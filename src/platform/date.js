// Dates are handled as 'YYYY-MM-DD' strings in the UI and in RTK Query cache
// keys (stable keys => better cache hits), and as epoch millis in Firestore.

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayStr = () => toDateStr(new Date());

export function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const startOfDayMs = (str) => parseDateStr(str).getTime();
export const endOfDayMs = (str) => {
  const d = parseDateStr(str);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

export function monthRange(ref = new Date(), offset = 0) {
  const from = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
  const to = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 0);
  return { from: toDateStr(from), to: toDateStr(to) };
}

export function lastNMonthsRange(n, ref = new Date()) {
  return {
    from: toDateStr(new Date(ref.getFullYear(), ref.getMonth() - (n - 1), 1)),
    to: toDateStr(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
  };
}

export function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
}

/** Every month key between two date strings, inclusive. */
export function monthKeysBetween(from, to) {
  const keys = [];
  const start = parseDateStr(from);
  const end = parseDateStr(to);
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    keys.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export function datePresets(ref = new Date()) {
  const today = toDateStr(ref);
  const daysAgo = (n) => toDateStr(new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - n));
  return [
    { label: 'Hari ini', from: today, to: today },
    { label: '7 hari', from: daysAgo(6), to: today },
    { label: '30 hari', from: daysAgo(29), to: today },
    { label: 'Bulan ini', ...monthRange(ref) },
    { label: 'Bulan lalu', ...monthRange(ref, -1) },
    { label: 'Tahun ini', from: `${ref.getFullYear()}-01-01`, to: `${ref.getFullYear()}-12-31` },
  ];
}
