# Prompt Launcher — design spec

**Date:** 2026-04-20
**Author:** Claude (Max AFK; assumptions captured inline)

## Goal

Add a search/prompt field to the dashboard home page. The user types a query,
picks an engine (default **Claude**), hits **Go**, and a new tab opens on the
chosen engine with the query pre-submitted. A **?** icon next to the field
opens a help modal explaining how to get Claude auto-submit working (install
Tampermonkey + our bundled userscript).

## Background

claude.ai deprecated its `?q=` URL parameter after a prompt-injection
vulnerability. ChatGPT, Perplexity and Google still support URL-based
auto-submit. To restore Claude behaviour we ship a userscript the user
installs once via Tampermonkey; it reads `?q=` from the URL on `claude.ai/*`,
injects the text into the composer and clicks Send.

Existing dashboard-react patterns already provide: React Query-backed home
layout, sortable home sections, `useLocalStorage` helper, Radix Dialog-based
modals, global CSS design tokens. The new feature should fit these.

## Assumptions (not to be ratified — user is AFK)

1. The launcher is a new **sortable HomePage section** (`prompt-launcher`),
   same drag-reorder pattern as the existing six. It is added to
   `DEFAULT_SECTIONS` as the first entry. Existing users' stored order will
   receive it appended to the end (merge rule
   `[...known, ...missing]`) — they can drag it up.
2. Engine list, ordered in the dropdown: **Claude**, **ChatGPT**,
   **Perplexity**, **Google**. Anything further is YAGNI.
3. Last-selected engine persists per-browser in `localStorage` under
   `prompt-launcher-engine`. Default is `claude`.
4. Queries are sent in a **new tab** via `window.open(url, '_blank',
   'noopener,noreferrer')`.
5. Empty/whitespace-only queries do nothing. Enter key and the Go button
   submit identically.
6. The **help** affordance is a small circled `?` button right of the Go
   button. Clicking it opens a Radix dialog (Modal component, `standard`
   variant) with step-by-step instructions and a direct install link.
7. The userscript file is shipped as `public/claude-prompt.user.js` so it is
   served at `/claude-prompt.user.js` in dev and prod. Tampermonkey intercepts
   any `.user.js` URL for install.
8. No backend changes. No API keys. No dashboard-side chat UI (that is
   option 2 from earlier brainstorming, explicitly out of scope).

## Engine URL table

| Engine     | URL template                                            | Auto-submits? |
|------------|---------------------------------------------------------|---------------|
| Claude     | `https://claude.ai/new?q={q}`                           | only with userscript |
| ChatGPT    | `https://chatgpt.com/?q={q}&hints=search`               | yes           |
| Perplexity | `https://www.perplexity.ai/search?q={q}`                | yes           |
| Google     | `https://www.google.com/search?q={q}`                   | yes           |

`{q}` is the query, `encodeURIComponent`-applied. No extra parameters beyond
the table above (YAGNI).

## Components

```
src/components/launcher/
  engines.ts               // Engine type, ENGINES array, buildPromptUrl()
  PromptLauncher.tsx       // The section-level widget rendered on HomePage
  PromptLauncherHelp.tsx   // The Radix Dialog with install instructions
  engines.vitest.ts        // Unit tests for buildPromptUrl
```

### `engines.ts`

- Export `EngineId = 'claude' | 'chatgpt' | 'perplexity' | 'google'`.
- Export `ENGINES: readonly Engine[]` with `{ id, label, buildUrl, needsUserscript }`.
  `buildUrl(q: string): string` returns the full URL with the query encoded.
- Export `buildPromptUrl(engine: EngineId, q: string): string` convenience
  wrapper used by the component and the tests. Throws on unknown engine
  (should be unreachable — type system blocks it).

Pure, no React, no DOM, no side effects. Easy to unit test.

### `PromptLauncher.tsx`

Renders as a home section (section header "Prompt" with grip handle + the
familiar `<div className="section-header">` pattern), containing one row:

```
[  Spør Claude, Perplexity, ChatGPT …              ]  [▼ Claude]  [Go]  [?]
```

Behavior:

- Controlled input for the query (`useState`).
- `useLocalStorage<EngineId>('prompt-launcher-engine', 'claude')` for the
  active engine.
- Dropdown: mirror the pattern used by `NewsSourceDropdown` in `HomePage.tsx`
  (custom button + popover) for visual consistency.
- Submit via form `onSubmit` so Enter and Go behave identically. Guard:
  ignore empty/whitespace queries.
- On submit: compute URL via `buildPromptUrl`, call
  `window.open(url, '_blank', 'noopener,noreferrer')`, then clear the input.
- `?` button opens the help modal (local `useState`).

### `PromptLauncherHelp.tsx`

Radix `Modal` with `variant="standard"`, `size="lg"`. Content:

1. Short paragraph explaining the situation (ChatGPT/Perplexity/Google work
   out of the box; Claude needs a one-time setup because claude.ai doesn't
   accept auto-submit URLs natively).
2. **Step 1** — Install Tampermonkey. Two outbound links:
   [Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/) and
   [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
3. **Step 2** — Install the userscript. A single prominent
   "Install userscript" button that `href`s to `/claude-prompt.user.js`.
   Tampermonkey auto-detects and prompts install.
4. **Step 3** — Try it. Select **Claude** in the dropdown, type a prompt,
   hit Go.
5. Troubleshooting note: if send doesn't fire, check the browser console for
   `[claude-prompt-from-url]` errors — probably a DOM selector drifted.

## Userscript (`public/claude-prompt.user.js`)

Same logic we agreed on earlier, with small hardening:

- `@match https://claude.ai/*`
- `@run-at document-start`
- Reads `?q=` once, strips it from the URL so refresh doesn't re-fire.
- Polls with `requestAnimationFrame` up to 20s for a `div[contenteditable]`
  composer, then `document.execCommand('insertText', …)`.
- Polls for a `button[aria-label="Send message"|"Send Message"|"Send"]`
  that is `:not([disabled])`, then clicks after an 80ms delay so React's
  enabled-state has a chance to settle.
- Version `1.0.0`.

## Styling

Reuse the existing `section-header` + grip-handle pattern from HomePage so the
launcher visually matches the other sections. The row of inputs uses the same
input styling the Weather search uses (`background: rgba(255,255,255,0.05)`,
8-ish px radius, 78% rem). The Go button reuses `.modal-btn-primary`. The `?`
button is a `24×24` round ghost button. Any bespoke styles go inline in the
component to match the rest of the codebase's "ad-hoc inline styles for one-off
widgets" convention.

## Persistence

Only one new persisted item: `prompt-launcher-engine` in localStorage. No
schema changes to the backend home envelope beyond the new section ID
(which is a string key the existing merge logic already tolerates).

## Error handling

- Pop-up blocker blocks `window.open`: the call returns null. We don't
  surface an error (minor UX — user can try again). YAGNI.
- Unknown engine ID from stale localStorage: `buildPromptUrl` throws, caught
  by a try/catch that resets the stored engine to `claude`. Not expected in
  practice (the type system prevents this at compile time and the value
  space is closed).

## Testing strategy

This project's vitest `include` is `src/**/*.vitest.ts`, not `.test.ts`
(legacy `.test.ts` files use a custom tsx runner). New tests must be
`.vitest.ts`.

`@testing-library/react` is not currently a dependency — adding it for one
small component would be over-investing. The high-value test target is the
URL-building pure function; UI behaviour is light enough to verify by hand.

**`engines.vitest.ts`** — pure-function tests:
- Each engine produces the expected URL for a simple ASCII query.
- Queries with spaces encode as `%20` (or `+` per RFC, whichever
  `encodeURIComponent` produces — assert against the actual encoder output).
- Queries with `&`, `?`, `#`, and unicode survive encoding.
- `buildPromptUrl(id, '')` returns a URL with an empty `q=` value (the
  empty-query *guard* lives in the component, not in `buildPromptUrl`).
- ChatGPT URL retains the `&hints=search` suffix.

UI behaviour (input, dropdown, Enter, empty-submit guard, help modal) is
covered by a dev-server smoke test in the rollout plan.

## Non-goals (explicit)

- No dashboard-hosted chat UI (the Claude API integration). Separate epic.
- No auto-login flow for claude.ai. User must be signed in already.
- No multi-user sync of preferred engine (this is single-user app; localStorage
  is fine).
- No Firefox/Chrome-specific detection for the help links — show both, let
  user pick.

## Rollout plan

1. Worktree `prompt-launcher` off main.
2. Implement in order: `engines.ts` → tests → `PromptLauncher` →
   `PromptLauncherHelp` → userscript file → HomePage wiring.
3. `npm run typecheck && npm run test` must pass.
4. `npm run dev` and manually verify: type "test", change engine, Go,
   confirm the target site opens with the prompt filled (or submitted where
   supported). Verify `/claude-prompt.user.js` serves the script and
   Tampermonkey offers to install.
5. Leave a summary note for the user; they test Claude after installing the
   userscript on their end when they return.
