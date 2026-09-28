import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { HomeHabit, HomeWidget } from '@/api/types';
import { WIDGET_KINDS, type TimerKind, type WidgetKind } from './widgetKinds';

interface Props {
  onClose: () => void;
  widgets: HomeWidget[];
  habits: HomeHabit[];
  onAddHabit: (name: string) => void;
  onRestoreHabit: (id: string) => void;
  onAddTimer: (kind: TimerKind) => void;
}

export function AddWidgetDialog({ onClose, widgets, habits, onAddHabit, onRestoreHabit, onAddTimer }: Props) {
  const [habitForm, setHabitForm] = useState(false);
  const [name, setName] = useState('');
  const storedHabits = habits.filter((habit) => !widgets.some((widget) => widget.type === 'habit' && widget.refId === habit.id));
  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title="Legg til widget" variant="standard" size="lg">
      <div className="widget-dialog">
        {habitForm ? (
          <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onAddHabit(name.trim()); }}>
            <button type="button" className="widget-button" onClick={() => setHabitForm(false)}><ArrowLeft size={18} /> Tilbake</button>
            <label className="widget-field">Navn på vane
              <input autoFocus maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} placeholder="For eksempel: Les i 20 minutter" />
            </label>
            <button className="widget-button widget-primary" disabled={!name.trim()} type="submit">Legg til vane</button>
            {storedHabits.length > 0 && <div className="widget-stored"><h3>Tidligere vaner</h3><p>Fortsett med historikken du allerede har.</p>
              {storedHabits.map((habit) => <button type="button" className="widget-choice" key={habit.id} onClick={() => onRestoreHabit(habit.id)}><span>{habit.name}</span><Plus size={18} /></button>)}
            </div>}
          </form>
        ) : (
          <div className="widget-choices">
            {(Object.keys(WIDGET_KINDS) as WidgetKind[]).map((kind) => {
              const { title, description, icon: Icon } = WIDGET_KINDS[kind];
              const added = kind !== 'habit' && widgets.some((widget) => widget.type === kind);
              return <button key={kind} className="widget-choice" disabled={added} onClick={() => kind === 'habit' ? setHabitForm(true) : onAddTimer(kind)}>
                <Icon size={24} aria-hidden="true" /><span><strong>{title}</strong><small>{added ? 'Allerede lagt til' : description}</small></span><Plus size={18} aria-hidden="true" />
              </button>;
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
