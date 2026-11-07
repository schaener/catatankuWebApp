import { collection } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';

/** users/{uid}/inbox — owned by the capture module; the ledger only deletes / restores reviewed items. */
export const inboxCol = (uid) => collection(db, 'users', uid, 'inbox');
