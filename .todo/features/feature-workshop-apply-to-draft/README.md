# Feature: Workshop Apply to Draft

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item
**Status**: Parked
**Priority**: Medium

## Problem

Workshop variation cards now support Copy and Save to notes only. Applying a
variation directly back into the source draft needs a separate write-back design
so the extension does not overwrite the wrong range, dirty buffer, or stale
selection.

## Related Files

- `packages/core/src/presentation/webview/components/workshop/WorkshopTurnBubble.tsx`
- `packages/core/src/application/handlers/domain/FileOperationsHandler.ts`
- `packages/core/src/application/handlers/domain/UIHandler.ts`
- `packages/core/src/platform/EditorContext.ts`

## Completion Criteria

- Write-back routes through a host-side handler/port, not browser APIs.
- The design handles dirty buffers, stale ranges, and missing source provenance.
- Variation cards expose Apply to draft only when the target range is known and
  safe.
- Focused tests cover happy path, stale source, missing source, and mid-edit
  conflict behavior.
