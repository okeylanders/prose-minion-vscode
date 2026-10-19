# Dialogue % Misses Curly Quotes

**Date Identified**: 2026-10-19 (Lightbox Slice 0 research)
**Reviewed**: 2026-10-19
**Status**: Identified. Prerequisite of [Lightbox Slice 2A](../epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md)
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
