import {
  arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { streamInto } from '../../../platform/stream.js';
import { squadEntriesCol, txCol } from '../../ledger/index.js';

/**
 * squads/{id}            { name, emoji, ownerId, memberUids[], members{uid:{name,photo,role}}, inviteCode, createdAt }
 * squads/{id}/entries    read model of shared transactions (written by each owner, see ledger/commands)
 * squadInvites/{code}    { squadId, expiresAt } — lets non-members find a squad by code
 * users/{uid}/meta/shareRules { rules: { [appPackage]: squadId } } — "share everything from BCA to Keluarga"
 */
const squadsCol = () => collection(db, 'squads');
const squadRef = (id) => doc(db, 'squads', id);
const inviteRef = (code) => doc(db, 'squadInvites', code);
const shareRulesRef = (uid) => doc(db, 'users', uid, 'meta', 'shareRules');
const INVITE_DAYS = 7;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const s = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}
const expiry = () => Timestamp.fromMillis(Date.now() + INVITE_DAYS * 86_400_000);
const memberOf = (user, role) => ({ name: user.displayName || user.email || 'Anggota', photo: user.photoURL || null, role });

export const squadsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getMySquads: builder.query({
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded(_, ctx) {
        const { uid } = currentUser(ctx.getState);
        await streamInto(query(squadsCol(), where('memberUids', 'array-contains', uid)), ctx, (list) =>
          list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
      },
    }),
    /** Shared entries of one squad since `sinceMs`. */
    getSquadEntries: builder.query({
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded({ squadId, sinceMs }, ctx) {
        await streamInto(query(squadEntriesCol(squadId), where('date', '>=', sinceMs)), ctx);
      },
    }),
    getShareRules: builder.query({
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(shareRulesRef(currentUser(ctx.getState).uid), ctx, (d) => d?.rules ?? {});
      },
    }),
    setShareRule: builder.mutation({
      queryFn: ({ appPackage, squadId }, { getState }) =>
        run(async () => {
          await setDoc(shareRulesRef(currentUser(getState).uid), { rules: { [appPackage]: squadId || deleteField() } }, { merge: true });
          return appPackage;
        }),
    }),
    createSquad: builder.mutation({
      queryFn: ({ name, emoji }, { getState }) =>
        run(async () => {
          const user = currentUser(getState);
          const ref = doc(squadsCol());
          const code = newInviteCode();
          const batch = writeBatch(db);
          batch.set(ref, {
            name: name.trim(), emoji, ownerId: user.uid, memberUids: [user.uid], members: { [user.uid]: memberOf(user, 'owner') },
            inviteCode: code, createdAt: serverTimestamp(),
          });
          batch.set(inviteRef(code), { squadId: ref.id, expiresAt: expiry(), createdBy: user.uid });
          await batch.commit();
          return ref.id;
        }),
    }),
    joinSquad: builder.mutation({
      queryFn: (rawCode, { getState }) =>
        run(async () => {
          const user = currentUser(getState);
          const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{3})(.+)$/, '$1-$2');
          const invite = await getDoc(inviteRef(code));
          if (!invite.exists() || invite.data().expiresAt.toMillis() < Date.now()) throw new Error('Kode undangan tidak valid atau sudah kedaluwarsa');
          const { squadId } = invite.data();
          // rules allow adding exactly yourself, proving the invite via `joinCode`
          await updateDoc(squadRef(squadId), { memberUids: arrayUnion(user.uid), [`members.${user.uid}`]: memberOf(user, 'member'), joinCode: code });
          return squadId;
        }),
    }),
    renameSquad: builder.mutation({
      queryFn: ({ squadId, name, emoji }) => run(async () => updateDoc(squadRef(squadId), { name: name.trim(), emoji }).then(() => squadId)),
    }),
    rotateInvite: builder.mutation({
      queryFn: ({ squadId, oldCode }, { getState }) =>
        run(async () => {
          const code = newInviteCode();
          const batch = writeBatch(db);
          batch.set(inviteRef(code), { squadId, expiresAt: expiry(), createdBy: currentUser(getState).uid });
          if (oldCode) batch.delete(inviteRef(oldCode));
          batch.update(squadRef(squadId), { inviteCode: code });
          await batch.commit();
          return code;
        }),
    }),
    /** Leave (uid = self) or remove a member (owner). Their shared entries leave with them. */
    removeMember: builder.mutation({
      queryFn: ({ squadId, uid }, { getState }) =>
        run(async () => {
          const me = currentUser(getState).uid;
          const entries = await getDocs(query(squadEntriesCol(squadId), where('ownerUid', '==', uid)));
          const batch = writeBatch(db);
          entries.docs.forEach((d) => batch.delete(d.ref));
          batch.update(squadRef(squadId), { memberUids: arrayRemove(uid), [`members.${uid}`]: deleteField() });
          // leaving yourself: your own transactions become private again
          if (uid === me) {
            const mine = await getDocs(query(txCol(me), where('squadId', '==', squadId)));
            mine.docs.forEach((d) => batch.update(d.ref, { squadId: null }));
          }
          await batch.commit();
          return uid;
        }),
    }),
    deleteSquad: builder.mutation({
      queryFn: ({ squadId, inviteCode }) =>
        run(async () => {
          const entries = await getDocs(squadEntriesCol(squadId));
          const batch = writeBatch(db);
          entries.docs.forEach((d) => batch.delete(d.ref));
          if (inviteCode) batch.delete(inviteRef(inviteCode));
          await batch.commit();
          await deleteDoc(squadRef(squadId));
          return squadId;
        }),
    }),
  }),
});

export const {
  useGetMySquadsQuery, useGetSquadEntriesQuery, useGetShareRulesQuery, useSetShareRuleMutation, useCreateSquadMutation,
  useJoinSquadMutation, useRenameSquadMutation, useRotateInviteMutation, useRemoveMemberMutation, useDeleteSquadMutation,
} = squadsApi;
