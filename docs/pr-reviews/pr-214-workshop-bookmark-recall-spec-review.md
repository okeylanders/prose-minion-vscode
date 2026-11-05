# PR #214 review: Workshop Bookmark Recall specification

**Latest disposition: see the re-review below. F-01–F-07 are open (one P1 and six P2 contract corrections).**

**Initial disposition at `ca3a6b88`: four P2 planning corrections requested before implementation.** This is a review of the proposed architecture and slice contracts, not a claim that the unimplemented feature currently fails, a formal GitHub approval, or authorization to merge.

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


## Re-review: current-room access and cited proposals (`9bc6a489` / `581731df`)

**Latest disposition: F-01–F-04 remain open, with three further contract corrections below.** The author changed the design in `9bc6a4890c3a4226fe7cb1e0ebe89aad21dfd5dc` while the initial review was being prepared; `581731df` adds the initial report on top without altering the author's changes. This section reviews that exact combined head against the unchanged target `f2980986`. All intervening changes are documentation only.

The ADR now records the writer's answers, permits current-room bookmark recall, and adds memory proposals with cited turns. The earlier nonblocking request to record Q1–Q6 is therefore **addressed**. The initial review's references to the live-room exclusion describe the former design; that exclusion is no longer the requested product behavior. F-01's evidence-retention contradiction still applies, and F-02–F-04 remain unchanged in the new plan. The new live port could help address F-03, but the writer-browser slice still explicitly relies on the old snapshot and unchanged `saveTurn`.

### F-05 (P1): Caller-side filtering does not preserve a private row's publication audience

**Anchor:** [updated D7](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/docs/adr/2026-11-05-workshop-bookmark-recall.md#L140-L144).

D7 now asserts that filtering the rows for the asking persona, then using normal capability publication, guarantees that private rows never reach another persona. That guarantee does not follow from the existing policy. `workshopTurnAudience` assigns **one audience to the whole result** from its operation/status/publication stamp. It never intersects that audience with source turns or re-filters rows for each recipient. Once the new operation joins the publishable set and the reply commits, the entire result is room-visible.

For example, a guest may legitimately see its own unpublished capability card and a writer's bookmark label on it. The proposed live port admits that row for the guest. Publishing its successful bookmark-list result then exposes that row's quoted request/label to the host and other guests under the current whole-result policy, despite the original card being private. Projection hides capability evidence bodies; it does not make the remaining private label/request public.

**Correction:** decide and specify an enforceable publication design. Options include refusing to publish a result containing private rows, constructing a separate room-safe published body, or adding explicit audience-intersection metadata and corresponding delivery rules. Do not rely solely on filtering for the original caller. Pin a mixed public/private result, reply commitment, host/other-guest catch-up and save/reopen; demonstrate that the private sentinel never crosses that boundary. This is a privacy-related specification blocker, not a claim that the new operation already exists.

### F-06 (P2): Preserve session-qualified provenance, and provide the identifiers proposals require

**Anchor:** [updated D10](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/docs/adr/2026-11-05-workshop-bookmark-recall.md#L184-L191) and [Slice 3 cited-turn contract](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-3-remember-this.md#L23-L28).

The new trailer accepts citations from the live room and saved sessions, but the plan then appends the accepted bare IDs to `sourceTurns` and says provenance reads remain unchanged. [A memory has only one `sourceSession`](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/packages/core/src/shared/types/projectMemory.ts#L104-L107). [Proposal provenance sets it to the live proposal room](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/packages/core/src/application/handlers/domain/workshop/WorkshopProjectMemoryProvenance.ts#L14-L28), and [the manager resolves every source turn against that single session](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/packages/core/src/application/services/workshop/memory/ProjectMemoryLibrary.ts#L387-L400).

A proposal in A citing bookmark B/t therefore loses B when written: after A stops being live, t is looked up in A. It either appears missing or resolves to an inherited/shared turn in the wrong session. Checking B before saving does not preserve B in the saved record. Keeping the original proposal/writer provenance also means simply replacing `sourceSession` with B cannot represent the mixed sources.

**Correction:** choose session-qualified multi-source provenance with the necessary storage/codec/read/UI/compatibility work, or explicitly restrict cited sources to one compatible session. Specify which proposal and source references remain, deduplication and the 32-turn bound. Test live plus saved sources, two saved sessions, overlapping turn IDs and reopen.

The output contract also needs to expose a usable durable reference. Current-room rows currently promise only “this conversation” and a **position** ([D1](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/docs/adr/2026-11-05-workshop-bookmark-recall.md#L47)), while the trailer requires **turn IDs taken from the result**. Add rendered durable IDs or a host-resolved reference scheme; a ledger position is not that identifier.

### F-07 (P2): Give a truncated current-room bookmark a usable full-message path

**Anchor:** [updated D2's truncation promise](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/docs/adr/2026-11-05-workshop-bookmark-recall.md#L81-L88) versus [Slice 1's unchanged recall exclusions](https://github.com/okeylanders/prose-minion-vscode/blob/581731dffb1f7751bf8b11d694b28b960d6b2563/.todo/epics/epic-workshop-bookmark-recall-2026-11-05/slice-1-recall-operation.md#L35-L37).

A current-room bookmarked message longer than `bookmarkMessageCharacters` is cut, but the only promised recovery hint is a `transcript.read` of that session/turn. Current rows deliberately contain no session ID, and the same plan explicitly keeps the live room excluded from `transcript.read`. Passing the live session ID would be refused anyway. Repeating `transcript.bookmarks` produces the same capped head, not the missing text.

**Correction:** define a supported current-room full-read/continuation contract under the same audience and window guards, or explicitly change the full-message promise and the current-row truncation copy. A hint must be executable and actually retrieve the missing source, not merely parse. Test a current bookmarked message exceeding 4,000 characters through the real codec/service, including a caller who lacks the complete original message in retained history.

### Re-review verification

- The author delta and report commit change documentation only; the previously verified executable/test baseline and 37-suite local results still apply. No future-feature implementation was tested.
- Exact-head CI for `581731df`, [run 42019846616](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42019846616), was still running when this update was written. It is not reported as passed.
- No formal approval, implementation change or merge was performed.

### Current resolution ledger

| Finding | Status |
|---|---|
| F-01: evidence propagation versus isolation | Open |
| F-02: complete browser enumeration | Open |
| F-03: live bookmark data and memory prefill | Open |
| F-04: collapsed read marks | Open |
| F-05: private-row publication | Open |
| F-06: session-qualified citations and usable references | Open |
| F-07: current-room full-message hint | Open |
| Q1–Q6 recording clarification | Addressed in `9bc6a489` |

## Author response (spec revision)

Every finding is answered in the ADR (`docs/adr/2026-11-05-workshop-bookmark-recall.md`) and the slice docs. Nothing is implemented yet: these are contract changes for Slices 1–3 to build and test.

| Finding | Resolution | Where |
|---|---|---|
| F-01 | The isolation rule now covers only **automatic injection**. No frame, catch-up, catalog frame or per-turn prompt carries live bookmark data, so setting, clearing or renaming a bookmark changes nothing a persona is sent. A **requested** result is ordinary recall evidence: it's retained, saved and reopened, and published under D7. The rewritten pin tests both halves. | ADR D1, D4; Slice 1 "The D10 pin, rewritten" |
| F-02 | The browser reads saved sessions in **pages**. A new read-only `WorkshopSessionStore.listPage({ after?, limit })` walks every session file in a stable order, isn't capped at 200, and never initializes or flushes. Each page is bounded by `bookmarkBrowserSessions` and `bookmarkBrowserBytes`, which are store-side constants, not prompt budgets. It returns rows, a `next` cursor, and counts of sessions read, unreadable and remaining. The browser states its coverage and offers "Load more". Search covers the loaded rows and says so. Requests are correlated and cancellable. The persona's operation keeps its own bounds. Tests use a corpus of more than 200 sessions and a cold corpus beyond the byte budget. | ADR D8; Slice 2 Host and Tests |
| F-03 | **Live rows come from the host, never the snapshot.** It builds them from the full ledger (label, `createdAt`, speaker, projected message, turn id) by `roomRevision`, and the webview drops stale answers. Search covers live rows' full text. An out-of-window live "Remember this" prefills from the host's message and saves through Project Memory's live-turn route under a room check; an in-window one keeps `saveTurn`. Tests cover in-window and out-of-window rows, `createdAt` distinct from the turn's timestamp, and a stale answer after replacement. | ADR D8, D9; Slice 2; Slice 3 |
| F-04 | Read marks go in **both renderers**: `renderEntry`, and `collapsedReport` for `discussion` detail's tool reports. They count toward the packing bounds and the full-read hint. Tests cover single-session discussion and the default multi-session read. | ADR D5; Slice 1 "Read marks" |
| F-05 (P1) | **A result is published only if every open-room row stands on a turn the whole room could see.** Otherwise the host stamps it unpublishable, and it stays with the persona that asked. There are no per-row audiences and no second body, and the whole-result policy is never asked to filter. Saved-session rows follow recall's existing rule for saved turns. The test is a mixed public/private-sentinel result through reply commitment, the host's and another guest's catch-up, and save/reopen: the sentinel never crosses. | ADR D7; Slice 1 "Publication" |
| F-06 | **Durable references:** every row carries the turn id and the bookmark id; a position is only where the turn stands now. **Citations:** a proposal may cite open-room turns only, checked against the ledger and the persona's visibility, deduplicated, and within the bound of 32. `sourceSession` stays the live room, so one session holds every source. Saved-session citations are refused here, because format 1 holds one `sourceSession`. They're recorded as a follow-up for session-qualified, multi-source provenance (`feature-workshop-memory-multi-session-sources`). "Remember this" from a saved bookmark needs no such change: its one source is that session. | ADR D1, D10; Slice 3 |
| F-07 | **One bookmark in full:** `<bookmark>{id}</bookmark>` with an optional `<from>{offset}</from>` reads one bookmark's whole message in windows, in every scope, under the same audience rule and window clamp. It's exclusive with the list filters. Every cut message's hint is this form, so it fetches the rest even when the caller has lost the original from its history. A saved row also names its session and turn, for reading it in context. Tests cover an open-room message over 4,000 characters read to its end through the real codec and service, plus a guest refused a turn it couldn't see. | ADR D2, D3; Slice 1 |
| Dates (nonblocking) | Dates are calendar days in the **holding session's own zone**, recall's existing rule; for the open room, its own zone. `<until>` includes the whole day. Impossible or malformed dates, and `since` later than `until`, are refused as `invalid-date`. Tests cover a UTC/local-day boundary and a DST change. | ADR D2; Slice 1 |
| Acceptance (nonblocking) | Okey answered Q1–Q6 on 2026-11-05, and his answers are recorded in the ADR. Slice 4 still records the live pass's outcome before the ADR moves to Accepted. | ADR "The writer's answers"; Slice 4 |
