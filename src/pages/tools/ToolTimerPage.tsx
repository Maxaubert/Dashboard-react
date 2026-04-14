import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { PillToggle, type PillOption } from '@/components/timer/PillToggle';
import { AlarmMode } from '@/components/timer/AlarmMode';
import { CountdownMode } from '@/components/timer/CountdownMode';
import { StopwatchMode } from '@/components/timer/StopwatchMode';
import { PomodoroMode } from '@/components/timer/PomodoroMode';

type Mode = 'alarm' | 'timer' | 'stopwatch' | 'pomodoro';

const MODES: PillOption<Mode>[] = [
  { id: 'alarm', label: 'Alarm', color: '#f97316' },
  { id: 'timer', label: 'Timer', color: '#ef4444' },
  { id: 'stopwatch', label: 'Stopwatch', color: '#22d3ee' },
  { id: 'pomodoro', label: 'Pomodoro', color: '#34d399' },
];

const COMPONENTS: Record<Mode, React.FC> = {
  alarm: AlarmMode,
  timer: CountdownMode,
  stopwatch: StopwatchMode,
  pomodoro: PomodoroMode,
};

export function ToolTimerPage() {
  const [mode, setMode] = useState<Mode>('alarm');
  const Component = COMPONENTS[mode];

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader title="Timer & Pomodoro" subtitle="Alarm, timer, stoppeklokke og Pomodoro i ett." />

      <div className="surface tt-surface">
        <PillToggle options={MODES} value={mode} onChange={setMode} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Component />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
