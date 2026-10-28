# The Opinion's Citation Basis Hashes the Digest's Wording

**Date Identified**: 2026-10-21 (Lightbox Slice 4D)
**Status**: Resolved in Lightbox Slice 5A, 2026-10-22 (`epic/lightbox-slice-5a-saved-boards`), as its first step: a canonical data basis (epic decision 25), with the rule's id recorded on every board as `rules.opinionBasis`
**Priority**: Was Medium; resolved
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
- [Slice 4D](../../epics/epic-lightbox-2026-10-19/slice-4d-opinion.md) and
  [Slice 5](../../epics/epic-lightbox-2026-10-19/slice-5-saved-boards-and-compare.md)

## Completion Criteria

- Slice 5's board format says what an Opinion's basis is and how a saved
  one is judged on load.
- A test rewords one digest line and shows that an Opinion read before
  either stays current (data basis) or reads as an earlier digest format
  (versioned basis), never as "something it cites changed".

## Resolution (2026-10-22, Lightbox Slice 5A)

The first option, as the writer chose (epic decision 25).

- **The basis is the item's data.** `shared/constants/lightboxOpinionBasis.ts`
  builds each item's canonical data: its key and kind, its lens, title and
  claim, the quotes it may be cited by with their ¶ addresses and notes,
  its counted terms with counts and paragraphs, its kind's own fields (a
  number usage's figure, a template's engagement by movement numeral, a
  steering reading's counts), and every measured figure. The basis is the
  hash of that data written as JSON with sorted keys. `lightboxOpinionItems`
  passes each item's data in; the digest's lines are words only.
- **What stays out is what the digest never showed**, as before: a tile's
  friction, withheld quotes, a quote's match kind, quotes and terms past
  the digest's bounds, tension scores, a swatch's colour, a note's nudge and
  example, and a measured row's own words (label, unit, instance label).
- **Versioned.** `LIGHTBOX_OPINION_BASIS_RULE_ID` (`item-data-2026-10-22`)
  is recorded on every board as `rules.opinionBasis`, so a saved board says
  which basis its citations were read under; a new rule is a new id, pinned
  by the measurement-rule guard.
- **Standing is unchanged**: stale when a cited item is gone, not current,
  or its basis differs.

**Proof** (`LightboxOpinionBasis.test.ts`): every label the digest prints
(each tile kind's and lens's label, the numbers' usage, tier and familiar
labels, the steering count lines, and each measured row's own words)
reloaded with new words changes all ten cited items' text and no basis, and
the Opinion stands. That test fails at `3e6a156` (78 bases moved). Each
canonical field (key, kind, lens, title, claim, a quote's text, ¶ and note,
a term's count and paragraphs, tier counts, mentions, a thread's span, a
familiar kind, a movement's range, a standout's value and instances) makes
the citing observations stale, by id. A sweep over every leaf of every item
on a board holding every reading kind (1,323 tile leaves, 807 of them moving
the digest; 57 measured changes) finds no change that moves the digest and
not the basis.
