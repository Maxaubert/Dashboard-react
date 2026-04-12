import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Subtle dot indicator on the left. */
  dot?: boolean;
  /** Small / default size. */
  size?: 'sm' | 'md';
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-white/[0.06] text-[var(--color-text-dim)] border-[var(--color-border)]',
  accent:
    'bg-[color-mix(in_srgb,var(--accent,var(--color-accent))_14%,transparent)] text-[var(--accent,var(--color-accent))] border-[color-mix(in_srgb,var(--accent,var(--color-accent))_30%,transparent)]',
  success:
    'bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--color-success)] border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]',
  warning:
    'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)] border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]',
  danger:
    'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger)] border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
  info: 'bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)] text-[var(--color-info)] border-[color-mix(in_srgb,var(--color-info)_30%,transparent)]',
};

const dotColors: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-text-dim)]',
  accent: 'bg-[var(--accent,var(--color-accent))]',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  size = 'md',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium tracking-tight whitespace-nowrap',
        size === 'sm' ? 'h-5 px-1.5 text-[10.5px]' : 'h-6 px-2 text-[11.5px]',
        tones[tone],
        className
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} />}
      {children}
    </span>
  );
}
