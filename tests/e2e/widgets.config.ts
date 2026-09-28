import { defineConfig, devices } from '@playwright/test';

// Run: npx playwright test --config tests/e2e/widgets.config.ts
// All data uses a mocked browser-local backend, with no account credentials.
export default defineConfig({
  testDir: '.',
  testMatch: 'widgets.spec.ts',
  outputDir: '../../test-results/widgets',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5188',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'widgets-mocked', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://dashboard-widgets-e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dashboard-widgets-e2e-placeholder',
    },
  },
});
