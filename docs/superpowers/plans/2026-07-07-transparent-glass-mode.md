# Transparent (Nebula) Glass Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggleable transparent "glass" mode so the dashboard's surfaces frost and Zen's Nebula/Mica backdrop shows through, off by default and leaving the normal look untouched.

**Architecture:** A single `body.glass-mode` class (mirroring the existing `bento-active` pattern) gates all glass styling in one new scoped stylesheet `src/styles/glass.css`. A `GlassModeProvider` context owns the boolean (persisted via `useLocalStorage`), applies the body class, and exposes `useGlassMode()`. A toggle row in the existing `SettingsModal` flips it.

**Tech Stack:** React 18, TypeScript ~5.6 (strict), Vite 5, Tailwind 4 CSS, vitest + jsdom, `useLocalStorage`.

## Global Constraints

- No em-dashes anywhere (code, comments, commits, UI). Use en-dash, comma, or rephrase.
- No emojis in code or commits.
- All user-facing strings in Norwegian (`nb-NO`).
- `@/*` path alias resolves to `src/*`.
- `npm run typecheck` MUST pass before every commit; `npm test` MUST pass before pushing.
- Reuse existing patterns: body-class toggling like `bento-active`, `useLocalStorage` for view prefs, inline styles / existing CSS classes over new UI primitives.
- Commit body trailer (verbatim):
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Glass values (verbatim from spec): surface `rgba(17, 17, 20, 0.40)`, `backdrop-filter: blur(30px) saturate(150%)`. Heavy, pure glass, no readability floor. Default OFF.

---

### Task 1: Glass-mode helpers + unit test

**Files:**
- Create: `src/lib/glassMode.ts`
- Test: `src/lib/glassMode.vitest.ts`

**Interfaces:**
- Produces: `GLASS_MODE_KEY: string`, `GLASS_MODE_CLASS: string`, `GLASS_MODE_DEFAULT: boolean`, `applyGlassModeClass(enabled: boolean): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/glassMode.vitest.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyGlassModeClass,
  GLASS_MODE_CLASS,
  GLASS_MODE_DEFAULT,
} from './glassMode';

describe('glassMode', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('defaults to off', () => {
    expect(GLASS_MODE_DEFAULT).toBe(false);
  });

  it('adds the body class when enabled', () => {
    applyGlassModeClass(true);
    expect(document.body.classList.contains(GLASS_MODE_CLASS)).toBe(true);
  });

  it('removes the body class when disabled', () => {
    document.body.classList.add(GLASS_MODE_CLASS);
    applyGlassModeClass(false);
    expect(document.body.classList.contains(GLASS_MODE_CLASS)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- glassMode`
Expected: FAIL — cannot resolve `./glassMode` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/glassMode.ts`:

```ts
/**
 * Constants + helper for transparent (Nebula) glass mode.
 *
 * The React state lives in GlassModeContext; this module holds the pure,
 * framework-free bits so they are unit-testable without React.
 */

/** localStorage key (matches the app's unprefixed view-pref keys). */
export const GLASS_MODE_KEY = 'glass-mode';

/** Body class that activates src/styles/glass.css. */
export const GLASS_MODE_CLASS = 'glass-mode';

/** Off by default: the effect only renders inside Zen with Mica. */
export const GLASS_MODE_DEFAULT = false;

/** Add/remove the body class. Safe when there is no document (SSR/tests). */
export function applyGlassModeClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle(GLASS_MODE_CLASS, enabled);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- glassMode`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/glassMode.ts src/lib/glassMode.vitest.ts
git commit -m "$(cat <<'EOF'
feat(glass): add glass-mode constants and body-class helper

Pure, testable core for transparent mode: the localStorage key, body
class, default-off flag, and applyGlassModeClass. React wiring follows.

Refs #49

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: GlassModeProvider context + App wiring

**Files:**
- Create: `src/context/GlassModeContext.tsx`
- Modify: `src/App.tsx` (wrap the authed subtree)

**Interfaces:**
- Consumes: `GLASS_MODE_KEY`, `GLASS_MODE_DEFAULT`, `applyGlassModeClass` (Task 1); `useLocalStorage` (`src/hooks/useLocalStorage.ts`, returns `[value, setValue, reset]`).
- Produces: `GlassModeProvider({ children }): JSX.Element`; `useGlassMode(): { enabled: boolean; setEnabled: (on: boolean) => void }`.

- [ ] **Step 1: Create the context + provider + hook**

Create `src/context/GlassModeContext.tsx`:

```tsx
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  GLASS_MODE_KEY,
  GLASS_MODE_DEFAULT,
  applyGlassModeClass,
} from '@/lib/glassMode';

type GlassModeValue = {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
};

const GlassModeContext = createContext<GlassModeValue | null>(null);

/**
 * Owns the single source of truth for transparent mode: one localStorage-backed
 * boolean, applied to <body> as the `glass-mode` class for its lifetime. Wrap
 * the authed app so the class is applied on every route.
 */
export function GlassModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useLocalStorage<boolean>(
    GLASS_MODE_KEY,
    GLASS_MODE_DEFAULT,
  );

  useEffect(() => {
    applyGlassModeClass(enabled);
    return () => applyGlassModeClass(false);
  }, [enabled]);

  return (
    <GlassModeContext.Provider value={{ enabled, setEnabled: (on) => setEnabled(on) }}>
      {children}
    </GlassModeContext.Provider>
  );
}

export function useGlassMode(): GlassModeValue {
  const ctx = useContext(GlassModeContext);
  if (!ctx) throw new Error('useGlassMode must be used within GlassModeProvider');
  return ctx;
}
```

- [ ] **Step 2: Wire the provider into the authed subtree**

In `src/App.tsx`, add the import after the existing `PageOverlay` import (line 8):

```tsx
import { GlassModeProvider } from '@/context/GlassModeContext';
```

Then wrap the authed element. Replace the current guarded `element={ ... }` block (lines 40-49) with:

```tsx
              element={
                <RequireAuth>
                  <GlassModeProvider>
                    <PageOverlayProvider>
                      <AppShell>
                        <Outlet />
                      </AppShell>
                      <PageOverlay />
                    </PageOverlayProvider>
                  </GlassModeProvider>
                </RequireAuth>
              }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify the app still boots (nothing visual yet)**

Run: `npm run dev` (note the port from `_dev.log`), open the app, confirm it loads normally (glass mode is off by default, so no visual change). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/context/GlassModeContext.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
feat(glass): add GlassModeProvider context and wire into App

Single localStorage-backed boolean, applied to <body> as `glass-mode`
for the authed app's lifetime. Exposes useGlassMode for the toggle.

Refs #49

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The glass stylesheet

**Files:**
- Create: `src/styles/glass.css`
- Modify: `src/main.tsx` (import the stylesheet)

**Interfaces:**
- Consumes: the `body.glass-mode` class applied by Task 2; existing selectors `.bento-card`, `.bento-card.sage`, `.prompt-launcher-card`, `.page-overlay-panel`, `.lm-content`, `.lm-overlay`, `body.bento-active`.
- Produces: no code interface; purely visual activation gated by the body class.

- [ ] **Step 1: Create the stylesheet**

Create `src/styles/glass.css`:

```css
/* Transparent (Nebula) glass mode.
 *
 * Activated by body.glass-mode (toggled by GlassModeProvider). Every rule is
 * scoped under body.glass-mode so it can NEVER affect the normal opaque look.
 * Heavy, pure glass per the design spec: rgba(17,17,20,0.40) + blur(30px),
 * no readability floor.
 *
 * Cascade: these rules are unlayered, so they beat the layered @layer base /
 * @layer components rules in globals.css regardless of source order. Doubled
 * classes / descendant pairs raise specificity above the scoped dark overrides
 * in bento.css and overlay-dark.css.
 */

/* 1. Canvas: transparent so Zen's Mica backdrop shows through the whole app.
 *    body.bento-active forces #0c0c0d and <html> carries the base white bg;
 *    override both. */
html:has(body.glass-mode) { background: transparent !important; }
body.glass-mode { background: transparent !important; }

/* 2. Shared frosted-glass surface for the big container surfaces: home section
 *    cards, the Hurtigsok bar, overlay page panels and their cards, and modals.
 *    Inner tiles are intentionally left alone: link tiles (.lcard) inherit the
 *    glassed card behind them; wishlist/news tiles stay image-filled. */
body.glass-mode .bento-card,
body.glass-mode .prompt-launcher-card,
body.glass-mode .page-overlay-panel.page-overlay-panel,
body.glass-mode .page-overlay-panel .card,
body.glass-mode .page-overlay-panel .weather-card,
body.glass-mode .lm-content {
  background: rgba(17, 17, 20, 0.40) !important;
  -webkit-backdrop-filter: blur(30px) saturate(150%) !important;
  backdrop-filter: blur(30px) saturate(150%) !important;
}

/* 3. The Todo card is `.sage` (light bg + dark ink). On dark glass its ink must
 *    flip light and its sage-tinted controls need light hairlines. */
body.glass-mode .bento-card.sage { color: #ededec !important; }
body.glass-mode .bento-card.sage .tohead .lab,
body.glass-mode .bento-card.sage .ch-link { color: #9a9a98 !important; }
body.glass-mode .bento-card.sage .torow { border-bottom-color: rgba(255, 255, 255, 0.10) !important; }
body.glass-mode .bento-card.sage .tobox { border-color: rgba(255, 255, 255, 0.30) !important; }
body.glass-mode .bento-card.sage .torow.done .tobox { background: #ededec !important; }
body.glass-mode .bento-card.sage .torow.done .tobox::after { color: #171a12 !important; }

/* 4. Modal backdrop: soften the opaque scrim so glass modals read against Mica
 *    rather than a flat black sheet. */
body.glass-mode .lm-overlay { background: rgba(0, 0, 0, 0.35) !important; }
```

- [ ] **Step 2: Import the stylesheet**

In `src/main.tsx`, add directly after the existing globals import (line 4):

```tsx
import './styles/globals.css';
import './styles/glass.css';
```

- [ ] **Step 3: Typecheck + build (CSS is bundled by Vite)**

Run: `npm run typecheck && npm run build`
Expected: both succeed; no CSS parse errors in the Vite build output.

- [ ] **Step 4: Manual smoke — force the class on**

Run `npm run dev`, open the app, and in DevTools run `document.body.classList.add('glass-mode')`. Confirm the home canvas/cards go translucent and text stays readable (including the sage Todo card flipping to light ink). Run `document.body.classList.remove('glass-mode')` and confirm it returns to normal. Stop the dev server. (Full Mica verification happens in Task 5, inside Zen.)

- [ ] **Step 5: Commit**

```bash
git add src/styles/glass.css src/main.tsx
git commit -m "$(cat <<'EOF'
feat(glass): add scoped glass.css and import it

Frosted-glass surfaces + transparent canvas under body.glass-mode, with
the sage Todo card flipped to light ink. Scoped so the normal look is
untouched when the class is absent.

Refs #49

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Settings toggle

**Files:**
- Modify: `src/components/home/SettingsModal.tsx`

**Interfaces:**
- Consumes: `useGlassMode()` (Task 2); existing `cn` (`@/lib/cn`) and the `settings-row` / `settings-row-label` / `settings-toggle` / `settings-toggle-knob` / `settings-hint` CSS classes.
- Produces: no new exported interface; `SettingsModal`'s props are unchanged (glass state comes from context, not props).

- [ ] **Step 1: Add the import**

In `src/components/home/SettingsModal.tsx`, add after the existing `cn` import (line 3):

```tsx
import { useGlassMode } from '@/context/GlassModeContext';
```

- [ ] **Step 2: Read glass state inside the component**

Inside `SettingsModal(...)`, immediately after the `sensors` `useSensors(...)` call, add:

```tsx
  const { enabled: glassEnabled, setEnabled: setGlassEnabled } = useGlassMode();
```

- [ ] **Step 3: Render the toggle row**

In the returned JSX, insert this block immediately after the `<p className="settings-hint">…</p>` line and before the `<DndContext …>`:

```tsx
      <div className="settings-row">
        <span className="settings-row-label">Gjennomsiktig modus (Nebula)</span>
        <button
          type="button"
          role="switch"
          aria-checked={glassEnabled}
          aria-label="Gjennomsiktig modus (Nebula)"
          className={cn('settings-toggle', glassEnabled && 'on')}
          onClick={() => setGlassEnabled(!glassEnabled)}
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>
      <p className="settings-hint" style={{ marginTop: 0 }}>
        Gjør flatene gjennomsiktige slik at Zen/Nebula-bakgrunnen skinner gjennom. Virker bare i Zen.
      </p>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification — the real toggle**

Run `npm run dev`, open the app, open Innstillinger (gear icon), and flip "Gjennomsiktig modus (Nebula)". Confirm: surfaces go glass immediately; reload the page and confirm the setting persisted (still on); flip it off and confirm the app returns to normal and persists off. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/home/SettingsModal.tsx
git commit -m "$(cat <<'EOF'
feat(glass): add transparent-mode toggle to the settings modal

Reuses the existing settings-toggle switch; reads/writes glass state via
useGlassMode. Norwegian label + hint noting it only works in Zen.

Refs #49

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Full verification (typecheck, tests, build, Zen/Mica)

**Files:** none (verification only).

- [ ] **Step 1: Gates**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck clean; all tests pass (incl. `glassMode`); build succeeds.

- [ ] **Step 2: End-to-end in Zen (the spec's key risk check)**

Open the running dashboard (or the deployed URL) in Zen with Nebula/Mica active. Turn glass mode on. Confirm the desktop Mica actually shows through the transparent canvas. If it does NOT (the page shows a flat dark/opaque background instead), the site needs its URL allowed for transparency in the Zen Internet extension (per-site browser toggle) — document that as a one-time setup step in the PR; it is not a code change.

- [ ] **Step 3: Surface sweep in Zen**

With glass on, verify each surface reads as glass and stays readable: home section cards, the Hurtigsok bar, the sage Todo card (light ink), an opened overlay page (e.g. Lenker or Plan), and an edit modal. Toggle off and confirm every surface returns to the exact prior look.

- [ ] **Step 4: Capture evidence**

Take before/off and after/on screenshots in Zen for the PR "Test plan" section.

- [ ] **Step 5: Open the PR**

```bash
git push
gh pr create --title "Transparent (Nebula) glass mode toggle" --body "$(cat <<'EOF'
## Summary
- Adds a toggleable transparent "glass" mode (Settings modal), off by default.
- Single body.glass-mode class + scoped src/styles/glass.css; no base-theme changes.
- GlassModeProvider owns the localStorage-backed boolean and applies the class app-wide.
- Heavy pure glass (rgba(17,17,20,0.40) + blur 30px); sage Todo card flips to light ink.

## Test plan
- [ ] npm run typecheck
- [ ] npm test (incl. glassMode)
- [ ] npm run build
- [ ] Zen + Mica: canvas shows desktop through; all surfaces glass and readable; toggle off restores exactly. (Manual — screenshots attached.)
- [ ] Note whether the Vercel URL needed Zen Internet per-site transparency.

Closes #49
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Whole-app scope (home + overlays + modals) → Task 3 selectors cover `.bento-card`, `.page-overlay-panel*`, `.lm-content`. ✓
- `body.glass-mode` class + scoped `glass.css` → Tasks 1-3. ✓
- `useGlassMode` hook over `useLocalStorage`, default off → Task 2. ✓
- Settings-modal toggle, reuse `settings-toggle` → Task 4. ✓
- Heavy pure glass values, no floor → Task 3 (verbatim). ✓
- Image tiles / weather scene unchanged → Task 3 excludes `.gtile`/`.ncard`/`.viz` (documented refinement of the spec's card list, consistent with "image tiles stay opaque"). ✓
- Zen-Internet-for-Mica risk as first end-to-end check → Task 5 Step 2. ✓
- Testing: typecheck gate, vitest unit test, manual Zen verification → Tasks 1 & 5. ✓

**Deviations from spec (intentional, noted):** localStorage key is `glass-mode` (unprefixed) to match existing keys (`todo-view`, `news-source`) rather than `dashboard:glass-mode`. `.gtile`/`.ncard`/`.viz` excluded from the glass surface so image tiles and the weather scene stay as-is.

**Placeholder scan:** none — every code/CSS/command step is complete.

**Type consistency:** `applyGlassModeClass`, `GLASS_MODE_KEY`, `GLASS_MODE_DEFAULT` defined in Task 1 and consumed with the same names/signatures in Task 2; `useGlassMode()` returns `{ enabled, setEnabled }` and is consumed as such in Task 4.
