import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
  Users as UsersIcon,
  XCircle,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, StatCard, EmptyState, LoadingState, Pagination, SectionCard, RoleBadge } from '../components/common';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatDate, formatDateTime } from '../utils/format';

const LIMIT = 20;
const ROLES = ['Administrator', 'Inventory Staff', 'Viewer'];

const MATRIX = [
  { permission: 'View dashboard and inventory', admin: true, staff: true, viewer: true },
  { permission: 'Search and filter inventory', admin: true, staff: true, viewer: true },
  { permission: 'View reports and print', admin: true, staff: true, viewer: true },
  { permission: 'Add and edit inventory items', admin: true, staff: true, viewer: false },
  { permission: 'Record stock in / stock out', admin: true, staff: true, viewer: false },
  { permission: 'Manage borrowing and returns', admin: true, staff: true, viewer: false },
  { permission: 'Manage categories', admin: true, staff: false, viewer: false },
  { permission: 'Manage user accounts and roles', admin: true, staff: false, viewer: false },
  { permission: 'View activity logs', admin: true, staff: false, viewer: false },
  { permission: 'Archive inventory items', admin: true, staff: false, viewer: false },
];

function UserModal({ open, onClose, user, onSaved }) {
  const [form, setForm] = useState({ name: '', username: '', email: '', role: 'Viewer', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user?.name || '',
      username: user?.username || '',
      email: user?.email || '',
      role: user?.role || 'Viewer',
      password: '',
      confirm: '',
    });
    setErrors({});
    setServerError('');
  }, [open, user]);

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter the full name.';
    if (!user) {
      if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.username.trim())) next.username = 'Use 3–30 letters, numbers, dots, dashes or underscores.';
      if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
      else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) next.password = 'Include at least one letter and one number.';
      if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      if (user) {
        await api.patch(`/users/${user.id}`, { name: form.name.trim(), email: form.email.trim(), role: form.role });
      } else {
        await api.post('/users', {
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim(),
          role: form.role,
          password: form.password,
        });
      }
      onSaved(user ? 'User account updated.' : 'User account created.');
      onClose();
    } catch (error) {
      setServerError(error.message || 'Unable to save the account.');
      if (error.details) {
        const fieldMap = {};
        error.details.forEach((detail) => { fieldMap[detail.field] = detail.message; });
        setErrors(fieldMap);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Edit user account' : 'Create user account'}
      description={user ? `@${user.username} · update profile, role or access` : 'New accounts can sign in immediately after creation.'}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} {user ? 'Save changes' : 'Create account'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="user-name">Full name <span className="req">*</span></label>
            <input id="user-name" className={`input ${errors.name ? 'invalid' : ''}`} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="user-username">Username <span className="req">*</span></label>
            <input id="user-username" className={`input ${errors.username ? 'invalid' : ''}`} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} disabled={Boolean(user)} maxLength={30} />
            {errors.username ? <span className="field-error">{errors.username}</span> : <span className="field-hint">Used to sign in. Cannot be changed after creation.</span>}
          </div>
          <div className="field">
            <label htmlFor="user-role">Role <span className="req">*</span></label>
            <select id="user-role" className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <span className="field-hint">Permissions are enforced by the API.</span>
          </div>
          <div className="field span-2">
            <label htmlFor="user-email">Email address</label>
            <input id="user-email" type="email" className={`input ${errors.email ? 'invalid' : ''}`} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength={120} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>
          {!user && (
            <>
              <div className="field">
                <label htmlFor="user-password">Temporary password <span className="req">*</span></label>
                <input id="user-password" type="text" className={`input ${errors.password ? 'invalid' : ''}`} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} maxLength={72} />
                {errors.password ? <span className="field-error">{errors.password}</span> : <span className="field-hint">At least 8 characters with a letter and a number.</span>}
              </div>
              <div className="field">
                <label htmlFor="user-confirm">Confirm password <span className="req">*</span></label>
                <input id="user-confirm" type="text" className={`input ${errors.confirm ? 'invalid' : ''}`} value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} maxLength={72} />
                {errors.confirm && <span className="field-error">{errors.confirm}</span>}
              </div>
            </>
          )}
        </div>
        {serverError && <div className="login-error" style={{ marginTop: 12 }}>{serverError}</div>}
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ open, onClose, user, onSaved }) {
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ password: '', confirm: '' });
      setError('');
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) return setError('Include at least one letter and one number.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: form.password });
      onSaved(`Password reset for ${user.name}.`);
      onClose();
    } catch (err) {
      setError(err.message || 'Unable to reset the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset user password"
      description={`Set a new password for ${user?.name} (@${user?.username}).`}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="reset-form" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />} Reset password
          </button>
        </>
      }
    >
      <form id="reset-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <input id="reset-password" className="input" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} maxLength={72} />
          <span className="field-hint">At least 8 characters with a letter and a number.</span>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="reset-confirm">Confirm password</label>
          <input id="reset-confirm" className="input" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} maxLength={72} />
        </div>
        {error && <div className="login-error" style={{ marginTop: 12 }}>{error}</div>}
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get('/users', { ...filters, page, limit: LIMIT });
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

  const counts = data?.counts || {};
  const total = data?.total || 0;
  const refresh = () => setReloadKey((key) => key + 1);

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setToggleLoading(true);
    try {
      const result = await api.post(`/users/${toggleTarget.id}/toggle`);
      toast.success(result.message);
      setToggleTarget(null);
      refresh();
    } catch (error) {
      toast.error(error.message || 'Unable to update the account.');
    } finally {
      setToggleLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="User Management"
        description="Create accounts, assign roles and deactivate access. Only administrators can open this module."
      >
        <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={15} /> Add user
        </button>
      </PageHeader>

      <div className="grid grid-stats" style={{ marginBottom: 14 }}>
        <StatCard label="Total Accounts" value={total} icon={UsersIcon} tone="dark" sub={`${data?.users?.filter((entry) => entry.isActive).length || 0} active on this page`} />
        <StatCard label="Administrators" value={counts.Administrator || 0} icon={ShieldCheck} tone="accent" sub="Full system access" />
        <StatCard label="Inventory Staff" value={counts['Inventory Staff'] || 0} icon={UserRound} sub="Stock and borrowing" />
        <StatCard label="Viewers" value={counts.Viewer || 0} icon={UserCheck} sub="Read-only access" />
      </div>

      <SectionCard className="flush">
        <div className="filters">
          <div className="input-icon-wrap search">
            <Search size={15} />
            <input className="input" placeholder="Search name, username or email…" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPage(1); }} aria-label="Search users" />
          </div>
          <select className="select" value={filters.role} onChange={(event) => { setFilters({ ...filters, role: event.target.value }); setPage(1); }} aria-label="Filter by role">
            <option value="">All roles</option>
            {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <select className="select" value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <div className="spacer" />
          <span className="filter-count">{loading ? 'Loading…' : `${total} account(s)`}</span>
        </div>

        {loading ? (
          <LoadingState label="Loading user accounts…" rows={5} columns={5} />
        ) : !data?.users?.length ? (
          <EmptyState icon={UsersIcon} title="No user accounts found" description="Create accounts for administrators, inventory staff and viewers." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div className="row" style={{ gap: 9, flexWrap: 'nowrap' }}>
                          <span className={`avatar ${entry.isActive ? '' : 'dark'}`} style={{ width: 30, height: 30, fontSize: 11 }}>{entry.initials}</span>
                          <div style={{ minWidth: 0 }}>
                            <div className="cell-main">{entry.name} {entry.id === currentUser?.id && <span className="tiny muted">(you)</span>}</div>
                            <div className="cell-sub">{entry.email || 'No email provided'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono tiny">@{entry.username}</td>
                      <td><RoleBadge role={entry.role} /></td>
                      <td>
                        <span className={`badge no-dot ${entry.isActive ? 'badge-success' : 'badge-neutral'}`}>
                          {entry.isActive ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {entry.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="small muted nowrap">{entry.lastLoginAt ? formatDateTime(entry.lastLoginAt) : 'Never signed in'}</td>
                      <td className="actions text-right">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Edit account" aria-label={`Edit ${entry.name}`} onClick={() => { setEditing(entry); setModalOpen(true); }}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" className="icon-btn" title="Reset password" aria-label={`Reset password for ${entry.name}`} onClick={() => setResetTarget(entry)}>
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className={`icon-btn ${entry.isActive ? 'danger' : ''}`}
                            title={entry.isActive ? 'Deactivate account' : 'Activate account'}
                            aria-label={entry.isActive ? `Deactivate ${entry.name}` : `Activate ${entry.name}`}
                            onClick={() => setToggleTarget(entry)}
                            disabled={entry.id === currentUser?.id}
                          >
                            {entry.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} pages={data.pages} total={data.total} limit={LIMIT} onPageChange={setPage} label="accounts" />
          </>
        )}
      </SectionCard>

      <SectionCard title="Role permissions" description="Access control enforced on both the interface and the API" icon={ShieldCheck} style={{ marginTop: 14 }}>
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Administrator</th>
                <th>Inventory Staff</th>
                <th>Viewer</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.permission}>
                  <td>{row.permission}</td>
                  <td>{row.admin ? <span className="yes">✓</span> : <span className="no">—</span>}</td>
                  <td>{row.staff ? <span className="yes">✓</span> : <span className="no">—</span>}</td>
                  <td>{row.viewer ? <span className="yes">✓</span> : <span className="no">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <UserModal open={modalOpen} onClose={() => setModalOpen(false)} user={editing} onSaved={(message) => { toast.success(message); refresh(); }} />
      <ResetPasswordModal open={Boolean(resetTarget)} onClose={() => setResetTarget(null)} user={resetTarget} onSaved={(message) => { toast.success(message); refresh(); }} />
      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.isActive ? 'Deactivate account' : 'Activate account'}
        message={
          toggleTarget?.isActive
            ? `Deactivate ${toggleTarget?.name} (@${toggleTarget?.username})? The account will no longer be able to sign in, but its history is preserved.`
            : `Activate ${toggleTarget?.name} (@${toggleTarget?.username})? The user will be able to sign in with their assigned role.`
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        tone={toggleTarget?.isActive ? 'danger' : 'info'}
        loading={toggleLoading}
      />
    </>
  );
}
