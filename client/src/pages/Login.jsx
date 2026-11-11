import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

const FEATURES = [
  { icon: ShieldCheck, title: 'Access that fits every role', text: 'Clear permissions for administrators, inventory staff and viewers.' },
  { icon: Boxes, title: 'Reliable stock records', text: 'Track computer-lab equipment, school resources and every stock movement.' },
  { icon: BarChart3, title: 'Useful inventory insights', text: 'Find low-stock items quickly and create clear, printable reports.' },
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const mode = useMemo(() => location.pathname.replace(/^\//, '') || 'login', [location.pathname]);
  const resetToken = searchParams.get('token') || '';

  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [signupForm, setSignupForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [email, setEmail] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [resetForm, setResetForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const pageCopy = {
    login: { title: 'Welcome back', subtitle: 'Sign in to your school inventory workspace.' },
    signup: { title: 'Create your account', subtitle: 'New accounts start with Viewer access. An administrator can update your role later.' },
    'forgot-password': { title: 'Reset your password', subtitle: 'Enter the email associated with your account and we’ll send a one-time link.' },
    'reset-password': { title: 'Choose a new password', subtitle: 'Set a new password for your inventory account.' },
  }[mode] || { title: 'Welcome', subtitle: 'School Inventory Management System' };

  const clearFeedback = () => {
    setError('');
    setNotice('');
    setResetUrl('');
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (!loginForm.identifier.trim() || !loginForm.password) {
      setError('Enter your email or username and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(loginForm.identifier.trim(), loginForm.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}.`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitSignup = async (event) => {
    event.preventDefault();
    clearFeedback();
    const normalizedEmail = signupForm.email.trim().toLowerCase();
    if (signupForm.name.trim().length < 2) return setError('Enter your full name (at least 2 characters).');
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setError('Enter a valid email address.');
    if (signupForm.password.length < 8 || signupForm.password.length > 72) return setError('Password must be between 8 and 72 characters.');
    if (!/[A-Za-z]/.test(signupForm.password) || !/[0-9]/.test(signupForm.password)) return setError('Include at least one letter and one number in your password.');
    if (signupForm.password !== signupForm.confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await signup(signupForm.name.trim(), normalizedEmail, signupForm.password, signupForm.confirmPassword);
      toast.success('Account created. You’re signed in as a Viewer.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (event) => {
    event.preventDefault();
    clearFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setError('Enter a valid email address.');
    setLoading(true);
    try {
      const result = await api.post('/auth/forgot-password', { email: normalizedEmail });
      setNotice(result.message || 'If an account with that email exists, a password reset link will be sent shortly.');
      if (result.resetToken) {
        const reset = new URL('/reset-password', window.location.origin);
        reset.searchParams.set('token', result.resetToken);
        setResetUrl(reset.toString());
      }
    } catch (err) {
      setError(err.message || 'Unable to process the request. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    clearFeedback();
    if (!resetToken) return setError('This reset link is missing its token. Request a new password reset link.');
    if (resetForm.password.length < 8 || resetForm.password.length > 72) return setError('Password must be between 8 and 72 characters.');
    if (!/[A-Za-z]/.test(resetForm.password) || !/[0-9]/.test(resetForm.password)) return setError('Include at least one letter and one number in your password.');
    if (resetForm.password !== resetForm.confirmPassword) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const result = await api.post('/auth/reset-password', {
        token: resetToken,
        password: resetForm.password,
        confirmPassword: resetForm.confirmPassword,
      });
      toast.success(result.message || 'Password reset successfully.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired. Request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => navigate('/login');
  const isLogin = mode === 'login';
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot-password';
  const isReset = mode === 'reset-password';

  return (
    <div className="login-page">
      <section className="login-brand" aria-label="Inventory system overview">
        <div className="login-brand-inner">
          <div className="brand-row">
            <div className="brand-mark">IM</div>
            <div>
              <b>School Inventory</b>
              <small>Management System</small>
            </div>
          </div>
          <h1>Keep every school resource <em>in good order.</em></h1>
          <p className="lead">
            A dependable place to manage computer-lab equipment, school resources, stock movements and borrowing records — with clear access control for every role.
          </p>
          <div className="login-features">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="login-feature" key={title}>
                <span className="lf-icon"><Icon size={16} /></span>
                <span><b>{title}</b><small>{text}</small></span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-brand-foot">Inventory Management System <span>·</span> Secure school resource tracking</div>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <div className="mobile-brand">
            <div className="brand-mark">IM</div>
            <div><b>School Inventory</b><small>Management System</small></div>
          </div>

          <div className="auth-heading">
            {(isForgot || isReset) && (
              <button type="button" className="auth-back" onClick={goBack}>
                <ArrowLeft size={14} /> Back to sign in
              </button>
            )}
            <h2>{pageCopy.title}</h2>
            <p className="sub">{pageCopy.subtitle}</p>
          </div>

          {isLogin && (
            <form className="login-form" onSubmit={submitLogin} noValidate>
              <div className="field">
                <label htmlFor="login-identifier">Email or username</label>
                <div className="input-icon-wrap">
                  <UserRound size={15} />
                  <input id="login-identifier" className="input" autoComplete="username" placeholder="you@school.edu or your username" value={loginForm.identifier} onChange={(event) => { setLoginForm({ ...loginForm, identifier: event.target.value }); clearFeedback(); }} autoFocus />
                </div>
              </div>
              <div className="field">
                <div className="field-label-row"><label htmlFor="login-password">Password</label><button type="button" className="auth-inline-link" onClick={() => navigate('/forgot-password')}>Forgot password?</button></div>
                <div className="pw-wrap">
                  <input id="login-password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={loginForm.password} onChange={(event) => { setLoginForm({ ...loginForm, password: event.target.value }); clearFeedback(); }} />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && <div className="login-error" role="alert"><Lock size={14} /><span>{error}</span></div>}
              <div className="login-meta"><span><ShieldCheck size={13} /> Secure sign-in</span><span>Cookies are HTTP-only</span></div>
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : <Lock size={15} />} {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="auth-switch">New to the system? <button type="button" className="auth-inline-link" onClick={() => navigate('/signup')}>Create an account <ArrowRight size={13} /></button></p>
            </form>
          )}

          {isSignup && (
            <form className="login-form" onSubmit={submitSignup} noValidate>
              <div className="field"><label htmlFor="signup-name">Full name</label><div className="input-icon-wrap"><UserRound size={15} /><input id="signup-name" className="input" autoComplete="name" maxLength={80} value={signupForm.name} onChange={(event) => { setSignupForm({ ...signupForm, name: event.target.value }); clearFeedback(); }} /></div></div>
              <div className="field"><label htmlFor="signup-email">Email address</label><div className="input-icon-wrap"><Mail size={15} /><input id="signup-email" type="email" className="input" autoComplete="email" maxLength={120} value={signupForm.email} onChange={(event) => { setSignupForm({ ...signupForm, email: event.target.value }); clearFeedback(); }} /></div></div>
              <div className="field"><label htmlFor="signup-password">Password</label><div className="pw-wrap"><input id="signup-password" type={showPassword ? 'text' : 'password'} className="input" autoComplete="new-password" maxLength={72} value={signupForm.password} onChange={(event) => { setSignupForm({ ...signupForm, password: event.target.value }); clearFeedback(); }} /><button type="button" className="pw-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><span className="field-hint">At least 8 characters, including a letter and a number.</span></div>
              <div className="field"><label htmlFor="signup-confirm">Confirm password</label><input id="signup-confirm" type="password" className="input" autoComplete="new-password" maxLength={72} value={signupForm.confirmPassword} onChange={(event) => { setSignupForm({ ...signupForm, confirmPassword: event.target.value }); clearFeedback(); }} /></div>
              {error && <div className="login-error" role="alert"><Lock size={14} /><span>{error}</span></div>}
              <div className="login-note"><CheckCircle2 size={14} /><span>Self-registered accounts receive read-only Viewer access. An administrator can assign a different role.</span></div>
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>{loading ? <span className="spinner" /> : <UserRound size={15} />} {loading ? 'Creating account…' : 'Create account'}</button>
              <p className="auth-switch">Already have an account? <button type="button" className="auth-inline-link" onClick={goBack}>Sign in</button></p>
            </form>
          )}

          {isForgot && (
            <form className="login-form" onSubmit={submitForgot} noValidate>
              <div className="field"><label htmlFor="forgot-email">Email address</label><div className="input-icon-wrap"><Mail size={15} /><input id="forgot-email" type="email" className="input" autoComplete="email" maxLength={120} value={email} onChange={(event) => { setEmail(event.target.value); clearFeedback(); }} /></div></div>
              {error && <div className="login-error" role="alert"><Lock size={14} /><span>{error}</span></div>}
              {notice && <div className="login-note success" role="status"><CheckCircle2 size={14} /><span>{notice}{resetUrl && <><br /><a className="auth-inline-link" href={resetUrl}>Open password reset link</a></>}</span></div>}
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>{loading ? <span className="spinner" /> : <Mail size={15} />} {loading ? 'Sending…' : 'Send reset link'}</button>
              <p className="auth-privacy-note">For account privacy, the same confirmation is shown whether or not the email is registered.</p>
            </form>
          )}

          {isReset && (
            <form className="login-form" onSubmit={submitReset} noValidate>
              {!resetToken && <div className="login-error" role="alert"><Lock size={14} /><span>This reset link is missing its token. <button type="button" className="auth-inline-link" onClick={() => navigate('/forgot-password')}>Request a new link</button></span></div>}
              <div className="field"><label htmlFor="reset-password">New password</label><div className="pw-wrap"><input id="reset-password" type={showPassword ? 'text' : 'password'} className="input" autoComplete="new-password" maxLength={72} value={resetForm.password} onChange={(event) => { setResetForm({ ...resetForm, password: event.target.value }); clearFeedback(); }} /><button type="button" className="pw-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><span className="field-hint">At least 8 characters, including a letter and a number.</span></div>
              <div className="field"><label htmlFor="reset-confirm">Confirm new password</label><input id="reset-confirm" type="password" className="input" autoComplete="new-password" maxLength={72} value={resetForm.confirmPassword} onChange={(event) => { setResetForm({ ...resetForm, confirmPassword: event.target.value }); clearFeedback(); }} /></div>
              {error && <div className="login-error" role="alert"><Lock size={14} /><span>{error}</span></div>}
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading || !resetToken}>{loading ? <span className="spinner" /> : <KeyRound size={15} />} {loading ? 'Updating password…' : 'Reset password'}</button>
            </form>
          )}

          <p className="login-foot">Protected by role-based access control · School Inventory Management System</p>
        </div>
      </section>
    </div>
  );
}
