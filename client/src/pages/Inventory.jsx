import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  Eye,
  FilterX,
  MapPin,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, StatusBadge, EmptyState, LoadingState, Pagination, SectionCard } from '../components/common';
import { ConditionBadge } from '../components/badges';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CONDITIONS, LOCATIONS, UNITS } from '../utils/constants';
import { formatDate, formatNumber, todayISO } from '../utils/format';
import { can } from '../utils/permissions';

const LIMIT = 12;

function ItemForm({ open, onClose, item, categories, onSaved }) {
  const empty = {
    name: '',
    categoryId: categories[0]?.id || '',
    quantity: 0,
    unit: 'pcs',
    minimumStock: 1,
    location: '',
    condition: 'Good',
    description: '',
  };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unit: item.unit,
        minimumStock: item.minimumStock,
        location: item.location,
        condition: item.condition,
        description: item.description,
      });
    } else {
      setForm({ ...empty, categoryId: categories[0]?.id || '' });
    }
    setErrors({});
    setServerError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const update = (field) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim() || form.name.trim().length < 2) next.name = 'Enter an item name (at least 2 characters).';
    if (!form.categoryId) next.categoryId = 'Select a category.';
    if (form.quantity === '' || Number(form.quantity) < 0 || !Number.isInteger(Number(form.quantity))) next.quantity = 'Quantity must be a whole number of 0 or more.';
    if (form.minimumStock === '' || Number(form.minimumStock) < 0 || !Number.isInteger(Number(form.minimumStock))) next.minimumStock = 'Minimum level must be a whole number of 0 or more.';
    if (!form.unit.trim()) next.unit = 'Unit is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        categoryId: form.categoryId,
        unit: form.unit,
        minimumStock: Number(form.minimumStock),
        location: form.location.trim(),
        condition: form.condition,
        description: form.description.trim(),
        ...(item ? {} : { quantity: Number(form.quantity) }),
      };
      if (item) await api.patch(`/items/${item.id}`, payload);
      else await api.post('/items', payload);
      onSaved(item ? 'Item updated successfully.' : 'Item added to the inventory.');
      onClose();
    } catch (error) {
      setServerError(error.message || 'Unable to save the item.');
      if (error.details) {
        const next = {};
        error.details.forEach((detail) => {
          next[detail.field] = detail.message;
        });
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
      title={item ? 'Edit inventory item' : 'Add inventory item'}
      description={item ? `${item.itemCode} · update the item information` : 'Record a new item in the school inventory'}
      size="wide"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="item-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            {item ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="item-name">Item name <span className="req">*</span></label>
            <input id="item-name" className={`input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={update('name')} placeholder="e.g. USB Wired Keyboard" maxLength={120} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="item-category">Category <span className="req">*</span></label>
            <select id="item-category" className={`select ${errors.categoryId ? 'invalid' : ''}`} value={form.categoryId} onChange={update('categoryId')}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            {errors.categoryId && <span className="field-error">{errors.categoryId}</span>}
          </div>
          <div className="field">
            <label htmlFor="item-condition">Condition</label>
            <select id="item-condition" className="select" value={form.condition} onChange={update('condition')}>
              {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
            </select>
          </div>
          {!item && (
            <div className="field">
              <label htmlFor="item-quantity">Initial quantity <span className="req">*</span></label>
              <input id="item-quantity" type="number" min={0} step={1} className={`input ${errors.quantity ? 'invalid' : ''}`} value={form.quantity} onChange={update('quantity')} />
              <span className="field-hint">Opening stock is recorded as a Stock In transaction.</span>
              {errors.quantity && <span className="field-error">{errors.quantity}</span>}
            </div>
          )}
          <div className="field">
            <label htmlFor="item-unit">Unit of measurement <span className="req">*</span></label>
            <select id="item-unit" className={`select ${errors.unit ? 'invalid' : ''}`} value={form.unit} onChange={update('unit')}>
              {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
            {errors.unit && <span className="field-error">{errors.unit}</span>}
          </div>
          <div className="field">
            <label htmlFor="item-minimum">Minimum stock level <span className="req">*</span></label>
            <input id="item-minimum" type="number" min={0} step={1} className={`input ${errors.minimumStock ? 'invalid' : ''}`} value={form.minimumStock} onChange={update('minimumStock')} />
            <span className="field-hint">Low-stock alerts trigger at or below this level.</span>
            {errors.minimumStock && <span className="field-error">{errors.minimumStock}</span>}
          </div>
          <div className="field">
            <label htmlFor="item-location">Location / storage area</label>
            <input id="item-location" className="input" list="location-options" value={form.location} onChange={update('location')} placeholder="e.g. Computer Lab 1" maxLength={80} />
            <datalist id="location-options">
              {LOCATIONS.map((location) => <option key={location} value={location} />)}
            </datalist>
          </div>
          <div className="field span-2">
            <label htmlFor="item-description">Description</label>
            <textarea id="item-description" className="textarea" rows={2} value={form.description} onChange={update('description')} placeholder="Short description, specifications or usage notes" maxLength={500} />
          </div>
        </div>
        {item && (
          <div className="login-note" style={{ marginTop: 12 }}>
            <ArrowLeftRight size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>Quantity is currently <strong>{formatNumber(item.quantity)} {item.unit}</strong>. To change stock, use Stock In, Stock Out or an adjustment so the movement is recorded.</span>
          </div>
        )}
        {serverError && <div className="login-error" style={{ marginTop: 12 }}>{serverError}</div>}
      </form>
    </Modal>
  );
}

function StockModal({ open, onClose, item, onSaved }) {
  const [type, setType] = useState('Stock In');
  const [form, setForm] = useState({ quantity: 1, date: todayISO(), supplier: '', reason: '', remarks: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setType('Stock In');
      setForm({ quantity: 1, date: todayISO(), supplier: '', reason: '', remarks: '' });
      setError('');
    }
  }, [open, item]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1) {
      setError('Enter a whole quantity of at least 1.');
      return;
    }
    if (type === 'Stock Out' && Number(form.quantity) > item.quantity) {
      setError(`Only ${item.quantity} ${item.unit} available for ${item.name}.`);
      return;
    }
    if (type === 'Stock Out' && !form.reason.trim()) {
      setError('Provide a reason for releasing the stock.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/transactions', {
        type,
        itemId: item.id,
        quantity: Number(form.quantity),
        date: form.date,
        supplier: form.supplier,
        reason: form.reason,
        remarks: form.remarks,
      });
      onSaved(type === 'Stock In' ? 'Stock in recorded.' : 'Stock out recorded.');
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to record the transaction.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record stock movement"
      description={`${item?.itemCode} · ${item?.name} — ${formatNumber(item?.quantity)} ${item?.unit} available`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="stock-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} Save transaction
          </button>
        </>
      }
    >
      <form id="stock-form" onSubmit={submit} noValidate>
        <div className="chip-row" style={{ marginBottom: 14 }}>
          <button type="button" className={`chip ${type === 'Stock In' ? 'active' : ''}`} onClick={() => setType('Stock In')}>
            <ArrowDownToLine size={13} /> Stock in
          </button>
          <button type="button" className={`chip ${type === 'Stock Out' ? 'active' : ''}`} onClick={() => setType('Stock Out')}>
            <ArrowUpFromLine size={13} /> Stock out
          </button>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="stock-qty">Quantity <span className="req">*</span></label>
            <input id="stock-qty" type="number" min={1} step={1} className="input" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="stock-date">Transaction date</label>
            <input id="stock-date" type="date" className="input" value={form.date} max={todayISO()} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </div>
          {type === 'Stock In' ? (
            <div className="field span-2">
              <label htmlFor="stock-supplier">Supplier / source</label>
              <input id="stock-supplier" className="input" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} placeholder="e.g. National Book Store" maxLength={120} />
            </div>
          ) : (
            <div className="field span-2">
              <label htmlFor="stock-reason">Reason for releasing <span className="req">*</span></label>
              <input id="stock-reason" className="input" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="e.g. Classroom distribution" maxLength={160} />
            </div>
          )}
          <div className="field span-2">
            <label htmlFor="stock-remarks">Remarks</label>
            <textarea id="stock-remarks" className="textarea" rows={2} value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Optional notes" maxLength={300} />
          </div>
        </div>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    condition: '',
    sort: 'name',
    order: 'asc',
  });
  const [page, setPage] = useState(1);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const isStaff = can(user?.role, 'inventory:update');
  const isAdmin = user?.role === 'Administrator';

  useEffect(() => {
    const next = {
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      status: searchParams.get('status') || '',
    };
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    api.get('/categories').then((result) => setCategories(result.categories)).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.get('/items', {
          search: filters.search,
          category: filters.category,
          status: filters.status,
          condition: filters.condition,
          sort: filters.sort,
          order: filters.order,
          page,
          limit: LIMIT,
          includeArchived: includeArchived ? 'true' : 'false',
        });
        if (active) setData(result);
      } catch {
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }, 260);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, page, includeArchived, reloadKey]);

  const summary = data?.summary || { totalItems: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 };
  const statusCounts = data?.statusCounts || {};
  const countAll = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);

  const refresh = () => setReloadKey((key) => key + 1);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', category: '', status: '', condition: '', sort: 'name', order: 'asc' });
    setIncludeArchived(false);
    setPage(1);
  };

  const handleSaved = (message) => {
    toast.success(message);
    refresh();
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await api.delete(`/items/${archiveTarget.id}`);
      toast.success(`"${archiveTarget.name}" was archived.`);
      setArchiveTarget(null);
      setViewing(null);
      refresh();
    } catch (error) {
      toast.error(error.message || 'Unable to archive the item.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const restoreItem = async (item) => {
    try {
      await api.patch(`/items/${item.id}/restore`);
      toast.success(`"${item.name}" was restored to the inventory.`);
      refresh();
    } catch (error) {
      toast.error(error.message || 'Unable to restore the item.');
    }
  };

  const activeFilterCount = [filters.search, filters.category, filters.status, filters.condition].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Manage school supplies, equipment and laboratory materials. Stock quantities change only through recorded transactions."
      >
        {isStaff && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus size={15} /> Add item
          </button>
        )}
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Total Items" value={formatNumber(summary.totalItems)} icon={Boxes} tone="dark" sub={`${categories.length} categories`} />
        <StatCard label="Available Stocks" value={formatNumber(summary.totalQuantity)} icon={Boxes} sub="Units on hand" />
        <StatCard label="Low Stock" value={formatNumber(summary.lowStock)} icon={PackageSearch} tone="default" sub="At or below minimum" />
        <StatCard label="Out of Stock" value={formatNumber(summary.outOfStock)} icon={Archive} tone="danger" sub="Zero quantity" />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input
              className="input"
              placeholder="Search by name, item ID, description or location…"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              aria-label="Search inventory"
            />
          </div>
          <select className="select" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>{category.name}</option>
            ))}
          </select>
          <select className="select" value={filters.condition} onChange={(event) => updateFilter('condition', event.target.value)} aria-label="Filter by condition">
            <option value="">All conditions</option>
            {CONDITIONS.map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
          <select className="select" value={`${filters.sort}:${filters.order}`} onChange={(event) => { const [sort, order] = event.target.value.split(':'); setFilters((current) => ({ ...current, sort, order })); }} aria-label="Sort inventory">
            <option value="name:asc">Name (A–Z)</option>
            <option value="name:desc">Name (Z–A)</option>
            <option value="quantity:desc">Quantity (high to low)</option>
            <option value="quantity:asc">Quantity (low to high)</option>
            <option value="dateAdded:desc">Newest first</option>
            <option value="dateAdded:asc">Oldest first</option>
            <option value="category:asc">Category (A–Z)</option>
          </select>
          {activeFilterCount > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <FilterX size={14} /> Clear
            </button>
          )}
          <div className="spacer" />
          {isAdmin && (
            <label className="checkbox-row" style={{ fontSize: 12 }}>
              <input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }} />
              Show archived
            </label>
          )}
          <span className="filter-count">{loading ? 'Loading…' : `${data?.total || 0} result(s)`}</span>
        </div>

        <div className="chip-row" style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          {[
            { value: '', label: 'All items', count: countAll },
            { value: 'In Stock', label: 'In stock', count: statusCounts['In Stock'] || 0 },
            { value: 'Low Stock', label: 'Low stock', count: statusCounts['Low Stock'] || 0 },
            { value: 'Out of Stock', label: 'Out of stock', count: statusCounts['Out of Stock'] || 0 },
          ].map((chip) => (
            <button
              type="button"
              key={chip.value || 'all'}
              className={`chip ${filters.status === chip.value ? 'active' : ''}`}
              onClick={() => updateFilter('status', chip.value)}
            >
              {chip.label} <span className="count">{chip.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState label="Loading inventory items…" rows={6} columns={6} />
        ) : !data?.items?.length ? (
          <EmptyState
            icon={PackageSearch}
            title="No inventory items found"
            description={activeFilterCount ? 'No items match the current filters. Try clearing the search or filters.' : 'Add the first inventory item to start monitoring stock levels.'}
            action={activeFilterCount ? <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button> : isStaff ? <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={14} /> Add item</button> : null}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="num">Quantity</th>
                    <th className="num">Min. level</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Condition</th>
                    <th>Last updated</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className={item.status !== 'In Stock' ? 'is-low' : ''}>
                      <td>
                        <div className="cell-main">{item.name}</div>
                        <div className="cell-sub mono">{item.itemCode}{!item.isActive ? ' · Archived' : ''}</div>
                      </td>
                      <td>{item.category}</td>
                      <td className="num"><strong>{formatNumber(item.quantity)}</strong> <span className="tiny muted">{item.unit}</span></td>
                      <td className="num">{formatNumber(item.minimumStock)}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>
                        <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                          <MapPin size={12} style={{ color: 'var(--muted-light)' }} />
                          <span className="small">{item.location || '—'}</span>
                        </span>
                      </td>
                      <td><ConditionBadge condition={item.condition} /></td>
                      <td className="nowrap small muted">{formatDate(item.lastUpdated)}</td>
                      <td className="actions text-right">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="View details" aria-label={`View ${item.name}`} onClick={() => setViewing(item)}>
                            <Eye size={14} />
                          </button>
                          {isStaff && item.isActive && (
                            <button type="button" className="icon-btn" title="Record stock movement" aria-label={`Record stock for ${item.name}`} onClick={() => setStockItem(item)}>
                              <ArrowLeftRight size={14} />
                            </button>
                          )}
                          {isStaff && (
                            <button type="button" className="icon-btn" title="Edit item" aria-label={`Edit ${item.name}`} onClick={() => { setEditing(item); setFormOpen(true); }}>
                              <Pencil size={14} />
                            </button>
                          )}
                          {isAdmin && item.isActive && (
                            <button type="button" className="icon-btn danger" title="Archive item" aria-label={`Archive ${item.name}`} onClick={() => setArchiveTarget(item)}>
                              <Archive size={14} />
                            </button>
                          )}
                          {isAdmin && !item.isActive && (
                            <button type="button" className="icon-btn" title="Restore item" aria-label={`Restore ${item.name}`} onClick={() => restoreItem(item)}>
                              <ArchiveRestore size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="items" />
          </>
        )}
      </SectionCard>

      <ItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
        categories={categories}
        onSaved={handleSaved}
      />

      <StockModal open={Boolean(stockItem)} onClose={() => setStockItem(null)} item={stockItem} onSaved={handleSaved} />

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.name || 'Item details'}
        description={viewing ? `${viewing.itemCode} · added ${formatDate(viewing.dateAdded)}` : ''}
        size="wide"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>
            {isStaff && viewing?.isActive && (
              <button type="button" className="btn btn-secondary" onClick={() => { setStockItem(viewing); setViewing(null); }}>
                <ArrowLeftRight size={14} /> Stock movement
              </button>
            )}
            {isStaff && (
              <button type="button" className="btn btn-primary" onClick={() => { setEditing(viewing); setViewing(null); setFormOpen(true); }}>
                <Pencil size={14} /> Edit item
              </button>
            )}
          </>
        }
      >
        {viewing && (
          <>
            <div className="row" style={{ marginBottom: 14, gap: 8 }}>
              <StatusBadge status={viewing.status} />
              <ConditionBadge condition={viewing.condition} />
              <span className="badge badge-neutral no-dot">{viewing.category}</span>
              {!viewing.isActive && <span className="badge badge-danger no-dot">Archived</span>}
            </div>
            <div className="detail-grid">
              <div className="detail-item"><div className="dt">Item ID</div><div className="dd mono">{viewing.itemCode}</div></div>
              <div className="detail-item"><div className="dt">Category</div><div className="dd">{viewing.category}</div></div>
              <div className="detail-item"><div className="dt">Available quantity</div><div className="dd"><strong>{formatNumber(viewing.quantity)}</strong> {viewing.unit}</div></div>
              <div className="detail-item"><div className="dt">Minimum stock level</div><div className="dd">{formatNumber(viewing.minimumStock)} {viewing.unit}</div></div>
              <div className="detail-item"><div className="dt">Location</div><div className="dd">{viewing.location || '—'}</div></div>
              <div className="detail-item"><div className="dt">Condition</div><div className="dd">{viewing.condition}</div></div>
              <div className="detail-item"><div className="dt">Date added</div><div className="dd">{formatDate(viewing.dateAdded)}</div></div>
              <div className="detail-item"><div className="dt">Last updated</div><div className="dd">{formatDate(viewing.lastUpdated)}</div></div>
              <div className="detail-item span-2"><div className="dt">Description</div><div className="dd">{viewing.description || 'No description provided.'}</div></div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        onConfirm={confirmArchive}
        title="Archive inventory item"
        message={`Archive "${archiveTarget?.name}"? The item will be removed from the active inventory list, but its transaction and borrowing history will be preserved. You can restore it later.`}
        confirmLabel="Archive item"
        loading={archiveLoading}
      />
    </>
  );
}
