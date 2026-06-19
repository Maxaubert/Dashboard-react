# Single-page Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the app to a single page: remove the sidebar/widgets/Sport/Notes, and surface Plan/Todo/Gaming/Links as preview sections whose "Vis alle" opens the full page in a pop-out overlay.

**Architecture:** A `PageOverlay` context holds which page (if any) is open; `<PageOverlay>` renders that full page component in a near-fullscreen Radix dialog. Home preview sections call `openOverlay(key)` instead of navigating. Removed areas + the sidebar + per-area routes are deleted; only `/`, `/login`, `/signup` remain.

**Tech Stack:** React + react-router (kept for `/login`/`/signup` + page internals), @radix-ui/react-dialog, react-query, dnd-kit (home section reorder), vitest.

## Global Constraints

- No em-dashes anywhere (code, comments, commits). No emojis in code/commits.
- UI strings Norwegian (nb-NO).
- Commit trailer exactly: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Branch: `feat/single-page-dashboard`. Issue: #23.
- vitest collects `*.vitest.ts`. `@/*` resolves to `src/*`.
- Each task must leave `npm run typecheck` + `npm test` + `npm run build` green (the app stays runnable after every task).
- Overlays are state-driven (NO URL change). Routes for removed/overlaid areas are deleted in Task 7, AFTER the overlay works.

---

## Task 1: PageOverlay context + component, wired into App

**Files:**
- Create: `src/context/PageOverlayContext.tsx`
- Create: `src/components/overlay/PageOverlay.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/globals.css` (overlay styles)

**Interfaces:**
- Produces: `PageOverlayProvider`, `usePageOverlay(): { key: OverlayKey | null; openOverlay(k: OverlayKey): void; closeOverlay(): void }` where `OverlayKey = 'plan' | 'todo' | 'gaming' | 'links'`. `<PageOverlay />` renders the page for the current key.

- [ ] **Step 1: Create the context**

`src/context/PageOverlayContext.tsx`:
```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type OverlayKey = 'plan' | 'todo' | 'gaming' | 'links';

interface PageOverlayValue {
  key: OverlayKey | null;
  openOverlay: (key: OverlayKey) => void;
  closeOverlay: () => void;
}

const PageOverlayContext = createContext<PageOverlayValue | null>(null);

export function PageOverlayProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState<OverlayKey | null>(null);
  const value = useMemo<PageOverlayValue>(
    () => ({ key, openOverlay: setKey, closeOverlay: () => setKey(null) }),
    [key],
  );
  return <PageOverlayContext.Provider value={value}>{children}</PageOverlayContext.Provider>;
}

export function usePageOverlay(): PageOverlayValue {
  const ctx = useContext(PageOverlayContext);
  if (!ctx) throw new Error('usePageOverlay must be used within PageOverlayProvider');
  return ctx;
}
```

- [ ] **Step 2: Create the overlay component**

`src/components/overlay/PageOverlay.tsx`:
```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { usePageOverlay, type OverlayKey } from '@/context/PageOverlayContext';
import { PlanPage } from '@/pages/PlanPage';
import { TodoPage } from '@/pages/TodoPage';
import { GamingPage } from '@/pages/GamingPage';
import { LinksPage } from '@/pages/LinksPage';

const PAGES: Record<OverlayKey, () => JSX.Element> = {
  plan: PlanPage,
  todo: TodoPage,
  gaming: GamingPage,
  links: LinksPage,
};

export function PageOverlay() {
  const { key, closeOverlay } = usePageOverlay();
  if (!key) return null;
  const Page = PAGES[key];
  return (
    <Dialog.Root open onOpenChange={(o) => !o && closeOverlay()}>
      <Dialog.Portal>
        <Dialog.Overlay className="page-overlay-backdrop" />
        <Dialog.Content className="page-overlay-panel" aria-label="Side">
          <Dialog.Close asChild>
            <button className="page-overlay-close" aria-label="Lukk">✕</button>
          </Dialog.Close>
          <div className="page-overlay-scroll">
            <Page />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
(If `JSX.Element` triggers a lint/type issue, type `PAGES` as `Record<OverlayKey, React.ComponentType>` and `import type { ComponentType } from 'react'`.)

- [ ] **Step 3: Add overlay styles**

Append to `src/styles/globals.css`:
```css
/* Full-page pop-out overlay */
.page-overlay-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px); z-index: 80;
}
.page-overlay-panel {
  position: fixed; z-index: 81; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: min(96vw, 1280px); height: 92vh;
  background: var(--color-bg, #0a0a0a);
  border: 1px solid var(--color-border, #2a2a2a);
  border-radius: 16px; overflow: hidden;
}
.page-overlay-scroll { width: 100%; height: 100%; overflow-y: auto; }
.page-overlay-close {
  position: absolute; top: 12px; right: 12px; z-index: 1;
  width: 34px; height: 34px; border-radius: 8px;
  background: rgba(0,0,0,0.4); color: #fff; border: 1px solid var(--color-border, #2a2a2a);
  cursor: pointer; font-size: 1rem;
}
```

- [ ] **Step 4: Wire into `src/App.tsx`**

Wrap the guarded route element with `PageOverlayProvider` and render `<PageOverlay />` inside it (so it sits within `BrowserRouter` + `RequireAuth`). Add imports:
```tsx
import { PageOverlayProvider } from '@/context/PageOverlayContext';
import { PageOverlay } from '@/components/overlay/PageOverlay';
```
Change the guarded route element to:
```tsx
              <Route
                element={
                  <RequireAuth>
                    <PageOverlayProvider>
                      <AppShell>
                        <Outlet />
                      </AppShell>
                      <PageOverlay />
                    </PageOverlayProvider>
                  </RequireAuth>
                }
              >
```
Leave all existing routes intact for now (they are removed in Task 7).

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. (Overlay exists but nothing triggers it yet, so no behavior change; no unit test for this wiring.)

- [ ] **Step 6: Commit**

```bash
git add src/context/PageOverlayContext.tsx src/components/overlay/PageOverlay.tsx src/App.tsx src/styles/globals.css
git commit -m "$(printf 'feat: page-overlay context + component\n\nState-driven pop-out that renders a full page (plan/todo/gaming/links)\nin a near-fullscreen dialog. Wired into App; not triggered yet.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: Todo preview section + section-list cleanup

**Files:**
- Create: `src/lib/todoPreview.ts`
- Test: `src/lib/todoPreview.vitest.ts`
- Create: `src/components/home/SectionTodo.tsx`
- Modify: `src/lib/home.ts` (SECTION_IDS)
- Modify: `src/components/home/SortableHomeSection.tsx`
- Modify: `src/styles/globals.css` (todo preview styles)

**Interfaces:**
- Consumes: `usePageOverlay` (Task 1); `useTodos` (`@/hooks/useTodos`).
- Produces: `topOpenTodos(todos: Todo[], n?: number): Todo[]`; `TodoSection({ handleProps })`.

- [ ] **Step 1: Write the failing test**

`src/lib/todoPreview.vitest.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { topOpenTodos } from './todoPreview';
import type { Todo } from '@/api/types';

const t = (p: Partial<Todo> & { id: string }): Todo => ({
  id: p.id, text: p.text ?? p.id, priority: p.priority ?? 'medium',
  done: p.done ?? false, deadline: p.deadline ?? null,
});

describe('topOpenTodos', () => {
  it('drops done todos and orders by priority (high->low)', () => {
    const out = topOpenTodos([
      t({ id: 'a', priority: 'low' }),
      t({ id: 'b', priority: 'high' }),
      t({ id: 'c', priority: 'medium', done: true }),
      t({ id: 'd', priority: 'medium' }),
    ]);
    expect(out.map((x) => x.id)).toEqual(['b', 'd', 'a']);
  });
  it('caps the list at n', () => {
    const many = Array.from({ length: 8 }, (_, i) => t({ id: String(i) }));
    expect(topOpenTodos(many, 5)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/todoPreview.vitest.ts`
Expected: FAIL — cannot find `./todoPreview`.

- [ ] **Step 3: Implement `src/lib/todoPreview.ts`**

```ts
import type { Todo } from '@/api/types';

const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Top open (not done) todos, highest priority first, capped at n. */
export function topOpenTodos(todos: Todo[], n = 5): Todo[] {
  return todos
    .filter((todo) => !todo.done)
    .sort((a, b) => (RANK[a.priority] ?? 9) - (RANK[b.priority] ?? 9))
    .slice(0, n);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/todoPreview.vitest.ts`
Expected: PASS (2 cases).

- [ ] **Step 5: Create `src/components/home/SectionTodo.tsx`**

```tsx
import { useTodos } from '@/hooks/useTodos';
import { usePageOverlay } from '@/context/PageOverlayContext';
import { topOpenTodos } from '@/lib/todoPreview';
import { GripHandle, type HandleProps } from '@/components/home/GripHandle';

export function TodoSection({ handleProps }: { handleProps?: HandleProps }) {
  const { data: todos } = useTodos();
  const { openOverlay } = usePageOverlay();
  const top = topOpenTodos(todos ?? []);

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Todo
        </span>
        <button type="button" className="section-header-link" onClick={() => openOverlay('todo')}>
          Vis alle
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6z" />
          </svg>
        </button>
      </div>
      {top.length === 0 ? (
        <div className="todo-preview-empty">Ingen åpne oppgaver</div>
      ) : (
        <ul className="todo-preview-list">
          {top.map((todo) => (
            <li key={todo.id} className="todo-preview-item" onClick={() => openOverlay('todo')}>
              <span className={`todo-preview-dot prio-${todo.priority}`} />
              <span className="todo-preview-text">{todo.text}</span>
              {todo.deadline && <span className="todo-preview-deadline">{todo.deadline}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Add todo preview styles**

Append to `src/styles/globals.css`:
```css
/* Home todo preview */
.todo-preview-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.todo-preview-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.02); }
.todo-preview-item:hover { background: rgba(255,255,255,0.05); }
.todo-preview-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; background: #71717a; }
.todo-preview-dot.prio-high { background: #f87171; }
.todo-preview-dot.prio-medium { background: #fbbf24; }
.todo-preview-dot.prio-low { background: #60a5fa; }
.todo-preview-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-preview-deadline { color: var(--color-text-muted, #71717a); font-size: 0.78rem; flex: 0 0 auto; }
.todo-preview-empty { color: var(--color-text-muted, #71717a); font-size: 0.85rem; padding: 8px 0; }
```

- [ ] **Step 7: Update `SECTION_IDS` and `SortableHomeSection`**

In `src/lib/home.ts`, set `SECTION_IDS` to (remove `'widgets'` and `'kategorier'`, add `'todo'`):
```ts
export const SECTION_IDS = [
  'prompt-launcher',
  'todo',
  'dagens-plan',
  'wishlist',
  'ext-lenker',
  'vaer',
  'nyhetssaker',
] as const;
```
In `src/components/home/SortableHomeSection.tsx`: remove the imports + render branches for `KategorierSection` and `WidgetsSection`; add `import { TodoSection } from '@/components/home/SectionTodo';` and the render line `{id === 'todo' && <TodoSection handleProps={handleProps} />}`. (The `SectionKategorier`/`WidgetsSection` files stay on disk for now; they are deleted in Tasks 6-7. After this edit nothing imports them via SortableHomeSection.)

- [ ] **Step 8: Verify**

Run: `npx vitest run src/lib/todoPreview.vitest.ts && npm run typecheck && npm test && npm run build`
Expected: all PASS. The home page now shows a Todo preview; widgets/kategorier sections are gone from the home list.

- [ ] **Step 9: Commit**

```bash
git add src/lib/todoPreview.ts src/lib/todoPreview.vitest.ts src/components/home/SectionTodo.tsx src/lib/home.ts src/components/home/SortableHomeSection.tsx src/styles/globals.css
git commit -m "$(printf 'feat: home Todo preview section; drop widgets/kategorier from the list\n\nAdds a top-open-todos preview that opens the Todo pop-out, and removes\nthe widgets + kategorier sections from the home section list.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: Repoint area sections to the overlay

**Files:**
- Modify: `src/components/home/SectionWishlist.tsx`
- Modify: `src/components/home/SectionEksterneLenker.tsx`
- Modify: `src/components/home/SectionDagensPlan.tsx`

**Interfaces:** consumes `usePageOverlay` (Task 1).

- [ ] **Step 1: Wishlist "Alle" -> Gaming overlay**

In `src/components/home/SectionWishlist.tsx`: import `usePageOverlay`, call `const { openOverlay } = usePageOverlay();` inside `WishlistSection`, and replace the header `<Link to="/gaming" className="section-header-link"> ... </Link>` with a `<button type="button" className="section-header-link" onClick={() => openOverlay('gaming')}>` keeping the same inner "Alle" + svg. Remove the now-unused `Link`/react-router import if nothing else in the file uses it.

- [ ] **Step 2: Links "Alle" -> Links overlay**

In `src/components/home/SectionEksterneLenker.tsx`: same change for the `<Link to="/links" className="section-header-link">` header link -> `<button ... onClick={() => openOverlay('links')}>`. Keep the per-card external `<a href={link.url}>` anchors as they are (those open the external site, not the overlay). Remove the `Link` import only if unused after the change.

- [ ] **Step 3: Plan section -> Plan overlay**

In `src/components/home/SectionDagensPlan.tsx`: import `usePageOverlay`; add a header "Vis alle" button (matching the others) that calls `openOverlay('plan')`; and change the today-item `<Link to="/plan" className="today-item-inner">` into a clickable element (`<button>` or a div with onClick) calling `openOverlay('plan')`, preserving the existing inner markup + `today-item-inner` class. Remove the `Link` import if unused.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS. Clicking "Alle"/"Vis alle"/plan items now opens the respective overlay instead of navigating (manual-verify in Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/SectionWishlist.tsx src/components/home/SectionEksterneLenker.tsx src/components/home/SectionDagensPlan.tsx
git commit -m "$(printf 'feat: open Gaming/Links/Plan pop-outs from the home sections\n\nRepoints the section Alle/Vis alle links from route navigation to the\nstate-driven page overlay.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: Move logout + display name into a home header

**Files:**
- Create: `src/components/home/HomeAccount.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/styles/globals.css` (account header styles)

**Interfaces:** consumes `useCurrentUser`, `useLogout` (`@/hooks/useCurrentUser`).

- [ ] **Step 1: Create `src/components/home/HomeAccount.tsx`**

Move the account row markup currently in `src/components/layout/Sidebar.tsx` (the display-name + logout button block, lines ~120-160, using `useCurrentUser()` + `useLogout()`) into a standalone component. Example:
```tsx
import { useCurrentUser, useLogout } from '@/hooks/useCurrentUser';

export function HomeAccount() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  if (!user) return null;
  return (
    <div className="home-account">
      <span className="home-account-name">{user.display_name || user.email}</span>
      <button
        type="button"
        className="home-account-logout"
        disabled={logout.isPending}
        title="Logg ut"
        aria-label="Logg ut"
        onClick={() => logout.mutate()}
      >
        Logg ut
      </button>
    </div>
  );
}
```
(Match the exact logout `mutate` call shape used in `Sidebar.tsx` if it passes options.)

- [ ] **Step 2: Render it in `HomePage.tsx`**

Import `HomeAccount` and render it at the top of the page, in a flex row with the `PageHeader` (account pinned top-right). Minimal: wrap the existing `<PageHeader .../>` and `<HomeAccount />` in a `<div className="home-topbar">`.

- [ ] **Step 3: Styles**

Append to `src/styles/globals.css`:
```css
.home-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.home-account { display: flex; align-items: center; gap: 10px; }
.home-account-name { color: var(--color-text-muted, #a1a1aa); font-size: 0.85rem; }
.home-account-logout { background: transparent; border: 1px solid var(--color-border, #2a2a2a); color: var(--color-text, #e4e4e7); border-radius: 8px; padding: 5px 10px; font-size: 0.82rem; cursor: pointer; }
.home-account-logout:hover { background: rgba(255,255,255,0.05); }
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS. The home page shows the name + logout (the sidebar still has its copy until Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/components/home/HomeAccount.tsx src/pages/HomePage.tsx src/styles/globals.css
git commit -m "$(printf 'feat: account + logout in the home header\n\nMoves the display-name + logout out of the sidebar (removed next) into\na small header on the home page.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: Remove the sidebar, mobile drawer, and AppShell sidebar logic

**Files:**
- Delete: `src/components/layout/Sidebar.tsx`, `src/components/layout/MobileDrawer.tsx`, `src/components/layout/navConfig.tsx`
- Modify: `src/components/layout/AppShell.tsx`, `src/components/layout/navIcons.tsx`

**Interfaces:** none produced.

- [ ] **Step 1: Find references**

Run: `grep -rn "Sidebar\|MobileDrawer\|navConfig\|NAV_ITEMS" src`
Confirm the only importers are `AppShell.tsx` (Sidebar, MobileDrawer) and `Sidebar.tsx`/`MobileDrawer.tsx` (navConfig).

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/layout/Sidebar.tsx src/components/layout/MobileDrawer.tsx src/components/layout/navConfig.tsx
```

- [ ] **Step 3: Simplify `AppShell.tsx`**

Replace AppShell with a thin centered container (no sidebar, no resize, no route-based fullHeight, no mobile drawer):
```tsx
import { type ReactNode } from 'react';

/** Top-level layout: just centers the page content. The dashboard is a
 *  single page now; per-area pages render inside the PageOverlay. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <div className="main-content">{children}</div>
    </div>
  );
}
```
(If the `.app-shell`/`.main-content` CSS assumed a sidebar grid column, adjust those rules so the main content centers full-width; grep `app-shell`/`main-content` in `globals.css` and remove the sidebar-column sizing. Keep `<div className="page">` behavior from HomePage.)

- [ ] **Step 4: Prune `navIcons.tsx`**

After navConfig is gone, remove any icon exports in `src/components/layout/navIcons.tsx` that are now unused (grep each icon name; delete the unused ones). If the whole file becomes unused, `git rm` it.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS, no dangling imports.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: remove the sidebar and mobile drawer\n\nThe dashboard is a single page; AppShell is now a thin centered\ncontainer and the nav config/icons are gone.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: Remove the widgets / pinning system

**Files:**
- Delete: `src/components/widgets/` (whole tree, incl. `WidgetsSection.tsx`, `todo/TodoWidget.tsx`), `src/hooks/useWidgets.ts`
- Modify: `src/pages/TodoPage.tsx`, plus any home-layout type that lists widgets

**Interfaces:** none produced.

- [ ] **Step 1: Find references**

Run: `grep -rn "useWidgets\|WidgetsSection\|TodoWidget\|addWidget\|removeWidgetByRefId\|togglePin\|HomeWidget\b" src`

- [ ] **Step 2: Delete the widget files**

```bash
git rm -r src/components/widgets
git rm src/hooks/useWidgets.ts
```

- [ ] **Step 3: Strip pinning from `TodoPage.tsx`**

Remove the `useWidgets()` usage and every `addWidget`/`removeWidgetByRefId` call, the `togglePin` function, and the pin button + its handler from the todo UI. Todos keep all other behavior (add/edit/complete/reorder/priority). The `pinned`/`completedAt` fields on `Todo` may remain in the type (harmless); just stop reading/writing `pinned` for the widget feature. Run typecheck to find every reference to remove.

- [ ] **Step 4: Clean the home layout type/hooks if they reference widgets**

If `src/api/types.ts` `HomeEnvelope`/`HomeWidget` or `src/hooks/useHome.ts`/`useHomeMigration.ts` reference widgets, leave the JSONB `widgets` field in the stored envelope (data-compatible) but remove any code that renders/derives widgets. Do not break the home envelope shape. Grep + typecheck to confirm nothing still imports `useWidgets`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: remove the widgets and todo-pin system\n\nDeletes WidgetsSection/useWidgets/TodoWidget and the pin-to-home path in\nTodoPage. Todos keep all other behavior.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 7: Remove Sport + Notes + the per-area routes

**Files:**
- Delete: `src/pages/SportPage.tsx`, `src/data/sportsData.ts` (+ sport-only data), `src/pages/NotesPage.tsx`, `src/api/notes.ts`, `src/hooks/useNotes.ts`, `src/components/home/SectionKategorier.tsx`
- Modify: `src/App.tsx`

**Interfaces:** none produced.

- [ ] **Step 1: Find references**

Run: `grep -rn "SportPage\|sportsData\|NotesPage\|notesApi\|useNotes\|KategorierSection\|/sport\|/notes\|/plan\|/todo\|/gaming\|/links" src`

- [ ] **Step 2: Delete the files**

```bash
git rm src/pages/SportPage.tsx src/pages/NotesPage.tsx src/api/notes.ts src/hooks/useNotes.ts src/components/home/SectionKategorier.tsx
git rm src/data/sportsData.ts   # plus any other sport-only data files the grep surfaced
```

- [ ] **Step 3: Update `App.tsx` routes**

Remove the `<Route>` lines for `/plan /todo /notes /sport /gaming /links`, and remove the `NotesPage` + `SportPage` imports. KEEP the `PlanPage`/`TodoPage`/`GamingPage`/`LinksPage` imports ONLY if `App.tsx` still references them; since `PageOverlay` now imports those four, remove their imports from `App.tsx` too. Final guarded routes: just `<Route path="/" element={<HomePage />} />` and `<Route path="*" element={<NotFoundPage />} />`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS. `grep -rn "/sport\|/notes\|SportPage\|NotesPage\|notesApi\|KategorierSection" src` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'feat: remove Sport, Notes, and the per-area routes\n\nDeletes the Sport + Notes pages/data/clients and the Kategorier section,\nand strips the per-area routes (only /, /login, /signup remain). The\nPlan/Todo/Gaming/Links pages live only in the pop-out overlay now.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 8: Final sweep + manual verification

**Files:** as needed (cleanup only).

- [ ] **Step 1: Dangling-reference sweep**

Run:
```bash
grep -rn "Sidebar\|MobileDrawer\|navConfig\|useWidgets\|WidgetsSection\|TodoWidget\|notesApi\|useNotes\|SportPage\|sportsData\|KategorierSection" src
```
Expected: empty. Fix any stragglers.

- [ ] **Step 2: Full gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 3: Manual verification (dev or deployed)**

- Home is a single page: launcher, Todo preview, Dagens plan, wishlist, Eksterne lenker, weather, news; drag-reorder works and persists.
- "Vis alle"/"Alle" on Todo, Plan, Gaming, Links each open the full page in a pop-out; close button + backdrop + Escape close it.
- The Plan pop-out's calendar and the Todo/Gaming/Links pages render and scroll inside the overlay.
- Account name + logout in the home header work; logout returns to /login.
- No sidebar, no mobile drawer, no widgets, no Sport/Notes anywhere.
- Direct navigation to `/sport` or `/notes` shows the NotFound page.

- [ ] **Step 4: Commit any cleanup**

```bash
git add -A
git commit -m "$(printf 'chore: final single-page cleanup sweep\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Overlay system (context + component, state-driven, no URL) -> Task 1.
- Todo preview section + drop widgets/kategorier from the list -> Task 2.
- Repoint Plan/Gaming/Links sections to overlay -> Task 3.
- Logout/name in home header -> Task 4.
- Remove sidebar/drawer/AppShell sidebar logic/navConfig -> Task 5.
- Remove widgets/pinning system + TodoPage pin -> Task 6.
- Remove Sport + Notes + per-area routes + Kategorier file -> Task 7.
- Keep launcher/weather/news; pages as-is in overlay -> Tasks 1-2 (sections untouched), Task 1 (pages rendered unchanged).
- Final sweep + manual verify -> Task 8.
All spec sections map to a task.

**Placeholder scan:** The removal/move tasks (4-7) describe deletions and a block-move (the Sidebar account markup) against cited files/lines rather than re-printing large existing bodies; the new modules (context, overlay, SectionTodo, helper, HomeAccount) have complete code. Task 6 Step 4 is conditional ("if X references widgets") because the exact home-envelope coupling is verified at edit time via grep/typecheck; the instruction (leave the JSONB field, remove rendering) is concrete. No "TODO/TBD" remain.

**Type consistency:** `OverlayKey = 'plan'|'todo'|'gaming'|'links'` defined in Task 1 is used identically in `PAGES` (Task 1) and every `openOverlay(...)` call (Tasks 2-3). `usePageOverlay()` returns `{ key, openOverlay, closeOverlay }` consumed in Tasks 2-3. `topOpenTodos(todos, n?)` defined in Task 2 matches its use in `SectionTodo`. `TodoSection({ handleProps })` registered in `SortableHomeSection` (Task 2) matches its definition. `HomeAccount` (Task 4) uses the same `useCurrentUser`/`useLogout` the sidebar did.
