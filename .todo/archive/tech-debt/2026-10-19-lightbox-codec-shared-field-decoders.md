# Lightbox: one home for the reading codec's field decoders

**Date Identified**: 2026-10-19 (Lightbox Slice 3)
**Reviewed**: 2026-10-23
**Status**: Resolved (Lightbox Slice 4H, 2026-10-23)
**Priority**: Low
**Estimated Effort**: Small (move helpers, re-point imports, no behavior change)

## Resolution

Slice 4H made `LightboxReadingFields.ts` the one home of the field
decoders: `text`, `terms`, `evidence`, `singleQuote`, `listAt`,
`strictObject`, `paragraphNumber`, `claimedFraction`, `decodeItems`,
`oneOf` and the field count. `LightboxReadingCodec.ts` lost its private
copies, and the plot and craft codecs lost theirs (`singleQuote`,
`oneOf`). Every codec reads a field through the one rule, which is what
let the slice change it once: a length or a count is an ask, and one
safety ceiling clips a runaway field. The reasons stay host-owned.

## Problem

Slice 3 decodes the lexical gravity and palette blocks in their own module,
`LightboxGravityCodec.ts`, so `LightboxReadingCodec.ts` gains only an import
and two switch cases. The field decoders both codecs need (bounded text,
term lists, quoted evidence, paragraph numbers, claimed fractions, and the
per-item withholding loop) are private to `LightboxReadingCodec.ts`, so
Slice 3 copied them into `LightboxReadingFields.ts` rather than restructure
the 2B codec while its review fixes were in flight (PR #149, F-05 changes
how a broken item's reason is worded).

Two copies of the same rules can drift: a bound, a reason's wording, or the
F-05 rule that a reason never echoes a model-controlled key could change in
one and not the other.

## Recommendation

Once PR #149's fixes are on `epic/lightbox`, make `LightboxReadingFields.ts`
the only home of these decoders, delete the private copies in
`LightboxReadingCodec.ts`, and import them from both codecs. Keep the
reasons host-owned (no model keys or values in a "broke the format" reason).

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxReadingFields.ts`
- `packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts`
- `packages/core/src/infrastructure/lightbox/LightboxGravityCodec.ts`
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxReadingCodec.test.ts`
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxGravityReadings.test.ts`

## Completion Criteria

- One definition of each field decoder, used by both codecs.
- The existing codec and gravity tests pass unchanged.
