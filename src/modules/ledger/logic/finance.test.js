import { describe, it, expect } from 'vitest';
import { splitEvenly, computeSplit, summarize, filterTransactions } from './finance.js';

describe('splitEvenly', () => {
  it('distributes the remainder so the sum is exact', () => {
    const parts = splitEvenly(100000, 3);
    expect(parts).toEqual([33334, 33333, 33333]);
    expect(parts.reduce((a, b) => a + b)).toBe(100000);
  });
});

describe('computeSplit', () => {
  const people = [{ id: 'a' }, { id: 'b' }];

  it('splits equally with tax and service', () => {
    const r = computeSplit({ mode: 'equal', subtotal: 200000, participants: people, taxPercent: 10, servicePercent: 5 });
    expect(r.shares).toEqual([115000, 115000]);
    expect(r.total).toBe(230000);
    expect(r.tax).toBe(20000);
    expect(r.service).toBe(10000);
  });

  it('splits by item assignment and reports unassigned items', () => {
    const r = computeSplit({
      mode: 'items',
      participants: people,
      items: [
        { price: 50000, qty: 1, assignedTo: ['a'] },
        { price: 30000, qty: 2, assignedTo: ['a', 'b'] },
        { price: 10000, qty: 1, assignedTo: [] },
      ],
    });
    expect(r.shares).toEqual([80000, 30000]);
    expect(r.unassigned).toBe(10000);
  });

  it('uses custom amounts', () => {
    const r = computeSplit({ mode: 'custom', participants: [{ id: 'a', custom: 1000 }, { id: 'b', custom: 2500 }] });
    expect(r.shares).toEqual([1000, 2500]);
  });
});

describe('summarize & filter', () => {
  const tx = [
    { id: '1', type: 'income', amount: 5000000, category: 'Gaji', date: new Date(2026, 9, 1).getTime() },
    { id: '2', type: 'expense', amount: 50000, category: 'Makanan & Minuman', place: 'Warteg', date: new Date(2026, 9, 2).getTime(), note: 'makan siang' },
    { id: '3', type: 'expense', amount: 150000, category: 'Transportasi', place: 'Pertamina', date: new Date(2026, 10, 3).getTime() },
  ];

  it('summarizes totals, categories and months', () => {
    const s = summarize(tx);
    expect(s.totalIncome).toBe(5000000);
    expect(s.totalExpense).toBe(200000);
    expect(s.balance).toBe(4800000);
    expect(s.expenseByCategory[0].name).toBe('Transportasi');
    expect(s.byMonth.map((m) => m.month)).toEqual(['2026-10', '2026-11']);
    expect(s.largestExpense.id).toBe('3');
  });

  it('filters by keyword, type and amount', () => {
    expect(filterTransactions(tx, { keyword: 'warteg' }).map((t) => t.id)).toEqual(['2']);
    expect(filterTransactions(tx, { type: 'expense', min: 100000 }).map((t) => t.id)).toEqual(['3']);
  });
});

import { initials } from '../../../platform/format.js';
describe('initials', () => {
  it('skips emoji and keeps letters', () => {
    expect(initials('🏡 Villa Puncak')).toBe('VP');
    expect(initials('Rina Wijaya')).toBe('RW');
    expect(initials('')).toBe('?');
  });
});
