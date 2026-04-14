// src/components/timer/AlarmMode.tsx
import { useState, useEffect } from 'react';
import { useTimers } from '@/context/TimerContext';

/**
 * Live-format an HH:MM input as the user types: strip non-digits, cap at 4
 * digits, and insert the colon as soon as 2 digits exist so the user doesn't
 * have to type it. Typing "1" → "1"; "15" → "15:"; "153" → "15:3";
 * "1530" → "15:30". `parseTimeString` strips trailing colons before parsing,
 * so a committed "15:" parses as 15 minutes.
 *
 * Backspace edge: if the user deletes a character and only the auto-inserted
 * colon goes away (digit count unchanged), they actually meant to delete a
 * digit. Detect that and drop a digit from the right instead of re-inserting
 * the colon — otherwise the colon is unbackspaceable.
 */
function formatHHMMDraft(raw: string, prev: string): string {
  let digits = raw.replace(/\D/g, '').slice(0, 4);
  const prevDigits = prev.replace(/\D/g, '');
  if (
    raw.length < prev.length &&
    digits.length === prevDigits.length &&
    prev.includes(':') &&
    !raw.includes(':')
  ) {
    digits = digits.slice(0, -1);
  }
  if (digits.length < 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `in ${h}h ${m}m`;
  if (h > 0) return `in ${h}h`;
  return `in ${m}m`;
}

export function AlarmMode() {
  const ctx = useTimers();
  const t = ctx.getTimer('alarm');

  // 1Hz refresh so "in Xh Ym" updates while armed.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!t.running && !t.ringing) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [t.running, t.ringing]);

  const remainingMs = t.fireAt !== null ? t.fireAt - Date.now() : 0;
  const buttonLabel = t.ringing ? 'STOP' : t.running ? 'CANCEL' : 'SET ALARM';
  const buttonBg = t.ringing ? '#ef4444' : t.color;

  function handleButton() {
    if (t.ringing) ctx.stopAlarm();
    else if (t.running) ctx.cancelAlarm();
    else ctx.armAlarm();
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 24px',
        minHeight: 320,
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        {t.ringing ? 'RINGING' : 'RINGS AT'}
      </div>
      <EditableHHMM
        value={t.targetTime}
        color={t.color}
        disabled={t.running || t.ringing}
        onChange={(time) => ctx.setAlarmTime(time)}
      />
      {t.running && !t.ringing && (
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>
          {formatRemaining(remainingMs)}
        </div>
      )}
      {!t.running && !t.ringing && (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>click time to edit</div>
      )}
      <button
        type="button"
        onClick={handleButton}
        style={{
          background: buttonBg,
          color: '#000',
          border: 'none',
          borderRadius: 999,
          padding: '12px 36px',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

interface EditableHHMMProps {
  value: string;
  color: string;
  disabled: boolean;
  onChange: (next: string) => void;
}

/** Click-to-edit HH:MM input. Commits on Enter or blur, cancels on Esc. */
function EditableHHMM({ value, color, disabled, onChange }: EditableHHMMProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    const trimmed = draft.trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
        onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
    setEditing(false);
  }

  // Shared box so the button and input occupy the same footprint —
  // only the border and background flip when entering edit mode. Width is
  // in `ch` (= width of "0" in the current font) so the box hugs the 5-char
  // "HH:MM" content. `em` would be relative to font-size and produces a
  // wildly oversized box at 5rem font.
  const sharedBoxStyle: React.CSSProperties = {
    width: '5.5ch',
    padding: '4px 12px',
    boxSizing: 'content-box',
    borderRadius: 8,
    color,
    fontSize: '5rem',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '-0.05em',
    textAlign: 'center',
    lineHeight: 1,
    outline: 'none',
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft((prev) => formatHHMMDraft(e.target.value, prev))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        inputMode="numeric"
        style={{
          ...sharedBoxStyle,
          background: '#050505',
          border: `1px solid ${color}66`,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        setDraft(value);
        setEditing(true);
      }}
      style={{
        ...sharedBoxStyle,
        background: 'transparent',
        border: '1px solid transparent',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {value}
    </button>
  );
}
