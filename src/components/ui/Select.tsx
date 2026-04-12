import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

/**
 * Native select styled to match the rest of the form controls.
 * For more elaborate dropdowns (multi-select, search, custom items)
 * use Radix Dropdown or Select instead — those should be added as
 * a separate component when first needed.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, id, children, ...rest },
  ref
) {
  const selectId = id ?? `sel-${Math.random().toString(36).slice(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border bg-white/[0.04] px-3 pr-9 text-[13px]',
            'text-[var(--color-text)]',
            'transition-colors duration-150 focus:outline-none',
            hasError
              ? 'border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)]'
              : 'border-[var(--color-border)] focus:border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]',
            className
          )}
          aria-invalid={hasError || undefined}
          {...rest}
        >
          {children}
        </select>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
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
