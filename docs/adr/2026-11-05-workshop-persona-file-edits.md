# ADR 2026-11-05: Personas Propose Edits to Project Files

**Status:** Proposed (2026-11-05).
- **Scope (Okey's choice):** project notes **and** chapter drafts
  ("option B"). Autonomous editing is out of scope; D10 keeps a seam for it.
- **Q1–Q5:** Okey handed the implementation to the coordinator, who took the
  recommended defaults ([below](#defaults-taken-2026-11-05)). Okey may
  override any of them before the live pass.
**Date:** 2026-11-05
**Epic:** [Workshop Persona File Edits](../../.todo/epics/epic-workshop-persona-file-edits-2026-11-05/README.md)
**Extends:**
- [ADR 2026-10-21: Draft Edit](2026-10-21-draft-edit-engine-and-document-write-back.md):
  its applier becomes the one write path for persona edits too.
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md),
  addendum of 2026-11-05 (Slice 6c): its edit grammar and exactly-once
  anchoring move to a shared planner.

**Supersedes in part:** [Workshop Apply to Draft](../../.todo/features/feature-workshop-apply-to-draft/README.md)
(a feature note, never an ADR). Its target rules become D5's prose policy.
Its Apply Variation becomes a later use of the gateway (D4).

## Context

What already exists:
- **Personas read project files.** `resource.catalog`, `resource.search` and
  `resource.read` address a file by `<group>` and `<path>`: a
  `ConfiguredResourceRef` in one of `CONTEXT_PATH_GROUPS` (`characters`,
  `locations`, `themes`, `things`, `chapters`, `manuscript`, `projectBrief`,
  `general`).
- **Personas propose memory edits.** Since Project Memory Slice 6c, a
  persona's trailer can rewrite a field, replace quoted text, or append or
  prepend. The host anchors each quote exactly once
  (`WorkshopMemoryEditAnchor`), and an edit always waits for the writer.
- **Draft Edit writes the writer's documents.** `DraftEditApplier` →
  `DocumentEditor.applyEdits`:
  - one change, as one undo step;
  - checked against the version it was placed in;
  - never saved;
  - read back from a watch, never trusted.

  It works only on an open document.
- **Apply to Draft** (parked) designed edits to the excerpt's document. It was
  never built.

What Okey asked for:
1. Personas can change a character file or a chapter draft.
2. One gateway for editing, rather than one per feature (his question during
   Slice 6c).
3. Room to add autonomous editing later without rework.

## Decision

### D1. A persona proposes; the writer accepts

Nothing in a file changes until the writer presses Apply. This is the
memory's "Ask first", and in v1 it is the only approval (D10).

### D2. The proposal: a trailer addressed like `resource.read`

- **One frame per edited file.** A reply may end with up to
  `PROMPT_BUDGETS.workshopFileEdits.proposalsPerReply` frames, each
  `<prose-minion-file-edit>`. Frames past the cap are dropped and counted, as
  memory proposals are.
- **The target.**
  - `<group>` and `<path>`, exactly as `resource.read` takes them;
  - or `<excerpt/>`, for the document the room's excerpt came from (resolved
    by the host; see D4).
- **The operations** are the memory grammar's, minus its field names:
  - `<rewrite>` replaces the whole file, after its front matter;
  - `<find>` followed at once by `<replace-with>` (at most
    `editReplaces` pairs);
  - `<append>` or `<prepend>`, each at most once.
- **`<why>`**: one line saying what the edit is for, shown on the card.
- **Quotes, never offsets or line numbers** (Draft Edit's rule). A file
  rewritten whole takes no other operation, so every quote anchors against
  the file as it stands.

The prompt section and its worked example teach the frame only while the
setting is on (D9). A sync test pins the prompt's numbers to the budgets.

### D3. One pure edit planner, shared

`utils/textEdits/` holds the operations and the anchoring:
- **Input:** a text, an ordered list of operations, and the planner's rules
  (front matter to skip, whether `rewrite` is allowed).
- **Output:** non-overlapping ranges with their replacements, or a fault per
  operation (`not-found`, `ambiguous`, `overlapping`, `conflicting-operations`,
  `not-allowed`).
- **Anchoring:** exactly once (`findExactlyOnce`), the rule memory edits use
  today.

Memory edits move onto it first, with no behavior change; their tests run
unchanged. Draft Edit's own passes keep `anchorEdits.ts`. They anchor a
model's quote with its surrounding context, a different rule for a
different input.

### D4. One gateway, the only new caller of the applier

`ProjectFileEditGateway` (an application service, built only in
`extension.ts`, reached through `CoreServices`):

1. **Takes a source-agnostic request.** `FileEditRequest` is
   `{ target, operations, source }`. In v1, `source` is
   `{ kind: 'proposal', turnId, index }`. A trailer and a future capability
   (D10) build the same request.
2. **Resolves the target fresh, host-side.**
   - A catalog key is looked up in a fresh catalog: never a path or URI from
     the model or the webview. The result stays inside the workspace, and
     only text files are accepted.
   - Over a size bound, the target is refused.
   - `<excerpt/>` is the room's excerpt document, and is refused while the
     excerpt is stale.
3. **Opens the document if it isn't open** (D6), and reads the live buffer.
4. **Plans against the live text** with D3's planner, under the target's
   policy (D5).
5. **Applies through `DraftEditApplier`**, with that policy. The applier's
   protected-region, line-break and Markdown-structure checks, its version
   guard and its read-back all apply unchanged.
6. **Reports what landed**, by operation, from the applier's result.

`boundaries.test.ts` pins it: only Draft Edit's runs and the gateway may reach
the applier, and nothing in the Workshop reaches `DocumentEditor` directly.

### D5. Policies by target: prose and notes

| | Prose: `chapters`, `manuscript`, `<excerpt/>` | Notes: every other group |
|---|---|---|
| `rewrite` | Refused: a chapter is never rewritten whole | Allowed, after front matter |
| `find` / `replace-with` | Allowed | Allowed |
| `append` / `prepend` | Allowed, bounded (Q2) | Allowed |
| Line breaks | Allowed (paragraphs may merge or split) | Allowed |
| Markdown structure | Preserved (`editsChangingStructure`) | May change (headings, lists) |
| Protected regions | Never touched | Never touched |
| Rewrite ceiling | Refused when the changed share of the touched paragraphs passes a bound (Q2) | None |

Policies are data (`FILE_EDIT_TARGET_POLICIES`), the way
`DRAFT_EDIT_PASS_POLICIES` are. A new group joins the table, and the compiler
checks that every group has an entry.

### D6. Opening a file that isn't open

`DocumentEditor` gains `open(uri): Promise<DocumentSnapshot | undefined>`. In
VS Code this is `workspace.openTextDocument`: it loads a buffer without
showing it.

The applier never saves, so an edit to a file that isn't visible leaves a
dirty buffer the writer can't see. After a landed edit, the host shows that
document in a preview tab, so the writer sees the change and saves it (or
undoes it). An edit to a visible document is left where it is.

### D7. Cards in the thread

Each proposal is a card under its bubble, like a memory card:
- **What it shows:** the file's name and group, the `<why>`, and each
  operation's before and after (word-level diff; a rewrite shows the new
  text).
- **Actions:**
  - **Apply** sends `review: 'direct'`. The card was the review.
  - **Review in editor…** sends `review: 'preview'` (Refactor Preview), for a
    writer who wants to tick entries.
  - **Decline.**
- **States:** `pending` → `applied` (all or some of its operations, by the
  read-back) / `declined` / `stale` / `refused`. A refusal carries the host's
  reason in the writer's words.
- **Stale:** the anchoring runs again at Apply, against the live text. A quote
  that isn't there exactly once makes the card `stale` ("The file changed
  since this was suggested"), with nothing applied.
- **Correlation:** each action is posted under a webview-minted request id and
  keyed by turn and index, the receipt pattern #221 settled. An answer to an
  old room is ignored.

### D8. Session state

A turn carries `fileEditProposals`: a list like `memoryProposals`, each with
its target (by catalog key or `excerpt`), operations, `why` and state.
- **An applied proposal records what landed:** the catalog key, the document
  version after it, and each applied range's new text. A later Revert (D10)
  can find it again without trusting a version.
- **Development shapes:** during the epic, shape changes go through
  `WorkshopSessionCheckpointNormalization` with logged, tested repairs.
- **Release:** the session schema version is decided under
  [ADR 2026-07-30](2026-07-30-workshop-session-codec-evolution.md).
- **Transcript export** (one projection) includes a card's target, `why` and
  state, never the operations' text.

### D9. One setting

`proseMinion.workshop.fileEdits`: `off` | `ask`, default `ask` (Q1).
- `off` teaches nothing and reads no frame; a frame that arrives anyway is
  dropped and counted.
- The value is read when the reply is read, so a card's state never depends on
  a later change to the setting.

### D10. The seam for autonomous editing (not built)

Approval is a policy, not a code path. What autonomy adds later, and why it
needs no rework:
- **A third setting value, `auto`.** The gateway applies at once instead of
  waiting for a card's Apply. It takes the same `FileEditRequest`, runs the
  same planner, policies and applier, and reads the result back the same way.
- **A mid-turn capability, `file.edit`,** so a persona can read, edit, then
  read again in one turn. It builds the same `FileEditRequest` (D4.1) with
  `source: { kind: 'capability', … }` and joins
  `WORKSHOP_CAPABILITY_OPERATIONS` with a new `file` family.
- **Receipts with Revert.** Revert is an inverse request through the same
  gateway: the applied text, anchored exactly once, replaced by what it
  replaced. Unlike VS Code's undo, it still works after a save or a close.
  D8 records what it needs.
- **Budgets per turn, an activity list, and multi-file batches.**

All of these are additions. The decisions that keep them additions:
- the request doesn't care where it came from (D4.1);
- Apply is a host action keyed by proposal, never a webview write;
- what landed is recorded (D8).

### D11. Guards that never depend on the model

These are code, tested without a model:
- bounds and caps;
- catalog-only targets, contained in the workspace;
- text files only, under a size bound;
- the version guard, protected regions and policies;
- the read-back.

Logs carry ids, counts and fault kinds, never the writer's text or a quote.

## Defaults taken (2026-11-05)

Okey delegated these. Each is the recommendation below, taken as the
default until he says otherwise.

1. **Default.** Should file edits be on ("Ask first") or off until the
   writer turns them on? Recommendation: on. Nothing changes without Apply,
   and a card is cheap to decline.
2. **New prose in a chapter.** May a persona append or prepend new prose to a
   chapter, or only replace passages? And what rewrite ceiling over the
   touched paragraphs? Recommendation: allow append and prepend up to about
   400 words each, and set the ceiling at 60% of the touched paragraphs'
   characters.
3. **Apply on chapters.** Should Apply be direct everywhere (the card shows
   the diff), or always go through Refactor Preview for chapters?
   Recommendation: direct, with "Review in editor…" beside it.
4. **Cap per reply.** Recommendation: 5 files.
5. **Apply to Draft's "Apply Recommendations".** Drop it, since a persona can
   now propose the edits directly, or keep it as a later model pass?
   Recommendation: drop it, and keep Apply Variation (no model) as a later
   gateway use.

## Consequences

- Persona edits, memory edits and Draft Edit share one anchoring vocabulary
  and one write path.
- Apply to Draft needs no engine of its own.
- The writer's draft is protected by the rules Proofread already proved:
  - the version guard;
  - protected regions;
  - Markdown structure;
  - read-back;
  - never saving.
- A persona's reply can carry more output, so prompt budgets grow by the
  frame's teaching. That cost is paid only while the setting is on.
- `DocumentEditor` gains one method (`open`). A desktop host implements it
  with its own document model.

## Alternatives considered

- **Write files directly through the `FileSystem` port.** Rejected:
  - no undo;
  - no live-buffer awareness;
  - it would overwrite unsaved edits.
- **Line-number or offset edits.** Rejected: models miscount, and a moved
  line silently retargets the edit (Draft Edit's rule).
- **A gateway per feature** (one for memory, one for files, one for Apply to
  Draft). Rejected: three anchoring rules and three write paths to review.
- **Autonomous editing first.** Deferred by Okey's choice. D10 keeps it
  additive.
