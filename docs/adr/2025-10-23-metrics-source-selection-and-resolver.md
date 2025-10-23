# ADR: Metrics Source Selection + Centralized Text Resolver

- Status: Accepted
- Date: 2025-10-23

## Context

The existing Metrics tab analyzed whatever text was pasted/typed into a textbox. For real writing workflows, this was insufficient: authors want to measure prose directly from project sources, including the current file, the full manuscript set, and draft chapters. We also want a reusable, centralized mechanism to resolve text inputs for future non-AI tools (e.g., search term frequency/clustering).

Goals:
- Provide explicit, user-controlled source selection for metrics.
- Avoid duplication by centralizing file/glob resolution.
- Preserve backward compatibility with existing message contracts.
- Ensure UI remains theme-aware and consistent with existing components.

## Decision

We added a source selector to the Metrics UI and a shared resolver in the infrastructure layer. The selector offers four modes:
- Active File: analyze the current file by path.
- Manuscripts: analyze files matched by `proseMinion.contextPaths.manuscript` or user-edited globs.
- Chapters: analyze files matched by `proseMinion.contextPaths.chapters` or user-edited globs.
- Selection: analyze the currently selected text in the editor (text box shows `[selected text]`).

Central to this is a new `TextSourceResolver` that resolves a `TextSourceSpec` into text + metadata. All metric tools now call the resolver, then pass resolved text into existing metrics implementations. This keeps measurement tools unchanged and prevents duplication.

UI changes replace the freeform textarea with a mode selector (styled like the app’s TabBar) and a single Path/Pattern input which updates when users click a mode. The Path/Pattern input is always editable (including `[selected text]`), but the extension validates on run and surfaces errors.

## Changes

### Shared Types
- `src/shared/types/sources.ts`
  - `TextSourceMode = 'activeFile' | 'manuscript' | 'chapters' | 'selection'`
  - `TextSourceSpec { mode, pathText? }`
  - `ResolvedTextSource { text, relativePaths[], displayPath? }`

### Message Contracts
- `src/shared/types/messages.ts`
  - Updated metrics request messages to accept `text?` (legacy) or `source?: TextSourceSpec` (preferred).
  - Added helper message pairs:
    - `REQUEST_ACTIVE_FILE` → `ACTIVE_FILE { relativePath?, sourceUri? }`
    - `REQUEST_MANUSCRIPT_GLOBS` → `MANUSCRIPT_GLOBS { globs }`
    - `REQUEST_CHAPTER_GLOBS` → `CHAPTER_GLOBS { globs }`

### Infrastructure
- `src/infrastructure/text/TextSourceResolver.ts`
  - Resolves `TextSourceSpec` to aggregated text.
  - Modes:
    - selection: verifies `[selected text]` token if provided, reads current selection.
    - activeFile: accepts absolute or workspace-relative paths; fallback to active editor; reads single file.
    - manuscript: expands globs (from `pathText` or settings), includes `.md`/`.txt`, aggregates.
    - chapters: same as manuscript but uses `contextPaths.chapters`.
  - Reuses consistent glob normalization and excludes (`node_modules`, `.git`, etc.).

### Application (Message Handler)
- `src/application/handlers/MessageHandler.ts`
  - Metrics handlers now resolve text via `TextSourceResolver` and then call existing measurement tools.
  - Added helpers to respond to `REQUEST_*` messages with active file or configured globs.
  - Errors (no selection, invalid path/globs, or no matches) surface as `ERROR` with “Invalid selection or path”.

### Presentation (Webview)
- `src/presentation/webview/components/MetricsTab.tsx`
  - Added a “Measure:” selector with 4 options (Active File, Manuscripts, Chapters, Selection) styled as `.tab-bar`/`.tab-button` to stay theme-aware and match the TabBar look.
  - A single Path/Pattern input updates on mode selection via messages; remains editable.
  - On run, posts `{ source: { mode, pathText } }` for all metrics.
- `src/presentation/webview/App.tsx`
  - Persists `metricsSourceMode` and `metricsPathText` via `vscode.setState`.
  - Handles `ACTIVE_FILE`, `MANUSCRIPT_GLOBS`, and `CHAPTER_GLOBS` to update the Path/Pattern field.
  - Removed race guard so replies always update the input field.

### Compatibility
- Legacy `text` field still works; if `source` is absent, handlers use `text` (unchanged behavior).

## Alternatives Considered
- Keeping textarea-only input: rejected due to poor UX for real manuscripts and duplication risks.
- Implicitly auto-updating the mode and path on editor/tab changes: rejected; we require explicit user action.

## Consequences
- Metrics UX is clearer and more powerful; users can analyze entire corpora or the active file without copy-paste.
- Centralized resolver simplifies future tool development (e.g., term clustering utilities) and reduces duplication.
- Minimal risk to existing flows thanks to backward compatibility.

## Follow-ups / Future Work
- Add brief helper text under Path/Pattern explaining input format per mode.
- Reuse `TextSourceResolver` for upcoming “search term frequency/clustering” tool.
- Consider per-file breakdown reporting in addition to aggregated metrics.

## Example Payloads

Run Prose Stats on Manuscripts with custom globs:
```json
{
  "type": "measure_prose_stats",
  "source": { "mode": "manuscript", "pathText": "manuscript/**/*.md,Manuscript/**/*.txt" }
}
```

Request active file path for UI:
```json
{ "type": "request_active_file" }
```

Extension response:
```json
{ "type": "active_file", "relativePath": "novel/ch-03.md", "sourceUri": "file:///..." }
```

