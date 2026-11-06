import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { api, currentUser, listTags, run } from './api.js';
import { serializeDoc } from '../utils/serialize.js';
import { endOfDayMs, startOfDayMs } from '../utils/date.js';

export const txCol = (uid) => collection(db, 'users', uid, 'transactions');

export async function fetchTransactions(uid, { from, to } = {}) {
  const constraints = [];
  if (from) constraints.push(where('date', '>=', startOfDayMs(from)));
  if (to) constraints.push(where('date', '<=', endOfDayMs(to)));
  const snap = await getDocs(query(txCol(uid), ...constraints, orderBy('date', 'desc')));
  return snap.docs.map(serializeDoc);
}

export function cleanTx(tx) {
  return {
    type: tx.type === 'income' ? 'income' : 'expense',
    amount: Math.round(Number(tx.amount) || 0),
    category: tx.category || 'Lainnya',
    place: (tx.place || '').trim(),
    paymentMethod: tx.paymentMethod || '',
    note: (tx.note || '').trim(),
    date: Number(tx.date) || Date.now(),
    ...(tx.splitBillId ? { splitBillId: tx.splitBillId } : {}),
  };
}

export const transactionsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Args are { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } so cache keys are stable.
    getTransactions: builder.query({
      queryFn: (range, { getState }) => run(() => fetchTransactions(currentUser(getState).uid, range)),
      providesTags: (result) => listTags('Transaction', result),
    }),
    addTransaction: builder.mutation({
      queryFn: (tx, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const ref = await addDoc(txCol(uid), { ...cleanTx(tx), createdAt: serverTimestamp() });
          return { id: ref.id };
        }),
      invalidatesTags: [{ type: 'Transaction', id: 'LIST' }],
    }),
    updateTransaction: builder.mutation({
      queryFn: ({ id, ...tx }, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          await updateDoc(doc(txCol(uid), id), { ...cleanTx(tx), updatedAt: serverTimestamp() });
          return { id };
        }),
      invalidatesTags: (r, e, { id }) => [{ type: 'Transaction', id }, { type: 'Transaction', id: 'LIST' }],
    }),
    deleteTransaction: builder.mutation({
      queryFn: (id, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          await deleteDoc(doc(txCol(uid), id));
          return { id };
        }),
      invalidatesTags: (r, e, id) => [{ type: 'Transaction', id }, { type: 'Transaction', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetTransactionsQuery,
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
} = transactionsApi;
