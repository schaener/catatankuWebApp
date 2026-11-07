import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';

/** Insights squad: Beranda, Laporan (from notifications) and saved report snapshots. */
export const manifest = defineModule({
  id: 'insights',
  routes: [
    { index: true, element: lazy(() => import('./pages/HomePage.jsx')) },
    { path: 'insights', element: lazy(() => import('./pages/InsightsPage.jsx')) },
    { path: 'reports', element: lazy(() => import('./pages/ReportsPage.jsx')) },
    { path: 'reports/:id', element: lazy(() => import('./pages/ReportDetailPage.jsx')) },
  ],
  nav: [
    { to: '/', end: true, label: 'Beranda', icon: 'home', order: 10, primary: true },
    { to: '/insights', label: 'Laporan', icon: 'report', order: 30, primary: true },
    { to: '/reports', label: 'Laporan tersimpan', icon: '📄', order: 60 },
  ],
});
