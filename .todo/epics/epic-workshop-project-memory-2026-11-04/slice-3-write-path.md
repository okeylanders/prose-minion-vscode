# Slice 3: Write Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D4 (writes, supersession), D6, D7, D8 (Ask first and the writer's own paths), D9, D10 (owed writes)
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

## Build

### Trailer codec and stripping (D6)

- `utils/workshopMemoryProposalProtocol.ts` (pure), modeled on
  `workshopWidgetRecommendationProtocol.ts`:
  - `inspectWorkshopMemoryProposal(reply)` → `{ kind: 'none' }`,
    `{ kind: 'proposal'; proposal }`, or `{ kind: 'rejected'; reason }`;
  - `stripWorkshopMemoryProposal(reply)` for the bubble;
  - `sanitizeWorkshopMemoryProposalForRetention(reply)` for retained history,
    composed with the widget sanitizer as `retainedAssistantContentSanitizer`
    (`AssistantToolService.ts:609`, `:676`, `:734`).
- Rules:
  - closed element names;
  - D4 and D11 bounds;
  - one trailer, and a second is dropped and logged;
  - provenance elements are refused;
  - `supersedes` must name a listed memory, or it's dropped with a card note.
- The phrasing fence (D9): `WorkshopMemoryProposalPhrasing` reads only
  sentences about the writer, and withholds with a logged reason (never text).
  Its stated limits go in its header.
- Wire it where completion strips the widget block (`WorkshopRunCompletion.ts:253-315`)
  for host and guest replies.

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
  expandable, and *Save*, *Edit*, *Dismiss*. The sheet for *Edit* and for
  *Save to memory…* is one component, bounded by the same rules as the codec.
- **Save to memory…** appears on the bubbles bookmarks allow (ADR 2026-11-03
  D5's eligibility). The source is that turn, and `origin` is `writer`.

### Library writes (D4, D10)

- `save(draft, provenance)` mints an id inside the store's queue and writes
  `origin` `proposed` or `writer`. Superseding writes one new file only.
- `archive(id)` and `update(id, patch)` are claimed rewrites in place.
- Every write is owed. Logs carry ids and reasons only.

### Prompt

`resources/system-prompts/workshop-personas/project-memory-proposals.md` covers:
when to propose (a decision landed, a fact settled, the writer asked); the
trailer; kinds; bounds; supersession; and the never-list (D9). It's included
only when the mode isn't `off`. A sync test pins its numbers to
`PROMPT_BUDGETS.workshopProjectMemory`, and its example decodes through the
production codec.

## Tests

- **Codec:**
  - every rejection reason, one per reply, provenance refused;
  - stripping in both the bubble and retained history (the persona's next turn
    never sees its own trailer).
- **Phrasing:** writer-directed personal inference withheld; a character's
  feelings kept.
- **Card flow through real routes:** save, edit-then-save, dismiss, each behind
  the gate, each posting a snapshot. A save writes a file and a receipt.
- **Receipt:** delivered to other participants as room history, shown in
  export, and its body is never the memory's body.
- **Persistence:** round-trip, the pre-memory fixture, refusal on the wrong turn
  kind, Rewind and Branch carry, New clears.
- **Supersession:** the new file names the old one, the old one reads as
  superseded and leaves the catalog, and the old file is untouched on disk.
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
