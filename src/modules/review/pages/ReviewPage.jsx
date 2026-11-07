import { memo, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppAvatar, Chip, Hero, Section, Segmented, Tag } from '../../../platform/ui/kit.jsx';
import { formatIDR, timeAgo } from '../../../platform/format.js';
import { openComposer } from '../../../platform/composer.js';
import { isNativeApp, native } from '../../../platform/native.js';
import { useNativeList } from '../../../platform/hooks.js';
import { useShareTargets } from '../../../platform/shareTargets.js';
import { useGetDevicesQuery, useSetDeviceAppsMutation } from '../../capture/index.js';
import { EntryRow, categoryEmoji, dismissPair, ignoreEntries, markTransfer, saveEntries, signedAmount, useLedger, useReviewQueue } from '../../ledger/index.js';

const SKIP_REASON = {
  NOT_MONITORED: ['Aplikasi belum dipantau', 'Nyalakan aplikasi ini sebagai sumber'],
  NO_AMOUNT: ['Nominal tidak terbaca', 'Tidak ada "Rp" / "IDR" / "Nominal" di teksnya'],
  SECRET: ['Berisi kode rahasia', 'OTP / PIN tidak pernah dikirim, isinya tidak disimpan'],
  HIDDEN: ['Disembunyikan Android', 'Aktifkan "Baca notifikasi bank lengkap" di Pengaturan HP'],
};

/** Per-card "Catat ke" destination; defaults to the user's rule for that app. */
function useDestination(entry) {
  const { targets, defaultFor } = useShareTargets();
  const [choice, setChoice] = useState(null);
  return { targets, squadId: choice ?? defaultFor(entry.app.pkg) ?? '', setSquadId: setChoice };
}

const ReviewCard = memo(function ReviewCard({ entry, onSave, onIgnore }) {
  const { targets, squadId, setSquadId } = useDestination(entry);
  const ready = entry.amount && entry.kind && !entry.isPromo;
  const menu = () => openComposer({ mode: 'menu', entry });
  return (
    <article className="k-card k-review" data-sure={entry.confident || undefined} onContextMenu={(e) => { e.preventDefault(); menu(); }}>
      <div className="k-row" style={{ padding: 0, cursor: 'default' }}>
        <AppAvatar app={entry.app} size={38} />
        <div className="k-main">
          <div className="k-title">{entry.app.name}</div>
          <div className="k-meta">{timeAgo(entry.date)}</div>
        </div>
        <span className={`k-amount ${entry.kind || ''}`}>{entry.amount ? signedAmount(entry) : 'Nominal ?'}</span>
      </div>
      <div className="k-tags" style={{ marginTop: 8 }}>
        {entry.place && <Tag>📍 {entry.place}</Tag>}
        {entry.kind && <Tag>{categoryEmoji(entry.category)} {entry.category}</Tag>}
        {entry.movedFrom && <Tag tone="violet">dari {entry.movedFrom.name}</Tag>}
        {entry.confident ? <Tag tone="good">Yakin</Tag> : !entry.isPromo && <Tag tone="warn">Perlu dicek</Tag>}
      </div>
      {entry.raw[0] && <p className="k-raw">{[entry.raw[0].title, entry.raw[0].text].filter(Boolean).join(' · ')}</p>}
      {ready && targets.length > 0 && (
        <>
          <span className="k-label" style={{ marginTop: 4 }}>Catat ke</span>
          <div className="k-choices">
            <Chip active={!squadId} onClick={() => setSquadId('')}>🔒 Pribadi</Chip>
            {targets.map((t) => (
              <Chip key={t.id} active={squadId === t.id} onClick={() => setSquadId(t.id)}>{t.emoji} {t.name}</Chip>
            ))}
          </div>
        </>
      )}
      <div className="k-actions" style={{ marginTop: 10 }}>
        <button type="button" className="k-btn" onClick={() => onIgnore(entry)}>Abaikan</button>
        <button type="button" className={`k-btn ${ready ? '' : 'primary'}`} onClick={() => openComposer({ mode: 'edit', entry: { ...entry, squadId } })}>Ubah</button>
        {ready && <button type="button" className="k-btn primary" onClick={() => onSave({ ...entry, squadId: squadId || null })}>Simpan</button>}
      </div>
    </article>
  );
});

function TransferCard({ pair, onYes, onNo }) {
  const [out, inc] = pair;
  return (
    <article className="k-card">
      <div style={{ display: 'flex', alignItems: 'center', textAlign: 'center' }}>
        <div className="grow"><AppAvatar app={out.app} size={38} /><div className="k-meta">{out.app.name}</div></div>
        <div style={{ flex: 1.3 }}><b>{formatIDR(out.amount)}</b><div className="k-muted">⟶</div></div>
        <div className="grow"><AppAvatar app={inc.app} size={38} /><div className="k-meta">{inc.app.name}</div></div>
      </div>
      <p className="k-muted" style={{ textAlign: 'center', fontSize: '.78rem', margin: '10px 0' }}>Kalau iya, tidak dihitung pengeluaran · {timeAgo(out.date)}</p>
      <div className="k-actions">
        <button type="button" className="k-btn" onClick={onNo}>Bukan, catat terpisah</button>
        <button type="button" className="k-btn primary" onClick={onYes}>Ya, pindah dana</button>
      </div>
    </article>
  );
}

function SkippedRow({ item, onMonitor, onRecord, onDismiss }) {
  const [label, hint] = SKIP_REASON[item.reason] ?? SKIP_REASON.NO_AMOUNT;
  const body = [item.title, item.text].filter(Boolean).join(' · ');
  return (
    <article className="k-card">
      <div className="k-row" style={{ padding: 0, cursor: 'default' }}>
        <AppAvatar app={{ pkg: item.packageName, name: item.appName }} size={36} />
        <div className="k-main">
          <div className="k-title">{item.appName}</div>
          <div className="k-meta">{timeAgo(item.postedAt)}</div>
        </div>
        <button type="button" className="icon-btn" aria-label="Hapus dari daftar" onClick={onDismiss}>✕</button>
      </div>
      <div className="k-tags" style={{ marginTop: 6 }}>
        <Tag tone={item.reason === 'SECRET' ? 'muted' : 'warn'}>{label}</Tag>
        <small className="k-muted">{hint}</small>
      </div>
      {body && <p className="k-raw">{body}</p>}
      {(onMonitor || onRecord) && (
        <div className="k-actions">
          {onMonitor && <button type="button" className={`k-btn ${onRecord ? '' : 'primary'}`} onClick={onMonitor}>Pantau aplikasi ini</button>}
          {onRecord && <button type="button" className="k-btn primary" onClick={onRecord}>Catat</button>}
        </div>
      )}
    </article>
  );
}

function History() {
  const { entries } = useLedger();
  const [skippedAll, refreshSkipped] = useNativeList(native.skipped);
  const [captured] = useNativeList(native.captured);
  const { data: devices = [] } = useGetDevicesQuery();
  const [setApps] = useSetDeviceAppsMutation();
  const deviceId = isNativeApp ? native.deviceStatus()?.deviceId : null;
  const device = devices.find((d) => d.id === deviceId);
  // a skipped notification recorded via "Catat" is saved under the same id
  const savedIds = new Set(entries.map((e) => e.id));
  const skipped = skippedAll.filter((s) => !savedIds.has(s.id));
  const recent = entries.filter((e) => e.origin === 'notification' && !e.pending).slice(0, 30);

  if (!isNativeApp) {
    return (
      <Section title="Tersimpan dari notifikasi">
        <p className="k-muted" style={{ fontSize: '.82rem', marginTop: 0 }}>Daftar notifikasi yang dilewati HP hanya tampil di aplikasi Android.</p>
        <div className="k-card flush">{recent.length ? recent.map((e) => <EntryRow key={e.id} entry={e} />) : <div className="k-empty">Belum ada.</div>}</div>
      </Section>
    );
  }
  return (
    <>
      {skipped.length > 0 && (
        <Section title={`Tidak dicatat (${skipped.length})`} action="Bersihkan" onAction={() => { native.clearSkipped(); refreshSkipped(); }}>
          <p className="k-muted" style={{ fontSize: '.8rem', margin: '0 2px 8px' }}>Notifikasi bank &amp; e-wallet yang dilewati, dan alasannya. Hanya tersimpan di HP ini.</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {skipped.map((s) => (
              <SkippedRow
                key={s.id}
                item={s}
                onDismiss={() => { native.removeSkipped(s.id); refreshSkipped(); }}
                onRecord={s.reason === 'SECRET' ? null : () => openComposer({ mode: 'edit', raw: s })}
                onMonitor={s.reason === 'NOT_MONITORED' && device && !(device.selected || []).includes(s.packageName) ? () => setApps({ deviceId, packages: [s.packageName], on: true }) : null}
              />
            ))}
          </div>
        </Section>
      )}
      <Section title={`Tertangkap di HP ini (${captured.length})`}>
        <div className="k-card flush">
          {captured.length === 0 && <div className="k-empty"><span className="k-emoji">🕓</span>Belum ada yang tertangkap.</div>}
          {captured.slice(0, 100).map((c) => (
            <div key={c.id} className="k-row" style={{ cursor: 'default' }}>
              <AppAvatar app={{ pkg: c.packageName, name: c.appName }} size={38} />
              <div className="k-main">
                <div className="k-title">{c.appName}</div>
                <div className="k-meta">{[c.title, c.text].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="k-end">
                <small className="k-muted">{timeAgo(c.postedAt)}</small>
                <Tag tone={c.synced ? 'good' : 'warn'}>{c.synced ? 'Terkirim' : 'Antri'}</Tag>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

export default function ReviewPage() {
  const dispatch = useDispatch();
  const queue = useReviewQueue();
  const { defaultFor } = useShareTargets();
  const [tab, setTab] = useState('pending');
  const [showPromos, setShowPromos] = useState(false);
  const save = useCallback((e) => dispatch(saveEntries([e], 'Transaksi disimpan')), [dispatch]);
  const ignore = useCallback((e) => dispatch(ignoreEntries([e])), [dispatch]);
  const saveSure = () => dispatch(saveEntries(queue.sure.map((e) => ({ ...e, squadId: defaultFor(e.app.pkg) || null }))));

  return (
    <div className="page k-page">
      <Hero>
        <div className="k-hero-row">
          <div className="grow">
            <h1>Tinjau</h1>
            <p>{queue.size ? `${queue.size} transaksi dari notifikasi` : 'Semua sudah ditinjau'}</p>
          </div>
          {tab === 'pending' && queue.sure.length > 1 && (
            <button type="button" className="k-btn" style={{ background: '#fff', color: 'var(--primary)' }} onClick={saveSure}>
              ✓ Simpan {queue.sure.length} yang yakin
            </button>
          )}
        </div>
      </Hero>
      <div className="k-pad" style={{ marginTop: 14 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[{ value: 'pending', label: `Perlu ditinjau${queue.size ? ` (${queue.size})` : ''}` }, { value: 'history', label: 'Riwayat' }]}
        />
      </div>

      {tab === 'history' ? (
        <div className="k-pad"><History /></div>
      ) : (
        <div className="k-pad">
          {queue.loading && <div className="k-empty">Memuat…</div>}
          {!queue.loading && queue.size === 0 && <div className="k-empty"><span className="k-emoji">🎉</span>Tidak ada yang perlu ditinjau. Transaksi baru dari notifikasi akan muncul di sini.</div>}
          {queue.transfers.length > 0 && (
            <Section title="Pindah dana antar akunmu?">
              <div style={{ display: 'grid', gap: 10 }}>
                {queue.transfers.map((pair) => (
                  <TransferCard key={pair[0].id} pair={pair} onYes={() => dispatch(markTransfer(pair))} onNo={() => dismissPair(pair)} />
                ))}
              </div>
            </Section>
          )}
          {queue.items.length > 0 && (
            <Section title="Transaksi">
              <div className="k-review-grid">
                {queue.items.map((e) => <ReviewCard key={e.id} entry={e} onSave={save} onIgnore={ignore} />)}
              </div>
            </Section>
          )}
          {queue.promos.length > 0 && (
            <Section title={`${showPromos ? '▾' : '▸'} Kemungkinan promo (${queue.promos.length})`} action="Abaikan semua" onAction={() => dispatch(ignoreEntries(queue.promos, 'Promo diabaikan'))}>
              <button type="button" className="k-link" onClick={() => setShowPromos((s) => !s)}>{showPromos ? 'Sembunyikan' : 'Tampilkan'}</button>
              {showPromos && <div className="k-review-grid">{queue.promos.map((e) => <ReviewCard key={e.id} entry={e} onSave={save} onIgnore={ignore} />)}</div>}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
