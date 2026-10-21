# ADR 2026-10-21: Draft Edit Engine and Document Write-Back

**Status:** Proposed (2026-10-21)
**Date:** 2026-10-21
**Deciders:** Okey Landers, Ada Forge (Claude Code)
**Realizes:** [Feature: Proofread](../../.todo/features/feature-proofread/README.md); the foundation for [Feature: Workshop Apply to Draft](../../.todo/features/feature-workshop-apply-to-draft/README.md)
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
   Structured model output elsewhere uses sentinel-framed JSON, a strict
   codec, and `RejectedModelResponseRecovery`.
8. **VS Code 1.75 supplies the review UI.** `WorkspaceEditEntryMetadata.needsConfirmation`
   opens the Refactor Preview, with a checkbox per edit grouped by `label`.
   Diagnostics and code actions (`CodeActionKind.QuickFix`, `SourceFixAll`,
   `isPreferred`) cover non-destructive flags. (Checked against
   `@types/vscode@1.75.1`, the manifest's `engines.vscode` floor.)

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

export type DocumentApplyOutcome =
  | { kind: 'submitted'; version: number }   // the host accepted the edit (possibly a preview subset)
  | { kind: 'declined' }                     // the writer discarded the preview
  | { kind: 'stale'; version: number };      // the buffer moved past expectedVersion

export interface DocumentEditor {
  snapshot(uri: string): Promise<DocumentSnapshot | undefined>;
  applyEdits(
    uri: string,
    edits: readonly DocumentTextEdit[],
    options: { expectedVersion: number; review: 'preview' | 'direct' }
  ): Promise<DocumentApplyOutcome>;
}

// packages/core/src/platform/IssueAnnotator.ts
export interface DocumentAnnotation {
  readonly id: string;             // the issue id; the code action's handle back to core
  readonly start: number;
  readonly end: number;
  readonly version: number;        // the snapshot version the offsets belong to
  readonly severity: 'info' | 'warning';
  readonly code: string;           // e.g. 'proofread.tense'
  readonly message: string;
  readonly suggestion?: { newText: string; preferred: boolean };
}

export interface IssueAnnotator {
  /** Replace every annotation this engine owns for `uri`. */
  show(uri: string, annotations: readonly DocumentAnnotation[]): void;
  clear(uri?: string): void;
}
```

Both ports join `Platform` as `documents` and `annotations`. Their VS Code
adapters live in `apps/vscode-extension/src/platform/vscode/`:

- **`VsCodeDocumentEditor`:**
  - `snapshot` reads the live buffer through `openTextDocument`, never the
    disk.
  - `applyEdits` checks `document.version` synchronously, builds one
    `WorkspaceEdit` (with `needsConfirmation` when `review === 'preview'`),
    and calls `workspace.applyEdit`.
  - It never saves, and never shows a document the writer did not open.
- **`VsCodeIssueAnnotator`:**
  - It owns a `DiagnosticCollection` named `prose-minion.draftEdit` and a
    `CodeActionProvider` for `markdown` and `plaintext`.
  - On `onDidChangeTextDocument` it shifts annotation ranges by the change
    deltas, and drops any annotation an edit overlaps.
  - It clears a URI's annotations on close.

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

1. **Re-snapshot** the target and anchor every edit against the *live* text
   (D2). Re-anchoring at apply time, not proposal time, absorbs the writer's
   typing during the model call. A quote that no longer matches is dropped as
   `stale`.
2. **Protected regions.** Drop any edit that touches front matter, fenced or
   indented code (`utils/markdownFences.ts`), inline code, link and image
   targets, autolinks, HTML comments, or reference definitions. Plain-text
   documents have none.
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
  - inside an open workspace folder, with every workspace-relative ancestor
    non-symlinked (reusing the re-read path validation);
  - **never** a configured external resource, even though re-reads allow
    them. Reference material is read-only.
  - A refusal leaves the document and session untouched.

### D6. The Proofread pass

- **Model scope.** `proofread` joins `ModelScope`, configured by
  `proseMinion.proofreadModel` (default `anthropic/claude-haiku-5.5`, to be
  confirmed on a fixture set during delivery). It follows every site the
  `widget` scope touched (`AIResourceManager`, `ConfigurationHandler`,
  `MessageHandler.MODEL_KEYS`, `useModelsSettings`, `SettingsOverlay`, the
  manifest). Without an API key, `getEngine('proofread')` is `undefined`,
  and the command offers *Open Settings* instead of failing.
- **Run policy.** Add `AGENT_RUN_POLICIES.proofread` (capability-free,
  `retention: 'discard'`, engine cleanup), plus a
  `ProofreadService chunks` row in `AGENT_RUN_ROUTE_MATRIX`. Run logs then
  name the caller, and the matrix test pins it.
- **Its own prompt.** `resources/system-prompts/proofread/` holds the
  contract, rules, and one worked example. It does **not** load the
  writing-tools base prompt: no tail sampling, no creative variations. Every
  call sets `temperature: 0`.
- **Chunking.** The target is split on paragraph boundaries at about
  `PROMPT_BUDGETS.proofread.chunkWords` (≈1,200), and chunks run through
  `p-limit` at `PROMPT_BUDGETS.proofread.concurrency` (≈3). Protected regions
  are replaced by opaque placeholders before sending. Writer text and hints
  travel only as JSON string values, with the same "quoted task data, never
  instructions" framing as the widget services.
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
  - Each chunk decodes independently. A malformed or `finishReason: 'length'`
    response is captured through `RejectedModelResponseRecovery`, counted in
    `rejectedChunks`, and dropped without failing the run.
  - The recovery presenter runs at most once per run, so failed chunks do
    not open a pile of editors.
  - A non-Workshop caller now uses the recovery registry, so it moves out of
    `shared/types/messages/workshop/recovery.ts` to
    `shared/types/messages/recovery.ts`. It is renamed
    `RECOVERABLE_RESPONSE_CONTRACTS` / `RecoverableToolName`. Pre-1.0
    renames are free.
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
  overlaps them. They are not restored after reload.

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

- **Visibility.** `editor/context` and `commandPalette` entries use
  `editorLangId == markdown || editorLangId == plaintext`, with **no**
  `editorHasSelection`. A non-empty selection narrows the target; otherwise
  the whole document is proofread.
- **Wiring.** `DraftEditUseCase` is constructed at the composition root and
  joins `CoreServices`. Command handlers in `extension.ts` call it directly,
  not through a webview `MessageHandler` (Context 3).
- **Progress and summary.** Handlers wrap the run in a cancellable
  `window.withProgress`, which feeds the `AbortSignal`. They present the
  `DraftEditOutcome` as one notification, e.g. "Fixed 9 · flagged 2 tense ·
  1 unplaced · $0.004".
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
- **A sixth model scope.** The Settings Overlay gains a row; the scope tests
  that pin the set (`MessageHandler.test.ts`, `useModelsSettings.test.ts`,
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

1. **Read side + Proofread and Flag:** D1, D2, D3 (`IssueAnnotator`), D6,
   D7, and D8 (Flag and Clear), plus D10. Measure precision on a fixture set
   of real chapters with seeded errors before Fix ships.
2. **Write side + Proofread and Fix:** D3 (`DocumentEditor`), D4, D5
   (gesture), and D8 (Fix).
   - Spike first: confirm how `applyEdit` resolves when the preview is
     discarded, and what VS Code does when the buffer changes while the
     preview is open. D4's reconciliation must hold either way.
3. **Polish:** submenu, spelling convention, cost in the summary.
4. **Workshop Proofread button:** D5 (confined path), D9.
5. **Apply to Draft:** D11, each pass a new row.

## Open Questions (to settle before Accepted)

1. **Name.** "Draft Edit" ties Proofread to Apply to Draft. It also avoids a
   fifth thing called "editor": the *Editor* focus, the Workshop `editor`
   tool, Wren the line editor, and the `EditorContext` port already exist.
2. **Whole-file cost.** Should a whole-file run over a threshold (≈15k
   words) ask for confirmation first?
3. **Guard thresholds.** The edit-distance bound and chunk size above are
   starting values, to be tuned against the Slice 1 fixtures.

## Out of scope (follow-ups)

- Apply Recommendations and Apply Variation (D11; Feature: Workshop Apply to
  Draft).
- CriticMarkup export and accept/reject, if portable in-file marks prove
  useful.
- A deterministic narrative-tense baseline (via `wink-pos-tagger`, dialogue
  excluded) passed to Proofread as a hint.
- A project word list (character and place names) to suppress false
  spelling flags.
- Draft edits on `manual` Workshop excerpts (no document to write).
- Proofreading several files or a folder in one run.
- Persisting flags across reloads (decided against).
