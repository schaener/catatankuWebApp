import { collection, deleteField, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser } from '../../../platform/api.js';
import { notify } from '../../../platform/ui/uiSlice.js';
import { paymentMethodFor } from '../../capture/domain.js';
import { inboxCol } from './paths.js';
import { txCol } from './transactionsApi.js';
import { transfersCol } from './transfersApi.js';
import { OTHER, SOURCE } from '../logic/entries.js';

/**
 * Write side of the ledger (command half of CQRS; reads are the live streams).
 *
 * Every command is ONE atomic batch, fired without awaiting the server: Firestore applies it to the
 * local cache instantly (all listeners update in the same frame, online or offline) and syncs later.
 * Failures surface as a toast. Squad sharing is fan-out-on-write: the owner writes a read-model copy
 * to squads/{id}/entries/{txId} in the same batch, so the copy can never drift from the transaction.
 */
const squadEntry = (squadId, id) => doc(db, 'squads', squadId, 'entries', id);
const colFor = (uid, store) => (store === 'transfer' ? transfersCol(uid) : store === 'inbox' ? inboxCol(uid) : txCol(uid));

function txData(e) {
  return {
    // fields every web page reads (same shape as cleanTx)
    type: e.kind === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(e.amount) || 0),
    category: e.category || OTHER,
    place: (e.place || '').trim(),
    paymentMethod: paymentMethodFor(e.app),
    note: (e.note || '').trim(),
    date: Number(e.date) || Date.now(),
    // ledger fields
    source: e.origin === SOURCE.NOTIFICATION ? SOURCE.NOTIFICATION : SOURCE.APP,
    appPackage: e.app.pkg,
    appName: e.app.name,
    movedFromPackage: e.movedFrom?.pkg ?? null,
    movedFromName: e.movedFrom?.name ?? null,
    raw: e.raw[0] ?? null,
    squadId: e.squadId || null,
    updatedAt: serverTimestamp(),
  };
}

function transferData(e) {
  return {
    amount: Math.round(Number(e.amount) || 0),
    fromPackage: e.app.pkg,
    fromName: e.app.name,
    toPackage: e.toApp?.pkg ?? null,
    toName: e.toApp?.name ?? null,
    note: (e.note || '').trim(),
    date: Number(e.date) || Date.now(),
    source: e.origin === SOURCE.NOTIFICATION ? SOURCE.NOTIFICATION : SOURCE.APP,
    raw: e.raw,
    squadId: deleteField(),
    updatedAt: serverTimestamp(),
  };
}

function shareData(e, user, id) {
  return {
    txId: id,
    ownerUid: user.uid,
    ownerName: user.displayName || '',
    ownerPhoto: user.photoURL || null,
    type: e.kind === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(e.amount) || 0),
    category: e.category || OTHER,
    place: (e.place || '').trim(),
    appPackage: e.app.pkg,
    appName: e.app.name,
    note: (e.note || '').trim(),
    date: Number(e.date) || Date.now(),
    updatedAt: serverTimestamp(),
  };
}

/** Removes an entry's current documents (inbox notifications, or its tx/transfer + squad copy). */
function remove(batch, uid, e, keepId = null) {
  if (e.store === 'inbox') e.raw.forEach((r) => batch.delete(doc(inboxCol(uid), r.id)));
  else if (e.store !== 'draft' && e.id && e.id !== keepId) batch.delete(doc(colFor(uid, e.store), e.id));
  if (e.sharedTo && (e.id !== keepId || e.kind === 'transfer')) batch.delete(squadEntry(e.sharedTo, e.id));
}

/** Create or update; moves between collections when the kind changes (e.g. expense -> transfer). */
function save(batch, user, e) {
  const target = e.kind === 'transfer' ? 'transfer' : 'tx';
  // Confirmed notifications reuse the inbox id, so confirming on two devices can't duplicate.
  const id = (e.store === target && e.id) || e.raw[0]?.id || doc(colFor(user.uid, target)).id;
  remove(batch, user.uid, e, e.store === target ? id : null);
  batch.set(doc(colFor(user.uid, target), id), target === 'transfer' ? transferData(e) : txData(e), { merge: true });
  if (target === 'tx') {
    if (e.sharedTo && e.sharedTo !== e.squadId) batch.delete(squadEntry(e.sharedTo, id));
    if (e.squadId) batch.set(squadEntry(e.squadId, id), shareData(e, user, id));
  }
}

function command(message, build) {
  return (dispatch, getState) => {
    const user = currentUser(getState);
    const batch = writeBatch(db);
    build(batch, user);
    batch.commit().catch((err) => dispatch(notify(err.message || 'Gagal menyimpan', 'error')));
    // pages that fetch by date range (Transaksi, Cari, Laporan tersimpan) refetch
    dispatch(api.util.invalidateTags([{ type: 'Transaction', id: 'LIST' }]));
    if (message) dispatch(notify(message, 'success'));
  };
}

export const saveEntries = (entries, message = entries.length > 1 ? `${entries.length} transaksi disimpan` : 'Tersimpan') =>
  command(message, (b, user) => entries.forEach((e) => save(b, user, e)));

export const ignoreEntries = (entries, message = 'Diabaikan') => command(message, (b, user) => entries.forEach((e) => remove(b, user.uid, e)));

export const deleteEntry = (e) => command('Dihapus', (b, user) => remove(b, user.uid, e));

/** Undo a review: original notification(s) back to the inbox, saved record (and squad copy) removed. */
export const returnToReview = (e) =>
  command('Dikembalikan ke Tinjau', (b, user) => {
    e.raw.forEach((r) => {
      const { id, ...data } = r;
      b.set(doc(inboxCol(user.uid), id), { ...data, capturedBy: 'android' });
    });
    remove(b, user.uid, e);
  });

/** Two pending notifications are one transfer between own accounts. */
export const markTransfer = ([out, inc]) =>
  saveEntries([{ ...out, kind: 'transfer', toApp: inc.app, raw: [...out.raw, ...inc.raw], place: '', category: OTHER, squadId: null }], 'Dicatat sebagai pindah dana');

/** Re-assign to another account. Pending items just remember the override until reviewed. */
export const moveEntry = (e, app) =>
  command(`Dipindah ke ${app.name}`, (b, user) => {
    if (e.store === 'inbox') {
      b.update(doc(inboxCol(user.uid), e.id), { overridePackage: app.pkg, overrideName: app.name });
      return;
    }
    const origin = e.raw[0] && { pkg: e.raw[0].packageName, name: e.raw[0].appName };
    save(b, user, { ...e, app, movedFrom: origin && origin.pkg !== app.pkg ? origin : null });
  });

/** Collection path helper re-exported for squads (leave / remove member cleanup). */
export const squadEntriesCol = (squadId) => collection(db, 'squads', squadId, 'entries');
