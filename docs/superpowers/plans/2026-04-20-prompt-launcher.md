# Prompt Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a prompt/search field to the dashboard home page that opens the selected engine (Claude/ChatGPT/Perplexity/Google) in a new tab with the query pre-submitted. Ships a Tampermonkey userscript to enable auto-submit on claude.ai.

**Architecture:** New sortable HomePage section `prompt-launcher` backed by a pure `buildPromptUrl()` helper (unit-tested), with a Radix-dialog help modal that points to a userscript served statically from `public/`. No backend changes.

**Tech Stack:** React 18, TypeScript, Vite, Vitest (jsdom), Radix UI Dialog, `useLocalStorage`, existing global CSS tokens.

Related spec: `docs/superpowers/specs/2026-04-20-prompt-launcher-design.md`.

---

## Task 0: Create isolated worktree

**Files:** none

- [ ] **Step 1: Enter worktree**

Call the EnterWorktree tool with `name: "prompt-launcher"`. This creates
`.claude/worktrees/prompt-launcher` on a new branch off main and switches the
session into it.

- [ ] **Step 2: Confirm working directory**

Run: `pwd`
Expected: a path ending in `.claude/worktrees/prompt-launcher`.

Run: `git branch --show-current`
Expected: `prompt-launcher` (or whatever the tool named it — note the branch name and use that going forward).

- [ ] **Step 3: Verify spec is present**

Run: `ls docs/superpowers/specs/2026-04-20-prompt-launcher-design.md`
Expected: file exists (it was authored on main before the worktree split).

---

## Task 1: Commit spec + plan to the feature branch

**Files:**
- Add: `docs/superpowers/specs/2026-04-20-prompt-launcher-design.md`
- Add: `docs/superpowers/plans/2026-04-20-prompt-launcher.md`

- [ ] **Step 1: Stage docs**

```bash
git add docs/superpowers/specs/2026-04-20-prompt-launcher-design.md docs/superpowers/plans/2026-04-20-prompt-launcher.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs(prompt-launcher): design spec + implementation plan

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify**

Run: `git log --oneline -1`
Expected: first line is the docs commit.

---

## Task 2: `engines.ts` — pure URL-building helper (TDD)

**Files:**
- Create: `src/components/launcher/engines.vitest.ts`
- Create: `src/components/launcher/engines.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/launcher/engines.vitest.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ENGINES, buildPromptUrl, type EngineId } from './engines';

describe('ENGINES registry', () => {
  it('lists the four supported engines in dropdown order', () => {
    expect(ENGINES.map((e) => e.id)).toEqual(['claude', 'chatgpt', 'perplexity', 'google']);
  });

  it('marks Claude as the only one that needs a userscript', () => {
    const needs = ENGINES.filter((e) => e.needsUserscript).map((e) => e.id);
    expect(needs).toEqual(['claude']);
  });
});

describe('buildPromptUrl', () => {
  const cases: Array<[EngineId, string, string]> = [
    ['claude', 'hello', 'https://claude.ai/new?q=hello'],
    ['chatgpt', 'hello', 'https://chatgpt.com/?q=hello&hints=search'],
    ['perplexity', 'hello', 'https://www.perplexity.ai/search?q=hello'],
    ['google', 'hello', 'https://www.google.com/search?q=hello'],
  ];

  it.each(cases)('builds correct URL for %s', (id, q, expected) => {
    expect(buildPromptUrl(id, q)).toBe(expected);
  });

  it('URL-encodes spaces', () => {
    expect(buildPromptUrl('google', 'two words')).toBe(
      'https://www.google.com/search?q=two%20words'
    );
  });

  it('URL-encodes reserved characters and unicode', () => {
    expect(buildPromptUrl('perplexity', 'a & b ? # é')).toBe(
      'https://www.perplexity.ai/search?q=a%20%26%20b%20%3F%20%23%20%C3%A9'
    );
  });

  it('preserves ChatGPT hints=search suffix even with a complex query', () => {
    const url = buildPromptUrl('chatgpt', 'why & when');
    expect(url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(url.endsWith('&hints=search')).toBe(true);
  });

  it('returns an empty q= for the empty string (guard lives in the component)', () => {
    expect(buildPromptUrl('google', '')).toBe('https://www.google.com/search?q=');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/launcher/engines.vitest.ts`
Expected: FAIL with "Cannot find module './engines'" (or similar import error).

- [ ] **Step 3: Implement `engines.ts`**

Create `src/components/launcher/engines.ts`:

```ts
/**
 * Engines the prompt launcher can send queries to.
 *
 * All URLs auto-submit except Claude, which deprecated its `?q=` parameter
 * after a prompt-injection issue. The bundled Tampermonkey userscript
 * (public/claude-prompt.user.js) restores that behaviour on claude.ai.
 */

export type EngineId = 'claude' | 'chatgpt' | 'perplexity' | 'google';

export interface Engine {
  id: EngineId;
  label: string;
  /** True when the engine requires the userscript to actually auto-submit. */
  needsUserscript: boolean;
  buildUrl: (query: string) => string;
}

export const ENGINES: readonly Engine[] = [
  {
    id: 'claude',
    label: 'Claude',
    needsUserscript: true,
    buildUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    needsUserscript: false,
    buildUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}&hints=search`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    needsUserscript: false,
    buildUrl: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'google',
    label: 'Google',
    needsUserscript: false,
    buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
] as const;

export function buildPromptUrl(engine: EngineId, query: string): string {
  const e = ENGINES.find((x) => x.id === engine);
  if (!e) throw new Error(`Unknown engine: ${engine}`);
  return e.buildUrl(query);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/launcher/engines.vitest.ts`
Expected: all tests pass. Look for `Test Files  1 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/components/launcher/engines.ts src/components/launcher/engines.vitest.ts
git commit -m "$(cat <<'EOF'
feat(launcher): add engines registry + buildPromptUrl helper

Pure, tested URL builder for Claude/ChatGPT/Perplexity/Google.
Claude's buildUrl emits /new?q= (requires userscript to auto-submit).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Ship the Tampermonkey userscript

**Files:**
- Create: `public/claude-prompt.user.js`

- [ ] **Step 1: Create the `public/` directory if needed**

Run: `ls public/ 2>/dev/null || mkdir public`

- [ ] **Step 2: Create the userscript file**

Create `public/claude-prompt.user.js`:

```javascript
// ==UserScript==
// @name         Claude.ai — auto-submit ?q= prompt
// @namespace    https://github.com/dashboard-react/prompt-launcher
// @version      1.0.0
// @description  Reads ?q= from the URL on claude.ai and auto-submits it as a new prompt.
// @match        https://claude.ai/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const prompt = new URLSearchParams(location.search).get('q');
  if (!prompt) return;

  // Strip ?q= so a refresh doesn't re-submit.
  const url = new URL(location.href);
  url.searchParams.delete('q');
  history.replaceState(null, '', url.pathname + url.search + url.hash);

  const waitFor = (selector, timeoutMs = 20000) =>
    new Promise((resolve, reject) => {
      const start = Date.now();
      (function tick() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout: ' + selector));
        requestAnimationFrame(tick);
      })();
    });

  (async () => {
    try {
      const editor = await waitFor(
        'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]'
      );
      editor.focus();
      // ProseMirror listens for the synthetic input events that execCommand dispatches.
      document.execCommand('insertText', false, prompt);

      const sendBtn = await waitFor(
        'button[aria-label="Send message"]:not([disabled]),' +
        'button[aria-label="Send Message"]:not([disabled]),' +
        'button[aria-label="Send"]:not([disabled])'
      );
      // Small delay so React's enabled-state has a tick to settle.
      setTimeout(() => sendBtn.click(), 80);
    } catch (e) {
      console.error('[claude-prompt-from-url]', e);
    }
  })();
})();
```

- [ ] **Step 3: Verify Vite will serve it**

Run: `ls public/claude-prompt.user.js`
Expected: file exists.

Vite automatically serves `public/*` at the root in both dev and build. No
config change needed. (There is no pre-existing `public/` folder; creating one
is safe — Vite recognises it by default.)

- [ ] **Step 4: Commit**

```bash
git add public/claude-prompt.user.js
git commit -m "$(cat <<'EOF'
feat(launcher): ship Tampermonkey userscript for claude.ai auto-submit

Served statically at /claude-prompt.user.js. Tampermonkey auto-detects the
.user.js URL and offers a one-click install.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Help modal component

**Files:**
- Create: `src/components/launcher/PromptLauncherHelp.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/launcher/PromptLauncherHelp.tsx`:

```tsx
import { Modal } from '@/components/ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Instructions shown from the `?` affordance on PromptLauncher.
 *
 * ChatGPT / Perplexity / Google work with no setup. Claude needs a one-time
 * Tampermonkey + userscript install because claude.ai has no auto-submit URL.
 */
export function PromptLauncherHelp({ open, onOpenChange }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Sending prompts to Claude"
      variant="standard"
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem', lineHeight: 1.5 }}>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>
          ChatGPT, Perplexity and Google accept a query directly in the URL and
          submit automatically. Claude doesn't — so for Claude specifically
          we install a tiny one-time browser script that does the last step
          for you.
        </p>

        <Step n={1} title="Install Tampermonkey">
          <p style={{ margin: 0 }}>
            Tampermonkey is a browser extension that runs user-made scripts on
            specific sites. Pick your browser:
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <HelpLink href="https://addons.mozilla.org/firefox/addon/tampermonkey/">
              Firefox
            </HelpLink>
            <HelpLink href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo">
              Chrome / Edge
            </HelpLink>
            <HelpLink href="https://apps.apple.com/app/tampermonkey/id1482490089">
              Safari
            </HelpLink>
          </div>
        </Step>

        <Step n={2} title="Install the Claude auto-submit script">
          <p style={{ margin: 0 }}>
            Click the link below. Tampermonkey will open an install prompt — click
            <strong> Install</strong>.
          </p>
          <div style={{ marginTop: 8 }}>
            <a
              href="/claude-prompt.user.js"
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#7c3aed',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Install userscript ↗
            </a>
          </div>
        </Step>

        <Step n={3} title="Try it">
          <p style={{ margin: 0 }}>
            Pick <strong>Claude</strong> in the engine dropdown, type a prompt, hit
            <strong> Go</strong>. A claude.ai tab will open, the prompt will be
            typed in for you and sent automatically.
          </p>
        </Step>

        <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
          If nothing happens on claude.ai, open the browser console and look for
          <code> [claude-prompt-from-url] </code> messages — probably the site's
          DOM changed and the script's selectors need updating.
        </p>
      </div>
    </Modal>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.72rem',
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.7)' }}>{children}</div>
      </div>
    </div>
  );
}

function HelpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        padding: '6px 10px',
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.78rem',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/components/launcher/PromptLauncherHelp.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): add help modal with Tampermonkey + userscript steps

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `PromptLauncher` main component

**Files:**
- Create: `src/components/launcher/PromptLauncher.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/launcher/PromptLauncher.tsx`:

```tsx
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

      {activeEngine.needsUserscript && (
        <div
          style={{
            marginTop: 6,
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.35)',
          }}
        >
          Claude trenger en engangs-brukerskript. Trykk <strong>?</strong> for oppsett.
        </div>
      )}

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
              {e.needsUserscript && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: '0.62rem',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  (trenger skript)
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/launcher/PromptLauncher.tsx
git commit -m "$(cat <<'EOF'
feat(launcher): add PromptLauncher section component

Input + engine dropdown + Go + help button. Persists selected engine in
localStorage. Submits by opening the engine URL in a new tab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire into HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Add the section id and default placement**

In `src/pages/HomePage.tsx`, locate `SECTION_IDS`:

```tsx
const SECTION_IDS = [
  'kategorier',
  'widgets',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;
```

Replace with:

```tsx
const SECTION_IDS = [
  'prompt-launcher',
  'kategorier',
  'widgets',
  'ext-lenker',
  'dagens-plan',
  'vaer',
  'nyhetssaker',
] as const;
```

- [ ] **Step 2: Import the component**

Near the other component imports at the top of `HomePage.tsx` (around the
`WidgetsSection` import), add:

```tsx
import { PromptLauncher } from '@/components/launcher/PromptLauncher';
```

- [ ] **Step 3: Render the section**

Locate `SortableHomeSection` and find the block that renders each section
id (starts with `{id === 'kategorier' && <KategorierSection ... />}`). Add a
new branch at the top of that block:

```tsx
{id === 'prompt-launcher' && <PromptLauncher handleProps={handleProps} />}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "$(cat <<'EOF'
feat(home): wire PromptLauncher as a sortable home section

New section lands at the top of DEFAULT_SECTIONS for new users; existing
users receive it appended via the existing missing-section merge rule and
can drag it where they like.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full verification pass

**Files:** none modified

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 2: Unit tests**

Run: `npm run test`
Expected: all tests pass, including the new engines tests. Look for
`Test Files  N passed (N)` with the count including `engines.vitest.ts`.

- [ ] **Step 3: Dev-server smoke test**

Run the dev server in the background (do not block the terminal):

```bash
npm run dev
```

Then verify each URL is reachable from a browser OR via `curl`:

```bash
curl -sI http://localhost:5173/ | head -1
curl -sI http://localhost:5173/claude-prompt.user.js | head -1
curl -s http://localhost:5173/claude-prompt.user.js | head -10
```

Expected:
- `HTTP/1.1 200 OK` for `/`.
- `HTTP/1.1 200 OK` for `/claude-prompt.user.js`.
- The userscript `head -10` output starts with `// ==UserScript==`.

If the dev server is the only remaining task, stop it when done:

```bash
# Find the background job id (printed when you started it)
# or:  ps | grep vite  ;  kill <pid>
```

- [ ] **Step 4: Review the diff**

Run: `git log --oneline main..HEAD`
Expected: five or six commits — docs, engines, userscript, help modal,
launcher component, home wiring.

Run: `git diff --stat main..HEAD`
Expected: only the files listed in this plan were touched. No stray edits.

---

## Task 8: Final summary for the user

**Files:**
- Create: `docs/superpowers/plans/2026-04-20-prompt-launcher-RESULT.md`

- [ ] **Step 1: Write a short status note**

Create `docs/superpowers/plans/2026-04-20-prompt-launcher-RESULT.md`
summarising: worktree name, branch name, commits list, how to switch to the
worktree to test, how to install the userscript, known limitations.

- [ ] **Step 2: Commit it**

```bash
git add docs/superpowers/plans/2026-04-20-prompt-launcher-RESULT.md
git commit -m "$(cat <<'EOF'
docs(prompt-launcher): result summary for end-of-session handoff

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Do NOT merge or push**

Leave the worktree/branch intact on disk. The user asked for something they
can "simply test" — merging is their call.

---

## Self-review

Spec coverage walkthrough:

- Goal (URL-based prompt launcher on dashboard) → Tasks 5, 6.
- Engine table (Claude/ChatGPT/Perplexity/Google) → Task 2.
- Auto-submit caveat on Claude + userscript → Task 3.
- Help modal with Tampermonkey links and install button → Task 4.
- Sortable section in HomePage → Task 6.
- Persist engine choice in localStorage → Task 5 (uses `useLocalStorage`).
- Enter + Go submit; empty blocked → Task 5 (form `onSubmit` + `.trim()` guard).
- Opens in new tab via `window.open('_blank','noopener,noreferrer')` → Task 5.
- Tests on pure function only (component manually verified) → Tasks 2 + 7.
- Userscript hardening (path stripping, selector retries, 80ms settle delay) → Task 3.

No placeholders remain. Types referenced later (`EngineId`, `Engine`,
`ENGINES`, `buildPromptUrl`) are all defined in Task 2 before being consumed.
Help-modal imports `Modal` via `@/components/ui` which exists today.
