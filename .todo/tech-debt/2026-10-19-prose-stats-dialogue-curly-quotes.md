# Dialogue % Misses Curly Quotes

**Date Identified**: 2026-10-19 (Lightbox Slice 0 research)
**Reviewed**: 2026-10-19
**Status**: Resolved on `epic/lightbox-prereq-dialogue-quotes` (PR pending). Prerequisite of [Lightbox Slice 2A](../epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md)
**Priority**: High (wrong numbers on the Metrics tab today)
**Estimated Effort**: Small (one matcher, tests)

## Problem

`PassageProseStats.calculateDialoguePercentage` counts words inside
`/"[^"]*"/g`, so only straight double quotes are matched. Most manuscripts
written in Word, Scrivener, Google Docs or with smart-quote editors use curly
quotes (`“…”`), so their dialogue reads as **0%**. That misleads the Metrics
tab and the publishing-standards comparison, where Dialogue % is one of the
compared metrics.

Lightbox makes the error visible side by side. Its per-paragraph dialogue lane
uses a matcher that handles both quote styles, so the headline figure would
disagree with the lane on any curly-quoted chapter.

## Related files

- `packages/core/src/tools/measure/passageProseStats/index.ts`
  (`calculateDialoguePercentage`, around line 106)
- `packages/core/src/__tests__/tools/measure/passageProseStats/index.test.ts`
- `packages/core/src/application/services/StandardsComparisonService.ts`
  (consumes `dialoguePercentage`)

## Fix

Match `"…"`, `“…”` and, where the text uses them for dialogue, `‘…’`. Do not
treat apostrophes as quote openers. Share one quote matcher between
`PassageProseStats` and Lightbox's paragraph model so the two cannot drift.
Add tests for straight, curly, mixed, nested and unbalanced quotes.

Related heuristic, not part of this fix: `readabilityScore` is
`100 − 2 × words/sentence`, not Flesch Reading Ease. It is labeled
"readability", which is fair, but a future pass could compute real Flesch from
the syllable heuristic `readabilityGrade` already uses.

## Completion criteria

- A curly-quoted dialogue fixture reports a nonzero dialogue %.
- Lightbox's paragraph model and `PassageProseStats` use the same matcher.
- The Metrics tab output for straight-quoted text is unchanged.

## Resolution

- **One matcher:** `packages/core/src/utils/dialogueSpans.ts`, imported as
  `@/utils/dialogueSpans`. `findDialogueSpans(text)` returns ordered,
  non-overlapping spans as offsets (`start`, `end`, `closed`).
  `countDialogueWords(text)` counts the whitespace tokens inside them.
  `PassageProseStats.calculateDialoguePercentage` now divides
  `countDialogueWords` by the total word count, with the same rounding.
  Lightbox's paragraph model should call the same two functions.
- **Supported:** straight `"…"` and curly `“…”` double quotes, mixed in one
  text and within one quotation (`“Hello," she said`). Straight quotes pair in
  sequence as before. Curly quotes pair by direction, so a `”` with nothing
  open is ignored. A single-quoted passage nested in double-quoted dialogue is
  part of the outer span.
- **Unbalanced quotes stay local:** no span crosses a paragraph break (the
  `/\n\s*\n/` rule `countParagraphs` uses). A quote still open at its
  paragraph's end runs to that end, which is also how multi-paragraph speech
  is punctuated. Per-paragraph counts therefore sum to the whole-text count.
  An opener inside an open span is text, so curly-in-curly nesting closes at
  the first `”`.
- **Straight-quoted output is unchanged** wherever each paragraph's quotes
  are balanced. Tests check this against the former `/"[^"]*"/g` computation.
  Where a paragraph has an odd number of straight quotes, the count changes
  on purpose: the old regex paired the extra quote across the paragraph break
  and shifted every later pair, while the new matcher stops it at the
  paragraph's end.
- **Deliberately not supported:** single-quoted dialogue (`‘…’`, and straight
  `'…'`). `‘` and `’` are also apostrophes. Smart-quote editors write
  elisions such as `‘cause` and `‘em` with an opening `‘`, and plural
  possessives (`the boys’`) end in `’` followed by a space. No
  character-level rule separates these from speech, so UK-style
  single-quoted manuscripts still report a low dialogue %. This is tracked
  in [2026-10-19-dialogue-single-quote-convention.md](2026-10-19-dialogue-single-quote-convention.md).
  Guillemets and low-9 quotes (`« » „`) are not matched either.
- **Tests:** `packages/core/src/__tests__/utils/dialogueSpans.test.ts` and the
  Dialogue Percentage cases in
  `packages/core/src/__tests__/tools/measure/passageProseStats/index.test.ts`.
  The Metrics legend now reads "% of tokens inside double quotes, straight or
  curly".
