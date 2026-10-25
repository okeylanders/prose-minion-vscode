# Slice 1: Read Side + Proofread and Flag

**Epic:** [Draft Edit](README.md)
**Decision:** [ADR 2026-10-21](../../../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md): D1, D2, D3 (`IssueAnnotator`, `DocumentEditor.snapshot`), D6, D7, D8 (Flag, Clear), D10
**Status:** In progress

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
