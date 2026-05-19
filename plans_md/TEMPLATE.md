# Plan — YYYY-MM-DD <topic>

One-paragraph framing: what this plan covers, why it exists, what the success criteria are. Keep it short — the stages do the explaining.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `⏸` deferred · `⊘` rejected

---

## Stage 1 — <title>

Brief framing. What kind of work, what risks, what "done" means for this stage.

### 1a. <sub-section>
- [ ] task description (be specific — file paths, function names, expected outcome)
- [ ] task description

### 1b. <sub-section>
- [ ] task description

---

## Stage 2 — <title>

...

---

## Stage N — Probably-don't-bother

Items explicitly excluded with one sentence of reasoning. Keep them here so we don't re-evaluate later.

- ~~Item~~ — reason
- ~~Item~~ — reason

---

## Checkpoints

Filled in as commits land. Newest first.

```
<sha>  <commit subject>
```

---

## Notes / context

- **Date started**: YYYY-MM-DD
- **Branch**: `feat/...` or `refactor/...`
- **PR**: link, once created
- **Status**: in progress / merged / deferred
- **Open decisions** that need user input
- **Deployment caveats** (e.g. requires running `_setup_*.py` once)

---

## Conventions for new plans

- Mark deferred work explicitly with a reason — don't silently drop tasks.
- After a stage merges, update the `[ ]` to `[x]` with the merge commit SHA.
- When the user verifies something manually (e.g. drag UX), note that the verification happened in the audit doc.
- Use the existing audit `plans_md/2026-05-19-codebase-audit.md` as a worked example.
