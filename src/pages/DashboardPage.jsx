import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useGetTransactionsQuery } from '../services/transactionsApi.js';
import { useGetSplitBillsQuery } from '../services/splitBillsApi.js';
import { useGetInboxQuery } from '../services/inboxApi.js';
import { selectUser } from '../features/auth/authSlice.js';
import { logout } from '../features/auth/authThunks.js';
import { lastNMonthsRange, monthKey, monthKeysBetween, monthLabel } from '../utils/date.js';
import { summarize } from '../utils/finance.js';
import { formatCompact, formatIDR } from '../utils/format.js';
import { CHART_COLORS } from '../utils/constants.js';
import { ErrorBox, Modal, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import TransactionList from '../components/TransactionList.jsx';

function ReviewBanner() {
  const { data = [] } = useGetInboxQuery();
  if (!data.length) return null;
  return (
    <Link to="/review" className="card review-banner">
      <span style={{ fontSize: '1.8rem' }}>📲</span>
      <div className="grow">
        <strong>{data.length} transaksi dari notifikasi HP menunggu</strong>
        <div className="small">Cek sebentar, lalu simpan dengan sekali klik.</div>
      </div>
      <span className="btn">Tinjau</span>
    </Link>
  );
}

export default function DashboardPage() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [adding, setAdding] = useState(false);
  // One cached query (6 months) powers the whole dashboard.
  const range = useMemo(() => lastNMonthsRange(6), []);
  const { data = [], isLoading, isFetching, error } = useGetTransactionsQuery(range);
  const { data: bills = [] } = useGetSplitBillsQuery();

  const currentKey = monthKey(Date.now());
  const stats = useMemo(() => {
    const thisMonth = data.filter((t) => monthKey(t.date) === currentKey);
    return { month: summarize(thisMonth), all: summarize(data, monthKeysBetween(range.from, range.to)) };
  }, [data, currentKey, range]);

  const owedToMe = useMemo(
    () =>
      bills
        .filter((b) => b.ownerId === user.uid)
        .flatMap((b) => b.participants.filter((p) => !p.paid && p.uid !== user.uid))
        .reduce((s, p) => s + (p.amount || 0), 0),
    [bills, user.uid],
  );

  const m = stats.month;
  const trend = stats.all.byMonth.map((x) => ({ ...x, label: monthLabel(x.month) }));

  return (
    <div className="page">
      <ReviewBanner />
      <PageHeader title={`Halo, ${user.displayName?.split(' ')[0]} 👋`} subtitle="Ringkasan keuangan bulan ini">
        {isFetching && !isLoading && <span className="muted small">menyinkronkan…</span>}
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Transaksi
        </button>
        <button className="btn btn-ghost mobile-only" onClick={() => dispatch(logout())}>
          Keluar
        </button>
      </PageHeader>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <section className="stats-grid">
            <StatCard label="Saldo bulan ini" value={formatIDR(m.balance)} tone={m.balance >= 0 ? 'good' : 'bad'} />
            <StatCard label="Pemasukan" value={formatIDR(m.totalIncome)} tone="good" />
            <StatCard label="Pengeluaran" value={formatIDR(m.totalExpense)} tone="bad" sub={`${m.count} transaksi`} />
            <StatCard label="Piutang split bill" value={formatIDR(owedToMe)} sub="belum dibayar teman" />
          </section>

          <section className="grid-charts">
            <div className="card">
              <h3>Tren 6 bulan</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12 }} width={50} />
                  <Tooltip formatter={(v) => formatIDR(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Pengeluaran per kategori</h3>
              {m.expenseByCategory.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={m.expenseByCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                      {m.expenseByCategory.map((c, i) => (
                        <Cell key={c.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatIDR(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">Belum ada pengeluaran bulan ini.</p>
              )}
            </div>
          </section>

          <section className="grid-charts">
            <div className="card">
              <h3>📍 Uang paling banyak dihabiskan di</h3>
              {m.expenseByPlace.length ? (
                <ul className="rank-list">
                  {m.expenseByPlace.slice(0, 6).map((p) => (
                    <li key={p.name}>
                      <span>{p.name}</span>
                      <span className="muted small">{p.count}x</span>
                      <strong>{formatIDR(p.value)}</strong>
                      <div className="bar" style={{ width: `${(p.value / m.expenseByPlace[0].value) * 100}%` }} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Isi kolom "tempat" saat mencatat pengeluaran untuk melihat ini.</p>
              )}
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Transaksi terbaru</h3>
                <Link to="/transactions">Lihat semua →</Link>
              </div>
              <TransactionList items={data.slice(0, 6)} editable={false} />
            </div>
          </section>
        </>
      )}
      {adding && (
        <Modal title="Tambah transaksi" onClose={() => setAdding(false)}>
          <TransactionForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}
