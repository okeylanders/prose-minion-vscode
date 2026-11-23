# PR #296: Workshop Passage Search persona re-review

- Reviewer: Astra 6.2
- Reviewed head: `d3d0de1767d7655975e55d6482241b2abaae3b5e` (latest code `c17def55cc08a7711db9e46d8e4b7be98d60f246`)
- Base: `epic/passage-search` at `8b441e55e10c5422ee87d9166f8b0763513d1515`
- Verdict: **Hold for two P2 lifecycle issues.**

## Findings

### P2: The previous room's search still blocks the new room

`packages/core/src/application/handlers/domain/workshop/WorkshopPassageSearchHandler.ts:337–355,396–414`. Replacement aborts the old search promptly, but retains it in the handler's busy slot until the async work settles. The new room's pending-card check examines that slot before its revision-aware status. An offline probe held an old re-plan open, replaced room 5 with room 6 using the real room-instance emitter, and restored the same turn ID. The new card was idle yet its Estimate, Run, and Cancel were refused as `search-running`. A manual estimate succeeded after the old plan finally settled. Release the old slot on replacement, make checks revision-aware, and identity-check all old-operation slot clears (including the early exits around lines 222–234) so an old completion cannot erase a new search.

### P2: Closing during a search still allows late publication or delivery

Same file, lines 176–181, 237–265, 396–400. The existing fix correctly rolls back a provisional turn if a delivery is already in flight when the panel closes. Closing earlier, during the search itself, aborts and clears the handler, but the completion checks only the unchanged room revision and card. With the checked-in abort-aware fake, a late stopped result repopulated the disposed holder and emitted state and completion on the old transport. A separate contract double returning a late complete result invoked the directed-run port after disposal. The latter is a port-level observation, not a live provider or native VS Code result. Invalidate the operation on close and guard all post-await effects by live ownership; retain the partial report on ordinary user Stop while the panel is still open.

## What the fixes cover

- Restoring a room and transitioning rooms now price against the current render; stale responses are ignored. Focused React/jsdom tests passed.
- Closing during an already-started provisional delivery rolls back before flush. Verified by tracing the pinned room handler and composition and reading the branch's mocked disposal test.
- Room replacement announces immediately, aborts the old signal, and drops old held results even on a same-ID reopen. An emitter-backed Rewind retains an eligible unchanged card; the real coordinator paths were traced. This does not resolve the previous-room busy slot above.
- Offline checks covered retaining results when no delivery frame fits, declining a fifth run before planning, gating auto-send while a room operation is pending, and separate matched and searched counts. Correction to the previous wording: the shared sidebar report already used matched-file counts correctly; its formatter was unchanged.

## Verification and integration

29 focused offline checks passed: 22 pinned author tests, four independent positive probes, and three characterization probes whose assertions confirm the two undesirable behaviors above. The latter passing is not a fix. No live model or installed VS Code host was exercised. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45070787763) passed.

This is a standalone review. On the combined #295/#296 head, run two planned reads in separate files: one returns a match and one is refused by local context preflight. Verify one provider read and one refusal (no usage or charge for it), correct matched/searched counts, and incomplete coverage in the card, report, saved/reopened receipt, and any delivered context. Decide explicitly whether to require manual Send or automatically send a clearly qualified partial result. Ensure the new required call counters reach the Workshop projections and fixtures; rerun combined CI. No combined-runtime result or merge.
