# The Word-Pattern Figures Miss a Form Wrapped in Underscore Emphasis

**Date Identified**: 2026-10-21 (Lightbox Slice 4F, the being-verbs investigation)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (one shared boundary rule, then re-measure)

## Problem

The detectors behind three of the numbers' figures, and behind every craft
steering quote check, match whole words with a regex word boundary:
`findBeingVerbs` (`\b(?:am|is|…)\b`), `findAdverbs` and `findFillerWords`.
An underscore is a word character to that boundary, so a form wrapped in
Markdown underscore emphasis is not counted: `_was_`, `_slowly_` and
`_very_` count nothing. Asterisk emphasis (`*was*`) is counted.

The rate, craft steering's total and the quote check all run the same
detector, so they agree and nothing is withheld wrongly
(`LightboxBeingVerbsAgreement.test.ts` pins the underscore case at 0 in all
three). The figure is simply low for a writer who emphasises with
underscores, and a reading that quotes such a form is withheld as holding no
instance. The steering task tells the model so ("a form joined to an
underscore (_was_) … are not instances").

## Recommendation

Give the word-pattern detectors one shared boundary that treats `_` as
punctuation (letters and apostrophes only), as the steering example anchor
already does. That changes the numbers rows and the writer's averages, so
re-measure the worked examples (none uses underscores today) and the
writer-average fixtures, and update the agreement test's expectation from 0
to 1 for `She _was_ there.`

## Related Files

- `packages/core/src/tools/measure/beingVerbs/index.ts`
- `packages/core/src/tools/measure/styleFlags/index.ts` (`findAdverbs`, `findFillerWords`)
- `packages/core/src/infrastructure/lightbox/LightboxNumbers.ts` (`LIGHTBOX_NUMBER_PATTERNS`)
- `packages/core/src/infrastructure/lightbox/LightboxNumberInstances.ts` (`lightboxPatternInstancePhrase`)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxBeingVerbsAgreement.test.ts`

## Completion Criteria

- `_was_`, `_slowly_` and `_very_` are counted by the rate, the steering
  total and the quote check alike, with literal tests.
- The task's instance phrase no longer excludes underscore forms.
