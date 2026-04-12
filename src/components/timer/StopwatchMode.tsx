import { motion, AnimatePresence } from 'framer-motion';
import { useStopwatch, formatStopwatch } from '@/hooks/useTimer';
import { TimerRing } from './TimerRing';
import { StopwatchControls } from './TimerControls';

const COLOR = '#22d3ee';

export function StopwatchMode() {
  const sw = useStopwatch();

  return (
    <div className="tt-mode-body">
      <TimerRing progress={1} color={COLOR} running={sw.running}>
        <div className="tt-ring-label" style={{ color: COLOR }}>STOPWATCH</div>
        <div className="tt-ring-text">{formatStopwatch(sw.elapsedMs)}</div>
      </TimerRing>
      <StopwatchControls
        running={sw.running}
        elapsedMs={sw.elapsedMs}
        lapsCount={sw.laps.length}
        color={COLOR}
        onToggle={() => sw.setRunning((r) => !r)}
        onLap={sw.addLap}
        onReset={sw.reset}
      />
      {sw.laps.length > 0 && (
        <div className="tt-lap-list">
          <AnimatePresence initial={false}>
            {sw.laps.map((lap, i) => {
              const lapIndex = sw.laps.length - i;
              const prev = sw.laps[i + 1] ?? 0;
              const diff = lap - prev;
              return (
                <motion.div
                  key={lapIndex}
                  className="tt-lap-row"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  style={i === 0 ? { borderColor: `${COLOR}30` } : undefined}
                >
                  <span className="tt-lap-num">#{String(lapIndex).padStart(2, '0')}</span>
                  <span className="tt-lap-diff">+{formatStopwatch(diff)}</span>
                  <span className="tt-lap-time">{formatStopwatch(lap)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
