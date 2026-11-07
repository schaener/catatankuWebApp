import { useEffect, useState } from 'react';
import { onComposerRequest } from '../../../platform/composer.js';
import { blankEntry, fromRaw } from '../logic/entries.js';
import { EntryActionSheet, EntryEditor, MoveAppSheet } from './EntrySheets.jsx';

/**
 * The one place entry sheets are rendered, mounted by the app shell (manifest `providers`).
 * Any module opens them with platform/composer.openComposer({ mode, entry | raw }).
 */
export default function ComposerHost({ children }) {
  const [req, setReq] = useState(null);
  useEffect(() => onComposerRequest(setReq), []);
  const close = () => setReq(null);

  let sheet = null;
  if (req) {
    const entry = req.entry ?? (req.raw ? fromRaw(req.raw) : { ...blankEntry(), kind: req.kind ?? 'expense' });
    if (req.mode === 'menu') sheet = <EntryActionSheet entry={entry} onClose={close} onEdit={() => setReq({ mode: 'edit', entry })} onMove={() => setReq({ mode: 'move', entry })} />;
    else if (req.mode === 'move') sheet = <MoveAppSheet entry={entry} onClose={close} />;
    // key: a new request always starts from fresh form state
    else sheet = <EntryEditor key={`${entry.store}:${entry.id}:${Date.now()}`} entry={entry} onClose={close} />;
  }
  return (
    <>
      {children}
      {sheet}
    </>
  );
}
