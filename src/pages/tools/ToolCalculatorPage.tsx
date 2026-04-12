import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScientificCalculator } from '@/components/calculator/ScientificCalculator';
import { StatsCalculator } from '@/components/calculator/StatsCalculator';

type CalcMode = 'scientific' | 'statistics';

export function ToolCalculatorPage() {
  const [mode, setMode] = useState<CalcMode>('scientific');

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">← Verktøy</Link>
      <PageHeader title="Kalkulator" subtitle="Regn ut tall, funksjoner og uttrykk." />
      <div className="surface" style={{ padding: '24px' }}>
        <div className="calc-mode-toggle">
          <button className={`calc-mode-btn${mode === 'scientific' ? ' active' : ''}`} onClick={() => setMode('scientific')}>Scientific</button>
          <button className={`calc-mode-btn${mode === 'statistics' ? ' active' : ''}`} onClick={() => setMode('statistics')}>Statistics</button>
        </div>
        {mode === 'scientific' ? (
          <ScientificCalculator />
        ) : (
          <StatsCalculator />
        )}
      </div>
    </div>
  );
}
