/**
 * Small Web Audio helpers for UI feedback sounds.
 *
 * Single shared AudioContext, lazily created on first play (browsers
 * require a user-gesture before audio can start; the first click
 * unlocks it).
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor!();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur = 0.3, volume = 0.18) {
  const a = getCtx();
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/**
 * Two-note sine chime (C5 → E5) played when a todo is marked complete
 * via a direct checkbox click. NOT played on drag-complete or uncheck.
 */
export function playTodoCompleteSound() {
  tone(523, 0.3);
  setTimeout(() => tone(659, 0.4), 80);
}
