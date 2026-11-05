# PR #214 review: Workshop Bookmark Recall specification

**Disposition: four P2 planning corrections requested before implementation.** This is a review of the proposed architecture and slice contracts, not a claim that the unimplemented feature currently fails, a formal GitHub approval, or authorization to merge.

- **PR:** [#214](https://github.com/okeylanders/prose-minion-vscode/pull/214)
- **Reviewed head:** `ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe` (`epic/workshop-bookmark-recall-slice-0-spec`)
- **Target:** `epic/workshop-bookmark-recall` at `f2980986bb24d4627ffc60048ae7600020d342ce`
- **Reviewed:** 2026-11-05
- The target diff contains 19 documentation files, including Wayfinding close-out documents brought in from main. No executable or test changes are proposed.

## F-01 (P2): Separate unsolicited bookmark metadata from retained and published recall evidence

**Anchor:** [ADR D1](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/docs/adr/2026-11-05-workshop-bookmark-recall.md#L41-L42) and [Slice 1 isolation test](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-1-recall-operation.md#L63-L68).

The unconditional rule that bookmarks never appear in a frame, catch-up, provider history or per-turn prompt conflicts with D7 and the existing recall architecture. Once a persona requests the new list or a marked `transcript.read`, that result contains the bookmark label. Normal capability delivery retains that evidence, and normal publication makes its body available to other participants through room frames. The next participant need not independently request recall.

This is not a hypothetical new transport: [the audience policy](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/application/services/workshop/WorkshopRoomAudience.ts#L27-L71) publishes successful/partial reads after reply commitment; [room rendering](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts#L73-L106) includes the capability turn's content; [the run engine](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L502-L517) injects evidence and [commits its pending messages](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L573-L578). The existing recall ADR explicitly documents both retained evidence and catch-up delivery.

**Correction:** scope the isolation rule to automatic injection of live bookmark metadata. State that explicitly recalled records may persist and propagate through the ordinary quoted-evidence/publication path. Rewrite the pin to test both halves: toggling/renaming a live bookmark changes no prompt, while requested saved-session evidence can be retained, saved/reopened, and published. If absolute non-retention/non-publication is actually intended, D7 and the transport design need a different explicit decision instead.

**Witness:** an independent baseline probe placed a bookmark-label sentinel in a published `transcript.read` body. The real audience policy admitted it to the room and both the real guest frame and catch-up renderer contained the sentinel.

## F-02 (P2): Give the all-bookmarks browser a completeness and continuation contract

**Anchor:** [Slice 2 host listing](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-2-bookmarks-screen.md#L9-L18).

The outcome promises every saved session's bookmarks, but the specified existing corpus port cannot enumerate every session. [The store caps browser listings at 200 files](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L48-L58), [cuts the filenames before loading their summaries](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L553-L559), and returns `truncated`. The recall corpus port offers `list(undefined, signal)`, with no cursor. Filtering or searching the already returned bookmark rows cannot recover the 201st session. Cached documents do not expand that listing.

There is a second bound to specify: loading full recall documents for all listed sessions either stops at a source-byte budget, which can omit a much earlier session, or requires a new bounded loading strategy. The plan currently describes unreadable sessions but gives the UI no completeness, progress or continuation contract.

**Correction:** either add a bounded read-only enumeration/pagination contract that can eventually cover the promised corpus, or explicitly narrow the product promise and expose which limits made the browser incomplete. Define UI search coverage, cancellation, unreadable/omitted counts, and how further results are reached without removing the host's resource limits. Pin a corpus beyond 200 sessions and a cold corpus beyond the read-byte budget. Keep the model-facing bounded operation separate from the writer browser's completeness promise.

## F-03 (P2): Specify the missing live-bookmark data path

**Anchor:** [Slice 2's existing-snapshot requirement](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-2-bookmarks-screen.md#L27) and [Slice 3's unchanged live save path](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-3-remember-this.md#L13-L22).

The required live rows show bookmark dates and message first lines and participate in text search, but the existing [bookmark summary](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/shared/types/messages/workshop/bookmarks.ts#L36-L45) contains neither `createdAt` nor message text. [The ledger deliberately emits only that summary](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/application/services/workshop/session/WorkshopBookmarkLedger.ts#L246-L270); the room snapshot contains all bookmark summaries but only a bounded window of turns.

Concrete case: reopen a long room with an early bookmark outside the snapshot window. Its live row has no message to display or search. Even an in-window row lacks the bookmark date: the turn timestamp is a different event. Slice 3 also cannot simply call the unchanged [`saveTurn(WorkshopTurn)`](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopProjectMemory.ts#L225-L234) for that old row, because it needs the complete turn and pre-fills from its content.

**Correction:** specify safe live-summary enrichment and/or a correlated read-only full-ledger path, including how complete text search works and how an out-of-window live bookmark gets its memory prefill. Preserve room-ownership checks on live requests. Add in-window/out-of-window cases where bookmark creation and message timestamps differ, and a stale reply after room replacement. This can reuse existing host machinery, but it needs to be part of the slice contract rather than assuming the current snapshot already contains the data.

**Witness:** an independent real-session probe confirmed an out-of-window bookmark survives in the snapshot with neither `createdAt` nor content and no matching turn in `snapshot.turns`; its persisted bookmark timestamp is distinct from the original turn timestamp. The existing `WorkshopSessionBookmarks.test.ts` also pins this bounded-window behavior.

## F-04 (P2): Include collapsed tool reports in the read-mark plan

**Anchor:** [Slice 1 read marks](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-1-recall-operation.md#L58-L61).

The instruction to add the mark to `renderEntry` misses an existing renderer branch. [Discussion-detail reads route tool replies through `collapsedReport` instead](https://github.com/okeylanders/prose-minion-vscode/blob/ca3a6b88a4e9e2aba7f30ec71c3ab814ed836abe/packages/core/src/application/services/workshop/recall/WorkshopRecallReadWindow.ts#L110-L114), bypassing `renderEntry`. Multiple-session reads default to discussion detail. Tool reports are bookmarkable, so following the plan literally leaves those bookmarked turns unmarked in a common read mode, despite D5 and the completion criterion promising marked bookmarked turns.

**Correction:** carry the bookmark decoration into both full entries and collapsed reports, while keeping it out of the shared transcript projection. Add explicit single-session discussion and default multi-session tests for a bookmarked tool report, and check the added label does not break packing bounds or the full-read hint.

## Nonblocking clarifications

- **Calendar dates:** D2 says “writer's zone,” while the existing recall document and clock use each saved session's own IANA zone. Before Slice 1, name which zone drives filtering, whether `until` includes the whole day, and how impossible dates are rejected. Test a UTC/local-day boundary and DST. This avoids silently choosing different meanings for an identical date range across sessions.
- **Acceptance:** Q1–Q6 remain proposed defaults. Slice 4 should record their actual resolutions before changing the ADR to Accepted; passing technical checks alone is not writer acceptance.

## Verification and limits

- Verified **2,005 tracked source, test, resource and configuration blobs** used for local review against the exact head's Git tree. Read the repository guide and the recall, Wayfinding and Project Memory contracts.
- **Local focused verification:** **37 production suites / 525 tests passed**, covering recall, publication, persistence, session storage, bookmarks, preview and memory. Two independent baseline contract probes also passed. An initial broad in-band run was killed; the suite set was rerun in small isolated batches. One batch was killed after writing its successful results and all three constituent suites were rerun independently with exit 0.
- **Exact-head GitHub CI:** [run 41983299446](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41983299446), job `verify`, passed all three typechecks, **728 suites / 10,239 tests / 59 snapshots**, lint (**0 errors / 1,165 warnings**), and both bundles.
- Relative links in the new bookmark-recall planning documents resolve against the reviewed tree.
- No implementation changes, live provider calls, native VS Code acceptance, formal approval or merge were performed. These checks validate the existing foundations and the review's evidence; they do not validate the future feature.

## Resolution ledger

| Finding | Status |
|---|---|
| F-01: evidence propagation versus isolation | Open |
| F-02: complete browser enumeration | Open |
| F-03: live bookmark data and memory prefill | Open |
| F-04: collapsed read marks | Open |
