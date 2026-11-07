import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { streamInto } from '../../../platform/stream.js';

/**
 * users/{uid}/meta/appRules: { rules: [{ fromPackage, keyword, toPackage, toName }] }
 * "Notifications from GoPay mentioning INDOMARET belong to DANA" — created from the move sheet.
 */
const rulesDoc = (uid) => doc(db, 'users', uid, 'meta', 'appRules');

export const appRulesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAppRules: builder.query({
      queryFn: () => ({ data: null }),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(rulesDoc(currentUser(ctx.getState).uid), ctx, (d) => d?.rules ?? []);
      },
    }),
    addAppRule: builder.mutation({
      queryFn: (rule, { getState }) =>
        run(async () => {
          await setDoc(rulesDoc(currentUser(getState).uid), { rules: arrayUnion(rule) }, { merge: true });
          return rule;
        }),
    }),
    removeAppRule: builder.mutation({
      queryFn: (rule, { getState }) =>
        run(async () => {
          await setDoc(rulesDoc(currentUser(getState).uid), { rules: arrayRemove(rule) }, { merge: true });
          return rule;
        }),
    }),
  }),
});

export const { useGetAppRulesQuery, useAddAppRuleMutation, useRemoveAppRuleMutation } = appRulesApi;
