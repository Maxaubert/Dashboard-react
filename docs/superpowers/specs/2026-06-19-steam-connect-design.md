# Per-user Steam wishlist via "Sign in through Steam"

Date: 2026-06-19
Status: Approved design, pending spec review
Branch: `feat/steam-connect` (off `feat/vercel-supabase-migration`)
Issue: #21 (builds on #20)

## Goal

Make the Gaming wishlist per-user. A user clicks "Connect Steam", authenticates
through Steam's OpenID login, and we capture their SteamID64. The app uses one
shared Steam Web API key to fetch that user's public wishlist by SteamID. No
per-user API keys; no key typing.

## Key facts that shape the design

- Steam has **no OAuth** that grants an app a Web API token. The only login is
  **OpenID 2.0** ("Sign in through Steam"), which returns the user's SteamID64
  and nothing else.
- A Steam Web API key is **not tied to the wishlist owner**: any valid key can
  read any user's *public* wishlist given their SteamID. So one shared app key
  + per-user SteamID is sufficient.
- Requirement surfaced in the UI: the user's Steam **wishlist must be Public**,
  or `IWishlistService/GetWishlist` returns nothing.

## Architecture overview

```
Gaming page
  ├── getConnection()  ── supabase (anon, RLS) ─► integrations row (own steam_id)   [direct, no function]
  ├── "Connect Steam"  ── fetch /api/steam/login (Bearer JWT) ─► {url} ─► browser redirect to Steam
  │        Steam OpenID ─► GET /api/steam/callback ── verify w/ Steam + signed state ─► upsert integrations (service role) ─► redirect /gaming?steam=connected
  ├── disconnect()     ── supabase (anon, RLS) ─► delete own integrations row        [direct, no function]
  └── wishlistApi.list() ── fetch /api/wishlist (Bearer JWT) ─► { connected, games }
                                  └─ verify JWT ─► user_id ─► steam_id (service role) ─► buildWishlist(SHARED_KEY, steam_id) ─► cache wishlist:<user_id>
```

Two new functions (`/api/steam/login`, `/api/steam/callback`); `/api/wishlist`
modified. Connection read + disconnect are plain RLS-scoped Supabase calls from
the browser (no function needed).

## Data model

Migration `supabase/migrations/0002_integrations.sql`:

```sql
create table if not exists public.integrations (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  steam_id     text not null,
  connected_at timestamptz not null default now()
);
alter table public.integrations enable row level security;
create policy integrations_owner on public.integrations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

One row per user. RLS owner-only so the browser can read its own SteamID and
delete it; the service-role functions bypass RLS. (Never edit an applied
migration; this is a new numbered file.)

## OpenID flow

Steam OpenID endpoint: `https://steamcommunity.com/openid/login`.

### `GET /api/steam/login`
- Called by the frontend via `fetch` with `Authorization: Bearer <supabase jwt>`.
- Verify the JWT with Supabase (`admin.auth.getUser(jwt)`) -> `user_id`. 401 if invalid.
- Build a signed `state` = `${user_id}.${exp}.${hmacSHA256(`${user_id}.${exp}`, STEAM_OPENID_SECRET)}`, `exp` = now + 10 min.
- Build the Steam auth URL with:
  - `openid.ns=http://specs.openid.net/auth/2.0`
  - `openid.mode=checkid_setup`
  - `openid.return_to=<base>/api/steam/callback?state=<state>`
  - `openid.realm=<base>`
  - `openid.identity=openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`
- `<base>` derived from request headers (`x-forwarded-proto` + `host`) so it
  matches the live origin and `vercel dev`.
- Return `{ url }`. The frontend does `window.location.href = url`.

### `GET /api/steam/callback`
- Steam redirects here with `openid.*` params + our `state`.
- **Verify with Steam** (mandatory): POST the received params back to the OpenID
  endpoint with `openid.mode=check_authentication`; require the response to
  contain `is_valid:true`. Reject otherwise.
- Verify `state`: recompute the HMAC, check it matches and `exp` is in the
  future. Recover `user_id`.
- Extract SteamID64 from `openid.claimed_id`
  (`https://steamcommunity.com/openid/id/<steamid64>`); validate it is 17 digits.
- Upsert `integrations(user_id, steam_id)` via the service-role client.
- Redirect (302) to `<base>/gaming?steam=connected` (or `?steam=error` on any
  failure).

The Supabase JWT never appears in a URL; only the HMAC-signed `state`
(carrying the non-secret `user_id`) travels through the redirect.

## Wishlist function (modified `api/wishlist.ts`)

- Read `Authorization: Bearer <jwt>`; verify -> `user_id` (401 if missing/invalid).
- Read `integrations.steam_id` for that user via the service-role client.
- If no row: return `200 { connected: false, games: [] }`.
- Else: build `env = { steamKey: process.env.STEAM_API_KEY, steamId, itadKey: process.env.ITAD_API_KEY }`
  (the shared key + the per-user SteamID, matching the existing
  `buildWishlist(env, fetchImpl?)` signature) and call
  `getCached('wishlist:' + user_id, 3600_000, () => buildWishlist(env))`. Return
  `200 { connected: true, games }`.
- `buildWishlist` is adjusted only so that when `env.itadKey` is empty/undefined
  it **skips** the ITAD lookup + hot-tag passes (games still returned). On any
  upstream failure it returns `[]` as today.

## Frontend

- `src/api/steam.ts`:
  - `getConnection(): Promise<{ connected: boolean; steamId: string | null }>` -
    `supabase.from('integrations').select('steam_id').maybeSingle()` (RLS).
  - `startConnect(): Promise<void>` - `fetch('/api/steam/login', { headers: Bearer })`
    -> `window.location.href = url`.
  - `disconnect(): Promise<void>` - `supabase.from('integrations').delete().eq('user_id', uid)` (RLS).
- `src/api/wishlist.ts`: `list()` sends `Authorization: Bearer <jwt>` and returns
  `{ connected: boolean; games: WishlistGame[] }`.
- `src/hooks/useWishlist.ts` (or existing): expose connection state + games.
- `GamingPage`:
  - **Not connected** -> a "Koble til Steam" button (calls `startConnect`) + a hint
    line: wishlisten din ma vaere offentlig.
  - **Connected** -> existing wishlist UI, plus a small "Koble fra / Koble til pa
    nytt" control. On `?steam=connected` show a success toast and refetch; on
    `?steam=error` show an error toast.
- All user-facing strings in Norwegian (nb-NO).

## Environment / setup

- `STEAM_API_KEY` (shared, Vercel env) - owner generates one at
  steamcommunity.com/dev/apikey. Set in Vercel + `.env.local`.
- `STEAM_OPENID_SECRET` (Vercel env + `.env.local`) - random 32+ byte secret for
  signing the OpenID `state`.
- `ITAD_API_KEY` (optional, Vercel env) - enables the hot/all-time-low tag +
  itadId for the price chart. Absent => wishlist still works without those.
- `STEAM_ID` env (the old global) is removed; SteamID is per-user now.

## Security

- OpenID responses are always verified server-side with Steam
  (`check_authentication`); an unverified response is rejected.
- `state` is HMAC-signed and time-limited, binding the callback to the
  initiating user and preventing CSRF/forgery.
- Service-role key stays server-only; the browser uses the anon key under RLS.
- The shared Steam key is server-only (no `VITE_` prefix).

## Testing

- Unit (`*.vitest.ts`): OpenID auth-URL builder; `state` sign/verify (valid,
  tampered, expired); claimed_id -> SteamID extraction + validation; the
  wishlist `connected:false` branch; `buildWishlist` skips ITAD when no key.
- Manual / Playwright: the real Steam login redirect cannot be scripted
  (third-party login) - verified by hand. The Gaming page not-connected ->
  connect button -> connected states get a Playwright check using a seeded
  integrations row (bypassing the real Steam redirect).

## Out of scope

- Per-user ITAD keys (ITAD stays optional/global).
- Refreshing/paginating very large wishlists beyond the existing behavior.
- Importing the old (now-deleted) wishlist data.

## Rollout order (informs the plan)

1. `integrations` migration + apply.
2. `api/_lib/steamOpenid.ts` (URL build, state sign/verify, response parse) + tests.
3. `api/steam/login.ts` + `api/steam/callback.ts`.
4. Modify `api/wishlist.ts` (auth + per-user + connected flag) and `buildWishlist` ITAD-optional.
5. `src/api/steam.ts` + `wishlistApi.list` auth + Gaming page UI.
6. Env setup (shared key + OpenID secret) + deploy + manual Steam verify.
