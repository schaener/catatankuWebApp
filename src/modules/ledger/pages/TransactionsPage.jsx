import { useMemo, useState } from 'react';
import { useGetTransactionsQuery } from '../api/transactionsApi.js';
import { monthRange, parseDateStr } from '../../../platform/date.js';
import { summarize } from '../logic/finance.js';
import { formatIDR } from '../../../platform/format.js';
import { ErrorBox, Modal, PageHeader, Spinner, StatCard } from '../../../platform/ui/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import TransactionList from '../components/TransactionList.jsx';

export default function TransactionsPage() {
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const range = useMemo(() => monthRange(new Date(), offset), [offset]);
  const { data = [], isLoading, error } = useGetTransactionsQuery(range);
  const s = useMemo(() => summarize(data), [data]);
  const label = parseDateStr(range.from).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <PageHeader title="Transaksi" subtitle="Catat ke mana uangmu pergi">
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Transaksi
        </button>
      </PageHeader>
      <div className="month-nav">
        <button className="btn btn-ghost" onClick={() => setOffset((o) => o - 1)}>
          ‹
        </button>
        <strong>{label}</strong>
        <button className="btn btn-ghost" onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0}>
          ›
        </button>
      </div>
      <section className="stats-grid three">
        <StatCard label="Pemasukan" value={formatIDR(s.totalIncome)} tone="good" />
        <StatCard label="Pengeluaran" value={formatIDR(s.totalExpense)} tone="bad" />
        <StatCard label="Selisih" value={formatIDR(s.balance)} tone={s.balance >= 0 ? 'good' : 'bad'} />
      </section>
      <ErrorBox error={error} />
      <div className="card">{isLoading ? <Spinner /> : <TransactionList items={data} />}</div>
      {adding && (
        <Modal title="Tambah transaksi" onClose={() => setAdding(false)}>
          <TransactionForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}
