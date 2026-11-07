import { useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { AppAvatar, Bar, Bars, Chip, Donut, Fab, Hero, Kpi, Section } from '../../../platform/ui/kit.jsx';
import { CHART_COLORS } from '../../../platform/constants.js';
import { formatCompact, formatDate, formatIDR } from '../../../platform/format.js';
import { openComposer } from '../../../platform/composer.js';
import { native } from '../../../platform/native.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { EntryRow, PERIODS, categoryEmoji, groupByDay, periodRange, useSummary } from '../../ledger/index.js';
import { everything, shareText, tracked } from '../logic/filters.js';

const PAGE = 30;
const pct = (v, total) => (total > 0 ? Math.round((v / total) * 100) : 0);

/** Laporan: everything recorded from notifications (and ＋ Catat) for a period. */
export default function InsightsPage() {
  const dispatch = useDispatch();
  const [period, setPeriod] = useState('month');
  const [scope, setScope] = useState('tracked');
  const [appFilter, setAppFilter] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const rangeOf = useCallback((today) => periodRange(period, today), [period]);
  const s = useSummary(rangeOf, scope === 'tracked' ? tracked : everything);
  const label = PERIODS.find((p) => p.id === period).label;

  const filtered = useMemo(() => (s ? (appFilter ? s.items.filter((e) => e.app.pkg === appFilter) : s.items) : []), [s, appFilter]);
  const days = useMemo(() => groupByDay(filtered.slice(0, shown)), [filtered, shown]);
  const apps = useMemo(() => (s ? [...new Map(s.items.map((e) => [e.app.pkg, e.app])).values()] : []), [s]);

  const choosePeriod = (id) => {
    setPeriod(id);
    setAppFilter(null);
    setShown(PAGE);
  };
  const share = async () => {
    const text = shareText(label, s, formatIDR);
    if (!native.share(text)) {
      await navigator.clipboard?.writeText(text);
      dispatch(notify('Ringkasan disalin', 'success'));
    }
  };

  return (
    <div className="page k-page">
      <Hero pad="lg">
        <div className="k-hero-row">
          <div className="grow">
            <h1>Laporan</h1>
            <p>{s ? `${formatDate(s.range.start, { day: 'numeric', month: 'short' })} – ${formatDate(s.range.end)}` : '…'} · {scope === 'tracked' ? 'dari notifikasi & catatan' : 'semua transaksi'}</p>
          </div>
          {s && <button type="button" className="k-round-btn" aria-label="Bagikan" onClick={share}>↗</button>}
        </div>
        <div className="k-hero-chips">
          {PERIODS.map((p) => <Chip key={p.id} active={p.id === period} onClick={() => choosePeriod(p.id)}>{p.label}</Chip>)}
        </div>
        <div className="k-sub">Total keluar</div>
        <div className="k-big">{s ? formatIDR(s.expense) : '…'}</div>
      </Hero>

      <div className="k-float" style={{ display: 'flex', gap: 14, marginTop: -50 }}>
        <div className="grow"><small className="k-muted">● Masuk</small><div className="k-amount income">{s ? `+${formatIDR(s.income)}` : '…'}</div></div>
        <div className="grow" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 14 }}><small className="k-muted">● Pindah dana</small><div className="k-amount transfer">{s ? formatIDR(s.transfer) : '…'}</div></div>
      </div>

      {!s ? <div className="k-empty">Memuat…</div> : (
        <>
          <div className="k-pad" style={{ marginTop: 14 }}>
            <div className="k-kpis">
              <Kpi label="Transaksi tertangkap" value={s.count} sub={`${s.saved} disimpan · ${s.pending} menunggu`} />
              <Kpi label="Rata-rata keluar" value={`${formatCompact(s.avgPerDay)}/hari`} sub={`${s.elapsedDays} hari`} />
              <Kpi label="Terbesar" value={s.largest ? formatIDR(s.largest.amount) : '-'} sub={s.largest && [s.largest.app.name, s.largest.place].filter(Boolean).join(' · ')} />
              <Kpi label="Paling sering" value={s.mostUsedApp ? `${s.mostUsedApp.label} · ${s.mostUsedApp.count}x` : '-'} sub={s.mostUsedApp && `rata-rata ${formatCompact(s.mostUsedApp.value / s.mostUsedApp.count)}`} />
            </div>
          </div>

          {s.byApp.length > 0 && (
            <Section title="Pengeluaran per aplikasi">
              <div className="k-card">
                {s.byApp.map((a, i) => (
                  <button key={a.key} type="button" className="k-row" style={{ padding: '6px 0' }} onClick={() => setAppFilter(a.key)}>
                    <AppAvatar app={a.app || { pkg: a.key, name: a.label }} size={36} />
                    <div className="k-main">
                      <div style={{ display: 'flex' }}><span className="k-title grow">{a.label}</span><small className="k-muted">{a.count}x · {pct(a.value, s.expense)}%</small></div>
                      <Bar value={a.value} max={s.byApp[0].value} color={CHART_COLORS[i % CHART_COLORS.length]} />
                    </div>
                    <b>{formatCompact(a.value)}</b>
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Pengeluaran per kategori">
            <div className="k-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Donut slices={s.byCategory} total={s.expense} />
              <div className="k-legend">
                {s.byCategory.length === 0 && <span className="k-muted">Belum ada pengeluaran.</span>}
                {s.byCategory.slice(0, 6).map((c, i) => (
                  <div key={c.key}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span>{categoryEmoji(c.label)} {c.label}</span><b>{pct(c.value, s.expense)}%</b></div>
                ))}
              </div>
            </div>
          </Section>

          <Section title={s.bucketTitle}>
            <div className="k-card"><Bars buckets={s.buckets} /></div>
          </Section>

          {s.byMerchant.length > 0 && (
            <Section title="Merchant teratas">
              <div className="k-card flush">
                {s.byMerchant.slice(0, 5).map((m) => (
                  <div key={m.key} className="k-row" style={{ cursor: 'default' }}>
                    <div className="k-main"><div className="k-title">{m.label}</div><div className="k-meta">{m.app ? m.app.name : `${m.appCount} aplikasi`} · {m.count}x</div></div>
                    <b>{formatIDR(m.value)}</b>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={`Semua transaksi (${filtered.length})`} action={scope === 'tracked' ? 'Tampilkan semua sumber' : 'Hanya notifikasi & catatan'} onAction={() => setScope(scope === 'tracked' ? 'all' : 'tracked')}>
            <div className="k-chips" style={{ marginBottom: 6 }}>
              <Chip active={!appFilter} onClick={() => setAppFilter(null)}>Semua</Chip>
              {apps.map((a) => <Chip key={a.pkg} active={appFilter === a.pkg} onClick={() => setAppFilter(a.pkg)}>{a.name}</Chip>)}
            </div>
            {filtered.length === 0 && <div className="k-empty"><span className="k-emoji">🗂️</span>Tidak ada transaksi pada periode ini.</div>}
            {days.map(([day, list]) => (
              <div key={day}>
                <div className="k-day">{formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                <div className="k-card flush">{list.map((e) => <EntryRow key={`${e.store}:${e.id}`} entry={e} />)}</div>
              </div>
            ))}
            {filtered.length > shown && (
              <button type="button" className="k-btn block" style={{ marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>Tampilkan lebih banyak ({filtered.length - shown} lagi)</button>
            )}
          </Section>

          <Section title="Laporan tersimpan">
            <Link to="/reports" className="k-card k-banner" style={{ background: 'var(--surface)', color: 'inherit' }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div className="grow"><b>Snapshot laporan</b><div className="k-muted" style={{ fontSize: '.78rem' }}>Buat & cetak laporan untuk periode tertentu (CSV / PDF)</div></div>
              <span className="k-link">Buka ›</span>
            </Link>
          </Section>
        </>
      )}
      <Fab onClick={() => openComposer({ mode: 'edit' })}>＋ Catat</Fab>
    </div>
  );
}
