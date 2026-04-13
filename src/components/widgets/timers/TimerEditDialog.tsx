import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

const PRESET_COLORS = ['#34d399', '#a855f7', '#38bdf8', '#f97316', '#eab308', '#ef4444', '#ec4899'];

interface TimerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialColor: string;
  title: string;
  onSave: (color: string) => void;
}

/**
 * Small dialog for editing a timer widget. Timers have no name, so the only
 * editable property is the accent color.
 */
export function TimerEditDialog({ open, onOpenChange, initialColor, title, onSave }: TimerEditDialogProps) {
  const [color, setColor] = useState(initialColor);

  // Sync draft color whenever the dialog re-opens with a different initial.
  useEffect(() => {
    if (open) setColor(initialColor);
  }, [open, initialColor]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(color);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100 }}
        />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: '#0a0a0a', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 16, padding: 24, width: 360, zIndex: 101,
          }}
        >
          <Dialog.Title style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, marginBottom: 16 }}>
            {title}
          </Dialog.Title>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8 }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Color ${c}`}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c,
                      border: color === c ? '2px solid rgba(255, 255, 255, 0.8)' : '2px solid transparent',
                      cursor: 'pointer', padding: 0,
                      transition: 'transform 0.15s',
                      transform: color === c ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Dialog.Close asChild>
                <button type="button" style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: '8px 16px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.82rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" style={{ background: color, border: 'none', borderRadius: 8, padding: '8px 16px', color: '#000', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
