# Home Widgets + Habit Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Widgets section to the home page with habit tracker as the first widget type. Each habit renders as its own small widget with a 30-day grid, color dot, name, and streak counter. Widgets flow horizontally and wrap.

**Architecture:** Section integrates with existing draggable home sections. User's widget list and habit records live in localStorage. Widgets section hides when empty. AddWidgetMenu → AddHabitModal creates Widget + Habit atomically. HabitGrid is click-to-toggle on current-month days.

**Tech Stack:** React 18, TypeScript, framer-motion (already installed), Radix Dialog + DropdownMenu (already installed), localStorage

**Worktree:** `.worktrees/feat-home-widgets`

---

### Task 1: Data types + useHabits hook

**Files:**
- Create: `src/hooks/useHabits.ts`
- Create: `src/hooks/useHabits.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useHabits.test.ts`:

```typescript
import { calcStreak, todayISO, addDays } from './useHabits';

let failed = 0;
let passed = 0;
function check(ok: boolean, msg: string) {
  if (ok) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// ── todayISO ─────────────────────────────────────────────────────────────
console.log('\ntodayISO');
check(/^\d{4}-\d{2}-\d{2}$/.test(todayISO()), 'returns YYYY-MM-DD format');

// ── addDays ──────────────────────────────────────────────────────────────
console.log('\naddDays');
check(addDays('2026-04-12', 1) === '2026-04-13', '2026-04-12 + 1 = 2026-04-13');
check(addDays('2026-04-12', -1) === '2026-04-11', '2026-04-12 - 1 = 2026-04-11');
check(addDays('2026-04-30', 1) === '2026-05-01', 'crosses month boundary');
check(addDays('2026-12-31', 1) === '2027-01-01', 'crosses year boundary');

// ── calcStreak ───────────────────────────────────────────────────────────
console.log('\ncalcStreak');
check(calcStreak([]) === 0, 'empty → 0');

// Mock today as 2026-04-12 for deterministic tests
const today = todayISO();
const y1 = addDays(today, -1);
const y2 = addDays(today, -2);
const y3 = addDays(today, -3);

check(calcStreak([today]) === 1, 'just today → 1');
check(calcStreak([today, y1, y2]) === 3, 'today + 2 previous → 3');
check(calcStreak([y1, y2, y3]) === 3, 'yesterday + 2 prior (today missing) → 3 (grace period)');
check(calcStreak([y2, y3]) === 0, 'gap of 2+ days → 0');
check(calcStreak([today, y2]) === 1, 'today + skip yesterday → 1');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-home-widgets && npx tsx src/hooks/useHabits.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useHabits.ts**

Create `src/hooks/useHabits.ts`:

```typescript
import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface Habit {
  id: string;
  name: string;
  color: string;
  completedDays: string[];
  createdAt: string;
}

const STORAGE_KEY = 'home-habits-v1';

/* ── Date utilities ─────────────────────────────────────────────────── */

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(date.getUTCDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/* ── Streak calc ────────────────────────────────────────────────────── */

export function calcStreak(completedDays: string[]): number {
  if (completedDays.length === 0) return 0;
  const sorted = [...completedDays].sort().reverse();
  const today = todayISO();
  const yesterday = addDays(today, -1);

  // Streak starts from today OR yesterday (grace period)
  let cursor: string | null = null;
  if (sorted.includes(today)) cursor = today;
  else if (sorted.includes(yesterday)) cursor = yesterday;

  if (!cursor) return 0;

  const daySet = new Set(sorted);
  let streak = 0;
  while (daySet.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/* ── CRUD hook ──────────────────────────────────────────────────────── */

export function useHabits() {
  const [habits, setHabits] = useLocalStorage<Habit[]>(STORAGE_KEY, []);

  const addHabit = useCallback(
    (name: string, color: string): Habit => {
      const habit: Habit = {
        id: crypto.randomUUID(),
        name: name.trim(),
        color,
        completedDays: [],
        createdAt: new Date().toISOString(),
      };
      setHabits((prev) => [...prev, habit]);
      return habit;
    },
    [setHabits],
  );

  const updateHabit = useCallback(
    (id: string, patch: Partial<Pick<Habit, 'name' | 'color'>>) => {
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    },
    [setHabits],
  );

  const removeHabit = useCallback(
    (id: string) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
    },
    [setHabits],
  );

  const toggleDay = useCallback(
    (id: string, date: string) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const has = h.completedDays.includes(date);
          return {
            ...h,
            completedDays: has ? h.completedDays.filter((d) => d !== date) : [...h.completedDays, date],
          };
        }),
      );
    },
    [setHabits],
  );

  return { habits, addHabit, updateHabit, removeHabit, toggleDay };
}
```

- [ ] **Step 4: Run tests — should pass**

```bash
cd .worktrees/feat-home-widgets && npx tsx src/hooks/useHabits.test.ts
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/hooks/useHabits.ts src/hooks/useHabits.test.ts
git commit -m "feat(habits): add useHabits hook with streak calculation"
```

---

### Task 2: useWidgets hook

**Files:**
- Create: `src/hooks/useWidgets.ts`
- Create: `src/hooks/useWidgets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useWidgets.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useWidgets } from './useWidgets';

// Minimal smoke test — the heavy lifting is in useLocalStorage (already tested elsewhere)
// We just verify the CRUD shape here via tsx.

let failed = 0;
let passed = 0;
function check(ok: boolean, msg: string) {
  if (ok) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// Stub localStorage for tsx env
if (typeof window === 'undefined') {
  (globalThis as any).window = { localStorage: { store: {} as Record<string, string>, getItem(k: string) { return this.store[k] ?? null; }, setItem(k: string, v: string) { this.store[k] = v; } } };
}

// Can't call React hooks directly in tsx — just verify the module exports
import * as mod from './useWidgets';
check(typeof mod.useWidgets === 'function', 'exports useWidgets function');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

Note: the `renderHook` import is aspirational (not used). This test just verifies the module shape so we catch broken exports quickly. Full behavior is tested via integration in the browser (Task 10).

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-home-widgets && npx tsx src/hooks/useWidgets.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement useWidgets.ts**

Create `src/hooks/useWidgets.ts`:

```typescript
import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export type WidgetType = 'habit';

export interface Widget {
  id: string;
  type: WidgetType;
  refId: string;
}

const STORAGE_KEY = 'home-widgets-v1';

export function useWidgets() {
  const [widgets, setWidgets] = useLocalStorage<Widget[]>(STORAGE_KEY, []);

  const addWidget = useCallback(
    (type: WidgetType, refId: string): Widget => {
      const widget: Widget = {
        id: crypto.randomUUID(),
        type,
        refId,
      };
      setWidgets((prev) => [...prev, widget]);
      return widget;
    },
    [setWidgets],
  );

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => prev.filter((w) => w.id !== id));
    },
    [setWidgets],
  );

  const removeWidgetByRefId = useCallback(
    (refId: string) => {
      setWidgets((prev) => prev.filter((w) => w.refId !== refId));
    },
    [setWidgets],
  );

  return { widgets, addWidget, removeWidget, removeWidgetByRefId };
}
```

- [ ] **Step 4: Run test — should pass**

```bash
cd .worktrees/feat-home-widgets && npx tsx src/hooks/useWidgets.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/hooks/useWidgets.ts src/hooks/useWidgets.test.ts
git commit -m "feat(widgets): add useWidgets hook for home page widgets"
```

---

### Task 3: HabitGrid component

**Files:**
- Create: `src/components/widgets/HabitGrid.tsx`

- [ ] **Step 1: Create HabitGrid.tsx**

```typescript
import { motion } from 'framer-motion';
import { todayISO, type Habit } from '@/hooks/useHabits';

interface HabitGridProps {
  habit: Habit;
  onToggle: (date: string) => void;
}

const CELL = 14;
const GAP = 3;

/**
 * 7-column Mon-Sun grid of the current month. Click past/today cells to toggle.
 * Future cells are dimmed and not interactive.
 */
export function HabitGrid({ habit, onToggle }: HabitGridProps) {
  const today = todayISO();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month — convert JS getDay (0=Sun) to Mon-first (0=Mon, 6=Sun)
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const completedSet = new Set(habit.completedDays);

  const cells: Array<{ key: string; date?: string; state: 'past-done' | 'past-miss' | 'today-done' | 'today-miss' | 'future' | 'empty' }> = [];

  // Leading empty cells
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `empty-${i}`, state: 'empty' });
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = date === today;
    const isFuture = date > today;
    const isDone = completedSet.has(date);
    let state: 'past-done' | 'past-miss' | 'today-done' | 'today-miss' | 'future';
    if (isFuture) state = 'future';
    else if (isToday && isDone) state = 'today-done';
    else if (isToday) state = 'today-miss';
    else if (isDone) state = 'past-done';
    else state = 'past-miss';
    cells.push({ key: date, date, state });
  }

  return (
    <div
      role="grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(7, ${CELL}px)`,
        gap: `${GAP}px`,
      }}
    >
      {cells.map((c) => {
        if (c.state === 'empty' || !c.date) {
          return <div key={c.key} style={{ width: CELL, height: CELL }} />;
        }
        const bg = cellBackground(c.state, habit.color);
        const outline = (c.state === 'today-done' || c.state === 'today-miss')
          ? `2px solid ${habit.color}`
          : undefined;
        const interactive = c.state !== 'future';
        return (
          <motion.button
            key={c.key}
            type="button"
            aria-label={`${c.date}: ${c.state === 'past-done' || c.state === 'today-done' ? 'completed' : 'not completed'}`}
            onClick={interactive ? () => onToggle(c.date!) : undefined}
            disabled={!interactive}
            whileTap={interactive ? { scale: 0.85 } : undefined}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{
              width: CELL,
              height: CELL,
              padding: 0,
              border: 'none',
              borderRadius: 3,
              background: bg,
              outline,
              outlineOffset: '-1px',
              cursor: interactive ? 'pointer' : 'default',
            }}
          />
        );
      })}
    </div>
  );
}

function cellBackground(state: string, color: string): string {
  switch (state) {
    case 'past-done':
    case 'today-done':
      return hexWithAlpha(color, 0.7);
    case 'past-miss':
    case 'today-miss':
      return 'rgba(255, 255, 255, 0.06)';
    case 'future':
      return 'rgba(255, 255, 255, 0.03)';
    default:
      return 'transparent';
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/HabitGrid.tsx
git commit -m "feat(widgets): add HabitGrid component with click-to-toggle"
```

---

### Task 4: AddHabitModal component

**Files:**
- Create: `src/components/widgets/AddHabitModal.tsx`

Create the modal using Radix Dialog (already installed).

- [ ] **Step 1: Create AddHabitModal.tsx**

```typescript
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

const PRESET_COLORS = ['#34d399', '#a855f7', '#38bdf8', '#f97316', '#eab308', '#ef4444', '#ec4899'];

interface AddHabitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, color: string) => void;
  /** Initial values for edit mode. If set, modal shows "Save changes" instead of "Create habit". */
  initialName?: string;
  initialColor?: string;
  mode?: 'create' | 'edit';
}

export function AddHabitModal({
  open,
  onOpenChange,
  onCreate,
  initialName = '',
  initialColor = PRESET_COLORS[0],
  mode = 'create',
}: AddHabitModalProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  function reset() {
    setName(initialName);
    setColor(initialColor);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), color);
    onOpenChange(false);
    if (mode === 'create') reset();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16,
            padding: 24,
            width: 360,
            zIndex: 101,
          }}
        >
          <Dialog.Title
            style={{
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 700,
              marginBottom: 16,
            }}
          >
            {mode === 'create' ? 'New habit' : 'Edit habit'}
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 6,
                }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoFocus
                placeholder="Exercise"
                style={{
                  width: '100%',
                  background: '#050505',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 8,
                }}
              >
                Color
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: color === c ? '2px solid rgba(255, 255, 255, 0.8)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'transform 0.15s',
                      transform: color === c ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Dialog.Close asChild>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim()}
                style={{
                  background: name.trim() ? color : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  color: name.trim() ? '#000' : 'rgba(255, 255, 255, 0.3)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: name.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {mode === 'create' ? 'Create habit' : 'Save changes'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/AddHabitModal.tsx
git commit -m "feat(widgets): add AddHabitModal with name + color picker"
```

---

### Task 5: HabitWidget component

**Files:**
- Create: `src/components/widgets/HabitWidget.tsx`

The card containing a single habit — header with color dot, name, streak, three-dot menu, and the HabitGrid below.

- [ ] **Step 1: Create HabitWidget.tsx**

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { calcStreak, type Habit } from '@/hooks/useHabits';
import { HabitGrid } from './HabitGrid';
import { AddHabitModal } from './AddHabitModal';

interface HabitWidgetProps {
  habit: Habit;
  onToggleDay: (date: string) => void;
  onUpdate: (patch: { name?: string; color?: string }) => void;
  onRemove: () => void;
}

export function HabitWidget({ habit, onToggleDay, onUpdate, onRemove }: HabitWidgetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const streak = calcStreak(habit.completedDays);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        background: 'rgba(255, 255, 255, 0.006)',
        border: '1px solid rgba(255, 255, 255, 0.028)',
        borderRadius: 14,
        padding: '14px 16px',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: habit.color }} />
        <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.78rem', fontWeight: 600 }}>
          {habit.name}
        </span>
        {streak > 0 && (
          <span style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 700, marginLeft: 4 }}>
            🔥 {streak}
          </span>
        )}

        {/* Three-dot menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Habit options"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                padding: 2,
                color: 'rgba(255, 255, 255, 0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: 4,
                minWidth: 140,
                zIndex: 50,
              }}
            >
              <DropdownMenu.Item
                onSelect={() => setEditOpen(true)}
                style={{
                  padding: '6px 10px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderRadius: 4,
                  outline: 'none',
                }}
              >
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setConfirmRemove(true)}
                style={{
                  padding: '6px 10px',
                  color: '#ef4444',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderRadius: 4,
                  outline: 'none',
                }}
              >
                Remove
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Grid */}
      <HabitGrid habit={habit} onToggle={onToggleDay} />

      {/* Edit modal */}
      <AddHabitModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initialName={habit.name}
        initialColor={habit.color}
        onCreate={(name, color) => onUpdate({ name, color })}
      />

      {/* Remove confirmation */}
      <AnimatePresence>
        {confirmRemove && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setConfirmRemove(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 16,
                padding: 24,
                width: 320,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: 8 }}>
                Remove "{habit.name}"?
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.82rem', marginBottom: 20 }}>
                This will delete all tracked days. Cannot be undone.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRemove(false);
                    onRemove();
                  }}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/HabitWidget.tsx
git commit -m "feat(widgets): add HabitWidget with edit/remove menu"
```

---

### Task 6: AddWidgetMenu component

**Files:**
- Create: `src/components/widgets/AddWidgetMenu.tsx`

Dropdown menu shown when user clicks "+ Add widget". For now, only one option: "Habit Tracker".

- [ ] **Step 1: Create AddWidgetMenu.tsx**

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface AddWidgetMenuProps {
  onAddHabit: () => void;
}

export function AddWidgetMenu({ onAddHabit }: AddWidgetMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="section-header-link"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          + Add widget
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: 4,
            minWidth: 180,
            zIndex: 50,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              padding: '6px 10px 4px',
            }}
          >
            Add widget
          </div>
          <DropdownMenu.Item
            onSelect={onAddHabit}
            style={{
              padding: '8px 10px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              borderRadius: 6,
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>🔥</span>
            Habit Tracker
          </DropdownMenu.Item>
          <div
            style={{
              padding: '8px 10px',
              color: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.75rem',
              fontStyle: 'italic',
            }}
          >
            More coming soon...
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/AddWidgetMenu.tsx
git commit -m "feat(widgets): add AddWidgetMenu dropdown"
```

---

### Task 7: WidgetsSection component

**Files:**
- Create: `src/components/widgets/WidgetsSection.tsx`

The section wrapper that renders the user's widgets. Accepts `handleProps` for the drag grip (same pattern as other home sections).

- [ ] **Step 1: Create WidgetsSection.tsx**

```typescript
import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useHabits } from '@/hooks/useHabits';
import { useWidgets } from '@/hooks/useWidgets';
import { HabitWidget } from './HabitWidget';
import { AddHabitModal } from './AddHabitModal';
import { AddWidgetMenu } from './AddWidgetMenu';

type HandleProps = Record<string, unknown>;

function GripHandle({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <span className="db-grip-handle" {...handleProps}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="8" cy="2" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="2" cy="12" r="1.5" />
        <circle cx="8" cy="12" r="1.5" />
      </svg>
    </span>
  );
}

export function WidgetsSection({ handleProps }: { handleProps?: HandleProps }) {
  const { habits, addHabit, updateHabit, removeHabit, toggleDay } = useHabits();
  const { widgets, addWidget, removeWidgetByRefId } = useWidgets();
  const [habitModalOpen, setHabitModalOpen] = useState(false);

  // Hide entirely when no widgets exist
  if (widgets.length === 0) return null;

  const habitMap = new Map(habits.map((h) => [h.id, h]));

  function handleAddHabit(name: string, color: string) {
    const habit = addHabit(name, color);
    addWidget('habit', habit.id);
  }

  function handleRemoveHabit(habitId: string) {
    removeHabit(habitId);
    removeWidgetByRefId(habitId);
  }

  return (
    <>
      <section>
        <div className="section-header">
          <span>
            <GripHandle handleProps={handleProps} />
            Widgets
          </span>
          <AddWidgetMenu onAddHabit={() => setHabitModalOpen(true)} />
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <AnimatePresence>
            {widgets.map((w) => {
              if (w.type === 'habit') {
                const habit = habitMap.get(w.refId);
                if (!habit) return null; // Orphaned widget — shouldn't happen but guard anyway
                return (
                  <HabitWidget
                    key={w.id}
                    habit={habit}
                    onToggleDay={(date) => toggleDay(habit.id, date)}
                    onUpdate={(patch) => updateHabit(habit.id, patch)}
                    onRemove={() => handleRemoveHabit(habit.id)}
                  />
                );
              }
              return null;
            })}
          </AnimatePresence>
        </div>
      </section>

      <AddHabitModal
        open={habitModalOpen}
        onOpenChange={setHabitModalOpen}
        onCreate={handleAddHabit}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/WidgetsSection.tsx
git commit -m "feat(widgets): add WidgetsSection with add/remove integration"
```

---

### Task 8: Empty-state entry point

**Files:**
- Modify: `src/components/widgets/WidgetsSection.tsx`

Problem: WidgetsSection hides when empty, but the user needs a way to add the first widget. Fix: always render the section header (with "+ Add widget"), but show a subtle "No widgets yet..." placeholder in the body when empty instead of widget cards.

- [ ] **Step 1: Refactor WidgetsSection to always show the header row**

Edit `src/components/widgets/WidgetsSection.tsx`. Replace the `if (widgets.length === 0) return null;` block and the full return with:

```typescript
  const hasWidgets = widgets.length > 0;
  const habitMap = new Map(habits.map((h) => [h.id, h]));

  function handleAddHabit(name: string, color: string) {
    const habit = addHabit(name, color);
    addWidget('habit', habit.id);
  }

  function handleRemoveHabit(habitId: string) {
    removeHabit(habitId);
    removeWidgetByRefId(habitId);
  }

  return (
    <>
      <section>
        <div className="section-header">
          <span>
            <GripHandle handleProps={handleProps} />
            Widgets
          </span>
          <AddWidgetMenu onAddHabit={() => setHabitModalOpen(true)} />
        </div>
        {hasWidgets ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <AnimatePresence>
              {widgets.map((w) => {
                if (w.type === 'habit') {
                  const habit = habitMap.get(w.refId);
                  if (!habit) return null;
                  return (
                    <HabitWidget
                      key={w.id}
                      habit={habit}
                      onToggleDay={(date) => toggleDay(habit.id, date)}
                      onUpdate={(patch) => updateHabit(habit.id, patch)}
                      onRemove={() => handleRemoveHabit(habit.id)}
                    />
                  );
                }
                return null;
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.25)',
              fontSize: '0.78rem',
              fontStyle: 'italic',
              padding: '4px 0',
            }}
          >
            No widgets yet. Click "+ Add widget" to get started.
          </div>
        )}
      </section>

      <AddHabitModal
        open={habitModalOpen}
        onOpenChange={setHabitModalOpen}
        onCreate={handleAddHabit}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/components/widgets/WidgetsSection.tsx
git commit -m "feat(widgets): always show section header so users can add first widget"
```

---

### Task 9: Wire WidgetsSection into HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

Add 'widgets' to SECTION_IDS and render WidgetsSection for that id.

- [ ] **Step 1: Edit HomePage.tsx**

Change the SECTION_IDS declaration (around line 52):

```typescript
// Before:
const SECTION_IDS = [
  'kategorier',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;

// After:
const SECTION_IDS = [
  'kategorier',
  'widgets',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;
```

Add the import near the top:

```typescript
import { WidgetsSection } from '@/components/widgets/WidgetsSection';
```

Modify `SortableHomeSection` to render WidgetsSection for id `'widgets'`. Find the function (around line 130) and add the case:

```typescript
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'db-section-dragging')}>
      {id === 'kategorier' && <KategorierSection handleProps={handleProps} />}
      {id === 'widgets' && <WidgetsSection handleProps={handleProps} />}
      {id === 'ext-lenker' && <EksterneLenkerSection handleProps={handleProps} />}
      {id === 'dagens-plan' && <DagensPlanSection handleProps={handleProps} />}
      {id === 'vaer' && <VaerSection handleProps={handleProps} />}
      {id === 'nyhetssaker' && <NyhetssakerSection handleProps={handleProps} />}
    </div>
  );
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-home-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-home-widgets
git add src/pages/HomePage.tsx
git commit -m "feat(home): wire WidgetsSection into HomePage section order"
```

---

### Task 10: Browser test

**Files:**
- Modify: any (fix issues found)

- [ ] **Step 1: Start dev server**

```bash
cd .worktrees/feat-home-widgets && npx vite --port 5176
```

- [ ] **Step 2: Manual test**

Navigate to `http://localhost:5176/`. Test:

1. **Widgets section appears** between Kategorier and Eksterne lenker with the grip handle and "+ Add widget" link.
2. **Empty state**: shows "No widgets yet..." italic text.
3. **Add first habit**: Click "+ Add widget" → Habit Tracker → type "Exercise" → pick green → Create.
4. **Widget appears** with spring animation. Shows color dot, name, 14px grid. Today has outline but is not completed.
5. **Click today's cell** → cell fills with color. Streak shows "🔥 1".
6. **Click a past day** (any empty cell) → toggles completed. No streak change unless adjacent.
7. **Add second habit**: "Reading", purple. Both widgets appear side by side, wrap if narrow.
8. **Hover widget** → three-dot menu button becomes visible.
9. **Click three-dot → Edit** → modal opens with current values → rename → Save.
10. **Click three-dot → Remove** → confirmation → Remove → widget animates out.
11. **Refresh page** → habits persist from localStorage.
12. **Drag the Widgets section** up/down to reorder (via grip handle).

- [ ] **Step 3: Fix any issues, commit**

```bash
cd .worktrees/feat-home-widgets
git add -A
git commit -m "fix(widgets): integration fixes from browser testing"
```

Skip if no fixes needed.
