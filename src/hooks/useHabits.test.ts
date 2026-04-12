import { todayISO, addDays, calcStreak } from './useHabits';

let passed = 0;
let failed = 0;

function check(ok: boolean, msg: string): void {
  if (ok) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function eq(actual: unknown, expected: unknown, msg: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(a === e, `${msg} (expected ${e}, got ${a})`);
}

// ── todayISO ──────────────────────────────────────────────────────────────────

console.log('todayISO:');
{
  const iso = todayISO();
  check(/^\d{4}-\d{2}-\d{2}$/.test(iso), `matches YYYY-MM-DD format (got "${iso}")`);

  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  eq(iso, expected, 'returns local today');
}

// ── addDays ───────────────────────────────────────────────────────────────────

console.log('addDays: add 1 day');
eq(addDays('2024-01-15', 1), '2024-01-16', '+1 normal day');

console.log('addDays: subtract 1 day');
eq(addDays('2024-01-15', -1), '2024-01-14', '-1 normal day');

console.log('addDays: cross month boundary (forward)');
eq(addDays('2024-01-31', 1), '2024-02-01', 'Jan 31 + 1 = Feb 01');

console.log('addDays: cross month boundary (backward)');
eq(addDays('2024-03-01', -1), '2024-02-29', 'Mar 01 - 1 = Feb 29 (leap year)');

console.log('addDays: cross year boundary (forward)');
eq(addDays('2023-12-31', 1), '2024-01-01', 'Dec 31 + 1 = Jan 01 next year');

console.log('addDays: cross year boundary (backward)');
eq(addDays('2024-01-01', -1), '2023-12-31', 'Jan 01 - 1 = Dec 31 prev year');

// ── calcStreak ────────────────────────────────────────────────────────────────

console.log('calcStreak: empty array');
eq(calcStreak([]), 0, 'empty → 0');

console.log('calcStreak: just today');
{
  const today = todayISO();
  eq(calcStreak([today]), 1, 'just today → 1');
}

console.log('calcStreak: today + 2 previous consecutive days');
{
  const today = todayISO();
  const d1 = addDays(today, -1);
  const d2 = addDays(today, -2);
  eq(calcStreak([today, d1, d2]), 3, 'today + 2 prior = 3');
}

console.log('calcStreak: yesterday + 2 prior (grace period)');
{
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const d2 = addDays(today, -2);
  const d3 = addDays(today, -3);
  // today NOT completed, but yesterday is — grace period should give streak of 3
  eq(calcStreak([yesterday, d2, d3]), 3, 'grace period: yesterday+2 prior = 3');
}

console.log('calcStreak: gap of 2+ days breaks streak');
{
  const today = todayISO();
  const d2 = addDays(today, -2); // today and yesterday missing
  const d3 = addDays(today, -3);
  eq(calcStreak([d2, d3]), 0, 'gap of 2 → 0 (no grace for 2 days ago)');
}

console.log('calcStreak: today present but gap before it');
{
  const today = todayISO();
  const d2 = addDays(today, -2); // skip yesterday
  // today is in the set, streak starts at today but stops since yesterday missing
  eq(calcStreak([today, d2]), 1, 'today only (gap at yesterday) → 1');
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
