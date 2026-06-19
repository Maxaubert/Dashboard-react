import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui';
import type { Priority, Todo } from '@/api/types';
import { cn } from '@/lib/cn';
import { displayToIso, isoToDisplay } from '@/lib/todo';

export interface TodoModalProps {
  item: Todo | null;
  defaultPriority: Priority;
  onClose: () => void;
  onSave: (item: Todo) => void;
  onDelete?: () => void;
}

export function TodoModal({ item, defaultPriority, onClose, onSave, onDelete }: TodoModalProps) {
  const [form, setForm] = useState<Todo>(
    item ?? {
      id: String(Date.now()),
      text: '',
      priority: defaultPriority,
      deadline: null,
      done: false,
    },
  );

  function update<K extends keyof Todo>(key: K, value: Todo[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.text.trim()) return;
    onSave(form);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={item ? 'Rediger oppgave' : 'Ny oppgave'}
      size="lg"
    >
      <div className="todo-modal-fields">
        <div className="todo-field">
          <label htmlFor="t-title">Tittel</label>
          <input
            id="t-title"
            type="text"
            placeholder="Hva skal gjøres?"
            autoComplete="off"
            autoFocus
            value={form.text}
            onChange={(e) => update('text', e.target.value)}
          />
        </div>

        <div className="todo-field">
          <label>Prioritet</label>
          <div className="priority-row">
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'low' && 'selected')}
              data-p="low"
              onClick={() => update('priority', 'low')}
            >
              Lav
            </button>
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'medium' && 'selected')}
              data-p="medium"
              onClick={() => update('priority', 'medium')}
            >
              Medium
            </button>
            <button
              type="button"
              className={cn('pri-btn', form.priority === 'high' && 'selected')}
              data-p="high"
              onClick={() => update('priority', 'high')}
            >
              Høy
            </button>
          </div>
        </div>

        <div className="todo-field">
          <label htmlFor="t-deadline">Frist</label>
          <div className="todo-deadline-row">
            <DeadlineInput
              id="t-deadline"
              value={form.deadline ?? null}
              onChange={(next) => update('deadline', next)}
            />
            {form.deadline && (
              <button
                type="button"
                className="todo-deadline-clear"
                onClick={() => update('deadline', null)}
                aria-label="Fjern frist"
                title="Fjern frist"
              >
                ✕ Fjern
              </button>
            )}
          </div>
        </div>

        <div className="todo-modal-actions">
          {onDelete && (
            <button className="btn-delete-todo" onClick={onDelete}>
              Slett
            </button>
          )}
          <button className="btn-cancel-todo" onClick={onClose}>
            Avbryt
          </button>
          <button className="btn-save-todo" onClick={handleSubmit}>
            Lagre
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Text-style date input showing dd/mm/yy, storing ISO (yyyy-mm-dd).
 *
 * The native `<input type="date">` follows browser locale and can't be
 * forced into dd/mm/yy cross-browser, so this wraps a text input with
 * auto-slash masking and parses on blur. Two-digit years are assumed
 * to live in the 2000s (e.g. "26" → "2026").
 */
function DeadlineInput({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [text, setText] = useState(() => (value ? isoToDisplay(value) : ''));

  useEffect(() => {
    setText(value ? isoToDisplay(value) : '');
  }, [value]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
    let masked = raw;
    if (raw.length >= 3 && raw.length <= 4) masked = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    else if (raw.length >= 5) masked = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4, 6)}`;
    setText(masked);
  }

  function commit() {
    if (!text.trim()) {
      onChange(null);
      return;
    }
    const iso = displayToIso(text);
    if (iso) {
      onChange(iso);
      setText(isoToDisplay(iso));
    } else {
      setText(value ? isoToDisplay(value) : '');
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/åå"
      maxLength={8}
      autoComplete="off"
      value={text}
      onChange={handleInput}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
