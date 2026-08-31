import { test, expect, type Page } from '@playwright/test';

// Smoke test for the single-page app: log in, see the bento, open every
// pop-out, and hit both Vercel functions. Needs a real dashboard login in
// E2E_EMAIL / E2E_PASSWORD (env or .env.local, see .env.example).
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

// Each home card is a `.bento-card` with an `<h2>` and a `.ch-link` button
// that opens the matching page in the PageOverlay pop-out.
const OVERLAYS = [
  { heading: 'Todo', button: /^vis alle$/i },
  { heading: 'Dagens plan', button: /^vis alle$/i },
  { heading: 'Eksterne lenker', button: /^alle$/i },
  { heading: 'Ønskeliste', button: /^alle$/i },
];

test.skip(!EMAIL || !PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD (see .env.example)');

// supabase-js persists the session in localStorage under
// `sb-<project-ref>-auth-token`; /api/wishlist wants that access token.
async function sessionToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    try {
      const session = JSON.parse(localStorage.getItem(key) ?? 'null') as { access_token?: string } | null;
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  });
}

test('login, bento, pop-outs and functions', async ({ page }) => {
  // Login form has placeholder-only inputs (LoginPage.tsx).
  await page.goto('/login');
  await page.getByPlaceholder('E-post').fill(EMAIL!);
  await page.getByPlaceholder('Passord').fill(PASSWORD!);
  await page.getByRole('button', { name: /^logg inn$/i }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

  // The bento home renders.
  await expect(page.locator('.bento-home')).toBeVisible();
  await expect(page.locator('.bento-card').first()).toBeVisible();

  // Every visible card opens its page in the overlay and Escape closes it.
  const panel = page.locator('.page-overlay-panel');
  for (const { heading, button } of OVERLAYS) {
    const card = page
      .locator('.bento-card')
      .filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
    if ((await card.count()) === 0) {
      test.info().annotations.push({ type: 'hidden-card', description: `${heading} er skjult i innstillingene` });
      continue;
    }
    await card.getByRole('button', { name: button }).click();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  }

  // Integration functions respond.
  const news = await page.request.get('/api/news?source=nrk&count=3');
  expect(news.ok(), '/api/news').toBeTruthy();

  const token = await sessionToken(page);
  expect(token, 'Supabase session token in localStorage').toBeTruthy();
  const wishlist = await page.request.get('/api/wishlist', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(wishlist.ok(), '/api/wishlist').toBeTruthy();
});
