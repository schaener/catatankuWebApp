import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import authReducer from '../platform/auth/authSlice.js';
import uiReducer from '../platform/ui/uiSlice.js';
import { api } from '../platform/api.js';
import { setupCachePersistence } from '../platform/cachePersistence.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefault) => getDefault().concat(api.middleware),
});

// Enables refetchOnFocus / refetchOnReconnect
setupListeners(store.dispatch);
setupCachePersistence(store);

// Handy for debugging in the browser console during development
if (import.meta.env.DEV) window.__store = store;
