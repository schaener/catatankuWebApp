import { memo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { CHART_COLORS } from '../constants.js';
import { formatCompact } from '../format.js';

// ---------------------------------------------------------------- app avatar

// Brand-ish tile colors for common Indonesian banks / wallets; anything else gets a stable hashed color.
const BRANDS = [
  [/bca/i, '#1d4ed8'], [/gojek|gopay/i, '#00aa13'], [/dana/i, '#108ee9'], [/ovo/i, '#4c1d95'],
  [/shopee/i, '#ee4d2d'], [/mandiri|livin/i, '#0b3d91'], [/bri/i, '#00529c'], [/bni|wondr/i, '#f37021'],
  [/jago/i, '#f5a623'], [/seabank/i, '#ff6a00'], [/linkaja/i, '#e82529'], [/jenius|btpn/i, '#00a5e3'],
];
const FALLBACK = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d', '#475569'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
const tileColor = (app) => BRANDS.find(([re]) => re.test(`${app.pkg} ${app.name}`))?.[1] ?? FALLBACK[Math.abs(hash(app.pkg || app.name || '?')) % FALLBACK.length];
const tileText = (name = '?') => {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, words[0].length <= 4 ? 4 : 2) : words[0][0] + words[1][0]).toUpperCase();
};

/** Tile standing in for a phone app's icon (the web can't read launcher icons). `app = { pkg, name }`. */
export const AppAvatar = memo(function AppAvatar({ app, size = 40 }) {
  const cash = app?.pkg === 'cash';
  return (
    <span
      className="k-avatar"
      title={app?.name}
      style={{ width: size, height: size, borderRadius: size / 3.2, fontSize: cash ? size * 0.45 : size / (tileText(app?.name).length > 2 ? 3.6 : 3), background: cash ? '#64748b' : tileColor(app || {}) }}
    >
      {cash ? '💵' : tileText(app?.name)}
    </span>
  );
});

// ---------------------------------------------------------------- layout pieces

/** Gradient page header used by the mobile screens (and as a banner on desktop). */
export function Hero({ children, pad = 'md', className = '' }) {
  return <header className={`k-hero k-hero-${pad} ${className}`}>{children}</header>;
}

export function Section({ title, action, onAction, children }) {
  return (
    <section className="k-section">
      {(title || action) && (
        <div className="k-section-head">
          <h3>{title}</h3>
          {action && (
            <button type="button" className="k-link" onClick={onAction}>
              {action}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tag({ tone = 'muted', children }) {
  return <span className={`k-tag k-tag-${tone}`}>{children}</span>;
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`k-seg ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} className={`${o.value === value ? 'on' : ''} ${o.tone ? `tone-${o.tone}` : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children, className = '' }) {
  return (
    <button type="button" className={`k-chip ${active ? 'on' : ''} ${className}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Bar({ value, max, color = 'var(--primary)' }) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span className="k-bar">
      <i style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export function Kpi({ label, value, sub, tone }) {
  return (
    <div className="k-kpi">
      <span className="muted">{label}</span>
      <b className={tone || ''}>{value}</b>
      {sub && <small className="muted">{sub}</small>}
    </div>
  );
}

export function Fab({ onClick, children }) {
  return (
    <button type="button" className="k-fab" onClick={onClick}>
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

// ---------------------------------------------------------------- sheet

/** Bottom sheet on phones, centered dialog on desktop. Locks page scroll; Esc / backdrop closes. */
export function Sheet({ title, onClose, children, footer }) {
  const labelId = useId();
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return createPortal(
    <div className="k-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="k-sheet" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="k-grab" />
        {title && (
          <div className="k-sheet-head">
            <h2 id={labelId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
              ✕
            </button>
          </div>
        )}
        <div className="k-sheet-body">{children}</div>
        {footer && <div className="k-sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- charts (dependency-free)

/** SVG donut; `slices = [{ label, value }]`. */
export const Donut = memo(function Donut({ slices, total, label = 'Keluar', size = 128 }) {
  const r = 15.9155; // circumference = 100
  let offset = 25; // start at 12 o'clock
  return (
    <div className="k-donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" width={size} height={size} aria-hidden="true">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        {total > 0 &&
          slices.map((s, i) => {
            const pct = (s.value / total) * 100;
            const gap = slices.length > 1 ? 0.6 : 0;
            const el = (
              <circle key={s.label} cx="21" cy="21" r={r} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth="6"
                strokeDasharray={`${Math.max(pct - gap, 0.3)} ${100 - Math.max(pct - gap, 0.3)}`} strokeDashoffset={offset} />
            );
            offset -= pct;
            return el;
          })}
      </svg>
      <div className="k-donut-center">
        <small>{label}</small>
        <b>{formatCompact(total)}</b>
      </div>
    </div>
  );
});

/** Bar chart from plain divs; `buckets = [{ label, value, current }]`. */
export const Bars = memo(function Bars({ buckets }) {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const step = buckets.length <= 12 ? 1 : 5;
  return (
    <div className="k-bars">
      <small className="muted">{max > 1 ? `maks ${formatCompact(max)}` : 'Belum ada pengeluaran'}</small>
      <div className="k-bars-plot">
        {buckets.map((b) => (
          <span key={b.label} className={b.current ? 'current' : ''} style={{ height: b.value ? `${Math.max(3, (b.value / max) * 100)}%` : 0 }} title={`${b.label}: ${b.value}`} />
        ))}
      </div>
      <div className="k-bars-labels">
        {buckets.map((b, i) => (
          <span key={b.label} className={b.current ? 'current' : ''}>
            {i % step === 0 || b.current ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
});
