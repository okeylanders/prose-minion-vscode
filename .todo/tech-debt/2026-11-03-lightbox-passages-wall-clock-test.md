# The Lightbox passage linear-time tests are bounded by a wall clock

**Date Identified**: 2026-11-03
**Status**: Identified
**Priority**: Low
**Source**: CI on Workshop Wayfinding PR #186 (`71c1541`, [job log](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41737090370/job/126268955772)); see the [PR comment](https://github.com/okeylanders/prose-minion-vscode/pull/186#issuecomment-6617969791)

## Problem

Two tests in the `one long row` block of
`packages/core/src/__tests__/infrastructure/lightbox/LightboxPassages.test.ts`
check that cutting a passage is linear. They do it by timing it:

- **The ceiling.** They time `buildLightboxPassage` with `performance.now()`
  and assert under `CEILING_MS = 1_000`. That's 25,000 instances, and one
  phrase across 25,000 sentences.
- **The CI failure.** On 2026-11-03 the phrase case went over the ceiling on
  a loaded GitHub runner, for a PR that touches no Lightbox code. The same
  source passed on two other runs.
- **The convention.** `AGENTS.md` asks for the opposite: "A test of a scan
  bounds it by its search count (`withPhraseScanLimit`), never a clock", and
  the steering measure's tests count the tagger's token reads.

The test's own comment calls one second "a coarse ceiling" over roughly a
tenth of a second of work, so a slow or shared runner can cross it. When it
does, every PR in flight goes red.

## Recommendation

Count the work instead of timing it:

1. Expose a counter seam for the passage builder's segment and instance work,
   the way `withPhraseScanLimit` and the tagger read counter do.
2. Assert that the count grows linearly. For example, build at 12,500 and at
   25,000 instances and check that the count about doubles, or check it
   against a fixed multiple of the instances.
3. Drop the clock assertion, or keep it only as a very generous backstop
   (10 s or more) that no runner reaches.

Keep the PR #159 N-01 regression it guards. The quadratic cut must still fail
the new count bound.

## Related Files

- `packages/core/src/__tests__/infrastructure/lightbox/LightboxPassages.test.ts` (`one long row`)
- `packages/core/src/infrastructure/lightbox/` (the passage builder, `buildLightboxPassage`)
- `.todo/epics/epic-lightbox-2026-10-19/slice-4e-inspector-aids.md` (PR #159 N-01)

## Completion Criteria

- The `one long row` tests bound the passage builder's work by a count, not
  a 1 s clock.
- Reverting the PR #159 N-01 fix, back to the quadratic cut, fails the new
  bound.
