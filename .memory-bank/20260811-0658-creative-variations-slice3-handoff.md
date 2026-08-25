# Creative Variations — Slice 3 Review-Gate Handoff

**Date:** 2026-08-11 06:58 CDT

**Branch:** `sprint/conversation-widgets-03-creative-variations`

**Implementation tip:** `1633a3ed` — `feat(workshop): add Creative Variations generation runtime`

**Sprint:** [Sprint 03: Creative Variations Explorer](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-creative-variations.md)

**Runway:** [Creative Variations implementation runway](../docs/architecture/2026-08-10-creative-variations-implementation-runway.md)

**Current gate:** Slice 3 is complete and ready for commit review. Do not begin
Slice 5 commit/reopen work or flip the catalog live. The next implementation
step is Slice 4 integration.

## Exact repository state

The sprint branch contains these seven commits beyond remote commit `e02e7702`:

1. `0c29c151` — extract shared one-shot commit ownership (Slice 1)
2. `7c4b673b` — sync the Creative Variations design comp (Fable Phase A)
3. `450dfaf9` — map the comp to the Sprint 03 contract (Fable Phase A)
4. `d14ab795` — add Creative Variations durable contracts, budgets, codec, and persistence (Slice 2)
5. `06557616` — address every actionable Slice 1 commit-review finding
6. `72ee6b63` — add the controlled Creative Variations presentation components (Fable Phase B)
7. `1633a3ed` — add prompt, provider codec/service, overlap v1, and dormant generation routes (Slice 3)

The current-sprint review artifact is
[`commit-0c29c151-extract-one-shot-commit-ownership-review-v2.md`](../docs/pr-reviews/commit-0c29c151-extract-one-shot-commit-ownership-review-v2.md).
Its resolution ledger now records all twelve actionable findings as addressed by
`06557616`; the review body remains the historical assessment of `0c29c151`.

The main checkout is the sprint branch. One separate Fable worktree remains at
`.claude/worktrees/fable-s03-cvx-design`, on
`fable/s03-creative-variations-design` at `72ee6b63`. Its work is already in the
sprint branch; it is not ahead and does not need merging.

Two unrelated local artifacts remain intentionally untracked and must not be
staged by a broad add:

- `Prose Minion.zip`
- `docs/pr-reviews/commit-dbcfc9e5-recover-prior-widget-checkpoints-review-v2.md`

The second review belongs to the older Lexical Gravity recovery branch, not
Sprint 03.

## What Slice 3 now owns

- `packages/core/resources/system-prompts/creative-variations/` contains the
  closed v1 prompt and example.
- `CreativeVariationsResponseCodec` accepts only the exact sentinel-framed JSON
  grammar, exact keys, exact requested count, and bounded nonblank card fields.
  Model-authored ids are forbidden; the host derives flag ids.
- `CreativeVariationsService` performs one quality-first `widget`-scope call,
  validates all input before spend, rejects truncated or malformed completed
  responses, and stores paid rejected bodies through the shared recovery seam.
- `CreativeVariationsDistinctness` implements `textual-overlap-v2`: NFKC and
  Unicode token normalization, exact normalized-prose duplicate rejection,
  source-trigram discount with the specified fallback, direction bigrams,
  rounded Jaccard percentages, every canonical unordered pair, and deterministic
  first-maximum tie handling. High non-identical overlap remains evidence; the
  warning calibration score is 80.
- Persisted Creative workups recompute overlap evidence during integrity checks;
  stored scores are never trusted.
- `WorkshopCreativeVariationsHandler` owns only dormant pre-commit generation:
  catalog availability, host source resolution, fresh `cvw-<UUID>` ids,
  cancellation, progress, request-token correlation, and stale-result refusal.
  Generation does not mutate the Workshop session.
- The service is constructed only in `extension.ts`, enters core through
  `CoreServices`, and is routed by `WorkshopSliceComposition`. Production still
  reads the catalog entry as `live: false`; focused tests enable exactly
  `creative-variations` through the fixed availability policy.

The feature intentionally keeps semantic integrity, host-minted workup
identity, and shared derivation helpers in focused sibling modules instead of
growing `CreativeVariationsConfigCodec.ts` into a mixed-responsibility file.
Future widgets may make the same split when their integrity surface earns it;
the split is not a mandatory family layout rule.

## Presentation state already present

Fable's `72ee6b63` added the controlled modal, card, comparison component, CSS,
fixtures, and presentation tests. These components are intentionally unmounted.
They hold no durable draft or transport state. Only ephemeral comparison marks
and comparison-tray visibility live inside presentation.

The modal contract expects the future controller to supply:

- the full `WorkshopCreativeVariationsDraft`;
- opening banner, generation state, commit state/blockers, artifact projection,
  high-overlap score, source options, and widget-model selection;
- callbacks for intake/editing/invalidation, source toggles, generation/cancel,
  selection/carry/risk acceptance, notes, copy, commit, and close.

## Verification at the Slice 3 tip

- Full Jest: **204 suites, 2,142 tests, 2 snapshots — all passed**.
- TypeScript: core, webview, and VS Code adapter — clean.
- Architecture: all 11 guard suites — passed.
- ESLint: **0 errors**, 951 repository warning-class instances.
- Production build, resource staging, and bundle sentinel verification — passed.
- Webpack reported only the three existing asset-size recommendations.
- `git diff --check` — clean.

No screenshots exist yet because there is still no honest mounted rendering
path. Capture screenshots only after Slice 4 wiring.

## Next step — Slice 4 integration

Implement Slice 4 on the sprint branch, stopping again at its review gate:

1. Add the Creative Variations transport hook for generate/cancel/progress/result
   correlation and the Gesture-style widget-model selector quartet.
2. Add a transient authoring controller with the tripartite hook shape and an
   explicit empty persistence contract. The persisted widget config remains
   host-owned; the controller must not call `useVSCodeApi` or construct messages.
3. Wire selection and paste intake into `subject`, preserving excerpt versus
   pasted provenance honestly. Editing excerpt-derived subject text flips its
   provenance to `pasted`.
4. Make any authoring-input change invalidate the settled workup atomically:
   clear cards, selections, carry modes, accepted risks, and prior workup id.
   Starting a regenerate uses a new webview token; the handler supplies a new
   host workup id.
5. Map the handler's progress/result messages to the modal's controlled
   `generation` state. Closing or cancelling must abort the active matching
   token; stale progress/results must not settle.
6. Mount `WorkshopCreativeVariationsModal` from `WorkshopApp`, import
   `creativeVariations.css` there, add the webview message-route entries, and
   provide the host clipboard callback for per-card copy.
7. Pass `CREATIVE_VARIATIONS_HIGH_OVERLAP_SCORE` (80) into the presentation;
   do not derive an average, rank cards, hide high-overlap cards, or add partial
   pair regeneration.
8. Add controller, hook, router, intake, invalidation, cancellation, stale-token,
   accessibility, and mounted integration tests. Then capture honest narrow and
   normal-width screenshots.

Slice 4 must **not** implement compact room commit, chip reopen, clone and
recommit, recommendation/prefill, or catalog activation. Those remain Slices
5, 6, and 7 respectively.
