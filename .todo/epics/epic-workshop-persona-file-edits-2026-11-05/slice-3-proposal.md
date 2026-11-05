# Slice 3: The proposal

**Status:** Built, in review. Revised to the settled contracts (ADR at `494a17d3`: D2, D4, D10, D11, D13; PR #226's ledger), merged in at `ed51137e`.
**Branch:** `epic/workshop-persona-file-edits-slice-3-proposal`
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D2, D4 (the port and its caller), D10, D11, D13
**Built on:** Slice 1 (`f4dcc641`). It runs parallel to Slice 2, which implements `FileEditStaging`. This slice doesn't touch the gateway, `DocumentEditor` or `DraftEditApplier`. No UI and no apply.

## Scope

- **The trailer** (`utils/workshopFileEditProtocol.ts`, pure). One `<prose-minion-file-edit>` frame per file.
  - **Target:** `<group>` + `<path>` by `resource.read`'s rule (a known group; `isSafeConfiguredResourcePath`; within `workshopResource.pathCharacters`), or `<excerpt/>`.
  - **Operations,** in the order written, as the shared planner's `TextEditOperation`:
    - `<rewrite>`, which stands alone;
    - `<find>` + `<replace-with>`, at most `editReplaces` pairs;
    - `<append>` and `<prepend>`, once each.
  - **`<why>`:** required, one line.
  - **Faults** are values, never thrown.
- **D2's bounds** live in `PROMPT_BUDGETS.workshopFileEdits`:

  | Bound | Value |
  |---|---|
  | `proposalsPerReply` | 5 |
  | `frameCharacters` | 24,000 |
  | `whyCharacters` | 200 |
  | `editReplaces` | 8 |
  | `findCharacters` | 2,000 |
  | `replaceWithCharacters` | 4,000 |
  | `insertWords` / `insertCharacters` | 400 / 4,000 |
  | `rewriteCharacters` | 16,000 |
  | `revertCharacters` | 4,000 (D10) |
  | `landedContextCharacters` | 80 (D10) |

  - The codec holds every append and prepend to `insertCharacters`. Prose's `insertWords` is the gateway's policy (D5); the prompt teaches it.
  - Slice 2 adds its four keys to the same block.
- **Shared extractions, not copies:**
  - `utils/workshopTrailerElements.ts`, the element reader; the memory codec now calls it. It adds a self-closed empty element (`<excerpt/>`).
  - `utils/configuredResourcePath.ts`, the path rule, now pure. `WorkshopConfiguredResourceLookup` re-exports it.
  - `utils/workshopReplyTrailerFrames.ts`, the multi-tag frame scanner.
- **Reading a reply.**
  - `extractWorkshopReplyControls` finds memory and file-edit frames in one pass, so both kinds stand at the tail together.
  - `utils/workshopReplyFileEdits.ts` judges each frame on its own:
    - `file-edits-off`;
    - structure, as memory's frames are judged;
    - `oversized` past `frameCharacters`: dropped whole, never decoded;
    - `malformed:<fault>`;
    - `duplicate` (one frame per file);
    - `over-cap`.
  - Frames never show: not in `rest`, the streaming text or retained history. `redacted` shows a placeholder. `fileEdits` is absent when the reply held none.
- **Staging (D4).**
  - **The port.** `domain/models/FileEditStaging.ts` is the interface agreed with Slice 2, byte-identical on both branches: `stage(target)` → staged `{ target: identity, class, baseline }` or refused `{ reason }`.
  - **The resolver.** `application/services/workshop/fileEdits/WorkshopReplyFileEditProposals.ts` runs before completion, like memory's context:
    - it reads the setting when the reply is read;
    - it stages every frame that decodes, at most 5, in parallel;
    - a rejected port reads as `unreadable`;
    - staged frames become `pending` cards, and refused frames become `refused` cards with the refusal kind as `reason`;
    - with the setting `off`, an aborted run or no port, nothing is staged;
    - a reply with no tag costs no await.
  - **Completion** uses the context only for the exact reply it was resolved from. A frame with no context is stripped and counted `not-staged`.
  - **Where staging comes from.** `CoreServices.fileEditStaging?` reaches `WorkshopRoomHandler`, and from there the side pass's `fileEdits` event. Slice 4 binds the real port. Until then, frames are stripped and counted `staging-unavailable`, and no card is made.
- **Session state (D10)**, in `shared/types/messages/workshop/fileEdits.ts`. `WorkshopFileEditProposal` holds:
  - `requested`, what the frame named; it is kept for display, and is all a card refused at staging has;
  - `target` (`{ kind: 'file' | 'excerpt', documentUri, relativePath }`), `class` and `baseline`, staging's, always together;
  - `operations` and `why`;
  - `state`: `pending | applying | applied | partial | declined | stale | refused | unknown`;
  - `reason?`;
  - `outcomes?`, one per operation once settled;
  - `landed?`: full records (`before`/`after` within `revertCharacters`, context within 80 characters each side, `versionAfter`) or hashed ones (`beforeSha256`, `afterSha256`).
- **Session codec** (`session/WorkshopFileEditProposalRecords.ts`). Keys and bounds are exact:
  - A file identity matches a resource request, and an excerpt identity matches an excerpt request.
  - Outcomes appear only on `applied`, `partial` and `unknown` cards: all landed when applied, some and not all when partial.
  - There is one `landed` record per landed operation.
  - `reason` never appears on a `pending`, `applying`, `applied` or `declined` card. A card refused at staging must have one.
  - No two cards request one file.
  - There is no schema version change.
- **Reopen rule (D8).** `applying` round-trips in the file. Hydration reads it as `unknown`, with `reason: 'applying-on-reopen'` and every outcome `unknown` (`settleWorkshopFileEditProposalsOnReopen`). This is a **read rule, not a normalization**: `applying` is a legitimate persisted state, not a development shape. No development shape of this field ever existed, so no normalization exists.
- **The webview's view** omits `documentUri`. `workshopTurnForWebview` runs on every turn the room handler posts (`WORKSHOP_TURN`, `WORKSHOP_SESSION_STATE`).
- **Transcript projection.** `projectWorkshopTranscript` adds `fileEdits: { path, why, state }`, where `path` is the display path. It never includes an operation's text or the URI. Markdown, JSON and HTML render it. Recall and the preview are unchanged.
- **The setting (D11).** `proseMinion.workshop.fileEdits` is exactly `off | ask`, default `ask`, `scope: application`. The coerce reads unset as `ask` and anything else (`auto` included) as `off`.
  - The manifest and the config watcher read it. A change rebuilds the persona prompts.
  - The prompt is taught only while it's `ask`.
  - There is no Conversation settings UI yet.
- **The prompt** (`workshop-personas/file-edit-proposals.md`) teaches:
  - D2's bounds;
  - prefer find-and-replace;
  - never rewrite a chapter;
  - rewrite only a short note with no links, images or code;
  - prose is decided by the project's lists, not the group named;
  - the per-target rules;
  - nothing changes until the writer applies.

## Tests

- `utils/workshopFileEditProtocol.test.ts`:
  - every fault, at each bound and one past it;
  - `<excerpt/>` in five spellings;
  - path rules, the order kept, the pairs cap;
  - decoded operations plan through `planTextEdits`;
  - never throws.
- `utils/workshopReplyFileEdits.test.ts`:
  - several frames and the cap; duplicates; off;
  - `oversized`;
  - mixed with memory frames, nesting across kinds, a mismatched closing tag;
  - never in `rest`, `redacted`, the streaming text or retained history;
  - the tag neutralized.
- `fileEdits/WorkshopReplyFileEditProposals.test.ts` (fake staging):
  - staged and refused cards;
  - a rejecting port reads as `unreadable`;
  - off and no port stage nothing; no tag means no await; the cap; an aborted run;
  - **log sentinels** for malformed, oversized and disabled frames and for refusals: no path, URI, quote, why or passage.
- `session/WorkshopFileEditTurns.test.ts`:
  - cards on a reply; trailer-only; off; not staged; logs without text;
  - byte-for-byte round-trip and hydrate;
  - every state round-trips, with outcomes and landed records;
  - **the reopen rule**;
  - 32 malformed shapes refused;
  - projection and Markdown, JSON and HTML exports never show text or the URI;
  - recall and preview unchanged.
- `handlers/.../WorkshopFileEditProposalRoutes.test.ts`, through the real router and room handler:
  - staged into cards;
  - **nothing posted to the webview holds `documentUri`**;
  - `off`, no port, and `auto` all stage nothing.
- `architecture/fileEditProposalPromptSync.test.ts`:
  - all eight bounds pinned, and no other number;
  - every element taught, and the replace/rewrite rules;
  - the worked example decodes through the production extractor;
  - the prompt is taught only with the setting on.
- `architecture/fileEditsSetting.test.ts` and `WorkshopConversationSettingsFileEdits.test.ts`: manifest, coerce, live read, and the prompt rebuild.
- `AssistantToolService.test.ts` (one case).
- `boundaries.test.ts` (`fileEdits.ts` listed).

## Implementation note

- **One pass for both trailers.** Under memory's tail rule, a memory frame followed by a file-edit frame would be `misplaced`. Depth counts every trailer tag.
- **`fileEdits` is optional on `WorkshopReplyControls`,** so memory-only results stay byte-identical. The only memory-test edit is the mechanical rename of the strip functions (`…ReplyTrailersFor…`).
- **Staging runs once and outside completion.** Completion stays synchronous and pure. The resolver stages first, and the context carries the reply it was made from, so a context can't attach to another reply.
- **A rejecting port** never throws through the run. It becomes an `unreadable` refusal, and its message isn't logged.
- **Reopen versus rollback.** Hydration also serves a room replacement's rollback. A live `applying` card restored that way reads as `unknown` too, which is the safe reading (D8: an outcome for an earlier generation is dropped).

### Open for review

1. **The staging port's input** is Slice 2's: `stage(target)` alone. Staging reads the room's excerpt itself, so the reply reader passes neither the excerpt nor the live session id, unlike the coordinator's sketch.
2. **`insertWords`** is taught and recorded here but enforced by the gateway, for prose only. The codec enforces only `insertCharacters`.
3. **A refused card's `reason`** is the refusal kind (`not-configured`, …), not writer-facing words. The words are Slice 4's (D9).
4. **`AGENTS.md`'s message tree** doesn't list `fileEdits.ts`. That's for Slice 5.
