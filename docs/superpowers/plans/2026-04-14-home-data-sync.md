# Home Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Move the home-page layout (section order, widget list, habits) from per-browser localStorage to a single `/api/home` envelope on the backend. Timer state stays in localStorage.

**Architecture:** Add `GET`/`POST /api/home` routes to `api.py` mirroring the existing `/api/links` pattern. On the client, add `useHome`/`useSaveHome` React Query hooks; rewrite `useWidgets`, `useHabits`, and `HomePage`'s section-order storage on top of them. A one-shot migration hook pushes existing localStorage data to the backend on first load and then clears the old keys.

**Tech Stack:** React 18 + TypeScript, @tanstack/react-query, Python stdlib `http.server`, vitest.

**Spec:** `docs/superpowers/specs/2026-04-14-home-data-sync-design.md`

---

## File structure

**New:**
- `src/api/home.ts` — thin fetch wrapper.
- `src/hooks/useHome.ts` — React Query hooks (`useHome`, `useSaveHome`).
- `src/hooks/useHomeMigration.ts` — one-shot localStorage → backend migration.
- `src/lib/homeMigration.ts` — pure functions extracted for unit testing.

**Modified:**
- `../Dashboard/api.py` — add GET/POST `/api/home`.
- `src/api/types.ts` — add `HomeEnvelope`, `HomeWidget`, `HomeHabit`.
- `src/hooks/useWidgets.ts` — rewrite on top of home envelope.
- `src/hooks/useHabits.ts` — rewrite on top of home envelope.
- `src/pages/HomePage.tsx` — replace `useLocalStorage('home-section-order', …)` with home envelope; mount `useHomeMigration()`.
- `src/api/queryKeys.ts` — add `home` query key.

---

## Task 1: Backend — `GET` / `POST /api/home` routes in api.py

**Files:**
- Modify: `C:\Users\Admin\Documents\Claude\Github\Dashboard\api.py`

- [ ] **Step 1: Read the existing `/api/links` handler for pattern.**

Look at `api.py` lines ~485 (GET) and ~580 (POST). The pattern is:
- GET: `elif self.path == '/api/X':` inside `do_GET`, opens the JSON file, dumps to body.
- POST: `elif self.path == '/api/X':` inside `do_POST` sets `file_path = X_FILE`, the shared POST logic writes the body to that path.

Note: `LINKS_FILE` is a module-level constant pointing at `/opt/dashboard/www/links.json`.

- [ ] **Step 2: Add `HOME_FILE` constant.**

Near the existing file-path constants at the top of `api.py`, add:

```python
HOME_FILE = '/opt/dashboard/www/home.json'
```

- [ ] **Step 3: Add the GET branch.**

In `do_GET`, next to the `/api/links` branch, add:

```python
elif self.path == '/api/home':
    try:
        if os.path.exists(HOME_FILE):
            data = json.load(open(HOME_FILE))
        else:
            data = {'version': 1, 'sections': [], 'widgets': [], 'habits': []}
    except Exception:
        data = {'version': 1, 'sections': [], 'widgets': [], 'habits': []}
    body = json.dumps(data).encode()
```

- [ ] **Step 4: Add the POST branch.**

In `do_POST`, next to the `/api/links` branch, add:

```python
elif self.path == '/api/home':
    file_path = HOME_FILE
```

(The shared write logic below that switch handles reading the request body and writing the file.)

- [ ] **Step 5: Manual smoke (do NOT deploy yet).**

Run `api.py` locally (or just visually review the diff) to confirm:
- `do_GET` has the new `elif self.path == '/api/home':` branch and returns the empty envelope when the file doesn't exist.
- `do_POST` routes `/api/home` to `HOME_FILE`.

- [ ] **Step 6: Commit.**

```bash
cd /c/Users/Admin/Documents/Claude/Github/Dashboard
git add api.py
# if that repo is git-tracked; otherwise skip. The react project is what we commit in.
```

Actually: the `api.py` lives in a separate directory (`../Dashboard/api.py`). Commit ordering:
- Back in the worktree for this feature (`.worktrees/feat-home-sync`), commit the spec/plan changes.
- `api.py` itself is tracked in its own repo (if any); otherwise the change stays local and gets uploaded by `_deploy_api.py`.

For THIS task, just document the change with a commit in the `dashboard-react` worktree:

```bash
git add docs/superpowers/plans/2026-04-14-home-data-sync.md
git commit -m "feat(api): add GET/POST /api/home route (api.py edited out of tree)"
```

> Note to implementer: because `api.py` is outside the react repo, its change cannot be part of a worktree commit. Leave the edited `api.py` in its checkout; the final deploy step will push it via `_deploy_api.py`.

---

## Task 2: Client types + API wrapper

**Files:**
- Modify: `src/api/types.ts`
- Create: `src/api/home.ts`
- Modify: `src/hooks/queryKeys.ts`

- [ ] **Step 1: Add envelope types to `src/api/types.ts`.**

Append at the bottom of the file:

```ts
/** Single envelope for all home-page server-persisted data. */
export interface HomeEnvelope {
  version: 1;
  /** Section IDs in the order they render on the home page. */
  sections: string[];
  widgets: HomeWidget[];
  habits: HomeHabit[];
}

/** Persisted widget tile (NOT the timer runtime state). */
export interface HomeWidget {
  id: string;
  type: 'habit' | 'countdown' | 'pomodoro' | 'stopwatch' | 'alarm';
  refId: string;
}

/** Persisted habit. Matches the existing `Habit` type in useHabits.ts. */
export interface HomeHabit {
  id: string;
  name: string;
  color: string;
  /** ISO "YYYY-MM-DD" strings. */
  completedDays: string[];
  /** ISO timestamp. */
  createdAt: string;
}
```

- [ ] **Step 2: Create `src/api/home.ts`.**

```ts
import { api } from './client';
import type { HomeEnvelope } from './types';

export const homeApi = {
  list: (): Promise<HomeEnvelope> => api.get<HomeEnvelope>('/home'),
  saveAll: (envelope: HomeEnvelope): Promise<{ ok: boolean }> =>
    api.post<{ ok: boolean }>('/home', envelope),
};
```

The `api` helper already prepends `/api` (see `src/api/links.ts`).

- [ ] **Step 3: Add the query key.**

In `src/hooks/queryKeys.ts`, add a `home` entry to the `queryKeys` object:

```ts
export const queryKeys = {
  // ...existing keys,
  home: ['home'] as const,
};
```

- [ ] **Step 4: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/api/types.ts src/api/home.ts src/hooks/queryKeys.ts
git commit -m "feat(home): add HomeEnvelope types + homeApi client"
```

---

## Task 3: `useHome` / `useSaveHome` React Query hooks

**Files:**
- Create: `src/hooks/useHome.ts`

- [ ] **Step 1: Write the hooks.**

```ts
// src/hooks/useHome.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { homeApi } from '@/api/home';
import type { HomeEnvelope } from '@/api/types';
import { queryKeys } from './queryKeys';

/**
 * Fetches the single home-page envelope: { version, sections, widgets, habits }.
 * If the backend returns an empty or malformed payload, `data` is still populated
 * with a well-formed empty envelope so consumers never see `undefined` fields.
 */
export function useHome() {
  return useQuery({
    queryKey: queryKeys.home,
    queryFn: async () => {
      const raw = await homeApi.list();
      return normaliseHome(raw);
    },
    staleTime: 60_000,
  });
}

/**
 * Saves the full envelope. Callers construct the next envelope and call
 * `.mutate(next)`. Optimistic update swaps it in immediately; rolls back on error.
 */
export function useSaveHome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (envelope: HomeEnvelope) => homeApi.saveAll(envelope),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: queryKeys.home });
      const previous = qc.getQueryData<HomeEnvelope>(queryKeys.home);
      qc.setQueryData(queryKeys.home, next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.home, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.home });
    },
  });
}

export function normaliseHome(raw: Partial<HomeEnvelope> | null | undefined): HomeEnvelope {
  return {
    version: 1,
    sections: Array.isArray(raw?.sections) ? raw!.sections : [],
    widgets: Array.isArray(raw?.widgets) ? raw!.widgets : [],
    habits: Array.isArray(raw?.habits) ? raw!.habits : [],
  };
}
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/hooks/useHome.ts
git commit -m "feat(home): useHome and useSaveHome React Query hooks"
```

---

## Task 4: Migration — extract pure logic + write tests first

**Files:**
- Create: `src/lib/homeMigration.ts`
- Create: `src/lib/homeMigration.vitest.ts`
- Create: `src/hooks/useHomeMigration.ts`

- [ ] **Step 1: Write the failing tests.**

Create `src/lib/homeMigration.vitest.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLocalStorageHome,
  decideMigration,
  clearLocalStorageHome,
  LOCAL_STORAGE_KEYS,
} from './homeMigration';
import type { HomeEnvelope } from '@/api/types';

function emptyEnvelope(): HomeEnvelope {
  return { version: 1, sections: [], widgets: [], habits: [] };
}

describe('readLocalStorageHome', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty envelope when no keys are set', () => {
    expect(readLocalStorageHome()).toEqual(emptyEnvelope());
  });

  it('reads all three keys when present', () => {
    localStorage.setItem('home-section-order', JSON.stringify(['widgets', 'news']));
    localStorage.setItem('home-widgets-v1', JSON.stringify([{ id: 'w1', type: 'alarm', refId: 'alarm' }]));
    localStorage.setItem('home-habits-v1', JSON.stringify([
      { id: 'h1', name: 'Run', color: '#34d399', completedDays: ['2026-04-12'], createdAt: '2026-04-12T00:00:00Z' },
    ]));
    const env = readLocalStorageHome();
    expect(env.sections).toEqual(['widgets', 'news']);
    expect(env.widgets).toHaveLength(1);
    expect(env.habits).toHaveLength(1);
  });

  it('tolerates malformed JSON per key (returns empty for that key only)', () => {
    localStorage.setItem('home-section-order', '{ malformed ]');
    localStorage.setItem('home-widgets-v1', JSON.stringify([{ id: 'w1', type: 'alarm', refId: 'alarm' }]));
    const env = readLocalStorageHome();
    expect(env.sections).toEqual([]);
    expect(env.widgets).toHaveLength(1);
  });
});

describe('decideMigration', () => {
  it('returns shouldMigrate=false when backend is non-empty', () => {
    const backend: HomeEnvelope = {
      version: 1, sections: ['widgets'], widgets: [], habits: [],
    };
    const local = readLocalStorageHome();
    expect(decideMigration(backend, local).shouldMigrate).toBe(false);
  });

  it('returns shouldMigrate=false when both backend and local are empty', () => {
    expect(decideMigration(emptyEnvelope(), emptyEnvelope()).shouldMigrate).toBe(false);
  });

  it('returns shouldMigrate=true when backend empty and local has data', () => {
    const local: HomeEnvelope = {
      version: 1,
      sections: ['widgets'],
      widgets: [{ id: 'w1', type: 'alarm', refId: 'alarm' }],
      habits: [],
    };
    const result = decideMigration(emptyEnvelope(), local);
    expect(result.shouldMigrate).toBe(true);
    expect(result.next).toEqual(local);
  });
});

describe('clearLocalStorageHome', () => {
  it('removes all three migration keys', () => {
    for (const k of LOCAL_STORAGE_KEYS) localStorage.setItem(k, 'x');
    clearLocalStorageHome();
    for (const k of LOCAL_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — they fail because `homeMigration.ts` doesn't exist.**

Run: `npm test -- homeMigration.vitest.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure module.**

Create `src/lib/homeMigration.ts`:

```ts
import type { HomeEnvelope, HomeWidget, HomeHabit } from '@/api/types';

export const LOCAL_STORAGE_KEYS = [
  'home-section-order',
  'home-widgets-v1',
  'home-habits-v1',
] as const;

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Read the three legacy localStorage keys into a HomeEnvelope shape. */
export function readLocalStorageHome(): HomeEnvelope {
  return {
    version: 1,
    sections: parse<string[]>('home-section-order', []),
    widgets: parse<HomeWidget[]>('home-widgets-v1', []),
    habits: parse<HomeHabit[]>('home-habits-v1', []),
  };
}

/** Remove all legacy keys — call after a successful migration POST. */
export function clearLocalStorageHome(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

export interface MigrationDecision {
  shouldMigrate: boolean;
  next: HomeEnvelope;
}

/**
 * Given the current backend envelope and the localStorage-extracted envelope,
 * decide whether a one-shot migration is needed.
 *
 * Rules:
 *   - If backend has ANY content (sections | widgets | habits non-empty), no migration.
 *   - If both sides are empty, no migration.
 *   - Otherwise push the local envelope up.
 */
export function decideMigration(
  backend: HomeEnvelope,
  local: HomeEnvelope,
): MigrationDecision {
  const backendEmpty =
    backend.sections.length === 0 &&
    backend.widgets.length === 0 &&
    backend.habits.length === 0;
  const localHasAny =
    local.sections.length > 0 ||
    local.widgets.length > 0 ||
    local.habits.length > 0;

  if (!backendEmpty || !localHasAny) {
    return { shouldMigrate: false, next: backend };
  }
  return { shouldMigrate: true, next: local };
}
```

- [ ] **Step 4: Re-run tests — they pass.**

Run: `npm test -- homeMigration.vitest.ts`
Expected: PASS — 5/5 tests.

- [ ] **Step 5: Write the React hook that wires it together.**

Create `src/hooks/useHomeMigration.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useHome, useSaveHome } from './useHome';
import { readLocalStorageHome, decideMigration, clearLocalStorageHome } from '@/lib/homeMigration';

const MIGRATED_FLAG_KEY = 'home-migrated-to-backend-v1';

/**
 * One-shot migration: on first successful load after this deploy, if the
 * backend is empty and localStorage still has the legacy keys, push the
 * local data up and clear the keys. Idempotent — guarded by a localStorage
 * flag and an in-component ref against StrictMode double-invocation.
 */
export function useHomeMigration() {
  const home = useHome();
  const save = useSaveHome();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!home.data) return;
    if (localStorage.getItem(MIGRATED_FLAG_KEY) === 'true') {
      ranRef.current = true;
      return;
    }

    const local = readLocalStorageHome();
    const decision = decideMigration(home.data, local);

    ranRef.current = true;

    if (!decision.shouldMigrate) {
      localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      return;
    }

    save.mutate(decision.next, {
      onSuccess: () => {
        clearLocalStorageHome();
        localStorage.setItem(MIGRATED_FLAG_KEY, 'true');
      },
    });
  }, [home.data, save]);
}
```

- [ ] **Step 6: Verify typecheck and tests.**

Run: `npm run typecheck && npm test`
Expected: typecheck PASS, 41 existing + 5 new = 46 tests pass.

- [ ] **Step 7: Commit.**

```bash
git add src/lib/homeMigration.ts src/lib/homeMigration.vitest.ts src/hooks/useHomeMigration.ts
git commit -m "feat(home): one-shot localStorage→backend migration with tests"
```

---

## Task 5: Rewrite `useWidgets` on top of `useHome`

**Files:**
- Modify: `src/hooks/useWidgets.ts`

- [ ] **Step 1: Replace the file.**

```ts
// src/hooks/useWidgets.ts
import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useSaveHome } from './useHome';
import type { HomeEnvelope, HomeWidget } from '@/api/types';

// Keep the existing public types so consumers don't change.
export type WidgetType = HomeWidget['type'];
export type Widget = HomeWidget;

export function useWidgets() {
  const { data } = useHome();
  const save = useSaveHome();

  const widgets: Widget[] = data?.widgets ?? [];

  const commit = useCallback(
    (nextWidgets: Widget[]) => {
      const base: HomeEnvelope = data ?? { version: 1, sections: [], widgets: [], habits: [] };
      save.mutate({ ...base, widgets: nextWidgets });
    },
    [data, save],
  );

  const addWidget = useCallback(
    (type: WidgetType, refId: string): Widget => {
      const widget: Widget = { id: randomId(), type, refId };
      // Dedupe by (type, refId): see original comment about StrictMode.
      if (widgets.some((w) => w.type === type && w.refId === refId)) return widget;
      commit([...widgets, widget]);
      return widget;
    },
    [widgets, commit],
  );

  const removeWidget = useCallback(
    (id: string) => commit(widgets.filter((w) => w.id !== id)),
    [widgets, commit],
  );

  const removeWidgetByRefId = useCallback(
    (refId: string) => commit(widgets.filter((w) => w.refId !== refId)),
    [widgets, commit],
  );

  const reorderWidgets = useCallback(
    (nextOrder: Widget[]) => commit(nextOrder),
    [commit],
  );

  return { widgets, addWidget, removeWidget, removeWidgetByRefId, reorderWidgets };
}
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add src/hooks/useWidgets.ts
git commit -m "feat(home): rewrite useWidgets on top of useHome envelope"
```

---

## Task 6: Rewrite `useHabits` on top of `useHome`

**Files:**
- Modify: `src/hooks/useHabits.ts`

- [ ] **Step 1: Read the existing `useHabits.ts` fully first.**

You need to preserve every exported function signature (`useHabits()`, its returned `addHabit`, `updateHabit`, `removeHabit`, `toggleDay`, etc.) and the `calcStreak` helper if it's exported.

- [ ] **Step 2: Rewrite the file.**

Keep helper functions that don't touch state at the top. Replace the state source from `useLocalStorage` to `useHome` + `useSaveHome`. The returned methods should construct the next habits array and commit the whole envelope.

Skeleton:

```ts
import { useCallback } from 'react';
import { randomId } from '@/lib/randomId';
import { useHome, useSaveHome } from './useHome';
import type { HomeEnvelope, HomeHabit } from '@/api/types';

export type Habit = HomeHabit;

// (Keep calcStreak and any other pure helpers that were in the old file.)
export function calcStreak(completedDays: string[]): number { /* ...existing logic... */ }

export function useHabits() {
  const { data } = useHome();
  const save = useSaveHome();

  const habits: Habit[] = data?.habits ?? [];

  const commit = useCallback(
    (nextHabits: Habit[]) => {
      const base: HomeEnvelope = data ?? { version: 1, sections: [], widgets: [], habits: [] };
      save.mutate({ ...base, habits: nextHabits });
    },
    [data, save],
  );

  const addHabit = useCallback(
    (name: string, color: string): Habit => {
      const habit: Habit = {
        id: randomId(),
        name,
        color,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      commit([...habits, habit]);
      return habit;
    },
    [habits, commit],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'name' | 'color'>>) =>
      commit(habits.map((h) => (h.id === id ? { ...h, ...patch } : h))),
    [habits, commit],
  );

  const removeHabit = useCallback(
    (id: string) => commit(habits.filter((h) => h.id !== id)),
    [habits, commit],
  );

  const toggleDay = useCallback(
    (habitId: string, date: string) =>
      commit(habits.map((h) => {
        if (h.id !== habitId) return h;
        const has = h.completedDays.includes(date);
        return {
          ...h,
          completedDays: has ? h.completedDays.filter((d) => d !== date) : [...h.completedDays, date].sort(),
        };
      })),
    [habits, commit],
  );

  return { habits, addHabit, updateHabit, removeHabit, toggleDay };
}
```

> The implementer MUST keep the exact method shapes the rest of the app calls. If the old file has additional helpers (`addDays`, etc.) copy them over verbatim.

- [ ] **Step 3: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Run existing habits tests (if any).**

Run: `npm test -- useHabits` if there's a `useHabits.vitest.ts` or equivalent.
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/hooks/useHabits.ts
git commit -m "feat(home): rewrite useHabits on top of useHome envelope"
```

---

## Task 7: Rewrite HomePage section order + mount migration

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Read the existing HomePage.tsx.**

Identify where `useLocalStorage('home-section-order', ...)` is called and where the reorder handler writes to it. There's also a default fallback array.

- [ ] **Step 2: Replace section-order storage.**

Replace:
```ts
const [storedOrder, setStoredOrder] = useLocalStorage<SectionId[]>('home-section-order', DEFAULT_SECTIONS);
```

with:
```ts
const { data: home } = useHome();
const saveHome = useSaveHome();
const storedOrder: SectionId[] = (home?.sections.length ? home.sections : DEFAULT_SECTIONS) as SectionId[];
function setStoredOrder(next: SectionId[]) {
  const base = home ?? { version: 1, sections: [], widgets: [], habits: [] };
  saveHome.mutate({ ...base, sections: next });
}
```

- [ ] **Step 3: Mount `useHomeMigration` at the top of the component.**

```ts
import { useHomeMigration } from '@/hooks/useHomeMigration';
// ...
export function HomePage() {
  useHomeMigration();
  // ...
}
```

- [ ] **Step 4: Verify typecheck.**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual smoke in dev mode.**

Run `npm run dev`. Open browser devtools Network tab. Visit the home page.
- Verify `GET /api/home` is called.
- If localStorage has legacy keys, verify `POST /api/home` is called immediately after, and that `localStorage.getItem('home-migrated-to-backend-v1') === 'true'` after.
- Reorder a section → another `POST /api/home` fires.

- [ ] **Step 6: Commit.**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat(home): HomePage reads/writes section order via envelope + mounts migration"
```

---

## Task 8: Self-review + build verification

**Files:** none modified.

- [ ] **Step 1: Grep for any stale localStorage references.**

Run:
```bash
grep -rn "home-section-order\|home-widgets-v1\|home-habits-v1" src/
```
Only matches should be inside `src/lib/homeMigration.ts` (the migration reads them) and `src/lib/homeMigration.vitest.ts`. Anything else means a consumer still hits localStorage directly — fix it.

- [ ] **Step 2: Run the full suite.**

```bash
npm test
npm run typecheck
npm run build
```
All should pass. Build should not complain about unused imports from old `useLocalStorage` uses.

- [ ] **Step 3: Commit any cleanups.**

If the grep surfaced issues that needed fixing, commit those. Otherwise no commit.

---

## Task 9: Deploy api.py changes

**Files:**
- Deploy: `../Dashboard/api.py`

- [ ] **Step 1: Verify the edited api.py in `/c/Users/Admin/Documents/Claude/Github/Dashboard/api.py` has both new routes (from Task 1).**

- [ ] **Step 2: Run the api deploy script.**

```bash
cd /c/Users/Admin/Documents/Claude/Github/dashboard-react
python _deploy_api.py
```
Expected: script uploads `api.py` to `/opt/dashboard/www/api.py` and restarts the systemd service (or whatever the script does — read it first if unsure).

- [ ] **Step 3: Smoke-test the live endpoint.**

```bash
curl -u "$USER:$PASS" http://37.27.210.14/api/home
```
Expected: returns `{"version": 1, "sections": [], "widgets": [], "habits": []}` (or existing envelope if you've already migrated).

---

## Task 10: Final integration

**Files:** none modified.

- [ ] **Step 1: Squash-merge the feature branch to main.**

```bash
cd /c/Users/Admin/Documents/Claude/Github/dashboard-react
git merge --squash feat/home-sync
git commit -m "feat(home): sync home-page layout to backend (/api/home)"
git push origin main
```

- [ ] **Step 2: Build + deploy the frontend.**

```bash
npm run build
python _deploy.py
```

- [ ] **Step 3: Manual smoke on live site.**

- Visit http://37.27.210.14/index.html. Hard-reload (Ctrl+Shift+R).
- Home page loads without errors.
- Add a habit → reload → habit persists.
- Reorder a widget → reload → order persists.
- Open in a second browser → same layout appears.
- Clear localStorage on one browser → reload → data still appears (backend is authoritative).

- [ ] **Step 4: Report back.**

---

## Self-Review

### Spec coverage

- [x] New endpoint `/api/home` GET+POST — Task 1
- [x] Envelope types — Task 2
- [x] React Query hooks — Task 3
- [x] Migration (pure logic + hook) — Task 4 (with TDD)
- [x] `useWidgets` refactor — Task 5
- [x] `useHabits` refactor — Task 6
- [x] HomePage section order + migration mount — Task 7
- [x] Build/test verification — Task 8
- [x] api.py deploy — Task 9
- [x] Frontend deploy — Task 10

### Placeholder scan

- No "TBD" / "implement later".
- All code in TDD steps is complete.
- The "keep exact method shapes" note in Task 6 is intentional — the implementer needs to preserve the habits hook's existing surface which I can't fully transcribe without reading the current file.

### Type consistency

- `HomeEnvelope` / `HomeWidget` / `HomeHabit` are named consistently across all tasks.
- `Widget` / `Habit` re-exports in hooks keep old consumer types working.
- `queryKeys.home` is used only in `useHome.ts`.
