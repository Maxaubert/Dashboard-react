import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, rows = 4, ...rest },
  ref
) {
  const textareaId = id ?? `ta-${Math.random().toString(36).slice(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        className={cn(
          'rounded-lg border bg-white/[0.04] px-3 py-2.5',
          'text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
          'transition-colors duration-150 focus:outline-none',
          'resize-y min-h-[80px]',
          hasError
            ? 'border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)]'
            : 'border-[var(--color-border)] focus:border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]',
          className
        )}
        aria-invalid={hasError || undefined}
        {...rest}
      />
      {(hint || error) && (
        <p
          className={cn(
            'text-[11.5px]',
            hasError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
