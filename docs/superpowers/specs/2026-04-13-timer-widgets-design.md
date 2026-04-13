# Timer Widgets Design Spec

## Overview

Add three timer widgets to the home page (Countdown, Pomodoro, Stopwatch) that surface live state from `/tools/timer` and continue running regardless of which route the user is on. Widgets can be **auto-summoned** when a timer starts, or **manually added** for a persistent always-on surface. Clicking a widget opens a centered popup overlay that mirrors the full tools timer view — the user stays on the dashboard.

## Motivation

Right now the timer, pomodoro, and stopwatch state lives inside their mode components in `/tools/timer`. When the user leaves that page, the state unmounts and the timer stops. These widgets let timers run in the background and stay visible on the home dashboard.

## Architecture

### State Hoisting — Global Timer Context

The timing state moves from `CountdownMode.tsx`, `StopwatchMode.tsx`, `PomodoroMode.tsx` into a global context provider at app root so it survives route changes.

**New file:** `src/context/TimerContext.tsx`

```typescript
// Discriminated union by kind
type TimerInstance =
  | CountdownTimer
  | StopwatchTimer
  | PomodoroTimer;

interface BaseTimer {
  id: string;              // unique per instance
  kind: 'countdown' | 'stopwatch' | 'pomodoro';
  color: string;           // hex, user-picked or default per kind
  /** Whether the user manually added a widget for this timer (stays past zero). */
  persistent: boolean;
}

interface CountdownTimer extends BaseTimer {
  kind: 'countdown';
  totalMs: number;
  remainingMs: number;
  running: boolean;
  /** performance.now() when it last started running; null if paused. */
  startedAt: number | null;
  /** When remaining hit 0, the timestamp (Date.now()) for the "hide after 60s" rule. */
  zeroedAt: number | null;
}

interface StopwatchTimer extends BaseTimer {
  kind: 'stopwatch';
  elapsedMs: number;
  laps: number[];          // ms values
  running: boolean;
  startedAt: number | null;
  /** For reset detection (for the 60s-to-hide rule). */
  zeroedAt: number | null;
}

interface PomodoroTimer extends BaseTimer {
  kind: 'pomodoro';
  settings: { focusMin: number; pauseMin: number; targetCycles: number };
  phase: 'focus' | 'pause';
  cycle: number;           // sessions completed
  totalMs: number;
  remainingMs: number;
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
}
```

**Context value:**

```typescript
interface TimerContextValue {
  timers: TimerInstance[];              // always exactly three, one per kind

  // Getters (by kind since there's one of each)
  getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }>;

  // Persistence toggle — user manually adds/removes a timer as a persistent widget
  setPersistent(kind, persistent: boolean): void;
  setColor(kind, color: string): void;

  // Countdown
  setCountdownTime(ms: number): void;
  setCountdownRunning(running: boolean): void;
  resetCountdown(): void;

  // Stopwatch
  setStopwatchRunning(running: boolean): void;
  addStopwatchLap(): void;
  resetStopwatch(): void;

  // Pomodoro
  setPomodoroRunning(running: boolean): void;
  resetPomodoro(): void;
  updatePomodoroSettings(settings: { focusMin: number; pauseMin: number; targetCycles: number }): void;
}
```

All kind-specific methods take no `id` because there's exactly one timer per kind. The context bootstraps three default timers on mount if localStorage is empty.

**Ticker:** One `useEffect` in the provider schedules a 100ms interval that updates `remainingMs`/`elapsedMs` for all running timers. Matches the existing delta-tracking pattern (`performance.now()`).

**Persistence:** All timers serialized to `localStorage` key `home-timers-v1`. On mount, restore and correct `startedAt` based on elapsed wall-clock time since last save (so a 5-min countdown started before a reload still ticks correctly).

### Rewrite Tool Pages

`CountdownMode.tsx`, `StopwatchMode.tsx`, `PomodoroMode.tsx` become thin views that read/write via `useTimers()` from context. The `useCountdown`/`useStopwatch` hooks inside `src/hooks/useTimer.ts` go away — their state logic moves into `TimerContext`. The utility exports from that file (`formatHMS`, `formatStopwatch`, `parseTimeString`, `playAlarm`, `notify`) stay as-is and are used by both the context and the components.

`ToolTimerPage.tsx` keeps the same pill toggle and `AnimatePresence` between modes. Each mode renders the full-size ring for its kind, reading state from context.

The key insight: all views (`/tools/timer`, widget, popup overlay) render the same `TimerInstance` — they just differ in chrome.

### File Structure

```
src/context/
  TimerContext.tsx                  ~280 lines — state + reducer + ticker + localStorage persistence

src/components/widgets/
  timers/
    TimerWidget.tsx                 ~60 lines  — countdown widget (A1 linear bar)
    PomodoroWidget.tsx              ~70 lines  — pomodoro widget (B3 segmented bar)
    StopwatchWidget.tsx             ~45 lines  — stopwatch widget (C3 huge time)
    TimerPopup.tsx                  ~120 lines — popup overlay (full ring + controls, mirrors tools page)
    TimerSubtypePicker.tsx          ~70 lines  — stage-2 of add-widget dialog for timers (pick subtype + color)

  AddWidgetDialog.tsx               modify — add 'configure-timer' stage
  WidgetsSection.tsx                modify — register timer widget types, auto-remove 60s after zero

src/pages/tools/
  ToolTimerPage.tsx                 modify — pass timers from context instead of local state
  (CountdownMode/StopwatchMode/PomodoroMode are rewritten to read from context)
```

## Widget Designs

All three share: 164px width, dark card with faint color tint, header (icon + label), click to open popup. Right-click for context menu (Change color / Remove).

### Countdown Widget (A1 Linear bar)

```
┌──────────────────────┐
│ [⏱] Timer            │
│                      │
│       18:42          │   <- 28px monospace, centered
│                      │
│  ▬▬▬▬▬▬▬░░░░░░░░░░   │   <- thin 3px progress bar
└──────────────────────┘
```

- Accent: red `#ef4444` (default)
- Header: clock icon (lucide `Timer`) + "Timer" label
- Time: 28px, monospace, letter-spacing -1px, centered
- Progress bar: `remainingMs / totalMs` wide, 3px tall
- No "running" pill (the time updating signals it)

### Pomodoro Widget (B3 Segmented bar)

```
┌──────────────────────┐
│ FOCUS           2/4  │
│                      │
│       18:42          │
│                      │
│  ████░██░░░░ ░░░░    │   <- 4 segments, current one partially filled
└──────────────────────┘
```

- Accent: mint `#34d399` when focus, cyan `#06b6d4` when pause (swaps on phase change)
- Phase label: uppercase, accent color, weight 700
- Cycle counter "2/4" right-aligned
- 4 horizontal segments, 3px gap. Completed segments = accent solid, current = partially filled, future = dim track.

### Stopwatch Widget (C3 Huge time)

```
┌──────────────────────┐
│    STOPWATCH         │   <- uppercase label, cyan, letter-spacing 2px
│                      │
│     02:34.67         │   <- 26px monospace, .67 smaller + dimmer
└──────────────────────┘
```

- Accent: cyan `#22d3ee`
- Label at top, time below, nothing else
- Centisecond pair rendered smaller and dimmer inside the same line

## Widget Lifecycle

### Auto-summoned widgets

When a timer starts in `/tools/timer` (or in the popup), a widget auto-appears on the home page if one doesn't exist for that kind.

- Widget persists through pause (so the user can resume)
- Widget disappears **60 seconds after `zeroedAt`** — that is, 60s after the countdown hits 0 or the stopwatch/pomodoro is reset
- The 60s timer is a `setTimeout` per widget, cleared on resume/restart
- `zeroedAt` resets to `null` on restart (so the clock starts over)

### Manually added widgets

User clicks "+" → stage 1 picks widget type (existing grid) → **new stage** for Timer: pick subtype (Countdown / Pomodoro / Stopwatch) → pick color (7 preset palette, existing) → widget created with `persistent: true`.

- Persistent widgets **ignore the 60s-to-hide rule** — they stay forever
- Only removed via right-click → Remove

### Relationship between widgets and the `/tools/timer` page

The tool page now renders the timers from context. There's always at least one of each kind accessible via the pill toggle. Widgets and the tool page share the same underlying timer — starting in one updates both.

**Design decision:** if a manually-added persistent timer exists, the tool page shows that one (so the user can control their "own" timer). Otherwise the tool page uses the default auto-summoned timer (created on demand).

For simplicity this iteration: **one countdown timer, one stopwatch, one pomodoro exist at all times**. Users can't have multiple independent countdowns as widgets. "Manually add" just means marking the existing timer of that kind as `persistent: true` and giving it a color.

### Right-click → Remove behavior

- On a **persistent** widget: clears `persistent: true` → falls back to the 60s-to-hide rule (removes immediately if timer is at zero, otherwise waits)
- On an **auto-summoned** widget: hides the widget immediately without stopping the timer. The timer keeps running and will re-summon a widget if it's still ticking — so effectively the user dismisses for now. If the user wants the timer to stop, they use the pause/reset controls.

The underlying timer is never destroyed by Remove — only by the Reset control (which zeros it and starts the 60s fade). This keeps the mental model "timer state is persistent and shared; widgets are just views".

## Click-to-open Popup

Clicking a widget opens a Radix Dialog overlay. The user stays on `/`.

**Backdrop:**
- `rgba(0, 0, 0, 0.6)` with `backdrop-filter: blur(6px)`
- Click to close

**Modal:**
- Centered, max-width ~320px, padding 24px
- Border + subtle glow in the timer's accent color
- Close button (X) top-right
- Content: mirrors the tool page view for that kind, but with a smaller ring

The existing `TimerRing` component gains an optional `size` prop (default 300 for the tool page, 160 for the popup). Cell sizes, stroke width, glow intensity scale proportionally.

Popup content:
  - `TimerRing` at 160px
  - Editable time (click to edit, for countdown + pomodoro) — reuses the existing inline editor
  - Circular play/pause + reset buttons — reuses existing `TimerControls` variants
  - For pomodoro: segmented ring + phase label + 3 inline settings fields
  - For stopwatch: lap button + animated lap list below

**Transitions:**
- Opens with framer-motion spring (scale 0.95 → 1, opacity 0 → 1)
- Closes with reverse
- Duration ~250ms

## Add Widget Flow Changes

Current flow:
1. Click "+" → pick widget type → (for habit) configure name+color → create

New flow: four tiles at stage 1 — Habit, Countdown, Pomodoro, Stopwatch (flatten the subtypes as top-level tiles, no intermediate Timer category).

1. Click "+" → pick tile (4 enabled, rest "soon")
2. Next stage:
   - **Habit** → existing name+color form → create
   - **Countdown / Pomodoro / Stopwatch** → color palette only (no name field) → create

The existing `AddWidgetDialog` gets a new `stage: 'configure-timer'` with just the 7-color palette + a Create button. The user's color choice calls `setColor(kind, color)` then `setPersistent(kind, true)`.

If a timer of that kind is already persistent, the tile shows as disabled ("already added") with a hint to use the existing one.

## Persistence

`home-timers-v1`: `TimerInstance[]` serialized. Loaded on provider mount. Saved on any state change (debounced 200ms to avoid thrashing localStorage during active countdowns).

`home-widgets-v1` widgets referencing timers use the timer's `id` as `refId` (same as habits). This is how WidgetsSection knows which widgets to render and in what order.

## Migration

Existing pomodoro settings (`tool-pomodoro-settings-v2`) are read once on first mount to seed the pomodoro timer's defaults. No need to preserve on subsequent loads — the new persistence covers it.

## Out of Scope

- No multiple simultaneous countdowns (one per kind)
- No custom timer names (always "Timer" / "Pomodoro" / "Stopwatch")
- No stats/history tracking across timers
- No widget for alarm scheduling
- No sync across devices
