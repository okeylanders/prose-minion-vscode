# Sprint 06C: Excerpt Revision Loop and Room Memory

**Status**: Completed (2026-07-12)
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06c-excerpt-revision-loop` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3-4 days
**Depends on**: Sprint 06B
**Blocks (soft)**: Sprint 07 — the capability loop should build on the final host-turn memory model rather than retrofit it, and its input ceilings must be born in the central budget table
**ADRs**: [2026-07-11 — Workshop Excerpt Revision and Room Memory](../../../../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Absorbs**: [archived prompt-budget centralization debt](../../../archive/tech-debt/2026-07-11-prompt-truncation-budget-centralization.md) as Task 0; the **paste-only slice** of [feature-workshop-context-selector](../../../features/feature-workshop-context-selector/README.md) (editable context brief — the selector modal stays in that entry)

## Goal

Make the Workshop's core loop — get feedback, revise the manuscript, ask for
another look — work without amnesia. Replacing the pinned excerpt preserves
the host conversation and delivers the revised text as a versioned frame on
the next host turn; tool sidecars stay stateless instruments and are retired
honestly.

## Current Reality After Sprint 06B

- `replaceExcerpt()` discards the host conversation and every tool sidecar;
  the visible thread survives, so the UI shows continuity the model no
  longer has.
- The excerpt rides the first user message of each retained conversation
  (`buildWorkshopPersonaUserMessage`, 10k-word cap, delimiter-neutralized).
- Direct-tool handoff (delivery cursor, 8 turns / 20k chars) ships in 06B —
  the pending-evidence delivery pattern this sprint mirrors.
- A same-tool re-run replaces/disposes its sidecar and analyzes the current
  excerpt in a fresh conversation.

## Locked Decisions (from the ADR)

- Host memory survives replacement via a **pending revision notice**
  delivered ahead of the writer's next host message. No API call at
  replacement time; the notice clears only after that turn succeeds.
- Multiple replacements before the next host turn collapse to one notice
  carrying only the newest version.
- Monotonic `excerptVersion`; turns and tool artifacts record the version
  they saw.
- Tool sidecars dispose on replacement; re-runs stay fresh conversations.
  Comparison is the host's job.
- Deterministic thread divider at replacement (version, source, retired
  sidecars). No confirmation dialog.
- Every version frame independently capped at
  `WORKSHOP_PERSONA_EXCERPT_MAX_WORDS` with head-slice provenance;
  deterministic advisory after three replacements per session.
- Delimiter neutralization applies to every version frame and the notice
  wrapper. Mid-run replacement guard unchanged.

## Tasks

### Task 0: Prompt budget centralization (mechanical; first commits, zero behavior change)

- [x] Create the frozen, typed budget module
      (`packages/core/src/shared/constants/promptBudgets.ts`) covering every
      prompt-side bound in the tech-debt census: `fileExcerpt` (words +
      bytes), `personaExcerpt`, `contextBrief`, `toolEvidence` (chars),
      `directHandoff` (turns + chars + named header allowance — retiring the
      magic `- 800`), `contextFiles` (words + catalog items), `guides`,
      `sourceDocument`.
- [x] Migrate all seven sites to import from it; delete every module-local
      limit constant. **No limit value changes in this sprint.**
- [x] Add a char-based trim helper beside `trimToWordLimit` returning the
      same `TrimResult`-style provenance; adopt it at the raw-`slice()`
      sites (`WorkshopPromptBuilder`, `WorkshopSessionService`).
- [x] Architecture guard test (sibling of `boundaries.test.ts`): fail on new
      module-local `*_MAX_*` / `*_LIMIT*` constants outside the budget
      module and tests.
- [x] These commits land before any revision-loop behavior work so the
      refactor diff reviews clean.

### Session model

- [x] Add `excerptVersion` (monotonic per session) and stamp it into
      `WorkshopExcerpt`; expose it in the session snapshot.
- [x] Change `replaceExcerpt()` to preserve the host conversation id,
      dispose only tool sidecars + direct target, and set/overwrite the
      pending revision notice. Return disposed conversation ids.
- [x] Record a divider turn (participant-neutral) in `turns` at replacement
      with version, source path, and retired tool labels.
- [x] Persist pending-notice state in the snapshot so a webview reload
      mid-pending rehydrates honestly.
- [x] `reset()` clears the pending notice along with everything else.

### Delivery on next host turn

- [x] Build the revision frame (`<pinned-excerpt version="N">` + provenance
      + supersession preamble) in `AssistantToolService`, reusing the
      existing trim + neutralization helpers per frame.
- [x] Prepend the frame to the next host continuation message; clear the
      pending notice only on turn success (mirror the 06B delivery-cursor
      adoption rule; cancellation/failure leaves it pending).
- [x] Collapse rule: a second replacement overwrites the pending notice;
      intermediate versions the host never saw are not delivered.

### Handler and UI

- [x] `handleSetExcerpt` / `handlePickExcerptFile`: same validation and
      mid-run guard; on success post the divider turn and updated snapshot;
      log version, source, and retired sidecar count.
- [x] Render the divider in the thread ("Excerpt v2 pinned · ch-03.md ·
      retired: Cliché, Continuity") and the current version in the excerpt
      panel/status.
- [x] Deterministic advisory (status rail, not modal) after the third
      replacement in one session suggesting a new session for cost.

### Editable context brief (paste-only slice)

Current reality: the Context Brief panel is a hardcoded placeholder
(`WorkshopApp.tsx` "No context brief loaded."), while the downstream
plumbing — `getContextBrief()` consumed by persona messages and tool side
passes, framed as `<context-brief>` with the 10,000-word cap — is fully
built. No setter exists anywhere; the field is born and stays `undefined`.

- [x] Session: add `setContextBrief(text: string | undefined)`; empty/
      whitespace clears. The brief describes the project, not the excerpt —
      it **survives excerpt replacement** and is cleared only by `reset()`
      (which already does). Persist in the snapshot for reload.
- [x] Message: typed `WORKSHOP_SET_CONTEXT_BRIEF` route on
      `WorkshopHandler`; envelope-sourced, validated, logged (length only,
      never content).
- [x] Delivery: a brief set before the host conversation starts rides the
      opening message (existing plumbing). A brief set or changed
      mid-conversation queues a pending context update delivered with the
      next host turn — **reuse the revision-notice delivery path**, same
      collapse and clear-on-success rules. Tool runs need nothing: they
      read `getContextBrief()` fresh per run.
- [x] UI: replace the placeholder with an editable textarea; live word
      count against the `contextBrief` budget (from the Task 0 table) with
      honest will-be-trimmed indication; clear control; a quiet hint when
      an edit is pending delivery ("shared with your next message").
- [x] Scope guardrail: paste-only. No file browsing, categories, or
      attachments (Context Selector modal feature) and no
      persona-requested loading (post-Sprint-07 feature).

### Tests

- [x] Session: replacement preserves host id, disposes sidecars, bumps
      version, records divider, collapses double-replacement; reset clears
      pending state.
- [x] Delivery: notice rides the next host turn exactly once; survives
      cancellation un-cleared; cleared on success; reload rehydration.
- [x] Frames: per-frame word cap with trim provenance; neutralization on
      version frames and wrapper; version stamping on turns/artifacts.
- [x] Rewrite (not delete) any test asserting host invalidation on
      replacement — the old behavior was load-bearing and the new one must
      be proven, not assumed.
- [x] Context brief: setter/clear/persistence semantics (survives excerpt
      replacement, cleared by reset, restores on reload); opening-message
      inclusion; mid-conversation pending update delivered exactly once via
      the shared path; tool side pass reads the current brief.

### Documentation

- [x] Update the Workshop session docs and ADR cross-links; note the
      changed `replaceExcerpt()` contract in `docs/ARCHITECTURE.md` if it is
      described there.

## Completion Record

- Centralized all prompt input bounds in `PROMPT_BUDGETS`, added character
  trim provenance, and archived the absorbed tech-debt item. The architecture
  guard allowlists only established non-prompt batching/concurrency/UI bounds.
- `WorkshopSessionService` now versions excerpts/turns, preserves the retained
  host on replacement, retires tool sidecars, records dividers, and owns a
  generation-safe pending host-update transaction for revisions and context.
- Revision/context frames are bounded and delimiter-neutralized. Delivery is
  success-only across ordinary host messages and tool-side-pass synthesis;
  cancellation/failure keeps the exact update pending and replacements
  collapse to the newest excerpt.
- The Context Brief rail is editable with a live 10,000-word budget indicator,
  trim disclosure, clear control, and pending-delivery hint. Tool runs read the
  current brief at invocation time.
- Pre-PR hardening: model-selection changes now hot-swap the existing engine's
  transport model instead of rebuilding model scopes, so retained Workshop
  host/tool conversations survive assistant, context, dictionary, and category
  model changes. Workshop errors render at the thread tail and trigger
  autoscroll rather than appearing above the conversation.
- Verification: lint completed with 0 errors (603 pre-existing warnings);
  typecheck passed; 84 suites / 643 tests passed; production build and bundle
  sentinel verification passed; `git diff --check` passed.
- Production bundles: `extension.js` 2,322,175 bytes; `webview.js` 590,206
  bytes. The pre-build local artifacts were 4,440,463 and 2,160,985 bytes
  respectively; those stale-artifact deltas (-2,118,288 / -1,570,779 bytes)
  are recorded for completeness but are not attributable to this sprint.

## Acceptance Criteria

- Every prompt-side truncation limit imports from the budget module; the
  guard test enforces it; grep for stray `MAX_WORDS|MAX_CHARS|MAX_BYTES`
  outside the module returns only the module and tests. New 06C bounds
  (revision frame reuses `personaExcerpt`) come from the table.
- Replacing the excerpt mid-conversation, then asking the host to compare
  against its earlier feedback, gets a memory-intact, version-aware answer.
- The Context Brief box is editable; a pasted brief demonstrably reaches
  the persona (opening message or next host turn) and tool runs; an empty
  box sends no `<context-brief>` frame.
- No API call fires at replacement time; the next host turn carries exactly
  one revision frame with the newest version.
- Tool sidecars retire visibly at the divider; re-running a tool analyzes
  the current excerpt in a fresh conversation.
- The thread never implies memory or liveness the model doesn't have.
- Lint, typecheck, focused/full tests, build, bundle verification, and
  `git diff --check` pass. Record bundle deltas.

## Guardrails

- Task 0 commits are pure mechanical moves and land first; no limit value
  changes and no behavior changes ride in them. Revision-loop behavior work
  starts only after the budget table is in place.
- Do not mutate retained histories — the revision frame is new content on
  the next turn, never an edit of turn 1.
- Do not add a confirmation dialog; the divider is disclosure enough under
  this model.
- Do not seed re-runs with prior findings (deferred R2) or build diff-based
  frames in this sprint.
- Do not touch guest-persona semantics; that is Sprint 09 on its own ADR.
