import { PageHeader } from '@/components/layout/PageHeader';

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
}

/**
 * Stub used by every not-yet-migrated page. Renders the PageHeader so we
 * can verify the shell + accent color picks up correctly even before
 * the real page is built.
 */
export function PlaceholderPage({ eyebrow, title, subtitle, accent }: PlaceholderPageProps) {
  return (
    <div className="page" style={{ ['--accent' as string]: accent }}>
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <div className="surface accent-glow grid place-items-center rounded-2xl px-6 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[var(--color-text)]">
            Under migrering
          </p>
          <p className="max-w-sm text-[12.5px] text-[var(--color-text-dim)]">
            Denne siden er under arbeid. Det opprinnelige innholdet finnes
            fortsatt i de gamle HTML-filene.
          </p>
        </div>
      </div>
    </div>
  );
}
