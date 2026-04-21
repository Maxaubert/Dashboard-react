import { useEffect, useRef, useState } from 'react';
import { ArrowUp, HelpCircle, Sparkles } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { buildPromptUrl, ENGINES, type EngineId } from './engines';
import { PromptLauncherHelp } from './PromptLauncherHelp';

type HandleProps = Record<string, unknown>;

function GripHandle({ handleProps }: { handleProps?: HandleProps }) {
  return (
    <span className="db-grip-handle" {...handleProps}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2" cy="2" r="1.5" />
        <circle cx="8" cy="2" r="1.5" />
        <circle cx="2" cy="7" r="1.5" />
        <circle cx="8" cy="7" r="1.5" />
        <circle cx="2" cy="12" r="1.5" />
        <circle cx="8" cy="12" r="1.5" />
      </svg>
    </span>
  );
}

/**
 * Home-page section that opens a prompt in Claude / ChatGPT / Perplexity /
 * Google in a new tab. Multi-line composer: Enter sends, Shift+Enter inserts
 * a newline. Frosted-glass card with a subtle violet ring pulse. The `?`
 * button explains the Tampermonkey userscript setup needed for Claude/ChatGPT.
 */
export function PromptLauncher({ handleProps }: { handleProps?: HandleProps }) {
  const [engine, setEngine] = useLocalStorage<EngineId>('prompt-launcher-engine', 'claude');
  const [query, setQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Guard against a stale localStorage value pointing at an engine we no
  // longer ship. Reset to the default so the UI doesn't get stuck.
  const isKnown = ENGINES.some((e) => e.id === engine);
  useEffect(() => {
    if (!isKnown) setEngine('claude');
  }, [isKnown, setEngine]);

  // Auto-grow the textarea up to a reasonable max so longer prompts have
  // room without the bar dominating the page.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [query]);

  function submit() {
    const q = query.trim();
    if (!q) return;
    const url = buildPromptUrl(engine, q);
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const activeEngine = ENGINES.find((x) => x.id === engine) ?? ENGINES[0];
  const canSubmit = query.trim().length > 0;

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Prompt
        </span>
      </div>

      <form onSubmit={handleSubmit} className="prompt-launcher-card">
        <div className="prompt-launcher-row">
          <Sparkles size={18} className="prompt-launcher-icon" aria-hidden="true" />
          <textarea
            ref={taRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Spør ${activeEngine.label}…`}
            aria-label="Prompt query"
            rows={2}
            className="prompt-launcher-textarea"
          />
        </div>

        <div className="prompt-launcher-footer">
          <EngineDropdown value={engine} onChange={setEngine} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Hvordan virker dette?"
              title="Hvordan virker dette?"
              className="prompt-launcher-help"
            >
              <HelpCircle size={14} />
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Send"
              title="Send"
              className="prompt-launcher-send"
            >
              <ArrowUp size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </form>

      <PromptLauncherHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </section>
  );
}

/* ── Engine dropdown — violet pill, opens above so it doesn't clip ─────── */

function EngineDropdown({
  value,
  onChange,
}: {
  value: EngineId;
  onChange: (v: EngineId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = ENGINES.find((e) => e.id === value);

  return (
    <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="prompt-launcher-engine-pill"
      >
        {current?.label ?? value}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div role="listbox" className="prompt-launcher-engine-menu">
          {ENGINES.map((e) => (
            <button
              key={e.id}
              type="button"
              role="option"
              aria-selected={e.id === value}
              onClick={() => {
                onChange(e.id);
                setOpen(false);
              }}
              className={
                'prompt-launcher-engine-option' +
                (e.id === value ? ' is-active' : '')
              }
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
