import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from './Modal';
import { formatNumber, todayISO } from '../utils/format';
import { can } from '../utils/permissions';

const ACTIONS = [
  { value: 'Stock In', label: 'Stock In' },
  { value: 'Stock Out', label: 'Stock Out' },
  { value: 'Adjustment', label: 'Adjustment', adminOnly: true },
];

export function StockMovementModal({
  open,
  onClose,
  items = [],
  initialType = 'Stock In',
  initialItem = null,
  onSaved,
}) {
  const { user } = useAuth();
  const canRecord = can(user?.role, 'transactions:create');
  const isAdmin = user?.role === 'Administrator';
  const actions = ACTIONS.filter((action) => !action.adminOnly || isAdmin);
  const selectableItems = useMemo(() => {
    if (!initialItem || items.some((item) => item.id === initialItem.id)) return items;
    return [initialItem, ...items];
  }, [initialItem, items]);

  const [action, setAction] = useState('Stock In');
  const [form, setForm] = useState({ itemId: '', quantity: '1', date: todayISO(), supplier: '', reason: '', notes: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const nextAction = actions.some((entry) => entry.value === initialType) ? initialType : 'Stock In';
    const nextItemId = selectableItems.some((item) => item.id === initialItem?.id)
      ? initialItem.id
      : selectableItems[0]?.id || '';
    setAction(nextAction);
    setForm({ itemId: nextItemId, quantity: '1', date: todayISO(), supplier: '', reason: '', notes: '' });
    setFieldErrors({});
    setError('');
    // Reset only when the modal opens or its preselected item/action changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType, initialItem?.id, isAdmin]);

  const selectedItem = useMemo(
    () => selectableItems.find((item) => item.id === form.itemId),
    [selectableItems, form.itemId]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const nextErrors = {};
    const quantityInput = form.quantity.trim();
    const quantity = Number(quantityInput);

    if (!form.itemId || !selectedItem) nextErrors.itemId = 'Select an active inventory item.';
    const minimum = action === 'Adjustment' ? 0 : 1;
    if (!quantityInput || !Number.isSafeInteger(quantity) || quantity < minimum || quantity > 1_000_000) {
      nextErrors.quantity = action === 'Adjustment'
        ? 'Enter a whole counted quantity from 0 to 1,000,000.'
        : 'Quantity must be a positive whole number from 1 to 1,000,000.';
    }
    if (action === 'Stock Out' && selectedItem && quantity > selectedItem.quantity) {
      nextErrors.quantity = `Only ${formatNumber(selectedItem.quantity)} ${selectedItem.unit} available.`;
    }
    if (action === 'Adjustment' && selectedItem && quantity === selectedItem.quantity) {
      nextErrors.quantity = 'The count matches current stock; no adjustment is needed.';
    }
    if (action !== 'Stock In' && !form.reason.trim()) {
      nextErrors.reason = action === 'Adjustment' ? 'A reason is required for an adjustment.' : 'Provide a reason for releasing stock.';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await api.post('/transactions', {
        type: action,
        itemId: form.itemId,
        quantity,
        date: form.date,
        supplier: form.supplier.trim(),
        reason: form.reason.trim(),
        remarks: form.notes.trim(),
      });
      const message = action === 'Stock In'
        ? 'Stock in recorded successfully.'
        : action === 'Stock Out'
          ? 'Stock out recorded successfully.'
          : 'Stock adjustment recorded successfully.';
      onSaved?.(message);
      onClose?.();
    } catch (requestError) {
      setError(requestError.message || 'Unable to record this stock movement.');
      if (requestError.details) {
        const mapped = {};
        requestError.details.forEach((detail) => { mapped[detail.field] = detail.message; });
        setFieldErrors(mapped);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!canRecord) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Stock"
      description="Choose an action, item and quantity. Every stock change is recorded in the transaction history."
      size="wide"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="stock-movement-form" className="btn btn-primary" disabled={saving || !selectableItems.length}>
            {saving && <span className="spinner" />}
            Save stock movement
          </button>
        </>
      )}
    >
      <form id="stock-movement-form" onSubmit={submit} noValidate>
        <div className="form-grid stock-form-grid">
          <div className="field span-2">
            <label htmlFor="stock-action">Action <span className="req">*</span></label>
            <select id="stock-action" className="select" value={action} onChange={(event) => { setAction(event.target.value); setFieldErrors({}); setError(''); }}>
              {actions.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}
            </select>
          </div>

          <div className="field span-2">
            <label htmlFor="stock-item">Inventory item <span className="req">*</span></label>
            <select
              id="stock-item"
              className={`select ${fieldErrors.itemId ? 'invalid' : ''}`}
              value={form.itemId}
              onChange={(event) => { setForm({ ...form, itemId: event.target.value }); setFieldErrors((current) => ({ ...current, itemId: '', quantity: '' })); }}
            >
              <option value="">Select an item</option>
              {selectableItems.filter((item) => item.isActive !== false).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {formatNumber(item.quantity)} {item.unit} available ({item.itemCode})
                </option>
              ))}
            </select>
            {fieldErrors.itemId && <span className="field-error">{fieldErrors.itemId}</span>}
            {selectedItem && <span className="field-hint">Current balance: <strong>{formatNumber(selectedItem.quantity)} {selectedItem.unit}</strong> · Minimum {formatNumber(selectedItem.minimumStock)}</span>}
          </div>

          <div className="field">
            <label htmlFor="stock-quantity">{action === 'Adjustment' ? 'Counted quantity' : 'Quantity'} <span className="req">*</span></label>
            <input
              id="stock-quantity"
              type="number"
              min={action === 'Adjustment' ? 0 : 1}
              max={1_000_000}
              step={1}
              inputMode="numeric"
              className={`input ${fieldErrors.quantity ? 'invalid' : ''}`}
              value={form.quantity}
              onChange={(event) => { setForm({ ...form, quantity: event.target.value }); setFieldErrors((current) => ({ ...current, quantity: '' })); }}
            />
            {fieldErrors.quantity && <span className="field-error">{fieldErrors.quantity}</span>}
          </div>

          <div className="field">
            <label htmlFor="stock-date">Transaction date</label>
            <input id="stock-date" type="date" className="input" value={form.date} max={todayISO()} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </div>

          {action === 'Stock In' ? (
            <div className="field span-2">
              <label htmlFor="stock-supplier">Supplier / source</label>
              <input id="stock-supplier" className="input" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="e.g. School procurement delivery" maxLength={120} />
            </div>
          ) : (
            <div className="field span-2">
              <label htmlFor="stock-reason">{action === 'Adjustment' ? 'Reason for adjustment' : 'Reason for release'} <span className="req">*</span></label>
              <input id="stock-reason" className={`input ${fieldErrors.reason ? 'invalid' : ''}`} value={form.reason} onChange={(event) => { setForm({ ...form, reason: event.target.value }); setFieldErrors((current) => ({ ...current, reason: '' })); }} placeholder={action === 'Adjustment' ? 'e.g. Verified physical count' : 'e.g. Computer-lab equipment issue'} maxLength={160} />
              {fieldErrors.reason && <span className="field-error">{fieldErrors.reason}</span>}
            </div>
          )}

          <div className="field span-2">
            <label htmlFor="stock-notes">Notes</label>
            <textarea id="stock-notes" className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional notes for the transaction history" maxLength={300} />
          </div>
        </div>
        {action === 'Adjustment' && <div className="login-note" style={{ marginTop: 12 }}><AlertTriangle size={14} /><span>Adjustments are Administrator-only and set an exact counted quantity.</span></div>}
        {error && <div className="login-error" style={{ marginTop: 12 }} role="alert">{error}</div>}
      </form>
    </Modal>
  );
}
