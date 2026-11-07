import { collection, query, where } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser } from '../../../platform/api.js';
import { streamInto } from '../../../platform/stream.js';

/**
 * users/{uid}/transfers/{id}: moves between own accounts (BCA -> GoPay). Kept out of
 * `transactions` so no page ever counts them as spending.
 * { amount, fromPackage, fromName, toPackage, toName, date, note, source, raw[] }
 */
export const transfersCol = (uid) => collection(db, 'users', uid, 'transfers');

export const transfersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    streamTransfers: builder.query({
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded(sinceMs, ctx) {
        await streamInto(query(transfersCol(currentUser(ctx.getState).uid), where('date', '>=', sinceMs)), ctx);
      },
    }),
  }),
});

export const { useStreamTransfersQuery } = transfersApi;
