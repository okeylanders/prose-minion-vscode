# Slice 3: Write Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D4 (writes, supersession), D5 (the pinned budget on edit), D6, D7, D8 (Ask first and the writer's own paths), D9, D10 (owed writes)
**Status:** Waiting on Slice 2.

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
  and estimator, and refuses a save that would pass it, with the reason
  ("pinned notes would load about 5,600 of 5,000 tokens"). Nothing is
  unpinned automatically.
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

- [ ] A proposal shows as a card, never as reply text, and the persona's
      retained history never holds the trailer.
- [ ] Nothing is saved without the writer's action in this slice.
- [ ] Every save leaves a receipt the room sees.
- [ ] Save to memory… works on eligible bubbles.
- [ ] Sessions without the new fields are unchanged on read and write.
- [ ] Owed writes drain at deactivation.
- [ ] The epic's per-slice verification passes, with counts recorded here.
