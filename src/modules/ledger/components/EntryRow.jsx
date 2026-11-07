import { memo, useRef } from 'react';
import { AppAvatar, Tag } from '../../../platform/ui/kit.jsx';
import { formatIDR } from '../../../platform/format.js';
import { openComposer } from '../../../platform/composer.js';
import { entryTitle } from '../logic/entries.js';

export function signedAmount(e) {
  if (e.amount == null) return 'Rp ?';
  const sign = e.kind === 'income' ? '+' : e.kind === 'expense' ? '−' : '';
  return sign + formatIDR(e.amount);
}

function subtitle(e) {
  const account = e.kind === 'transfer' && e.toApp ? `${e.app.name} → ${e.toApp.name}` : e.app.name;
  return [account, e.place && e.kind !== 'transfer' ? e.category : null, e.origin === 'app' && !e.legacy ? 'input manual' : null].filter(Boolean).join(' · ');
}

/** Long-press (touch) or right-click opens the quick menu; tap edits. */
function useLongPress(onLong, ms = 450) {
  const timer = useRef(0);
  const fired = useRef(false);
  const clear = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      fired.current = false;
      timer.current = setTimeout(() => {
        fired.current = true;
        navigator.vibrate?.(10);
        onLong();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => {
      e.preventDefault();
      clear();
      fired.current = true;
      onLong();
    },
    wasLong: () => fired.current,
  };
}

/** Ledger row used by Beranda, Laporan and Squad lists. */
export const EntryRow = memo(function EntryRow({ entry, showStatus = true }) {
  const { wasLong, ...press } = useLongPress(() => openComposer({ mode: 'menu', entry }));
  return (
    <button type="button" className="k-row" {...press} onClick={() => !wasLong() && openComposer({ mode: 'edit', entry })}>
      <AppAvatar app={entry.app} size={38} />
      <div className="k-main">
        <div className="k-title">{entryTitle(entry)}</div>
        <div className="k-meta">
          {subtitle(entry)}
          {entry.movedFrom && (
            <>
              {' '}
              <Tag tone="violet">dipindah dari {entry.movedFrom.name}</Tag>
            </>
          )}
        </div>
      </div>
      <div className="k-end">
        <span className={`k-amount ${entry.kind || ''}`}>{signedAmount(entry)}</span>
        {showStatus && (entry.pending ? <Tag tone="warn">Menunggu</Tag> : entry.squadId ? <Tag tone="good">Squad</Tag> : <Tag tone="good">Disimpan</Tag>)}
      </div>
    </button>
  );
});
