import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FileBarChart2,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_ITEMS, can } from '../utils/permissions';

const ICONS = {
  dashboard: LayoutDashboard,
  inventory: Boxes,
  transactions: ArrowLeftRight,
  borrowing: ClipboardList,
  categories: Tags,
  reports: FileBarChart2,
  users: Users,
  logs: History,
  settings: Settings,
};

export function Sidebar({ open, pinned, isMobile, onClose, onLogout, alertCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => can(user?.role, item.permission));
  const groups = [...new Set(items.map((item) => item.group))];

  const go = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {isMobile && open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`sidebar ${open ? 'is-open' : ''} ${pinned && !isMobile ? 'is-pinned' : ''}`.trim()}
        aria-label="Main navigation"
        onMouseLeave={() => {
          if (!pinned) onClose();
        }}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">IM</div>
          <div className="sidebar-brand-text">
            <b>School Inventory</b>
            <small>Management System</small>
          </div>
          {isMobile && (
            <button type="button" className="sidebar-logout" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close menu">
              <X size={14} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group}>
              <div className="nav-group-label">{group}</div>
              {items
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = location.pathname === item.to;
                  return (
                    <button
                      type="button"
                      key={item.to}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => go(item.to)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={17} strokeWidth={1.9} />
                      <span>{item.label}</span>
                      {item.icon === 'inventory' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{user?.initials || 'IM'}</div>
            <div className="sidebar-user-info">
              <b>{user?.name}</b>
              <small>{user?.role}</small>
            </div>
            <button type="button" className="sidebar-logout" onClick={onLogout} title="Log out" aria-label="Log out">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
