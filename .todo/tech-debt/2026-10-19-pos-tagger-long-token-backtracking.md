# A Long Unbroken Run of Word Characters Stalls Word Frequency for Minutes

**Date Identified**: 2026-10-19 (PR #149, while testing F-10)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: Small to medium (bound the tagger's input, then measure)

## Problem

Word frequency tags parts of speech with the offline `wink-pos-tagger`
(2.2.2), which tokenizes with `wink-tokenizer` (5.3.0). That tokenizer's
e-mail pattern (`rgxEmail`, `wink-tokenizer/src/wink-tokenizer.js:47`) is
tried at every position and backtracks across a whole run of word
characters looking for an `@`. On text with a long unbroken run of ASCII
word characters the cost grows with the square of the run:

| Unspaced Latin run | `WordFrequencyService.analyze` |
|---|---|
| 20,000 characters | about 2 s, nearly all in that pattern (profiled) |
| 40,000 characters | about 7 s |
| 162,014 characters | about 2 minutes (building a Lightbox board) |

The work is synchronous, so the extension host does nothing else meanwhile.
The Lightbox builds its counted board with this service, and the Metrics
tool's word frequency runs it too. Prose rarely holds such a run, but a
pasted base64 image (a `data:` URI in a Markdown chapter) does: every
base64 character is in the pattern's class. The Lightbox accepts such a
source, because it counts few words. CJK text is not affected: its characters are
not ASCII word characters, so the pattern fails at once.

## Recommendation

- Keep pathological runs away from the tagger: split, or skip, any token
  run longer than a bound (a few hundred characters is far beyond any
  word) before `tagSentence`, and count such a run as no part of speech.
- Or tag in bounded chunks cut at whitespace, which also caps the cost of
  one call.
- Measure the fix on the sizes above and on an ordinary 50,000-word
  chapter, which must not slow down.

## Related Files

- `packages/core/src/tools/measure/wordFrequency/index.ts`
  (`tagPartsOfSpeech`, where the tagger is called)
- `packages/core/src/infrastructure/api/services/measurement/WordFrequencyService.ts`
- `packages/core/src/infrastructure/lightbox/LightboxService.ts` (`assemble`,
  where a board is measured)
- `node_modules/wink-tokenizer/src/wink-tokenizer.js` (the pattern; not ours
  to change)
- `packages/core/src/__tests__/application/handlers/domain/LightboxLongParagraph.test.ts`
  (why its unspaced Latin control runs below the board)

## Completion Criteria

- Word frequency over a 162,014-character unspaced Latin paragraph finishes
  in well under a second, and so does building a Lightbox board over it.
- Ordinary prose tags exactly as before: the existing word-frequency and
  part-of-speech tests pass unchanged.
- A regression test pins the bound with a long run of word characters.
