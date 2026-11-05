# Slice 3: The proposal

**Status:** Built, in review.
**Branch:** `epic/workshop-persona-file-edits-slice-3-proposal`
**Decision:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-workshop-persona-file-edits.md) D2, D8, D9
**Built on:** Slice 1 (`f4dcc641`). Parallel to Slice 2 (the gateway); no gateway, `DocumentEditor` or `DraftEditApplier` code is touched. No UI and no apply.

## Scope

- **The trailer** (`utils/workshopFileEditProtocol.ts`, pure). One `<prose-minion-file-edit>` frame per file:
  - the target is `<group>` + `<path>` by `resource.read`'s rule (a known group; `isSafeConfiguredResourcePath`; within `workshopResource.pathCharacters`), or `<excerpt/>`;
  - the operations, in the order written, are the shared planner's `TextEditOperation`: `<rewrite>` (alone), `<find>` + `<replace-with>` (at most `editReplaces` pairs), `<append>` and `<prepend>` (once each);
  - a required one-line `<why>`;
  - faults are values (`WORKSHOP_FILE_EDIT_FAULTS` plus the reader's), never thrown.
- **Shared extractions, not copies.**
  - `utils/workshopTrailerElements.ts`: the element reader, moved out of the memory codec (which now calls it). It adds one opt-in, a self-closed empty element (`<excerpt/>`), which memory doesn't use.
  - `utils/configuredResourcePath.ts`: `isSafeConfiguredResourcePath`, moved out of `WorkshopConfiguredResourceLookup` (which re-exports it). It is now pure, with no Node `path` import, so the webview-reachable reply extractor can use it.
  - `utils/workshopReplyTrailerFrames.ts`: the reply's frame scanner, moved out of `workshopReplyControls` and made multi-tag.
- **Reading a reply.** `extractWorkshopReplyControls` finds memory and file-edit frames in one pass, so the two kinds stand at the tail together, in any order.
  - `utils/workshopReplyFileEdits.ts` judges each file-edit frame on its own: off (`file-edits-off`), structure (as memory's), decode (`malformed:<fault>`), one frame per file (`duplicate`), and the cap (`over-cap`). Dropped frames are counted; the reply is never dropped.
  - `rest` holds no frame; `redacted` shows `[file edit proposal removed]`. Streaming and retention strip both kinds (renamed `stripWorkshopReplyTrailersForStreaming` / `…ForRetention`).
  - `fileEdits` is **absent** when the reply held no file-edit frame, so every memory-only result is exactly as before.
  - The frame tag is reserved in `neutralizeReservedPersonaPromptDelimiters`.
- **Budgets.** `PROMPT_BUDGETS.workshopFileEdits`: `proposalsPerReply` 5, `editReplaces` 5, `whyCharacters` 200, `rewriteCharacters` 40,000, `findCharacters` 2,000, `replaceWithCharacters` 8,000, `passageCharacters` 8,000. It also has `appendWords` 400, **Slice 2's key, at the same value**, because the prompt quotes it.
- **The prompt.** `workshop-personas/file-edit-proposals.md` is taught to host and guest only while the setting is `ask` (`workshopPersonaSystemPromptPaths`' `fileEdits` option, bound in `extension.ts` through `AssistantToolService.setWorkshopFileEditsGrammar`). A setting change rebuilds the persona prompts, as the memory mode's does (`WorkshopConversationSettingsService`).
- **Completion.** `WorkshopRunCompletion` reads `fileEditsOpen`, which the room handler and the tool side-pass read from the setting when the reply is read. `WorkshopReplyFileEditProposals` turns each kept frame into a `pending` card and logs one line per frame: the target's group or `excerpt`, the operation kinds, counts and reasons. A reply made only of trailers shows the host's line, without a model stamp.
- **Session state (D8).**
  - Types are in `shared/types/messages/workshop/fileEdits.ts`: `WorkshopFileEditProposal`, `WorkshopFileEditTarget`, `WorkshopFileEditOperation`, `WorkshopFileEditState`, `WorkshopFileEditLanded` (+ `…LandedRange`), the setting and its coerce. `session.ts` grows by the seam: `fileEditProposals?` on `WorkshopTurn`.
  - The codec is `session/WorkshopFileEditProposalRecords.ts`: exact keys and bounds.
    - The operations are checked by the trailer's own `workshopFileEditOperationsFault`.
    - `landed` is present exactly when a card is `applied`, and each operation lands in at most one range.
    - `reason` is allowed only on applied, stale or refused cards.
    - No two cards may name one file.
  - No schema version change. No development shape exists, so there's no normalization.
- **Transcript projection.** `projectWorkshopTranscript` adds `fileEdits` (target, why, state) to a reply entry; Markdown, JSON and HTML render it. It never carries an operation's text. `projectWorkshopTranscriptTurn` doesn't add it, so recall and the turn preview don't change.
- **The setting.** `proseMinion.workshop.fileEdits` (`off` | `ask`, default `ask`, `scope: application`, like the memory mode) is in the manifest and the config watcher. It isn't in `ConfigurationHandler`: no Workshop mode is (the memory mode isn't either), because the conversation-settings service reads them live.

## Tests

- `__tests__/utils/workshopFileEditProtocol.test.ts`:
  - every fault, by reason;
  - every bound, at the bound and one past it;
  - `<excerpt/>` in five spellings;
  - group and path rules (absolute, drive, scheme, traversal, `.`, empty segment, backslash, trailing slash, length);
  - the order kept, and the pairs cap;
  - the decoded operations plan through `planTextEdits`;
  - never throws.
- `__tests__/utils/workshopReplyFileEdits.test.ts`:
  - several frames, and past the cap;
  - duplicates (case-folded), and a malformed frame dropping only itself;
  - the setting off, and absent;
  - mixed with memory frames in any order, each kind's own cap, nesting across kinds, a mismatched closing tag;
  - a frame never in `rest`, `redacted`, the streaming text or retained history;
  - the tag neutralized in quotes.
- `__tests__/architecture/fileEditProposalPromptSync.test.ts`:
  - every number pinned, and no other number;
  - every codec element taught;
  - the targets, quoting and per-target rules, and that nothing changes until the writer applies;
  - the worked example decodes through the production extractor and is refused anywhere but last;
  - the prompt is taught only with `fileEdits`, host and guest.
- `__tests__/application/services/workshop/session/WorkshopFileEditTurns.test.ts`:
  - pending cards in order, with a bubble of prose only;
  - logs with no quote, replacement, passage, why or path;
  - a trailer-only reply; the setting off; the cap;
  - a byte-for-byte round-trip and hydrate, every state, and applied with `landed`;
  - 23 malformed shapes refused;
  - the projection, and Markdown, JSON and HTML exports, with file, why and state, never text;
  - recall and preview unchanged.
- `__tests__/application/handlers/domain/workshop/WorkshopFileEditProposalRoutes.test.ts`: through the real router and room handler, unset (`ask`) makes cards, and `off` at read time makes none.
- `__tests__/application/services/workshop/WorkshopConversationSettingsFileEdits.test.ts`: read live, and a prompt rebuild on off ↔ ask but not on unset ↔ ask.
- `__tests__/architecture/fileEditsSetting.test.ts`: the manifest entry is user-only, its modes and default are the code's, and the coerce fails closed.
- `AssistantToolService.test.ts` (one case added): the trailer prompt follows the bound check.
- `boundaries.test.ts`: `fileEdits.ts` joins the Workshop message modules (and `docs/ARCHITECTURE.md` and `.ai/central-agent-setup.md` list it).
- Every existing memory reply-control test ran unchanged, apart from the mechanical rename of the two strip functions.

## Implementation note

- **One pass for both trailers.** Memory's tail rule ("nothing but whitespace and other frames after it") would have made a memory frame followed by a file-edit frame `misplaced`. The scanner therefore reads both tags together.
  - Depth counts every trailer tag, so a frame of one kind inside the other is `nested`.
  - A closing tag of the other kind marks the frame `malformed:tag`.
  - For a memory-only reply, nothing changes.
- **`fileEdits` is optional on `WorkshopReplyControls`** so a reply with no file-edit frame keeps exactly its old result. This is why no memory expectation changed.
- **One frame per file.** A second frame for a file that the case-folded group and path already name is `duplicate`, as the catalog admits a unique case-folded match. The session codec holds the same rule.
- **Whitespace.** Each element's text is trimmed, as memory's are, so a pretty-printed `<rewrite>` keeps no indentation lines at its ends. A replacement may be empty (a deletion). A rewrite, an append or a prepend may not be.
- **The codec doesn't apply D5.** It accepts a `<rewrite>` aimed at prose. The target policy is the gateway's (Slice 2), and the card's state is Slice 4's to set (see the open questions).
- **The landed record** carries its own target (the gateway's canonical catalog key, which may differ in case from what the persona wrote) and, for each range, the indexes of the operations it carries, so a partial apply can say which landed.
- **The host's lines.** "Proposed an edit to a project file." for a reply of file-edit frames only, and "Proposed a project memory and an edit to a project file." for both kinds.
- **The Conversation settings modal doesn't show the setting yet.** The manifest is enough while there are no cards. Slice 4 or 5 can add a control beside the Memory tab's mode once cards exist.
- **Not covered by a unit test:** the config watcher's new key (one line beside the memory key; MessageHandler's watcher has no unit harness for Workshop keys). The Slice 5 live pass covers it.

### Open for review

1. **D5 at reply time?** Should a `<rewrite>` to `chapters`, `manuscript` or `<excerpt/>` be dropped at reply time (`malformed:not-allowed`), or become a card that Slice 4 marks `refused` at once? It is kept as a card now. Slice 4 can read `FILE_EDIT_TARGET_POLICIES` when it settles cards.
2. **The `appendWords` merge.** Both slices define `appendWords` at 400 in `workshopFileEdits`. When Slice 2 lands, keep one copy and Slice 2's doc comment.
3. **`AGENTS.md`'s message tree** doesn't list `fileEdits.ts`, since this slice doesn't edit `AGENTS.md`. Slice 5's update should add it, beside the other two docs.
