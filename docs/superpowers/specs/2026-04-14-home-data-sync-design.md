# Home Data Sync Design

**Status:** Design
**Date:** 2026-04-14

## Goal

Move the home-page layout data (section order, widget list, habits) from per-browser `localStorage` to a single backend-stored JSON envelope served by `api.py`. Matches how `/api/links` already works for links + categories. Timer state stays in `localStorage` (per-device by design).

## Non-goals

- Multi-user support — dashboard is single-user, last-write-wins is fine.
- Real-time sync — no push, no websockets. Clients PUT on change, GET on load, stale-revalidate via React Query.
- Syncing timer runtime state (running/paused, `fireAt`, `remainingMs`, elapsed) across devices. Timer state remains entirely client-side.
- Offline-with-conflict-resolution. If the backend is unreachable on load, the UI shows an error state; writes fail with a toast.

## User experience

No visual change. The home page looks and behaves identically. Existing drag-to-reorder interactions on sections and widgets work the same way — the only difference is that the new order now survives across browsers and devices.

First load after the deploy migrates any existing `localStorage` data up to the backend (see Migration below).

## Data model

### Envelope

Single envelope at `/opt/dashboard/www/home.json`:

```ts
interface HomeEnvelope {
  version: 1;
  /** Section order on the home page — which sections render in which order. */
  sections: SectionId[];
  /** Widget tiles on the widgets row, in render order. */
  widgets: Widget[];
  /** User-defined habits (including completion history). */
  habits: Habit[];
}

type SectionId = 'widgets' | 'news' | 'habits' | /* future section ids */ string;

interface Widget {
  id: string;
  type: 'habit' | 'countdown' | 'pomodoro' | 'stopwatch' | 'alarm';
  /** For habit widgets: the habit's id. For timer widgets: the kind ('alarm', 'countdown', ...). */
  refId: string;
}

interface Habit {
  id: string;
  name: string;
  color: string;
  /** ISO "YYYY-MM-DD" strings for each day the habit was completed. */
  completedDays: string[];
  /** ISO timestamp. */
  createdAt: string;
}
```

All three existing types (`Widget`, `Habit`, `SectionId`) already exist in the codebase — the envelope just collects them.

### Schema versioning

`version: 1` enables future migrations. Writes always emit the current version; reads must be defensive against missing keys and fall back to sensible defaults (empty `sections`, empty `widgets`, empty `habits`).

### What's NOT in this envelope

- Timer state (alarm `fireAt`, `ringing`, countdown `remainingMs`, pomodoro `cycle`, stopwatch `elapsedMs`) — stays in `localStorage` under `home-timers-v4`.
- Links + categories — already in `/api/links`, not duplicated.
- News source preference (`news-source`) — stays in `localStorage` for now. Not asked for.

## Backend

`api.py` already handles `/api/links`, `/api/todos`, `/api/notes` in its single-file `do_GET` / `do_POST` switch. Add two routes:

- `GET /api/home` — returns the envelope. If `home.json` doesn't exist yet, returns `{ version: 1, sections: [], widgets: [], habits: [] }`.
- `PUT /api/home` — atomically replaces `home.json` with the request body. Validates `version === 1`. Uses the same write-to-temp-then-rename atomicity pattern already in use for `links.json` / `todos.json` (if present — otherwise add it).

Both go behind the existing basic-auth layer at the nginx level; no extra auth work in api.py.

## Client

### New hooks

Mirror the existing `useLinks` / `useSaveLinks` pattern:

```ts
// src/hooks/useHome.ts
export function useHome(): UseQueryResult<HomeEnvelope> { ... }
export function useSaveHome(): UseMutationResult<HomeEnvelope, Error, HomeEnvelope> { ... }
```

`useSaveHome` uses optimistic updates: on `mutate`, immediately replace the cached envelope; on error, roll back; on settled, invalidate. Copy-paste from `useSaveLinks`.

### API client

```ts
// src/api/home.ts
import { api } from './client';
import type { HomeEnvelope } from './types';

export const homeApi = {
  list: (): Promise<HomeEnvelope> => api.get<HomeEnvelope>('/api/home'),
  saveAll: (envelope: HomeEnvelope): Promise<void> => api.put('/api/home', envelope),
};
```

`api.put` already exists in `src/api/client.ts:116` — no client-side plumbing needed.

### Existing hooks — refactor

`useWidgets`, `useHabits`, and the `home-section-order` localStorage call on `HomePage.tsx` change from `useLocalStorage` consumers to `useHome` consumers.

Each hook:
1. Reads its slice from the envelope (`env.widgets`, `env.habits`, `env.sections`).
2. Writes by constructing the next envelope and calling `useSaveHome().mutate(next)`.

The public API of each hook stays the same (same function signatures, same return shape) so the rest of the UI doesn't change.

### Migration

On first load per device after the deploy, if backend has empty data AND localStorage still has the old keys, push localStorage up and clear the keys:

```ts
// Runs once, in a top-level effect after the initial useHome load resolves.
function useHomeMigration() {
  const { data: home } = useHome();
  const saveHome = useSaveHome();
  const [done, setDone] = useLocalStorage('home-migrated-to-backend-v1', false);

  useEffect(() => {
    if (done || !home) return;
    const backendEmpty = home.sections.length === 0 && home.widgets.length === 0 && home.habits.length === 0;
    if (!backendEmpty) { setDone(true); return; }

    const sections = JSON.parse(localStorage.getItem('home-section-order') ?? '[]');
    const widgets = JSON.parse(localStorage.getItem('home-widgets-v1') ?? '[]');
    const habits = JSON.parse(localStorage.getItem('home-habits-v1') ?? '[]');
    const hasAny = sections.length || widgets.length || habits.length;
    if (!hasAny) { setDone(true); return; }

    saveHome.mutate({ version: 1, sections, widgets, habits }, {
      onSuccess: () => {
        localStorage.removeItem('home-section-order');
        localStorage.removeItem('home-widgets-v1');
        localStorage.removeItem('home-habits-v1');
        setDone(true);
      },
    });
  }, [home, done, saveHome, setDone]);
}
```

Idempotent: the `home-migrated-to-backend-v1` flag prevents re-running. Safe to leave in the codebase forever; it's a one-shot guard.

### Error handling

- On `useHome` failure: show an inline "Failed to load home layout" banner with a retry button in place of the widgets + habits section. Sections the user can't interact with are better than a silently broken page.
- On `useSaveHome` failure: optimistic update rolls back; a toast appears ("Failed to save — try again"). User sees their most recent state reappear.

## Concurrency model

Last-write-wins. Two devices that both PUT at the same time: whichever arrives at the server second wins; the first's changes are overwritten. Acceptable for a single-user dashboard. If we ever need better, add a `revision` number and 409 on mismatch.

## Testing

- **api.py**: a small Python test that POSTs an envelope, GETs it back, confirms round-trip. Existing pattern (if any) or a new one-file smoke test.
- **Client**: no unit tests for the hooks (matches the existing `useLinks`/`useSaveLinks` which aren't unit-tested). Manual smoke on the deploy:
  1. Fresh browser → load home page → see envelope from backend.
  2. Reorder a widget → refresh → order persists.
  3. Add a habit → refresh → habit persists.
  4. Open the page on a second browser/device → same layout appears.
  5. Clear localStorage on one device (simulate fresh install) → backend data is authoritative; nothing is lost.

## Files

**Modified:**
- `api.py` — add `GET /api/home` + `PUT /api/home` routes.
- `src/hooks/useWidgets.ts` — rewrite on top of `useHome` / `useSaveHome`.
- `src/hooks/useHabits.ts` — rewrite on top of `useHome` / `useSaveHome`.
- `src/pages/HomePage.tsx` — replace `useLocalStorage('home-section-order', …)` with `useHome` / `useSaveHome`.
- `src/App.tsx` (or wherever the top-level provider tree lives) — mount the migration effect once.

**New:**
- `src/api/home.ts` — thin fetch wrapper.
- `src/hooks/useHome.ts` — React Query hooks.
- `src/hooks/useHomeMigration.ts` — one-shot localStorage → backend migration.
- `/opt/dashboard/www/home.json` — created on first PUT; api.py handles the absent-file case on GET.

## Risks

- **First-deploy race**: if two devices load the app simultaneously right after the deploy, both see "backend empty" and both try to migrate. Last-write-wins resolves this — whichever PUT lands second overwrites, and the local `home-migrated-to-backend-v1` flag on each device makes migration one-shot regardless. Worst case: one device's in-flight migration is overwritten by the other's. Acceptable given it's a one-shot event.
- **Migrating a device with stale localStorage**: if a user had this dashboard on two browsers pre-deploy and one had newer data, the "first load after deploy" on the newer browser wins only if it loads before the older one. Pragmatic fix: user can manually re-do anything that got lost. Not worth adding merge logic for a one-time event.
- **Backend unreachable on first load**: if `useHome` fails, migration doesn't run. On a subsequent successful load, migration runs as expected. The `home-migrated-to-backend-v1` flag gates on success, not failure.

## Deferred

- Per-user scoping (multi-user support).
- Syncing timer settings (alarm `lastSetTime`, pomodoro `settings`) — currently per-device.
- Syncing news source preference.
- Conflict resolution beyond last-write-wins.
