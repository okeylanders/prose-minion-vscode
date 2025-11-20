# Loading Widget Status Integration

**Date Identified**: 2025-11-19  
**Identified During**: Search status wiring  
**Priority**: Medium  
**Estimated Effort**: 1 day

## Problem
LoadingWidget is a visual component only; each tab manually renders status text and wiring. Search now mirrors Analysis by threading STATUS messages through the tab, but this is duplicated plumbing and easy to forget for new domains. STATUS handling belongs with the loading experience itself.

## Current Implementation
- App routes STATUS to domain hooks (analysis/dictionary/search).
- Each tab renders its own status text above LoadingWidget (`statusMessage || fallback`).
- LoadingWidget does not receive or render status and has no lifecycle hooks for registration.

## Recommendation
- Enhance LoadingWidget to accept an optional `statusSource` and, on mount, register a STATUS handler with useMessageRouter (or a shared hook) to render incoming messages automatically.
- Provide an opt-in prop for domains to supply a selector/filter for sources (e.g., `extension.search`).
- Unregister on unmount to avoid stale listeners.
- Update tabs to drop custom status plumbing and pass only the source hint.

## Impact
- Reduces duplicated status wiring per tab.
- Lowers risk of missing STATUS display for new tools.
- Centralizes UX for loading + ticker effects.

## References
- Files: src/presentation/webview/components/LoadingWidget.tsx, src/presentation/webview/components/AnalysisTab.tsx, src/presentation/webview/components/SearchTab.tsx, src/presentation/webview/App.tsx  
*** End Patch***");
