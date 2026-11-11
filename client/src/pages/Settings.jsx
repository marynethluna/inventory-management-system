import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Lock,
  Mail,
  Moon,
  Plus,
  Save,
  Settings2,
  Sun,
  Tags,
  Trash2,
  UserRound,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { PageHeader, SectionCard, RoleBadge } from '../components/common';
import { formatDate, formatDateTime } from '../utils/format';
import { UNITS as DEFAULT_UNITS } from '../utils/constants';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Settings() {
  const { user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const isAdmin = user?.role === 'Administrator';

  const [profile, setProfile] = useState({ name: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [inventorySettings, setInventorySettings] = useState({ defaultMinimumStock: 5, units: DEFAULT_UNITS });
  const [unitDraft, setUnitDraft] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    if (user) setProfile({ name: user.name, email: user.email || '' });
  }, [user]);

  useEffect(() => {
    let active = true;
    api.get('/settings')
      .then((result) => { if (active) setInventorySettings(result.settings); })
      .catch(() => { if (active) setSettingsError('Unable to load inventory defaults.'); })
      .finally(() => { if (active) setSettingsLoading(false); });
    return () => { active = false; };
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    if (profile.name.trim().length < 2) return setProfileError('Enter a name with at least 2 characters.');
    const normalizedEmail = profile.email.trim().toLowerCase();
    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) return setProfileError('Enter a valid email address.');
    setProfileSaving(true);
    try {
      await api.patch('/auth/profile', { name: profile.name.trim(), email: normalizedEmail });
      await refresh();
      toast.success('Profile updated.');
    } catch (error) {
      setProfileError(error.message || 'Unable to update the profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (!passwords.current) return setPasswordError('Enter your current password.');
    if (passwords.next.length < 8 || passwords.next.length > 72) return setPasswordError('New password must be between 8 and 72 characters.');
    if (!/[A-Za-z]/.test(passwords.next) || !/[0-9]/.test(passwords.next)) return setPasswordError('Include at least one letter and one number.');
    if (passwords.next !== passwords.confirm) return setPasswordError('New passwords do not match.');
    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: passwords.current, password: passwords.next });
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password updated. Other sessions have been signed out.');
    } catch (error) {
      setPasswordError(error.message || 'Unable to change the password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const addUnit = () => {
    const unit = unitDraft.trim();
    if (!/^[A-Za-z][A-Za-z0-9 /-]{0,19}$/.test(unit)) {
      setSettingsError('Use a 1–20 character unit name beginning with a letter.');
      return;
    }
    if (inventorySettings.units.some((entry) => entry.toLowerCase() === unit.toLowerCase())) {
      setSettingsError('That unit is already in the list.');
      return;
    }
    setSettingsError('');
    setInventorySettings((current) => ({ ...current, units: [...current.units, unit] }));
    setUnitDraft('');
  };

  const removeUnit = (unit) => {
    if (inventorySettings.units.length <= 1) {
      setSettingsError('Keep at least one unit of measurement configured.');
      return;
    }
    setInventorySettings((current) => ({ ...current, units: current.units.filter((entry) => entry !== unit) }));
    setSettingsError('');
  };

  const saveInventorySettings = async (event) => {
    event.preventDefault();
    setSettingsError('');
    const threshold = Number(inventorySettings.defaultMinimumStock);
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 1_000_000) {
      return setSettingsError('Default minimum stock must be a whole number from 0 to 1,000,000.');
    }
    if (!inventorySettings.units.length) return setSettingsError('Keep at least one unit configured.');
    setSettingsSaving(true);
    try {
      const result = await api.patch('/settings', {
        defaultMinimumStock: threshold,
        units: inventorySettings.units,
      });
      setInventorySettings(result.settings);
      toast.success('Inventory defaults saved.');
    } catch (error) {
      setSettingsError(error.message || 'Unable to save inventory defaults.');
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, password, appearance and inventory defaults." />

      <div className="settings-grid">
        <div className="stack">
          <SectionCard title="Profile" description="Your account details and current access level" icon={UserRound}>
            <div className="profile-head">
              <div className="avatar lg">{user?.initials}</div>
              <div><h2>{user?.name}</h2><p>@{user?.username} · {user?.email || 'No email on file'}</p><div className="profile-role"><RoleBadge role={user?.role} /></div></div>
            </div>
            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <div className="field"><label htmlFor="profile-name">Full name</label><input id="profile-name" className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} maxLength={80} autoComplete="name" /></div>
                <div className="field"><label htmlFor="profile-email">Email address</label><div className="input-icon-wrap"><Mail size={14} /><input id="profile-email" type="email" className="input" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} maxLength={120} autoComplete="email" /></div></div>
              </div>
              {profileError && <div className="login-error" style={{ marginTop: 12 }} role="alert">{profileError}</div>}
              <div className="row settings-form-actions"><button type="submit" className="btn btn-primary" disabled={profileSaving}>{profileSaving ? <span className="spinner" /> : <Save size={15} />} Save profile</button><span className="tiny muted">Your username and role are managed by an administrator.</span></div>
            </form>
            <div className="divider" />
            <div className="detail-grid">
              <div className="detail-item"><div className="dt">Role</div><div className="dd">{user?.role}</div></div>
              <div className="detail-item"><div className="dt">Status</div><div className="dd"><span className="badge badge-success">Active</span></div></div>
              <div className="detail-item"><div className="dt">Last sign-in</div><div className="dd">{user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</div></div>
              <div className="detail-item"><div className="dt">Member since</div><div className="dd">{formatDate(user?.createdAt)}</div></div>
            </div>
          </SectionCard>

          <SectionCard title="Change password" description="Use a strong password you do not use elsewhere" icon={KeyRound}>
            <form onSubmit={changePassword}>
              <div className="form-grid">
                <div className="field span-2"><label htmlFor="current-password">Current password</label><div className="input-icon-wrap"><Lock size={14} /><input id="current-password" type="password" className="input" autoComplete="current-password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} maxLength={72} /></div></div>
                <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" className="input" autoComplete="new-password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} maxLength={72} /><span className="field-hint">At least 8 characters with a letter and a number.</span></div>
                <div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" className="input" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} maxLength={72} /></div>
              </div>
              {passwordError && <div className="login-error" style={{ marginTop: 12 }} role="alert">{passwordError}</div>}
              <button type="submit" className="btn btn-primary settings-form-actions" disabled={passwordSaving}>{passwordSaving ? <span className="spinner" /> : <KeyRound size={15} />} Update password</button>
            </form>
          </SectionCard>
        </div>

        <div className="stack">
          <SectionCard title="Appearance" description="Choose a theme for this device" icon={Sun}>
            <div className="theme-options">
              <button type="button" className={`theme-option ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}><span className="theme-preview light" /><Sun size={14} /> Light</button>
              <button type="button" className={`theme-option ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}><span className="theme-preview dark" /><Moon size={14} /> Dark</button>
            </div>
            <p className="tiny muted settings-note">Theme preference is saved on this device.</p>
          </SectionCard>

          {isAdmin && (
            <SectionCard title="Inventory defaults" description="Defaults used when staff create new inventory records" icon={Settings2}>
              {settingsLoading ? <div className="loading-block"><span className="spinner" /> Loading settings…</div> : (
                <form onSubmit={saveInventorySettings}>
                  <div className="field"><label htmlFor="default-minimum-stock">Default minimum stock threshold</label><input id="default-minimum-stock" type="number" min={0} max={1_000_000} step={1} className="input threshold-input" value={inventorySettings.defaultMinimumStock} onChange={(event) => setInventorySettings({ ...inventorySettings, defaultMinimumStock: event.target.value })} /><span className="field-hint">Used as the starting minimum level for new items. Each item keeps its own editable minimum.</span></div>
                  <div className="field units-field"><label>Units of measurement</label><div className="unit-chip-list">{inventorySettings.units.map((unit) => <span className="unit-chip" key={unit}>{unit}<button type="button" onClick={() => removeUnit(unit)} aria-label={`Remove unit ${unit}`} title={`Remove ${unit}`}><Trash2 size={12} /></button></span>)}</div><div className="unit-add-row"><input className="input" aria-label="New unit" placeholder="Add a unit, e.g. roll" value={unitDraft} onChange={(event) => setUnitDraft(event.target.value)} maxLength={20} /><button type="button" className="btn btn-secondary" onClick={addUnit}><Plus size={14} /> Add unit</button></div></div>
                  {settingsError && <div className="login-error" style={{ marginTop: 12 }} role="alert">{settingsError}</div>}
                  <div className="row settings-form-actions"><button type="submit" className="btn btn-primary" disabled={settingsSaving}>{settingsSaving ? <span className="spinner" /> : <Save size={15} />} Save defaults</button><Link className="btn btn-secondary" to="/categories"><Tags size={15} /> Manage categories</Link></div>
                </form>
              )}
            </SectionCard>
          )}

        </div>
      </div>
    </>
  );
}
