# Slice 2: Read Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D1, D2, D3, D5, D8 (mode switches), D10 (workspace rule, library), D11, D12, D13, D14 (update notes)
**Status:** Waiting on Slice 0 (ADR) and Slice 1 (store and codec).

## Outcome

With memory on, every new conversation starts with a bounded `<project-memory>`
catalog frame. A conversation that falls behind the memory set (reopened,
memory turned on mid-room, a change from another window or a hand edit) gets
an appended update note with only what changed. Any persona can call
`memory.catalog`, `memory.search` and `memory.read`. Memories exist only as files made by hand or as fixtures. No
model writes one yet, and the writer has no UI for them yet. Every list that
widens with the family widens here, together.

## Since Slice 1

- Slice 1 delivers the format-1 codec and `ProjectMemoryStore` with listing,
  read, new file, claimed rewrite and claimed delete. This slice only *reads*
  through it. Writes start in Slice 3.
- If Slice 1 merged before the ADR settled, check its codec against D4 first:
  derived supersession, `origin`, the required-key table, real turn-id
  grammar, and identity from the frontmatter only.

## Build

### Library and composition (D10, D13)

- `application/services/workshop/memory/ProjectMemoryLibrary.ts` (new):
  - `catalog()`, `search(query, status)` and `read(ids)` return data, never
    prose, like the recall service;
  - it derives `superseded` (D4), conflicts and unreadable files from the
    store's listing, and it never writes.
- Ports the library consumes:
  - the store's listing and read, as types only;
  - the coordinator's `recallScope()`, for the accepted workspace and the live
    session;
  - a new read-only recall-service query, `positionsOf(sessionId, turnIds)`
    (D3), answered from recall's cached documents.
- Built only in `extension.ts`: the store, then the library, then the persona
  capability factory, which gains the library as a constructor port.
  `boundaries.test.ts` forbids `new ProjectMemoryLibrary` /
  `new ProjectMemoryStore` elsewhere.
- **Mode.** The library reads `proseMinion.workshop.projectMemory`
  (`off` | `ask` | `auto`, default `off`) through `SettingsStore`. It's one
  global setting (question 1, decided), so the port is unchanged. Slice 4b adds
  the manifest entry and the tab; this slice may add the manifest entry first,
  so the setting is readable.

### The catalog frame (D5)

- `memory/ProjectMemoryCatalogFrame.ts`: pure `renderProjectMemoryFrame(catalog,
  budgets)`. It puts pinned bodies first, then entries by `updated` (ties by id),
  then `<more count>`. Text is escaped, the output is deterministic, and it
  returns `undefined` when there's nothing to show or memory is off.
- The frame goes into the **first user message only**:
  - `buildWorkshopPersonaUserMessage` / `buildWorkshopOpenConversationUserMessage`
    (`AssistantToolService.ts:1022`, `:1076`) take a pre-rendered `projectMemory`
    frame on their input;
  - `buildWorkshopGuestJoinMessage` (`WorkshopPromptBuilder.ts:321`) does the
    same, rendered at join;
  - the run that starts a conversation awaits the library before building the
    message. Follow-up turns never call it.
- Add the D5, D6 and D14 tag names to `RESERVED_PERSONA_FRAME`
  (`utils/workshopPromptFrames.ts:5-16`).
- Budgets are in tokens, measured with the engine's `estimateTextTokens`
  (`RequestContextPreflight.ts:7`) over the rendered elements, so the tab's
  meter and the frame's cut agree.
- `estimateProjectMemoryFrame()` on the library returns counts and the pinned
  and catalog token figures from the same renderer, for Slice 4b's tab.
  `pinnedTokens` is 5,000 and `catalogTokens` 2,000 (question 4, decided), so a
  full frame is about 7,000 tokens.

### Update notes and the delivery record (D14)

- **Versions.** `memory/ProjectMemoryVersion.ts` (pure): the first 12 hex
  characters of a SHA-256 over the canonical id, title, kind, summary, body,
  pinned flag and effective status. The library attaches it on listing; it is
  never stored in the file.
- **The record.**
  - `WorkshopTurn.projectMemoryDelivery?: { participant, kind: 'frame' | 'note',
    memories: { id, version }[] }[]`: its own codec module
    (`session/WorkshopProjectMemoryDeliveryRecords.ts`), called from the shape
    file.
  - Optional, written only when present, and refused on a turn that can't carry
    it. No `schemaVersion` bump.
  - Covered by a pre-memory fixture that reads and saves byte for byte.
  - A frame records its snapshot on the writer turn (host) or the join turn
    (guest); a note records its snapshot on the turn that carried it.
- **The fold.** `memory/ProjectMemoryDeliveredView.ts` (pure) gives a
  participant's view from the turns in ledger order: the latest snapshot, then
  receipts (Slice 3 adds them) up to that reader's delivery offset.
- **The note.** `memory/ProjectMemoryUpdateNote.ts` (pure): the delta from the
  view to the current set, with entries, pinned bodies and `<gone>` with
  reasons. It's held to `pinnedTokens` and `catalogTokens`, and past either it
  is the count line pointing at `memory.catalog`. Nothing changed means
  `undefined`.
- **Where it's appended.** At the end of the next user message each
  conversation receives: the host's message builder
  (`buildWorkshopHostMessage`, `WorkshopPromptBuilder.ts:610`) and the guest's
  (`buildWorkshopGuestMessage`, `:147`), when memory is on. A conversation with
  no record (it started while memory was off) gets the whole catalog as its
  note.
- **When it doesn't send:** memory off, an unaccepted workspace, or a folder
  that can't be listed. No record is written then, and the failure is logged
  by reason.

### The capability (D1, D2, D3)

- `memory/WorkshopProjectMemoryCapability.ts`: the per-turn sub-adapter,
  composed in `WorkshopPersonaCapability`'s constructor beside resource and
  recall.
  - It enforces `readsPerTurn` and the per-call bounds, and rejects every call
    with `memory-off` when the mode is `off`.
- `memory/WorkshopProjectMemoryXmlCodec.ts`: request decoding for the three
  operations. `WorkshopCapabilityXmlCodec.inspect` gains the family by hand
  (it has no `never` guard).
- `memory/WorkshopProjectMemoryRenderer.ts`: catalog, search and read bodies.
  Read renders provenance as a `transcript.read` hint, or as the host's reason
  why not.
- The evidence framing (D2) lives in `memory/WorkshopProjectMemoryCopy.ts`, and
  `evidenceFraming` takes a `memory` case.
- Manifest rows: each successful read adds a `memory` context-source row,
  labeled with the memory titles ("Project note").
- Prompt: `resources/system-prompts/workshop-personas/project-memory-capability.md`
  holds the grammar, when to use it, and the limits.
  `workshopPersonaSystemPromptPaths` includes it only when the mode isn't `off`.
  `base.md` and `guest-base.md` name the family. The grammar file explains the
  update note: a later entry replaces an earlier one with the same id, and a
  `<gone>` memory is no longer in effect. The interaction contract says a
  memory is a saved note the persona looked up, never something it remembers.

### Every list that widens (D12)

Widen every row of D12's table in this slice:

- operations;
- family and its label ("Project Memory");
- every family and operation switch;
- `inspect`;
- `WORKSHOP_TURN_ARTIFACTS`;
- `CONTEXT_SOURCE_KINDS` and its consumers (`AgentRunContracts`,
  `ContextBudget`, `ConversationManager`'s archive validator, `READ_IN_KINDS`,
  `readInOpenAction` → `jump`);
- the publishable set: `memory.read` is published (question 5, decided);
- `WORKSHOP_MEMORY_MODULES` in `boundaries.test.ts`.

Flip the three reservation tests to their positive meaning, and keep an
unknown-operation case under another reserved name.

### Budgets (D11)

Add `PROMPT_BUDGETS.workshopProjectMemory` with D11's starting values. Pin them
in `promptBudgets.test.ts` (including `readsPerTurn < callsPerTurn`), and add
`projectMemoryPromptSync.test.ts` modeled on `transcriptRecallPromptSync.test.ts`.

## Tests

- **Frame:**
  - budgets, ordering, `<more count>`, escaping, the empty and off cases;
  - byte-identical across a second turn, a Conversation settings change
    (system prompt replaced) and an archive import (reopen);
  - a guest's join frame reflects the catalog at the join.
- **Never to tools:** a tool run, a tool sidecar and the analysis side pass
  receive neither `<project-memory>` nor `<workshop-interaction` (the negative
  test that's missing today).
- **Capability:**
  - each operation: success, partial and rejected; ids checked against the
    listing; `readsPerTurn`; `memory-off`;
  - an unreadable or conflicting file never appears in any output (use
    sentinel text).
- **Provenance:** recallable source → hint with positions; the live room, an
  unnamed room or a missing session → the host's reason.
- **Mid-room switches (D8):** Off → on sends each conversation the whole
  catalog as an update note on the writer's next message, and the rebuilt
  system prompt teaches the grammar. On → Off sends no note, leaves the
  delivered frame in history, and refuses every call; on again sends only
  what changed since.
- **Update notes (D14):**
  - reopen after a change, a change from another window, and a hand edit that
    leaves `updated` alone each give exactly one note with only the change;
  - nothing changed gives no note;
  - over budget gives the count line, and the next message gives no repeat;
  - every earlier message is byte-identical after a note.
- **The record through whole-room operations:**
  - Rewind before a note sends it again;
  - Branch keeps the records up to the cut;
  - a rolled-back writer turn takes its record;
  - New starts with none;
  - a session without the field is unchanged on read and write.
- **Accepted workspace:** a changed root yields no frame and rejects every
  call.
- **Widened lists:** one test saves **and reopens** a session holding every
  new operation, artifact and context-source kind.
- **Prompt sync and budgets.**
- **Boundaries:** `memory/` imports the store and coordinator as types only,
  and no handler constructs the library.

## Completion Criteria

- [ ] With memory on and hand-made memories in the folder, a new room's first
      message carries the frame, and personas can catalog, search and read.
- [ ] With memory off, no frame, no grammar, and every call is rejected.
- [ ] The frame never changes within a conversation (pinned by test).
- [ ] A conversation behind the memory set gets one update note with only the
      changes, and never the same change twice.
- [ ] Every D12 list is widened, and the save-and-reopen test passes.
- [ ] The epic's per-slice verification passes, with counts recorded here.
