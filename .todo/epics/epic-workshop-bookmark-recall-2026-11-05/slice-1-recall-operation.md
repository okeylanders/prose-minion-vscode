# Slice 1: Recall Reads Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D1–D7
**Status:** Done (branch `epic/workshop-bookmark-recall-slice-1-recall-operation`, cut from the epic at `8e9b612`; PR #215). See the [implementation note](#implementation-note).

## Outcome

A persona can call `transcript.bookmarks` to get bookmarks from the open room and saved sessions, each with its full message, within stated bounds. From the open room, it sees only bookmarks on turns it could see. In a session read, a bookmarked turn's header carries its label. Nothing else a persona receives changes.

## Build

### First: split the recall capability

`recall/WorkshopTranscriptRecallCapability.ts` is 496 lines.
- Move each operation's adapter (catalog, search, read, todos) into its own module, so the file only dispatches.
- Do this in one refactor commit with no behavior change, before adding anything.
- Every new module joins `WORKSHOP_RECALL_MODULES` (`boundaries.test.ts`).

### The recall document carries bookmarks (D5)

- **The builder.** `buildWorkshopRecallDocument` (`recall/WorkshopRecallDocument.ts`) gets the whole `WorkshopPersistedSessionV2` and today ignores `workshop.bookmarks`. Copy each bookmark field by field, the way `recallTodo` does:
  - `id`, `turnId`, `label?` and `createdAt`;
  - the turn's position;
  - the resolved label (`workshopBookmarkDefaultLabel`) when none is stored;
  - the speaker.
- **The cache bound.** Count the bookmarks in `characters`.
- **Dangling bookmarks.** Named reads already drop them at decode (`WorkshopSessionCheckpointNormalization`).

### The open room, through one read-only port (D1, Q1)

- **The port.** Define `WorkshopLiveRoomBookmarks` in `recall/`, for example `read(audience): { bookmarks with projected turns } | unavailable`.
  - The session service implements it over the live bookmark ledger and `readRoomLedger()`.
  - Recall imports it as a type only. It never imports the session service, and never writes or flushes (`boundaries.test.ts`).
- **Filtering by audience.** Only turns the asking persona could see qualify: room-visible turns, and private exchanges it was part of. Use the room's own audience rule (`WorkshopRoomAudience`), never a copy of it.
- **The rows.** Each open-room row carries "this conversation", the turn's id and position, and the bookmark's qualified ref (`current@{liveSessionId}/{bookmarkId}`) (F-06, F-07).
- **Recall's other operations stay put.** `transcript.catalog`, `.search`, `.read` and `.todos` still never read the open room. Only `transcript.bookmarks` takes the port.

### The operation, everywhere (D4)

Follow the list in ADR D4 and Project Memory D12. Most items match how `transcript.todos` is built:
- `workshopCapabilities.ts`: the list, the family, the request union.
- `WorkshopTranscriptRecallXmlCodec.ts`: the operation guard, the switch, the validators.
  - `<query>`: at most `bookmarkQueryCharacters`.
  - `<speaker>`: a persona id or label, a tool id, or `writer`.
  - `<since>` and `<until>`: `YYYY-MM-DD` calendar days in the holding session's own zone (the open room's zone for the open room). `<until>` includes the whole day. An impossible or malformed date, or `since` later than `until`, is `invalid-date`.
  - `<bookmark>` and `<from>`: one bookmark's whole message in windows (F-07).
    - `<bookmark>` takes a qualified ref: `{sessionId}/{bookmarkId}` or `current@{liveSessionId}/{bookmarkId}`. It accepts only `<from>` beside it.
    - A malformed ref is refused at the codec. An unknown or stale source (`stale-bookmark-ref`) is refused by the service.
    - `<from>` is a character offset within the message.
  - `<scope>`: `current`, `saved` or `all`, with `all` the default. `<recent>`, `<session>`, `<match>` and `<persona>` are refused with `current`.
  - `<session>`: repeatable, so it goes in `FIELD_POLICY`.
  - `<recent>` and `<session>` are exclusive.
  - New rejection reasons join `WorkshopCapabilityRejectionReason`.
- `WorkshopCapabilityXmlCodec.inspect`: add the case by hand. It has no guard, so write a test proving the new operation reaches it.
- `WorkshopPersonaCapability.ts`: its six operation switches.
- The recall capability's `fulfill` switch and port `Pick`.
- `WorkshopTranscriptRecallRequestCopy.ts`: its four switches.
- **The service.** Add a `bookmarks()` method to `WorkshopTranscriptRecallService`, through `withCorpus`. Put the session choice and the bookmark filter in `WorkshopRecallCorpusSelection.ts`, beside `selectWorkshopRecallTodos`.
- **Publication (D7, F-05).** The service marks the result unpublishable if any open-room row stands on a turn the room couldn't see, and gives the reason by id. `WorkshopRoomAudience` reads that mark. It never filters rows.
- **The renderer.** Add a new `recall/WorkshopRecallBookmarkList.ts`, modelled on `WorkshopRecallTodoList.ts`:
  - the framing line;
  - grouping by session;
  - each item whole or not at all, with its message capped, and a `<bookmark>`/`<from>` hint that fetches the rest;
  - the `<bookmark>` form's window, with its own continuation hint;
  - every bound stated;
  - a minimum-size guard.
- **Persisted card (D6).** Add `transcript_bookmarks` to `WORKSHOP_TURN_ARTIFACTS` and to `WorkshopSessionService`'s artifact switch. The load/save guard comes with it.
- **Publication (D7).** Add the operation to `PUBLISHABLE_CAPABILITY_OPERATIONS`, then update `guest-base.md` and the recall prompt's "shared with the room" line.
- **Budgets (D3).** Add them to `PROMPT_BUDGETS.workshopTranscriptRecall` (type and values), with the pin in `promptBudgets.test.ts`.
- **Prompt.** In `transcript-recall-capability.md`, "four" becomes "five". Add the grammar, a worked example, and every number. Update `transcriptRecallPromptSync.test.ts`: the number pins, the example list and count, and any hint forms.
- **Other tests.** `workshopPersonas.test.ts` (the tag and the `named()` switch), `workshopCapabilityFamily.test.ts`, `WorkshopCapabilityFamilies.test.ts`, `WorkshopRoomAudience.test.ts`, `WorkshopPersistedTurnGuards.test.ts` (its list and its count), and `WorkshopTranscriptRecallWiring.test.ts`.

### Read marks (D5)

- **Where.** In `WorkshopRecallReadWindow.ts`, both renderers carry the mark: `renderEntry`'s header line, and `collapsedReport` for `discussion` detail's one-line tool reports (F-04). The mark reads `bookmarked: "{label}"`, fed from the document's bookmarks. It counts toward the packing bounds and the full-read hint.
- **What stays put.** The shared projection's `bookmarked` field is still set only by export. Export and the turn preview are unchanged, and a test pins that.

### The D10 pin, rewritten (D1, D4)

`WorkshopTranscriptRecallBookmarks.test.ts` pins both halves of D1 (F-01):
- **Nothing automatic.** Setting, clearing or renaming a live bookmark changes no frame, catch-up, catalog frame or per-turn prompt.
- **Requested evidence.** A requested result (list or read mark) is retained, survives save/reopen, and is published only as D7 allows.
- **The open room.** Its bookmarks appear only in `transcript.bookmarks`, filtered by audience.

## Tests

- **Document:** bookmarks copied with their positions and resolved labels, counted in the size.
- **Wayfinding fixture:** a session saved by the Wayfinding release (with labelled and unlabelled bookmarks) reads unchanged.
- **Codec:**
  - every field, valid and invalid;
  - exclusivity;
  - repeated `<session>` up to its bound;
  - dates in order and out of order;
  - unknown and empty fields.
- **Selection:**
  - session choice by `recent`, `session`, `match` and `persona`;
  - item filters by `query`, `speaker` and the dates;
  - bounds applied in the stated order.
- **Renderer:**
  - whole items only;
  - a message cut at its cap, with a hint that decodes as written;
  - every bound in the footer;
  - the minimum-size guard.
- **Service:**
  - `<scope>` picks the right sources, with the open room first;
  - the open room is filtered by audience, so a private exchange the asking persona wasn't in never appears (a guest and a host case, through the real room);
  - other recall operations still never read the open room;
  - unknown session ids get the shared copy;
  - cache reuse works.
- **Publication (F-05):**
  - a mixed result (a public row and a private sentinel) is not published;
  - through reply commitment, the host's and another guest's catch-up, and save/reopen, the sentinel never crosses;
  - an all-public result is published.
- **End to end:** through the real persona capability, a call produces a card, the card persists, and it is published to the room.
- **Read marks:**
  - a bookmarked turn's header in a full read;
  - a bookmarked tool report in single-session `discussion` and in a default multi-session read;
  - packing bounds and the full-read hint still hold;
  - export and the preview are unchanged.
- **Dates:** a UTC/local-day boundary, a DST change, `<until>` including its whole day, and impossible dates refused.
- **One bookmark in full:**
  - an open-room bookmarked message over 4,000 characters, read to its end through the real codec and service by following its hints, including a caller that no longer holds the original message;
  - a guest refused for a turn it couldn't see;
  - the same bookmark id in two saved sessions (one branched from the other, and two with the same clock), where each ref reads its own message;
  - the same id in the open room and a saved session, where neither shadows the other;
  - an open-room ref after New, Open and Branch, refused as stale.
- **Isolation:** the rewritten pin.

## Completion Criteria

- [x] `transcript.bookmarks` works end to end with every filter and bound, and its prompt is held to the code.
- [x] `transcript.read` marks bookmarked turns; export and the preview are unchanged.
- [x] Bookmarks reach a persona only through `transcript.bookmarks` and read marks. Open-room rows are filtered by what the asking persona could see.
- [x] The Wayfinding fixture reads unchanged.
- [x] The epic's per-slice verification passes. Counts are recorded.

## Implementation Note

**Commits:** `6926a58` (the split), `89337398` (the operation), `80ad0e5` (its tests), then this note.

### Files

- **The split (no behavior change).** `recall/WorkshopTranscriptRecallCapability.ts` went from 496 lines to a dispatcher. Each operation's adapter is its own module: `WorkshopRecallCatalogOperation.ts`, `WorkshopRecallSearchOperation.ts`, `WorkshopRecallReadOperation.ts` (a class: the turn's read counts are its state) and `WorkshopRecallTodosOperation.ts`. What they share is in `WorkshopRecallOperationResults.ts`.
- **New in `recall/`:**
  - `WorkshopRecallBookmarks.ts`: the one builder of bookmark rows, for saved documents and the open room alike. It copies fields one by one, takes the label from `workshopBookmarkDefaultLabel` and names the speaker. A capability card's speaker is the persona that asked for it.
  - `WorkshopLiveRoomBookmarks.ts`: the port, types only.
  - `WorkshopRecallBookmarkRef.ts`: the ref grammar, shared by the codec and the renderer.
  - `WorkshopRecallBookmarkResults.ts`: the result types.
  - `WorkshopRecallBookmarkQuery.ts`: the list and the one-bookmark read over an opened corpus. It keeps `WorkshopTranscriptRecallService.ts` at 487 lines.
  - `WorkshopRecallBookmarkList.ts`: the renderer.
  - `WorkshopRecallBookmarksOperation.ts`: the adapter.
- **The host's side of the port** is `workshop/WorkshopLiveRoomBookmarkReader.ts`. It is not in `session/`, because it owns no state. It is built only in `extension.ts`, over the session service and the time service's timezone. The session service's seam is `readRoomBookmarks()`.
- **Changed:**
  - `WorkshopRecallDocument.ts` (bookmarks, counted in `characters`) and `WorkshopRecallCorpusSelection.ts` (`bookmarkCandidates`, `selectWorkshopRecallBookmarks`).
  - `WorkshopRecallReadSection.ts` and `WorkshopRecallReadWindow.ts` (D5 marks), and `WorkshopTranscriptRecallResults.ts` (a read carries its session's bookmarks).
  - `WorkshopRoomAudience.ts`:
    - `transcript.bookmarks` joins the publishable set;
    - `workshopCapabilityPublicationWithheld` reads the D7 stamp;
    - `isWorkshopTurnVisibleToParticipant` is the join snapshot's rule, now named. `WorkshopRoomDeliveryService` calls it.
  - Every D4 list: `workshopCapabilities.ts`, `WorkshopTranscriptRecallXmlCodec.ts`, `WorkshopCapabilityXmlCodec.ts` (its reasons and `inspect`), `WorkshopPersonaCapability.ts` (six cases), `WorkshopTranscriptRecallRequestCopy.ts`, `WorkshopSessionService.ts` (the artifact switch), `session.ts` (`transcript_bookmarks`), `promptBudgets.ts`, `WorkshopCapabilityResultLog.ts` (it names a withheld reason), `index.ts` and `extension.ts`.
  - Prompts: `transcript-recall-capability.md` and `guest-base.md`. `AGENTS.md` gains a "Bookmarks and the open room" rule under Session Recall.

### Tests, by completion criterion

- **End to end, every filter and bound, the prompt held to the code:**
  - `WorkshopTranscriptRecallXmlCodec.bookmarks.test.ts`: every field, valid and invalid; exclusivity; repeated `<session>`; dates; refs; `<from>`. It goes through `inspect`, so it also proves the operation reaches it.
  - `WorkshopRecallBookmarkSelection.test.ts`: session choice; filters; bound order; a UTC/local-day boundary; a DST change; `<until>` whole.
  - `WorkshopRecallBookmarkList.test.ts`: whole items; a cut message whose hint decodes; every bound in the footer; the hard cap; the minimum guard; windows to the end; surrogate pairs.
  - `WorkshopRecallBookmarksOperation.test.ts`: the reader; the window clamp; the D7 stamp and its log line.
  - `WorkshopTranscriptRecallService.bookmarks.test.ts`:
    - scopes, with the open room first;
    - other operations never read the port;
    - unknown sessions get the shared copy;
    - cache reuse;
    - an open-room message over 4,000 characters followed to its end through the codec, by fresh callers;
    - a guest refused a turn it couldn't see;
    - same-id collisions: a branch, two sessions on one clock, and the open room beside a saved session;
    - stale refs after New, Open and Branch.
  - `WorkshopTranscriptRecallWiring.test.ts` and `WorkshopTranscriptRecallPersistence.test.ts`: a card through the real persona capability, persisted, reopened and published.
  - `transcriptRecallPromptSync.test.ts`: the numbers, the three new examples, and the two bookmark hint forms, both ways against the renderer.
  - `promptBudgets.test.ts`.
- **Read marks; export and preview unchanged:** `WorkshopRecallReadMarks.test.ts`. It covers a full read, a collapsed report in a one-session discussion read and in the default multi-session read, the hints, the bounds, and the projection, preview and export.
- **Only on request, filtered by audience:**
  - `WorkshopTranscriptRecallBookmarks.test.ts`, the rewritten pin:
    - setting, renaming and clearing bookmarks sends byte-identical requests;
    - saved catalogs, searches and to-dos show none;
    - a mixed open-room result with a private sentinel never reaches the host or another guest, through commitment, catch-up, the join snapshot and reopen. An all-public one is published.
  - `WorkshopRecallBookmarks.test.ts`: the port and the audience rule.
  - `WorkshopRoomAudience.test.ts` and `boundaries.test.ts`. The boundary test checks that recall never imports the session service or the reader, that the port is types only, and that recall modules stay at 500 lines or fewer.
- **Wayfinding fixture:** `WorkshopRecallBookmarks.test.ts`, over `fixtures/workshop-session-v2-wayfinding-bookmarks.json`.
- **Also widened:** `workshopPersonas.test.ts`, `workshopCapabilityFamily.test.ts`, `WorkshopCapabilityFamilies.test.ts`, `WorkshopPersistedTurnGuards.test.ts`, `WorkshopCapabilityResultLog.test.ts` and `providerAssembly.test.ts` (the port's construction is pinned).

### Readings the ADR left open

In each case I took the more conservative reading.

1. **Hints followed together.** `<bookmark>` reads one bookmark (D2), so two cut-message hints written in one call are refused as `duplicate-field`. The prompt teaches this with a refused example, and the sync test pins it. Each hint decodes alone, as written.
2. **Refs the service refuses.** All of these are `stale-bookmark-ref`, each with a `why`:
   - an open-room ref to a replaced room (`room-replaced`);
   - a saved ref to the session that is now open (`now-open`);
   - a saved ref to no saved session (`no-session`).

   A bookmark on a turn the reader couldn't see reads the same as a missing one (`unknown-bookmark`), so a private turn's bookmark is never confirmed to exist.
3. **Saved-session rows never withhold a result.** That is recall's existing rule for saved turns. Only open-room rows on turns the room couldn't see stamp it. A one-bookmark read is stamped by the same rule.
4. **The window clamp.** Both lists and one-bookmark windows are clamped to half the free window. Neither counts against `readsPerTurn` or the per-turn read total, which D3 doesn't ask for. The clamp bounds each call.
5. **`bookmarkFromMax` is 999,999,** six digits like a turn number. Past it a cut message says it can't be read further by ref, rather than emit a hint the codec would refuse. A window that stops there says how much is left and never claims the message ended (PR #215 F-01).
6. **Small filter rules.**
   - A `<query>` with no words admits nothing, never everything.
   - A bookmark whose time no Date can hold is left out when a date filter is set.
   - With no owner on the turn, only room-visible rows qualify.
7. **The fixture is derived, not captured.** It is the Wayfinding-era `workshop-session-v2-before-memory.json` with an unlabelled bookmark added, in the shape the Wayfinding release writes. It is not a file captured from that release build.

### Deferred

Nothing in this slice. The Bookmarks screen and "Remember this" are Slices 2 and 3. Native behavior (a real model following the grammar) is the Slice 4 live pass.

### Verification

- `npm run typecheck`: clean (core, webview, extension).
- `npm run lint`: 0 errors, 1,165 warnings (the baseline; none new).
- `npx jest`: **735 suites / 10,328 tests / 59 snapshots**, all passing (baseline 728 / 10,239 at `f298098`).
- `grep -rn "from 'vscode'" packages/core/src`: no imports (three hits are pre-existing test strings).
- File sizes: every new file is under 500 lines. Existing large files grew by their seam only: `WorkshopSessionService.ts` 2,717 → 2,724, `WorkshopPersonaCapability.ts` 951 → 957, `promptBudgets.ts` 791 → 812 (the D3 bounds). `WorkshopApp.tsx` is untouched.
