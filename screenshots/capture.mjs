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

async function openSection(heading, buttonName) {
  await page.locator('.section-header').filter({ hasText: heading }).getByRole('button', { name: buttonName }).first().click();
  await page.waitForSelector('.page-overlay-panel', { timeout: 15000 });
  await page.waitForTimeout(2800);
}
async function closeOverlay() {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.page-overlay-panel', { state: 'detached', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// Log in
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByPlaceholder(/e-?post/i).fill(EMAIL);
await page.getByPlaceholder(/passord/i).fill(PASSWORD);
await page.getByRole('button', { name: /logg inn/i }).click();
await page.waitForURL(`${BASE}/`, { timeout: 20000 });
await page.waitForSelector('.wishlist-cover img', { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle').catch(() => {});
await page.screenshot({ path: 'screenshots/01-home.png', fullPage: true });
console.log('captured 01-home.png');

// Todo pop-out
await openSection('Todo', /vis alle/i);
await page.screenshot({ path: 'screenshots/03-todo.png' });
console.log('captured 03-todo.png');
await closeOverlay();

// Plan (calendar) pop-out
await openSection('Dagens plan', /vis alle/i);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/02-plan.png' });
console.log('captured 02-plan.png');
await closeOverlay();

// Links pop-out
await openSection('Eksterne lenker', /^Alle$/);
await page.waitForTimeout(1500); // favicons
await page.screenshot({ path: 'screenshots/08-links.png' });
console.log('captured 08-links.png');
await closeOverlay();

// Gaming pop-out + price-history modal
try {
  await openSection('Steam', /^Alle$/);
  await page.waitForSelector('.games-grid img', { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshots/07-gaming.png' });
  console.log('captured 07-gaming.png');
  await page.locator('.games-grid img').first().click();
  await page.waitForSelector('.gaming-modal-panel', { timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'screenshots/07b-gaming-detail.png' });
  console.log('captured 07b-gaming-detail.png');
} catch (e) {
  console.error('gaming capture failed:', e.message);
}

await browser.close();
console.log('done');
