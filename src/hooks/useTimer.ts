import { useState, useEffect, useRef } from 'react';

/* ──────────────────────────────────────────────────────────────────────── */
/*  Utility functions                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

/** Format total seconds to "M:SS" or "H:MM:SS". */
export function formatHMS(totalSec: number): string {
  totalSec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format milliseconds to "M:SS.CS" with centiseconds. */
export function formatStopwatch(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10); // centiseconds
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Parse a free-form time string into milliseconds.
 *   "5"        → 5 minutes  (single number = minutes)
 *   "1:30"     → 1 min 30 sec
 *   "1:30:00"  → 1 hour 30 min
 * Returns null if the input can't be parsed.
 */
export function parseTimeString(s: string): number | null {
  s = s.trim();
  if (!s) return null;
  const parts = s.split(':').map((p) => p.trim());
  if (parts.some((p) => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => parseInt(p, 10));
  let totalSec = 0;
  if (nums.length === 1) {
    totalSec = nums[0] * 60;
  } else if (nums.length === 2) {
    totalSec = nums[0] * 60 + nums[1];
  } else if (nums.length === 3) {
    totalSec = nums[0] * 3600 + nums[1] * 60 + nums[2];
  } else {
    return null;
  }
  if (totalSec < 0 || totalSec > 24 * 3600) return null;
  return totalSec * 1000;
}

/**
 * Play a short two-beep alarm via Web Audio. Avoids needing an audio
 * file in /public — synth-generated tones are good enough for an alarm.
 */
export function playAlarm() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    beep(880, 0, 0.15);
    beep(1175, 0.22, 0.2);
  } catch {
    /* audio context blocked — fail silently */
  }
}

/** Best-effort browser notification. Requests permission lazily. */
export function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') new Notification(title, { body });
    });
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  useCountdown hook                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

export interface UseCountdownOptions {
  initialMs: number;
  onFinish?: () => void;
}

export interface UseCountdownResult {
  totalMs: number;
  remainingMs: number;
  running: boolean;
  setRunning: (running: boolean) => void;
  setTime: (ms: number) => void;
  reset: () => void;
  resetFull: (ms: number) => void;
  progress: number;
  finished: boolean;
}

export function useCountdown({ initialMs, onFinish }: UseCountdownOptions): UseCountdownResult {
  const [totalMs, setTotalMs] = useState(initialMs);
  const [remainingMs, setRemainingMs] = useState(initialMs);
  const [running, setRunning] = useState(false);

  const lastTickRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // Real-time tick using performance.now() delta tracking with 100ms setInterval
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

  // Fire onFinish and stop when we hit zero
  useEffect(() => {
    if (!running || remainingMs > 0) return;
    setRunning(false);
    onFinishRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, remainingMs]);

  /** Sets both remaining and total to the given value. */
  function setTime(ms: number) {
    setRemainingMs(ms);
    setTotalMs(ms);
  }

  /** Resets remaining to totalMs (does not change total). */
  function reset() {
    setRunning(false);
    setRemainingMs(totalMs);
  }

  /** Resets both total and remaining to the given value. */
  function resetFull(ms: number) {
    setRunning(false);
    setTotalMs(ms);
    setRemainingMs(ms);
  }

  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const finished = remainingMs === 0;

  return {
    totalMs,
    remainingMs,
    running,
    setRunning,
    setTime,
    reset,
    resetFull,
    progress,
    finished,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  useStopwatch hook                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

export interface UseStopwatchResult {
  running: boolean;
  setRunning: (running: boolean) => void;
  elapsedMs: number;
  laps: number[];
  reset: () => void;
  addLap: () => void;
}

export function useStopwatch(): UseStopwatchResult {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  // Tick — high-frequency for smooth centisecond display using requestAnimationFrame
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

  function reset() {
    setRunning(false);
    setElapsedMs(0);
    setLaps([]);
    accumulatedRef.current = 0;
    startTimeRef.current = null;
  }

  function addLap() {
    setLaps((prev) => [elapsedMs, ...prev]);
  }

  return {
    running,
    setRunning,
    elapsedMs,
    laps,
    reset,
    addLap,
  };
}
