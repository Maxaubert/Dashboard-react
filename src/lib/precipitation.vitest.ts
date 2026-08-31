import { describe, expect, it } from 'vitest';
import {
  RAIN_DEFAULT_COUNT,
  SNOW_DEFAULT_COUNT,
  rainDrops,
  snowFlakes,
  unitRandom,
} from './precipitation';

const field = { x: 72, width: 84, y: 116 };

describe('unitRandom', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const a = unitRandom(i, 3);
      expect(a).toBe(unitRandom(i, 3));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('varies with both index and salt', () => {
    const byIndex = new Set(Array.from({ length: 50 }, (_, i) => unitRandom(i, 0)));
    const bySalt = new Set(Array.from({ length: 50 }, (_, s) => unitRandom(0, s)));
    expect(byIndex.size).toBeGreaterThan(45);
    expect(bySalt.size).toBeGreaterThan(45);
  });
});

describe('rainDrops', () => {
  const drops = rainDrops(field);

  it('produces the requested count, 24 by default, deterministically', () => {
    expect(drops).toHaveLength(RAIN_DEFAULT_COUNT);
    expect(rainDrops({ ...field, count: 10 })).toHaveLength(10);
    expect(rainDrops(field)).toEqual(drops);
  });

  it('splits drops evenly across two depth layers', () => {
    const far = drops.filter((d) => d.far);
    expect(far).toHaveLength(RAIN_DEFAULT_COUNT / 2);
  });

  it('keeps every parameter inside the design ranges', () => {
    for (const d of drops) {
      expect(d.length).toBeGreaterThanOrEqual(8);
      expect(d.length).toBeLessThanOrEqual(16);
      expect(d.duration).toBeGreaterThanOrEqual(0.7);
      expect(d.duration).toBeLessThanOrEqual(1.3);
      expect(d.delay).toBeLessThanOrEqual(0);
      expect(d.delay).toBeGreaterThanOrEqual(-d.duration);
      expect(d.slant).toBeLessThan(0);
      expect(d.x).toBeGreaterThanOrEqual(field.x);
      expect(d.x).toBeLessThanOrEqual(field.x + field.width);
      expect(d.y).toBeGreaterThanOrEqual(field.y);
      expect(d.y).toBeLessThanOrEqual(field.y + 10);
      if (d.far) {
        expect(d.opacity).toBeGreaterThanOrEqual(0.22);
        expect(d.opacity).toBeLessThanOrEqual(0.42);
        expect(d.width).toBeLessThan(2);
      } else {
        expect(d.opacity).toBeGreaterThanOrEqual(0.6);
        expect(d.opacity).toBeLessThanOrEqual(0.9);
        expect(d.width).toBe(2);
      }
    }
  });

  it('spreads drops left to right across the band', () => {
    const xs = drops.map((d) => d.x);
    expect(xs[0]).toBeLessThan(field.x + field.width / 4);
    expect(xs[xs.length - 1]).toBeGreaterThan(field.x + (field.width * 3) / 4);
    expect(new Set(drops.map((d) => d.duration)).size).toBeGreaterThan(5);
  });
});

describe('snowFlakes', () => {
  const flakes = snowFlakes(field);

  it('produces the requested count, 18 by default, deterministically', () => {
    expect(flakes).toHaveLength(SNOW_DEFAULT_COUNT);
    expect(snowFlakes({ ...field, count: 6 })).toHaveLength(6);
    expect(snowFlakes(field)).toEqual(flakes);
  });

  it('keeps every parameter inside the design ranges', () => {
    for (const f of flakes) {
      expect(f.radius).toBeGreaterThanOrEqual(1.3);
      expect(f.radius).toBeLessThanOrEqual(3.2);
      expect(f.duration).toBeGreaterThanOrEqual(2.6);
      expect(f.duration).toBeLessThanOrEqual(4.6);
      expect(f.delay).toBeLessThanOrEqual(0);
      expect(Math.abs(f.sway)).toBeGreaterThanOrEqual(4);
      expect(Math.abs(f.sway)).toBeLessThanOrEqual(10);
      expect(f.x).toBeGreaterThanOrEqual(field.x);
      expect(f.x).toBeLessThanOrEqual(field.x + field.width);
      if (f.far) {
        expect(f.radius).toBeLessThanOrEqual(2);
        expect(f.opacity).toBeLessThanOrEqual(0.5);
      } else {
        expect(f.radius).toBeGreaterThanOrEqual(2);
        expect(f.opacity).toBeGreaterThanOrEqual(0.65);
      }
    }
  });

  it('sways in both directions', () => {
    expect(flakes.some((f) => f.sway < 0)).toBe(true);
    expect(flakes.some((f) => f.sway > 0)).toBe(true);
  });
});
