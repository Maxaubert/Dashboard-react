import { Modal } from '@/components/ui';
import { SECTION_LABELS, type SectionId } from '@/lib/home';
import { cn } from '@/lib/cn';

/**
 * Settings popup: one toggle per home section. Toggling writes through the
 * home mutation immediately (no Save button) -- `onToggle` flips the id's
 * membership in `hidden`. `order` is the resolved page order so the list
 * mirrors the page top-to-bottom.
 */
export function SettingsModal({
  open,
  onOpenChange,
  order,
  hidden,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SectionId[];
  hidden: SectionId[];
  onToggle: (id: SectionId) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Innstillinger" variant="standard" size="md">
      <div className="settings-list">
        {order.map((id) => {
          const visible = !hidden.includes(id);
          return (
            <div className="settings-row" key={id}>
              <span className="settings-row-label">{SECTION_LABELS[id]}</span>
              <button
                type="button"
                role="switch"
                aria-checked={visible}
                aria-label={SECTION_LABELS[id]}
                className={cn('settings-toggle', visible && 'on')}
                onClick={() => onToggle(id)}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
