import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — describes what the button does. */
  'aria-label': string;
  icon: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'accent';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, size = 'md', variant = 'ghost', className, ...rest }, ref) {
    const sizes = {
      sm: 'h-7 w-7 rounded-md',
      md: 'h-8 w-8 rounded-md',
      lg: 'h-10 w-10 rounded-lg',
    } as const;

    const variants = {
      ghost: cn(
        'bg-transparent text-[var(--color-text-dim)]',
        'hover:bg-white/[0.06] hover:text-[var(--color-text)]'
      ),
      subtle: cn(
        'bg-[var(--color-surface-2)] text-[var(--color-text-dim)]',
        'border border-[var(--color-border)]',
        'hover:bg-[#1c1c1f] hover:text-[var(--color-text)]'
      ),
      accent: cn(
        'text-[var(--accent,var(--color-accent))]',
        'bg-[color-mix(in_srgb,var(--accent,var(--color-accent))_14%,transparent)]',
        'border border-[color-mix(in_srgb,var(--accent,var(--color-accent))_30%,transparent)]',
        'hover:bg-[color-mix(in_srgb,var(--accent,var(--color-accent))_22%,transparent)]'
      ),
    } as const;

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center transition-colors',
          'active:scale-95',
          'disabled:pointer-events-none disabled:opacity-50',
          sizes[size],
          variants[variant],
          className
        )}
        {...rest}
      >
        {icon}
      </button>
    );
  }
);
