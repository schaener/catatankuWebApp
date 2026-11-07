const APP_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d', '#475569'];
const appColor = (name = '') => APP_COLORS[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % APP_COLORS.length];
const appInitials = (name = '?') =>
  name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/** Colored initials tile standing in for a phone app's icon. */
export default function AppBadge({ name }) {
  return (
    <span className="app-badge" style={{ background: appColor(name) }} title={name}>
      {appInitials(name)}
    </span>
  );
}
