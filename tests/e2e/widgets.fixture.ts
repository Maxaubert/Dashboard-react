import type { Page } from '@playwright/test';

/** Intentionally lacks widget arrays to exercise an existing user's document. */
export const existingHome = {
  version: 1,
  sections: ['todo', 'dagens-plan', 'ext-lenker'],
  hidden: ['prompt-launcher', 'wishlist', 'vaer', 'nyhetssaker'],
};

export async function mockWidgetDashboard(
  page: Page,
  initial: Record<string, unknown> = existingHome,
) {
  let home = structuredClone(initial);
  const writes: Record<string, unknown>[] = [];
  const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
  const token = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'widgets-e2e-user', exp: expiresAt })).toString('base64url'),
    'mock-signature',
  ].join('.');
  await page.addInitScript(({ token, expiresAt }) => {
    localStorage.setItem('sb-dashboard-widgets-e2e-auth-token', JSON.stringify({
      access_token: token,
      refresh_token: 'widgets-e2e-refresh-token',
      token_type: 'bearer',
      expires_at: expiresAt,
      expires_in: 86_400,
      user: { id: 'widgets-e2e-user', email: 'widgets-e2e@example.com', user_metadata: { display_name: 'Test' } },
    }));
  }, { token, expiresAt });

  // Keep the whole fixture offline except for local Vite assets.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/documents') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON();
        if (body.kind === 'home') {
          home = structuredClone(body.data as Record<string, unknown>);
          writes.push(structuredClone(home));
        }
        await route.fulfill({ status: 201, body: '' });
      } else {
        const kind = url.searchParams.get('kind')?.replace(/^eq\./, '');
        await route.fulfill({ json: { data: kind === 'home' ? home : [] } });
      }
    } else if (url.pathname.startsWith('/api/')) {
      await route.fulfill({ json: url.pathname === '/api/wishlist' ? { connected: false, games: [] } : [] });
    } else if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  return { saved: () => home, writes };
}
