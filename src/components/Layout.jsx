import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../features/auth/authThunks.js';
import { selectUser } from '../features/auth/authSlice.js';
import { Avatar, Spinner, Toasts } from './ui.jsx';
import { useNotificationAlerts, useNotifications } from '../features/notifications/useNotifications.js';
import { useGetInboxQuery } from '../services/inboxApi.js';
import { useGetDevicesQuery } from '../services/devicesApi.js';

const NAV = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/transactions', icon: '💸', label: 'Transaksi' },
  // Only shown once a phone is connected or something waits for review (keeps the mobile tab bar short)
  { to: '/review', icon: '📲', label: 'Tinjau', optional: true },
  { to: '/search', icon: '🔎', label: 'Cari' },
  { to: '/reports', icon: '📄', label: 'Laporan' },
  { to: '/split', icon: '🧾', label: 'Split Bill' },
  { to: '/chat', icon: '💬', label: 'Chat' },
  { to: '/feed', icon: '🌐', label: 'Feed' },
  { to: '/notifications', icon: '🔔', label: 'Notifikasi' },
];

// Unread badges per menu item
const BADGE = { '/chat': 'chat', '/notifications': 'total', '/review': 'review' };

export default function Layout() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const { counts: notifCounts } = useNotifications();
  const { data: inbox = [] } = useGetInboxQuery();
  const { data: devices = [] } = useGetDevicesQuery();
  const { pathname } = useLocation();
  const counts = { ...notifCounts, review: inbox.length };
  useNotificationAlerts();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">Rp</span>
          <span>Catatan Keuangan</span>
        </div>
        <nav>
          {NAV.filter((n) => !n.optional || counts.review > 0 || devices.length > 0 || pathname === n.to).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {counts[BADGE[n.to]] > 0 && <span className="badge">{counts[BADGE[n.to]] > 99 ? '99+' : counts[BADGE[n.to]]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.displayName} src={user.photoURL} size={34} />
          <div className="sidebar-user-info">
            <strong>{user.displayName}</strong>
            <small className="muted">{user.email}</small>
          </div>
          <button className="icon-btn" title="Keluar" onClick={() => dispatch(logout())}>
            🚪
          </button>
        </div>
      </aside>
      <main className="content">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Toasts />
    </div>
  );
}
