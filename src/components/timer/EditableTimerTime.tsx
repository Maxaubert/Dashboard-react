import { useEffect, useRef, useState } from 'react';
import { parseTimeString } from '@/lib/timerUtils';

function formatDraft(raw: string, clock: boolean, deleting: boolean) {
  // Leave deletion alone so the automatically inserted colon is removable.
  if (deleting) return raw;
  raw = raw.replace(/:{2,}/g, ':');
  if (!/^\d+:?\d*:?\d*$/.test(raw)) return raw;
  if (!raw.includes(':')) {
    if (raw.length < 2) return raw;
    return raw.match(/.{1,2}/g)!.join(':') + (raw.length === 2 ? ':' : '');
  }
  const parts = raw.split(':');
  const last = parts[parts.length - 1];
  if (!clock && parts.length === 2 && last.length > 2) return `${parts[0]}:${last.slice(0, 2)}:${last.slice(2)}`;
  return raw;
}

/** The original click-to-edit clock, with keyboard access and explicit validation. */
export function EditableTimerTime({ value, label, disabled, clock, onChange, onValidationChange }: {
  value: string;
  label: string;
  disabled: boolean;
  clock?: boolean;
  onChange: (value: number | string) => void;
  onValidationChange: (valid: boolean, error: string | null) => void;
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
      onValidationChange(true, null);
      setEditing(false);
    }
  }, [disabled, editing, onValidationChange]);

  function parseDraft(text: string) {
    let parsed: string | number | null;
    if (clock) {
      const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
      parsed = match && Number(match[1]) < 24 && Number(match[2]) < 60
        ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
    } else {
      parsed = parseTimeString(text);
      if (parsed === 0) parsed = null;
    }
    return parsed;
  }

  function commit(focus = false) {
    if (cancelBlur.current) return;
    const parsed = parseDraft(draft);
    if (parsed === null) {
      setInvalid(true);
      onValidationChange(false, clock ? 'Velg et klokkeslett mellom 00:00 og 23:59.' : 'Velg en varighet fra 1 sekund til 24 timer.');
      return;
    }
    onValidationChange(true, null);
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
          onChange={(event) => {
            const deleting = (event.nativeEvent as InputEvent).inputType?.startsWith('delete') ?? false;
            const next = formatDraft(event.target.value, Boolean(clock), deleting);
            setDraft(next);
            setInvalid(false);
            onValidationChange(parseDraft(next) !== null, null);
          }}
          onClick={(event) => event.currentTarget.select()}
          onBlur={() => commit()} onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(true); }
            if (event.key === 'Escape') {
              event.preventDefault(); event.stopPropagation(); cancelBlur.current = true; restoreFocus.current = true; onValidationChange(true, null); setEditing(false);
            }
          }} />
      </> : <button ref={button} type="button" className="widget-clock-button" data-long={value.length > 5} disabled={disabled}
        aria-label={`Endre tid for ${label.toLowerCase()}`} title={disabled ? 'Sett på pause for å endre tiden' : 'Klikk for å endre tiden'}
        onClick={() => { setDraft(value); setInvalid(false); onValidationChange(true, null); cancelBlur.current = false; setEditing(true); }}>
        <span role="timer" aria-label={label}>{value}</span>
      </button>}
    </div>
  );
}
