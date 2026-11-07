import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../../platform/firebase.js';
import { api, currentUser, run } from '../../../platform/api.js';
import { serializeDoc } from '../../../platform/serialize.js';
import { streamInto } from '../../../platform/stream.js';

/**
 * Phones running the Android companion app publish themselves to users/{uid}/devices/{deviceId}:
 * { name, osVersion, appVersion, lastSeen, listenerEnabled, batteryUnrestricted,
 *   installedApps: [{ packageName, label, suggested }], selected: [packageName] }.
 * Toggling `selected` here is picked up by the phone's listener in real time.
 */
const devicesCol = (uid) => collection(db, 'users', uid, 'devices');
const byLastSeen = (list) => [...list].sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

export const devicesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDevices: builder.query({
      queryFn: (_, { getState }) =>
        run(async () => byLastSeen((await getDocs(devicesCol(currentUser(getState).uid))).docs.map(serializeDoc))),
      async onCacheEntryAdded(_, ctx) {
        await streamInto(devicesCol(currentUser(ctx.getState).uid), ctx, byLastSeen);
      },
    }),
    // { deviceId, packages: string[], on: boolean }
    setDeviceApps: builder.mutation({
      queryFn: ({ deviceId, packages, on }, { getState }) =>
        run(async () => {
          const { uid } = currentUser(getState);
          await updateDoc(doc(devicesCol(uid), deviceId), { selected: (on ? arrayUnion : arrayRemove)(...packages) });
          return { deviceId };
        }),
      // Optimistic: the switch flips immediately, the snapshot listener confirms it.
      async onQueryStarted({ deviceId, packages, on }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          devicesApi.util.updateQueryData('getDevices', undefined, (draft) => {
            const d = draft.find((x) => x.id === deviceId);
            if (!d) return;
            const set = new Set(d.selected || []);
            packages.forEach((p) => (on ? set.add(p) : set.delete(p)));
            d.selected = [...set];
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    removeDevice: builder.mutation({
      queryFn: (deviceId, { getState }) =>
        run(async () => {
          await deleteDoc(doc(devicesCol(currentUser(getState).uid), deviceId));
          return { deviceId };
        }),
    }),
  }),
});

export const { useGetDevicesQuery, useSetDeviceAppsMutation, useRemoveDeviceMutation } = devicesApi;
