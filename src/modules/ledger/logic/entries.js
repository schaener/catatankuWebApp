import { parseCached, ruleFor } from '../../capture/domain.js';

/**
 * One ledger row, whatever its storage:
 *   store 'inbox'    pending notification (users/{uid}/inbox)
 *   store 'tx'       saved income / expense, shared with every web page (users/{uid}/transactions)
 *   store 'transfer' move between own accounts, never counted as spending (users/{uid}/transfers)
 *   store 'draft'    not stored yet (manual entry, or a notification the phone skipped)
 *
 * Entry = { id, store, pending, origin: 'notification'|'manual', kind: 'expense'|'income'|'transfer'|null,
 *           amount, app: {pkg,name}, toApp, movedFrom, category, place, note, date, raw: Notification[],
 *           isPromo, confident, squadId, sharedTo, legacy }
 */
export const CASH = Object.freeze({ pkg: 'cash', name: 'Tunai' });
export const OTHER = 'Lainnya';
export const SOURCE = Object.freeze({ NOTIFICATION: 'notification', APP: 'app' });

export const rawOf = (d) => ({
  id: d.id,
  packageName: d.packageName,
  appName: d.appName || '',
  title: d.title || '',
  text: d.text || '',
  postedAt: d.postedAt || 0,
});
export const rawBody = (r) => [r.title, r.text].filter(Boolean).join(' · ');
const appOfRaw = (r) => ({ pkg: r.packageName, name: r.appName || r.packageName });
const sameApp = (a, b) => a?.pkg === b?.pkg;

/** Pending inbox doc -> entry; a user override or a matching "Ingat" rule re-assigns the app. */
export function fromInbox(doc, rules = []) {
  const raw = rawOf(doc);
  const p = parseCached(doc);
  const rule = doc.overridePackage ? null : ruleFor(rules, raw);
  const moved = doc.overridePackage ? { pkg: doc.overridePackage, name: doc.overrideName || doc.overridePackage } : rule && { pkg: rule.toPackage, name: rule.toName };
  const original = appOfRaw(raw);
  return {
    id: doc.id,
    store: 'inbox',
    pending: true,
    origin: SOURCE.NOTIFICATION,
    kind: p.type,
    amount: p.amount,
    app: moved || original,
    toApp: null,
    movedFrom: moved && !sameApp(moved, original) ? original : null,
    category: p.category,
    place: p.place,
    note: '',
    date: raw.postedAt,
    raw: [raw],
    isPromo: p.isPromo,
    // moved items always get a second look
    confident: p.confidence === 'high' && !moved,
    squadId: null,
    sharedTo: null,
    legacy: false,
  };
}

/** A notification that never reached the inbox (skipped on the phone), as an editable draft. */
export function fromRaw(rawDoc) {
  return { ...fromInbox(rawDoc), store: 'draft', confident: false };
}

export function blankEntry(app = CASH) {
  return {
    id: '', store: 'draft', pending: false, origin: SOURCE.APP, kind: 'expense', amount: null, app, toApp: null, movedFrom: null,
    category: 'Makanan & Minuman', place: '', note: '', date: Date.now(), raw: [], isPromo: false, confident: false, squadId: null, sharedTo: null, legacy: false,
  };
}

/** users/{uid}/transactions doc -> entry. Legacy web entries (no source) are kept, flagged `legacy`. */
export function fromTx(d) {
  if (d.amount == null || d.date == null) return null;
  const method = d.paymentMethod || '';
  return {
    id: d.id,
    store: 'tx',
    pending: false,
    origin: d.source === SOURCE.NOTIFICATION ? SOURCE.NOTIFICATION : SOURCE.APP,
    kind: d.type === 'income' ? 'income' : 'expense',
    amount: Number(d.amount) || 0,
    app: d.appPackage ? { pkg: d.appPackage, name: d.appName || d.appPackage } : { pkg: `unknown:${method}`, name: method || OTHER },
    toApp: null,
    movedFrom: d.movedFromPackage ? { pkg: d.movedFromPackage, name: d.movedFromName || d.movedFromPackage } : null,
    category: d.category || OTHER,
    place: d.place || '',
    note: d.note || '',
    date: d.date,
    raw: d.raw ? [rawOf(d.raw)] : [],
    isPromo: false,
    confident: false,
    squadId: d.squadId || null,
    sharedTo: d.squadId || null,
    legacy: d.source !== SOURCE.NOTIFICATION && d.source !== SOURCE.APP,
    splitBillId: d.splitBillId,
  };
}

export function fromTransfer(d) {
  if (d.amount == null || d.date == null || !d.fromPackage) return null;
  return {
    id: d.id,
    store: 'transfer',
    pending: false,
    origin: d.source === SOURCE.NOTIFICATION ? SOURCE.NOTIFICATION : SOURCE.APP,
    kind: 'transfer',
    amount: Number(d.amount) || 0,
    app: { pkg: d.fromPackage, name: d.fromName || d.fromPackage },
    toApp: d.toPackage ? { pkg: d.toPackage, name: d.toName || d.toPackage } : null,
    movedFrom: null,
    category: OTHER,
    place: '',
    note: d.note || '',
    date: d.date,
    raw: (d.raw || []).map(rawOf),
    isPromo: false,
    confident: false,
    squadId: null,
    sharedTo: null,
    legacy: false,
  };
}

/** Counts towards totals: has an amount and a direction, and isn't an ad. */
export const isCountable = (e) => e.amount != null && e.amount > 0 && e.kind != null && !e.isPromo;
export const entryTitle = (e) => e.place || (e.kind === 'transfer' ? 'Pindah dana' : e.category);
export const isUnknownApp = (app) => !app?.pkg || app.pkg.startsWith('unknown:');
