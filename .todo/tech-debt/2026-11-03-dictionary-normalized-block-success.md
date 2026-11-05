# A dictionary block that normalization empties still counts as a success

**Date Identified**: 2026-11-03
**Status**: Identified
**Priority**: Low
**Source**: Workshop Wayfinding Slice 6, PR #185 review F-04 (scope note in the author response)

## Problem

`DictionaryService` decides whether a full-entry block succeeded by testing its
raw `result.content.trim()`, before `normalizeBlockContent` runs. A block that
holds text before normalization and none after it counts as a success, and so
does its model:

- **It counts toward `successCount`.** A lookup whose only "successful" blocks
  normalize away is recorded and reported as a success, though the writer sees
  nothing but the host header.
- **It counts toward the history's `modelIds`.** Dictionary lookup history
  (ADR 2026-10-14) records that block's model among the models that answered,
  although none of its text was kept.

Slice 6 (F-04) fixed this for the Workshop turn's model stamp only. The stamp
now reads just the blocks whose normalized text the entry keeps. `successCount`
and the history's `modelIds` were left on the raw rule. Changing them changes
when a lookup is recorded or reported as failed, which is outside that slice.

An example of a block normalization empties: a non-special-focus block whose
only content is a stray `## **Special Focus: …` section.

## Recommendation

Decide success from the normalized content the entry keeps, and use the same
kept-block set for the history's `modelIds`.

Check these consequences:

- whether a lookup whose blocks all normalize away should be recorded in
  history at all, or reported as a failure;
- the history codec's expectations for `modelIds`, which may be non-empty today
  for such lookups.

## Related Files

- `packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts`
  (block assembly, `successCount`)
- `packages/core/src/infrastructure/api/services/dictionary/DictionaryRunModel.ts`
  (the kept-block rule the stamp now uses)
- `packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts`
- `docs/pr-reviews/workshop-wayfinding-slice-6-model-stamps-review.md` (F-04)

## Completion Criteria

- Success, history recording, and history `modelIds` follow the kept,
  normalized blocks.
- A test covers a lookup whose only non-empty blocks normalize away, and one
  where a removed block's model sits beside kept text from another model.
