# Timer Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add countdown/pomodoro/stopwatch widgets to the home page that share state with `/tools/timer`, persist across route changes, auto-appear when timers start, auto-hide 60s after reaching zero (unless user manually persists them), and open a popup overlay on click.

**Architecture:** Global `TimerContext` at app root hoists all timing state out of mode components. There's always exactly one timer per kind. The tool page, widgets, and popup overlay are three views of the same `TimerInstance`. Widget visibility is driven by timer state (running/paused/zeroedAt + persistent flag).

**Tech Stack:** React 18 + Context, TypeScript, framer-motion, Radix Dialog, lucide-react icons, localStorage

**Worktree:** `.worktrees/feat-timer-widgets`

---

### Task 1: Create TimerContext — types and initial state

**Files:**
- Create: `src/context/TimerContext.tsx`

This task sets up the types, provider skeleton, and persistence. No ticker yet — that's Task 2.

- [ ] **Step 1: Create TimerContext.tsx with types, reducer, and provider**

```typescript
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

/* ── Types ──────────────────────────────────────────────────────────── */

export interface BaseTimer {
  id: string;
  kind: 'countdown' | 'stopwatch' | 'pomodoro';
  color: string;
  /** User manually added a widget for this timer — stays past zero. */
  persistent: boolean;
}

export interface CountdownTimer extends BaseTimer {
  kind: 'countdown';
  totalMs: number;
  remainingMs: number;
  running: boolean;
  /** performance.now() when the current run started; null if paused. */
  startedAt: number | null;
  /** Date.now() when remainingMs first hit 0. Used for the 60s-to-hide rule. */
  zeroedAt: number | null;
}

export interface StopwatchTimer extends BaseTimer {
  kind: 'stopwatch';
  elapsedMs: number;
  laps: number[];
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
}

export interface PomodoroSettings {
  focusMin: number;
  pauseMin: number;
  targetCycles: number;
}

export interface PomodoroTimer extends BaseTimer {
  kind: 'pomodoro';
  settings: PomodoroSettings;
  phase: 'focus' | 'pause';
  cycle: number;
  totalMs: number;
  remainingMs: number;
  running: boolean;
  startedAt: number | null;
  zeroedAt: number | null;
}

export type TimerInstance = CountdownTimer | StopwatchTimer | PomodoroTimer;

/* ── Defaults ───────────────────────────────────────────────────────── */

const DEFAULT_POMODORO: PomodoroSettings = { focusMin: 25, pauseMin: 5, targetCycles: 4 };

function makeDefaults(): TimerInstance[] {
  return [
    {
      id: 'countdown', kind: 'countdown', color: '#ef4444', persistent: false,
      totalMs: 5 * 60_000, remainingMs: 5 * 60_000, running: false, startedAt: null, zeroedAt: null,
    },
    {
      id: 'stopwatch', kind: 'stopwatch', color: '#22d3ee', persistent: false,
      elapsedMs: 0, laps: [], running: false, startedAt: null, zeroedAt: null,
    },
    {
      id: 'pomodoro', kind: 'pomodoro', color: '#34d399', persistent: false,
      settings: { ...DEFAULT_POMODORO },
      phase: 'focus', cycle: 0,
      totalMs: DEFAULT_POMODORO.focusMin * 60_000, remainingMs: DEFAULT_POMODORO.focusMin * 60_000,
      running: false, startedAt: null, zeroedAt: null,
    },
  ];
}

/* ── Actions ────────────────────────────────────────────────────────── */

type Action =
  | { type: 'load'; timers: TimerInstance[] }
  | { type: 'setPersistent'; kind: TimerInstance['kind']; persistent: boolean }
  | { type: 'setColor'; kind: TimerInstance['kind']; color: string }
  | { type: 'countdown/setTime'; ms: number }
  | { type: 'countdown/setRunning'; running: boolean; now: number }
  | { type: 'countdown/tick'; delta: number; now: number }
  | { type: 'countdown/reset'; now: number }
  | { type: 'stopwatch/setRunning'; running: boolean; now: number }
  | { type: 'stopwatch/tick'; delta: number }
  | { type: 'stopwatch/addLap' }
  | { type: 'stopwatch/reset'; now: number }
  | { type: 'pomodoro/setRunning'; running: boolean; now: number }
  | { type: 'pomodoro/tick'; delta: number; now: number }
  | { type: 'pomodoro/reset'; now: number }
  | { type: 'pomodoro/advancePhase'; now: number }
  | { type: 'pomodoro/updateSettings'; settings: PomodoroSettings };

function reducer(state: TimerInstance[], action: Action): TimerInstance[] {
  return state.map((t) => applyAction(t, action));
}

function applyAction(t: TimerInstance, a: Action): TimerInstance {
  if (a.type === 'load') return a.timers.find((nt) => nt.kind === t.kind) ?? t;
  if (a.type === 'setPersistent' && a.kind === t.kind) return { ...t, persistent: a.persistent };
  if (a.type === 'setColor' && a.kind === t.kind) return { ...t, color: a.color };

  if (t.kind === 'countdown') return reduceCountdown(t, a);
  if (t.kind === 'stopwatch') return reduceStopwatch(t, a);
  if (t.kind === 'pomodoro') return reducePomodoro(t, a);
  return t;
}

function reduceCountdown(t: CountdownTimer, a: Action): CountdownTimer {
  switch (a.type) {
    case 'countdown/setTime':
      return { ...t, totalMs: a.ms, remainingMs: a.ms, zeroedAt: null };
    case 'countdown/setRunning':
      if (a.running && t.remainingMs === 0) return t; // can't start from zero
      return { ...t, running: a.running, startedAt: a.running ? a.now : null };
    case 'countdown/tick': {
      if (!t.running) return t;
      const next = Math.max(0, t.remainingMs - a.delta);
      const zeroedAt = next === 0 && t.zeroedAt === null ? Date.now() : t.zeroedAt;
      const running = next === 0 ? false : t.running;
      return { ...t, remainingMs: next, running, zeroedAt, startedAt: running ? t.startedAt : null };
    }
    case 'countdown/reset':
      return { ...t, remainingMs: t.totalMs, running: false, startedAt: null, zeroedAt: Date.now() };
    default:
      return t;
  }
}

function reduceStopwatch(t: StopwatchTimer, a: Action): StopwatchTimer {
  switch (a.type) {
    case 'stopwatch/setRunning':
      return { ...t, running: a.running, startedAt: a.running ? a.now : null, zeroedAt: null };
    case 'stopwatch/tick':
      if (!t.running) return t;
      return { ...t, elapsedMs: t.elapsedMs + a.delta };
    case 'stopwatch/addLap':
      return { ...t, laps: [t.elapsedMs, ...t.laps] };
    case 'stopwatch/reset':
      return { ...t, elapsedMs: 0, laps: [], running: false, startedAt: null, zeroedAt: Date.now() };
    default:
      return t;
  }
}

function reducePomodoro(t: PomodoroTimer, a: Action): PomodoroTimer {
  switch (a.type) {
    case 'pomodoro/setRunning':
      return { ...t, running: a.running, startedAt: a.running ? a.now : null };
    case 'pomodoro/tick': {
      if (!t.running) return t;
      const next = Math.max(0, t.remainingMs - a.delta);
      if (next > 0) return { ...t, remainingMs: next };
      // Phase end — mark zeroedAt and stop; ticker dispatches advancePhase next
      return { ...t, remainingMs: 0, running: false, startedAt: null, zeroedAt: t.zeroedAt ?? Date.now() };
    }
    case 'pomodoro/advancePhase': {
      if (t.phase === 'focus') {
        const nextCycle = t.cycle + 1;
        if (nextCycle >= t.settings.targetCycles) {
          // All sessions done — full reset
          return {
            ...t, phase: 'focus', cycle: 0,
            totalMs: t.settings.focusMin * 60_000,
            remainingMs: t.settings.focusMin * 60_000,
            running: false, startedAt: null, zeroedAt: Date.now(),
          };
        }
        return {
          ...t, phase: 'pause', cycle: nextCycle,
          totalMs: t.settings.pauseMin * 60_000,
          remainingMs: t.settings.pauseMin * 60_000,
          running: true, startedAt: a.now, zeroedAt: null,
        };
      } else {
        return {
          ...t, phase: 'focus',
          totalMs: t.settings.focusMin * 60_000,
          remainingMs: t.settings.focusMin * 60_000,
          running: true, startedAt: a.now, zeroedAt: null,
        };
      }
    }
    case 'pomodoro/reset':
      return {
        ...t, phase: 'focus', cycle: 0,
        totalMs: t.settings.focusMin * 60_000,
        remainingMs: t.settings.focusMin * 60_000,
        running: false, startedAt: null, zeroedAt: Date.now(),
      };
    case 'pomodoro/updateSettings': {
      // Reset remaining if we're idle; keep if running
      const baseMs = (t.phase === 'focus' ? a.settings.focusMin : a.settings.pauseMin) * 60_000;
      const shouldReset = !t.running;
      return {
        ...t, settings: a.settings,
        totalMs: shouldReset ? baseMs : t.totalMs,
        remainingMs: shouldReset ? baseMs : t.remainingMs,
      };
    }
    default:
      return t;
  }
}

/* ── Context ────────────────────────────────────────────────────────── */

export interface TimerContextValue {
  timers: TimerInstance[];
  getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }>;

  setPersistent(kind: TimerInstance['kind'], persistent: boolean): void;
  setColor(kind: TimerInstance['kind'], color: string): void;

  setCountdownTime(ms: number): void;
  setCountdownRunning(running: boolean): void;
  resetCountdown(): void;

  setStopwatchRunning(running: boolean): void;
  addStopwatchLap(): void;
  resetStopwatch(): void;

  setPomodoroRunning(running: boolean): void;
  resetPomodoro(): void;
  updatePomodoroSettings(settings: PomodoroSettings): void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY = 'home-timers-v1';

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return makeDefaults();
      const parsed = JSON.parse(raw) as TimerInstance[];
      // Force everything back to "paused" on boot — we don't try to
      // continue ticking across page reload. Start fresh but keep
      // totals, settings, laps.
      return parsed.map((t) => ({ ...t, running: false, startedAt: null }));
    } catch {
      return makeDefaults();
    }
  });

  // Persist any change (debounced 200ms so active ticks don't thrash storage)
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(timers)); } catch { /* quota — ignore */ }
    }, 200);
    return () => window.clearTimeout(saveTimeoutRef.current);
  }, [timers]);

  // Helpers
  function getTimer<K extends TimerInstance['kind']>(kind: K): Extract<TimerInstance, { kind: K }> {
    return timers.find((t) => t.kind === kind) as Extract<TimerInstance, { kind: K }>;
  }

  const value: TimerContextValue = {
    timers,
    getTimer,
    setPersistent: (kind, persistent) => dispatch({ type: 'setPersistent', kind, persistent }),
    setColor: (kind, color) => dispatch({ type: 'setColor', kind, color }),
    setCountdownTime: (ms) => dispatch({ type: 'countdown/setTime', ms }),
    setCountdownRunning: (running) => dispatch({ type: 'countdown/setRunning', running, now: performance.now() }),
    resetCountdown: () => dispatch({ type: 'countdown/reset', now: performance.now() }),
    setStopwatchRunning: (running) => dispatch({ type: 'stopwatch/setRunning', running, now: performance.now() }),
    addStopwatchLap: () => dispatch({ type: 'stopwatch/addLap' }),
    resetStopwatch: () => dispatch({ type: 'stopwatch/reset', now: performance.now() }),
    setPomodoroRunning: (running) => dispatch({ type: 'pomodoro/setRunning', running, now: performance.now() }),
    resetPomodoro: () => dispatch({ type: 'pomodoro/reset', now: performance.now() }),
    updatePomodoroSettings: (settings) => dispatch({ type: 'pomodoro/updateSettings', settings }),
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimers(): TimerContextValue {
  const v = useContext(TimerContext);
  if (!v) throw new Error('useTimers must be used within <TimerProvider>');
  return v;
}

```

- [ ] **Step 2: Verify it compiles**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```
Expected: Build succeeds (file is unused so far).

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/context/TimerContext.tsx
git commit -m "feat(timer): add TimerContext with three timer kinds, reducer, and localStorage"
```

---

### Task 2: Add ticker + alarms + phase-advance effects

**Files:**
- Modify: `src/context/TimerContext.tsx`

Now we wire up the 100ms ticker, the pomodoro auto-advance, and alarm triggering. Keep it all inside TimerProvider.

- [ ] **Step 1: Add the ticker and side-effect useEffect hooks inside TimerProvider**

In `TimerContext.tsx`, just before `return <TimerContext.Provider...`, add:

```typescript
  // ── Ticker: 100ms interval, decrements running countdown/pomodoro, increments stopwatch ──
  const lastTickRef = useRef(performance.now());
  useEffect(() => {
    const anyRunning = timers.some((t) => t.running);
    if (!anyRunning) { lastTickRef.current = performance.now(); return; }
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      // Dispatch per-kind ticks
      for (const t of timers) {
        if (!t.running) continue;
        if (t.kind === 'countdown') dispatch({ type: 'countdown/tick', delta, now });
        else if (t.kind === 'stopwatch') dispatch({ type: 'stopwatch/tick', delta });
        else if (t.kind === 'pomodoro') dispatch({ type: 'pomodoro/tick', delta, now });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [timers]);

  // ── Alarms and pomodoro phase advance ──
  const prevRef = useRef(timers);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = timers;

    for (const t of timers) {
      const p = prev.find((pp) => pp.id === t.id);
      if (!p) continue;

      // Countdown hit zero this tick
      if (t.kind === 'countdown' && p.kind === 'countdown') {
        if (p.remainingMs > 0 && t.remainingMs === 0) {
          playAlarm();
          notify('Timer ferdig', 'Nedtelling er over.');
        }
      }

      // Pomodoro phase end
      if (t.kind === 'pomodoro' && p.kind === 'pomodoro') {
        if (p.remainingMs > 0 && t.remainingMs === 0) {
          playAlarm();
          const nextIsPause = t.phase === 'focus';
          const nextCycle = t.phase === 'focus' ? t.cycle + 1 : t.cycle;
          if (nextIsPause && nextCycle >= t.settings.targetCycles) {
            notify('Pomodoro ferdig', `${t.settings.targetCycles} økter fullført.`);
          } else if (nextIsPause) {
            notify('Fokus ferdig', 'Pause starter.');
          } else {
            notify('Pause over', 'Tilbake til fokus.');
          }
          dispatch({ type: 'pomodoro/advancePhase', now: performance.now() });
        }
      }
    }
  }, [timers]);
```

At the top of the file, import the alarm helpers:

```typescript
import { playAlarm, notify } from '@/hooks/useTimer';
```

- [ ] **Step 2: Build**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/context/TimerContext.tsx
git commit -m "feat(timer): wire up ticker, alarms, and pomodoro phase auto-advance in context"
```

---

### Task 3: Wire TimerProvider into App root

**Files:**
- Modify: `src/App.tsx` (or wherever the root JSX is)

- [ ] **Step 1: Find the app root file**

```bash
cd .worktrees/feat-timer-widgets && ls src/App.tsx src/main.tsx 2>/dev/null
```

- [ ] **Step 2: Add the provider**

Read `src/App.tsx`. Wrap the main routes tree with `<TimerProvider>`. Example diff:

```typescript
import { TimerProvider } from '@/context/TimerContext';

// ...inside the root component, wrapping the router or <Routes> block:
<TimerProvider>
  {/* existing routes */}
</TimerProvider>
```

- [ ] **Step 3: Build**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/App.tsx
git commit -m "feat(timer): mount TimerProvider at app root"
```

---

### Task 4: Rewrite CountdownMode to use context

**Files:**
- Modify: `src/components/timer/CountdownMode.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { useTimers } from '@/context/TimerContext';
import { TimerRing } from './TimerRing';
import { CountdownControls, EditableTime } from './TimerControls';

export function CountdownMode() {
  const ctx = useTimers();
  const t = ctx.getTimer('countdown');
  const progress = t.totalMs > 0 ? t.remainingMs / t.totalMs : 0;
  const finished = t.remainingMs === 0;

  return (
    <div className="tt-mode-body">
      <TimerRing progress={progress} color={t.color} running={t.running}>
        {finished && <div className="tt-ring-label" style={{ color: t.color }}>FERDIG</div>}
        <EditableTime
          ms={t.remainingMs}
          color={t.color}
          onChange={ctx.setCountdownTime}
          disabled={t.running}
        />
      </TimerRing>
      <CountdownControls
        running={t.running}
        finished={finished}
        color={t.color}
        onToggle={() => ctx.setCountdownRunning(!t.running)}
        onReset={ctx.resetCountdown}
      />
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

```bash
cd .worktrees/feat-timer-widgets && npx vite --port 5181
```

Open `/tools/timer`, click Timer pill. Set time, hit play, verify countdown ticks; pause, reset, alarm at zero. Leave the page and come back — state should be preserved as paused (we don't auto-resume on navigation).

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/timer/CountdownMode.tsx
git commit -m "feat(timer): wire CountdownMode to TimerContext"
```

---

### Task 5: Rewrite StopwatchMode to use context

**Files:**
- Modify: `src/components/timer/StopwatchMode.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/context/TimerContext';
import { formatStopwatch } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { StopwatchControls } from './TimerControls';

export function StopwatchMode() {
  const ctx = useTimers();
  const sw = ctx.getTimer('stopwatch');

  return (
    <div className="tt-mode-body">
      <TimerRing progress={1} color={sw.color} running={sw.running}>
        <div className="tt-ring-label" style={{ color: sw.color }}>STOPWATCH</div>
        <div className="tt-ring-text">{formatStopwatch(sw.elapsedMs)}</div>
      </TimerRing>
      <StopwatchControls
        running={sw.running}
        elapsedMs={sw.elapsedMs}
        lapsCount={sw.laps.length}
        color={sw.color}
        onToggle={() => ctx.setStopwatchRunning(!sw.running)}
        onLap={ctx.addStopwatchLap}
        onReset={ctx.resetStopwatch}
      />
      {sw.laps.length > 0 && (
        <div className="tt-lap-list">
          <AnimatePresence initial={false}>
            {sw.laps.map((lap, i) => {
              const lapIndex = sw.laps.length - i;
              const prev = sw.laps[i + 1] ?? 0;
              const diff = lap - prev;
              return (
                <motion.div
                  key={lapIndex}
                  className="tt-lap-row"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={i === 0 ? { borderColor: `${sw.color}30` } : undefined}
                >
                  <span className="tt-lap-num">#{String(lapIndex).padStart(2, '0')}</span>
                  <span className="tt-lap-diff">+{formatStopwatch(diff)}</span>
                  <span className="tt-lap-time">{formatStopwatch(lap)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Browser test (same server as Task 4 if still running)**

Start stopwatch from `/tools/timer`, leave the page, come back → timer should keep its elapsed value (paused across nav, not continuing to tick — that's expected for now since we reset `running: false` on mount).

Actually, re-reading: we want it to KEEP running when user navigates away. Currently `TimerProvider` mounts once (at app root), so navigation doesn't unmount it. The ticker stays active. Only a full page reload forces pause. Verify this is the behavior.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/timer/StopwatchMode.tsx
git commit -m "feat(timer): wire StopwatchMode to TimerContext"
```

---

### Task 6: Rewrite PomodoroMode to use context

**Files:**
- Modify: `src/components/timer/PomodoroMode.tsx`

- [ ] **Step 1: Replace the file**

```typescript
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/context/TimerContext';
import { TimerRing } from './TimerRing';
import { PomodoroControls, EditableTime } from './TimerControls';

const LABELS = { focus: 'FOKUS', pause: 'PAUSE' } as const;

export function PomodoroMode() {
  const ctx = useTimers();
  const p = ctx.getTimer('pomodoro');
  const progress = p.totalMs > 0 ? p.remainingMs / p.totalMs : 0;

  function handleEditTime(ms: number) {
    // Editing time while in focus phase updates focusMin; in pause updates pauseMin.
    const minutes = Math.max(1, Math.round(ms / 60_000));
    const next = p.phase === 'focus'
      ? { ...p.settings, focusMin: minutes }
      : { ...p.settings, pauseMin: minutes };
    ctx.updatePomodoroSettings(next);
  }

  return (
    <div className="tt-mode-body">
      <TimerRing
        progress={progress}
        color={p.color}
        running={p.running}
        segments={{
          total: p.settings.targetCycles,
          completed: p.cycle,
          currentProgress: progress,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={p.phase}
            className="tt-ring-label"
            style={{ color: p.color }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.3 }}
          >
            {LABELS[p.phase]} {p.cycle + (p.phase === 'focus' ? 1 : 0)}/{p.settings.targetCycles}
          </motion.div>
        </AnimatePresence>
        <EditableTime ms={p.remainingMs} color={p.color} onChange={handleEditTime} disabled={p.running} />
      </TimerRing>
      <PomodoroControls
        running={p.running}
        color={p.color}
        onToggle={() => ctx.setPomodoroRunning(!p.running)}
        onReset={ctx.resetPomodoro}
      />
      <div className="tt-pomo-inline">
        <InlineField label="Focus" value={p.settings.focusMin} suffix="min"
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, focusMin: v })} />
        <InlineField label="Break" value={p.settings.pauseMin} suffix="min"
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, pauseMin: v })} />
        <InlineField label="Sessions" value={p.settings.targetCycles}
          onChange={(v) => ctx.updatePomodoroSettings({ ...p.settings, targetCycles: v })} />
      </div>
    </div>
  );
}

function InlineField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  function commit() {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 1) onChange(n);
    setEditing(false);
  }
  if (editing) {
    return (
      <div className="tt-inline-field">
        <div className="tt-inline-label">{label}</div>
        <input className="tt-inline-input" value={draft} onChange={(e) => setDraft(e.target.value)}
          onBlur={commit} onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }} autoFocus inputMode="numeric" style={{ width: '40px' }} />
      </div>
    );
  }
  return (
    <div className="tt-inline-field">
      <div className="tt-inline-label">{label}</div>
      <button className="tt-inline-value" onClick={() => { setDraft(String(value)); setEditing(true); }}>
        {value}{suffix && <span className="tt-inline-suffix">{suffix}</span>}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Browser test**

Test pomodoro — start focus, let it tick, pause, reset. Phase advance is tested in Task 10.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/timer/PomodoroMode.tsx
git commit -m "feat(timer): wire PomodoroMode to TimerContext"
```

---

### Task 7: Add `size` prop to TimerRing

**Files:**
- Modify: `src/components/timer/TimerRing.tsx`

- [ ] **Step 1: Read the file**

Locate the constants defining `VIEWBOX`, `CX`, `CY`, `R`, `STROKE_WIDTH` near the top of `TimerRing.tsx`.

- [ ] **Step 2: Make them derived from a `size` prop (default 300)**

Replace the constant block and the signature. Keep existing visual behavior at size=300:

```typescript
interface TimerRingProps {
  progress: number;
  color: string;
  children: React.ReactNode;
  segments?: { total: number; completed: number; currentProgress: number };
  running?: boolean;
  /** Outer diameter in px. Default 300 (tool page). 160 is the popup size. */
  size?: number;
}

export function TimerRing({ progress, color, children, segments, running, size = 300 }: TimerRingProps) {
  const VIEWBOX = size;
  const CX = size / 2;
  const CY = size / 2;
  const R = (size / 2) - 20; // 20px inset so the stroke doesn't clip
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const STROKE_WIDTH = Math.max(4, Math.round(size / 37.5)); // 8px at 300, ~4px at 160

  // ...rest of the component unchanged, but use these local constants instead of top-level ones
}
```

Ensure the wrapper div also respects the size:

```typescript
<div className="tt-ring-wrap" style={{ width: size, height: size }}>
```

The existing `.tt-ring-wrap` CSS may have a fixed size — if so, override it via the inline style.

- [ ] **Step 3: Build and manually verify the tool page still looks identical at default size**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

Open `/tools/timer` — countdown/stopwatch/pomodoro rings should all look unchanged.

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/timer/TimerRing.tsx
git commit -m "feat(timer): add size prop to TimerRing for popup reuse"
```

---

### Task 8: Create CountdownWidget (A1 linear bar)

**Files:**
- Create: `src/components/widgets/timers/CountdownWidget.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTimers, type CountdownTimer } from '@/context/TimerContext';
import { formatHMS } from '@/hooks/useTimer';

interface CountdownWidgetProps {
  timer: CountdownTimer;
  onClick: () => void;
}

export function CountdownWidget({ timer, onClick }: CountdownWidgetProps) {
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  const tint = hexWithAlpha(timer.color, 0.015);
  const border = hexWithAlpha(timer.color, 0.15);

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      style={{
        background: tint,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '12px 10px',
        width: 164,
        boxSizing: 'border-box',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Timer size={12} color={timer.color} />
        <span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.78rem', fontWeight: 700 }}>
          Timer
        </span>
      </div>
      <div style={{ textAlign: 'center', padding: '6px 0' }}>
        <div style={{ color: '#fff', fontSize: '1.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
          {formatHMS(timer.remainingMs / 1000)}
        </div>
      </div>
      <div style={{ marginTop: 8, height: 3, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 2 }}>
        <div style={{ width: `${progress * 100}%`, height: '100%', background: timer.color, borderRadius: 2 }} />
      </div>
    </motion.button>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Build**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/widgets/timers/CountdownWidget.tsx
git commit -m "feat(widgets): add CountdownWidget"
```

---

### Task 9: Create PomodoroWidget (B3 segmented bar)

**Files:**
- Create: `src/components/widgets/timers/PomodoroWidget.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { motion } from 'framer-motion';
import { useTimers, type PomodoroTimer } from '@/context/TimerContext';
import { formatHMS } from '@/hooks/useTimer';

interface PomodoroWidgetProps {
  timer: PomodoroTimer;
  onClick: () => void;
}

const LABELS = { focus: 'FOCUS', pause: 'BREAK' } as const;

export function PomodoroWidget({ timer, onClick }: PomodoroWidgetProps) {
  const color = timer.phase === 'pause' ? '#06b6d4' : timer.color;
  const tint = hexWithAlpha(color, 0.015);
  const border = hexWithAlpha(color, 0.15);
  const segProgress = timer.totalMs > 0 ? 1 - (timer.remainingMs / timer.totalMs) : 0;
  const total = timer.settings.targetCycles;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      style={{
        background: tint,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '12px 10px',
        width: 164,
        boxSizing: 'border-box',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 700 }}>
          {LABELS[timer.phase]}
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.65rem', marginLeft: 'auto' }}>
          {timer.cycle + (timer.phase === 'focus' ? 1 : 0)}/{total}
        </span>
      </div>
      <div style={{ textAlign: 'center', padding: '2px 0' }}>
        <div style={{ color: '#fff', fontSize: '1.65rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
          {formatHMS(timer.remainingMs / 1000)}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
        {Array.from({ length: total }, (_, i) => {
          let fill = 0;
          if (i < timer.cycle) fill = 1;
          else if (i === timer.cycle && timer.phase === 'focus') fill = segProgress;
          return (
            <div key={i} style={{ flex: 1, height: 3, background: 'rgba(255, 255, 255, 0.04)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${fill * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
            </div>
          );
        })}
      </div>
    </motion.button>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Build & commit**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
git add src/components/widgets/timers/PomodoroWidget.tsx
git commit -m "feat(widgets): add PomodoroWidget"
```

---

### Task 10: Create StopwatchWidget (C3 huge time)

**Files:**
- Create: `src/components/widgets/timers/StopwatchWidget.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { motion } from 'framer-motion';
import { type StopwatchTimer } from '@/context/TimerContext';
import { formatStopwatch } from '@/hooks/useTimer';

interface StopwatchWidgetProps {
  timer: StopwatchTimer;
  onClick: () => void;
}

export function StopwatchWidget({ timer, onClick }: StopwatchWidgetProps) {
  const tint = hexWithAlpha(timer.color, 0.015);
  const border = hexWithAlpha(timer.color, 0.15);
  const formatted = formatStopwatch(timer.elapsedMs); // "M:SS.cs" or "H:MM:SS.cs"
  // Split centiseconds for smaller/dimmer rendering
  const dotIdx = formatted.lastIndexOf('.');
  const main = dotIdx >= 0 ? formatted.slice(0, dotIdx) : formatted;
  const cs = dotIdx >= 0 ? formatted.slice(dotIdx) : '';

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      style={{
        background: tint,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: '14px 12px',
        width: 164,
        boxSizing: 'border-box',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.018), 0 1px 2px rgba(0, 0, 0, 0.4)',
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      <div style={{ color: hexWithAlpha(timer.color, 0.7), fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: 2 }}>
        Stopwatch
      </div>
      <div style={{ color: '#fff', fontSize: '1.55rem', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-1px' }}>
        {main}<span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '1.1rem' }}>{cs}</span>
      </div>
    </motion.button>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Build & commit**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
git add src/components/widgets/timers/StopwatchWidget.tsx
git commit -m "feat(widgets): add StopwatchWidget"
```

---

### Task 11: Create TimerPopup overlay

**Files:**
- Create: `src/components/widgets/timers/TimerPopup.tsx`

The popup reuses the same components the tool page uses, just at a smaller size.

- [ ] **Step 1: Create the file**

```typescript
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTimers, type TimerInstance } from '@/context/TimerContext';
import { TimerRing } from '@/components/timer/TimerRing';
import { CountdownControls, StopwatchControls, PomodoroControls, EditableTime } from '@/components/timer/TimerControls';
import { formatStopwatch } from '@/hooks/useTimer';

interface TimerPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: TimerInstance['kind'];
}

const LABELS = { focus: 'FOKUS', pause: 'PAUSE' } as const;

export function TimerPopup({ open, onOpenChange, kind }: TimerPopupProps) {
  const ctx = useTimers();
  const timer = ctx.getTimer(kind);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
          }}
        />
        <Dialog.Content
          asChild
          onPointerDownOutside={(e) => {
            // Allow backdrop click to close (default behavior)
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#0a0a0a',
              border: `1px solid ${hexWithAlpha(timer.color, 0.15)}`,
              borderRadius: 20,
              padding: 24,
              width: 320,
              zIndex: 101,
              boxShadow: `0 24px 60px rgba(0, 0, 0, 0.8), 0 0 32px ${hexWithAlpha(timer.color, 0.1)}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Dialog.Title style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, margin: 0 }}>
                {kind === 'countdown' ? 'Timer' : kind === 'stopwatch' ? 'Stopwatch' : 'Pomodoro'}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close" style={{ background: 'none', border: 'none', padding: 2, color: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <div className="tt-mode-body">
              {kind === 'countdown' && <CountdownBody timer={timer as any} ctx={ctx} />}
              {kind === 'stopwatch' && <StopwatchBody timer={timer as any} ctx={ctx} />}
              {kind === 'pomodoro' && <PomodoroBody timer={timer as any} ctx={ctx} />}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CountdownBody({ timer, ctx }: any) {
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  const finished = timer.remainingMs === 0;
  return (
    <>
      <TimerRing progress={progress} color={timer.color} running={timer.running} size={160}>
        {finished && <div className="tt-ring-label" style={{ color: timer.color }}>FERDIG</div>}
        <EditableTime ms={timer.remainingMs} color={timer.color} onChange={ctx.setCountdownTime} disabled={timer.running} />
      </TimerRing>
      <CountdownControls running={timer.running} finished={finished} color={timer.color}
        onToggle={() => ctx.setCountdownRunning(!timer.running)} onReset={ctx.resetCountdown} />
    </>
  );
}

function StopwatchBody({ timer, ctx }: any) {
  return (
    <>
      <TimerRing progress={1} color={timer.color} running={timer.running} size={160}>
        <div className="tt-ring-label" style={{ color: timer.color }}>STOPWATCH</div>
        <div className="tt-ring-text">{formatStopwatch(timer.elapsedMs)}</div>
      </TimerRing>
      <StopwatchControls running={timer.running} elapsedMs={timer.elapsedMs} lapsCount={timer.laps.length} color={timer.color}
        onToggle={() => ctx.setStopwatchRunning(!timer.running)} onLap={ctx.addStopwatchLap} onReset={ctx.resetStopwatch} />
    </>
  );
}

function PomodoroBody({ timer, ctx }: any) {
  const progress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;
  function handleEditTime(ms: number) {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    const next = timer.phase === 'focus'
      ? { ...timer.settings, focusMin: minutes }
      : { ...timer.settings, pauseMin: minutes };
    ctx.updatePomodoroSettings(next);
  }
  return (
    <>
      <TimerRing
        progress={progress} color={timer.color} running={timer.running} size={160}
        segments={{ total: timer.settings.targetCycles, completed: timer.cycle, currentProgress: progress }}
      >
        <div className="tt-ring-label" style={{ color: timer.color }}>
          {LABELS[timer.phase as 'focus' | 'pause']} {timer.cycle + (timer.phase === 'focus' ? 1 : 0)}/{timer.settings.targetCycles}
        </div>
        <EditableTime ms={timer.remainingMs} color={timer.color} onChange={handleEditTime} disabled={timer.running} />
      </TimerRing>
      <PomodoroControls running={timer.running} color={timer.color}
        onToggle={() => ctx.setPomodoroRunning(!timer.running)} onReset={ctx.resetPomodoro} />
    </>
  );
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

- [ ] **Step 2: Build**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/widgets/timers/TimerPopup.tsx
git commit -m "feat(widgets): add TimerPopup overlay mirroring tool page"
```

---

### Task 12: Update AddWidgetDialog — 4 top-level tiles

**Files:**
- Modify: `src/components/widgets/AddWidgetDialog.tsx`

- [ ] **Step 1: Read the current file to see its structure**

```bash
cat .worktrees/feat-timer-widgets/src/components/widgets/AddWidgetDialog.tsx | head -60
```

- [ ] **Step 2: Restructure the widget type list**

Find the `WIDGET_TYPES` constant and replace with 4 enabled + 3 "soon":

```typescript
const WIDGET_TYPES: WidgetType[] = [
  { id: 'habit', label: 'Habit', subtitle: 'tracker', icon: <Calendar size={20} />, color: '#34d399', enabled: true },
  { id: 'countdown', label: 'Timer', subtitle: 'countdown', icon: <Timer size={20} />, color: '#ef4444', enabled: true },
  { id: 'pomodoro', label: 'Pomodoro', subtitle: 'focus', icon: <Clock size={20} />, color: '#34d399', enabled: true },
  { id: 'stopwatch', label: 'Stopwatch', subtitle: 'elapsed', icon: <Watch size={20} />, color: '#22d3ee', enabled: true },
  { id: 'weather', label: 'Weather', subtitle: 'soon', icon: <Cloud size={20} />, color: '#38bdf8', enabled: false },
  { id: 'todo', label: 'Todo', subtitle: 'soon', icon: <CheckSquare size={20} />, color: '#ec4899', enabled: false },
  { id: 'stats', label: 'Stats', subtitle: 'soon', icon: <BarChart3 size={20} />, color: '#f59e0b', enabled: false },
];
```

Import the new icons:

```typescript
import { Calendar, Clock, Timer, Watch, CheckSquare, Cloud, BarChart3, X, ChevronLeft } from 'lucide-react';
```

Update the `WidgetType['id']` union in the type declaration to include `'countdown' | 'pomodoro' | 'stopwatch'`.

- [ ] **Step 3: Add `configure-timer` stage**

Below the existing stage type:

```typescript
type Stage = 'pick' | 'configure-habit' | 'configure-timer';
```

Change `handlePick` to branch:

```typescript
  function handlePick(type: WidgetType) {
    if (!type.enabled || selectedId) return;
    setSelectedId(type.id);
    setTimeout(() => {
      if (type.id === 'habit') setStage('configure-habit');
      else if (type.id === 'countdown' || type.id === 'pomodoro' || type.id === 'stopwatch') {
        setSelectedTimerKind(type.id);
        setColor(type.color); // pre-select the default color
        setStage('configure-timer');
      }
    }, 450);
  }
```

Add state for the timer kind:

```typescript
  const [selectedTimerKind, setSelectedTimerKind] = useState<'countdown' | 'pomodoro' | 'stopwatch' | null>(null);
```

And prop:

```typescript
interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateHabit: (name: string, color: string) => void;
  onCreateTimerWidget: (kind: 'countdown' | 'pomodoro' | 'stopwatch', color: string) => void;
}
```

Add a stage body for configure-timer (color palette + Add button, no name field):

```typescript
{stage === 'configure-timer' && (
  <motion.form
    key="configure-timer"
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 10 }}
    transition={{ duration: 0.15 }}
    onSubmit={(e) => {
      e.preventDefault();
      if (!selectedTimerKind) return;
      onCreateTimerWidget(selectedTimerKind, color);
      onOpenChange(false);
    }}
  >
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8 }}>
        Color
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        {PRESET_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`} style={{
            width: 26, height: 26, borderRadius: '50%', background: c,
            border: color === c ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
            cursor: 'pointer', padding: 0, transition: 'transform 0.15s',
            transform: color === c ? 'scale(1.1)' : 'scale(1)',
          }} />
        ))}
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button type="button" onClick={() => setStage('pick')} style={{
        background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '7px 14px', color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', cursor: 'pointer',
      }}>Back</button>
      <button type="submit" style={{
        background: color, border: 'none', borderRadius: 8,
        padding: '7px 14px', color: '#000', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
      }}>Add</button>
    </div>
  </motion.form>
)}
```

Also update the header title for the new stage — show "Timer" / "Pomodoro" / "Stopwatch" based on `selectedTimerKind`.

- [ ] **Step 4: Build**

```bash
cd .worktrees/feat-timer-widgets && npx vite build 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/widgets/AddWidgetDialog.tsx
git commit -m "feat(widgets): AddWidgetDialog supports 4 top-level tiles + configure-timer stage"
```

---

### Task 13: Wire widgets into WidgetsSection with auto-summon logic

**Files:**
- Modify: `src/components/widgets/WidgetsSection.tsx`
- Modify: `src/hooks/useWidgets.ts`

The existing widget list stores `{ id, type: 'habit', refId: habit.id }`. We need a new type for timer widgets and to sync with the timer context's `persistent` flag.

- [ ] **Step 1: Update `useWidgets.ts` widget types**

```typescript
export type WidgetType = 'habit' | 'countdown' | 'pomodoro' | 'stopwatch';
```

(No change to the shape — `refId` for timers is just the kind as string, since there's one per kind.)

- [ ] **Step 2: Update WidgetsSection rendering**

In the existing `renderWidget(w: Widget)` switch, add branches for timers:

```typescript
import { useState } from 'react';
import { CountdownWidget } from './timers/CountdownWidget';
import { PomodoroWidget } from './timers/PomodoroWidget';
import { StopwatchWidget } from './timers/StopwatchWidget';
import { TimerPopup } from './timers/TimerPopup';
import { useTimers } from '@/context/TimerContext';

// inside WidgetsSection component:
const ctx = useTimers();
const [popupKind, setPopupKind] = useState<null | 'countdown' | 'pomodoro' | 'stopwatch'>(null);

// Auto-sync: for each timer, ensure there's a widget if it's running or persistent,
// and no widget if it's been zero for >60s and not persistent.
useEffect(() => {
  const now = Date.now();
  for (const t of ctx.timers) {
    const existingWidget = widgets.find((w) => w.type === t.kind && w.refId === t.kind);
    const shouldShow =
      t.persistent ||
      t.running ||
      (t.zeroedAt !== null && now - t.zeroedAt < 60_000) ||
      // Countdown with time set but not yet started counts as "has state"
      (t.kind === 'countdown' && (t as any).remainingMs < (t as any).totalMs && (t as any).remainingMs > 0) ||
      (t.kind === 'stopwatch' && (t as any).elapsedMs > 0) ||
      (t.kind === 'pomodoro' && (t as any).cycle > 0);

    if (shouldShow && !existingWidget) {
      addWidget(t.kind, t.kind);
    } else if (!shouldShow && existingWidget) {
      removeWidgetByRefId(t.kind);
    }
  }
}, [ctx.timers, widgets, addWidget, removeWidgetByRefId]);

// 60s-to-hide schedule
useEffect(() => {
  const timeouts: number[] = [];
  for (const t of ctx.timers) {
    if (t.persistent) continue;
    if (t.zeroedAt === null) continue;
    const elapsed = Date.now() - t.zeroedAt;
    const remaining = 60_000 - elapsed;
    if (remaining <= 0) continue; // handled by the other effect on next tick
    const id = window.setTimeout(() => {
      // Re-evaluate after 60s by bumping a tick (we rely on the sync effect above to run again)
      // Simplest: force a re-read by calling removeWidgetByRefId if still zeroed
      removeWidgetByRefId(t.kind);
    }, remaining);
    timeouts.push(id);
  }
  return () => timeouts.forEach((id) => window.clearTimeout(id));
}, [ctx.timers, removeWidgetByRefId]);

function renderWidget(w: Widget) {
  if (w.type === 'habit') { /* existing code */ }
  if (w.type === 'countdown') {
    const t = ctx.getTimer('countdown');
    return <CountdownWidget timer={t} onClick={() => setPopupKind('countdown')} />;
  }
  if (w.type === 'pomodoro') {
    const t = ctx.getTimer('pomodoro');
    return <PomodoroWidget timer={t} onClick={() => setPopupKind('pomodoro')} />;
  }
  if (w.type === 'stopwatch') {
    const t = ctx.getTimer('stopwatch');
    return <StopwatchWidget timer={t} onClick={() => setPopupKind('stopwatch')} />;
  }
  return null;
}
```

At the end of the return, render the popup:

```tsx
{popupKind && (
  <TimerPopup open={true} onOpenChange={(o) => !o && setPopupKind(null)} kind={popupKind} />
)}
```

- [ ] **Step 3: Wire `onCreateTimerWidget` through the AddWidgetDialog**

Update the AddWidgetDialog usage in WidgetsSection:

```typescript
<AddWidgetDialog
  open={addDialogOpen}
  onOpenChange={setAddDialogOpen}
  onCreateHabit={handleAddHabit}
  onCreateTimerWidget={(kind, color) => {
    ctx.setColor(kind, color);
    ctx.setPersistent(kind, true);
    // The auto-sync effect above will add the widget automatically once setPersistent triggers a re-render
  }}
/>
```

- [ ] **Step 4: Update context menu "Remove" to handle timer widgets**

The HabitWidget has a context menu with Remove that calls `onRemove`. For timer widgets, Remove should call `ctx.setPersistent(kind, false)` instead of destroying anything.

Since timer widgets are separate components (not HabitWidget), add a context menu inside each timer widget wrapper. To keep this simple, wrap timer widget renders in a `SortableTimerWidget` helper that adds right-click support pointing to `onRemove`.

Actually for simplicity, add the context menu in each timer widget file (Tasks 8-10 retroactively). The handler just calls a passed-in `onRemove` prop.

Add `onRemove` prop to each timer widget component's props signature, and have `WidgetsSection` pass:

```typescript
onRemove={() => ctx.setPersistent(t.kind, false)}
```

Update CountdownWidget, PomodoroWidget, StopwatchWidget to wrap their `motion.button` in a `ContextMenu.Root`/`Trigger`/`Content` with Remove option (pattern matches HabitWidget).

- [ ] **Step 5: Build + browser test**

```bash
cd .worktrees/feat-timer-widgets && npx vite --port 5181
```

Test scenarios:
1. Go to `/tools/timer`, set countdown to 10s, hit play. Navigate to `/` — countdown widget should appear, count down from wherever it is.
2. Let it reach zero — widget stays for 60s, then vanishes.
3. Click "+" on widgets section, pick Timer, pick red, click Add. Widget appears as persistent. Stays even at zero.
4. Right-click a persistent widget → Remove → widget disappears.
5. Click a widget → popup opens with ring/controls. Close, state preserved.
6. Reset button in popup closes countdown, widget starts 60s fade.
7. Pomodoro: start, verify phase auto-advances (focus→break→focus).
8. Reload page while timer is running — it should stop (paused state) but remember the time.

- [ ] **Step 6: Commit**

```bash
cd .worktrees/feat-timer-widgets
git add src/components/widgets/WidgetsSection.tsx src/hooks/useWidgets.ts src/components/widgets/timers
git commit -m "feat(widgets): wire timer widgets into section with auto-summon + popup"
```

---

### Task 14: Final integration test and polish

**Files:**
- Modify: various (fix any issues found)

- [ ] **Step 1: Start dev server**

```bash
cd .worktrees/feat-timer-widgets && npx vite --port 5181 --open
```

- [ ] **Step 2: Run through full scenarios**

1. **Auto-summon countdown**: set 10s, play on `/tools/timer`, leave page → widget appears on home. Let zero → wait 60s → widget gone.
2. **Manual persistent timer**: "+" → Timer → red → Add → widget persists through zero.
3. **Right-click persistent timer → Remove** → widget disappears, but underlying timer is not destroyed (go back to `/tools/timer` and it's still there).
4. **Popup interaction**: click widget → popup opens → controls work → X closes → backdrop closes.
5. **Pomodoro flow**: start focus (2min for testing), it auto-advances to pause, then back to focus, until target cycles done.
6. **Stopwatch**: start in `/tools/timer`, leave, come back — elapsed time correct, laps preserved.
7. **Reload test**: start countdown, reload page, timer is paused but remaining time preserved.
8. **Drag order**: drag a timer widget around — order persists.
9. **Widget color change**: right-click (on timer widget) → (may need to add a color picker to context menu as future work)

- [ ] **Step 3: Fix any issues and commit**

```bash
cd .worktrees/feat-timer-widgets
git add -A
git commit -m "fix(timer-widgets): polish from integration testing"
```

(Skip if no fixes needed.)
