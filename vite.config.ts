import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Vite config for the dashboard.
//
// Dev:    `npm run dev`     → http://localhost:5173, /api/* proxied to api.py on 3001
// Build:  `npm run build`   → emits /dist for nginx to serve from /opt/dashboard/www/
//
// In production, nginx serves dist/ as static files and proxies /api/* to api.py
// on 127.0.0.1:3001 (already configured in server/nginx.conf), so no host hardcoding
// is needed in the React code — every fetch uses a relative path.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // /api/notes, /api/cart and /api/tools live on separate Flask
      // services (notes_api.py on 5001, tools_api.py on 5002). In
      // production nginx routes them through; in dev we hit the
      // production nginx directly on port 80 so we don't need to run
      // a local Flask process. If your nginx requires basic auth, set
      // the VITE_DEV_BASIC_AUTH env var to "user:pass".
      '/api/notes': {
        target: 'http://37.27.210.14',
        changeOrigin: true,
        auth: process.env.VITE_DEV_BASIC_AUTH,
      },
      '/api/cart': {
        target: 'http://37.27.210.14',
        changeOrigin: true,
        auth: process.env.VITE_DEV_BASIC_AUTH,
      },
      '/api/tools': {
        target: 'http://37.27.210.14',
        changeOrigin: true,
        auth: process.env.VITE_DEV_BASIC_AUTH,
        // Long-running ops (yt-dlp, rembg, ffmpeg) need a generous
        // timeout — match the production nginx 600s.
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      // Everything else goes straight to api.py on its dedicated port.
      '/api': {
        target: 'http://37.27.210.14:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // Only pick up *.vitest.ts files. Several pre-existing *.test.ts files use
  // a custom tsx-based runner (process.exit) and aren't vitest-compatible.
  test: {
    include: ['src/**/*.vitest.ts'],
  },
});
