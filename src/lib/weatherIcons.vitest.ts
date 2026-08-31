import { describe, expect, it } from 'vitest';
import { WEATHER_ICON_KEYS, iconForCode } from './weatherIcons';

describe('iconForCode', () => {
  it('maps clear skies to sun by day and moon by night', () => {
    expect(iconForCode(0)).toBe('sun');
    expect(iconForCode(0, true)).toBe('sun');
    expect(iconForCode(0, false)).toBe('moon');
  });

  it('maps mostly clear and partly cloudy', () => {
    expect(iconForCode(1)).toBe('partly');
    expect(iconForCode(2)).toBe('partly');
    expect(iconForCode(1, false)).toBe('moon');
    expect(iconForCode(2, false)).toBe('cloud');
  });

  it('maps overcast and fog', () => {
    expect(iconForCode(3)).toBe('cloud');
    expect(iconForCode(3, false)).toBe('cloud');
    expect(iconForCode(45)).toBe('fog');
    expect(iconForCode(48)).toBe('fog');
  });

  it('maps drizzle, rain and showers', () => {
    for (const code of [51, 53, 55, 56, 57]) expect(iconForCode(code)).toBe('drizzle');
    for (const code of [61, 63, 65, 66, 67, 80, 81, 82]) expect(iconForCode(code)).toBe('rain');
  });

  it('maps snow, snow grains and snow showers', () => {
    for (const code of [71, 73, 75, 77, 85, 86]) expect(iconForCode(code)).toBe('snow');
  });

  it('maps thunderstorms', () => {
    for (const code of [95, 96, 99]) expect(iconForCode(code)).toBe('thunder');
  });

  it('falls back to cloud for unknown codes', () => {
    expect(iconForCode(-1)).toBe('cloud');
    expect(iconForCode(42)).toBe('cloud');
    expect(iconForCode(120)).toBe('cloud');
  });

  it('only ever returns a key from the icon set', () => {
    for (let code = 0; code <= 99; code++) {
      expect(WEATHER_ICON_KEYS).toContain(iconForCode(code, true));
      expect(WEATHER_ICON_KEYS).toContain(iconForCode(code, false));
    }
  });
});
