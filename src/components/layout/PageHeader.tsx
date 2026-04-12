import type { ReactNode } from 'react';

interface PageHeaderProps {
  /** Tiny label above the title (e.g. "Hjem"). */
  eyebrow?: string;
  /** Main title (e.g. "Dashboard"). */
  title: string;
  /** Subtitle below the title (e.g. "Velg en kategori"). */
  subtitle?: string;
  /** Optional right-side actions, rendered above the header. */
  actions?: ReactNode;
}

/**
 * Page header — matches the legacy `.page-header` block exactly:
 *   eyebrow (uppercase tracked, dim) → title (1.9rem 800) → subtitle (0.88rem dim)
 *
 * Action buttons (if any) sit on the right of the title row.
 */
export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="page-header-title">{title}</div>
          {subtitle && <div className="page-header-sub">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
