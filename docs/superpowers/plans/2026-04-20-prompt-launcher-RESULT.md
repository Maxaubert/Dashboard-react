# Prompt Launcher — execution result

**Date:** 2026-04-20
**Branch:** `worktree-prompt-launcher`
**Worktree path:** `.claude/worktrees/prompt-launcher` (relative to the repo root)

## What got built

A sortable HomePage section called **Prompt**: input field + engine dropdown
(Claude / ChatGPT / Perplexity / Google) + Go button + `?` help button.

| File | Purpose | Lines |
|---|---|---|
| `src/components/launcher/engines.ts` | Engine registry + `buildPromptUrl` pure helper | 50 |
| `src/components/launcher/engines.vitest.ts` | 10 unit tests covering URL construction | 49 |
| `src/components/launcher/PromptLauncher.tsx` | The section component + engine dropdown | 261 |
| `src/components/launcher/PromptLauncherHelp.tsx` | Radix dialog with Tampermonkey + userscript steps | 144 |
| `public/claude-prompt.user.js` | The Tampermonkey userscript itself | 53 |
| `src/pages/HomePage.tsx` | +3 lines: import, section id, render branch | +3 |

6 files, +560 lines.

## Commits on the branch (oldest first)

```
97f6726 feat(launcher): add engines registry + buildPromptUrl helper
bc21a9c feat(launcher): ship Tampermonkey userscript for claude.ai auto-submit
44e1155 feat(launcher): add help modal with Tampermonkey + userscript steps
2adcb4c feat(launcher): add PromptLauncher section component
81d4014 feat(home): wire PromptLauncher as a sortable home section
```

Plus the pre-existing `b5a8e27 docs(prompt-launcher): …` on main that added
the spec and plan.

## Verification run

- `npm run typecheck` → clean (exit 0).
- `npm run test` → **58 / 58 passing** across 3 vitest files (the 10 new
  `engines.vitest.ts` tests plus the 2 existing ones).
- `npm run dev` → `/` serves 200, `/claude-prompt.user.js` serves 200 with
  `Content-Type: text/javascript` — Tampermonkey picks up the URL and
  offers install.

## How to test when you get back

1. **Switch into the worktree:**
   ```bash
   cd C:/Users/Admin/Documents/Claude/Github/dashboard-react/.claude/worktrees/prompt-launcher
   ```
2. **Run the dev server:**
   ```bash
   npm run dev
   ```
   (If 5173 is taken, Vite will pick the next free port and print it.)
3. **Open the dashboard** in the browser.
   The **Prompt** section appears at the top of the home page (existing
   users — whose saved section order predates this change — will see it
   appended at the bottom; drag it up with the grip handle).
4. **Try ChatGPT first** (no setup needed): select ChatGPT in the dropdown,
   type anything, hit Go. A new tab opens on chatgpt.com with your query
   pre-filled and (usually) auto-submitted.
5. **Set up Claude auto-submit:**
   - Click the **?** button → follow the 3 steps:
     - Install Tampermonkey for your browser (link provided).
     - Click the "Install userscript ↗" button — it opens
       `/claude-prompt.user.js` and Tampermonkey offers a one-click install.
     - Select Claude in the dropdown and hit Go. A claude.ai tab opens,
       your prompt is typed in, and send fires automatically.
6. **Drag the section** by its grip handle to re-order alongside the other
   home sections.

## Known limitations

- If claude.ai changes the composer's DOM (class name or Send-button
  `aria-label`), the userscript's selectors may drift. Check the browser
  console for `[claude-prompt-from-url]` errors and update
  `public/claude-prompt.user.js` accordingly. The version field is `1.0.0`
  — bump it when you change the script so Tampermonkey offers the update.
- Pop-up blockers that block `window.open` from non-user-initiated contexts
  should not affect us since the submit is a direct user click, but if you
  ever see nothing happen, that's the likely cause.
- Engine list is fixed to Claude / ChatGPT / Perplexity / Google. Adding
  another engine is a one-line addition to `ENGINES` in
  `src/components/launcher/engines.ts`.

## What I did NOT do (to keep scope tight)

- Did not merge into main or push the branch — that's your call.
- Did not install `@testing-library/react` to add component-rendering tests.
  The high-value test target was the URL-building function, which is
  covered. UI behaviour was verified by hand and by compiling / serving.
- Did not change the backend or `/api/skole`.
- Did not alter existing styles beyond reusing classes already in
  `globals.css` (`section-header`, `db-grip-handle`, `modal-btn-primary`).

## Files to re-read if you want to review

- Design decisions: `docs/superpowers/specs/2026-04-20-prompt-launcher-design.md`
- Step-by-step implementation plan: `docs/superpowers/plans/2026-04-20-prompt-launcher.md`
- This result summary: you're reading it.
