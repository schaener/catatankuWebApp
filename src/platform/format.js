const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

export const formatIDR = (n) => idr.format(Math.round(Number(n) || 0));
export const formatCompact = (n) => compact.format(Number(n) || 0);

export function formatDate(ms, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (ms == null) return '-';
  return new Date(ms).toLocaleDateString('id-ID', opts);
}

export function formatDateTime(ms) {
  if (ms == null) return '-';
  return new Date(ms).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(ms, now = Date.now()) {
  if (ms == null) return '';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return 'baru saja';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return formatDate(ms);
}

export const initials = (name = '?') =>
  (name || '')
    .split(/\s+/)
    .map((w) => Array.from(w).find((ch) => /[\p{L}\p{N}]/u.test(ch)))
    .filter(Boolean)
    .slice(0, 2)
    .map((ch) => ch.toUpperCase())
    .join('') || '?';
