# Creative Variations Slice 6 implementation handoff

**Recorded**: 2026-08-13 20:45 CDT
**Branch**: `sprint/conversation-widgets-03-creative-variations`
**Starting / required ancestor**: `41f5b717` (`docs: align Creative Variations runway with live availability`)
**Current gate**: Slice 6 accepted; Slice 7 closure and writer-authority correction verified; Sprint 03 complete
**Publication**: implementation `333e28e5`, remediation `0e4cd290`, prompt-doc
alignment `7a7accfb`, and context-limit adjustment `c9432788` are committed and pushed
**Abstraction register**: `imagine`, bounded by the approved implementation runway

## Result

Slice 6 adds writer-controlled persona recommendation and input-only prefill to
Creative Variations. Host and Guest personas may now emit one exact, bounded
Creative recommendation frame. The host validates it against the production
availability policy and current session sources, persists it only on the exact
persona turn, and renders the existing generic recommendation chip. Opening the
chip creates an editable Creative draft with honest `persona-prefill`
provenance; it does not generate, select, accept risk, or commit anything.

The Widgets browser's explicit “Ask agent to configure, then open” door now
supports Creative too. It seeds an editable Host request that names the complete
input surface and forbids generation, selection, acceptance, and commit.

Report-prefill remains deliberately absent. No analysis report contract, prompt,
parser, or result chip was changed.

The `imagine` register influenced only the healthy family shape already frozen
by the runway: one named Creative parser/entry behind the closed recommendation
registry and catalog-derived generic presentation. It did not create a generic
variation framework or move Creative vocabulary into family mechanics.

## Authority and data flow

1. `CreativeVariationsRecommendation` owns Creative prompt copy, exact markers,
   field bounds, source-reference syntax, and conversion to the input-only seed.
2. `WorkshopWidgetRecommendationOperations` contributes the named entry to the
   closed family registry. Its injected availability policy filters both prompt
   instructions and accepted result ids.
3. `WorkshopRunCompletion` strips the control frame, validates current source
   availability, and offers the seed only to `completeRun`. Session ownership
   permits attachment only to the current Host or Guest turn.
4. `WorkshopSessionStateV1Shape` independently validates the exact seed and
   refuses recommendations on non-persona current-state turns. Checkpoint
   normalization discards only a recommendation with forged ownership so the
   remaining session stays recoverable. `WorkshopSessionRecords` defensively
   clones nested source references.
5. `useWorkshopWidgetOpening` correlates the exact recommendation and persona,
   refuses to replace an already-open Creative sheet, and hands the seed to the
   transport-free authoring controller.
6. `useCreativeVariationsAuthoring` mints `persona-prefill` custody with the
   canonical persona id and unedited state, seeds exact inputs, defaults only
   omitted distance/count values, and initializes no workup, selections,
   or note. Editing the subject preserves custody and records
   `editedByWriter`.
7. `WorkshopApp`, `WorkshopCreativeVariationsModal`, and `WorkshopTurnBubble`
   provide the attribution banner, honest provenance copy, and catalog-derived
   chip label/icon. Nothing runs until the writer presses Generate.

## Durable boundary

The recommendation seed may contain only authoring inputs:

- exact subject and optional exact surrounding context;
- current session source-reference addresses;
- optional `must survive`, `must not change`, and creative aim;
- one closed distance and a count of 3, 4, or 5.

It cannot contain provenance, a workup, cards, overlap evidence, selections,
carry modes, a writer note, or any committed identity. The
controller, not the persona, assigns display-safe prefill custody. The canonical
persona id and whether the writer edited the prefill survive exact commit and
reopen; neither state claims a file or room-material origin.

## Principal production changes

- Added `CreativeVariationsRecommendation.ts` as the feature-owned prompt/parser
  entry and registered it in `WorkshopWidgetRecommendationOperations.ts`.
- Added exact recommendation-seed and `persona-prefill` contracts plus bounded
  checkpoint validation and defensive cloning.
- Extended run completion/source validation and reserved prompt-delimiter
  neutralization for the Creative frame.
- Extended widget opening, authoring, modal attribution, generic turn-chip
  rendering, and the Widgets-browser Host-prefill request.
- Added the Creative frame allowance to the centralized prompt budget, gave
  every registry entry its own response ceiling, and derived the coarse family
  envelope from those compiler-required entries.

## Review remediation addendum — 2026-08-14

The v2 review of `333e28e5` raised fourteen findings; all were addressed in
`0e4cd290` and accepted on re-review. The material changes are:

- exact per-widget registry ceilings plus a 7,823-character assembled-prompt
  pin, completing the 2026-07-31 recommendation prompt-assembly tech debt;
- custody-correct persona provenance (`personaId`, `editedByWriter`) excluded
  from provider task JSON;
- explicit Host ask semantics for only writer-stated constraints;
- exhaustive presentation and source dispatch, widget-named diagnostics, and a
  nonblank frame-only fallback when a tool participant cannot own the chip;
- pending committed-config reopen precedence over later persona-prefill clicks;
- local checkpoint recovery for forged recommendation ownership while strict
  current-state ownership remains enforced; and
- stronger bare-vocabulary architecture guards and exact source-reference unit
  bounds.

The review resolution ledger is updated in
`docs/pr-reviews/sprint-03-creative-variations-slice-6-333e28e5-review-v2.md`.

## Verification receipt

- Targeted remediation: **13 suites / 256 tests** passed.
- Full Jest: **208 suites, 2,293 tests, 2 snapshots passed**.
- `npm run typecheck`: core, webview, and extension configurations passed.
- `npm run lint`: **0 errors, 956 warnings** (repository baseline; no bulk fixes).
- `npm run build`: resource staging, both production webpack bundles, and bundle
  sentinel passed. Webpack retained its 3 advisory webview-size warnings.
- `git diff --check`: passed after the final implementation and evidence update.

The tests cover prompt authority and exact prompt size, per-feature/aggregate
frame ceilings, exact/blank/boundary parsing, malformed
markers, source availability, production-catalog dispatch, tool-turn refusal,
persistence shape and local ownership recovery, defensive correlation to the
exact persona turn, opening/pending-reopen overwrite refusal, input-only draft
creation, custody edits/reopen, mounted chip-to-prefill behavior, and absence of
automatic generate/commit messages.

## Accepted seams and remaining work

- Slice 7 completed the final architecture witnesses, production-policy route
  matrix, current-state documentation, and sprint closeout on 2026-08-15.
- A post-closure hands-on correction removed advisory acceptance and
  hard-conflict commit vetoes. Model-declared invariant flags remain visible and
  ride selected-card artifacts, while every returned card remains under writer
  selection and commit authority.
- The optional `personaId` on the broad Guest turn contract remains an accepted
  seam. Production Guest turns carry their canonical id, while Creative prefill
  opening refuses a recommendation whose producing persona id is absent.
- Creative Variations configs remain unshipped. The strict provenance-shape
  change therefore stays at the accepted decode boundary with
  `CreativeVariationsCheckpointNormalization = never`; no compatibility
  normalization or migration arm is added.
- Report-prefill, partial/card regeneration, bound frames, cross-workup history,
  and editor apply remain out of scope.
- Human F5 visual inspection may still validate normal/narrow layout and the
  chip/banner interaction; no fixture-only screenshot is claimed here.

The protected pre-existing `Prose Minion.zip` artifact remains untouched,
unstaged, unmoved, and undeleted.
