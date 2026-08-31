# Dashboard -- Project context for Claude Code

Personal dashboard. Static Vite/React frontend deployed to Vercel Hobby, with four TypeScript serverless functions under `api/` and Supabase for auth + database.

**IMPORTANT: this repo is public at `github.com/Maxaubert/Dashboard-react`. Never commit secrets. Env vars live in `.env.local` (gitignored) locally and in the Vercel dashboard for production.**

## Stack

- **Frontend**: React 18, TypeScript ~5.6, Vite 5, react-query, dnd-kit, Tailwind 4, Radix UI, react-router 6, framer-motion, lucide-react.
- **Serverless functions**: four Vercel Node.js functions in `api/` (`/api/wishlist`, `/api/news`, `/api/steam/login`, `/api/steam/callback`). Shared helpers in `api/_lib/` (`supabaseAdmin.ts`, `cache.ts`, `wishlist.ts`, `news.ts`, `steamOpenid.ts`).
- **Auth + database**: Supabase (hosted Postgres + Supabase Auth with email+password). RLS enforces per-user data isolation. Schema in `supabase/migrations/`.
- **Deploy**: `vercel --prod` for production. Static build + functions deploy together.
- **UI language**: Norwegian (`nb-NO`). Don't translate user-facing strings to English.

## Path alias

`@/*` resolves to `src/*` (`tsconfig.app.json`). Use it for cross-area imports; relative paths for siblings inside the same folder.

## Routing: one page plus overlays

- `src/App.tsx` registers only `/` (HomePage), `/login`, `/signup` and `*` (NotFoundPage). There are no `/todo`, `/plan`, `/gaming` or `/links` routes.
- Plan, Todo, Gaming and Links are **pop-outs**: `usePageOverlay().openOverlay('plan' | 'todo' | 'gaming' | 'links')` (`src/context/PageOverlayContext.tsx`) sets the key and `src/components/overlay/PageOverlay.tsx` renders the matching page from `src/pages/` on top of the home page. Closing just clears the key; no navigation happens.
- A new feature page gets a new `OverlayKey` and a case in `PageOverlay`, not a new route. Server-side redirects (e.g. the Steam callback) must land on `/`.
- `src/context/` holds `PageOverlayContext` and `GlassModeContext` only.

## File organization (the established split)

- `src/pages/*.tsx` -- **thin** page shells: state, mutations, top-level layout. Target: under 200 lines.
- `src/components/<area>/*.tsx` -- per-page focused components (`home/`, `home-bento/`, `todo/`, `links/`, `gaming/`, `overlay/`, `launcher/`, `layout/`, `auth/`, `patterns/`, `ui/`).
- `src/lib/<area>.ts` -- pure helpers + constants, **no React imports**.
- `src/hooks/*.ts` -- react-query wrappers and cross-cutting hooks. Query keys live in `src/hooks/queryKeys.ts`.
- `src/api/*.ts` -- typed API clients (each resource gets its own file). Document-shaped data goes through `src/lib/docStore.ts`.
- `src/data/*.ts` -- static config (icons, holidays, gaming events).
- `api/` -- Vercel serverless functions and shared `_lib/` helpers. **Never import runtime code from `src/` here** (the type-only import of `src/api/types.ts` is the one exception).
- `supabase/migrations/` -- SQL migration files applied via the Supabase CLI or dashboard.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` -- approved design specs and implementation plans (tracked).
- `plans_md/` -- local planning and audit notes. Gitignored except `TEMPLATE.md`, `*-design.md`, `*-spec.md` and `*-plan.md`.

When a page passes ~400 lines, split it the way `TodoPage`, `LinksPage`, `HomePage` were split: keep the page as an orchestrator, move JSX subcomponents to `components/<area>/`, pure helpers to `lib/<area>.ts`.

## Critical commands

| Task | Command |
|---|---|
| Typecheck | `npm run typecheck` |
| Tests | `npm test` (vitest, incl. `api/_lib/*.vitest.ts`) |
| Dev server (frontend only) | `npm run dev` (picks first free port from 5173) |
| Dev server (incl. functions) | `vercel dev` |
| Build | `npm run build` (runs `tsc -b && vite build`) |
| Deploy to production | `vercel --prod` |

**YOU MUST** run `npm run typecheck` before committing TS changes. **YOU MUST** run `npm test` before pushing.

## Database

- **Engine**: Supabase (hosted Postgres). Schema enforced via RLS policies; no direct Postgres access needed locally.
- **Schema migrations**: SQL files in `supabase/migrations/` (zero-padded, e.g. `0001_init.sql`). Apply via the Supabase CLI (`supabase db push`) or the Supabase dashboard SQL editor. **YOU MUST** add schema changes as a NEW numbered file -- never edit an applied migration.
- **Data model**:
  - `documents` -- per-user JSONB bulk-replace store. One row per `(user_id, kind)` where `kind` is `todos | plan | links | home` (`DocKind` in `src/lib/docStore.ts`). RLS: owner only.
  - `integrations` -- per-user external accounts (`0002_integrations.sql`). One row per user holding `steam_id`, written by `/api/steam/callback` and read by `/api/wishlist`. RLS: owner only.
  - `cache` -- service-role-only key/value store for the Vercel functions (wishlist + news results). No RLS policies -- anon/authenticated roles cannot touch it; only the service-role key used by the functions bypasses RLS.
  - `notes` -- created in `0001_init.sql` but **unused and reserved**: no page, client or hook reads it. Do not build on it without a design; drop it with a new migration if it ever gets in the way.
- **Client in functions**: `api/_lib/supabaseAdmin.ts` creates a service-role client (bypasses RLS). Server-only -- never import it under `src/`.
- **Client in frontend**: `src/lib/supabase.ts` creates an anon-key client. Session is persisted via `persistSession: true`.

## Auth

- **Provider**: Supabase Auth (email+password). No custom sessions table or cookie logic.
- **Frontend**: `src/lib/supabase.ts` exports the `supabase` client. `src/api/auth.ts` wraps `supabase.auth`. `useCurrentUser` (`src/hooks/useCurrentUser.ts`) wraps the Supabase session. `RequireAuth` (`src/components/auth/RequireAuth.tsx`) guards the whole app: logged-out users redirect to `/login`.
- **Pages**: `/login` (`src/pages/LoginPage.tsx`) and `/signup` (`src/pages/SignupPage.tsx`), sharing `src/components/auth/AuthCard.tsx`.
- **Functions**: `/api/wishlist` and `/api/steam/login` require a `Bearer <supabase access token>` header and resolve the user with the service-role client.
- **Env vars reaching the browser** (prefixed `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ITAD_KEY`.
- **Function-only env vars** (not exposed to the browser): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STEAM_API_KEY`, `STEAM_OPENID_SECRET`, `ITAD_API_KEY`. `.env.example` is the authoritative list.
- **Local**: copy these to `.env.local` (gitignored). Production values live in the Vercel dashboard.

## Serverless functions (`api/`)

- `/api/wishlist` (`api/wishlist.ts`) -- looks up the caller's `steam_id` in `integrations`, fetches Steam + ITAD data, caches per user in the `cache` table for 1 hour, returns `{ connected, games }`.
- `/api/news` (`api/news.ts`) -- fetches RSS from `vg | nrk | aftenposten`, caches for 5 minutes, returns items sliced by `?source=&count=&offset=`.
- `/api/steam/login` (`api/steam/login.ts`) -- returns the Steam OpenID URL with a signed, 10-minute `state` (HMAC with `STEAM_OPENID_SECRET`).
- `/api/steam/callback` (`api/steam/callback.ts`) -- verifies the OpenID response with Steam, upserts `integrations.steam_id`, then redirects back to the app with `?steam=connected|error`.
- Shared helpers in `api/_lib/`: `supabaseAdmin.ts` (DB client), `cache.ts` (read-through cache against the `cache` table), `wishlist.ts`, `news.ts`, `steamOpenid.ts`.
- Test files are co-located as `*.vitest.ts` inside `api/_lib/` and run with the main `npm test` command.
- Local testing with real function behaviour: `vercel dev` (spins up both the Vite frontend and the functions).

## Frontend conventions

- **Multi-container DnD**: `useMultiContainerDnd` in `src/hooks/`. Used by `TodoListDnd` and `ColumnsDnd`. Pass `containers`, `containerIds`, `itemId`, `onCommit`, and optionally `transformOnMove` for cross-container item mutations.
- **Single-container DnD** (reorder only): just use `arrayMove` inline. See `components/home/SettingsModal.tsx` (home section order).
- **LinksLibrary** keeps its own DnD implementation. Section-vs-link drag duality, custom `pointerOrCorners` collision, `MeasuringStrategy.Always`, sensor distance 4, and click-suppression on drop don't fit the shared hook.
- **DnD testing**: dnd-kit's `PointerSensor` ignores synthetic JS events. Playwright's `evaluate`-dispatched `PointerEvent`s won't trigger drag. Manual user verification only for any DnD change.
- **State**: react-query is the source of truth for server data. `useLocalStorage` is for view preferences only.

## UI primitives (the design system that isn't)

`src/components/ui/` holds only `Modal` (focus trap, escape, backdrop) and `Toast` (app-wide notifications). Pages use raw `<button>` / `<input>` JSX. The old `Button/Card/Input/...` primitives were deleted because nothing imported them. **If you find yourself adding back a UI primitive, first check whether the pages would actually use it -- otherwise add inline styles like the rest.**

## Git workflow

- **Branches**: `feat/<name>`, `refactor/<name>`, `fix/<name>`, `chore/<name>`.
- **Commits**: imperative subject. Body explains *why*, not *what*. End every body with:
  ```
  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  ```
- **PRs**: title under 70 chars. Body sections: `## Summary` (3-5 bullets) and `## Test plan` (checklist). Flag anything that needs manual user verification (e.g. drag UX).
- **No em-dashes** anywhere -- code, commits, PRs, chat. Global user preference.
- **No emojis** in code or commits unless explicitly requested.

## Common gotchas

- Repo URL is `Maxaubert/Dashboard-react` (capital D). The old lowercase form redirects; the "This repository moved" line on push is harmless.
- Vite dev server hops ports (`5173 → 5174 → ...`) if any are taken. Read the actual port from `_dev.log` before navigating.
- `api/_lib/supabaseAdmin.ts` uses `SUPABASE_URL` (no `VITE_` prefix) -- it is a Node.js module, not a Vite build input.
- Never import `api/_lib/*` from under `src/` -- those modules use `process.env` and Node.js APIs unavailable in the browser bundle.

## Where the bones are buried

- **Approved specs and plans**: `docs/superpowers/specs/` and `docs/superpowers/plans/`. The Vercel + Supabase move is `docs/superpowers/specs/2026-06-19-vercel-supabase-migration-design.md`; the single-page + overlay model is `2026-06-19-single-page-dashboard-design.md`.
- **Historical**: the tracked `plans_md/2026-05-19-multi-user-backend-*` files describe the deleted Python/VPS backend and are superseded by the migration spec above. Do not follow them.
- **Audit notes**: dated `*-audit.md` files in `plans_md/` are local-only (untracked). If one exists, read it before any structural change.
