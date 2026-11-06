import { useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { draftFromInbox, useConfirmInboxMutation, useGetInboxQuery, useResolveInboxMutation } from '../services/inboxApi.js';
import { findTransferPairs } from '../utils/notifParser.js';
import { notify } from '../features/ui/uiSlice.js';
import { formatIDR, timeAgo } from '../utils/format.js';
import { EmptyState, ErrorBox, Modal, PageHeader, Spinner } from '../components/ui.jsx';
import TransactionForm from '../components/TransactionForm.jsx';
import AppBadge from '../components/AppBadge.jsx';
import DeviceSources from '../components/DeviceSources.jsx';

function Amount({ parsed }) {
  if (!parsed.amount) return <strong className="muted">Nominal ?</strong>;
  const income = parsed.type === 'income';
  return (
    <strong className={`review-amount ${income ? 'good' : parsed.type ? 'bad' : ''}`}>
      {parsed.type ? (income ? '+' : '−') : ''}
      {formatIDR(parsed.amount)}
    </strong>
  );
}

function ReviewCard({ item, onEdit, onSave, onIgnore, busy }) {
  const { parsed } = item;
  const ready = parsed.amount && parsed.type;
  return (
    <article className={`card review-card ${parsed.confidence === 'high' ? 'sure' : ''}`}>
      <header className="review-head">
        <AppBadge name={item.appName} />
        <div className="grow">
          <strong>{item.appName}</strong>
          <div className="muted small">{timeAgo(item.postedAt)}</div>
        </div>
        <Amount parsed={parsed} />
      </header>
      <div className="review-meta">
        {parsed.place && <span className="tag">📍 {parsed.place}</span>}
        {parsed.type && <span className="tag">{parsed.category}</span>}
        {parsed.confidence === 'low' && <span className="tag tag-warn">Perlu dicek</span>}
      </div>
      <p className="review-raw">{[item.title, item.text].filter(Boolean).join(' · ')}</p>
      <footer className="review-actions">
        <button className="btn btn-ghost" disabled={busy} onClick={() => onIgnore([item.id])}>
          Abaikan
        </button>
        <button className="btn btn-ghost" disabled={busy} onClick={() => onEdit(item)}>
          Ubah
        </button>
        {ready && (
          <button className="btn btn-primary" disabled={busy} onClick={() => onSave([item])}>
            Simpan
          </button>
        )}
      </footer>
    </article>
  );
}

function TransferCard({ out, inc, onTransfer, onSeparate, busy }) {
  return (
    <article className="card review-card transfer-card">
      <div className="transfer-flow">
        <span className="transfer-end">
          <AppBadge name={out.appName} />
          <small>{out.appName}</small>
        </span>
        <span className="transfer-arrow">
          <strong>{formatIDR(out.parsed.amount)}</strong>
          <span>⟶</span>
        </span>
        <span className="transfer-end">
          <AppBadge name={inc.appName} />
          <small>{inc.appName}</small>
        </span>
      </div>
      <p className="center">
        <strong>Pindah dana antar akunmu?</strong>
        <br />
        <span className="muted small">Kalau iya, ini bukan pengeluaran dan tidak akan dicatat. {timeAgo(out.postedAt)}</span>
      </p>
      <footer className="review-actions">
        <button className="btn btn-ghost" disabled={busy} onClick={onSeparate}>
          Bukan, catat terpisah
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={onTransfer}>
          Ya, pindah dana
        </button>
      </footer>
    </article>
  );
}

export default function ReviewPage() {
  const dispatch = useDispatch();
  const { data = [], isLoading, error } = useGetInboxQuery();
  const [resolve, resolveState] = useResolveInboxMutation();
  const [confirm, confirmState] = useConfirmInboxMutation();
  const [editing, setEditing] = useState(null);
  const [separated, setSeparated] = useState(() => new Set());
  const [showPromos, setShowPromos] = useState(false);
  const [tab, setTab] = useState('review');
  const busy = resolveState.isLoading || confirmState.isLoading;

  const { transfers, items, promos, sure } = useMemo(() => {
    const pairs = findTransferPairs(data.filter((i) => !separated.has(i.id)));
    const seen = new Set();
    const transfers = [];
    for (const item of data) {
      const partnerId = pairs.get(item.id);
      if (!partnerId || seen.has(item.id)) continue;
      const partner = data.find((x) => x.id === partnerId);
      seen.add(item.id).add(partnerId);
      transfers.push(item.parsed.type === 'expense' ? [item, partner] : [partner, item]);
    }
    const rest = data.filter((i) => !seen.has(i.id));
    const items = rest.filter((i) => !i.parsed.isPromo);
    return { transfers, items, promos: rest.filter((i) => i.parsed.isPromo), sure: items.filter((i) => i.parsed.confidence === 'high') };
  }, [data, separated]);

  const save = async (list) => {
    const res = await confirm(list.map((i) => ({ id: i.id, tx: draftFromInbox(i) })));
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    dispatch(notify(list.length > 1 ? `${list.length} transaksi disimpan` : 'Transaksi disimpan', 'success'));
  };
  const ignore = async (ids, message) => {
    const res = await resolve(ids);
    if (res.error) return dispatch(notify(res.error.message, 'error'));
    if (message) dispatch(notify(message, 'success'));
  };

  return (
    <div className="page review">
      <PageHeader title="Catat otomatis" subtitle="Transaksi dari notifikasi bank & e-wallet di HP-mu">
        {tab === 'review' && sure.length > 1 && (
          <button className="btn btn-primary" disabled={busy} onClick={() => save(sure)}>
            ✓ Simpan {sure.length} yang yakin
          </button>
        )}
      </PageHeader>
      <div className="segmented review-tabs">
        <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')}>
          Perlu ditinjau{data.length ? ` (${data.length})` : ''}
        </button>
        <button className={tab === 'sources' ? 'active' : ''} onClick={() => setTab('sources')}>
          Aplikasi dipantau
        </button>
      </div>
      {tab === 'sources' ? (
        <DeviceSources />
      ) : (
        <>
          <ErrorBox error={error} />
          {isLoading ? (
            <Spinner />
          ) : !data.length ? (
            <EmptyState icon="📲" title="Semua sudah ditinjau">
              Pasang aplikasi <strong>Catatanku Auto</strong> di HP Android-mu. Notifikasi transaksi dari bank & e-wallet akan
              muncul di sini untuk dikonfirmasi.
            </EmptyState>
          ) : (
            <>
              {transfers.map(([out, inc]) => (
                <TransferCard
                  key={out.id}
                  out={out}
                  inc={inc}
                  busy={busy}
                  onTransfer={() => ignore([out.id, inc.id], 'Ditandai sebagai pindah dana')}
                  onSeparate={() => setSeparated((s) => new Set([...s, out.id, inc.id]))}
                />
              ))}
              <div className="review-grid">
                {items.map((item) => (
                  <ReviewCard key={item.id} item={item} busy={busy} onEdit={setEditing} onSave={save} onIgnore={ignore} />
                ))}
              </div>
              {promos.length > 0 && (
                <section className="promo-section">
                  <div className="inline">
                    <button className="link-btn grow left" onClick={() => setShowPromos((s) => !s)}>
                      {showPromos ? '▾' : '▸'} Kemungkinan promo / bukan transaksi ({promos.length})
                    </button>
                    <button className="btn btn-ghost" disabled={busy} onClick={() => ignore(promos.map((p) => p.id), 'Promo diabaikan')}>
                      Abaikan semua
                    </button>
                  </div>
                  {showPromos && (
                    <div className="review-grid">
                      {promos.map((item) => (
                        <ReviewCard key={item.id} item={item} busy={busy} onEdit={setEditing} onSave={save} onIgnore={ignore} />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
      {editing && (
        <Modal title={`Dari ${editing.appName}`} onClose={() => setEditing(null)}>
          <p className="review-raw">{[editing.title, editing.text].filter(Boolean).join(' · ')}</p>
          <TransactionForm
            initial={draftFromInbox(editing)}
            onDone={() => {
              ignore([editing.id]);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
