import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../platform/auth/authThunks.js';
import { selectUser } from '../platform/auth/authSlice.js';
import { NavIcon } from '../platform/ui/icons.jsx';
import { Hero, Section } from '../platform/ui/kit.jsx';
import { Avatar } from '../platform/ui/ui.jsx';
import { isNativeApp, native } from '../platform/native.js';
import { MORE_NAV } from './modules.js';

/** "Akun" tab: profile, every module page that isn't a bottom tab, plus account actions. */
export default function MorePage() {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();
  const status = isNativeApp ? native.deviceStatus() : null;
  return (
    <div className="page k-page">
      <Hero>
        <div className="k-hero-row">
          <Avatar name={user.displayName} src={user.photoURL} size={52} />
          <div className="grow">
            <h1>{user.displayName}</h1>
            <p>{user.email}</p>
          </div>
        </div>
      </Hero>
      <Section title="Menu">
        <div className="k-card flush">
          {MORE_NAV.map((n) => (
            <Link key={n.to} to={n.to} className="k-row">
              <span className="k-avatar" style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <NavIcon name={n.icon} size={20} />
              </span>
              <span className="k-main k-title">{n.label}</span>
              <span className="k-muted">›</span>
            </Link>
          ))}
        </div>
      </Section>
      <div className="k-pad" style={{ marginTop: 20 }}>
        <button type="button" className="k-btn danger block" onClick={() => dispatch(logout())}>Keluar</button>
        <p className="k-muted" style={{ textAlign: 'center', fontSize: '.75rem' }}>
          Catatanku web{status ? ` · aplikasi Android ${status.appVersion}` : ''}
        </p>
      </div>
    </div>
  );
}
