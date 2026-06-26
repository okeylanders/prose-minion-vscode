# API-Key Warning Live Clear Contract

**Date Identified**: 2026-06-26
**Source**: PR #64 review, finding 3
**Status**: Identified
**Priority**: Low
**Estimated Effort**: 2-4 hours

## Problem

When a user triggers an AI-backed action without an OpenRouter API key, the
backend returns the transient no-key warning as tool output. PR #64 prevents
that warning from being persisted across reloads, but the currently rendered
warning remains visible in the live session after the user adds a key.

The services self-heal after the secret changes, but the UI does not receive a
message that the stale warning can be cleared.

## Recommendation

Design an explicit UI message contract for clearing only transient API-key
warnings after a successful service refresh. Do not clear arbitrary user
results from the backend refresh path.

One safe shape:

- backend refresh succeeds after a key change;
- backend posts a targeted "clear transient warning" message;
- analysis, dictionary, and context hooks clear their result only if it matches
  `isApiKeyNotConfiguredWarning`;
- ordinary tool output remains untouched.

## Related Files

- `packages/core/src/application/handlers/MessageHandler.ts`
- `packages/core/src/presentation/webview/hooks/domain/useAnalysis.ts`
- `packages/core/src/presentation/webview/hooks/domain/useDictionary.ts`
- `packages/core/src/presentation/webview/hooks/domain/useContext.ts`
- `packages/core/src/shared/types/messages/warnings.ts`

## Completion Criteria

- A typed message contract exists for clearing transient config warnings
- All three result hooks handle the message safely
- Only API-key warning output is cleared; user content is preserved
- Tests cover live warning clear and non-warning preservation
