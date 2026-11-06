# ProseAnalysisService Refactor - ADR Approved

**Date**: November 11, 2025, 4:00 PM
**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Status**: ADR Approved, Epic and Sprints Created, Ready to Implement
**Participants**: User + Claude

---

## Session Summary

Completed ADR iteration and approval for the **final god component refactor** in the codebase: ProseAnalysisService (916 lines, 9+ responsibilities). This represents the last major architectural debt.

### Major Decision: No Facade Pattern

Through collaborative iteration, we decided to **remove the ProseAnalysisService facade pattern** and have handlers inject services directly. This was a significant pivot from the original proposal.

**Original Proposal**: ProseAnalysisService facade with 10 services underneath
**Final Decision**: 11 focused services, handlers orchestrate directly, **no facade**

---

## Key Architectural Decision

**Question Raised by User**:
> "Do we need the ProseAnalysisService as a facade instead of just direct connections to the underlying providers?"

**Analysis Result**:
- 7 out of 8 methods would be pure delegation (no orchestration value)
- Only `measureProseStats` has real orchestration (stats → aggregation → enrichment)
- **Orchestration belongs in application layer (handlers), not infrastructure layer**

**Decision**: Remove facade, handlers orchestrate use cases directly.

---

## Revised Architecture

### Services Created (11 Total)

**Analysis Services** (wrap AI tools):
1. AssistantToolService (~120-150 lines) - Wraps DialogueMicrobeatAssistant + ProseAssistant
2. ContextAssistantService (~100-120 lines) - Wraps ContextAssistant
3. DictionaryService (~80-100 lines) - Wraps DictionaryUtility

**Measurement Services** (wrap measurement tools - added for consistency):
4. ProseStatsService (~80-100 lines) - Wraps PassageProseStats
5. StyleFlagsService (~60-80 lines) - Wraps StyleFlags
6. WordFrequencyService (~80-100 lines) - Wraps WordFrequency

**Search Service**:
7. WordSearchService (~250-300 lines) - Word search logic + helpers

**Resource Services** (foundation):
8. AIResourceManager (~200-250 lines) - OpenRouter + orchestrator lifecycle
9. ResourceLoaderService (~100-120 lines) - Prompts, guides, registry
10. StandardsService (~120-150 lines) - Publishing standards comparison
11. ToolOptionsProvider (~60-80 lines) - Configuration helper

### What Gets Deleted

- ❌ ProseAnalysisService.ts (916 lines)
- ❌ IProseAnalysisService interface

### Handlers Orchestrate Directly

**Example**: MetricsHandler orchestrates ProseStats use case
```typescript
async handleProseStats(message: MessageEnvelope) {
  const stats = this.proseStatsService.analyze(text);

  if (multiFileMode) {
    const perFileStats = await this.standardsService.computePerFileStats(files, this.proseStatsService);
    Object.assign(stats, { chapterStats: perFileStats });
  }

  const enriched = await this.standardsService.enrichWithStandards(stats);
  this.panel.postMessage(result);
}
```

**Benefits**:
- ✅ Use case logic in application layer (correct architectural layer)
- ✅ Explicit orchestration (no hidden logic in facade)
- ✅ Easy to test (mock services)
- ✅ Follows Clean Architecture principles

---

## Why Add Measurement Service Wrappers?

**Question**: If we're rejecting the facade for YAGNI reasons, why add measurement service wrappers?

**Answer**: **Consistency and architectural symmetry**

- Analysis tools: Wrapped (AssistantToolService, ContextAssistantService, DictionaryService)
- Measurement tools: Should also be wrapped for consistency
- **Pattern**: All handlers depend on services, not tools directly
- **Benefits**: Clean extension points, symmetric architecture, consistent abstraction level

**Key Distinction**:
- Wrappers are **service → tool** (infrastructure abstraction) ✅
- Facade would be **handler → service** (application → infrastructure delegation) ❌

---

## Migration Strategy (6 Phases)

### Phase 1: Extract Resource Services (2-3 hours)
- ResourceLoaderService
- ToolOptionsProvider
- AIResourceManager
- StandardsService

### Phase 2: Create Measurement Service Wrappers (1-2 hours)
- ProseStatsService
- StyleFlagsService
- WordFrequencyService

### Phase 3: Extract Analysis Services (2-3 hours)
- AssistantToolService
- DictionaryService
- ContextAssistantService

### Phase 4: Extract Search Service (2-3 hours)
- WordSearchService

### Phase 5: Update Handlers, Delete Facade (3-4 hours)
- Update all handlers to inject services directly
- **Delete ProseAnalysisService.ts**
- **Delete IProseAnalysisService interface**
- MetricsHandler orchestrates ProseStats use case

### Phase 6: Documentation and Cleanup (1-2 hours)
- Update ARCHITECTURE.md
- Add JSDoc comments
- Verify dependency graph
- Comprehensive regression testing

**Total Effort**: 12-17 hours (vs. 9-14 hours in original estimate, but cleaner architecture)

---

## Success Metrics

| Metric | Before | Target | Impact |
|--------|--------|--------|--------|
| God components | 1 | 0 | ✅ Last architectural debt eliminated |
| Service count | 1 monolith | 11 focused services | ✅ Domain-organized |
| ProseAnalysisService | 916 lines | **DELETED** | ✅ Eliminated entirely |
| Largest service | 916 lines | < 300 lines | ✅ All focused |
| Orchestration location | Mixed | Handlers only | ✅ Application layer |
| Architecture score | Inconsistent | **10/10** | ✅ Clean Architecture |

---

## Architecture Score: 10/10 🏆

**Why 10/10**:
1. ✅ Application layer orchestrates use cases (handlers)
2. ✅ Infrastructure services provide focused capabilities
3. ✅ No false abstractions (facades with no orchestration value)
4. ✅ Symmetric with frontend (hooks) and backend (handlers)
5. ✅ Consistent patterns (all services wrap tools)
6. ✅ SOLID principles followed throughout
7. ✅ Clean Architecture dependency flow (inward only)
8. ✅ Single responsibility per service
9. ✅ Explicit dependencies (no hidden coupling)
10. ✅ Last god component eliminated

---

## Key Lessons Learned

### 1. Question Every Facade

Don't assume facades provide value. Analyze orchestration needs first:
- **Pure delegation** → No facade needed
- **Real orchestration** → Ask: does it belong in application layer?

### 2. YAGNI with Nuance

Applied YAGNI twice, but differently:
- ❌ **No MeasurementToolService facade** - No orchestration, pure delegation
- ✅ **Yes to measurement service wrappers** - Consistency and symmetry matter

**The difference**: Wrappers provide architectural consistency. Facades (in this case) would add unnecessary indirection.

### 3. Clean Architecture Matters

Orchestration in the wrong layer is a red flag:
- ❌ Infrastructure layer orchestrating use cases → Wrong layer
- ✅ Application layer orchestrating use cases → Correct layer

### 4. Iterate on ADRs Before Coding

We iterated on the ADR **three times**:
1. **Morning session**: Initial draft with facade pattern
2. **Afternoon session 1**: Decided against MeasurementToolService facade (YAGNI)
3. **Afternoon session 2**: Questioned entire facade pattern, removed it

**Result**: Discovered the optimal architecture **before writing code**, saving 3-5 hours of refactoring.

---

## What We Accomplished Today

1. ✅ Analyzed ProseAnalysisService god component (916 lines, 9+ responsibilities)
2. ✅ Decided to refactor before adding Context Search feature
3. ✅ Created comprehensive ADR with three iterations:
   - Draft 1: Facade pattern with 10 services
   - Draft 2: No MeasurementToolService facade (YAGNI)
   - Draft 3: No ProseAnalysisService facade (Clean Architecture)
4. ✅ Documented decision rationale in Appendix A
5. ✅ Created git branch: `adr/prose-analysis-service-refactor-2025-11-11`
6. ✅ ADR approved by user
7. ✅ Epic and sprints created (6 phases)
8. ✅ Ready to begin implementation

---

## What We Did NOT Do Yet

- ❌ Begin Phase 1 implementation (scheduled for next session)
- ❌ Create service files
- ❌ Update handlers
- ❌ Delete ProseAnalysisService.ts

---

## State of Repository

**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`

**Files Created/Modified**:
- `docs/adr/2025-11-11-prose-analysis-service-refactor.md` (NEW - comprehensive ADR, 1075 lines)
- `.memory-bank/20251111-1430-prose-analysis-service-refactor-adr-draft.md` (NEW - draft session)
- `.memory-bank/20251111-1545-measurement-facade-decision.md` (NEW - facade analysis)
- `.memory-bank/20251111-1600-prose-analysis-service-refactor-adr-approved.md` (NEW - this file)
- `.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/` (NEW - epic and sprints)

**Commits**:
- Ready to commit: ADR + memory bank entries
- Ready to commit: Epic and sprints

**Main Branch**: Clean, no changes
**Working Directory**: Ready to commit on feature branch

---

## References

### ADR
- [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../docs/adr/2025-11-11-prose-analysis-service-refactor.md)

### Related ADRs
- [ADR-2025-10-26: Message Architecture Organization](../docs/adr/2025-10-26-message-architecture-organization.md) - MessageHandler refactor (1091→495 lines)
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) - App.tsx refactor (697→394 lines)

### Previous Memory Bank Entries
- [20251111-1430-prose-analysis-service-refactor-adr-draft.md](./20251111-1430-prose-analysis-service-refactor-adr-draft.md)
- [20251111-1545-measurement-facade-decision.md](./20251111-1545-measurement-facade-decision.md)

### Epic
- [.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/](../.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/)

### Architecture Guidance
- [CLAUDE.md](../.ai/central-agent-setup.md) - Anti-pattern guardrails, development flow

---

## Next Session: Phase 1 Implementation

**Branch**: `sprint/epic-prose-analysis-service-refactor-2025-11-11-01-resource-services`

**Tasks**:
1. Create `ResourceLoaderService` (prompts, guides, registry)
2. Create `ToolOptionsProvider` (configuration helper)
3. Create `AIResourceManager` (OpenRouter + orchestrator lifecycle)
4. Create `StandardsService` (publishing standards)
5. Update ProseAnalysisService to use these services (temporary)
6. Test all existing functionality

**Estimated Effort**: 2-3 hours

**Acceptance Criteria**:
- All tests pass
- Extension loads without errors
- ProseAnalysisService line count reduced ~200 lines

---

## Context Search Feature

**Status**: Blocked by this refactor (intentionally)

**Why We're Refactoring First**:
- Adding Context Search to current god component would add ~150 lines to 916-line file
- Refactoring first provides clean extension point in WordSearchService
- Token budget savings: 3-5 hours (refactor now vs. untangle later)

**After Refactor**:
- Context Search will be added as `ContextSearchService` (sibling to WordSearchService)
- Clean architecture enables semantic matching features
- Handlers can orchestrate hybrid search (deterministic + semantic)

---

## Mood and Confidence

**Mood**: Excited and confident! 🚀

**Why**:
- ✅ We iterated on the architecture **before** coding
- ✅ Discovered optimal design through questioning assumptions
- ✅ User collaboration led to better architecture (no facade!)
- ✅ This is the **last major architectural debt** - huge milestone
- ✅ Proven refactor pattern (MessageHandler, App.tsx both successful)
- ✅ Architecture score: **10/10** (best in codebase)

**Concerns**:
- Migration risk (916 lines is substantial)
- Handler orchestration complexity (must avoid bloat)
- Time estimate increased slightly (12-17 hours vs. 9-14)

**Mitigations**:
- ✅ Phased approach with testing after each phase
- ✅ Line count caps for handlers (< 200 lines)
- ✅ Manual testing checklist
- ✅ Alpha development freedom (can break things)
- ✅ Proven pattern from previous refactors

---

## Quick Start for Next Session

1. Checkout branch: `adr/prose-analysis-service-refactor-2025-11-11`
2. Review ADR: `docs/adr/2025-11-11-prose-analysis-service-refactor.md`
3. Review Sprint 01: `.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/sprints/01-extract-resource-services.md`
4. Create sprint branch: `sprint/epic-prose-analysis-service-refactor-2025-11-11-01-resource-services`
5. Begin Phase 1 implementation

**First Service to Create**: `ResourceLoaderService`

---

**Session End**: November 11, 2025, 4:00 PM
**Status**: ADR Approved ✅ | Epic Created ✅ | Ready to Implement 🚀
**Next Session**: Phase 1 - Extract Resource Services
