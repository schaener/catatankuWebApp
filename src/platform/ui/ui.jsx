import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toastRemoved } from './uiSlice.js';
import { initials } from '../format.js';

export function Avatar({ name, src, size = 36 }) {
  return src ? (
    <img className="avatar" src={src} alt={name} width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = 'Memuat...' }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '🗒️', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  const msg = error.message || 'Terjadi kesalahan';
  const hint = error.code === 'permission-denied' ? ' — periksa Firestore security rules.' : '';
  return <div className="error-box">⚠️ {msg}{hint}</div>;
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function StatCard({ label, value, tone, sub }) {
  return (
    <div className={`card stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Toasts() {
  const toasts = useSelector((s) => s.ui.toasts);
  const dispatch = useDispatch();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dispatch(toastRemoved(t.id))}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
