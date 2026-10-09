# Show vs. Tell Live-Provider Quality Pass

**Status**: Open
**Priority**: Medium
**Discovered**: Sprint 05 (Show vs. Tell) Slice 6b, 2026-10-09

## Problem

Every Show vs. Tell test runs with mocked transport and fixtures. No live,
billable provider call has checked the generation prompt
(`system-prompts/show-vs-tell/`) or the recommendation prompt against a real
model. Real outputs may break the response contract, or they may produce a
selection that the writer cannot commit. The quality pass should check the two
kinds of limit separately.

**(a) Response-contract checks, enforced by the strict parser.** A model
response is rejected for: a missing or extra group, the wrong variant count,
per-field limits (each variant's prose may run up to 1,200 characters), a
direction that is not shorter than its prose by the encoded margin of 4,
duplicate variants, or a malformed flag. The parser does **not** enforce the
600-character artifact ceiling. Several long variants can be valid.

**(b) Selected-artifact fit, enforced later.** The 600-character limit applies
to the writer's selected artifact body, after keeps and carry modes are chosen.
The meter shows an over-ceiling blocker, and the host refuses the commit. Real
generations are not expected to fit all at once.

The "diagnosis, not verdict" copy in the recommendation prompt is also
unreviewed against real output.

## Related files

- `packages/core/resources/system-prompts/show-vs-tell/` (generation and recommendation prompts)
- `packages/core/src/infrastructure/api/services/widgets/showVsTell/ShowVsTellResponseCodec.ts` (response contract)
- `packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellOneShotCommit.ts` (host 600 re-check)
- `packages/core/src/__tests__/infrastructure/api/services/widgets/showVsTell/ShowVsTellResponseCodec.test.ts` (1,200-character acceptance)
- `packages/core/src/__tests__/application/services/workshop/widgets/showVsTell/ShowVsTellBudgets.test.ts` (585 ≤ 600 fit guarantee)
- `packages/core/src/__tests__/application/services/workshop/widgets/showVsTell/ShowVsTellPromptExample.test.ts`
- [Sprint 05 — Show vs. Tell](../epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md) (Open follow-ups)

## Options

1. A manual pass: run a fixed set of beats (one per continuum position, with and
   without a surrounding passage) through the configured model. For each beat,
   record the response-contract outcome (a), and the artifact-fit outcome (b)
   for a named kept set and its carry modes.
2. Record the results as a dated note in `.memory-bank/`, with a decision on any
   prompt change. Prompt edits go in a separate change.

## Completion criteria

- **(a) Response contract.** Each fixed beat has a recorded parser outcome:
  accepted, or rejected with the reason. Accepted responses show the four-group
  shape, the per-field limits, the direction rule (encoded margin 4), no
  duplicates, and valid flags.
- **(b) Selected-artifact fit.** For each beat, record the tested kept set and
  each variant's carry mode. Check that:
  - an over-budget selection shows the meter's over-ceiling blocker and the host
    refuses the commit;
  - a fitting selection commits. Use the guaranteed case, one kept variant as
    direction-only (pinned by the 585 ≤ 600 fit test), as the fitting example.
- Do not describe the parser as enforcing the 600-character limit, and do not
  require all generated prose to fit at once.
- Any prompt change is a separate commit with the pass results linked.
- The run uses no real manuscript text unless the writer approves it.
