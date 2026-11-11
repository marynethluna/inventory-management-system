import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, SectionCard, RoleBadge } from '../components/common';
import { formatDate, formatDateTime } from '../utils/format';
import { ROLE_DESCRIPTIONS } from '../utils/permissions';

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email || '' });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileSaving(true);
    try {
      await api.patch('/auth/profile', { name: profile.name.trim(), email: profile.email.trim() });
      await refresh();
      toast.success('Profile updated.');
    } catch (error) {
      toast.error(error.message || 'Unable to update the profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (!passwords.current) return setPasswordError('Enter your current password.');
    if (passwords.next.length < 8) return setPasswordError('New password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(passwords.next) || !/[0-9]/.test(passwords.next)) return setPasswordError('Include at least one letter and one number.');
    if (passwords.next !== passwords.confirm) return setPasswordError('New passwords do not match.');
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: passwords.current, password: passwords.next });
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated successfully.');
    } catch (error) {
      setPasswordError(error.message || 'Unable to change the password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, password and appearance preferences." />

      <div className="settings-grid">
        <div className="stack">
          <SectionCard title="My profile" description="Your account information and role" icon={UserRound}>
            <div className="profile-head">
              <div className="avatar lg">{user?.initials}</div>
              <div>
                <h2>{user?.name}</h2>
                <p>@{user?.username} · {user?.email || 'No email on file'}</p>
                <div style={{ marginTop: 6 }}><RoleBadge role={user?.role} /></div>
              </div>
            </div>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="profile-name">Full name</label>
                  <input id="profile-name" className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} maxLength={80} />
                </div>
                <div className="field">
                  <label htmlFor="profile-email">Email address</label>
                  <div className="input-icon-wrap">
                    <Mail size={14} />
                    <input id="profile-email" type="email" className="input" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} maxLength={120} />
                  </div>
                </div>
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? <span className="spinner" /> : <Save size={15} />} Save profile
                </button>
                <span className="tiny muted">Username and role are managed by an administrator.</span>
              </div>
            </form>
            <div className="divider" />
            <div className="detail-grid">
              <div className="detail-item"><div className="dt">Role</div><div className="dd">{user?.role}</div></div>
              <div className="detail-item"><div className="dt">Account status</div><div className="dd"><span className="badge badge-success">Active</span></div></div>
              <div className="detail-item"><div className="dt">Last login</div><div className="dd">{user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</div></div>
              <div className="detail-item"><div className="dt">Member since</div><div className="dd">{formatDate(user?.createdAt)}</div></div>
            </div>
          </SectionCard>

          <SectionCard title="Change password" description="Use a strong password you do not use elsewhere" icon={KeyRound}>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <div className="field span-2">
                  <label htmlFor="current-password">Current password</label>
                  <div className="input-icon-wrap">
                    <Lock size={14} />
                    <input id="current-password" type="password" className="input" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input id="new-password" type="password" className="input" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
                  <span className="field-hint">At least 8 characters with a letter and a number.</span>
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input id="confirm-password" type="password" className="input" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
                </div>
              </div>
              {passwordError && <div className="login-error" style={{ marginTop: 12 }}>{passwordError}</div>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }} disabled={passwordSaving}>
                {passwordSaving ? <span className="spinner" /> : <KeyRound size={15} />} Update password
              </button>
            </form>
          </SectionCard>
        </div>

        <div className="stack">
          <SectionCard title="Appearance" description="Choose how the interface looks on this device" icon={Sun}>
            <div className="theme-options">
              <button type="button" className={`theme-option ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
                <span className="theme-preview light" /> <Sun size={14} /> Light
              </button>
              <button type="button" className={`theme-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                <span className="theme-preview dark" /> <Moon size={14} /> Dark
              </button>
            </div>
            <p className="tiny muted" style={{ marginTop: 10 }}>Your preference is stored on this device only.</p>
          </SectionCard>

          <SectionCard title="Your access" description={ROLE_DESCRIPTIONS[user?.role]} icon={ShieldCheck}>
            <div className="security-list">
              <div className="security-item"><CheckCircle2 size={14} /> View the dashboard, inventory and reports</div>
              {user?.role !== 'Viewer' && <div className="security-item"><CheckCircle2 size={14} /> Add and edit inventory items</div>}
              {user?.role !== 'Viewer' && <div className="security-item"><CheckCircle2 size={14} /> Record stock transactions and borrowing</div>}
              {user?.role === 'Administrator' && <div className="security-item"><CheckCircle2 size={14} /> Manage users, roles, categories and logs</div>}
            </div>
          </SectionCard>

          <SectionCard title="Security" description="How this system protects your data" icon={Lock}>
            <div className="security-list">
              <div className="security-item"><CheckCircle2 size={14} /> Passwords are hashed with bcrypt — never stored in plain text.</div>
              <div className="security-item"><CheckCircle2 size={14} /> Sessions use signed, HTTP-only cookies.</div>
              <div className="security-item"><CheckCircle2 size={14} /> Every API request is checked against your role.</div>
              <div className="security-item"><CheckCircle2 size={14} /> Inputs are validated and sanitized against NoSQL injection.</div>
              <div className="security-item"><CheckCircle2 size={14} /> Sensitive actions are recorded in the activity log.</div>
            </div>
          </SectionCard>

          <SectionCard title="Session" description="Sign out of the inventory system">
            <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
              <LogOut size={15} /> Log out
            </button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => navigate('/')}>
              Back to dashboard
            </button>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
