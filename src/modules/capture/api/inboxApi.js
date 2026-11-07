import { collection, doc, limit, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { streamInto } from '../../../platform/stream.js';

/**
 * users/{uid}/inbox/{id}: raw bank / e-wallet notifications uploaded by the Android app
 * ({ packageName, appName, title, text, postedAt, overridePackage?, overrideName? }).
 * Read-only stream here; turning them into transactions is the ledger's job.
 */
export const inboxCol = (uid) => collection(db, 'users', uid, 'inbox');
const inboxQuery = (uid) => query(inboxCol(uid), orderBy('postedAt', 'desc'), limit(300));

export const inboxApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getInbox: builder.query({
      // The live listener fills the cache; the first emission comes from the offline cache when available.
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(inboxQuery(currentUser(ctx.getState).uid), ctx);
      },
    }),
    /** Remember which app a pending notification really belongs to (before it's reviewed). */
    moveInboxItem: builder.mutation({
      queryFn: ({ id, app }, { getState }) =>
        run(async () => {
          await updateDoc(doc(inboxCol(currentUser(getState).uid), id), { overridePackage: app.pkg, overrideName: app.name });
          return id;
        }),
    }),
    resolveInbox: builder.mutation({
      queryFn: (ids, { getState }) =>
        run(async () => {
          const batch = writeBatch(db);
          ids.forEach((id) => batch.delete(doc(inboxCol(currentUser(getState).uid), id)));
          await batch.commit();
          return ids;
        }),
    }),
  }),
});

export const { useGetInboxQuery, useMoveInboxItemMutation, useResolveInboxMutation } = inboxApi;
