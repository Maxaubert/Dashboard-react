# Home Widgets + Habit Tracker Design Spec

## Overview

Add a **Widgets section** to the dashboard home page that hosts small, per-user configurable widgets. The first widget type is a **Habit Tracker** — a per-habit card showing a 30-day GitHub-style completion grid with streak count. Users can have multiple habits; each renders as its own widget. Widgets flow horizontally, wrapping to new rows as needed.

The Widgets section sits alongside the existing draggable home sections (Kategorier, Eksterne lenker, Dagens plan, etc.) and hides entirely when no widgets exist.

## Scope Decomposition

This spec covers two related-but-distinct pieces:

1. **Widget framework** — a generic "Widgets" section on the home page with add/remove support
2. **Habit widget type** — the first concrete widget implementation

Both ship together because the framework needs at least one widget type to prove itself. Future widget types (Pomodoro display, etc.) will slot into the same framework.

## Architecture

### File Structure

```
src/pages/
  HomePage.tsx                     modified — add 'widgets' to SECTION_IDS, render WidgetsSection

src/components/widgets/
  WidgetsSection.tsx               ~80 lines — section wrapper, renders user's widgets, "+ Add widget" button
  AddWidgetMenu.tsx                ~60 lines — dropdown to pick a widget type to add
  HabitWidget.tsx                  ~100 lines — one habit widget (header + grid)
  HabitGrid.tsx                    ~80 lines — the 7-column Mon-Sun grid with click-to-toggle
  AddHabitModal.tsx                ~80 lines — modal for creating a new habit (name + color)

src/hooks/
  useWidgets.ts                    ~80 lines — user's widget list (CRUD, localStorage)
  useHabits.ts                     ~100 lines — habits CRUD + streak calc, localStorage
```

### Data Model

Persisted to localStorage. All data is local-only (no backend for now).

```typescript
// Widget types — extensible. For now only 'habit'.
type WidgetType = 'habit';

interface Widget {
  id: string;
  type: WidgetType;
  // For habit widgets, refs the habit by id. Future types may carry other props.
  refId: string;
}

interface Habit {
  id: string;
  name: string;
  color: string;              // hex
  completedDays: string[];    // ISO dates "YYYY-MM-DD"
  createdAt: string;          // ISO date
}
```

**localStorage keys:**
- `home-widgets-v1` — `Widget[]`
- `home-habits-v1` — `Habit[]`

### Data Flow

```
User clicks "+ Add widget" → AddWidgetMenu opens → pick "Habit"
  → AddHabitModal opens → user enters name + color
  → useHabits.addHabit() creates Habit
  → useWidgets.addWidget({ type: 'habit', refId: newHabit.id }) creates Widget
  → WidgetsSection re-renders with the new widget

User clicks a day in the grid:
  → HabitGrid.onToggle(date) → useHabits.toggleDay(habitId, date)
  → Habit.completedDays updated → streak recomputed → grid re-renders
```

## Visual Design

### Widgets Section

A new section on the home page, between Kategorier and Eksterne lenker (user can drag to reorder like other sections). Uses the same `.section-header` style as other sections.

**Section header:**
```
⠿ WIDGETS                    + ADD WIDGET →
```
- Grip handle on the left (drag to reorder section)
- "+ ADD WIDGET" link on the right using `.section-header-link` style (uppercase, muted, matches "ALLE" link)

**Empty state:** Section hidden entirely when `widgets.length === 0`. No placeholder card.

### Habit Widget Card

Uses the existing `.card` surface style:
- Background: `rgba(255, 255, 255, 0.006)`
- Border: `1px solid rgba(255, 255, 255, 0.028)`
- Border radius: `14px` (matches `var(--radius)`)
- Padding: `14px 16px`
- Box shadow: matches `.card`

**Widget contents (top to bottom):**
1. Header row (flex, centered):
   - 8px color dot (habit's accent color)
   - Habit name (0.78rem, weight 600, `rgba(255,255,255,0.7)`)
   - Streak badge: `🔥 12` (amber `#f59e0b`, 0.65rem, weight 700, small left margin)
2. 10px gap
3. Calendar grid (see below)

**Widgets layout:**
```css
display: flex;
gap: 12px;
flex-wrap: wrap;
```
Each widget sizes to its content. Widgets wrap naturally on narrow viewports.

### Habit Grid (14px cells, 3px gap)

- 7-column grid, Mon-Sun order
- Day headers hidden (not needed in small widget context)
- Cell size: 14px × 14px, border-radius 3px
- Gap: 3px between cells
- Offset cells at month start based on first-weekday
- States:
  - **Completed** (day in `completedDays`): solid accent color at 0.7 opacity
  - **Not completed past day** (past & not in list): `rgba(255, 255, 255, 0.06)` (dim track)
  - **Today + completed**: accent color + 2px outline in full accent color
  - **Today + not completed**: dim track + 2px outline in full accent color
  - **Future days**: very dim `rgba(255, 255, 255, 0.03)`, not interactive
- **Click behavior:** Click any past or current day to toggle. Click future days does nothing.
- Shows the current month only (no nav between months in widget — simplicity).

### Add Widget Menu

Dropdown/popover that appears when "+ Add widget" is clicked. Lists available widget types:

```
┌─────────────────────────┐
│ Add widget              │
├─────────────────────────┤
│ ● Habit Tracker         │
│ ○ More coming soon...   │
└─────────────────────────┘
```

Clicking "Habit Tracker" opens the AddHabitModal.

### Add Habit Modal

Uses Radix Dialog (already in the project). Fields:
- **Name** (text input, required, max 40 chars)
- **Color** (7 preset colors to pick from: #34d399, #a855f7, #38bdf8, #f97316, #eab308, #ef4444, #ec4899)

Footer buttons: **Cancel** | **Create habit**

Creating the habit:
1. Creates a `Habit` record
2. Creates a `Widget` record pointing to the habit
3. Closes modal
4. Widgets section shows the new habit widget

### Edit/Remove Habit

A small three-dot button in the top-right corner of each widget (shows on hover). Clicking opens a dropdown menu:
- **Rename** (opens modal with name field pre-filled)
- **Change color** (opens color picker modal)
- **Remove habit** (confirmation dialog — deletes both habit AND widget)

Uses `@radix-ui/react-dropdown-menu` for accessibility.

## Streak Calculation

Computed on the fly from `completedDays`:

```typescript
function calcStreak(completedDays: string[]): number {
  // Sort descending (today first)
  const sorted = [...completedDays].sort().reverse();
  const today = todayISO();
  const yesterday = addDays(today, -1);

  // Streak valid if today OR yesterday is in the list
  let cursor = sorted[0] === today ? today : sorted[0] === yesterday ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  for (const day of sorted) {
    if (day === cursor) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (day < cursor) {
      break;
    }
  }
  return streak;
}
```

## Integration with Existing Home Page

`HomePage.tsx` changes:
- Add `'widgets'` to `SECTION_IDS` (before `'ext-lenker'` by default)
- Add handling in `SortableHomeSection` to render `<WidgetsSection />` for id `'widgets'`
- Section position persists to the existing `home-section-order` localStorage key (no schema change — `widgets` just gets appended if missing)

## Animations (framer-motion)

- Widget add: scale from 0.9 to 1 + fade in (spring)
- Widget remove: scale to 0.9 + fade out (spring)
- Day toggle: brief scale-up pop (whileTap: 0.9, spring back)
- Streak badge: pulse once when streak increments (scale 1 → 1.15 → 1)

## Dependencies

**Existing (reused):**
- `@radix-ui/react-dialog` — AddHabitModal
- `@radix-ui/react-dropdown-menu` — AddWidgetMenu + right-click context menu
- `framer-motion` — animations (added in timer remodel)
- `@/hooks/useLocalStorage` — persistence

No new dependencies needed.

## Error Handling

- **Duplicate habit name:** allowed (users may legitimately want two "Exercise" habits tracked separately)
- **Empty name submit:** Create button disabled until name is non-empty
- **Invalid color:** only the 7 presets allowed; no free-form input
- **Clicking future day:** no-op, not styled as clickable
- **Corrupt localStorage data:** useWidgets/useHabits fall back to `[]` on parse errors

## Out of Scope

- No month navigation in the widget (always shows current month)
- No year/heatmap view (could be an "Expand" action on the widget in a future iteration)
- No quantity habits (binary only for now)
- No habit categories/grouping
- No reminders/notifications
- No sync across devices (localStorage only)
- No widget types other than Habit in this iteration
