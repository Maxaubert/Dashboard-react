import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
// Vite config for the dashboard.
//
// Dev:    `npm run dev`     -> http://localhost:5173 (no proxy; API now lives in Vercel functions)
// Build:  `npm run build`   -> emits /dist for Vercel to serve as a static SPA
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase/')) return 'vendor-supabase';
          if (id.includes('@phosphor-icons/') || id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
          if (id.includes('@dnd-kit/')) return 'vendor-dnd';
          return 'vendor';
        },
      },
    },
  },
  // Unit tests are co-located as *.vitest.ts next to the code they cover.
  test: {
    include: ['src/**/*.vitest.ts', 'api/**/*.vitest.ts'],
  },
});
