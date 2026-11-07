import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

/**
 * Firestore with IndexedDB persistence (cache layer #1).
 * Reads are served from the local cache when offline, and writes are queued
 * and synced automatically when the connection comes back. Works across tabs.
 */
function createDb(firebaseApp) {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn('IndexedDB persistence unavailable, falling back to memory cache', err);
    return initializeFirestore(firebaseApp, { localCache: memoryLocalCache() });
  }
}

export const db = app ? createDb(app) : null;

// `VITE_USE_EMULATORS=true` talks to `firebase emulators:start --only auth,firestore` on the page's host
// (so an Android emulator loading http://10.0.2.2:5173 reaches the emulators on the Mac too).
if (app && import.meta.env.VITE_USE_EMULATORS === 'true') {
  const host = import.meta.env.VITE_EMULATOR_HOST || window.location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
