import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { reportsDevPlugin } from './vite-plugins/reports';

// Vite config for the dashboard.
//
// Dev:    `npm run dev`     → http://localhost:5173, /api/* proxied to api.py on 3001
// Build:  `npm run build`   → emits /dist for nginx to serve from /opt/dashboard/www/
//
// In production, nginx serves dist/ as static files and proxies /api/* to api.py
// on 127.0.0.1:3001 (already configured in server/nginx.conf), so no host hardcoding
// is needed in the React code — every fetch uses a relative path.
export default defineConfig({
  plugins: [react(), tailwindcss(), reportsDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // /api/tools still lives on the tools_api.py Flask sidecar (port
      // 5002), reached through the production nginx. The site is HTTPS
      // now (Let's Encrypt on the sslip.io host) and port 80 redirects,
      // so dev must target the https origin directly. /api/notes used to
      // be a sidecar route too, but Phase 4 folded it into api.py — it
      // now falls through to the /api catch-all below.
      '/api/tools': {
        target: 'https://37-27-210-14.sslip.io',
        changeOrigin: true,
        // Long-running ops (yt-dlp, rembg, ffmpeg) need a generous
        // timeout — match the production nginx 1800s.
        timeout: 1_800_000,
        proxyTimeout: 1_800_000,
      },
      // Everything else goes straight to api.py on its dedicated port
      // (HTTP, behind nginx in prod but reachable directly in dev).
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
    include: ['src/**/*.vitest.ts', 'vite-plugins/**/*.vitest.ts'],
  },
});
