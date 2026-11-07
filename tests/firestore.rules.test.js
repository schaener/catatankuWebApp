// Security rules tests. Run with the emulator: `npm run test:rules`.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, deleteField, doc, getDoc, getDocs, collection, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const OWNER = 'owner';
const FRIEND = 'friend';
const STRANGER = 'stranger';
const db = (uid) => env.authenticatedContext(uid).firestore();
const future = () => Timestamp.fromMillis(Date.now() + 86_400_000);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-catatanku-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const f = ctx.firestore();
    await setDoc(doc(f, 'squads/s1'), { name: 'Keluarga', emoji: '🏠', ownerId: OWNER, memberUids: [OWNER, FRIEND], members: { [OWNER]: { name: 'O', role: 'owner' }, [FRIEND]: { name: 'F', role: 'member' } }, inviteCode: 'ABC-DEFG' });
    await setDoc(doc(f, 'squadInvites/ABC-DEFG'), { squadId: 's1', expiresAt: future(), createdBy: OWNER });
    await setDoc(doc(f, 'squadInvites/OLD-CODE'), { squadId: 's1', expiresAt: Timestamp.fromMillis(Date.now() - 1000), createdBy: OWNER });
    await setDoc(doc(f, 'squads/s1/entries/t1'), { txId: 't1', ownerUid: FRIEND, amount: 1000, date: 1 });
  });
});

describe('squads', () => {
  it('members read the squad and its shared entries; strangers do not', async () => {
    await assertSucceeds(getDoc(doc(db(FRIEND), 'squads/s1')));
    await assertSucceeds(getDocs(collection(db(FRIEND), 'squads/s1/entries')));
    await assertFails(getDoc(doc(db(STRANGER), 'squads/s1')));
    await assertFails(getDocs(collection(db(STRANGER), 'squads/s1/entries')));
  });

  it('joining needs a valid, unexpired invite and may only add yourself', async () => {
    const join = (uid, code, extra = {}) =>
      updateDoc(doc(db(uid), 'squads/s1'), { memberUids: arrayUnion(uid), [`members.${uid}`]: { name: 'S', role: 'member' }, joinCode: code, ...extra });
    await assertFails(join(STRANGER, 'NOP-EXIST'));
    await assertFails(join(STRANGER, 'OLD-CODE'));
    await assertFails(join(STRANGER, 'ABC-DEFG', { name: 'hijacked' }));
    await assertFails(updateDoc(doc(db(STRANGER), 'squads/s1'), { memberUids: arrayUnion(STRANGER, 'other'), joinCode: 'ABC-DEFG' }));
    await assertSucceeds(join(STRANGER, 'ABC-DEFG'));
  });

  it('members may leave but not remove others; only the owner manages the squad', async () => {
    await assertFails(updateDoc(doc(db(FRIEND), 'squads/s1'), { memberUids: [FRIEND], [`members.${OWNER}`]: deleteField() }));
    await assertFails(updateDoc(doc(db(FRIEND), 'squads/s1'), { name: 'mine now' }));
    await assertSucceeds(updateDoc(doc(db(FRIEND), 'squads/s1'), { memberUids: [OWNER], [`members.${FRIEND}`]: deleteField() }));
    await assertSucceeds(updateDoc(doc(db(OWNER), 'squads/s1'), { name: 'Keluarga Besar' }));
  });

  it('shared entries are written only by their owner, as a member', async () => {
    const entry = (uid, id = 't2') => setDoc(doc(db(uid), `squads/s1/entries/${id}`), { txId: id, ownerUid: uid, amount: 5, date: 2 });
    await assertSucceeds(entry(OWNER));
    await assertFails(entry(STRANGER, 't3'));
    await assertFails(setDoc(doc(db(OWNER), 'squads/s1/entries/t1'), { txId: 't1', ownerUid: OWNER, amount: 1, date: 1 })); // someone else's
    await assertFails(setDoc(doc(db(OWNER), 'squads/s1/entries/t4'), { txId: 't4', ownerUid: FRIEND, amount: 1, date: 1 })); // impersonation
  });

  it('owner may clean up entries; invites are owner-managed and not listable', async () => {
    const owner = db(OWNER);
    await assertSucceeds(writeBatch(owner).delete(doc(owner, 'squads/s1/entries/t1')).commit());
    await assertSucceeds(getDoc(doc(db(STRANGER), 'squadInvites/ABC-DEFG')));
    await assertFails(getDocs(collection(db(STRANGER), 'squadInvites')));
    await assertFails(setDoc(doc(db(FRIEND), 'squadInvites/NEW-CODE'), { squadId: 's1', expiresAt: future() }));
    await assertSucceeds(setDoc(doc(db(OWNER), 'squadInvites/NEW-CODE'), { squadId: 's1', expiresAt: future() }));
  });

  it('private ledger data stays private', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `users/${FRIEND}/transactions/t1`), { amount: 1, squadId: 's1' }));
    await assertFails(getDoc(doc(db(OWNER), `users/${FRIEND}/transactions/t1`)));
    await assertFails(getDocs(collection(db(OWNER), `users/${FRIEND}/inbox`)));
  });
});
