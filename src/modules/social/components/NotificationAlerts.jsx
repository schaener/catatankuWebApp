import { useNotificationAlerts } from '../hooks/useNotifications.js';

/** Mounted once by the shell: toasts / system notifications for new likes, comments and messages. */
export default function NotificationAlerts({ children }) {
  useNotificationAlerts();
  return children;
}
