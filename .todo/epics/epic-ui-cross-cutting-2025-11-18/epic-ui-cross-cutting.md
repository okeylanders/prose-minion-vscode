# Epic: UI Cross-Cutting Improvements

**Epic ID**: epic-ui-cross-cutting-2025-11-18
**Status**: Proposed
**Created**: 2025-11-18
**Owner**: okeylanders
**ADR**: [ADR-2025-11-18: Cross-Cutting UI Improvements](../../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)
**Branch**: `epic/ui-cross-cutting-2025-11-18`

## Overview

Implement two cross-cutting UI improvements identified during Category Search development:

1. **Subtab persistence** - Remember selected subtab across sessions for all modules
2. **Cancellable loading states** - Add cancel button to AI-powered feature loading indicators

## Goals

1. **Consistent persistence**: All UI state that affects user workflow should persist
2. **User control**: Users should be able to cancel long-running AI operations
3. **Pattern establishment**: Create reusable patterns for future components

## Success Criteria

- [ ] Subtab selection persists across sessions for all modules with subtabs
- [ ] Cancel button appears on AI loading indicators
- [ ] Cancel actually aborts the in-progress request (not just hides UI)
- [ ] No orphaned requests after cancel
- [ ] Pattern documented for future components

## Scope

### In Scope

**Sprint 01: Subtab Persistence**
- SearchTab (word/category subtabs)
- MetricsTab (if applicable)
- Pattern documentation

**Sprint 02: Cancellable Loading States**
- Extract LoadingIndicator component with cancel support
- Add AbortController pattern to domain hooks
- Apply to all AI-powered features

### Out of Scope
- Request queuing/batching
- Retry UI after cancel
- Timeout auto-cancel

## Architecture Alignment

**Patterns**:
- Tripartite Hook Interface (add to persistedState)
- Composed Persistence (App.tsx aggregates)
- Infrastructure Hooks (loading state abstraction)

**Anti-Pattern Prevention**:
- Avoid duplicating cancel logic per component
- Extract reusable LoadingIndicator

## Sprints

### Sprint 01: Subtab Persistence
**Status**: Pending
**Estimated Effort**: 0.25 days

**Scope**:
- Extend domain hook persistence interfaces
- Pass initial state to components
- Apply to SearchTab, audit other tabs

**Details**: [Sprint 01](sprints/01-subtab-persistence.md)

---

### Sprint 02: Cancellable Loading States
**Status**: Pending
**Estimated Effort**: 0.5 days

**Scope**:
- Extract LoadingIndicator component
- Add AbortController to AI hooks
- Apply to all AI features (Category Search, Word Search, Analysis, etc.)

**Details**: [Sprint 02](sprints/02-cancellable-loading.md)

---

## Dependencies

**Internal**:
- useSearch hook (SearchTab subtab)
- useMetrics hook (MetricsTab subtab if applicable)
- useAnalysis, useDictionary, useContext (loading states)
- App.tsx (persistence composition)

**External**: None

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| AbortController not supported in OpenRouter client | Medium | Wrap fetch calls with signal support |
| Orphaned requests after cancel | Low | Proper cleanup in useEffect |
| Inconsistent cancel behavior | Medium | Document pattern, review all implementations |

## Testing Strategy

**Manual Testing**:
- Switch subtabs, reload webview, verify selection persists
- Start AI search, cancel mid-request, verify no error
- Verify cancelled request doesn't update state when it completes

**Automated Testing** (optional):
- Unit test for AbortController cleanup
- Integration test for persistence restoration

## References

- [ADR-2025-11-18](../../../docs/adr/2025-11-18-cross-cutting-ui-improvements.md)
- [Presentation Layer Domain Hooks](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Identified during: Category Search Epic Sprint 04 planning

## Changelog

- **2025-11-18**: Epic created (Proposed status)
