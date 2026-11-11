import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const media = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [pinned, setPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [notifications, setNotifications] = useState({ lowStock: [], outOfStock: [], overdueBorrows: [], total: 0 });
  const hideTimer = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/dashboard/notifications');
      setNotifications(data);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  useEffect(() => {
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    setMobileOpen(false);
    setHovered(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleMenuClick = () => {
    if (isDesktop) setPinned((current) => !current);
    else setMobileOpen((current) => !current);
  };

  const revealSidebar = () => {
    if (!isDesktop || !canHover) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered(true);
  };

  const scheduleHide = () => {
    if (!isDesktop || !canHover || pinned) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 160);
  };

  const sidebarOpen = isDesktop ? pinned || hovered : mobileOpen;

  return (
    <div className="app-shell">
      {isDesktop && canHover && !pinned && (
        <div className="sidebar-hotzone" onMouseEnter={revealSidebar} aria-hidden="true" />
      )}

      <Sidebar
        open={sidebarOpen}
        pinned={pinned}
        isMobile={!isDesktop}
        onClose={() => {
          if (isDesktop) {
            if (pinned) setPinned(false);
            else setHovered(false);
          } else {
            setMobileOpen(false);
          }
        }}
        onLogout={logout}
        alertCount={notifications.total}
      />

      <div className={`main-area ${pinned && isDesktop ? 'pinned' : ''}`.trim()}>
        <Topbar onMenuClick={handleMenuClick} notifications={notifications} onRefreshNotifications={loadNotifications} />
        <main className="content" onMouseEnter={scheduleHide} aria-live="polite">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
