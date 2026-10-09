# Show vs. Tell Live-Provider Quality Pass

**Status**: Open
**Priority**: Medium
**Discovered**: Sprint 05 (Show vs. Tell) Slice 6b, 2026-10-09

## Problem

Every Show vs. Tell test runs with mocked transport and fixtures. No live,
billable provider call has checked the generation prompt
(`system-prompts/show-vs-tell/`) or the recommendation prompt against a real
model. Real outputs may fail the four-group shape, drift past the 600-character
artifact ceiling, or give a direction that is not shorter than its prose. The
strict parser would reject those outputs, but the writer's experience would
degrade. The "diagnosis, not verdict" copy in the recommendation prompt is
also unreviewed against real output.

## Related files

- `packages/core/resources/system-prompts/show-vs-tell/` (generation and recommendation prompts)
- `packages/core/src/infrastructure/api/services/widgets/showVsTell/` (response codec)
- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellPromptExample.test.ts`
- [Sprint 05 — Show vs. Tell](../epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md) (Open follow-ups)

## Options

1. A manual pass: run a fixed set of beats (one per continuum position, with and
   without a surrounding passage) through the configured model, and record
   parser acceptance, ceiling fit, and the writer-facing readability of each
   variant and recommendation.
2. Record the results as a dated note in `.memory-bank/`, with a decision on any
   prompt change. Prompt edits go in a separate change.

## Completion criteria

- Each fixed beat has a recorded outcome: parser accepted or rejected, artifact
  within 600 characters, every direction shorter than its prose.
- Any prompt change is a separate commit with the pass results linked.
- The run uses no real manuscript text unless the writer approves it.
