import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, listTags, run } from '../../../platform/api.js';
import { fetchTransactions } from '../../ledger/index.js';
import { serializeDoc } from '../../../platform/serialize.js';
import { summarizeTransactions as summarize } from '../../ledger/domain.js';
import { monthKeysBetween } from '../../../platform/date.js';

const reportCol = (uid) => collection(db, 'users', uid, 'reports');

export const reportsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getReports: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const snap = await getDocs(query(reportCol(uid), orderBy('createdAt', 'desc')));
          // List view does not need the transaction snapshot
          return snap.docs.map((d) => {
            const { transactions, ...rest } = serializeDoc(d);
            return rest;
          });
        }),
      providesTags: (result) => listTags('Report', result),
    }),
    getReport: builder.query({
      queryFn: (id, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const snap = await getDoc(doc(reportCol(uid), id));
          if (!snap.exists()) throw new Error('Laporan tidak ditemukan');
          return serializeDoc(snap);
        }),
      providesTags: (r, e, id) => [{ type: 'Report', id }],
    }),
    // Generates a frozen snapshot of the period so the report never changes afterwards.
    createReport: builder.mutation({
      queryFn: ({ title, from, to, notes }, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const transactions = await fetchTransactions(uid, { from, to });
          const summary = summarize(transactions, monthKeysBetween(from, to));
          const ref = await addDoc(reportCol(uid), {
            title: title?.trim() || `Laporan ${from} s/d ${to}`,
            from,
            to,
            notes: notes?.trim() || '',
            summary,
            transactions: transactions.slice(0, 1000).map(({ createdAt, updatedAt, ...t }) => t),
            createdAt: serverTimestamp(),
          });
          return { id: ref.id };
        }),
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),
    deleteReport: builder.mutation({
      queryFn: (id, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          await deleteDoc(doc(reportCol(uid), id));
          return { id };
        }),
      invalidatesTags: (r, e, id) => [{ type: 'Report', id: 'LIST' }, { type: 'Report', id }],
    }),
  }),
});

export const { useGetReportsQuery, useGetReportQuery, useCreateReportMutation, useDeleteReportMutation } =
  reportsApi;
