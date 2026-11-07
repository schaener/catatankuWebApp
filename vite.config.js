import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demo = (p) => fileURLToPath(new URL(`./src/demo/${p}`, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `vite build --mode demo` swaps Firebase for an in-browser fake with sample data
  base: mode === 'demo' ? './' : '/',
  resolve: {
    alias:
      mode === 'demo'
        ? {
            'firebase/app': demo('app.js'),
            'firebase/auth': demo('auth.js'),
            'firebase/firestore': demo('firestore.js'),
          }
        : {},
  },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: mode === 'demo' ? { codeSplitting: false } : {
        // Long-lived vendor chunks for caching; everything else (incl. recharts, used by one lazy
        // page) is split automatically along dynamic imports so it never blocks the first paint.
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|react-redux|@reduxjs|redux|immer|reselect)\//.test(id)) return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
}));
