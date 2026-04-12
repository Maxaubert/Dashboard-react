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
