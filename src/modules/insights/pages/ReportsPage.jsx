import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateReportMutation, useDeleteReportMutation, useGetReportsQuery } from '../api/reportsApi.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { datePresets, parseDateStr } from '../../../platform/date.js';
import { formatDate, formatIDR } from '../../../platform/format.js';
import { confirmAction } from '../../../platform/env.js';
import DateRangeFilter from '../../../platform/ui/DateRangeFilter.jsx';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner } from '../../../platform/ui/ui.jsx';

function CreateReportForm({ onDone }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [create, { isLoading }] = useCreateReportMutation();
  const preset = datePresets()[3];
  const [range, setRange] = useState({ from: preset.from, to: preset.to });
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const res = await create({ title, notes, ...range });
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    dispatch(notify('Laporan dibuat', 'success'));
    onDone();
    navigate(`/reports/${res.data.id}`);
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Judul laporan
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Laporan November" />
      </label>
      <DateRangeFilter value={range} onChange={setRange} />
      <label>
        Catatan
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Evaluasi, target bulan depan, dll." />
      </label>
      <button className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Membuat laporan...' : 'Buat laporan'}
      </button>
    </form>
  );
}

export default function ReportsPage() {
  const dispatch = useDispatch();
  const [creating, setCreating] = useState(false);
  const { data = [], isLoading, error } = useGetReportsQuery();
  const [remove] = useDeleteReportMutation();

  const onDelete = async (r) => {
    if (!confirmAction(`Hapus "${r.title}"?`)) return;
    const res = await remove(r.id);
    dispatch(notify(res.error ? res.error.message : 'Laporan dihapus', res.error ? 'error' : 'success'));
  };

  return (
    <div className="page">
      <PageHeader title="Laporan" subtitle="Snapshot keuangan untuk periode tertentu">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Buat laporan
        </button>
      </PageHeader>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data.length ? (
        <EmptyState icon="📄" title="Belum ada laporan">
          Buat laporan untuk menyimpan ringkasan pemasukan & pengeluaran pada rentang tanggal tertentu.
        </EmptyState>
      ) : (
        <div className="cards-grid">
          {data.map((r) => (
            <div key={r.id} className="card report-card">
              <Link to={`/reports/${r.id}`} className="report-link">
                <h3>{r.title}</h3>
                <p className="muted small">
                  {formatDate(parseDateStr(r.from).getTime())} – {formatDate(parseDateStr(r.to).getTime())}
                </p>
                <div className="report-figs">
                  <span className="good">+{formatIDR(r.summary?.totalIncome)}</span>
                  <span className="bad">-{formatIDR(r.summary?.totalExpense)}</span>
                </div>
              </Link>
              <button className="icon-btn" title="Hapus" onClick={() => onDelete(r)}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
      {creating && (
        <Modal title="Buat laporan" onClose={() => setCreating(false)}>
          <CreateReportForm onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
