import { defineConfig, devices } from '@playwright/test';

// Isolated frontend regression suite. No credentials or Vercel functions needed.
// Run: npx playwright test --config tests/e2e/links.config.ts
export default defineConfig({
  testDir: '.',
  testMatch: 'links.spec.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'links-mocked', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://dashboard-e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dashboard-e2e-placeholder',
    },
  },
});
