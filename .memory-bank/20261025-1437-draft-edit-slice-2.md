# Draft Edit Slice 2: Proofread and Fix

**Date:** 2026-10-25 14:37 UTC
**Branch:** `claude/upbeat-galileo-y1l4yf`, restarted from `epic/lightbox` at
`e3a7fac0` (the PR #171 merge), into `epic/lightbox`
**Decision record:** [ADR 2026-10-21](../docs/adr/2026-10-21-draft-edit-engine-and-document-write-back.md),
"Amendment 2026-10-25: Slice 2, the write side"
**Slice doc:** [slice-2-write-side-and-fix.md](../.todo/epics/epic-draft-edit-2026-10-25/slice-2-write-side-and-fix.md)

## What changed

- `a013267d`: the write-side hardening from PR #171's review.
  - `anchorQuote` refuses a match ending inside an expansion.
  - `changesLineBreaks` refuses any line-break change.
- `3fee84d0`: `DocumentEditor.applyEdits` and `VsCodeDocumentEditor`'s
  implementation.
- `c2d2a0c9`: `DraftEditApplier` (the one door) and `reconcileEdits`.
- `924a481f`: Proofread and Fix, and the *Replace with* / *Fix all* quick
  fixes.
  - The commands, the manifest entry, and `proseMinion.proofread.fixReview`.
  - The guard's `markup-change` downgrade.
  - `IssueAnnotator.current`.

## Decisions

- **Review starts unticked (the writer, 2026-10-25).** `needsConfirmation`
  is the only way an extension opens Refactor Preview, and VS Code lists such
  entries unticked. The writer ticks the file (all fixes) or single fixes,
  then Apply. The progress line says so.
- A single *Replace with* applies at once; *Fix all* honors the setting.
- The setting has no Settings Overlay row (an editor command, like the
  Workshop's settings).
- The writer ran Flag in their editor and reported it working; the default
  Proofread model stays.

## Context worth keeping

- **VS Code could not be downloaded here.** The network policy denies
  `update.code.visualstudio.com`.
  - The spike read VS Code's source instead, from a blob-filtered sparse
    clone of `microsoft/vscode` at `/home/user/microsoft/vscode`:
    `src/vs/workbench/contrib/bulkEdit/` and `api/`, at `main` (`4f383697`)
    and tag `1.82.0`.
  - `git sparse-checkout set --no-cone <paths>` needs leading slashes for
    files.
- **`workspace.applyEdit`'s boolean.**
  - `true` means any edit landed.
  - `false` means one of:
    - the preview was discarded;
    - the buffer changed during review (VS Code's conflict dialog);
    - the buffer moved after the extension's check (each edit carries the
      ext host's document version).
  - Tell them apart by the document: closed, moved (stale), or neither.
- **VS Code makes edits to the active editor's document "more minimal".**
  One replacement can arrive as smaller changes inside its range (always at
  1.82.0; at `main` unless the entry has metadata).
  - That is why `reconcileEdits` takes in changes inside a range, edges
    included, and why touching edits are joined first.
- **After `await workspace.applyEdit`,** the document and its change events
  already reflect the edit, so the applier's watch, begun before the call,
  sees it.
- **Cancel can't close an open preview.** The progress notification's
  Cancel has no effect once the preview is open; there is no extension API
  for it. (Corrected in PR #172 F-02: VS Code's `refactorPreview.discard`
  command is that call, and the adapter now runs it when a reviewed
  document closes or changes language; Cancel does not use it yet.)

## Verification

- Node 18.20.8, CI's four steps:
  - typecheck (core, webview, adapter) passes;
  - the full suite passes: 545 suites / 7,614 tests / 59 snapshots;
  - lint is at its baseline: 0 errors / 1,133 warnings;
  - the build and `verify:bundle` pass.
- The full suite also passes under Node 22.
- No live provider calls. Fixtures are public-domain *Alice*.

## Follow-ups

- The Extension Development Host pass for Fix is the writer's; the slice
  doc lists it.
- Slice 3 (polish), Slice 4 (the Workshop's Proofread button), Slice 5
  (Apply to Draft) are as planned.
