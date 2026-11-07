import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

/** Public profile (users/{uid}) used as the people directory by chat, split bill and squads. */
export function upsertProfile(user) {
  return setDoc(
    doc(db, 'users', user.uid),
    {
      displayName: user.displayName || user.email,
      displayNameLower: (user.displayName || user.email || '').toLowerCase(),
      email: user.email,
      photoURL: user.photoURL || null,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}
