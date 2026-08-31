// Capture the README screenshots from the live site.
// Usage: E2E_EMAIL=you@example.com E2E_PASSWORD=secret node screenshots/capture.mjs
// Writes the four files README.md embeds, next to this script:
//   01-login.png, home.png, calendar.png, game-detail.png
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'https://dashboard-react-mauve-alpha.vercel.app';
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set E2E_EMAIL and E2E_PASSWORD env vars.');
  process.exit(1);
}

const OUT = fileURLToPath(new URL('.', import.meta.url));
const out = (name) => `${OUT}${name}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });

// Each home card is a `.bento-card` with an `<h2>` heading and a `.ch-link`
// button ("Vis alle" / "Alle") that opens the page in the PageOverlay.
async function openOverlay(heading, buttonName) {
  const card = page
    .locator('.bento-card')
    .filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
  await card.getByRole('button', { name: buttonName }).first().click();
  await page.waitForSelector('.page-overlay-panel', { timeout: 15000 });
  await page.waitForTimeout(2800);
}
async function closeOverlay() {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.page-overlay-panel', { state: 'detached', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
}

// Login page (before the form is filled)
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // galaxy shell settles
await page.screenshot({ path: out('01-login.png') });
console.log('captured 01-login.png');

// Log in
await page.getByPlaceholder('E-post').fill(EMAIL);
await page.getByPlaceholder('Passord').fill(PASSWORD);
await page.getByRole('button', { name: /^logg inn$/i }).click();
await page.waitForURL(`${BASE}/`, { timeout: 20000 });

// Home (bento)
await page.waitForSelector('.bento-card', { timeout: 30000 });
await page.waitForSelector('.gtile img', { timeout: 60000 }).catch(() => {}); // wishlist covers
await page.waitForTimeout(3000);
await page.waitForLoadState('networkidle').catch(() => {});
await page.screenshot({ path: out('home.png'), fullPage: true });
console.log('captured home.png');

// Plan (calendar) pop-out
await openOverlay('Dagens plan', /^vis alle$/i);
await page.waitForTimeout(1500);
await page.screenshot({ path: out('calendar.png') });
console.log('captured calendar.png');
await closeOverlay();

// Gaming pop-out, then the price-history modal for the first game
try {
  await openOverlay('Ønskeliste', /^alle$/i);
  await page.waitForSelector('.games-grid img', { timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.locator('.games-grid img').first().click();
  await page.waitForSelector('.gaming-modal-panel', { timeout: 15000 });
  await page.waitForTimeout(4000); // price-history chart
  await page.screenshot({ path: out('game-detail.png') });
  console.log('captured game-detail.png');
} catch (e) {
  console.error('game-detail capture failed (Steam connected and wishlist public?):', e.message);
}

await browser.close();
console.log('done');
