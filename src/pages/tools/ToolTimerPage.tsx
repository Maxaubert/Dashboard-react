import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { PillToggle, type PillOption } from '@/components/timer/PillToggle';
import { CountdownMode } from '@/components/timer/CountdownMode';
import { StopwatchMode } from '@/components/timer/StopwatchMode';
import { PomodoroMode } from '@/components/timer/PomodoroMode';

type Mode = 'timer' | 'stopwatch' | 'pomodoro';

const MODES: PillOption<Mode>[] = [
  { id: 'timer', label: 'Timer', color: '#ef4444' },
  { id: 'stopwatch', label: 'Stopwatch', color: '#22d3ee' },
  { id: 'pomodoro', label: 'Pomodoro', color: '#34d399' },
];

const MODE_ORDER: Mode[] = ['timer', 'stopwatch', 'pomodoro'];

const COMPONENTS: Record<Mode, React.FC> = {
  timer: CountdownMode,
  stopwatch: StopwatchMode,
  pomodoro: PomodoroMode,
};

export function ToolTimerPage() {
  const [mode, setMode] = useState<Mode>('timer');
  const [prevMode, setPrevMode] = useState<Mode>('timer');

  function changeMode(next: Mode) {
    setPrevMode(mode);
    setMode(next);
  }

  const direction = MODE_ORDER.indexOf(mode) > MODE_ORDER.indexOf(prevMode) ? 1 : -1;
  const Component = COMPONENTS[mode];

  return (
    <div className="page">
      <Link to="/tools" className="tools-back-link tools-back-link-eyebrow">
        ← Verktøy
      </Link>
      <PageHeader title="Timer & Pomodoro" subtitle="Timer, stoppeklokke og Pomodoro i ett." />

      <div className="surface tt-surface">
        <PillToggle options={MODES} value={mode} onChange={changeMode} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <Component />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
