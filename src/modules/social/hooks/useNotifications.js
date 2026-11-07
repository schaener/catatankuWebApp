import { useEffect, useMemo, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { notify } from '../../../platform/ui/uiSlice.js';
import { unreadCount, useGetNotificationsQuery, useMarkNotificationsReadMutation } from '../api/notificationsApi.js';

export function describe(n) {
  if (n.type === 'like') return `${n.actorName} menyukai postinganmu`;
  if (n.type === 'comment') return `${n.actorName} mengomentari postinganmu: "${n.text}"`;
  const from = n.chatName ? `${n.actorName} di ${n.chatName}` : n.actorName;
  return n.count > 1 ? `${n.count} pesan baru dari ${from}` : `${from}: ${n.text}`;
}

export const linkFor = (n) => (n.type === 'message' ? `/chat/${n.chatId}` : '/feed');

/** Notification list plus unread totals for the sidebar badges. */
export function useNotifications() {
  const { data = [], ...rest } = useGetNotificationsQuery();
  const counts = useMemo(() => {
    let chat = 0;
    let total = 0;
    for (const n of data) {
      const c = unreadCount(n);
      total += c;
      if (n.type === 'message') chat += c;
    }
    return { chat, total };
  }, [data]);
  return { data, counts, ...rest };
}

const openChatId = (pathname) => pathname.match(/^\/chat\/([^/]+)/)?.[1];

function showSystemNotification(n) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    new Notification('Catatan Keuangan', { body: describe(n), icon: '/favicon.svg', tag: n.id });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

/**
 * Mounted once in the layout: toasts (and, when the tab is hidden, shows a
 * browser notification for) every notification that arrives while the app
 * is open, and marks the chat you are looking at as read.
 */
export function useNotificationAlerts() {
  const { data, isSuccess } = useGetNotificationsQuery();
  const [markRead] = useMarkNotificationsReadMutation();
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const seen = useRef(null);

  useEffect(() => {
    if (!isSuccess) return;
    const activeChat = openChatId(pathname);
    const first = seen.current === null;
    if (first) seen.current = new Map();
    const toMark = [];
    for (const n of data) {
      const isNew = (seen.current.get(n.id) ?? 0) < (n.updatedAt ?? 0);
      seen.current.set(n.id, n.updatedAt ?? 0);
      if (n.read) continue;
      if (n.type === 'message' && n.chatId === activeChat) {
        toMark.push(n.id);
        continue;
      }
      if (isNew && !first) {
        dispatch(notify(`🔔 ${describe(n)}`));
        showSystemNotification(n);
      }
    }
    if (toMark.length) markRead(toMark);
  }, [data, isSuccess, pathname, dispatch, markRead]);
}
