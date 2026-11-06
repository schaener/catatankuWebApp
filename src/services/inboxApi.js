import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { api, currentUser, run } from './api.js';
import { cleanTx, txCol } from './transactionsApi.js';
import { serializeDoc } from '../utils/serialize.js';
import { parseNotification } from '../utils/notifParser.js';
import { streamInto } from './stream.js';

/**
 * Bank / e-wallet notifications captured by the Android companion app land in
 * users/{uid}/inbox/{id} as raw text: { packageName, appName, title, text, postedAt }.
 * They are parsed here (utils/notifParser.js) and removed once reviewed, so the
 * inbox only ever holds items waiting for review and raw texts don't pile up.
 */
const inboxCol = (uid) => collection(db, 'users', uid, 'inbox');
const inboxQuery = (uid) => query(inboxCol(uid), orderBy('postedAt', 'desc'), limit(300));
const withParsed = (list) => list.map((item) => ({ ...item, parsed: parseNotification(item) }));

export const inboxApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getInbox: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => withParsed((await getDocs(inboxQuery(currentUser(getState).uid))).docs.map(serializeDoc))),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(inboxQuery(currentUser(ctx.getState).uid), ctx, withParsed);
      },
    }),
    // Drop reviewed items: ignored, transfers between own accounts, or already saved via the form.
    resolveInbox: builder.mutation({
      queryFn: (ids, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const batch = writeBatch(db);
          ids.forEach((id) => batch.delete(doc(inboxCol(uid), id)));
          await batch.commit();
          return ids;
        }),
    }),
    // Save drafts as transactions and remove them from the inbox in one atomic write.
    confirmInbox: builder.mutation({
      queryFn: (entries, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const batch = writeBatch(db);
          for (const { id, tx } of entries) {
            batch.set(doc(txCol(uid)), { ...cleanTx(tx), source: 'notification', createdAt: serverTimestamp() });
            batch.delete(doc(inboxCol(uid), id));
          }
          await batch.commit();
          return entries.length;
        }),
      invalidatesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),
  }),
});

export const { useGetInboxQuery, useResolveInboxMutation, useConfirmInboxMutation } = inboxApi;

/** Transaction draft for an inbox item (used for the form and for bulk confirm). */
export const draftFromInbox = (item) => ({
  type: item.parsed.type || 'expense',
  amount: item.parsed.amount || '',
  category: item.parsed.category,
  place: item.parsed.place,
  paymentMethod: item.parsed.paymentMethod,
  note: `Otomatis dari ${item.appName || 'notifikasi'}`,
  date: item.postedAt,
});
