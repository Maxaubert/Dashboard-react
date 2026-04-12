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
