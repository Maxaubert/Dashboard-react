import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA button or link to render below the description. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className
      )}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.04] text-[var(--color-text-muted)]">
          {icon}
        </div>
      )}
      <h3 className="text-[14px] font-medium text-[var(--color-text)]">{title}</h3>
      {description && (
        <p className="max-w-sm text-[12.5px] text-[var(--color-text-dim)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Noe gikk galt',
  description = 'Klarte ikke å hente data. Prøv igjen om litt.',
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const detail =
    error instanceof Error ? error.message : typeof error === 'string' ? error : null;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)] text-[var(--color-danger)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l10 18H2L12 3z" />
          <path d="M12 10v5M12 17.5v.5" />
        </svg>
      </div>
      <h3 className="text-[14px] font-medium text-[var(--color-text)]">{title}</h3>
      <p className="max-w-sm text-[12.5px] text-[var(--color-text-dim)]">{description}</p>
      {detail && (
        <code className="rounded bg-white/5 px-2 py-1 text-[11px] text-[var(--color-text-muted)]">
          {detail}
        </code>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex h-8 items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-3 text-[12px] font-medium hover:bg-white/5"
        >
          Prøv igjen
        </button>
      )}
    </div>
  );
}
