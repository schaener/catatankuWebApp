import { describe, expect, it } from 'vitest';
import { squadSummary } from './squadSummary.js';

const today = new Date(2026, 10, 7).getTime();
const at = (d) => new Date(2026, 10, d, 12).getTime();
const squad = { memberUids: ['a', 'b', 'c'], members: { a: { name: 'Angga' }, b: { name: 'Rina' }, c: { name: 'Bima' } } };
const doc = (id, ownerUid, amount, extra = {}) => ({ id, ownerUid, ownerName: ownerUid, type: 'expense', amount, category: 'Belanja', appPackage: 'com.bca', appName: 'BCA', date: at(3), ...extra });

describe('squadSummary', () => {
  it('splits spending per member and keeps members who paid nothing', () => {
    const s = squadSummary([doc('1', 'a', 300), doc('2', 'b', 200), doc('3', 'a', 100), doc('4', 'b', 50, { type: 'income' })], squad, today);
    expect(s.expense).toBe(600);
    expect(s.byMember.map((m) => [m.uid, m.value, m.count])).toEqual([['a', 400, 2], ['b', 200, 1], ['c', 0, 0]]);
  });

  it('still shows spending of someone who left', () => {
    const s = squadSummary([doc('1', 'x', 10)], squad, today);
    expect(s.byMember[0]).toMatchObject({ uid: 'x', value: 10, former: true });
  });
});
