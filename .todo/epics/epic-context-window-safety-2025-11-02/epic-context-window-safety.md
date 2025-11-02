# Epic: Context Window Safety

**Date Created**: 2025-11-02
**Status**: In Progress
**Priority**: HIGH (v1.0 blocker candidate)
**Target Release**: v1.0
**Epic Lead**: Development Team

---

## Overview

Implement context window management to prevent token limit errors, reduce unexpected API costs, and provide user awareness of input sizes. This epic ensures non-technical users can confidently use Prose Minion without understanding technical limitations like token counts and context windows.

## Vision

**As a creative writer**, I want to paste my manuscript excerpts and get analysis results without worrying about technical limits, so that I can focus on my craft instead of API constraints.

**As a power user**, I want control over context window limits when I'm using models with larger context windows, so that I can leverage the full capabilities of my chosen model.

## Business Value

### User Experience
- ✅ **Eliminates frustrating API errors** for typical users
- ✅ **Prevents unexpected costs** from oversized requests
- ✅ **Educates users** about appropriate input sizes
- ✅ **Builds trust** through predictable, reliable behavior

### Technical Value
- ✅ **Reduces support burden** (fewer "why did it fail?" questions)
- ✅ **Improves API efficiency** (smaller requests = faster responses)
- ✅ **Enables confident v1.0 release** (robust error prevention)
- ✅ **Maintains Clean Architecture** (follows established patterns)

## Success Metrics

### Primary Metrics
- **Zero "token limit exceeded" errors** reported by users in first month post-release
- **No user complaints** about unexpected API costs related to large inputs
- **< 5% of users** disable the trimming feature (indicates good defaults)

### Secondary Metrics
- **Output Channel trim logs** tracked for telemetry (how often does trimming occur?)
- **User feedback** on word counter UI (helpful vs. annoying?)
- **Support ticket reduction** related to API errors

## Scope

### In Scope
1. **UI Word Counter** (Presentation Layer)
   - Real-time word count display for excerpt inputs
   - Color-coded visual feedback (green/yellow/red)
   - Non-blocking soft limit (500 words)
   - Implemented on Analysis, Context, Dictionary tabs

2. **Backend Silent Trimming** (Application Layer)
   - Settings-based toggle (`proseMinion.applyContextWindowTrimming`)
   - Context Agent: 50K word limit
   - Analysis Agents: 75K word limit with prioritization
   - Output Channel logging for transparency
   - Sentence boundary preservation (best effort)

3. **Configuration & Documentation**
   - Add setting to package.json with clear description
   - Update user-facing documentation
   - Internal architectural documentation (ADR)

### Out of Scope (Future Enhancements)
- ❌ Token counting (vs. word counting) - v1.1+
- ❌ Per-model context limits - v1.1+
- ❌ Smart truncation (summarize middle) - v1.1+
- ❌ User notifications for significant trimming - v1.1+
- ❌ Configurable per-agent limits - v1.1+
- ❌ Input size estimator UI (progress bar) - v1.1+

## Architecture Alignment

This epic adheres to Clean Architecture principles established in the [Presentation Layer Review](../../../docs/architectural-reviews/2025-11-02-presentation-layer-review.md):

### Layer Separation
```
┌────────────────────────────────────┐
│  Presentation Layer                │
│  - Word counter components         │
│  - Visual feedback only            │
│  - No business logic               │
└────────────────────────────────────┘
              ↓
┌────────────────────────────────────┐
│  Application Layer                 │
│  - AIResourceOrchestrator          │
│  - Trimming logic                  │
│  - Configuration reading           │
└────────────────────────────────────┘
              ↓
┌────────────────────────────────────┐
│  Domain/Infrastructure             │
│  - Word counting utilities         │
│  - Pure functions                  │
└────────────────────────────────────┘
```

### SOLID Principles Applied
- **Single Responsibility**: Word counter handles UI feedback; orchestrator handles trimming
- **Open/Closed**: Trimming strategies can be extended without modifying existing code
- **Dependency Inversion**: High-level orchestration depends on abstractions (utilities)
- **Interface Segregation**: Clean, focused interfaces for word counting
- **Type Safety**: Explicit TypeScript interfaces throughout

### Domain Mirroring
- **Frontend Domain**: User awareness and education (word counter)
- **Backend Domain**: Resource management and cost control (trimming)
- Clear boundary between user choice (UI) and system limits (backend)

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users frustrated by trimming | Medium | Low | Good defaults, clear documentation, easy disable |
| Guides trimmed too aggressively | Low | Medium | Prioritization logic (guides last), Output Channel transparency |
| Word count inaccurate vs. tokens | Low | Medium | Conservative limits with margin, token counting in v1.1+ |
| Performance impact from word counting | Low | Very Low | Simple whitespace splitting is O(n), negligible overhead |
| Setting not discoverable | Medium | Low | Clear UI in Settings overlay, good default (enabled) |

## Dependencies

### Internal Dependencies
- ✅ AIResourceOrchestrator exists and is stable
- ✅ Settings overlay UI for configuration
- ✅ Output Channel for logging
- ✅ React components for word counter UI

### External Dependencies
- None (self-contained feature)

### Blocking Issues
- None identified

## Timeline

### Sprint 1: Core Implementation (2-3 hours)
- **Week 1**: Implement utilities, backend trimming, UI word counter
- **Deliverables**: Working feature with all acceptance criteria met

### Sprint 2: Testing & Polish (Optional - if issues found)
- **Week 1**: Edge case testing, refinements
- **Deliverables**: Production-ready, thoroughly tested

**Estimated Total**: 2-3 hours (single sprint likely sufficient)

## Sprints

1. [Sprint 01: Context Window Trim Limits Implementation](sprints/01-trim-limits-implementation.md) - **In Progress**

## Related ADRs

- [ADR: Context Window Trim Limits (2025-11-02)](../../../docs/adr/2025-11-02-context-window-trim-limits.md)

## Related Epics

- [Epic: Presentation Layer Domain Hooks Refactor](../epic-presentation-refactor-2025-10-27/) - Establishes architectural patterns this epic follows

## Team Notes

### Why This Epic Matters

**Context window limits are invisible to most users until they hit them.** When that happens, the experience is jarring:
- API returns cryptic error messages
- User doesn't know what they did wrong
- No guidance on how to fix it
- Potential unexpected API charges

This epic makes context windows **invisible in the right way** - they just work, without the user needing to understand the underlying complexity.

### Architectural Philosophy

Following the lessons from the presentation layer refactor:
- **Thin orchestrator**: App.tsx/MessageHandler remain simple routers
- **Domain separation**: UI concerns (word counter) vs. backend concerns (trimming)
- **Type safety**: Explicit interfaces prevent runtime errors
- **Pure functions**: Word counting utilities have no side effects
- **Testability**: Every component can be tested in isolation

### User Scenarios

**Scenario 1: New User** (95% of users)
- Pastes 2000-word excerpt into Analysis tab
- Sees green word counter: "2000 / 500 words (⚠️ Large excerpt)"
- Decides to trim manually or proceeds anyway
- Backend ensures total context stays within limits
- Analysis succeeds without errors
- User is happy and productive

**Scenario 2: Power User** (5% of users)
- Uses Claude Opus with 200K context window
- Wants to analyze 50-page chapters (15K+ words)
- Disables `applyContextWindowTrimming` in settings
- No limits applied
- Full context sent to API
- User leverages full model capabilities

## Definition of Done

- [ ] All acceptance criteria from Sprint 01 met
- [ ] ADR documented and approved
- [ ] Code follows Clean Architecture principles
- [ ] Unit tests for word counting utilities
- [ ] Integration tests for trimming logic
- [ ] Manual testing checklist completed
- [ ] Output Channel logging verified
- [ ] Documentation updated (if user-facing changes)
- [ ] PR reviewed and approved
- [ ] Merged to main branch
- [ ] Memory bank entry created

## Post-Epic Review

_(To be filled after completion)_

### What Went Well
- TBD

### What Could Be Improved
- TBD

### Lessons Learned
- TBD

### Metrics Achieved
- TBD

---

**Epic Status**: 🟡 In Progress
**Next Action**: Complete Sprint 01 implementation
**Blocked**: No
**Last Updated**: 2025-11-02
