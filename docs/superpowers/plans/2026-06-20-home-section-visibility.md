# Home Section Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings popup (gear button, top-right of the home page) with one toggle per home section, letting the user show/hide any of the 7 modular sections.

**Architecture:** Persist a `hidden: string[]` array in the existing home document (JSONB, no DB migration). `HomePage` filters its rendered sections by `hidden`; a `SettingsModal` lists every section with a toggle that writes through the existing optimistic `useMutateHome`. Drag-reorder logic is untouched, so hidden sections keep their place and reappear where they were.

**Tech Stack:** React 18 + TypeScript, react-query, the existing `Modal` primitive (Radix Dialog), lucide-react, Tailwind 4 + `globals.css`, vitest.

## Global Constraints

- UI language is Norwegian (`nb-NO`). Do not translate user-facing strings to English.
- No em-dashes anywhere (use en-dashes, commas, or rephrase). No emojis in code or commits.
- `@/*` resolves to `src/*`. Use it for cross-area imports; relative paths for siblings.
- Pages use raw `<button>`/`<input>` JSX — do NOT add a new UI primitive for the toggle.
- Test files are named `*.vitest.ts` (vitest `include` is `src/**/*.vitest.ts`).
- `npm run typecheck` and `npm test` must pass before any push.
- Commit bodies end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Branch: `feat/home-section-visibility` (already created). Issue: #27.

## File Structure

- `src/api/types.ts` — add `hidden` to `HomeEnvelope`.
- `src/hooks/useHome.ts` — `EMPTY_HOME` + `normaliseHome` default `hidden: []`.
- `src/hooks/useHome.vitest.ts` — NEW: unit tests for `normaliseHome`'s `hidden` handling.
- `src/lib/homeMigration.ts` — `readLocalStorageHome` returns `hidden: []`.
- `src/lib/homeMigration.vitest.ts` — update existing `HomeEnvelope` literals with `hidden: []`.
- `src/lib/home.ts` — add `SECTION_LABELS`.
- `src/lib/home.vitest.ts` — NEW: assert every `SectionId` has a label.
- `src/components/home/SettingsModal.tsx` — NEW: the toggle list.
- `src/pages/HomePage.tsx` — gear button, modal mount, visible filter, empty hint.
- `src/styles/globals.css` — gear button, settings rows + toggle, empty hint.

---

### Task 1: Data model — `hidden` on the home envelope

**Files:**
- Modify: `src/api/types.ts` (HomeEnvelope interface)
- Modify: `src/hooks/useHome.ts` (EMPTY_HOME, normaliseHome)
- Modify: `src/lib/homeMigration.ts` (readLocalStorageHome)
- Modify: `src/lib/homeMigration.vitest.ts` (literals)
- Test: `src/hooks/useHome.vitest.ts` (NEW)

**Interfaces:**
- Produces: `HomeEnvelope.hidden: string[]`; `normaliseHome(raw)` always returns `hidden` as an array; `EMPTY_HOME.hidden === []`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useHome.vitest.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normaliseHome } from './useHome';

describe('normaliseHome — hidden', () => {
  it('defaults hidden to [] when the key is missing', () => {
    const result = normaliseHome({ version: 1, sections: ['todo'], widgets: [], habits: [] });
    expect(result.hidden).toEqual([]);
  });

  it('defaults hidden to [] for null and undefined payloads', () => {
    expect(normaliseHome(null).hidden).toEqual([]);
    expect(normaliseHome(undefined).hidden).toEqual([]);
  });

  it('preserves a provided hidden array', () => {
    const result = normaliseHome({ hidden: ['wishlist', 'vaer'] });
    expect(result.hidden).toEqual(['wishlist', 'vaer']);
  });

  it('ignores a non-array hidden value', () => {
    const result = normaliseHome({ hidden: 'nope' as unknown as string[] });
    expect(result.hidden).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useHome.vitest.ts`
Expected: FAIL — `result.hidden` is `undefined` (property does not exist yet).

- [ ] **Step 3: Add `hidden` to the type**

In `src/api/types.ts`, update the `HomeEnvelope` interface (currently `version`, `sections`, `widgets`, `habits`):

```ts
/** Single envelope for all home-page server-persisted data. */
export interface HomeEnvelope {
  version: 1;
  /** Section IDs in the order they render on the home page. */
  sections: string[];
  /** Section IDs the user has hidden via Settings. Empty = all visible. */
  hidden: string[];
  widgets: HomeWidget[];
  habits: HomeHabit[];
}
```

- [ ] **Step 4: Default `hidden` in useHome.ts**

In `src/hooks/useHome.ts`, update `EMPTY_HOME` and `normaliseHome`:

```ts
const EMPTY_HOME: HomeEnvelope = { version: 1, sections: [], hidden: [], widgets: [], habits: [] };
```

```ts
export function normaliseHome(raw: Partial<HomeEnvelope> | null | undefined): HomeEnvelope {
  return {
    version: 1,
    sections: Array.isArray(raw?.sections) ? raw!.sections : [],
    hidden: Array.isArray(raw?.hidden) ? raw!.hidden : [],
    widgets: Array.isArray(raw?.widgets) ? raw!.widgets : [],
    habits: Array.isArray(raw?.habits) ? raw!.habits : [],
  };
}
```

- [ ] **Step 5: Keep the migration literals type-valid**

In `src/lib/homeMigration.ts`, add `hidden: []` to the `readLocalStorageHome` return (there is no legacy localStorage key for hidden, so it is always empty on migration):

```ts
export function readLocalStorageHome(): HomeEnvelope {
  return {
    version: 1,
    sections: parse<string[]>('home-section-order', []),
    hidden: [],
    widgets: parse<HomeWidget[]>('home-widgets-v1', []),
    habits: parse<HomeHabit[]>('home-habits-v1', []),
  };
}
```

In `src/lib/homeMigration.vitest.ts`, add `hidden: []` to every `HomeEnvelope` literal so typecheck and the `toEqual` comparisons stay correct. There are three:

`emptyEnvelope()`:
```ts
function emptyEnvelope(): HomeEnvelope {
  return { version: 1, sections: [], hidden: [], widgets: [], habits: [] };
}
```

The two literals inside the `decideMigration` tests (currently `version: 1, sections: ['widgets'], widgets: [], habits: []` and `version: 1, sections: [], widgets: [], habits: []`) — add `hidden: []` to each, e.g.:
```ts
      version: 1, sections: ['widgets'], hidden: [], widgets: [], habits: [],
```
```ts
      version: 1, sections: [], hidden: [], widgets: [], habits: [],
```

- [ ] **Step 6: Run the new test and the full suite**

Run: `npx vitest run src/hooks/useHome.vitest.ts`
Expected: PASS (4 tests).

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass (existing 46 + new tests).

- [ ] **Step 7: Commit**

```bash
git add src/api/types.ts src/hooks/useHome.ts src/hooks/useHome.vitest.ts src/lib/homeMigration.ts src/lib/homeMigration.vitest.ts
git commit -m "feat(home): add hidden[] to the home envelope

Refs #27

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Section labels

**Files:**
- Modify: `src/lib/home.ts` (add SECTION_LABELS)
- Test: `src/lib/home.vitest.ts` (NEW)

**Interfaces:**
- Produces: `SECTION_LABELS: Record<SectionId, string>` — a non-empty nb-NO label for every `SectionId`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/home.vitest.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SECTION_IDS, SECTION_LABELS } from './home';

describe('SECTION_LABELS', () => {
  it('has a non-empty label for every section id', () => {
    for (const id of SECTION_IDS) {
      expect(SECTION_LABELS[id]).toBeTruthy();
    }
  });

  it('has no labels for unknown ids beyond SECTION_IDS', () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...SECTION_IDS].sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/home.vitest.ts`
Expected: FAIL — `SECTION_LABELS` is not exported.

- [ ] **Step 3: Add the labels**

In `src/lib/home.ts`, after the `DEFAULT_SECTIONS` line, add:

```ts
/** Human-readable nb-NO labels for the Settings toggle list. */
export const SECTION_LABELS: Record<SectionId, string> = {
  'prompt-launcher': 'Hurtigsøk',
  'todo': 'Gjøremål',
  'dagens-plan': 'Dagens plan',
  'wishlist': 'Ønskeliste',
  'ext-lenker': 'Eksterne lenker',
  'vaer': 'Vær',
  'nyhetssaker': 'Nyheter',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/home.vitest.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/home.ts src/lib/home.vitest.ts
git commit -m "feat(home): add nb-NO section labels for settings

Refs #27

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SettingsModal component

**Files:**
- Create: `src/components/home/SettingsModal.tsx`
- Modify: `src/styles/globals.css` (settings list + rows + toggle)

**Interfaces:**
- Consumes: `Modal` from `@/components/ui`; `SECTION_LABELS`, `SectionId` from `@/lib/home`; `cn` from `@/lib/cn`.
- Produces: `SettingsModal({ open, onOpenChange, order, hidden, onToggle })` where
  `open: boolean`, `onOpenChange: (open: boolean) => void`, `order: SectionId[]`,
  `hidden: SectionId[]`, `onToggle: (id: SectionId) => void`.

This task has no vitest test: it is presentational wiring over the existing
`Modal`, and the repo has no React component-test harness. Verify via typecheck
and the manual checks in Task 4.

- [ ] **Step 1: Create the component**

Create `src/components/home/SettingsModal.tsx`:

```tsx
import { Modal } from '@/components/ui';
import { SECTION_LABELS, type SectionId } from '@/lib/home';
import { cn } from '@/lib/cn';

/**
 * Settings popup: one toggle per home section. Toggling writes through the
 * home mutation immediately (no Save button) — `onToggle` flips the id's
 * membership in `hidden`. `order` is the resolved page order so the list
 * mirrors the page top-to-bottom.
 */
export function SettingsModal({
  open,
  onOpenChange,
  order,
  hidden,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SectionId[];
  hidden: SectionId[];
  onToggle: (id: SectionId) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Innstillinger" variant="standard" size="md">
      <div className="settings-list">
        {order.map((id) => {
          const visible = !hidden.includes(id);
          return (
            <div className="settings-row" key={id}>
              <span className="settings-row-label">{SECTION_LABELS[id]}</span>
              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={SECTION_LABELS[id]}
                className={cn('settings-toggle', visible && 'on')}
                onClick={() => onToggle(id)}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Add styles**

Append to `src/styles/globals.css`:

```css
/* Settings popup — section show/hide toggles */
.settings-list { display: flex; flex-direction: column; }
.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 2px;
}
.settings-row + .settings-row { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.settings-row-label { font-size: 0.9rem; color: var(--color-text, #e5e7eb); }
.settings-toggle {
  position: relative; flex: 0 0 auto; width: 40px; height: 22px;
  border-radius: 999px; border: none; padding: 0; cursor: pointer;
  background: rgba(255, 255, 255, 0.14); transition: background 0.15s;
}
.settings-toggle.on { background: #4f46e5; }
.settings-toggle-knob {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; transition: transform 0.15s;
}
.settings-toggle.on .settings-toggle-knob { transform: translateX(18px); }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (The component is unused until Task 4; typecheck still validates it.)

- [ ] **Step 4: Commit**

```bash
git add src/components/home/SettingsModal.tsx src/styles/globals.css
git commit -m "feat(home): add SettingsModal toggle list

Refs #27

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: HomePage integration — gear button, filter, empty hint

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/styles/globals.css` (gear button + empty hint + topbar actions)

**Interfaces:**
- Consumes: `SettingsModal` from `@/components/home/SettingsModal`; `Settings` from `lucide-react`; `useMutateHome`, `useHome` (already imported); `SectionId` from `@/lib/home`.

This task is verified by typecheck + manual checks (visibility toggling and
DnD reordering require a running app; dnd-kit ignores synthetic events, so the
order-preservation check is manual).

- [ ] **Step 1: Add imports and settings state**

In `src/pages/HomePage.tsx`, add to the React import: `useState` (alongside `useMemo`). Add imports:

```tsx
import { Settings } from 'lucide-react';
import { SettingsModal } from '@/components/home/SettingsModal';
```

Inside `HomePage`, after the existing `const mutateHome = useMutateHome();` line, add:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false);
const hidden = (home?.hidden ?? []) as SectionId[];

function toggleSection(id: SectionId) {
  mutateHome((prev) => {
    const cur = (prev.hidden ?? []) as SectionId[];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    return { ...prev, hidden: next };
  });
}
```

- [ ] **Step 2: Compute the visible order**

After the existing `order` `useMemo` block, add:

```tsx
const visible = useMemo<SectionId[]>(
  () => order.filter((id) => !hidden.includes(id)),
  [order, hidden],
);
```

- [ ] **Step 3: Render the gear button in the topbar**

Replace the `.home-topbar` block:

```tsx
      <div className="home-topbar">
        <PageHeader eyebrow="Hjem" title="Dashboard" subtitle="Velg en kategori" />
        <HomeAccount />
      </div>
```

with:

```tsx
      <div className="home-topbar">
        <PageHeader eyebrow="Hjem" title="Dashboard" subtitle="Velg en kategori" />
        <div className="home-topbar-actions">
          <button
            type="button"
            className="home-settings-btn"
            aria-label="Innstillinger"
            title="Innstillinger"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={18} />
          </button>
          <HomeAccount />
        </div>
      </div>
```

- [ ] **Step 4: Render visible sections + empty hint + modal**

Replace the `SortableContext` block (currently mapping `order`):

```tsx
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="sections-container">
            {order.map((id) => (
              <SortableHomeSection key={id} id={id} />
            ))}
          </div>
        </SortableContext>
```

with (note: items + map now use `visible`):

```tsx
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          <div className="sections-container">
            {visible.length === 0 ? (
              <div className="home-empty-hint">
                Alle seksjoner er skjult – åpne Innstillinger for å vise dem.
              </div>
            ) : (
              visible.map((id) => <SortableHomeSection key={id} id={id} />)
            )}
          </div>
        </SortableContext>
```

Then add the modal just before the final closing `</div>` of the `.page` wrapper (after `</DndContext>`):

```tsx
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        order={order}
        hidden={hidden}
        onToggle={toggleSection}
      />
```

Leave `handleDragEnd` unchanged — it operates on the full `order` via
`order.indexOf(...)`, which keeps hidden sections in their slots.

- [ ] **Step 5: Add styles**

Append to `src/styles/globals.css`:

```css
/* Home topbar actions (gear + account) */
.home-topbar-actions { display: flex; align-items: center; gap: 12px; }
.home-settings-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border, #2a2a2a);
  color: var(--color-text-muted, #a1a1aa);
  cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.home-settings-btn:hover { color: #fff; border-color: #3a3a3a; }
.home-empty-hint {
  padding: 48px 16px; text-align: center;
  color: var(--color-text-muted, #71717a); font-size: 0.9rem;
}
```

- [ ] **Step 6: Typecheck and tests**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 7: Manual verification**

Run: `npm run dev` and open the printed localhost URL (read the actual port from `_dev.log` — Vite hops from 5173 if taken). Log in, then on the home page:
- Click the gear (top-right) → "Innstillinger" popup opens with 7 labelled toggles.
- Toggle a section off → it disappears from the page immediately (behind the modal).
- Toggle it back on → it reappears in its original position.
- Drag-reorder two sections, then hide and re-show one → confirm it returns to the spot consistent with the new order (hidden ids keep their slot).
- Hide all 7 → the empty hint shows; the gear remains usable.
- Reload the page → the hidden state persisted (server round-trip).

- [ ] **Step 8: Commit**

```bash
git add src/pages/HomePage.tsx src/styles/globals.css
git commit -m "feat(home): settings gear toggles section visibility

Closes #27

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** data model (`hidden`) → Task 1; labels → Task 2; modal + toggle UI → Task 3; gear button, visible filter, empty hint, persistence wiring → Task 4. `normaliseHome` default test → Task 1. All spec sections covered.
- **Placeholders:** none — every step has concrete code/commands.
- **Type consistency:** `hidden` typed `string[]` in `HomeEnvelope`; cast to `SectionId[]` at the HomePage boundary; `SettingsModal` props use `SectionId[]`/`(id: SectionId) => void`; `toggleSection` matches `onToggle`. `SECTION_LABELS` keyed by `SectionId` and consumed as `SECTION_LABELS[id]`.
- **Open follow-up:** after Task 4, push the branch and open a PR referencing #27 (handled outside the plan, per repo workflow).
