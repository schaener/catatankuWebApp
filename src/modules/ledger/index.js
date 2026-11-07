import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';
import ComposerHost from './components/ComposerHost.jsx';

/**
 * Ledger squad: the user's money records — saved transactions, transfers between own accounts,
 * manual entries — and every write to them (save / move / ignore / delete / back to review).
 */
export const manifest = defineModule({
  id: 'ledger',
  routes: [
    { path: 'transactions', element: lazy(() => import('./pages/TransactionsPage.jsx')) },
    { path: 'search', element: lazy(() => import('./pages/SearchPage.jsx')) },
  ],
  nav: [
    { to: '/transactions', label: 'Transaksi', icon: '💸', order: 50 },
    { to: '/search', label: 'Cari', icon: '🔎', order: 55 },
  ],
  providers: [ComposerHost],
});

export { useLedger, useReviewQueue, useSummary, useAccounts, dismissPair } from './hooks/useLedger.js';
export { saveEntries, ignoreEntries, deleteEntry, returnToReview, markTransfer, moveEntry, squadEntriesCol } from './api/commands.js';
export { useGetTransactionsQuery, useAddTransactionMutation, fetchTransactions, txCol } from './api/transactionsApi.js';
export { EntryRow, signedAmount } from './components/EntryRow.jsx';
export { categoryEmoji } from './components/EntrySheets.jsx';
export { default as TransactionForm } from './components/TransactionForm.jsx';
export { default as TransactionList } from './components/TransactionList.jsx';
export * from './domain.js';
