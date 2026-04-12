# Timer/Pomodoro Remodel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remodel the timer tool from a single 749-line file into 8 focused components with thick glowing ring, animated pill toggle, framer-motion animations, and no +/- adjustment buttons.

**Architecture:** Page shell with animated pill toggle switches between CountdownMode, StopwatchMode, and PomodoroMode. Shared TimerRing and TimerControls components. Timing logic extracted to useTimer hook. framer-motion handles all animations.

**Tech Stack:** React 18, TypeScript, framer-motion (new), SVG for ring, Web Audio API for alarms

**Worktree:** `.worktrees/feat-timer-remodel`

---

### Task 1: Install framer-motion

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install framer-motion**

```bash
cd .worktrees/feat-timer-remodel && npm install framer-motion
```

- [ ] **Step 2: Verify it imports**

```bash
cd .worktrees/feat-timer-remodel && npx tsx -e "import { motion } from 'framer-motion'; console.log('ok')"
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add package.json package-lock.json
git commit -m "chore: add framer-motion for timer animations"
```

---

### Task 2: Extract useTimer hook

**Files:**
- Create: `src/hooks/useTimer.ts`

Extract the shared timing engine, utility functions, alarm, and notification system from ToolTimerPage.tsx into a reusable hook.

- [ ] **Step 1: Create useTimer.ts**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';

/* ── Formatting ─────────────────────────────────────────────────────── */

export function formatHMS(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatStopwatch(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  const time =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  return `${time}.${String(cs).padStart(2, '0')}`;
}

export function parseTimeString(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => p.trim());
  if (parts.length > 3) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n) || n < 0)) return null;
  let totalSec: number;
  if (nums.length === 1) totalSec = nums[0] * 60;
  else if (nums.length === 2) totalSec = nums[0] * 60 + nums[1];
  else totalSec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  return totalSec * 1000;
}

/* ── Alarm & Notification ───────────────────────────────────────────── */

export function playAlarm() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.15);
    beep(1175, 0.2, 0.2);
  } catch {
    /* audio context blocked — ignore */
  }
}

export function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}

/* ── Countdown Hook ─────────────────────────────────────────────────── */

interface UseCountdownOptions {
  initialMs: number;
  onFinish?: () => void;
}

export function useCountdown({ initialMs, onFinish }: UseCountdownOptions) {
  const [totalMs, setTotalMs] = useState(initialMs);
  const [remainingMs, setRemainingMs] = useState(initialMs);
  const [running, setRunning] = useState(false);

  const lastTickRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((prev) => Math.max(0, prev - delta));
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || remainingMs > 0) return;
    setRunning(false);
    onFinishRef.current?.();
  }, [running, remainingMs]);

  const setTime = useCallback((ms: number) => {
    setRemainingMs(ms);
    setTotalMs(ms);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setRemainingMs(totalMs);
  }, [totalMs]);

  const resetFull = useCallback((ms: number) => {
    setRunning(false);
    setTotalMs(ms);
    setRemainingMs(ms);
  }, []);

  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const finished = remainingMs === 0;

  return { totalMs, remainingMs, running, setRunning, setTime, reset, resetFull, progress, finished };
}

/* ── Stopwatch Hook ─────────────────────────────────────────────────── */

export function useStopwatch() {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(accumulatedRef.current + (performance.now() - startTimeRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    startTimeRef.current = performance.now();
    raf = requestAnimationFrame(tick);
    return () => {
      if (startTimeRef.current !== null) {
        accumulatedRef.current += performance.now() - startTimeRef.current;
        startTimeRef.current = null;
      }
      cancelAnimationFrame(raf);
    };
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    accumulatedRef.current = 0;
    startTimeRef.current = null;
  }, []);

  const addLap = useCallback(() => {
    setLaps((prev) => [elapsedMs, ...prev]);
  }, [elapsedMs]);

  return { running, setRunning, elapsedMs, laps, reset, addLap };
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```
Expected: Build succeeds (file is unused but compiles).

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/hooks/useTimer.ts
git commit -m "feat(timer): extract useTimer hook with countdown, stopwatch, alarm, utilities"
```

---

### Task 3: Create PillToggle component

**Files:**
- Create: `src/components/timer/PillToggle.tsx`

- [ ] **Step 1: Create PillToggle.tsx**

```typescript
import { motion } from 'framer-motion';

export interface PillOption<T extends string> {
  id: T;
  label: string;
  color: string;
}

interface PillToggleProps<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function PillToggle<T extends string>({ options, value, onChange }: PillToggleProps<T>) {
  const active = options.find((o) => o.id === value);

  return (
    <div className="tt-pill-container">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className="tt-pill-option"
          style={{ color: opt.id === value ? '#000' : 'rgba(255,255,255,0.4)' }}
          onClick={() => onChange(opt.id)}
        >
          {opt.id === value && (
            <motion.div
              className="tt-pill-bg"
              layoutId="pill-bg"
              style={{ backgroundColor: active?.color }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS classes to globals.css**

Append after the existing `.tt-mode-tab.active` block (around line 1375). These replace the old tab styles:

```css
/* Pill toggle (replaces .tt-mode-tabs) */
.tt-pill-container {
  display: inline-flex;
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 4px;
  margin-bottom: 18px;
}
.tt-pill-option {
  position: relative;
  padding: 6px 18px;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 20px;
  transition: color 0.2s;
}
.tt-pill-bg {
  position: absolute;
  inset: 0;
  border-radius: 20px;
}
```

- [ ] **Step 3: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/PillToggle.tsx src/styles/globals.css
git commit -m "feat(timer): add animated PillToggle component with framer-motion"
```

---

### Task 4: Create TimerRing component

**Files:**
- Create: `src/components/timer/TimerRing.tsx`

- [ ] **Step 1: Create TimerRing.tsx**

The ring supports two modes: normal (single arc) and segmented (for pomodoro). Uses `motion.circle` for animated progress.

```typescript
import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TimerRingProps {
  /** 0–1 overall progress */
  progress: number;
  /** Accent color for stroke and glow */
  color: string;
  /** Content rendered in the center (time display, label) */
  children: ReactNode;
  /** If set, renders N segments instead of a single arc */
  segments?: { total: number; completed: number; currentProgress: number };
  /** Whether the timer is currently running (enables glow pulse) */
  running?: boolean;
}

const VIEWBOX = 300;
const CX = 150;
const CY = 150;
const R = 130;
const CIRCUMFERENCE = 2 * Math.PI * R;
const STROKE_WIDTH = 8;

export function TimerRing({ progress, color, children, segments, running }: TimerRingProps) {
  const glowFilter = `drop-shadow(0 0 ${running ? 10 : 6}px ${color}50)`;

  return (
    <div className="tt-ring-wrap">
      <svg
        className="tt-ring"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
        style={{ filter: glowFilter, transition: 'filter 0.5s' }}
      >
        {/* Track */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={STROKE_WIDTH}
        />

        {segments ? (
          <SegmentedRing
            total={segments.total}
            completed={segments.completed}
            currentProgress={segments.currentProgress}
            color={color}
          />
        ) : (
          <motion.circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={0.9}
          />
        )}
      </svg>
      <div className="tt-ring-center">
        {children}
      </div>
    </div>
  );
}

function SegmentedRing({
  total, completed, currentProgress, color,
}: {
  total: number; completed: number; currentProgress: number; color: string;
}) {
  const gapAngle = 4; // degrees of gap between segments
  const totalGap = gapAngle * total;
  const segmentAngle = (360 - totalGap) / total;
  const segmentArc = (segmentAngle / 360) * CIRCUMFERENCE;
  const gapArc = (gapAngle / 360) * CIRCUMFERENCE;

  return (
    <>
      {Array.from({ length: total }, (_, i) => {
        const startOffset = i * (segmentArc + gapArc);
        let opacity: number;
        let arcLength: number;

        if (i < completed) {
          // Completed segment
          opacity = 0.9;
          arcLength = segmentArc;
        } else if (i === completed) {
          // Current segment (partially filled)
          opacity = 0.6;
          arcLength = segmentArc * currentProgress;
        } else {
          // Future segment (dim track)
          opacity = 0.08;
          arcLength = segmentArc;
        }

        return (
          <motion.circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={i > completed ? 'rgba(255,255,255,1)' : color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
            strokeDashoffset={-startOffset}
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={opacity}
            initial={false}
            animate={{ strokeDasharray: `${arcLength} ${CIRCUMFERENCE - arcLength}`, opacity }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/TimerRing.tsx
git commit -m "feat(timer): add TimerRing component with glow, progress, and segmented mode"
```

---

### Task 5: Create TimerControls and EditableTime components

**Files:**
- Create: `src/components/timer/TimerControls.tsx`

- [ ] **Step 1: Create TimerControls.tsx**

Contains the circular play/pause/reset/lap buttons AND the EditableTime component:

```typescript
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Flag } from 'lucide-react';
import { formatHMS, parseTimeString } from '@/hooks/useTimer';

/* ── Circular icon button ───────────────────────────────────────────── */

interface CircleBtnProps {
  icon: React.ReactNode;
  color?: string;
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}

function CircleBtn({ icon, color, primary, disabled, onClick, label }: CircleBtnProps) {
  return (
    <motion.button
      type="button"
      className={`tt-circle-btn${primary ? ' primary' : ''}`}
      style={primary && color ? {
        background: `linear-gradient(135deg, ${color}4d, ${color}26)`,
        borderColor: `${color}66`,
        boxShadow: `0 0 12px ${color}33`,
        color,
      } : undefined}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      aria-label={label}
    >
      {icon}
    </motion.button>
  );
}

/* ── Control bar variants ───────────────────────────────────────────── */

interface CountdownControlsProps {
  running: boolean;
  finished: boolean;
  color: string;
  onToggle: () => void;
  onReset: () => void;
}

export function CountdownControls({ running, finished, color, onToggle, onReset }: CountdownControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        disabled={finished}
        onClick={onToggle}
        label={running ? 'Pause' : 'Start'}
      />
      <CircleBtn icon={<RotateCcw size={16} />} onClick={onReset} label="Nullstill" />
    </div>
  );
}

interface StopwatchControlsProps {
  running: boolean;
  elapsedMs: number;
  lapsCount: number;
  color: string;
  onToggle: () => void;
  onLap: () => void;
  onReset: () => void;
}

export function StopwatchControls({ running, elapsedMs, lapsCount, color, onToggle, onLap, onReset }: StopwatchControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        onClick={onToggle}
        label={running ? 'Pause' : elapsedMs > 0 ? 'Fortsett' : 'Start'}
      />
      <CircleBtn icon={<Flag size={16} />} onClick={onLap} disabled={!running} label="Lap" />
      <CircleBtn icon={<RotateCcw size={16} />} onClick={onReset} disabled={elapsedMs === 0 && lapsCount === 0} label="Nullstill" />
    </div>
  );
}

interface PomodoroControlsProps {
  running: boolean;
  color: string;
  onToggle: () => void;
  onReset: () => void;
}

export function PomodoroControls({ running, color, onToggle, onReset }: PomodoroControlsProps) {
  return (
    <div className="tt-circle-controls">
      <CircleBtn
        icon={running ? <Pause size={18} /> : <Play size={18} />}
        color={color}
        primary
        onClick={onToggle}
        label={running ? 'Pause' : 'Start'}
      />
      <CircleBtn icon={<RotateCcw size={16} />} onClick={onReset} label="Nullstill" />
    </div>
  );
}

/* ── Editable time display ──────────────────────────────────────────── */

interface EditableTimeProps {
  ms: number;
  color: string;
  onChange: (newMs: number) => void;
  disabled?: boolean;
}

export function EditableTime({ ms, color, onChange, disabled }: EditableTimeProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function start() {
    if (disabled) return;
    setDraft(formatHMS(ms / 1000));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  function commit() {
    const parsed = parseTimeString(draft);
    if (parsed !== null) onChange(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <input
          ref={inputRef}
          className="tt-ring-input"
          style={{ borderColor: `${color}4d` }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') setEditing(false);
          }}
          spellCheck={false}
          inputMode="numeric"
          aria-label="Rediger tid"
        />
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      className="tt-ring-text tt-ring-text-editable"
      onClick={start}
      title={disabled ? undefined : 'Klikk for å redigere'}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {formatHMS(ms / 1000)}
    </motion.button>
  );
}
```

- [ ] **Step 2: Add CSS for circular controls**

Append to globals.css after the pill toggle CSS:

```css
/* Circular controls */
.tt-circle-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
.tt-circle-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s;
}
.tt-circle-btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
}
.tt-circle-btn:disabled {
  opacity: 0.3;
  cursor: default;
}
```

- [ ] **Step 3: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/TimerControls.tsx src/styles/globals.css
git commit -m "feat(timer): add TimerControls and EditableTime with framer-motion"
```

---

### Task 6: Create CountdownMode component

**Files:**
- Create: `src/components/timer/CountdownMode.tsx`

- [ ] **Step 1: Create CountdownMode.tsx**

```typescript
import { useCallback } from 'react';
import { useCountdown, playAlarm, notify, formatHMS } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { CountdownControls, EditableTime } from './TimerControls';

const COLOR = '#ef4444';
const DEFAULT_MS = 5 * 60_000;

export function CountdownMode() {
  const onFinish = useCallback(() => {
    playAlarm();
    notify('Timer ferdig', `Nedtelling er over.`);
  }, []);

  const timer = useCountdown({ initialMs: DEFAULT_MS, onFinish });

  return (
    <div className="tt-mode-body">
      <TimerRing progress={timer.progress} color={COLOR} running={timer.running}>
        {timer.finished && (
          <div className="tt-ring-label" style={{ color: COLOR }}>FERDIG</div>
        )}
        <EditableTime
          ms={timer.remainingMs}
          color={COLOR}
          onChange={timer.setTime}
          disabled={timer.running}
        />
      </TimerRing>
      <CountdownControls
        running={timer.running}
        finished={timer.finished}
        color={COLOR}
        onToggle={() => timer.setRunning((r) => !r)}
        onReset={timer.reset}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/CountdownMode.tsx
git commit -m "feat(timer): add CountdownMode component"
```

---

### Task 7: Create StopwatchMode component

**Files:**
- Create: `src/components/timer/StopwatchMode.tsx`

- [ ] **Step 1: Create StopwatchMode.tsx**

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { useStopwatch, formatStopwatch } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { StopwatchControls } from './TimerControls';

const COLOR = '#22d3ee';

export function StopwatchMode() {
  const sw = useStopwatch();

  return (
    <div className="tt-mode-body">
      <TimerRing progress={1} color={COLOR} running={sw.running}>
        <div className="tt-ring-label" style={{ color: COLOR }}>STOPWATCH</div>
        <div className="tt-ring-text">{formatStopwatch(sw.elapsedMs)}</div>
      </TimerRing>
      <StopwatchControls
        running={sw.running}
        elapsedMs={sw.elapsedMs}
        lapsCount={sw.laps.length}
        color={COLOR}
        onToggle={() => sw.setRunning((r) => !r)}
        onLap={sw.addLap}
        onReset={sw.reset}
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
                  style={i === 0 ? { borderColor: `${COLOR}30` } : undefined}
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

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/StopwatchMode.tsx
git commit -m "feat(timer): add StopwatchMode with animated lap list"
```

---

### Task 8: Create PomodoroMode component

**Files:**
- Create: `src/components/timer/PomodoroMode.tsx`

- [ ] **Step 1: Create PomodoroMode.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useCountdown, playAlarm, notify } from '@/hooks/useTimer';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { TimerRing } from './TimerRing';
import { PomodoroControls, EditableTime } from './TimerControls';

type Phase = 'focus' | 'pause';

interface PomodoroSettings {
  focusMin: number;
  pauseMin: number;
  targetCycles: number;
}

const DEFAULTS: PomodoroSettings = { focusMin: 25, pauseMin: 5, targetCycles: 4 };
const COLORS: Record<Phase, string> = { focus: '#34d399', pause: '#06b6d4' };
const LABELS: Record<Phase, string> = { focus: 'FOKUS', pause: 'PAUSE' };

export function PomodoroMode() {
  const [stored, setStored] = useLocalStorage<Partial<PomodoroSettings>>('tool-pomodoro-settings-v2', DEFAULTS);
  const settings: PomodoroSettings = {
    focusMin: Number.isFinite(stored.focusMin) ? stored.focusMin! : DEFAULTS.focusMin,
    pauseMin: Number.isFinite(stored.pauseMin) ? stored.pauseMin! : DEFAULTS.pauseMin,
    targetCycles: Number.isFinite(stored.targetCycles) ? stored.targetCycles! : DEFAULTS.targetCycles,
  };
  const setSettings = (next: PomodoroSettings) => setStored(next);

  const [phase, setPhase] = useState<Phase>('focus');
  const [cycle, setCycle] = useState(0);

  const handleFinish = useCallback(() => {
    playAlarm();
    if (phase === 'focus') {
      const next = cycle + 1;
      setCycle(next);
      if (next >= settings.targetCycles) {
        notify('Pomodoro ferdig', `${settings.targetCycles} økter fullført.`);
        setPhase('focus');
        setCycle(0);
        return;
      }
      notify('Fokus ferdig', 'Pause starter.');
      setPhase('pause');
    } else {
      notify('Pause over', 'Tilbake til fokus.');
      setPhase('focus');
    }
  }, [phase, cycle, settings.targetCycles]);

  const initialMs = (phase === 'focus' ? settings.focusMin : settings.pauseMin) * 60_000;
  const timer = useCountdown({ initialMs, onFinish: handleFinish });

  // Reset when phase or settings change
  useEffect(() => {
    const ms = (phase === 'focus' ? settings.focusMin : settings.pauseMin) * 60_000;
    timer.resetFull(ms);
  }, [phase, settings.focusMin, settings.pauseMin]);

  function setExactTime(newMs: number) {
    timer.setTime(newMs);
    const minutes = Math.max(1, Math.round(newMs / 60_000));
    if (phase === 'focus') setSettings({ ...settings, focusMin: minutes });
    else setSettings({ ...settings, pauseMin: minutes });
  }

  function fullReset() {
    timer.resetFull(settings.focusMin * 60_000);
    setPhase('focus');
    setCycle(0);
  }

  const color = COLORS[phase];
  const segmentProgress = timer.totalMs > 0 ? timer.remainingMs / timer.totalMs : 0;

  return (
    <div className="tt-mode-body">
      <TimerRing
        progress={timer.progress}
        color={color}
        running={timer.running}
        segments={{
          total: settings.targetCycles,
          completed: cycle,
          currentProgress: 1 - segmentProgress,
        }}
      >
        <motion.div
          className="tt-ring-label"
          style={{ color }}
          key={phase}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {LABELS[phase]} {cycle + (phase === 'focus' ? 1 : 0)}/{settings.targetCycles}
        </motion.div>
        <EditableTime
          ms={timer.remainingMs}
          color={color}
          onChange={setExactTime}
          disabled={timer.running}
        />
      </TimerRing>
      <PomodoroControls
        running={timer.running}
        color={color}
        onToggle={() => timer.setRunning((r) => !r)}
        onReset={fullReset}
      />
      {/* Inline settings */}
      <div className="tt-pomo-inline">
        <InlineField label="Focus" value={settings.focusMin} suffix="min" onChange={(v) => setSettings({ ...settings, focusMin: v })} />
        <InlineField label="Break" value={settings.pauseMin} suffix="min" onChange={(v) => setSettings({ ...settings, pauseMin: v })} />
        <InlineField label="Sessions" value={settings.targetCycles} onChange={(v) => setSettings({ ...settings, targetCycles: v })} />
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
        <input
          className="tt-inline-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
          inputMode="numeric"
          style={{ width: '40px' }}
        />
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

- [ ] **Step 2: Add CSS for inline pomodoro settings**

Append to globals.css:

```css
/* Pomodoro inline settings */
.tt-pomo-inline {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 18px;
}
.tt-inline-field {
  text-align: center;
}
.tt-inline-label {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  margin-bottom: 4px;
}
.tt-inline-value {
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 4px 10px;
  color: rgba(255, 255, 255, 0.6);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.15s;
}
.tt-inline-value:hover {
  border-color: rgba(255, 255, 255, 0.15);
}
.tt-inline-suffix {
  color: var(--color-text-muted);
  font-size: 0.65rem;
  margin-left: 2px;
}
.tt-inline-input {
  background: #08080a;
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 6px;
  padding: 4px 6px;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  text-align: center;
  outline: none;
}
```

- [ ] **Step 3: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/components/timer/PomodoroMode.tsx src/styles/globals.css
git commit -m "feat(timer): add PomodoroMode with segmented ring and inline settings"
```

---

### Task 9: Rewrite ToolTimerPage as shell + cleanup CSS

**Files:**
- Modify: `src/pages/tools/ToolTimerPage.tsx` (replace entire contents)
- Modify: `src/styles/globals.css` (remove old `.tt-adjust-*`, `.tt-numfield*`, `.tt-mode-tab*` styles; keep `.tt-ring-*`, `.tt-lap-*`, `.tt-mode-body`, `.tt-controls`, `.tt-btn`, `.tt-surface` styles that are still used or update them)

- [ ] **Step 1: Rewrite ToolTimerPage.tsx**

Replace the entire file with:

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { PillToggle, type PillOption } from '@/components/timer/PillToggle';
import { CountdownMode } from '@/components/timer/CountdownMode';
import { StopwatchMode } from '@/components/timer/StopwatchMode';
import { PomodoroMode } from '@/components/timer/PomodoroMode';

type Mode = 'timer' | 'stopwatch' | 'pomodoro';

const MODES: PillOption<Mode>[] = [
  { id: 'timer', label: 'Timer', color: '#ef4444' },
  { id: 'stopwatch', label: 'Stopwatch', color: '#22d3ee' },
  { id: 'pomodoro', label: 'Pomodoro', color: '#34d399' },
];

const MODE_ORDER: Mode[] = ['timer', 'stopwatch', 'pomodoro'];

const COMPONENTS: Record<Mode, React.FC> = {
  timer: CountdownMode,
  stopwatch: StopwatchMode,
  pomodoro: PomodoroMode,
};

export function ToolTimerPage() {
  const [mode, setMode] = useState<Mode>('timer');
  const [prevMode, setPrevMode] = useState<Mode>('timer');

  function changeMode(next: Mode) {
    setPrevMode(mode);
    setMode(next);
  }

  const direction = MODE_ORDER.indexOf(mode) > MODE_ORDER.indexOf(prevMode) ? 1 : -1;
  const Component = COMPONENTS[mode];

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader title="Timer & Pomodoro" subtitle="Timer, stoppeklokke og Pomodoro i ett." />

      <div className="surface tt-surface">
        <PillToggle options={MODES} value={mode} onChange={changeMode} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Component />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Clean up globals.css**

Remove these old class blocks from globals.css (lines ~1338-1697):
- `.tt-mode-tabs` and `.tt-mode-tab` and `.tt-mode-tab:hover` and `.tt-mode-tab.active` (replaced by pill toggle)
- `.tt-adjust-row` and `.tt-adjust-btn` and all adjust button styles (removed feature)
- `.tt-numfield`, `.tt-numfield-label`, `.tt-numfield-stepper`, `.tt-numfield-btn`, `.tt-numfield-value` (replaced by inline settings)
- `.tt-pomo-boxes` (replaced by `.tt-pomo-inline`)
- `.tt-btn` and `.tt-btn.primary` and `.tt-controls` (replaced by circular controls)

Keep and update these classes:
- `.tt-surface` — keep as-is
- `.tt-mode-body` — keep as-is
- `.tt-ring-wrap`, `.tt-ring`, `.tt-ring-center`, `.tt-ring-track` — keep but update `.tt-ring-track` stroke to match new 8px width
- `.tt-ring-text`, `.tt-ring-text-editable`, `.tt-ring-input`, `.tt-ring-label` — keep as-is
- `.tt-lap-list`, `.tt-lap-row`, `.tt-lap-num`, `.tt-lap-diff`, `.tt-lap-time` — keep, update `.tt-lap-row` border-radius to 8px

- [ ] **Step 3: Verify build**

```bash
cd .worktrees/feat-timer-remodel && npx vite build 2>&1 | tail -3
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feat-timer-remodel
git add src/pages/tools/ToolTimerPage.tsx src/styles/globals.css
git commit -m "feat(timer): rewrite page shell with animated pill toggle and mode transitions"
```

---

### Task 10: Browser test and fix

**Files:**
- Modify: various (fix any issues found)

- [ ] **Step 1: Start dev server**

```bash
cd .worktrees/feat-timer-remodel && npx vite --port 5175 --open
```

- [ ] **Step 2: Test all modes**

Navigate to `/tools/timer` and test:

1. **Pill toggle:** Click between Timer, Stopwatch, Pomodoro. Verify pill background slides with spring animation. Content slides left/right.
2. **Countdown:** Click the time display → edit to "10" → Enter. Press play. Verify ring depletes, glow visible, alarm fires at zero. Reset works.
3. **Stopwatch:** Press Start. Time counts up with centiseconds. Press Lap — new lap animates in. Press Pause, then Reset.
4. **Pomodoro:** Verify segmented ring shows 4 segments. Click time to edit. Press Start. Verify "FOKUS 1/4" label. Let it run or manually test phase transitions. Check inline settings (Focus/Break/Sessions) are editable.
5. **Responsive:** Resize browser to mobile width. Ring shrinks, controls adjust.

- [ ] **Step 3: Fix any issues found and commit**

```bash
cd .worktrees/feat-timer-remodel
git add -A
git commit -m "fix(timer): integration fixes from browser testing"
```

(Skip if no fixes needed.)
