import { useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppAvatar, Chip, Segmented, Sheet, Tag } from '../../../platform/ui/kit.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../platform/constants.js';
import { formatDateTime, formatIDR } from '../../../platform/format.js';
import { toDateStr } from '../../../platform/date.js';
import { useShareTargets } from '../../../platform/shareTargets.js';
import { useAddAppRuleMutation } from '../../capture/index.js';
import { deleteEntry, ignoreEntries, moveEntry, returnToReview, saveEntries } from '../api/commands.js';
import { useAccounts } from '../hooks/useLedger.js';
import { CASH, OTHER, entryTitle, isCountable, rawBody } from '../logic/entries.js';
import { signedAmount } from './EntryRow.jsx';

const KINDS = [
  { value: 'expense', label: 'Keluar', tone: 'expense' },
  { value: 'income', label: 'Masuk', tone: 'income' },
  { value: 'transfer', label: 'Pindah dana', tone: 'transfer' },
];
const EMOJI = {
  'Makanan & Minuman': '🍜', Transportasi: '🚗', Belanja: '🛍️', Tagihan: '🧾', Hiburan: '🎬', Kesehatan: '💊', Pendidikan: '📚',
  Rumah: '🏠', 'Split Bill': '👥', Gaji: '💼', Bonus: '🎁', Investasi: '📈', Hadiah: '🎉', Penjualan: '🏷️',
};
export const categoryEmoji = (c) => EMOJI[c] ?? '💸';
const digitsOnly = (s) => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13);
const grouped = (digits) => (digits ? Number(digits).toLocaleString('id-ID') : '');
const originalApp = (e) => e.raw[0] && { pkg: e.raw[0].packageName, name: e.raw[0].appName || e.raw[0].packageName };

/** Horizontal strip of accounts; keeps a value that is no longer monitored selectable. */
function AccountStrip({ accounts, value, onChange }) {
  const list = value && !accounts.some((a) => a.pkg === value.pkg) ? [value, ...accounts] : accounts;
  return (
    <div className="k-accounts">
      {list.map((a) => (
        <button key={a.pkg} type="button" className={`k-account ${a.pkg === value?.pkg ? 'on' : ''}`} onClick={() => onChange(a)}>
          <span className="ring">
            <AppAvatar app={a} size={42} />
          </span>
          <small>{a.name}</small>
        </button>
      ))}
    </div>
  );
}

/** Create (`entry.store === 'draft'` without id) or edit any entry: pending, saved, transfer or skipped notification. */
export function EntryEditor({ entry, onClose }) {
  const dispatch = useDispatch();
  const accounts = useAccounts();
  const { targets, defaultFor } = useShareTargets();
  const [addRule] = useAddAppRuleMutation();
  const isNew = entry.store === 'draft' && !entry.raw.length;
  const original = originalApp(entry);

  const [kind, setKind] = useState(entry.kind || 'expense');
  const [digits, setDigits] = useState(entry.amount ? String(entry.amount) : '');
  const [app, setApp] = useState(() => (isNew ? accounts.find((a) => a.pkg !== CASH.pkg) || CASH : entry.app));
  const [toApp, setToApp] = useState(entry.toApp);
  const [category, setCategory] = useState(entry.category);
  const [place, setPlace] = useState(entry.place);
  const [note, setNote] = useState(entry.note);
  const [day, setDay] = useState(() => toDateStr(entry.date || Date.now()));
  const [remember, setRemember] = useState(false);
  // "Catat ke": explicit choice wins; otherwise follow the user's per-app default while it's unsaved.
  const [squadChoice, setSquadChoice] = useState(entry.store === 'tx' ? entry.squadId ?? '' : null);
  const wanted = squadChoice ?? (entry.pending || entry.store === 'draft' ? defaultFor(app.pkg) || '' : '');
  // a squad the user has left is no longer a valid target: saving makes the entry private again
  const squadId = targets.some((t) => t.id === wanted) ? wanted : '';
  const amountRef = useRef(null);

  const categories = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const selectedCategory = categories.includes(category) ? category : categories[0];
  const amount = Number(digits) || 0;
  const moved = original && original.pkg !== app.pkg;
  const error = !amount ? 'Isi nominalnya' : kind === 'transfer' && !toApp ? 'Pilih aplikasi tujuan' : kind === 'transfer' && toApp?.pkg === app.pkg ? 'Asal dan tujuan tidak boleh sama' : null;

  function build() {
    const [y, m, d] = day.split('-').map(Number);
    const sameDay = entry.date && toDateStr(entry.date) === day;
    const date = sameDay ? entry.date : day === toDateStr(Date.now()) ? Date.now() : new Date(y, m - 1, d, 12).getTime();
    const transfer = kind === 'transfer';
    return {
      ...entry,
      kind, amount, app, date, isPromo: false,
      toApp: transfer ? toApp : null,
      movedFrom: moved ? original : null,
      category: transfer ? OTHER : selectedCategory,
      place: transfer ? '' : place.trim(),
      note: note.trim(),
      squadId: transfer ? null : squadId || null,
    };
  }

  function submit() {
    dispatch(saveEntries([build()], isNew ? 'Transaksi dicatat' : entry.pending ? 'Transaksi disimpan' : 'Perubahan disimpan'));
    if (moved && remember && place.trim()) addRule({ fromPackage: original.pkg, keyword: place.trim(), toPackage: app.pkg, toName: app.name });
    onClose();
  }

  const act = (action) => () => {
    dispatch(action);
    onClose();
  };

  return (
    <Sheet
      title={isNew ? 'Catat transaksi' : 'Ubah transaksi'}
      onClose={onClose}
      footer={
        <>
          {entry.pending && <button type="button" className="k-btn danger block" style={{ marginBottom: 8 }} onClick={act(ignoreEntries([entry]))}>Abaikan notifikasi ini</button>}
          {!entry.pending && entry.store !== 'draft' && (
            <div className="k-field-row" style={{ marginBottom: 8 }}>
              <button type="button" className="k-btn danger block" onClick={act(deleteEntry(entry))}>Hapus</button>
              {entry.raw.length > 0 && <button type="button" className="k-btn block" onClick={act(returnToReview(entry))}>Kembalikan ke Tinjau</button>}
            </div>
          )}
          <button type="button" className="k-btn primary block" disabled={Boolean(error)} onClick={submit}>
            {error || (isNew || entry.pending ? 'Simpan' : 'Simpan perubahan')}
          </button>
        </>
      }
    >
      {entry.store !== 'draft' && <Tag>{entry.origin === 'notification' ? 'dari notifikasi' : 'input manual'}</Tag>}
      {entry.raw.map((r) => (
        <div key={r.id} className="k-raw">
          🔔 <b>{r.appName}</b> · {formatDateTime(r.postedAt)}
          <br />
          {rawBody(r)}
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        <Segmented options={KINDS} value={kind} onChange={setKind} />
      </div>
      <label className={`k-amount-input k-amount ${kind}`} style={{ marginTop: 10 }}>
        <span>Rp</span>
        <input ref={amountRef} inputMode="numeric" autoFocus={isNew} placeholder="0" value={grouped(digits)} onChange={(e) => setDigits(digitsOnly(e.target.value))} aria-label="Nominal" />
      </label>

      <span className="k-label">{kind === 'transfer' ? 'Dari aplikasi' : kind === 'income' ? 'Masuk ke aplikasi' : 'Dibayar pakai aplikasi'}</span>
      <AccountStrip accounts={accounts} value={app} onChange={setApp} />
      {moved && (
        <>
          <div className="k-muted" style={{ fontSize: '.78rem', color: 'var(--violet)', marginTop: 4 }}>Asal notifikasi: {original.name}. Akan ditandai &quot;dipindah&quot;.</div>
          {place.trim() && (
            <label className="k-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Ingat: &quot;{place.trim()}&quot; dari {original.name} → {app.name}
            </label>
          )}
        </>
      )}

      {kind === 'transfer' ? (
        <>
          <span className="k-label">Ke aplikasi</span>
          <AccountStrip accounts={accounts.filter((a) => a.pkg !== app.pkg)} value={toApp} onChange={setToApp} />
        </>
      ) : (
        <>
          <span className="k-label">Kategori</span>
          <div className="k-choices">
            {categories.map((c) => (
              <Chip key={c} active={c === selectedCategory} onClick={() => setCategory(c)}>
                {categoryEmoji(c)} {c}
              </Chip>
            ))}
          </div>
        </>
      )}

      <span className="k-label">Detail</span>
      <div className="k-field-row">
        {kind !== 'transfer' && <input placeholder="Tempat / merchant" value={place} onChange={(e) => setPlace(e.target.value)} />}
        <input type="date" value={day} max={toDateStr(Date.now())} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Tanggal" />
      </div>
      <input style={{ marginTop: 8 }} placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />

      {kind !== 'transfer' && targets.length > 0 && (
        <>
          <span className="k-label">Catat ke</span>
          <div className="k-choices">
            <Chip active={!squadId} onClick={() => setSquadChoice('')}>🔒 Pribadi</Chip>
            {targets.map((t) => (
              <Chip key={t.id} active={squadId === t.id} onClick={() => setSquadChoice(t.id)}>
                {t.emoji} {t.name}
              </Chip>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** Long-press menu. */
export function EntryActionSheet({ entry, onClose, onEdit, onMove }) {
  const dispatch = useDispatch();
  const act = (action) => () => {
    dispatch(action);
    onClose();
  };
  const items = [
    entry.pending && isCountable(entry) && { ic: '✓', title: 'Simpan', sub: 'Catat sesuai yang terbaca', run: act(saveEntries([entry])) },
    { ic: '✏️', title: 'Ubah…', sub: 'Nominal, jenis, kategori, tanggal, squad', run: onEdit },
    entry.kind !== 'transfer' && { ic: '↔️', title: 'Pindahkan ke aplikasi…', sub: 'Kalau salah sasaran', run: onMove },
    !entry.pending && entry.raw.length > 0 && { ic: '↩️', title: 'Kembalikan ke Tinjau', sub: 'Batalkan penyimpanan', run: act(returnToReview(entry)) },
    entry.pending
      ? { ic: '🚫', title: 'Abaikan', sub: 'Bukan transaksi', danger: true, run: act(ignoreEntries([entry])) }
      : { ic: '🗑️', title: 'Hapus', sub: 'Dari laporan, web dan squad', danger: true, run: act(deleteEntry(entry)) },
  ].filter(Boolean);
  return (
    <Sheet onClose={onClose}>
      <div className="k-row" style={{ cursor: 'default', padding: '4px 0 10px' }}>
        <AppAvatar app={entry.app} size={40} />
        <div className="k-main">
          <div className="k-title">{entryTitle(entry)}</div>
          <div className="k-meta">{entry.app.name} · {formatDateTime(entry.date)}</div>
        </div>
        <span className={`k-amount ${entry.kind || ''}`}>{signedAmount(entry)}</span>
      </div>
      {items.map((it) => (
        <button key={it.title} type="button" className={`k-menu-item ${it.danger ? 'danger' : ''}`} onClick={it.run}>
          <span className="ic">{it.ic}</span>
          <span>
            <b>{it.title}</b>
            <small>{it.sub}</small>
          </span>
        </button>
      ))}
    </Sheet>
  );
}

/** Move to another app; optionally remember it for similar notifications. */
export function MoveAppSheet({ entry, onClose }) {
  const dispatch = useDispatch();
  const accounts = useAccounts();
  const [addRule] = useAddAppRuleMutation();
  const origin = originalApp(entry);
  const [choice, setChoice] = useState(entry.app);
  const [remember, setRemember] = useState(false);
  const list = useMemo(() => [origin, entry.app, ...accounts].filter(Boolean).filter((a, i, all) => all.findIndex((b) => b.pkg === a.pkg) === i), [origin, entry.app, accounts]);
  const canRemember = origin && entry.place && choice.pkg !== origin.pkg;

  function submit() {
    dispatch(moveEntry(entry, choice));
    if (canRemember && remember) addRule({ fromPackage: origin.pkg, keyword: entry.place, toPackage: choice.pkg, toName: choice.name });
    onClose();
  }

  return (
    <Sheet
      title="Pindahkan ke aplikasi"
      onClose={onClose}
      footer={<button type="button" className="k-btn primary block" disabled={choice.pkg === entry.app.pkg} onClick={submit}>Pindahkan ke {choice.name}</button>}
    >
      <p className="k-muted" style={{ margin: '0 0 6px', fontSize: '.82rem' }}>
        {[entryTitle(entry), entry.amount && formatIDR(entry.amount), origin && `tertangkap dari ${origin.name}`].filter(Boolean).join(' · ')}
      </p>
      {list.map((a) => (
        <label key={a.pkg} className="k-radio-row">
          <AppAvatar app={a} size={38} />
          <span className="grow">
            <b style={{ fontSize: '.9rem' }}>{a.name}</b>
            {origin?.pkg === a.pkg && <small className="k-muted" style={{ display: 'block' }}>asal notifikasi</small>}
          </span>
          <input type="radio" name="move-app" checked={a.pkg === choice.pkg} onChange={() => setChoice(a)} />
        </label>
      ))}
      {canRemember && (
        <label className="k-check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Ingat: &quot;{entry.place}&quot; dari {origin.name} → {choice.name}
        </label>
      )}
    </Sheet>
  );
}
