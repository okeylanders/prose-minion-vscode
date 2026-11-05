# LightboxPassages "one long row" is bounded by a clock

**Status:** Open
**Priority:** Low
**Found:** 2026-11-05, during Project Memory Slice 6b's full-suite runs.

## Problem

`packages/core/src/__tests__/infrastructure/lightbox/LightboxPassages.test.ts`,
in the `one long row` block, times a 25,000-instance passage against a 1-second
ceiling (`CEILING_MS`, with `performance.now()`).

- Alone, it passes every time.
- Under a full `npm test` run on a loaded machine, it failed in 2 of 4 runs
  while every other suite passed.
- Slice 6b doesn't touch the Lightbox.

AGENTS.md asks that a test of a scan be bounded by a count, never a clock
(Draft Edit's `withPhraseScanLimit`).

## Completion criteria

- Bound the cut's work by a count of the operations it performs, such as
  segment visits or instance comparisons, instead of elapsed time.
- Keep the literal counts the test already checks.
