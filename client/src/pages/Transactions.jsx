import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CalendarRange,
  FilterX,
  Plus,
  Search,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, Pagination, SectionCard } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { Modal } from '../components/Modal';
import { formatDate, formatNumber, todayISO } from '../utils/format';
import { can } from '../utils/permissions';

const LIMIT = 12;
const TYPE_FILTERS = ['All', 'Stock In', 'Stock Out', 'Borrowed', 'Returned', 'Adjustment'];

function TransactionModal({ open, onClose, items, initialType, onSaved }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Administrator';
  const [type, setType] = useState(initialType || 'Stock In');
  const [form, setForm] = useState({ itemId: '', quantity: 1, date: todayISO(), supplier: '', reason: '', remarks: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initialType || 'Stock In');
    setForm({ itemId: items[0]?.id || '', quantity: 1, date: todayISO(), supplier: '', reason: '', remarks: '' });
    setError('');
    setFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);

  const selectedItem = useMemo(() => items.find((item) => item.id === form.itemId), [items, form.itemId]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const next = {};
    if (!form.itemId) next.itemId = 'Select an inventory item.';
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < (type === 'Adjustment' ? 0 : 1)) {
      next.quantity = type === 'Adjustment' ? 'Enter a counted quantity of 0 or more.' : 'Quantity must be a whole number of at least 1.';
    }
    if (type === 'Stock Out' && selectedItem && Number(form.quantity) > selectedItem.quantity) {
      next.quantity = `Only ${selectedItem.quantity} ${selectedItem.unit} available.`;
    }
    if (type !== 'Stock In' && !form.reason.trim()) next.reason = type === 'Adjustment' ? 'A reason is required for adjustments.' : 'Provide a reason for releasing the stock.';
    setFieldErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api.post('/transactions', {
        type,
        itemId: form.itemId,
        quantity: Number(form.quantity),
        date: form.date,
        supplier: form.supplier,
        reason: form.reason,
        remarks: form.remarks,
      });
      onSaved(type === 'Stock In' ? 'Stock in recorded successfully.' : type === 'Stock Out' ? 'Stock out recorded successfully.' : 'Stock adjusted successfully.');
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to record the transaction.');
      if (err.details) {
        const next = {};
        err.details.forEach((detail) => { next[detail.field] = detail.message; });
        setFieldErrors(next);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record stock transaction"
      description="Every movement updates the available quantity and is written to the audit trail."
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="txn-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} Save transaction
          </button>
        </>
      }
    >
      <form id="txn-form" onSubmit={submit} noValidate>
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button type="button" className={`chip ${type === 'Stock In' ? 'active' : ''}`} onClick={() => setType('Stock In')}>
            <ArrowDownToLine size={13} /> Stock in
          </button>
          <button type="button" className={`chip ${type === 'Stock Out' ? 'active' : ''}`} onClick={() => setType('Stock Out')}>
            <ArrowUpFromLine size={13} /> Stock out
          </button>
          {isAdmin && (
            <button type="button" className={`chip ${type === 'Adjustment' ? 'active' : ''}`} onClick={() => setType('Adjustment')}>
              <Wrench size={13} /> Adjustment
            </button>
          )}
        </div>

        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="txn-item">Inventory item <span className="req">*</span></label>
            <select id="txn-item" className={`select ${fieldErrors.itemId ? 'invalid' : ''}`} value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
              <option value="">Select an item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} — {formatNumber(item.quantity)} {item.unit} available ({item.itemCode})</option>
              ))}
            </select>
            {fieldErrors.itemId && <span className="field-error">{fieldErrors.itemId}</span>}
            {selectedItem && (
              <span className="field-hint">
                Current stock: <strong>{formatNumber(selectedItem.quantity)} {selectedItem.unit}</strong> · Minimum level {formatNumber(selectedItem.minimumStock)} · {selectedItem.category}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="txn-qty">{type === 'Adjustment' ? 'Counted quantity' : 'Quantity'} <span className="req">*</span></label>
            <input id="txn-qty" type="number" min={type === 'Adjustment' ? 0 : 1} step={1} className={`input ${fieldErrors.quantity ? 'invalid' : ''}`} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            {fieldErrors.quantity ? <span className="field-error">{fieldErrors.quantity}</span> : <span className="field-hint">{type === 'Adjustment' ? 'The stock level will be set to this counted value.' : 'Whole units only.'}</span>}
          </div>

          <div className="field">
            <label htmlFor="txn-date">Transaction date</label>
            <input id="txn-date" type="date" className="input" value={form.date} max={todayISO()} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </div>

          {type === 'Stock In' && (
            <div className="field span-2">
              <label htmlFor="txn-supplier">Supplier / source</label>
              <input id="txn-supplier" className="input" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="e.g. National Book Store" maxLength={120} />
            </div>
          )}

          {type !== 'Stock In' && (
            <div className="field span-2">
              <label htmlFor="txn-reason">{type === 'Adjustment' ? 'Reason for adjustment' : 'Reason for releasing'} <span className="req">*</span></label>
              <input id="txn-reason" className={`input ${fieldErrors.reason ? 'invalid' : ''}`} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder={type === 'Adjustment' ? 'e.g. Physical count correction' : 'e.g. Classroom distribution'} maxLength={160} />
              {fieldErrors.reason && <span className="field-error">{fieldErrors.reason}</span>}
            </div>
          )}

          <div className="field span-2">
            <label htmlFor="txn-remarks">Remarks</label>
            <textarea id="txn-remarks" className="textarea" rows={2} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Optional notes about this transaction" maxLength={300} />
          </div>
        </div>

        {type === 'Adjustment' && (
          <div className="login-note" style={{ marginTop: 12 }}>
            <Wrench size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Adjustments are restricted to administrators and are recorded in the transaction history with the reason you provide.</span>
          </div>
        )}
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </Modal>
  );
}

export default function Transactions() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState('All');
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialType, setInitialType] = useState('Stock In');
  const [reloadKey, setReloadKey] = useState(0);

  const isStaff = can(user?.role, 'transactions:create');

  useEffect(() => {
    const nextType = searchParams.get('new');
    if (nextType) {
      setInitialType(nextType);
      setModalOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    api.get('/items', { limit: 100 }).then((result) => setItems(result.items)).catch(() => setItems([]));
  }, [reloadKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/transactions', {
        type: typeFilter === 'All' ? '' : typeFilter,
        search: filters.search,
        from: filters.from,
        to: filters.to,
        page,
        limit: LIMIT,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const summary = data?.summary || {};
  const refresh = () => setReloadKey((key) => key + 1);

  const handleSaved = (message) => {
    toast.success(message);
    refresh();
  };

  const openModal = (type = 'Stock In') => {
    setInitialType(type);
    setModalOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Stock Transactions"
        description="Record incoming and outgoing stock. Available quantities update automatically and every movement is logged."
      >
        {isStaff && (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => openModal('Stock Out')}>
              <ArrowUpFromLine size={15} /> Stock out
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openModal('Stock In')}>
              <Plus size={15} /> Stock in
            </button>
          </>
        )}
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Stock In" value={formatNumber(summary['Stock In']?.quantity)} icon={ArrowDownToLine} tone="success" sub={`${summary['Stock In']?.count || 0} transaction(s)`} />
        <StatCard label="Stock Out" value={formatNumber(summary['Stock Out']?.quantity)} icon={ArrowUpFromLine} tone="warning" sub={`${summary['Stock Out']?.count || 0} transaction(s)`} />
        <StatCard label="Borrowed" value={formatNumber(summary.Borrowed?.quantity)} icon={ArrowLeftRight} tone="default" sub={`${summary.Borrowed?.count || 0} record(s)`} />
        <StatCard label="Returned" value={formatNumber(summary.Returned?.quantity)} icon={ArrowLeftRight} tone="default" sub={`${summary.Returned?.count || 0} record(s)`} />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input className="input" placeholder="Search reference, item, supplier or person…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} aria-label="Search transactions" />
          </div>
          <div className="input-icon-wrap" style={{ position: 'relative', minWidth: 140 }}>
            <CalendarRange size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
            <input type="date" className="input" style={{ paddingLeft: 30 }} value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} aria-label="From date" />
          </div>
          <div className="input-icon-wrap" style={{ position: 'relative', minWidth: 140 }}>
            <CalendarRange size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', zIndex: 1 }} />
            <input type="date" className="input" style={{ paddingLeft: 30 }} value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} aria-label="To date" />
          </div>
          {(filters.search || filters.from || filters.to || typeFilter !== 'All') && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ search: '', from: '', to: '' }); setTypeFilter('All'); setPage(1); }}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} transaction(s)`}</span>
        </div>

        <div className="chip-row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          {TYPE_FILTERS.map((type) => (
            <button type="button" key={type} className={`chip ${typeFilter === type ? 'active' : ''}`} onClick={() => { setTypeFilter(type); setPage(1); }}>
              {type === 'All' ? 'All transactions' : type}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading stock transactions…" rows={6} columns={6} />
        ) : !data?.transactions?.length ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No transactions found"
            description="Stock movements will appear here once inventory staff record stock in, stock out or borrowing activity."
            action={isStaff ? <button type="button" className="btn btn-primary btn-sm" onClick={() => openModal('Stock In')}><Plus size={14} /> Record stock in</button> : null}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Balance</th>
                    <th>Supplier / reason</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td className="nowrap">{formatDate(txn.date)}</td>
                      <td className="mono tiny">{txn.reference}</td>
                      <td><TransactionTypeBadge type={txn.type} /></td>
                      <td>
                        <div className="cell-main">{txn.itemName}</div>
                        <div className="cell-sub mono">{txn.itemCode}</div>
                      </td>
                      <td className="num">
                        <strong style={{ color: txn.type === 'Stock In' || txn.type === 'Returned' ? 'var(--success)' : txn.type === 'Adjustment' ? 'var(--muted)' : 'var(--warning)' }}>
                          {txn.type === 'Stock In' || txn.type === 'Returned' ? '+' : txn.type === 'Adjustment' ? '±' : '−'}{formatNumber(txn.quantity)}
                        </strong>
                      </td>
                      <td className="num">{formatNumber(txn.balanceAfter)}</td>
                      <td>
                        <div className="small">{txn.supplier || txn.reason || '—'}</div>
                        {txn.remarks && <div className="cell-sub">{txn.remarks}</div>}
                      </td>
                      <td>
                        <div className="small">{txn.recordedBy?.name || '—'}</div>
                        <div className="cell-sub">@{txn.recordedBy?.username || 'system'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="transactions" />
          </>
        )}
      </SectionCard>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        items={items}
        initialType={initialType}
        onSaved={handleSaved}
      />
    </>
  );
}
