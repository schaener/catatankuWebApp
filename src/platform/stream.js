import { onSnapshot } from 'firebase/firestore';
import { serializeDoc } from './serialize.js';

/**
 * Helper for real-time endpoints: keeps an RTK Query cache entry in sync with
 * a Firestore onSnapshot listener for as long as any component uses it.
 * When the last subscriber unmounts (plus keepUnusedDataFor) the listener is removed.
 *
 * Pure streaming endpoints use `queryFn: () => ({ data: null })`: null means "not loaded yet",
 * and the listener (served from the offline cache first) fills the entry — one read, not two.
 */
// Errors that can heal by themselves: membership written a moment ago (rules see it after the commit
// reaches the server), network blips, throttling.
const RETRYABLE = new Set(['permission-denied', 'unavailable', 'resource-exhausted', 'internal', 'deadline-exceeded', 'aborted']);
const MAX_RETRIES = 6;

export async function streamInto(q, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }, transform = (x) => x) {
  let unsubscribe = () => {};
  let timer = 0;
  let attempt = 0;
  let removed = false;
  const subscribe = () => {
    unsubscribe = onSnapshot(
      q,
      // query snapshots carry .docs; document snapshots are passed as one object (or null if missing)
      (snap) => {
        attempt = 0;
        updateCachedData(() => transform(snap.docs ? snap.docs.map(serializeDoc) : snap.exists() ? serializeDoc(snap) : null));
      },
      // A Firestore listener is dead after an error; resubscribe with exponential backoff (1s, 2s, 4s ... 30s).
      (err) => {
        if (removed) return;
        if (RETRYABLE.has(err.code) && attempt < MAX_RETRIES) {
          timer = setTimeout(subscribe, Math.min(30_000, 1000 * 2 ** attempt++));
        } else {
          console.error('Realtime listener error', err);
        }
      },
    );
  };
  try {
    await cacheDataLoaded;
    subscribe();
  } catch {
    // cache entry removed before the first load finished
  }
  await cacheEntryRemoved;
  removed = true;
  clearTimeout(timer);
  unsubscribe();
}
