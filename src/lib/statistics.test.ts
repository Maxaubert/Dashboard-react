import {
  parseDataset,
  computeMean,
  computeMedian,
  computeVariance,
  computeStdDev,
  computeRange,
} from './statistics';

let failed = 0;
let passed = 0;

function approxEq(actual: number, expected: number, tol = 0.001): boolean {
  return Math.abs(actual - expected) < tol;
}

function check(ok: boolean, msg: string): void {
  if (ok) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// ── parseDataset ──────────────────────────────────────────────────────────────

console.log('parseDataset: comma-separated');
{
  const result = parseDataset('1,2,3,4,5');
  check(
    JSON.stringify(result) === JSON.stringify([1, 2, 3, 4, 5]),
    'parses "1,2,3,4,5" → [1,2,3,4,5]',
  );
}

console.log('parseDataset: space-separated');
{
  const result = parseDataset('10 20 30');
  check(
    JSON.stringify(result) === JSON.stringify([10, 20, 30]),
    'parses "10 20 30" → [10,20,30]',
  );
}

console.log('parseDataset: trailing commas / extra whitespace');
{
  const result = parseDataset('7, 8, 9,');
  check(
    JSON.stringify(result) === JSON.stringify([7, 8, 9]),
    'strips trailing comma and whitespace',
  );
}

console.log('parseDataset: empty string');
{
  const result = parseDataset('');
  check(
    JSON.stringify(result) === JSON.stringify([]),
    'empty string → []',
  );
}

// ── test dataset ─────────────────────────────────────────────────────────────
const data = [12, 15, 18, 22, 25, 30, 31, 28];

// ── computeMean ───────────────────────────────────────────────────────────────

console.log('computeMean:');
{
  const { result, steps } = computeMean(data);
  check(approxEq(result as number, 22.625), 'mean([12,15,18,22,25,30,31,28]) ≈ 22.625');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step has label FORMULA');
  check(steps.some((s) => s.label === 'SUBSTITUTED'), 'has SUBSTITUTED step');
  check(steps.some((s) => s.label === 'RESULT'), 'has RESULT step');
}

// ── computeMedian ─────────────────────────────────────────────────────────────

console.log('computeMedian: even-length');
{
  const { result } = computeMedian(data);
  check(approxEq(result as number, 23.5), 'median([12,15,18,22,25,30,31,28]) ≈ 23.5');
}

console.log('computeMedian: odd-length');
{
  const { result, steps } = computeMedian([3, 1, 2]);
  check(approxEq(result as number, 2), 'median([3,1,2]) = 2');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step has label FORMULA');
}

// ── computeVariance ───────────────────────────────────────────────────────────

console.log('computeVariance: sample variance');
{
  const { result, steps } = computeVariance(data);
  check(approxEq(result as number, 50.268, 0.01), 'variance([12,15,18,22,25,30,31,28]) ≈ 50.268');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step has label FORMULA');
  check(steps.some((s) => s.label === 'SUBSTITUTED'), 'has SUBSTITUTED step');
  check(steps.some((s) => s.label === 'RESULT'), 'has RESULT step');
}

// ── computeStdDev ─────────────────────────────────────────────────────────────

console.log('computeStdDev: sample std dev');
{
  const { result, steps } = computeStdDev(data);
  check(approxEq(result as number, 7.09, 0.01), 'stddev([12,15,18,22,25,30,31,28]) ≈ 7.09');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step has label FORMULA');
}

// ── computeRange ──────────────────────────────────────────────────────────────

console.log('computeRange:');
{
  const { result, steps } = computeRange(data);
  check(approxEq(result as number, 19), 'range([12,15,18,22,25,30,31,28]) = 19');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step has label FORMULA');
  check(steps.some((s) => s.label === 'SUBSTITUTED'), 'has SUBSTITUTED step');
  check(steps.some((s) => s.label === 'RESULT'), 'has RESULT step');
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
