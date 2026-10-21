# The Opinion's Citation Basis Hashes the Digest's Wording

**Date Identified**: 2026-10-21 (Lightbox Slice 4D)
**Status**: Decided (2026-10-21, epic decision 25): a canonical data basis with an explicit basis/format version on saved boards; scheduled as Slice 5's first step, after Slices 4E and 4F merge
**Priority**: Medium (decide before Slice 5 saves boards)
**Estimated Effort**: Small to medium (hash item data, or version the basis)

## Problem

Each Opinion citation records the `basis` of the item it cites:
`lightboxOpinionHash` (cyrb53) of the item's digest block, as
`lightboxOpinionItemText` renders it. That covers the label, the host-word
lines and the numbered quotes. The Opinion's standing
(`lightboxOpinionStanding`) compares each cited item's basis now with the
one it was read with. That is how a cited figure measured again, or a cited
tile read again, makes the Opinion stale, in the webview and the host
alike.

The basis is a hash of **rendered host words**, not of the item's data. Any
change to how the digest words an item makes every Opinion read before
the change stale, though nothing on the board changed:
- a label;
- "per 100 words";
- a kind's line format;
- the paragraph-list cap.

Today boards live in memory for a session, so the effect is a stale note
after an upgrade at most. Slice 5 saves boards to `prose-minion/boards/` with
their own `formatVersion`. A saved Opinion opened after a wording change
would read stale for no reason the writer can see.

## Recommendation

Decide before Slice 5's format is fixed. Either:
- hash a canonical form of the item's **data** (its key, kind, values and
  quote spans) instead of its rendering, so rewording the digest keeps old
  Opinions current; or
- keep hashing the rendering, version it (`basisVersion` beside the saved
  Opinion), and treat a saved Opinion of another basis version as "read
  under an earlier digest format" in its standing note, distinct from
  "something it cites changed".

The first is simpler to reason about. The second keeps the guarantee that
the Opinion read exactly the words the basis names.

## Related Files

- `packages/core/src/shared/constants/lightboxOpinionItems.ts`
  (`lightboxOpinionItemText`, `lightboxOpinionHash`, the per-kind lines)
- `packages/core/src/shared/constants/lightboxOpinion.ts`
  (`lightboxOpinionStanding`)
- `packages/core/src/infrastructure/lightbox/LightboxOpinionGates.ts`
  (each cite keeps the basis it was read with, fresh and carried)
- [Slice 4D](../epics/epic-lightbox-2026-10-19/slice-4d-opinion.md) and
  [Slice 5](../epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md)

## Completion Criteria

- Slice 5's board format says what an Opinion's basis is and how a saved
  one is judged on load.
- A test rewords one digest line and shows that an Opinion read before
  either stays current (data basis) or reads as an earlier digest format
  (versioned basis), never as "something it cites changed".
