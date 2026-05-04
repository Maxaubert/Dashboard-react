import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useToast } from '@/components/ui';
import { submitReport, type ReportType } from '@/api/reports';
import { cn } from '@/lib/cn';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONO =
  "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', Consolas, ui-monospace, monospace";

/**
 * Quick-capture modal for jotting down bugs or feature ideas without
 * blocking the current task. Submissions are appended to
 * `reports/bugs.md` or `reports/features.md` by the dev plugin.
 *
 * Visual style: BRUTALIST.SYS — pure black surface, 1.5px hard white
 * borders, IBM Plex Mono throughout, ALL CAPS labels with `>>`
 * prefixes. Reads as a system tool, not an app modal. Uses Radix
 * Dialog primitives directly (rather than the dashboard's shared
 * <Modal>) so the chrome can be fully bespoke.
 */
export function ReportModal({ open, onOpenChange }: ReportModalProps) {
  const { pathname } = useLocation();
  const { toast } = useToast();

  const [type, setType] = useState<ReportType>('bug');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [page, setPage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [stamp, setStamp] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Reset whenever the modal closes — and when it opens, snapshot the
  // current route + a "stamp" timestamp into state, then focus title.
  useEffect(() => {
    if (!open) {
      setType('bug');
      setTitle('');
      setBody('');
      setTitleError(undefined);
      setSubmitting(false);
      return;
    }
    setPage(pathname);
    setStamp(formatStamp(new Date()));
    const id = window.setTimeout(() => titleInputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, pathname]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('TITLE REQUIRED');
      return;
    }
    setTitleError(undefined);
    setSubmitting(true);
    try {
      await submitReport({
        type,
        title: trimmed,
        body: body.trim(),
        page: page.trim() || undefined,
      });
      toast({
        tone: 'success',
        title: type === 'bug' ? 'Bug logged' : 'Idea logged',
        description: `Saved to reports/${type}s.md`,
      });
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        tone: 'danger',
        title: "Couldn't save",
        description: message,
        durationMs: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/85 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[480px]',
            '-translate-x-1/2 -translate-y-1/2',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'focus:outline-none'
          )}
          style={{
            background: '#000',
            color: '#fff',
            border: '1.5px solid #fff',
            fontFamily: MONO,
            boxShadow: '0 30px 80px -10px rgba(0,0,0,0.85)',
          }}
        >
          {/* Title bar */}
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: '1.5px solid #fff' }}
          >
            <Dialog.Title className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
              <span
                aria-hidden
                className="block h-2 w-2"
                style={{ background: '#ff3b2f' }}
              />
              <span>NEW REPORT — REPORT.SYS v0.1</span>
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="grid h-5 w-9 place-items-center text-[12px] hover:bg-white hover:text-black focus:bg-white focus:text-black focus:outline-none"
              style={{ border: '1.5px solid #fff' }}
            >
              ×
            </Dialog.Close>
          </div>

          <form
            id="report-form"
            onSubmit={handleSubmit}
            className="px-4 py-4 text-[12.5px] leading-[1.55]"
          >
            <SectionLabel>TYPE</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-0">
              <TypeOption
                label="BUG"
                selected={type === 'bug'}
                onClick={() => setType('bug')}
                disabled={submitting}
                position="left"
              />
              <TypeOption
                label="FEATURE"
                selected={type === 'feature'}
                onClick={() => setType('feature')}
                disabled={submitting}
                position="right"
              />
            </div>

            <div className="mt-5">
              <SectionLabel>TITLE {titleError && <ErrorTag>{titleError}</ErrorTag>}</SectionLabel>
              <input
                ref={titleInputRef}
                id="input-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'Search on /todo is case-sensitive'
                    : 'Add a dark-mode toggle to the sidebar'
                }
                maxLength={200}
                disabled={submitting}
                aria-invalid={!!titleError || undefined}
                className="mt-2 w-full bg-transparent px-3 py-2 text-[12.5px] text-white placeholder:text-[#5a5a5a] focus:outline-none"
                style={{
                  border: '1.5px solid #fff',
                  borderColor: titleError ? '#ff3b2f' : '#fff',
                  caretColor: '#fff',
                  fontFamily: MONO,
                }}
              />
            </div>

            <div className="mt-5">
              <SectionLabel>DESCRIPTION</SectionLabel>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Steps to reproduce, expected vs actual, links…"
                rows={4}
                maxLength={8000}
                disabled={submitting}
                className="mt-2 w-full resize-y bg-transparent px-3 py-2 text-[12.5px] text-white placeholder:text-[#5a5a5a] focus:outline-none"
                style={{
                  border: '1.5px solid #fff',
                  caretColor: '#fff',
                  minHeight: 90,
                  fontFamily: MONO,
                }}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <SectionLabel>PAGE</SectionLabel>
                <input
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  maxLength={200}
                  disabled={submitting}
                  className="mt-2 w-full bg-transparent px-3 py-2 text-[12.5px] text-white focus:outline-none"
                  style={{
                    border: '1.5px solid #fff',
                    caretColor: '#fff',
                    fontFamily: MONO,
                  }}
                />
              </div>
              <div>
                <SectionLabel>STAMP</SectionLabel>
                <div
                  className="mt-2 px-3 py-2 text-[12.5px] text-[#cfcfcf]"
                  style={{ border: '1.5px solid #fff' }}
                  aria-label="timestamp"
                >
                  {stamp}
                </div>
              </div>
            </div>
          </form>

          {/* Action bar */}
          <div className="flex" style={{ borderTop: '1.5px solid #fff' }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className={cn(
                'flex-1 py-2.5 text-[11px] uppercase tracking-[0.22em] text-[#888]',
                'hover:bg-white hover:text-black focus:bg-white focus:text-black focus:outline-none',
                'disabled:opacity-50'
              )}
              style={{ borderRight: '1.5px solid #fff', fontFamily: MONO }}
            >
              ESC · CANCEL
            </button>
            <button
              type="submit"
              form="report-form"
              disabled={submitting}
              className={cn(
                'flex-1 py-2.5 text-[11px] font-bold uppercase tracking-[0.22em]',
                'hover:bg-[#e0e0e0] focus:bg-[#e0e0e0] focus:outline-none',
                'disabled:opacity-50'
              )}
              style={{ background: '#fff', color: '#000', fontFamily: MONO }}
            >
              {submitting ? '… EXEC' : '↵ EXEC'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-[#888]">
      <span aria-hidden>&gt;&gt;</span>
      <span>{children}</span>
    </div>
  );
}

function ErrorTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="ml-2 px-1.5 text-[10px] tracking-[0.12em]"
      style={{
        background: '#ff3b2f',
        color: '#000',
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

interface TypeOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  position: 'left' | 'right';
}

function TypeOption({ label, selected, onClick, disabled, position }: TypeOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-left',
        'focus:outline-none',
        !selected && !disabled && 'hover:bg-white/[0.06]'
      )}
      style={{
        border: '1.5px solid #fff',
        borderLeft: position === 'right' ? 'none' : '1.5px solid #fff',
        background: selected ? '#fff' : '#000',
        color: selected ? '#000' : '#fff',
        fontFamily: MONO,
      }}
    >
      <span aria-hidden style={{ color: selected ? '#000' : '#888' }}>
        {selected ? '[*]' : '[ ]'}
      </span>
      <span className="font-bold uppercase tracking-[0.06em]">{label}</span>
    </button>
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatStamp(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
