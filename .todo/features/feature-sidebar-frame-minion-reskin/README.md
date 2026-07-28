# Feature: Sidebar Frame Minion Reskin

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item
**Status**: Parked
**Priority**: Medium

## Problem

The Workshop ships with the warm Frame Minion-inspired editor-tab treatment,
while the sidebar remains on its existing surface. The temporary visual
divergence is acceptable for the Workshop alpha, but it should be resolved as a
separate design pass rather than folded into Sprint 04.

## Related Files

- `docs/design/Prose Minion - Design Refresh.html`
- `docs/design/pm-mock.css`
- `packages/core/src/presentation/webview/App.tsx`
- `packages/core/src/presentation/webview/index.css`

## Completion Criteria

- Sidebar chrome, tabs, cards, and controls align with the approved design
  refresh without regressing narrow sidebar usability.
- Existing sidebar workflows still pass: analysis, metrics, dictionary, search,
  settings, account balance, save/copy.
- Visual changes are scoped to sidebar styles and shared components where
  appropriate.
