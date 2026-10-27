# ADR 2026-10-21: Draft Edit Engine and Document Write-Back

**Status:** Accepted (2026-10-25). Proposed 2026-10-21; reconciled on 2026-10-25 with the Lightbox epic it now builds on ([Reconciliation](#reconciliation-2026-10-25-building-on-epiclightbox)).
**Date:** 2026-10-21
**Deciders:** Okey Landers, Ada Forge (Claude Code)
**Epic:** [Draft Edit](../../.todo/epics/epic-draft-edit-2026-10-25/README.md)
**Realizes:** [Feature: Proofread](../../.todo/features/feature-proofread/README.md); the foundation for [Feature: Workshop Apply to Draft](../../.todo/features/feature-workshop-apply-to-draft/README.md)
**Follows the precedents of:** [ADR 2026-10-19 — Lightbox Inspiration Board](2026-10-19-lightbox-inspiration-board.md) (a non-Workshop model scope, the shared JSON repair parser, a non-Workshop recovery caller)
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md); [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Preserves:** the write-free widget boundary of [ADR 2026-07-22 — Conversation Widgets](2026-07-22-conversation-widgets.md)

## Context

The writer wants two things that are, underneath, one operation: turn intent
into edits on the manuscript.

- **Proofread.** From the editor context menu on an open Markdown or
  plain-text file, fix spelling and punctuation and flag the judgment calls,
  above all unintended tense shifts. There are two variants: *Flag* marks
  problems without changing the text; *Fix* applies the safe corrections.
- **Apply to Draft.** From a Workshop agent bubble, apply exactly what the
  agent recommended, including flow and clarity changes that are not
  proofreading. Later, apply a variation card's prose in place of its
  subject.

These facts in the current code shape the design:

1. **Nothing writes to a document.** `EditorContext` is read-only
   (`getActiveSelection()`). No production code calls `WorkspaceEdit`,
   `applyEdit`, diagnostics, or code actions. Architecture tests forbid
   editor writes in one-shot widget slices (`ONE_SHOT_FORBIDDEN_IMPORT_REFERENCE`
   in `boundaries.test.ts`). They also forbid them throughout Show vs. Tell
   and Creative Variations (`showVsTellPresentationBoundaries.test.ts`,
   `creativeVariationsPresentationBoundaries.test.ts`). This ADR introduces
   the first write authority in the product.
2. **Models quote well and count badly.** A model can reliably reproduce the
   phrase it means. It cannot reliably report UTF-16 offsets, line numbers,
   or occurrence indexes in a long passage.
3. **The sidebar's `MessageHandler` exists only while its webview is
   resolved.** A context-menu command cannot route through it the way
   `WorkshopPanelProvider.seedExcerpt` routes through the panel's handler.
   Token usage does not need it: `AgentRunEngine` reports usage through
   `AIResourceManager.addTokenUsageListener`, which fans out to every live
   handler.
4. **The Workshop excerpt carries provenance, not coordinates.**
   `WorkshopExcerpt.source` is `manual`, `editor-selection` (`sourceUri`,
   `relativePath`, 1-based inclusive `startLine`/`endLine`), or `file`. No
   character offsets or document version travel with it. The excerpt also
   carries a SHA-256 `sourceFingerprint`. Persisted `sourceUri`s cross the
   session-file boundary, which is why re-reads go through
   `WorkshopContextIntakeService.authorizeExcerptReread()`.
5. **Re-pinning has one owner.** `WorkshopExcerptScopeHandler.tryReplaceExcerpt`
   performs every side effect of an excerpt change: it calls
   `session.replaceExcerpt`, discards retired sidecar conversations, posts
   the `excerpt_revision` divider, queues the versioned `<pinned-excerpt>`
   host update, and shows the three-revision advisory. `registerMutation`
   refuses a route only when a serialized session operation (save, open,
   rewind, branch, and the like, via
   `WorkshopSessionPersistenceCoordinator.isSessionOperationPending()`) is
   already pending *at entry*. It holds no gate while the handler runs.
6. **Agents already emit strict, keyed recommendations.** Any agent turn may
   carry `actionableFindings`: an exact `### Next steps` section, parsed
   fail-closed, keyed `finding-N`, with at most 12 items of at most 500
   characters. The writer can already Add or Add all of them as todos.
7. **The existing *Editor* focus is a teaching report.** It produces nine
   Markdown sections including creative variations. It inherits the
   writing-tools base prompt's instruction to sample from the p<0.10 tails.
   `OpenRouterClient` defaults to `temperature ?? 0.7` and has no JSON mode.
   Structured model output elsewhere uses sentinel-framed JSON, a codec, and
   `RejectedModelResponseRecovery`. The Lightbox added a shared,
   schema-free JSON repair parser (`parsers/ModelJsonRepair.ts`:
   `parseModelJson`, `salvageModelJson`), guarded so that no repair changes,
   adds, or drops a value.
8. **VS Code supplies the review UI.** `WorkspaceEditEntryMetadata.needsConfirmation`
   opens the Refactor Preview, with a checkbox per edit grouped by `label`.
   Diagnostics and code actions (`CodeActionKind.QuickFix`, `SourceFixAll`,
   `isPreferred`) cover non-destructive flags. (Checked against
   `@types/vscode@1.75.1`. The manifest's `engines.vscode` floor is now
   `^1.82.0`, so all of these are available.)
9. **Model scopes have one selection rule, and engines can be retired
   mid-run.** `ModelScopeSelections.ts` resolves every
   `proseMinion.*Model` setting. *Own* scopes read their own setting with a
   built-in default. *Following* scopes (the Lightbox) run on another scope's
   model until the writer picks one. Only the single `AIResourceManager`
   built in `extension.ts` and carried in `CoreServices` builds engines. When
   the API key is removed or replaced, it detaches every retired engine's
   provider before disposing it. A run still holding that engine fails its
   next call as missing credentials, and sends nothing (PR #169 F-01).

## Decision

### D1. One Draft Edit engine; behaviors are passes, and passes are policies

All document edits flow through one engine, the **Draft Edit** engine, with
three layers. Only the middle layer may call a model:

```text
target resolution              pass (edit producer)              edit application (model-free)
─────────────────              ────────────────────              ─────────────────────────────
context menu: active doc  ──►  proofread (LLM)              ──►  anchor quotes → ranges
Workshop: excerpt source       (reserved: apply-recommendations, protected regions, pass guard
                                apply-variation; see D11)         version guard, review, reconcile
```

```ts
// packages/core/src/domain/models/DraftEdit.ts
export type DraftEditPass = { kind: 'proofread'; output: 'flag' | 'fix'; hints?: string };

/** What every pass emits. Offsets never come from a model (D2). */
export interface ProposedEdit {
  readonly anchor: DraftEditAnchor;
  readonly replacement: string;
  /** Refactor Preview grouping label, and the diagnostic's code. */
  readonly label: string;
}

export interface DraftEditAnchor {
  readonly quote: string;
  readonly before?: string;
  readonly after?: string;
}
```

Each pass registers a row in an exhaustive
`DRAFT_EDIT_PASS_POLICIES: Record<DraftEditPass['kind'], DraftEditPassPolicy>`.
A row names the pass's model scope (or none), its guard, whether newline
changes are allowed, and its review rule (D4). **A new pass adds a union
member, a row, and a producer. It never adds a branch inside the applier.**

The union ships with `proofread` only. The reserved passes (D11) join it when
they are built. This ADR fixes their shape now so that adding them costs a
row, not a redesign.

Options rejected:

- **A write path per feature.** Proofread and Apply to Draft would each
  re-solve anchoring, stale buffers, Markdown protection, and review, and
  drift apart.
- **One prompt with a mode flag.** Proofread and Apply Recommendations differ
  in scope (scan vs. execute), guard (small edits vs. traceability), and
  review. A flag would hide that behind boolean branches.

### D2. Passes propose quotes; the host anchors them

A pass returns `ProposedEdit`s whose anchor is the exact text to replace,
plus optional `before`/`after` context. The applier locates each anchor
deterministically in the target:

- **Exact first.** Search for `before + quote + after` in the target. If a
  side is absent, widen to the quote alone.
- **Normalized fallback, for matching only.** Fold curly and straight
  quotes, NBSP and narrow NBSP, and whitespace runs. Then map the match back
  to the exact source span. The replacement is applied verbatim; the
  normalization never leaks into the text.
- **Ambiguity fails closed.** A quote that matches zero times, or more than
  once after context is applied, is dropped and counted as `unanchored`.
- **Coordinates are the host's.** Offsets are UTF-16 code units into the
  snapshot's text, the same units as VS Code's `offsetAt`/`positionAt`.

Options rejected:

- **Model-reported offsets or line numbers:** see Context 2.
- **Ask for the full corrected text, then diff it.** Output tokens grow with
  passage length rather than issue count. The model drifts (rephrasing,
  dropped sentences) and the drift surfaces as edits. Flag-only judgments
  such as tense cannot be expressed as a diff.

### D3. Two new platform ports: `DocumentEditor` and `IssueAnnotator`

```ts
// packages/core/src/platform/DocumentEditor.ts
export interface DocumentSnapshot {
  readonly uri: string;            // opaque host id (`uri.toString()`)
  readonly version: number;        // changes on every edit to the buffer
  readonly text: string;           // the LIVE buffer, unsaved edits included
  readonly languageId: string;
  readonly relativePath?: string;
}

export interface DocumentTextEdit {
  readonly start: number;          // offsets into the snapshot at `expectedVersion`
  readonly end: number;
  readonly newText: string;
  readonly label: string;          // Refactor Preview grouping
}

// Amended 2026-10-25 (Slice 2): no version (the applier reads it from its
// watch), and a closed document or a refusal is said.
export type DocumentApplyOutcome =
  | { kind: 'submitted' }                    // the host made the edit, or the subset the writer ticked
  | { kind: 'declined' }                     // the writer discarded the preview
  | { kind: 'stale' }                        // the buffer moved past expectedVersion
  | { kind: 'closed' }
  | { kind: 'failed'; message: string };

export interface DocumentEditor {
  // Amended 2026-10-25 (PR #171 F-03, F-04): the read half is a watch on one
  // lifetime of an open document, not a snapshot that may reopen a closed one.
  watch(uri: string, version: number): DocumentWatch | undefined;
  applyEdits(
    uri: string,
    edits: readonly DocumentTextEdit[],
    options: { expectedVersion: number; review: 'preview' | 'direct' }
  ): Promise<DocumentApplyOutcome>;
}

// packages/core/src/platform/IssueAnnotator.ts
export interface DocumentAnnotation {
  readonly id: string;             // the issue id; the code action's handle back to core
  readonly start: number;          // offsets into the snapshot at `version`
  readonly end: number;
  readonly severity: 'info' | 'warning';
  readonly code: string;           // e.g. 'proofread.tense'
  readonly message: string;
  // Amended 2026-10-25 (Slice 2): the quick fix's replacement, routed back to core by id.
  readonly fix?: { readonly replacement: string; readonly preferred: boolean };
}

export interface IssueAnnotator {
  /** Replace every annotation this engine owns for `uri`; offsets belong to `version`. */
  show(uri: string, version: number, annotations: readonly DocumentAnnotation[]): void;
  /** Withdraw some annotations (Dismiss), wherever the writer's edits have since moved them. */
  remove(uri: string, ids: readonly string[]): void;
  clear(uri?: string): void;
  /** Amended 2026-10-25 (Slice 2): where shown annotations sit now, for a quick fix. */
  current(uri: string): { version: number; annotations: readonly DocumentAnnotation[] } | undefined;
}
```

Both ports join `Platform` as `documents` and `annotations`. Their VS Code
adapters live in `apps/vscode-extension/src/platform/vscode/`:

- **`VsCodeDocumentEditor`:**
  - `watch` follows one open document from the version a run read: it
    collects each change event's replacements and settles to the live
    buffer and those edits, or to `closed` once the document closes. A
    language change (VS Code closes and reopens the document) or a reopen
    is another lifetime, and a closed document is never reopened to place a
    late reply (amended 2026-10-25, PR #171 F-04).
  - `applyEdits` checks `document.version` synchronously, builds one
    `WorkspaceEdit` (with `needsConfirmation` when `review === 'preview'`),
    and calls `workspace.applyEdit`.
  - It never saves, and never shows a document the writer did not open.
- **`VsCodeIssueAnnotator`:**
  - It owns a `DiagnosticCollection` named `prose-minion.draftEdit` and a
    `CodeActionProvider` for `markdown` and `plaintext`.
  - It refuses a `show` whose `version` is no longer the document's, so
    flags are never drawn on moved text.
  - On `onDidChangeTextDocument` it shifts annotation ranges by the change
    deltas (a pure core helper does the arithmetic), and drops any
    annotation an edit overlaps. It is the source of truth for where a shown
    flag sits, which is why Dismiss calls `remove` rather than re-`show`.
  - It clears a URI's annotations on close.
  - A replacement suggestion is part of the message in Slice 1; it becomes a
    quick fix in Slice 2, when there is a write path.

Options rejected:

- **Write methods on `EditorContext`.** That port is focus-sensitive (it
  remembers the last real selection when a webview holds focus) and widely
  consumed. Adding writes would grant write authority to every consumer and
  blur the guard in D10. Keeping writes on a separate port makes them
  greppable.
- **`FileSystem.writeFile`.** It writes the disk rather than the buffer, so
  it would clobber unsaved edits, bypass undo, and race the editor.

A non-VS-Code host implements both ports. A desktop host may render
annotations in its own way, or not at all, without any change to core.

### D4. The applier is model-free, the only door to `DocumentEditor.applyEdits`, and never trusts the boolean

`DraftEditApplier` (`application/services/draftEdit/`) turns a pass's
`ProposedEdit`s into a document change:

1. **Follow the target** from the version the run read (D3's watch). Each
   edit moves through the writer's edits during the model call, as the
   annotator moves shown flags; one an edit touched is dropped as `stale`,
   never searched for again, so it can never land on another occurrence of
   its words. Protected regions are found again on the live text, and an
   edit now inside one is dropped as `protected` (amended 2026-10-25, PR #171
   F-03).
2. **Protected regions.** Drop any edit that touches any of these:
   - front matter;
   - fenced code or inline code;
   - link and image targets, autolinks, or reference definitions;
   - HTML comments or tags.

   Constructs are read whole, wherever Markdown's containers put them: block
   structure from `marked`'s block lexer, inline constructs from one
   CommonMark-precedence pass (`utils/draftEdit/markdownBlockRegions.ts`,
   `markdownInlineRegions.ts`; amended 2026-10-25, PR #171 F-02).

   Plain-text documents have none. *Indented* code blocks are deliberately
   **not** protected. Fiction writers routinely indent paragraphs with a tab
   or four spaces, which Markdown reads as code, so protecting them would
   silently skip prose (amended 2026-10-25).
3. **The pass guard** (D6 for Proofread) downgrades or drops edits by policy.
4. **Overlaps** are resolved by keeping the earlier-starting edit and dropping
   the rest as `overlapping`.
5. **One `applyEdits` call** per run with `expectedVersion` = the re-snapshot
   version. That is one undo step. A `stale` outcome triggers one
   re-snapshot and re-anchor, then fails cleanly.
6. **Review** follows the pass row. Proofread honors
   `proseMinion.proofread.fixReview` (`preview` by default). The reserved
   passes always preview.
7. **Reconcile.** The applier never treats `submitted` as "all landed". The
   writer may have unchecked entries in the preview. It re-snapshots and
   re-anchors each edit's *after* form (`before + replacement + after`)
   against its *before* form to classify it as `applied`, `not-applied`, or
   `unknown`. Proofread renders not-applied fixes as flags (D7).

The use case returns a `DraftEditOutcome` that each host presents:

```ts
export interface DraftEditOutcome {
  readonly proposed: number;
  readonly applied: number;
  readonly flagged: number;
  readonly dropped: Readonly<Record<'unanchored' | 'stale' | 'protected' | 'overlapping', number>>;
  readonly declined: boolean;
  readonly rejectedChunks: number;          // D6: unreadable model responses
  readonly usage?: TokenUsage;              // summed across the run's calls
}
```

One run per URI at a time. A second request for a URI already in flight is
refused with "already proofreading *chapter-03.md*". Every run takes an
`AbortSignal`, and cancellation leaves the document untouched.

### D5. Write authority comes from a fresh gesture or a confined path

- **Context menu: a fresh gesture.** The command handler captures the active
  editor's URI, version, text, and selection offsets in one synchronous read
  at gesture time. It passes them as the target, and the use case never
  re-reads `activeTextEditor`. Any scheme the editor can edit is allowed,
  including `untitled:`, because the writer is pointing at it.
- **Workshop: a confined path.** The URI comes from session state, which can
  outlive the gesture that created it and can be edited on disk. Before the
  snapshot, and again immediately before `applyEdits`, the target must
  satisfy a **write-confinement policy** that is stricter than re-read:
  - `file:` scheme only;
  - inside an open workspace folder (`isPathWithinRoot`,
    `infrastructure/storage/pathContainment`), with every workspace-relative
    ancestor non-symlinked. That check moves out of the Workshop's re-read
    validation into a shared helper, so reads and writes cannot drift;
  - **never** a configured external resource, even though re-reads allow
    them. Reference material is read-only.
  - A refusal leaves the document and session untouched.

### D6. The Proofread pass

- **Model scope: an own scope, with a cheap default.** `proofread` joins
  `ModelScope` as an *own* scope in `ModelScopeSelections.ts`, not a
  following one (Context 9).
  - Its key is `MODEL_SCOPE_SETTING_KEYS.proofread = 'proofreadModel'`, and
    its default is `DEFAULT_PROOFREAD_MODEL = 'anthropic/claude-haiku-5.5'`.
  - Proofreading wants precision and speed, not the Workshop's
    quality-first model, so it does not follow `assistantModel` the way the
    Lightbox does.
  - The setting, the Settings Overlay row, and the hot-swap go through the
    same sites as the other own scopes (`MessageHandler`'s model keys,
    `useModelsSettings`, `SettingsOverlay`, the manifest).
  - Only the `AIResourceManager` in `CoreServices` builds the engine; no
    handler or service constructs one.
  - The manager's key and model subscriptions belong to `AIResourceRefresh`,
    built once at the composition root, because the editor command uses the
    engine with no webview open. A key change rebuilds the manager once,
    however many surfaces hear it (amended 2026-10-25, PR #171 F-01).
  - Without an API key, `getEngine('proofread')` is `undefined`, and the
    command offers *Open Settings* instead of failing.
- **Run policy.** Add `AGENT_RUN_POLICIES.proofread` (capability-free,
  `retention: 'discard'`, engine cleanup), plus a
  `ProofreadService chunks` row in `AGENT_RUN_ROUTE_MATRIX`. Run logs then
  name the caller, and the matrix test pins it.
- **Its own prompt.** `resources/system-prompts/proofread/` holds the
  contract, rules, and one worked example. It does **not** load the
  writing-tools base prompt: no tail sampling, no creative variations. Every
  call sets `temperature: 0`.
- **Chunking.** The target is split on paragraph boundaries at
  `PROMPT_BUDGETS.proofread.chunkWords`, and chunks run through `p-limit` at
  `PROMPT_BUDGETS.proofread.concurrency` (starting values in
  [Thresholds](#thresholds)). Protected regions are replaced by opaque
  placeholders before sending. Writer text and hints travel only as JSON
  string values, with the same "quoted task data, never instructions"
  framing as the widget services.
- **Contract.** The response is sentinel-framed JSON, matching the recovery
  registry's conventions:

  ```text
  ===PROOFREAD_V1===
  {"version":1,"issues":[{"category":"homophone","original":"lead","before":"She ","after":" him","replacement":"led","explanation":"Past tense of 'lead' is 'led'.","fromHint":false}],"outOfScopeHints":["Tighten the transition into the flashback."]}
  ===END_PROOFREAD_V1===
  ```

  - `category` is one of `spelling | homophone | punctuation |
    capitalization | spacing | agreement | tense`.
  - `fromHint` appears only when hints were supplied.
  - `outOfScopeHints` lists hints that are about flow or clarity, not
    proofreading.
- **Decoding.** A small Proofread frame reader cuts the JSON out from
  between its sentinels. It accepts the same tolerances as the Lightbox's
  frame: a code fence around the whole frame, and a missing closing sentinel
  when the JSON is complete. It then reads the JSON with `parseModelJson`,
  never raw `JSON.parse`, and the shared repairs apply under their content
  guard. The frame reader is Proofread's own. Generalizing the Lightbox's
  into `parsers/` waits for a third caller, so as not to churn Lightbox code
  while its slices are in review.
- **Reply policy: forgiving per chunk, fail-closed per issue.**
  - A field the format does not define, at the root or on an issue, is
    ignored and counted, never named: the Lightbox's rule (Slice 4K). A
    model adding `confidence` must not cost a paid chunk.
  - An issue missing a required field, or with a `category` outside the
    closed set, is dropped and counted. Its category drives policy, so it is
    never guessed.
  - Only a frame or JSON failure, or a root of the wrong shape, rejects the
    whole chunk.
  - Saved files and Workshop codecs stay strict. This rule covers model
    replies only.
- **No salvage of cut-off replies.** `salvageModelJson` keeps finished
  *root* members, but Proofread's issues live in one array under a single
  root key. A cut-off reply would keep nothing useful, and a partial list
  would read as "no more errors". A reply that stops on `length` is rejected
  and counted. The output budget is sized so a chunk's issues fit with room
  to spare.
- **Category policy, in code.** `FIXABLE = {spelling, homophone, punctuation,
  capitalization, spacing}` and `FLAG_ONLY = {agreement, tense}`. A flag-only
  issue's `replacement` is a suggestion: a non-preferred quick fix, never
  applied by Fix.
- **The mechanical guard.** A fixable edit survives as `fix` only if it is
  small. Anything else is downgraded to `flag` with
  `downgradeReason: 'non-mechanical-edit'`.
  - Spelling and homophone edits stay within a bounded edit distance (e.g.
    ≤ max(2, 30% of the token)).
  - Punctuation, spacing, and capitalization edits differ only in
    punctuation, whitespace, or case.
  - **No fix adds or removes a newline.** Proofreading never needs to, and
    the rule keeps line-based provenance (an `editor-selection` excerpt's
    lines) valid after a fix.
- **Hints are advisory.** On the Workshop path, hints are candidates to
  verify, never orders. A persona calling a style choice an "error" does not
  make it one.
- **Prompt rules.**
  - Preserve dialect and eye-dialect in dialogue, invented names and words,
    and deliberate fragments.
  - Exempt dialogue from narrative-tense rules.
  - Don't normalize style-sheet choices (serial comma, dash spacing, quote
    style) unless the passage is internally inconsistent, and then only
    flag.
  - Apply `proseMinion.proofread.spellingConvention`
    (`auto | american | british | canadian | australian`).
- **Failure isolation.**
  - Each chunk decodes independently. A rejected chunk is captured through
    `persistRejectedModelResponse`, under a `proofread` entry in
    `RECOVERABLE_RESPONSE_CONTRACTS`. It is counted in `rejectedChunks` and
    dropped without failing the run.
  - The recovery presenter runs at most once per run, so failed chunks do
    not open a pile of editors.
  - The registry moved out of the Workshop and was renamed (commit
    `d058e8d2`): from `shared/types/messages/workshop/recovery.ts` to
    `shared/types/messages/recovery.ts`, with `RECOVERABLE_RESPONSE_CONTRACTS`,
    `RecoverableToolName`, `RejectedModelResponseInput`, and
    `persistRejectedModelResponse`.
- **The key changing mid-run.** A run holds its engine for every chunk. If
  the key is removed or replaced during a run, the next call fails as
  missing credentials, and nothing is sent (Context 9).
  - The run then stops starting chunks, keeps the issues from chunks that
    finished, and reports "the API key changed during the run; N of M
    chunks proofread".
  - It is not counted as rejected chunks, and nothing is captured for
    recovery.
  - The test follows the Lightbox's `LightboxKeyRetirement.test.ts`: real
    `OpenRouterClient`s whose transport is the only stand-in, with the first
    request held.
- **The last run's issues, in memory.** The use case keeps each URI's last
  Proofread issues for the session only, with no persistence (feature
  decision 3). Quick fixes, "Fix all", and Dismiss refer to issues by id.
  They go back through the applier (D4), which re-anchors against the live
  text. They never write from stale diagnostic ranges.

Options rejected:

- **Reuse the *Editor* focus** (Context 7). It is a report for reading, not
  an operation, and its sampling instructions are wrong for proofreading.
- **Reuse the `dictionary` or `widget` scope.** Proofread's cost and latency
  profile is its own, and the writer should be able to choose its model
  independently.
- **A following scope** (blank follows the Workshop's or the Dictionary's
  model, as the Lightbox follows the Workshop's). Following the Workshop
  would put an expensive, quality-first model on a precision task.
  Following the Dictionary would couple two unrelated choices. Decided
  2026-10-25: an own scope with a cheap default.

#### Thresholds

Starting values, decided 2026-10-25. Each lives in one constant so the
Slice 1 fixtures can tune it without touching logic.

| Threshold | Starting value | Lives in |
|---|---|---|
| Chunk size | ≈1,200 words, cut on paragraph boundaries | `PROMPT_BUDGETS.proofread.chunkWords` |
| Chunk concurrency | 3 | `PROMPT_BUDGETS.proofread.concurrency` |
| Output budget per chunk | 4,000 tokens | `PROMPT_BUDGETS.proofread.outputTokens` |
| Spelling / homophone edit size | ≤ max(2, 30% of the token's length) characters | the Proofread guard |
| Whole-file confirmation | > 15,000 words (D8) | `PROMPT_BUDGETS.proofread.confirmWholeFileWords` |

### D7. Flags are diagnostics, never inline markup, and last only the session

- **Flag never modifies the document.**
  - Each issue becomes a diagnostic: `source: 'Prose Minion'`,
    `code: 'proofread.<category>'`.
  - Severity is `Information` for fixable issues and `Warning` for
    tense/agreement.
  - The message is the explanation.
  - Code actions offer *Replace with '…'* (preferred for fixable issues),
    *Fix all Prose Minion proofread issues*, and *Dismiss*. Every action is
    a command routed to core, never a raw `WorkspaceEdit`, so D4's guards
    always apply.
- **Fix renders the leftovers as flags.** Flag-only issues, downgraded
  fixes, and fixes the writer unchecked in the preview (D4 step 7) all
  become diagnostics.
- **Session-only lifetime.** Annotations clear on close, on
  *Clear Proofread Flags*, on the next run for that URI, and where an edit
  overlaps them. They are not restored after reload. A selection run
  replaces only the flags that overlap its selection (amended 2026-10-26,
  Slice 3).

Option rejected: **inline `**bold**` or `~~strike~~` marks.**

- `**` is indistinguishable from the author's own emphasis.
- Neither mark renders in `.txt`.
- `~~` can express neither "replace with X" nor "this tense looks wrong".
- Flagging is a read, and writing marks dirties the buffer and the VCS
  diff.

If portable marks are wanted later, CriticMarkup carries the original, the
correction, and a note without colliding with Markdown (see Out of scope).

### D8. Context-menu commands call the use case directly

| Command | Title | Pass |
|---|---|---|
| `prose-minion.proofreadFlag` | Prose Minion: Proofread and Flag | `{ kind: 'proofread', output: 'flag' }` |
| `prose-minion.proofreadFix` | Prose Minion: Proofread and Fix | `{ kind: 'proofread', output: 'fix' }` |
| `prose-minion.clearProofreadFlags` | Prose Minion: Clear Proofread Flags | annotator only |

- **Visibility.** The `editor/context` entry uses
  `editorLangId == markdown || editorLangId == plaintext`, with **no**
  `editorHasSelection`. A non-empty selection narrows the target; otherwise
  the whole document is proofread. There is no `commandPalette` rule: the
  project hides no command there (a manifest test enforces it), so from the
  palette any other language is refused with a message (amended 2026-10-25).
- **Long files confirm first.** A whole-file run over
  `PROMPT_BUDGETS.proofread.confirmWholeFileWords` (15,000 words) shows a
  modal naming the word count and the number of model calls before anything
  is sent. *Cancel* sends nothing. A selection never confirms, however long.
  Typical chapters never see the modal.
- **Wiring.** `DraftEditUseCase` is constructed at the composition root.
  Command handlers in `extension.ts` call it directly, not through a webview
  `MessageHandler` (Context 3). It joins `CoreServices` when a webview
  handler first needs it, the Workshop's in Slice 4 (amended 2026-10-25).
  The command rules live behind a host port in
  `application/commands/proofreadCommands.ts`, so they are tested without a
  VS Code mock, like the Lightbox's Open File command.
- **Progress and summary.** Handlers wrap the run in a cancellable
  `window.withProgress`, which feeds the `AbortSignal`. They present the
  `DraftEditOutcome` as one notification, e.g. "Proofread chapter-03.md:
  9 issues flagged (2 tense or agreement) · 1 not placed · $0.0040", worded
  once in core (`describeDraftEditOutcome`). It offers *Show Problems* when
  flags were shown and *Open Settings* when there is no key. (Since Slice 3b
  the count reads "(2 need your judgment)": every flag-only category.)
- **Activation.** `onCommand:` activation events are added, matching the
  manifest's style.

Option rejected: **routing through the sidebar's `MessageHandler`.** It does
not exist until the sidebar is opened (Context 3).

### D9. Workshop actions get their own route owner, not a widget

- **`WorkshopDraftEditHandler`** joins `WorkshopMutationRouteOwner`. It is
  composed in `WorkshopSliceComposition`, registered through
  `registerMutation`, and receives `DraftEditUseCase` from `CoreServices`.
  It constructs nothing.
- **Messages.** `WORKSHOP_DRAFT_EDIT { turnId, pass }` goes webview → host.
  Payload `pass` is a Workshop-safe subset: for this ADR, only
  `{ kind: 'proofread' }`, always in fix output. `WORKSHOP_DRAFT_EDIT_RESULT
  { turnId, outcome }` comes back. URIs never reach the webview.
- **Host-derived enablement.** The snapshot gains
  `turnDraftEditability: Record<string, WorkshopTurnDraftEditability>`,
  derived per bubble in the same way as `turnRewindability`. The webview
  consumes it and never re-derives it. It is derived state, not session
  data, so the session codec is unchanged. A bubble is eligible when:
  - it is an agent reply;
  - the excerpt source is `file` or `editor-selection`;
  - the turn's `excerptVersion` equals the current excerpt version (the rule
    that already disables Add finding);
  - and no room run is active (`WorkshopRunGate`).

  Otherwise the bubble carries a reason. `manual` excerpts are ineligible in
  this ADR.
- **Target resolution.** A single resolver, `WorkshopExcerptWriteTarget`,
  maps the excerpt source to a target under D5's confinement policy.
  - `file` targets the whole document.
  - `editor-selection` targets `startLine..endLine`. It first confirms that
    those live lines still match the excerpt text (normalized compare). If
    they don't, it searches the document for the excerpt. If the excerpt
    isn't found, it refuses: "the excerpt no longer matches *chapter-03.md*;
    re-pin and try again".
- **Hints.** The Proofread button runs the full excerpt scan (feature
  decision 2), with hints built from the bubble's *visible* content via
  `projectWorkshopTranscriptTurn`, including its `actionableFindings`.
  Host-private bodies never enter the prompt. The summary credits the agent
  (`fromHint`) and hands `outOfScopeHints` off ("2 notes were about flow").
- **Re-pin, with one owner.** Extract `tryReplaceExcerpt`'s body into a
  `WorkshopExcerptReplacer` collaborator. `WorkshopSliceComposition` builds
  it once and hands it to both `WorkshopExcerptScopeHandler` and
  `WorkshopDraftEditHandler`. After a change lands, the handler re-reads the
  target and re-pins through it, producing the ordinary `excerpt_revision`
  divider and versioned frame. No new divider reason and no new persisted
  field are added.
- **No gate is held across a model call or a preview.** The handler captures
  the room identity and excerpt version at the start. Before re-pinning, it
  requires that no session operation is pending, the room is unchanged, and
  the excerpt version is unchanged (Context 5). If any check fails, the
  document edit stands but the re-pin is skipped, and the writer is told to
  re-pin by hand.

Option rejected: **a conversation widget.** Widgets commit into the
conversation, and that boundary is deliberately write-free (D10). Draft Edit
writes to the manuscript.

### D10. Architecture guards

- **One write door.** Outside the composition root and the platform barrel,
  only `DraftEditApplier` may reference `DocumentEditor`. Only the use case
  and the applier may reference `IssueAnnotator`. A new `boundaries.test.ts`
  case enforces this.
- **Widgets stay write-free.** `ONE_SHOT_FORBIDDEN_IMPORT_REFERENCE` gains
  `DocumentEditor|IssueAnnotator`. The Show vs. Tell and Creative Variations
  no-write tests are unchanged.
- **Pass exhaustiveness.** `DRAFT_EDIT_PASS_POLICIES` is a `Record` over
  `DraftEditPass['kind']`, and every switch on `kind` has an explicit
  `never` default.
- **Core stays `vscode`-free.** The existing static and dynamic import guard
  covers the new ports.

### D11. Reserved passes: constraints fixed now, built later

These are designed in Feature: Workshop Apply to Draft and are **not**
implemented by this ADR. Their shape is fixed so that they fit D1 without
changing the applier.

- **`apply-recommendations` (LLM).**
  - **Input:** one or more `DraftRecommendation { ref, text }`, typed as a
    non-empty tuple and drawn from a turn's `actionableFindings`. Payload:
    all of them, or one finding via an *Apply* button beside *Add*.
  - **Scope:** it executes only what is requested. It does not scan the
    target.
  - **Output:** per recommendation, either `applied` with its edits or
    `skipped` with a reason.
  - **Guard:** traceability. Every edit cites a requested `ref`, uncited
    edits are dropped, and a rewrite ceiling refuses the result as "a
    rewrite, not an application".
  - **Newlines are allowed.** The applier recomputes an `editor-selection`
    line range from the applied edits before re-pinning.
  - **Review:** always preview, labeled by recommendation.
  - **Model:** decided when the pass is built.
- **`apply-variation` (no model).** A committed variation card's prose
  replaces its subject quote. Its route lives outside the widget feature
  folders and resolves the card host-side by id, so D10's widget guards
  stand.

## Consequences

- **Write authority enters core.** The blast radius is bounded by one door
  (D10), a confinement policy (D5), and live re-anchoring (D4). A new
  feature that wants to edit the manuscript must become a pass rather than a
  new door.
- **Two more ports** for every host. `IssueAnnotator` may be a no-op where a
  host has no diagnostics surface.
- **A seventh model scope.** The Settings Overlay gains a row; the tests
  that pin the scope set (`ModelScopeSelections.test.ts`,
  `MessageHandler.test.ts`, `useModelsSettings.test.ts`,
  `SettingsOverlay.test.tsx`) are updated.
- **Cost scales with chunks.** A whole-chapter proofread is several small
  calls. The cost is shown on every run, and appears in the sidebar's token
  widget whenever the sidebar is open.
- **A Workshop proofread is an excerpt change.** Like every excerpt change,
  it retires live tool sidecars and counts toward the three-revision
  advisory.
- **Preview acceptance is partial by design.** Reconciliation (D4 step 7) is
  the price of letting the writer uncheck edits, and it is what keeps the
  summary and the flags honest.
- **Flags vanish on reload**, by decision. A writer who wants them back
  reruns Flag.
- **Two features now sound alike.** The Assistant's *Editor* focus teaches;
  Proofread operates. The Workshop catalog currently describes `editor` as
  "A holistic developmental editor pass" (`workshopTools.ts:36`) while its
  prompt is a copyedit. Correct that description in the first delivery
  slice.

## Delivery

Slices follow the feature's sequencing:

1. **Read side + Proofread and Flag:** D1, D2, D3 (`IssueAnnotator`, and
   `DocumentEditor.snapshot` only), D6, D7, and D8 (Flag and Clear), plus
   D10.
   - Flag needs the live buffer: the writer may type during the model calls,
     so flags follow the writer's edits through a watch on the open document
     before they are shown. The read half of `DocumentEditor` therefore lands
     here, and `applyEdits` lands in Slice 2 (amended 2026-10-25; the watch
     replaced a snapshot after PR #171 F-03 and F-04).
   - Automated tests never call a provider. Provider clients run on mocked
     transport, and fixtures are public-domain text (*Alice's Adventures in
     Wonderland*) with seeded errors.
   - Before Fix ships, the writer runs Flag in the Extension Development Host
     on the same seeded public-domain fixtures, with their own key, and
     records the false-positive rate. That run confirms or replaces the
     default model.
2. **Write side + Proofread and Fix:** D3 (`DocumentEditor.applyEdits`),
   D4, D5 (gesture), and D8 (Fix).
   - Spike first: confirm how `applyEdit` resolves when the preview is
     discarded, and what VS Code does when the buffer changes while the
     preview is open. D4's reconciliation must hold either way. Done from
     VS Code's source: see [Amendment 2026-10-25: Slice 2, the write
     side](#amendment-2026-10-25-slice-2-the-write-side).
3. **Polish:** submenu, spelling convention, cost in the summary, and a
   selection run that replaces only its own flags. See [Amendment
   2026-10-26: Slice 3, polish](#amendment-2026-10-26-slice-3-polish).
   Proofread's wider coverage follows as Slice 3b.
4. **Workshop Proofread button:** D5 (confined path), D9.
5. **Apply to Draft:** D11, each pass a new row.

## Resolved Questions (2026-10-25)

1. **Name: "Draft Edit".** It ties Proofread to Apply to Draft, and avoids a
   fifth thing called "editor" (the *Editor* focus, the Workshop `editor`
   tool, Wren the line editor, and the `EditorContext` port already exist).
2. **Whole-file cost: confirm above 15,000 words** (D8). Selections never
   confirm.
3. **Thresholds: the starting values in [Thresholds](#thresholds)**, each
   in one constant, tuned against the manual fixture run.
4. **Proofread's model when unset: an own scope with a cheap default**
   (`anthropic/claude-haiku-5.5`), not a following scope (D6).

## Reconciliation 2026-10-25: building on epic/lightbox

The ADR was proposed against `main`. Draft Edit now branches from
`epic/lightbox`, which by then had set precedents this ADR adopts rather than
re-inventing:

| Area | Lightbox precedent | What changed here |
|---|---|---|
| Model scope | `'lightbox'` in `ModelScope`; one selection rule in `ModelScopeSelections.ts`; engines only from the `CoreServices` manager | D6: `proofread` is an own scope in that rule, with `DEFAULT_PROOFREAD_MODEL`. |
| Engine retirement | PR #169 F-01: retired engines are detached before disposal, so a held engine sends nothing | D6: a key change stops the run, keeps finished chunks, and is reported. Tested like `LightboxKeyRetirement.test.ts`. |
| JSON | `parseModelJson` / `salvageModelJson`, with a content guard | D6: decode through `parseModelJson` in a Proofread frame reader. No salvage, for the stated reason. |
| Undefined fields | Slice 4K: ignored, counted, never named | D6: same rule for Proofread replies. Issues stay fail-closed. |
| Recovery registry | `'lightbox-readings'` added in place under `workshop/` | Moved and renamed in `d058e8d2`, Lightbox imports included. Proofread adds a `proofread` entry. |
| Path containment | `infrastructure/storage/pathContainment` (`isPathWithinRoot`) | D5 names it, and extracts the symlinked-ancestor check to sit beside it. |
| Host floor | `engines.vscode` raised to `^1.82.0` | Context 8 updated; every API used here is available. |

Project rules adopted from the epic:

- no live or billable provider calls in tests or anywhere else;
- public-domain fixtures only;
- the full suite passes under Node 18 (CI's version) before every push, with
  no assertions on V8-specific error wording.

## Amendment 2026-10-25: PR #171 review (Slice 1)

Astra's review of Slice 1 found six blocking defects. Each changed a
decision above:

| Finding | Decision |
|---|---|
| F-01: the editor command could miss a model or key change when no webview was open | D6: `AIResourceRefresh` owns the shared manager's subscriptions for the extension's lifetime. Every surface asks it to refresh for a key change. Requests are numbered before anything is awaited, and only the newest request's reading of the key counts; an older one joins it. The newest compares its reading with the key the manager adopted (`adoptedKeyFingerprint`) and, if they differ, hands the manager exactly that key, which it adopts trimmed, as the fingerprint reads it (second re-review). One key change is one rebuild, and a late, obsolete read can neither retire a run on a newer key nor hide the next deletion (re-review). Model changes hot-swap in place, idempotently. |
| F-02: valid protected Markdown reached the payload | D4 step 2: complete constructs. Fences, definitions and raw `<script>`/`<style>` blocks inside block quotes and list items; balanced, escaped, angle-bracketed, line-broken and empty-before-a-title destinations; definitions on several lines; email autolinks; maximal backtick runs; quoted attributes holding `>`. Inline constructs are read one scope at a time, the parser's own leaf blocks and table cells with container prefixes stripped, so nothing pairs across blocks (re-review); a row's last cell is read however the row ends (second re-review). Every line is checked against the source; anything that does not line up, or a document nesting quotes and lists past any manuscript's depth (list indentation counted inside quotes too), is protected whole. What cannot be classified within a bound is not prose: a destination nested past `MAX_LINK_PAREN_DEPTH` parentheses protects the rest of its scope (second re-review). Indented paragraphs stay prose. |
| F-03: the live re-anchor could move a finding to another occurrence, or into code | D4 step 1: findings follow their own occurrence through the recorded edits, and the live text's protected regions are found again. |
| F-04: a reply could draw flags after the document closed | D3: the read half is a watch bound to one document lifetime. A run whose document closed returns `closed` and shows nothing; one whose document moved before it started returns `changed` and sends nothing. |
| F-05: a call with no usage record made a partial cost look whole | A cost or cache total needs every call's record; `requestCount` counts every call (`utils/tokenUsage.ts`). |
| F-06: a failed recovery save was called saved | A rejected chunk carries whether its capture was saved; the outcome counts `saved` and `unsaved`, and the summary says which. D4's outcome sketch's `rejectedChunks` is that pair. |

## Amendment 2026-10-25: Slice 2, the write side

### The spike: what `workspace.applyEdit` does

No VS Code could be downloaded in the build environment (its network policy
denies the update host), so the spike read VS Code's own source instead. It
read the bulk-edit service, the Refactor Preview pane and contribution, the
conflict detector and the text-edit task, at `main` (`4f383697`) and at
`1.82.0`, this extension's engine floor. Both read the same:

| Question | What VS Code does | Source |
|---|---|---|
| The writer discards the preview | The pane resolves with nothing, no edit is made, and `applyEdit` resolves `false` | [`bulkEditPane.ts` `_done`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts), [`bulkEditService.ts` `apply`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/bulkEditService.ts) |
| The writer applies the preview | Only the ticked entries are made; `true` when any was | the same, `isApplied: edits.length > 0` |
| The buffer changes while the preview is open | A conflict: Apply shows "Cannot apply refactoring because … has changed in the meantime", nothing is made, `false` | [`conflicts.ts`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/conflicts.ts), `bulkEditPane.ts` `accept` |
| The buffer moves after the extension's own check | Each text edit carries the document's version from the extension host; VS Code refuses a stale one ("has changed in the meantime"), `false` | [`extHostTypeConverters.ts`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/api/common/extHostTypeConverters.ts), [`bulkTextEdits.ts`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/bulkTextEdits.ts) |
| Entries marked `needsConfirmation` | They open **unticked**; Apply stays disabled until one is ticked. It is the only way an extension can open the preview | [`bulkEditPreview.ts` `_init`](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts) ([1.82.0](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts)) |
| An edit to the active editor's document | VS Code may make it "more minimal" first: one replacement can arrive as smaller changes inside its range (at 1.82.0 always; at `main` unless the entry carries metadata) | `bulkTextEdits.ts` `_createEditsTasks` |

### What changed in the decisions above

- **D3, the outcome.** `DocumentApplyOutcome` is `submitted`, `declined`,
  `stale`, `closed` or `failed`, with no version: the applier reads the live
  version from its own watch. `false` is told apart by the document: closed,
  moved (`stale`), or neither (`declined` in review, `failed` direct).
- **D3, the annotator.** `DocumentAnnotation` carries an optional `fix`
  (replacement, and whether it is preferred), and `IssueAnnotator.current`
  says where a document's shown annotations sit now. A quick fix asks it
  before core writes, because the annotator moves shown flags as the writer
  types (D3), and core never writes from a stale range (D6).
- **D4 step 5, retry.** A `stale` direct apply follows its edits through the
  writer's typing and asks once more. A reviewed one never does: the writer
  was editing during review, and a second preview would be a surprise.
- **D4 step 7, reconcile.** What landed is read by following each edit's
  range through every change since the edits' version
  (`utils/draftEdit/reconcileEdits.ts`), never by searching for its words. A
  change inside a range, edges included, is taken into it: that is where
  VS Code's smaller edits land. A change across an edge breaks it. Then the
  replacement standing there reads as `applied`, the original as
  `not-applied`, anything else as `unknown`. Edits that touch are joined
  into one before asking, so every change belongs to exactly one of them.
- **D4, the refusals.** The applier refuses, and counts, an edit whose text
  is no longer its original, one inside a protected region of the live text,
  one that would change a line break (`utils/draftEdit/lineBreaks.ts`: the
  changed text, between the common prefix and suffix, holds none; counting
  them was not enough, PR #171), and one overlapping an earlier edit.
- **D6, the guard.** A fix that adds or removes a Markdown markup character
  (a backtick, `|`, `<`, `>`, `*`, `_`, `~`, `[`, `]`, `#`, or a backslash)
  is flagged instead (`markup-change`). Letters unchanged is not enough once
  Fix writes: a backtick turns prose into code, a pipe splits a table cell.
  Anchoring refuses a normalized match that ends inside one character's
  expansion, so `Wait.` never anchors on `Wait…` (PR #171).
- **D7, review, decided 2026-10-25 by the writer.** Fix goes through Refactor
  Preview by default, its entries unticked as VS Code opens them: nothing
  changes until the writer ticks the file (all fixes) or single fixes, then
  Apply. The progress line says so while the preview is open. A Discard, an
  untick, or a refusal flags the fix where its text stands after; a fix the
  writer rewrote during review is left as they wrote it.
  `proseMinion.proofread.fixReview: apply` applies at once instead. *Fix
  all* honors the setting; a single *Replace with '…'* applies at once,
  since choosing it is the review. It is preferred only for a fix Proofread
  would make itself; a judgment call's suggestion is offered, never
  preferred, and never applied by Fix or *Fix all*.
- **The setting** is a VS Code setting, read at the gesture, with no
  Settings Overlay row, like the Workshop's settings: it governs an editor
  command, not a sidebar tool.
- **Known limit.** Once the preview is open, the progress notification's
  Cancel cannot close it: the extension API has no call for that. The writer
  applies or discards in the preview.

## Amendment 2026-10-25: PR #172 review (Slice 2)

Astra's review of Slice 2 found four blocking defects on the write side,
and her re-reviews of the corrections found two more (F-05, F-06) and a gap
in F-03's (table cells). Each changed a decision above, except F-02, which
the writer accepted as a limit of VS Code's preview:

| Finding | Decision |
|---|---|
| F-01: a stale direct retry wrote into code the writer had just fenced | D4 step 5: a retry follows each edit through the writer's typing, then checks every rule again against the document as it now stands (text, protection, line breaks, overlaps, structure) before asking. |
| F-03: a spacing fix with the same markup characters made a tag, or a fence | D4, D6: a fix must leave the document's Markdown structure as it was. Each top-level block an edit touches is lexed by `marked` before and after, its inline content with the document's own link definitions, and the shape (token types and nesting, heading depths, list kinds and task boxes, and every table cell's inline shape with the columns' alignment) must match (`utils/draftEdit/markdownStructure.ts`). The re-review found the first version reduced a table to its size, so a tag or a reference link made inside a cell passed. The batch is judged together; when a block's shape moves, its edits are kept in order only while the shape holds. A block too long to verify refuses its edits; since spans an edit touches at their edges join, a long run of such paragraphs can pass the bound together, and its fixes are then flagged instead (a conservative availability limit the re-review recorded). The policy row gains `preservesMarkdownStructure`. Placement downgrades such a fix to a flag (`markup-change`), so it is never preferred, and the applier checks again on the live text. |
| F-04: at 1,000 operations VS Code merges an edit into one spanning change, and every fix read as unknown | D4 step 7: reconciliation replays the document. A change and the edits it touches form a cluster; the cluster's new text must read, in exactly one way, as the text between the edits unchanged with each edit original or replaced. Read that way, the cluster is given back as exactly those replacements, so leftover flags between them stay on their text; otherwise an edit the change reached into is unknown. A quick fix shows the untouched flags again after it applies, since the annotator moves flags change by change. |
| F-02: a held Refactor Preview can write after a language change ends the watched lifetime | An accepted limit, decided 2026-10-25 by the writer: keep Refactor Preview. D3, D7: a review belongs to one lifetime of its document, but VS Code gives no way to end one, so an Apply after the lifetime ends still writes; the run reports it closed and shows nothing (below). A discard to narrow the window was tried and withdrawn (F-06). |
| F-06 (second and third re-reviews): the discard could end a preview this review did not own | D3: Draft Edit sends no command to VS Code's preview. Its Discard ends whichever preview holds the pane, and no public API ties a preview to the request that opened it: neither a pending request nor a preview's copy of the file proves ownership (below). |
| F-05 (re-review): a Clear made while a quick fix's write was out was undone when it landed | D7: a Clear withdraws flags for good. After a quick fix lands, the untouched flags are shown again only while the issues it captured still hold the document's flags. A Clear replaces them, so nothing comes back; a Dismiss deletes from them, so it holds too. |

### F-02 and F-06: a review VS Code holds is left to the writer

The preview commits inside `workspace.applyEdit`, with no hook between the
writer's Apply and the write. A language change fires the document's close
and open events without moving its version
([`extHostDocuments.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/api/common/extHostDocuments.ts)
`$acceptModelLanguageChanged`), and VS Code checks only content conflicts
and the version, so it applies a held review to the document as it now
reads. The writer weighed three review steps: Refactor Preview with this
limit, the extension's own checklist (a strict barrier, without VS Code's
diff), and direct only. They kept Refactor Preview.

- **The accepted limit.** An Apply after the reviewed document closes,
  reopens or changes language still writes the entries the writer ticked,
  as the diff showed them. The run reports the document "closed or changed
  language" and shows nothing. A closed quick fix asks the writer to check
  the file, since its fix may have gone in (the second re-review). The
  adapter answers `closed` when the review then ends with nothing applied,
  and logs the lifetime's end.
- **No discard (F-06).** VS Code's own Discard, `refactorPreview.discard`
  ([`bulkEdit.contribution.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts),
  the same at `main`), would end a held review, but it has no target: it
  ends whichever preview holds the pane, or, with none, opens an empty
  Refactor Preview panel. Two attempts to send it only for our own preview
  were withdrawn:
  - *While our request is pending.* A request made while another preview
    is shown waits, in a modal dialog, for the writer to agree to replace
    it (`_previewEdit`), so the preview shown may be another extension's or
    another chapter's (the second re-review).
  - *Once a copy of our document opens after we asked.* A preview copies
    each file it edits into a model that reaches the extension host
    (`bulkEditPreview.ts` `_init`, `asPreviewUri`), but those copies are
    made asynchronously after the preview has taken the pane, and some never
    sync (`shouldSynchronizeModel`). So another extension's preview of the
    same document, whose copy arrives late, passed for ours (the third
    re-review).

  No public API ties a preview to the request that opened it, so Draft Edit
  sends no command to the preview at all. Cancelling another writer's
  review, even rarely, is not the limit the writer accepted.
- **The port.** `DocumentEditor` says a review belongs to one lifetime of
  its document: a host that can end it without writing does, and answers
  `closed`; one that cannot says so, as the VS Code adapter does. The
  applier's watch reads the lifetime as ended either way, so nothing more
  is shown.
- **A correction to Slice 2's known limit.** An extension can run VS Code's
  Discard, but for the same reason the progress notification's Cancel
  does not: it could end another extension's preview. The writer applies
  or discards in the preview.

## Amendment 2026-10-26: Slice 3, polish

Slice 3 changes three decisions above and leaves the thresholds as they
were:

| Decision | Change |
|---|---|
| D8: the menus | The editor context menu holds one **Prose Minion** submenu (`contributes.submenus`, id `prose-minion.editorContext`) in place of the flat entries; its items keep their own `when` clauses. Every contributed command takes `"category": "Prose Minion"` and a short title. VS Code labels a menu item by its title alone and writes "category: title" in the Command Palette ([`actions.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/platform/actions/common/actions.ts) `MenuItemAction.label`, [`commandsQuickAccess.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts)), so the palette reads as before. VS Code leaves out a submenu with nothing to show ([`menuService.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/platform/actions/common/menuService.ts) `createActionGroups`), so the submenu entry carries no `when`. Open File in Lightbox's Explorer and editor-title entries now read "Open File in Lightbox". |
| D6: the spelling convention | `proseMinion.proofread.spellingConvention`: `auto` (the default), `american`, `british`, `canadian` or `australian`. It is read at the gesture, carried on the pass as `spelling` (absent for `auto`, and for a value outside the list), and sent in each chunk's request as a JSON field beside the passage. With a named convention, a word spelled only to another one is a `spelling` issue whose replacement is the convention's spelling; the guard still judges it, so a longer respelling is flagged, not fixed. With none, a spelling correct in any of the four is never reported, unless the passage mixes conventions, and then only the instance that breaks its own pattern. |
| D7: whose flags a run replaces | A whole-file run replaces the document's flags, as before. A selection run replaces only the flags it reads again: those that overlap the selection as the gesture read it. The rest are kept where they now sit, with their quick fixes, unless the writer dismissed, edited or cleared them during the run. Which flags lie outside is decided at the gesture, against the text the selection's offsets name, so no range is moved through the writer's edits. The summary counts the kept flags, and offers *Show Problems* whenever any flag is shown. |

**Summary and thresholds.** No other summary wording or threshold changed.
The writer's runs of Flag and Fix raised no false positive or threshold
problem, but no fixture run with a rate was recorded, so the
[Thresholds](#thresholds) table stands until one gives a reason to tune it.

## Amendment 2026-10-26: Slice 3b, Proofread coverage

Slice 3b widens what Proofread catches
([slice doc](../../.todo/epics/epic-draft-edit-2026-10-25/slice-3b-proofread-coverage.md)).
It ships in three parts, each a PR into `epic/lightbox`. This amendment
decides all three; each part's PR records what it built.

### Part 1: four categories and the narration baseline

| Decision | Change |
|---|---|
| D6: the categories | The closed list gains four. **`wrong-word`**: a real word in place of the one meant that is not a sound-alike ("form" for "from"); sound-alikes stay `homophone`. **`missing-word`**: the quote spans the words either side of the gap, and the replacement puts the word back. **`extra-word`**: a stray word, often a revision's leftover; a word written twice in a row stays `spelling`, fixable as before. **`person`**: a first-person pronoun in third-person narration, outside dialogue and quoted thought. Every new category is **flag-only**: its suggestion is a *Replace with* that is never preferred, and Fix and *Fix all* never make it. A category becomes fixable only after a recorded fixture run shows its false-positive rate, and then with its own guard rule (for `wrong-word`, the spelling edit size; for `missing-word`, exactly one inserted word from a closed list). Severity follows the disposition, so they show as warnings. |
| D6: the narration baseline | Host code measures the whole document's narration once per run (`measureNarrationBaseline`, `utils/proofread/narrationBaseline.ts`). It leaves out dialogue (`findDialogueSpans`), single-quoted speech whole, interior sentences included (PR #174 F-01), and protected regions. Single-quoted speech closes only at a mark after closing punctuation with no word after it; a possessive ("sisters'") or elision ("sittin'", "—'tis") inside it leaves it open, to its paragraph's end if nothing closes it, since where a mark's role is unclear more is left out (F-01's re-review). The part-of-speech tagger (`tagTextTokens`) counts finite verbs (past `VBD`; present `VBZ`, `VBP`) and personal pronouns. A tense is named when at least 20 finite verbs are counted and one tense holds 75% of them. `first` person is named when first-person singular pronouns are at least 1% of the narration's words; `third` when they are at most 0.2% and third-person pronouns at least 1%. Either needs at least 200 narration words. The thresholds live in `NARRATION_BASELINE`. Measured on *Alice* adaptations: past narration read 87–90% past, present narration 100% present; first-person pronouns were 8% of first-person narration and 0% of third. Tagging 12,500 words took 77 ms, so the tagger reads at most 20,000 words (about 120 ms on the extension host), chosen evenly across the document by word position; a sentence over 500 words is read in pieces (PR #174 F-02). A prologue in another tense cannot speak for the book. A selection run measures the whole document, not the selection, so a short or dialogue-heavy selection still knows the book's narration. The baseline goes beside each chunk as `narration` (`{"tense": "past", "person": "third"}`, each field only when named). The prompt judges `tense` against it, and reports `person` only against a named third person. It is a hint: tense and person stay flag-only. A tagger that fails to load sends no baseline, and the run goes on, logged. |
| D8: the summary | "(N tense or agreement)" becomes "(N need your judgment)". Every flag-only category counts, so the writer sees how many flags Fix never makes. |

### Part 2: the word list and name consistency

Decided now, built in part 2.

- **The word list.** `proseMinion.proofread.wordList`: names and invented
  words the writer accepts, in user or workspace settings, read at the
  gesture.
  - Each chunk's request carries only the listed words that occur in it
    (`acceptedWords`), so the request stays small.
  - A host backstop drops a `spelling` or `wrong-word` finding whose quote
    is a listed word, and counts it.
- **Name consistency** is a host check over the whole document, not a model
  category:
  - Capitalized words that appear at least once mid-sentence are names.
  - Forms with the same first letter within a small edit distance (one edit
    up to six letters, two from seven), a possessive set aside, form a
    group.
  - In a group, a form used at most twice, beside one used at least three
    times as often, is flagged at each use (`name`), with a *Replace with*
    the common form that is never preferred.
  - Month and day names and honorifics are never names, and a listed word
    is never flagged.
  - Its issues join the model's at placement. Where both mark the same
    text, the host's is kept: it read the whole document.

**As built (part 2), where the build goes beyond the above:**

- **The word list** is normalized at the gesture (`proofreadWordList`) and
  carried on the pass beside the convention (`ProofreadSettings`):
  - strings only; an entry of several words counts word by word;
  - each word once, by case;
  - a possessive set aside.

  It is compared with case and apostrophe shape set aside, and a
  hyphenated word holds its parts. `acceptedWords` follows `narration` in
  the request. A dropped finding counts as `accepted`, which the summary
  never calls "not placed".
- **Host categories** are a list of their own (`PROOFREAD_HOST_CATEGORIES`),
  so a model reply naming `name` is malformed, and they are always flagged
  (warnings).
- **What counts as mid-sentence:** the nearest character before the word on
  its line is a letter, digit, comma or semicolon. So a word after an
  opening quotation mark, a colon, a dash or a sentence's end is never the
  evidence. A misspelling only ever written at a sentence's start is not
  found: the stated limit.
- **Never read as names:**
  - headings, whose title case says nothing: ATX or setext, wherever block
    quotes and lists put them, found by the Markdown block reader
    (`readDocumentRegions`, the same reading as the protected regions;
    PR #176 F-02);
  - words in capitals, under three letters, or over twenty (F-01);
  - the forms of "I".
- **Never flagged,** beyond the list (a hyphenated word whose parts are all
  listed is accepted, by the word list's own rule: N-01):
  - a variant the document also writes in lower case (a word, not a
    misspelled name);
  - a plural of the common name;
  - a variant with two equally used candidates.
- **Edits are counted by optimal string alignment,** so swapping two
  neighbouring letters is one edit; the length rule uses the longer form.
- **It runs on the extension host,** so it compares only names that could
  be close: each common name is indexed by what is left with up to two
  letters deleted. Every deletion made (indexing or looking up), index
  entry visited and pair compared is charged before it is done, to a work
  budget of 250,000 (PR #176 F-01). Past it the check stops, finds nothing
  and logs why, rather than show a part. Measured on Node 18: a novel's
  4,500 distinct names in 70,500 words spent 121,845 (139 ms); a stopped
  document spent at most 0.6 s beyond reading it.
- **Precedence:** a model issue overlapping a host issue is dropped before
  model issues are weighed against each other, so a broad model quote the
  host replaced never takes an independent issue with it (N-02).
- **What host code reads of the whole document** lives in
  `draftEditHostRead` (the narration baseline moved there too).

### Part 3: quotation marks and consistency

Decided now, built in part 3.

- **Quotation marks** (`quotation`, host):
  - a double quotation mark that opens and never closes within its
    paragraph, unless the next paragraph opens with one (speech running
    over several paragraphs);
  - a closing mark with nothing open.

  Flag only, with no replacement.
- **Consistency** (`consistency`, host): a closed table of variant pairs
  (grey and gray, toward and towards, OK and okay, e-mail and email, all
  right and alright, and others).
  - Where one document uses both, the less used form is flagged, with a
    *Replace with* the other.
  - With a spelling convention named, the convention's form wins whatever
    the counts.
  - Flag only.

Host checks run inside a Proofread run, over the whole document, and a
selection run shows only those inside its selection. They need no model,
but a run still needs a key; running them without one is a follow-up.

## Amendment 2026-10-26: Slice 3c, Craft Flags

The writer's decisions (2026-10-26):

- **A second pass, *Craft Flags*,** beside Proofread on this engine, with
  its own command in the **Prose Minion** editor menu. Its categories are
  cliché, gesture strain, continuity and register shift, each as the
  [slice doc](../../.todo/epics/epic-draft-edit-2026-10-25/slice-3c-craft-flags.md)
  describes it. They are flags with a recommendation, and never change the
  text.
- **The slice doc's six recommendations:**
  - one whole-chapter call per category, in parallel, under a word ceiling;
  - the recommendation as a note in the flag's message ("One way it could
    go: …"), with no quick fix;
  - phrased as options, never orders;
  - `info` severity under a diagnostic source of its own;
  - a model scope of its own that follows the Workshop's model until picked;
  - a cost estimate in the confirmation before a run.
- **Cliché first.** It is closest to what exists (the Lightbox's familiar
  phrasing), and it proves the pass end to end.

Slice 3c ships in parts, each a PR into `epic/lightbox`. This amendment
decides the pass and cliché (part 1). Register shift, gesture strain and
continuity each get their own rows here when they are built, in that order.

### Part 1: the pass and cliché

| Decision | Change |
|---|---|
| D1: a second pass | `DraftEditPass` is `ProofreadPass \| CraftFlagsPass`. `CraftFlagsPass` is `{ kind: 'craft'; categories }`, the categories drawn from `CRAFT_FLAG_CATEGORIES` (`['cliche']` in part 1). Its policy row names the `craft` model scope. Its fix fields take the strictest values, though nothing reads them: the pass never writes. `DraftEditUseCase` runs Proofread only (`ProofreadPass`). |
| D1: its own run | **`CraftFlagsUseCase`,** beside `DraftEditUseCase`, not a branch inside it. It sends one whole-chapter call per category, and only flags. It takes no applier, so it cannot write. It shares with Proofread: the protected-region masking; anchoring by quote (`anchorQuote`); the watch from the gesture's version, moving each flag through the writer's edits (a flag an edit touched is stale); the live text's protected regions; and a selection run replacing only the flags that overlap its selection (Slice 3). One Craft Flags run per document at a time. It is independent of Proofread's: each shows its own flags. |
| D3, D7: flags of its own | **A second `IssueAnnotator`, `Platform.craftAnnotations`.** In VS Code it is a second `VsCodeIssueAnnotator`: diagnostic collection `prose-minion.craftFlags`, source `Prose Minion Craft`, code `craft.<category>`, severity `info`. It offers *Dismiss this Craft flag* and *Clear all Craft flags in this file*, never *Replace with* or *Fix all*. A Craft Flags run never replaces Proofread's flags, nor Proofread's run its flags, and the Problems panel filters the two apart by source. |
| D8: the commands | **Craft Flags** (`prose-minion.craftFlags`) and **Clear Craft Flags** (`prose-minion.clearCraftFlags`), category "Prose Minion", in the **Prose Minion** editor submenu with Proofread's `when` clause. The Dismiss command is internal, never contributed. The rules live behind a host port in `application/commands/craftFlagsCommands.ts`. |
| D10: the guards | The runs (`DraftEditUseCase`, `CraftFlagsUseCase`) and the applier may reach `DocumentEditor` and `IssueAnnotator`; only the applier asks for `applyEdits`, as before. New: no Craft Flags module names `DraftEditApplier` or `applyEdits`. A Craft Flags issue has no replacement field, so no annotation it makes carries a fix, and a reply's `replacement` is a field the format does not define: ignored and counted. |
| The model scope | **`craft`,** set by `proseMinion.craftModel`. It is empty by default, and follows `assistantModel` (the Workshop's) until the writer picks one, as `lightboxModel` does (Lightbox Slice 4L). It has its own engine in `AIResourceManager`, its own policy (`craftFlags`: capability-free, nothing kept), a Settings overlay row, and "Same as Workshop" in its picker. Calls run at temperature 0.2: low enough that a chapter flags alike from run to run, above 0 because each flag carries a note in prose. |
| Reading the chapter | **One call per category over the whole document,** protected regions masked, sent as `{ "task": "craft-flags", "category": "cliche", "passage": … }`, a JSON string value, never instructions. The calls run in parallel. **The word ceiling** is `PROMPT_BUDGETS.craftFlags.chapterWords` (25,000): a long chapter at the Workshop's model and a reply fit any model the scope offers. Over it, a selection run reads its selection alone and says so; a whole-file run is refused, asking for a selection. Under it, a selection run reads the whole chapter for context and shows only the flags inside its selection. The output ceiling is 8,000 tokens; a reply that reaches it is rejected and saved for recovery, as Proofread's chunks are. `salvageModelJson` keeps whole root members, and the flags are one array, so it would keep nothing. |
| The reply | Framed by `===CRAFT_FLAGS_V1===` and `===END_CRAFT_FLAGS_V1===`, read by the frame reader Proofread now shares (`DraftEditResponseFrame`). Its root is `{ "version": 1, "flags": [{ "original", "before"?, "after"?, "kind", "why", "suggestion"? }] }`. As Proofread's: forgiving per reply, fail-closed per flag. A flag missing a field, with a kind outside its category's, or quoting more than 160 characters is dropped and counted. |
| What a flag says | Its message: the `why` (what the phrase stands in for here), then "One way it could go: " and the `suggestion` (one way this scene could say it), then the host's repeat line. There is no quick fix: Dismiss and Clear. |
| The phrasing fence | **`craftFlagPhrasing`** (`utils/craftFlags/`). A `why` and a `suggestion` hold none of these: a listed order or correction word (should, must, need to, have to, fix, cut, delete, remove, replace, rewrite, wrong, bad, in their forms); a double quotation mark (the flag already sits on the words); or a digit (counts are the host's). And no clause opens with a listed imperative (try, use, consider, swap, …). A `why` that breaks it is replaced by the host's line for its kind; a `suggestion` that breaks it is withheld. Either way the flag stays, and the summary counts the notes withheld. The limits, stated plainly: these are English word lists, not a parse, so a listed word used to describe is withheld too (the safe failure), and an order phrased without one passes. The Lightbox's steering fence is not imported. Draft Edit takes no Lightbox infrastructure (the slice doc's rule for sections), and that fence forbids offering words, which a suggestion here exists to do. |
| Cliché: what it flags | A phrase worn smooth by use, standing in for something this scene could name exactly. Its `kind` is `cliche` or `weighted` (a familiar beat asked to hold a peak, a turn or a coda). `idiom` and `stock` are familiar, not faults, and never flagged. |
| Cliché: one vocabulary | **`FAMILIAR_PHRASE_KINDS`** (`shared/constants/familiarPhrasing.ts`) holds the four kinds and their definitions. `LightboxFamiliarKind` is that type. The cliché prompt states each definition verbatim, and a sync test holds it there, and holds the Lightbox's prompt to the same four kinds. |
| Cliché: dialogue | **Left alone.** A character's idiom is their voice (the Lightbox's rule, epic decision 26). Host code drops a flag that touches speech, counted as `dialogue`: the shared dialogue rule (`findDialogueSpans`, double quotation marks) and single-quoted speech, whole, by the narration baseline's rule (Slice 3b part 1, PR #174 F-01). That rule moves to `utils/draftEdit/speechSpans.ts`, shared by both. The prompt asks the same. |
| Cliché: repeats | **Host code counts each flagged phrase over the whole document's narration** (speech and protected regions left out), case, curly apostrophes, dashes and runs of space folded, at word boundaries. Two or more add "This phrase appears N times in this document." to every flag on it. Inflected forms ("ran down her spine", "runs down his spine") count apart: the stated limit, which gesture strain's lemma counts may lift. |
| Cost before a run | **Every run confirms first,** naming the words read, the calls, the model, and the price: "≈ $0.06", or "< $0.01". The price is an estimate, never a cap. It is the engine's token estimator over the exact messages times the live catalog's prompt price, plus a typical reply (`PROMPT_BUDGETS.craftFlags.typicalOutputTokens`) times its completion price. With no live pricing, the confirmation says the price is unknown. The catalog is fetched once if nothing has fetched it (a free request, never billable), through a port tests replace. |
| The summary | One notification, worded in core (`describeCraftFlagsOutcome`): "Craft Flags chapter-03.md: 4 flags · 1 left alone in dialogue · $0.0610". It offers *Show Problems* when flags were shown and *Open Settings* when there is no key. |

**On by default.** Cliché runs whenever the writer runs Craft Flags: the
command is the opt-in. When a second category joins,
`proseMinion.craftFlags.categories` chooses which run, and the fixture run
(the slice doc's) decides each one's default.

**As built (part 1), where the build goes beyond the above:**

- **The calls start together.** A call the provider refuses is not sent,
  and the summary says why, but the other calls are already out and stand
  as they are answered. "Stops starting calls" means nothing with the calls
  in parallel.
- **A run with no key says so before the confirmation.** The estimate names
  no model without an engine, so the plan is `unconfigured`, and nothing is
  priced that would not be sent.
- **A selection with no words in it is empty,** whatever the document
  holds.
- **Overlaps are judged within a category.** Two categories may flag the
  same words; part 1 has one.
- **The fence's lists** are `CRAFT_FLAG_FORBIDDEN_FORMS`, the two-word orders
  in `CRAFT_FLAG_FORBIDDEN_PHRASES`, and `CRAFT_FLAG_IMPERATIVE_OPENERS`.
  Softening words ("perhaps", "instead") are set aside before a clause's
  opening verb is read. "Say" is not an opener: "say, her shoulders lock" is
  a hedge, not an order.
- **The host's why** for a withheld one is the shared definition of the
  flag's kind (`FAMILIAR_PHRASE_DEFINITIONS`).
- **Speech spans are joined** (`findSpeechSpans`): a single-quoted line
  inside double-quoted speech is one span, so one binary search answers
  whether a flag touches speech.
- **Its recovery contract** is `craft-flags-v1` in
  `RECOVERABLE_RESPONSE_CONTRACTS`.

**PR #177 review (Astra), as built:**

- **F-01: the run goes to the model its confirmation named.** The estimate
  reads the craft engine's model once, before anything is awaited, and
  prices that model. The approval carries it to the run, and every call
  names it (`AgentRunOptions.model`, through to
  `OpenRouterCompletionOptions.model`). The context preflight measures
  against it too. A model that changes while the price is read, while the
  confirmation is open or while the prompts load, by the writer's own
  setting or by the Workshop model it follows, never receives the chapter.
  The next run uses the new model.
- **F-02: a gesture is held from its first read.** `begin` takes it
  synchronously, with the document watch, at the writer's gesture. `plan`
  and `run` ask the watch whether its lifetime ended (`DocumentWatch.ended()`,
  a new port method that does not end the watch) once the price is in, and
  before sending. The service asks again (`stillCurrent`) once the prompts
  are ready, in the same turn the calls start. A close, a reopen or a
  language change shows no confirmation, or sends nothing (`changed`). The
  gesture is released however the command ends. An ordinary edit while the
  price is read is followed, as an edit while the model reads is.
- **F-03: speech is read with protected syntax set aside**
  (`findSpeechSpansOutsideProtected`), as if the protected region were not
  there. A quotation mark inside one neither opens nor closes speech: the
  shared rules read a view in which each of its characters but white space
  is a letter, so offsets, and the paragraphs the blank-line rule finds, stay
  the text's own. A single quotation mark beside one is judged by the prose
  on its far side, never by the view's letters or the markup's characters,
  so `<em>‘Late,’</em> said Alice` reads as `‘Late,’ said Alice` does (the
  re-review: letters alone hid an opener right after a tag, comment or code
  span). It is read in the gesture's text before overlaps are weighed, and
  again in the settled live text (`outsideSpeech`), so words put in
  quotation marks during the run are left alone and counted as `dialogue`.
  The shared dialogue rule and the narration baseline are unchanged.
- **N-01: repeats are counted in the live text,** after the run settles.
- **N-02: repeats are counted only when there is a flag,** one regular
  expression scan of the text per distinct phrase, at most
  `PHRASE_REPEATS.phrases` (40) per document; a phrase past that shows no
  count. Measured on Node 18: a 250,000-word manuscript with a 36-character
  selection reached the model stub in about 0.1 s (2.86 s before), and 40
  phrases over 1.2 million characters were counted in 87 ms.
- **N-03 (re-review): occurrences that overlap count,** as they did before
  the scan changed: "never say never" stands twice in "never say never say
  never".

## Out of scope (follow-ups)

- Apply Recommendations and Apply Variation (D11; Feature: Workshop Apply to
  Draft).
- CriticMarkup export and accept/reject, if portable in-file marks prove
  useful.
- A deterministic narrative-tense baseline: built in Slice 3b, part 1
  ([Amendment 2026-10-26: Slice 3b](#amendment-2026-10-26-slice-3b-proofread-coverage)).
- A project word list (character and place names) to suppress false
  spelling flags: built in Slice 3b, part 2
  (`proseMinion.proofread.wordList`).
- Craft flags (cliché, gesture strain, in-chapter continuity, register
  shift), flags with a recommendation that never edit: Slice 3c, a second
  pass, *Craft Flags*
  ([Amendment 2026-10-26: Slice 3c](#amendment-2026-10-26-slice-3c-craft-flags)).
  Cliché is part 1; the other three follow.
- Continuity across chapters (a story bible).
- Draft edits on `manual` Workshop excerpts (no document to write).
- Proofreading several files or a folder in one run.
- Persisting flags across reloads (decided against).
