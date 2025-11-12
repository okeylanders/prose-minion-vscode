# Epic: ProseAnalysisService Domain Services Refactor

**Status**: Approved - Ready to Implement
**Created**: 2025-11-11
**ADR**: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](../../docs/adr/2025-11-11-prose-analysis-service-refactor.md)
**Branch**: `adr/prose-analysis-service-refactor-2025-11-11`
**Epic Owner**: Claude (AI Assistant) + User

---

## Overview

Refactor ProseAnalysisService (916 lines, 9+ responsibilities) into **11 focused domain services** with handlers orchestrating use cases directly. This eliminates the last remaining god component in the codebase and achieves Clean Architecture (10/10 score).

**Key Architectural Decision**: **No facade pattern**. Handlers inject services directly and own use case orchestration. This keeps orchestration in the application layer (where it belongs) instead of hiding it in infrastructure facades.

---

## Goals

### Primary Goals

1. **Eliminate Last God Component**
   - ProseAnalysisService: 916 lines → **DELETED**
   - Break into 11 focused services (~80-300 lines each)

2. **Achieve Clean Architecture**
   - Handlers orchestrate use cases (application layer)
   - Services provide focused capabilities (infrastructure layer)
   - No false abstractions (facades with no orchestration value)

3. **Enable Context Search Feature**
   - Clean extension point for ContextSearchService
   - Semantic matching infrastructure ready

4. **Maintain Consistency**
   - All handlers depend on services (not tools directly)
   - Symmetric architecture (mirrors frontend hooks, backend handlers)

### Success Criteria

- [ ] ProseAnalysisService.ts deleted
- [ ] IProseAnalysisService interface removed
- [ ] 11 focused services created (< 300 lines each)
- [ ] All handlers inject services directly
- [ ] Orchestration logic in handlers (application layer)
- [ ] All existing functionality preserved
- [ ] Manual tests pass
- [ ] Architecture documentation updated
- [ ] Ready for Context Search implementation

---

## Scope

### In Scope

**Services to Create** (11 total):
1. AssistantToolService - Wraps dialogue + prose assistants
2. ContextAssistantService - Wraps context assistant
3. DictionaryService - Wraps dictionary utility
4. ProseStatsService - Wraps PassageProseStats
5. StyleFlagsService - Wraps StyleFlags
6. WordFrequencyService - Wraps WordFrequency
7. WordSearchService - Word search logic + helpers
8. AIResourceManager - OpenRouter + orchestrator lifecycle
9. ResourceLoaderService - Prompts, guides, registry
10. StandardsService - Publishing standards comparison
11. ToolOptionsProvider - Configuration helper

**Files to Delete**:
- `src/infrastructure/api/ProseAnalysisService.ts` (916 lines)
- `src/domain/services/IProseAnalysisService.ts` (interface)

**Handlers to Update** (inject services directly):
- AnalysisHandler
- MetricsHandler (orchestrates ProseStats use case)
- DictionaryHandler
- ContextHandler
- SearchHandler

**Documentation**:
- ARCHITECTURE.md (service organization)
- JSDoc comments (all services)

### Out of Scope

- ❌ Context Search implementation (separate epic)
- ❌ Automated test suite (deferred to Phase 7 if needed)
- ❌ Performance optimization (no performance issues expected)
- ❌ Additional features (focus on refactor only)

---

## Architecture

### Before

```
ProseAnalysisService (916 lines, 9+ responsibilities)
  - AI tool lifecycle
  - Measurement tool management
  - AI resource orchestration
  - Configuration management
  - Resource loading
  - Analysis methods
  - Metrics methods
  - Word search
  - Publishing standards
```

### After

```
Application Layer (Handlers)
  ↓ orchestrates
Infrastructure Services (11 focused services)
  ↓ wrap
Tools (DialogueMicrobeatAssistant, PassageProseStats, etc.)
```

**Key Pattern**: Handlers own orchestration. Services provide capabilities.

---

## Migration Strategy

### 6 Phases (12-17 hours total)

| Phase | Description | Risk | Effort | Sprint |
|-------|-------------|------|--------|--------|
| 1 | Extract Resource Services | Low | 2-3h | [01](sprints/01-extract-resource-services.md) |
| 2 | Create Measurement Service Wrappers | Low | 1-2h | [02](sprints/02-create-measurement-service-wrappers.md) |
| 3 | Extract Analysis Services | Medium | 2-3h | [03](sprints/03-extract-analysis-services.md) |
| 4 | Extract Search Service | Medium | 2-3h | [04](sprints/04-extract-search-service.md) |
| 5 | Update Handlers, Delete Facade | Medium | 3-4h | [05](sprints/05-update-handlers-delete-facade.md) |
| 6 | Documentation and Cleanup | Low | 1-2h | [06](sprints/06-documentation-and-cleanup.md) |

**Testing**: Manual testing after each phase using checklist in ADR

---

## Anti-Patterns to Avoid

### 1. God Service → Multiple God Services
- **Mitigation**: Line count caps (< 300 lines), single responsibility review

### 2. Handlers Become God Components
- **Mitigation**: If handler > 200 lines, extract orchestration to service
- **Watch**: MetricsHandler (orchestrates ProseStats use case)

### 3. Circular Dependencies
- **Mitigation**: Strict dependency graph (flows inward only)

### 4. Shared Mutable State
- **Mitigation**: AIResourceManager owns all AI resource lifecycle

### 5. Leaky Abstractions
- **Mitigation**: Clear public interfaces (3-5 methods max)

---

## Success Metrics

| Metric | Before | Target | Impact |
|--------|--------|--------|--------|
| God components | 1 | 0 | Last architectural debt eliminated |
| Service count | 1 monolith | 11 focused | Domain-organized |
| ProseAnalysisService | 916 lines | **DELETED** | Eliminated entirely |
| Largest service | 916 lines | < 300 lines | All focused |
| Orchestration location | Mixed | Handlers only | Application layer |
| Architecture score | Inconsistent | **10/10** | Clean Architecture achieved |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing functionality | Medium | High | Test after each phase, manual checklist |
| Handlers become god components | Low | Medium | Line count caps, orchestration review |
| Circular dependencies | Low | Medium | Strict dependency graph, code review |
| Migration takes longer than estimated | Medium | Low | Phased approach, can pause between phases |

---

## Dependencies

### Blockers
- None (ready to begin)

### Blocked By This Epic
- Context Search implementation (intentionally deferred)
- Additional semantic analysis tools

---

## Timeline

**Start Date**: 2025-11-12 (next session)
**Estimated Completion**: 2025-11-13 to 2025-11-15 (depending on pace)
**Total Effort**: 12-17 hours

**Pacing**:
- Phase 1-2: Day 1 (3-5 hours)
- Phase 3-4: Day 2 (4-6 hours)
- Phase 5-6: Day 3 (4-6 hours)

---

## Sprints

1. [Sprint 01: Extract Resource Services](sprints/01-extract-resource-services.md) - 2-3 hours
2. [Sprint 02: Create Measurement Service Wrappers](sprints/02-create-measurement-service-wrappers.md) - 1-2 hours
3. [Sprint 03: Extract Analysis Services](sprints/03-extract-analysis-services.md) - 2-3 hours
4. [Sprint 04: Extract Search Service](sprints/04-extract-search-service.md) - 2-3 hours
5. [Sprint 05: Update Handlers, Delete Facade](sprints/05-update-handlers-delete-facade.md) - 3-4 hours
6. [Sprint 06: Documentation and Cleanup](sprints/06-documentation-and-cleanup.md) - 1-2 hours

---

## References

### ADR
- [ProseAnalysisService Domain Services Architecture](../../docs/adr/2025-11-11-prose-analysis-service-refactor.md)

### Related ADRs
- [ADR-2025-10-26: Message Architecture Organization](../../docs/adr/2025-10-26-message-architecture-organization.md) - MessageHandler refactor
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md) - App.tsx refactor

### Memory Bank
- [ADR Draft Session](../../.memory-bank/20251111-1430-prose-analysis-service-refactor-adr-draft.md)
- [Measurement Facade Decision](../../.memory-bank/20251111-1545-measurement-facade-decision.md)
- [ADR Approved Session](../../.memory-bank/20251111-1600-prose-analysis-service-refactor-adr-approved.md)

### Architecture Docs
- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- [CLAUDE.md](../../.ai/central-agent-setup.md)

---

## Notes

### Why No Facade?

After analysis, we determined that 7 out of 8 methods in the proposed facade would be pure delegation with no orchestration value. The one method with real orchestration (`measureProseStats`) belongs in the application layer (MetricsHandler), not in an infrastructure facade.

**Clean Architecture principle**: Orchestration logic belongs in the application layer (handlers), not the infrastructure layer (services).

### Why Measurement Service Wrappers?

For **consistency and architectural symmetry**:
- Analysis tools are wrapped (AssistantToolService, ContextAssistantService, DictionaryService)
- Measurement tools should also be wrapped
- All handlers depend on services (not tools directly)
- Provides clean extension points and consistent abstraction level

**Key distinction**: Wrappers are service → tool (infrastructure abstraction). Facade would be handler → service (unnecessary indirection).

---

**Created**: 2025-11-11
**Status**: Approved - Ready to Implement
**Next**: Sprint 01 - Extract Resource Services
