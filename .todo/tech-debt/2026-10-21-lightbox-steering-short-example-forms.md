# A Steering Example of One Short Form Cannot Anchor, and Its Reason Misleads

**Date Identified**: 2026-10-21 (PR #160 review, disclosed as a low limitation)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (a reason of its own, or a shorter minimum for the anchor alone)

## Problem

A craft-steering note's example anchors its `before` in the note's checked
quote through the quote verifier, which refuses any quote with fewer than
`LIGHTBOX_QUOTE_MINIMUM_LETTERS` (4) letters. A `before` that is just the
instance, such as "was", "are", "am" or "be", is therefore withheld.

That outcome is conservative: an example of one form is a weak
illustration anyway. The reason shown is not accurate, though. The board
says "Its example's first part is not a run of whole words of its checked
quote holding the instance", when the words are a whole, in-span instance
that is simply too short to check.

## Recommendation

Keep the verifier's minimum as it is everywhere else. Then either:
- give the anchor a reason of its own for a `before` under the minimum
  ("too short to place: give a few words around the instance"); or
- teach `58-steering.md` that an example's first part is at least a few
  words, and pin it in the prompt-budget sync test.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxSteeringTiles.ts` (`anchorLightboxSteeringExample`)
- `packages/core/src/infrastructure/lightbox/LightboxSteeringCodec.ts` (`LIGHTBOX_STEERING_EXAMPLE_REASONS`)
- `packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts` (`LIGHTBOX_QUOTE_MINIMUM_LETTERS`)
- `packages/core/resources/system-prompts/lightbox/58-steering.md`
- [PR #160 review](../../docs/pr-reviews/pr-160-lightbox-craft-steering-review.md)

## Completion Criteria

- A `before` of one short form is withheld with a reason that says it is too
  short, by a literal test, or the prompt asks for more and a sync test pins
  it.
