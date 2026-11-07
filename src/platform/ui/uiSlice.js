import { createSlice, nanoid } from '@reduxjs/toolkit';
import { datePresets } from '../date.js';

const last30Days = datePresets()[2];

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    toasts: [],
    // Shared date range for search so it survives navigation
    searchRange: { from: last30Days.from, to: last30Days.to },
    // Pre-filled draft when sharing a transaction to the feed
    postDraft: null,
  },
  reducers: {
    toastAdded: {
      reducer(state, { payload }) {
        state.toasts.push(payload);
      },
      prepare: (message, kind = 'info') => ({ payload: { id: nanoid(), message, kind } }),
    },
    toastRemoved(state, { payload }) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
    searchRangeChanged(state, { payload }) {
      state.searchRange = payload;
    },
    postDraftSet(state, { payload }) {
      state.postDraft = payload;
    },
  },
});

export const { toastAdded, toastRemoved, searchRangeChanged, postDraftSet } = uiSlice.actions;
export default uiSlice.reducer;

/** Shows a toast and removes it after a few seconds. */
export const notify = (message, kind = 'info') => (dispatch) => {
  const action = dispatch(toastAdded(message, kind));
  setTimeout(() => dispatch(toastRemoved(action.payload.id)), 3500);
};
