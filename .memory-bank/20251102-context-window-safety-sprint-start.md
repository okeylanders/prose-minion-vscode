# Memory Bank: Context Window Safety Implementation

**Date**: 2025-11-02
**Session**: Context Window Trim Limits - Sprint Start
**Branch**: `sprint/epic-context-window-safety-2025-11-02-01-trim-limits`
**Epic**: Context Window Safety
**Sprint**: 01 - Trim Limits Implementation

---

## Current Focus

Implementing context window management to prevent token limit errors and unexpected API costs for non-technical users. This is a **v1.0 blocker candidate** with high priority.

## Key Architectural Decisions

### Architecture Alignment

Following Clean Architecture principles from the [Presentation Layer Review](../docs/architectural-reviews/2025-11-02-presentation-layer-review.md):

1. **Single Responsibility Principle**
   - Word counter components: UI feedback only
   - AIResourceOrchestrator: Trimming logic only
   - Utilities: Pure word counting functions

2. **Layer Separation**
   ```
   Presentation → Application → Domain/Infrastructure
   Word Counter → Orchestrator → Text Utilities
   ```

3. **Domain Mirroring**
   - Frontend domain: User awareness and education
   - Backend domain: Resource management and cost control

4. **Type Safety**
   - Explicit interfaces: `TrimResult`, `countWords`, `trimToWordLimit`
   - No implicit `any` types
   - Clear contracts between layers

### Feature Design

**Two-Layer Approach**:

1. **UI Layer (Soft Limit)**
   - 500-word recommendation for excerpts
   - Real-time word counter with color coding:
     - Green: 0-399 words
     - Yellow: 400-499 words
     - Red: 500+ words with warning
   - Non-blocking (user can still send)
   - Educates users about input size

2. **Backend Layer (Hard Limit)**
   - Setting: `proseMinion.applyContextWindowTrimming` (default: `true`)
   - Context Agent: 50K word limit
   - Analysis Agents: 75K word limit with prioritization:
     1. Excerpt (never trim - UI handles)
     2. Context (trim if guides exhausted)
     3. Guides (trim first)
   - Silent operation (no popups)
   - Output Channel logging for transparency

### Rationale for Limits

**Target**: 128K token context window (lowest common denominator)

| Agent Type | Word Limit | Token Estimate | Output Budget |
|------------|-----------|----------------|---------------|
| Context | 50K words | ~66K tokens | ~60K tokens |
| Analysis | 75K words | ~100K tokens | ~28K tokens |

**Token estimation**: 1.33 tokens/word (conservative average for prose)

## What We're Building

### Files to Create
- `src/utils/textUtils.ts` - Word counting utilities (pure functions)

### Files to Modify
- `package.json` - Add `applyContextWindowTrimming` setting
- `src/application/services/AIResourceOrchestrator.ts` - Add trimming logic
- `src/presentation/webview/components/AnalysisTab.tsx` - Add word counter
- `src/presentation/webview/components/UtilitiesTab.tsx` - Add word counter (Context + Dictionary)
- `src/presentation/webview/styles/index.css` - Add word counter styles

## Implementation Plan

### Phase 1: Configuration & Utilities (30 min)
1. Add configuration setting to `package.json`
2. Create `textUtils.ts` with `countWords` and `trimToWordLimit`
3. Define `TrimResult` interface

### Phase 2: Backend Trimming (60 min)
1. Import utilities into AIResourceOrchestrator
2. Implement Context Agent trimming (50K words)
3. Implement Analysis Agent trimming (75K words with prioritization)
4. Add Output Channel logging

### Phase 3: UI Word Counter (60 min)
1. Add word counter to Analysis tab
2. Add word counter to Context tab
3. Add word counter to Dictionary tab
4. Add CSS styling for color coding

### Phase 4: Testing (30 min)
1. Manual testing checklist
2. Edge case testing
3. Verify setting toggle works
4. Check Output Channel logs

**Total Estimate**: 2-3 hours

## Current Status

### Completed
- ✅ ADR created: [docs/adr/2025-11-02-context-window-trim-limits.md](../docs/adr/2025-11-02-context-window-trim-limits.md)
- ✅ Epic overview: [.todo/epics/epic-context-window-safety-2025-11-02/epic-context-window-safety.md](../.todo/epics/epic-context-window-safety-2025-11-02/epic-context-window-safety.md)
- ✅ Sprint document: [.todo/epics/epic-context-window-safety-2025-11-02/sprints/01-trim-limits-implementation.md](../.todo/epics/epic-context-window-safety-2025-11-02/sprints/01-trim-limits-implementation.md)
- ✅ Memory bank entry (this file)

### In Progress
- 🟡 Creating feature branch
- 🟡 Implementation (Phase 1 starting)

### Upcoming
- ⏳ Phase 1: Configuration & Utilities
- ⏳ Phase 2: Backend Trimming
- ⏳ Phase 3: UI Word Counter
- ⏳ Phase 4: Testing & Verification

## Related Documentation

### ADRs
- [ADR: Context Window Trim Limits (2025-11-02)](../docs/adr/2025-11-02-context-window-trim-limits.md)

### Epics & Sprints
- [Epic: Context Window Safety](../.todo/epics/epic-context-window-safety-2025-11-02/epic-context-window-safety.md)
- [Sprint 01: Trim Limits Implementation](../.todo/epics/epic-context-window-safety-2025-11-02/sprints/01-trim-limits-implementation.md)

### Architectural Reviews
- [Presentation Layer Review (2025-11-02)](../docs/architectural-reviews/2025-11-02-presentation-layer-review.md)

### Related Epics
- [Epic: Presentation Layer Domain Hooks Refactor](../.todo/epics/epic-presentation-refactor-2025-10-27/) - Establishes patterns we're following

## Key Principles (from Architectural Review)

### SOLID Principles
1. **Single Responsibility**: Each component has one reason to change
2. **Open/Closed**: Open for extension, closed for modification
3. **Liskov Substitution**: Consistent interfaces enable predictable composition
4. **Interface Segregation**: Components receive only what they need
5. **Dependency Inversion**: High-level depends on abstractions, not concretions

### Clean Architecture Layers
```
┌─────────────────────────────────────────┐
│  Components (WordCounter)               │ ← UI Layer
│  Dependencies: React, CSS               │
└─────────────────────────────────────────┘
              ↓ sends data
┌─────────────────────────────────────────┐
│  App.tsx (Orchestrator)                 │ ← Presentation Layer
│  Dependencies: domain hooks             │
└─────────────────────────────────────────┘
              ↓ delegates to
┌─────────────────────────────────────────┐
│  AIResourceOrchestrator                 │ ← Application Layer
│  Dependencies: utilities, config        │
└─────────────────────────────────────────┘
              ↓ uses
┌─────────────────────────────────────────┐
│  Text Utilities (countWords, trim)      │ ← Domain/Infrastructure
│  Dependencies: none (pure functions)    │
└─────────────────────────────────────────┘
```

### Domain Separation
- **Frontend Domain**: User awareness and education (word counter)
- **Backend Domain**: Resource management and cost control (trimming)
- **Clear Boundary**: UI handles user choice, backend handles limits

## Open Questions

- None at this time

## Blockers

- None identified

## Next Steps

1. ✅ Create feature branch: `sprint/epic-context-window-safety-2025-11-02-01-trim-limits`
2. ⏳ Phase 1: Add configuration setting and utilities
3. ⏳ Phase 2: Backend trimming logic
4. ⏳ Phase 3: UI word counter components
5. ⏳ Phase 4: Testing and verification
6. ⏳ Create PR with links to ADR and sprint doc
7. ⏳ Merge to main after review

## Success Metrics

- Zero "token limit exceeded" errors for typical users
- Feature is invisible (defaults just work)
- Power users can easily disable
- Output Channel provides transparency
- No unexpected API cost complaints

## Notes for Future Sessions

### If Resuming This Work
1. Check branch: `sprint/epic-context-window-safety-2025-11-02-01-trim-limits`
2. Review sprint task checklist in sprint document
3. Continue from current phase (check todos)
4. Follow architectural principles from review
5. Test thoroughly before PR

### Common Pitfalls to Avoid
1. ❌ Don't block user input (word counter is informational only)
2. ❌ Don't trim excerpt in backend (UI counter handles user awareness)
3. ❌ Don't show popup warnings (silent operation via Output Channel)
4. ❌ Don't use token counting (word counting sufficient for v1.0)
5. ❌ Don't violate layer boundaries (word counter ≠ trimming logic)

### Testing Checklist Reference
- UI word counter appears on all tabs (Analysis, Context, Dictionary)
- Real-time updates as user types
- Color coding works (green/yellow/red)
- Setting appears in Settings overlay with correct default (`true`)
- Context Agent trims to 50K words when enabled
- Analysis Agents trim to 75K words with prioritization
- Output Channel shows trim logs
- Toggle setting off → no trimming applied
- Edge cases: empty text, single word, extremely large inputs

---

**Session End State**: Documentation complete, ready to implement
**Last Updated**: 2025-11-02
**Next Session**: Implementation (Phase 1: Configuration & Utilities)
