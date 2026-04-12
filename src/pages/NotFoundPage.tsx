import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';

export function NotFoundPage() {
  return (
    <div className="page">
      <PageHeader
        eyebrow="404"
        title="Siden finnes ikke"
        subtitle="Lenken er ugyldig eller siden er flyttet."
      />
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-4 py-2 text-[13px] font-medium text-[var(--color-text)] hover:bg-white/5"
      >
        ← Tilbake til hjem
      </Link>
    </div>
  );
}
