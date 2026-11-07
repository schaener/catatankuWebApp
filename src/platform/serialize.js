/**
 * Firestore returns Timestamp objects which are not serializable in Redux.
 * Convert every Timestamp (anything with toMillis) to epoch milliseconds.
 */
export function normalize(value) {
  if (value == null) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

export function serializeDoc(snap) {
  return normalize({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) });
}
