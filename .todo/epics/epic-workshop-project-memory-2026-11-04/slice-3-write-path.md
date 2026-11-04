# Slice 3: Write Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D4 (writes, supersession), D5 (the pinned budget on edit), D6, D7, D8 (Ask first and the writer's own paths), D9, D10 (owed writes)
**Branch:** `epic/workshop-project-memory-slice-3-write-path`, from Slice 2a's head (`7ec50ba4`)
**Status:** Built, verified and pushed, the fold with 2b's delivered view included (PR #200). This doc is PR #196's version, with the progress below.

## Outcome

A persona can propose a memory with a reply trailer. The writer sees a card under
the bubble and saves, edits or dismisses it. Every save leaves a receipt turn
that the whole room sees. The writer can also save any eligible bubble with
**Save to memory…**. Supersession works. Save and tell me is not in this slice:
under `auto` a proposal behaves as under `ask` until Slice 5.

## Since Slice 2

- The library reads. This slice gives it writes: `save`, `update`, `archive`
  (Forget), each owed until it settles, plus `shutDown()`, which joins
  `shutDownExtension` (`apps/vscode-extension/src/application/extensionShutdown.ts`)
  beside the Lightbox's drain.
- The catalog frame is untouched: a save mid-room never rewrites it (D5).
- Slice 2's delivery record folds snapshots. This slice adds receipts to the
  fold. A receipt carries the memory's `version` (D7), and counts as delivered
  to each conversation room delivery has handed it to, so a save in this room
  never comes back as an update note.

## Build

### Trailer codec and stripping (D6)

- **The tail extractor** (ADR D6, PR #192 F-01):
  `utils/workshopReplyControls.ts` (pure),
  `extractWorkshopReplyControls(reply)` → `{ rest, memory, redacted }`.
  - It removes every `<prose-minion-memory-proposal>` frame (to its close, or
    to the end when unclosed).
  - `memory` is `none`, `proposal`, or `rejected` with
    `misplaced | duplicate | malformed:<reason> | memory-off`.
  - `rest` is the reply without memory frames: what the widget inspector,
    `inspectWorkshopActionableFindings`, display and retention read.
  - `redacted` is the reply with each frame replaced by
    `[project memory proposal removed]`: what every log and diagnostic reads.
  - Completion (`WorkshopRunCompletion.ts:253-315`) calls it first, and passes
    `rest` and `redacted` on. Retention composes it ahead of the widget
    sanitizer in `retainedAssistantContentSanitizer` (`AssistantToolService.ts:609`,
    `:676`, `:734`).
  - The widget instruction (`WorkshopWidgetRecommendationOperations.ts:103-115`)
    allows a project-memory proposal after the widget frame. Its prompt test
    moves with it.
- `utils/workshopMemoryProposalProtocol.ts` (pure): decodes the one eligible
  frame against closed element names, the D4 and D11 bounds, and refuses
  provenance elements. `supersedes` repeats up to 8; each must name a listed
  memory, or it's dropped with a card note.
- **Control-only replies:** with no prose left, the host writes the display
  line ("Proposed a project memory.", or today's widget-only note). The turn
  isn't attributed to a model, and retained history holds that host line.
- The phrasing fence (D9): `WorkshopMemoryProposalPhrasing` reads only
  sentences about the writer, and withholds with a logged reason (never text).
  Its stated limits go in its header.
- With memory Off, a trailer is still stripped from the bubble and history,
  then dropped with a log line and no card (ADR D8). A card pending from
  before the switch keeps its *Save*.
- This covers host and guest replies alike.

### Persisted proposal and receipt (D6, D7)

- `WorkshopTurn.memoryProposal?` and `WorkshopTurn.projectMemoryReceipt?` (D6, D7
  shapes). Each has its own codec module (`session/WorkshopMemoryProposalRecords.ts`,
  `session/WorkshopMemoryReceiptRecords.ts`), called from the shape file.
- Optional, written only when present, refused on turns that can't carry them,
  and covered by a pre-memory fixture (`workshop-session-v2-before-memory.json`)
  that reads and saves byte for byte.
- Rewind and Branch carry a proposal with its turn (`rewindWorkshopSession`), and
  New clears it with the room. Memory *files* aren't room state: Rewind never
  un-saves a memory.
- The transcript projection (`projectWorkshopTranscriptTurn`) shows a receipt as
  an event line and omits a pending proposal's body. Export and recall follow it.
  Add a test for each.

### Routes and the card

- Messages (`shared/types/messages/workshop/projectMemory.ts`):
  - `WORKSHOP_MEMORY_PROPOSAL_ACTION { turnId, action: 'save' | 'dismiss', edited? }`;
  - `WORKSHOP_SAVE_TURN_TO_MEMORY { turnId, draft }`;
  - their results.
- `WorkshopProjectMemoryHandler` (new route owner, composed in
  `WorkshopSliceComposition`) calls the library. Mutations join the room's
  mutation gate, record the receipt turn, and post the snapshot.
- The snapshot projects a proposal card's display fields. The card renders
  under the bubble (`WorkshopTurnBubble`): title, kind, summary, the body
  expandable, and *Save*, *Edit*, *Dismiss*.
- **This slice owns the memory sheet and the write routes** (PR #192 F-03). One
  sheet component, `WorkshopMemorySheet`, has three modes: *Edit* (a card or a
  saved memory), *Save to memory…* (a bubble as source), and *New* (no source).
  It's bounded by the same rules as the codec. `WorkshopProjectMemoryHandler`
  owns the write routes:
  - `WORKSHOP_MEMORY_PROPOSAL_ACTION`;
  - `WORKSHOP_SAVE_TURN_TO_MEMORY`;
  - `WORKSHOP_MEMORY_CREATE { draft }`;
  - `WORKSHOP_MEMORY_UPDATE { memoryId, patch }`.

  Slice 4b reuses the sheet and these routes; it adds no write route of its
  own beyond pin, archive and delete.
- **Save to memory…** appears on the bubbles bookmarks allow (ADR 2026-11-03
  D5's eligibility). The source is that turn, and `origin` is `writer`.

### Library writes (D4, D10)

- `save(draft, provenance)` mints an id inside the store's queue and writes
  `origin` `proposed` or `writer`. Superseding writes one new file only.
- `archive(id)` and `update(id, patch)` are claimed rewrites in place.
  `update` stamps `updated` only for a change to what the memory says.
- **Pinned budget on edit** (ADR D5, PR #192 F-04): `update` of a pinned memory
  re-checks the pinned bodies against `pinnedTokens` with the frame's renderer
  and estimator, and refuses a save that would pass it, with the reason. The
  UI copy is Slice 0d's: "Can't save this edit: this memory loads in full, and
  the longer note would bring memories loaded in full to about 5,300 of 5,000
  tokens. …" The UI says "Always load in full" and "Loaded in full", never
  "pin" (Slice 0d decision 16); code keeps `pinned`. Nothing is turned off
  automatically.
- Every write is owed. Logs carry ids and reasons only.

### Prompt

`resources/system-prompts/workshop-personas/project-memory-proposals.md` covers:
when to propose (a decision landed, a fact settled, the writer asked); the
trailer; kinds; bounds; supersession; and the never-list (D9). It's included
only when the mode isn't `off`. A sync test pins its numbers to
`PROMPT_BUDGETS.workshopProjectMemory`, and its example decodes through the
production codec.

## Tests

- **Extractor and codec (F-01):** every row of ADR D6's outcome table:
  - both valid (card and widget);
  - memory before the widget (memory `misplaced`, widget stands);
  - duplicates;
  - malformed and unclosed frames;
  - memory off;
  - control-only replies with no prose;
  - every decode rejection, provenance refused.
- **No memory text in any diagnostic (F-01):** a sentinel in a proposal's
  title, summary, body and `supersedes` never appears in any log line across
  every outcome above. That covers the widget-rejection dump
  (`boundedLogText`), the actionable-findings log, the phrasing fence's log,
  and the library's and store's logs.
- **Codec:**
  - stripping in both the bubble and retained history (the persona's next turn
    never sees its own trailer).
- **Phrasing:** writer-directed personal inference withheld; a character's
  feelings kept.
- **Card flow through real routes:** save, edit-then-save, dismiss, each behind
  the gate, each posting a snapshot. A save writes a file and a receipt.
- **Receipt:** delivered to other participants as room history, shown in
  export, and its body is never the memory's body. A save in this room
  never comes back as an update note: a participant the receipt hasn't reached
  yet gets the receipt and no note in the same delivery.
- **Persistence:** round-trip, the pre-memory fixture, refusal on the wrong turn
  kind, Rewind and Branch carry, New clears.
- **Supersession:** the new file names the old one, the old one reads as
  superseded and leaves the catalog, and the old file is untouched on disk.
  Forgetting (archiving) the newer memory keeps the old one superseded (N-01).
  Slice 4b tests Delete separately.
- **Pinned edit refused past budget (F-04):** enlarging a pinned body past
  `pinnedTokens` is refused with the reason, and the file is unchanged.
- **Two windows:** two libraries on one folder save at once and both files
  stand.
- **Deactivation:** a save in flight is awaited by `shutDownExtension`.

## Completion Criteria

- [x] A proposal shows as a card, never as reply text, and the persona's
      retained history never holds the trailer.
- [x] Nothing is saved without the writer's action in this slice.
- [x] Every save leaves a receipt the room sees.
- [x] Save to memory… works on eligible bubbles.
- [x] Sessions without the new fields are unchanged on read and write.
- [x] Owed writes drain at deactivation.
- [x] The epic's per-slice verification passes, with counts recorded here.
- [x] Receipts join 2b's delivered-view fold, so a save in this room never
      comes back as an update note.

## Built

| Piece | Where |
|---|---|
| The tail's one owner (F-01) | `utils/workshopReplyControls.ts` (pure): `extractWorkshopReplyControls(reply, { memoryOpen })` → `{ rest, redacted, memory }`. Removes every frame (to its close, or the end when unclosed; a stray closing tag too); `memory` is `none`, `proposal`, or `rejected` (`misplaced`, `duplicate`, `memory-off`, `malformed:<reason>`). `sanitizeWorkshopReplyForRetention` composes it ahead of the widget sanitizer; `AssistantToolService` hands it to the engine at all three sites |
| Trailer codec | `utils/workshopMemoryProposalProtocol.ts` (pure): closed elements, the format's bounds, provenance elements refused, `supersedes` up to 8, deduplicated |
| Completion | `WorkshopRunCompletion` calls the extractor first; findings, the widget inspector and display read `rest`; the widget-rejection dump reads `redacted`. A control-only reply shows "Proposed a project memory." (or the widget note), unattributed to a model, and retention holds the same line. `settleWorkshopMemoryProposal` (`memory/WorkshopReplyMemory.ts`) turns the verdict into the turn's card or a log line |
| Reply context | Completion stays synchronous: each of the three completion sites (host, guest join, tool synthesis) resolves `{ open, listed }` first through the capability factory (`replyMemoryContext`, on the library), and only when the reply holds a frame, so ordinary replies cost no await. `supersedes` keeps ids the listing holds, with their titles; the rest are dropped and counted |
| Phrasing fence (D9) | `memory/WorkshopMemoryProposalPhrasing.ts`: reads only sentences about the writer (second person, "the writer", "the author", the About-you name); withholds one holding a personal-domain word; its limits in its header |
| Persisted fields | `WorkshopTurn.memoryProposal` (`session/WorkshopMemoryProposalRecords.ts`) and `projectMemoryReceipt` (`session/WorkshopMemoryReceiptRecords.ts`), called from the shape file; a new turn artifact `memory_receipt`; `WorkshopSessionService.setMemoryProposalState` and `appendMemoryReceipt` |
| Library writes | `memory/ProjectMemoryWrites.ts`, composed by the library: `save`, `update`, `forget`, `restore`, `editData`, `estimatePinned`, `shutDown`. Writer access (memory Off doesn't stop them); refused only where the workspace holds no memory. `updated` moves only for a change to what a memory says. The pinned budget uses the frame's renderer and estimator (`projectMemoryPinnedTokens`), and refuses only a change that grows the total past `pinnedTokens` |
| Receipt version | `memory/ProjectMemoryReceiptVersion.ts`, D14's definition, until 2b's version module replaces it at the fold |
| Deactivation | `ExtensionShutdownParts.projectMemory`, drained beside the Lightbox's (both settle before either's failure is raised); `CoreServices.projectMemory` |
| Handler | `WorkshopProjectMemoryHandler`, composed in `WorkshopSliceComposition`. Mutations (behind the gate): `WORKSHOP_MEMORY_PROPOSAL_ACTION` (save, edited save, dismiss, reopen), `WORKSHOP_SAVE_TURN_TO_MEMORY`, `WORKSHOP_MEMORY_CREATE`, `WORKSHOP_MEMORY_UPDATE`, `WORKSHOP_MEMORY_FORGET` (forget, restore). Reads: `WORKSHOP_MEMORY_REQUEST_EDIT`, `WORKSHOP_MEMORY_ESTIMATE`. Each answers `WORKSHOP_MEMORY_WRITE_RESULT` (or its read's result) by request id |
| Shared rules and copy | `shared/constants/workshopProjectMemoryWrites.ts`: the draft check the sheet and the host share, field faults, the refused-edit copy and the switch's help line, from the host's numbers |
| Prompt | `workshop-personas/project-memory-proposals.md`, taught beside the grammar under the same condition (`workshopPersonaSystemPromptPaths`) |
| Webview | `useWorkshopProjectMemory` (transport, correlation, the sheet's state; persists nothing); `components/workshop/memory/`: `WorkshopMemoryCard` (one card, with a read-only mode for Slice 5's receipt), `WorkshopTurnMemory` (the card's states, receipt lines, Save to memory…), `WorkshopMemorySheet`; `styles/workshop/memory.css` |

## Tests

| Area | Where |
|---|---|
| Extractor and codec: every D6 row (both valid; memory before the widget; duplicates; malformed and unclosed; stray close; memory off; control-only), every decode rejection, provenance refused, bounds exact | `utils/workshopReplyControls.test.ts` |
| Completion: card, card with widget, control-only host line and no model, off, unread listing, guest, the phrasing fence (writer inference withheld, character feelings kept, "the writer", second person, the About-you name) | `WorkshopRunCompletionMemory.test.ts` |
| No memory text in any diagnostic: a sentinel in title, summary, body and `supersedes` across every outcome; the widget-rejection dump and the findings log | same, plus the library's (`ProjectMemoryWrites.test.ts`) and the routes' (`WorkshopProjectMemoryRoutes.test.ts`) |
| Stripping in bubble and retained history | `workshopReplyControls.test.ts` (retention), `WorkshopRunCompletionMemory.test.ts` (bubble) |
| Card flow through real routes: save, edit-then-save, dismiss, show again; each behind the gate and posting a snapshot; a save writes a file and a receipt; Save to memory…; New, Edit, Forget, Restore; a load-in-full toggle leaves no receipt; the sheet's reads | `WorkshopProjectMemoryRoutes.test.ts` (real router, room handler, composition and library) |
| Receipt: delivered to host and guests as room history; its line never the body; shown in export (Markdown) and recall as an event | `WorkshopProjectMemoryRoutes.test.ts`, `session/WorkshopMemoryTurns.test.ts` |
| Persistence: round-trip, the pre-memory fixture byte for byte, refusals on the wrong turn and malformed fields, Rewind carry and cut, Branch carry, New clears | `session/WorkshopMemoryTurns.test.ts`, `fixtures/workshop-session-v2-before-memory.json` |
| Supersession: the new file names the old; the old reads superseded and leaves the frame; its bytes untouched; Forget of the newer keeps it superseded (N-01) | `memory/ProjectMemoryWrites.test.ts` |
| Pinned edit refused past budget (F-04), the file unchanged; turning it on refused; shrinking an over-budget memory allowed; a new memory checked too | same |
| Two windows on one folder save at once; both files stand | same |
| Deactivation waits for a save in flight; the drain order | `apps/.../extensionShutdown.integration.test.ts` |
| Prompt sync: numbers pinned, no other number, the example through the production extractor, kinds closed, the never-list, taught only beside the grammar | `architecture/projectMemoryProposalPromptSync.test.ts`; `projectMemoryPromptSync.test.ts` updated |
| Webview: the card's modes and states, receipts, Save to memory… eligibility and the busy room, the sheet (counters, kinds, Don't replace, the host's numbers, the refused edit, faults), the hook's correlation; no "pin" in any of it | `WorkshopTurnMemory.test.tsx`, `WorkshopMemorySheet.test.tsx`, `useWorkshopProjectMemory.test.ts` |
| Guards moved deliberately | `boundaries.test.ts` (memory modules, route ledger 64 → 71, composed handlers, message modules), `WorkshopRoomHandler.seams.test.ts` (64 → 71 routes), `promptBudgets.test.ts` (instruction 13,098 → 13,173), `WorkshopWidgetRecommendationOperations.test.ts`, `workshopStyles.test.ts` (memory.css) |

## Verification

- `npm ci`, then `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,158 warnings before and after. The new
  ones (enum members, component names, `open-thread` keys) are disabled
  with reasons, as their neighbours are.
- `npx jest`: before (base `7ec50ba4`, clean worktree) **652 suites / 9,228
  tests / 59 snapshots**; after **661 suites / 9,363 tests / 59 snapshots**,
  all passing.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines (the largest: the handler, 411). Touched files
  already past 500 grew a little: `WorkshopSessionService.ts` 2,610 →
  2,663 (the two receipt and card mutations), `WorkshopApp.tsx` 1,740 →
  1,772, `WorkshopRoomHandler.ts` 1,597 → 1,622, `WorkshopTurnBubble.tsx`
  791 → 803, `WorkshopPersonaCapability.ts` 922 → 932, `extension.ts` 920 →
  927, `WorkshopSessionStateV1Shape.ts` 1,061 → 1,068, `session.ts` 957 →
  964, `MessageHandler.ts` 982 → 984. `promptBudgets.test.ts` stays at 500.
- *Alice* and made-up ids in fixtures; no live provider calls.
- **After merging the epic** (PR #196 merged: the design snapshot, Slice 0d's
  doc, and Slice 1's store fixes): typecheck clean, lint 1,158 warnings,
  **661 suites / 9,373 tests / 59 snapshots**, all passing.
- **After merging 2a's head** (`2b4aaba9`, which carries `27da6fee`: the
  store's review fixes and the #197 review): the store's create and replace
  results are unchanged, so the writes compile and settle as before. A
  `set-aside` or unreadable file is only ever in the listing's `unreadable`
  rows, never `memories`, so it is never a write target and a new memory
  can't name it in `supersedes` (pinned by a test). The library never calls
  delete (that's Slice 4b's). Typecheck clean, lint 1,158 warnings,
  **661 suites / 9,375 tests / 59 snapshots**, all passing.

## Deviations

1. **`supersedes` on the card carries titles.** D6's shape names
   `supersedes?: string[]`; the card stores `{ id, title }[]` (the title as
   listed when the reply landed) plus `droppedSupersedes`, so "Replaces …"
   and the dropped note render with no extra read. The save sends ids only.
2. **One more receipt action, `restored`.** The design's Forget receipt
   offers Restore; D7's union had no word for it. Receipts carry a memory
   id and version whatever the action, so 2b's fold needs no change for it.
3. **`memory-off` covers an unavailable workspace too.** Completion asks
   whether personas may propose now; no folder, several, or a changed root
   reads as closed, so the trailer is dropped as `memory-off`.
4. **Two extra routes.** `WORKSHOP_MEMORY_FORGET` (Forget and Restore, from
   receipts) and the sheet's two reads (`WORKSHOP_MEMORY_REQUEST_EDIT`,
   `WORKSHOP_MEMORY_ESTIMATE`). The estimate keeps the sheet's numbers the
   host's (D5: one renderer, one estimator), since the webview can't run the
   engine's estimator.
5. **A write mid-reply is refused** ("Wait for the reply to finish, then save
   to memory."), so a receipt never lands between a writer's message and
   its reply. A write the library awaits records its receipt only in the
   room it was asked in; a room replaced meanwhile keeps the memory and gets
   no receipt, logged.
6. **Receipt actions follow the design.** A writer's save shows no actions;
   a Forget shows Restore; Save and tell me's receipt (Slice 5) shows Edit ·
   Forget. Its expand, which needs a writer-facing read of the saved
   memory, is Slice 5's, on `WorkshopMemoryCard`'s read-only mode. "Open in
   manager" on a saved card waits for 4b's manager (`onOpenManager`).
7. **Tool reports aren't stripped for display.** Tools aren't taught the
   trailer, and retention strips every reply alike; only persona replies
   (host, guest, synthesis) can carry a card.
8. **The receipt's version** is computed here by D14's definition
   (`ProjectMemoryReceiptVersion`) until 2b's version module lands; the fold
   step switches to it.
9. **Docs trees.** `docs/ARCHITECTURE.md` and `.ai/central-agent-setup.md`
   list the new `projectMemory.ts` message module, which `boundaries.test.ts`
   requires. `AGENTS.md` is untouched.

## The fold (after 2b, PR #198 fixed and approved)

Merged 2b's branch (`54297bd6`, implementation `29b41de1`) and 2a's head
again (`a1ca49b3`).

- **Where a receipt counts.** `projectMemoryDeliveredView(turns, participant,
  { deliveredThroughTurnId })` counts a receipt only at or before the last
  room turn this conversation has been, or is now being, handed:
  `workshopRoomDeliveredThrough(prepared)` (this run's prepared catch-up, or
  the reader's committed offset), carried on the persona capability's turn
  context (`roomDeliveredThrough`) from the room handler and the tool
  side-pass. So a receipt riding this message's catch-up is counted for this
  message's note, and one guest's reading it never counts for another.
- **What it does to the view.** Counted after the conversation's latest
  snapshot, a receipt leaves the view at its memory's version; a Forget
  removes the memory (the conversation was told it's gone). A snapshot
  replaces the view and clears earlier receipts, and every new membership
  records its own frame (PR #198 F-02), so a re-invited guest never inherits
  receipts its earlier membership read. A receipt is its own turn, so a cut
  that removes it removes its effect.
- **Beside a digest** (PR #198 F-03, past 4,096 memories). A digest keeps
  no versions, so a receipt can't update it; the view carries the receipts
  beside it (`receipted`). When the current set, without the memories the
  receipts told of at the versions they told, hashes to the digest, the
  receipts explain every change and there is no note (a save in this room).
  Anything else (an edit or a Forget past the bound, a change the receipts
  don't cover, a memory that moved past its receipt) is 2b's count line
  once, and its snapshot records a fresh digest. Nothing is hidden.
- **The version** is 2b's `ProjectMemoryVersion`, read from the listing;
  `ProjectMemoryReceiptVersion` is gone, and a test pins the receipt's
  version to the listing's.
- **Merge resolutions.** The library's write `update(id, patch)` is renamed
  `edit`, since 2b's `update(view)` renders the update note.
  `projectMemoryPinnedTokens` reads 2b's `projectMemoryPinnedLine`.
- **One more redaction** (PR #192 F-01, "any rejected-response record").
  With `debugLogging` on, the engine dumps a whole rejected capability
  response; a persona reply holding a proposal would have put its text in
  the log. `AgentCapability.redactPrivateControls` (optional; named
  `redactForLog` until PR #200 F-01) lets the owning domain
  redact it, and the Workshop persona capability returns the extractor's
  redacted copy. (2a's #197 F-03, titles in the engine's manifest log, is a
  different line and 2a's to fix.)

**Fold tests** (`memory/ProjectMemoryReceiptFold.test.ts`, through the real
capability, library, store, session and room delivery): a save in this room
never comes back as a note; a receipt one guest has read is still owed to
another, and reaches each once; it counts only once delivery reaches it; a
Forget's receipt isn't repeated as `<gone>`; a re-invited guest starts from
its own frame; Rewind and Branch (through the real coordinator) that cut a
receipt cut its effect; the version equals the listing's; and a receipt
beside a digest: a save explained, a save plus an edit, a memory moved past
its receipt, an edit and a Forget, and the fold carrying receipts beside the
digest. Removing the delivery point makes the three no-repeat tests fail.
The engine's redacted dump: `AgentRunEngine.test.ts`; the persona
capability's redaction: `WorkshopRunCompletionMemory.test.ts`.

**Verification after the fold:** typecheck clean, lint 1,158 warnings, **664
suites / 9,415 tests / 59 snapshots**, all passing. No `vscode` in core; no
new file over 500 lines.

## PR #200 review fixes (Astra, `docs/pr-reviews/pr-200-project-memory-write-path-review.md`; F-06 from the re-review)

Each fix has a regression test that fails with the fix taken out (checked
by reverting the fix and running its test).

- **F-01: intermediate responses.** The engine replayed a rejected or
  capability-calling response to the provider, kept it in retained history,
  and dumped it raw. `redactForLog` is now `redactPrivateControls`. The
  engine applies it to every intermediate response before it is replayed:
  the correction turn, a capability round, the forced-final turn. It applies
  the same hook to the debug dump. The final response still goes through
  `retainedAssistantContentSanitizer`. `WorkshopToolContextCapability`
  implements it beside the persona capability, because tool replies can
  carry a proposal too.
  - Tests: `AgentRunEngine.test.ts`, with sentinels through a correction
    and a capability round, checking provider messages, retained history
    and logs with debug on; the tool-context capability's own test.
- **F-02: the live bubble.** `stripWorkshopMemoryProposalForStreaming`
  removes frames as `rest` does: an unclosed one to the end of the reply. It
  also holds back a trailing fragment that could still become an opening
  or closing tag, until the next token settles it. `WorkshopApp` applies it
  before the widget strip.
  - Tests: every prefix of four replies (a whole frame, attributes, nested,
    after the widget section); and `WorkshopApp.memoryStreaming.test.tsx`
    through the real App and StreamingContent, one character at a time, then
    completion, cancellation, a rejected proposal, and a frame left open.
- **F-03: nested frames.** `findFrames` now pairs tags by depth. A frame ends
  only where its own depth closes, or at the end of the reply when it never
  does, so nothing inside a nested frame reads as text after it. A closed
  nested frame is rejected as `malformed:nested` (a new reason).
  - Tests: one-level, two-level, outer-unclosed and nothing-closed nesting,
    each with memory on and off, and prose after a nested frame.
- **F-04: concurrent writes.** `ProjectMemoryWrites` runs one write at a
  time in a window: each write lists, checks and commits before the next
  one lists. Another window's writes are still the store's to order (its
  claims), as before.
  - Tests: create/create, create/update and update/update, each pair fitting
    the pinned budget alone but not together; exactly one is written.
- **F-05: overlapping saves of one card.**
  - Host: the handler holds a proposal's save in flight by turn id, taken
    before the first await. A second Save joins it and gets the same answer
    under its own request id. A Dismiss or Reopen waits it out, and is then
    refused if the card was saved. `write()` returns the answer it sent.
  - Webview: a sheet save of a card marks the card busy. `closeSheet`, and
    the sheet's `onClose` (Escape, backdrop), do nothing while a save is
    out. The hook's own close after a successful answer still works. Opening
    another sheet while one saves does nothing either. An answer to a sheet
    no longer on screen sets its card's error, so the outcome is kept.
  - Tests: Edit → Save plus a card Save at once through the routes (one
    file, one receipt, both answered with the same id); a Dismiss sent while
    a save is out; the hook (busy card, Escape refused, reopen refused, then
    the answer); the sheet (Escape ignored while saving). One older hook
    test, which closed a sheet mid-save, now answers first.

- **F-06 (re-review): digest equality over a contradicted receipt.** Past
  4,096 memories, the update note took "the folder hashes to the digest" as
  "nothing changed", even when a receipt folded after the digest had told
  this conversation something the folder now contradicts (a Forget restored
  outside the room, an edit reverted outside it). The note now accepts
  digest equality, or a save the receipts explain, only when every such
  receipt names the state the folder holds now. Otherwise it sends the
  count line once and records a fresh digest.
  - Tests: Forget → external Restore and Edit → external revert both give
    the count line. A Forget then a Restore in the room gives no note. A
    Forget receipt reads the same whether it was delivered earlier or
    arrives in this turn's catch-up.

**Files over 500 lines** that these fixes touched were all already over
before them, and grew by a few lines each: `AgentRunEngine.ts` (+5),
`WorkshopPersonaCapability.ts` (+4), `WorkshopApp.tsx` (+2), and the
engine's test (+41).

**Verification after the fixes:**
- Typecheck is clean.
- Lint shows 1,158 warnings, the baseline.
- Jest: **665 suites / 9,441 tests / 59 snapshots**, all passing (before:
  664 / 9,415 / 59).
- No `vscode` import in core.

**2a merged again** (`94fcabb7`, PR #197's F-02 recheck): one conflict, in
`listProjectMemories`. The resolution keeps 2a's accepted-links standing
and `supersededBy` and adds 2b's `version` beside them. After the merge:
typecheck clean, lint 1,158, **668 suites / 9,452 tests / 59 snapshots**,
all passing.

**F-03 recheck (Astra at `f87b38c8`): overlapping tokens.** The depth scanner
collected opening and closing matches independently, so a closing token
could sit inside an opening tag's own bytes (`<tag data-x="</tag>">`).
- **Fix:** markers are now read in one left-to-right pass, each search
  resuming after the marker it found. Only exactly `<tag>` and `</tag>` (any
  case) are tags. Any other marker (attributes, whitespace, a missing `>`, a
  marker inside the tag) removes everything from it, or from the frame it
  is in, to the end of the reply, and is rejected as `malformed:tag`. The
  streaming stripper reads `rest`, so it follows the same rule.
- **Behaviour change:** whitespace before `>` is no longer accepted. The
  prompt never writes it.
- **Tests:** the witness plus five variants through the extractor,
  retention sanitizer, every streaming prefix, and the engine's correction
  replay, history and logs, with memory on and off and debug on and off.
  All failed on the earlier scanner.

**Verification after the recheck fix and the epic merge** (#197 merged; `git merge --no-ff origin/epic/workshop-project-memory`): typecheck clean, lint 1,158, **668 suites / 9,461 tests / 59 snapshots**, all passing on two consecutive full runs. One earlier full run had a single failing test that did not reproduce; its name was not captured.
