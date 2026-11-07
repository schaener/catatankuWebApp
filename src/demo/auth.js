// In-browser stand-in for `firebase/auth` (demo build only).
import { DEMO_USER } from './seed.js';

const KEY = 'catatan-keuangan:demo-auth';
const subs = new Set();
let current = null;
try {
  if (localStorage.getItem(KEY)) current = DEMO_USER;
} catch {
  /* ignore */
}

function set(user) {
  current = user;
  try {
    if (user) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  subs.forEach((cb) => cb(current));
}

export const getAuth = () => ({ demo: true });
export class GoogleAuthProvider {
  setCustomParameters() {}
  static credential(idToken) {
    return { idToken };
  }
}

export const connectAuthEmulator = () => {};
export const signInWithCredential = (...args) => signInWithPopup(...args);
export function onAuthStateChanged(_auth, cb) {
  subs.add(cb);
  setTimeout(() => subs.has(cb) && cb(current), 0);
  return () => subs.delete(cb);
}
export async function signInWithPopup() {
  await new Promise((r) => setTimeout(r, 300));
  set(DEMO_USER);
  return { user: DEMO_USER };
}
export async function signOut() {
  set(null);
}
