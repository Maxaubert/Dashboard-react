import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { reportsDevPlugin } from './vite-plugins/reports';

// Vite config for the dashboard.
//
// Dev:    `npm run dev`     → http://localhost:5173 (no proxy; API now lives in Vercel functions)
// Build:  `npm run build`   → emits /dist for Vercel to serve as a static SPA
export default defineConfig({
  plugins: [react(), tailwindcss(), reportsDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  // Only pick up *.vitest.ts files. Several pre-existing *.test.ts files use
  // a custom tsx-based runner (process.exit) and aren't vitest-compatible.
  test: {
    include: ['src/**/*.vitest.ts', 'vite-plugins/**/*.vitest.ts', 'api/**/*.vitest.ts'],
  },
});
