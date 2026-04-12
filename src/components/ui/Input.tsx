import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional label rendered above the input. */
  label?: string;
  /** Helper text shown below — use `error` for error states. */
  hint?: string;
  /** Error message — when set, the input shows in danger state. */
  error?: string;
  /** Icon rendered inside the input on the left. */
  leading?: ReactNode;
  /** Icon rendered inside the input on the right. */
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, ...rest },
  ref
) {
  const inputId = id ?? `input-${Math.random().toString(36).slice(2, 9)}`;
  const hasError = !!error;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'group relative flex items-center',
          'rounded-lg border bg-white/[0.04]',
          'transition-colors duration-150',
          hasError
            ? 'border-[color-mix(in_srgb,var(--color-danger)_50%,transparent)]'
            : 'border-[var(--color-border)] focus-within:border-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]'
        )}
      >
        {leading && (
          <span className="pointer-events-none flex items-center pl-3 text-[var(--color-text-muted)]">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 flex-1 bg-transparent px-3 text-[13px]',
            'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
            'focus:outline-none',
            leading && 'pl-2',
            trailing && 'pr-2',
            className
          )}
          aria-invalid={hasError || undefined}
          {...rest}
        />
        {trailing && (
          <span className="flex items-center pr-3 text-[var(--color-text-muted)]">{trailing}</span>
        )}
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
