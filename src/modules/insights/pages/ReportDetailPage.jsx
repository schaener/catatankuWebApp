import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGetReportQuery } from '../api/reportsApi.js';
import { downloadFile, toCSV, TransactionList } from '../../ledger/index.js';
import { formatCompact, formatDate, formatIDR } from '../../../platform/format.js';
import { monthLabel, parseDateStr } from '../../../platform/date.js';
import { ErrorBox, PageHeader, Spinner, StatCard } from '../../../platform/ui/ui.jsx';
import { IS_DEMO } from '../../../platform/env.js';

function Breakdown({ title, rows, total }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {rows?.length ? (
        <table className="table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="muted small">{r.count}x</td>
                <td className="num">{formatIDR(r.value)}</td>
                <td className="num muted small">{total ? Math.round((r.value / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">Tidak ada data.</p>
      )}
    </div>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const { data: r, isLoading, error } = useGetReportQuery(id);
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const s = r.summary;
  const period = `${formatDate(parseDateStr(r.from).getTime())} – ${formatDate(parseDateStr(r.to).getTime())}`;

  return (
    <div className="page report-print">
      <PageHeader title={r.title} subtitle={`Periode ${period} · dibuat ${formatDate(r.createdAt)}`}>
        <Link to="/reports" className="btn btn-ghost no-print">
          ← Kembali
        </Link>
        {!IS_DEMO && (
          <>
        <button className="btn btn-ghost no-print" onClick={() => downloadFile(`${r.title}.csv`, toCSV(r.transactions || []))}>
          ⬇ CSV
        </button>
        <button className="btn btn-primary no-print" onClick={() => window.print()}>
          🖨 Cetak / PDF
        </button>
          </>
        )}
      </PageHeader>
      <section className="stats-grid">
        <StatCard label="Pemasukan" value={formatIDR(s.totalIncome)} tone="good" />
        <StatCard label="Pengeluaran" value={formatIDR(s.totalExpense)} tone="bad" />
        <StatCard label="Saldo" value={formatIDR(s.balance)} tone={s.balance >= 0 ? 'good' : 'bad'} />
        <StatCard
          label="Pengeluaran terbesar"
          value={s.largestExpense ? formatIDR(s.largestExpense.amount) : '-'}
          sub={s.largestExpense ? `${s.largestExpense.category}${s.largestExpense.place ? ` · ${s.largestExpense.place}` : ''}` : null}
        />
      </section>
      {r.notes && (
        <div className="card">
          <h3>Catatan</h3>
          <p className="pre">{r.notes}</p>
        </div>
      )}
      {s.byMonth?.length > 1 && (
        <div className="card">
          <h3>Per bulan</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.byMonth.map((m) => ({ ...m, label: monthLabel(m.month) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={formatCompact} width={50} />
              <Tooltip formatter={(v) => formatIDR(v)} />
              <Legend />
              <Bar dataKey="income" name="Pemasukan" fill="#10b981" />
              <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <section className="grid-charts">
        <Breakdown title="Pengeluaran per kategori" rows={s.expenseByCategory} total={s.totalExpense} />
        <Breakdown title="Pengeluaran per tempat" rows={s.expenseByPlace} total={s.totalExpense} />
        <Breakdown title="Pemasukan per kategori" rows={s.incomeByCategory} total={s.totalIncome} />
        <Breakdown title="Metode pembayaran" rows={s.expenseByMethod} total={s.totalExpense} />
      </section>
      <div className="card">
        <h3>Daftar transaksi ({r.transactions?.length || 0})</h3>
        <TransactionList items={r.transactions} editable={false} />
      </div>
    </div>
  );
}
