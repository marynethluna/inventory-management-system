import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  Clock,
  Layers,
  PackageCheck,
  PackageX,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, StatusBadge, EmptyState, SectionCard } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { formatDate, formatDateTime, formatNumber, relativeTime } from '../utils/format';
import { can } from '../utils/permissions';

const CHART_COLORS = ['#f28c28', '#1e1e1e', '#d9791b', '#8a8a8a', '#b35f0f', '#c9a06a', '#4a4a4a'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 7,
        padding: '8px 10px',
        boxShadow: 'var(--shadow-md)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)' }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: entry.color || entry.fill }} />
          <span>{entry.name}:</span>
          <strong style={{ color: 'var(--text)' }}>{formatNumber(entry.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const result = await api.get('/dashboard');
      setData(result);
    } catch {
      /* handled by the empty state */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const movementData = useMemo(
    () =>
      (data?.movement || []).map((entry) => ({
        ...entry,
        label: new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      })),
    [data?.movement]
  );

  const lowItems = data?.lowStockItems || [];
  const recentTransactions = data?.recentTransactions || [];
  const activities = data?.recentActivities || [];
  const activeBorrows = data?.activeBorrows || [];

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading the latest inventory information…" />
        <div className="grid grid-stats" style={{ marginBottom: 14 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="stat-card" key={index}>
              <div className="skeleton" style={{ width: '55%', height: 10 }} />
              <div className="skeleton" style={{ width: '40%', height: 22, marginTop: 6 }} />
            </div>
          ))}
        </div>
        <div className="grid grid-main">
          <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>
          <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name?.split(' ')[0] || 'there'}!`}
        description={`Here is the inventory overview as of ${formatDate(new Date())}.`}
      >
        <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spinner' : ''} style={refreshing ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          Refresh
        </button>
        {can(user?.role, 'transactions:create') && (
          <button type="button" className="btn btn-primary" onClick={() => navigate('/transactions?new=Stock%20In')}>
            <ArrowDownToLine size={15} /> Record stock in
          </button>
        )}
      </PageHeader>

      <div className="welcome-strip">
        <div>
          <h2>{greeting}, {user?.name?.split(' ')[0]}.</h2>
          <p>
            {stats?.lowStockItems > 0 || stats?.outOfStockItems > 0
              ? `${stats.lowStockItems} low-stock and ${stats.outOfStockItems} out-of-stock item(s) need attention.`
              : 'All inventory items are currently above their minimum stock levels.'}
          </p>
        </div>
        <div className="ws-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>
            View reports
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/inventory')}>
            Open inventory
          </button>
        </div>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Total Inventory Items" value={formatNumber(stats?.totalItems)} icon={Boxes} tone="dark" sub={`${stats?.totalCategories || 0} categories`} />
        <StatCard label="Total Available Stocks" value={formatNumber(stats?.totalAvailableStocks)} icon={PackageCheck} tone="accent" sub="Units across all items" />
        <StatCard label="Low-Stock Items" value={formatNumber(stats?.lowStockItems)} icon={AlertTriangle} tone="default" sub="At or below minimum level" onClick={() => navigate('/inventory?status=Low%20Stock')} />
        <StatCard label="Out-of-Stock Items" value={formatNumber(stats?.outOfStockItems)} icon={PackageX} tone="danger" sub="Requires replenishment" onClick={() => navigate('/inventory?status=Out%20of%20Stock')} />
        <StatCard label="Total Borrowed Items" value={formatNumber(stats?.totalBorrowedItems)} icon={ClipboardList} tone="default" sub={`${stats?.activeBorrowRecords || 0} active borrow record(s)`} onClick={() => navigate('/borrowing')} />
        <StatCard label="Overdue Returns" value={formatNumber(stats?.overdueBorrows)} icon={Clock} tone={stats?.overdueBorrows > 0 ? 'danger' : 'success'} sub={stats?.overdueBorrows > 0 ? 'Follow up with borrowers' : 'No overdue equipment'} onClick={() => navigate('/borrowing?status=Overdue')} />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 14 }}>
        <SectionCard
          title="Stock movement"
          description="Incoming and outgoing quantities over the last 7 days"
          icon={TrendingUp}
          actions={
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot" style={{ background: '#f28c28' }} /> Stock in</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#1e1e1e' }} /> Stock out</span>
            </div>
          }
        >
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(242,140,40,0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Bar dataKey="stockIn" name="Stock in" fill="#f28c28" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="stockOut" name="Stock out" fill="#1e1e1e" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 18, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <div className="tiny muted">Stock in this month</div>
              <div className="strong" style={{ fontSize: 16, color: 'var(--success)' }}>+{formatNumber(stats?.stockInThisMonth)} units</div>
            </div>
            <div>
              <div className="tiny muted">Stock out this month</div>
              <div className="strong" style={{ fontSize: 16, color: 'var(--warning)' }}>−{formatNumber(stats?.stockOutThisMonth)} units</div>
            </div>
            <div>
              <div className="tiny muted">Transactions this month</div>
              <div className="strong" style={{ fontSize: 16 }}>{formatNumber(stats?.transactionsThisMonth)}</div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Inventory by category" description="Share of available stock" icon={Layers}>
          {data?.categories?.length ? (
            <>
              <div className="chart-box sm">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="quantity"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {data.categories.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="cat-list" style={{ marginTop: 10 }}>
                {data.categories.slice(0, 5).map((category, index) => (
                  <div className="cat-row" key={category.name}>
                    <div className="cat-top">
                      <b style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span className="legend-dot" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                        {category.name}
                      </b>
                      <span>{formatNumber(category.quantity)} · {category.percent}%</span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.max(category.percent, 2)}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No category data yet" description="Categories and items will appear here once inventory records are added." />
          )}
        </SectionCard>
      </div>

      <div className="grid grid-main" style={{ marginBottom: 14 }}>
        <SectionCard
          title="Low-stock alerts"
          description="Items at or below their minimum stock level"
          icon={AlertTriangle}
          actions={<button type="button" className="btn-text" onClick={() => navigate('/inventory?status=Low%20Stock')}>View all</button>}
          className="flush"
          bodyClassName=""
        >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="num">Available</th>
                  <th className="num">Minimum</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lowItems.slice(0, 5).map((item) => (
                  <tr key={item.id} className={item.status !== 'In Stock' ? 'is-low' : ''}>
                    <td>
                      <div className="cell-main">{item.name}</div>
                      <div className="cell-sub">{item.itemCode} · {item.location || 'No location'}</div>
                    </td>
                    <td>{item.category}</td>
                    <td className="num"><strong>{formatNumber(item.quantity)}</strong> <span className="tiny muted">{item.unit}</span></td>
                    <td className="num">{formatNumber(item.minimumStock)}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
                {!lowItems.length && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No low-stock items" description="Every item is above its minimum stock level." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Recent system activities"
          description="Latest actions recorded in the audit trail"
          icon={Clock}
          actions={user?.role === 'Administrator' ? <button type="button" className="btn-text" onClick={() => navigate('/logs')}>View logs</button> : null}
        >
          <div className="timeline">
            {activities.map((activity) => (
              <div className="timeline-item" key={activity.id}>
                <div className="timeline-dot"><ArrowLeftRight size={13} /></div>
                <div className="timeline-body">
                  <b>{activity.action}</b>
                  <small>{activity.entityLabel || activity.details || activity.actorName}</small>
                  <div className="time">{activity.actorName} · {relativeTime(activity.createdAt)}</div>
                </div>
              </div>
            ))}
            {!activities.length && <EmptyState title="No activity recorded" description="Important actions will appear here." />}
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-main">
        <SectionCard
          title="Recent inventory transactions"
          description="Latest stock movements across all items"
          icon={ArrowLeftRight}
          actions={<button type="button" className="btn-text" onClick={() => navigate('/transactions')}>View all</button>}
          className="flush"
        >
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th className="num">Balance</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="nowrap">{formatDate(txn.date)}</td>
                    <td>
                      <div className="cell-main">{txn.itemName}</div>
                      <div className="cell-sub">{txn.itemCode}</div>
                    </td>
                    <td><TransactionTypeBadge type={txn.type} /></td>
                    <td className="num">{txn.type === 'Stock Out' || txn.type === 'Borrowed' ? '−' : '+'}{formatNumber(txn.quantity)}</td>
                    <td className="num">{formatNumber(txn.balanceAfter)}</td>
                    <td>{txn.recordedBy?.name || '—'}</td>
                  </tr>
                ))}
                {!recentTransactions.length && (
                  <tr>
                    <td colSpan={6}><EmptyState title="No transactions yet" description="Stock movements will appear here." /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Active borrowings"
          description="Equipment currently released to borrowers"
          icon={ClipboardList}
          actions={<button type="button" className="btn-text" onClick={() => navigate('/borrowing')}>Manage</button>}
        >
          <div className="alert-list">
            {activeBorrows.map((borrow) => (
              <div className="alert-row" key={borrow.id}>
                <div className="notif-icon info" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
                  <ClipboardList size={14} />
                </div>
                <div className="alert-main">
                  <b>{borrow.itemName} × {borrow.quantity}</b>
                  <small>{borrow.borrowerName} · due {formatDate(borrow.expectedReturnDate)}</small>
                </div>
                <span className={`badge ${borrow.displayStatus === 'Overdue' ? 'badge-danger' : 'badge-info'}`}>{borrow.displayStatus}</span>
              </div>
            ))}
            {!activeBorrows.length && (
              <EmptyState title="No active borrowings" description="Borrowed equipment will be listed here until returned." />
            )}
          </div>
          {!!stats?.borrowedThisMonth && (
            <div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', gap: 16 }}>
              <div className="tiny muted">Borrowed this month</div>
              <div className="strong" style={{ fontSize: 13 }}>{formatNumber(stats.borrowedThisMonth)} units</div>
              <div className="tiny muted">· Returned</div>
              <div className="strong" style={{ fontSize: 13 }}>{formatNumber(stats.returnedThisMonth)} units</div>
            </div>
          )}
        </SectionCard>
      </div>

      <p className="tiny muted" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowUpFromLine size={12} /> Data refreshed from MongoDB at {formatDateTime(data?.generatedAt)}. Figures update automatically after every transaction.
      </p>
    </>
  );
}
