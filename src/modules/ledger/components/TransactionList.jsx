import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatIDR } from '../../../platform/format.js';
import { useDeleteTransactionMutation } from '../api/transactionsApi.js';
import { notify, postDraftSet } from '../../../platform/ui/uiSlice.js';
import { confirmAction } from '../../../platform/env.js';
import TransactionForm from './TransactionForm.jsx';
import { EmptyState, Modal } from '../../../platform/ui/ui.jsx';

export default function TransactionList({ items, editable = true, emptyText = 'Belum ada transaksi' }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null);
  const [remove] = useDeleteTransactionMutation();

  if (!items?.length) return <EmptyState title={emptyText} />;

  const onDelete = async (t) => {
    if (!confirmAction('Hapus transaksi ini?')) return;
    const res = await remove(t.id);
    dispatch(notify(res.error ? res.error.message : 'Transaksi dihapus', res.error ? 'error' : 'success'));
  };

  const share = (t) => {
    dispatch(
      postDraftSet({
        text: `${t.type === 'income' ? 'Dapat' : 'Habis'} ${formatIDR(t.amount)} untuk ${t.category}${t.place ? ` di ${t.place}` : ''}. ${t.note || ''}`.trim(),
        amount: t.amount,
        category: t.category,
      }),
    );
    navigate('/feed');
  };

  return (
    <>
      <ul className="tx-list">
        {items.map((t) => (
          <li key={t.id} className="tx-item">
            <div className={`tx-icon ${t.type}`}>{t.type === 'income' ? '↓' : '↑'}</div>
            <div className="tx-main">
              <div className="tx-title">
                {t.category}
                {t.place && <span className="tx-place"> · 📍 {t.place}</span>}
              </div>
              <div className="tx-meta muted">
                {formatDate(t.date)}
                {t.paymentMethod && ` · ${t.paymentMethod}`}
                {t.note && ` · ${t.note}`}
              </div>
            </div>
            <div className={`tx-amount ${t.type}`}>
              {t.type === 'income' ? '+' : '-'}
              {formatIDR(t.amount)}
            </div>
            {editable && (
              <div className="tx-actions">
                <button className="icon-btn" title="Bagikan ke feed" onClick={() => share(t)}>
                  📣
                </button>
                <button className="icon-btn" title="Edit" onClick={() => setEditing(t)}>
                  ✏️
                </button>
                <button className="icon-btn" title="Hapus" onClick={() => onDelete(t)}>
                  🗑️
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <Modal title="Edit transaksi" onClose={() => setEditing(null)}>
          <TransactionForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
