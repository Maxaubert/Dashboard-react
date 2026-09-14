import { test, expect, type Locator, type Page } from '@playwright/test';
import { mockDashboard, openLinks, sampleLinks } from './links.fixture';

test.beforeEach(async ({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== 'links-mocked', 'Run with tests/e2e/links.config.ts for isolated mock data.');
});

function card(section: Locator, name: string) {
  return section.locator('.ext-link').filter({ has: section.page().getByRole('link', { name, exact: true }) });
}

async function editLink(page: Page, target: Locator) {
  await target.click({ button: 'right' });
  await page.locator('.section-context-menu').getByText('Rediger', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Rediger lenke', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('favorites remain in their origin and toggle one stored item', async ({ page }) => {
  const store = await mockDashboard(page);
  const library = await openLinks(page);
  const favorites = library.locator('[data-category-id="__favorites"]');
  const coding = library.locator('[data-category-id="coding"]');
  const other = library.locator('[data-category-id="__other"]');

  await expect(card(favorites, 'GitHub')).toBeVisible();
  await expect(card(coding, 'GitHub')).toBeVisible();
  await expect(card(favorites, 'Uten kategori')).toBeVisible();
  await expect(card(other, 'Uten kategori')).toBeVisible();
  await card(coding, 'GitHub').getByRole('button', { name: 'Fjern favoritt' }).click();
  await expect(card(favorites, 'GitHub')).toHaveCount(0);
  await expect(card(coding, 'GitHub')).toBeVisible();
  await expect.poll(() => store.saved().links.find((link) => link.id === 'github')?.favorite).toBe(false);

  await card(coding, 'GitHub').getByRole('button', { name: 'Marker som favoritt' }).click();
  await expect(card(favorites, 'GitHub')).toBeVisible();
  await expect(card(coding, 'GitHub').getByRole('button', { name: 'Fjern favoritt' })).toBeVisible();
  await expect.poll(() => store.saved().links.find((link) => link.id === 'github')?.favorite).toBe(true);
  expect(store.saved().links.filter((link) => link.id === 'github')).toHaveLength(1);
  expect(store.saved().links.find((link) => link.id === 'github')?.category).toBe('coding');

  const dialog = await editLink(page, card(favorites, 'GitHub'));
  await expect(dialog.locator('.cat-picker-row').filter({ hasText: 'Utvikling' }).locator('.cat-picker-count')).toHaveText('1');
  await dialog.getByLabel('Navn', { exact: true }).fill('GitHub prosjekter');
  await dialog.locator('.lm-footer').getByRole('button', { name: 'Lagre', exact: true }).click();
  await expect(card(favorites, 'GitHub prosjekter')).toBeVisible();
  await expect(card(coding, 'GitHub prosjekter')).toBeVisible();
  await expect.poll(() => store.saved().links.find((link) => link.id === 'github')?.name).toBe('GitHub prosjekter');
  expect(store.writes.every((write) => new Set(write.links.map((link) => link.id)).size === write.links.length)).toBe(true);
});

for (const [name, id, category] of [['GitHub', 'github', 'coding'], ['YouTube', 'youtube', 'video']]) {
  test(`${name} icon can be searched, saved and restored`, async ({ page }) => {
    const store = await mockDashboard(page);
    let library = await openLinks(page);
    let target = card(library.locator(`[data-category-id="${category}"]`), name);
    let dialog = await editLink(page, target);
    await dialog.getByRole('button', { name: 'Ikoner', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Søk etter ikon' }).fill(name);
    await dialog.getByRole('button', { name, exact: true }).click();
    await expect(dialog.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Lagre', exact: true }).click();
    await expect.poll(() => store.saved().links.find((link) => link.id === id)?.iconValue).toBe(id);
    expect(store.saved().links.find((link) => link.id === id)?.iconType).toBe('svg');
    await expect(target.locator('.ext-link-icon-wrap svg')).toBeVisible();

    library = await openLinks(page);
    target = card(library.locator(`[data-category-id="${category}"]`), name);
    dialog = await editLink(page, target);
    await expect(dialog.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`${id}-icon-picker.png`), fullPage: true });
  });
}

test('hidden library scrollbar still allows wheel and keyboard scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mockDashboard(page, sampleLinks(36));
  const library = await openLinks(page);
  await expect(library).toHaveCSS('scrollbar-width', 'none');
  expect(await library.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await library.hover();
  await page.mouse.wheel(0, 650);
  await expect.poll(() => library.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await library.evaluate((element) => { element.scrollTop = 0; });
  await library.getByRole('button', { name: 'Ny lenke', exact: true }).focus();
  await page.keyboard.press('PageDown');
  await expect.poll(() => library.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await library.evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: test.info().outputPath('links-library.png'), fullPage: true });

  await page.keyboard.press('Escape');
  const todo = page.locator('.bento-card').filter({ has: page.getByRole('heading', { name: 'Todo', exact: true }) });
  await todo.getByRole('button', { name: /^vis alle$/i }).click();
  await expect(page.locator('[data-overlay="todo"]')).not.toHaveCSS('scrollbar-width', 'none');
});

test('library and icon picker remain usable in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page);
  let library = await openLinks(page);
  await expect(library.getByRole('button', { name: 'Ny lenke', exact: true })).toBeInViewport();
  expect(await library.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('links-library-narrow.png'), fullPage: true });

  // 640 x 360 CSS pixels exercises the layout space of 1280 x 720 at 200% zoom.
  await page.setViewportSize({ width: 640, height: 360 });
  library = await openLinks(page);
  await library.getByRole('button', { name: 'Ny lenke', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ny lenke', exact: true });
  await dialog.getByRole('button', { name: 'Ikoner', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Søk etter ikon' }).fill('GitHub');
  await dialog.getByRole('button', { name: 'GitHub', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'GitHub', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.lm-footer').getByRole('button', { name: 'Lagre', exact: true })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath('icon-picker-zoom-layout.png'), fullPage: true });
});
