import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import api from '../api/client';
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
      // Notifications are supplementary; do not block the current page.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, location.pathname]);

  useEffect(() => {
    const interval = setInterval(loadNotifications, 60_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    setMobileOpen(false);
    setHovered(false);
  }, [location.pathname]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

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
    hideTimer.current = setTimeout(() => setHovered(false), 180);
  };

  const sidebarOpen = isDesktop ? pinned || hovered : mobileOpen;
  const mainClass = isDesktop
    ? sidebarOpen ? 'main-area sidebar-expanded' : 'main-area sidebar-collapsed'
    : 'main-area sidebar-mobile';

  return (
    <div className="app-shell">
      {isDesktop && canHover && !pinned && (
        <div className="sidebar-hotzone" onMouseEnter={revealSidebar} aria-hidden="true" />
      )}

      <Sidebar
        open={sidebarOpen}
        isMobile={!isDesktop}
        onClose={() => {
          if (isDesktop) {
            if (pinned) setPinned(false);
            else setHovered(false);
          } else {
            setMobileOpen(false);
          }
        }}
        onMouseEnter={revealSidebar}
        onMouseLeave={scheduleHide}
        alertCount={notifications.total}
      />

      <div className={mainClass} onMouseEnter={scheduleHide}>
        <Topbar onMenuClick={handleMenuClick} notifications={notifications} onRefreshNotifications={loadNotifications} />
        <main className="content" aria-live="polite">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
