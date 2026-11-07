/**
 * Pure, side-effect-free public API of the capture module (no Firebase, no React).
 * Other modules' domain logic and unit tests import this instead of index.js.
 */
export { parseNotification, parseCached, findTransferPairs, findAmount, isWallet, paymentMethodFor } from './logic/notifParser.js';
export { ruleFor } from './logic/rules.js';
