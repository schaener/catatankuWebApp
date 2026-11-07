import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { AppAvatar, Bar, Fab, Hero, Section } from '../../../platform/ui/kit.jsx';
import { Avatar } from '../../../platform/ui/ui.jsx';
import { formatCompact, formatIDR } from '../../../platform/format.js';
import { openComposer } from '../../../platform/composer.js';
import { isNativeApp } from '../../../platform/native.js';
import { useGetDevicesQuery, useSetupProgress } from '../../capture/index.js';
import { EntryRow, periodRange, useLedger, useReviewQueue, useSummary } from '../../ledger/index.js';
import { tracked } from '../logic/filters.js';

const thisMonth = (today) => periodRange('month', today);

export default function HomePage() {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const month = useSummary(thisMonth, tracked);
  const queue = useReviewQueue();
  const { entries } = useLedger();
  const { status, steps, missing } = useSetupProgress();
  const { data: devices = [] } = useGetDevicesQuery();
  const recent = useMemo(() => entries.filter((e) => e.origin === 'notification').slice(0, 5), [entries]);
  const first = (user.displayName || 'Kamu').split(' ')[0];
  const listening = isNativeApp ? status?.listener && status?.sources > 0 : devices.length > 0;
  const pillText = isNativeApp
    ? listening ? `Aktif membaca ${status.sources} aplikasi` : 'Belum aktif. Selesaikan pengaturan HP'
    : devices.length ? `${devices.length} HP terhubung` : 'Belum ada HP terhubung';
  const detail = [queue.sure.length && `${queue.sure.length} yakin`, queue.transfers.length && `${queue.transfers.length} pindah dana`, queue.promos.length && `${queue.promos.length} promo`].filter(Boolean).join(', ');

  return (
    <div className="page k-page">
      <Hero pad="lg">
        <div className="k-hero-row">
          <Avatar name={user.displayName} src={user.photoURL} size={44} />
          <div className="grow">
            <p style={{ margin: 0 }}>Halo,</p>
            <h1>{first}</h1>
          </div>
          <button type="button" className="k-round-btn" aria-label="Tinjau" onClick={() => navigate('/review')}>
            🔔{queue.size > 0 && <span className="k-dot-count">{queue.size > 99 ? '99' : queue.size}</span>}
          </button>
        </div>
        <button type="button" className={`k-pill ${listening ? '' : 'off'}`} style={{ border: 'none', color: '#fff', font: 'inherit', cursor: 'pointer' }} onClick={() => navigate('/device')}>
          <i />
          {pillText}
        </button>
      </Hero>

      <Link to="/insights" className="k-float" style={{ display: 'block', color: 'inherit' }}>
        <div className="k-muted" style={{ fontSize: '.78rem' }}>Keluar bulan ini · dari notifikasi &amp; catatan</div>
        <div className="k-amount expense" style={{ fontSize: '1.7rem' }}>{month ? formatIDR(month.expense) : '…'}</div>
        <div style={{ display: 'flex', marginTop: 8 }}>
          <div className="grow"><small className="k-muted">Masuk</small><div className="k-amount income">{month ? `+${formatIDR(month.income)}` : '…'}</div></div>
          <div className="grow"><small className="k-muted">Tertangkap</small><div className="k-amount">{month ? `${month.count} transaksi` : '…'}</div></div>
        </div>
      </Link>

      {queue.size > 0 && (
        <div className="k-pad" style={{ marginTop: 14 }}>
          <Link to="/review" className="k-card k-banner">
            <span style={{ fontSize: 22 }}>📲</span>
            <div className="grow">
              <b>{queue.size} transaksi perlu ditinjau</b>
              <div className="k-muted" style={{ fontSize: '.78rem' }}>{detail || 'Cek sebentar, lalu simpan'}</div>
            </div>
            <span className="k-btn primary">Tinjau</span>
          </Link>
        </div>
      )}

      {isNativeApp && missing > 0 && (
        <Section title="Biar tetap jalan, walau HP direstart" action="Atur ›" onAction={() => navigate('/device')}>
          <div className="k-card flush">
            {steps.filter((s) => !s.done).map((st) => (
              <div key={st.title} className="k-row" style={{ cursor: 'default' }}>
                <span className="k-avatar" style={{ width: 32, height: 32, borderRadius: 16, background: '#fef3c7', color: 'var(--warn)' }}>!</span>
                <div className="k-main"><div className="k-title">{st.title}</div><div className="k-meta">{st.sub}</div></div>
                <button type="button" className="k-btn primary" onClick={() => (st.to ? navigate(st.to) : st.run())}>{st.action}</button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {month?.byApp.length > 0 && (
        <Section title="Per aplikasi" action="Laporan ›" onAction={() => navigate('/insights')}>
          <div className="k-card">
            {month.byApp.slice(0, 3).map((s) => (
              <div key={s.key} className="k-row" style={{ padding: '6px 0', cursor: 'default' }}>
                <AppAvatar app={s.app || { pkg: s.key, name: s.label }} size={36} />
                <div className="k-main">
                  <div className="k-title">{s.label}</div>
                  <Bar value={s.value} max={month.byApp[0].value} />
                </div>
                <b>{formatCompact(s.value)}</b>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Baru tertangkap" action="Lihat semua ›" onAction={() => navigate('/insights')}>
        <div className="k-card flush">
          {recent.length ? recent.map((e) => <EntryRow key={e.id} entry={e} />) : (
            <div className="k-empty"><span className="k-emoji">📭</span>Belum ada transaksi dari notifikasi. Coba bayar QRIS, atau catat manual dengan tombol ＋ Catat.</div>
          )}
        </div>
      </Section>

      <Fab onClick={() => openComposer({ mode: 'edit' })}>＋ Catat</Fab>
    </div>
  );
}
