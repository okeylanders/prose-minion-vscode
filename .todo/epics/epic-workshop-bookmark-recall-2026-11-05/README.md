# Epic: Workshop Bookmark Recall

**Status:** Slices 0–3 merged. Slice 3 merged at `298c17d` (PR #219). Slice 4, the live pass, is ready for Okey. Slice 2 merged at `78fe28d` (PR #216). Slice 1 merged at `ddf8356` (PR #215). Slice 0 (spec) merged at `8e9b612` (PR #214). The branch `epic/workshop-bookmark-recall` was cut from `epic-pinned-context` at `f298098` on 2026-11-05, after Pinned Context finished its code (Project Memory 6a–6c merged in at `b668782`). `main` was merged in for the Wayfinding close-out docs.
**Priority:** Medium
**Created:** 2026-11-05
**Integration branch:** `epic/workshop-bookmark-recall`. Each slice is built on its own branch, `epic/workshop-bookmark-recall-slice-<N>-<slug>`, and merges into the epic through a reviewed PR.
**Decision:** [ADR 2026-11-05: Bookmarks Personas Can Read, and a Bookmarks Screen](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md) (Proposed; Okey answered Q1–Q6 on 2026-11-05)
**Realizes:** [Bookmarks personas can read, and a Bookmarks screen](../../features/feature-workshop-bookmark-recall/README.md)
**Downstream of:** Wayfinding (on `main`), Project Memory, and Pinned Context. Fixes from those two epics' live passes are merged in as they land.

## Goal

Two outcomes:
- **For personas:** read the writer's bookmarks on request, in the open room and in saved sessions. That means a fast list, filtered by scope, session, date, text and speaker, with each bookmark's full message, plus marks on bookmarked turns in a read.
  - Okey's own use case is "can you see what I bookmarked in this session and propose any new memories?" A memory proposed that way cites the bookmarked turns (ADR D10).
- **For the writer:** one screen of every bookmark, with preview, Open, Open at bookmark, and "Remember this".

Every bookmark saved since Wayfinding reads unchanged.

## Slices

| # | Slice | Outcome | Decisions | Status |
|---|---|---|---|---|
| 0 | Spec | ADR, this epic, slice docs, open questions | All | Done (PR #214, `8e9b612`) |
| 1 | [Recall reads bookmarks](slice-1-recall-operation.md) | `transcript.bookmarks` end to end, the open room through a read-only live port, read marks, and the Wayfinding D10 pin rewritten | D1–D7 | Done (PR #215, `ddf8356`) |
| 2 | [The Bookmarks screen](slice-2-bookmarks-screen.md) | Read-only browser across sessions: preview, Open, Open at bookmark | D8 | Done (PR #216, `78fe28d`) |
| 3 | [Remember this, and proposals that cite bookmarks](slice-3-remember-this.md) | A saved bookmark becomes a memory citing its session and turn, and a persona's proposal cites the bookmarked turns | D9, D10 | Done (PR #219, `298c17d`) |
| 4 | [Verify live](slice-4-live-pass.md) | Extension Development Host pass; ADR → Accepted; memory bank | — | Ready for Okey (checklist consolidated) |

**Order:** 1 → 2 → 3.
- Slice 2 needs the recall document's bookmarks from Slice 1.
- Slice 3 builds on Slice 2's screen.

## How the slices are built

This is the same flow as Wayfinding, Project Memory and Pinned Context.

- **One implementation thread per slice.** It works on its slice branch, cut from the epic. It reads:
  - this README;
  - the ADR;
  - `AGENTS.md`, mainly Session Recall, Transcript Export and the presentation patterns;
  - its slice doc.

  Then it builds, verifies, commits and pushes. When the slice is done, it updates its slice doc and this README's progress notes, then stops.
- **The coordinating thread opens each slice's PR** into `epic/workshop-bookmark-recall` and watches it. Astra reviews each PR.
- **Findings are fixed on the slice branch**, and answered in the review's ledger.
- **Merging into the epic.** Once a PR is green and its findings are settled, the coordinator merges it into the epic with a merge commit and starts the next slice.
- **Merging to `main`.** The epic goes to `main` in one PR, after Project Memory and Pinned Context have merged to `main`.

## Verification (every slice)

- `npm run typecheck`
- `npm run lint`: no new errors. Only new warnings count.
- `npx jest`: the full suite passes. Record the counts in the progress notes. The baseline at `f298098` is 728 suites / 10,239 tests.
- `packages/core/src` has no `from 'vscode'`.
- **File size.**
  - No new file goes over 500 lines.
  - A file already over 500 lines grows only by the seam, that is, the calls into new modules. The files this applies to: `WorkshopApp.tsx` (1,828), `WorkshopSessionService.ts` (2,717), `WorkshopPersonaCapability.ts` (951) and `promptBudgets.ts` (791).
  - `recall/WorkshopTranscriptRecallCapability.ts` is at 496 lines, so it is split before it grows.
- **Personas and data.**
  - No bookmark reaches a persona except through recall (ADR D1).
  - The stored bookmark shape is unchanged. A session saved by the Wayfinding release reads unchanged (fixture).
- **Completion criteria** are each backed by a named test, or stated as covered by the Slice 4 live pass.

## Completion Criteria

- `transcript.bookmarks` returns bookmarks from the open room and saved sessions, with full messages, within stated bounds and with hints that decode as written.
  - Its filters are scope, session, recent, match, persona, query, speaker and the dates.
  - From the open room, a persona sees only bookmarks on turns it could see.
- `transcript.read` marks bookmarked turns. Export and the turn preview are unchanged.
- The Bookmarks screen lists every bookmark across saved sessions and the live room. It can preview, open the session, and jump to the turn.
- "Remember this" saves a saved session's bookmarked message as a memory, citing its session and turn.
- Bookmarks never enter a room frame, a catch-up or provider history. A persona reads them only on request.
- A persona's memory proposal from bookmarks cites the bookmarked turns, and the host checks every one.
- Every bookmark saved since Wayfinding reads unchanged.

## Close-out (with the final PR)

- Add a "Superseded in part by ADR 2026-11-05" line to ADR 2026-11-03's D5 and D10. That file lives on `main`; editing it now would cut across the downstream epics.
- Archive the feature note, and Wayfinding's epic and feature notes, once nothing downstream links to them. Fix the links in the same pass.
- Remind Okey about PR #205 (Workshop settings user-only) when this epic is done. It is still open into `main`, its tech-debt README conflicts with Wayfinding, and its new scope test will need a `proseMinion.workshop.projectMemory` row.

## Progress Notes

- **2026-11-05. Slice 0.**
  - Okey asked for this epic at the Wayfinding Slice 8 review, then said to branch it from Pinned Context once that epic finished development.
  - The branch was cut from `epic-pinned-context` at `f298098`.
  - A survey of the code (recall's `transcript.todos` template, Project Memory's D12 lists, its provenance, and the shared browser) shaped the ADR. It corrected three things in the feature note:
    - the call syntax is `<prose-minion-tool-call name="…">`;
    - the bounds belong in `PROMPT_BUDGETS.workshopTranscriptRecall`;
    - `<match>` and `<persona>` choose sessions, so bookmark filters need their own fields.
- **2026-11-05. Okey's answers to Q1–Q6.** All six are recorded in the ADR.
  - **Q1 changed the design.** The open room's bookmarks are visible to personas, on request, through `<scope>` and a read-only live port, filtered by what the asking persona could see. His use case added D10: a memory proposed from bookmarks cites them.
  - **Q4 is a follow-up.** Catalog counts went to [their own feature note](../../features/feature-workshop-recall-bookmark-counts/README.md).
  - **Q2, Q3, Q5 and Q6 stand as proposed.**
- **2026-11-05. PR #214 review (Astra).** She raised one P1 (F-05) and six P2s (F-01–F-04, F-06, F-07), all against the spec. Each is answered in the ADR and the slice docs, and the ledger is in [the review](../../../docs/pr-reviews/pr-214-workshop-bookmark-recall-spec-review.md).
  - **F-01.** Nothing about bookmarks is injected automatically, and a requested result is ordinary evidence. The rewritten pin tests both halves.
  - **F-05 (P1).** A result holding any open-room row the room couldn't see is never published. It stays with the persona that asked.
  - **F-02.** The browser reads saved sessions in pages, through a read-only `listPage` cursor, and says how much it covers.
  - **F-03.** The host builds live rows from the full ledger, by `roomRevision`. An out-of-window "Remember this" uses the host's message and Project Memory's live-turn route.
  - **F-04.** Read marks also go on collapsed tool reports.
  - **F-06.**
    - Rows carry turn ids.
    - Proposal citations are limited to the open room, because a memory has one source session.
    - Saved-session citations went to [their own follow-up](../../features/feature-workshop-memory-multi-session-sources/README.md).
  - **F-07.** `<bookmark>` and `<from>` read one bookmark's whole message in windows, and that's the continuation every cut message points to.
  - **Dates.** They use the holding session's own zone, with `<until>` inclusive, and impossible dates are refused.
- **2026-11-05. Slice 0 merged** into the epic at `8e9b612` (PR #214), after Astra closed F-01–F-07 at the spec level and CI passed on `57bfac2`.
- **Since Slice 0** (for the Slice 1 thread):
  - Okey's Q1–Q6 answers are final; the ADR's "Writer's answers" section is the record.
  - The spec review's outcomes the code must honor:
    - nothing about bookmarks is injected (F-01);
    - a result with any open-room row the room couldn't see is never published (F-05, D7);
    - read marks also go on collapsed reports (F-04, D5);
    - rows carry turn ids, and refs are source-qualified, with `stale-bookmark-ref` for a replaced room (F-06, F-07, D2).
  - Slice 1 starts on `epic/workshop-bookmark-recall-slice-1-recall-operation`, cut from the epic at `8e9b612`. Its first code step is the split of `recall/WorkshopTranscriptRecallCapability.ts` (496 lines).
- **2026-11-05. Slice 1 built** on `epic/workshop-bookmark-recall-slice-1-recall-operation` (PR #215). The [slice doc's implementation note](slice-1-recall-operation.md#implementation-note) lists the files and tests.
  - **The split came first** (`6926a58`). The recall capability now only dispatches, and each operation's adapter is its own module.
  - **`transcript.bookmarks`** joins every D4 list. The open room is read only through `WorkshopLiveRoomBookmarks`, filtered by `isWorkshopTurnVisibleToParticipant`, the room's own rule, now named.
  - **D7:** a result holding an open-room row the room couldn't see is stamped withheld, and the audience policy never publishes it. The rewritten pin carries a private sentinel through commitment, the host's and another guest's catch-up, the join snapshot, and reopen.
  - **Readings the ADR left open** are recorded in the slice doc. The main one: two cut-message hints in one call are refused as `duplicate-field`, because `<bookmark>` reads one bookmark. The prompt teaches this.
  - **Verification:** typecheck clean; lint 0 errors / 1,165 warnings (baseline); jest **735 suites / 10,328 tests / 59 snapshots**, all passing; no `vscode` import in core.
- **2026-11-05. PR #215 review (Astra)** found one P2.
  - **F-01:** a bookmark window at the `<from>` ceiling (999,999) said "This is the end of the message." although text remained.
  - **The fix (`ac43aa58`):** a window says the end only where the message ends. Past the ceiling, it says how much is left and that the rest can't be read by ref.
  - **The ceiling stays.** The prompt teaches the notice and the sync test pins its number.
  - **Re-review:** clean. Ledger: [the review](../../../docs/pr-reviews/pr-215-workshop-bookmark-recall-slice-1-review.md).
- **2026-11-05. Slice 1 merged** into the epic at `ddf8356` (PR #215), after CI passed on `3855e71`.
- **Since Slice 1** (for the Slice 2 thread):
  - **What Slice 2 builds on.** The recall document now carries bookmarks (`WorkshopRecallDocument`). The live port is `WorkshopLiveRoomBookmarks`, implemented by `WorkshopLiveRoomBookmarkReader`, built in `extension.ts`.
  - **What stays as it is.** The audience rule is `isWorkshopTurnVisibleToParticipant`. The screen is the writer's own view, so it shows every live bookmark. Personas still read only through recall.
  - **Pinned Context:** no new commits since `f298098`, so nothing to merge in yet.
  - **The branch.** Slice 2 starts on `epic/workshop-bookmark-recall-slice-2-bookmarks-screen`, cut from the epic at `ddf8356`.
- **2026-11-05. Slice 2 built** on `epic/workshop-bookmark-recall-slice-2-bookmarks-screen` (PR #216). The [slice doc's implementation note](slice-2-bookmarks-screen.md#implementation-note) lists the files, the tests by criterion, and the readings the ADR left open.
  - **Host.** The store's read-only `listPage` walks every session file by cursor, uncapped by the 200, each page bounded by `WORKSHOP_BOOKMARK_BROWSER_LIMITS`. Recall's scope rule moved to `WorkshopRecallScopeGate`, so the service shrank to 466 lines and gained `bookmarkPage`, `liveRoomBookmarks` and `savedTurn`. The recall service joins `CoreServices`. `WorkshopBookmarkBrowserHandler` owns four direct routes; the fourth, `WORKSHOP_CANCEL_BOOKMARK_PAGE`, lets the host stop a page.
  - **Webview.** `readOnly` on the shared browser and row. The screen is reached from "Bookmarks…" and "All bookmarks…". Preview uses the turn-preview sheet with saved and given sources. Open session goes through its confirmation, and Open at bookmark waits for Open's result and the new room before it jumps. `WorkshopApp.tsx` grew 1,828 → 1,860 lines, wiring only.
  - **Verification:** typecheck clean; lint 0 errors / 1,165 warnings (baseline); jest **743 suites / 10,390 tests / 59 snapshots**, all passing (full run, `--maxWorkers=4`); no `vscode` import in core.
- **2026-11-05. PR #216 review (Astra)** raised two P2s. Both are fixed in `72f92970`, and the ledger is in [the review](../../../docs/pr-reviews/pr-216-workshop-bookmark-browser-review.md).
  - **F-01.** Paging no longer primes the store's exact-read path cache. It counts ids folder-wide, and never resolves a duplicate. The shared cache path is fixed upstream in Pinned Context.
  - **F-02.** Open at bookmark follows its own Open and drops the jump when that Open is superseded.
  - **Verification:** jest **744 suites / 10,399 tests / 59 snapshots**, all passing; lint at the 1,165 baseline; typecheck clean.
- **2026-11-05. PR #216 re-reviews (Astra)** raised three more findings against the fixes. All are fixed, and the ledger is in [the review](../../../docs/pr-reviews/pr-216-workshop-bookmark-browser-review.md).
  - **F-03 (P2), `99ddf80a`.** The folder-wide id scan ran outside the page budget. It is gone. Each page reads only its own files, and shared ids are detected across the walk in page-local walk state (`WorkshopRecallBookmarkWalks`). Earlier rows are marked "Shared session id" and their Opens are disabled.
  - **F-04 (P3), `99ddf80a`.** An id the browser couldn't read is never taken as unique. The coverage note says so, and an exact read's conflict is its own outcome (`ambiguous-session`).
  - **F-05 (P2), `6cb9ace6`.** The pager's document cache is keyed by source file, and an ambiguous id is evicted.
  - **Verification:** jest **744 suites / 10,410 tests / 59 snapshots**, all passing.
  - **Limit, stated on the screen:** a row loaded before its duplicate's page looks normal until "Load more" reaches that page. Preview and Open still refuse the conflict.
- **2026-11-05. Slice 2 merged** into the epic at `78fe28d` (PR #216), after Astra approved and CI passed on `2072c64c`.
- **2026-11-05. Pinned Context sync.** `epic-pinned-context` moved to `b9d8498f` with its Slice 5 live-pass fixes (#217). The sync PR is #218 (`f8f3d166`), and it merged cleanly. Okey's session-store identity fix for the shared exact-read cache path has not landed upstream yet; it comes in with a later sync.
- **Since Slice 2** (for the Slice 3 thread):
  - **The recall service** gained writer-facing seams: `bookmarkPage`, `liveRoomBookmarks` (every live bookmark, writer only) and `savedTurn` (a saved turn through `projectWorkshopTranscriptTurn`). Saved-session "Remember this" can check its turn through them.
  - **The Bookmarks screen's rows** carry source and turn ids. Live rows come from the full ledger, matched by `roomRevision`. An ambiguous row is never actionable.
  - **The upstream store code** (`findNamedSession`, `list()`, `rememberNamedSessionPath`) is Okey's to change in Pinned Context. Don't touch it here.
  - **The branch.** Slice 3 starts on `epic/workshop-bookmark-recall-slice-3-remember-this`, cut from the epic at `78fe28d`. The #218 sync merges in when it lands.
- **2026-11-05. Slice 3 built** on `epic/workshop-bookmark-recall-slice-3-remember-this` (PR #219), in two commits: host `5e60b21c`, webview `20ce3f66`. The [slice doc's implementation note](slice-3-remember-this.md#implementation-note) lists the files, the tests by criterion, and eleven readings the ADR left open.
  - **"Remember this," host side.** A saved session's bookmark saves through a new sibling route owner, `WorkshopSavedTurnMemoryHandler` (`WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`). It checks the turn with recall's `savedTurn` and refuses `ambiguous-session`, never resolving it. It writes through Project Memory's own write path, by a new seam (`saveWriterMemory`), so `WorkshopProjectMemoryHandler` stays at 497 lines.
  - **The live route** takes `roomRevision` and refuses another room.
  - **"Remember this," webview side.** It is on the Bookmarks screen's rows and on the Notes list. An in-window turn goes through `saveTurn`, unchanged. A turn outside the window prefills from the host's message. A saved turn opens the sheet's new `saved-turn` mode: "From “Title”, …".
  - **Cited turns (D10).** The trailer gains `<cites-turn>`, at most 30. At save, the host keeps a cited turn only when the open room holds it and the proposer could see it (`isWorkshopTurnVisibleToParticipant`). It drops the rest, saved-session and `current@…` refs included, and logs them by id. Kept turns join `sourceTurns` after the writer's message and the reply, each once, within 32. The prompt teaches the field with a worked example.
  - **Verification:** typecheck clean; lint 0 errors / 1,165 warnings (baseline); jest **749 suites / 10,453 tests / 59 snapshots**, all passing (full run, `--maxWorkers=4`); no `vscode` import in core.
- **2026-11-05. PR #219 review (Astra)** raised two P2s, both fixed; the ledger is in [the review](../../../docs/pr-reviews/pr-219-remember-this-review.md).
  - **F-01.** A saved capability-card bookmark couldn't be remembered: the route judged the projection's kind. Eligibility is now the original turn's (`bookmarkable`, through recall), and the screen offers only what the host saves.
  - **F-02.** A saved-turn save read the room after the source read, so a same-id reopen or a Rewind could take its receipt. The route now takes the room when its message arrives, and the write refuses, writing nothing, if it moved.
  - **Verification:** jest **751 suites / 10,465 tests / 59 snapshots**, all passing; lint at the 1,165 baseline; typecheck clean.
- **2026-11-05. Slice 3 merged** into the epic at `298c17d` (PR #219), after Astra approved `b93c27ee` and CI passed on `9d0568a0`.
  - **Wording, still open.** Her re-review noted that a capability card's "Remember this" sheet labels the safe summary "Session's reply". The persisted provenance is correct. The note is non-blocking and is now a live-pass item.
  - **Size.** `WorkshopProjectMemoryHandler.ts` is now exactly 500 lines. Its next change splits it, never grows it.
- **2026-11-05. Slice 4 prepared.** The [live-pass checklist](slice-4-live-pass.md) now folds in what Slices 2 and 3 added, all of it pinned by their reviews:
  - shared-id rows and their refusals;
  - "Load more" coverage;
  - superseded Open at bookmark;
  - every "Remember this" path;
  - cited-turn drops and `edit-cites`.

  It needs Okey in VS Code. After it come the close-out steps, including the #205 reminder.
- **2026-11-06. Live pass: 15 capability calls per turn.** Okey asked for more calls per persona turn. `callsPerTurn` goes from 5 to 15 (ADR D11), on `epic/workshop-bookmark-recall-calls-per-turn`. The per-operation limits stay, and the engine's ceiling tests now count from the constant.
- **2026-11-06. Live pass: higher read limits.** Okey found the per-operation limits tight for broad research. Transcript reads go from 2 to 10, sharing the same 300,000 characters. Memory reads go from 2 to 5, full entries from 1 to 3, and analysis runs from 1 to 2 (ADR D11). The read limits' prompt sentences move with them, and every limit's test counts from its constant.
- **2026-11-06. Follow-up: reads that fit the window.** With 15 calls a turn, memory reads and file reads can fill the context window, and the turn then fails instead of answering. [The feature note](../../features/feature-workshop-reads-fit-the-window/README.md) plans three changes: every read fits itself with recall's rule, a guard in the engine ends a full turn with a reply, and `resource.read` reads several files in one call. It is ADR-first and outside this epic.
