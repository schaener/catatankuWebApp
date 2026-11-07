import {
  collection,
  doc,
  getDoc,
  getDocs,
  limitToLast,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { serializeDoc } from '../../../platform/serialize.js';
import { streamInto } from '../../../platform/stream.js';
import { notifyMessage } from './notificationsApi.js';

const chatsQuery = (uid) => query(collection(db, 'chats'), where('members', 'array-contains', uid));
const messagesQuery = (chatId) =>
  query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt'), limitToLast(200));
const byUpdated = (list) => [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getChats: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => byUpdated((await getDocs(chatsQuery(currentUser(getState).uid))).docs.map(serializeDoc))),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(chatsQuery(currentUser(ctx.getState).uid), ctx, byUpdated);
      },
    }),
    getMessages: builder.query({
      queryFn: (chatId) => run(async () => (await getDocs(messagesQuery(chatId))).docs.map(serializeDoc)),
      async onCacheEntryAdded(chatId, ctx) {
        await streamInto(messagesQuery(chatId), ctx);
      },
    }),
    // Opens (or creates) a chat room. Direct chats use a deterministic id.
    startChat: builder.mutation({
      queryFn: ({ users, name }, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          const all = [me, ...users.filter((u) => u.uid !== me.uid)];
          const isDirect = all.length === 2;
          const ref = isDirect
            ? doc(db, 'chats', all.map((u) => u.uid).sort().join('_'))
            : doc(collection(db, 'chats'));
          if (isDirect && (await getDoc(ref)).exists()) return { id: ref.id };
          await setDoc(ref, {
            members: all.map((u) => u.uid),
            memberInfo: Object.fromEntries(
              all.map((u) => [u.uid, { displayName: u.displayName || u.email, photoURL: u.photoURL || null }]),
            ),
            isGroup: !isDirect,
            name: isDirect ? null : name?.trim() || all.map((u) => u.displayName?.split(' ')[0]).join(', '),
            lastMessage: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return { id: ref.id };
        }),
    }),
    sendMessage: builder.mutation({
      queryFn: ({ chatId, text, chat }, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          const batch = writeBatch(db);
          const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
          batch.set(msgRef, {
            text: text.trim(),
            senderId: me.uid,
            senderName: me.displayName,
            createdAt: serverTimestamp(),
          });
          batch.update(doc(db, 'chats', chatId), {
            lastMessage: { text: text.trim().slice(0, 120), senderId: me.uid, senderName: me.displayName },
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
          if (chat) await notifyMessage(me, chat, text.trim());
          return { id: msgRef.id };
        }),
    }),
  }),
});

export const { useGetChatsQuery, useGetMessagesQuery, useStartChatMutation, useSendMessageMutation } = chatApi;
