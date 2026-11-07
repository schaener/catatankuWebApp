import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';

export const REHYDRATE_CACHE = 'cache/rehydrate';

/**
 * Single RTK Query API slice (cache layer #2).
 *  - every Firestore read is cached in memory, keyed by endpoint + args
 *  - unused data is kept for 5 minutes (instant back-navigation)
 *  - data older than 2 minutes is re-fetched in the background on mount
 *  - mutations invalidate tags so only affected lists refetch
 *  - snapshots of selected endpoints are persisted to localStorage
 *    (see platform/cachePersistence.js) and rehydrated on page load
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Transaction', 'Report', 'SplitBill', 'User', 'Chat', 'Post'],
  keepUnusedDataFor: 300,
  refetchOnMountOrArgChange: 120,
  refetchOnReconnect: true,
  extractRehydrationInfo(action, { reducerPath }) {
    if (action.type === REHYDRATE_CACHE) return action.payload?.[reducerPath];
    return undefined;
  },
  endpoints: () => ({}),
});

/** Wrap an async Firestore call into the { data } / { error } shape RTK Query expects. */
export async function run(fn) {
  try {
    return { data: await fn() };
  } catch (error) {
    console.error(error);
    return { error: { message: error?.message || String(error), code: error?.code } };
  }
}

export function currentUser(getState) {
  const user = getState().auth.user;
  if (!user) throw new Error('Belum login');
  return user;
}

export const listTags = (type, result) =>
  result ? [...result.map((r) => ({ type, id: r.id })), { type, id: 'LIST' }] : [{ type, id: 'LIST' }];
