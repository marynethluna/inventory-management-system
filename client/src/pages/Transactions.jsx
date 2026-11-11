import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CalendarRange,
  FilterX,
  Search,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, EmptyState, LoadingState, Pagination, SectionCard } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { StockMovementModal } from '../components/StockMovementModal';
import { formatDate, formatNumber } from '../utils/format';
import { can } from '../utils/permissions';

const LIMIT = 12;
const SUMMARY_TYPES = [
  { type: 'Stock In', label: 'Stock In', icon: ArrowDownToLine, tone: 'success' },
  { type: 'Stock Out', label: 'Stock Out', icon: ArrowUpFromLine, tone: 'warning' },
  { type: 'Borrowed', label: 'Borrowed', icon: ArrowLeftRight, tone: 'info' },
  { type: 'Returned', label: 'Returned', icon: ArrowLeftRight, tone: 'default' },
];
function SummaryFilterCard({ type, label, icon: Icon, tone, summary, active, onClick }) {
  return (
    <button type="button" className={`stat-card txn-filter-card ${tone} ${active ? 'active' : ''}`} onClick={onClick} aria-pressed={active}>
      <div className="stat-top">
        <div><div className="stat-label">{label}</div><div className="stat-value">{formatNumber(summary?.[type]?.quantity)}</div></div>
        <span className="stat-icon"><Icon size={17} /></span>
      </div>
      <div className="stat-sub">{summary?.[type]?.count || 0} transaction{summary?.[type]?.count === 1 ? '' : 's'} · {active ? 'active filter · click to clear' : 'click to filter'}</div>
    </button>
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
  const canRecord = can(user?.role, 'transactions:create');

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
  const transactions = data?.transactions || [];
  const refresh = () => setReloadKey((key) => key + 1);
  const handleSaved = (message) => { toast.success(message); refresh(); };

  const setFilterType = (nextType) => {
    setTypeFilter(nextType);
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ search: '', from: '', to: '' });
    setFilterType('All');
  };

  return (
    <>
      <PageHeader title="Stock Transactions" description="Review stock movements and keep every quantity change tied to a recorded transaction.">
        {canRecord && <button type="button" className="btn btn-primary" onClick={() => { setInitialType('Stock In'); setModalOpen(true); }}><Wrench size={15} /> Edit Stock</button>}
      </PageHeader>

      <div className="grid grid-stats transaction-summary" role="group" aria-label="Filter transactions by movement">
        {SUMMARY_TYPES.map((entry) => (
          <SummaryFilterCard
            key={entry.type}
            {...entry}
            summary={summary}
            active={typeFilter === entry.type}
            onClick={() => setFilterType(typeFilter === entry.type ? 'All' : entry.type)}
          />
        ))}
      </div>
      <div className="chip-row transaction-type-pills" role="group" aria-label="Other transaction type filters">
        <button type="button" className={`chip ${typeFilter === 'All' ? 'active' : ''}`} aria-pressed={typeFilter === 'All'} onClick={() => setFilterType('All')}>
          All
        </button>
        <button type="button" className={`chip ${typeFilter === 'Adjustment' ? 'active' : ''}`} aria-pressed={typeFilter === 'Adjustment'} onClick={() => setFilterType(typeFilter === 'Adjustment' ? 'All' : 'Adjustment')}>
          Adjustment <span className="count">{formatNumber(summary?.Adjustment?.count || 0)}</span>
        </button>
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search"><Search size={15} /><input className="input" placeholder="Search reference, item, supplier or person…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} aria-label="Search transactions" /></div>
          <div className="input-icon-wrap date-filter"><CalendarRange size={14} /><input type="date" className="input" value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} aria-label="From date" /></div>
          <div className="input-icon-wrap date-filter"><CalendarRange size={14} /><input type="date" className="input" value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} aria-label="To date" /></div>
          {(filters.search || filters.from || filters.to || typeFilter !== 'All') && <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}><FilterX size={14} /> Clear</button>}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} transaction(s)`}</span>
        </div>

        {loading ? (
          <LoadingState label="Loading stock transactions…" rows={6} columns={6} />
        ) : !transactions.length ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="No transactions found"
            description="Try another filter or record a stock movement if you have permission."
            action={canRecord ? <button type="button" className="btn btn-primary btn-sm" onClick={() => { setInitialType('Stock In'); setModalOpen(true); }}><Wrench size={14} /> Edit Stock</button> : null}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Item</th><th className="num">Qty</th><th className="num">Balance</th><th>Supplier / reason</th><th>Recorded by</th></tr></thead>
                <tbody>
                  {transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td className="nowrap">{formatDate(txn.date)}</td>
                      <td className="mono tiny">{txn.reference}</td>
                      <td><TransactionTypeBadge type={txn.type} /></td>
                      <td><div className="cell-main">{txn.itemName}</div><div className="cell-sub mono">{txn.itemCode}</div></td>
                      <td className="num"><strong className={txn.type === 'Stock In' || txn.type === 'Returned' ? 'text-success' : txn.type === 'Adjustment' ? 'muted' : 'text-warning'}>{txn.type === 'Stock In' || txn.type === 'Returned' ? '+' : txn.type === 'Adjustment' ? '±' : '−'}{formatNumber(txn.quantity)}</strong></td>
                      <td className="num">{formatNumber(txn.balanceAfter)}</td>
                      <td><div className="small">{txn.supplier || txn.reason || '—'}</div>{txn.remarks && <div className="cell-sub">{txn.remarks}</div>}</td>
                      <td><div className="small">{txn.recordedBy?.name || 'System seed'}</div>{txn.recordedBy?.username && <div className="cell-sub">@{txn.recordedBy.username}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="transactions" />
          </>
        )}
      </SectionCard>

      {canRecord && <StockMovementModal open={modalOpen} onClose={() => setModalOpen(false)} items={items} initialType={initialType} onSaved={handleSaved} />}
    </>
  );
}
