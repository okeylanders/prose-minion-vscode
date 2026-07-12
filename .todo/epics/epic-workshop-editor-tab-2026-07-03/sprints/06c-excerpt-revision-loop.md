# Sprint 06C: Excerpt Revision Loop and Room Memory

**Status**: Planned
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-06c-excerpt-revision-loop` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3-4 days
**Depends on**: Sprint 06B
**Blocks (soft)**: Sprint 07 — the capability loop should build on the final host-turn memory model rather than retrofit it, and its input ceilings must be born in the central budget table
**ADRs**: [2026-07-11 — Workshop Excerpt Revision and Room Memory](../../../../docs/adr/2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Absorbs**: [.todo/tech-debt/2026-07-11-prompt-truncation-budget-centralization.md](../../../tech-debt/2026-07-11-prompt-truncation-budget-centralization.md) as Task 0

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

- [ ] Create the frozen, typed budget module
      (`packages/core/src/shared/constants/promptBudgets.ts`) covering every
      prompt-side bound in the tech-debt census: `fileExcerpt` (words +
      bytes), `personaExcerpt`, `contextBrief`, `toolEvidence` (chars),
      `directHandoff` (turns + chars + named header allowance — retiring the
      magic `- 800`), `contextFiles` (words + catalog items), `guides`,
      `sourceDocument`.
- [ ] Migrate all seven sites to import from it; delete every module-local
      limit constant. **No limit value changes in this sprint.**
- [ ] Add a char-based trim helper beside `trimToWordLimit` returning the
      same `TrimResult`-style provenance; adopt it at the raw-`slice()`
      sites (`WorkshopPromptBuilder`, `WorkshopSessionService`).
- [ ] Architecture guard test (sibling of `boundaries.test.ts`): fail on new
      module-local `*_MAX_*` / `*_LIMIT*` constants outside the budget
      module and tests.
- [ ] These commits land before any revision-loop behavior work so the
      refactor diff reviews clean.

### Session model

- [ ] Add `excerptVersion` (monotonic per session) and stamp it into
      `WorkshopExcerpt`; expose it in the session snapshot.
- [ ] Change `replaceExcerpt()` to preserve the host conversation id,
      dispose only tool sidecars + direct target, and set/overwrite the
      pending revision notice. Return disposed conversation ids.
- [ ] Record a divider turn (participant-neutral) in `turns` at replacement
      with version, source path, and retired tool labels.
- [ ] Persist pending-notice state in the snapshot so a webview reload
      mid-pending rehydrates honestly.
- [ ] `reset()` clears the pending notice along with everything else.

### Delivery on next host turn

- [ ] Build the revision frame (`<pinned-excerpt version="N">` + provenance
      + supersession preamble) in `AssistantToolService`, reusing the
      existing trim + neutralization helpers per frame.
- [ ] Prepend the frame to the next host continuation message; clear the
      pending notice only on turn success (mirror the 06B delivery-cursor
      adoption rule; cancellation/failure leaves it pending).
- [ ] Collapse rule: a second replacement overwrites the pending notice;
      intermediate versions the host never saw are not delivered.

### Handler and UI

- [ ] `handleSetExcerpt` / `handlePickExcerptFile`: same validation and
      mid-run guard; on success post the divider turn and updated snapshot;
      log version, source, and retired sidecar count.
- [ ] Render the divider in the thread ("Excerpt v2 pinned · ch-03.md ·
      retired: Cliché, Continuity") and the current version in the excerpt
      panel/status.
- [ ] Deterministic advisory (status rail, not modal) after the third
      replacement in one session suggesting a new session for cost.

### Tests

- [ ] Session: replacement preserves host id, disposes sidecars, bumps
      version, records divider, collapses double-replacement; reset clears
      pending state.
- [ ] Delivery: notice rides the next host turn exactly once; survives
      cancellation un-cleared; cleared on success; reload rehydration.
- [ ] Frames: per-frame word cap with trim provenance; neutralization on
      version frames and wrapper; version stamping on turns/artifacts.
- [ ] Rewrite (not delete) any test asserting host invalidation on
      replacement — the old behavior was load-bearing and the new one must
      be proven, not assumed.

### Documentation

- [ ] Update the Workshop session docs and ADR cross-links; note the
      changed `replaceExcerpt()` contract in `docs/ARCHITECTURE.md` if it is
      described there.

## Acceptance Criteria

- Every prompt-side truncation limit imports from the budget module; the
  guard test enforces it; grep for stray `MAX_WORDS|MAX_CHARS|MAX_BYTES`
  outside the module returns only the module and tests. New 06C bounds
  (revision frame reuses `personaExcerpt`) come from the table.
- Replacing the excerpt mid-conversation, then asking the host to compare
  against its earlier feedback, gets a memory-intact, version-aware answer.
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
