# Slice 2: Drafting in the memory sheet

**Status:** Built, in review. The coordinator's two changes (setting off is silence; cancel on Close and disposal) and the PR #225 checks (A-01–A-05) are in.
**Branch:** `epic/helper-agent-slice-2-memory-draft`, from the Slice 1 head, with `epic/helper-agent` (the spec, the review, ADR D5.6–D5.7 as amended at `2d47d52f`) merged in.
**Decisions:** [ADR 2026-11-05](../../../../docs/adr/2026-11-05-helper-agent.md) D5.

## Scope

- **Routes** (contracts in `shared/types/messages/workshop/memoryDraft.ts`; the domain's union pieces are exported there, so the messages barrel names it once each way):
  - `WORKSHOP_MEMORY_DRAFT_REQUEST { requestId, turnId, sessionId?, roomRevision? }`. It never carries text.
  - `WORKSHOP_MEMORY_DRAFT_RESULT { requestId, outcome, draft? }`. The outcome is one of `drafted`, `off`, `unconfigured`, `refused`, `failed` or `malformed`.
  - `WORKSHOP_MEMORY_DRAFT_CANCEL { requestId }`: the sheet no longer waits.
  - `WORKSHOP_REQUEST_MEMORY_DRAFTS_SETTING` and `WORKSHOP_MEMORY_DRAFTS_SETTING { enabled }`: the switch, asked once mounted and pushed by `MessageHandler`'s config watcher when it changes.
- **`WorkshopMemoryDraftHandler`**, beside the project-memory handlers. It is built in `WorkshopSliceComposition` from `memoryDrafts` (the helper from `CoreServices` and the platform settings), which `MessageHandler` hands to `WorkshopRoomHandler`. Its three routes are direct, because it writes nothing.
  - **The turn is the host's to read.**
    - A live turn comes from the room's ledger. It is refused when the named room isn't the open one, or the turn is gone or not bookmarkable.
    - A saved turn comes only through recall's `savedTurn`. It is refused unless it is a `turn` and `bookmarkable`, and also when the room changed while it was read.
    - Both are read through the transcript projection (`workshopTurnPreview` / `workshopTurnPreviewOfEntry`), cut by `workshopMemoryNoteFromTurn`. That function is now in `shared/constants/workshopProjectMemoryWrites.ts`, shared with the sheet.
  - **The room** is read when the request arrives, before anything is awaited, and again after a saved turn's read.
  - **The setting** is read per request. When off, the handler answers `off` with no read and no model call.
  - **Stopping.** One call is in flight at a time. A newer request, the sheet's cancel and disposal each abort it, and a call the host stopped answers nothing.
  - **Logs** carry the request id and the outcome or fault kind, never text.
- **Webview.**
  - `memory/workshopMemoryHelperDraft.ts` (pure): the request, bound to its room; touched-field history; taking the answer; the placeholder; the in-flight id; the stopped sheet.
  - `memory/useWorkshopMemoryHelperDrafts.ts` (a sub-hook):
    - asks for the setting once mounted, and holds the host's answer;
    - `ask` gives a fresh opening its own request, and only while drafting is on;
    - `stop` posts the cancel and marks the draft `stopped`;
    - on unmount, stops a draft still out.
  - `memory/workshopMemorySheetState.ts` holds the sheet's types, moved out of the hook and re-exported unchanged.
  - **The hook's seam:**
    - `openSheet` stops the old sheet's draft, then asks;
    - `dismissSheet` (Close, a successful Save) stops it;
    - `submitSheet` stops it, which freezes the fields;
    - `updateDraft` marks touched fields;
    - `handleMemoryDraftResult` and `handleMemoryDraftsSetting` take the host's answers.

    The hook is 494 lines (was 498). `WorkshopApp` passes the room's revision.
  - **The outside-window preview** fills only the note, so a draft that landed first keeps its title, summary and kind.
- **The sheet:**
  - the title and summary show the placeholder `Drafting…` while it drafts;
  - when it couldn't draft, one muted `role="status"` line: "Couldn’t draft a title and summary.";
  - `off` and `stopped` show nothing;
  - Save keeps its own rules.
- **The setting:** `proseMinion.workshop.memory.helperDrafts` (boolean, default `true`), read through `WORKSHOP_MEMORY_HELPER_DRAFTS_SETTING` and `coerceWorkshopMemoryHelperDrafts`. Only an explicit `false` turns it off.
- **Docs:** `memoryDraft.ts` is added to the contract trees in `docs/ARCHITECTURE.md` and `.ai/central-agent-setup.md`. `AGENTS.md` is left for Slice 3.

## Tests

| Test | Covers |
|---|---|
| `WorkshopMemoryDraftHandler.test.ts` (35) | Reading, refusals, the setting, outcome mapping, lifecycle and logs: see the acceptance table below |
| `useWorkshopProjectMemoryHelperDraft.test.ts` | Correlation, touched fields, failure and silence, Save's freeze, stops, the setting, rooms: see below |
| `WorkshopMemorySheetHelperDraft.test.tsx` (6) | The placeholders, not values; Save's own rules; silence for `off` and `stopped`; the quiet line |
| `useWorkshopAppMessageRouter.test.ts` | The result and the setting reach the hook |
| `boundaries.test.ts`, `WorkshopRoomHandler.seams.test.ts` | The three routes' owner, direct (ledger 89 / 42 direct; 89 handlers); the handler at the slice-composition tier; `memoryDraft.ts` in the contract trees |

## Acceptance checks (PR #225 review, A-01–A-05)

The engine's half of A-04 and A-05 is tabled in [slice-1-engine.md](slice-1-engine.md).

| Check | How | Test |
|---|---|---|
| **A-01** Safe source | Live turns go through `workshopTurnPreview`, saved turns through `savedTurn` and `workshopTurnPreviewOfEntry`. No raw turn, session document, attachment, widget payload, evidence or archive reaches the helper. | `WorkshopMemoryDraftHandler.test.ts`: "never reads text the webview sent", "never hands the helper an attachment's body", "admits an eligible capability card through its safe event, never its evidence" |
| A-01 Eligibility | The bubbles' rule (`isWorkshopBookmarkableTurn`) for live turns, and `bookmarkable` for saved ones, never the projected kind. | "admits an eligible capability card…", "refuses a session marker…", "refuses a saved turn recall won't give, or one a bookmark may not mark" |
| A-01 Input bound | `workshopMemoryNoteFromTurn` (8,000 UTF-16 code units), on every path, the out-of-window one too. | "cuts the turn as the sheet's note is cut", "sends the out-of-window path the same bounded note as the sheet's" |
| A-01 Refusals make no call and no write | Forged ids; unknown, ambiguous, unreadable or now-live saved sessions; unknown turns; markers. | "refuses a forged id…", "refuses a saved turn recall reads as %s…" (each), "refuses a turn that is gone…", "writes nothing to the room, whatever it answers" |
| **A-01** The note the sheet holds (PR #231 F-01) | The helper drafts only from the sheet's own note. The request names it (`note`: `bubble` or `preview`). A capability card's bubble holds evidence the helper never reads, so its sheet (Save to memory…, an in-window Remember this) asks for nothing (`helperWithheld`). The host answers any bubble request whose raw note isn't its projection's `withheld`, with no model call. `withheld` renders as silence, like `off`. Outside the window, the sheet holds the projection and drafts. | `WorkshopMemoryDraftSource.integration.test.ts` (all seven); handler: "drafts an eligible capability card only from a sheet that holds its safe preview…", "withholds a capability card whose sheet holds the bubble / no note named…", "refuses a note it does not know…" |
| **A-02** Room binding | The revision is captured before the first await. Every live request carries one: the bookmark's own, else the room's at opening. It is checked again after a saved read. | "refuses a live turn asked for in a room since replaced, even one with the same turn id", "refuses a saved turn read across a room change…"; hook: "names the open room on a live turn's request…" |
| A-02 Fresh owner per opening | Each opening mints its own request. A result after Close, a reopen, another turn, a switch to New or Edit, a successful Save, or unmount changes nothing. | Hook: "takes only the open sheet's own answer…", "a successful Save closes the sheet; its late answer changes nothing", "a card's Edit…, a saved memory's edit and New ask for nothing", "stops a draft still out on Close, on another opening, on a switch to New, and on unmount" |
| A-02 Save freezes the draft | Submit stops the draft (`stopped`, cancel posted), so the fields shown are the ones submitted. | Hook: "Save freezes the fields…" |
| A-02 The late preview | Fills only the body; asks for no new draft. | Hook: "a room bookmark outside the window asks by its room, and the preview that lands later keeps the draft" |
| **A-03** Touched is history | Tracked per field, through every `updateDraft`. A field emptied again, or a kind set back to its default, stays touched; a fill never marks one. | Hook: "keeps every field the writer touched first…", "keeps a field the writer emptied again…", "counts a kind set back to its default as touched…" |
| A-03 Current state | The answer is applied to the sheet as it stands when it lands. | Hook: "applies the answer to the sheet as it is when it lands: typing in the same moment wins" |
| A-03 What never changes | The body, supersessions, the pin, and the source and provenance. A body edited while drafting is kept. | Hook: "keeps every field the writer touched first, and never changes the body", "counts a kind set back to its default… changes no supersession, pin or source" |
| A-03 Save's rules stay | Drafting adds no lock and lifts none. | Sheet: "keeps Save's own rules while it drafts…", "keeps Save as the draft's own rules leave it while it drafts" |
| **A-04** Output contract | Slice 1's codec. Only `drafted` with its three fields fills anything; every other outcome takes the failure path. | Slice 1's table; hook: "leaves the sheet as it was on %s, with the quiet line" |
| **A-05** Cancel and disposal | The sheet cancels on Close, Save, another opening and unmount, and the host aborts the call. Disposal aborts the call in flight, as does a newer request. | Handler: "aborts a stalled call when the sheet cancels it…", "aborts a stalled call when disposed", "answers nothing for a call it stopped…", "stops the draft before it when a newer request comes"; hook: "stops a draft still out on …" |
| A-05 After a timeout | `failed` ends the placeholder, and editing was never blocked. | Hook: "leaves the sheet as it was on failed…"; sheet: "says once, quietly…" |
| **D5.7** Off is silence | The webview knows the switch: when it's off, it posts nothing and shows nothing. A stray request is answered `off` with zero provider calls, and `off` renders as silence. | Hook: "asks the host whether drafting is on once mounted; off, a sheet asks for nothing and shows nothing", "reads an `off` answer… as silence"; handler: "answers a stray request `off` with zero provider calls…", "reads nothing and sends nothing with the setting off", "tells the webview whether drafting is on, by the one rule"; sheet: "is silent when off, or stopped" |

## Review (PR #231)

- **F-01: the helper and the sheet read different notes for capability cards.** Fixed by withholding, not widening.
  - The safe projection is unchanged, and capability evidence never reaches the helper.
  - Among bookmarkable turns, only a capability card projects differently from its own text: writer messages, replies and event artifacts project their content. The host's check is generic all the same: it compares the bubble's note with the projection's.
  - Astra's integration probes (eight) all pass. Of her source probes, the out-of-window, writer/reply and touched-subset cases pass. The bubble and in-window cases asserted a draft and now fail by design, because the sheet asks for nothing. Their corrected behavior is the new integration test.

## Implementation note

- **The Memory tab doesn't show the setting** (agreed). Its switches ride on the conversation-settings path, which holds settings that enter the room's prompts. This one doesn't, so it reaches the webview by its own small push.
- **Projection, not `turn.content`** (agreed). For a bubble in the window it is the same text the sheet's body holds.
- **Before the setting's first answer** the sheet asks, and the host answers `off` if it is off, which is silent. In practice the answer arrives at mount, long before any sheet opens.
- **`source`** is `writer` for the writer's messages and `persona` for replies and events.
- **Size.** Three files over 500 lines grow, each only by a seam:
  - `WorkshopRoomHandler.ts` (1,672 lines, not on the epic's list) grows by 3: the port's type import, its constructor parameter, the pass-through;
  - `MessageHandler.ts` grows by 8 (the port, and the setting's push);
  - `WorkshopApp.tsx` grows by 0 lines (one changed).

  `shared/types/messages/index.ts` stays at 497.
