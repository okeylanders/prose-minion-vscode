# Cancel Message Duplication in Tabs

**Date Identified**: 2025-03-01  
**Identified During**: Streaming/cancel hardening review  
**Priority**: Low  
**Estimated Effort**: <0.5 day

## Problem
Cancel message construction is repeated across UI tabs. Each tab manually builds the `CANCEL_*` message with type/payload/timestamp. This invites drift if cancel semantics change (e.g., new metadata, telemetry, or guard checks).

## Current Implementation
- `src/presentation/webview/components/tabs/AnalysisTab.tsx` (analysis + context cancel)
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx` (dictionary cancel)

## Recommendation
Extract a small helper (e.g., `postCancelRequest(vscode, domain, requestId, source)`) in a shared UI utility module. Tabs call the helper instead of hand-coding the message shape. Consider colocating with other message helpers (if/when created) to keep UI messaging consistent.

## Impact
- Reduces duplication and drift risk when cancel envelope changes.
- Simplifies tab components; easier to audit cancel flow.

## References
- Duplicate code paths: `AnalysisTab.tsx`, `UtilitiesTab.tsx`
