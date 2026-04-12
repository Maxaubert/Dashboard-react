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
