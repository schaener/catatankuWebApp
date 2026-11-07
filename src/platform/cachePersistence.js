/**
 * Cache layer #3: persists a snapshot of selected RTK Query results to
 * localStorage per user, so a reload shows data instantly (stale-while-
 * revalidate: RTK Query refetches in the background when it is older than
 * `refetchOnMountOrArgChange`). Real-time endpoints are not persisted since
 * they rely on live listeners.
 */
const VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_BYTES = 2_000_000;
const PERSISTED_ENDPOINTS = new Set(['getTransactions', 'getReports', 'getReport', 'getSplitBills', 'getSplitBill', 'getUsers']);

const keyFor = (uid) => `catatan-keuangan:cache:v${VERSION}:${uid}`;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadPersistedCache(uid) {
  try {
    const raw = storage()?.getItem(keyFor(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.savedAt > TTL_MS) {
      storage()?.removeItem(keyFor(uid));
      return null;
    }
    return parsed.state;
  } catch {
    return null;
  }
}

export function clearPersistedCache(uid) {
  try {
    storage()?.removeItem(keyFor(uid));
  } catch {
    /* ignore */
  }
}

function snapshot(apiState) {
  const queries = {};
  for (const [key, entry] of Object.entries(apiState.queries)) {
    if (entry?.status === 'fulfilled' && PERSISTED_ENDPOINTS.has(entry.endpointName)) queries[key] = entry;
  }
  const keep = new Set(Object.keys(queries));
  const tags = {};
  for (const [type, ids] of Object.entries(apiState.provided?.tags || {})) {
    for (const [id, cacheKeys] of Object.entries(ids)) {
      const filtered = cacheKeys.filter((k) => keep.has(k));
      if (filtered.length) (tags[type] ??= {})[id] = filtered;
    }
  }
  return { queries, mutations: {}, provided: { tags, keys: {} }, subscriptions: {}, config: apiState.config };
}

export function save(uid, apiState) {
  try {
    const payload = JSON.stringify({ savedAt: Date.now(), state: { api: snapshot(apiState) } });
    if (payload.length > MAX_BYTES) return;
    storage()?.setItem(keyFor(uid), payload);
  } catch {
    /* quota exceeded or storage disabled: caching is best-effort */
  }
}

/** Subscribes to the store and writes the snapshot at most once per second. */
export function setupCachePersistence(store) {
  let timer = null;
  let lastApi = null;
  return store.subscribe(() => {
    const state = store.getState();
    if (state.api === lastApi || !state.auth.user) return;
    lastApi = state.api;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const s = store.getState();
      if (s.auth.user) save(s.auth.user.uid, s.api);
    }, 1000);
  });
}
