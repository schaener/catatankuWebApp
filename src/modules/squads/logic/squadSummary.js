import { periodRange, summarize } from '../../ledger/domain.js';

/** squads/{id}/entries doc -> ledger entry shape (so the shared summary engine applies). */
export const toEntry = (d) => ({
  id: d.id,
  store: 'squad',
  pending: false,
  origin: 'notification',
  kind: d.type === 'income' ? 'income' : 'expense',
  amount: Number(d.amount) || 0,
  app: { pkg: d.appPackage || 'unknown:', name: d.appName || 'Lainnya' },
  toApp: null,
  movedFrom: null,
  category: d.category || 'Lainnya',
  place: d.place || '',
  note: d.note || '',
  date: d.date,
  raw: [],
  isPromo: false,
  owner: { uid: d.ownerUid, name: d.ownerName || 'Anggota', photo: d.ownerPhoto || null },
});

/** Month summary + "siapa bayar apa" (expenses per member, members with nothing included). */
export function squadSummary(docs, squad, today, period = 'month') {
  const entries = (docs || []).map(toEntry);
  const s = summarize(entries, periodRange(period, today), today);
  const perMember = new Map((squad?.memberUids || []).map((uid) => [uid, { uid, name: squad.members?.[uid]?.name || 'Anggota', photo: squad.members?.[uid]?.photo, value: 0, count: 0 }]));
  for (const e of s.items) {
    if (e.kind !== 'expense') continue;
    const m = perMember.get(e.owner.uid) ?? { uid: e.owner.uid, name: e.owner.name, photo: e.owner.photo, value: 0, count: 0, former: true };
    m.value += e.amount;
    m.count += 1;
    perMember.set(e.owner.uid, m);
  }
  return { ...s, byMember: [...perMember.values()].sort((a, b) => b.value - a.value) };
}
