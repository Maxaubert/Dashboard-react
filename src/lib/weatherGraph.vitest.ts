import { describe, expect, it } from 'vitest';
import { GRAPH_HOURS, next24hPoints } from './weatherGraph';

function hourly(startIso: string, count: number) {
  const out = [];
  const t = new Date(startIso);
  for (let i = 0; i < count; i++) {
    const d = new Date(t.getTime() + i * 3_600_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
    out.push({ time, hour: d.getHours(), temperature: i });
  }
  return out;
}

describe('next24hPoints', () => {
  const data = hourly('2026-08-31T00:00', 72);

  it('starts at the hour that is running now and spans a full day', () => {
    const now = new Date('2026-08-31T12:27:00').getTime();
    const pts = next24hPoints(data, now);
    expect(pts).toHaveLength(GRAPH_HOURS);
    expect(pts[0]).toEqual({ hour: 12, temp: 12 });
    expect(pts[pts.length - 1]).toEqual({ hour: 12, temp: 36 });
  });

  it('starts at the exact hour boundary without stepping back', () => {
    const now = new Date('2026-08-31T15:00:00').getTime();
    expect(next24hPoints(data, now)[0].hour).toBe(15);
  });

  it('falls back to the first entry when the forecast starts in the future', () => {
    const now = new Date('2026-08-30T20:00:00').getTime();
    expect(next24hPoints(data, now)[0].hour).toBe(0);
  });

  it('returns what is left near the end of the data', () => {
    const now = new Date('2026-09-02T20:00:00').getTime();
    expect(next24hPoints(data, now)).toHaveLength(4);
  });

  it('returns nothing for fewer than two entries', () => {
    expect(next24hPoints(data.slice(0, 1), 0)).toEqual([]);
  });
});
