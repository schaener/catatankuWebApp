import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShareTargetsContext } from '../../../platform/shareTargets.js';
import { useGetMySquadsQuery, useGetShareRulesQuery } from '../api/squadsApi.js';

/** Supplies "Catat ke" targets (the user's squads) and per-app defaults to the ledger editor. */
export default function ShareTargetsProvider({ children }) {
  const signedIn = useSelector((s) => Boolean(s.auth.user));
  const { data: squads } = useGetMySquadsQuery(undefined, { skip: !signedIn });
  const { data: rules } = useGetShareRulesQuery(undefined, { skip: !signedIn });
  const targets = useMemo(() => (squads || []).map((s) => ({ id: s.id, name: s.name, emoji: s.emoji || '👥' })), [squads]);
  const defaultFor = useCallback((pkg) => {
    const id = rules?.[pkg];
    return id && targets.some((t) => t.id === id) ? id : null;
  }, [rules, targets]);
  const value = useMemo(() => ({ targets, defaultFor }), [targets, defaultFor]);
  return <ShareTargetsContext.Provider value={value}>{children}</ShareTargetsContext.Provider>;
}
