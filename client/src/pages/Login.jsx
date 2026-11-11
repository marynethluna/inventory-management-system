import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const DEMO_ACCOUNTS = [
  { role: 'Administrator', username: 'admin', password: 'Admin@123', color: '#f28c28', description: 'Full system access' },
  { role: 'Inventory Staff', username: 'staff', password: 'Staff@123', color: '#2c5f8a', description: 'Manage stock & borrowing' },
  { role: 'Viewer', username: 'viewer', password: 'Viewer@123', color: '#8a8a8a', description: 'Read-only access' },
];

const FEATURES = [
  { icon: ShieldCheck, text: 'Role-based access control for administrators, inventory staff and viewers.' },
  { icon: Boxes, text: 'Real-time stock levels with automatic low-stock and out-of-stock alerts.' },
  { icon: ClipboardList, text: 'Borrowing and return tracking with overdue monitoring.' },
  { icon: BarChart3, text: 'Printable reports, CSV exports and a complete audit trail.' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.username.trim() || !form.password) {
      setError('Enter both your username and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.username.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account) => {
    setForm({ username: account.username, password: account.password });
    setError('');
  };

  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="brand-row">
            <div className="brand-mark">IM</div>
            <div>
              <b>School Inventory System</b>
              <small>Management System with Access Control</small>
            </div>
          </div>
          <h1>
            School inventory,
            <br />
            <em>organized and secure.</em>
          </h1>
          <p className="lead">
            A centralized platform for monitoring school supplies, computer equipment, laboratory materials and
            borrowed resources — with access control that keeps every record accountable.
          </p>
          <div className="login-features">
            {FEATURES.map((feature) => (
              <div className="login-feature" key={feature.text}>
                <span className="lf-icon">
                  <feature.icon size={14} />
                </span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-brand-foot">
          <b>Cavite State University</b> · Don Severino de las Alas Campus
          <br />
          College of Engineering and Information Technology · Indang, Cavite
        </div>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-brand">
            <div className="brand-mark">IM</div>
            <div>
              <b>School Inventory System</b>
              <small>Management System with Access Control</small>
            </div>
          </div>

          <h2>Welcome back</h2>
          <p className="sub">Sign in with your school inventory account to continue.</p>

          <form className="login-form" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="username">Username</label>
              <div className="input-icon-wrap">
                <UserRound size={15} />
                <input
                  id="username"
                  className="input"
                  autoComplete="username"
                  placeholder="e.g. admin"
                  value={form.username}
                  onChange={update('username')}
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="pw-wrap">
                <input
                  id="password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={update('password')}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <Lock size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div className="login-meta">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={13} /> Secure session
              </span>
              <span>Accounts are managed by administrators</span>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ minHeight: 40 }}>
              {loading ? <span className="spinner" /> : <Lock size={15} />}
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>

          <div className="login-note" style={{ marginTop: 14 }}>
            <CheckCircle2 size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              New accounts are created by an administrator. If you cannot sign in, please contact the inventory
              administrator to verify your role and account status.
            </span>
          </div>

          <div className="demo-box">
            <div className="demo-title">Demonstration accounts</div>
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map((account) => (
                <button type="button" key={account.username} className="demo-account" onClick={() => fillDemo(account)}>
                  <span className="role-dot" style={{ background: account.color }} />
                  <span>
                    <b>{account.role}</b>
                    <small>
                      {account.username} · {account.password}
                    </small>
                  </span>
                  <span className="demo-fill">Use</span>
                </button>
              ))}
            </div>
          </div>

          <p className="login-foot">
            Protected by role-based access control · <ArrowRight size={10} style={{ display: 'inline', verticalAlign: '-1px' }} /> Inventory Management System v1.0
          </p>
        </div>
      </section>
    </div>
  );
}
