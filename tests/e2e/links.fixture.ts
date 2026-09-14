import { expect, type Page } from '@playwright/test';
import type { LinksEnvelope } from '../../src/api/types';

export function sampleLinks(extraLinks = 0): LinksEnvelope {
  return {
    version: 2,
    categories: [
      { id: '__favorites', name: 'Favoritter', order: 0 },
      { id: 'coding', name: 'Utvikling', order: 1 },
      { id: 'video', name: 'Video', order: 2 },
      { id: '__other', name: 'Annet', order: 3 },
    ],
    links: [
      { id: 'github', name: 'GitHub', url: 'https://github.com', category: 'coding', favorite: true, iconType: 'svg', iconValue: 'code' },
      { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', category: 'video', favorite: false, iconType: 'svg', iconValue: 'play' },
      { id: 'uncategorized', name: 'Uten kategori', url: 'https://example.com', favorite: true, iconType: 'svg', iconValue: 'globe' },
      ...Array.from({ length: extraLinks }, (_, i) => ({
        id: `extra-${i}`, name: `Ekstra lenke ${i + 1}`, url: `https://example.com/${i}`,
        category: 'video', iconType: 'svg' as const, iconValue: 'link',
      })),
    ],
  };
}

export async function mockDashboard(page: Page, initial = sampleLinks()) {
  let saved = structuredClone(initial);
  const writes: LinksEnvelope[] = [];
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'e2e-user', exp: expiresAt })).toString('base64url'),
    'mock-signature',
  ].join('.');
  await page.addInitScript(({ token, expiresAt }) => {
    localStorage.setItem('sb-dashboard-e2e-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'e2e-refresh-token',
      token_type: 'bearer',
      expires_at: expiresAt,
      expires_in: 3600,
      user: { id: 'e2e-user', email: 'e2e@example.com', user_metadata: { display_name: 'Test' } },
    }));
  }, { token, expiresAt });

  // Only Vite assets can leave this fixture. All data is local to this test.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/documents') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.kind === 'links') {
          saved = structuredClone(body.data as LinksEnvelope);
          writes.push(structuredClone(saved));
        }
        await route.fulfill({ status: 201, body: '' });
      } else {
        const kind = url.searchParams.get('kind')?.replace(/^eq\./, '');
        const data = kind === 'links' ? saved : kind === 'home'
          ? { version: 1, sections: [], hidden: ['prompt-launcher', 'wishlist', 'vaer', 'nyhetssaker'] }
          : [];
        await route.fulfill({ json: { data } });
      }
    } else if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ json: url.pathname === '/api/wishlist' ? { connected: false, games: [] } : [] });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  return { saved: () => saved, writes };
}

export async function openLinks(page: Page) {
  await page.goto('/');
  const homeCard = page.locator('.bento-card').filter({
    has: page.getByRole('heading', { name: 'Eksterne lenker', exact: true }),
  });
  await homeCard.getByRole('button', { name: /^alle$/i }).click();
  await expect(page.getByRole('dialog', { name: 'Lenker', exact: true })).toBeVisible();
  return page.locator('[data-overlay="links"]');
}
