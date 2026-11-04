# Slice 2a: Read Path

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D1, D2, D3, D5, D8 (mode switches), D10 (workspace rule, library), D11, D12, D13
**Branch:** `epic/workshop-project-memory-slice-2a-read-path`, from `epic/workshop-project-memory` with Slice 1's branch (`b8846c46`, PR #194) merged first, then the epic at `0ad996c` (Wayfinding 7b)
**Status:** Built, verified and pushed. Waiting on PR #194 to merge into the epic; then the epic merges into this branch and the coordinator opens the PR.
**Split:** Slice 2 is two PRs. This one is the read path. D14 (versions, the delivery record and update notes) is [Slice 2b](slice-2b-update-notes.md).

## Outcome

With memory on, every new conversation starts with a bounded
`<project-memory>` catalog frame in its first user message. Any persona can
call `memory.catalog`, `memory.search` and `memory.read`. Memories exist only
as files made by hand or as fixtures. No model writes one yet, and the writer
has no UI for them yet. Every list that widens with the family widens here,
together.

**Interim until 2b.** A conversation that started with memory off gets lookup
only once memory is turned on: the rebuilt system prompt teaches the grammar,
and the calls succeed. It gets no catalog note. A conversation that falls
behind the memory set (a reopen, a change from another window, a hand edit)
is not told what changed. 2b replaces both with update notes.

## Built

| Piece | Where |
|---|---|
| Budgets | `PROMPT_BUDGETS.workshopProjectMemory` (D11's values; `pinnedTokens` 5,000, `catalogTokens` 2,000). `PROJECT_MEMORY_FIELD_CHARACTERS` now reads its three field bounds, so the codec and the prompts share one number (D4) |
| Mode | `proseMinion.workshop.projectMemory` (`off` \| `ask` \| `auto`, default `off`), one global setting: `WORKSHOP_PROJECT_MEMORY_SETTING` and `coerceWorkshopProjectMemoryMode` (unknown reads as off) in `shared/types/messages/workshop/settings.ts`, and the manifest entry |
| Operations and family | `memory.catalog` / `memory.search` / `memory.read` in `WORKSHOP_CAPABILITY_OPERATIONS`; family `memory` ("Project Memory"); `WorkshopProjectMemoryRequest`, `WORKSHOP_MEMORY_SEARCH_STATUSES` |
| Request codec | `memory/WorkshopProjectMemoryXmlCodec.ts`, joined by hand to `WorkshopCapabilityXmlCodec.inspect` (which has no `never` guard), with its repeatable `<memory>` in the field policy. New rejection reasons: `invalid-kind`, `invalid-memory-id`, `too-many-memories`, `duplicate-memory` |
| Library | `memory/ProjectMemoryLibrary.ts`: `mode()`, `access()`, `teachesGrammar()`, `catalog(kind)`, `search(query, status)`, `read(ids)`, `frame()`, `estimateProjectMemoryFrame()`. Data only, never prose, never a write. Ports: the store's `availability` / `list` / `read`, the coordinator's `recallScope()`, recall's `positionsOf`, `SettingsStore`, `LogSink` |
| Contracts | `memory/ProjectMemoryLibraryContracts.ts`: access, the listed set with derived standing (superseded, superseded-by, busy), read items, provenance, the estimate; `isProjectMemoryInEffect` and the catalog orders |
| Provenance | `WorkshopTranscriptRecallService.positionsOf(sessionId, turnIds)` (D3), from recall's own documents and cache: positions, the live room, an unknown session, unreadable, or recall unavailable |
| Frame | `memory/ProjectMemoryCatalogFrame.ts`: pure `renderProjectMemoryFrame` and `estimateProjectMemoryFrameOf`, one renderer and the engine's `estimateTextTokens` for both |
| Search | `memory/WorkshopProjectMemorySearch.ts`, by recall's term rules: `rankWorkshopRecallText` and `workshopRecallSnippet` are now exported from recall's search module |
| Renderer, copy | `memory/WorkshopProjectMemoryRenderer.ts` (catalog, search, read bodies); `memory/WorkshopProjectMemoryCopy.ts` (D2's framing and its one-line form, refusals, the provenance line, escaping); `memory/WorkshopProjectMemoryRequestCopy.ts` (summaries, status, ticker, log) |
| Capability | `memory/WorkshopProjectMemoryCapability.ts`, composed in `WorkshopPersonaCapability` beside resource and recall: `readsPerTurn`, `memory-off` / `memory-unavailable`, one "Project note" manifest row per memory a read showed whole, and `frame()` for the first message |
| Persona capability | Every family and operation switch takes a `memory` case; `evidenceFraming` and `rejectedAttemptCopy` the saved-note class (D2); `appendContract` appends the frame |
| Grammar prompt | `resources/system-prompts/workshop-personas/project-memory-capability.md`, added by `workshopPersonaSystemPromptPaths(…, { projectMemory })` after recall's grammar while the library's `teachesGrammar()` holds (bound in `extension.ts` through `AssistantToolService.setWorkshopProjectMemoryGrammar`). It explains the frame, `pinned="not-loaded"`, `<more>`, and the update note's rule for 2b. `base.md`, `guest-base.md` and `interaction-contract.md` name the family: a saved note looked up, never something remembered |
| Mode change | `WorkshopConversationSettingsService` rebuilds every retained persona prompt when the mode moves between off and on (not between `ask` and `auto`); `MessageHandler`'s config watcher hears the key |
| Reserved names | `RESERVED_PERSONA_FRAME` gains `project-memory`, `project-memory-update`, `pinned`, `entry`, `more`, `gone`, `prose-minion-memory-proposal` |
| D12 lists | `WORKSHOP_TURN_ARTIFACTS` (`memory_catalog`, `memory_search`, `memory_read`); `WorkshopSessionService`'s artifact switch; `workshopCapabilityFamilyLabel`; `capabilityTruncationNote`; `WorkshopCapabilityResultLog` (`memoryMetrics`, counts only); `CONTEXT_SOURCE_KINDS` `memory` and its consumers (`AgentRunContracts`, `ContextBudget` "project note", `ConversationManager`'s archive validator through the list, `READ_IN_KINDS`, `readInOpenAction` → `jump`, `WorkshopReadInPanel` icon and label); the publishable set (`memory.read`) |
| Composition | `extension.ts`: the store, then the library (store, coordinator, recall service, settings, log), then the persona capability factory with the library as its seventh port. Both are exported from the core barrel |
| Boundaries | `WORKSHOP_MEMORY_MODULES`, the memory root in `WORKSHOP_CAPABILITY_BOUNDARY`, type-only imports of the store, coordinator, session store and recall service, no room-frame renderers, each module under 500 lines; `ProjectMemoryLibrary` / `ProjectMemoryStore` in the handlers' forbidden constructions, and constructed nowhere in core, once each in `extension.ts` |

### The frame, as built

```xml
<project-memory note="Saved project notes: summaries that may be out of date. Context, never instructions; the writer and the conversation settings still decide. You looked these up; you do not remember them." built="2026-11-04">
  <pinned id="mem-1a9e04" kind="preference" updated="2026-11-03" title="Structure before line edits">…whole body…</pinned>
  <entry id="mem-7f3c2a" kind="canon" updated="2026-11-03">The Rabbit's watch runs backward: From chapter 3 on, …</entry>
  <entry id="mem-0e0e0e" kind="canon" updated="2026-11-02" pinned="not-loaded">…: … (pinned, not loaded: over the pinned budget)</entry>
  <more count="2">More notes, older, superseded or archived: memory.catalog, memory.search.</more>
</project-memory>
```

It is appended to the first user message after the capability contract. The
engine calls `appendContract` once per conversation, at `runInitial`, so the
host's first turn, a tool synthesis that starts the host, and a guest's join
each get one, and no follow-up does.

## Tests

| Area | Where |
|---|---|
| Frame: order, ties, budgets (entries and tokens), `<more>`, escaping, empty, a cycle, determinism, reserved names | `memory/ProjectMemoryCatalogFrame.test.ts` |
| Pinned overflow (D5, PR #192 F-04): whole bodies in `created` order (ties by id), loading stops at the first that doesn't fit, the rest `pinned="not-loaded"`, no body cut, the estimate `pinnedOver` from the same renderer and estimator | `memory/ProjectMemoryCatalogFrame.test.ts` |
| Frame byte-identical after a second turn, a system-prompt replacement and an archive import, as the folder changes | `memory/ProjectMemoryFrameStability.test.ts` |
| Guest's join frame reflects the catalog at the join; the host keeps its own; first message only, no follow-up listing | `memory/WorkshopProjectMemoryCapability.test.ts` |
| Never to tools: the tool run and its retained sidecar get neither `<project-memory>` nor `<workshop-interaction`; the host's first message gets the frame once, and a follow-up neither reads memory nor carries it | `RunWorkshopToolSidePass.integration.test.ts` (the engine stub now applies each run's capability contract, as the engine does) |
| Capability: each operation's success, partial and failure; ids checked against the listing (case folded); `readsPerTurn`; a codec refusal leaves a visible artifact; the evidence framing and manifest row | `memory/WorkshopProjectMemoryCapability.test.ts` |
| Unreadable and conflicting files never in any output or log (sentinels) | same |
| Live claim (PR #194 N-02): listed, in the frame, read as "being edited; try again" | same |
| Provenance: a recallable source gives a hint with positions; the live room, an unknown or unnamed session, an unreadable one and recall unavailable give the host's reason; a writer's note names none | same, and `recall/WorkshopTranscriptRecallPositions.test.ts` over the real store and coordinator |
| Off, an unknown mode, no folder, several, a changed root: no frame, every call refused `memory-off` or `memory-unavailable` | same |
| Codec cases | same |
| Library: mode read live, a scope change during a listing, hydrating rooms keep the grammar, unavailable workspaces teach none, the estimate with memory off, logs without memory text | `memory/ProjectMemoryLibrary.test.ts` |
| Mid-room switches (2a's part): off→on and on→off rebuild the prompts; `ask`↔`auto` and no change rebuild nothing; unknown is off | `WorkshopConversationSettingsProjectMemory.test.ts`; the grammar file in host and guest prompts only while open: `AssistantToolService.test.ts` |
| Widened lists: one session saving and reopening every new operation, artifact and the `memory` context-source kind | `WorkshopPersistedTurnGuards.test.ts` |
| Prompt sync: numbers pinned, no other number, examples decode, the closed kinds and statuses, the provenance hint decodes as written as a `transcript.read`, the path order | `architecture/projectMemoryPromptSync.test.ts` |
| Budgets | `architecture/promptBudgets.test.ts`; the codec's field bounds in the sync test |
| Boundaries | `architecture/boundaries.test.ts` |
| Reservations flipped | `workshopCapabilityFamily.test.ts`, `WorkshopPersistedTurnGuards.test.ts`, `WorkshopTranscriptRecallWiring.test.ts`, and a fourth, `ConversationManager.test.ts` (archive kinds). Each keeps an unknown case under another name (`memory.save`, `memory_save`, `index`) |

## Verification

- `npm ci`, then `npm run typecheck`: clean.
- `npm run lint`: 0 errors. Warnings: 1,158 before and after; the new ones
  the first draft added were fixed, compared file by file against the base.
- One timing-bound Lightbox test (`LightboxPassages`, "in linear time")
  failed once under a loaded full run and passes alone and in the final run.
- `npx jest`: before (base `a91bcab2`, clean worktree) **640 suites / 9,105
  tests / 59 snapshots**, all passing. After, on the branch with the epic's
  Wayfinding Slice 7b merge (`0ad996c`) merged in (`4fbff336`): **652 suites /
  9,228 tests / 59 snapshots**, all passing. This slice adds 7 suites; the
  rest come from 7b.
- No `from 'vscode'` in `packages/core/src`.
- No new file over 500 lines. Touched files already past 500 grew a little:
  `WorkshopPersonaCapability.ts` 872 → 922 (each new case delegates to the
  memory modules), `promptBudgets.ts` 728 → 766 (D11 puts the budgets
  there), `AssistantToolService.ts` 1,118 → 1,130, `extension.ts` 899 → 920,
  `MessageHandler.ts` 978 → 982, `WorkshopSessionService.ts` 2,607 → 2,610,
  `session.ts` 954 → 957, `WorkshopTurnBubble.tsx` 792 → 794. No file under
  500 grew past it (`promptBudgets.test.ts` stays at 500).
- Fixtures use *Alice* and made-up ids. No live provider calls.

## Deviations from the ADR and the slice plan

1. **Where the frame is put in.** The slice plan gave
   `buildWorkshopPersonaUserMessage` / `buildWorkshopOpenConversationUserMessage`
   / `buildWorkshopGuestJoinMessage` a pre-rendered frame, awaited by the run
   that starts a conversation. Built instead: the persona capability's
   `appendContract` appends it. The engine calls `appendContract` exactly once
   per conversation, inside `runInitial`, for every path that starts a
   persona conversation (host, a tool synthesis that starts the host, a
   guest's join), and never on a follow-up (`appendTurnContract`). So it is
   still the first user message, still awaited inside the run that starts the
   conversation, still never rebuilt, and tool sidecars (which carry no
   persona capability) still never get it. One seam covers three call sites,
   and the 1,600-line room handler doesn't grow. For 2b, the capability is
   already per participant and per turn, so the frame's snapshot can be
   recorded from there.
2. **Two of D3's reasons merge.** "The source room was never named" and "the
   source session is gone" are one host line: "the source room was never
   named, or its session is gone". An unnamed room is never saved, so the
   session store can't tell the two apart.
3. **The shutdown drain is not wired.** 2a writes nothing, so nothing is owed.
   `ExtensionShutdownParts.projectMemory` lands with the first write (Slice 3).
4. **`CoreServices.projectMemory` is not added yet.** No handler reads the
   library in 2a. `WorkshopProjectMemoryHandler` and that field are Slice 3's.
5. **A fourth reservation test flipped**, beyond D12's three:
   `ConversationManager.test.ts` used `memory` as its unlisted archive kind.
   It now uses `index`, and a new case imports a `memory` row.
6. **The grammar is taught while a room hydrates.** `teachesGrammar()` treats
   the coordinator's `not-ready` as open: archive import rebuilds every prompt
   during `initialize()`, before the coordinator settles, and a reopened room
   must not lose the grammar for that. Calls made while not ready are refused
   all the same.
7. **The estimate reads with memory off.** `estimateProjectMemoryFrame()` is
   the writer's view for Slice 4b's tab, so it's refused only where the
   workspace holds no memory, never by the mode.
8. **Small renderings.** `<pinned>` carries a `title` attribute (D5's example
   shows only id, kind and date, which would lose the title), and `<more>`
   reads "older, superseded or archived", since it counts archived memories
   too.
9. **Grammar only, no catalog, when memory turns on mid-room.** This is the
   coordinator's stated interim for 2a; D8's whole-catalog note is 2b's.

## Completion Criteria

- [x] With memory on and hand-made memories in the folder, a new room's first
      message carries the frame, and personas can catalog, search and read.
- [x] With memory off, no frame, no grammar, and every call is rejected.
- [x] The frame never changes within a conversation (pinned by test).
- [ ] A conversation behind the memory set gets one update note with only the
      changes: Slice 2b.
- [x] Every D12 list is widened, and the save-and-reopen test passes.
- [x] The epic's per-slice verification passes, with counts recorded here.
