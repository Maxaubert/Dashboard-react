/**
 * Norwegian public holidays (helligdager) for the years currently in use
 * by the Plan calendar. Hardcoded because:
 *
 *   - The set rarely changes; only the moveable Easter-anchored dates
 *     shift each year and they're computable / lookup-able
 *   - Avoids a network round trip for static data
 *   - Works offline
 *
 * Each entry is `YYYY-MM-DD` keyed in HOLIDAYS_BY_DATE for O(1) lookup
 * from PlanPage when rendering day headers. The full list is also
 * exported for any future overview UI.
 *
 * To add a new year: append the 12 dates below and the lookup map will
 * pick them up automatically.
 */

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  /** True for fixed-date national holidays (jul, 17. mai, 1. mai, etc.). */
  fixed: boolean;
}

export const HOLIDAYS: Holiday[] = [
  // ── 2026 ─────────────────────────────────────────────────────────────
  { date: '2026-01-01', name: 'Nyttårsdag',          fixed: true },
  { date: '2026-04-02', name: 'Skjærtorsdag',        fixed: false },
  { date: '2026-04-03', name: 'Langfredag',          fixed: false },
  { date: '2026-04-05', name: 'Påskedag',            fixed: false },
  { date: '2026-04-06', name: '2. påskedag',         fixed: false },
  { date: '2026-05-01', name: 'Arbeidernes dag',     fixed: true },
  { date: '2026-05-14', name: 'Kristi himmelfart',   fixed: false },
  { date: '2026-05-17', name: 'Grunnlovsdagen',      fixed: true },
  { date: '2026-05-24', name: 'Pinsedag',            fixed: false },
  { date: '2026-05-25', name: '2. pinsedag',         fixed: false },
  { date: '2026-12-25', name: 'Juledag',             fixed: true },
  { date: '2026-12-26', name: '2. juledag',          fixed: true },

  // ── 2027 ─────────────────────────────────────────────────────────────
  { date: '2027-01-01', name: 'Nyttårsdag',          fixed: true },
  { date: '2027-03-25', name: 'Skjærtorsdag',        fixed: false },
  { date: '2027-03-26', name: 'Langfredag',          fixed: false },
  { date: '2027-03-28', name: 'Påskedag',            fixed: false },
  { date: '2027-03-29', name: '2. påskedag',         fixed: false },
  { date: '2027-05-01', name: 'Arbeidernes dag',     fixed: true },
  { date: '2027-05-06', name: 'Kristi himmelfart',   fixed: false },
  { date: '2027-05-16', name: 'Pinsedag',            fixed: false },
  { date: '2027-05-17', name: 'Grunnlovsdagen',      fixed: true },
  { date: '2027-05-17', name: '2. pinsedag',         fixed: false }, // collision: 17. mai + 2. pinsedag both fall on May 17
  { date: '2027-12-25', name: 'Juledag',             fixed: true },
  { date: '2027-12-26', name: '2. juledag',          fixed: true },
];

/**
 * Lookup map: ISO date → Holiday. When two helligdager fall on the same
 * date (e.g. 2027 has 2. pinsedag and 17. mai both on May 17) the first
 * entry in HOLIDAYS wins, so list the more recognizable one first above.
 */
export const HOLIDAYS_BY_DATE: Record<string, Holiday> = (() => {
  const map: Record<string, Holiday> = {};
  for (const h of HOLIDAYS) {
    if (!map[h.date]) map[h.date] = h;
  }
  return map;
})();

/** Convenience helper used by PlanPage. */
export function getHoliday(dateIso: string): Holiday | null {
  return HOLIDAYS_BY_DATE[dateIso] ?? null;
}
