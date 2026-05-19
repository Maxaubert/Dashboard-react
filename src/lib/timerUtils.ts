/* Pure timer helpers — formatters, parser, and Web Audio alarm beeps.
 * No React. The countdown / stopwatch React hooks (`useCountdown`,
 * `useStopwatch`) used to live next to this code but had zero callers,
 * so they were removed along with the split. */

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
  const cs = Math.floor((ms % 1000) / 10);
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
  s = s.trim().replace(/:+$/, '');
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

/* ── Web Audio alarm beeps ─────────────────────────────────────────── */

const ALARM_REPEATS = 3;
const ALARM_REPEAT_GAP_S = 0.35;

/**
 * Play a short sequence of sine-wave beeps. Each beep is `[frequency_hz, dur_s]`.
 * Beeps play sequentially, 0.22s apart; the whole sequence repeats `repeats`
 * times with `ALARM_REPEAT_GAP_S` between passes.
 */
function playBeepSequence(beeps: Array<[number, number]>, repeats = ALARM_REPEATS) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const passDuration = beeps.length * 0.22;
    let offset = 0;
    for (let r = 0; r < repeats; r++) {
      for (const [freq, dur] of beeps) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + offset);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + offset + dur);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + dur + 0.05);
        offset += 0.22;
      }
      offset = (r + 1) * (passDuration + ALARM_REPEAT_GAP_S);
    }
  } catch {
    /* audio context blocked — fail silently */
  }
}

/** Warm two-tone alarm for pomodoro focus-end (entering break). Lower, gentler. */
export function playFocusEndAlarm() {
  playBeepSequence([[660, 0.2], [523, 0.3]]);
}

/** Energetic three-tone alarm for pomodoro break-end (back to focus). */
export function playBreakEndAlarm() {
  playBeepSequence([[784, 0.12], [988, 0.12], [1318, 0.2]]);
}

/* ── Looping alarm chime ───────────────────────────────────────────── */

let alarmLoopId: ReturnType<typeof setInterval> | null = null;

function playSingleAlarmBeep(): void {
  playBeepSequence([[880, 0.15], [1175, 0.2]], 1);
}

/**
 * Start a continuous alarm chime. Plays one two-tone beep immediately, then
 * one every 900ms. Idempotent — calling twice doesn't stack intervals.
 * The 900ms interval is tuned to be longer than one two-tone cycle (≈0.44s)
 * so beeps don't overlap, but short enough to feel insistent.
 */
export function startLoopingAlarm(): void {
  stopLoopingAlarm();
  playSingleAlarmBeep();
  alarmLoopId = setInterval(playSingleAlarmBeep, 900);
}

/** Stop the looping chime. Safe to call when not running. */
export function stopLoopingAlarm(): void {
  if (alarmLoopId !== null) {
    clearInterval(alarmLoopId);
    alarmLoopId = null;
  }
}
