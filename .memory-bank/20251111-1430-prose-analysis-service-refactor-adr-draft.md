# ProseAnalysisService Refactor - ADR Draft Session

**Date**: November 11, 2025, 2:30 PM
**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Status**: ADR Draft Complete, Awaiting Review
**Participants**: User + Claude

---

## Session Summary

Initiated planning for the **final god component refactor** in the codebase: ProseAnalysisService (916 lines, 9+ responsibilities).

### Context

User asked about implementing Context Search feature (semantic word matching using AI). Discussion revealed:

1. **ProseAnalysisService is a god component** - 916 lines, last remaining architectural debt
2. **App.tsx is clean** - Already refactored (697→394 lines, 9.8/10 architectural score)
3. **Two successful god component refactors completed**:
   - MessageHandler: 1091→495 lines (54% reduction)
   - App.tsx: 697→394 lines (43% reduction)

### Decision: Refactor First, Then Add Context Search

**Rationale**:
- Adding Context Search to current god component would add ~150 lines to already-bloated 916-line file
- Refactoring first provides clean extension point in SearchService
- Token budget savings: 3-5 hours (refactor now vs. untangle later)
- Alpha development freedom: No backward compatibility required
- Proven pattern exists: Successfully used for MessageHandler and App.tsx

---

## ADR Draft Completed

**Location**: `docs/adr/2025-11-11-prose-analysis-service-refactor.md`

### Proposed Architecture

**Target**: 916 lines → ~150-200 lines (83% reduction)

**Service Breakdown**:

1. **ProseAnalysisService** (Facade) - ~150-200 lines
   - Pure delegation, implements IProseAnalysisService
   - Orchestrates domain services
   - Zero business logic

2. **Domain Services** (7 services):
   - **AssistantToolService** (~120-150 lines) - Dialogue + Prose analysis
   - **ContextAssistantService** (~100-120 lines) - Context generation
   - **MeasurementToolService** (~150-180 lines) - Stats, Flags, Frequency
   - **WordSearchService** (~250-300 lines) - Word search + future Context Search sibling
   - **DictionaryService** (~80-100 lines) - Dictionary lookups
   - **StandardsService** (~120-150 lines) - Publishing standards

3. **Resource Services** (3 services):
   - **AIResourceManager** (~200-250 lines) - OpenRouter + orchestrator lifecycle (CRITICAL)
   - **ResourceLoaderService** (~100-120 lines) - Prompts, guides, registry
   - **ToolOptionsProvider** (~60-80 lines) - Configuration helper

### Anti-Patterns Addressed

Learned from previous refactors:

1. ❌ **God Service → Multiple God Services** - Mitigated via line count caps, single responsibility review
2. ❌ **Circular Dependencies** - Mitigated via strict dependency graph (flows inward only)
3. ❌ **Shared Mutable State** - Mitigated via AIResourceManager as single source of truth
4. ❌ **Leaky Abstractions** - Mitigated via clear public interfaces (3-5 methods max)
5. ❌ **Facade Becomes God Component** - Mitigated via delegation-only rule (3-5 lines per method)

### Migration Strategy

**6 Phases** (9-14 hours total):

1. **Phase 1**: Extract Resource Services (2-3 hrs) - Low risk
2. **Phase 2**: Extract Measurement Services (1-2 hrs) - Low risk
3. **Phase 3**: Extract Analysis Services (2-3 hrs) - Medium risk
4. **Phase 4**: Extract Search Services (2-3 hrs) - Medium risk
5. **Phase 5**: Extract Standards Service (1-2 hrs) - Low risk
6. **Phase 6**: Finalize Facade (1 hr) - Low risk

**Testing Strategy**: Manual testing after each phase, comprehensive regression checklist

### Success Metrics

| Metric | Before | Target | Success Criteria |
|--------|--------|--------|------------------|
| ProseAnalysisService lines | 916 | 150-200 | ✅ 83% reduction |
| Service responsibilities | 9+ | 1 per service | ✅ Single responsibility |
| Largest service file | 916 | < 300 | ✅ All focused |
| God components | 1 | 0 | ✅ Eliminated |
| Architecture consistency | Inconsistent | Mirrors backend | ✅ Domain organization |

---

## Key Architectural Decisions

### 1. Facade Pattern
ProseAnalysisService becomes a thin orchestrator that delegates to domain services. No business logic in facade.

### 2. Dependency Injection
Explicit constructor injection in extension.ts activation. No singletons, no service locator pattern.

### 3. Domain Organization
Services organized by domain (analysis, measurement, search, dictionary) to mirror backend handlers and frontend hooks.

### 4. Critical Service: AIResourceManager
Most complex service - manages entire AI resource lifecycle per model scope (assistant, dictionary, context). Must preserve exact behavior.

### 5. Extension Point for Context Search
WordSearchService provides clean sibling location for ContextSearchService (semantic matching).

---

## Open Questions for Review

### Service Boundary Questions

1. **MeasurementToolService**: Should it be a facade over Stats/Flags/Frequency, or should we use thin wrappers (ProseStatsService, etc.)?
   - **Current proposal**: Single facade service
   - **Alternative**: 3 separate services (more files, but cleaner SRP)

2. **WordSearchService**: 250-300 lines with helper functions - is that too large?
   - **Current proposal**: Acceptable since it's cohesive logic (deterministic search + helpers)
   - **Alternative**: Extract helpers to shared utility module

3. **AIResourceManager**: 200-250 lines - does responsibility breakdown look right?
   - Manages: Client lifecycle, orchestrator lifecycle, scope-based resources, model resolution
   - **Concern**: Could this become a mini god component?
   - **Mitigation**: Single responsibility is "AI resource lifecycle" - cohesive

### Dependency Graph Validation

Does the dependency graph flow cleanly inward?

```
ProseAnalysisService (Facade)
    ↓ depends on
Domain Services (Analysis, Measurement, Search, Dictionary)
    ↓ depends on
Resource Services (AIResourceManager, ResourceLoader, Standards, ToolOptions)
    ↓ depends on
Infrastructure (OpenRouterClient, VSCode API, File System)
```

**Question**: Any hidden circular dependencies?

### Migration Phase Order

Is the phase order optimal?
1. Resources first (foundation)
2. Measurement second (no AI dependencies)
3. Analysis third (AI dependencies)
4. Search fourth (heaviest method)
5. Standards fifth (enrichment)
6. Facade finalization last

**Alternative**: Could we parallelize any phases?

---

## Next Steps (For Tomorrow's Session)

### 1. Review ADR Against Anti-Pattern Checklist ✅
- [ ] God Service → Multiple God Services
- [ ] Circular Dependencies
- [ ] Shared Mutable State
- [ ] Leaky Abstractions
- [ ] Facade Becomes God Component

### 2. Validate Dependency Graph
- [ ] Draw full dependency diagram
- [ ] Verify no upward dependencies
- [ ] Verify no circular dependencies
- [ ] Validate AIResourceManager doesn't depend on domain services

### 3. Iterate on Service Boundaries (If Needed)
- [ ] Resolve MeasurementToolService question (facade vs. separate services)
- [ ] Confirm WordSearchService size is acceptable
- [ ] Validate AIResourceManager responsibility scope

### 4. Finalize ADR
- [ ] Mark as "Accepted" after review
- [ ] Address any identified issues
- [ ] Get final approval

### 5. Create Epic and Sprint Breakdown
- [ ] Create `.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/`
- [ ] Write epic overview
- [ ] Create 6 sprint documents (one per phase)
- [ ] Define acceptance criteria per sprint
- [ ] Assign time estimates

### 6. Implement Phase 1 (Resource Services)
- [ ] Create ResourceLoaderService
- [ ] Create ToolOptionsProvider
- [ ] Create AIResourceManager
- [ ] Update ProseAnalysisService to use these services
- [ ] Test all existing functionality

---

## Context for Resumption

### What We Accomplished Today

1. ✅ Analyzed ProseAnalysisService and confirmed it's a god component (916 lines, 9+ responsibilities)
2. ✅ Decided to refactor before adding Context Search feature
3. ✅ Created comprehensive ADR with:
   - Current state analysis (pain points, responsibilities)
   - Proposed architecture (10 services)
   - Anti-pattern mitigation strategies
   - 6-phase migration strategy
   - Success metrics
   - Open questions for review
4. ✅ Created git branch: `adr/prose-analysis-service-refactor-2025-11-11`
5. ✅ Documented session in memory bank

### What We Did NOT Do Yet

- ❌ Review ADR against anti-pattern checklist (scheduled for tomorrow)
- ❌ Validate dependency graph
- ❌ Resolve open questions (service boundaries, etc.)
- ❌ Create epic and sprint breakdown
- ❌ Begin implementation

### State of Repository

**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Files Modified**:
- `docs/adr/2025-11-11-prose-analysis-service-refactor.md` (NEW - ADR draft)
- `.memory-bank/20251111-1430-prose-analysis-service-refactor-adr-draft.md` (NEW - this file)

**Not Committed Yet** - Will commit before end of session

**Main Branch**: Clean, no changes
**Working Directory**: Clean on new branch

---

## References

### Related ADRs
- [ADR-2025-10-26: Message Architecture Organization](../docs/adr/2025-10-26-message-architecture-organization.md) - MessageHandler refactor template
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) - App.tsx refactor template

### Memory Bank
- [Presentation Layer Architectural Review](./../.memory-bank/20251102-1845-presentation-layer-architectural-review.md) - 9.8/10 score, proven pattern

### Related Specs
- [Context Search Requirements](./../.todo/search-module/2025-10-24-context-search-component.md) - Blocked by this refactor

### Architecture Guidance
- [CLAUDE.md](../.ai/central-agent-setup.md) - Anti-pattern guardrails, development flow

---

## Recommended Reading Before Tomorrow's Session

1. **ADR Draft**: `docs/adr/2025-11-11-prose-analysis-service-refactor.md`
   - Focus on: Service boundaries, dependency graph, anti-pattern mitigations

2. **Current ProseAnalysisService**: `src/infrastructure/api/ProseAnalysisService.ts`
   - Review: Lines 83-165 (initializeAITools), 372-494 (measureWordSearch), 511-577 (enrichWithStandards)

3. **Previous Refactor ADRs**:
   - MessageHandler refactor (template for backend service extraction)
   - Presentation Layer refactor (proven pattern, anti-patterns to avoid)

4. **Anti-Pattern Checklist**: `docs/adr/2025-11-11-prose-analysis-service-refactor.md` (Section: "Anti-Patterns to Avoid")

---

## Mood and Confidence

**Mood**: Excited and confident
**Reasoning**:
- We've successfully refactored 2 god components already (MessageHandler, App.tsx)
- Both scored 9.5-10/10 in architectural reviews
- Pattern is proven and repeatable
- This is the **last major architectural debt** - huge milestone
- Context Search will be so much cleaner to implement after this

**Concerns**:
- AIResourceManager complexity (manages entire AI lifecycle)
- Migration risk (916 lines is a lot to refactor safely)
- Time estimate (9-14 hours is significant)

**Mitigations**:
- Phased approach with testing after each phase
- Manual testing checklist
- Alpha development freedom (can break things)
- Proven pattern from previous refactors

---

## Quick Start for Tomorrow

1. Open branch: `adr/prose-analysis-service-refactor-2025-11-11`
2. Read ADR: `docs/adr/2025-11-11-prose-analysis-service-refactor.md`
3. Review anti-pattern checklist
4. Validate dependency graph
5. Resolve open questions
6. Iterate on ADR if needed
7. Create epic/sprint breakdown
8. Start Phase 1 implementation

**First Question to Answer Tomorrow**:
> "Does the dependency graph have any hidden circular dependencies or upward dependencies?"

**Second Question**:
> "Is MeasurementToolService a facade, or should we use separate services?"

---

**Session End**: November 11, 2025, 2:30 PM
**Status**: ADR Draft Complete ✅
**Next Session**: Review, iterate, create epic, begin implementation
