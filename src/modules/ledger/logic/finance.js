import { monthKey } from '../../../platform/date.js';

const sumBy = (list, fn) => list.reduce((acc, x) => acc + fn(x), 0);

function groupTotals(list, keyFn) {
  const map = new Map();
  for (const t of list) {
    const key = keyFn(t) || 'Lainnya';
    const cur = map.get(key) || { name: key, value: 0, count: 0 };
    cur.value += Number(t.amount) || 0;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

/** Aggregate a list of transactions into everything the dashboard/reports need. */
export function summarize(transactions = [], monthKeys = null) {
  const income = transactions.filter((t) => t.type === 'income');
  const expense = transactions.filter((t) => t.type === 'expense');
  const totalIncome = sumBy(income, (t) => Number(t.amount) || 0);
  const totalExpense = sumBy(expense, (t) => Number(t.amount) || 0);

  const months = new Map((monthKeys || []).map((k) => [k, { month: k, income: 0, expense: 0 }]));
  for (const t of transactions) {
    const k = monthKey(t.date);
    const cur = months.get(k) || { month: k, income: 0, expense: 0 };
    cur[t.type === 'income' ? 'income' : 'expense'] += Number(t.amount) || 0;
    months.set(k, cur);
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    count: transactions.length,
    expenseByCategory: groupTotals(expense, (t) => t.category),
    incomeByCategory: groupTotals(income, (t) => t.category),
    expenseByPlace: groupTotals(expense, (t) => t.place?.trim()),
    expenseByMethod: groupTotals(expense, (t) => t.paymentMethod),
    byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    largestExpense: expense.reduce((max, t) => (!max || t.amount > max.amount ? t : max), null),
  };
}

/** Client-side filtering applied on top of a cached date-range query. */
export function filterTransactions(list = [], { keyword = '', type = 'all', category = 'all', min, max } = {}) {
  const kw = keyword.trim().toLowerCase();
  const minN = min === '' || min == null ? null : Number(min);
  const maxN = max === '' || max == null ? null : Number(max);
  return list.filter((t) => {
    if (type !== 'all' && t.type !== type) return false;
    if (category !== 'all' && t.category !== category) return false;
    if (minN != null && t.amount < minN) return false;
    if (maxN != null && t.amount > maxN) return false;
    if (kw) {
      const hay = `${t.note || ''} ${t.place || ''} ${t.category || ''} ${t.paymentMethod || ''}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/** Split an integer amount into n parts that add up exactly (remainder goes to the first ones). */
export function splitEvenly(total, n) {
  if (n <= 0) return [];
  const t = Math.round(total);
  const base = Math.floor(t / n);
  let rest = t - base * n;
  return Array.from({ length: n }, () => base + (rest-- > 0 ? 1 : 0));
}

/**
 * Compute what each participant owes.
 *
 * mode = 'equal'  -> subtotal split evenly
 * mode = 'custom' -> each participant.custom is their subtotal share
 * mode = 'items'  -> items[{ price, qty, assignedTo: [participantId] }] split among assignees
 *
 * Tax and service (percent) are added proportionally to each share.
 */
export function computeSplit({ mode = 'equal', subtotal = 0, participants = [], items = [], taxPercent = 0, servicePercent = 0 }) {
  const n = participants.length;
  if (!n) return { shares: [], subtotal: 0, tax: 0, service: 0, total: 0, unassigned: 0 };

  let base;
  let unassigned = 0;
  if (mode === 'custom') {
    base = participants.map((p) => Number(p.custom) || 0);
  } else if (mode === 'items') {
    const idx = new Map(participants.map((p, i) => [p.id, i]));
    base = new Array(n).fill(0);
    for (const item of items) {
      const cost = (Number(item.price) || 0) * (Number(item.qty) || 1);
      const owners = (item.assignedTo || []).filter((id) => idx.has(id));
      if (!owners.length) {
        unassigned += cost;
        continue;
      }
      splitEvenly(cost, owners.length).forEach((part, i) => {
        base[idx.get(owners[i])] += part;
      });
    }
  } else {
    base = splitEvenly(Number(subtotal) || 0, n);
  }

  const sub = sumBy(base, (x) => x);
  const rate = ((Number(taxPercent) || 0) + (Number(servicePercent) || 0)) / 100;
  const shares = base.map((b) => Math.round(b * (1 + rate)));
  const total = sumBy(shares, (x) => x);
  const tax = Math.round(sub * ((Number(taxPercent) || 0) / 100));
  return { shares, subtotal: sub, tax, service: total - sub - tax, total, unassigned };
}

export function toCSV(transactions) {
  const header = ['Tanggal', 'Tipe', 'Kategori', 'Tempat', 'Metode', 'Jumlah', 'Catatan'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = transactions.map((t) =>
    [
      new Date(t.date).toISOString().slice(0, 10),
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.category,
      t.place,
      t.paymentMethod,
      t.amount,
      t.note,
    ]
      .map(esc)
      .join(','),
  );
  return [header.map(esc).join(','), ...rows].join('\n');
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
