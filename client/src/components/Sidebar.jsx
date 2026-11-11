import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  FileBarChart2,
  History,
  LayoutDashboard,
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

export function Sidebar({ open, isMobile, onClose, onMouseEnter, onMouseLeave, alertCount = 0 }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const collapsed = !open && !isMobile;
  const items = NAV_ITEMS.filter((item) => can(user?.role, item.permission));
  const groups = [...new Set(items.map((item) => item.group))];

  const go = (path) => {
    navigate(path);
    if (isMobile || !open) onClose();
  };

  return (
    <>
      {isMobile && open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`sidebar ${open ? 'is-open' : 'is-collapsed'} ${isMobile ? 'is-mobile' : ''}`.trim()}
        aria-label="Main navigation"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="sidebar-brand">
          <div className="brand-mark" aria-label="Inventory Management">IM</div>
          <div className="sidebar-brand-text" aria-hidden={collapsed}>
            <b>School Inventory</b>
            <small>Management System</small>
          </div>
          {isMobile && (
            <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close navigation">
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav" aria-label="Application pages">
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-label" aria-hidden={collapsed}>{group}</div>
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
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                      <span className="nav-item-label" aria-hidden={collapsed}>{item.label}</span>
                      {item.icon === 'inventory' && alertCount > 0 && <span className="nav-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-collapsed-hint" aria-hidden={collapsed ? 'true' : undefined}>
          <span className="sidebar-hint-icon"><Boxes size={15} /></span>
          <span>School resources, accounted for.</span>
        </div>
      </aside>
    </>
  );
}
