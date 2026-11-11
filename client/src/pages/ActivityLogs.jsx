import { useCallback, useEffect, useState } from 'react';
import { Activity, Download, FileClock, FilterX, History, Search, ShieldCheck } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, Pagination, SectionCard, RoleBadge } from '../components/common';
import { exportCSV, formatDate, formatDateTime, relativeTime } from '../utils/format';

const LIMIT = 20;

export default function ActivityLogs() {
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/activity-logs', { ...filters, page, limit: LIMIT });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    const timer = setTimeout(load, 220);
    return () => clearTimeout(timer);
  }, [load, reloadKey]);

  const logs = data?.logs || [];
  const actions = data?.actions || [];

  const handleExport = () => {
    if (!logs.length) {
      toast.error('There are no log entries to export.');
      return;
    }
    exportCSV(
      `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: 'createdAt', label: 'Date and time' },
        { key: 'actorName', label: 'User' },
        { key: 'actorUsername', label: 'Username' },
        { key: 'actorRole', label: 'Role' },
        { key: 'action', label: 'Action' },
        { key: 'entityType', label: 'Record type' },
        { key: 'entityLabel', label: 'Affected record' },
        { key: 'details', label: 'Details' },
      ],
      logs
    );
    toast.success('Activity log exported.');
  };

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description="A complete audit trail of important inventory, account and administrative actions."
      >
        <button type="button" className="btn btn-secondary" onClick={handleExport}>
          <Download size={15} /> Export CSV
        </button>
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Total Log Entries" value={data?.total || 0} icon={History} tone="dark" sub="All recorded activities" />
        <StatCard label="Distinct Actions" value={actions.length} icon={Activity} sub="Types of recorded actions" />
        <StatCard label="Latest Activity" value={logs[0] ? relativeTime(logs[0].createdAt) : '—'} icon={FileClock} tone="accent" sub={logs[0]?.action || 'No activity yet'} />
        <StatCard label="Audit Status" value="Enabled" icon={ShieldCheck} tone="success" sub="All mutations are recorded" />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input className="input" placeholder="Search action, user, record or details…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} aria-label="Search activity logs" />
          </div>
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.from} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPage(1); }} aria-label="From date" />
          <input type="date" className="input" style={{ width: 'auto' }} value={filters.to} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPage(1); }} aria-label="To date" />
          {(filters.search || filters.from || filters.to) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFilters({ search: '', from: '', to: '' }); setPage(1); }}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} entries`}</span>
        </div>

        {actions.length > 0 && (
          <div className="chip-row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            {actions.slice(0, 8).map((action) => (
              <button
                type="button"
                key={action.action}
                className={`chip ${filters.search === action.action ? 'active' : ''}`}
                onClick={() => { setFilters({ ...filters, search: action.action }); setPage(1); }}
              >
                {action.action} <span className="count">{action.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <LoadingState label="Loading activity logs…" rows={7} columns={5} />
        ) : !logs.length ? (
          <EmptyState icon={History} title="No activity recorded" description="Important actions such as stock movements, account changes and category updates will appear here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date and time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Affected record</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap">
                        <div className="small">{formatDateTime(log.createdAt)}</div>
                        <div className="cell-sub">{relativeTime(log.createdAt)}</div>
                      </td>
                      <td>
                        <div className="cell-main">{log.actorName}</div>
                        <div className="cell-sub">@{log.actorUsername}</div>
                        {log.actorRole && <div style={{ marginTop: 3 }}><RoleBadge role={log.actorRole} /></div>}
                      </td>
                      <td><span className="badge badge-orange no-dot">{log.action}</span></td>
                      <td>
                        <div className="small">{log.entityLabel || log.entityType || '—'}</div>
                        {log.entityType && <div className="cell-sub">{log.entityType}</div>}
                      </td>
                      <td>
                        <div className="small muted" style={{ maxWidth: 360 }}>{log.details || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="log entries" />
          </>
        )}
      </SectionCard>

      <p className="tiny muted" style={{ marginTop: 12 }}>
        Logs are stored in MongoDB and cannot be edited or deleted from the application. The latest entry on this page was recorded on {logs[0] ? formatDate(logs[0].createdAt) : '—'}.
      </p>
    </>
  );
}
