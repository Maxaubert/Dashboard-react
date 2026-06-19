# Migration: Dashboard → free Vercel + Supabase app

Date: 2026-06-19
Status: Approved design, pending spec review
Branch: `feat/vercel-supabase-migration`

## Goal

Strip the dashboard down to something that runs entirely on free managed
hosting (no paid VPS, no server to maintain). Retire the Hetzner VPS, the
Python backend (`server/api.py`, `notes_api.py`, `tools_api.py`), nginx, and
systemd. Keep login + cross-device sync.

## Outcome in one sentence

A static React build on Vercel Hobby, talking directly to Supabase (hosted
Postgres + Auth) for all user data, with exactly two small Vercel serverless
functions for the only features that need a hidden API key.

## Architecture

```
Browser (React, static, Vercel Hobby)
  ├── @supabase/supabase-js ──► Supabase (Postgres + Auth, RLS-protected)   [all CRUD + auth]
  ├── fetch /api/wishlist  ───► Vercel function ──► Steam + ITAD APIs        [secret-holding proxy]
  ├── fetch /api/news      ───► Vercel function ──► VG/NRK/Aftenposten RSS   [secret-holding proxy + CORS]
  ├── fetch open-meteo.com ──────────────────────────────────────────────► [client-side, unchanged]
  └── <img src=google favicon> ─────────────────────────────────────────► [client-side, unchanged]
```

The whole Python backend, nginx, systemd unit, VPS, and the hand-rolled
argon2 + session-cookie auth are removed.

## Decisions (locked)

- **Hosting**: Vercel Hobby (free) for the static frontend + serverless functions.
- **Data + auth**: Supabase free tier. Browser uses `@supabase/supabase-js`
  directly; Row-Level Security scopes rows by `auth.uid()`.
- **Auth**: Supabase Auth (email + password). Replaces argon2, the `sessions`
  table, and the `Secure` cookie. Public signup disabled once the single
  account exists (no invite-code system).
- **Data**: start fresh. No migration of existing VPS data.
- **Sync**: cross-device, behind login.

## Feature scope

### Kept
- Login + Signup (existing redesigned UI, rewired to Supabase Auth)
- Home (sections, widgets, habits, today's plan, news feed)
- Plan (calendar)
- Todo
- Notes
- Links
- Sport (static data, already client-side)
- Gaming: wishlist (via `/api/wishlist` function), events tab (static),
  price-history chart (already client-side via ITAD)
- Weather (client-side Open-Meteo, unchanged)

### Dropped
- Skole / Canvas page and its `/api/skole` + `/api/pdf` backend
- The entire Tools section: all 18 routes including calculator, QR, timer,
  and the 5 heavy tools (video, bgremove, pdf, convert, reader). Nav entry
  removed.
- `/api/report` bug/feature reporter
- `/api/favicon` proxy — replaced by pointing `<img>` straight at Google's
  favicon service (`https://www.google.com/s2/favicons?domain=...&sz=64`),
  which works as an image `src` with no CORS proxy.

## Data model (Supabase)

New tables mirroring current shapes, each with `user_id uuid references
auth.users` and RLS policies (`user can select/insert/update/delete where
user_id = auth.uid()`):

- `todos`
- `plan_events` (TEXT id, client-generated UUIDs, as today)
- `notes` (TEXT id)
- `links` (TEXT id) + `categories` (TEXT id); categories upserted before links
- `home_layout` (one JSONB row per user)
- `cache` (small key/value + `fetched_at` TIMESTAMPTZ for the two functions'
  TTL caching; not user-scoped)

Schema is created via Supabase SQL migrations checked into the repo (new
`supabase/migrations/` dir). The old `server/migrations/` (yoyo) is retired.

## Auth flow

- `LoginPage` submit → `supabase.auth.signInWithPassword({ email, password })`.
- `SignupPage` submit → `supabase.auth.signUp(...)` (disabled in Supabase
  dashboard after the one account is created).
- `RequireAuth` → reads `supabase.auth.getSession()` / `onAuthStateChange`
  instead of calling `/api/auth/me`. Logged-out users redirect to `/login`.
- Logout → `supabase.auth.signOut()`.
- The JWT is managed by the Supabase client (localStorage); no cookies.

## Serverless functions (Vercel `/api`, TypeScript)

### `/api/wishlist`
- Ports `fetch_wishlist` from `server/api.py`.
- Calls Steam `IWishlistService/GetWishlist` + `store.../appdetails`, enriches
  with ITAD price/all-time-low.
- Secrets from Vercel env: `STEAM_API_KEY`, `STEAM_ID`, `ITAD_API_KEY`.
- Caches result in Supabase `cache` table, 1h TTL; serves stale on upstream
  failure.

### `/api/news`
- Ports the VG/NRK/Aftenposten feed logic.
- Fetches RSS + OpenGraph metadata server-side (CORS blocks the browser).
- Query params `source`, `count`, `offset` as today.
- Caches in Supabase `cache` table, ~5min TTL.

Both functions read Supabase via the service-role key (env var, server-only).

## Frontend changes

- Add `src/lib/supabase.ts` exporting a configured client (URL + anon key from
  `import.meta.env.VITE_SUPABASE_*`).
- Delete `src/api/client.ts` (cookie fetch wrapper).
- Rewrite as thin Supabase queries: `auth.ts`, `todos.ts`, `plan.ts`,
  `notes.ts`, `links.ts`, `home.ts`. Keep the same exported function names /
  return shapes so hooks and pages don't change.
- `wishlist.ts`, `news.ts`: keep calling `/api/*` (now Vercel functions).
- `weather.ts`, `itadHistory.ts`: unchanged (direct third-party).
- Delete `skole.ts`, `pdf.ts`, `reports.ts`.
- Replace `faviconUrl()` to return the direct Google favicon URL.
- Remove Tools + Skole routes from `src/App.tsx`, delete `src/pages/tools/*`,
  `ToolsPage.tsx`, `SkolePage.tsx`, and their nav entries.
- `src/api/types.ts`: keep (trim Skole/Tools/Report types).

## Repo / deploy changes

- Add `vercel.json` (build = `npm run build`, output `dist`, SPA rewrite to
  `index.html`).
- Add `supabase/migrations/*.sql`.
- Delete `server/`, `_deploy_*.py`, `_apply_migrations.py`, nginx conf,
  systemd unit, and VPS-specific scripts (in a clearly separate commit so the
  history is legible).
- Update project `CLAUDE.md` to describe the new architecture (separate
  follow-up; not part of the code change).

## Testing / verification

- `npm run typecheck` and `npm test` (vitest) stay green.
- Unit tests for the two functions (mock upstream + Supabase cache).
- Playwright smoke: login → todos/plan/notes/links render synced data →
  wishlist + news load on Home/Gaming.
- DnD changes remain manual-verify (per project CLAUDE.md).

## Security / housekeeping

- Rotate the ITAD key hardcoded in `src/lib/itadHistory.ts` (repo is public).
  Move it behind the `/api/wishlist` function or, if it must stay client-side,
  accept it as a low-value public key but rotate the leaked one.
- Vercel env vars hold all server-side secrets; the Supabase service-role key
  is never exposed to the browser (only the anon key is).
- Supabase RLS is the real access control — verify policies deny cross-user
  reads even though it is single-user today.

## Known limitations / out of scope

- Heavy media tools (video/bgremove/pdf/convert/reader) are gone; reviving any
  would need a separate always-on host. Not in scope.
- Skole/Canvas integration removed entirely.
- No data migration from the old VPS.
- Supabase free projects auto-pause after ~7 days idle (slow first wake);
  acceptable for a regularly used personal dashboard.

## Rollout order (informs the plan, not the plan itself)

1. Supabase project + schema + RLS.
2. Supabase client + auth rewire (login works).
3. CRUD clients → Supabase (data syncs).
4. `/api/wishlist` + `/api/news` functions.
5. Strip Skole + Tools + dead clients/routes.
6. `vercel.json`, deploy, smoke test.
7. Delete `server/` + VPS scripts.
