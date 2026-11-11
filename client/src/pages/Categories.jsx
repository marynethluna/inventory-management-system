import { useCallback, useEffect, useState } from 'react';
import { Boxes, FolderTree, Layers, Package, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, SectionCard } from '../components/common';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatNumber } from '../utils/format';

function CategoryModal({ open, onClose, category, onSaved }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ name: category?.name || '', description: category?.description || '' });
    setError('');
  }, [open, category]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2) {
      setError('Category name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      if (category) await api.patch(`/categories/${category.id}`, { name: form.name.trim(), description: form.description.trim() });
      else await api.post('/categories', { name: form.name.trim(), description: form.description.trim() });
      onSaved(category ? 'Category updated.' : 'Category created.');
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to save the category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'Add category'}
      description="Categories group inventory items for easier filtering and reporting."
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} {category ? 'Save changes' : 'Create category'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="category-name">Category name <span className="req">*</span></label>
          <input id="category-name" className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Computer Equipment" maxLength={60} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="category-description">Description</label>
          <textarea id="category-description" className="textarea" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What kind of items belong in this category?" maxLength={240} />
        </div>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </Modal>
  );
}

export default function Categories() {
  const { user } = useAuth();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAdmin = user?.role === 'Administrator';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/categories');
      setCategories(result.categories);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalItems = categories.reduce((sum, category) => sum + category.itemCount, 0);
  const totalQuantity = categories.reduce((sum, category) => sum + category.totalQuantity, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}`);
      toast.success(`Category "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (error) {
      toast.error(error.message || 'Unable to delete the category.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organize inventory into logical groups. Categories with existing items cannot be deleted, protecting inventory records."
      >
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={15} /> Add category
          </button>
        )}
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Total Categories" value={formatNumber(categories.length)} icon={Tags} tone="dark" sub="Active groupings" />
        <StatCard label="Classified Items" value={formatNumber(totalItems)} icon={Boxes} sub="Items in categories" />
        <StatCard label="Total Quantity" value={formatNumber(totalQuantity)} icon={Package} tone="accent" sub="Units across categories" />
        <StatCard label="Uncategorized" value="0" icon={Layers} tone="success" sub="All items have a category" />
      </div>

      {loading ? (
        <SectionCard><LoadingState label="Loading categories…" rows={4} columns={3} /></SectionCard>
      ) : !categories.length ? (
        <SectionCard>
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Create categories such as Computer Equipment, Laboratory Materials or School Supplies to organize inventory."
            action={isAdmin ? <button type="button" className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={14} /> Add category</button> : null}
          />
        </SectionCard>
      ) : (
        <div className="grid grid-3">
          {categories.map((category) => (
            <div className="cat-card" key={category.id}>
              <div className="cat-card-head">
                <div className="cat-icon"><Tags size={17} /></div>
                <div style={{ minWidth: 0 }}>
                  <h3>{category.name}</h3>
                  <p>{category.description || 'No description provided.'}</p>
                </div>
              </div>
              <div className="cat-metrics">
                <div className="cat-metric">
                  <b>{formatNumber(category.itemCount)}</b>
                  <span>Items</span>
                </div>
                <div className="cat-metric">
                  <b>{formatNumber(category.totalQuantity)}</b>
                  <span>Total qty</span>
                </div>
              </div>
              {isAdmin && (
                <div className="cat-card-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(category); setModalOpen(true); }}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setDeleteTarget(category)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editing}
        onSaved={(message) => { toast.success(message); load(); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete category"
        message={`Delete the category "${deleteTarget?.name}"? This is only possible when no inventory items are assigned to it. Items must be reassigned or archived first.`}
        confirmLabel="Delete category"
        loading={deleteLoading}
      />
    </>
  );
}
