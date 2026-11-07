# PR #219 review: Bookmark Recall Slice 3, Remember this

## Verdict

**Current code-review verdict: approved at `b93c27ee89c712d0eb2af9d86205791912ec9e63`.** Both P2 findings are independently resolved, with no remaining blocking finding. Correction-head CI was still running when this report update was prepared; the final publication head requires its own green verification before this task is complete. Earlier findings and the author response remain below as history. This is an approval in the report/conversation, not a formal self-APPROVED GitHub review or permission to merge.

- PR: [#219](https://github.com/okeylanders/prose-minion-vscode/pull/219)
- Base: `epic/workshop-bookmark-recall`, `0c008dfe939347efac758ac8655df774202a7ef3`
- Head branch: `epic/workshop-bookmark-recall-slice-3-remember-this`
- Reviewed: 2026-11-05
- Scope: all 39 changed files, ADR D9/D10, saved/live source validation, room lifetime, citation visibility and persistence, UI correlation, composed routes, and verification.

## F-01 — P2: saved capability bookmarks cannot be remembered

**Anchor:** [WorkshopSavedTurnMemoryHandler.ts:138–141](https://github.com/okeylanders/prose-minion-vscode/blob/ddebf2f5ec25741ddb859ab34c4f09f2a7bb1d7d/packages/core/src/application/handlers/domain/workshop/WorkshopSavedTurnMemoryHandler.ts#L138-L141).

The route treats every transcript `event` as ineligible, claiming that bookmarks only mark messages or replies. That is not the actual bookmark rule. `isWorkshopBookmarkableTurn` explicitly allows assistant capability cards, while `projectWorkshopTranscriptTurn` deliberately projects a capability card as an event containing only its safe request summary. Projection kind is not bookmark eligibility.

**Reproduction:**

1. Bookmark an assistant capability card, save the session, and open a different session.
2. In Bookmarks, that saved row has a projected message and an enabled **Remember this** button.
3. The button opens an editable memory sheet containing the safe capability summary.
4. Save always returns **“That message can't be saved to memory.”** No memory is written.

This is reproduced with the real recall service, session store/coordinator and memory library, plus a separate real-App/router/recall/library UI witness. The same capability card is eligible for the live-turn path. The saved row is not a malformed or manually forged bookmark.

**Requested correction:** carry or derive bookmark eligibility from the source turn through the read-only recall seam, using the same shared rule as live saves. Do not simply admit every event: dividers and actual session markers should remain refused, and capability evidence must remain private. Add a saved capability-card regression and a non-bookmarkable event control.

**Witnesses:** [host probes](probes/pr-219-saved-memory-audit.test.ts.txt) and [real-App UI probe](probes/pr-219-bookmark-ui-audit.test.tsx.txt). These tests pass while recording the current defect; corrected product tests should assert successful saving of the eligible capability source.

## F-02 — P2: a saved-turn save can attach its receipt to a replacement room

**Anchor:** [WorkshopSavedTurnMemoryHandler.ts:124–143](https://github.com/okeylanders/prose-minion-vscode/blob/ddebf2f5ec25741ddb859ab34c4f09f2a7bb1d7d/packages/core/src/application/handlers/domain/workshop/WorkshopSavedTurnMemoryHandler.ts#L124-L143).

The new route waits for `recall.savedTurn` before calling `saveWriterMemory`. The shared writer captures `readRoomRevision()` only inside its later `write` call. Consequently the saved-turn read is outside the existing room-lifetime guard. The route's mutation gate rejects a replacement already in progress, but does not protect this awaited read from a replacement that starts later.

Recall's scope check prevents a change to a different session ID, but reopening the same named session changes the room revision without changing that scope identity. This leaves a practical gap.

**Deterministic reproduction with the real coordinator:**

1. Open named session `live-room`, then start remembering a turn from `saved-source`.
2. Hold `readNamed('saved-source')` during the recall read.
3. Reopen `live-room` through `coordinator.openNamed('live-room')`; confirm its room revision changed.
4. Release the source read.
5. The request returns `ok: true` with no room-changed warning and appends its receipt to the replacement room.

The same failure is independently reproduced through the coordinator’s real Rewind path, which also preserves the session ID while changing its revision. A control that opens `saved-source` itself changes the live ID and is correctly refused.

The source memory still names `saved-source` correctly; the defect is adopting the *new* room for the receipt and dirty-state effects of the old gesture. This contradicts the shared write path's explicit rule that a receipt belongs to the room where the request began. UI inspection also shows that saving does not lock session Open: the memory sheet has no Tab containment, the background frame is not inert for this sheet, and `roomMutationLocked` does not include `projectMemory.sheet.saving`.

**Requested correction:** capture the originating room revision before the first asynchronous source read and preserve it through the shared write/receipt path, or refuse the save if that revision changed before writing. Never silently adopt the replacement revision. Add the same-ID reopen witness; checking only session ID or a different-session replacement is insufficient.

**Witness:** [host probes](probes/pr-219-saved-memory-audit.test.ts.txt), second test.

## What reviewed cleanly

- The new saved route uses the existing recall and project-memory writer seams rather than constructing a store or bypassing the single-writer queue.
- Unknown, missing, unreadable, ambiguous, live-session and invalid source identifiers are refused. Cross-workspace availability is checked by recall and the memory library; no new path-based read/write was introduced.
- Outside-window live saves carry the room revision, and a mismatched revision is refused. Existing in-window saves deliberately retain their old route shape, as the accepted ADR specifies.
- The saved sheet uses host-projected content, caps its prefill, names the source session and closes the Bookmarks modal before opening. Notes previews correlate request ID and room revision; cancelled/superseded results do not reopen a sheet.
- Citation decoding is bounded to 30 unique tokens, edit proposals reject citations, and persisted proposals validate and clone the new field.
- Save-time citation filtering uses the room's existing audience policy, rejects unknown/foreign-reference/private-to-another-persona sources, logs IDs and reasons rather than source text, and deduplicates all sources within 32.
- Independent positive controls verify **Save and tell me** carries the proposal's citations into the actual saved memory and logs a rejected saved-session reference. A removed source is dropped at save without losing the writer/reply provenance.
- No-citation proposals preserve the existing shape, and saved citations survive reopen. The prompt and its worked example remain synchronized with the codec and limits.
- Route ownership remains explicit: 86 handlers, 47 mutations. The new handler and pure sheet builder remain below 500 lines; existing memory handler/hook are 497/485 lines. WorkshopApp remains a pre-existing large composition surface with small wiring-only changes.

## Verification

- Exact implementation checkout; no production edits made for the review. Local Node 24.22.1; CI Node 18.
- Local typecheck: all three projects passed.
- Local full-suite attempt: 747 suites / 10,433 tests / 59 snapshots passed; three Jest workers were externally terminated with SIGKILL before their suites ran. Those exact three suites then passed in a serial rerun, **3 suites / 25 tests**. Thus all **750 suites / 10,458 tests** passed across the two runs; the first aggregate command was not a clean pass.
- Local lint: **0 errors / 1,165 warnings**, matching baseline.
- Local build: both webpack bundles and Tailwind bundle-sentinel verification passed; the webview retains three baseline size/performance warnings.
- Focused independent UI review: **6 suites / 56 existing tests passed**.
- Independent probes: **7/7 passed** (four saved-source host cases, one real-App capability witness, and two citation controls), preserved as `.txt` artifacts outside normal test discovery. Defect witnesses are distinguished from passing product behavior above.
- Exact implementation-head PR CI: [run 42078868527](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42078868527), `verify`, passed typecheck, **750 suites / 10,458 tests / 59 snapshots**, lint and build. The log checks out merge candidate `4d5139044959a38aa45036dde35b02152ca506f3`, merging the stated head into the stated base.
- The report-only publication head requires its own CI verification; the implementation result is not a substitute for that later head.

## Reproducing independent probes

Copy the host/citation `.txt` files to `packages/core/src/__tests__/application/handlers/domain/workshop/` with their `.test.ts` names, and the UI `.txt` file to `packages/core/src/__tests__/presentation/webview/` with its `.test.tsx` name. Run each using `npx jest --runInBand --runTestsByPath <copied path>`, then remove the temporary copies. Imports use the checkout's existing fixtures. No live provider call is made.

Native VS Code layout and keyboard acceptance were not run; UI execution here uses the existing App/JSDOM harness. Saved-session proposal citations remain the accepted deferred multi-session-provenance work, not another finding. No product fixes, merge or deployment were performed. PR #205 was not reviewed.

## Author response

Both findings are real and are in this slice's code. Both are fixed on the Slice 3 branch, and Astra's witnesses are regressions in `WorkshopSavedTurnMemoryReview.test.ts`, built on her probe's setup with the real coordinator, store, recall service and memory library.

| Finding | Correction | Tests |
|---|---|---|
| F-01: saved capability bookmarks can't be remembered | **Eligibility is the original turn's, carried through recall.**<ul><li>Each recall entry records `bookmarkable`, computed from the persisted turn with `isWorkshopBookmarkableTurn`, the bubbles' rule (`WorkshopRecallDocument`).</li><li>`savedTurn` returns it, and `WorkshopSavedTurnMemoryHandler` gates on it, never on the projection's kind. A capability card, projected as an event, saves; a divider or session marker is still refused.</li><li>The prefill is unchanged: the row's projected message, the card's safe request summary. No capability evidence is read or sent.</li></ul>**The screen offers what the host saves.** Each recall bookmark records `bookmarkable` too, and its browser row carries `rememberable: true` only then (`WorkshopBookmarkBrowserRows`). "Remember this" is disabled on any other row, and the mount refuses one without it. | `WorkshopSavedTurnMemoryReview.test.ts`:<ul><li>"saves a bookmarked capability card, whose projection is an event": `savedTurn` reads `{ kind: 'turn', bookmarkable: true, entry: { kind: 'event' } }`; the memory is written with `sourceSession: 'saved-source'` and the card's turn, with one receipt.</li><li>"the screen offers it: the row carries the safe projected summary and is rememberable".</li><li>"still refuses a session marker, with nothing written" (the non-bookmarkable control).</li></ul>`WorkshopBookmarkBrowserModal.remember.test.tsx`: a row the host would refuse is not offered. |
| F-02: a saved-turn save can attach its receipt to a replacement room | **The room is taken when the message arrives.**<ul><li>`WorkshopSavedTurnMemoryHandler` reads the room revision first, with nothing awaited, through a new one-method port (`WorkshopSavedTurnMemoryRoom`, the session).</li><li>It passes that revision through `saveWriterMemory` into the shared `write`. There, before the library is called, a revision that moved refuses with `WORKSHOP_MEMORY_ROOM_CHANGED` and writes nothing: no memory, no receipt, no dirty mark.</li><li>The existing post-write check then compares against that same revision, so a replacement during the library's write still leaves no receipt, as before.</li></ul>**The live-turn route has no such gap.** The mutation registrar refuses or calls the handler synchronously. `handleSaveTurn` compares the request's `roomRevision`, finds the turn and enters `write`, whose revision read comes before its first await. The out-of-window save takes that path, so its room is checked in the same turn the message arrives. | `WorkshopSavedTurnMemoryReview.test.ts`:<ul><li>"refuses, writing nothing, after a same-id reopen while the source is read" and "…after a same-id rewind…": her two races through the real coordinator, holding `readNamed('saved-source')`. The live id stays `live-room` and the revision moves. The answer is `{ ok: false, error: WORKSHOP_MEMORY_ROOM_CHANGED }`, with no memory and no receipt.</li><li>"control: refuses when the saved source becomes the live room during the read" (the different-id case).</li><li>"control: with the room unchanged it saves, and its receipt is that room's".</li></ul> |

**The other notes in F-02.** The memory sheet's lack of Tab containment, the frame not being inert under it, and `roomMutationLocked` not counting a sheet save are pre-existing Project Memory sheet behavior, not this slice's. With the room taken at arrival, a session Open during a save can no longer misplace its receipt, so I left them as they are.

**Shapes.** `WorkshopRecallEntry.bookmarkable` and `WorkshopRecallBookmark.bookmarkable` are in-memory recall shapes, built per document and never persisted. `WorkshopBookmarkBrowserRow.rememberable` is an optional message field. No stored shape changes.

**Files.** `WorkshopRecallDocument.ts`, `WorkshopRecallSavedTurn.ts`, `WorkshopRecallBookmarks.ts`, `WorkshopBookmarkBrowserRows.ts`, `bookmarkBrowser.ts`, `WorkshopSavedTurnMemoryHandler.ts`, `WorkshopProjectMemoryHandler.ts` (500 lines), `WorkshopSliceComposition.ts`, `WorkshopBookmarkBrowserModal.tsx`, `WorkshopBookmarkBrowserMount.tsx`. Two recall tests that pin the bookmark shape exactly gained the field.

**Verification:** typecheck clean; lint 0 errors / 1,165 warnings (baseline); jest **751 suites / 10,465 tests / 59 snapshots**, all passing (full run, `--maxWorkers=4`); no `vscode` import in core.

## Ledger

| Finding | Status | Where |
|---|---|---|
| F-01 (P2) | Independently resolved | `b93c27ee`; original-turn eligibility, host controls and real-App success |
| F-02 (P2) | Independently resolved | `b93c27ee`; same-ID recall races plus staged-write/after-commit controls |

## Independent correction review — `b93c27ee` (2026-11-05)

Both corrections were inspected independently against the original witnesses, not accepted solely from the author response.

- **F-01 resolved.** The recall document and recall bookmark compute eligibility from the original turn using `isWorkshopBookmarkableTurn`; `savedTurn` carries that fact without exposing the source turn or private capability evidence. The host checks it, and browser button/mount guards agree with the host. The real-App witness now saves exactly one memory with the correct saved session and turn, and one receipt. The draft and saved note contain only the safe request summary. Non-bookmarkable session markers remain refused.
- **F-02 resolved.** The saved route captures the room revision before the source read and passes it into the shared writer. A changed revision refuses before the library is called. The existing post-write comparison then retains the same origin revision, so a later replacement cannot adopt the receipt. Independent same-ID reopen and Rewind witnesses now write nothing; different-ID controls remain refused.
- **No new blocking finding.** The added eligibility fields are computed in-memory/message fields, not a persisted session-format change. The fix keeps the existing single-writer queue and source/privacy boundaries.

Nonblocking display note: capability sheets still say “Session’s reply” because their safe event preview uses that speaker label, while the bookmark row names the persona. This does not alter the saved source IDs or expose capability evidence.

### Correction verification

- All three local typechecks passed.
- **105 suites / 1,470 tests passed** across Workshop memory, recall, bookmarks, sheet/hooks, route seams, prompt budgets/sync and architecture boundaries.
- **11 independent recheck probes passed:** ten host/recall/library cases, plus the real-App capability save. Separate focused UI regressions passed **11 suites / 89 tests**; separate host regressions/probes passed **3 suites / 30 tests**. These runs overlap, so their counts are not additive.
- Local lint passed at **0 errors / 1,165 warnings**. Both webpack bundles and the bundle-sentinel check passed, with the same three webview size/performance warnings.
- Extra write controls verify receipt isolation before and after commit. An admitted same-ID write may finish, returning the existing room-changed warning, without a receipt in the replacement room; a different-ID change before commit withdraws the write.
- F-01 and F-02 review threads were answered with independent results and resolved.
- [Correction-head CI run 42083762842](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42083762842) was still running at publication. Its outcome and the subsequent report-head verification will be recorded in the PR conversation without creating an endless series of CI-only report commits.

Updated independent probes: [host recheck](probes/pr-219-saved-memory-rereview.test.ts.txt), [real-App recheck](probes/pr-219-bookmark-ui-recheck.test.tsx.txt). The earlier probes remain historical defect witnesses for the original head. No production code was changed by the reviewer, and no merge was performed.
