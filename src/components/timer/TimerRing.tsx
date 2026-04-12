import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface TimerRingProps {
  progress: number;         // 0-1 overall progress
  color: string;            // accent color for stroke and glow
  children: ReactNode;      // center content (time, label)
  segments?: {              // if set, renders segmented ring for pomodoro
    total: number;
    completed: number;
    currentProgress: number; // 0-1 how far through current segment
  };
  running?: boolean;        // enables stronger glow when running
}

const VIEWBOX = 300;
const CX = 150;
const CY = 150;
const R = 130;
const CIRCUMFERENCE = 2 * Math.PI * R;
const STROKE_WIDTH = 8;

export function TimerRing({ progress, color, children, segments, running }: TimerRingProps) {
  const glowFilter = `drop-shadow(0 0 ${running ? 10 : 6}px ${color}50)`;

  return (
    <div className="tt-ring-wrap">
      <svg
        className="tt-ring"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
        style={{ filter: glowFilter, transition: 'filter 0.5s' }}
      >
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={STROKE_WIDTH} />

        {segments ? (
          <SegmentedRing total={segments.total} completed={segments.completed} currentProgress={segments.currentProgress} color={color} />
        ) : (
          <motion.circle
            cx={CX} cy={CY} r={R}
            fill="none" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - progress) }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={0.9}
          />
        )}
      </svg>
      <div className="tt-ring-center">{children}</div>
    </div>
  );
}

function SegmentedRing({ total, completed, currentProgress, color }: { total: number; completed: number; currentProgress: number; color: string }) {
  const gapAngle = 4;
  const totalGap = gapAngle * total;
  const segmentAngle = (360 - totalGap) / total;
  const segmentArc = (segmentAngle / 360) * CIRCUMFERENCE;
  const gapArc = (gapAngle / 360) * CIRCUMFERENCE;

  return (
    <>
      {Array.from({ length: total }, (_, i) => {
        const startOffset = i * (segmentArc + gapArc);
        let opacity: number;
        let arcLength: number;

        if (i < completed) {
          opacity = 0.9; arcLength = segmentArc;
        } else if (i === completed) {
          opacity = 0.6; arcLength = segmentArc * currentProgress;
        } else {
          opacity = 0.08; arcLength = segmentArc;
        }

        return (
          <motion.circle
            key={i} cx={CX} cy={CY} r={R}
            fill="none"
            stroke={i > completed ? 'rgba(255,255,255,1)' : color}
            strokeWidth={STROKE_WIDTH} strokeLinecap="round"
            strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
            strokeDashoffset={-startOffset}
            transform={`rotate(-90 ${CX} ${CY})`}
            opacity={opacity}
            initial={false}
            animate={{ strokeDasharray: `${arcLength} ${CIRCUMFERENCE - arcLength}`, opacity }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}
