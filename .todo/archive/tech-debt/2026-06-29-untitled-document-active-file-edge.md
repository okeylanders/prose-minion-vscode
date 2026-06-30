# Untitled Document Active File Edge

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Resolved
**Priority**: Low
**Estimated Effort**: Small

## Problem

During the ports-and-adapters migration, selection handling moved through a
string-path boundary. Unsaved VS Code buffers use the `untitled:` scheme, and
forcing paths through file-oriented helpers may change the error mode for an
unsaved active document.

The old implementation likely did not support reading untitled buffers through
workspace FS either, but the current behavior should be confirmed explicitly.

## Recommendation

Smoke-test active selection flows against an untitled editor. If the behavior is
acceptable, document it. If it is confusing, improve the user-facing error or add
a direct text-source path for unsaved selections.

## Related Files

- `apps/vscode-extension/src/platform/vscode/VsCodeEditorContext.ts`
- `packages/core/src/application/handlers/domain/UIHandler.ts`
- `packages/core/src/infrastructure/text/TextSourceResolver.ts`

## Completion Criteria

- Current behavior for untitled active files is verified.
- If needed, the user-facing message clearly explains that the buffer must be
  saved or selected text must be supplied directly.
- Any behavior change has focused tests or a documented F5 smoke result.

## Resolution

Resolved on 2026-06-30 in `release-cleanup/pre-v2-low-hanging-fruit`.
Selection mode remains supported for untitled buffers because it reads selected
text directly. Active-file mode now fails with a clear "save the file first or
use selected text" message, covered by resolver tests.
