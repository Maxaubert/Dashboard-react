# Per-user Steam Wishlist (Sign in through Steam) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user connect their Steam account via OpenID so the Gaming page shows their own wishlist, using one shared app Steam key.

**Architecture:** A new `integrations` table stores each user's SteamID (RLS owner-only). Two Vercel functions run the Steam OpenID flow (`/api/steam/login` mints a signed-state redirect URL; `/api/steam/callback` verifies with Steam and stores the SteamID). `/api/wishlist` becomes per-user: it authenticates the caller's Supabase JWT, looks up their SteamID, and builds the wishlist with the shared key. Connection read + disconnect are direct RLS-scoped Supabase calls from the browser.

**Tech Stack:** Vercel Node ESM functions (`@vercel/node`), `@supabase/supabase-js` (service-role + anon), Node `crypto` (HMAC), React + react-query, vitest.

## Global Constraints

- No em-dashes anywhere (code, comments, commits). No emojis.
- UI strings Norwegian (nb-NO).
- Commit trailer exactly: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch: `feat/steam-connect`. Issue: #21.
- `api/**` functions are ESM: relative imports MUST use explicit `.js` extensions (see existing `api/*.ts`). Compiled per `api/tsconfig.json` (module ESNext, moduleResolution bundler).
- vitest only collects `*.vitest.ts`. New tests use that suffix.
- Secrets reaching the browser must be `VITE_`-prefixed. `STEAM_API_KEY`, `STEAM_OPENID_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ITAD_API_KEY` are function-only (no `VITE_`).
- `npm run typecheck` and `npm test` must pass before each commit; the migration apply and the live Steam redirect are the only steps needing external services.
- Supabase migrations: new numbered file only; never edit an applied one.

---

## Task 1: `integrations` table migration

**Files:**
- Create: `supabase/migrations/0002_integrations.sql`

**Interfaces:**
- Produces: table `public.integrations(user_id uuid PK default auth.uid(), steam_id text not null, connected_at timestamptz)`, RLS owner-only policy `integrations_owner`.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0002_integrations.sql`:
```sql
-- Per-user external integration links. Currently: Steam (SteamID64).
create table if not exists public.integrations (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  steam_id     text not null,
  connected_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
create policy integrations_owner on public.integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply to the remote Supabase via the session pooler**

The DB password is in `.env.local` as `SUPABASE_DB_PASSWORD` (gitignored). Run:
```bash
set -a; . ./.env.local; set +a
echo "y" | npx supabase db push \
  --db-url "postgresql://postgres.oqmpxijorciweubsjoiq:${SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```
Expected: `Applying migration 0002_integrations.sql...` then `Finished supabase db push.` (a Docker cache warning is harmless).

- [ ] **Step 3: Verify it registered**

```bash
set -a; . ./.env.local; set +a
npx supabase migration list \
  --db-url "postgresql://postgres.oqmpxijorciweubsjoiq:${SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" 2>/dev/null | grep -E "0001|0002"
```
Expected: both `0001` and `0002` show matching Local | Remote columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_integrations.sql
git commit -m "$(printf 'feat: integrations table for per-user SteamID\n\nRLS owner-only; one row per user holding their connected SteamID64.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: Steam OpenID helper lib

**Files:**
- Create: `api/_lib/steamOpenid.ts`
- Test: `api/_lib/steamOpenid.vitest.ts`

**Interfaces:**
- Produces (all from `api/_lib/steamOpenid.js`):
  - `signState(userId: string, expMs: number, secret: string): string` -> `"<userId>.<expMs>.<sig>"`
  - `verifyState(state: string, secret: string, nowMs: number): string | null` -> userId or null
  - `buildAuthUrl(base: string, state: string): string`
  - `extractSteamId(claimedId: string): string | null` -> 17-digit id or null
  - `verifyWithSteam(params: URLSearchParams, fetchImpl?: typeof fetch): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

`api/_lib/steamOpenid.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { signState, verifyState, extractSteamId, buildAuthUrl, verifyWithSteam } from './steamOpenid.js';

const SECRET = 'test-secret';

describe('state sign/verify', () => {
  it('round-trips a valid, unexpired state', () => {
    const exp = 10_000;
    const s = signState('user-1', exp, SECRET);
    expect(verifyState(s, SECRET, 9_000)).toBe('user-1');
  });
  it('rejects an expired state', () => {
    const s = signState('user-1', 10_000, SECRET);
    expect(verifyState(s, SECRET, 11_000)).toBeNull();
  });
  it('rejects a tampered state', () => {
    const s = signState('user-1', 10_000, SECRET);
    const tampered = s.replace('user-1', 'user-2');
    expect(verifyState(tampered, SECRET, 9_000)).toBeNull();
  });
  it('rejects a wrong secret', () => {
    const s = signState('user-1', 10_000, SECRET);
    expect(verifyState(s, 'other', 9_000)).toBeNull();
  });
});

describe('extractSteamId', () => {
  it('pulls the 17-digit id from a claimed_id url', () => {
    expect(extractSteamId('https://steamcommunity.com/openid/id/76561197960287930')).toBe('76561197960287930');
  });
  it('returns null for a non-matching url', () => {
    expect(extractSteamId('https://example.com/foo')).toBeNull();
  });
});

describe('buildAuthUrl', () => {
  it('targets steam OpenID with our return_to + realm', () => {
    const url = buildAuthUrl('https://app.example.com', 'STATE');
    expect(url.startsWith('https://steamcommunity.com/openid/login?')).toBe(true);
    const qs = new URL(url).searchParams;
    expect(qs.get('openid.mode')).toBe('checkid_setup');
    expect(qs.get('openid.return_to')).toBe('https://app.example.com/api/steam/callback?state=STATE');
    expect(qs.get('openid.realm')).toBe('https://app.example.com');
  });
});

describe('verifyWithSteam', () => {
  it('returns true when Steam says is_valid:true', async () => {
    const stub = (async () => ({ ok: true, text: async () => 'ns:...\nis_valid:true\n' })) as unknown as typeof fetch;
    const params = new URLSearchParams({ 'openid.sig': 'x' });
    expect(await verifyWithSteam(params, stub)).toBe(true);
  });
  it('returns false otherwise', async () => {
    const stub = (async () => ({ ok: true, text: async () => 'is_valid:false\n' })) as unknown as typeof fetch;
    expect(await verifyWithSteam(new URLSearchParams(), stub)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run api/_lib/steamOpenid.vitest.ts`
Expected: FAIL — cannot find `./steamOpenid.js`.

- [ ] **Step 3: Implement `api/_lib/steamOpenid.ts`**

```ts
import crypto from 'node:crypto';

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signState(userId: string, expMs: number, secret: string): string {
  const payload = `${userId}.${expMs}`;
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifyState(state: string, secret: string, nowMs: number): string | null {
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = hmac(`${userId}.${expStr}`, secret);
  // constant-time compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expStr) < nowMs) return null;
  return userId;
}

export function buildAuthUrl(base: string, state: string): string {
  const returnTo = `${base}/api/steam/callback?state=${encodeURIComponent(state)}`;
  const qs = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': base,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID}?${qs.toString()}`;
}

export function extractSteamId(claimedId: string): string | null {
  const m = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId);
  return m ? m[1] : null;
}

export async function verifyWithSteam(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const body = new URLSearchParams(params);
  body.set('openid.mode', 'check_authentication');
  const res = await fetchImpl(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  return /is_valid\s*:\s*true/.test(text);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/_lib/steamOpenid.vitest.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck` (PASS), then:
```bash
git add api/_lib/steamOpenid.ts api/_lib/steamOpenid.vitest.ts
git commit -m "$(printf 'feat: Steam OpenID helper lib\n\nState HMAC sign/verify, auth-URL builder, claimed_id SteamID extraction,\nand server-side check_authentication verification.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: OpenID functions (`/api/steam/login`, `/api/steam/callback`)

**Files:**
- Create: `api/steam/login.ts`
- Create: `api/steam/callback.ts`

**Interfaces:**
- Consumes: `signState`, `verifyState`, `buildAuthUrl`, `extractSteamId`, `verifyWithSteam` from `../_lib/steamOpenid.js`; `admin` from `../_lib/supabaseAdmin.js`.
- Produces: `GET /api/steam/login` -> `{ url }`; `GET /api/steam/callback` -> 302 redirect to `/gaming?steam=connected|error`.

- [ ] **Step 1: Implement `api/steam/login.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../_lib/supabaseAdmin.js';
import { signState, buildAuthUrl } from '../_lib/steamOpenid.js';

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const secret = process.env.STEAM_OPENID_SECRET as string;
  const state = signState(data.user.id, Date.now() + 10 * 60_000, secret);
  res.status(200).json({ url: buildAuthUrl(baseUrl(req), state) });
}
```

- [ ] **Step 2: Implement `api/steam/callback.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from '../_lib/supabaseAdmin.js';
import { verifyState, extractSteamId, verifyWithSteam } from '../_lib/steamOpenid.js';

function baseUrl(req: VercelRequest): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = baseUrl(req);
  const fail = () => res.redirect(302, `${base}/gaming?steam=error`);
  try {
    const params = new URLSearchParams(req.query as Record<string, string>);
    const userId = verifyState(String(req.query.state ?? ''), process.env.STEAM_OPENID_SECRET as string, Date.now());
    if (!userId) return fail();
    if (!(await verifyWithSteam(params))) return fail();
    const steamId = extractSteamId(String(req.query['openid.claimed_id'] ?? ''));
    if (!steamId) return fail();
    const { error } = await admin
      .from('integrations')
      .upsert({ user_id: userId, steam_id: steamId, connected_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) return fail();
    res.redirect(302, `${base}/gaming?steam=connected`);
  } catch {
    fail();
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (These functions are thin wrappers over the Task 2 lib, which is unit-tested; the live OpenID round-trip is verified manually in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add api/steam/login.ts api/steam/callback.ts
git commit -m "$(printf 'feat: Steam OpenID login + callback functions\n\nlogin mints a signed-state redirect URL for the authed user; callback\nverifies with Steam + the state, then upserts the SteamID.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: Per-user wishlist function

**Files:**
- Modify: `api/_lib/wishlist.ts` (ITAD optional)
- Modify: `api/wishlist.ts` (auth + per-user + connected flag)
- Test: `api/_lib/wishlist.vitest.ts` (add an ITAD-skip case)

**Interfaces:**
- Consumes: `admin` from `./_lib/supabaseAdmin.js`; `buildWishlist` from `./_lib/wishlist.js`; `getCached` from `./_lib/cache.js`.
- Produces: `GET /api/wishlist` (Bearer JWT) -> `{ connected: boolean; games: WishlistGame[] }`.

- [ ] **Step 1: Add the ITAD-skip test**

Append to `api/_lib/wishlist.vitest.ts` a case that asserts no ITAD calls happen when `itadKey` is empty:
```ts
import { describe, it, expect, vi } from 'vitest';
import { buildWishlist } from './wishlist.js';

describe('buildWishlist ITAD optional', () => {
  it('skips ITAD lookups when itadKey is empty', async () => {
    const calls: string[] = [];
    const stub = (async (url: string) => {
      calls.push(url);
      const json = (o: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') } as Response);
      if (url.includes('GetWishlist')) return json({ response: { items: [{ appid: 10, priority: 1, date_added: 1 }] } });
      if (url.includes('appdetails')) return json({ '10': { success: true, data: { name: 'A', price_overview: { discount_percent: 60, final: 100, final_formatted: 'kr 1', initial_formatted: 'kr 2', currency: 'NOK' }, genres: [] } } });
      return json({});
    }) as unknown as typeof fetch;
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: '' }, stub);
    expect(games).toHaveLength(1);
    expect(games[0].itadId).toBeNull();
    expect(calls.some((u) => u.includes('isthereanydeal'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run api/_lib/wishlist.vitest.ts`
Expected: FAIL — current code calls ITAD even with an empty key (`calls` includes an isthereanydeal URL).

- [ ] **Step 3: Make ITAD optional in `api/_lib/wishlist.ts`**

Guard both ITAD loops so they no-op without a key. Change the start of Step 4's loop (around line 91) and Step 5's loop (around line 106) so each is wrapped:
```ts
  // Step 4: ITAD lookup -> itadId for each game (only if an ITAD key is configured)
  if (env.itadKey) {
    for (const g of games) {
      try {
        const url = `https://api.isthereanydeal.com/games/lookup/v1?key=${env.itadKey}&appid=${g.appid}`;
        const res = await fetchImpl(url);
        const data = (await res.json()) as { game?: { id?: string } };
        const gid = data?.game?.id ?? null;
        if (gid) g.itadId = gid;
      } catch { /* continue */ }
    }

    // Step 5: hot-tag on-sale games at their all-time low
    for (const g of games) {
      if (!g.onSale || !g.itadId) continue;
      try {
        const url = `https://api.isthereanydeal.com/games/history/v2?key=${env.itadKey}&id=${g.itadId}&shops=61&since=${ATL_SINCE}`;
        const res = await fetchImpl(url);
        const raw = await res.json();
        const cuts = (raw as Array<{ deal?: { cut: number } }>).filter((p) => p.deal).map((p) => p.deal!.cut);
        if (cuts.length > 0) {
          const bestCut = Math.max(...cuts);
          if (bestCut > 0 && g.discount >= bestCut - 5) g.priceTag = 'hot';
        }
      } catch { /* continue */ }
    }
  }
```
(Wrap the two existing loops in `if (env.itadKey) { ... }`; keep the sort step after.)

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run api/_lib/wishlist.vitest.ts`
Expected: PASS (the new case + the existing mapping/sort/hot test).

- [ ] **Step 5: Rewrite `api/wishlist.ts` to be per-user**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { admin } from './_lib/supabaseAdmin.js';
import { buildWishlist } from './_lib/wishlist.js';
import { getCached } from './_lib/cache.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const { data: udata, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !udata.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const { data: row } = await admin
    .from('integrations')
    .select('steam_id')
    .eq('user_id', udata.user.id)
    .maybeSingle();
  if (!row?.steam_id) {
    res.status(200).json({ connected: false, games: [] });
    return;
  }
  const env = {
    steamKey: process.env.STEAM_API_KEY as string,
    steamId: row.steam_id as string,
    itadKey: (process.env.ITAD_API_KEY as string) || '',
  };
  try {
    const games = await getCached(`wishlist:${udata.user.id}`, 60 * 60_000, () => buildWishlist(env));
    res.status(200).json({ connected: true, games });
  } catch {
    res.status(200).json({ connected: true, games: [] });
  }
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npm run typecheck` (PASS), then:
```bash
git add api/_lib/wishlist.ts api/_lib/wishlist.vitest.ts api/wishlist.ts
git commit -m "$(printf 'feat: per-user wishlist function\n\nAuthenticates the caller JWT, reads their stored SteamID, builds the\nwishlist with the shared key, and returns {connected, games}. ITAD\nenrichment is skipped when no ITAD key is set.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: Frontend connect flow + Gaming page

**Files:**
- Create: `src/api/steam.ts`
- Modify: `src/api/wishlist.ts` (auth header + `{connected, games}`)
- Modify: `src/hooks/useWishlist.ts` (no signature change needed; data shape changes)
- Modify: `src/pages/GamingPage.tsx` (connect/disconnect UI + new data shape)

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`.
- Produces: `steamApi.{ getConnection(): Promise<{connected:boolean; steamId:string|null}>, startConnect(): Promise<void>, disconnect(): Promise<void> }`; `wishlistApi.list(): Promise<{ connected: boolean; games: WishlistGame[] }>`.

- [ ] **Step 1: Create `src/api/steam.ts`**

```ts
import { supabase } from '@/lib/supabase';

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export const steamApi = {
  getConnection: async (): Promise<{ connected: boolean; steamId: string | null }> => {
    const { data, error } = await supabase.from('integrations').select('steam_id').maybeSingle();
    if (error) throw error;
    return { connected: !!data?.steam_id, steamId: (data?.steam_id as string) ?? null };
  },

  startConnect: async (): Promise<void> => {
    const res = await fetch('/api/steam/login', { headers: { Authorization: `Bearer ${await bearer()}` } });
    if (!res.ok) throw new Error(`steam login ${res.status}`);
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  },

  disconnect: async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { error } = await supabase.from('integrations').delete().eq('user_id', data.user.id);
    if (error) throw error;
  },
};
```

- [ ] **Step 2: Update `src/api/wishlist.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { WishlistGame } from './types';

export interface WishlistResponse {
  connected: boolean;
  games: WishlistGame[];
}

export const wishlistApi = {
  list: async (): Promise<WishlistResponse> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? '';
    const res = await fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`wishlist ${res.status}`);
    return res.json();
  },
};
```

- [ ] **Step 3: Add a Steam connection query hook**

In `src/hooks/useWishlist.ts`, add below the existing hook:
```ts
import { steamApi } from '@/api/steam';

export function useSteamConnection() {
  return useQuery({
    queryKey: ['steam-connection'],
    queryFn: steamApi.getConnection,
    staleTime: 5 * 60_000,
  });
}
```
(Keep the existing `useWishlist` as-is; its `data` is now a `WishlistResponse`.)

- [ ] **Step 4: Update `GamingPage.tsx` for the new data shape + connect UI**

Replace the top of `GamingPage` (lines 22-31) and the wishlist-tab conditional (lines 61-91 region) so it reads connection + the `{connected, games}` shape and shows a Connect button when not connected. New `GamingPage` header/body:

```tsx
import { useWishlist, useSteamConnection } from '@/hooks/useWishlist';
import { steamApi } from '@/api/steam';
// ...existing imports...

export function GamingPage() {
  const { data: conn } = useSteamConnection();
  const { data: wl, isLoading, error } = useWishlist();
  const [tab, setTab] = useState<Tab>('wishlist');
  const [activeGame, setActiveGame] = useState<WishlistGame | null>(null);

  const connected = wl?.connected ?? conn?.connected ?? false;
  const games = wl?.games ?? [];
  const onSale = useMemo(() => games.filter((g) => g.onSale).sort((a, b) => b.discount - a.discount), [games]);
  const regular = useMemo(() => games.filter((g) => !g.onSale), [games]);

  // ...keep the page-header + filter-bar markup, but change the count line to use `games`...
```

For the wishlist tab body, replace the conditional with:
```tsx
      {tab === 'wishlist' ? (
        !connected && !isLoading ? (
          <div className="gaming-state-box">
            <p>Koble til Steam for å vise ønskelisten din.</p>
            <p style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Ønskelisten din på Steam må være satt til offentlig.
            </p>
            <button className="gaming-filter-btn active" style={{ marginTop: '1rem' }} onClick={() => steamApi.startConnect()}>
              Koble til Steam
            </button>
          </div>
        ) : error ? (
          <div className="gaming-state-box">Kunne ikke laste ønskeliste.</div>
        ) : isLoading ? (
          <div className="gaming-state-box">Laster ønskeliste…</div>
        ) : games.length === 0 ? (
          <div className="gaming-state-box">Ønskelisten er tom (er den satt til offentlig på Steam?).</div>
        ) : (
          <>
            {/* keep the existing onSale + regular grids exactly as they were */}
          </>
        )
      ) : (
        <EventsTab />
      )}
```

Also: read the `?steam=` query param once on mount and surface a toast, then strip it:
```tsx
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('steam');
    if (p === 'connected') { /* show success toast via the app Toast */ }
    if (p === 'error') { /* show error toast */ }
    if (p) window.history.replaceState({}, '', '/gaming');
  }, []);
```
Use the app's existing `useToast()` (from `src/components/ui`) for the messages: success "Steam koblet til" / error "Kunne ikke koble til Steam". Add a small "Koble fra" button near the header when `connected` that calls `steamApi.disconnect()` then invalidates the `['steam-connection']` and wishlist queries.

- [ ] **Step 5: Typecheck + build + tests**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS (71+ tests; no consumer of the old bare-array wishlist remains).

- [ ] **Step 6: Commit**

```bash
git add src/api/steam.ts src/api/wishlist.ts src/hooks/useWishlist.ts src/pages/GamingPage.tsx
git commit -m "$(printf 'feat: Steam connect UI + per-user wishlist on the Gaming page\n\nAdds steamApi (connect/disconnect/connection), sends the auth header on\nwishlist fetch, and shows a Connect Steam button when not linked, with a\npublic-wishlist hint and connect/error toasts.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: Env setup, deploy, and live verification

**Files:**
- Modify: `.env.example` (add `STEAM_OPENID_SECRET`; note `STEAM_ID` removed)
- Modify: `.env.local` (gitignored — add the shared key + secret)

**Interfaces:** none.

- [ ] **Step 1: Owner generates the shared Steam Web API key**

At steamcommunity.com/dev/apikey (domain can be the Vercel URL). This is a MANUAL owner step. Capture the key.

- [ ] **Step 2: Generate the OpenID state secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- [ ] **Step 3: Put both in `.env.local`** (gitignored)

Add/replace:
```
STEAM_API_KEY=<the shared key>
STEAM_OPENID_SECRET=<the generated secret>
```
(`STEAM_ID` is no longer used; remove it if present.) Add `STEAM_OPENID_SECRET=` (empty) to `.env.example`.

- [ ] **Step 4: Set the Vercel production env vars**

```bash
set -a; . ./.env.local; set +a
SCOPE="max01230aub-7964s-projects"
for V in STEAM_API_KEY STEAM_OPENID_SECRET; do
  printf '%s' "${!V}" | vercel env add "$V" production --scope "$SCOPE"
done
```
(If a var already exists, `vercel env rm <NAME> production --yes --scope ...` first.) `ITAD_API_KEY` is optional; add it the same way only if the owner wants the price-tag/chart features.

- [ ] **Step 5: Deploy**

```bash
vercel --prod --yes --scope "max01230aub-7964s-projects"
```
Expected: Build Completed, ready.

- [ ] **Step 6: Manual live verification**

On `https://dashboard-react-mauve-alpha.vercel.app`:
1. Log in, go to Gaming -> see "Koble til Steam".
2. Click it -> redirected to the real Steam login -> authorize -> redirected back to `/gaming?steam=connected` with a success toast.
3. The wishlist loads (ensure your Steam wishlist is Public). If empty, confirm the privacy setting.
4. `curl` the function with no auth returns 401; with a valid session it returns `{connected:true,...}`.
5. "Koble fra" clears the connection and the Connect button returns.

- [ ] **Step 7: Commit the env-example change**

```bash
git add .env.example
git commit -m "$(printf 'chore: document STEAM_OPENID_SECRET, drop STEAM_ID\n\nSteamID is per-user now; the shared Steam key + OpenID state secret are\nthe function env vars.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Shared key + per-user SteamID model -> Tasks 4, 6.
- `integrations` table + RLS -> Task 1.
- OpenID login (signed state) + callback (verify + store) -> Tasks 2, 3.
- Per-user wishlist function with `{connected}` flag -> Task 4.
- Connection read + disconnect via RLS from browser -> Task 5 (`steamApi`).
- Gaming page connect button + public-wishlist hint + toasts -> Task 5.
- ITAD optional/global -> Task 4 (Step 3 guard) + Task 6 (optional env).
- Env setup (shared key, OpenID secret), STEAM_ID removed -> Task 6.
- Testing: lib unit tests + ITAD-skip + manual Steam redirect -> Tasks 2, 4, 6.
All spec sections map to a task.

**Placeholder scan:** The GamingPage edit (Task 5 Step 4) references "keep the existing onSale + regular grids exactly as they were" and the toast wiring in prose rather than repeating the ~25 unchanged grid lines; this is a targeted edit to a known 365-line file (lines cited), not a missing implementation. Every new module (steamOpenid, steam.ts, both functions, wishlist changes) has complete code.

**Type consistency:** `signState/verifyState/buildAuthUrl/extractSteamId/verifyWithSteam` signatures match between Task 2 (definition) and Task 3 (use). `WishlistResponse {connected, games}` is produced by Task 4's function and consumed identically in Task 5 (`wl?.connected`, `wl?.games`). `buildWishlist(env, fetchImpl?)` signature unchanged; only its ITAD branch is guarded. `integrations(user_id, steam_id)` columns match across Task 1 (schema), Task 3 (upsert), Task 4 (select), Task 5 (delete/select).
