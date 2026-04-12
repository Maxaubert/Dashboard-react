import { useState } from 'react';
import type { StatFunction } from './StatsGrid';
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
import type { StatResult } from '@/lib/statistics';
import { FormulaDisplay } from './FormulaDisplay';

export interface StatsFormProps {
  fn: StatFunction;
}

const TITLES: Record<string, string> = {
  mean: 'MEAN',
  median: 'MEDIAN',
  variance: 'VARIANCE (sample)',
  stddev: 'STANDARD DEVIATION (sample)',
  range: 'RANGE',
  normalCdf: 'NORMAL (Z)',
  normalInv: 'NORMAL INVERSE',
  tCdf: "STUDENT'S t",
  tInv: "STUDENT'S t INVERSE",
  chi2Cdf: 'CHI-SQUARE (χ²)',
  chi2Inv: 'CHI-SQUARE INVERSE',
  fCdf: 'F-DISTRIBUTION',
  fInv: 'F-DISTRIBUTION INVERSE',
  binomialPmf: 'BINOMIAL',
  binomialCdf: 'BINOMIAL CDF',
  poissonPmf: 'POISSON',
  poissonCdf: 'POISSON CDF',
  zTest: 'Z-TEST',
  oneSampleT: 'ONE-SAMPLE t-TEST',
  twoSampleT: "TWO-SAMPLE t-TEST (Welch's)",
  pairedT: 'PAIRED t-TEST',
  anova: 'ANOVA (F-TEST)',
  pValue: 'P-VALUE CALCULATOR',
  regression: 'LEAST-SQUARES REGRESSION',
  correlation: 'CORRELATION (r)',
  rSquared: 'R-SQUARED',
  predict: 'PREDICTION',
  residualSE: 'RESIDUAL STANDARD ERROR',
};

// Helper hook for input fields
function useField(initial = '') {
  const [value, setValue] = useState(initial);
  return { value, setValue, bind: { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue(e.target.value) } };
}

type Tail = 'left' | 'two' | 'right';

// TailSelector pill toggle component
function TailSelector({ tail, onChange }: { tail: Tail; onChange: (t: Tail) => void }) {
  return (
    <div className="tail-selector">
      {(['left', 'two', 'right'] as Tail[]).map((t) => (
        <button
          key={t}
          type="button"
          className={`tail-btn${tail === t ? ' active' : ''}`}
          onClick={() => onChange(t)}
        >
          {t === 'left' ? 'Left' : t === 'two' ? 'Two' : 'Right'}
        </button>
      ))}
    </div>
  );
}

// InputModeToggle for CDF/Inverse or Summary/Raw toggles
function InputModeToggle({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="input-mode-toggle">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`input-mode-btn${value === opt ? ' active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function StatsForm({ fn }: StatsFormProps) {
  // Shared input state
  const dataset = useField('');
  const dataset2 = useField('');
  const xVals = useField('');
  const yVals = useField('');
  const x0Field = useField('');

  // Distribution fields
  const zVal = useField('');
  const probVal = useField('');
  const tVal = useField('');
  const dfField = useField('');
  const df1Field = useField('');
  const df2Field = useField('');
  const chi2Val = useField('');
  const fVal = useField('');

  // Binomial / Poisson
  const nField = useField('');
  const pField = useField('');
  const kField = useField('');
  const lambdaField = useField('');

  // Hypothesis test summary fields
  const xbar1 = useField('');
  const s1 = useField('');
  const n1 = useField('');
  const xbar2 = useField('');
  const s2 = useField('');
  const n2 = useField('');
  const xbarField = useField('');
  const mu0Field = useField('');
  const sigmaField = useField('');
  const nTestField = useField('');

  // p-value calculator
  const testStatField = useField('');
  const [pDist, setPDist] = useState<'normal' | 't' | 'chi2' | 'f'>('normal');
  const pDfField = useField('');
  const pDf1Field = useField('');
  const pDf2Field = useField('');

  // ANOVA groups
  const [anovaGroups, setAnovaGroups] = useState<string[]>(['', '']);

  // Mode toggles
  const [tail, setTail] = useState<Tail>('two');
  const [distMode, setDistMode] = useState<'CDF' | 'Inverse'>('CDF');
  const [binomialMode, setBinomialMode] = useState<'Exact' | 'Cumulative'>('Exact');
  const [poissonMode, setPoissonMode] = useState<'Exact' | 'Cumulative'>('Exact');
  const [twoSampleMode, setTwoSampleMode] = useState<'Summary' | 'Raw'>('Summary');

  // Result state
  const [result, setResult] = useState<StatResult | null>(null);
  const [error, setError] = useState<string>('');

  function setErr(msg: string) {
    setError(msg);
    setResult(null);
  }

  function setRes(r: StatResult) {
    setResult(r);
    setError('');
  }

  function compute() {
    try {
      switch (fn) {
        // ── Descriptive ──────────────────────────────────────────────────────
        case 'mean': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) return setErr('Enter at least one number');
          setRes(computeMean(data));
          break;
        }
        case 'median': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) return setErr('Enter at least one number');
          setRes(computeMedian(data));
          break;
        }
        case 'variance': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) return setErr('Enter at least one number');
          if (data.length < 2) return setErr('Need at least 2 values');
          setRes(computeVariance(data));
          break;
        }
        case 'stddev': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) return setErr('Enter at least one number');
          if (data.length < 2) return setErr('Need at least 2 values');
          setRes(computeStdDev(data));
          break;
        }
        case 'range': {
          const data = parseDataset(dataset.value);
          if (data.length === 0) return setErr('Enter at least one number');
          setRes(computeRange(data));
          break;
        }

        // ── Normal ───────────────────────────────────────────────────────────
        case 'normalCdf': {
          if (distMode === 'Inverse') {
            const p = parseFloat(probVal.value);
            if (isNaN(p)) return setErr('Enter a probability');
            setRes(computeNormalInv(p));
          } else {
            const z = parseFloat(zVal.value);
            if (isNaN(z)) return setErr('Enter a z value');
            setRes(computeNormalCdf(z, tail));
          }
          break;
        }
        case 'normalInv': {
          const p = parseFloat(probVal.value);
          if (isNaN(p)) return setErr('Enter a probability');
          setRes(computeNormalInv(p));
          break;
        }

        // ── t-distribution ───────────────────────────────────────────────────
        case 'tCdf': {
          if (distMode === 'Inverse') {
            const p = parseFloat(probVal.value);
            const df = parseFloat(dfField.value);
            if (isNaN(p) || isNaN(df)) return setErr('Enter probability and df');
            setRes(computeTInv(p, df));
          } else {
            const t = parseFloat(tVal.value);
            const df = parseFloat(dfField.value);
            if (isNaN(t) || isNaN(df)) return setErr('Enter t value and df');
            setRes(computeTCdf(t, df, tail));
          }
          break;
        }
        case 'tInv': {
          const p = parseFloat(probVal.value);
          const df = parseFloat(dfField.value);
          if (isNaN(p) || isNaN(df)) return setErr('Enter probability and df');
          setRes(computeTInv(p, df));
          break;
        }

        // ── Chi-squared ──────────────────────────────────────────────────────
        case 'chi2Cdf': {
          if (distMode === 'Inverse') {
            const p = parseFloat(probVal.value);
            const df = parseFloat(dfField.value);
            if (isNaN(p) || isNaN(df)) return setErr('Enter probability and df');
            setRes(computeChi2Inv(p, df));
          } else {
            const x = parseFloat(chi2Val.value);
            const df = parseFloat(dfField.value);
            if (isNaN(x) || isNaN(df)) return setErr('Enter χ² value and df');
            setRes(computeChi2Cdf(x, df, tail));
          }
          break;
        }
        case 'chi2Inv': {
          const p = parseFloat(probVal.value);
          const df = parseFloat(dfField.value);
          if (isNaN(p) || isNaN(df)) return setErr('Enter probability and df');
          setRes(computeChi2Inv(p, df));
          break;
        }

        // ── F-distribution ───────────────────────────────────────────────────
        case 'fCdf': {
          if (distMode === 'Inverse') {
            const p = parseFloat(probVal.value);
            const d1 = parseFloat(df1Field.value);
            const d2 = parseFloat(df2Field.value);
            if (isNaN(p) || isNaN(d1) || isNaN(d2)) return setErr('Enter probability, df1, and df2');
            setRes(computeFInv(p, d1, d2));
          } else {
            const f = parseFloat(fVal.value);
            const d1 = parseFloat(df1Field.value);
            const d2 = parseFloat(df2Field.value);
            if (isNaN(f) || isNaN(d1) || isNaN(d2)) return setErr('Enter F value, df1, and df2');
            setRes(computeFCdf(f, d1, d2, tail));
          }
          break;
        }
        case 'fInv': {
          const p = parseFloat(probVal.value);
          const d1 = parseFloat(df1Field.value);
          const d2 = parseFloat(df2Field.value);
          if (isNaN(p) || isNaN(d1) || isNaN(d2)) return setErr('Enter probability, df1, and df2');
          setRes(computeFInv(p, d1, d2));
          break;
        }

        // ── Binomial ─────────────────────────────────────────────────────────
        case 'binomialPmf':
        case 'binomialCdf': {
          const n = parseFloat(nField.value);
          const p = parseFloat(pField.value);
          const k = parseFloat(kField.value);
          if (isNaN(n) || isNaN(p) || isNaN(k)) return setErr('Enter n, p, and k');
          const isCumulative = fn === 'binomialCdf' || binomialMode === 'Cumulative';
          setRes(isCumulative ? computeBinomialCdf(n, p, k) : computeBinomialPmf(n, p, k));
          break;
        }

        // ── Poisson ──────────────────────────────────────────────────────────
        case 'poissonPmf':
        case 'poissonCdf': {
          const lambda = parseFloat(lambdaField.value);
          const k = parseFloat(kField.value);
          if (isNaN(lambda) || isNaN(k)) return setErr('Enter λ and k');
          const isCumulative = fn === 'poissonCdf' || poissonMode === 'Cumulative';
          setRes(isCumulative ? computePoissonCdf(lambda, k) : computePoissonPmf(lambda, k));
          break;
        }

        // ── Z-Test ───────────────────────────────────────────────────────────
        case 'zTest': {
          const xb = parseFloat(xbarField.value);
          const mu = parseFloat(mu0Field.value);
          const sigma = parseFloat(sigmaField.value);
          const n = parseFloat(nTestField.value);
          if (isNaN(xb) || isNaN(mu) || isNaN(sigma) || isNaN(n)) return setErr('Enter x̄, μ₀, σ, and n');
          setRes(computeZTest(xb, mu, sigma, n, tail));
          break;
        }

        // ── One-sample t-test ────────────────────────────────────────────────
        case 'oneSampleT': {
          const xb = parseFloat(xbarField.value);
          const mu = parseFloat(mu0Field.value);
          const s = parseFloat(sigmaField.value);
          const n = parseFloat(nTestField.value);
          if (isNaN(xb) || isNaN(mu) || isNaN(s) || isNaN(n)) return setErr('Enter x̄, μ₀, s, and n');
          setRes(computeOneSampleTTest(xb, mu, s, n, tail));
          break;
        }

        // ── Two-sample t-test ────────────────────────────────────────────────
        case 'twoSampleT': {
          if (twoSampleMode === 'Raw') {
            const data1 = parseDataset(dataset.value);
            const data2 = parseDataset(dataset2.value);
            if (data1.length < 2) return setErr('Need at least 2 values per group');
            if (data2.length < 2) return setErr('Need at least 2 values per group');
            const m1 = data1.reduce((a, x) => a + x, 0) / data1.length;
            const m2 = data2.reduce((a, x) => a + x, 0) / data2.length;
            const sd1 = Math.sqrt(data1.reduce((a, x) => a + (x - m1) ** 2, 0) / (data1.length - 1));
            const sd2 = Math.sqrt(data2.reduce((a, x) => a + (x - m2) ** 2, 0) / (data2.length - 1));
            setRes(computeTwoSampleTTest(m1, sd1, data1.length, m2, sd2, data2.length, tail));
          } else {
            const xb1 = parseFloat(xbar1.value);
            const sd1 = parseFloat(s1.value);
            const nn1 = parseFloat(n1.value);
            const xb2 = parseFloat(xbar2.value);
            const sd2 = parseFloat(s2.value);
            const nn2 = parseFloat(n2.value);
            if (isNaN(xb1) || isNaN(sd1) || isNaN(nn1) || isNaN(xb2) || isNaN(sd2) || isNaN(nn2)) {
              return setErr('Enter x̄, s, and n for both groups');
            }
            setRes(computeTwoSampleTTest(xb1, sd1, nn1, xb2, sd2, nn2, tail));
          }
          break;
        }

        // ── Paired t-test ────────────────────────────────────────────────────
        case 'pairedT': {
          const data1 = parseDataset(dataset.value);
          const data2 = parseDataset(dataset2.value);
          if (data1.length === 0 || data2.length === 0) return setErr('Enter at least one number');
          if (data1.length !== data2.length) {
            return setErr(`Datasets must have the same number of values (got ${data1.length} and ${data2.length})`);
          }
          setRes(computePairedTTest(data1, data2, tail));
          break;
        }

        // ── ANOVA ────────────────────────────────────────────────────────────
        case 'anova': {
          const groups = anovaGroups
            .map((g) => parseDataset(g))
            .filter((g) => g.length > 0);
          if (groups.length < 2) return setErr('Need at least 2 groups');
          const badGroup = groups.find((g) => g.length < 2);
          if (badGroup) return setErr('Each group needs at least 2 values');
          setRes(computeAnova(groups));
          break;
        }

        // ── p-value calculator ───────────────────────────────────────────────
        case 'pValue': {
          const ts = parseFloat(testStatField.value);
          if (isNaN(ts)) return setErr('Enter a test statistic');
          const params: { df?: number; df1?: number; df2?: number } = {};
          if (pDist === 't' || pDist === 'chi2') {
            const df = parseFloat(pDfField.value);
            if (isNaN(df)) return setErr('Enter df');
            params.df = df;
          } else if (pDist === 'f') {
            const d1 = parseFloat(pDf1Field.value);
            const d2 = parseFloat(pDf2Field.value);
            if (isNaN(d1) || isNaN(d2)) return setErr('Enter df1 and df2');
            params.df1 = d1;
            params.df2 = d2;
          }
          setRes(computePValue(ts, pDist, tail, params));
          break;
        }

        // ── Regression ───────────────────────────────────────────────────────
        case 'regression': {
          const xs = parseDataset(xVals.value);
          const ys = parseDataset(yVals.value);
          if (xs.length < 2 || ys.length < 2) return setErr('Need at least 2 data points');
          if (xs.length !== ys.length) {
            return setErr(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`);
          }
          setRes(computeRegression(xs, ys));
          break;
        }
        case 'correlation': {
          const xs = parseDataset(xVals.value);
          const ys = parseDataset(yVals.value);
          if (xs.length < 2 || ys.length < 2) return setErr('Need at least 2 data points');
          if (xs.length !== ys.length) {
            return setErr(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`);
          }
          setRes(computeCorrelation(xs, ys));
          break;
        }
        case 'rSquared': {
          const xs = parseDataset(xVals.value);
          const ys = parseDataset(yVals.value);
          if (xs.length < 2 || ys.length < 2) return setErr('Need at least 2 data points');
          if (xs.length !== ys.length) {
            return setErr(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`);
          }
          setRes(computeRSquared(xs, ys));
          break;
        }
        case 'predict': {
          const xs = parseDataset(xVals.value);
          const ys = parseDataset(yVals.value);
          const x0 = parseFloat(x0Field.value);
          if (xs.length < 2 || ys.length < 2) return setErr('Need at least 2 data points');
          if (xs.length !== ys.length) {
            return setErr(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`);
          }
          if (isNaN(x0)) return setErr('Enter an x₀ value');
          setRes(computeRegressionPredict(xs, ys, x0));
          break;
        }
        case 'residualSE': {
          const xs = parseDataset(xVals.value);
          const ys = parseDataset(yVals.value);
          if (xs.length < 2 || ys.length < 2) return setErr('Need at least 2 data points');
          if (xs.length !== ys.length) {
            return setErr(`Datasets must have the same number of values (got ${xs.length} and ${ys.length})`);
          }
          setRes(computeResidualSE(xs, ys));
          break;
        }

        default:
          setErr('Unknown function');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Computation error');
    }
  }

  function renderInputs() {
    // Descriptive: single dataset textarea
    if (['mean', 'median', 'variance', 'stddev', 'range'].includes(fn)) {
      return (
        <div>
          <div className="stats-field-label">Data (comma or space separated)</div>
          <textarea className="stats-input" rows={3} style={{ width: '100%', resize: 'vertical' }} {...dataset.bind} placeholder="e.g. 1, 2, 3, 4, 5" />
        </div>
      );
    }

    // Normal distribution
    if (fn === 'normalCdf' || fn === 'normalInv') {
      if (fn === 'normalInv') {
        return (
          <div>
            <div className="stats-field-label">Probability (p)</div>
            <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
          </div>
        );
      }
      return (
        <div>
          <InputModeToggle options={['CDF', 'Inverse']} value={distMode} onChange={(v) => setDistMode(v as 'CDF' | 'Inverse')} />
          {distMode === 'CDF' ? (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>z value</div>
              <input className="stats-input" type="number" step="any" {...zVal.bind} placeholder="e.g. 1.96" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
              <TailSelector tail={tail} onChange={setTail} />
            </>
          ) : (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Probability (p)</div>
              <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
            </>
          )}
        </div>
      );
    }

    // t-distribution
    if (fn === 'tCdf' || fn === 'tInv') {
      if (fn === 'tInv') {
        return (
          <div>
            <div className="stats-field-label">Probability (p)</div>
            <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
            <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
            <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 10" />
          </div>
        );
      }
      return (
        <div>
          <InputModeToggle options={['CDF', 'Inverse']} value={distMode} onChange={(v) => setDistMode(v as 'CDF' | 'Inverse')} />
          {distMode === 'CDF' ? (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>t value</div>
              <input className="stats-input" type="number" step="any" {...tVal.bind} placeholder="e.g. 2.0" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
              <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 10" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
              <TailSelector tail={tail} onChange={setTail} />
            </>
          ) : (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Probability (p)</div>
              <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
              <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 10" />
            </>
          )}
        </div>
      );
    }

    // Chi-squared distribution
    if (fn === 'chi2Cdf' || fn === 'chi2Inv') {
      if (fn === 'chi2Inv') {
        return (
          <div>
            <div className="stats-field-label">Probability (p)</div>
            <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
            <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
            <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 5" />
          </div>
        );
      }
      return (
        <div>
          <InputModeToggle options={['CDF', 'Inverse']} value={distMode} onChange={(v) => setDistMode(v as 'CDF' | 'Inverse')} />
          {distMode === 'CDF' ? (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>χ² value</div>
              <input className="stats-input" type="number" step="any" {...chi2Val.bind} placeholder="e.g. 3.84" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
              <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 5" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
              <TailSelector tail={tail} onChange={setTail} />
            </>
          ) : (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Probability (p)</div>
              <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
              <input className="stats-input" type="number" step="any" {...dfField.bind} placeholder="e.g. 5" />
            </>
          )}
        </div>
      );
    }

    // F-distribution
    if (fn === 'fCdf' || fn === 'fInv') {
      if (fn === 'fInv') {
        return (
          <div>
            <div className="stats-field-label">Probability (p)</div>
            <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">df1</div>
                <input className="stats-input" type="number" step="any" {...df1Field.bind} placeholder="e.g. 3" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">df2</div>
                <input className="stats-input" type="number" step="any" {...df2Field.bind} placeholder="e.g. 20" />
              </div>
            </div>
          </div>
        );
      }
      return (
        <div>
          <InputModeToggle options={['CDF', 'Inverse']} value={distMode} onChange={(v) => setDistMode(v as 'CDF' | 'Inverse')} />
          {distMode === 'CDF' ? (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>F value</div>
              <input className="stats-input" type="number" step="any" {...fVal.bind} placeholder="e.g. 2.5" />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div className="stats-field-label">df1</div>
                  <input className="stats-input" type="number" step="any" {...df1Field.bind} placeholder="e.g. 3" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stats-field-label">df2</div>
                  <input className="stats-input" type="number" step="any" {...df2Field.bind} placeholder="e.g. 20" />
                </div>
              </div>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
              <TailSelector tail={tail} onChange={setTail} />
            </>
          ) : (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Probability (p)</div>
              <input className="stats-input" type="number" step="any" {...probVal.bind} placeholder="0 to 1" />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div className="stats-field-label">df1</div>
                  <input className="stats-input" type="number" step="any" {...df1Field.bind} placeholder="e.g. 3" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="stats-field-label">df2</div>
                  <input className="stats-input" type="number" step="any" {...df2Field.bind} placeholder="e.g. 20" />
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    // Binomial
    if (fn === 'binomialPmf' || fn === 'binomialCdf') {
      const showToggle = fn === 'binomialPmf';
      return (
        <div>
          {showToggle && (
            <InputModeToggle options={['Exact', 'Cumulative']} value={binomialMode} onChange={(v) => setBinomialMode(v as 'Exact' | 'Cumulative')} />
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: showToggle ? '8px' : '0' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">n (trials)</div>
              <input className="stats-input" type="number" step="1" {...nField.bind} placeholder="e.g. 10" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">p (success prob)</div>
              <input className="stats-input" type="number" step="any" {...pField.bind} placeholder="0 to 1" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">k (successes)</div>
              <input className="stats-input" type="number" step="1" {...kField.bind} placeholder="e.g. 3" />
            </div>
          </div>
        </div>
      );
    }

    // Poisson
    if (fn === 'poissonPmf' || fn === 'poissonCdf') {
      const showToggle = fn === 'poissonPmf';
      return (
        <div>
          {showToggle && (
            <InputModeToggle options={['Exact', 'Cumulative']} value={poissonMode} onChange={(v) => setPoissonMode(v as 'Exact' | 'Cumulative')} />
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: showToggle ? '8px' : '0' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">λ (rate)</div>
              <input className="stats-input" type="number" step="any" {...lambdaField.bind} placeholder="e.g. 3.5" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">k (events)</div>
              <input className="stats-input" type="number" step="1" {...kField.bind} placeholder="e.g. 2" />
            </div>
          </div>
        </div>
      );
    }

    // z-test
    if (fn === 'zTest') {
      return (
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">x̄ (sample mean)</div>
              <input className="stats-input" type="number" step="any" {...xbarField.bind} placeholder="e.g. 50" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">μ₀ (null mean)</div>
              <input className="stats-input" type="number" step="any" {...mu0Field.bind} placeholder="e.g. 48" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">σ (pop. std dev)</div>
              <input className="stats-input" type="number" step="any" {...sigmaField.bind} placeholder="e.g. 5" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">n (sample size)</div>
              <input className="stats-input" type="number" step="any" {...nTestField.bind} placeholder="e.g. 30" />
            </div>
          </div>
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
          <TailSelector tail={tail} onChange={setTail} />
        </div>
      );
    }

    // One-sample t-test
    if (fn === 'oneSampleT') {
      return (
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">x̄ (sample mean)</div>
              <input className="stats-input" type="number" step="any" {...xbarField.bind} placeholder="e.g. 50" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">μ₀ (null mean)</div>
              <input className="stats-input" type="number" step="any" {...mu0Field.bind} placeholder="e.g. 48" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">s (sample std dev)</div>
              <input className="stats-input" type="number" step="any" {...sigmaField.bind} placeholder="e.g. 5" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">n (sample size)</div>
              <input className="stats-input" type="number" step="any" {...nTestField.bind} placeholder="e.g. 30" />
            </div>
          </div>
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
          <TailSelector tail={tail} onChange={setTail} />
        </div>
      );
    }

    // Two-sample t-test
    if (fn === 'twoSampleT') {
      return (
        <div>
          <InputModeToggle options={['Summary', 'Raw']} value={twoSampleMode} onChange={(v) => setTwoSampleMode(v as 'Summary' | 'Raw')} />
          {twoSampleMode === 'Summary' ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '6px', padding: '8px' }}>
                <div className="stats-field-label" style={{ fontWeight: 600 }}>Group 1</div>
                <div className="stats-field-label">x̄₁</div>
                <input className="stats-input" type="number" step="any" {...xbar1.bind} placeholder="mean" />
                <div className="stats-field-label" style={{ marginTop: '4px' }}>s₁</div>
                <input className="stats-input" type="number" step="any" {...s1.bind} placeholder="std dev" />
                <div className="stats-field-label" style={{ marginTop: '4px' }}>n₁</div>
                <input className="stats-input" type="number" step="any" {...n1.bind} placeholder="size" />
              </div>
              <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '6px', padding: '8px' }}>
                <div className="stats-field-label" style={{ fontWeight: 600 }}>Group 2</div>
                <div className="stats-field-label">x̄₂</div>
                <input className="stats-input" type="number" step="any" {...xbar2.bind} placeholder="mean" />
                <div className="stats-field-label" style={{ marginTop: '4px' }}>s₂</div>
                <input className="stats-input" type="number" step="any" {...s2.bind} placeholder="std dev" />
                <div className="stats-field-label" style={{ marginTop: '4px' }}>n₂</div>
                <input className="stats-input" type="number" step="any" {...n2.bind} placeholder="size" />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">Group 1 data</div>
                <textarea className="stats-input" rows={3} style={{ width: '100%', resize: 'vertical' }} {...dataset.bind} placeholder="e.g. 1, 2, 3" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">Group 2 data</div>
                <textarea className="stats-input" rows={3} style={{ width: '100%', resize: 'vertical' }} {...dataset2.bind} placeholder="e.g. 4, 5, 6" />
              </div>
            </div>
          )}
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
          <TailSelector tail={tail} onChange={setTail} />
        </div>
      );
    }

    // Paired t-test
    if (fn === 'pairedT') {
      return (
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">Sample 1</div>
              <textarea className="stats-input" rows={3} style={{ width: '100%', resize: 'vertical' }} {...dataset.bind} placeholder="e.g. 1, 2, 3" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">Sample 2</div>
              <textarea className="stats-input" rows={3} style={{ width: '100%', resize: 'vertical' }} {...dataset2.bind} placeholder="e.g. 4, 5, 6" />
            </div>
          </div>
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
          <TailSelector tail={tail} onChange={setTail} />
        </div>
      );
    }

    // ANOVA
    if (fn === 'anova') {
      return (
        <div className="anova-groups">
          {anovaGroups.map((g, i) => (
            <div key={i} className="anova-group-row">
              <div className="stats-field-label">Group {i + 1}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <textarea
                  className="stats-input"
                  rows={2}
                  style={{ flex: 1, resize: 'vertical' }}
                  value={g}
                  onChange={(e) => {
                    const updated = [...anovaGroups];
                    updated[i] = e.target.value;
                    setAnovaGroups(updated);
                  }}
                  placeholder="e.g. 1, 2, 3"
                />
                {anovaGroups.length > 2 && (
                  <button
                    type="button"
                    className="anova-remove"
                    onClick={() => setAnovaGroups(anovaGroups.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="anova-add"
            onClick={() => setAnovaGroups([...anovaGroups, ''])}
          >
            + Add Group
          </button>
        </div>
      );
    }

    // p-value calculator
    if (fn === 'pValue') {
      return (
        <div>
          <div className="stats-field-label">Test statistic</div>
          <input className="stats-input" type="number" step="any" {...testStatField.bind} placeholder="e.g. 2.5" />
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Distribution</div>
          <select
            className="stats-input"
            value={pDist}
            onChange={(e) => setPDist(e.target.value as 'normal' | 't' | 'chi2' | 'f')}
          >
            <option value="normal">Normal (Z)</option>
            <option value="t">Student's t</option>
            <option value="chi2">Chi-Square (χ²)</option>
            <option value="f">F-Distribution</option>
          </select>
          {(pDist === 't' || pDist === 'chi2') && (
            <>
              <div className="stats-field-label" style={{ marginTop: '8px' }}>Degrees of freedom (df)</div>
              <input className="stats-input" type="number" step="any" {...pDfField.bind} placeholder="e.g. 10" />
            </>
          )}
          {pDist === 'f' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">df1</div>
                <input className="stats-input" type="number" step="any" {...pDf1Field.bind} placeholder="e.g. 3" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="stats-field-label">df2</div>
                <input className="stats-input" type="number" step="any" {...pDf2Field.bind} placeholder="e.g. 20" />
              </div>
            </div>
          )}
          <div className="stats-field-label" style={{ marginTop: '8px' }}>Tail</div>
          <TailSelector tail={tail} onChange={setTail} />
        </div>
      );
    }

    // Regression (regression, correlation, rSquared, residualSE)
    if (['regression', 'correlation', 'rSquared', 'residualSE'].includes(fn)) {
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <div className="stats-field-label">x values</div>
            <textarea className="stats-input" rows={4} style={{ width: '100%', resize: 'vertical' }} {...xVals.bind} placeholder="e.g. 1, 2, 3, 4" />
          </div>
          <div style={{ flex: 1 }}>
            <div className="stats-field-label">y values</div>
            <textarea className="stats-input" rows={4} style={{ width: '100%', resize: 'vertical' }} {...yVals.bind} placeholder="e.g. 2, 4, 5, 4" />
          </div>
        </div>
      );
    }

    // Predict
    if (fn === 'predict') {
      return (
        <div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">x values</div>
              <textarea className="stats-input" rows={4} style={{ width: '100%', resize: 'vertical' }} {...xVals.bind} placeholder="e.g. 1, 2, 3, 4" />
            </div>
            <div style={{ flex: 1 }}>
              <div className="stats-field-label">y values</div>
              <textarea className="stats-input" rows={4} style={{ width: '100%', resize: 'vertical' }} {...yVals.bind} placeholder="e.g. 2, 4, 5, 4" />
            </div>
          </div>
          <div className="stats-field-label" style={{ marginTop: '8px' }}>x₀ (predict for)</div>
          <input className="stats-input" type="number" step="any" {...x0Field.bind} placeholder="e.g. 5" />
        </div>
      );
    }

    return null;
  }

  const title = TITLES[fn] ?? fn.toUpperCase();

  return (
    <div className="stats-form">
      <div className="stats-form-title">{title}</div>
      {renderInputs()}
      <button
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
