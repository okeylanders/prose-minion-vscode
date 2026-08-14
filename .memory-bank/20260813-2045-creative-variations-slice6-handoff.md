# Creative Variations Slice 6 implementation handoff

**Recorded**: 2026-08-13 20:45 CDT
**Branch**: `sprint/conversation-widgets-03-creative-variations`
**Starting / required ancestor**: `41f5b717` (`docs: align Creative Variations runway with live availability`)
**Current gate**: Slice 6 implemented and ready for review — not complete
**Publication**: uncommitted and unpushed
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
   refuses recommendations on non-persona turns. `WorkshopSessionRecords`
   defensively clones nested source references.
5. `useWorkshopWidgetOpening` correlates the exact recommendation and persona,
   refuses to replace an already-open Creative sheet, and hands the seed to the
   transport-free authoring controller.
6. `useCreativeVariationsAuthoring` mints `persona-prefill` provenance, seeds
   exact inputs, defaults only omitted distance/count values, and initializes no
   workup, selections, accepted risks, or note. Editing the subject changes its
   origin to `pasted`.
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
carry modes, accepted risk ids, a writer note, or any committed identity. The
controller, not the persona, assigns display-safe prefill provenance. If the
writer commits without editing the subject, that provenance survives exact
reopen; if the writer edits it, the origin becomes `pasted`.

## Principal production changes

- Added `CreativeVariationsRecommendation.ts` as the feature-owned prompt/parser
  entry and registered it in `WorkshopWidgetRecommendationOperations.ts`.
- Added exact recommendation-seed and `persona-prefill` contracts plus bounded
  checkpoint validation and defensive cloning.
- Extended run completion/source validation and reserved prompt-delimiter
  neutralization for the Creative frame.
- Extended widget opening, authoring, modal attribution, generic turn-chip
  rendering, and the Widgets-browser Host-prefill request.
- Added the Creative frame allowance to the centralized prompt budget and made
  the family frame ceiling the maximum of its named entries.

## Verification receipt

- Staged focused gates: **10 suites / 192 tests**, **7 suites / 153 tests**, and
  **3 suites / 36 tests** passed.
- Full Jest: **208 suites, 2,282 tests, 2 snapshots passed** in 72.721 seconds.
- `npm run typecheck`: core, webview, and extension configurations passed.
- `npm run lint`: **0 errors, 956 warnings** (repository baseline; no bulk fixes).
- `npm run build`: resource staging, both production webpack bundles, and bundle
  sentinel passed. Webpack retained its 3 advisory webview-size warnings.
- `git diff --check`: passed after the final implementation and evidence update.

The tests cover prompt authority, exact/blank/boundary parsing, malformed
markers, source availability, production-catalog dispatch, tool-turn refusal,
persistence shape, defensive correlation to the exact persona turn, opening
overwrite refusal, input-only draft creation, provenance edits/reopen, mounted
chip-to-prefill behavior, and absence of automatic generate/commit messages.

## Review boundary and remaining work

- Stop here for Slice 6 review. Do not commit or push without explicit
  publication authorization.
- Slice 7 owns the final architecture witnesses, production-policy route matrix,
  current-state documentation, and final sprint closeout.
- Report-prefill, partial/card regeneration, bound frames, cross-workup history,
  and editor apply remain out of scope.
- Human F5 visual inspection may still validate normal/narrow layout and the
  chip/banner interaction; no fixture-only screenshot is claimed here.

Protected pre-existing untracked artifacts were not touched, staged, moved, or
deleted: `.todo/tech-debt/2026-08-13-fresh-host-time-frame-dropped.md`,
`Prose Minion.zip`, and `docs/architecture/2026-08-13-workshop-prompt-assembly/`.
