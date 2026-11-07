import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';
import { isNativeApp, native } from '../native.js';
import { authChanged, authError } from './authSlice.js';
import { api, REHYDRATE_CACHE } from '../api.js';
import { upsertProfile } from './profile.js';
import { clearPersistedCache, loadPersistedCache } from '../cachePersistence.js';

const pickUser = (u) =>
  u && { uid: u.uid, displayName: u.displayName || u.email, email: u.email, photoURL: u.photoURL || null };

/** Starts the Firebase auth listener and keeps Redux in sync. */
export const listenToAuth = () => (dispatch) => {
  if (!auth) {
    dispatch(authChanged(null));
    return () => {};
  }
  let first = true;
  return onAuthStateChanged(auth, (fbUser) => {
    const user = pickUser(fbUser);
    // Inside the Android app the phone is usually signed in already: reuse it silently.
    if (first && !user && isNativeApp && native.hasSession()) {
      first = false;
      dispatch(loginWithGoogle({ silent: true }));
      return;
    }
    first = false;
    if (user) {
      // Restore last session's cached data for this user before UI renders it.
      const cached = loadPersistedCache(user.uid);
      if (cached) dispatch({ type: REHYDRATE_CACHE, payload: cached });
      upsertProfile(user).catch((e) => console.warn('Profile sync failed', e));
    }
    dispatch(authChanged(user));
  });
};

/**
 * Browser: Google popup. Android app: Google blocks OAuth inside WebViews, so the shell signs in natively
 * (Credential Manager) and hands over a Google ID token that Firebase Web accepts.
 */
export const loginWithGoogle = ({ silent = false } = {}) => async (dispatch) => {
  try {
    if (isNativeApp) {
      const idToken = await native.signIn(silent);
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  } catch (e) {
    if (silent) dispatch(authChanged(null));
    else if (e?.code !== 'auth/popup-closed-by-user' && e?.message !== 'cancelled') dispatch(authError(e.message));
  }
};

export const logout = () => async (dispatch, getState) => {
  const uid = getState().auth.user?.uid;
  await signOut(auth);
  native.signOut();
  if (uid) clearPersistedCache(uid);
  dispatch(api.util.resetApiState());
};
