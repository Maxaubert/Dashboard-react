/**
 * Pure helpers for the temperature graph on the weather bento card.
 */

export interface GraphPoint {
  hour: number;
  temp: number;
}

interface HourlyLike {
  /** Open-Meteo local ISO string without a timezone suffix ("2026-08-31T12:00"). */
  time: string;
  hour: number;
  temperature: number;
}

/** Number of hourly points in the graph: the current hour plus 24 more. */
export const GRAPH_HOURS = 25;

/**
 * The next 24 hours of temperatures, starting at the hour that is running
 * right now. 25 points, so the axis spans a full day (12 ... 12) instead of
 * stopping one hour short.
 *
 * `hourly` entries are hour-aligned and sorted; the start is the last entry
 * whose time is at or before `nowMs`. If every entry is in the future (the
 * forecast starts later than now) the window begins at the first entry.
 */
export function next24hPoints(hourly: readonly HourlyLike[], nowMs: number): GraphPoint[] {
  if (hourly.length < 2) return [];
  let start = 0;
  for (let i = 0; i < hourly.length; i++) {
    if (new Date(hourly[i].time).getTime() <= nowMs) start = i;
    else break;
  }
  return hourly
    .slice(start, start + GRAPH_HOURS)
    .map((h) => ({ hour: h.hour, temp: h.temperature }));
}
