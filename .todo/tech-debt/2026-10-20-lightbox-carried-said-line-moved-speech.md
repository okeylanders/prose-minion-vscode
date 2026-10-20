# A Carried Said Line Does Not Follow Speech That Moved Past Narration

**Date Identified**: 2026-10-20 (PR #151 re-review, noted beside F-07)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one carry rule, parity tests)

## Problem

When a reading is carried onto a changed chapter, a quote whose paragraph
no longer holds its words follows them to the nearest paragraph that does
(`recheckQuote` in `LightboxStaleReadings`). A subtext pair's said line is
found again with the dialogue filter (`verifySaid`), but only within the
paragraph it named. The plain match there wins over speech in another
paragraph:

- read `"I don't know," she said.` in ¶1, with the said line `I don't know`;
- edit ¶1 to `I don't know was written all over her face.` and move the
  speech to ¶2: `“I don’t know,” she said.`;
- carried, the pair is withheld: its said line "no longer stands inside
  quoted dialogue", though the speech is still in the chapter, one
  paragraph on.

This was reproduced before the PR #151 fixes (`132aabb`) and after them, so
it is not a regression. A fresh read that names ¶1 withholds the same pair,
so fresh/carry parity holds. Nothing wrong is shown: the pair is withheld
with a true reason, and a re-read of the lens draws it from the new text.

## Recommendation

When the named paragraph holds only narration, let the said line's recheck
look for speech in the nearest paragraph too, with the same dialogue filter,
before falling back to the narration. Decide first whether a fresh read
should do the same; if it should not, keep carry as it is, since the two
must agree (PR #150 F-05).

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxStaleReadings.ts` (`recheckQuote`, `carryTile`)
- `packages/core/src/infrastructure/lightbox/LightboxDialogueAnchor.ts` (`verifySaid`)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxCarryParity.test.ts`

## Completion Criteria

- The case above has a decided outcome, carried and fresh alike, with a
  parity test.
