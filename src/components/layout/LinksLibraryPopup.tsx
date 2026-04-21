import * as Dialog from '@radix-ui/react-dialog';
import { LinksLibrary } from '@/pages/LinksPage';

/**
 * Sidebar-triggered popup containing the full Lenker library.
 *
 * Uses Radix Dialog directly (not the shared Modal wrapper) so we get
 * full control over the inner layout — the body renders <LinksLibrary />
 * exactly as on the /links page, so look/order/edit flow all match
 * 1:1 without threading props. A floating X close button sits in the
 * top-right corner of the dialog instead of a heavy header row.
 */
interface LinksLibraryPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinksLibraryPopup({ open, onOpenChange }: LinksLibraryPopupProps) {
  return (
    /* `modal={false}` is required for dnd-kit drag-and-drop inside the
     * popup to work — Radix's modal mode applies focus traps and
     * pointer-event blocking on body siblings that hijack the pointer
     * captures dnd-kit needs. Outside-click + Escape still dismiss. */
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        {/* Manual backdrop. Radix's <Dialog.Overlay /> doesn't render when
         * modal=false, so we draw our own. pointer-events:none keeps it
         * out of the way of dnd-kit + the popup's outside-click dismiss. */}
        <div className="links-popup-backdrop" aria-hidden="true" />
        <Dialog.Content
          className="lm-content links-popup-content"
          // Don't auto-close when the click is on the sidebar trigger
          // button — its own onClick handles toggling. Without this, both
          // Radix's outside-dismiss and the button's toggle fire in the
          // same event, the second wins, and the popup re-opens.
          // (The real click target is on `detail.originalEvent.target`;
          // `e.target` is the dialog content itself.)
          onInteractOutside={(e) => {
            const evt = e.detail.originalEvent as Event;
            const t = evt.target as Element | null;
            if (t?.closest?.('.sidebar-links-icon')) e.preventDefault();
          }}
        >
          <Dialog.Title className="sr-only">Lenkebibliotek</Dialog.Title>
          <Dialog.Description className="sr-only">
            Administrer dine lagrede lenker
          </Dialog.Description>

          {/* Decorative corner brackets — blueprint/workshop accent */}
          <span className="links-popup-corner tl" aria-hidden="true" />
          <span className="links-popup-corner tr" aria-hidden="true" />
          <span className="links-popup-corner bl" aria-hidden="true" />
          <span className="links-popup-corner br" aria-hidden="true" />

          <div className="links-popup-body">
            <LinksLibrary />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
