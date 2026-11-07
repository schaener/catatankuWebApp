import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: { status: 'loading', user: null, error: null },
  reducers: {
    authChanged(state, { payload }) {
      state.user = payload;
      state.status = payload ? 'authenticated' : 'unauthenticated';
      state.error = null;
    },
    authError(state, { payload }) {
      state.error = payload;
    },
  },
});

export const { authChanged, authError } = authSlice.actions;
export default authSlice.reducer;

export const selectUser = (s) => s.auth.user;
export const selectAuthStatus = (s) => s.auth.status;
