# Slice 1: Recall Reads Bookmarks

**Epic:** [Workshop Bookmark Recall](README.md)
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-bookmark-recall.md), D1–D7
**Status:** Planned

## Outcome

A persona can call `transcript.bookmarks` to get saved sessions' bookmarks, each with its full message, within stated bounds. In a session read, a bookmarked turn's header carries its label. Nothing else a persona receives changes.

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

### The operation, everywhere (D4)

Follow the list in ADR D4 and Project Memory D12. Most items match how `transcript.todos` is built:
- `workshopCapabilities.ts`: the list, the family, the request union.
- `WorkshopTranscriptRecallXmlCodec.ts`: the operation guard, the switch, the validators.
  - `<query>`: at most `bookmarkQueryCharacters`.
  - `<speaker>`: a persona id or label, a tool id, or `writer`.
  - `<since>` and `<until>`: `YYYY-MM-DD`, with `since ≤ until`.
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
- the live room's bookmarks never appear anywhere a persona reads.

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
- **Service:** the live room is never read; unknown and live session ids get the shared copy; cache reuse works.
- **End to end:** through the real persona capability, a call produces a card, the card persists, and it is published to the room.
- **Read marks:** a bookmarked turn's header in `transcript.read`; export and the preview unchanged.
- **Isolation:** the rewritten pin.

## Completion Criteria

- [ ] `transcript.bookmarks` works end to end with every filter and bound, and its prompt is held to the code.
- [ ] `transcript.read` marks bookmarked turns; export and the preview are unchanged.
- [ ] Bookmarks reach a persona only through recall, never from the live room.
- [ ] The Wayfinding fixture reads unchanged.
- [ ] The epic's per-slice verification passes. Counts are recorded.
