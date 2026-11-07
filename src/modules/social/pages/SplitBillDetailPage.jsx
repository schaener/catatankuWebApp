import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteSplitBillMutation, useGetSplitBillQuery, useTogglePaidMutation } from '../api/splitBillsApi.js';
import { useStartChatMutation } from '../api/chatApi.js';
import { selectUser } from '../../../platform/auth/authSlice.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { formatDate, formatIDR } from '../../../platform/format.js';
import { confirmAction } from '../../../platform/env.js';
import { ErrorBox, PageHeader, Spinner, StatCard } from '../../../platform/ui/ui.jsx';

export default function SplitBillDetailPage() {
  const { id } = useParams();
  const me = useSelector(selectUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { data: b, isLoading, error } = useGetSplitBillQuery(id);
  const [togglePaid] = useTogglePaidMutation();
  const [remove] = useDeleteSplitBillMutation();
  const [startChat, { isLoading: opening }] = useStartChatMutation();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const isOwner = b.ownerId === me.uid;
  const paidAmount = b.participants.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const linkedUsers = b.participants.filter((p) => p.uid && p.uid !== me.uid);

  const summaryText = [
    `🧾 ${b.title}${b.place ? ` @ ${b.place}` : ''} (${formatDate(b.date)})`,
    `Total: ${formatIDR(b.total)}`,
    ...b.participants.map((p) => `- ${p.name}: ${formatIDR(p.amount)} ${p.paid ? '✅' : '⏳'}`),
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      dispatch(notify('Ringkasan disalin, tinggal tempel di WhatsApp', 'success'));
    } catch {
      dispatch(notify('Browser menolak akses clipboard', 'error'));
    }
  };

  const openChat = async () => {
    const res = await startChat({
      users: linkedUsers.map((p) => ({ uid: p.uid, displayName: p.name })),
      name: `🧾 ${b.title}`,
    });
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    navigate(`/chat/${res.data.id}`);
  };

  const onDelete = async () => {
    if (!confirmAction('Hapus split bill ini?')) return;
    await remove(id);
    navigate('/split');
  };

  return (
    <div className="page">
      <PageHeader title={b.title} subtitle={`${formatDate(b.date)}${b.place ? ` · ${b.place}` : ''} · dibuat oleh ${isOwner ? 'kamu' : b.ownerName}`}>
        <Link to="/split" className="btn btn-ghost">
          ← Kembali
        </Link>
        <button className="btn btn-ghost" onClick={copy}>
          📋 Salin
        </button>
        {linkedUsers.length > 0 && (
          <button className="btn btn-ghost" onClick={openChat} disabled={opening}>
            💬 Chat
          </button>
        )}
        {isOwner && (
          <button className="btn btn-danger" onClick={onDelete}>
            Hapus
          </button>
        )}
      </PageHeader>
      <section className="stats-grid three">
        <StatCard label="Total" value={formatIDR(b.total)} sub={`subtotal ${formatIDR(b.subtotal)} · pajak ${b.taxPercent}% · service ${b.servicePercent}%`} />
        <StatCard label="Sudah dibayar" value={formatIDR(paidAmount)} tone="good" />
        <StatCard label="Sisa" value={formatIDR(b.total - paidAmount)} tone="bad" />
      </section>
      <div className="card">
        <h3>Peserta</h3>
        <ul className="participants">
          {b.participants.map((p) => {
            const canToggle = isOwner || p.uid === me.uid;
            return (
              <li key={p.id} className={p.paid ? 'paid' : ''}>
                <span className="grow">
                  {p.name}
                  {p.uid === me.uid && <small className="muted"> (kamu)</small>}
                  {!p.uid && <small className="muted"> (tamu)</small>}
                </span>
                <strong>{formatIDR(p.amount)}</strong>
                <button
                  className={`btn ${p.paid ? 'btn-success' : 'btn-ghost'}`}
                  disabled={!canToggle}
                  onClick={() => togglePaid({ billId: id, participantId: p.id })}
                >
                  {p.paid ? '✓ Lunas' : 'Tandai lunas'}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {b.items?.length > 0 && (
        <div className="card">
          <h3>Item</h3>
          <table className="table">
            <tbody>
              {b.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.name || 'Item'}</td>
                  <td className="muted small">x{it.qty}</td>
                  <td className="muted small">
                    {it.assignedTo.map((pid) => b.participants.find((p) => p.id === pid)?.name.split(' ')[0]).filter(Boolean).join(', ')}
                  </td>
                  <td className="num">{formatIDR(it.price * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
