import { useRef } from 'react';
import { cn } from '@/lib/cn';

interface ColorSwatchRowProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}

export function ColorSwatchRow({ colors, value, onChange }: ColorSwatchRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPreset = colors.some((c) => c.toLowerCase() === value.toLowerCase());

  return (
    <div className="modal-color-row">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={cn(
            'modal-color-swatch',
            value.toLowerCase() === c.toLowerCase() && 'selected',
          )}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Velg farge ${c}`}
        />
      ))}
      <button
        type="button"
        className={cn('modal-color-custom', !isPreset && 'selected')}
        title="Egendefinert farge"
        onClick={() => inputRef.current?.click()}
        style={!isPreset ? { borderColor: value, color: value } : undefined}
      >
        +
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
        />
      </button>
    </div>
  );
}
