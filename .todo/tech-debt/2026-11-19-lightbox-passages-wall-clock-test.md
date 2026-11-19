# The Lightbox passage linear-time tests still fail CI by the clock

**Date Identified**: 2026-11-19
**Status**: Identified
**Priority**: Medium (raised from Low: it now fails CI for unrelated PRs)
**Estimated Effort**: Small
**Source**: [Workshop Persona Tools](../epics/epic-workshop-persona-tools-2026-11-19/README.md), CI on PR #286 (`1e024cdb`, docs only) and PR #289 (`5a4b81f5`)
**Supersedes**: [2026-11-03](2026-11-03-lightbox-passages-wall-clock-test.md) and [2026-11-05](2026-11-05-lightbox-passages-clock-ceiling.md), the same test, filed at Low. Close all three together.

## Problem

`packages/core/src/__tests__/infrastructure/lightbox/LightboxPassages.test.ts`,
block `one long row`, times two passage cuts with `performance.now()` and
asserts each is under `CEILING_MS` (1,000 ms):

- "cuts one sentence holding 25,000 instances in linear time, and lights
  every one" (`word.ms`, `phrase.ms`, `paragraph.ms < CEILING_MS`);
- "joins the 25,000 sentences one phrase runs across into one row in
  linear time" (`phrase.ms < CEILING_MS`).

On 2026-11-19 the second one failed the `verify` job twice, on PRs that
touch no Lightbox code:

- PR #286's docs-only head `1e024cdb` (a 530 s run); it passed on re-run;
- PR #289's head `5a4b81f5`; it passed on re-run.

It also failed in local full runs of #287 at `--maxWorkers=50%` under
memory pressure, and passed 19/19 alone. Each failure needs a manual
re-run from the Actions tab, since the session's integration cannot
re-run jobs (403).

`AGENTS.md` already says the opposite: "A test of a scan bounds it by its
search count (`withPhraseScanLimit`), never a clock", and the steering
measure's tests count the tagger's token reads.

## Recommendation

Bound the cut by counted work, the way the steering tests count tagger
reads:

1. Give the passage builder (`buildLightboxPassage`, under
   `packages/core/src/infrastructure/lightbox/`) a counter seam for its
   segment visits and instance comparisons, as `withPhraseScanLimit` does
   for phrase scans.
2. Assert the count against a fixed multiple of the instances, or that it
   about doubles from 12,500 to 25,000 instances.
3. Drop the clock assertion, or keep it only as a backstop of 10 s or more.

The PR #159 N-01 regression it guards must still fail: reverting to the
quadratic cut must break the new count bound.

## Related Files

- `packages/core/src/__tests__/infrastructure/lightbox/LightboxPassages.test.ts` (`one long row`)
- `packages/core/src/infrastructure/lightbox/` (the passage builder)
- `.todo/epics/epic-lightbox-2026-10-19/slice-4e-inspector-aids.md` (PR #159 N-01)

## Completion Criteria

- Neither `one long row` test reads a clock below a 10 s backstop; each
  bounds the builder's work by a count.
- Reverting the PR #159 N-01 fix to the quadratic cut fails the count.
- The 2026-11-03 and 2026-11-05 notes are archived with this one.
