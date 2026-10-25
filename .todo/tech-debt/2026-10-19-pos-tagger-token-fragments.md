# Part-of-Speech Lists Count Contraction Fragments

**Date Identified**: 2026-10-19 (Lightbox Slice 2A)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (a token filter in the word-frequency tool, tests)

## Problem

`WordFrequency.analyze` tags the text with `wink-pos-tagger` and keeps each
token after stripping everything but `a–z` and `'`. The tagger splits
contractions, so with curly apostrophes "Dinah’ll" and "Alice’s" leave the
fragments `ll` and `s`, which are then counted as nouns. On Chapter I of
"Alice's Adventures in Wonderland" (public domain), the top nouns include
`ll` ×9 and `s` ×8.

The Metrics tab's word-frequency report and the Lightbox's parts-of-speech
tile both show these fragments. The tagger also splits hyphenated words
("rabbit-hole" is a "rabbit" and a "hole"), so its counts differ from the Top
Words list, which keeps "rabbit-hole" whole. Since PR #148 F-03 the Lightbox
counts and places every tagged word, fragments included, from the tagger's
own occurrence stream (`tagPartsOfSpeech`), so each item's paragraphs agree
with its count and with the Metrics tab.

## Recommendation

Drop contraction suffix tokens (`’ll`, `’s`, `n’t`, `’re`, `’ve`, `’d`, `’m`,
straight or curly) before counting tagged words, and fold curly apostrophes to
straight ones before tagging so contractions tag consistently. Do it in
`tagPartsOfSpeech`, the one stream both the Metrics counts and the Lightbox's
placement read, and keep any folding length-preserving (or map offsets back),
since the Lightbox locates each occurrence by its offset. Note in the tool's
docs that tagged counts split hyphenated words.

## Related Files

- `packages/core/src/tools/measure/wordFrequency/index.ts`
- `packages/core/src/infrastructure/lightbox/LightboxMeasures.ts`
- `packages/core/src/__tests__/tools/measure/wordFrequency/`

## Completion Criteria

- No part-of-speech list contains a contraction fragment.
- A test covers straight and curly contractions.
