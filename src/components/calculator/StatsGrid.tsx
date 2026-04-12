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
    label: 'Descriptive', cols: 5,
    items: [
      { id: 'mean', label: 'Mean' }, { id: 'median', label: 'Median' },
      { id: 'variance', label: 'Var' }, { id: 'stddev', label: 'Std Dev' }, { id: 'range', label: 'Range' },
    ],
  },
  {
    label: 'Distributions', cols: 6,
    items: [
      { id: 'normalCdf', label: 'Norm Z' }, { id: 'tCdf', label: 't' },
      { id: 'chi2Cdf', label: 'χ²' }, { id: 'fCdf', label: 'F' },
      { id: 'binomialPmf', label: 'Binom' }, { id: 'poissonPmf', label: 'Poisson' },
    ],
  },
  {
    label: 'Hypothesis Tests', cols: 6,
    items: [
      { id: 'zTest', label: 'z-test' }, { id: 'oneSampleT', label: '1-samp t' },
      { id: 'twoSampleT', label: '2-samp t' }, { id: 'pairedT', label: 'Paired t' },
      { id: 'anova', label: 'ANOVA' }, { id: 'pValue', label: 'p-value' },
    ],
  },
  {
    label: 'Regression', cols: 5,
    items: [
      { id: 'regression', label: 'LSR Line' }, { id: 'correlation', label: 'r' },
      { id: 'rSquared', label: 'R²' }, { id: 'predict', label: 'Predict' },
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
                key={item.id} type="button"
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
