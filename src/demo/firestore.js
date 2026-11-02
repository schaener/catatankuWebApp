// In-browser stand-in for the parts of `firebase/firestore` this app uses.
// Only bundled in the demo build (vite --mode demo aliases firebase/firestore here).
import { seedDatabase, scheduleAutoReply } from './seed.js';

const KEY = 'catatan-keuangan:demo-db:v2'; // bump when seed data changes shape
const store = new Map();
const listeners = new Set();
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
let autoId = 0;
const newId = () => `${Date.now().toString(36)}${(autoId++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...store.entries()]));
  } catch {
    /* storage unavailable: demo still works in memory */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      for (const [k, v] of JSON.parse(raw)) store.set(k, v);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ---- refs
const join = (parts) => parts.flat().filter((p) => p != null && p !== '').join('/');
export function collection(base, ...segs) {
  const prefix = base?.path ? [base.path] : [];
  return { type: 'collection', path: join([...prefix, ...segs]) };
}
export function doc(base, ...segs) {
  if (base?.type === 'collection') {
    const id = segs[0] ?? newId();
    return { type: 'doc', path: `${base.path}/${id}`, id };
  }
  const path = join(segs);
  return { type: 'doc', path, id: path.split('/').pop() };
}
export const query = (col, ...constraints) => ({ type: 'query', path: col.path, constraints });
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const limit = (n) => ({ kind: 'limit', n });
export const limitToLast = (n) => ({ kind: 'limitToLast', n });

// ---- sentinels
export const serverTimestamp = () => ({ __op: 'ts' });
export const increment = (n) => ({ __op: 'inc', n });
export const arrayUnion = (...v) => ({ __op: 'union', v });
export const arrayRemove = (...v) => ({ __op: 'remove', v });

function resolve(prev = {}, data) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && v.__op) {
      if (v.__op === 'ts') out[k] = Date.now();
      else if (v.__op === 'inc') out[k] = (Number(prev[k]) || 0) + v.n;
      else if (v.__op === 'union') out[k] = [...new Set([...(prev[k] || []), ...v.v])];
      else if (v.__op === 'remove') out[k] = (prev[k] || []).filter((x) => !v.v.includes(x));
    } else out[k] = clone(v);
  }
  return out;
}

// ---- snapshots
const docSnap = (path, data) => ({
  id: path.split('/').pop(),
  exists: () => data !== undefined,
  data: () => clone(data),
});

function runQuery(q) {
  const depth = q.path.split('/').length + 1;
  let rows = [...store.entries()]
    .filter(([p]) => p.startsWith(`${q.path}/`) && p.split('/').length === depth)
    .map(([p, d]) => ({ p, d }));
  const cs = q.constraints || [];
  for (const c of cs.filter((x) => x.kind === 'where')) {
    rows = rows.filter(({ d }) => {
      const v = d[c.field];
      if (c.op === '==') return v === c.value;
      if (c.op === '>=') return v >= c.value;
      if (c.op === '<=') return v <= c.value;
      if (c.op === 'array-contains') return Array.isArray(v) && v.includes(c.value);
      return true;
    });
  }
  const ob = cs.find((x) => x.kind === 'orderBy');
  if (ob) rows.sort((a, b) => ((a.d[ob.field] ?? 0) - (b.d[ob.field] ?? 0)) * (ob.dir === 'desc' ? -1 : 1));
  const lim = cs.find((x) => x.kind === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  const last = cs.find((x) => x.kind === 'limitToLast');
  if (last) rows = rows.slice(-last.n);
  return { docs: rows.map(({ p, d }) => docSnap(p, d)) };
}

// ---- change notification
let pending = false;
function changed() {
  persist();
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    for (const l of listeners) l.fire();
  });
}

function write(path, data) {
  store.set(path, data);
  scheduleAutoReply(path, data, api);
}

// ---- reads & writes
export async function getDoc(ref) {
  await delay();
  return docSnap(ref.path, store.get(ref.path));
}
export async function getDocs(q) {
  await delay();
  return runQuery(q.type === 'collection' ? { path: q.path, constraints: [] } : q);
}
export async function addDoc(col, data) {
  await delay();
  const ref = doc(col);
  write(ref.path, resolve({}, data));
  changed();
  return ref;
}
export async function setDoc(ref, data, opts) {
  await delay();
  write(ref.path, resolve(opts?.merge ? store.get(ref.path) : {}, data));
  changed();
}
export async function updateDoc(ref, data) {
  await delay();
  if (!store.has(ref.path)) throw Object.assign(new Error('Dokumen tidak ditemukan'), { code: 'not-found' });
  write(ref.path, resolve(store.get(ref.path), data));
  changed();
}
export async function deleteDoc(ref) {
  await delay();
  store.delete(ref.path);
  changed();
}
export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data, opts) => ops.push(() => write(ref.path, resolve(opts?.merge ? store.get(ref.path) : {}, data))),
    update: (ref, data) => ops.push(() => write(ref.path, resolve(store.get(ref.path), data))),
    delete: (ref) => ops.push(() => store.delete(ref.path)),
    async commit() {
      await delay();
      ops.forEach((op) => op());
      changed();
    },
  };
}
export async function runTransaction(_db, fn) {
  await delay();
  const result = await fn({
    get: async (ref) => docSnap(ref.path, store.get(ref.path)),
    update: (ref, data) => write(ref.path, resolve(store.get(ref.path), data)),
    set: (ref, data) => write(ref.path, resolve({}, data)),
  });
  changed();
  return result;
}
export function onSnapshot(target, next) {
  const l = {
    fire: () =>
      next(target.type === 'doc' ? docSnap(target.path, store.get(target.path)) : runQuery(target)),
  };
  listeners.add(l);
  setTimeout(() => listeners.has(l) && l.fire(), 0);
  return () => listeners.delete(l);
}

// ---- init (no-op config)
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const memoryLocalCache = () => ({});
export const initializeFirestore = () => ({ demo: true });
export const getFirestore = () => ({ demo: true });

const api = { store, write, changed, newId };

export function resetDemoData() {
  store.clear();
  seedDatabase(store);
  changed();
}

if (!load()) {
  seedDatabase(store);
  persist();
}
