import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { describe, linkFor, useNotifications } from '../features/notifications/useNotifications.js';
import { useMarkNotificationsReadMutation } from '../services/notificationsApi.js';
import { timeAgo } from '../utils/format.js';
import { Avatar, EmptyState, ErrorBox, PageHeader, Spinner } from '../components/ui.jsx';

const ICON = { like: '❤️', comment: '💬', message: '✉️' };

function BrowserPermission() {
  const supported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  if (permission === 'granted' || permission === 'unsupported') return null;
  return (
    <div className="card notif-permission">
      <span>
        {permission === 'denied'
          ? 'Notifikasi browser diblokir. Izinkan lewat pengaturan situs di browser untuk menerima notifikasi saat tab ini tidak dibuka.'
          : 'Aktifkan notifikasi browser supaya tetap tahu ada chat atau komentar baru saat tab ini tidak dibuka.'}
      </span>
      {permission === 'default' && (
        <button className="btn btn-primary" onClick={async () => setPermission(await Notification.requestPermission())}>
          Aktifkan
        </button>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { data, counts, isLoading, error } = useNotifications();
  const [markRead, { isLoading: marking }] = useMarkNotificationsReadMutation();
  const navigate = useNavigate();
  const unread = data.filter((n) => !n.read).map((n) => n.id);

  const open = (n) => {
    if (!n.read) markRead([n.id]);
    navigate(linkFor(n));
  };

  return (
    <div className="page">
      <PageHeader title="Notifikasi" subtitle={counts.total ? `${counts.total} belum dibaca` : 'Semua sudah dibaca'}>
        {unread.length > 0 && (
          <button className="btn btn-ghost" disabled={marking} onClick={() => markRead(unread)}>
            Tandai semua dibaca
          </button>
        )}
      </PageHeader>
      <BrowserPermission />
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : !data.length ? (
        <EmptyState icon="🔔" title="Belum ada notifikasi">
          Like, komentar di postinganmu, dan chat baru akan muncul di sini.
        </EmptyState>
      ) : (
        <ul className="card notif-list">
          {data.map((n) => (
            <li key={n.id}>
              <button className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
                <span className="notif-avatar">
                  <Avatar name={n.actorName} src={n.actorPhoto} size={40} />
                  <span className="notif-type">{ICON[n.type]}</span>
                </span>
                <span className="notif-body">
                  <span className="notif-text">{describe(n)}</span>
                  <small className="muted">{timeAgo(n.updatedAt)}</small>
                </span>
                {!n.read && <span className="dot" aria-label="Belum dibaca" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
