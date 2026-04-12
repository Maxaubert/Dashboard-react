# Statistics Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Statistics mode to the calculator with 22 stat functions, step-by-step formula display, and visual polish on both modes.

**Architecture:** Page shell with pill toggle switches between ScientificCalculator and StatsCalculator. Stats mode uses a button grid + expanding form pattern. Pure math in `statistics.ts` returns results + formula steps. `jstat` handles distribution CDFs.

**Tech Stack:** React 18 + TypeScript, mathjs (existing, scientific mode), jstat (new, distribution CDFs), tsx (test runner)

**Worktree:** `.worktrees/feat-statistics-calculator`

---

### Task 1: Install jstat and add types

**Files:**
- Modify: `.worktrees/feat-statistics-calculator/package.json`

- [ ] **Step 1: Install jstat**

Run from the worktree root:
```bash
cd .worktrees/feat-statistics-calculator && npm install jstat
```

- [ ] **Step 2: Verify it imports**

Create a quick check — open a node repl or run:
```bash
cd .worktrees/feat-statistics-calculator && npx tsx -e "import { jStat } from 'jstat'; console.log(jStat.normal.cdf(1.96, 0, 1))"
```
Expected: `0.9750021...` (approximately 0.975)

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add package.json package-lock.json
git commit -m "chore: add jstat dependency for distribution CDFs"
```

---

### Task 2: Implement statistics.ts — types and descriptive functions

**Files:**
- Create: `src/lib/statistics.ts`
- Create: `src/lib/statistics.test.ts`

- [ ] **Step 1: Write the test file for descriptive stats**

Create `src/lib/statistics.test.ts`:

```typescript
import {
  computeMean,
  computeMedian,
  computeVariance,
  computeStdDev,
  computeRange,
  parseDataset,
} from './statistics';
import type { StatResult } from './statistics';

let failed = 0;
let passed = 0;

function approxEq(actual: number, expected: number, tol = 0.001): boolean {
  return Math.abs(actual - expected) < tol;
}

function check(ok: boolean, msg: string): void {
  if (ok) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ ${msg}`); }
}

// ── parseDataset ──────────────────────────────────────────────────────────

console.log('\nparseDataset');
check(
  JSON.stringify(parseDataset('12, 15, 18')) === JSON.stringify([12, 15, 18]),
  'comma-separated'
);
check(
  JSON.stringify(parseDataset('12 15 18')) === JSON.stringify([12, 15, 18]),
  'space-separated'
);
check(
  JSON.stringify(parseDataset('12, , 15,  18, ')) === JSON.stringify([12, 15, 18]),
  'handles trailing commas and gaps'
);
check(
  JSON.stringify(parseDataset('')) === JSON.stringify([]),
  'empty string'
);

// ── mean ──────────────────────────────────────────────────────────────────

console.log('\ncomputeMean');
{
  const r = computeMean([12, 15, 18, 22, 25, 30, 31, 28]);
  check(approxEq(r.result as number, 22.625), `result = ${r.result}`);
  check(r.steps.length >= 2, `has ${r.steps.length} steps`);
}

// ── median ────────────────────────────────────────────────────────────────

console.log('\ncomputeMedian');
{
  const r = computeMedian([12, 15, 18, 22, 25, 30, 31, 28]);
  check(approxEq(r.result as number, 23.5), `even count median = ${r.result}`);
}
{
  const r = computeMedian([3, 1, 2]);
  check(approxEq(r.result as number, 2), `odd count median = ${r.result}`);
}

// ── variance ──────────────────────────────────────────────────────────────

console.log('\ncomputeVariance');
{
  const r = computeVariance([12, 15, 18, 22, 25, 30, 31, 28]);
  check(approxEq(r.result as number, 50.268), `sample variance = ${r.result}`);
  check(r.steps.length >= 3, `has ${r.steps.length} steps`);
}

// ── stddev ────────────────────────────────────────────────────────────────

console.log('\ncomputeStdDev');
{
  const r = computeStdDev([12, 15, 18, 22, 25, 30, 31, 28]);
  check(approxEq(r.result as number, 7.09, 0.01), `sample stddev = ${r.result}`);
}

// ── range ─────────────────────────────────────────────────────────────────

console.log('\ncomputeRange');
{
  const r = computeRange([12, 15, 18, 22, 25, 30, 31, 28]);
  check(approxEq(r.result as number, 19), `range = ${r.result}`);
}

// ── summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types and descriptive functions**

Create `src/lib/statistics.ts`:

```typescript
/** A single step in the formula display. */
export interface FormulaStep {
  /** Label like "FORMULA", "SUBSTITUTED", "RESULT" */
  label: string;
  /** The expression/text to display (may contain math symbols) */
  content: string;
}

/** Return type for all stat functions. */
export interface StatResult {
  result: number | Record<string, number>;
  steps: FormulaStep[];
}

/** Parse a string of comma/space separated numbers into an array. */
export function parseDataset(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .filter((s) => s.length > 0)
    .map(Number)
    .filter((n) => !isNaN(n));
}

export function computeMean(data: number[]): StatResult {
  const n = data.length;
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  return {
    result: mean,
    steps: [
      { label: 'FORMULA', content: 'x̄ = Σxᵢ / n' },
      { label: 'SUBSTITUTED', content: `x̄ = (${data.join(' + ')}) / ${n} = ${sum} / ${n}` },
      { label: 'RESULT', content: `x̄ = ${+mean.toFixed(6)}` },
    ],
  };
}

export function computeMedian(data: number[]): StatResult {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  let median: number;
  let substep: string;
  if (n % 2 === 1) {
    median = sorted[Math.floor(n / 2)];
    substep = `Sorted: [${sorted.join(', ')}]\nMiddle value (position ${Math.floor(n / 2) + 1}): ${median}`;
  } else {
    const lo = sorted[n / 2 - 1];
    const hi = sorted[n / 2];
    median = (lo + hi) / 2;
    substep = `Sorted: [${sorted.join(', ')}]\nMiddle values: ${lo} and ${hi}\nMedian = (${lo} + ${hi}) / 2`;
  }
  return {
    result: median,
    steps: [
      { label: 'FORMULA', content: 'Median = middle value of sorted data' },
      { label: 'SUBSTITUTED', content: substep },
      { label: 'RESULT', content: `Median = ${+median.toFixed(6)}` },
    ],
  };
}

export function computeVariance(data: number[]): StatResult {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const diffs = data.map((x) => x - mean);
  const squaredDiffs = diffs.map((d) => d * d);
  const sumSq = squaredDiffs.reduce((a, b) => a + b, 0);
  const variance = sumSq / (n - 1);
  return {
    result: variance,
    steps: [
      { label: 'FORMULA', content: 's² = Σ(xᵢ − x̄)² / (n − 1)' },
      {
        label: 'SUBSTITUTED',
        content: [
          `x̄ = ${+mean.toFixed(6)}`,
          `Σ(xᵢ − x̄)² = ${data.map((x) => `(${x} − ${+mean.toFixed(3)})²`).join(' + ')}`,
          `  = ${squaredDiffs.map((s) => +s.toFixed(2)).join(' + ')} = ${+sumSq.toFixed(3)}`,
          `s² = ${+sumSq.toFixed(3)} / ${n - 1}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `s² = ${+variance.toFixed(6)}` },
    ],
  };
}

export function computeStdDev(data: number[]): StatResult {
  const varResult = computeVariance(data);
  const variance = varResult.result as number;
  const stddev = Math.sqrt(variance);
  return {
    result: stddev,
    steps: [
      { label: 'FORMULA', content: 's = √[Σ(xᵢ − x̄)² / (n − 1)]' },
      {
        label: 'SUBSTITUTED',
        content: varResult.steps[1].content + `\ns = √${+variance.toFixed(6)}`,
      },
      { label: 'RESULT', content: `s = ${+stddev.toFixed(6)}` },
    ],
  };
}

export function computeRange(data: number[]): StatResult {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  return {
    result: range,
    steps: [
      { label: 'FORMULA', content: 'Range = max − min' },
      { label: 'SUBSTITUTED', content: `Range = ${max} − ${min}` },
      { label: 'RESULT', content: `Range = ${range}` },
    ],
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/lib/statistics.ts src/lib/statistics.test.ts
git commit -m "feat(stats): add descriptive statistics functions with formula steps"
```

---

### Task 3: Implement statistics.ts — distribution functions

**Files:**
- Modify: `src/lib/statistics.ts`
- Modify: `src/lib/statistics.test.ts`

- [ ] **Step 1: Add distribution tests to statistics.test.ts**

Append to `src/lib/statistics.test.ts` before the summary block:

```typescript
import {
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

// ── Normal Z ──────────────────────────────────────────────────────────────

console.log('\nNormal Z');
check(approxEq(computeNormalCdf(1.96, 'left').result as number, 0.975, 0.001), 'P(Z ≤ 1.96) ≈ 0.975');
check(approxEq(computeNormalCdf(1.96, 'right').result as number, 0.025, 0.001), 'P(Z ≥ 1.96) ≈ 0.025');
check(approxEq(computeNormalCdf(1.96, 'two').result as number, 0.05, 0.001), 'two-tail ≈ 0.05');
check(approxEq(computeNormalInv(0.975).result as number, 1.96, 0.01), 'inv(0.975) ≈ 1.96');

// ── t-distribution ────────────────────────────────────────────────────────

console.log('\nt-distribution');
check(approxEq(computeTCdf(2.228, 10, 'left').result as number, 0.975, 0.01), 't CDF left');
check(approxEq(computeTInv(0.975, 10).result as number, 2.228, 0.01), 't inverse');

// ── Chi-square ────────────────────────────────────────────────────────────

console.log('\nChi-square');
check(approxEq(computeChi2Cdf(18.307, 10, 'left').result as number, 0.95, 0.01), 'χ² CDF');
check(approxEq(computeChi2Inv(0.95, 10).result as number, 18.307, 0.1), 'χ² inverse');

// ── F-distribution ────────────────────────────────────────────────────────

console.log('\nF-distribution');
check(approxEq(computeFCdf(3.35, 3, 20, 'left').result as number, 0.96, 0.02), 'F CDF');
check(approxEq(computeFInv(0.95, 3, 20).result as number, 3.10, 0.1), 'F inverse');

// ── Binomial ──────────────────────────────────────────────────────────────

console.log('\nBinomial');
check(approxEq(computeBinomialPmf(10, 0.5, 5).result as number, 0.2461, 0.001), 'Binom PMF');
check(approxEq(computeBinomialCdf(10, 0.5, 5).result as number, 0.623, 0.01), 'Binom CDF');

// ── Poisson ───────────────────────────────────────────────────────────────

console.log('\nPoisson');
check(approxEq(computePoissonPmf(3, 2).result as number, 0.224, 0.01), 'Poisson PMF');
check(approxEq(computePoissonCdf(3, 2).result as number, 0.857, 0.01), 'Poisson CDF');
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement distribution functions**

Append to `src/lib/statistics.ts`:

```typescript
import { jStat } from 'jstat';

type Tail = 'left' | 'right' | 'two';

export function computeNormalCdf(z: number, tail: Tail): StatResult {
  const leftP = jStat.normal.cdf(z, 0, 1);
  let p: number;
  let desc: string;
  if (tail === 'left') { p = leftP; desc = `P(Z ≤ ${z})`; }
  else if (tail === 'right') { p = 1 - leftP; desc = `P(Z ≥ ${z})`; }
  else { p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1)); desc = `P(|Z| ≥ ${Math.abs(z)})`; }
  return {
    result: p,
    steps: [
      { label: 'FORMULA', content: `${desc} using standard normal distribution` },
      { label: 'SUBSTITUTED', content: `Φ(${z}) = ${+leftP.toFixed(6)}${tail !== 'left' ? `\n${desc} = ${+p.toFixed(6)}` : ''}` },
      { label: 'RESULT', content: `p = ${+p.toFixed(6)}` },
    ],
  };
}

export function computeNormalInv(p: number): StatResult {
  const z = jStat.normal.inv(p, 0, 1);
  return {
    result: z,
    steps: [
      { label: 'FORMULA', content: 'Find z such that Φ(z) = p' },
      { label: 'SUBSTITUTED', content: `Φ⁻¹(${p}) = ${+z.toFixed(6)}` },
      { label: 'RESULT', content: `z = ${+z.toFixed(6)}` },
    ],
  };
}

export function computeTCdf(t: number, df: number, tail: Tail): StatResult {
  const leftP = jStat.studentt.cdf(t, df);
  let p: number;
  let desc: string;
  if (tail === 'left') { p = leftP; desc = `P(T ≤ ${t})`; }
  else if (tail === 'right') { p = 1 - leftP; desc = `P(T ≥ ${t})`; }
  else { p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df)); desc = `P(|T| ≥ ${Math.abs(t)})`; }
  return {
    result: p,
    steps: [
      { label: 'FORMULA', content: `${desc}, df = ${df}` },
      { label: 'SUBSTITUTED', content: `t-CDF(${t}, df=${df}) = ${+leftP.toFixed(6)}${tail !== 'left' ? `\n${desc} = ${+p.toFixed(6)}` : ''}` },
      { label: 'RESULT', content: `p = ${+p.toFixed(6)}` },
    ],
  };
}

export function computeTInv(p: number, df: number): StatResult {
  const t = jStat.studentt.inv(p, df);
  return {
    result: t,
    steps: [
      { label: 'FORMULA', content: `Find t such that P(T ≤ t) = ${p}, df = ${df}` },
      { label: 'SUBSTITUTED', content: `t⁻¹(${p}, df=${df}) = ${+t.toFixed(6)}` },
      { label: 'RESULT', content: `t = ${+t.toFixed(6)}` },
    ],
  };
}

export function computeChi2Cdf(x: number, df: number, tail: Tail): StatResult {
  const leftP = jStat.chisquare.cdf(x, df);
  let p: number;
  let desc: string;
  if (tail === 'left') { p = leftP; desc = `P(χ² ≤ ${x})`; }
  else if (tail === 'right') { p = 1 - leftP; desc = `P(χ² ≥ ${x})`; }
  else { p = 2 * Math.min(leftP, 1 - leftP); desc = `two-tail p for χ² = ${x}`; }
  return {
    result: p,
    steps: [
      { label: 'FORMULA', content: `${desc}, df = ${df}` },
      { label: 'SUBSTITUTED', content: `χ²-CDF(${x}, df=${df}) = ${+leftP.toFixed(6)}${tail !== 'left' ? `\n${desc} = ${+p.toFixed(6)}` : ''}` },
      { label: 'RESULT', content: `p = ${+p.toFixed(6)}` },
    ],
  };
}

export function computeChi2Inv(p: number, df: number): StatResult {
  const x = jStat.chisquare.inv(p, df);
  return {
    result: x,
    steps: [
      { label: 'FORMULA', content: `Find χ² such that P(χ² ≤ x) = ${p}, df = ${df}` },
      { label: 'SUBSTITUTED', content: `χ²⁻¹(${p}, df=${df}) = ${+x.toFixed(6)}` },
      { label: 'RESULT', content: `χ² = ${+x.toFixed(6)}` },
    ],
  };
}

export function computeFCdf(f: number, df1: number, df2: number, tail: Tail): StatResult {
  const leftP = jStat.centralF.cdf(f, df1, df2);
  let p: number;
  let desc: string;
  if (tail === 'left') { p = leftP; desc = `P(F ≤ ${f})`; }
  else if (tail === 'right') { p = 1 - leftP; desc = `P(F ≥ ${f})`; }
  else { p = 2 * Math.min(leftP, 1 - leftP); desc = `two-tail p for F = ${f}`; }
  return {
    result: p,
    steps: [
      { label: 'FORMULA', content: `${desc}, df₁ = ${df1}, df₂ = ${df2}` },
      { label: 'SUBSTITUTED', content: `F-CDF(${f}, df₁=${df1}, df₂=${df2}) = ${+leftP.toFixed(6)}${tail !== 'left' ? `\n${desc} = ${+p.toFixed(6)}` : ''}` },
      { label: 'RESULT', content: `p = ${+p.toFixed(6)}` },
    ],
  };
}

export function computeFInv(p: number, df1: number, df2: number): StatResult {
  const f = jStat.centralF.inv(p, df1, df2);
  return {
    result: f,
    steps: [
      { label: 'FORMULA', content: `Find F such that P(F ≤ f) = ${p}, df₁ = ${df1}, df₂ = ${df2}` },
      { label: 'SUBSTITUTED', content: `F⁻¹(${p}, df₁=${df1}, df₂=${df2}) = ${+f.toFixed(6)}` },
      { label: 'RESULT', content: `F = ${+f.toFixed(6)}` },
    ],
  };
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function comb(n: number, k: number): number {
  return factorial(n) / (factorial(k) * factorial(n - k));
}

export function computeBinomialPmf(n: number, p: number, k: number): StatResult {
  const coeff = comb(n, k);
  const prob = coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);
  return {
    result: prob,
    steps: [
      { label: 'FORMULA', content: 'P(X = k) = C(n,k) · pᵏ · (1−p)ⁿ⁻ᵏ' },
      {
        label: 'SUBSTITUTED',
        content: `C(${n},${k}) = ${coeff}\nP(X = ${k}) = ${coeff} · ${p}^${k} · ${+(1 - p).toFixed(4)}^${n - k}\n  = ${coeff} · ${+Math.pow(p, k).toFixed(6)} · ${+Math.pow(1 - p, n - k).toFixed(6)}`,
      },
      { label: 'RESULT', content: `P(X = ${k}) = ${+prob.toFixed(6)}` },
    ],
  };
}

export function computeBinomialCdf(n: number, p: number, k: number): StatResult {
  let cumulative = 0;
  for (let i = 0; i <= k; i++) {
    cumulative += comb(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return {
    result: cumulative,
    steps: [
      { label: 'FORMULA', content: 'P(X ≤ k) = Σᵢ₌₀ᵏ C(n,i) · pⁱ · (1−p)ⁿ⁻ⁱ' },
      { label: 'SUBSTITUTED', content: `P(X ≤ ${k}) = Σᵢ₌₀^${k} C(${n},i) · ${p}ⁱ · ${+(1 - p).toFixed(4)}^(${n}−i)` },
      { label: 'RESULT', content: `P(X ≤ ${k}) = ${+cumulative.toFixed(6)}` },
    ],
  };
}

export function computePoissonPmf(lambda: number, k: number): StatResult {
  const prob = (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
  return {
    result: prob,
    steps: [
      { label: 'FORMULA', content: 'P(X = k) = (λᵏ · e⁻λ) / k!' },
      {
        label: 'SUBSTITUTED',
        content: `P(X = ${k}) = (${lambda}^${k} · e^−${lambda}) / ${k}!\n  = (${+Math.pow(lambda, k).toFixed(4)} · ${+Math.exp(-lambda).toFixed(6)}) / ${factorial(k)}`,
      },
      { label: 'RESULT', content: `P(X = ${k}) = ${+prob.toFixed(6)}` },
    ],
  };
}

export function computePoissonCdf(lambda: number, k: number): StatResult {
  let cumulative = 0;
  for (let i = 0; i <= k; i++) {
    cumulative += (Math.pow(lambda, i) * Math.exp(-lambda)) / factorial(i);
  }
  return {
    result: cumulative,
    steps: [
      { label: 'FORMULA', content: 'P(X ≤ k) = Σᵢ₌₀ᵏ (λⁱ · e⁻λ) / i!' },
      { label: 'SUBSTITUTED', content: `P(X ≤ ${k}) = Σᵢ₌₀^${k} (${lambda}ⁱ · e^−${lambda}) / i!` },
      { label: 'RESULT', content: `P(X ≤ ${k}) = ${+cumulative.toFixed(6)}` },
    ],
  };
}
```

Note: The `import { jStat } from 'jstat'` goes at the top of the file, after the type exports.

- [ ] **Step 4: Run tests**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/lib/statistics.ts src/lib/statistics.test.ts
git commit -m "feat(stats): add distribution CDF/inverse functions"
```

---

### Task 4: Implement statistics.ts — hypothesis tests

**Files:**
- Modify: `src/lib/statistics.ts`
- Modify: `src/lib/statistics.test.ts`

- [ ] **Step 1: Add hypothesis test tests**

Append to `src/lib/statistics.test.ts` before the summary block:

```typescript
import {
  computeZTest,
  computeOneSampleTTest,
  computeTwoSampleTTest,
  computePairedTTest,
  computeAnova,
  computePValue,
} from './statistics';

// ── z-test ────────────────────────────────────────────────────────────────

console.log('\nz-test');
{
  const r = computeZTest(105, 100, 15, 36, 'two');
  const res = r.result as Record<string, number>;
  check(approxEq(res.z, 2.0, 0.01), `z = ${res.z}`);
  check(approxEq(res.p, 0.0455, 0.01), `p = ${res.p}`);
}

// ── one-sample t-test ─────────────────────────────────────────────────────

console.log('\none-sample t-test');
{
  const r = computeOneSampleTTest(5.2, 5.0, 0.3, 25, 'two');
  const res = r.result as Record<string, number>;
  check(approxEq(res.t, 3.333, 0.01), `t = ${res.t}`);
  check(res.p < 0.01, `p = ${res.p} < 0.01`);
}

// ── two-sample t-test (Welch's) ───────────────────────────────────────────

console.log('\ntwo-sample t-test');
{
  const r = computeTwoSampleTTest(24.5, 4.2, 30, 21.8, 3.9, 28, 'two');
  const res = r.result as Record<string, number>;
  check(approxEq(res.t, 2.53, 0.1), `t = ${res.t}`);
  check(res.p < 0.05, `p = ${res.p} < 0.05`);
}

// ── paired t-test ─────────────────────────────────────────────────────────

console.log('\npaired t-test');
{
  const r = computePairedTTest([85, 90, 78, 92, 88], [88, 95, 82, 94, 91], 'two');
  const res = r.result as Record<string, number>;
  check(approxEq(res.t, 6.667, 0.1), `t = ${res.t}`);
  check(res.p < 0.01, `p = ${res.p} < 0.01`);
}

// ── ANOVA ─────────────────────────────────────────────────────────────────

console.log('\nANOVA');
{
  const r = computeAnova([[23, 25, 27, 22, 26], [30, 32, 29, 31, 33], [18, 20, 19, 21, 17]]);
  const res = r.result as Record<string, number>;
  check(res.F > 10, `F = ${res.F} > 10`);
  check(res.p < 0.01, `p = ${res.p} < 0.01`);
  check(approxEq(res.dfBetween, 2), `dfBetween = ${res.dfBetween}`);
  check(approxEq(res.dfWithin, 12), `dfWithin = ${res.dfWithin}`);
}

// ── p-value calculator ────────────────────────────────────────────────────

console.log('\np-value calculator');
{
  const r = computePValue(1.96, 'normal', 'two', {});
  check(approxEq(r.result as number, 0.05, 0.001), `normal two-tail p = ${r.result}`);
}
{
  const r = computePValue(2.228, 't', 'two', { df: 10 });
  check(approxEq(r.result as number, 0.05, 0.01), `t two-tail p = ${r.result}`);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement hypothesis test functions**

Append to `src/lib/statistics.ts`:

```typescript
export function computeZTest(
  xbar: number, mu0: number, sigma: number, n: number, tail: Tail,
): StatResult {
  const se = sigma / Math.sqrt(n);
  const z = (xbar - mu0) / se;
  const leftP = jStat.normal.cdf(z, 0, 1);
  let p: number;
  if (tail === 'left') p = leftP;
  else if (tail === 'right') p = 1 - leftP;
  else p = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));
  return {
    result: { z: +z.toFixed(6), p: +p.toFixed(6) },
    steps: [
      { label: 'FORMULA', content: 'z = (x̄ − μ₀) / (σ / √n)' },
      {
        label: 'SUBSTITUTED',
        content: [
          `SE = σ / √n = ${sigma} / √${n} = ${sigma} / ${+Math.sqrt(n).toFixed(4)} = ${+se.toFixed(6)}`,
          `z = (${xbar} − ${mu0}) / ${+se.toFixed(6)} = ${+(xbar - mu0).toFixed(6)} / ${+se.toFixed(6)}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `z = ${+z.toFixed(6)}, p = ${+p.toFixed(6)} (${tail}-tailed)` },
    ],
  };
}

export function computeOneSampleTTest(
  xbar: number, mu0: number, s: number, n: number, tail: Tail,
): StatResult {
  const se = s / Math.sqrt(n);
  const t = (xbar - mu0) / se;
  const df = n - 1;
  const leftP = jStat.studentt.cdf(t, df);
  let p: number;
  if (tail === 'left') p = leftP;
  else if (tail === 'right') p = 1 - leftP;
  else p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return {
    result: { t: +t.toFixed(6), p: +p.toFixed(6), df },
    steps: [
      { label: 'FORMULA', content: 't = (x̄ − μ₀) / (s / √n)' },
      {
        label: 'SUBSTITUTED',
        content: [
          `SE = s / √n = ${s} / √${n} = ${+se.toFixed(6)}`,
          `t = (${xbar} − ${mu0}) / ${+se.toFixed(6)} = ${+t.toFixed(6)}`,
          `df = n − 1 = ${df}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `t = ${+t.toFixed(6)}, df = ${df}, p = ${+p.toFixed(6)} (${tail}-tailed)` },
    ],
  };
}

export function computeTwoSampleTTest(
  xbar1: number, s1: number, n1: number,
  xbar2: number, s2: number, n2: number,
  tail: Tail,
): StatResult {
  const se = Math.sqrt((s1 * s1) / n1 + (s2 * s2) / n2);
  const t = (xbar1 - xbar2) / se;
  // Welch–Satterthwaite degrees of freedom
  const num = Math.pow((s1 * s1) / n1 + (s2 * s2) / n2, 2);
  const den =
    Math.pow((s1 * s1) / n1, 2) / (n1 - 1) +
    Math.pow((s2 * s2) / n2, 2) / (n2 - 1);
  const df = num / den;
  const leftP = jStat.studentt.cdf(t, df);
  let p: number;
  if (tail === 'left') p = leftP;
  else if (tail === 'right') p = 1 - leftP;
  else p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return {
    result: { t: +t.toFixed(6), p: +p.toFixed(6), df: +df.toFixed(2) },
    steps: [
      { label: 'FORMULA', content: 't = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)   [Welch\'s t-test]' },
      {
        label: 'SUBSTITUTED',
        content: [
          `SE = √(${s1}²/${n1} + ${s2}²/${n2}) = √(${+(s1 * s1 / n1).toFixed(4)} + ${+(s2 * s2 / n2).toFixed(4)}) = ${+se.toFixed(6)}`,
          `t = (${xbar1} − ${xbar2}) / ${+se.toFixed(6)} = ${+t.toFixed(6)}`,
          `df (Welch-Satterthwaite) = ${+df.toFixed(2)}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `t = ${+t.toFixed(6)}, df = ${+df.toFixed(2)}, p = ${+p.toFixed(6)} (${tail}-tailed)` },
    ],
  };
}

export function computePairedTTest(
  sample1: number[], sample2: number[], tail: Tail,
): StatResult {
  const diffs = sample1.map((x, i) => x - sample2[i]);
  const n = diffs.length;
  const dbar = diffs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(diffs.reduce((sum, d) => sum + (d - dbar) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  const t = dbar / se;
  const df = n - 1;
  const leftP = jStat.studentt.cdf(t, df);
  let p: number;
  if (tail === 'left') p = leftP;
  else if (tail === 'right') p = 1 - leftP;
  else p = 2 * (1 - jStat.studentt.cdf(Math.abs(t), df));
  return {
    result: { t: +t.toFixed(6), p: +p.toFixed(6), df, dbar: +dbar.toFixed(6), sd: +sd.toFixed(6) },
    steps: [
      { label: 'FORMULA', content: 't = d̄ / (sᵈ / √n)' },
      {
        label: 'SUBSTITUTED',
        content: [
          `d = (${diffs.map((d) => (d >= 0 ? d : d)).join(', ')})`,
          `d̄ = (${diffs.join(' + ')}) / ${n} = ${+dbar.toFixed(6)}`,
          `sᵈ = √[Σ(dᵢ − d̄)² / (n−1)] = ${+sd.toFixed(6)}`,
          `SE = ${+sd.toFixed(6)} / √${n} = ${+se.toFixed(6)}`,
          `t = ${+dbar.toFixed(6)} / ${+se.toFixed(6)} = ${+t.toFixed(6)}`,
          `df = ${df}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `t = ${+t.toFixed(6)}, df = ${df}, p = ${+p.toFixed(6)} (${tail}-tailed)` },
    ],
  };
}

export function computeAnova(groups: number[][]): StatResult {
  const k = groups.length;
  const allValues = groups.flat();
  const N = allValues.length;
  const grandMean = allValues.reduce((a, b) => a + b, 0) / N;

  const groupMeans = groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const SSB = groups.reduce((sum, g, i) => sum + g.length * (groupMeans[i] - grandMean) ** 2, 0);
  const SSW = groups.reduce(
    (sum, g, i) => sum + g.reduce((s, x) => s + (x - groupMeans[i]) ** 2, 0), 0,
  );
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const MSB = SSB / dfBetween;
  const MSW = SSW / dfWithin;
  const F = MSB / MSW;
  const p = 1 - jStat.centralF.cdf(F, dfBetween, dfWithin);

  return {
    result: { F: +F.toFixed(6), p: +p.toFixed(6), SSB: +SSB.toFixed(4), SSW: +SSW.toFixed(4), MSB: +MSB.toFixed(4), MSW: +MSW.toFixed(4), dfBetween, dfWithin },
    steps: [
      { label: 'FORMULA', content: 'F = MSB / MSW\nMSB = SSB / (k−1)\nMSW = SSW / (N−k)' },
      {
        label: 'SUBSTITUTED',
        content: [
          `Grand mean = ${+grandMean.toFixed(4)}`,
          `Group means: ${groupMeans.map((m) => +m.toFixed(4)).join(', ')}`,
          `SSB = ${groups.map((g, i) => `${g.length}·(${+groupMeans[i].toFixed(4)} − ${+grandMean.toFixed(4)})²`).join(' + ')} = ${+SSB.toFixed(4)}`,
          `SSW = ${+SSW.toFixed(4)}`,
          `dfB = ${k} − 1 = ${dfBetween}, dfW = ${N} − ${k} = ${dfWithin}`,
          `MSB = ${+SSB.toFixed(4)} / ${dfBetween} = ${+MSB.toFixed(4)}`,
          `MSW = ${+SSW.toFixed(4)} / ${dfWithin} = ${+MSW.toFixed(4)}`,
          `F = ${+MSB.toFixed(4)} / ${+MSW.toFixed(4)}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `F = ${+F.toFixed(6)}, p = ${+p.toFixed(6)}\ndfB = ${dfBetween}, dfW = ${dfWithin}, SSB = ${+SSB.toFixed(4)}, SSW = ${+SSW.toFixed(4)}` },
    ],
  };
}

export function computePValue(
  testStat: number,
  dist: 'normal' | 't' | 'chi2' | 'f',
  tail: Tail,
  params: { df?: number; df1?: number; df2?: number },
): StatResult {
  let leftP: number;
  let label: string;
  switch (dist) {
    case 'normal': leftP = jStat.normal.cdf(testStat, 0, 1); label = 'Z'; break;
    case 't': leftP = jStat.studentt.cdf(testStat, params.df!); label = `t(df=${params.df})`; break;
    case 'chi2': leftP = jStat.chisquare.cdf(testStat, params.df!); label = `χ²(df=${params.df})`; break;
    case 'f': leftP = jStat.centralF.cdf(testStat, params.df1!, params.df2!); label = `F(df₁=${params.df1},df₂=${params.df2})`; break;
  }
  let p: number;
  if (tail === 'left') p = leftP;
  else if (tail === 'right') p = 1 - leftP;
  else p = 2 * Math.min(leftP, 1 - leftP);
  return {
    result: p,
    steps: [
      { label: 'FORMULA', content: `p-value for ${label}, test statistic = ${testStat}` },
      { label: 'SUBSTITUTED', content: `CDF(${testStat}) = ${+leftP.toFixed(6)}\np (${tail}-tailed) = ${+p.toFixed(6)}` },
      { label: 'RESULT', content: `p = ${+p.toFixed(6)}` },
    ],
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/lib/statistics.ts src/lib/statistics.test.ts
git commit -m "feat(stats): add hypothesis test functions (z, t, paired, ANOVA, p-value)"
```

---

### Task 5: Implement statistics.ts — regression functions

**Files:**
- Modify: `src/lib/statistics.ts`
- Modify: `src/lib/statistics.test.ts`

- [ ] **Step 1: Add regression tests**

Append to `src/lib/statistics.test.ts` before the summary block:

```typescript
import {
  computeRegression,
  computeCorrelation,
  computeRSquared,
  computeRegressionPredict,
  computeResidualSE,
} from './statistics';

// ── regression ────────────────────────────────────────────────────────────

const xs = [1, 2, 3, 4, 5, 6];
const ys = [2.1, 4.0, 5.8, 8.1, 9.9, 12.2];

console.log('\nRegression');
{
  const r = computeRegression(xs, ys);
  const res = r.result as Record<string, number>;
  check(approxEq(res.slope, 2.0, 0.1), `slope ≈ 2.0: ${res.slope}`);
  check(approxEq(res.intercept, 0.0, 0.5), `intercept ≈ 0: ${res.intercept}`);
}

console.log('\nCorrelation');
{
  const r = computeCorrelation(xs, ys);
  check(approxEq(r.result as number, 0.999, 0.01), `r ≈ 0.999: ${r.result}`);
}

console.log('\nR-squared');
{
  const r = computeRSquared(xs, ys);
  check(approxEq(r.result as number, 0.998, 0.01), `R² ≈ 0.998: ${r.result}`);
}

console.log('\nPrediction');
{
  const r = computeRegressionPredict(xs, ys, 7);
  check(approxEq(r.result as number, 14.0, 0.5), `predict(7) ≈ 14: ${r.result}`);
}

console.log('\nResidual SE');
{
  const r = computeResidualSE(xs, ys);
  check((r.result as number) < 0.5, `residual SE < 0.5: ${r.result}`);
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement regression functions**

Append to `src/lib/statistics.ts`:

```typescript
function regressionCoeffs(xs: number[], ys: number[]): { slope: number; intercept: number; xbar: number; ybar: number } {
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  const ssxy = xs.reduce((sum, x, i) => sum + (x - xbar) * (ys[i] - ybar), 0);
  const ssxx = xs.reduce((sum, x) => sum + (x - xbar) ** 2, 0);
  const slope = ssxy / ssxx;
  const intercept = ybar - slope * xbar;
  return { slope, intercept, xbar, ybar };
}

export function computeRegression(xs: number[], ys: number[]): StatResult {
  const { slope, intercept, xbar, ybar } = regressionCoeffs(xs, ys);
  const n = xs.length;
  const ssxy = xs.reduce((sum, x, i) => sum + (x - xbar) * (ys[i] - ybar), 0);
  const ssxx = xs.reduce((sum, x) => sum + (x - xbar) ** 2, 0);
  return {
    result: { slope: +slope.toFixed(6), intercept: +intercept.toFixed(6) },
    steps: [
      { label: 'FORMULA', content: 'b₁ = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)²\nb₀ = ȳ − b₁·x̄' },
      {
        label: 'SUBSTITUTED',
        content: [
          `x̄ = ${+xbar.toFixed(4)}, ȳ = ${+ybar.toFixed(4)}`,
          `Σ(xᵢ−x̄)(yᵢ−ȳ) = ${+ssxy.toFixed(4)}`,
          `Σ(xᵢ−x̄)² = ${+ssxx.toFixed(4)}`,
          `b₁ = ${+ssxy.toFixed(4)} / ${+ssxx.toFixed(4)} = ${+slope.toFixed(6)}`,
          `b₀ = ${+ybar.toFixed(4)} − ${+slope.toFixed(6)} · ${+xbar.toFixed(4)} = ${+intercept.toFixed(6)}`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `ŷ = ${+slope.toFixed(6)}x + ${+intercept.toFixed(6)}` },
    ],
  };
}

export function computeCorrelation(xs: number[], ys: number[]): StatResult {
  const n = xs.length;
  const xbar = xs.reduce((a, b) => a + b, 0) / n;
  const ybar = ys.reduce((a, b) => a + b, 0) / n;
  const ssxy = xs.reduce((sum, x, i) => sum + (x - xbar) * (ys[i] - ybar), 0);
  const ssxx = xs.reduce((sum, x) => sum + (x - xbar) ** 2, 0);
  const ssyy = ys.reduce((sum, y) => sum + (y - ybar) ** 2, 0);
  const r = ssxy / Math.sqrt(ssxx * ssyy);
  return {
    result: +r.toFixed(6),
    steps: [
      { label: 'FORMULA', content: 'r = Σ(xᵢ−x̄)(yᵢ−ȳ) / √[Σ(xᵢ−x̄)² · Σ(yᵢ−ȳ)²]' },
      {
        label: 'SUBSTITUTED',
        content: `Σ(xᵢ−x̄)(yᵢ−ȳ) = ${+ssxy.toFixed(4)}\nΣ(xᵢ−x̄)² = ${+ssxx.toFixed(4)}\nΣ(yᵢ−ȳ)² = ${+ssyy.toFixed(4)}\nr = ${+ssxy.toFixed(4)} / √(${+ssxx.toFixed(4)} · ${+ssyy.toFixed(4)})`,
      },
      { label: 'RESULT', content: `r = ${+r.toFixed(6)}` },
    ],
  };
}

export function computeRSquared(xs: number[], ys: number[]): StatResult {
  const corr = computeCorrelation(xs, ys);
  const r = corr.result as number;
  const r2 = r * r;
  return {
    result: +r2.toFixed(6),
    steps: [
      { label: 'FORMULA', content: 'R² = r²' },
      { label: 'SUBSTITUTED', content: `r = ${+r.toFixed(6)}\nR² = ${+r.toFixed(6)}²` },
      { label: 'RESULT', content: `R² = ${+r2.toFixed(6)}` },
    ],
  };
}

export function computeRegressionPredict(xs: number[], ys: number[], x0: number): StatResult {
  const { slope, intercept } = regressionCoeffs(xs, ys);
  const yhat = slope * x0 + intercept;
  return {
    result: +yhat.toFixed(6),
    steps: [
      { label: 'FORMULA', content: 'ŷ = b₁·x₀ + b₀' },
      { label: 'SUBSTITUTED', content: `ŷ = ${+slope.toFixed(6)} · ${x0} + ${+intercept.toFixed(6)}` },
      { label: 'RESULT', content: `ŷ = ${+yhat.toFixed(6)}` },
    ],
  };
}

export function computeResidualSE(xs: number[], ys: number[]): StatResult {
  const { slope, intercept } = regressionCoeffs(xs, ys);
  const n = xs.length;
  const residuals = ys.map((y, i) => y - (slope * xs[i] + intercept));
  const ssr = residuals.reduce((sum, r) => sum + r * r, 0);
  const se = Math.sqrt(ssr / (n - 2));
  return {
    result: +se.toFixed(6),
    steps: [
      { label: 'FORMULA', content: 'SE = √[Σ(yᵢ − ŷᵢ)² / (n − 2)]' },
      {
        label: 'SUBSTITUTED',
        content: [
          `ŷ = ${+slope.toFixed(4)}x + ${+intercept.toFixed(4)}`,
          `Residuals: ${residuals.map((r) => +r.toFixed(4)).join(', ')}`,
          `SSR = ${+ssr.toFixed(4)}`,
          `SE = √(${+ssr.toFixed(4)} / ${n - 2})`,
        ].join('\n'),
      },
      { label: 'RESULT', content: `SE = ${+se.toFixed(6)}` },
    ],
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/lib/statistics.ts src/lib/statistics.test.ts
git commit -m "feat(stats): add regression functions (LSR, r, R², predict, residual SE)"
```

---

### Task 6: Visual refinements — update CSS and refactor ScientificCalculator

**Files:**
- Modify: `src/styles/globals.css` (lines 2955-3084)
- Create: `src/components/calculator/ScientificCalculator.tsx`
- Modify: `src/pages/tools/ToolCalculatorPage.tsx`

- [ ] **Step 1: Update CSS for visual refinements**

In `src/styles/globals.css`, update the calculator section (lines 2955-3084). Change:

- `.calc-keys` grid: `repeat(8, 1fr)` → `repeat(6, 1fr)`, gap `5px` → `6px`
- `.calc-key` font-size: `0.88rem` → `0.92rem`, border-radius: `7px` → `9px`, background: `#08080a` → `#0c0c10`
- `.calc-key:hover` background: `#0f0f12` → `#141418`
- `.calc-input` font-size: `1.2rem` → `1.1rem` (slightly smaller to fit 6-col better)
- `.calc-result` font-size: `1.55rem` → `1.35rem`
- `.calc-input-box` border-radius: add `var(--radius-sm)` → `10px`, border: `rgba(255,255,255,0.045)` → `rgba(255,255,255,0.07)`
- `.calc-output-box` border-radius: `10px`, border: `rgba(245,158,11,0.18)` → `rgba(245,158,11,0.22)`
- `.calc-history-row` border-radius: `6px` → `8px`

Add new classes for the pill toggle and stats mode:

```css
/* Mode pill toggle */
.calc-mode-toggle {
  display: inline-flex;
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  padding: 3px;
  margin-bottom: 14px;
}
.calc-mode-btn {
  padding: 5px 16px;
  border-radius: 17px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
}
.calc-mode-btn.active {
  background: #f59e0b;
  color: #000;
}

/* Stats grid */
.stats-grid-label {
  color: var(--color-text-muted);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 5px;
  margin-top: 14px;
  font-family: var(--font-mono);
}
.stats-grid-label:first-child { margin-top: 0; }
.stats-grid {
  display: grid;
  gap: 5px;
}
.stats-btn {
  background: #0c0c10;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 7px;
  padding: 9px 4px;
  text-align: center;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.stats-btn:hover {
  background: #141418;
  color: var(--color-text);
  border-color: rgba(255, 255, 255, 0.10);
}
.stats-btn.active {
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

/* Stats form */
.stats-form {
  background: #040406;
  border: 1px solid rgba(245, 158, 11, 0.22);
  border-radius: 10px;
  padding: 16px;
  margin-top: 14px;
}
.stats-form-title {
  color: #f59e0b;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 12px;
}
.stats-field-label {
  color: var(--color-text-muted);
  font-size: 0.65rem;
  font-family: var(--font-mono);
  margin-bottom: 4px;
}
.stats-input {
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.82rem;
  width: 100%;
  outline: none;
  transition: border-color 0.12s;
  box-sizing: border-box;
}
.stats-input:focus {
  border-color: rgba(245, 158, 11, 0.3);
}
.stats-input.error {
  border-color: rgba(248, 113, 113, 0.4);
}
.stats-error {
  color: #f87171;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  margin-top: 4px;
}

/* Tail selector */
.tail-selector {
  display: inline-flex;
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 2px;
}
.tail-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
}
.tail-btn.active {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-weight: 700;
}

/* Formula display */
.formula-display {
  background: #08080a;
  border-radius: 8px;
  padding: 14px;
  font-family: var(--font-mono);
  margin-top: 12px;
}
.formula-label {
  color: var(--color-text-muted);
  font-size: 0.65rem;
  margin-bottom: 6px;
}
.formula-content {
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.8rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.formula-result {
  border-top: 1px solid rgba(245, 158, 11, 0.2);
  padding-top: 10px;
  margin-top: 10px;
}
.formula-result .formula-content {
  color: #f59e0b;
  font-size: 1.15rem;
  font-weight: 700;
}

/* ANOVA group rows */
.anova-groups { display: flex; flex-direction: column; gap: 8px; }
.anova-group-row { display: flex; gap: 8px; align-items: center; }
.anova-group-row .stats-input { flex: 1; }
.anova-remove {
  color: var(--color-text-muted);
  font-size: 1rem;
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px;
  transition: color 0.12s;
}
.anova-remove:hover { color: #f87171; }
.anova-add {
  color: #f59e0b;
  font-size: 0.72rem;
  cursor: pointer;
  background: none;
  border: none;
  font-family: var(--font-mono);
  padding: 4px 0;
  margin-top: 4px;
}

/* Input mode toggle (Summary/Raw) */
.input-mode-toggle {
  display: inline-flex;
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 2px;
}
.input-mode-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
}
.input-mode-btn.active {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
  font-weight: 700;
}
```

- [ ] **Step 2: Extract ScientificCalculator component**

Create `src/components/calculator/ScientificCalculator.tsx` — move the existing `CalculatorTool` component body (the KEYS array, all state, and the JSX) into this file. The only change is reducing the grid from 8 to 6 columns, which means reorganizing the KEYS array into 6-column rows:

```typescript
import { useRef, useState, type KeyboardEvent } from 'react';
import { evaluate } from 'mathjs';

interface CalcEntry {
  expr: string;
  result: string;
}

function normalizeExpression(input: string): string {
  const s = input
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi');
  return s.replace(
    /√\s*(\([^()]*\)|\d+(?:\.\d+)?|[a-zA-Z_][a-zA-Z0-9_]*)?/g,
    (_match, operand?: string) => {
      if (!operand) return 'sqrt(';
      if (operand.startsWith('(')) return `sqrt${operand}`;
      return `sqrt(${operand})`;
    },
  );
}

export function ScientificCalculator() {
  const [expr, setExpr] = useState('');
  const [history, setHistory] = useState<CalcEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function tryEvaluate(input: string): { ok: true; value: string } | { ok: false; error: string } {
    if (!input.trim()) return { ok: true, value: '' };
    try {
      const result = evaluate(normalizeExpression(input));
      const out = typeof result === 'function' ? '(funksjon)' : String(result);
      return { ok: true, value: out };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Feil i uttrykket' };
    }
  }

  const evaluation = tryEvaluate(expr);
  const liveResult = evaluation.ok ? evaluation.value : null;
  const errorMsg = !evaluation.ok ? evaluation.error : null;

  function commit() {
    if (!expr.trim() || !evaluation.ok || !evaluation.value) return;
    setHistory((prev) => [{ expr, result: evaluation.value }, ...prev].slice(0, 12));
    setExpr('');
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
  }

  function appendKey(s: string) {
    const input = inputRef.current;
    if (!input) { setExpr((prev) => prev + s); return; }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = input.value.slice(0, start) + s + input.value.slice(end);
    setExpr(newValue);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const pos = start + s.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function clear() { setExpr(''); inputRef.current?.focus(); }
  function backspace() { setExpr((prev) => prev.slice(0, -1)); inputRef.current?.focus(); }
  function recall(entry: CalcEntry) { setExpr(entry.expr); inputRef.current?.focus(); }

  // 6-column key grid
  const KEYS: Array<{ label: string; insert?: string; action?: () => void; accent?: boolean; span?: number }> = [
    { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' },
    { label: '÷', insert: '/' }, { label: '(', insert: '(' }, { label: ')', insert: ')' },

    { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' },
    { label: '×', insert: '*' }, { label: '√', insert: '√' }, { label: 'π', insert: 'pi' },

    { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' },
    { label: '−', insert: '-' }, { label: 'x²', insert: '^2' }, { label: 'xʸ', insert: '^' },

    { label: '0', insert: '0' }, { label: '.', insert: '.' }, { label: '%', insert: '%' },
    { label: '+', insert: '+' }, { label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' },

    { label: 'tan', insert: 'tan(' }, { label: 'log', insert: 'log10(' }, { label: 'ln', insert: 'log(' },
    { label: 'eˣ', insert: 'exp(' }, { label: 'e', insert: 'e' }, { label: '!', insert: '!' },

    { label: '⌫', action: backspace, span: 3 }, { label: 'C', action: clear, accent: true, span: 3 },
  ];

  return (
    <div>
      <div className="calc-input-box">
        <input
          ref={inputRef}
          className="calc-input"
          type="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="Skriv et uttrykk…"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />
      </div>
      <div className="calc-output-box">
        <span className="calc-output-label">=</span>
        {errorMsg ? (
          <span className="calc-result error">{errorMsg}</span>
        ) : !expr.trim() ? (
          <span className="calc-result placeholder">resultat vises her</span>
        ) : (
          <span className="calc-result">{liveResult || '—'}</span>
        )}
      </div>
      <div className="calc-keys">
        {KEYS.map((k, i) => (
          <button
            key={i}
            type="button"
            className={`calc-key${k.accent ? ' accent' : ''}`}
            style={k.span ? { gridColumn: `span ${k.span}` } : undefined}
            onClick={() => (k.action ? k.action() : appendKey(k.insert!))}
            title={k.insert}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="calc-history">
        {history.length === 0 ? (
          <div className="calc-history-empty">Trykk Enter for å lagre resultatet i historikken.</div>
        ) : (
          history.map((h, i) => (
            <div key={i} className="calc-history-row" onClick={() => recall(h)} title="Klikk for å bruke på nytt">
              <span className="calc-history-expr">{h.expr}</span>
              <span className="calc-history-result">= {h.result}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update ToolCalculatorPage.tsx to be the shell with mode toggle**

Replace the contents of `src/pages/tools/ToolCalculatorPage.tsx`:

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScientificCalculator } from '@/components/calculator/ScientificCalculator';

type CalcMode = 'scientific' | 'statistics';

export function ToolCalculatorPage() {
  const [mode, setMode] = useState<CalcMode>('scientific');

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader title="Kalkulator" subtitle="Regn ut tall, funksjoner og uttrykk." />

      <div className="surface" style={{ padding: '24px' }}>
        <div className="calc-mode-toggle">
          <button
            className={`calc-mode-btn${mode === 'scientific' ? ' active' : ''}`}
            onClick={() => setMode('scientific')}
          >
            Scientific
          </button>
          <button
            className={`calc-mode-btn${mode === 'statistics' ? ' active' : ''}`}
            onClick={() => setMode('statistics')}
          >
            Statistics
          </button>
        </div>

        {mode === 'scientific' ? (
          <ScientificCalculator />
        ) : (
          <div style={{ color: 'var(--color-text-muted)', padding: '20px 0' }}>
            Statistics mode — coming in Task 7
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the app compiles and scientific mode works**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/styles/globals.css src/components/calculator/ScientificCalculator.tsx src/pages/tools/ToolCalculatorPage.tsx
git commit -m "feat(calc): visual refinements + extract ScientificCalculator + mode toggle shell"
```

---

### Task 7: Implement FormulaDisplay component

**Files:**
- Create: `src/components/calculator/FormulaDisplay.tsx`

- [ ] **Step 1: Create FormulaDisplay.tsx**

```typescript
import type { FormulaStep } from '@/lib/statistics';

interface FormulaDisplayProps {
  steps: FormulaStep[];
}

export function FormulaDisplay({ steps }: FormulaDisplayProps) {
  if (steps.length === 0) return null;

  return (
    <div className="formula-display">
      {steps.map((step, i) => (
        <div key={i} className={step.label === 'RESULT' ? 'formula-result' : ''}>
          <div className="formula-label">{step.label}</div>
          <div className="formula-content">{step.content}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/components/calculator/FormulaDisplay.tsx
git commit -m "feat(calc): add FormulaDisplay component for step-by-step formulas"
```

---

### Task 8: Implement StatsGrid component

**Files:**
- Create: `src/components/calculator/StatsGrid.tsx`

- [ ] **Step 1: Create StatsGrid.tsx**

```typescript
export type StatFunction =
  | 'mean' | 'median' | 'variance' | 'stddev' | 'range'
  | 'normalCdf' | 'normalInv' | 'tCdf' | 'tInv' | 'chi2Cdf' | 'chi2Inv' | 'fCdf' | 'fInv' | 'binomialPmf' | 'binomialCdf' | 'poissonPmf' | 'poissonCdf'
  | 'zTest' | 'oneSampleT' | 'twoSampleT' | 'pairedT' | 'anova' | 'pValue'
  | 'regression' | 'correlation' | 'rSquared' | 'predict' | 'residualSE';

interface StatCategory {
  label: string;
  cols: number;
  items: Array<{ id: StatFunction; label: string }>;
}

const CATEGORIES: StatCategory[] = [
  {
    label: 'Descriptive',
    cols: 5,
    items: [
      { id: 'mean', label: 'Mean' },
      { id: 'median', label: 'Median' },
      { id: 'variance', label: 'Var' },
      { id: 'stddev', label: 'Std Dev' },
      { id: 'range', label: 'Range' },
    ],
  },
  {
    label: 'Distributions',
    cols: 6,
    items: [
      { id: 'normalCdf', label: 'Norm Z' },
      { id: 'tCdf', label: 't' },
      { id: 'chi2Cdf', label: 'χ²' },
      { id: 'fCdf', label: 'F' },
      { id: 'binomialPmf', label: 'Binom' },
      { id: 'poissonPmf', label: 'Poisson' },
    ],
  },
  {
    label: 'Hypothesis Tests',
    cols: 6,
    items: [
      { id: 'zTest', label: 'z-test' },
      { id: 'oneSampleT', label: '1-samp t' },
      { id: 'twoSampleT', label: '2-samp t' },
      { id: 'pairedT', label: 'Paired t' },
      { id: 'anova', label: 'ANOVA' },
      { id: 'pValue', label: 'p-value' },
    ],
  },
  {
    label: 'Regression',
    cols: 5,
    items: [
      { id: 'regression', label: 'LSR Line' },
      { id: 'correlation', label: 'r' },
      { id: 'rSquared', label: 'R²' },
      { id: 'predict', label: 'Predict' },
      { id: 'residualSE', label: 'Res. SE' },
    ],
  },
];

interface StatsGridProps {
  selected: StatFunction | null;
  onSelect: (fn: StatFunction) => void;
}

export function StatsGrid({ selected, onSelect }: StatsGridProps) {
  return (
    <div>
      {CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div className="stats-grid-label">{cat.label}</div>
          <div className="stats-grid" style={{ gridTemplateColumns: `repeat(${cat.cols}, 1fr)` }}>
            {cat.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`stats-btn${selected === item.id ? ' active' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/components/calculator/StatsGrid.tsx
git commit -m "feat(calc): add StatsGrid component with 22 function buttons"
```

---

### Task 9: Implement StatsForm component

**Files:**
- Create: `src/components/calculator/StatsForm.tsx`

This is the largest UI component. It renders the appropriate input fields based on the selected function, calls the corresponding statistics function, and displays results via FormulaDisplay.

- [ ] **Step 1: Create StatsForm.tsx**

```typescript
import { useState } from 'react';
import type { StatFunction } from './StatsGrid';
import type { StatResult } from '@/lib/statistics';
import {
  parseDataset,
  computeMean, computeMedian, computeVariance, computeStdDev, computeRange,
  computeNormalCdf, computeNormalInv, computeTCdf, computeTInv,
  computeChi2Cdf, computeChi2Inv, computeFCdf, computeFInv,
  computeBinomialPmf, computeBinomialCdf, computePoissonPmf, computePoissonCdf,
  computeZTest, computeOneSampleTTest, computeTwoSampleTTest,
  computePairedTTest, computeAnova, computePValue,
  computeRegression, computeCorrelation, computeRSquared,
  computeRegressionPredict, computeResidualSE,
} from '@/lib/statistics';
import { FormulaDisplay } from './FormulaDisplay';

type Tail = 'left' | 'right' | 'two';

interface StatsFormProps {
  fn: StatFunction;
}

function TailSelector({ value, onChange }: { value: Tail; onChange: (t: Tail) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <span className="stats-field-label" style={{ marginBottom: 0 }}>Tail:</span>
      <div className="tail-selector">
        {(['left', 'two', 'right'] as Tail[]).map((t) => (
          <button key={t} type="button" className={`tail-btn${value === t ? ' active' : ''}`} onClick={() => onChange(t)}>
            {t === 'left' ? 'Left' : t === 'right' ? 'Right' : 'Two'}
          </button>
        ))}
      </div>
    </div>
  );
}

function useField(initial = '') {
  const [value, setValue] = useState(initial);
  return { value, setValue, bind: { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value) } };
}

export function StatsForm({ fn }: StatsFormProps) {
  const dataset = useField('');
  const dataset2 = useField('');
  const field1 = useField('');
  const field2 = useField('');
  const field3 = useField('');
  const field4 = useField('');
  const field5 = useField('');
  const field6 = useField('');
  const [tail, setTail] = useState<Tail>('two');
  const [inverse, setInverse] = useState(false);
  const [cumulative, setCumulative] = useState(false);
  const [inputMode, setInputMode] = useState<'summary' | 'raw'>('summary');
  const [anovaGroups, setAnovaGroups] = useState<string[]>(['', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StatResult | null>(null);

  function compute() {
    setError(null);
    setResult(null);
    try {
      let r: StatResult;
      switch (fn) {
        // Descriptive
        case 'mean': case 'median': case 'variance': case 'stddev': case 'range': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) { setError('Enter at least one number'); return; }
          if ((fn === 'variance' || fn === 'stddev') && data.length < 2) { setError('Need at least 2 values'); return; }
          const fns = { mean: computeMean, median: computeMedian, variance: computeVariance, stddev: computeStdDev, range: computeRange };
          r = fns[fn](data);
          break;
        }
        // Distributions
        case 'normalCdf': {
          if (inverse) { r = computeNormalInv(parseFloat(field1.value)); }
          else { r = computeNormalCdf(parseFloat(field1.value), tail); }
          break;
        }
        case 'tCdf': {
          if (inverse) { r = computeTInv(parseFloat(field1.value), parseFloat(field2.value)); }
          else { r = computeTCdf(parseFloat(field1.value), parseFloat(field2.value), tail); }
          break;
        }
        case 'chi2Cdf': {
          if (inverse) { r = computeChi2Inv(parseFloat(field1.value), parseFloat(field2.value)); }
          else { r = computeChi2Cdf(parseFloat(field1.value), parseFloat(field2.value), tail); }
          break;
        }
        case 'fCdf': {
          if (inverse) { r = computeFInv(parseFloat(field1.value), parseFloat(field2.value), parseFloat(field3.value)); }
          else { r = computeFCdf(parseFloat(field1.value), parseFloat(field2.value), parseFloat(field3.value), tail); }
          break;
        }
        case 'binomialPmf': {
          const n = parseInt(field1.value); const p = parseFloat(field2.value); const k = parseInt(field3.value);
          r = cumulative ? computeBinomialCdf(n, p, k) : computeBinomialPmf(n, p, k);
          break;
        }
        case 'poissonPmf': {
          const lambda = parseFloat(field1.value); const k = parseInt(field2.value);
          r = cumulative ? computePoissonCdf(lambda, k) : computePoissonPmf(lambda, k);
          break;
        }
        // Hypothesis tests
        case 'zTest':
          r = computeZTest(parseFloat(field1.value), parseFloat(field2.value), parseFloat(field3.value), parseFloat(field4.value), tail);
          break;
        case 'oneSampleT':
          r = computeOneSampleTTest(parseFloat(field1.value), parseFloat(field2.value), parseFloat(field3.value), parseFloat(field4.value), tail);
          break;
        case 'twoSampleT': {
          if (inputMode === 'raw') {
            const d1 = parseDataset(dataset.value);
            const d2 = parseDataset(dataset2.value);
            if (d1.length < 2 || d2.length < 2) { setError('Need at least 2 values per group'); return; }
            const m1 = d1.reduce((a, b) => a + b, 0) / d1.length;
            const m2 = d2.reduce((a, b) => a + b, 0) / d2.length;
            const s1 = Math.sqrt(d1.reduce((s, x) => s + (x - m1) ** 2, 0) / (d1.length - 1));
            const s2 = Math.sqrt(d2.reduce((s, x) => s + (x - m2) ** 2, 0) / (d2.length - 1));
            r = computeTwoSampleTTest(m1, s1, d1.length, m2, s2, d2.length, tail);
          } else {
            r = computeTwoSampleTTest(
              parseFloat(field1.value), parseFloat(field2.value), parseFloat(field3.value),
              parseFloat(field4.value), parseFloat(field5.value), parseFloat(field6.value), tail,
            );
          }
          break;
        }
        case 'pairedT': {
          const d1 = parseDataset(dataset.value);
          const d2 = parseDataset(dataset2.value);
          if (d1.length < 2 || d2.length < 2) { setError('Need at least 2 values per sample'); return; }
          if (d1.length !== d2.length) { setError(`Datasets must have the same number of values (got ${d1.length} and ${d2.length})`); return; }
          r = computePairedTTest(d1, d2, tail);
          break;
        }
        case 'anova': {
          const groups = anovaGroups.map(parseDataset).filter((g) => g.length > 0);
          if (groups.length < 2) { setError('Need at least 2 groups'); return; }
          if (groups.some((g) => g.length < 2)) { setError('Each group needs at least 2 values'); return; }
          r = computeAnova(groups);
          break;
        }
        case 'pValue': {
          const dist = field2.value as 'normal' | 't' | 'chi2' | 'f';
          r = computePValue(parseFloat(field1.value), dist, tail, {
            df: parseFloat(field3.value) || undefined,
            df1: parseFloat(field3.value) || undefined,
            df2: parseFloat(field4.value) || undefined,
          });
          break;
        }
        // Regression
        case 'regression': case 'correlation': case 'rSquared': case 'residualSE': {
          const xs = parseDataset(dataset.value);
          const ys = parseDataset(dataset2.value);
          if (xs.length < 2 || ys.length < 2) { setError('Need at least 2 data points'); return; }
          if (xs.length !== ys.length) { setError(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`); return; }
          const rfns = { regression: computeRegression, correlation: computeCorrelation, rSquared: computeRSquared, residualSE: computeResidualSE };
          r = rfns[fn](xs, ys);
          break;
        }
        case 'predict': {
          const xs = parseDataset(dataset.value);
          const ys = parseDataset(dataset2.value);
          if (xs.length < 2 || ys.length < 2) { setError('Need at least 2 data points'); return; }
          if (xs.length !== ys.length) { setError(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`); return; }
          r = computeRegressionPredict(xs, ys, parseFloat(field1.value));
          break;
        }
        default:
          setError('Function not implemented');
          return;
      }
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Computation error');
    }
  }

  const TITLES: Record<string, string> = {
    mean: 'MEAN', median: 'MEDIAN', variance: 'VARIANCE (sample)', stddev: 'STANDARD DEVIATION (sample)', range: 'RANGE',
    normalCdf: 'NORMAL (Z)', tCdf: 'STUDENT\'S t', chi2Cdf: 'CHI-SQUARE (χ²)', fCdf: 'F-DISTRIBUTION',
    binomialPmf: 'BINOMIAL', poissonPmf: 'POISSON',
    zTest: 'Z-TEST', oneSampleT: 'ONE-SAMPLE t-TEST', twoSampleT: 'TWO-SAMPLE t-TEST (Welch\'s)',
    pairedT: 'PAIRED t-TEST', anova: 'ANOVA (F-TEST)', pValue: 'P-VALUE CALCULATOR',
    regression: 'LEAST-SQUARES REGRESSION', correlation: 'CORRELATION (r)', rSquared: 'R-SQUARED',
    predict: 'PREDICTION', residualSE: 'RESIDUAL STANDARD ERROR',
  };

  function renderInputs() {
    // Descriptive stats: single dataset
    if (['mean', 'median', 'variance', 'stddev', 'range'].includes(fn)) {
      return (
        <div>
          <div className="stats-field-label">Dataset (comma-separated)</div>
          <input className="stats-input" placeholder="12, 15, 18, 22, 25..." {...dataset.bind} />
        </div>
      );
    }

    // Normal Z
    if (fn === 'normalCdf') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Mode:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${!inverse ? ' active' : ''}`} onClick={() => setInverse(false)}>CDF</button>
              <button className={`input-mode-btn${inverse ? ' active' : ''}`} onClick={() => setInverse(true)}>Inverse</button>
            </div>
          </div>
          <div>
            <div className="stats-field-label">{inverse ? 'Probability (p)' : 'z-value'}</div>
            <input className="stats-input" placeholder={inverse ? '0.975' : '1.96'} {...field1.bind} />
          </div>
          {!inverse && <TailSelector value={tail} onChange={setTail} />}
        </div>
      );
    }

    // t, chi2, F distributions
    if (fn === 'tCdf' || fn === 'chi2Cdf') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Mode:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${!inverse ? ' active' : ''}`} onClick={() => setInverse(false)}>CDF</button>
              <button className={`input-mode-btn${inverse ? ' active' : ''}`} onClick={() => setInverse(true)}>Inverse</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div className="stats-field-label">{inverse ? 'Probability (p)' : (fn === 'tCdf' ? 't-value' : 'χ²-value')}</div>
              <input className="stats-input" {...field1.bind} />
            </div>
            <div>
              <div className="stats-field-label">df</div>
              <input className="stats-input" {...field2.bind} />
            </div>
          </div>
          {!inverse && <TailSelector value={tail} onChange={setTail} />}
        </div>
      );
    }

    if (fn === 'fCdf') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Mode:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${!inverse ? ' active' : ''}`} onClick={() => setInverse(false)}>CDF</button>
              <button className={`input-mode-btn${inverse ? ' active' : ''}`} onClick={() => setInverse(true)}>Inverse</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div className="stats-field-label">{inverse ? 'Probability (p)' : 'F-value'}</div>
              <input className="stats-input" {...field1.bind} />
            </div>
            <div><div className="stats-field-label">df₁</div><input className="stats-input" {...field2.bind} /></div>
            <div><div className="stats-field-label">df₂</div><input className="stats-input" {...field3.bind} /></div>
          </div>
          {!inverse && <TailSelector value={tail} onChange={setTail} />}
        </div>
      );
    }

    // Binomial
    if (fn === 'binomialPmf') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div><div className="stats-field-label">n (trials)</div><input className="stats-input" {...field1.bind} /></div>
            <div><div className="stats-field-label">p (probability)</div><input className="stats-input" {...field2.bind} /></div>
            <div><div className="stats-field-label">k (successes)</div><input className="stats-input" {...field3.bind} /></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Mode:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${!cumulative ? ' active' : ''}`} onClick={() => setCumulative(false)}>Exact P(X=k)</button>
              <button className={`input-mode-btn${cumulative ? ' active' : ''}`} onClick={() => setCumulative(true)}>Cumulative P(X≤k)</button>
            </div>
          </div>
        </div>
      );
    }

    // Poisson
    if (fn === 'poissonPmf') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><div className="stats-field-label">λ (rate)</div><input className="stats-input" {...field1.bind} /></div>
            <div><div className="stats-field-label">k (occurrences)</div><input className="stats-input" {...field2.bind} /></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Mode:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${!cumulative ? ' active' : ''}`} onClick={() => setCumulative(false)}>Exact P(X=k)</button>
              <button className={`input-mode-btn${cumulative ? ' active' : ''}`} onClick={() => setCumulative(true)}>Cumulative P(X≤k)</button>
            </div>
          </div>
        </div>
      );
    }

    // z-test, one-sample t
    if (fn === 'zTest' || fn === 'oneSampleT') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><div className="stats-field-label">x̄ (sample mean)</div><input className="stats-input" {...field1.bind} /></div>
            <div><div className="stats-field-label">μ₀ (hypothesized mean)</div><input className="stats-input" {...field2.bind} /></div>
            <div><div className="stats-field-label">{fn === 'zTest' ? 'σ (population SD)' : 's (sample SD)'}</div><input className="stats-input" {...field3.bind} /></div>
            <div><div className="stats-field-label">n (sample size)</div><input className="stats-input" {...field4.bind} /></div>
          </div>
          <TailSelector value={tail} onChange={setTail} />
        </div>
      );
    }

    // Two-sample t
    if (fn === 'twoSampleT') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stats-field-label" style={{ marginBottom: 0 }}>Input:</span>
            <div className="input-mode-toggle">
              <button className={`input-mode-btn${inputMode === 'summary' ? ' active' : ''}`} onClick={() => setInputMode('summary')}>Summary</button>
              <button className={`input-mode-btn${inputMode === 'raw' ? ' active' : ''}`} onClick={() => setInputMode('raw')}>Raw Data</button>
            </div>
          </div>
          {inputMode === 'summary' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: '#08080a', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="stats-field-label" style={{ fontWeight: 700, marginBottom: '8px' }}>Group 1</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div><div className="stats-field-label">x̄₁</div><input className="stats-input" {...field1.bind} /></div>
                  <div><div className="stats-field-label">s₁</div><input className="stats-input" {...field2.bind} /></div>
                  <div><div className="stats-field-label">n₁</div><input className="stats-input" {...field3.bind} /></div>
                </div>
              </div>
              <div style={{ background: '#08080a', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="stats-field-label" style={{ fontWeight: 700, marginBottom: '8px' }}>Group 2</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <div><div className="stats-field-label">x̄₂</div><input className="stats-input" {...field4.bind} /></div>
                  <div><div className="stats-field-label">s₂</div><input className="stats-input" {...field5.bind} /></div>
                  <div><div className="stats-field-label">n₂</div><input className="stats-input" {...field6.bind} /></div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><div className="stats-field-label">Group 1</div><input className="stats-input" placeholder="12, 15, 18..." {...dataset.bind} /></div>
              <div><div className="stats-field-label">Group 2</div><input className="stats-input" placeholder="20, 22, 25..." {...dataset2.bind} /></div>
            </div>
          )}
          <TailSelector value={tail} onChange={setTail} />
        </div>
      );
    }

    // Paired t
    if (fn === 'pairedT') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><div className="stats-field-label">Sample 1</div><input className="stats-input" placeholder="85, 90, 78, 92, 88" {...dataset.bind} /></div>
            <div><div className="stats-field-label">Sample 2</div><input className="stats-input" placeholder="88, 95, 82, 94, 91" {...dataset2.bind} /></div>
          </div>
          <TailSelector value={tail} onChange={setTail} />
        </div>
      );
    }

    // ANOVA
    if (fn === 'anova') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="anova-groups">
            {anovaGroups.map((g, i) => (
              <div key={i} className="anova-group-row">
                <span className="stats-field-label" style={{ marginBottom: 0, minWidth: '52px' }}>Group {i + 1}</span>
                <input
                  className="stats-input"
                  value={g}
                  onChange={(e) => {
                    const next = [...anovaGroups];
                    next[i] = e.target.value;
                    setAnovaGroups(next);
                  }}
                  placeholder="23, 25, 27..."
                />
                {anovaGroups.length > 2 && (
                  <button className="anova-remove" onClick={() => setAnovaGroups(anovaGroups.filter((_, j) => j !== i))}>×</button>
                )}
              </div>
            ))}
          </div>
          <button className="anova-add" onClick={() => setAnovaGroups([...anovaGroups, ''])}>+ Add group</button>
        </div>
      );
    }

    // p-value
    if (fn === 'pValue') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><div className="stats-field-label">Test statistic</div><input className="stats-input" {...field1.bind} /></div>
            <div>
              <div className="stats-field-label">Distribution</div>
              <select
                className="stats-input"
                value={field2.value}
                onChange={(e) => field2.setValue(e.target.value)}
                style={{ appearance: 'auto' }}
              >
                <option value="normal">Normal (Z)</option>
                <option value="t">Student's t</option>
                <option value="chi2">Chi-square (χ²)</option>
                <option value="f">F</option>
              </select>
            </div>
          </div>
          {(field2.value === 't' || field2.value === 'chi2') && (
            <div><div className="stats-field-label">df</div><input className="stats-input" {...field3.bind} /></div>
          )}
          {field2.value === 'f' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><div className="stats-field-label">df₁</div><input className="stats-input" {...field3.bind} /></div>
              <div><div className="stats-field-label">df₂</div><input className="stats-input" {...field4.bind} /></div>
            </div>
          )}
          <TailSelector value={tail} onChange={setTail} />
        </div>
      );
    }

    // Regression (all 5)
    if (['regression', 'correlation', 'rSquared', 'residualSE', 'predict'].includes(fn)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div><div className="stats-field-label">x values</div><input className="stats-input" placeholder="1, 2, 3, 4, 5, 6" {...dataset.bind} /></div>
            <div><div className="stats-field-label">y values</div><input className="stats-input" placeholder="2.1, 4.0, 5.8, 8.1, 9.9, 12.2" {...dataset2.bind} /></div>
          </div>
          {fn === 'predict' && (
            <div><div className="stats-field-label">x₀ (predict at)</div><input className="stats-input" placeholder="7" {...field1.bind} /></div>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="stats-form">
      <div className="stats-form-title">{TITLES[fn] ?? fn}</div>
      {renderInputs()}
      <button
        type="button"
        className="calc-key accent"
        style={{ marginTop: '12px', width: '100%', padding: '10px' }}
        onClick={compute}
      >
        Compute
      </button>
      {error && <div className="stats-error">{error}</div>}
      {result && <FormulaDisplay steps={result.steps} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/components/calculator/StatsForm.tsx
git commit -m "feat(calc): add StatsForm with all 22 function inputs and compute logic"
```

---

### Task 10: Implement StatsCalculator and wire into page

**Files:**
- Create: `src/components/calculator/StatsCalculator.tsx`
- Modify: `src/pages/tools/ToolCalculatorPage.tsx`

- [ ] **Step 1: Create StatsCalculator.tsx**

```typescript
import { useState } from 'react';
import { StatsGrid, type StatFunction } from './StatsGrid';
import { StatsForm } from './StatsForm';

export function StatsCalculator() {
  const [selected, setSelected] = useState<StatFunction | null>(null);

  return (
    <div>
      <StatsGrid selected={selected} onSelect={setSelected} />
      {selected && <StatsForm key={selected} fn={selected} />}
    </div>
  );
}
```

- [ ] **Step 2: Update ToolCalculatorPage to import StatsCalculator**

In `src/pages/tools/ToolCalculatorPage.tsx`, replace the placeholder:

Add import:
```typescript
import { StatsCalculator } from '@/components/calculator/StatsCalculator';
```

Replace the stats mode placeholder div with:
```typescript
<StatsCalculator />
```

- [ ] **Step 3: Verify build**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build 2>&1 | tail -5
```
Expected: Build succeeds.

- [ ] **Step 4: Start dev server and test in browser**

```bash
cd .worktrees/feat-statistics-calculator && npx vite --open
```

Test:
1. Scientific mode works with 6-column grid, pill toggle visible
2. Switch to Statistics mode — button grid appears with 4 categories
3. Click "Mean" — form expands with dataset input
4. Enter `12, 15, 18, 22, 25, 30, 31, 28` and click Compute
5. Verify step-by-step formula appears with correct result (22.625)
6. Test a distribution: click Norm Z, enter 1.96, click Compute → p ≈ 0.975
7. Test paired t: enter two datasets, verify formula shows differences
8. Test ANOVA: add groups, verify F and p displayed

- [ ] **Step 5: Commit**

```bash
cd .worktrees/feat-statistics-calculator
git add src/components/calculator/StatsCalculator.tsx src/pages/tools/ToolCalculatorPage.tsx
git commit -m "feat(calc): wire up StatsCalculator with grid + form into page shell"
```

---

### Task 11: Final integration test and cleanup

**Files:**
- Modify: various (fix any issues found)

- [ ] **Step 1: Run all statistics tests**

```bash
cd .worktrees/feat-statistics-calculator && npx tsx src/lib/statistics.test.ts
```
Expected: All pass.

- [ ] **Step 2: Run full build**

```bash
cd .worktrees/feat-statistics-calculator && npx vite build
```
Expected: Clean build, no errors.

- [ ] **Step 3: Manual browser test of all function categories**

Start dev server and test one function from each category:
- Descriptive: Variance with [10, 20, 30] → check formula shows (10-20)² + (20-20)² + (30-20)² / 2 = 100
- Distribution: t inverse with p=0.975, df=10 → should return ~2.228
- Hypothesis: Two-sample t with summary stats → check Welch-Satterthwaite df in formula
- Regression: Enter x=[1,2,3,4,5] y=[2,4,5,4,5] → check slope, intercept, and formula

- [ ] **Step 4: Commit any fixes**

```bash
cd .worktrees/feat-statistics-calculator
git add -A
git commit -m "fix(calc): integration fixes from browser testing"
```

(Skip this commit if no fixes were needed.)
