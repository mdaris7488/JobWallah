import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the browser talks to Vite (5173) and Vite proxies /api -> Express (5000).
// Same-origin => the httpOnly refresh cookie just works, no CORS pain.
export default defineConfig({
  plugins: [react()],
  build: { target: 'esnext' }, // pdf.js (PDF -> Image tool) uses modern syntax
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true } },
  },
});
