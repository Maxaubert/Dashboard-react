import { pdfUrl } from '@/api/pdf';
import { cn } from '@/lib/cn';

interface PdfViewerProps {
  /** Lab number (1-11) — fetches from labs/ folder via /api/pdf?lab=N. */
  lab?: string | number;
  /** Statistics PDF name — fetches via /api/pdf?stat=NAME. */
  stat?: string;
  /** Override the iframe height (default fills parent). */
  height?: number | string;
  className?: string;
  /** Title shown in the header (defaults to "PDF"). */
  title?: string;
}

/**
 * PDF viewer — replaces the legacy oppgave.html iframe wrapper.
 *
 * Browsers render PDFs natively in iframes, so we don't need PDF.js or
 * react-pdf for the simple "show me this file" case. The Python backend
 * sets the right Content-Type and the browser handles the rest.
 */
export function PdfViewer({ lab, stat, height = '70vh', className, title = 'PDF' }: PdfViewerProps) {
  if (lab === undefined && !stat) {
    return null;
  }
  const src = pdfUrl({ lab, stat });

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)]',
        className
      )}
    >
      <header className="flex h-10 items-center justify-between border-b border-[var(--color-border)] px-3.5">
        <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-dim)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M14 3v6h6" />
          </svg>
          <span className="truncate">{title}</span>
        </div>
        <a
          href={src}
          download
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2 text-[11.5px] text-[var(--color-text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--color-text)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" />
          </svg>
          Last ned
        </a>
      </header>
      <iframe
        src={src}
        title={title}
        style={{ height }}
        className="block w-full bg-[#0b0b0d]"
      />
    </div>
  );
}
