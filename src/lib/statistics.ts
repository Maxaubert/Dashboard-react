// @ts-expect-error jstat has no named export; default is the jStat object
import jStat from 'jstat';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormulaStep {
  label: string;
  content: string;
}

export interface StatResult {
  result: number | Record<string, number>;
  steps: FormulaStep[];
}

// ── parseDataset ──────────────────────────────────────────────────────────────

/**
 * Parse a comma- or space-separated string into an array of numbers.
 * Ignores empty tokens (handles trailing commas, extra whitespace, etc.).
 */
export function parseDataset(input: string): number[] {
  if (!input.trim()) return [];
  return input
    .split(/[\s,]+/)
    .filter((token) => token.length > 0)
    .map(Number);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return parseFloat(n.toPrecision(6)).toString();
}

// ── computeMean ───────────────────────────────────────────────────────────────

/**
 * Arithmetic mean: μ = Σxᵢ / n
 * Returns a StatResult with FORMULA, SUBSTITUTED, and RESULT steps.
 */
export function computeMean(data: number[]): StatResult {
  const n = data.length;
  const sum = data.reduce((acc, x) => acc + x, 0);
  const mean = sum / n;

  const steps: FormulaStep[] = [
    {
      label: 'FORMULA',
      content: 'mean = Σxᵢ / n',
    },
    {
      label: 'SUBSTITUTED',
      content: `mean = (${data.join(' + ')}) / ${n} = ${fmt(sum)} / ${n}`,
    },
    {
      label: 'RESULT',
      content: `mean = ${fmt(mean)}`,
    },
  ];

  return { result: mean, steps };
}

// ── computeMedian ─────────────────────────────────────────────────────────────

/**
 * Median: middle value of sorted data (average of two middle values if even).
 * Returns a StatResult with FORMULA, SUBSTITUTED, and RESULT steps.
 */
export function computeMedian(data: number[]): StatResult {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  let median: number;
  let substitutedContent: string;

  if (n % 2 === 1) {
    const midIndex = Math.floor(n / 2);
    median = sorted[midIndex];
    substitutedContent = `sorted: [${sorted.join(', ')}]; middle index = ${midIndex}; median = ${fmt(median)}`;
  } else {
    const lo = n / 2 - 1;
    const hi = n / 2;
    median = (sorted[lo] + sorted[hi]) / 2;
    substitutedContent = `sorted: [${sorted.join(', ')}]; middle indices = ${lo}, ${hi}; median = (${sorted[lo]} + ${sorted[hi]}) / 2 = ${fmt(median)}`;
  }

  const steps: FormulaStep[] = [
    {
      label: 'FORMULA',
      content:
        n % 2 === 1
          ? 'median = x[(n+1)/2]  (middle value of sorted data)'
          : 'median = (x[n/2] + x[n/2+1]) / 2  (average of two middle values)',
    },
    {
      label: 'SUBSTITUTED',
      content: substitutedContent,
    },
    {
      label: 'RESULT',
      content: `median = ${fmt(median)}`,
    },
  ];

  return { result: median, steps };
}

// ── computeVariance ───────────────────────────────────────────────────────────

/**
 * Sample variance: s² = Σ(xᵢ − x̄)² / (n − 1)
 * Returns a StatResult with FORMULA, SUBSTITUTED, and RESULT steps.
 */
export function computeVariance(data: number[]): StatResult {
  const n = data.length;
  const { result: meanResult } = computeMean(data);
  const mean = meanResult as number;

  const squaredDiffs = data.map((x) => (x - mean) ** 2);
  const sumSq = squaredDiffs.reduce((acc, v) => acc + v, 0);
  const variance = sumSq / (n - 1);

  const diffsStr = data.map((x) => `(${x} − ${fmt(mean)})²`).join(' + ');
  const diffsEval = squaredDiffs.map((v) => fmt(v)).join(' + ');

  const steps: FormulaStep[] = [
    {
      label: 'FORMULA',
      content: 's² = Σ(xᵢ − x̄)² / (n − 1)',
    },
    {
      label: 'SUBSTITUTED',
      content: `s² = (${diffsStr}) / (${n} − 1) = (${diffsEval}) / ${n - 1} = ${fmt(sumSq)} / ${n - 1}`,
    },
    {
      label: 'RESULT',
      content: `s² = ${fmt(variance)}`,
    },
  ];

  return { result: variance, steps };
}

// ── computeStdDev ─────────────────────────────────────────────────────────────

/**
 * Sample standard deviation: s = √s²
 * Returns a StatResult with FORMULA, SUBSTITUTED, and RESULT steps.
 */
export function computeStdDev(data: number[]): StatResult {
  const { result: varianceResult } = computeVariance(data);
  const variance = varianceResult as number;
  const stdDev = Math.sqrt(variance);

  const steps: FormulaStep[] = [
    {
      label: 'FORMULA',
      content: 's = √s²',
    },
    {
      label: 'SUBSTITUTED',
      content: `s = √${fmt(variance)}`,
    },
    {
      label: 'RESULT',
      content: `s = ${fmt(stdDev)}`,
    },
  ];

  return { result: stdDev, steps };
}

// ── computeRange ──────────────────────────────────────────────────────────────

/**
 * Range: max(x) − min(x)
 * Returns a StatResult with FORMULA, SUBSTITUTED, and RESULT steps.
 */
export function computeRange(data: number[]): StatResult {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  const steps: FormulaStep[] = [
    {
      label: 'FORMULA',
      content: 'range = max(x) − min(x)',
    },
    {
      label: 'SUBSTITUTED',
      content: `range = ${max} − ${min}`,
    },
    {
      label: 'RESULT',
      content: `range = ${fmt(range)}`,
    },
  ];

  return { result: range, steps };
}

// ── Distribution Types ────────────────────────────────────────────────────────

export type Tail = 'left' | 'right' | 'two';

// ── Distribution Helpers ──────────────────────────────────────────────────────

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  // Use the smaller k for efficiency
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

function applyTail(leftP: number, tail: Tail): number {
  if (tail === 'left') return leftP;
  if (tail === 'right') return 1 - leftP;
  // two-tailed: 2 * min(leftP, 1-leftP)
  return 2 * Math.min(leftP, 1 - leftP);
}

// ── computeNormalCdf ──────────────────────────────────────────────────────────

/**
 * Normal distribution CDF: P for a given z-score.
 * Uses standard normal (μ=0, σ=1).
 */
export function computeNormalCdf(z: number, tail: Tail): StatResult {
  const leftP = jStat.normal.cdf(z, 0, 1);
  const p = applyTail(leftP, tail);

  const tailLabel =
    tail === 'left' ? 'P(Z ≤ z)' : tail === 'right' ? 'P(Z ≥ z)' : 'P(|Z| ≥ |z|)';

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: `${tailLabel} using standard normal CDF Φ(z)` },
    { label: 'SUBSTITUTED', content: `z = ${fmt(z)}, tail = ${tail}, Φ(${fmt(z)}) = ${fmt(leftP)}` },
    { label: 'RESULT', content: `p = ${fmt(p)}` },
  ];

  return { result: p, steps };
}

// ── computeNormalInv ──────────────────────────────────────────────────────────

/**
 * Inverse normal CDF: z-score for a given left-tail probability.
 */
export function computeNormalInv(p: number): StatResult {
  const z = jStat.normal.inv(p, 0, 1);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'z = Φ⁻¹(p) for standard normal (μ=0, σ=1)' },
    { label: 'SUBSTITUTED', content: `p = ${fmt(p)}` },
    { label: 'RESULT', content: `z = ${fmt(z)}` },
  ];

  return { result: z, steps };
}

// ── computeTCdf ───────────────────────────────────────────────────────────────

/**
 * Student's t-distribution CDF.
 */
export function computeTCdf(t: number, df: number, tail: Tail): StatResult {
  const leftP = jStat.studentt.cdf(t, df);
  const p = applyTail(leftP, tail);

  const tailLabel =
    tail === 'left' ? 'P(T ≤ t)' : tail === 'right' ? 'P(T ≥ t)' : 'P(|T| ≥ |t|)';

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: `${tailLabel} using Student's t-distribution CDF with df degrees of freedom` },
    { label: 'SUBSTITUTED', content: `t = ${fmt(t)}, df = ${df}, tail = ${tail}, CDF(${fmt(t)}) = ${fmt(leftP)}` },
    { label: 'RESULT', content: `p = ${fmt(p)}` },
  ];

  return { result: p, steps };
}

// ── computeTInv ───────────────────────────────────────────────────────────────

/**
 * Inverse Student's t-distribution CDF (quantile function).
 */
export function computeTInv(p: number, df: number): StatResult {
  const t = jStat.studentt.inv(p, df);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 't = t⁻¹(p, df) inverse t-distribution CDF' },
    { label: 'SUBSTITUTED', content: `p = ${fmt(p)}, df = ${df}` },
    { label: 'RESULT', content: `t = ${fmt(t)}` },
  ];

  return { result: t, steps };
}

// ── computeChi2Cdf ────────────────────────────────────────────────────────────

/**
 * Chi-squared distribution CDF.
 */
export function computeChi2Cdf(x: number, df: number, tail: Tail): StatResult {
  const leftP = jStat.chisquare.cdf(x, df);
  const p = applyTail(leftP, tail);

  const tailLabel =
    tail === 'left' ? 'P(X² ≤ x)' : tail === 'right' ? 'P(X² ≥ x)' : 'P(|X²| ≥ |x|)';

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: `${tailLabel} using chi-squared CDF with df degrees of freedom` },
    { label: 'SUBSTITUTED', content: `x = ${fmt(x)}, df = ${df}, tail = ${tail}, CDF(${fmt(x)}) = ${fmt(leftP)}` },
    { label: 'RESULT', content: `p = ${fmt(p)}` },
  ];

  return { result: p, steps };
}

// ── computeChi2Inv ────────────────────────────────────────────────────────────

/**
 * Inverse chi-squared distribution CDF (quantile function).
 */
export function computeChi2Inv(p: number, df: number): StatResult {
  const x = jStat.chisquare.inv(p, df);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'x = χ²⁻¹(p, df) inverse chi-squared CDF' },
    { label: 'SUBSTITUTED', content: `p = ${fmt(p)}, df = ${df}` },
    { label: 'RESULT', content: `x = ${fmt(x)}` },
  ];

  return { result: x, steps };
}

// ── computeFCdf ───────────────────────────────────────────────────────────────

/**
 * F-distribution CDF.
 */
export function computeFCdf(f: number, df1: number, df2: number, tail: Tail): StatResult {
  const leftP = jStat.centralF.cdf(f, df1, df2);
  const p = applyTail(leftP, tail);

  const tailLabel =
    tail === 'left' ? 'P(F ≤ f)' : tail === 'right' ? 'P(F ≥ f)' : 'P(|F| ≥ |f|)';

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: `${tailLabel} using F-distribution CDF with df1, df2 degrees of freedom` },
    { label: 'SUBSTITUTED', content: `f = ${fmt(f)}, df1 = ${df1}, df2 = ${df2}, tail = ${tail}, CDF(${fmt(f)}) = ${fmt(leftP)}` },
    { label: 'RESULT', content: `p = ${fmt(p)}` },
  ];

  return { result: p, steps };
}

// ── computeFInv ───────────────────────────────────────────────────────────────

/**
 * Inverse F-distribution CDF (quantile function).
 */
export function computeFInv(p: number, df1: number, df2: number): StatResult {
  const f = jStat.centralF.inv(p, df1, df2);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'f = F⁻¹(p, df1, df2) inverse F-distribution CDF' },
    { label: 'SUBSTITUTED', content: `p = ${fmt(p)}, df1 = ${df1}, df2 = ${df2}` },
    { label: 'RESULT', content: `f = ${fmt(f)}` },
  ];

  return { result: f, steps };
}

// ── computeBinomialPmf ────────────────────────────────────────────────────────

/**
 * Binomial probability mass function: P(X = k).
 * Manual computation: C(n,k) * p^k * (1-p)^(n-k)
 */
export function computeBinomialPmf(n: number, p: number, k: number): StatResult {
  const coeff = comb(n, k);
  const prob = coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'P(X = k) = C(n,k) · pᵏ · (1−p)ⁿ⁻ᵏ' },
    {
      label: 'SUBSTITUTED',
      content: `P(X = ${k}) = C(${n},${k}) · ${fmt(p)}^${k} · ${fmt(1 - p)}^${n - k} = ${fmt(coeff)} · ${fmt(Math.pow(p, k))} · ${fmt(Math.pow(1 - p, n - k))}`,
    },
    { label: 'RESULT', content: `P(X = ${k}) = ${fmt(prob)}` },
  ];

  return { result: prob, steps };
}

// ── computeBinomialCdf ────────────────────────────────────────────────────────

/**
 * Binomial cumulative distribution function: P(X ≤ k).
 * Sum of PMFs from 0 to k.
 */
export function computeBinomialCdf(n: number, p: number, k: number): StatResult {
  let cumProb = 0;
  const terms: string[] = [];
  for (let i = 0; i <= k; i++) {
    const pmf = comb(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    cumProb += pmf;
    terms.push(`P(X=${i})=${fmt(pmf)}`);
  }

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'P(X ≤ k) = Σᵢ₌₀ᵏ C(n,i) · pⁱ · (1−p)ⁿ⁻ⁱ' },
    { label: 'SUBSTITUTED', content: `n=${n}, p=${fmt(p)}, k=${k}; terms: ${terms.join(', ')}` },
    { label: 'RESULT', content: `P(X ≤ ${k}) = ${fmt(cumProb)}` },
  ];

  return { result: cumProb, steps };
}

// ── computePoissonPmf ─────────────────────────────────────────────────────────

/**
 * Poisson probability mass function: P(X = k).
 * Manual computation: (λ^k * e^-λ) / k!
 */
export function computePoissonPmf(lambda: number, k: number): StatResult {
  const prob = (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'P(X = k) = (λᵏ · e⁻λ) / k!' },
    {
      label: 'SUBSTITUTED',
      content: `P(X = ${k}) = (${fmt(lambda)}^${k} · e^−${fmt(lambda)}) / ${k}! = (${fmt(Math.pow(lambda, k))} · ${fmt(Math.exp(-lambda))}) / ${factorial(k)}`,
    },
    { label: 'RESULT', content: `P(X = ${k}) = ${fmt(prob)}` },
  ];

  return { result: prob, steps };
}

// ── computePoissonCdf ─────────────────────────────────────────────────────────

/**
 * Poisson cumulative distribution function: P(X ≤ k).
 * Sum of PMFs from 0 to k.
 */
export function computePoissonCdf(lambda: number, k: number): StatResult {
  let cumProb = 0;
  const terms: string[] = [];
  for (let i = 0; i <= k; i++) {
    const pmf = (Math.pow(lambda, i) * Math.exp(-lambda)) / factorial(i);
    cumProb += pmf;
    terms.push(`P(X=${i})=${fmt(pmf)}`);
  }

  const steps: FormulaStep[] = [
    { label: 'FORMULA', content: 'P(X ≤ k) = Σᵢ₌₀ᵏ (λⁱ · e⁻λ) / i!' },
    { label: 'SUBSTITUTED', content: `λ=${fmt(lambda)}, k=${k}; terms: ${terms.join(', ')}` },
    { label: 'RESULT', content: `P(X ≤ ${k}) = ${fmt(cumProb)}` },
  ];

  return { result: cumProb, steps };
}
