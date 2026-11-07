/**
 * Cross-module intent: "open the entry editor with this draft". Any module can request it; the ledger
 * module mounts the single host that renders the editor (see ledger/components/ComposerHost.jsx).
 * Keeps modules decoupled the way an Android Intent or a super-app router would.
 *
 * draft: { raw?: notification, entry?: ledger entry, kind?: 'expense'|'income'|'transfer' } | null
 */
const listeners = new Set();

export function openComposer(draft = {}) {
  listeners.forEach((fn) => fn(draft));
}

export function onComposerRequest(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
