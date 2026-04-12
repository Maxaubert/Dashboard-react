import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ModalVariant = 'compact' | 'standard';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Optional small subtitle shown under the title (compact variant only). */
  description?: string;
  /** Modal width. Default `md` (440px) matches the Plan modal. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Layout variant.
   *   `compact`  — Plan-style: single padding block, no header X, footer
   *                renders inside `.modal-actions` (flex with primary first).
   *   `standard` — Links-style: three sections (header with title + X close,
   *                body, right-aligned footer).
   */
  variant?: ModalVariant;
  footer?: ReactNode;
  children: ReactNode;
}

const sizes: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[360px]',
  md: 'max-w-[440px]',
  lg: 'max-w-[480px]',
  xl: 'max-w-[820px]',
};

/**
 * Radix Dialog wrapper styled to match the legacy modals.
 *
 * Use the `compact` variant for forms (Plan, Todo) where you want the
 * blue full-width primary button. Use the `standard` variant for the
 * Links library modal and other dialogs that want a header X close +
 * right-aligned footer.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  variant = 'compact',
  footer,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="lm-overlay" />
        <Dialog.Content
          className={cn(
            'lm-content w-[calc(100vw-2rem)]',
            variant === 'standard' ? 'lm-standard flex flex-col' : 'lm-compact',
            sizes[size]
          )}
        >
          {variant === 'standard' ? (
            <>
              <div className="lm-header">
                <Dialog.Title className="lm-title-standard">{title}</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="lm-close" aria-label="Lukk">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">{description ?? title}</Dialog.Description>
              <div className="lm-body">{children}</div>
              {footer && <div className="lm-footer">{footer}</div>}
            </>
          ) : (
            <>
              <Dialog.Title className="lm-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="lm-description">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
              <div>{children}</div>
              {footer && <div className="modal-actions">{footer}</div>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
