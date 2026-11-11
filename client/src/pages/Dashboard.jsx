import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, StatusBadge, EmptyState, SectionCard } from '../components/common';
import { TransactionTypeBadge } from '../components/badges';
import { ChartCard } from '../components/ChartCard';
import { formatDate, formatDateTime, formatNumber } from '../utils/format';
import { can } from '../utils/permissions';

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
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const movement = useMemo(
    () => (data?.movement || []).map((entry) => ({ ...entry, day: formatDate(entry.date) })),
    [data?.movement]
  );
  const stats = data?.stats || {};
  const lowStockItems = data?.lowStockItems || [];
  const recentTransactions = data?.recentTransactions || [];
  const staffCanWrite = can(user?.role, 'inventory:create');

  if (loading) {
    return (
      <div className="loading-block dashboard-loading">
        <span className="spinner lg" />
        <span>Loading inventory overview…</span>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A clear view of school equipment, stock levels and recent movements."
      >
        <button type="button" className="btn btn-secondary" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
        {staffCanWrite && <button type="button" className="btn btn-primary" onClick={() => navigate('/inventory')}><Boxes size={15} /> Manage inventory</button>}
      </PageHeader>

      <div className="grid grid-stats dashboard-stats">
        <StatCard
          label="Total products"
          value={formatNumber(stats.totalProducts)}
          icon={Boxes}
          tone="dark"
          sub="Active inventory records"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Available stock"
          value={formatNumber(stats.totalAvailableStocks)}
          icon={ArrowDownToLine}
          sub="Total units currently on hand"
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          label="Low-stock items"
          value={formatNumber(stats.lowStockItems)}
          icon={AlertTriangle}
          tone={stats.lowStockItems ? 'warning' : 'success'}
          sub={`${formatNumber(stats.outOfStockItems)} out of stock`}
          onClick={() => navigate('/inventory?status=Low%20Stock')}
        />
      </div>

      {lowStockItems.length > 0 && (
        <div className="dashboard-alert-banner" role="status">
          <span className="dashboard-alert-icon"><AlertTriangle size={17} /></span>
          <div>
            <strong>{lowStockItems.length} item{lowStockItems.length === 1 ? '' : 's'} need attention</strong>
            <span>{stats.outOfStockItems ? `${stats.outOfStockItems} currently out of stock. ` : ''}Review the low-stock list and plan replenishment.</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory?status=Low%20Stock')}>Review items</button>
        </div>
      )}

      <div className="grid grid-equal dashboard-charts">
        <ChartCard
          id="stock-movement"
          title="7-day stock movement"
          description="Recorded stock in and stock out quantities"
          icon={ArrowLeftRight}
          data={movement}
          xKey="day"
          series={[{ key: 'stockIn', name: 'Stock in' }, { key: 'stockOut', name: 'Stock out' }]}
          pieMode="series"
          initialType="verticalBar"
        />
        <ChartCard
          id="inventory-category"
          title="Stock by category"
          description="Available quantities across school-resource groups"
          icon={PackageSearch}
          data={data?.categories || []}
          xKey="name"
          series={[{ key: 'quantity', name: 'Available stock' }]}
          pieMode="rows"
          initialType="donut"
        />
      </div>

      <SectionCard
        title="Low-stock items"
        description="Items at or below their minimum quantity, including out-of-stock records"
        icon={AlertTriangle}
        actions={<button type="button" className="btn-text" onClick={() => navigate('/inventory?status=Low%20Stock')}>View inventory</button>}
        className="flush dashboard-list-card"
      >
        {lowStockItems.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Item</th><th>Category</th><th className="num">Available</th><th className="num">Minimum</th><th>Status</th></tr></thead>
              <tbody>
                {lowStockItems.slice(0, 8).map((item) => (
                  <tr key={item.id} className="is-low">
                    <td><div className="cell-main">{item.name}</div><div className="cell-sub">{item.itemCode} · {item.location || 'Location not set'}</div></td>
                    <td>{item.category}</td>
                    <td className="num"><strong>{formatNumber(item.quantity)}</strong> <span className="tiny muted">{item.unit}</span></td>
                    <td className="num">{formatNumber(item.minimumStock)}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Stock levels are healthy" description="There are no active items below their minimum level." />
        )}
      </SectionCard>

      <SectionCard
        title="Recent transactions"
        description="Latest recorded stock movements"
        icon={ArrowLeftRight}
        actions={can(user?.role, 'transactions:read') ? <button type="button" className="btn-text" onClick={() => navigate('/transactions')}>View history</button> : null}
        className="flush dashboard-list-card"
      >
        {recentTransactions.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Date</th><th>Reference</th><th>Item</th><th>Type</th><th className="num">Qty</th><th className="num">Balance</th><th>Recorded by</th></tr></thead>
              <tbody>
                {recentTransactions.map((txn) => (
                  <tr key={txn.id}>
                    <td className="nowrap">{formatDate(txn.date)}</td>
                    <td className="mono tiny">{txn.reference}</td>
                    <td><div className="cell-main">{txn.itemName}</div><div className="cell-sub">{txn.itemCode}</div></td>
                    <td><TransactionTypeBadge type={txn.type} /></td>
                    <td className="num"><strong className={txn.type === 'Stock In' || txn.type === 'Returned' ? 'text-success' : 'text-warning'}>{txn.type === 'Stock Out' || txn.type === 'Borrowed' ? '−' : '+'}{formatNumber(txn.quantity)}</strong></td>
                    <td className="num">{formatNumber(txn.balanceAfter)}</td>
                    <td>{txn.recordedBy?.name || 'System seed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No transactions yet" description="Stock movements will appear here once they have been recorded." />
        )}
      </SectionCard>

      <p className="tiny muted dashboard-updated">
        <ArrowUpFromLine size={12} /> Updated from inventory records at {formatDateTime(data?.generatedAt)}. The overview refreshes automatically.
      </p>
    </>
  );
}
