# Cancel Message Duplication

**Date Identified**: 2025-12-05
**Reviewed**: 2026-06-25
**Status**: Resolved
**Priority**: Low
**Estimated Effort**: Under half a day

## Problem

Webview components manually construct cancel-message envelopes in several
places:

- Analysis streaming
- Context streaming
- Dictionary streaming
- Category search

This duplicates message type, source, request ID, domain, and timestamp logic.
It also permits contract drift: category search currently sends
`domain: 'search'`, while `StreamingDomain` does not include `search`.

## Recommendation

Add a typed cancel-message factory or `postCancelRequest()` helper that owns:

- Domain-to-`MessageType` mapping
- Envelope source
- Request ID payload
- Timestamp creation

Include category search explicitly rather than widening types through casts.

## Related Files

- `packages/core/src/presentation/webview/components/tabs/AnalysisTab.tsx`
- `packages/core/src/presentation/webview/components/tabs/UtilitiesTab.tsx`
- `packages/core/src/presentation/webview/components/search/CategorySearchPanel.tsx`
- `packages/core/src/shared/types/messages/streaming.ts`

## Completion Criteria

- UI call sites no longer hand-build cancel envelopes
- Search cancellation is represented by the shared contract
- Mapping and envelope shape have focused tests

## Resolution

Resolved on 2026-06-30 in `release-cleanup/pre-v2-low-hanging-fruit`.
Added a shared `createCancelRequestMessage()` helper, represented category
search as the `search` streaming domain, and covered the mapping with focused
tests.
