import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';
import { useReviewQueue } from '../ledger/index.js';

/** Review squad: turning captured notifications into confirmed records (Tinjau). */
export const manifest = defineModule({
  id: 'review',
  routes: [{ path: 'review', element: lazy(() => import('./pages/ReviewPage.jsx')) }],
  nav: [{ to: '/review', label: 'Tinjau', icon: 'review', order: 20, primary: true, useBadge: () => useReviewQueue().size }],
});
