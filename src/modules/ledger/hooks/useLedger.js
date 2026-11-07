import { useMemo, useSyncExternalStore } from 'react';
import { useToday } from '../../../platform/hooks.js';
import { useGetAppRulesQuery, useGetDevicesQuery, useGetInboxQuery } from '../../capture/index.js';
import { useStreamTransactionsQuery } from '../api/transactionsApi.js';
import { useStreamTransfersQuery } from '../api/transfersApi.js';
import { CASH, fromInbox, fromTransfer, fromTx, isUnknownApp } from '../logic/entries.js';
import { buildReview, collapsePendingTransfers, earliestStart, summarize } from '../logic/ledger.js';

/** Memoize on argument identity, shared by every caller (several screens mount the same ledger). */
function memoLast(fn) {
  let args = null;
  let result;
  return (...next) => {
    if (!args || next.length !== args.length || next.some((a, i) => a !== args[i])) {
      args = next;
      result = fn(...next);
    }
    return result;
  };
}

const buildLedger = memoLast((inbox, rules, txs, transfers) => {
  const pending = (inbox || []).map((d) => fromInbox(d, rules || []));
  const saved = [...(txs || []).map(fromTx), ...(transfers || []).map(fromTransfer)].filter(Boolean);
  return {
    loading: inbox == null || txs == null || transfers == null,
    pending,
    entries: [...pending, ...saved].sort((a, b) => b.date - a.date),
  };
});

/**
 * The user's ledger: pending notifications + saved transactions + transfers, newest first.
 * Streams from the oldest instant any report period needs.
 */
export function useLedger() {
  const today = useToday();
  const since = useMemo(() => earliestStart(today), [today]);
  const { data: inbox } = useGetInboxQuery();
  const { data: rules } = useGetAppRulesQuery();
  const { data: txs } = useStreamTransactionsQuery(since);
  const { data: transfers } = useStreamTransfersQuery(since);
  return { ...buildLedger(inbox, rules, txs, transfers), today };
}

// "Bukan, catat terpisah" decisions live for the session only (tiny external store).
let dismissed = new Set();
const dismissListeners = new Set();
export function dismissPair([a, b]) {
  dismissed = new Set([...dismissed, a.id, b.id]);
  dismissListeners.forEach((fn) => fn());
}
const subscribeDismissed = (fn) => {
  dismissListeners.add(fn);
  return () => dismissListeners.delete(fn);
};

const buildReviewMemo = memoLast(buildReview);
const collapseMemo = memoLast(collapsePendingTransfers);

/** Pending entries grouped for review: { transfers, items, promos, sure, size }. */
export function useReviewQueue() {
  const { pending, loading } = useLedger();
  const dismissedNow = useSyncExternalStore(subscribeDismissed, () => dismissed);
  return { ...buildReviewMemo(pending, dismissedNow), loading };
}

/**
 * Summary for a range. `filter(entry)` narrows the entries (e.g. by source); pending transfer pairs
 * count as transfers.
 */
export function useSummary(rangeOf, filter) {
  const { entries, loading, today } = useLedger();
  const queue = useReviewQueue();
  const counted = collapseMemo(entries, queue);
  return useMemo(() => {
    if (loading) return null;
    return summarize(filter ? counted.filter(filter) : counted, rangeOf(today), today);
  }, [counted, loading, today, rangeOf, filter]);
}

/** Accounts offered in pickers: apps monitored on the user's phones, apps used before, and cash. */
export function useAccounts() {
  const { data: devices } = useGetDevicesQuery();
  const { entries } = useLedger();
  return useMemo(() => {
    const byPkg = new Map();
    for (const d of devices || []) {
      const labels = new Map((d.installedApps || []).map((a) => [a.packageName, a.label]));
      for (const pkg of d.selected || []) if (pkg !== 'com.android.shell') byPkg.set(pkg, { pkg, name: labels.get(pkg) || pkg });
    }
    for (const e of entries) for (const a of [e.app, e.toApp]) if (a && !isUnknownApp(a) && a.pkg !== CASH.pkg && !byPkg.has(a.pkg)) byPkg.set(a.pkg, a);
    return [...[...byPkg.values()].sort((a, b) => a.name.localeCompare(b.name)), CASH];
  }, [devices, entries]);
}
