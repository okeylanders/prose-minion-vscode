# Craft Steering's Counts Do Not Open the Inspector's Sentence Well

**Date Identified**: 2026-10-21 (merging Slice 4E into Slice 4F)
**Status**: Identified (a follow-up, deliberately not built in 4F)
**Priority**: Low
**Estimated Effort**: Small to Medium (one passage term kind, one finder, its count-agreement test)

## Problem

Slice 4E's inspector lists the sentences a counted item stands in (a
passage well, `LIGHTBOX_REQUEST_PASSAGE`), each instance found by the rule
that made its count. Its terms are words, parts of speech, phrases, hapax
words and four style flags. A pinned craft-steering row (a figure, or one
construction of it) lights its paragraphs, but it opens no well, so the
writer cannot read the sentences that hold, for example, the
intensifiers before a generic word.

## Recommendation

Add a passage term `{ kind: 'steering', stat, construction? }`.
- Find its instances with the figure's own detector
  (`LIGHTBOX_NUMBER_PATTERNS`), and the construction with the measure's
  classifier (`LightboxSteeringMeasure`), so the well's count equals the
  row's.
- Pin that count with a test in the style of 4E's
  `LightboxCountAgreement`.
- Keep it measured only: no reading's words enter the well.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxInstances.ts`, `LightboxPassages.ts`
- `packages/core/src/shared/types/messages/lightboxPassages.ts`
- `packages/core/src/infrastructure/lightbox/LightboxSteeringMeasure.ts`
- `packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxSteering.ts`

## Completion Criteria

- A pinned steering row opens a sentence well whose instance count equals
  the row's, for each figure and construction, by a literal test.
