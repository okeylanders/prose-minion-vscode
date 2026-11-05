# Workshop Project Memory: Boundary Runway

**Date:** 2026-11-04
**For:** [ADR 2026-11-04: Workshop Project Memory](../adr/2026-11-04-workshop-project-memory.md)
**Read against:** `epic/workshop-project-memory` at `8fb016f`

The feature note was written from the design side. Reading it against the code
turned up the following. Each item names where the note and the code disagree,
or where a seam in the code is better than the one the note assumed, and the
ADR decision that answers it. Paths starting `core/` are under
`packages/core/src/`.

## Surprises

| # | The note assumed | The code says | ADR |
|---|---|---|---|
| 1 | The catalog frame is session-stable if nobody rewrites it | The system prompt is rebuilt on every Conversation settings change (`AssistantToolService.ts:776`, `ConversationManager.ts:377`) and at archive import. Only the first user message (`AssistantToolService.ts:1022`) and a guest's join message (`WorkshopPromptBuilder.ts:321`) are built once, and archive import keeps them verbatim (`ConversationManager.ts:222-249`) | D5: the frame goes in the first user message |
| 2 | Trailers are parsed "the way `### Next steps` is" and stripped | Next steps is parsed but never stripped (`WorkshopActionableFindings.ts:49-111`; `WorkshopRunCompletion.ts:253-315` strips only the widget block). The widget recommendation protocol strips the bubble (`workshopWidgetRecommendationProtocol.ts:162`) and retained history (`:171`, as `retainedAssistantContentSanitizer`) | D6: model it on the widget protocol |
| 3 | A receipt line is a new thing | Session and directive markers are `system` / `divider` turns (`WorkshopSessionService.ts:328-342`, `:1008-1022`), and room delivery gives them to personas (`WorkshopRoomDeliveryService.ts:36-47`) | D7: a divider with a receipt field |
| 4 | `source-turns: t-0412, t-0415` | Turn ids are `turn-<n>-<role>-<ms>` (`session/WorkshopTurnLedger.ts:25`). `transcript.read` takes positions, not ids; ids appear only as `firstTurnId` / `lastTurnId` (`recall/WorkshopTranscriptRecallCapability.ts:357-363`) | D3, D4: real ids; positions computed per read through the recall service |
| 5 | A turn "used web research" is knowable | Only `WorkshopTurn.citations` records it (`session.ts:410`); the tool is attached when the setting is on (`AssistantToolService.ts:753-761`), and no counter says a search ran without citing | D8: hold when attached, not when cited |
| 6 | Reuse `LightboxBoardRewrite` and `LightboxBoardClaims` | The claim regex hard-codes the board file name (`LightboxBoardClaims.ts:47`); folder naming and listing are board-specific (`LightboxBoardFiles.ts`) | D10: Slice 1 extracted the mechanics into `StoredFileClaims` / `StoredFileRewrite` (`768b41f`), configured per store; Lightbox tests unchanged |
| 7 | A workspace-scoped setting needs "a target parameter" | True, and nothing is workspace-scoped yet: `SettingsStore.update` has no target (`platform/SettingsStore.ts:21`), the adapter writes Global (`VsCodeSettingsStore.ts:26`), and the only declared scope is `writerProfile`'s `application` (`apps/vscode-extension/package.json:642`) | Decided: global mode (question 1), so no port change |
| 8 | Tool runs never receive conversation behavior | True by construction (`RunWorkshopToolSidePass.ts:103`, `AssistantToolService.ts:927`); no negative test pins it | D5: Slice 2 adds one for behavior and memory |
| 9 | Three tests reserve `memory.read` | Confirmed (`workshopCapabilityFamily.test.ts:28-36`, `WorkshopPersistedTurnGuards.test.ts:183-200`, `WorkshopTranscriptRecallWiring.test.ts:220-224`). Also: `WorkshopCapabilityXmlCodec.inspect` (`:165-185`) has no `never` guard; a new family is added there by hand | D12 |
| 10 | Memories are superseded by status | Storing `superseded` makes supersession a two-file write (new file + claimed rewrite of the old) | D4: supersession derived from `supersedes` |

## Seams the design leans on

- **Capability composition:** sub-adapters built per turn in
  `WorkshopPersonaCapability`'s constructor (`:136-154`), dispatched at
  `:524-580`; evidence framed per family (`:837-848`) and escaped (`:850-855`).
- **Read-only ports:** recall reads the store only through ports, and the
  coordinator's `recallScope()` gives the accepted workspace and live session
  (ADR 2026-10-05 §2; `boundaries.test.ts:996-998`).
- **Owed writes:** `LightboxBoardLibrary.owe` (`:396-399`) and `shutDown`
  (`:182-186`), awaited by `shutDownExtension`
  (`apps/vscode-extension/src/application/extensionShutdown.ts:31-40`).
- **Writer-promotes:** `WorkshopTodoLedger.addFromFinding`
  (`session/WorkshopTodoLedger.ts:48`), the precedent for "a persona suggests,
  the writer owns".
- **Shared saved-item browser:** `components/fulltab/SavedItemBrowserModal` and
  `SavedItemRow` (Lightbox Slice 5A.2), which the manager composes.

## Blast radius

- **Persisted:** the session turn (two optional fields), the turn artifact enum,
  the capability operation enum, and the context-source kind (archive import).
  All are additive and forward-only.
- **New files on disk:** `prose-minion/memory/*.md`, a second writer-data
  format.
- **Prompts:** one new system-prompt file, taught only when memory is on; the
  first user message and the join message gain a frame.
- **Platform:** none. The mode is one global setting (question 1, decided).
- **Refactored, behavior unchanged:** the Lightbox's claim and rewrite modules,
  now configurations of the shared primitive (Slice 1).
- **Untouched:** recall's grammar, tool runs.
