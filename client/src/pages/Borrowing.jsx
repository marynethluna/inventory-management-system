import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FilterX,
  Plus,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, Pagination, SectionCard } from '../components/common';
import { BorrowStatusBadge } from '../components/badges';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { addDaysISO, formatDate, formatNumber, todayISO } from '../utils/format';
import { can } from '../utils/permissions';

const LIMIT = 12;
const STATUS_TABS = ['All', 'Borrowed', 'Overdue', 'Returned'];

function BorrowModal({ open, onClose, items, onSaved }) {
  const [form, setForm] = useState({
    borrowerName: '',
    borrowerIdNumber: '',
    itemId: '',
    quantity: 1,
    dateBorrowed: todayISO(),
    expectedReturnDate: addDaysISO(7),
    remarks: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      borrowerName: '',
      borrowerIdNumber: '',
      itemId: items[0]?.id || '',
      quantity: 1,
      dateBorrowed: todayISO(),
      expectedReturnDate: addDaysISO(7),
      remarks: '',
    });
    setErrors({});
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selected = useMemo(() => items.find((item) => item.id === form.itemId), [items, form.itemId]);

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const next = {};
    if (!form.borrowerName.trim() || form.borrowerName.trim().length < 2) next.borrowerName = "Enter the borrower's full name.";
    if (!form.borrowerIdNumber.trim()) next.borrowerIdNumber = "Enter the borrower's ID or reference number.";
    if (!form.itemId) next.itemId = 'Select an item to borrow.';
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1) next.quantity = 'Quantity must be at least 1.';
    if (selected && Number(form.quantity) > selected.quantity) next.quantity = `Only ${selected.quantity} ${selected.unit} available.`;
    if (!form.expectedReturnDate) next.expectedReturnDate = 'Set an expected return date.';
    if (form.expectedReturnDate && form.dateBorrowed && form.expectedReturnDate < form.dateBorrowed) next.expectedReturnDate = 'Return date cannot be before the borrowing date.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await api.post('/borrows', {
        borrowerName: form.borrowerName.trim(),
        borrowerIdNumber: form.borrowerIdNumber.trim(),
        itemId: form.itemId,
        quantity: Number(form.quantity),
        dateBorrowed: form.dateBorrowed,
        expectedReturnDate: form.expectedReturnDate,
        remarks: form.remarks,
      });
      onSaved('Borrowing recorded. The available stock has been updated.');
      onClose();
    } catch (error) {
      setServerError(error.message || 'Unable to record the borrowing.');
      if (error.details) {
        const next = {};
        error.details.forEach((detail) => { next[detail.field] = detail.message; });
        setErrors(next);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record borrowed equipment"
      description="The borrowed quantity is deducted from available stock until the item is returned."
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="borrow-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} Record borrowing
          </button>
        </>
      }
    >
      <form id="borrow-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="borrower-name">Borrower's name <span className="req">*</span></label>
            <input id="borrower-name" className={`input ${errors.borrowerName ? 'invalid' : ''}`} value={form.borrowerName} onChange={(event) => setForm({ ...form, borrowerName: event.target.value })} placeholder="e.g. Prof. Elena Santos" maxLength={100} />
            {errors.borrowerName && <span className="field-error">{errors.borrowerName}</span>}
          </div>
          <div className="field">
            <label htmlFor="borrower-id">Borrower's ID / reference <span className="req">*</span></label>
            <input id="borrower-id" className={`input ${errors.borrowerIdNumber ? 'invalid' : ''}`} value={form.borrowerIdNumber} onChange={(event) => setForm({ ...form, borrowerIdNumber: event.target.value })} placeholder="e.g. FAC-2041" maxLength={40} />
            {errors.borrowerIdNumber && <span className="field-error">{errors.borrowerIdNumber}</span>}
          </div>
          <div className="field span-2">
            <label htmlFor="borrow-item">Item to borrow <span className="req">*</span></label>
            <select id="borrow-item" className={`select ${errors.itemId ? 'invalid' : ''}`} value={form.itemId} onChange={(event) => setForm({ ...form, itemId: event.target.value })}>
              <option value="">Select an item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} — {formatNumber(item.quantity)} {item.unit} available</option>
              ))}
            </select>
            {errors.itemId && <span className="field-error">{errors.itemId}</span>}
            {selected && <span className="field-hint">{selected.itemCode} · {selected.category} · {selected.location || 'No location'}</span>}
          </div>
          <div className="field">
            <label htmlFor="borrow-qty">Quantity <span className="req">*</span></label>
            <input id="borrow-qty" type="number" min={1} step={1} className={`input ${errors.quantity ? 'invalid' : ''}`} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            {errors.quantity && <span className="field-error">{errors.quantity}</span>}
          </div>
          <div className="field">
            <label htmlFor="borrow-date">Date borrowed</label>
            <input id="borrow-date" type="date" className="input" value={form.dateBorrowed} max={todayISO()} onChange={(event) => setForm({ ...form, dateBorrowed: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="borrow-return">Expected return date <span className="req">*</span></label>
            <input id="borrow-return" type="date" className={`input ${errors.expectedReturnDate ? 'invalid' : ''}`} value={form.expectedReturnDate} onChange={(event) => setForm({ ...form, expectedReturnDate: event.target.value })} />
            {errors.expectedReturnDate && <span className="field-error">{errors.expectedReturnDate}</span>}
          </div>
          <div className="field">
            <label htmlFor="borrow-remarks">Remarks</label>
            <input id="borrow-remarks" className="input" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Purpose or class/room" maxLength={300} />
          </div>
        </div>
        {serverError && <div className="login-error" style={{ marginTop: 12 }}>{serverError}</div>}
      </form>
    </Modal>
  );
}

export default function Borrowing() {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('All');
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isStaff = can(user?.role, 'borrows:create');

  useEffect(() => {
    api.get('/items', { limit: 100 }).then((result) => setItems(result.items)).catch(() => setItems([]));
  }, [reloadKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/borrows', {
        status,
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
  }, [status, filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const summary = data?.summary || {};
  const refresh = () => setReloadKey((key) => key + 1);

  const handleReturn = async () => {
    if (!returnTarget) return;
    setReturnLoading(true);
    try {
      await api.post(`/borrows/${returnTarget.id}/return`);
      toast.success(`Return recorded for ${returnTarget.borrowerName}.`);
      setReturnTarget(null);
      refresh();
    } catch (error) {
      toast.error(error.message || 'Unable to record the return.');
    } finally {
      setReturnLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Borrowing & Returns"
        description="Track school equipment released to students and faculty. Available stock is deducted when borrowed and restored when returned."
      >
        {isStaff && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Record borrowing
          </button>
        )}
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Active Borrowings" value={formatNumber(summary.Borrowed?.count || 0)} icon={ClipboardList} tone="dark" sub={`${formatNumber(summary.Borrowed?.quantity || 0)} units currently out`} />
        <StatCard label="Overdue" value={formatNumber(data?.overdueCount || 0)} icon={Clock} tone="danger" sub="Past the expected return date" />
        <StatCard label="Returned" value={formatNumber(summary.Returned?.count || 0)} icon={CheckCircle2} tone="success" sub={`${formatNumber(summary.Returned?.quantity || 0)} units returned`} />
        <StatCard label="Total Records" value={formatNumber(data?.total || 0)} icon={RotateCcw} tone="default" sub="All borrowing records" />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input className="input" placeholder="Search borrower, ID, item or reference…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} aria-label="Search borrowing records" />
          </div>
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} aria-label="From date" />
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} aria-label="To date" />
          {(filters.search || filters.from || filters.to || status !== 'All') && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ search: '', from: '', to: '' }); setStatus('All'); setPage(1); }}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} record(s)`}</span>
        </div>

        <div className="chip-row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          {STATUS_TABS.map((tab) => (
            <button type="button" key={tab} className={`chip ${status === tab ? 'active' : ''}`} onClick={() => { setStatus(tab); setPage(1); }}>
              {tab === 'All' ? 'All records' : tab}
              {tab === 'Borrowed' && summary.Borrowed?.count ? <span className="count">{summary.Borrowed.count}</span> : null}
              {tab === 'Returned' && summary.Returned?.count ? <span className="count">{summary.Returned.count}</span> : null}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading borrowing records…" rows={6} columns={6} />
        ) : !data?.borrows?.length ? (
          <EmptyState
            icon={ClipboardList}
            title="No borrowing records found"
            description="Record borrowed equipment to track who has it, when it is due and when it was returned."
            action={isStaff ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Record borrowing</button> : null}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Borrower</th>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th>Date borrowed</th>
                    <th>Expected return</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.borrows.map((borrow) => (
                    <tr key={borrow.id} className={borrow.displayStatus === 'Overdue' ? 'is-low' : ''}>
                      <td>
                        <div className="mono tiny">{borrow.reference}</div>
                        <div className="cell-sub">{borrow.recordedBy?.name ? `by ${borrow.recordedBy.name}` : ''}</div>
                      </td>
                      <td>
                        <div className="cell-main">{borrow.borrowerName}</div>
                        <div className="cell-sub">{borrow.borrowerIdNumber}</div>
                      </td>
                      <td>
                        <div className="cell-main">{borrow.itemName}</div>
                        <div className="cell-sub mono">{borrow.itemCode}</div>
                      </td>
                      <td className="num"><strong>{formatNumber(borrow.quantity)}</strong> <span className="tiny muted">{borrow.unit}</span></td>
                      <td className="nowrap">{formatDate(borrow.dateBorrowed)}</td>
                      <td className="nowrap">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <CalendarClock size={12} style={{ color: 'var(--muted-light)' }} />
                          {formatDate(borrow.expectedReturnDate)}
                        </span>
                        {borrow.actualReturnDate && <div className="cell-sub">Returned {formatDate(borrow.actualReturnDate)}</div>}
                      </td>
                      <td><BorrowStatusBadge status={borrow.displayStatus} /></td>
                      <td className="actions text-right">
                        {borrow.displayStatus !== 'Returned' && isStaff ? (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReturnTarget(borrow)}>
                            <Undo2 size={13} /> Return
                          </button>
                        ) : (
                          <span className="tiny muted">{borrow.displayStatus === 'Returned' ? 'Completed' : 'No action'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="records" />
          </>
        )}
      </SectionCard>

      <BorrowModal open={modalOpen} onClose={() => setModalOpen(false)} items={items} onSaved={(message) => { toast.success(message); refresh(); }} />

      <ConfirmDialog
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        onConfirm={handleReturn}
        title="Record item return"
        message={`Confirm that ${returnTarget?.borrowerName} returned ${returnTarget?.quantity} ${returnTarget?.unit || 'unit(s)'} of ${returnTarget?.itemName}. The quantity will be added back to the available stock.`}
        confirmLabel="Record return"
        tone="info"
        loading={returnLoading}
      />
    </>
  );
}
