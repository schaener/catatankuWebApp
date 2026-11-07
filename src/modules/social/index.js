import { lazy } from 'react';
import { defineModule } from '../../platform/module.js';
import NotificationAlerts from './components/NotificationAlerts.jsx';
import { useNotifications } from './hooks/useNotifications.js';

/** Social squad: feed, chat, notifications and split bill. */
export const manifest = defineModule({
  id: 'social',
  routes: [
    { path: 'split', element: lazy(() => import('./pages/SplitBillsPage.jsx')) },
    { path: 'split/:id', element: lazy(() => import('./pages/SplitBillDetailPage.jsx')) },
    { path: 'chat', element: lazy(() => import('./pages/ChatPage.jsx')) },
    { path: 'chat/:chatId', element: lazy(() => import('./pages/ChatPage.jsx')) },
    { path: 'feed', element: lazy(() => import('./pages/FeedPage.jsx')) },
    { path: 'notifications', element: lazy(() => import('./pages/NotificationsPage.jsx')) },
  ],
  nav: [
    { to: '/split', label: 'Split Bill', icon: '🧾', order: 80 },
    { to: '/chat', label: 'Chat', icon: '💬', order: 85, useBadge: () => useNotifications().counts.chat },
    { to: '/feed', label: 'Feed', icon: '🌐', order: 90 },
    { to: '/notifications', label: 'Notifikasi', icon: '🔔', order: 95, useBadge: () => useNotifications().counts.total },
  ],
  providers: [NotificationAlerts],
});
