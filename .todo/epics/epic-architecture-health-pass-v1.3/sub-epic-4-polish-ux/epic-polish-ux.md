# Sub-Epic 4: Polish & UX

**Status**: 🟢 Ready to Start
**Duration**: 1-2 days
**Progress**: 0/4 sprints complete (0%)
**Prerequisites**: ✅ Sub-Epic 3 Complete

---

## Overview

This sub-epic focuses on user experience improvements and final polish before v1.3 release. All sprints address UX quality concerns: graceful error handling, performance optimization, user-controllable cancellation, and consistent styling patterns.

**Core Theme**: Polish the architecture with user-facing improvements.

---

## Problem Statement

After Sub-Epic 3 completes standards and testing, several UX improvements remain:

1. **No Error Boundaries** - Component crashes take down entire webview
2. **Unnecessary Re-renders** - Tab components with 30+ props re-render on any parent state change
3. **No Cancellation UI** - Backend infrastructure complete (PR #31), but users can't cancel long requests
4. **Mixed CSS Patterns** - Inline styles used where Tailwind utilities would be cleaner

**User Experience Impact**:
- White screen crashes on errors (bad UX)
- Sluggish performance during interactions (unnecessary re-renders)
- No way to stop expensive AI requests (cost control issue)
- Linter warnings and inconsistent styling patterns

---

## Sprints

### Sprint 01: Error Boundary 🟡 Ready
**Status**: Ready to Start
**Priority**: MEDIUM
**Estimated Time**: 1-2 hours

**Deliverables**:
- ErrorBoundary component with graceful fallback UI
- TabErrorFallback component for friendly error messages
- Wrap tab components in error boundaries
- Wrap MarkdownRenderer separately (high-risk parsing)

**References**:
- [Architecture Debt: Error Boundary](./../../../architecture-debt/2025-11-19-error-boundary-needed.md)

---

### Sprint 02: React.memo Performance 🟡 Ready
**Status**: Ready to Start
**Priority**: MEDIUM
**Estimated Time**: 2-3 hours

**Deliverables**:
- Wrap tab components in `React.memo()`
- Add custom comparison functions for complex props
- Ensure callback stability in App.tsx (useCallback)
- Add useMemo for expensive computations

**References**:
- [Architecture Debt: React.memo Performance](./../../../architecture-debt/2025-11-19-react-memo-performance.md)

---

### Sprint 03: Request Cancellation UI 🟡 Ready
**Status**: Ready to Start
**Priority**: MEDIUM
**Estimated Time**: 4-6 hours

**Deliverables**:
- Add cancellation state to domain hooks (abortController management)
- Backend signal registry (track AbortControllers by request ID)
- Cancel button in LoadingIndicator component
- Message contracts for cancellation (CANCEL_REQUEST type)

**Prerequisites**:
- ✅ Backend infrastructure complete (PR #31)
- ✅ LoadingIndicator component extracted (Sub-Epic 2)

**References**:
- [Architecture Debt: Request Cancellation UI](./../../../architecture-debt/2025-11-21-request-cancellation-ui-exposure.md)

---

### Sprint 04: CSS Pattern Standardization 🟡 Ready
**Status**: Ready to Start
**Priority**: LOW
**Estimated Time**: 2-4 hours

**Deliverables**:
- Document hybrid pattern (custom CSS for reusables, Tailwind for one-offs)
- Refactor SettingsOverlay as example (eliminate inline styles)
- Update agent guidance in `.ai/central-agent-setup.md`
- Opportunistic refactoring guidelines (no mass rewrite)

**References**:
- [Architecture Debt: Tailwind Pattern](./../../../architecture-debt/2025-11-20-tailwind-custom-css-pattern.md)

---

## Success Criteria

### After Sprint 01 (Error Boundary)
- ✅ ErrorBoundary component created with fallback UI
- ✅ All tab components wrapped in error boundaries
- ✅ MarkdownRenderer wrapped separately
- ✅ Friendly error messages with retry button
- ✅ UI doesn't crash on component errors

### After Sprint 02 (React.memo)
- ✅ All tab components wrapped in `React.memo()`
- ✅ Custom comparison functions for complex props
- ✅ Stable callbacks in App.tsx
- ✅ Fewer re-renders verified in React DevTools
- ✅ Smoother UX during interactions

### After Sprint 03 (Cancellation UI)
- ✅ Cancel buttons visible during loading states
- ✅ Domain hooks manage AbortControllers
- ✅ Backend tracks signals by request ID
- ✅ Users can cancel analysis/dictionary/context/search/metrics requests
- ✅ Proper cleanup on abort (no orphaned promises)

### After Sprint 04 (CSS Pattern)
- ✅ Hybrid pattern documented in agent guidance
- ✅ SettingsOverlay refactored (no inline styles)
- ✅ Pattern clear: custom CSS for reusables, Tailwind for one-offs
- ✅ No linter warnings for inline styles
- ✅ Opportunistic refactoring guidelines established

---

## Architecture Impact

**Sub-Epic 4 Benefits**:
- **Resilience**: Graceful error handling prevents white screens
- **Performance**: React.memo reduces unnecessary re-renders
- **User Control**: Cancellation UI empowers users to stop expensive requests
- **Consistency**: Clear CSS pattern eliminates inline style confusion

**Final Architecture Score**: 9.8/10 → **10/10** (complete health pass)

---

## Dependencies

### Prerequisites (Sub-Epic 3)
- ✅ Component extraction complete (LoadingIndicator available)
- ✅ Type safety established (typed props for memo comparison)
- ✅ Clean architecture (easy to add error boundaries)

### Internal Dependencies
- Sprint 03 depends on LoadingIndicator (extracted in Sub-Epic 2, Sprint 02)
- Sprint 02 requires stable callbacks (useCallback in domain hooks)

---

## Timeline

**Day 1** (4-6 hours):
- Morning: Sprint 01 (Error Boundary) - 1-2 hours
- Afternoon: Sprint 02 (React.memo Performance) - 2-3 hours

**Day 2** (4-6 hours):
- Morning: Sprint 03 (Request Cancellation UI) - 4-6 hours
- Afternoon: Sprint 04 (CSS Pattern Standardization) - 2-4 hours (if time allows)

**Sprint 04 is LOW priority** - Can be deferred to v1.4 if time runs short.

---

## References

**Architecture Debt**:
- [Error Boundary Needed](./../../../architecture-debt/2025-11-19-error-boundary-needed.md)
- [React.memo Performance](./../../../architecture-debt/2025-11-19-react-memo-performance.md)
- [Request Cancellation UI Exposure](./../../../architecture-debt/2025-11-21-request-cancellation-ui-exposure.md)
- [Tailwind Custom CSS Pattern](./../../../architecture-debt/2025-11-20-tailwind-custom-css-pattern.md)

**Related PRs**:
- PR #31: Fast Dictionary Generation (backend cancellation infrastructure)
- PR #37: LoadingIndicator extraction (used in Sprint 03)

**Parent Epic**:
- [Epic: Architecture Health Pass v1.3](../epic-architecture-health-pass-v1.3.md)

---

## Next Steps

1. Complete Sub-Epic 3 (Standards & Testing)
2. Start Sprint 01: Error Boundary
3. Continue sequentially through sprints
4. Evaluate Sprint 04 timing based on velocity

---

**Created**: 2025-12-03
**Last Updated**: 2025-12-03
**Status**: Ready to Start (blocked on Sub-Epic 3 completion)
