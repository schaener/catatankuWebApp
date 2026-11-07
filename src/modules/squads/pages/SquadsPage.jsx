import { memo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { Link, useNavigate } from 'react-router-dom';
import { Chip, Hero, Section, Sheet } from '../../../platform/ui/kit.jsx';
import { Avatar } from '../../../platform/ui/ui.jsx';
import { formatCompact } from '../../../platform/format.js';
import { useToday } from '../../../platform/hooks.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { periodRange } from '../../ledger/domain.js';
import { useCreateSquadMutation, useGetMySquadsQuery, useGetSquadEntriesQuery, useJoinSquadMutation } from '../api/squadsApi.js';
import { squadSummary } from '../logic/squadSummary.js';

const EMOJIS = ['🏠', '💑', '🏢', '👨‍👩‍👧', '✈️', '🎓', '⚽', '💼', '🍜', '👥'];

const SquadCard = memo(function SquadCard({ squad, uid }) {
  const today = useToday();
  const { data } = useGetSquadEntriesQuery({ squadId: squad.id, sinceMs: periodRange('month', today).start });
  const s = data ? squadSummary(data, squad, today) : null;
  const members = squad.memberUids.map((id) => ({ id, ...squad.members?.[id] }));
  return (
    <Link to={`/squads/${squad.id}`} className="k-card k-squad">
      <span className="k-squad-icon">{squad.emoji || '👥'}</span>
      <div className="grow">
        <b>{squad.name}</b>
        <div className="k-muted" style={{ fontSize: '.75rem', margin: '2px 0 6px' }}>
          {members.length} anggota{squad.ownerId === uid ? ' · kamu pemilik' : ''}
        </div>
        <div className="k-stack">
          {members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} src={m.photo} size={24} />)}
          {members.length > 4 && <span className="avatar avatar-fallback" style={{ width: 24, height: 24, fontSize: 9 }}>+{members.length - 4}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="k-amount expense">{s ? `−Rp ${formatCompact(s.expense)}` : '…'}</div>
        <small className="k-muted">bulan ini</small>
      </div>
    </Link>
  );
});

function CreateSheet({ onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [create, { isLoading }] = useCreateSquadMutation();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const submit = async () => {
    const res = await create({ name, emoji });
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    onClose();
    navigate(`/squads/${res.data}/settings`);
  };
  return (
    <Sheet title="Buat squad" onClose={onClose} footer={<button type="button" className="k-btn primary block" disabled={!name.trim() || isLoading} onClick={submit}>{isLoading ? 'Membuat…' : 'Buat squad'}</button>}>
      <span className="k-label">Nama</span>
      <input autoFocus placeholder="mis. Keluarga, Kos Melati, Kita Berdua" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <span className="k-label">Ikon</span>
      <div className="k-choices">{EMOJIS.map((e) => <Chip key={e} active={e === emoji} onClick={() => setEmoji(e)}>{e}</Chip>)}</div>
      <p className="k-muted" style={{ fontSize: '.8rem' }}>Setelah dibuat, kamu dapat kode undangan untuk dibagikan.</p>
    </Sheet>
  );
}

export function JoinSheet({ onClose, initialCode = '' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [join, { isLoading }] = useJoinSquadMutation();
  const [code, setCode] = useState(initialCode);
  const submit = async () => {
    const res = await join(code);
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    dispatch(notify('Berhasil gabung squad', 'success'));
    onClose();
    navigate(`/squads/${res.data}`);
  };
  return (
    <Sheet title="Gabung squad" onClose={onClose} footer={<button type="button" className="k-btn primary block" disabled={code.replace(/\W/g, '').length < 7 || isLoading} onClick={submit}>{isLoading ? 'Bergabung…' : 'Gabung'}</button>}>
      <span className="k-label">Kode undangan</span>
      <input autoFocus className="k-code-input" placeholder="KLG-7Q2M" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
      <p className="k-muted" style={{ fontSize: '.8rem' }}>Minta kodenya ke pemilik squad (berlaku 7 hari).</p>
    </Sheet>
  );
}

export default function SquadsPage() {
  const uid = useSelector(selectUser).uid;
  const { data: squads } = useGetMySquadsQuery();
  const [sheet, setSheet] = useState(null);
  return (
    <div className="page k-page">
      <Hero>
        <h1>Squad</h1>
        <p>Kelola keuangan bareng keluarga, pasangan, teman kos, atau tim</p>
      </Hero>
      <Section title="Squad kamu">
        {squads == null && <div className="k-empty">Memuat…</div>}
        {squads?.length === 0 && <div className="k-empty"><span className="k-emoji">👥</span>Belum ada squad. Buat satu, lalu undang anggota dengan kode.</div>}
        <div style={{ display: 'grid', gap: 10 }}>
          {squads?.map((s) => <SquadCard key={s.id} squad={s} uid={uid} />)}
        </div>
        <button type="button" className="k-ghost" onClick={() => setSheet('create')}>＋ Buat squad baru</button>
        <button type="button" className="k-ghost plain" onClick={() => setSheet('join')}>🔑 Gabung dengan kode undangan</button>
      </Section>
      <p className="k-muted k-pad" style={{ fontSize: '.78rem', marginTop: 16 }}>
        Privasi: hanya transaksi yang kamu pilih &quot;Catat ke&quot; squad yang terlihat anggota lain. Notifikasi &amp; inbox tidak pernah dibagikan.
      </p>
      {sheet === 'create' && <CreateSheet onClose={() => setSheet(null)} />}
      {sheet === 'join' && <JoinSheet onClose={() => setSheet(null)} />}
    </div>
  );
}
