# Slice 1: Recall Reads Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D1–D7
**Status:** Planned

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
- **The rows.** Each open-room row carries "this conversation" and the turn's position, never a session id.
- **Recall's other operations stay put.** `transcript.catalog`, `.search`, `.read` and `.todos` still never read the open room. Only `transcript.bookmarks` takes the port.

### The operation, everywhere (D4)

Follow the list in ADR D4 and Project Memory D12. Most items match how `transcript.todos` is built:
- `workshopCapabilities.ts`: the list, the family, the request union.
- `WorkshopTranscriptRecallXmlCodec.ts`: the operation guard, the switch, the validators.
  - `<query>`: at most `bookmarkQueryCharacters`.
  - `<speaker>`: a persona id or label, a tool id, or `writer`.
  - `<since>` and `<until>`: `YYYY-MM-DD`, with `since ≤ until`.
  - `<scope>`: `current`, `saved` or `all`, with `all` the default. `<recent>`, `<session>`, `<match>` and `<persona>` are refused with `current`.
  - `<session>`: repeatable, so it goes in `FIELD_POLICY`.
  - `<recent>` and `<session>` are exclusive.
  - New rejection reasons join `WorkshopCapabilityRejectionReason`.
- `WorkshopCapabilityXmlCodec.inspect`: add the case by hand. It has no guard, so write a test proving the new operation reaches it.
- `WorkshopPersonaCapability.ts`: its six operation switches.
- The recall capability's `fulfill` switch and port `Pick`.
- `WorkshopTranscriptRecallRequestCopy.ts`: its four switches.
- **The service.** Add a `bookmarks()` method to `WorkshopTranscriptRecallService`, through `withCorpus`. Put the session choice and the bookmark filter in `WorkshopRecallCorpusSelection.ts`, beside `selectWorkshopRecallTodos`.
- **The renderer.** Add a new `recall/WorkshopRecallBookmarkList.ts`, modelled on `WorkshopRecallTodoList.ts`:
  - the framing line;
  - grouping by session;
  - each item whole or not at all, with its message capped and a hint;
  - every bound stated;
  - a minimum-size guard.
- **Persisted card (D6).** Add `transcript_bookmarks` to `WORKSHOP_TURN_ARTIFACTS` and to `WorkshopSessionService`'s artifact switch. The load/save guard comes with it.
- **Publication (D7).** Add the operation to `PUBLISHABLE_CAPABILITY_OPERATIONS`, then update `guest-base.md` and the recall prompt's "shared with the room" line.
- **Budgets (D3).** Add them to `PROMPT_BUDGETS.workshopTranscriptRecall` (type and values), with the pin in `promptBudgets.test.ts`.
- **Prompt.** In `transcript-recall-capability.md`, "four" becomes "five". Add the grammar, a worked example, and every number. Update `transcriptRecallPromptSync.test.ts`: the number pins, the example list and count, and any hint forms.
- **Other tests.** `workshopPersonas.test.ts` (the tag and the `named()` switch), `workshopCapabilityFamily.test.ts`, `WorkshopCapabilityFamilies.test.ts`, `WorkshopRoomAudience.test.ts`, `WorkshopPersistedTurnGuards.test.ts` (its list and its count), and `WorkshopTranscriptRecallWiring.test.ts`.

### Read marks (D5)

- **Where.** `WorkshopRecallReadWindow.ts`'s `renderEntry` header line gains `bookmarked: "{label}"` for a bookmarked turn, fed from the document's bookmarks.
- **What stays put.** The shared projection's `bookmarked` field is still set only by export. Export and the turn preview are unchanged, and a test pins that.

### The D10 pin, rewritten (D1, D4)

`WorkshopTranscriptRecallBookmarks.test.ts` pins the new rule:
- bookmarks appear in `transcript.bookmarks` and in read marks;
- bookmarks never appear in a room frame, a catch-up, provider history or the catalog frame;
- the open room's bookmarks appear only in `transcript.bookmarks`, filtered by audience.

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
- **Publication:** a published result never carries a row from a private exchange to a persona outside it.
- **End to end:** through the real persona capability, a call produces a card, the card persists, and it is published to the room.
- **Read marks:** a bookmarked turn's header in `transcript.read`; export and the preview unchanged.
- **Isolation:** the rewritten pin.

## Completion Criteria

- [ ] `transcript.bookmarks` works end to end with every filter and bound, and its prompt is held to the code.
- [ ] `transcript.read` marks bookmarked turns; export and the preview are unchanged.
- [ ] Bookmarks reach a persona only through `transcript.bookmarks` and read marks. Open-room rows are filtered by what the asking persona could see.
- [ ] The Wayfinding fixture reads unchanged.
- [ ] The epic's per-slice verification passes. Counts are recorded.
