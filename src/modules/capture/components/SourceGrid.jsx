import { memo, useEffect, useMemo, useState } from 'react';
import { native } from '../../../platform/native.js';
import { AppAvatar } from '../../../platform/ui/kit.jsx';

/** Real launcher icon inside the app (lazy, cached); colored initials in the browser / while loading. */
const AppIcon = memo(function AppIcon({ app }) {
  const [src, setSrc] = useState(() => native.cachedAppIcon(app.packageName));
  useEffect(() => {
    if (src !== undefined) return undefined;
    let alive = true;
    native.loadAppIcon(app.packageName).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [app.packageName, src]);
  return src ? <img src={src} alt="" width={44} height={44} decoding="async" /> : <AppAvatar app={{ pkg: app.packageName, name: app.label }} size={44} />;
});

const Tile = memo(function Tile({ app, checked, onToggle }) {
  return (
    <button type="button" className={`k-src-tile ${checked ? 'on' : ''}`} role="checkbox" aria-checked={checked} onClick={() => onToggle(app.packageName, !checked)}>
      <span className="k-src-icon">
        <AppIcon app={app} />
        {checked && <i aria-hidden="true">✓</i>}
      </span>
      <span className="k-src-label">{app.label}</span>
    </button>
  );
});

/**
 * Tap an app to check / uncheck it: checked apps' notifications are read.
 * apps: [{ packageName, label, suggested }], selected: Set<packageName>, onToggle(packageName, on).
 */
export default function SourceGrid({ apps, selected, onToggle }) {
  const [query, setQuery] = useState('');
  const { finance, others } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? apps.filter((a) => a.label.toLowerCase().includes(q)) : apps;
    return { finance: list.filter((a) => a.suggested), others: list.filter((a) => !a.suggested) };
  }, [apps, query]);
  const grid = (list) => (
    <div className="k-src-grid">{list.map((a) => <Tile key={a.packageName} app={a} checked={selected.has(a.packageName)} onToggle={onToggle} />)}</div>
  );

  return (
    <>
      <div className="k-pad">
        <label className="k-src-search">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          <input type="search" placeholder="Cari aplikasi…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {finance.length > 0 && <><h3 className="k-src-title">Bank &amp; e-wallet terdeteksi</h3>{grid(finance)}</>}
      {others.length > 0 && <><h3 className="k-src-title">Aplikasi lain</h3>{grid(others)}</>}
      {finance.length + others.length === 0 && <div className="k-empty">Tidak ada aplikasi yang cocok.</div>}
    </>
  );
}
