import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
// Vite config for the dashboard.
//
// Dev:    `npm run dev`     → http://localhost:5173 (no proxy; API now lives in Vercel functions)
// Build:  `npm run build`   → emits /dist for Vercel to serve as a static SPA
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
  // Unit tests are co-located as *.vitest.ts next to the code they cover.
  test: {
    include: ['src/**/*.vitest.ts', 'api/**/*.vitest.ts'],
  },
});
