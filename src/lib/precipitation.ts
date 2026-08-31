/**
 * Deterministic particle parameters for the weather hero's rain and snow.
 *
 * Everything is derived from the particle index through a small integer
 * hash, so a render never calls Math.random and the same scene always
 * produces the same drops. Two depth layers alternate by index: the far
 * layer is dimmer, thinner and smaller so the cloud reads as having depth.
 */

export interface RainDrop {
  /** Top-left start of the drop in SVG user units. */
  x: number;
  y: number;
  /** Length of the streak along its slant, in user units. */
  length: number;
  /** Horizontal offset of the streak end (negative = leaning left). */
  slant: number;
  /** Seconds per fall cycle. */
  duration: number;
  /** Seconds before the first cycle starts (negative so drops are mid-fall on mount). */
  delay: number;
  /** Peak opacity for the drop. */
  opacity: number;
  /** Stroke width in user units. */
  width: number;
  far: boolean;
}

export interface SnowFlake {
  x: number;
  y: number;
  radius: number;
  duration: number;
  delay: number;
  opacity: number;
  /** Horizontal drift amplitude in user units (signed). */
  sway: number;
  far: boolean;
}

export interface ParticleField {
  /** Left edge of the band the particles start in. */
  x: number;
  /** Width of the band (the cloud's width). */
  width: number;
  /** Baseline the particles start from (just under the cloud). */
  y: number;
  count?: number;
}

/** Integer hash of (index, salt) mapped to [0, 1). Stable across runs. */
export function unitRandom(index: number, salt = 0): number {
  let t = (Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  t ^= t >>> 15;
  t = Math.imul(t, 0x2c1b3c6d);
  t ^= t >>> 12;
  t = Math.imul(t, 0x297a2d39);
  t ^= t >>> 15;
  return (t >>> 0) / 4294967296;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round = (v: number, places = 2) => Number(v.toFixed(places));

/** Even spread across the band with per-slot jitter so drops never form a comb. */
function spread(index: number, count: number, x: number, width: number, jitter: number): number {
  const slot = width / count;
  return x + slot * (index + 0.15 + jitter * 0.7);
}

export const RAIN_DEFAULT_COUNT = 24;
export const SNOW_DEFAULT_COUNT = 18;

export function rainDrops({ x, width, y, count = RAIN_DEFAULT_COUNT }: ParticleField): RainDrop[] {
  return Array.from({ length: count }, (_, i) => {
    const far = i % 2 === 1;
    const length = lerp(8, 16, unitRandom(i, 1));
    const duration = lerp(0.7, 1.3, unitRandom(i, 2));
    return {
      x: round(spread(i, count, x, width, unitRandom(i, 3))),
      y: round(y + unitRandom(i, 4) * 10),
      length: round(length),
      slant: round(-length * 0.22),
      duration: round(duration),
      delay: round(-unitRandom(i, 5) * duration),
      opacity: round(far ? lerp(0.22, 0.42, unitRandom(i, 6)) : lerp(0.6, 0.9, unitRandom(i, 6))),
      width: far ? 1.2 : 2,
      far,
    };
  });
}

export function snowFlakes({ x, width, y, count = SNOW_DEFAULT_COUNT }: ParticleField): SnowFlake[] {
  return Array.from({ length: count }, (_, i) => {
    const far = i % 2 === 1;
    const duration = lerp(2.6, 4.6, unitRandom(i, 2));
    const sway = lerp(4, 10, unitRandom(i, 7)) * (unitRandom(i, 8) < 0.5 ? -1 : 1);
    return {
      x: round(spread(i, count, x, width, unitRandom(i, 3))),
      y: round(y + unitRandom(i, 4) * 10),
      radius: round(far ? lerp(1.3, 2, unitRandom(i, 1)) : lerp(2, 3.2, unitRandom(i, 1))),
      duration: round(duration),
      delay: round(-unitRandom(i, 5) * duration),
      opacity: round(far ? lerp(0.3, 0.5, unitRandom(i, 6)) : lerp(0.65, 0.95, unitRandom(i, 6))),
      sway: round(sway),
      far,
    };
  });
}
