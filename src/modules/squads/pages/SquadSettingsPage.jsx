import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { AppAvatar, Chip, Hero, Section, Switch, Tag } from '../../../platform/ui/kit.jsx';
import { Avatar } from '../../../platform/ui/ui.jsx';
import { confirmAction } from '../../../platform/env.js';
import { native } from '../../../platform/native.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { useAccounts } from '../../ledger/index.js';
import {
  useDeleteSquadMutation, useGetMySquadsQuery, useGetShareRulesQuery, useRemoveMemberMutation, useRenameSquadMutation,
  useRotateInviteMutation, useSetShareRuleMutation,
} from '../api/squadsApi.js';

const EMOJIS = ['🏠', '💑', '🏢', '👨‍👩‍👧', '✈️', '🎓', '⚽', '💼', '🍜', '👥'];

export default function SquadSettingsPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const { data: squads } = useGetMySquadsQuery();
  const squad = squads?.find((s) => s.id === id);
  const { data: rules = {} } = useGetShareRulesQuery();
  const accounts = useAccounts().filter((a) => a.pkg !== 'cash');
  const [setRule] = useSetShareRuleMutation();
  const [rotate] = useRotateInviteMutation();
  const [removeMember] = useRemoveMemberMutation();
  const [deleteSquad] = useDeleteSquadMutation();
  const [rename] = useRenameSquadMutation();
  const [name, setName] = useState(null);

  if (!squad) return <div className="page k-page"><Hero><h1>{squads ? 'Squad tidak ditemukan' : 'Memuat…'}</h1></Hero></div>;
  const owner = squad.ownerId === user.uid;
  const link = `${window.location.origin}/join/${squad.inviteCode}`;
  const done = (res, ok) => dispatch(notify(res.error ? res.error.message : ok, res.error ? 'error' : 'success'));

  const copy = async () => {
    await navigator.clipboard?.writeText(link);
    dispatch(notify('Link undangan disalin', 'success'));
  };
  const shareWa = () => {
    const text = `Gabung squad "${squad.name}" di Catatanku: ${link} (kode ${squad.inviteCode})`;
    if (!native.share(text)) window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const leave = async () => {
    if (!confirmAction(owner ? `Hapus squad "${squad.name}"? Semua transaksi bersama dihapus dari squad (transaksi pribadi tetap ada).` : `Keluar dari "${squad.name}"? Transaksimu di squad ini kembali jadi pribadi.`)) return;
    const res = owner ? await deleteSquad({ squadId: id, inviteCode: squad.inviteCode }) : await removeMember({ squadId: id, uid: user.uid });
    done(res, owner ? 'Squad dihapus' : 'Kamu keluar dari squad');
    if (!res.error) navigate('/squads');
  };

  return (
    <div className="page k-page">
      <Hero>
        <div className="k-hero-row">
          <button type="button" className="k-round-btn" aria-label="Kembali" onClick={() => navigate(`/squads/${id}`)}>←</button>
          <div className="grow"><h1>Pengaturan squad</h1><p>{squad.emoji} {squad.name}</p></div>
        </div>
      </Hero>

      <Section title="Undang anggota">
        <div className="k-card">
          <p className="k-muted" style={{ margin: 0, fontSize: '.82rem' }}>Bagikan kode atau link ini. Berlaku 7 hari.</p>
          <div className="k-invite-code">{squad.inviteCode}</div>
          <div className="k-field-row">
            <button type="button" className="k-btn block" onClick={copy}>Salin link</button>
            <button type="button" className="k-btn primary block" onClick={shareWa}>Bagikan ke WA</button>
          </div>
          {owner && <button type="button" className="k-link" style={{ marginTop: 8 }} onClick={async () => done(await rotate({ squadId: id, oldCode: squad.inviteCode }), 'Kode baru dibuat')}>↻ Buat kode baru (kode lama tidak berlaku)</button>}
        </div>
      </Section>

      <Section title={`Anggota (${squad.memberUids.length})`}>
        <div className="k-card flush">
          {squad.memberUids.map((uid) => {
            const m = squad.members?.[uid] ?? { name: 'Anggota' };
            return (
              <div key={uid} className="k-row" style={{ cursor: 'default' }}>
                <Avatar name={m.name} src={m.photo} size={34} />
                <div className="k-main"><div className="k-title">{m.name}{uid === user.uid ? ' (kamu)' : ''}</div></div>
                {uid === squad.ownerId ? <Tag tone="good">Pemilik</Tag> : <Tag>Anggota</Tag>}
                {owner && uid !== user.uid && (
                  <button type="button" className="k-btn danger" onClick={async () => confirmAction(`Keluarkan ${m.name}?`) && done(await removeMember({ squadId: id, uid }), `${m.name} dikeluarkan`)}>Keluarkan</button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Bagikan otomatis dari akunku">
        <div className="k-card flush">
          {accounts.length === 0 && <div className="k-empty">Belum ada aplikasi sumber. Pilih di tab Sumber.</div>}
          {accounts.map((a) => {
            const on = rules[a.pkg] === id;
            const elsewhere = rules[a.pkg] && rules[a.pkg] !== id ? squads.find((s) => s.id === rules[a.pkg]) : null;
            return (
              <div key={a.pkg} className="k-row" style={{ cursor: 'default' }}>
                <AppAvatar app={a} size={36} />
                <div className="k-main">
                  <div className="k-title">{a.name}</div>
                  <div className="k-meta">{on ? 'semua transaksi masuk squad ini' : elsewhere ? `otomatis ke ${elsewhere.emoji} ${elsewhere.name}` : 'pilih per transaksi'}</div>
                </div>
                <Switch checked={on} label={`Bagikan ${a.name}`} onChange={(v) => setRule({ appPackage: a.pkg, squadId: v ? id : null })} />
              </div>
            );
          })}
        </div>
        <p className="k-muted" style={{ fontSize: '.75rem', margin: '8px 2px 0' }}>Jadi pilihan awal &quot;Catat ke&quot; saat meninjau; tetap bisa diubah per transaksi.</p>
      </Section>

      {owner && (
        <Section title="Nama & ikon">
          <div className="k-card">
            <input value={name ?? squad.name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <div className="k-choices" style={{ marginTop: 10 }}>
              {EMOJIS.map((e) => <Chip key={e} active={e === squad.emoji} onClick={async () => done(await rename({ squadId: id, name: name ?? squad.name, emoji: e }), 'Disimpan')}>{e}</Chip>)}
            </div>
            {name != null && name.trim() && name !== squad.name && (
              <button type="button" className="k-btn primary block" style={{ marginTop: 10 }} onClick={async () => { done(await rename({ squadId: id, name, emoji: squad.emoji }), 'Nama disimpan'); setName(null); }}>Simpan nama</button>
            )}
          </div>
        </Section>
      )}

      <div className="k-pad" style={{ marginTop: 22 }}>
        <button type="button" className="k-btn danger block" onClick={leave}>{owner ? 'Hapus squad' : 'Keluar dari squad'}</button>
        <p className="k-muted" style={{ fontSize: '.75rem', textAlign: 'center' }}>
          <Link to={`/squads/${id}`}>Kembali ke ringkasan</Link>
        </p>
      </div>
    </div>
  );
}
