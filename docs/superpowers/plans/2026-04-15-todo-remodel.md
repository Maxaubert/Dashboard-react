# Todo Remodel + Pin-to-Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Visual redesign of `/todo` and add the ability to pin individual todos so they appear as widgets on the home page.

**Architecture:**
- Visual: rewrite `TodoPage.tsx` and the `.todo-*` CSS in `globals.css` to match the chosen mockup variant. Functional behavior (list/kanban toggle, drag-reorder, modal CRUD, deadline urgency) is preserved.
- Pinning: extend the `Todo` schema with `pinned?: boolean`. Add a pin button on each `TodoItem` (and a pin toggle in the edit modal). On the home page, render each pinned todo as a `widget` of type `'todo'` with `refId = todo.id`. The home envelope's widget list is server-stored already (`/api/home`), so pinning + ordering survive across devices.

**Tech Stack:** React 18 + TypeScript, framer-motion, dnd-kit, Radix Dialog, vitest, Python `api.py` (no backend changes needed — `/api/todos` already accepts arbitrary JSON shapes).

**Spec:** This plan IS the spec — small enough to combine. The visual choice is parameterized by which mockup is picked.

---

## Locked decisions (2026-04-15)

1. **Page visual style:** **V3 · Minimal editorial** — see `docs/superpowers/mockups/2026-04-15-todo-page-visuals.html` (V3 section) and `docs/superpowers/mockups/2026-04-15-todo-v3-columns.html` (column view). Big type hero ("Todo."), chip-based view controls + new-task button, divider-only rows (no card backgrounds), priority shown by tiny color dot. Columns view uses the same row treatment split across 3 whitespace-separated columns with typographic headers.
2. **Pin widget grouping:** **Option A2** — per-todo 164×156 tile with pink-gradient background (`linear-gradient(135deg, rgba(244,114,182,.22) 0%, var(--color-surface) 70%)`, border `rgba(244,114,182,.35)`). See `docs/superpowers/mockups/2026-04-15-pin-widget.html` (A2 section). `refId = todo.id`, one widget per pinned todo.
3. **Background:** Use the existing site grid + sunbeam bg (already on `body` via `globals.css`). **Do not add any grid/sunbeam CSS** — mockup styles reproduce it only for preview purposes.

---

## File structure

**Modified:**
- `src/api/types.ts` — add `pinned?: boolean` to `Todo`.
- `src/pages/TodoPage.tsx` — full rewrite of the layout against the picked mockup; add pin button to `TodoItem`; pin checkbox in `TodoModal`.
- `src/styles/globals.css` — replace the `.todo-*` block with new styles.
- `src/components/widgets/WidgetsSection.tsx` — render a `TodoWidget` (or `PinnedTodosWidget`) when `w.type === 'todo'`.
- `src/api/types.ts`'s `HomeWidget.type` union — add `'todo'`.
- `src/hooks/useWidgets.ts` — `WidgetType` derives from `HomeWidget['type']`, so it's automatic.

**New:**
- `src/components/widgets/todo/TodoWidget.tsx` (or `PinnedTodosWidget.tsx`) — the home widget body.
- `src/components/widgets/AddWidgetDialog.tsx` — add a "Pinned todos" tile in the add-widget grid (only relevant for option B; option A widgets are summoned by pinning a todo, not via the dialog).

---

## Task 1: Add `pinned` to the `Todo` schema

**Files:** `src/api/types.ts`

- [ ] **Step 1: Extend the interface.**

In `src/api/types.ts`, replace the `Todo` interface:

```ts
export interface Todo {
  id: string;
  text: string;
  priority: Priority;
  deadline?: string | null;
  done: boolean;
  /** True when the user has pinned this todo to the home page as a widget. */
  pinned?: boolean;
}
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`. Expected: PASS. (No consumers care about the new optional field yet.)

- [ ] **Step 3: Commit.**

```bash
git add src/api/types.ts
git commit -m "feat(todo): add pinned field to Todo schema"
```

---

## Task 2: Add `'todo'` to the widget kind union

**Files:** `src/api/types.ts`

- [ ] **Step 1: Extend `HomeWidget.type`.**

In `src/api/types.ts`, replace the `HomeWidget` interface:

```ts
export interface HomeWidget {
  id: string;
  type: 'habit' | 'countdown' | 'pomodoro' | 'stopwatch' | 'alarm' | 'todo';
  refId: string;
}
```

- [ ] **Step 2: Verify typecheck.**

Run: `npm run typecheck`. Expected: PASS — `useWidgets.WidgetType` derives from this so it picks up the new variant automatically.

- [ ] **Step 3: Commit.**

```bash
git add src/api/types.ts
git commit -m "feat(widgets): add 'todo' to HomeWidget type union"
```

---

## Task 3: Pin button on `TodoItem` + modal toggle

**Files:** `src/pages/TodoPage.tsx`

- [ ] **Step 1: Add a pin handler in `TodoPage`.**

```ts
function togglePin(id: string) {
  persist(sorted.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  // Also add/remove the corresponding home widget so the pin survives reload.
  const target = sorted.find((t) => t.id === id);
  if (!target) return;
  if (target.pinned) {
    // Was pinned, now unpinning → remove the widget if present.
    removeWidgetByRefId(id);
  } else {
    addWidget('todo', id);
  }
}
```

Pull `addWidget` and `removeWidgetByRefId` from `useWidgets()` at the top of `TodoPage`.

- [ ] **Step 2: Add a pin button to `TodoItem`.**

Add a `Pin` icon button next to the existing edit/delete actions. Use `lucide-react`'s `Pin` (outline) when unpinned and `PinOff` or filled `Pin` when pinned. Call `onTogglePin()` from the parent.

- [ ] **Step 3: Add a pin toggle to `TodoModal`.**

Below the deadline field:

```tsx
<div className="todo-field">
  <label className="todo-pin-toggle">
    <input
      type="checkbox"
      checked={form.pinned ?? false}
      onChange={(e) => update('pinned', e.target.checked)}
    />
    <span>Pin to dashboard</span>
  </label>
</div>
```

When the modal saves, the pin state writes through `handleSave`. The pin/unpin widget side-effect must also fire from `handleSave` if `pinned` changed.

- [ ] **Step 4: Verify typecheck and run dev.**

Run: `npm run typecheck`. Expected: PASS.

Run `npm run dev`, pin a todo, verify a widget appears on home; unpin, widget disappears.

- [ ] **Step 5: Commit.**

```bash
git add src/pages/TodoPage.tsx
git commit -m "feat(todo): pin/unpin button + modal toggle"
```

---

## Task 4: Visual redesign of `/todo` — V3 Minimal editorial

**Files:** `src/pages/TodoPage.tsx`, `src/styles/globals.css`

**Reference mockups:** `docs/superpowers/mockups/2026-04-15-todo-page-visuals.html` (V3 section) and `docs/superpowers/mockups/2026-04-15-todo-v3-columns.html`.

Visual language:
- **Hero**: large bold title "Todo." (font-size ~2.4rem, weight 800, letter-spacing -0.02em), small eyebrow "Oppgaver" above, count line below (`{active} aktive · {done} fullført`, with active count in pink `var(--color-page-todo)`). Hero sits above a 1px bottom border.
- **Controls** (right-aligned in hero): pill-shape `chip` buttons. Liste / Kolonner toggle (active = white bg, black text). Primary "＋ Ny" chip uses pink bg (`--color-page-todo`) with dark text.
- **List view row**: grid `[ ck 18px | pri-dot 6px | title 1fr | deadline auto | actions auto ]`, 14px vertical padding, `border-bottom: 1px solid rgba(255,255,255,0.05)`. No card background. Checkbox is a circle (not rounded square). Priority = single 6px color dot.
- **Column view**: 3 columns via `display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 36px`. Each column header is `[ dot · Høy (1.1rem weight 700) · count muted · + ]` with 1px bottom border. Rows reuse the same divider-only treatment as list view.
- **Done section**: labeled "Fullført" (tiny uppercase muted), rows reuse the same structure with `.done` modifier (filled check, line-through title, dimmed text).
- **Typography**: eyebrow `.68rem` uppercase `.14em`, section labels `.64rem` uppercase `.18em`, rows `.9rem`, deadlines `.7rem`.
- **Colors**: priorities use `--color-danger` (high), `--color-warning` (med), `--color-info` (low). Overdue deadlines use `--color-danger`.
- **DO NOT** add any grid/sunbeam CSS — site already has it on `body`.

- [ ] **Step 1: Replace the current `.todo-*` CSS block in `globals.css`.**

Lines ~6090–6500 of the current file. Author new block that matches the V3 mockup. Use existing CSS variables (`--color-page-todo`, `--color-danger`, `--color-warning`, `--color-info`, `--color-border`, `--color-text`, `--color-text-dim`, `--color-text-muted`, `--color-surface`). Keep class names stable where the React side references them, but you MAY add/rename classes as long as `TodoPage.tsx` is updated in lockstep.

- [ ] **Step 2: Update `TodoPage.tsx` markup to match V3 structure.**

Preserve all behavior: list view, columns view, view switch, new-task button, modal, drag-reorder, deadline urgency, done section, pin button + toggle from Task 3.

Structure:
```tsx
<div className="todo-page">
  <div className="todo-hero">
    <div>
      <div className="todo-eyebrow">Oppgaver</div>
      <h1 className="todo-title">Todo.</h1>
      <div className="todo-count"><strong>{active.length}</strong> aktive · {done.length} fullført</div>
    </div>
    <div className="todo-controls">
      <button className={cn('todo-chip', view === 'list' && 'active')} onClick={() => setView('list')}>Liste</button>
      <button className={cn('todo-chip', view === 'columns' && 'active')} onClick={() => setView('columns')}>Kolonner</button>
      <button className="todo-chip primary" onClick={() => setCreating('medium')}>＋ Ny</button>
    </div>
  </div>
  {/* list OR columns */}
  {/* Fullført section */}
</div>
```

- [ ] **Step 3: Smoke in browser at every breakpoint.**

Open `npm run dev` and resize the window to 360, 768, 1280, 1920px. The page should look intentional at all four widths.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/TodoPage.tsx src/styles/globals.css
git commit -m "feat(todo): visual redesign — variant <X>"
```

---

## Task 5: `TodoWidget` on home — Option A2 (pink gradient tile)

**Files:** `src/components/widgets/todo/TodoWidget.tsx`, `src/components/widgets/WidgetsSection.tsx`

**Reference mockup:** `docs/superpowers/mockups/2026-04-15-pin-widget.html` (A2 section).

Visual language:
- 164×156 widget tile via existing `WidgetShell`.
- Tile background: `linear-gradient(135deg, rgba(244,114,182,.22) 0%, var(--color-surface) 70%)`, border `1px solid rgba(244,114,182,.35)`.
- Header: small uppercase type label "📌 Festet" in pink (`--color-page-todo`), actions menu on right.
- Body: large rounded-square checkbox (22×22, `rgba(244,114,182,.55)` border), todo title beneath (`.86rem`, weight 600, `line-height 1.3`).
- Footer: priority pill + deadline pill (`.pill` = `2px 8px`, `border-radius: 999px`, `background: rgba(0,0,0,.3)`, dim text). Overdue pill uses `--color-danger` text.
- Clicking the checkbox marks the todo done (mutates via `useSaveTodos`). Done todos show struck-through title and dimmed tile.
- Right-click menu (Radix context-menu, same pattern as link cards): Edit (opens `TodoModal`) + Unpin (sets `pinned: false` and removes widget by refId).

- [ ] **Step 1: Create `src/components/widgets/todo/TodoWidget.tsx`.**

Reads the todo by `refId` from `useTodos()`. If the todo no longer exists (deleted), widget self-removes via `removeWidgetByRefId(refId)` in a `useEffect`, then returns `null`.

- [ ] **Step 2: Wire into `WidgetsSection.renderWidget`.**

```tsx
if (w.type === 'todo') {
  return <TodoWidget refId={w.refId} />;
}
```

- [ ] **Step 3: Add CSS for the A2 tile.**

Append to `globals.css` (after existing widget styles). Classes: `.todo-widget`, `.todo-widget-check`, `.todo-widget-title`, `.todo-widget-pills`, `.todo-widget-pill`. Do NOT introduce new CSS variables — reuse existing tokens.

- [ ] **Step 4: Verify typecheck + smoke.**

Run: `npm run typecheck`. Pin a todo, see A2 tile appear on home; toggle check from widget; right-click → Unpin; widget disappears.

- [ ] **Step 5: Commit.**

```bash
git add src/components/widgets/todo/ src/components/widgets/WidgetsSection.tsx src/styles/globals.css
git commit -m "feat(todo): pinned-todo widget (A2 pink-gradient tile)"
```

---

## Task 6: Final integration

- [ ] **Step 1: Run full suite.**

```bash
npm test           # 48 tests still pass (no new tests for UI)
npm run typecheck  # PASS
npm run build      # PASS
```

- [ ] **Step 2: Manual smoke checklist.**

- Visit `/todo`, add a todo, edit, mark done, undo done, delete.
- Switch list ↔ columns, drag-reorder both views.
- Pin a todo from the row → widget appears on `/`.
- Pin from the modal → widget appears.
- Unpin from row OR modal OR widget context menu → widget disappears.
- Reload the home page → pinned widgets persist.
- Open in a second browser → pinned widgets sync via `/api/home`.

- [ ] **Step 3: Squash-merge to main + frontend deploy.**

```bash
cd ../..
git merge --squash feat/todo-remodel
git commit -m "feat(todo): visual redesign + pin-to-widget"
git push origin main
npm run build
python _deploy.py
```

---

## Self-Review

### Spec coverage

- [x] Visual redesign — Task 4 (driven by mockup pick)
- [x] Pin from todo page — Task 3
- [x] Widget on dashboard — Task 5
- [x] Manual (not automatic) pinning — Task 3 (only fires on explicit user click)
- [x] Pinning is done from the todo page — Task 3 (button on row + modal toggle)
- [x] All work on a worktree — `feat/todo-remodel` already created

### Notes for the implementer

- The visual mockup the user picks dictates Task 4. Don't try to ship Task 4 before that pick is made — leave it stubbed as TODO if the implementer reaches it before the design is locked.
- The pinning feature (Tasks 1–3, 5) is independent of the visual choice — those tasks can ship first if needed.
- Don't add tests for the UI changes; the project's existing test surface only covers reducer logic, and there's no test infrastructure for React components.
