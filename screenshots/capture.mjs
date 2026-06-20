// Capture current dashboard screenshots from the live site.
// Usage: E2E_EMAIL=you@example.com E2E_PASSWORD=secret node screenshots/capture.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'https://dashboard-react-mauve-alpha.vercel.app';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD env vars.');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

// Log in
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByPlaceholder(/e-?post/i).fill(EMAIL);
await page.getByPlaceholder(/passord/i).fill(PASSWORD);
await page.getByRole('button', { name: /logg inn/i }).click();
await page.waitForURL(`${BASE}/`, { timeout: 20000 });

// Wait for the wishlist covers to actually load (the function does Steam+ITAD work)
try {
  await page.waitForSelector('.wishlist-cover img', { timeout: 60000 });
  await page.waitForTimeout(3000); // let all cover images + prices settle
} catch {
  console.error('wishlist covers did not load in time; capturing anyway');
}
await page.waitForLoadState('networkidle').catch(() => {});
await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });
console.log('captured 01-home.png');

// Open the Gaming pop-out via the wishlist section "Alle" button
try {
  await page.getByRole('button', { name: /^Alle$/ }).first().click();
  // wait for the full wishlist grid to render inside the overlay
  await page.waitForSelector('.games-grid img', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/07-gaming.png' });
  console.log('captured 07-gaming.png');

  // Click the first game card to open the price-history modal
  await page.locator('.games-grid img').first().click();
  await page.waitForSelector('.gaming-modal-panel', { timeout: 15000 });
  await page.waitForTimeout(4000); // let the ITAD chart render
  await page.screenshot({ path: 'screenshots/07b-gaming-detail.png' });
  console.log('captured 07b-gaming-detail.png');
} catch (e) {
  console.error('gaming capture step failed (home shot still saved):', e.message);
}

await browser.close();
console.log('done');
