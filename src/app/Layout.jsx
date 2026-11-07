import { memo, Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../platform/auth/authThunks.js';
import { selectUser } from '../platform/auth/authSlice.js';
import { NavIcon } from '../platform/ui/icons.jsx';
import { Avatar, Spinner, Toasts } from '../platform/ui/ui.jsx';
import { MORE_NAV, NAV, PRIMARY_NAV } from './modules.js';

const fmt = (n) => (n > 99 ? '99+' : n);

/** Each item's badge hook runs in its own component, so hooks stay unconditional. */
const Badge = memo(function Badge({ use, className }) {
  const n = use();
  return n > 0 ? <span className={className}>{fmt(n)}</span> : null;
});

// MORE_NAV is static, so calling its badge hooks in a loop keeps hook order stable.
const MORE_BADGES = MORE_NAV.filter((n) => n.useBadge).map((n) => n.useBadge);
function MoreBadge() {
  const total = MORE_BADGES.reduce((sum, use) => sum + (use() || 0), 0);
  return total > 0 ? <span className="k-tab-badge">{fmt(total)}</span> : null;
}

export default function Layout() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  return (
    <div className="shell k-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-logo">Rp</span>
          <span>Catatanku</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">
              {({ isActive }) => (
                <>
                  <span className="nav-icon"><NavIcon name={n.icon} active={isActive} size={20} /></span>
                  <span className="nav-label">{n.label}</span>
                  {n.useBadge && <Badge use={n.useBadge} className="badge" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.displayName} src={user.photoURL} size={34} />
          <div className="sidebar-user-info">
            <strong>{user.displayName}</strong>
            <small className="muted">{user.email}</small>
          </div>
          <button className="icon-btn" title="Keluar" onClick={() => dispatch(logout())}>🚪</button>
        </div>
      </aside>

      <main className="content">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="k-tabbar" aria-label="Navigasi utama">
        {PRIMARY_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="k-tab">
            {({ isActive }) => (
              <>
                <NavIcon name={n.icon} active={isActive} />
                {n.label}
                {n.useBadge && <Badge use={n.useBadge} className="k-tab-badge" />}
              </>
            )}
          </NavLink>
        ))}
        <NavLink to="/more" className="k-tab">
          {({ isActive }) => (
            <>
              <NavIcon name="user" active={isActive} />
              Akun
              <MoreBadge />
            </>
          )}
        </NavLink>
      </nav>
      <Toasts />
    </div>
  );
}
