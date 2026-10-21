# The Opinion's Digest Leaves Readings Out in Board Order

**Date Identified**: 2026-10-21 (Lightbox Slice 4D)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (a per-lens share of the bound, with a test)

## Problem

Group F, the Opinion, reads the board's checked digest
(`LightboxOpinionDigest`), bounded by
`PROMPT_BUDGETS.lightbox.opinionDigestTokens` (9,000 estimated tokens). The
measured figures always go in. Readings then go in **in board order**, group
A first, until the next one would pass the bound. The rest are left out, and
the digest's closing note counts them by lens ("Left out to keep the digest
within its bound: 7 readings, from Pressure, Artifacts, Summary &
movements.").

So on a board too large for the bound, the Opinion loses the last groups
first, which are the story lenses of group E. It never sees the movements
or threads, while it sees every motif. The Opinion says so in its own
digest, and the model is told what was left out, so nothing is hidden. It
is still a lopsided cut.

On the worked example's board (eight paragraphs, eight lenses), the digest
is about 3,000 tokens. With every lens on the same excerpt it stays under
the bound. Only a long chapter with many tiles reaches it. Tiles are bounded
per lens (`PROMPT_BUDGETS.lightbox`), so the worst case is finite but
larger than 9,000 tokens.

## Recommendation

Give each lens with current readings a share of the bound before any lens
takes a second item. One simple way is round-robin across lenses in rail
order, taking each lens's next tile until the bound is reached. Keep the
closing note, which already names what was left out by lens.

Measure first: when Slice 6 measures typical output on real chapters,
record how often a real board passes the bound at all.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxOpinionDigest.ts`
  (`buildLightboxOpinionDigest`: the board-order fill and the fit loop)
- `packages/core/src/shared/constants/promptBudgets.ts`
  (`opinionDigestTokens`, `opinionQuotesPerItem`)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxOpinionDigest.test.ts`
  (the bound sweep that pins the board-order prefix today)
- [Slice 4D](../epics/epic-lightbox-2026-10-19/slice-4d-opinion.md)

## Completion Criteria

- A digest over the bound keeps at least one current reading of every lens
  that has one, when the bound allows a reading each, pinned by a test on a
  board built to pass the bound.
- The closing note still names every reading left out, by lens.
