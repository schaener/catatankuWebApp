import { describe, expect, it } from 'vitest';
import { buildReview, collapsePendingTransfers, periodRange, summarize } from './ledger.js';
import { fromInbox, fromTx } from './entries.js';

const today = new Date(2026, 10, 7).getTime();
const at = (d, m = 10, h = 12) => new Date(2026, m, d, h).getTime();
const bca = { pkg: 'com.bca', name: 'BCA mobile' };
const gopay = { pkg: 'com.gojek.app', name: 'GoPay' };
const entry = (id, kind, amount, app, date, extra = {}) => ({
  id, store: extra.pending ? 'inbox' : 'tx', pending: false, origin: 'notification', kind, amount, app, toApp: null, movedFrom: null,
  category: 'Lainnya', place: '', note: '', date, raw: [], isPromo: false, confident: false, ...extra,
});

describe('summarize', () => {
  it('totals by app, category, merchant and day', () => {
    const list = [
      entry('1', 'expense', 50_000, gopay, at(2), { place: 'Kopi Kenangan', category: 'Makanan & Minuman' }),
      entry('2', 'expense', 200_000, bca, at(5), { place: 'PLN', category: 'Tagihan' }),
      entry('3', 'expense', 30_000, gopay, at(5), { pending: true, place: 'kopi kenangan', category: 'Makanan & Minuman' }),
      entry('4', 'income', 8_500_000, bca, at(1)),
      entry('5', 'transfer', 500_000, bca, at(3)),
      entry('6', 'expense', 99_000, gopay, at(20, 9)), // previous month
      entry('7', null, 10_000, gopay, at(6), { pending: true }), // unclassified
    ];
    const s = summarize(list, periodRange('month', today), today);
    expect(s).toMatchObject({ expense: 280_000, income: 8_500_000, transfer: 500_000, count: 5, pending: 1, avgPerDay: 40_000 });
    expect(s.byApp.map((a) => a.key)).toEqual(['com.bca', 'com.gojek.app']);
    expect(s.byMerchant[1]).toMatchObject({ label: 'Kopi Kenangan', value: 80_000, count: 2, app: gopay });
    expect(s.mostUsedApp.key).toBe('com.gojek.app');
    expect(s.buckets).toHaveLength(7);
    expect(s.buckets[4].value).toBe(230_000);
    expect(s.buckets.at(-1).current).toBe(true);
    expect(s.largest.id).toBe('2');
  });

  it('marks merchants paid from several apps', () => {
    const s = summarize([entry('a', 'expense', 10, bca, at(2), { place: 'Indomaret' }), entry('b', 'expense', 20, gopay, at(3), { place: 'INDOMARET' })], periodRange('month', today), today);
    expect(s.byMerchant[0]).toMatchObject({ app: null, appCount: 2, count: 2 });
  });

  it('buckets a year by month', () => {
    const s = summarize([entry('1', 'expense', 10, bca, at(3, 1))], periodRange('year', today), today);
    expect(s.buckets).toHaveLength(12);
    expect(s.buckets[1].value).toBe(10);
  });
});

describe('review queue', () => {
  const out = entry('a', 'expense', 100_000, bca, at(5, 10, 9), { pending: true });
  const inc = entry('b', 'income', 100_000, gopay, at(5, 10, 9) + 60_000, { pending: true });
  const promo = entry('c', 'expense', 20_000, gopay, at(5), { pending: true, isPromo: true });

  it('pairs transfers between own accounts and separates promos', () => {
    const q = buildReview([inc, out, promo]);
    expect(q.transfers).toEqual([[out, inc]]);
    expect(q.promos).toEqual([promo]);
    expect(q.items).toEqual([]);
    expect(buildReview([inc, out], new Set(['a', 'b'])).items).toHaveLength(2);
  });

  it('counts a pending pair as one transfer', () => {
    const all = [out, inc, entry('x', 'expense', 10_000, bca, at(4))];
    const s = summarize(collapsePendingTransfers(all, buildReview([out, inc])), periodRange('month', today), today);
    expect(s).toMatchObject({ expense: 10_000, income: 0, transfer: 100_000 });
  });
});

describe('entries', () => {
  const raw = { id: 'n1', packageName: 'com.gojek.app', appName: 'GoPay', title: '', text: 'Pembayaran Rp 64.200 ke INDOMARET berhasil', postedAt: at(7) };

  it('applies "remember" rules and overrides', () => {
    const rules = [{ fromPackage: 'com.gojek.app', keyword: 'indomaret', toPackage: 'id.dana', toName: 'DANA' }];
    const moved = fromInbox(raw, rules);
    expect(moved.app).toEqual({ pkg: 'id.dana', name: 'DANA' });
    expect(moved.movedFrom).toEqual({ pkg: 'com.gojek.app', name: 'GoPay' });
    expect(moved.confident).toBe(false);
    expect(fromInbox(raw).app.pkg).toBe('com.gojek.app');
    expect(fromInbox({ ...raw, overridePackage: 'cash', overrideName: 'Tunai' }, rules).app.pkg).toBe('cash');
  });

  it('reads web transactions, legacy ones included', () => {
    expect(fromTx({ id: 't', type: 'expense', amount: 5, date: 1, paymentMethod: 'Tunai' })).toMatchObject({ legacy: true, app: { name: 'Tunai' } });
    expect(fromTx({ id: 't', type: 'income', amount: 5, date: 1, source: 'notification', appPackage: 'com.bca', appName: 'BCA', squadId: 's1' }))
      .toMatchObject({ legacy: false, kind: 'income', squadId: 's1', sharedTo: 's1' });
  });
});
