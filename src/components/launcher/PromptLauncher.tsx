import { useEffect, useRef, useState } from 'react';
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
 * Google in a new tab. Enter or Go both submit. The `?` button explains the
 * Claude-specific Tampermonkey userscript setup.
 */
export function PromptLauncher({ handleProps }: { handleProps?: HandleProps }) {
  const [engine, setEngine] = useLocalStorage<EngineId>('prompt-launcher-engine', 'claude');
  const [query, setQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Guard against a stale localStorage value pointing at an engine we no
  // longer ship. Reset to the default so the UI doesn't get stuck.
  const isKnown = ENGINES.some((e) => e.id === engine);
  useEffect(() => {
    if (!isKnown) setEngine('claude');
  }, [isKnown, setEngine]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const url = buildPromptUrl(engine, q);
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  }

  const activeEngine = ENGINES.find((x) => x.id === engine) ?? ENGINES[0];

  return (
    <section>
      <div className="section-header">
        <span>
          <GripHandle handleProps={handleProps} />
          Prompt
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: 8,
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Spør ${activeEngine.label}…`}
          aria-label="Prompt query"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            padding: '6px 8px',
          }}
        />

        <EngineDropdown value={engine} onChange={setEngine} />

        <button
          type="submit"
          disabled={!query.trim()}
          className="modal-btn-primary"
          style={{
            flex: '0 0 auto',
            padding: '6px 18px',
            fontSize: '0.82rem',
            opacity: query.trim() ? 1 : 0.4,
            cursor: query.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Go
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="Hvordan virker dette?"
          title="Hvordan virker dette?"
          style={{
            flex: '0 0 auto',
            width: 32,
            height: 32,
            alignSelf: 'center',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 700,
          }}
        >
          ?
        </button>
      </form>

      <PromptLauncherHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </section>
  );
}

/* ── Engine dropdown (mirrors NewsSourceDropdown pattern in HomePage) ───── */

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
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '6px 10px',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.78rem',
          fontWeight: 600,
          cursor: 'pointer',
          height: '100%',
        }}
      >
        {current?.label ?? value}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
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
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: e.id === value ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.85)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
