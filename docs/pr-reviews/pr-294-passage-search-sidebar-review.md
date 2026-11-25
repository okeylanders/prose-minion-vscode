# PR #294 review: Passage Search sidebar

**Astra 6.2 · November 21, 2026 · Reviewed `a8c075fdb1a40e389a72ac0358bb58582831e55b`** against `773543f0ff77c7279209497ae760ea107f6f4880` on `epic/passage-search`.

**Verdict: changes before merge. Three P2s.** [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44952301717).

## P2 · External editor paths leak into results and reports

[PassageSearchScopeFiles.ts:229–253](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/application/services/passageSearch/PassageSearchScopeFiles.ts#L229-L253) copies the editor's relative-path field. [VsCodeEditorContext.ts:39–45](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/apps/vscode-extension/src/platform/vscode/VsCodeEditorContext.ts#L39-L45) uses VS Code's `asRelativePath`, which can return the original filesystem path for documents outside the workspace or with no workspace. [PassageSearchViews.ts:122–132](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/application/handlers/domain/PassageSearchViews.ts#L122-L132) sends that value verbatim. Both Active File and Selection produced a synthetic absolute home path in the result and Markdown. The existing view test feeds an already-relative label.

Keep real paths host-only; derive a safe display label for external files (for example basename, accounting for POSIX and Windows formats). Preserve workspace-relative labels and host-mediated opening. Add external Active File and Selection fixtures through the actual resolver and view mapping.

## P2 · Results can visually belong to the wrong question

[PassageSearchPanel.tsx:80–93,157–193](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/presentation/webview/components/search/PassageSearchPanel.tsx#L80-L93) leaves the input editable and [PassageSearchResult.tsx:73–79](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/presentation/webview/components/search/passage/PassageSearchResult.tsx#L73-L79) never shows the result's frozen question. In a React fixture, changing question A to B during A's request left A's result below only B's question. Editing after completion has the same ambiguity. Copy or Organize then applies to A even though B is the only visible question.

Show the result's own question above its results and actions. Keep draft edits independent and cover both A-to-B timings in a component test.

## P2 · Report copy/save bypasses the held snapshot and the private logging rule

[PassageSearchPanel.tsx:54–68](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/presentation/webview/components/search/PassageSearchPanel.tsx#L54-L68) sends the entire rendered report back via generic COPY_RESULT/SAVE_RESULT without its result ID. Unlike open-at-line, the host cannot confirm the export came from the held snapshot. D15 specifies that only the question, pattern and scope inputs cross back. In addition, Passage Search now enters the generic save handler: [FileOperationsHandler.ts:56–59,139–150,216](https://github.com/okeylanders/prose-minion-vscode/blob/a8c075fdb1a40e389a72ac0358bb58582831e55b/packages/core/src/application/handlers/domain/FileOperationsHandler.ts#L139-L150) can log an absolute report path when opening fails and exception text with the project root when writing fails. Synthetic ordinary failures verified both. D22 limits logs to counts, IDs and fault kinds.

Use ID-only export intents for this tool and render the validated held result on the host with the same pure formatter. Report stale results cleanly; log only status and fault kind on failure, including through any reused file helper. Keep a successful save distinguishable from a failure to open the saved report. Add copy/save tests for the ID boundary, missing/stale results and both filesystem failures.

## Verification and scope

Independent offline checks used head-pinned modules, synthetic text and paths, stubbed editor/provider, and React/jsdom. Confirmed two distinct nearby hits retain reading order and source lines, an overlapping duplicate collapses, and exact typographic source is preserved. Negation and different-actor decoys were not returned by the fake provider by construction, so this does not validate model recall. Open actions use host-held file identities; navigation uses the original snapshot's line, so edits during the run still merit a live smoke check. No live model call or Extension Development Host check. Recheck the organizer/sidebar integration after the sibling slice lands.
