# Craft Steering's Construction Breakdown Is a Next-Word Heuristic

**Date Identified**: 2026-10-21 (Lightbox Slice 4F)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Medium (a better rule per figure, then re-measure the fixtures)

## Problem

`LightboxSteeringMeasure` sorts each instance into a construction from the
word-frequency tool's part-of-speech tags of the words beside it. The rules
are stated in the module and their false positives are pinned by tests,
but a writer reads the breakdown as fact, and some calls are wrong in
predictable ways:

- **Adjectival participles** ("she was tired") are tagged as participles,
  so they count as *be + past participle*, beside true passives.
- **Referential *it*** ("The key? It was gold.") counts as *there or it +
  be*, beside expletive *it*.
- **Dialogue tags** are found only when *said*, *says*, *asked* or *asks*
  stands next to the adverb; "said Alice softly" falls to *other*.
- **Any -ly word** is an "adverb" (the numbers' detector): "lovely",
  "family" and "likely" as an adjective count, most as *other*.

The totals are exact (the numbers' own detector); only the split is a
heuristic.

## Recommendation

Measure first: on two or three public-domain chapters, hand-label a sample
of instances and record each construction's precision. Then improve the
weakest rule, for example a small list of common adjectival participles
(tired, pleased, surprised) read as *be + adjective*, or a tag window of two
words for dialogue tags. Keep each rule named and tested, as now.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxSteeringMeasure.ts`
- `packages/core/src/tools/measure/wordFrequency/index.ts` (`tagTextTokens`)
- `packages/core/src/__tests__/infrastructure/lightbox/LightboxSteeringMeasure.test.ts`
- [Slice 4F](../epics/epic-lightbox-2026-10-19/slice-4f-craft-steering.md)

## Completion Criteria

- A recorded precision per construction on labelled public-domain text.
- Any rule change pinned by literal tests, with the Alice fixture's
  breakdown updated.
