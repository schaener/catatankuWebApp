import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, run } from '../../../platform/api.js';
import { serializeDoc } from '../../../platform/serialize.js';

export const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Small user directory used by chat and split bill pickers.
    getUsers: builder.query({
      queryFn: () =>
        run(async () => {
          const snap = await getDocs(query(collection(db, 'users'), limit(500)));
          return snap.docs
            .map(serializeDoc)
            .map(({ id, displayName, email, photoURL }) => ({ uid: id, displayName, email, photoURL }));
        }),
      providesTags: [{ type: 'User', id: 'LIST' }],
      keepUnusedDataFor: 900,
    }),
  }),
});

export const { useGetUsersQuery } = usersApi;
