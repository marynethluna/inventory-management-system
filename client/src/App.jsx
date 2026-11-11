import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Borrowing from './pages/Borrowing';
import Categories from './pages/Categories';
import Reports from './pages/Reports';
import Users from './pages/Users';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { can } from './utils/permissions';

function FullScreenLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="brand-mark" style={{ width: 48, height: 48, fontSize: 17 }}>IM</div>
        <span className="spinner lg" />
        <span className="small muted">Loading your workspace…</span>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequirePermission({ permission, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(user.role, permission)) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: 32 }}>
        <div className="empty-icon" style={{ margin: '0 auto 12px' }}>
          <span style={{ fontSize: 20 }}>🔒</span>
        </div>
        <h2 style={{ fontSize: 17 }}>Access restricted</h2>
        <p className="small muted" style={{ marginTop: 6 }}>
          Your role ({user.role}) does not have permission to open this module. If you believe this is a mistake,
          please contact an administrator.
        </p>
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.assign('/')}>
          Back to dashboard
        </button>
      </div>
    );
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenLoader />;

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/borrowing" element={<Borrowing />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/users"
          element={
            <RequirePermission permission="users:read">
              <Users />
            </RequirePermission>
          }
        />
        <Route
          path="/logs"
          element={
            <RequirePermission permission="logs:read">
              <ActivityLogs />
            </RequirePermission>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
