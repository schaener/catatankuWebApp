import { createContext, useContext } from 'react';

/**
 * Dependency inversion between modules: the ledger asks "where can this entry be shared?" without
 * importing the squads module. The squads module provides the value (see squads/ShareTargetsProvider).
 *
 * targets:    [{ id, name, emoji }]
 * defaultFor: (appPackage) => targetId | null   (the user's "share everything from BCA to Keluarga" rules)
 */
export const ShareTargetsContext = createContext({ targets: [], defaultFor: () => null });
export const useShareTargets = () => useContext(ShareTargetsContext);
