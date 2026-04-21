/**
 * Throwaway mockup page for picking a final look for the home-page
 * PromptLauncher. Visit /dev/prompt-mockups in dev to compare.
 *
 * No logic — just visuals. Each variant is a self-contained block.
 * Delete this file once a direction is picked.
 */
import { useState } from 'react';
import { Sparkles, ChevronDown, ArrowUp, HelpCircle } from 'lucide-react';

const ENGINES = ['Claude', 'ChatGPT', 'Perplexity', 'Google'];

export function PromptMockupsPage() {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '40px 24px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 56,
        color: 'var(--color-text)',
      }}
    >
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          Prompt bar mockups
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '6px 0 0' }}>
          Throwaway preview — tell me which one (A–E) and I'll wire it into HomePage.
        </p>
      </header>

      <Variant label="A — Current (baseline)" subtitle="Flat row, framed in a subtle card. What's shipped now.">
        <VariantA />
      </Variant>

      <Variant label="B — Hero centered" subtitle="No section header, centered, large. Friend's-dashboard energy.">
        <VariantB />
      </Variant>

      <Variant label="C — Frosted pill" subtitle="Full pill, engine chip on the left, send-arrow on the right. Modern AI-chat feel.">
        <VariantC />
      </Variant>

      <Variant label="D — Segmented engine tabs" subtitle="Engine picker as visible tabs above a wide input. Zero clicks to see options.">
        <VariantD />
      </Variant>

      <Variant label="E — Composer (multi-line)" subtitle="Send-message style. Auto-grows for longer prompts. Footer holds engine + Go.">
        <VariantE />
      </Variant>
    </div>
  );
}

/* ── Layout helper ─────────────────────────────────────────────────────── */
function Variant({
  label,
  subtitle,
  children,
}: {
  label: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: 14 }}>
        {subtitle}
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.012)',
          border: '1px dashed rgba(255,255,255,0.05)',
          borderRadius: 14,
          padding: '28px 24px',
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ── A: current baseline ───────────────────────────────────────────────── */
function VariantA() {
  return (
    <div>
      <div
        style={{
          fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        Prompt
      </div>
      <form
        onSubmit={(e) => e.preventDefault()}
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
          placeholder="Spør Claude…"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            padding: '6px 8px',
          }}
        />
        <FakeDropdown label="Claude" />
        <button type="submit" style={btnPrimary}>Go</button>
        <button type="button" style={btnGhostRound} title="Help">?</button>
      </form>
    </div>
  );
}

/* ── B: hero centered ──────────────────────────────────────────────────── */
function VariantB() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: '8px 8px 8px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.04) inset',
        }}
      >
        <Sparkles size={18} style={{ color: '#a78bfa', flex: '0 0 auto' }} />
        <input
          placeholder="Hva lurer du på i dag?"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '1.05rem',
            padding: '12px 4px',
          }}
        />
        <FakeDropdown label="Claude" />
        <button
          type="submit"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
          }}
        >
          Go
        </button>
        <button type="button" style={btnGhostRound} title="Help">
          <HelpCircle size={14} />
        </button>
      </form>
    </div>
  );
}

/* ── C: frosted pill ───────────────────────────────────────────────────── */
function VariantC() {
  const [active, setActive] = useState('Claude');
  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 9999,
          padding: '5px 6px 5px 6px',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const i = ENGINES.indexOf(active);
            setActive(ENGINES[(i + 1) % ENGINES.length]);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(124,58,237,0.18)',
            border: '1px solid rgba(124,58,237,0.35)',
            color: '#c4b5fd',
            borderRadius: 9999,
            padding: '6px 12px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Bytt motor"
        >
          {active}
          <ChevronDown size={12} />
        </button>
        <input
          placeholder={`Spør ${active}…`}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '0.92rem',
            padding: '8px 10px',
          }}
        />
        <button
          type="submit"
          aria-label="Send"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
          }}
        >
          <ArrowUp size={16} />
        </button>
      </form>
      <div
        style={{
          textAlign: 'center',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.7rem',
          marginTop: 8,
        }}
      >
        Trykk på motor-pillen for å bytte. <span style={{ color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>Hjelp</span>
      </div>
    </div>
  );
}

/* ── D: segmented engine tabs ──────────────────────────────────────────── */
function VariantD() {
  const [active, setActive] = useState('Claude');
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 10,
          padding: 4,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 10,
          width: 'fit-content',
        }}
      >
        {ENGINES.map((e) => {
          const on = active === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => setActive(e)}
              style={{
                background: on ? 'rgba(124,58,237,0.18)' : 'transparent',
                border: 'none',
                color: on ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
                padding: '6px 14px',
                borderRadius: 7,
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {e}
              {on && (
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    right: 14,
                    bottom: 2,
                    height: 1,
                    background: '#a78bfa',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10,
          padding: '4px 4px 4px 14px',
        }}
      >
        <input
          placeholder={`Spør ${active} om hva som helst…`}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '0.92rem',
            padding: '10px 4px',
          }}
        />
        <button type="submit" style={{ ...btnPrimary, padding: '8px 18px' }}>Go</button>
        <button type="button" style={btnGhostRound} title="Help">?</button>
      </form>
    </div>
  );
}

/* ── E: composer (multi-line) ──────────────────────────────────────────── */
function VariantE() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <textarea
          rows={3}
          placeholder="Skriv en lengre prompt… Shift+Enter for ny linje, Enter for å sende."
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text)',
            fontSize: '0.92rem',
            padding: '6px 8px',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            paddingTop: 4,
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <FakeDropdown label="Claude" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" style={btnGhostRound} title="Help">?</button>
            <button type="button" style={btnPrimary}>Send ↵</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bits ──────────────────────────────────────────────────────────────── */
function FakeDropdown({ label }: { label: string }) {
  return (
    <button
      type="button"
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
      }}
    >
      {label}
      <ChevronDown size={12} />
    </button>
  );
}

const btnPrimary: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '6px 18px',
  fontSize: '0.82rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const btnGhostRound: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.7)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
};
