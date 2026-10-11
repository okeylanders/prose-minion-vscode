# Show vs. Tell — Slice 4 Review-Gate Handoff (commit, chip, reopen, clone)

**Date:** 2026-10-09 17:00 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-4-commit`, cut from
`epic/conversation-widgets` at `d425f4c` (the Slice 3 merge). One PR into the
epic. Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 3 handoff](20261009-1630-show-vs-tell-slice3-handoff.md)

**Current gate:** Slice 4 is ready for review. Do not start Slice 5 until the
PR merges. After this slice a writer can author, commit, reopen, and recommit a
Show vs. Tell draft end to end, so the Slice 3 → 4 restriction (catalog live
while commit was disabled) no longer applies. Recommendation and prefill
(Slice 5) and the witness matrix (Slice 6) are still open.

## What landed

Two commits, each green on its own.

1. **Host commit.**
   - `WorkshopShowVsTellCommitPayload` (`widgetId`, `requestToken`, `draft`,
     optional `clonedFromConfigId`) joins `WorkshopCommitWidgetPayload`, so
     `WorkshopOneShotWidgetId` gains `show-vs-tell`. The slice composition's busy
     predicate is `Record<WorkshopOneShotWidgetId, …>` again and the "joins when
     commit lands" comment is gone. The action-result union gains the
     `show-vs-tell` commit arm.
   - `ShowVsTellCommitEligibility.ts` (pure, webview-safe): `showVsTellCommitIssues`
     returns, in priority order, `no-workup`, `no-keep`, `kept-not-in-workup`,
     `kept-duplicated`, `kept-out-of-order`, `artifact-compilation-failed`,
     `over-artifact-budget`. The 600 check measures `buildShowVsTellArtifact(draft)`.
   - `ShowVsTellOneShotCommit.ts` (`prepareShowVsTellOneShotCommit`), the registry
     arm. On the host-received draft: shape assert → eligibility → integrity →
     `buildShowVsTellArtifact` → the host's own length check of the body that ships
     → append warnings. Rejections are `invalid-draft` with a writer-facing message;
     the over-ceiling message names all three fixes.
   - `ShowVsTellArtifactWarnings.ts` (host-only): the uncounted warning lines.
2. **Webview.**
   - `useShowVsTell` gains commit transport and correlation (copied from Creative
     Variations): `commit`, `handleCommitResult`, `clearCommitResult`,
     `resetCommitState`, `commitPending`, `commitResult`.
   - The authoring controller gains `commit`, `commitPending`, `commitOutcome`,
     `clearCommitResult`, `resetCommitState`, `onCommitAccepted`, `roomRunActive`,
     `toolTargetActive`, and exposes `commitError` and `commitDraft`.
     `commit-not-wired` is gone; `commit-in-flight`, `room-run-active`, and
     `tool-target` are in. Blockers are derived from the eligibility module, so the
     button is enabled exactly when the host would accept the draft.
   - The controller was at 486 lines, so two sibling hooks keep it under 500:
     `useShowVsTellCommitFlow` (outcome handling, `commitError`) and
     `useShowVsTellInvalidationWatch` (the model and room invalidation effects,
     moved without a behavior change).
   - The modal gains `banner`, `commitPending`, `commitError`, `onCommit`. Buttons
     are `Cancel` and `Commit to thread` / `Commit as new turn` / `Committing…`.
   - `WorkshopShowVsTellOpening` gains `{ kind: 'clone'; config }`.
     `useWorkshopWidgetOpening` opens it from a chip and from a rewind restore,
     and no longer says Show vs. Tell "can't be opened in this version".
   - `seededCloneConfigIdRef` is seeded in the controller's open effect, which is
     still the one place a draft is seeded.
   - The chip: eye icon, `Show vs. Tell`, `{N} kept · {M} as direction · re-open`.
3. **Guards.** `boundaries` approved-surface tokens extended at exactly the
   generic files touched (the commit-operations registry, `widgets.ts`,
   `WorkshopApp`, `WorkshopTurnBubble`, the opening hook, the action-result
   dispatch, the router); `minimumSourceFiles` 22 → 27. No new generic surface was
   approved, so the Prose Controller seam inventory is unchanged.
   `showVsTellPresentationBoundaries` now covers every controller file, the
   host-only commit and warning modules, and the no-editor-write claim across the
   whole feature (host and webview) plus the message enum.

## Decisions (Ada; the writer may override)

### The four orchestrator readings — all agreed

1. **Warning lines.** Format, one line per flag, with the key `warning:` (not in
   `SHOW_VS_TELL_ARTIFACT_LINE_KEYS`; a test pins that):
   `warning: kept line <n> · <strong|advisory> · <must survive|must not change> · <↵-encoded note>`.
   `<n>` is the 1-based ordinal among the `keep:`/`direction:` lines. Kept variants
   in workup order, each variant's flags in flag order. The maximal block is pinned
   exactly: 8 kept variants × 4 flags × (160-character note + the longest fixed
   prefix) + the joining newlines. Warnings never block and are never counted
   (a 600-character body with warnings commits).
2. **Writer turn.** `Ran “{beatPreview}” through the playground at {position,
   lowercased} — here's how I want the beat carried[ — {note}].` built from
   `summarizeShowVsTellDraft`'s bounded preview. A test proves no prose, direction,
   invariant, warning, provenance path, or passage rides it. `roomText` equals
   `displayText`, as in Creative Variations.
3. **Neutralizer.** No new tag, no `RESERVED_PERSONA_FRAME` change. A forged
   `</thread-artifact>`, `<writer-message>`, `<prose-directive>`, `</must-survive>`
   in the beat, prose, direction, both invariants, the note, and a warning note
   leaves exactly the two real envelope tags in the delivered frame. The kind
   validates; a near-miss kind throws.
4. **Chip data.** Reached without touching the persisted `widgetCommit`. The
   snapshot already carries `widgetConfigs` summaries for the visible window; the
   family-generic `useWorkshopWidgetHost` now mirrors them (`handleSessionState`),
   and `WorkshopThread` hands the bubble its summary. N comes from the turn's
   `selectionCount` (always `kept.length`), M from the summary's `directionCount`.
   If the summary is not in the window the chip keeps N and omits the direction
   clause. **I did not put this in `useWorkshopRoom`**: a boundary test forbids the
   room hook from naming widgets at all.

### Other decisions

- **Artifact label.** The frame's `Name:` line is `workshopWidgetLabel('show-vs-tell')`
  ("Show vs. Tell Playground"), as the brief says. The chip uses the shorter
  "Show vs. Tell" from the sprint and the design. They differ on purpose.
- **Units.** `workshopWidgetSelectionUnitLabel('show-vs-tell')` is "kept variant" (it
  feeds the transcript export), never "take".
- **Blocker order.** What is happening now (generation, commit, room run, tool
  target) outranks the draft's own gates, as Creative Variations orders them.
- **Unresolved source on a clone.** I followed Creative Variations: the reference
  is kept exactly as committed, never fixed or dropped; Generate is blocked with
  `source-unavailable` until the writer picks another source; **commit is not
  blocked** (the host resolves source text only at generation, and the artifact
  never carries it). A recommit records the unresolved reference as committed.
- **Reopen re-adopts, never invalidates.** A model or room change that happened
  before the sheet opened cannot clear a reopened workup. The invalidation watch
  adopts current values on the render that opens the sheet. A change after it
  opened still clears grounded work (tested).
- **The host's 600 re-check.** Eligibility already includes the ceiling (the
  webview shares it), so a crafted oversize payload is rejected there. The
  `prepare` step then re-measures the body it is about to ship. That second check
  cannot currently fire first; it is the independent guard on the shipped bytes and
  would catch a future change that makes eligibility looser than the projection.
- **A real bug the tests caught.** Splitting the controller put the commit
  outcome effect before the open effect, so a stale acknowledgement held when the
  sheet opened would have fired `onCommitAccepted`. The opening effect now lives in
  the commit-flow hook, declared first, with a test that fails if the order flips.
- **Lint.** +1 warning (1,105 vs 1,104 at the Slice 3 tip): the third hyphenated key
  in the closed commit-operations registry, the same naming-convention warning its
  two siblings already carry.

## Verification

- `npm run typecheck`: core, webview, ext clean.
- `npm run lint`: 0 errors, 1,105 warnings (baseline 1,104; see above).
- `npm test`: **288 suites / 4,053 tests / 2 snapshots, all passing** (Slice 3 tip:
  282 / 3,919 / 2).
- `npm run build`: compiled; `verify-bundle` OK.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits.

## What Slice 5 needs

- **Recommendation seed (input-only).** `WorkshopWidgetRecommendation` has no
  `show-vs-tell` arm yet. Adding it touches the places Creative Variations'
  seed touches: `widgets.ts` (the union), `cloneWidgetRecommendation` in
  `WorkshopSessionRecords`, `unavailableWidgetSourceReference` in
  `WorkshopRunCompletion`, `WorkshopSessionStateV1Shape`, and the
  `WorkshopWidgetRecommendationOperations` registry. The seed is beat, optional
  surrounding source, must survive, optional must not change, and optionally POV,
  position, channels, budget. Never a workup, selection, or note. If the frame
  needs a new tag it joins `RESERVED_PERSONA_FRAME` in the same commit.
- **The opening entry point a prefill uses.** Add
  `{ kind: 'seed'; seed; personaId; personaLabel }` to `WorkshopShowVsTellOpening`
  (as Creative Variations has) and a `seed` arm to `ShowVsTellBanner`. Seed it in
  `useShowVsTellAuthoring`'s open effect, the one place a draft is seeded, next to
  the `clone` branch. Then add the `show-vs-tell` case to
  `openWidgetRecommendation`; today its exhaustive `default` is `never`, so adding the
  union arm will fail the build until the case exists. Opening must never
  auto-generate.
- **POV custody (Q3).** A reopened clone restores `beat.provenance` exactly,
  including `persona-prefill` and `editedByWriter`. Nothing in Slice 4 builds
  persona custody for POV; the draft persists whatever it carried.
- **Host-preparation door.** `workshopWidgetAskPrefill` has no `show-vs-tell`
  builder; its test asserts the deferred set is exactly `['show-vs-tell']`. Slice 5
  adds the builder (the request expressly forbids generating, selecting, or
  committing) and removes the entry from the deferred set.

## Review fixes (Astra, PR #137)

Report: `docs/pr-reviews/pr-137-show-vs-tell-slice-4-review.md`. One finding.

- **F-01: a pending commit accepted draft changes.** The continuum and a late
  editor-selection reply bypassed the commit lock, so the displayed draft could
  diverge from the submitted one (a position edit lost on success; a rewritten
  beat and cleared workup after a refusal). A pending commit now owns the draft:
  - The controller holds a `commitPendingRef` and refuses every writer-driven
    edit while it is set: position, keep, carry, note, every generation input
    (through `updateGenerationInput`), selection intake, and Generate. The
    guard lives in the controller, not only the UI.
  - The continuum is disabled for the same span (pointer and keyboard). It stays
    editable **during generation**, the intentional exception.
  - **A late selection reply is dropped, not queued.** Queuing would apply a
    request the writer made before submitting to a draft they have since
    submitted; dropping is the safe choice. The writer can click Use editor
    selection again once the host answers.
  - A refusal therefore leaves the exact submitted draft, and the retry sends
    it unchanged under a new token. Source and model invalidation are unchanged
    (a room change mid-commit still clears grounded work).
  - To stay under 500 lines (498), three pure rules moved into
    `showVsTellAuthoringRules`: `withShowVsTellSourceReference`,
    `withShowVsTellPovMode`, `withShowVsTellCarryMode`. No new file, so the
    existing guards cover the delta.
- **Tests.** Full-`WorkshopApp` regressions for pointer and keyboard position
  input during a pending commit, a delayed selection reply, refusal then retry
  with the exact draft, edit-after-refusal, and the generation-time position
  control. Controller-level tests cover the same guards without the UI. Both
  witnesses were confirmed to fail with the fix reverted.
- **Verification.** typecheck clean; lint 0 errors / 1,105 warnings (unchanged);
  `npm test` 288 suites / 4,062 tests; build and `verify-bundle` OK; `git diff
  --check` clean.
