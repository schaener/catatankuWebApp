import { findTransferPairs } from '../../capture/domain.js';
import { isCountable } from './entries.js';

const DAY = 86_400_000;

// ---------------------------------------------------------------- periods

export const PERIODS = [
  { id: 'month', label: 'Bulan ini' },
  { id: 'lastMonth', label: 'Bulan lalu' },
  { id: 'last3', label: '3 bulan' },
  { id: 'year', label: 'Tahun ini' },
];

/** Inclusive [start, end] epoch ms for a period, relative to `today` (ms at local midnight). */
export function periodRange(id, today = Date.now()) {
  const d = new Date(today);
  const y = d.getFullYear();
  const m = d.getMonth();
  const at = (yy, mm, dd = 1) => new Date(yy, mm, dd).getTime();
  switch (id) {
    case 'lastMonth':
      return { start: at(y, m - 1), end: at(y, m) - 1 };
    case 'last3':
      return { start: at(y, m - 2), end: at(y, m + 1) - 1 };
    case 'year':
      return { start: at(y, 0), end: at(y + 1, 0) - 1 };
    default:
      return { start: at(y, m), end: at(y, m + 1) - 1 };
  }
}

/** Oldest instant any period needs; the ledger streams from here. */
export const earliestStart = (today) => Math.min(...PERIODS.map((p) => periodRange(p.id, today).start));

// ---------------------------------------------------------------- review queue

/** Pending entries grouped for the Tinjau tab. `dismissed` = ids the user said are not a transfer pair. */
export function buildReview(pending, dismissed = new Set()) {
  const asParsed = pending
    .filter((e) => !dismissed.has(e.id) && isCountable(e) && e.kind !== 'transfer')
    .map((e) => ({ id: e.id, packageName: e.app.pkg, postedAt: e.date, parsed: { amount: e.amount, type: e.kind, isPromo: e.isPromo } }));
  const pairs = findTransferPairs(asParsed);
  const byId = new Map(pending.map((e) => [e.id, e]));
  const seen = new Set();
  const transfers = [];
  for (const e of pending) {
    const partner = byId.get(pairs.get(e.id));
    if (!partner || seen.has(e.id)) continue;
    seen.add(e.id).add(partner.id);
    transfers.push(e.kind === 'expense' ? [e, partner] : [partner, e]);
  }
  const rest = pending.filter((e) => !seen.has(e.id));
  const items = rest.filter((e) => !e.isPromo);
  const promos = rest.filter((e) => e.isPromo);
  return { transfers, items, promos, sure: items.filter((e) => e.confident), size: transfers.length * 2 + items.length + promos.length };
}

/** A pending transfer pair counts once, as a transfer (not as an expense plus an income). */
export function collapsePendingTransfers(entries, queue) {
  if (!queue.transfers.length) return entries;
  const incoming = new Set(queue.transfers.map(([, inc]) => inc.id));
  const outgoing = new Map(queue.transfers.map(([out, inc]) => [out.id, { ...out, kind: 'transfer', toApp: inc.app, raw: [...out.raw, ...inc.raw] }]));
  const out = [];
  for (const e of entries) {
    if (e.store === 'inbox' && incoming.has(e.id)) continue;
    out.push((e.store === 'inbox' && outgoing.get(e.id)) || e);
  }
  return out;
}

// ---------------------------------------------------------------- summary

const sum = (list) => list.reduce((a, e) => a + (e.amount || 0), 0);

function group(list, keyOf) {
  const map = new Map();
  for (const e of list) {
    const [key, label] = keyOf(e);
    let g = map.get(key);
    if (!g) map.set(key, (g = { key, label, value: 0, count: 0, apps: new Map() }));
    g.value += e.amount || 0;
    g.count += 1;
    g.apps.set(e.app.pkg, e.app);
  }
  return [...map.values()]
    .map(({ apps, ...g }) => ({ ...g, app: apps.size === 1 ? [...apps.values()][0] : null, appCount: apps.size }))
    .sort((a, b) => b.value - a.value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function buckets(expenses, { start, end }, today) {
  const days = Math.round((end + 1 - start) / DAY);
  if (days <= 31) {
    const last = Math.min(Math.max(today, start), end);
    const n = Math.floor((last - start) / DAY) + 1;
    const values = new Array(n).fill(0);
    for (const e of expenses) {
      const i = Math.floor((e.date - start) / DAY);
      if (i >= 0 && i < n) values[i] += e.amount;
    }
    return values.map((value, i) => {
      const d = new Date(start + i * DAY + DAY / 2);
      return { label: String(d.getDate()), value, current: start + i * DAY === today };
    });
  }
  const s = new Date(start);
  const months = (new Date(end).getFullYear() - s.getFullYear()) * 12 + new Date(end).getMonth() - s.getMonth() + 1;
  const values = new Array(months).fill(0);
  for (const e of expenses) {
    const d = new Date(e.date);
    values[(d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth()] += e.amount;
  }
  const now = new Date(today);
  return values.map((value, i) => {
    const d = new Date(s.getFullYear(), s.getMonth() + i, 1);
    return { label: MONTHS[d.getMonth()], value, current: d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() };
  });
}

/** Everything the Beranda / Laporan / Squad screens show for a date range. */
export function summarize(entries, range, today) {
  const inRange = entries.filter((e) => isCountable(e) && e.date >= range.start && e.date <= range.end);
  const expenses = inRange.filter((e) => e.kind === 'expense');
  const days = Math.round((range.end + 1 - range.start) / DAY);
  const elapsed = Math.min(days, Math.max(1, Math.floor((Math.min(today, range.end) - range.start) / DAY) + 1));
  const expense = sum(expenses);
  const byApp = group(expenses, (e) => [e.app.pkg, e.app.name]);
  return {
    range,
    expense,
    income: sum(inRange.filter((e) => e.kind === 'income')),
    transfer: sum(inRange.filter((e) => e.kind === 'transfer')),
    count: inRange.length,
    saved: inRange.filter((e) => !e.pending).length,
    pending: inRange.filter((e) => e.pending).length,
    byApp,
    byCategory: group(expenses, (e) => [e.category, e.category]),
    byMerchant: group(expenses.filter((e) => e.place), (e) => [e.place.toLowerCase(), e.place]),
    bucketTitle: days <= 31 ? 'Pengeluaran harian' : 'Pengeluaran bulanan',
    buckets: buckets(expenses, range, today),
    largest: expenses.reduce((m, e) => (!m || e.amount > m.amount ? e : m), null),
    mostUsedApp: byApp.reduce((m, s) => (!m || s.count > m.count ? s : m), null),
    avgPerDay: Math.round(expense / elapsed),
    elapsedDays: elapsed,
    items: [...inRange].sort((a, b) => b.date - a.date),
  };
}

/** [[dayStartMs, entries[]], ...] newest first, for day-grouped lists. */
export function groupByDay(list) {
  const out = [];
  for (const e of list) {
    const d = new Date(e.date);
    d.setHours(0, 0, 0, 0);
    const key = d.getTime();
    const last = out[out.length - 1];
    if (last && last[0] === key) last[1].push(e);
    else out.push([key, [e]]);
  }
  return out;
}
