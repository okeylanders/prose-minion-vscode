# The Numbers Lens's Sentence and Dialogue Filters Recompute Per Candidate Span

**Date Identified**: 2026-10-21 (while fixing PR #162 F-01)
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Small (ask `LightboxSpanIndex`, and add a sentence index beside it)

## Problem

The numbers lens checks a reading's quote through `lightboxInstanceFilter`
(`LightboxNumberInstances.ts`). For a word pattern it now asks the shared
`LightboxSpanIndex`, which detects each paragraph once per text and answers
by binary search (PR #162 F-01). Two filters do not:
- **sentence length** calls `proseSentenceSpans(source)`, then scans the
  sentences, each time the verifier offers it a candidate span;
- **dialogue** calls `findDialogueSpans(source)`, then scans the spans, each
  time too.

A candidate is one place the quote's words stand in the paragraph, so the
work is the number of places times the paragraph's length. It is small for
an ordinary quote, and it predates PR #162. It is not on craft steering's
path, which the review measured.

## Recommendation

- Answer the dialogue filter from `lightboxParagraphDialogue` (`holds`, and
  a span count for "no dialogue in the paragraph").
- Give `LightboxSpanIndex` a per-paragraph sentence index (the shared
  `proseSentenceSpans`, with each sentence's word count), keyed the same
  way, and answer "inside one sentence beyond the reference" by binary
  search.
- Pin it with an operation-count test like `LightboxSteeringNoteScale`.

## Related Files

- `packages/core/src/infrastructure/lightbox/LightboxNumberInstances.ts` (`lightboxInstanceFilter`)
- `packages/core/src/infrastructure/lightbox/LightboxSpanIndex.ts`
- [PR #162 review](../../docs/pr-reviews/pr-162-lightbox-being-contractions-review.md)

## Completion Criteria

- A numbers quote checked on a paragraph where its words stand many times
  runs the sentence rule and the dialogue matcher once per paragraph, by a
  counted test, with every answer unchanged.
