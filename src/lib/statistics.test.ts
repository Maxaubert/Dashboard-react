import {
  parseDataset,
  computeMean,
  computeMedian,
  computeVariance,
  computeStdDev,
  computeRange,
  computeNormalCdf,
  computeNormalInv,
  computeTCdf,
  computeTInv,
  computeChi2Cdf,
  computeChi2Inv,
  computeFCdf,
  computeFInv,
  computeBinomialPmf,
  computeBinomialCdf,
  computePoissonPmf,
  computePoissonCdf,
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

// ── computeNormalCdf ──────────────────────────────────────────────────────────

console.log('computeNormalCdf:');
{
  const left = computeNormalCdf(1.96, 'left');
  check(approxEq(left.result as number, 0.975, 0.001), 'P(Z ≤ 1.96) ≈ 0.975');
  check(left.steps.length >= 3, 'returns at least 3 steps');
  check(left.steps[0].label === 'FORMULA', 'first step is FORMULA');

  const right = computeNormalCdf(1.96, 'right');
  check(approxEq(right.result as number, 0.025, 0.001), 'P(Z ≥ 1.96) ≈ 0.025');

  const two = computeNormalCdf(1.96, 'two');
  check(approxEq(two.result as number, 0.05, 0.001), 'two-tail P(|Z| ≥ 1.96) ≈ 0.05');
}

// ── computeNormalInv ──────────────────────────────────────────────────────────

console.log('computeNormalInv:');
{
  const { result, steps } = computeNormalInv(0.975);
  check(approxEq(result as number, 1.96, 0.001), 'inv(0.975) ≈ 1.96');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeTCdf ───────────────────────────────────────────────────────────────

console.log('computeTCdf:');
{
  const left = computeTCdf(2.228, 10, 'left');
  check(approxEq(left.result as number, 0.975, 0.001), 'P(T ≤ 2.228, df=10) ≈ 0.975');
  check(left.steps.length >= 3, 'returns at least 3 steps');
  check(left.steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeTInv ───────────────────────────────────────────────────────────────

console.log('computeTInv:');
{
  const { result, steps } = computeTInv(0.975, 10);
  check(approxEq(result as number, 2.228, 0.001), 'inv(0.975, df=10) ≈ 2.228');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeChi2Cdf ────────────────────────────────────────────────────────────

console.log('computeChi2Cdf:');
{
  const left = computeChi2Cdf(18.307, 10, 'left');
  check(approxEq(left.result as number, 0.95, 0.001), 'P(X² ≤ 18.307, df=10) ≈ 0.95');
  check(left.steps.length >= 3, 'returns at least 3 steps');
  check(left.steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeChi2Inv ────────────────────────────────────────────────────────────

console.log('computeChi2Inv:');
{
  const { result, steps } = computeChi2Inv(0.95, 10);
  check(approxEq(result as number, 18.307, 0.01), 'inv(0.95, df=10) ≈ 18.307');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeFCdf ───────────────────────────────────────────────────────────────

console.log('computeFCdf:');
{
  const left = computeFCdf(3.35, 3, 20, 'left');
  check(approxEq(left.result as number, 0.96, 0.01), 'P(F ≤ 3.35, df1=3, df2=20) ≈ 0.96');
  check(left.steps.length >= 3, 'returns at least 3 steps');
  check(left.steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeFInv ───────────────────────────────────────────────────────────────

console.log('computeFInv:');
{
  const { result, steps } = computeFInv(0.95, 3, 20);
  check(approxEq(result as number, 3.10, 0.05), 'inv(0.95, df1=3, df2=20) ≈ 3.10');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeBinomialPmf ────────────────────────────────────────────────────────

console.log('computeBinomialPmf:');
{
  const { result, steps } = computeBinomialPmf(10, 0.5, 5);
  check(approxEq(result as number, 0.2461, 0.001), 'PMF(n=10, p=0.5, k=5) ≈ 0.2461');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computeBinomialCdf ────────────────────────────────────────────────────────

console.log('computeBinomialCdf:');
{
  const { result, steps } = computeBinomialCdf(10, 0.5, 5);
  check(approxEq(result as number, 0.623, 0.001), 'CDF(n=10, p=0.5, k=5) ≈ 0.623');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computePoissonPmf ─────────────────────────────────────────────────────────

console.log('computePoissonPmf:');
{
  // PMF(λ=3, k=2): (3^2 * e^-3) / 2! = (9 * 0.0498) / 2 ≈ 0.224
  const { result, steps } = computePoissonPmf(3, 2);
  check(approxEq(result as number, 0.224, 0.001), 'PMF(λ=3, k=2) ≈ 0.224');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── computePoissonCdf ─────────────────────────────────────────────────────────

console.log('computePoissonCdf:');
{
  // CDF(λ=2, k=3): P(X≤3 | λ=2) ≈ 0.857
  const { result, steps } = computePoissonCdf(2, 3);
  check(approxEq(result as number, 0.857, 0.001), 'CDF(λ=2, k=3) ≈ 0.857');
  check(steps.length >= 3, 'returns at least 3 steps');
  check(steps[0].label === 'FORMULA', 'first step is FORMULA');
}

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
