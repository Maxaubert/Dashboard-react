import { useState } from 'react';
import { Modal } from '@/components/ui';
import { ColorSwatchRow } from '@/components/patterns';
import type { PlanItem } from '@/api/types';
import { cn } from '@/lib/cn';
import { COLORS, DAY_NAMES_SHORT } from '@/lib/plan';

export interface PlanModalProps {
  item: PlanItem;
  isEdit: boolean;
  onClose: () => void;
  onSave: (item: PlanItem) => void;
  onDelete?: () => void;
}

export function PlanModal({ item, isEdit, onClose, onSave, onDelete }: PlanModalProps) {
  const [form, setForm] = useState<PlanItem>(item);

  function update<K extends keyof PlanItem>(key: K, value: PlanItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(dow: number) {
    const days = new Set(form.days ?? []);
    if (days.has(dow)) days.delete(dow);
    else days.add(dow);
    update('days', Array.from(days));
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    if (form.recurring && (!form.days || form.days.length === 0)) return;
    onSave(form);
  }

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Rediger hendelse' : 'Ny hendelse'}
      footer={
        <>
          <button className="modal-btn-primary" onClick={handleSubmit}>
            {isEdit ? 'Lagre' : 'Legg til'}
          </button>
          <button className="modal-btn-cancel" onClick={onClose}>
            Avbryt
          </button>
          {onDelete && (
            <button className="modal-btn-delete" onClick={onDelete}>
              Slett
            </button>
          )}
        </>
      }
    >
      <div className="modal-field">
        <label htmlFor="m-title">Tittel *</label>
        <input
          id="m-title"
          type="text"
          placeholder="f.eks. Forelesning INF101"
          autoFocus
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </div>

      <div className="modal-row">
        <div className="modal-field">
          <label htmlFor="m-start">Start</label>
          <input
            id="m-start"
            type="time"
            step={900}
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
          />
        </div>
        <div className="modal-field">
          <label htmlFor="m-end">Slutt</label>
          <input
            id="m-end"
            type="time"
            step={900}
            value={form.endTime}
            onChange={(e) => update('endTime', e.target.value)}
          />
        </div>
      </div>

      <div className="modal-field">
        <label htmlFor="m-loc">Sted / rom</label>
        <input
          id="m-loc"
          type="text"
          placeholder="f.eks. Aud. Max, Rom 204"
          value={form.location ?? ''}
          onChange={(e) => update('location', e.target.value)}
        />
      </div>

      <div className="modal-field">
        <label className="modal-check-label">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => update('recurring', e.target.checked)}
          />
          <span>Gjentas ukentlig</span>
        </label>
      </div>

      {form.recurring ? (
        <div className="modal-field">
          <label>Ukedager</label>
          <div className="modal-days-row">
            {DAY_NAMES_SHORT.map((lbl, d) => (
              <button
                key={d}
                type="button"
                className={cn('modal-day-btn', form.days?.includes(d) && 'active')}
                onClick={() => toggleDay(d)}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="modal-field">
          <label htmlFor="m-date">Dato</label>
          <input
            id="m-date"
            type="date"
            value={form.date ?? ''}
            onChange={(e) => update('date', e.target.value)}
          />
        </div>
      )}

      <div className="modal-field">
        <label>Farge</label>
        <ColorSwatchRow
          colors={COLORS}
          value={form.color ?? COLORS[0]}
          onChange={(c) => update('color', c)}
        />
      </div>
    </Modal>
  );
}
