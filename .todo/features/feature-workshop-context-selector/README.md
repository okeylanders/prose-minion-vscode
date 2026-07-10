# Feature: Workshop Context Selector Modal

**Date Identified**: 2026-07-10
**Source**: User request
**Status**: Planned
**Priority**: High
**Estimated Effort**: Medium

## Problem

Workshop currently shows a read-only “Context Brief” placeholder. A writer
cannot paste context into that surface, inspect configured project-resource
locations, or deliberately choose project files for a Workshop conversation.

## Proposed Experience

Add a Context Selector modal from the Workshop rail:

- Start with the official resource locations configured in Settings (characters,
  locations, themes, things, chapters, manuscript, project brief, and general).
- Browse matching workspace files with clear path, category, and selection
  state.
- Offer an explicit “Explore project folders…” escape hatch through the VS Code
  host; do not expose browser filesystem access from the webview.
- Show selected files and pasted/manual context as inspectable attachments in
  the Workshop rail, with size limits and remove controls.

## Design Questions

- Does the modal attach full file text, a bounded excerpt, or a host-generated
  summary by default?
- Which attachments remain in the session on reset, excerpt replacement, and
  reload?
- Should selecting files immediately make them available to the persona, or
  require an explicit “Add to context” confirmation?
- How should configured glob categories and manually explored files be visibly
  distinguished?

## Architecture Notes

- Keep enumeration and reads behind `FileSystem`, `Workspace`, and
  `ShellService` ports; `packages/core` remains VS Code-free.
- Reuse context-path Settings as the default discovery policy, not a second
  hard-coded folder taxonomy.
- Model-assisted file selection is separate future work. This modal is the
  writer-controlled attachment path and must remain deterministic.
- Attachments should become typed, attributable session artifacts so later host
  evidence injection can reveal what the persona saw without dumping raw file
  contents into the visible chat.

## Completion Criteria

- Workshop offers a discoverable Context Selector modal.
- Default browsing reflects the configured context-resource paths.
- Writers can explicitly attach/remove configured or manually explored project
  files and paste manual context.
- Attached context has bounded size, visible provenance, reload behavior, and
  focused tests.
- No raw provider/file-system paths leak to the webview beyond the established
  display-safe path policy.

## Related Files

- `packages/core/src/presentation/webview/WorkshopApp.tsx`
- `packages/core/src/presentation/webview/hooks/domain/useContextPathsSettings.ts`
- `packages/core/src/application/handlers/domain/ContextHandler.ts`
- `packages/core/src/platform/FileSystem.ts`
- `packages/core/src/platform/Workspace.ts`
