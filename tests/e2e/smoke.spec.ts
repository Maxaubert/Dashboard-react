import { test, expect } from '@playwright/test';

test('login → data pages → integrations load', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/e-?post|email/i).fill(process.env.E2E_EMAIL!);
  await page.getByLabel(/passord|password/i).fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: /logg inn|login/i }).click();
  await expect(page).toHaveURL('http://localhost:3000/');

  // CRUD pages render without 401/404.
  for (const path of ['/todo', '/plan', '/notes', '/links']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText(/401|Unauthorized|Not Found/i);
  }

  // Integration functions respond.
  const news = await page.request.get('/api/news?source=nrk&count=3');
  expect(news.ok()).toBeTruthy();
  const wishlist = await page.request.get('/api/wishlist');
  expect(wishlist.ok()).toBeTruthy();
});
