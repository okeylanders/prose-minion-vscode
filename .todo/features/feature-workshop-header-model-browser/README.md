# Feature: Workshop Header Model Browser

**Date Identified**: 2026-07-07
**Source**: Workshop editor-tab Sprint 04 parked item
**Status**: Parked
**Priority**: Medium

## Problem

The Workshop header currently reuses the compact assistant model selector. The
prototype points toward a full model-browser affordance from that header so
writers can inspect capabilities, pricing, and context before switching models.

## Related Files

- `docs/design/Prose Minion - Model Browser.html`
- `packages/core/src/presentation/webview/components/shared/ModelSelector.tsx`
- `packages/core/src/presentation/webview/components/shared/ModelBrowserModal.tsx`
- `packages/core/src/presentation/webview/WorkshopApp.tsx`

## Completion Criteria

- The Workshop header opens the full model browser in a way that matches the
  approved Workshop visual language.
- Browser selection updates the assistant model scope through existing
  `SET_MODEL_SELECTION` plumbing.
- Pricing/context display clearly distinguishes live data from fallback data.
- Typecheck, focused model-browser tests, and Workshop smoke coverage pass.
