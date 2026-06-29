# Feature: Request History Buttons

**Date Identified**: 2026-06-29
**Source**: User request
**Status**: Planned
**Priority**: Medium
**Estimated Effort**: Medium

## Summary

Add request-history navigation to the Assistant, Category Search, and Dictionary
tools so writers can move through recent requests with previous/next buttons.

The goal is to make repeated exploratory work easier: revisiting a prior prompt,
search phrase, or dictionary lookup should not require retyping or manually
copying from previous output.

## Candidate Scope

- Add previous/next request-history buttons to:
  - Assistant
  - Category Search
  - Dictionary
- Preserve each tool's current request input before navigating away from it.
- Disable previous/next buttons when there is no history in that direction.
- Add a clear-history control in the Settings tab.
- Decide whether clearing history removes all tool histories at once or offers
  per-tool clearing.
- Decide whether histories are session-only or persisted across webview reloads.

## Design Questions

- Should each tool keep its own independent history, or should related searches
  share a unified history model?
- Should duplicate consecutive requests be collapsed?
- Should editing an older request and submitting it create a new newest history
  entry, similar to shell history behavior?
- Should history store only request text, or also associated options such as
  selected model, category, search target, and context mode?
- Should the Settings tab expose one "Clear request history" command or separate
  controls for Assistant, Category Search, and Dictionary?

## Architecture Notes

- Prefer a shared request-history hook or utility only if it removes real
  duplication across the three tools.
- Keep tool ownership clear: Assistant, Category Search, and Dictionary should
  be able to persist and clear their history without cross-domain coupling.
- Follow the existing domain-hook persistence pattern if history survives reloads.
- Use existing message and settings patterns for any Settings-tab clear action.
- Avoid storing generated responses as part of request history unless the product
  explicitly needs replayable result history.

## Acceptance Criteria

- Assistant has previous/next controls that navigate recent submitted requests.
- Category Search has previous/next controls that navigate recent submitted
  searches.
- Dictionary has previous/next controls that navigate recent submitted lookups.
- Navigation restores the relevant request input without automatically
  resubmitting it.
- Buttons have clear disabled states at the beginning and end of history.
- Settings includes a clear-history control.
- Clearing history removes stored request history and immediately disables
  history navigation where applicable.
- History behavior is covered by focused hook or component tests.

## Related

- Webview hooks: `packages/core/src/presentation/webview/hooks/`
- Domain hooks: `packages/core/src/presentation/webview/hooks/domain/`
- Settings UI: `packages/core/src/presentation/webview/components/`
- Message contracts: `packages/core/src/shared/types/messages/`
