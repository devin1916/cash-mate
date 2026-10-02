import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the frontend talks to /api on its own origin and Vite forwards
// to the Express server, so cookies (refresh token) stay same-origin.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
