import { cn } from '@/lib/cn';

interface SpinnerProps {
  size?: number;
  className?: string;
}

/**
 * Minimal CSS-only spinner. Inherits text color so it works inside
 * buttons of any variant. Use Skeleton for full-section loading.
 */
export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('animate-spin text-[var(--color-text-dim)]', className)}
      aria-label="Laster"
      role="status"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md',
        'bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]',
        className
      )}
    />
  );
}
