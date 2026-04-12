import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

type Mode = 'edit' | 'split' | 'preview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Initial mode. */
  defaultMode?: Mode;
  placeholder?: string;
  className?: string;
  /** Optional toolbar element (right side, e.g. Save button). */
  toolbar?: ReactNode;
}

/**
 * Side-by-side or tabbed markdown editor. Uses react-markdown for the
 * preview pane with GitHub-flavoured markdown.
 *
 * Modes:
 *   edit    — only the textarea (mobile-friendly)
 *   split   — textarea + preview side-by-side (desktop)
 *   preview — only the rendered preview
 */
export function MarkdownEditor({
  value,
  onChange,
  defaultMode = 'split',
  placeholder = 'Skriv markdown her…',
  className,
  toolbar,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>(defaultMode);

  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden',
        className
      )}
    >
      {/* Toolbar */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
          {(['edit', 'split', 'preview'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-[5px] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors',
                mode === m
                  ? 'bg-white/[0.08] text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              {m === 'edit' ? 'Rediger' : m === 'split' ? 'Delt' : 'Forh.vis'}
            </button>
          ))}
        </div>
        {toolbar}
      </header>

      {/* Body */}
      <div
        className={cn(
          'grid min-h-[320px]',
          mode === 'split' ? 'md:grid-cols-2' : 'grid-cols-1'
        )}
      >
        {(mode === 'edit' || mode === 'split') && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className={cn(
              'h-full min-h-[320px] resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed',
              'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
              'focus:outline-none',
              mode === 'split' && 'md:border-r md:border-[var(--color-border)]'
            )}
          />
        )}
        {(mode === 'preview' || mode === 'split') && (
          <div className="prose-md overflow-y-auto p-5">
            <MarkdownPreview source={value} />
          </div>
        )}
      </div>
    </div>
  );
}

export function MarkdownPreview({ source }: { source: string }) {
  return (
    <div
      className={cn(
        'text-[13.5px] leading-relaxed text-[var(--color-text)]',
        // Element styling — kept inline so MarkdownEditor & standalone use both work.
        '[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-[1.5rem] [&_h1]:font-semibold [&_h1]:tracking-tight',
        '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-[1.2rem] [&_h2]:font-semibold',
        '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[1.05rem] [&_h3]:font-semibold',
        '[&_p]:my-2',
        '[&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc',
        '[&_ol]:my-2 [&_ol]:pl-5 [&_ol]:list-decimal',
        '[&_li]:my-1',
        '[&_a]:text-[var(--color-accent)] [&_a:hover]:underline',
        '[&_code]:rounded [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12px]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre]:text-[12px]',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-accent)] [&_blockquote]:pl-3 [&_blockquote]:text-[var(--color-text-dim)]',
        '[&_hr]:my-6 [&_hr]:border-[var(--color-border)]',
        '[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[var(--color-border)] [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-2 [&_td]:py-1'
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
