import { manifest as insights } from '../modules/insights/index.js';
import { manifest as review } from '../modules/review/index.js';
import { manifest as squads } from '../modules/squads/index.js';
import { manifest as ledger } from '../modules/ledger/index.js';
import { manifest as capture } from '../modules/capture/index.js';
import { manifest as social } from '../modules/social/index.js';

/**
 * The module registry. Adding a squad's feature to the app = one line here; routes, navigation,
 * badges and providers come from its manifest.
 */
export const MODULES = [insights, review, squads, ledger, capture, social];

export const ROUTES = MODULES.flatMap((m) => m.routes);
export const NAV = MODULES.flatMap((m) => m.nav).sort((a, b) => a.order - b.order);
export const PRIMARY_NAV = NAV.filter((n) => n.primary).slice(0, 4);
export const MORE_NAV = NAV.filter((n) => !PRIMARY_NAV.includes(n));
export const PROVIDERS = MODULES.flatMap((m) => m.providers);
