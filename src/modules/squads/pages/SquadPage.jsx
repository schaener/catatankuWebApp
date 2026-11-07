import { memo, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { AppAvatar, Bar, Bars, Chip, Donut, Hero, Section, Tag } from '../../../platform/ui/kit.jsx';
import { Avatar } from '../../../platform/ui/ui.jsx';
import { CHART_COLORS } from '../../../platform/constants.js';
import { formatCompact, formatDate, formatIDR } from '../../../platform/format.js';
import { useToday } from '../../../platform/hooks.js';
import { openComposer } from '../../../platform/composer.js';
import { categoryEmoji, PERIODS, periodRange, signedAmount, useLedger } from '../../ledger/index.js';
import { groupByDay } from '../../ledger/domain.js';
import { useGetMySquadsQuery, useGetSquadEntriesQuery } from '../api/squadsApi.js';
import { squadSummary } from '../logic/squadSummary.js';

const pct = (v, t) => (t > 0 ? Math.round((v / t) * 100) : 0);
const MEMBER_COLORS = ['#0f766e', '#db2777', '#7c3aed', '#ea580c', '#2563eb', '#16a34a', '#64748b'];

/** Shared entry; your own open the editor of the underlying transaction, others are read-only. */
const SharedRow = memo(function SharedRow({ entry, mine, ownEntry }) {
  const content = (
    <>
      <AppAvatar app={entry.app} size={38} />
      <div className="k-main">
        <div className="k-title">{entry.place || entry.category}</div>
        <div className="k-meta">{mine ? 'Kamu' : entry.owner.name} · {entry.app.name} · {categoryEmoji(entry.category)} {entry.category}</div>
      </div>
      <span className={`k-amount ${entry.kind}`}>{signedAmount(entry)}</span>
    </>
  );
  return mine && ownEntry ? (
    <button type="button" className="k-row" onClick={() => openComposer({ mode: 'edit', entry: ownEntry })}>{content}</button>
  ) : (
    <div className="k-row" style={{ cursor: 'default' }}>{content}</div>
  );
});

export default function SquadPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const today = useToday();
  const [period, setPeriod] = useState('month');
  const { data: squads } = useGetMySquadsQuery();
  const squad = squads?.find((s) => s.id === id);
  // one stream covering every period chip (the oldest of "3 bulan" and "Tahun ini")
  const sinceMs = Math.min(periodRange('year', today).start, periodRange('last3', today).start);
  const { data: docs } = useGetSquadEntriesQuery({ squadId: id, sinceMs });
  const s = useMemo(() => (docs && squad ? squadSummary(docs, squad, today, period) : null), [docs, squad, today, period]);
  const { entries } = useLedger();
  const mineById = useMemo(() => new Map(entries.filter((e) => e.store === 'tx').map((e) => [e.id, e])), [entries]);
  const [shown, setShown] = useState(30);

  if (squads && !squad) {
    return (
      <div className="page k-page">
        <Hero><h1>Squad tidak ditemukan</h1><p>Mungkin kamu sudah keluar atau squad dihapus.</p></Hero>
        <div className="k-pad" style={{ marginTop: 16 }}><Link to="/squads" className="k-btn primary">← Kembali ke daftar squad</Link></div>
      </div>
    );
  }
  const colorOf = (uid) => MEMBER_COLORS[Math.max(0, squad?.memberUids.indexOf(uid)) % MEMBER_COLORS.length];

  return (
    <div className="page k-page">
      <Hero pad="lg">
        <div className="k-hero-row">
          <button type="button" className="k-round-btn" aria-label="Kembali" onClick={() => navigate('/squads')}>←</button>
          <div className="grow">
            <h1>{squad ? `${squad.emoji || '👥'} ${squad.name}` : '…'}</h1>
            <p>{squad ? `${squad.memberUids.length} anggota` : ''}</p>
          </div>
          <button type="button" className="k-round-btn" aria-label="Pengaturan squad" onClick={() => navigate(`/squads/${id}/settings`)}>⚙︎</button>
        </div>
        <div className="k-hero-chips">{PERIODS.map((p) => <Chip key={p.id} active={p.id === period} onClick={() => setPeriod(p.id)}>{p.label}</Chip>)}</div>
        <div className="k-sub">Total keluar bersama</div>
        <div className="k-big">{s ? formatIDR(s.expense) : '…'}</div>
      </Hero>

      <div className="k-float" style={{ marginTop: -50 }}>
        <div className="k-muted" style={{ fontSize: '.75rem', marginBottom: 6 }}>Siapa bayar apa</div>
        {!s && <div className="k-muted">Memuat…</div>}
        {s?.byMember.map((m) => (
          <div key={m.uid} className="k-row" style={{ padding: '5px 0', cursor: 'default' }}>
            <Avatar name={m.name} src={m.photo} size={34} />
            <div className="k-main">
              <div style={{ display: 'flex' }}>
                <span className="k-title grow">{m.uid === user.uid ? `${m.name.split(' ')[0]} (kamu)` : m.name}{m.former ? ' · keluar' : ''}</span>
                <small className="k-muted">{m.count}x · {pct(m.value, s.expense)}%</small>
              </div>
              <Bar value={m.value} max={s.byMember[0]?.value || 0} color={colorOf(m.uid)} />
            </div>
            <b>{formatCompact(m.value)}</b>
          </div>
        ))}
      </div>

      {s && (
        <>
          {s.count === 0 && (
            <div className="k-empty"><span className="k-emoji">🧾</span>Belum ada transaksi bersama. Pilih &quot;Catat ke: {squad?.name}&quot; saat meninjau atau mencatat, atau atur bagikan otomatis di pengaturan squad.</div>
          )}
          {s.byCategory.length > 0 && (
            <Section title="Per kategori">
              <div className="k-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Donut slices={s.byCategory} total={s.expense} />
                <div className="k-legend">
                  {s.byCategory.slice(0, 6).map((c, i) => (
                    <div key={c.key}><i style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span>{categoryEmoji(c.label)} {c.label}</span><b>{pct(c.value, s.expense)}%</b></div>
                  ))}
                </div>
              </div>
            </Section>
          )}
          {s.byApp.length > 0 && (
            <Section title="Per aplikasi">
              <div className="k-card">
                {s.byApp.map((a, i) => (
                  <div key={a.key} className="k-row" style={{ padding: '6px 0', cursor: 'default' }}>
                    <AppAvatar app={a.app || { pkg: a.key, name: a.label }} size={34} />
                    <div className="k-main"><div className="k-title">{a.label}</div><Bar value={a.value} max={s.byApp[0].value} color={CHART_COLORS[i % CHART_COLORS.length]} /></div>
                    <b>{formatCompact(a.value)}</b>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {s.count > 0 && <Section title={s.bucketTitle}><div className="k-card"><Bars buckets={s.buckets} /></div></Section>}
          {s.items.length > 0 && (
            <Section title={`Transaksi bersama (${s.items.length})`}>
              {groupByDay(s.items.slice(0, shown)).map(([day, list]) => (
                <div key={day}>
                  <div className="k-day">{formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                  <div className="k-card flush">
                    {list.map((e) => <SharedRow key={e.id} entry={e} mine={e.owner.uid === user.uid} ownEntry={mineById.get(e.id)} />)}
                  </div>
                </div>
              ))}
              {s.items.length > shown && <button type="button" className="k-btn block" style={{ marginTop: 12 }} onClick={() => setShown((n) => n + 30)}>Tampilkan lebih banyak</button>}
            </Section>
          )}
          <p className="k-muted k-pad" style={{ fontSize: '.75rem', marginTop: 14 }}>
            <Tag>hanya baca</Tag> Anggota melihat transaksi yang dibagikan. Mengubah / menghapus hanya oleh pemiliknya.
          </p>
        </>
      )}
    </div>
  );
}
