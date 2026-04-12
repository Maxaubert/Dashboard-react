import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Leading icon, rendered with the proper inline gap. */
  leading?: ReactNode;
  /** Trailing icon. */
  trailing?: ReactNode;
  /** Full width of its container. */
  block?: boolean;
}

const variants: Record<Variant, string> = {
  // Subtle filled button — default for most actions.
  primary: cn(
    'bg-[var(--color-surface-2)] text-[var(--color-text)]',
    'border border-[var(--color-border-strong)]',
    'hover:bg-[#1c1c1f] hover:border-white/20',
    'active:scale-[0.98]'
  ),
  // Translucent — for less prominent actions or in dense toolbars.
  secondary: cn(
    'bg-white/[0.04] text-[var(--color-text-dim)]',
    'border border-[var(--color-border)]',
    'hover:bg-white/[0.08] hover:text-[var(--color-text)]',
    'active:scale-[0.98]'
  ),
  ghost: cn(
    'bg-transparent text-[var(--color-text-dim)]',
    'border border-transparent',
    'hover:bg-white/[0.05] hover:text-[var(--color-text)]'
  ),
  danger: cn(
    'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)]',
    'text-[var(--color-danger)]',
    'border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
    'hover:bg-[color-mix(in_srgb,var(--color-danger)_20%,transparent)]',
    'active:scale-[0.98]'
  ),
  // Picks up the inherited --accent CSS var for page-coloured CTAs.
  accent: cn(
    'bg-[color-mix(in_srgb,var(--accent,var(--color-accent))_16%,transparent)]',
    'text-[var(--accent,var(--color-accent))]',
    'border border-[color-mix(in_srgb,var(--accent,var(--color-accent))_36%,transparent)]',
    'hover:bg-[color-mix(in_srgb,var(--accent,var(--color-accent))_22%,transparent)]',
    'active:scale-[0.98]'
  ),
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[14px] gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leading, trailing, block, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-medium',
        'transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {leading && <span className="-ml-0.5 inline-flex shrink-0">{leading}</span>}
      {children}
      {trailing && <span className="-mr-0.5 inline-flex shrink-0">{trailing}</span>}
    </button>
  );
});
