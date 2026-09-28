import { useEffect, useRef, useState } from 'react';
import { parseTimeString } from '@/lib/timerUtils';

/** The original click-to-edit clock, with keyboard access and explicit validation. */
export function EditableTimerTime({ value, label, disabled, clock, onChange }: {
  value: string;
  label: string;
  disabled: boolean;
  clock?: boolean;
  onChange: (value: number | string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const cancelBlur = useRef(false);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (editing) input.current?.select();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      button.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (disabled && editing) {
      cancelBlur.current = true;
      restoreFocus.current = false;
      setEditing(false);
    }
  }, [disabled, editing]);

  function commit(focus = false) {
    if (cancelBlur.current) return;
    let parsed: string | number | null;
    if (clock) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(draft.trim());
      parsed = match && Number(match[1]) < 24 && Number(match[2]) < 60
        ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
    } else {
      parsed = parseTimeString(draft);
      if (parsed === 0) parsed = null;
    }
    if (parsed === null) { setInvalid(true); return; }
    cancelBlur.current = true;
    restoreFocus.current = focus;
    onChange(parsed);
    setEditing(false);
  }

  return (
    <div className="widget-clock-edit">
      {editing ? <>
        <input ref={input} className="widget-clock-input" data-long={draft.length > 5} aria-label={clock ? 'Rediger klokkeslett' : 'Rediger varighet'} aria-invalid={invalid}
          value={draft} inputMode="text" autoFocus
          onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
          onBlur={() => commit()} onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(true); }
            if (event.key === 'Escape') {
              event.preventDefault(); event.stopPropagation(); cancelBlur.current = true; restoreFocus.current = true; setEditing(false);
            }
          }} />
        {invalid && <span className="widget-clock-error" role="alert">{clock ? 'Bruk TT:MM' : 'Bruk minutter eller M:SS'}</span>}
      </> : <button ref={button} type="button" className="widget-clock-button" data-long={value.length > 5} disabled={disabled}
        aria-label={`Endre tid for ${label.toLowerCase()}`} title={disabled ? 'Sett på pause for å endre tiden' : 'Klikk for å endre tiden'}
        onClick={() => { setDraft(value); setInvalid(false); cancelBlur.current = false; setEditing(true); }}>
        <span role="timer" aria-label={label}>{value}</span>
      </button>}
    </div>
  );
}
