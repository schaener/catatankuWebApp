import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { api, currentUser, run } from './api.js';
import { serializeDoc } from '../utils/serialize.js';
import { streamInto } from './stream.js';

/**
 * In-app notifications live in users/{uid}/notifications and are written by
 * the client that triggers them (no Cloud Functions needed):
 *  - like_{postId}_{actorUid}  someone liked your post (removed on unlike)
 *  - comment_{commentId}       someone commented on your post
 *  - chat_{chatId}             new messages in a chat (one doc per chat, `count` grows)
 */
const notifCol = (uid) => collection(db, 'users', uid, 'notifications');
const notifQuery = (uid) => query(notifCol(uid), orderBy('updatedAt', 'desc'), limit(50));

// Notifications are best-effort: a failure must never break the action that triggered it.
async function quietly(fn) {
  try {
    await fn();
  } catch (err) {
    console.warn('Notifikasi gagal dikirim', err);
  }
}

const actor = (me) => ({ actorId: me.uid, actorName: me.displayName, actorPhoto: me.photoURL || null });

export const notifyLike = (me, post, liked) =>
  post.authorId !== me.uid &&
  quietly(() => {
    const ref = doc(db, 'users', post.authorId, 'notifications', `like_${post.id}_${me.uid}`);
    if (!liked) return deleteDoc(ref);
    return setDoc(ref, {
      type: 'like',
      ...actor(me),
      postId: post.id,
      text: post.text.slice(0, 80),
      read: false,
      updatedAt: serverTimestamp(),
    });
  });

export const notifyComment = (me, post, commentId, text) =>
  post.authorId !== me.uid &&
  quietly(() =>
    setDoc(doc(db, 'users', post.authorId, 'notifications', `comment_${commentId}`), {
      type: 'comment',
      ...actor(me),
      postId: post.id,
      text: text.slice(0, 120),
      read: false,
      updatedAt: serverTimestamp(),
    }),
  );

export const notifyMessage = (me, chat, text) =>
  quietly(() => {
    const batch = writeBatch(db);
    for (const uid of chat.members.filter((m) => m !== me.uid)) {
      batch.set(
        doc(db, 'users', uid, 'notifications', `chat_${chat.id}`),
        {
          type: 'message',
          ...actor(me),
          chatId: chat.id,
          chatName: chat.isGroup ? chat.name : null,
          text: text.slice(0, 120),
          count: increment(1),
          read: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
    return batch.commit();
  });

export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => (await getDocs(notifQuery(currentUser(getState).uid))).docs.map(serializeDoc)),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(notifQuery(currentUser(ctx.getState).uid), ctx);
      },
    }),
    // ids = notification ids to mark read
    markNotificationsRead: builder.mutation({
      queryFn: (ids, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          const batch = writeBatch(db);
          ids.forEach((id) => batch.update(doc(notifCol(uid), id), { read: true, count: 0 }));
          await batch.commit();
          return ids;
        }),
    }),
  }),
});

export const { useGetNotificationsQuery, useMarkNotificationsReadMutation } = notificationsApi;

export const unreadCount = (n) => (n.read ? 0 : n.type === 'message' ? n.count || 1 : 1);
