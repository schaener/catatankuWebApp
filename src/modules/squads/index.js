import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';
import ShareTargetsProvider from './components/ShareTargetsProvider.jsx';

/**
 * Squads squad: groups (family, couple, housemates, team) that see each other's shared transactions.
 * Sharing is fan-out-on-write by the ledger; this module reads the shared read model and manages
 * membership, invites and per-app share rules.
 */
export const manifest = defineModule({
  id: 'squads',
  routes: [
    { path: 'squads', element: lazy(() => import('./pages/SquadsPage.jsx')) },
    { path: 'squads/:id', element: lazy(() => import('./pages/SquadPage.jsx')) },
    { path: 'squads/:id/settings', element: lazy(() => import('./pages/SquadSettingsPage.jsx')) },
    { path: 'join/:code', element: lazy(() => import('./pages/JoinPage.jsx')) },
  ],
  nav: [{ to: '/squads', label: 'Squad', icon: 'squad', order: 40 }],
  providers: [ShareTargetsProvider],
});

export { useGetMySquadsQuery } from './api/squadsApi.js';
