# Slice 2: Read Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D1, D2, D3, D5, D10 (workspace rule, library), D11, D12, D13
**Status:** Waiting on Slice 0 (ADR) and Slice 1 (store and codec).

## Outcome

With memory on, every new conversation starts with a bounded `<project-memory>`
catalog frame, and any persona can call `memory.catalog`, `memory.search` and
`memory.read`. Memories exist only as files made by hand or as fixtures. No
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
- **Mode (provisional).** The library reads `proseMinion.workshop.projectMemory`
  (`off` | `ask` | `auto`, default `off`) through `SettingsStore`. Its scope
  waits on open question 1. Read it through one function so Slice 4b can change
  the scope without touching readers.

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
- Add the D5 and D6 tag names to `RESERVED_PERSONA_FRAME`
  (`utils/workshopPromptFrames.ts:5-16`).
- `estimateProjectMemoryFrame()` on the library returns counts and an estimated
  token figure from the same renderer, for Slice 4b's tab.

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
  `base.md` and `guest-base.md` name the family. The interaction contract says a
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
- the publishable set (per open question 5's answer; until it's answered,
  `memory.read` is published, the ADR's recommendation);
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
- [ ] Every D12 list is widened, and the save-and-reopen test passes.
- [ ] The epic's per-slice verification passes, with counts recorded here.
