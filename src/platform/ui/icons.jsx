/**
 * Navigation icons from the approved design: 1.8px line icons when idle, solid when active.
 * Inline SVG (no icon font / image requests); `currentColor` follows the text color.
 */
const LINE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
const CUT = { fill: 'none', stroke: 'var(--icon-cut, #fff)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const HOUSE = 'M3.5 10.5L12 3.8l8.5 6.7V19a1.6 1.6 0 0 1-1.6 1.6h-4.2v-5.8h-5.4v5.8H5.1A1.6 1.6 0 0 1 3.5 19z';
const BARS = 'M8.3 16v-4M12 16V8M15.7 16v-2.5';

const ICONS = {
  home: [<path key="a" d={HOUSE} {...LINE} />, <path key="a" d={HOUSE} {...LINE} fill="currentColor" />],
  review: [
    <g key="a" {...LINE}>
      <path d="M4 13.5V6.2A2.2 2.2 0 0 1 6.2 4h11.6A2.2 2.2 0 0 1 20 6.2v11.6a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8zM4 13.5h4.2l1.3 2.3h5l1.3-2.3H20" />
      <path d="M9 8.8l2 2l4-4" />
    </g>,
    <g key="a">
      <path fill="currentColor" d="M6.2 3.1h11.6a3.1 3.1 0 0 1 3.1 3.1v6.4h-4.6l-1.3 2.3h-6l-1.3-2.3H3.1V6.2a3.1 3.1 0 0 1 3.1-3.1zM3.1 14.4h4.1l1.3 2.3h7l1.3-2.3h4.1v3.4a3.1 3.1 0 0 1-3.1 3.1H6.2a3.1 3.1 0 0 1-3.1-3.1z" />
      <path d="M9 7.8l2 2l4-4" {...CUT} />
    </g>,
  ],
  report: [
    <g key="a" {...LINE}>
      <rect x="3.9" y="3.9" width="16.2" height="16.2" rx="3" />
      <path d={BARS} />
    </g>,
    <g key="a">
      <rect x="3" y="3" width="18" height="18" rx="3.6" fill="currentColor" />
      <path d={BARS} {...CUT} />
    </g>,
  ],
  squad: [
    <g key="a" {...LINE}>
      <circle cx="9" cy="8.5" r="3.2" />
      <circle cx="16.6" cy="9.6" r="2.5" />
      <path d="M3.4 19.4c.6-3 2.9-4.8 5.6-4.8s5 1.8 5.6 4.8M14.6 14.9c.6-.2 1.3-.3 2-.3 2.2 0 3.9 1.4 4.4 3.8" />
    </g>,
    <g key="a" fill="currentColor">
      <circle cx="9" cy="8.3" r="3.8" />
      <circle cx="16.8" cy="9.4" r="3" />
      <path d="M2.8 20c.5-3.6 3-5.9 6.2-5.9s5.7 2.3 6.2 5.9zM15.9 20c-.2-2-1-3.7-2.2-4.9.9-.5 1.9-.8 3.1-.8 2.7 0 4.6 1.9 4.9 5.7z" />
    </g>,
  ],
  sources: [
    <g key="a" {...LINE}>
      <rect x="4" y="4" width="6.6" height="6.6" rx="1.8" />
      <circle cx="16.7" cy="7.3" r="3.3" />
      <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" />
      <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" />
    </g>,
    <g key="a" fill="currentColor">
      <rect x="3.2" y="3.2" width="8" height="8" rx="2.2" />
      <circle cx="16.8" cy="7.2" r="4" />
      <rect x="3.2" y="12.8" width="8" height="8" rx="2.2" />
      <rect x="12.8" y="12.8" width="8" height="8" rx="2.2" />
    </g>,
  ],
  user: [
    <g key="a" {...LINE}>
      <circle cx="12" cy="8.2" r="3.9" />
      <path d="M4.6 20.2c.8-3.8 3.8-6 7.4-6s6.6 2.2 7.4 6" />
    </g>,
    <g key="a" fill="currentColor">
      <circle cx="12" cy="8" r="4.6" />
      <path d="M3.8 20.6c.7-4.4 4-7.1 8.2-7.1s7.5 2.7 8.2 7.1z" />
    </g>,
  ],
  more: [
    <g key="a" fill="currentColor">
      <circle cx="5.5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.5" cy="12" r="1.8" />
    </g>,
  ],
};

export function NavIcon({ name, active = false, size = 24 }) {
  const variants = ICONS[name];
  if (!variants) return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{name}</span>; // emoji fallback
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {(active && variants[1]) || variants[0]}
    </svg>
  );
}
