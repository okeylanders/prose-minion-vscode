# Slice 2: Drafting in the memory sheet

**Status:** Built, in review.
**Branch:** `epic/helper-agent-slice-2-memory-draft`, from the Slice 1 head (`b7377ba0`).
**Decisions:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-helper-agent.md) D5.

## Scope

- **Routes.** `WORKSHOP_MEMORY_DRAFT_REQUEST` (webview → host) and `WORKSHOP_MEMORY_DRAFT_RESULT` (host → webview), contracts in `shared/types/messages/workshop/memoryDraft.ts`.
  - The request carries a webview-minted `requestId` and a `turnId`. It adds `sessionId` for a saved session's turn, and `roomRevision` for a bookmark outside the window.
  - The result echoes the id with an outcome (`drafted`, `off`, `unconfigured`, `refused`, `failed`, `malformed`). It carries a `draft` only when drafted.
- **`WorkshopMemoryDraftHandler`**, beside the project-memory handlers. It is built in `WorkshopSliceComposition` from `memoryDrafts` (the helper from `CoreServices` and the platform settings), which `MessageHandler` hands to `WorkshopRoomHandler`.
  - **Direct, not gated:** it writes nothing.
  - **The host reads the turn.** A live turn comes from the room's ledger: refused when the named room is not the open one, or the turn is gone or not bookmarkable. A saved turn comes only through recall's `savedTurn`, refused unless it is `turn` and `bookmarkable`.
  - **Both read the transcript projection** (`workshopTurnPreview` / `workshopTurnPreviewOfEntry`), cut by `workshopMemoryNoteFromTurn`, which now lives in `shared/constants/workshopProjectMemoryWrites.ts` so host and webview share it.
  - **The setting** is read when the request arrives. Off, it answers `off` and reads and sends nothing.
  - **One draft at a time:** a newer request aborts the earlier, and disposal aborts the one in flight.
  - **Logs** carry the request id and outcome or fault kind, never text.
- **Webview.**
  - `memory/workshopMemoryHelperDraft.ts` (pure) holds the request, the touched-field tracking, taking the answer, and the placeholder.
  - `memory/workshopMemorySheetState.ts` now holds the sheet's types, which moved out of the hook, re-exported unchanged; that made room for the seam.
  - The hook's seam:
    - `openSheet` asks when the sheet comes from a turn (`turn`, `saved-turn`);
    - `updateDraft` marks touched fields;
    - `handleMemoryDraftResult` takes the answer.
  - The hook is at 485 lines (was 498).
  - The preview that lands for a bookmark outside the window now fills only the note, so a draft that landed first keeps its title, summary and kind.
- **The sheet:**
  - title and summary show the placeholder `Drafting…` while it drafts;
  - when it couldn't draft, one muted `role="status"` line: "Couldn’t draft a title and summary.";
  - Save keeps its own rules.
- **The setting.** `proseMinion.workshop.memory.helperDrafts` (boolean, default `true`). `WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING` / `coerceWorkshopMemoryHelperDrafts`: only an explicit `false` turns it off.
- **Docs:** `memoryDraft.ts` joins the contract trees in `docs/ARCHITECTURE.md` and `.ai/central-agent-setup.md` (the ownership guard reads both).

## Tests

| Test | Covers |
|---|---|
| `WorkshopMemoryDraftHandler.test.ts` | a live turn read from the ledger by id, writer vs persona; webview text ignored; cut as the note; room changed or turn gone refused; outside the window by its room; saved turn only through `savedTurn`; recall refusals and not bookmarkable; setting off reads and sends nothing; only `false` is off; outcome mapping; a newer request aborts the older; logs carry no text; route registered |
| `useWorkshopProjectMemoryHelperDraft.test.ts` | asks by ids only; fills title, summary and kind; touched fields kept (an emptied one too); body never changed; correlation (closed, reopened, another sheet, a foreign id, the same answer twice); every failure outcome keeps the draft and sets the line; nothing filled into a saving sheet; Edit…, edit and New ask nothing; Remember this by session and turn; outside the window by room, the preview keeps the draft |
| `WorkshopMemorySheetHelperDraft.test.tsx` | placeholders not values; Save unchanged while drafting; the quiet line; neither once filled nor when nothing was asked |
| `useWorkshopAppMessageRouter.test.ts` | the result reaches the hook |
| `boundaries.test.ts` | the route's owner (direct; ledger 87 / 40 direct), the handler at the slice-composition tier, `memoryDraft.ts` in the contract trees |

## Implementation note

- **Setting off still shows the quiet line.** D5.6 lists "the setting off" among the failures, so the sheet shows the line then too. The webview doesn't know the setting: it posts, and the host answers `off` at once. A writer who turned drafting off sees "Drafting…" for a moment, then the line. If that reads wrong in the live pass, the change is small: the `off` outcome shows nothing.
- **The Memory tab doesn't show the setting.** The tab's settings ride on the conversation-settings path (`WorkshopConversationSettingsService`), which holds the room's live prompt settings. A switch that never enters a prompt doesn't belong there. It stays a VS Code setting; Slice 3 can revisit.
- **Projection, not `turn.content`.** The host reads a live turn through `workshopTurnPreview`, as export, recall and the outside-window sheet do. For a bubble in the window this is the same text the sheet's body holds.
- **`source`** is `writer` for the writer's messages and `persona` for replies and events (an eligible capability card projects as an event).
- **A save in flight** takes no fields from a late draft; the sheet keeps what is being saved.
- **`WorkshopRoomHandler.ts`** (1,672 lines, not on the epic's list) grows by three lines: the port's type import, its constructor parameter, and passing it on. `MessageHandler.ts` grows by two.
