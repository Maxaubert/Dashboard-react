# Vercel + Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Hetzner VPS + Python backend with a static Vercel build that talks directly to Supabase (Postgres + Auth), keeping only two serverless functions (wishlist, news).

**Architecture:** The React app uses `@supabase/supabase-js` for all user data and auth (RLS-scoped per user). Bulk-replace resources (todos, plan, links, home) are stored as one JSONB document per user in a `documents` table; notes get a real per-row table. Two Vercel TypeScript functions hold the Steam/ITAD/news secrets and cache results in a `cache` table.

**Tech Stack:** React 18 + TS + Vite (unchanged), `@supabase/supabase-js`, Vercel serverless functions (`@vercel/node`, Node 20 global `fetch`), `fast-xml-parser` for RSS, vitest, Playwright.

## Global Constraints

- **No em-dashes** anywhere (code, commits, docs). Use en-dashes, commas, or rephrase.
- **No emojis** in code or commits.
- **UI language is Norwegian (`nb-NO`)** — do not translate user-facing strings.
- **Commit trailer** on every commit body: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Branch:** `feat/vercel-supabase-migration` (already created off `main`).
- **vitest only collects `*.vitest.ts`** (see `vite.config.ts` `test.include`). All new tests use that suffix.
- **Typecheck gate:** `npm run typecheck` must pass before every commit that touches TS.
- **Keep exported API-client signatures identical** (`list`, `saveAll`, `create`, `update`, `delete`, `me`, `login`, `signup`, `logout`) so hooks and pages need no changes beyond the `User.id` type widening in Task 3.
- **Secrets:** only the Supabase *anon* key (`VITE_SUPABASE_ANON_KEY`) may reach the browser. `SUPABASE_SERVICE_ROLE_KEY`, `STEAM_API_KEY`, `STEAM_ID`, `ITAD_API_KEY` are function-only env vars, never imported under `src/`.

---

## Prerequisites (manual, user-performed — gate before Task 2)

These cannot be done from code. The implementer pauses and asks the user to do them, then collects the values.

1. **Create a Supabase project** (free tier) at supabase.com. From Project Settings → API, collect: Project URL, `anon` public key, `service_role` secret key.
2. **Create a Vercel account** and import the GitHub repo `Maxaubert/Dashboard-react` (free Hobby). Do not deploy yet.
3. **Local env file** `.env.local` (gitignored) at repo root:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   STEAM_API_KEY=<from /etc/dashboard.env on the old VPS>
   STEAM_ID=<from /etc/dashboard.env>
   ITAD_API_KEY=<rotated key, see Task 16>
   ```
4. **Vercel env vars**: the same keys set in the Vercel project dashboard (Production + Preview). `VITE_*` are build-time; the rest are runtime.
5. Install the Vercel CLI globally for local function testing: `npm i -g vercel`. Local dev that exercises functions runs via `vercel dev` (serves the Vite app and `/api/*` on one port). Plain `npm run dev` still works for UI-only work but wishlist/news will not load there.

---

## Task 1: Dependencies, Supabase client, Vercel config

**Files:**
- Modify: `package.json` (deps)
- Create: `src/lib/supabase.ts`
- Create: `vercel.json`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env.local`)
- Modify: `vite.config.ts` (drop VPS proxy, widen test include)
- Test: `src/lib/supabase.vitest.ts`

**Interfaces:**
- Produces: `supabase` (a `SupabaseClient`) exported from `@/lib/supabase`, configured from `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js fast-xml-parser
npm install -D @vercel/node
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/supabase.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { supabase } from './supabase';

describe('supabase client', () => {
  it('exposes the query + auth surface the app relies on', () => {
    expect(typeof supabase.from).toBe('function');
    expect(typeof supabase.auth.getSession).toBe('function');
    expect(typeof supabase.auth.signInWithPassword).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase.vitest.ts`
Expected: FAIL — cannot find module `./supabase`.

- [ ] **Step 4: Create the client**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Surfaced at startup rather than as a confusing 401 later.
  throw new Error('Mangler VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

- [ ] **Step 5: Update `vite.config.ts`**

Replace the entire `server.proxy` block with an empty dev server (the VPS no longer exists) and widen the test glob. The `server` key becomes:
```ts
  server: {
    port: 5173,
  },
```
And change `test.include` to:
```ts
  test: {
    include: ['src/**/*.vitest.ts', 'vite-plugins/**/*.vitest.ts', 'api/**/*.vitest.ts'],
  },
```

- [ ] **Step 6: Create `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 7: Create `.env.example`** (documents required vars, no secrets)

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STEAM_API_KEY=
STEAM_ID=
ITAD_API_KEY=
```

Ensure `.gitignore` contains `.env.local` and `.env*.local` (add if missing).

- [ ] **Step 8: Run test + typecheck**

Run: `npx vitest run src/lib/supabase.vitest.ts && npm run typecheck`
Expected: PASS (test green; typecheck clean). The test needs the env vars from `.env.local`; vitest loads them via Vite's env handling. If the client throws on missing env during the test, set them in a `.env.test` or export them in the shell before running.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/supabase.ts src/lib/supabase.vitest.ts vercel.json .env.example .gitignore vite.config.ts
git commit -m "$(printf 'feat: add Supabase client + Vercel config\n\nIntroduces the @supabase/supabase-js client and vercel.json SPA config,\nremoves the dead VPS dev proxy, and widens the vitest glob to cover\nfunction tests. Groundwork for the serverless migration.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: Supabase schema + RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `documents(user_id, kind, data, updated_at)`, `notes(id, user_id, title, body, updated_at)`, `cache(key, data, fetched_at)` with RLS. `documents.kind` ∈ `todos|plan|links|home`. `user_id` defaults to `auth.uid()`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_init.sql`:
```sql
-- Per-user JSONB documents for bulk-replace resources.
create table if not exists public.documents (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('todos','plan','links','home')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table public.documents enable row level security;
create policy documents_owner on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Notes: per-row CRUD.
create table if not exists public.notes (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null default '',
  body       text not null default '',
  updated_at bigint not null
);
alter table public.notes enable row level security;
create policy notes_owner on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists notes_user_updated on public.notes (user_id, updated_at desc);

-- Function cache. No policies → anon/authenticated cannot touch it; the
-- service-role key used by the Vercel functions bypasses RLS.
create table if not exists public.cache (
  key        text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.cache enable row level security;
```

- [ ] **Step 2: Apply it (manual)**

Paste the file's contents into the Supabase dashboard → SQL Editor → Run. (Or, if the user installed the Supabase CLI and linked the project: `supabase db push`.)

- [ ] **Step 3: Verify schema + RLS in the SQL Editor**

Run:
```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```
Expected: `documents`, `notes`, `cache` all with `rowsecurity = true`.

Then confirm anon is blocked (RLS works): in a fresh anon SQL context this would deny; in the dashboard editor you are superuser so instead just confirm the policies exist:
```sql
select tablename, policyname from pg_policies where schemaname = 'public';
```
Expected: `documents_owner`, `notes_owner` present; `cache` has none.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "$(printf 'feat: Supabase schema + RLS for documents, notes, cache\n\nPer-user JSONB documents for the bulk-replace resources (todos/plan/\nlinks/home), a per-row notes table, and a service-role-only cache table\nfor the wishlist/news functions. RLS scopes every row by auth.uid().\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: Auth rewrite (Supabase Auth)

**Files:**
- Modify: `src/api/types.ts` (widen `User.id`)
- Rewrite: `src/api/auth.ts`
- Modify: `src/hooks/useCurrentUser.ts`
- Test: `src/api/auth.vitest.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`.
- Produces: `authApi.{ me(): Promise<User|null>, login(email,password): Promise<User>, signup({email,password,display_name}): Promise<User>, logout(): Promise<void> }`. Note `signup` no longer takes `code`. `mapUser(u: SupabaseUser): User`.

- [ ] **Step 1: Widen `User.id`**

In `src/api/types.ts`, change `export interface User { id: number; ... }` to `id: string;` (Supabase user ids are UUID strings). Grep for numeric uses: `grep -rn "user.id" src` — there should be none that do arithmetic; it is only displayed/compared. Fix any `=== 1` admin checks (there should be none left in the frontend).

- [ ] **Step 2: Write the failing test**

Create `src/api/auth.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mapUser } from './auth';

describe('mapUser', () => {
  it('maps a Supabase user to the app User shape', () => {
    const u = { id: 'uuid-123', email: 'a@b.com', user_metadata: { display_name: 'Max' } };
    expect(mapUser(u as never)).toEqual({ id: 'uuid-123', email: 'a@b.com', display_name: 'Max' });
  });
  it('falls back to empty display_name and email', () => {
    const u = { id: 'x', email: null, user_metadata: {} };
    expect(mapUser(u as never)).toEqual({ id: 'x', email: '', display_name: '' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/api/auth.vitest.ts`
Expected: FAIL — `mapUser` is not exported.

- [ ] **Step 4: Rewrite `src/api/auth.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from './types';

export function mapUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? '',
    display_name: (u.user_metadata?.display_name as string | undefined) ?? '',
  };
}

export const authApi = {
  me: async (): Promise<User | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user ? mapUser(data.user) : null;
  },

  login: async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Innlogging feilet');
    return mapUser(data.user);
  },

  signup: async (input: { email: string; password: string; display_name: string }): Promise<User> => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.display_name } },
    });
    if (error || !data.user) throw new Error(error?.message ?? 'Registrering feilet');
    return mapUser(data.user);
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut();
  },
};
```

- [ ] **Step 5: Update `useCurrentUser.ts`**

Keep `useCurrentUser` calling `authApi.me`. Replace the body of `useLogout`'s `mutationFn` is already `authApi.logout` — no change needed there. Add a session listener so external sign-out/expiry updates the cache. Append to `useCurrentUser.ts`:
```ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/** Subscribe React Query to Supabase auth changes (call once, in App). */
export function useAuthSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      qc.setQueryData(
        queryKeys.currentUser,
        session?.user
          ? { id: session.user.id, email: session.user.email ?? '', display_name: (session.user.user_metadata?.display_name as string) ?? '' }
          : null
      );
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
}
```
(Adjust imports: `useEffect` from `react`, `useQueryClient` already imported.)

- [ ] **Step 6: Wire `useAuthSync` into the app**

In `src/App.tsx`, call `useAuthSync()` inside a small component rendered under `QueryClientProvider` (a hook needs a component). Add near the top of `App`'s tree, e.g. wrap routes in an `<AuthSync/>` that calls the hook and renders `null`, or call it inside an existing provider component. Minimal: create the component inline:
```tsx
function AuthSync() { useAuthSync(); return null; }
```
and render `<AuthSync />` just inside `<BrowserRouter>`.

- [ ] **Step 7: Update Login/Signup submit handlers**

In `src/pages/LoginPage.tsx`: the submit calls `authApi.login(email, password)` already (via its mutation). Confirm it does not pass a `code`. In `src/pages/SignupPage.tsx`: remove the invite `code` field from the form state and the `authApi.signup` call so it matches the new `{email,password,display_name}` signature. Keep the Norwegian labels. (Inspect both files; change only the data passed, not the redesigned layout.)

- [ ] **Step 8: Run test + typecheck**

Run: `npx vitest run src/api/auth.vitest.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Manual login smoke (needs Supabase project + a created user)**

In the Supabase dashboard → Authentication → Users, create your account (email + password), and under User Metadata add `{"display_name":"Max"}`. Then run `vercel dev`, open the app, log in, confirm you land on `/` and the sidebar shows your name. Confirm logout bounces to `/login`. After this works, disable public sign-ups: Supabase → Authentication → Providers → Email → turn off "Allow new users to sign up".

- [ ] **Step 10: Commit**

```bash
git add src/api/auth.ts src/api/auth.vitest.ts src/api/types.ts src/hooks/useCurrentUser.ts src/App.tsx src/pages/LoginPage.tsx src/pages/SignupPage.tsx
git commit -m "$(printf 'feat: move auth to Supabase Auth\n\nReplaces the cookie/session backend calls with supabase.auth\n(signInWithPassword, signUp, signOut, getUser) and syncs React Query to\nauth state changes. User.id widens to a UUID string. Drops the invite\ncode from signup; public signup is disabled in the Supabase dashboard.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: documents-backed clients — todos + plan

**Files:**
- Rewrite: `src/api/todos.ts`
- Rewrite: `src/api/plan.ts`
- Create: `src/lib/docStore.ts` (shared helper)
- Test: `src/lib/docStore.vitest.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`.
- Produces: `readDoc<T>(kind, fallback): Promise<T>` and `writeDoc<T>(kind, data): Promise<void>` in `@/lib/docStore`. `todosApi.{ list(): Promise<Todo[]>, saveAll(todos): Promise<{ok:boolean}> }`; `planApi.{ list(): Promise<PlanItem[]>, saveAll(items): Promise<{ok:boolean}> }`.

- [ ] **Step 1: Write the failing test for the doc store**

Create `src/lib/docStore.vitest.ts` (tests the fallback + shape logic with a stubbed supabase):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const single = vi.fn();
const eq = vi.fn(() => ({ maybeSingle: single }));
const select = vi.fn(() => ({ eq }));
const upsert = vi.fn(() => Promise.resolve({ error: null }));
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select, upsert }) },
}));

import { readDoc, writeDoc } from './docStore';

beforeEach(() => { single.mockReset(); upsert.mockClear(); });

describe('readDoc', () => {
  it('returns stored data when present', async () => {
    single.mockResolvedValue({ data: { data: [1, 2, 3] }, error: null });
    expect(await readDoc('todos', [])).toEqual([1, 2, 3]);
  });
  it('returns the fallback when no row exists', async () => {
    single.mockResolvedValue({ data: null, error: null });
    expect(await readDoc('todos', [])).toEqual([]);
  });
});

describe('writeDoc', () => {
  it('upserts the kind + data', async () => {
    await writeDoc('plan', [{ id: 'x' }]);
    expect(upsert).toHaveBeenCalledWith(
      { kind: 'plan', data: [{ id: 'x' }] },
      { onConflict: 'user_id,kind' }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/docStore.vitest.ts`
Expected: FAIL — cannot find `./docStore`.

- [ ] **Step 3: Implement `src/lib/docStore.ts`**

```ts
import { supabase } from '@/lib/supabase';

export type DocKind = 'todos' | 'plan' | 'links' | 'home';

/** Read a per-user JSONB document, or `fallback` if the user has no row yet. */
export async function readDoc<T>(kind: DocKind, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from('documents')
    .select('data')
    .eq('kind', kind)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as T | undefined) ?? fallback;
}

/** Upsert the per-user document. user_id is filled by the column default. */
export async function writeDoc<T>(kind: DocKind, data: T): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .upsert({ kind, data }, { onConflict: 'user_id,kind' });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/docStore.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/api/todos.ts`**

```ts
import { readDoc, writeDoc } from '@/lib/docStore';
import type { Todo } from './types';

export const todosApi = {
  list: () => readDoc<Todo[]>('todos', []),
  saveAll: async (todos: Todo[]) => {
    await writeDoc('todos', todos);
    return { ok: true };
  },
};
```

- [ ] **Step 6: Rewrite `src/api/plan.ts`**

```ts
import { readDoc, writeDoc } from '@/lib/docStore';
import type { PlanItem } from './types';

export const planApi = {
  list: () => readDoc<PlanItem[]>('plan', []),
  saveAll: async (items: PlanItem[]) => {
    await writeDoc('plan', items);
    return { ok: true };
  },
};
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. The hooks consuming `todosApi`/`planApi` are unchanged because the signatures match.

- [ ] **Step 8: Commit**

```bash
git add src/lib/docStore.ts src/lib/docStore.vitest.ts src/api/todos.ts src/api/plan.ts
git commit -m "$(printf 'feat: back todos + plan with Supabase documents\n\nAdds a shared readDoc/writeDoc helper over the per-user documents table\nand rewires the todos and plan clients to it, keeping list/saveAll\nsignatures identical so hooks and pages are untouched.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: links client (documents)

**Files:**
- Rewrite: `src/api/links.ts` (keep `normaliseEnvelope`)
- Test: `src/api/links.vitest.ts`

**Interfaces:**
- Consumes: `readDoc`/`writeDoc`, `normaliseEnvelope` (kept local).
- Produces: `linksApi.{ list(): Promise<LinksEnvelope>, saveAll(env): Promise<{ok:boolean}> }`.

- [ ] **Step 1: Write the failing test**

Create `src/api/links.vitest.ts` — test that the kept `normaliseEnvelope` behaviour survives by exporting it:
```ts
import { describe, it, expect } from 'vitest';
import { normaliseEnvelope } from './links';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from './types';

describe('normaliseEnvelope', () => {
  it('wraps a legacy bare array and adds pseudo-categories', () => {
    const env = normaliseEnvelope([{ id: 'a', url: 'x', name: 'n' }] as never);
    expect(env.version).toBe(2);
    expect(env.links).toHaveLength(1);
    const ids = env.categories.map((c) => c.id);
    expect(ids).toContain(FAVORITES_CATEGORY_ID);
    expect(ids).toContain(OTHER_CATEGORY_ID);
  });
  it('returns defaults for null', () => {
    expect(normaliseEnvelope(null).links).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/api/links.vitest.ts`
Expected: FAIL — `normaliseEnvelope` is not exported.

- [ ] **Step 3: Rewrite `src/api/links.ts`**

Keep the existing `DEFAULT_PSEUDO_CATEGORIES` and `normaliseEnvelope` bodies verbatim, but `export` `normaliseEnvelope`, and replace the `linksApi` object:
```ts
import { readDoc, writeDoc } from '@/lib/docStore';
import type { LinkItem, Category, LinksEnvelope } from './types';
import { FAVORITES_CATEGORY_ID, OTHER_CATEGORY_ID } from './types';

const DEFAULT_PSEUDO_CATEGORIES: Category[] = [
  { id: FAVORITES_CATEGORY_ID, name: 'Favorites', order: 0 },
  { id: OTHER_CATEGORY_ID, name: 'Other', order: 1_000_000 },
];

export function normaliseEnvelope(raw: LinkItem[] | LinksEnvelope | null | undefined): LinksEnvelope {
  // ... body unchanged from the current file ...
}

export const linksApi = {
  list: async (): Promise<LinksEnvelope> => {
    const raw = await readDoc<LinkItem[] | LinksEnvelope | null>('links', null);
    return normaliseEnvelope(raw);
  },
  saveAll: async (envelope: LinksEnvelope) => {
    await writeDoc('links', envelope);
    return { ok: true };
  },
};
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run src/api/links.vitest.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/links.ts src/api/links.vitest.ts
git commit -m "$(printf 'feat: back links with Supabase documents\n\nStores the v2 links envelope as a per-user document; normaliseEnvelope\nis kept (now exported + tested) so the v1 bare-array fallback and\npseudo-category backfill behave exactly as before.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: home client (documents)

**Files:**
- Rewrite: `src/api/home.ts`

**Interfaces:**
- Produces: `homeApi.{ list(): Promise<HomeEnvelope>, saveAll(env): Promise<{ok:boolean}> }`. Fallback for a fresh user is `{ version: 1, sections: [], widgets: [], habits: [] }`.

- [ ] **Step 1: Rewrite `src/api/home.ts`**

```ts
import { readDoc, writeDoc } from '@/lib/docStore';
import type { HomeEnvelope } from './types';

const EMPTY_HOME: HomeEnvelope = { version: 1, sections: [], widgets: [], habits: [] };

export const homeApi = {
  list: () => readDoc<HomeEnvelope>('home', EMPTY_HOME),
  saveAll: async (envelope: HomeEnvelope) => {
    await writeDoc('home', envelope);
    return { ok: true };
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (No test: this is a thin wrapper over the already-tested docStore; the empty-home fallback is exercised by the Task 14 smoke.)

- [ ] **Step 3: Commit**

```bash
git add src/api/home.ts
git commit -m "$(printf 'feat: back home layout with Supabase documents\n\nReplaces the /api/home calls with a per-user document; fresh users get\nan empty v1 envelope so the page renders without a 404.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 7: notes client (notes table)

**Files:**
- Rewrite: `src/api/notes.ts`

**Interfaces:**
- Produces: `notesApi.{ list(): Promise<Note[]>, create(note: Omit<Note,'id'>): Promise<Note>, update(id, patch): Promise<Note>, delete(id): Promise<{ok:boolean}> }`. Client generates `id` as `note_<ms>`.

- [ ] **Step 1: Rewrite `src/api/notes.ts`**

```ts
import { supabase } from '@/lib/supabase';
import type { Note } from './types';

type Row = { id: string; title: string; body: string; updated_at: number };
const toNote = (r: Row): Note => ({ id: r.id, title: r.title, body: r.body, updatedAt: r.updated_at });

export const notesApi = {
  list: async (): Promise<Note[]> => {
    const { data, error } = await supabase
      .from('notes')
      .select('id,title,body,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as Row[]).map(toNote);
  },

  create: async (note: Omit<Note, 'id'>): Promise<Note> => {
    const row = {
      id: `note_${Date.now()}`,
      title: note.title ?? '',
      body: note.body ?? '',
      updated_at: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now(),
    };
    const { data, error } = await supabase.from('notes').insert(row).select().single();
    if (error) throw error;
    return toNote(data as Row);
  },

  update: async (id: string, patch: Partial<Note>): Promise<Note> => {
    const upd: Partial<Row> = {};
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.body !== undefined) upd.body = patch.body;
    upd.updated_at = typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now();
    const { data, error } = await supabase.from('notes').update(upd).eq('id', id).select().single();
    if (error) throw error;
    return toNote(data as Row);
  },

  delete: async (id: string): Promise<{ ok: boolean }> => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. `useNotes.ts` is unchanged (signatures match).

- [ ] **Step 3: Commit**

```bash
git add src/api/notes.ts
git commit -m "$(printf 'feat: back notes with a Supabase notes table\n\nFull CRUD against the per-row notes table with client-generated\nnote_<ms> ids, preserving the notesApi list/create/update/delete\nsignatures the useNotes hook relies on.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 8: function shared libs — Supabase admin + cache helper

**Files:**
- Create: `api/_lib/supabaseAdmin.ts`
- Create: `api/_lib/cache.ts`
- Test: `api/_lib/cache.vitest.ts`

**Interfaces:**
- Produces: `admin` (service-role `SupabaseClient`) from `api/_lib/supabaseAdmin`. `getCached<T>(key, ttlMs, fetcher: () => Promise<T>): Promise<T>` from `api/_lib/cache` — returns fresh cache if within TTL, else runs `fetcher`, stores, and returns it; on `fetcher` failure returns stale cache if any, else rethrows.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/cache.vitest.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: Record<string, { data: unknown; fetched_at: string }> = {};
vi.mock('./supabaseAdmin', () => ({
  admin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: store['k'] ?? null, error: null }) }) }),
      upsert: async (row: { key: string; data: unknown; fetched_at: string }) => {
        store[row.key] = { data: row.data, fetched_at: row.fetched_at };
        return { error: null };
      },
    }),
  },
}));

import { getCached } from './cache';

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe('getCached', () => {
  it('runs the fetcher and stores on a cold cache', async () => {
    const fetcher = vi.fn(async () => ['fresh']);
    const out = await getCached('k', 60_000, fetcher);
    expect(out).toEqual(['fresh']);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('serves stale data when the fetcher throws', async () => {
    store['k'] = { data: ['old'], fetched_at: new Date(0).toISOString() };
    const out = await getCached('k', 60_000, async () => { throw new Error('boom'); });
    expect(out).toEqual(['old']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/cache.vitest.ts`
Expected: FAIL — cannot find `./cache`.

- [ ] **Step 3: Implement `api/_lib/supabaseAdmin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL as string;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Service-role client: bypasses RLS. Server-only — never import under src/.
export const admin = createClient(url, key, { auth: { persistSession: false } });
```

- [ ] **Step 4: Implement `api/_lib/cache.ts`**

```ts
import { admin } from './supabaseAdmin';

export async function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const { data: row } = await admin.from('cache').select('data,fetched_at').eq('key', key).maybeSingle();
  const fresh = row && Date.now() - new Date(row.fetched_at as string).getTime() < ttlMs;
  if (fresh) return row!.data as T;

  try {
    const data = await fetcher();
    await admin.from('cache').upsert({ key, data, fetched_at: new Date().toISOString() });
    return data;
  } catch (err) {
    if (row) return row.data as T; // serve stale on upstream failure
    throw err;
  }
}
```

Note: `new Date()` / `Date.now()` are fine in function runtime code (only the Workflow scripting sandbox forbids them).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run api/_lib/cache.vitest.ts`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/supabaseAdmin.ts api/_lib/cache.ts api/_lib/cache.vitest.ts
git commit -m "$(printf 'feat: function libs for service-role Supabase + TTL cache\n\nadmin client (service role, bypasses RLS) and getCached() which serves\nfresh data within TTL, refreshes on miss, and falls back to stale data\nwhen the upstream fetch fails.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 9: `/api/news` function

**Behavioural reference:** `server/api.py` `fetch_news` (line 538), `fetch_vg_news` (520), and the RSS helpers it calls. **MVP simplification (deliberate):** VG is served from its RSS feed (`https://www.vg.no/rss/feed/`) like NRK/Aftenposten, dropping the homepage JSON-LD ordering scrape. The frontend `isVgArticle` filter still applies. Log this so the dropped ordering is not mistaken for full parity.

**Files:**
- Create: `api/_lib/news.ts` (pure parser + fetch)
- Create: `api/news.ts` (handler)
- Test: `api/_lib/news.vitest.ts`

**Interfaces:**
- Produces: `parseRss(xml: string): NewsItem[]` and `fetchNews(source: 'vg'|'nrk'|'aftenposten'): Promise<NewsItem[]>` in `api/_lib/news`. Handler `GET /api/news?source=&count=&offset=` returns `NewsItem[]`. `NewsItem = { link, title, desc, img }`.

- [ ] **Step 1: Write the failing test**

Create `api/_lib/news.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseRss } from './news';

const SAMPLE = `<?xml version="1.0"?><rss><channel>
  <item>
    <title>Sak A</title>
    <link>https://www.nrk.no/a-1.2</link>
    <description><![CDATA[Beskrivelse A]]></description>
    <enclosure url="https://img/a.jpg" type="image/jpeg"/>
  </item>
  <item>
    <title>Sak B</title>
    <link>https://www.nrk.no/b-3.4</link>
    <description>Beskrivelse B</description>
  </item>
</channel></rss>`;

describe('parseRss', () => {
  it('extracts link/title/desc/img per item', () => {
    const items = parseRss(SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      link: 'https://www.nrk.no/a-1.2',
      title: 'Sak A',
      desc: 'Beskrivelse A',
      img: 'https://img/a.jpg',
    });
    expect(items[1].img).toBe(''); // no enclosure → empty string
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/news.vitest.ts`
Expected: FAIL — cannot find `./news`.

- [ ] **Step 3: Implement `api/_lib/news.ts`**

```ts
import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from '../../src/api/types';

const FEEDS: Record<string, string> = {
  vg: 'https://www.vg.no/rss/feed/',
  nrk: 'https://www.nrk.no/toppsaker.rss',
  aftenposten: 'https://www.aftenposten.no/rss',
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export function parseRss(xml: string): NewsItem[] {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.map((it: Record<string, unknown>) => {
    const enclosure = it.enclosure as { '@_url'?: string } | undefined;
    const media = it['media:content'] as { '@_url'?: string } | undefined;
    return {
      link: String(it.link ?? ''),
      title: String(it.title ?? '').trim(),
      desc: String(it.description ?? '').trim(),
      img: enclosure?.['@_url'] ?? media?.['@_url'] ?? '',
    };
  });
}

export async function fetchNews(source: keyof typeof FEEDS): Promise<NewsItem[]> {
  const url = FEEDS[source] ?? FEEDS.vg;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 DashboardBot' } });
  if (!res.ok) throw new Error(`feed ${source} ${res.status}`);
  return parseRss(await res.text());
}
```

- [ ] **Step 4: Implement `api/news.ts` handler**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchNews } from './_lib/news';
import { getCached } from './_lib/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const source = (String(req.query.source ?? 'vg')) as 'vg' | 'nrk' | 'aftenposten';
  const count = Number(req.query.count ?? 8);
  const offset = Number(req.query.offset ?? 0);
  try {
    const items = await getCached(`news:${source}`, 5 * 60_000, () => fetchNews(source));
    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json(items.slice(offset, offset + count));
  } catch {
    res.status(200).json([]); // news is non-critical; never break the home page
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run api/_lib/news.vitest.ts`
Expected: PASS.

- [ ] **Step 6: Manual check via `vercel dev`**

Run `vercel dev`, then `curl 'http://localhost:3000/api/news?source=nrk&count=3'` → expect a JSON array of 3 items with non-empty `title`/`link`.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/news.ts api/_lib/news.vitest.ts api/news.ts
git commit -m "$(printf 'feat: /api/news Vercel function (RSS, cached)\n\nServes VG/NRK/Aftenposten from their RSS feeds via fast-xml-parser,\ncached 5 min in Supabase. VG drops the old homepage-ordering scrape\n(MVP); the frontend vg.no filter still applies.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 10: `/api/wishlist` function + repoint wishlist/news clients

**Behavioural reference:** `server/api.py` `fetch_wishlist` (line 305) — Steam `GetWishlist` → per-app `appdetails` (cc=no) → map to `WishlistGame` → ITAD `lookup` for `itadId` → ITAD `history` to tag `priceTag:'hot'` when current discount is within 5 points of the all-time best cut → sort by `(priority, name)`.

**Files:**
- Create: `api/_lib/wishlist.ts` (pure builder taking an injected `fetch`)
- Create: `api/wishlist.ts` (handler)
- Modify: `src/api/wishlist.ts`, `src/api/news.ts` (use plain `fetch`, drop `./client`)
- Test: `api/_lib/wishlist.vitest.ts`

**Interfaces:**
- Produces: `buildWishlist(env: { steamKey, steamId, itadKey }, fetchImpl?): Promise<WishlistGame[]>` in `api/_lib/wishlist`. Handler `GET /api/wishlist` → `WishlistGame[]`.

- [ ] **Step 1: Write the failing test** (mapping + sort + hot-tag, with a stub fetch)

Create `api/_lib/wishlist.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildWishlist } from './wishlist';

function stubFetch(url: string) {
  const json = (o: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(o), text: () => Promise.resolve('') } as Response);
  if (url.includes('GetWishlist')) return json({ response: { items: [
    { appid: 10, priority: 2, date_added: 100 },
    { appid: 20, priority: 1, date_added: 200 },
  ] } });
  if (url.includes('appdetails?appids=10')) return json({ '10': { success: true, data: { name: 'Alpha', price_overview: { discount_percent: 50, final: 9900, final_formatted: 'kr 99', initial_formatted: 'kr 199', currency: 'NOK' }, genres: [{ description: 'RPG' }] } } });
  if (url.includes('appdetails?appids=20')) return json({ '20': { success: true, data: { name: 'Beta', is_free: true, genres: [] } } });
  if (url.includes('lookup')) return json({ game: { id: 'itad-x' } });
  if (url.includes('history')) return json([{ deal: { cut: 50 } }, { deal: { cut: 30 } }]);
  return json({});
}

describe('buildWishlist', () => {
  it('maps, sorts by priority, and tags all-time-low sales as hot', async () => {
    const games = await buildWishlist({ steamKey: 'k', steamId: 's', itadKey: 'i' }, stubFetch as typeof fetch);
    expect(games.map((g) => g.appid)).toEqual(['20', '10']); // priority 1 before 2
    const alpha = games.find((g) => g.appid === '10')!;
    expect(alpha.onSale).toBe(true);
    expect(alpha.priceTag).toBe('hot'); // discount 50 >= best cut 50 - 5
    expect(games.find((g) => g.appid === '20')!.isFree).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/wishlist.vitest.ts`
Expected: FAIL — cannot find `./wishlist`.

- [ ] **Step 3: Implement `api/_lib/wishlist.ts`**

Port `fetch_wishlist` faithfully (see reference above). Signature:
```ts
import type { WishlistGame } from '../../src/api/types';

export interface WishlistEnv { steamKey: string; steamId: string; itadKey: string; }

export async function buildWishlist(env: WishlistEnv, fetchImpl: typeof fetch = fetch): Promise<WishlistGame[]> {
  // 1. GetWishlist → items[]; if empty, return [].
  // 2. For each appid: appdetails?appids=<id>&cc=no&filters=basic,price_overview,genres
  // 3. Map to WishlistGame exactly as the Python does (imgUrl/imgFallback/storeUrl,
  //    isFree, price, origPrice, discount, onSale, genres, priority, dateAdded,
  //    priceInt, currency, priceTag:null, itadId:null).
  // 4. For each game: ITAD lookup → itadId.
  // 5. For on-sale games with itadId: ITAD history?shops=61&since=2013-01-01 →
  //    best cut; if discount >= bestCut - 5 → priceTag = 'hot'.
  // 6. sort by (priority, name.toLowerCase()).
  // Wrap each network call in try/catch and continue on failure, like the Python.
}
```
Implement the full body following the Python line-by-line; use `fetchImpl` for every request so the test can inject `stubFetch`.

- [ ] **Step 4: Implement `api/wishlist.ts` handler**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildWishlist } from './_lib/wishlist';
import { getCached } from './_lib/cache';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const env = {
    steamKey: process.env.STEAM_API_KEY as string,
    steamId: process.env.STEAM_ID as string,
    itadKey: process.env.ITAD_API_KEY as string,
  };
  try {
    const games = await getCached('wishlist', 60 * 60_000, () => buildWishlist(env));
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.status(200).json(games);
  } catch {
    res.status(200).json([]);
  }
}
```

- [ ] **Step 5: Repoint the frontend clients off `./client`**

`src/api/wishlist.ts`:
```ts
import type { WishlistGame } from './types';

export const wishlistApi = {
  list: async (): Promise<WishlistGame[]> => {
    const res = await fetch('/api/wishlist');
    if (!res.ok) throw new Error(`wishlist ${res.status}`);
    return res.json();
  },
};
```
`src/api/news.ts`: keep `isVgArticle` and the `NewsSource` type; replace the two `api.get` calls with `fetch('/api/news?source=...&count=...')` + `.json()`. Preserve the VG over-fetch (`count + 6`) + filter + slice logic.

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run api/_lib/wishlist.vitest.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Manual check via `vercel dev`**

`curl http://localhost:3000/api/wishlist` → JSON array of games (needs the Steam/ITAD env vars set). Open `/gaming` in the browser and confirm the list renders.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/wishlist.ts api/_lib/wishlist.vitest.ts api/wishlist.ts src/api/wishlist.ts src/api/news.ts
git commit -m "$(printf 'feat: /api/wishlist function + repoint news/wishlist clients\n\nPorts the Steam+ITAD wishlist aggregation to a Vercel function (cached\n1h), with a pure injectable builder for testing. Frontend wishlist/news\nclients now use plain fetch against the functions, dropping ./client.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 11: Remove the Tools section

**Files:**
- Modify: `src/App.tsx` (drop 9 tool routes + imports)
- Delete: `src/pages/ToolsPage.tsx`, `src/pages/tools/` (all 8 files)
- Modify: `src/components/layout/navConfig.tsx` (drop the Verktøy entry + unused icon import)
- Modify: any home-page tile linking to `/tools` (see grep) — `src/pages/HomePage.tsx`, `src/components/home/SectionKategorier.tsx`, `src/components/widgets/WidgetsSection.tsx`

**Interfaces:** none produced.

- [ ] **Step 1: Find every Tools reference**

Run: `grep -rn "/tools\|ToolsPage\|pages/tools\|Verktøy\|WrenchIcon" src`
Note each hit; they all get removed or repointed.

- [ ] **Step 2: Delete the tool pages**

```bash
git rm src/pages/ToolsPage.tsx
git rm -r src/pages/tools
```

- [ ] **Step 3: Edit `src/App.tsx`**

Remove the 9 `import` lines for `ToolsPage` + `Tool*Page`, and the 9 `<Route path="/tools..." .../>` lines (keep `<Route path="*" element={<NotFoundPage />} />`).

- [ ] **Step 4: Edit `navConfig.tsx`**

Remove the `{ to: '/tools', label: 'Verktøy', ... }` object and the now-unused `WrenchIcon` import.

- [ ] **Step 5: Repoint/remove home tiles**

In the grep hits under `src/pages/HomePage.tsx` / `src/components/home/SectionKategorier.tsx` / `src/components/widgets/WidgetsSection.tsx`, remove any card or link that targets `/tools` or a tool subpath. Leave timer/pomodoro/stopwatch *widgets* intact — they use `TimerContext`, not the deleted `/tools/timer` page. Only remove links that navigate to a deleted route.

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS, no unresolved imports, no references to deleted routes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: remove the Tools section\n\nDeletes all tool pages (calculator, QR, timer, reader, video, bgremove,\npdf, convert), their routes, and the Verktoy nav entry. Timer-based\nhome widgets stay (they use TimerContext, not the tools pages).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 12: Remove Skole + the bug/feature reporter

**Files:**
- Delete: `src/pages/SkolePage.tsx`, `src/hooks/useSkole.ts`, `src/api/skole.ts`
- Delete: `src/components/report/` (ReportProvider + related), `src/api/reports.ts`, `vite-plugins/reports.ts`
- Modify: `src/App.tsx` (drop Skole route + ReportProvider wrapper), `src/components/layout/navConfig.tsx` (drop Skole + GraduationCapIcon), `vite.config.ts` (drop `reportsDevPlugin`)
- Modify: any component invoking the report UI (grep)

**Interfaces:** none produced.

- [ ] **Step 1: Find references**

Run: `grep -rn "skole\|Skole\|GraduationCap\|ReportProvider\|reportsDevPlugin\|api/reports\|useReport" src vite.config.ts vite-plugins`

- [ ] **Step 2: Delete files**

```bash
git rm src/pages/SkolePage.tsx src/hooks/useSkole.ts src/api/skole.ts src/api/reports.ts
git rm -r src/components/report
git rm vite-plugins/reports.ts
```

- [ ] **Step 3: Edit `src/App.tsx`**

Remove the `SkolePage` import + `<Route path="/skole" .../>`. Remove the `ReportProvider` import and unwrap it from the guarded route element (leave `AppShell` + `Outlet`).

- [ ] **Step 4: Edit `navConfig.tsx`**

Remove the Skole nav object and the `GraduationCapIcon` import.

- [ ] **Step 5: Edit `vite.config.ts`**

Remove the `reportsDevPlugin` import and its entry in the `plugins` array.

- [ ] **Step 6: Remove report triggers**

In any grep hit (e.g. a "Report a bug" button in `AppShell`/`Sidebar`), remove the trigger UI and its imports.

- [ ] **Step 7: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: remove Skole page and the bug/feature reporter\n\nDrops the Canvas/Skole integration (page, hook, client) and the in-app\nreporter (provider, client, dev plugin) along with their routes, nav\nentry, and UI triggers. Neither has a serverless home.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 13: Favicon direct URL + delete dead `client.ts`/`pdf.ts` + trim types

**Files:**
- Modify: `src/api/pdf.ts` → reduce to `faviconUrl` only, pointing at Google; delete `pdfUrl`
- Delete: `src/api/client.ts`
- Modify: `src/api/types.ts` (drop Skole/News-unused types as appropriate)
- Modify: callers of `pdfUrl` (e.g. `PdfViewer`) — see grep
- Test: `src/api/favicon.vitest.ts`

**Interfaces:**
- Produces: `faviconUrl(domain: string): string` → `https://www.google.com/s2/favicons?domain=<domain>&sz=64`.

- [ ] **Step 1: Confirm `client.ts` has no importers left**

Run: `grep -rn "from './client'\|from '@/api/client'\|api/client" src`
Expected: no matches (auth/todos/plan/notes/links/home/wishlist/news all migrated). If any remain, migrate them before deleting.

- [ ] **Step 2: Find `pdfUrl` callers**

Run: `grep -rn "pdfUrl\|PdfViewer\|from '@/api/pdf'\|api/pdf" src`
Remove `pdfUrl` usages (the only caller was the Skole `PdfViewer`, deleted in Task 12). If `PdfViewer` still exists and is unused, delete it.

- [ ] **Step 3: Write the failing favicon test**

Create `src/api/favicon.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { faviconUrl } from './pdf';

describe('faviconUrl', () => {
  it('points at the Google favicon service', () => {
    expect(faviconUrl('example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=64');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/api/favicon.vitest.ts`
Expected: FAIL — current `faviconUrl` returns `/api/favicon?...`.

- [ ] **Step 5: Rewrite `src/api/pdf.ts`**

```ts
/** Favicon via Google's public service (works as an <img> src, no proxy). */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
```
(Optionally rename the file to `src/api/favicon.ts` and update the two importers — `LinkCard.tsx`, `IconPicker.tsx`; if renaming, update the test import too. Renaming is optional; leaving it as `pdf.ts` is acceptable for MVP.)

- [ ] **Step 6: Delete `client.ts` + trim types**

```bash
git rm src/api/client.ts
```
In `src/api/types.ts`, remove the now-unused `Skole*` interfaces and the `ApiOk`/`ApiError` types if nothing imports them (grep first: `grep -rn "Skole\|ApiOk\b" src`). Keep `NewsItem`, `WishlistGame`, `User`, `Todo`, `PlanItem`, `Note`, `LinkItem`, `Category`, `LinksEnvelope`, `Home*`.

- [ ] **Step 7: Run test + typecheck + build**

Run: `npx vitest run src/api/favicon.vitest.ts && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: direct Google favicons, delete dead fetch client\n\nfaviconUrl now points straight at Googles favicon service (no proxy),\nthe pdfUrl helper and the cookie fetch client are removed, and the\nunused Skole/generic types are trimmed.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 14: Playwright smoke test + full verification

**Files:**
- Create: `tests/e2e/smoke.spec.ts` (or follow the existing Playwright layout if one exists — grep `playwright.config`)
- Modify: `package.json` (add `test:e2e` script if absent)

**Interfaces:** none produced.

- [ ] **Step 1: Confirm Playwright setup**

Run: `ls playwright.config.* 2>/dev/null; grep -n playwright package.json`
If Playwright is not installed: `npm i -D @playwright/test && npx playwright install chromium` and add `playwright.config.ts` with `webServer` running `vercel dev` on port 3000 (so functions are live), `baseURL: 'http://localhost:3000'`.

- [ ] **Step 2: Write the smoke spec**

`tests/e2e/smoke.spec.ts` — uses test credentials from env (`E2E_EMAIL`, `E2E_PASSWORD` for the account created in Task 3):
```ts
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
```

- [ ] **Step 3: Run the smoke test**

Run: `E2E_EMAIL=... E2E_PASSWORD=... npx playwright test`
Expected: PASS. (DnD interactions remain manual-verify per project CLAUDE.md — do not script them.)

- [ ] **Step 4: Full verification gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS. Manually verify in `vercel dev`: create a todo, reload — it persists (Supabase). Create/edit/delete a note. Add a link. Reorder home sections, reload — order persists.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'test: end-to-end smoke for the Supabase/Vercel stack\n\nPlaywright login flow asserts the CRUD pages render and the news +\nwishlist functions respond. DnD stays manual-verify.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 15: Delete the Python backend + VPS scripts; update docs

**Files:**
- Delete: `server/`, `_deploy_api.py`, `_deploy_frontend.py`, `_apply_migrations.py`, and other VPS-only scripts (grep)
- Modify: `CLAUDE.md` (rewrite Stack/Deploy/DB/Auth sections for the new architecture)

**Interfaces:** none.

- [ ] **Step 1: Inventory what to remove**

Run: `git ls-files | grep -E '^server/|^_deploy|_apply_migrations|_migrate_|_headless_test|_setup_'`
Confirm each is VPS-only and unreferenced by the frontend (`grep -rn "server/" src` should be empty).

- [ ] **Step 2: Delete**

```bash
git rm -r server
git rm _deploy_api.py _deploy_frontend.py _apply_migrations.py
# plus any other matches from Step 1 that are tracked
```

- [ ] **Step 3: Rewrite `CLAUDE.md`**

Replace the Stack, Deploy, Database, Auth, and Server-conventions sections with the new reality: static Vite on Vercel, Supabase (Postgres + Auth, RLS), `documents`/`notes`/`cache` tables, two functions under `api/`, `supabase/migrations/` for schema, `vercel dev` for local function testing, env vars in `.env.local` + Vercel dashboard. Keep the Frontend conventions, DnD, and Git workflow sections. Update the critical-commands table (drop the `_deploy_*` rows; add `vercel dev` and `vercel --prod`).

- [ ] **Step 4: Typecheck + build (sanity)**

Run: `npm run typecheck && npm run build`
Expected: PASS (no source touched, but confirm nothing imported from `server/`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'chore: remove Python backend + VPS tooling, update docs\n\nThe Hetzner VPS, Python services, nginx/systemd, and deploy scripts are\ngone. CLAUDE.md now documents the Vercel + Supabase architecture.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 16: Rotate the leaked ITAD key

**Files:**
- Modify: `src/lib/itadHistory.ts`

**Interfaces:** none.

- [ ] **Step 1: Rotate (manual)**

In the IsThereAnyDeal account, revoke the key `bbb182d0...` currently hardcoded in `src/lib/itadHistory.ts` and issue a new one. (The repo is public; the old key is compromised.)

- [ ] **Step 2: Decide where the new key lives**

The price-history chart calls ITAD directly from the browser, so the key is unavoidably client-visible. For MVP keep it client-side but as a build-time env var rather than a literal: add `VITE_ITAD_KEY` to `.env.local` / Vercel and read `import.meta.env.VITE_ITAD_KEY` in `itadHistory.ts`. (A client-visible key is still low-value; this just removes the literal from source and lets you rotate without a code change.)

- [ ] **Step 3: Edit `src/lib/itadHistory.ts`**

Replace the hardcoded key constant with `const ITAD_KEY = import.meta.env.VITE_ITAD_KEY as string;` and add `VITE_ITAD_KEY=` to `.env.example`.

- [ ] **Step 4: Typecheck + manual check**

Run: `npm run typecheck`. In `vercel dev`, open a wishlist game's detail modal and confirm the price-history chart still loads.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itadHistory.ts .env.example
git commit -m "$(printf 'fix: move ITAD key to an env var and rotate it\n\nThe old key was committed to a public repo. Reads VITE_ITAD_KEY at\nbuild time instead of a source literal so it can be rotated without a\ncode change.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Final integration

After all tasks: open a PR from `feat/vercel-supabase-migration` to `main` referencing the migration issue. Deploy to Vercel production (`vercel --prod` or via the dashboard), set production env vars, and run the Task 14 smoke against the production URL once. Decommission the Hetzner VPS only after production is confirmed working.

---

## Self-Review

**Spec coverage:**
- Vercel static host → Task 1 (`vercel.json`), Task 14/Final (deploy).
- Supabase Postgres + Auth + RLS → Tasks 2, 3.
- Browser-direct CRUD, no CRUD server → Tasks 4-7.
- Two functions (wishlist, news) with secrets + cache → Tasks 8-10.
- Drop Skole, Tools, report, pdf, favicon proxy → Tasks 11, 12, 13.
- Direct Google favicons → Task 13.
- Fresh data (no migration) → no task needed (covered by not writing one; called out in spec).
- Delete Python backend + VPS → Task 15.
- Rotate ITAD key → Task 16.
- Testing/verification → Tasks have per-task gates; Task 14 is the end-to-end gate.
All spec sections map to a task.

**Placeholder scan:** The `buildWishlist` body in Task 10 Step 3 is given as a structured port-spec (numbered behaviour + exact field list + cited Python source) rather than full literal code, because it is a faithful translation of `server/api.py:305-421` which stays in git history until Task 15 and is referenced directly. This is the one intentional non-literal; every other code step is complete.

**Type consistency:** `User.id` widened to `string` in Task 3 and used as such in `mapUser`/`useAuthSync`. `readDoc`/`writeDoc` signatures in Task 4 match their uses in Tasks 4-6. `getCached(key, ttlMs, fetcher)` defined in Task 8 matches calls in Tasks 9-10. `NewsItem`/`WishlistGame` imported from `src/api/types` in the function libs. `faviconUrl` signature unchanged for its callers.
