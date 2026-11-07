import { useDeferredValue, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetTransactionsQuery } from '../api/transactionsApi.js';
import { searchRangeChanged } from '../../../platform/ui/uiSlice.js';
import { filterTransactions, summarize, toCSV, downloadFile } from '../logic/finance.js';
import { formatIDR } from '../../../platform/format.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../platform/constants.js';
import { IS_DEMO } from '../../../platform/env.js';
import DateRangeFilter from '../../../platform/ui/DateRangeFilter.jsx';
import TransactionList from '../components/TransactionList.jsx';
import { ErrorBox, PageHeader, Spinner, StatCard } from '../../../platform/ui/ui.jsx';

const ALL_CATEGORIES = [...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES])];

export default function SearchPage() {
  const dispatch = useDispatch();
  const range = useSelector((s) => s.ui.searchRange);
  const [filters, setFilters] = useState({ keyword: '', type: 'all', category: 'all', min: '', max: '' });
  const deferred = useDeferredValue(filters);
  // Server query is per date range (cached); other filters run client-side on the cached data.
  const { data = [], isLoading, isFetching, error } = useGetTransactionsQuery(range);
  const results = useMemo(() => filterTransactions(data, deferred), [data, deferred]);
  const s = useMemo(() => summarize(results), [results]);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page">
      <PageHeader title="Cari transaksi" subtitle="Filter berdasarkan rentang tanggal, kata kunci, kategori & nominal">
        {!IS_DEMO && (
        <button
          className="btn btn-ghost"
          disabled={!results.length}
          onClick={() => downloadFile(`transaksi_${range.from}_${range.to}.csv`, toCSV(results))}
        >
          ⬇ Export CSV
        </button>
        )}
      </PageHeader>
      <div className="card filters">
        <DateRangeFilter value={range} onChange={(r) => dispatch(searchRangeChanged(r))} />
        <div className="filter-row">
          <input
            className="grow"
            placeholder="Kata kunci: tempat, catatan, kategori..."
            value={filters.keyword}
            onChange={set('keyword')}
          />
          <select value={filters.type} onChange={set('type')}>
            <option value="all">Semua tipe</option>
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
          <select value={filters.category} onChange={set('category')}>
            <option value="all">Semua kategori</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input type="number" placeholder="Min Rp" value={filters.min} onChange={set('min')} />
          <input type="number" placeholder="Max Rp" value={filters.max} onChange={set('max')} />
        </div>
      </div>
      <section className="stats-grid three">
        <StatCard label="Hasil" value={`${results.length} transaksi`} sub={isFetching ? 'memuat…' : null} />
        <StatCard label="Total pemasukan" value={formatIDR(s.totalIncome)} tone="good" />
        <StatCard label="Total pengeluaran" value={formatIDR(s.totalExpense)} tone="bad" />
      </section>
      <ErrorBox error={error} />
      <div className="card">
        {isLoading ? <Spinner /> : <TransactionList items={results} emptyText="Tidak ada transaksi yang cocok" />}
      </div>
    </div>
  );
}
