import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';

/**
 * Capture squad: everything about notifications coming from phones — the raw inbox, the parser,
 * phones & monitored apps, and "this merchant belongs to that app" rules.
 */
export const manifest = defineModule({
  id: 'capture',
  routes: [
    { path: 'sources', element: lazy(() => import('./pages/SourcesPage.jsx')) },
    { path: 'device', element: lazy(() => import('./pages/DevicePage.jsx')) },
  ],
  nav: [
    { to: '/sources', label: 'Sumber', icon: 'sources', order: 35, primary: true },
    { to: '/device', label: 'Pengaturan HP', icon: '📱', order: 70 },
  ],
});

export { useGetInboxQuery, useMoveInboxItemMutation, useResolveInboxMutation } from './api/inboxApi.js';
export { useGetAppRulesQuery, useAddAppRuleMutation, useRemoveAppRuleMutation } from './api/appRulesApi.js';
export { useGetDevicesQuery, useSetDeviceAppsMutation } from './api/devicesApi.js';
export { useSetupProgress } from './logic/setup.js';
export * from './domain.js';
