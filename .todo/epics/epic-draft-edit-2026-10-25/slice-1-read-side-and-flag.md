# Slice 1: Read Side + Proofread and Flag

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D1, D2, D3 (`IssueAnnotator`, `DocumentEditor.watch`; planned as `snapshot`, changed after PR #171 F-03/F-04), D6, D7, D8 (Flag, Clear), D10
**Status:** Built 2026-10-25 (`5e07d91d`, `c97fcbfd`, `e50c2b36`, `fd5f3133`, `f1a6e79f`). In review. The writer's manual Flag run on seeded public-domain fixtures is pending.

## Outcome

Right-clicking an open Markdown or plain-text file offers **Prose Minion:
Proofread and Flag**. It proofreads the selection, or the whole file, and
shows each issue as a diagnostic: squiggle, Problems panel, F8. It never
touches the text.

- **Clear Proofread Flags** removes the flags. A per-flag **Dismiss** code
  action removes one.
- A whole-file run over 15,000 words asks first.
- A summary notification reports the counts and the cost.

Nothing in this slice writes to a document.

## Build order (one commit series per step)

### 1a. The `proofread` model scope

- `shared/types/messages/configuration.ts`: add `'proofread'` to
  `ModelScope` (an own scope, not a `FollowingModelScope`).
- `orchestration/ModelScopeSelections.ts`:
  - `MODEL_SCOPE_SETTING_KEYS.proofread = 'proofreadModel'`;
  - `DEFAULT_PROOFREAD_MODEL = 'anthropic/claude-haiku-5.5'`;
  - the own-scope resolution.
- `orchestration/AIResourceManager.ts`: build the `proofread` bundle, and
  include it in the resources and resolved-models maps.
- `MessageHandler.MODEL_KEYS` gains `proseMinion.proofreadModel`.
- `useModelsSettings` and the `SettingsOverlay` row ("Proofread Model").
- `apps/vscode-extension/package.json`: the `proseMinion.proofreadModel`
  contribution, defaulting to `anthropic/claude-haiku-5.5`.
- Tests: `ModelScopeSelections.test.ts`, the `MessageHandler` hot-swap
  `it.each`, `useModelsSettings`, and `SettingsOverlay`.

### 1b. Domain types and the deterministic core

- `domain/models/DraftEdit.ts`:
  - `DraftEditPass` (Slice 1: `{ kind: 'proofread'; output: 'flag'; hints? }`);
  - `DraftEditAnchor`, `ProposedEdit`, `DraftEditTarget`;
  - the pass-policy type.
- `domain/models/ProofreadIssue.ts`: categories, dispositions, the
  `FIXABLE` / `FLAG_ONLY` table, and `ProofreadIssue`.
- `utils/draftEdit/protectedRegions.ts`: Markdown protected regions (front
  matter, fenced code via `markdownFences`, inline code, link/image targets,
  autolinks, reference definitions, HTML comments and tags), and a masked
  view with an offset map back to the source. Plain text has none.
- `utils/draftEdit/chunkParagraphs.ts`: paragraph-boundary chunks under a
  word budget, each with its source offset.
- `utils/draftEdit/anchorEdits.ts`: D2. Exact match, then a normalized
  fallback (quotes, NBSP, whitespace runs) mapped back to exact spans;
  ambiguity fails closed.
- `utils/draftEdit/shiftAnnotations.ts`: shift or drop offset ranges for a
  set of content changes (the annotator's arithmetic, testable without
  `vscode`).
- `utils/proofread/proofreadGuard.ts`: category disposition, the
  edit-distance and alphanumeric-equality checks, and the no-newline rule.
- Tests: pure, on public-domain fixtures (*Alice's Adventures in
  Wonderland*) with seeded errors.

### 1c. The Proofread pass (model-backed)

- `resources/system-prompts/proofread/00-proofread.md` (contract and rules)
  and `01-proofread-example.md` (one worked public-domain example).
- `shared/constants/promptBudgets.ts`: `proofread` = `{ chunkWords: 1200,
  concurrency: 3, outputTokens: 4000, confirmWholeFileWords: 15000,
  maxQuoteCharacters, maxExplanationCharacters }`.
- `orchestration/AgentRunPolicies.ts`: `AGENT_RUN_POLICIES.proofread`
  (capability-free, discard) and a `ProofreadService chunks` row in the
  route matrix.
- `shared/types/messages/recovery.ts`: a `proofread` entry
  (`proofread-v1`).
- `services/proofread/ProofreadResponseFrame.ts`: sentinel frame reader.
  Accepts a whole-frame code fence, and a missing closing sentinel when the
  JSON is complete. Reads through `parseModelJson`.
- `services/proofread/ProofreadResponseCodec.ts`: forgiving per chunk,
  fail-closed per issue. Unknown fields are ignored and counted, never
  named. Issues with a missing field or unknown category are dropped and
  counted. Clipped at the quote and explanation ceilings.
- `services/proofread/ProofreadService.ts`:
  - `getEngine('proofread')`; `temperature: 0`; non-streaming.
  - Chunks fan out through `p-limit`. Writer text travels as JSON string
    values.
  - A rejected chunk goes to `persistRejectedModelResponse`, with the
    presenter at most once per run.
  - A key change stops the run (ADR D6).
  - Usage is summed.
- Tests:
  - frame and codec units;
  - the service on mocked transport (no provider is reached);
  - a key-retirement test modeled on `LightboxKeyRetirement.test.ts`.

### 1d. Ports, the use case, and the adapter

- `platform/DocumentEditor.ts`: `snapshot(uri)` only (the live buffer).
- `platform/IssueAnnotator.ts`: `show(uri, version, annotations)`,
  `remove(uri, ids)`, `clear(uri?)`.
- Both join `Platform` (`documents`, `annotations`) and the platform barrel.
- `application/services/draftEdit/DraftEditUseCase.ts`:
  - `plan(target)`: words, chunks, whole-file, and whether it needs
    confirmation;
  - `run(target, pass, signal)`: mask → chunk → pass → anchor → guard →
    overlaps → re-snapshot and re-anchor → `annotations.show`;
  - `dismiss(uri, id)` and `clear(uri?)`.
  - It refuses a second run for a URI already in flight, and keeps the last
    run's issues per URI in memory only.
  - Joins `CoreServices`.
- `application/services/draftEdit/draftEditSummary.ts`: the pure summary
  wording.
- `apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts`
  (snapshot) and `VsCodeIssueAnnotator.ts` (diagnostics, the Dismiss code
  action, shifting on change, clearing on close).
- `extension.ts`:
  - commands `prose-minion.proofreadFlag`,
    `prose-minion.clearProofreadFlags`, and the internal
    `prose-minion.dismissProofreadIssue`;
  - gesture-time target capture;
  - the long-file modal;
  - cancellable `withProgress`;
  - *Open Settings* when there is no key;
  - the summary notification.
- `package.json`: the commands, `editor/context` and `commandPalette` menus
  (`editorLangId == markdown || editorLangId == plaintext`), and `onCommand`
  activation.
- Tests: the use case (mocked service and ports), the summary, and the
  adapter's mapping logic where it can be tested without the extension host.

### 1e. Guards, docs, and housekeeping

- `boundaries.test.ts`:
  - in core, only `DraftEditUseCase` references `DocumentEditor` and
    `IssueAnnotator` (plus the platform barrel and `Platform.ts`);
  - `ONE_SHOT_FORBIDDEN_IMPORT_REFERENCE` gains both port names.
- Pass-policy exhaustiveness: a `Record` over `DraftEditPass['kind']`, with
  `never` defaults.
- `shared/constants/workshopTools.ts`: correct the `editor` description, so
  it reads as copyediting rather than "holistic developmental editor".
- Docs:
  - `docs/CONFIGURATION.md` (`proofreadModel`);
  - `docs/TOOLS.md` (Proofread);
  - the `.ai/central-agent-setup.md` test inventory;
  - `docs/ARCHITECTURE.md` (the Draft Edit engine and the two ports).
- A memory-bank entry when the slice closes.

## Acceptance

- Flag appears in the editor context menu and the Command Palette only for
  `markdown` and `plaintext`, with or without a selection.
- Flag never modifies the document. Each issue becomes one diagnostic:
  `source: 'Prose Minion'`, `code: 'proofread.<category>'`, Information
  for fixable categories and Warning for tense/agreement. The message
  carries the explanation and any suggested replacement.
- Nothing is flagged inside protected regions. Ambiguous or unplaceable
  quotes are counted, never guessed.
- Flags typed over are dropped; flags after an edit move with the text.
  Dismiss removes one flag; Clear removes them all; closing the file clears
  its flags.
- A whole-file run over 15,000 words asks first, and Cancel sends nothing.
  Selections never ask.
- No key: *Open Settings* is offered, and nothing is sent. Cancel: no flags
  change. A malformed or cut-off chunk is counted and captured for
  recovery. A key change mid-run stops it, keeps finished chunks, and says
  so.
- `proseMinion.proofreadModel` round-trips between the Settings Overlay and
  VS Code settings.
- CI's four steps pass under Node 18. Core still imports no `vscode`.

## As built (2026-10-25)

Where the build departed from the plan above, and why:

- **No `commandPalette` rule.** A manifest test enforces that the project
  hides no command from the Command Palette. Proofread and Flag therefore
  refuses other languages with a message ("Proofread reads Markdown and
  plain-text files."). The editor menu still offers it only for Markdown and
  plain text. ADR D8 is amended.
- **`DraftEditUseCase` is not in `CoreServices` yet.** No webview handler
  uses it in Slice 1, so it is built at the composition root and passed to the
  commands. It joins `CoreServices` with the Workshop route in Slice 4. ADR D8
  is amended.
- **Command rules behind a host port.** As with the Lightbox's Open File
  command, `application/commands/proofreadCommands.ts` holds the rules and
  imports only from core. The composition root passes VS Code in as a host,
  so the tests use a fake.
- **Show Problems** is offered on the summary when flags were shown. This was
  planned for Slice 3, but it was one line.
- **Anchoring joins context with or without a space.** Writing the worked
  example showed that a model leaves out the space between its context words
  and the quote, so each junction is tried both ways.
- **Doubled words** ("the the" → "the") count as a mechanical spelling fix,
  even though their edit distance exceeds the bound.
- **Prose-free paragraphs** (a lone protected block) are skipped by the
  chunker, so a chunk never starts or ends on a placeholder.
- **A shared `sumTokenUsage`** (`utils/tokenUsage.ts`) treats an unreported
  cost as unknown. Adopting it in the Lightbox and the Dictionary is tracked
  in `.todo/tech-debt/2026-10-25-shared-token-usage-sum.md`.

## Review fixes (PR #171, Astra, 2026-10-25)

Astra's review found six blocking defects. Each fix is in the ADR's
"Amendment 2026-10-25" and has regression tests:

- **F-01. Model and key changes with no webview open.** `AIResourceRefresh`
  (`orchestration/AIResourceRefresh.ts`), built in `extension.ts`, owns the
  shared manager's key and model subscriptions. Every surface that hears a
  key change asks it to refresh: the owner itself, each webview's
  `MessageHandler`, and the Settings overlay's Save and Clear
  (`ConfigurationHandler`, which still awaits the rebuild before it answers,
  as the Lightbox's key retirement depends on). It rebuilds once per key, so
  no second rebuild retires a run that began after the change.
- **F-02. Complete protected constructs.** `markdownBlockRegions.ts` reads
  block structure with `marked`'s block lexer: fences, definitions and raw
  script or style blocks inside block quotes and list items, each checked
  line by line against the source, failing closed.
  `markdownInlineRegions.ts` reads inline constructs in one
  CommonMark-precedence pass.
- **F-03 and F-04. One document lifetime.** `DocumentEditor.snapshot`
  became `watch(uri, version)`. A run follows each finding through the
  recorded edits and finds protected regions again on the live text. A
  closed document (or a reopened one, or a language change) shows nothing
  (`closed`); one that moved before the run started sends nothing
  (`changed`).
- **F-05.** `sumTokenUsage` keeps a call with no usage record in the
  completeness check and in `requestCount`.
- **F-06.** A rejected chunk carries whether its recovery capture was
  saved. The summary says "saved for recovery" only for those, and points
  to the output channel otherwise.

Astra's re-review closed F-03 to F-06 and kept two open, both now fixed:

- **F-01, ordering.** A late, obsolete key read could become the newest
  rebuild. Requests are now numbered before anything is awaited, only the
  newest reading counts, and the manager builds with exactly the key the
  owner compared (`adoptedKeyFingerprint`). A read pending at disposal
  builds nothing.
- **F-02, inline scopes.** The inline pass now reads the parser's own leaf
  blocks and table cells, container prefixes stripped, one at a time. The
  review's nonblocking notes are fixed too: empty destinations before a
  title, a bound on destination parentheses, mixed quote and list nesting in
  the depth guard, and a long list counted in linear work.

## Verification

- CI's four steps under Node 18.20.8: typecheck, lint, build, and the full
  suite (531 suites / 7,378 tests / 59 snapshots, with `epic/lightbox` at
  `31edcfd` merged in). The full suite also passes under Node 22.
- After the PR #171 review fixes (`ad33ecbd`), the same four steps under Node
  18.20.8: 537 suites / 7,452 tests / 59 snapshots; lint 0 errors / 1,133
  warnings (the baseline). The full suite also passes under Node 22.
- After the re-review fixes (`3441e185`), the same four steps under Node
  18.20.8: 537 suites / 7,475 tests / 59 snapshots; lint at the baseline.
  The full suite also passes under Node 22.
- No live provider calls. The key-retirement test runs real
  `OpenRouterClient`s with only the transport stubbed. Fixtures are
  public-domain *Alice*.
- Pending a human with VS Code:
  - Flag a seeded fixture chapter in the Extension Development Host.
  - Type over a flag, and type before one.
  - Dismiss a flag, and Clear all flags.
  - Run a long file and confirm the modal appears.
  - Cancel a run mid-way.
  - Remove the API key during a long run.
