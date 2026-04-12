import { motion } from 'framer-motion';

export interface PillOption<T extends string> {
  id: T;
  label: string;
  color: string;
}

interface PillToggleProps<T extends string> {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function PillToggle<T extends string>({ options, value, onChange }: PillToggleProps<T>) {
  const active = options.find((o) => o.id === value);

  return (
    <div className="tt-pill-container">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className="tt-pill-option"
          style={{ color: opt.id === value ? '#000' : 'rgba(255,255,255,0.4)' }}
          onClick={() => onChange(opt.id)}
        >
          {opt.id === value && (
            <motion.div
              className="tt-pill-bg"
              layoutId="pill-bg"
              style={{ backgroundColor: active?.color }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
