import { describe, expect, it } from 'vitest';
import { forecastDayLabel } from './weatherForecast';

describe('forecastDayLabel', () => {
  it('labels today as "I dag"', () => {
    expect(forecastDayLabel('2026-09-02', '2026-09-02')).toBe('I dag');
  });

  it('formats other days as weekday plus day.month without zero padding', () => {
    // 2026-09-02 is a Wednesday.
    expect(forecastDayLabel('2026-09-02', '2026-09-01')).toBe('Ons 2.9');
    expect(forecastDayLabel('2026-09-07')).toBe('Man 7.9');
    expect(forecastDayLabel('2026-12-30')).toBe('Ons 30.12');
    expect(forecastDayLabel('2027-01-03')).toBe('Søn 3.1');
  });

  it('does not treat a day as today without a reference date', () => {
    expect(forecastDayLabel('2026-09-02')).toBe('Ons 2.9');
  });

  it('returns the raw string for an unparseable date', () => {
    expect(forecastDayLabel('not-a-date')).toBe('not-a-date');
  });
});
