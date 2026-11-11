import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  Clock,
  LogOut,
  Menu,
  Moon,
  PackageX,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { PAGE_META } from '../utils/permissions';
import { formatDate } from '../utils/format';

export function Topbar({ onMenuClick, notifications, onRefreshNotifications }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [openMenu, setOpenMenu] = useState(null);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  const meta = PAGE_META[location.pathname] || { title: 'School Inventory', subtitle: '' };
  const alertCount = notifications?.total || 0;

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
                setOpenMenu((current) => (current === 'notifications' ? null : current));
      }
      if (userRef.current && !userRef.current.contains(event.target)) {
        setOpenMenu((current) => (current === 'user' ? null : current));
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (menu) => setOpenMenu((current) => (current === menu ? null : menu));

  return (
    <header className="topbar no-print">
      <div className="topbar-left">
        <button type="button" className="icon-btn" onClick={onMenuClick} aria-label="Toggle navigation menu" title="Menu">
          <Menu size={18} />
        </button>
        <div className="topbar-title">
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="dropdown-wrap" ref={notifRef}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              toggle('notifications');
              onRefreshNotifications?.();
            }}
            aria-label={`Notifications${alertCount ? `, ${alertCount} alerts` : ''}`}
            aria-expanded={openMenu === 'notifications'}
            title="Low stock and overdue alerts"
          >
            <Bell size={17} />
            {alertCount > 0 && <span className="dot">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
          {openMenu === 'notifications' && (
            <div className="dropdown wide" role="menu">
              <div className="dropdown-head">
                <b>Inventory alerts</b>
                <small>{alertCount} active</small>
              </div>
              <div className="dropdown-scroll">
                {!alertCount && (
                  <div className="empty-state" style={{ padding: '22px 12px' }}>
                    <ShieldCheck size={20} style={{ color: 'var(--success)' }} />
                    <h3 style={{ fontSize: 12.5 }}>All clear</h3>
                    <p style={{ fontSize: 11.5 }}>No low-stock, out-of-stock or overdue items.</p>
                  </div>
                )}
                {notifications?.outOfStock?.length > 0 && (
                  <>
                    <div className="nav-group-label" style={{ color: 'var(--muted)' }}>Out of stock</div>
                    {notifications.outOfStock.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="notif-item"
                        onClick={() => {
                          navigate('/inventory');
                          setOpenMenu(null);
                        }}
                      >
                        <span className="notif-icon danger"><PackageX size={15} /></span>
                        <span className="notif-body">
                          <b>{item.name}</b>
                          <small>{item.itemCode} · 0 {item.unit} available</small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
                {notifications?.lowStock?.length > 0 && (
                  <>
                    <div className="nav-group-label" style={{ color: 'var(--muted)' }}>Low stock</div>
                    {notifications.lowStock.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className="notif-item"
                        onClick={() => {
                          navigate('/inventory');
                          setOpenMenu(null);
                        }}
                      >
                        <span className="notif-icon warn"><AlertTriangle size={15} /></span>
                        <span className="notif-body">
                          <b>{item.name}</b>
                          <small>{item.quantity} of {item.minimumStock} minimum {item.unit} left</small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
                {notifications?.overdueBorrows?.length > 0 && (
                  <>
                    <div className="nav-group-label" style={{ color: 'var(--muted)' }}>Overdue returns</div>
                    {notifications.overdueBorrows.map((borrow) => (
                      <button
                        type="button"
                        key={borrow.id}
                        className="notif-item"
                        onClick={() => {
                          navigate('/borrowing');
                          setOpenMenu(null);
                        }}
                      >
                        <span className="notif-icon info"><Clock size={15} /></span>
                        <span className="notif-body">
                          <b>{borrow.itemName} · {borrow.borrowerName}</b>
                          <small>Due {formatDate(borrow.expectedReturnDate)} · {borrow.quantity} unit(s)</small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="dropdown-sep" />
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  navigate('/inventory');
                  setOpenMenu(null);
                }}
              >
                <ShieldCheck size={15} /> Review inventory alerts
              </button>
            </div>
          )}
        </div>

        <div className="dropdown-wrap" ref={userRef}>
          <button
            type="button"
            className="user-menu-btn"
            onClick={() => toggle('user')}
            aria-expanded={openMenu === 'user'}
            aria-haspopup="menu"
          >
            <span className="avatar">{user?.initials || 'IM'}</span>
            <span className="user-meta">
              <b>{user?.name}</b>
              <small>{user?.role}</small>
            </span>
            <ChevronDown size={14} className="chev" />
          </button>
          {openMenu === 'user' && (
            <div className="dropdown" role="menu">
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <b style={{ display: 'block', fontSize: 13 }}>{user?.name}</b>
                <small style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>@{user?.username}</small>
                <span className="badge badge-orange no-dot" style={{ marginTop: 6 }}>{user?.role}</span>
              </div>
              <button type="button" className="dropdown-item" onClick={() => navigate('/settings')}>
                <UserRound size={15} /> My profile
              </button>
              <button type="button" className="dropdown-item" onClick={() => navigate('/settings')}>
                <Settings size={15} /> Settings
              </button>
              <div className="dropdown-sep" />
              <button type="button" className="dropdown-item danger" onClick={logout}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
