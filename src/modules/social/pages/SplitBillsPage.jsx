import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { nanoid } from '@reduxjs/toolkit';
import { useCreateSplitBillMutation, useGetSplitBillsQuery } from '../api/splitBillsApi.js';
import { computeSplit, useAddTransactionMutation } from '../../ledger/index.js';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { formatDate, formatIDR } from '../../../platform/format.js';
import { parseDateStr, todayStr } from '../../../platform/date.js';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner } from '../../../platform/ui/ui.jsx';
import UserPicker from '../components/UserPicker.jsx';

function CreateSplitBill({ onDone }) {
  const me = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [create, { isLoading }] = useCreateSplitBillMutation();
  const [addTx] = useAddTransactionMutation();

  const [form, setForm] = useState({
    title: '',
    place: '',
    date: todayStr(),
    mode: 'equal',
    subtotal: '',
    taxPercent: 0,
    servicePercent: 0,
    recordMyShare: true,
  });
  const [participants, setParticipants] = useState([
    { id: me.uid, uid: me.uid, name: me.displayName, custom: '' },
  ]);
  const [items, setItems] = useState([]);
  const [guest, setGuest] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const toggleUser = (u) =>
    setParticipants((ps) =>
      ps.some((p) => p.uid === u.uid)
        ? ps.filter((p) => p.uid !== u.uid)
        : [...ps, { id: u.uid, uid: u.uid, name: u.displayName, custom: '' }],
    );
  const addGuest = () => {
    if (!guest.trim()) return;
    setParticipants((ps) => [...ps, { id: nanoid(8), uid: null, name: guest.trim(), custom: '' }]);
    setGuest('');
  };
  const updateItem = (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const result = useMemo(
    () => computeSplit({ ...form, participants, items }),
    [form, participants, items],
  );

  const submit = async (e) => {
    e.preventDefault();
    if (participants.length < 2) return dispatch(notify('Minimal 2 peserta', 'error'));
    if (!(result.total > 0)) return dispatch(notify('Total tagihan masih 0', 'error'));
    const date = parseDateStr(form.date).getTime();
    const bill = {
      title: form.title.trim() || 'Split bill',
      place: form.place.trim(),
      date,
      mode: form.mode,
      taxPercent: Number(form.taxPercent) || 0,
      servicePercent: Number(form.servicePercent) || 0,
      subtotal: result.subtotal,
      total: result.total,
      items: form.mode === 'items' ? items.map(({ id, name, price, qty, assignedTo }) => ({ id, name, price: Number(price) || 0, qty: Number(qty) || 1, assignedTo })) : [],
      participants: participants.map((p, i) => ({
        id: p.id,
        uid: p.uid,
        name: p.name,
        amount: result.shares[i],
        paid: p.uid === me.uid, // the creator paid the bill
      })),
    };
    const res = await create(bill);
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    const myShare = result.shares[participants.findIndex((p) => p.uid === me.uid)];
    if (form.recordMyShare && myShare > 0) {
      await addTx({
        type: 'expense',
        amount: myShare,
        category: 'Split Bill',
        place: bill.place || bill.title,
        paymentMethod: 'Tunai',
        note: `Bagian saya: ${bill.title}`,
        date,
        splitBillId: res.data.id,
      });
    }
    dispatch(notify('Split bill dibuat', 'success'));
    onDone();
    navigate(`/split/${res.data.id}`);
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="grid-2">
        <label>
          Judul
          <input value={form.title} onChange={set('title')} placeholder="mis. Makan malam tim" required />
        </label>
        <label>
          Tempat
          <input value={form.place} onChange={set('place')} placeholder="mis. Sate Senayan" />
        </label>
      </div>
      <div className="grid-2">
        <label>
          Tanggal
          <input type="date" value={form.date} onChange={set('date')} />
        </label>
        <label>
          Cara bagi
          <select value={form.mode} onChange={set('mode')}>
            <option value="equal">Bagi rata</option>
            <option value="items">Per item</option>
            <option value="custom">Nominal manual</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Peserta ({participants.length})</legend>
        <div className="chips">
          {participants.map((p) => (
            <span key={p.id} className="chip chip-active">
              {p.name}
              {p.uid !== me.uid && (
                <button type="button" className="chip-x" onClick={() => setParticipants((ps) => ps.filter((x) => x.id !== p.id))}>
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        <details>
          <summary>Tambah dari pengguna terdaftar</summary>
          <UserPicker selected={participants.filter((p) => p.uid && p.uid !== me.uid)} onToggle={toggleUser} />
        </details>
        <div className="inline">
          <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Atau tambah nama teman (tamu)" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGuest())} />
          <button type="button" className="btn btn-ghost" onClick={addGuest}>
            Tambah
          </button>
        </div>
      </fieldset>

      {form.mode === 'equal' && (
        <label>
          Subtotal (Rp)
          <input type="number" min="0" value={form.subtotal} onChange={set('subtotal')} required />
        </label>
      )}

      {form.mode === 'custom' && (
        <fieldset>
          <legend>Nominal per orang (sebelum pajak)</legend>
          {participants.map((p) => (
            <label key={p.id} className="inline">
              <span className="grow">{p.name}</span>
              <input
                type="number"
                min="0"
                value={p.custom}
                onChange={(e) => setParticipants((ps) => ps.map((x) => (x.id === p.id ? { ...x, custom: e.target.value } : x)))}
              />
            </label>
          ))}
        </fieldset>
      )}

      {form.mode === 'items' && (
        <fieldset>
          <legend>Item</legend>
          {items.map((it) => (
            <div key={it.id} className="item-row">
              <div className="inline">
                <input className="grow" placeholder="Nama item" value={it.name} onChange={(e) => updateItem(it.id, { name: e.target.value })} />
                <input type="number" min="0" placeholder="Harga" value={it.price} onChange={(e) => updateItem(it.id, { price: e.target.value })} />
                <input type="number" min="1" className="qty" value={it.qty} onChange={(e) => updateItem(it.id, { qty: e.target.value })} />
                <button type="button" className="icon-btn" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
                  ✕
                </button>
              </div>
              <div className="chips">
                {participants.map((p) => {
                  const on = it.assignedTo.includes(p.id);
                  return (
                    <button
                      type="button"
                      key={p.id}
                      className={`chip ${on ? 'chip-active' : ''}`}
                      onClick={() => updateItem(it.id, { assignedTo: on ? it.assignedTo.filter((x) => x !== p.id) : [...it.assignedTo, p.id] })}
                    >
                      {p.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => setItems((xs) => [...xs, { id: nanoid(6), name: '', price: '', qty: 1, assignedTo: participants.map((p) => p.id) }])}>
            + Item
          </button>
          {result.unassigned > 0 && <p className="bad small">{formatIDR(result.unassigned)} belum ditugaskan ke siapa pun.</p>}
        </fieldset>
      )}

      <div className="grid-2">
        <label>
          Pajak (%)
          <input type="number" min="0" step="0.5" value={form.taxPercent} onChange={set('taxPercent')} />
        </label>
        <label>
          Service (%)
          <input type="number" min="0" step="0.5" value={form.servicePercent} onChange={set('servicePercent')} />
        </label>
      </div>

      <div className="split-preview">
        {participants.map((p, i) => (
          <div key={p.id}>
            <span>{p.name}</span>
            <strong>{formatIDR(result.shares[i])}</strong>
          </div>
        ))}
        <div className="split-total">
          <span>Total</span>
          <strong>{formatIDR(result.total)}</strong>
        </div>
      </div>

      <label className="checkbox">
        <input type="checkbox" checked={form.recordMyShare} onChange={set('recordMyShare')} />
        Catat bagian saya sebagai pengeluaran
      </label>
      <button className="btn btn-primary" disabled={isLoading}>
        {isLoading ? 'Menyimpan...' : 'Simpan split bill'}
      </button>
    </form>
  );
}

export default function SplitBillsPage() {
  const me = useSelector(selectUser);
  const [creating, setCreating] = useState(false);
  const { data = [], isLoading, error } = useGetSplitBillsQuery();

  return (
    <div className="page">
      <PageHeader title="Split Bill" subtitle="Bagi tagihan dengan teman & pantau siapa yang sudah bayar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Split bill
        </button>
      </PageHeader>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data.length ? (
        <EmptyState icon="🧾" title="Belum ada split bill">
          Buat split bill setelah makan bareng atau patungan.
        </EmptyState>
      ) : (
        <div className="cards-grid">
          {data.map((b) => {
            const paid = b.participants.filter((p) => p.paid).length;
            const mine = b.participants.find((p) => p.uid === me.uid);
            return (
              <Link key={b.id} to={`/split/${b.id}`} className="card bill-card">
                <div className="card-head">
                  <h3>{b.title}</h3>
                  <strong>{formatIDR(b.total)}</strong>
                </div>
                <p className="muted small">
                  {formatDate(b.date)} · {b.place || 'tanpa tempat'} · oleh {b.ownerId === me.uid ? 'kamu' : b.ownerName}
                </p>
                <div className="progress">
                  <div style={{ width: `${(paid / b.participants.length) * 100}%` }} />
                </div>
                <p className="small">
                  {paid}/{b.participants.length} lunas
                  {mine && b.ownerId !== me.uid && (
                    <span className={mine.paid ? 'good' : 'bad'}> · bagianmu {formatIDR(mine.amount)} {mine.paid ? '✓' : '(belum)'}</span>
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      {creating && (
        <Modal title="Split bill baru" onClose={() => setCreating(false)} wide>
          <CreateSplitBill onDone={() => setCreating(false)} />
        </Modal>
      )}
    </div>
  );
}
