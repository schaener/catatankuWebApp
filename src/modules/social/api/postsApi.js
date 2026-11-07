import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { serializeDoc } from '../../../platform/serialize.js';
import { streamInto } from '../../../platform/stream.js';
import { notifyComment, notifyLike } from './notificationsApi.js';

const feedQuery = (max) => query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(max));
const commentsQuery = (postId) => query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt'), limit(200));

export const postsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Real-time feed. Arg = page size (load more increases it).
    getFeed: builder.query({
      queryFn: (max = 30) => run(async () => (await getDocs(feedQuery(max))).docs.map(serializeDoc)),
      async onCacheEntryAdded(max = 30, ctx) {
        await streamInto(feedQuery(max), ctx);
      },
    }),
    getComments: builder.query({
      queryFn: (postId) => run(async () => (await getDocs(commentsQuery(postId))).docs.map(serializeDoc)),
      async onCacheEntryAdded(postId, ctx) {
        await streamInto(commentsQuery(postId), ctx);
      },
    }),
    createPost: builder.mutation({
      queryFn: ({ text, amount, category, mood, imageUrl }, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          const ref = await addDoc(collection(db, 'posts'), {
            text: text.trim(),
            amount: amount ? Math.round(Number(amount)) : null,
            category: category || null,
            mood: mood || null,
            imageUrl: imageUrl?.trim() || null,
            authorId: me.uid,
            authorName: me.displayName,
            authorPhoto: me.photoURL || null,
            likes: [],
            likeCount: 0,
            commentCount: 0,
            createdAt: serverTimestamp(),
          });
          return { id: ref.id };
        }),
    }),
    deletePost: builder.mutation({
      queryFn: (postId) =>
        run(async () => {
          await deleteDoc(doc(db, 'posts', postId));
          return { id: postId };
        }),
    }),
    toggleLike: builder.mutation({
      queryFn: ({ postId, liked, post }, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          await updateDoc(doc(db, 'posts', postId), {
            likes: liked ? arrayRemove(me.uid) : arrayUnion(me.uid),
            likeCount: increment(liked ? -1 : 1),
          });
          if (post) await notifyLike(me, post, !liked);
          return { postId };
        }),
      // Optimistic update across every cached feed page
      async onQueryStarted({ postId, liked }, { dispatch, getState, queryFulfilled }) {
        const { uid } = currentUser(getState);
        const patches = postsApi.util
          .selectCachedArgsForQuery(getState(), 'getFeed')
          .map((arg) =>
            dispatch(
              postsApi.util.updateQueryData('getFeed', arg, (draft) => {
                const p = draft.find((x) => x.id === postId);
                if (!p) return;
                p.likes = liked ? p.likes.filter((x) => x !== uid) : [...p.likes, uid];
                p.likeCount = p.likes.length;
              }),
            ),
          );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    addComment: builder.mutation({
      queryFn: ({ postId, text, post }, { getState }) =>
        run(async () => {
          const me = currentUser(getState);
          const batch = writeBatch(db);
          const ref = doc(collection(db, 'posts', postId, 'comments'));
          batch.set(ref, {
            text: text.trim(),
            authorId: me.uid,
            authorName: me.displayName,
            authorPhoto: me.photoURL || null,
            createdAt: serverTimestamp(),
          });
          batch.update(doc(db, 'posts', postId), { commentCount: increment(1) });
          await batch.commit();
          if (post) await notifyComment(me, post, ref.id, text.trim());
          return { id: ref.id };
        }),
    }),
    deleteComment: builder.mutation({
      queryFn: ({ postId, commentId }) =>
        run(async () => {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'posts', postId, 'comments', commentId));
          batch.update(doc(db, 'posts', postId), { commentCount: increment(-1) });
          await batch.commit();
          return { id: commentId };
        }),
    }),
  }),
});

export const {
  useGetFeedQuery,
  useGetCommentsQuery,
  useCreatePostMutation,
  useDeletePostMutation,
  useToggleLikeMutation,
  useAddCommentMutation,
  useDeleteCommentMutation,
} = postsApi;
