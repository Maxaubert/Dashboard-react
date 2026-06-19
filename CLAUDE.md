# Dashboard — Project context for Claude Code

Personal single-user dashboard. Static Vite/React frontend deployed to Vercel Hobby, with two TypeScript serverless functions under `api/` and Supabase for auth + database.

**IMPORTANT: this repo is public at `github.com/Maxaubert/Dashboard-react`. Never commit secrets. Env vars live in `.env.local` (gitignored) locally and in the Vercel dashboard for production.**

## Stack

- **Frontend**: React 18, TypeScript ~5.6, Vite 5, react-query, dnd-kit, Tailwind 4, Radix UI, react-router 6, framer-motion, lucide-react.
- **Serverless functions**: two Vercel Node.js functions in `api/` (`/api/wishlist`, `/api/news`). Shared helpers in `api/_lib/` (`supabaseAdmin.ts`, `cache.ts`, `wishlist.ts`, `news.ts`).
- **Auth + database**: Supabase (hosted Postgres + Supabase Auth with email+password). RLS enforces per-user data isolation. Schema in `supabase/migrations/`.
- **Deploy**: `vercel --prod` for production. Static build + functions deploy together.
- **UI language**: Norwegian (`nb-NO`). Don't translate user-facing strings to English.

## Path alias

`@/*` resolves to `src/*` (`tsconfig.app.json`). Use it for cross-area imports; relative paths for siblings inside the same folder.

## File organization (the established split)

- `src/pages/*.tsx` — **thin** page shells: state, mutations, top-level layout. Target: under 200 lines.
- `src/components/<area>/*.tsx` — per-page focused components (`todo/`, `links/`, `home/`, `widgets/`, `timer/`, `launcher/`, etc.).
- `src/lib/<area>.ts` — pure helpers + constants, **no React imports**.
- `src/hooks/*.ts` — react-query wrappers and cross-cutting hooks.
- `src/api/*.ts` — typed API clients (each resource gets its own file).
- `src/data/*.ts` — static config (icons, holidays, sports data).
- `api/` — Vercel serverless functions and shared `_lib/` helpers. **Never import from `src/` here.**
- `supabase/migrations/` — SQL migration files applied via the Supabase CLI or dashboard.
- `plans_md/` — multi-step plan/audit documents (gitignored except `TEMPLATE.md`).

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
  - `documents` -- per-user JSONB bulk-replace store. One row per `(user_id, kind)` where `kind` is `todos | plan | links | home`. RLS: owner only.
  - `notes` -- per-row CRUD (`id TEXT`, `user_id`, `title`, `body`, `updated_at BIGINT`). RLS: owner only.
  - `cache` -- service-role-only key/value store for the Vercel functions (wishlist + news results). No RLS policies -- anon/authenticated roles cannot touch it; only the service-role key used by the functions bypasses RLS.
- **Client in functions**: `api/_lib/supabaseAdmin.ts` creates a service-role client (bypasses RLS). Server-only -- never import it under `src/`.
- **Client in frontend**: `src/lib/supabase.ts` creates an anon-key client. Session is persisted via `persistSession: true`.

## Auth

- **Provider**: Supabase Auth (email+password). No custom sessions table or cookie logic.
- **Frontend**: `src/lib/supabase.ts` exports the `supabase` client. `useCurrentUser` (`src/hooks/useCurrentUser.ts`) wraps the Supabase session. `RequireAuth` (`src/components/auth/RequireAuth.tsx`) guards the whole app: logged-out users redirect to `/login`.
- **Pages**: `/login` (`src/pages/LoginPage.tsx`) and `/signup` (`src/pages/SignupPage.tsx`), sharing `src/components/auth/AuthCard.tsx`.
- **Env vars reaching the browser** (prefixed `VITE_`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ITAD_KEY`.
- **Function-only env vars** (not exposed to the browser): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STEAM_API_KEY`, `STEAM_ID`, `ITAD_API_KEY`.
- **Local**: copy these to `.env.local` (gitignored). Production values live in the Vercel dashboard.

## Serverless functions (`api/`)

- `/api/wishlist` (`api/wishlist.ts`) -- fetches Steam + ITAD data, caches in the `cache` table for 1 hour, returns game list.
- `/api/news` (`api/news.ts`) -- fetches RSS from `vg | nrk | aftenposten`, caches for 5 minutes, returns items sliced by `?source=&count=&offset=`.
- Shared helpers in `api/_lib/`: `supabaseAdmin.ts` (DB client), `cache.ts` (read-through cache against the `cache` table), `wishlist.ts`, `news.ts`.
- Test files are co-located as `*.vitest.ts` inside `api/_lib/` and run with the main `npm test` command.
- Local testing with real function behaviour: `vercel dev` (spins up both the Vite frontend and the functions).

## Frontend conventions

- **Multi-container DnD**: `useMultiContainerDnd` in `src/hooks/`. Used by `TodoListDnd` and `ColumnsDnd`. Pass `containers`, `containerIds`, `itemId`, `onCommit`, and optionally `transformOnMove` for cross-container item mutations.
- **Single-container DnD** (reorder only): just use `arrayMove` inline. See `HomePage.tsx` and `WidgetsSection.tsx`.
- **LinksLibrary** keeps its own DnD implementation. Section-vs-link drag duality, custom `pointerOrCorners` collision, `MeasuringStrategy.Always`, sensor distance 4, and click-suppression on drop don't fit the shared hook.
- **DnD testing**: dnd-kit's `PointerSensor` ignores synthetic JS events. Playwright's `evaluate`-dispatched `PointerEvent`s won't trigger drag. Manual user verification only for any DnD change.
- **State**: react-query is the source of truth for server data. `useLocalStorage` is for view preferences only (e.g. todo Liste/Kolonner choice).
- **Cross-page widgets**: pinning a todo (`togglePin`) calls `addWidget('todo', id)`; the widget renders in `WidgetsSection` on `/`. Unpin removes it.

## UI primitives (the design system that isn't)

`src/components/ui/` holds only `Modal` (focus trap, escape, backdrop) and `Toast` (app-wide notifications). Pages use raw `<button>` / `<input>` JSX. The old `Button/Card/Input/...` primitives were deleted because nothing imported them. **If you find yourself adding back a UI primitive, first check whether the pages would actually use it -- otherwise add inline styles like the rest.**

## Git workflow

- **Branches**: `feat/<name>`, `refactor/<name>`, `fix/<name>`, `chore/<name>`.
- **Commits**: imperative subject. Body explains *why*, not *what*. End every body with:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
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

- **Audit & plan docs**: `plans_md/` (gitignored). New plans follow `plans_md/TEMPLATE.md`.
- **The 2026-05-19 audit**: `plans_md/2026-05-19-codebase-audit.md` documents the Stage 1-6 cleanup with commit SHAs. Worth reading before any structural change.
