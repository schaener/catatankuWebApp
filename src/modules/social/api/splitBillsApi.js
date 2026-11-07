import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, listTags, run } from '../../../platform/api.js';
import { serializeDoc } from '../../../platform/serialize.js';

const billCol = () => collection(db, 'splitBills');

export const splitBillsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSplitBills: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const snap = await getDocs(query(billCol(), where('memberUids', 'array-contains', uid)));
          // Sorted client-side to avoid requiring a composite index.
          return snap.docs.map(serializeDoc).sort((a, b) => (b.date || 0) - (a.date || 0));
        }),
      providesTags: (result) => listTags('SplitBill', result),
    }),
    getSplitBill: builder.query({
      queryFn: (id) =>
        run(async () => {
          const snap = await getDoc(doc(billCol(), id));
          if (!snap.exists()) throw new Error('Split bill tidak ditemukan');
          return serializeDoc(snap);
        }),
      providesTags: (r, e, id) => [{ type: 'SplitBill', id }],
    }),
    createSplitBill: builder.mutation({
      queryFn: (bill, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          const memberUids = [...new Set([me.uid, ...bill.participants.map((p) => p.uid).filter(Boolean)])];
          const ref = await addDoc(billCol(), {
            ...bill,
            ownerId: me.uid,
            ownerName: me.displayName,
            memberUids,
            createdAt: serverTimestamp(),
          });
          return { id: ref.id };
        }),
      invalidatesTags: [{ type: 'SplitBill', id: 'LIST' }],
    }),
    // Toggle a participant's paid flag inside a transaction (safe with concurrent edits).
    togglePaid: builder.mutation({
      queryFn: ({ billId, participantId }) =>
        run(() =>
          runTransaction(db, async (trx) => {
            const ref = doc(billCol(), billId);
            const snap = await trx.get(ref);
            if (!snap.exists()) throw new Error('Split bill tidak ditemukan');
            const participants = snap
              .data()
              .participants.map((p) =>
                p.id === participantId ? { ...p, paid: !p.paid, paidAt: !p.paid ? Date.now() : null } : p,
              );
            trx.update(ref, { participants, updatedAt: serverTimestamp() });
            return { id: billId };
          }),
        ),
      // Optimistic update for snappy UI
      async onQueryStarted({ billId, participantId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          splitBillsApi.util.updateQueryData('getSplitBill', billId, (draft) => {
            const p = draft.participants.find((x) => x.id === participantId);
            if (p) p.paid = !p.paid;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (r, e, { billId }) => [{ type: 'SplitBill', id: 'LIST' }, { type: 'SplitBill', id: billId }],
    }),
    deleteSplitBill: builder.mutation({
      queryFn: (id) =>
        run(async () => {
          await deleteDoc(doc(billCol(), id));
          return { id };
        }),
      invalidatesTags: [{ type: 'SplitBill', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetSplitBillsQuery,
  useGetSplitBillQuery,
  useCreateSplitBillMutation,
  useTogglePaidMutation,
  useDeleteSplitBillMutation,
} = splitBillsApi;
