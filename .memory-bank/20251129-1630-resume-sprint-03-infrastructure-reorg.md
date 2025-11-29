# Resume Sprint 03: Infrastructure Reorganization

**Date**: 2025-11-29 16:30
**Epic**: Architecture Health Pass v1.3
**Sub-Epic**: 3 - Standards & Testing
**Sprint**: 03 - Infrastructure Reorganization
**Branch**: `sprint/epic-ahp-v1.3-sub3-03-infrastructure-reorg`
**Session**: Sprint Resume

---

## Resume Context

**Why Resuming**: Continuing Architecture Health Pass. Sprint 02 (Token Usage Centralization) completed earlier today (PR #41).

**Current State**:
- **Epic Progress**: 10/17 Sprints (59%)
- **Sub-Epic 3 Progress**: 2/6 Sprints (33%)
- **Last Completed**: Sprint 02 (Token Usage Centralization, PR #41)
- **Last Commit**: c916f66 (memory bank entry for Sprint 02 completion)
- **Test Status**: 259/259 passing

---

## Sprint 03: Infrastructure Reorganization

**Problem**: AIResourceManager (infrastructure) imports from application layer, violating Clean Architecture's dependency rule.

**Solution**: Create clean four-tier structure under `src/infrastructure/api/`:

```plaintext
src/infrastructure/api/
├── providers/          # External API clients (OpenRouter)
├── orchestration/      # AI Gateway layer (AIRO, ARM, CM)
├── parsers/            # Request/response parsing
└── services/           # Domain services (unchanged)
```

---

## Tasks

1. [ ] Create directory structure (`providers/`, `orchestration/`, `parsers/`)
2. [ ] Move provider files (OpenRouterClient, OpenRouterModels)
3. [ ] Move orchestration files (AIRO, ARM, CM, ResourceLoaderService)
4. [ ] Move parser files (ResourceRequestParser)
5. [ ] Update path aliases (tsconfig, webpack, jest)
6. [ ] Update imports throughout codebase (~15-20 files)
7. [ ] Remove empty directories and verify tests pass

---

## Files to Move (7)

| From | To |
|------|-----|
| `src/infrastructure/api/OpenRouterClient.ts` | `providers/` |
| `src/infrastructure/api/OpenRouterModels.ts` | `providers/` |
| `src/application/services/AIResourceOrchestrator.ts` | `orchestration/` |
| `src/application/services/ConversationManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/AIResourceManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/ResourceLoaderService.ts` | `orchestration/` |
| `src/application/utils/ResourceRequestParser.ts` | `parsers/` |

---

## References

- **Sprint Doc**: [03-infrastructure-reorganization.md](.todo/epics/epic-architecture-health-pass-v1.3/sub-epic-3-standards-testing/sprints/03-infrastructure-reorganization.md)
- **Architecture Debt**: [2025-11-29-airesourcemanager-layer-violation.md](.todo/architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)
- **Epic Doc**: [epic-standards-testing.md](.todo/epics/epic-architecture-health-pass-v1.3/sub-epic-3-standards-testing/epic-standards-testing.md)

---

**Session Started**: 2025-11-29 16:30
**Branch**: `sprint/epic-ahp-v1.3-sub3-03-infrastructure-reorg`
**Status**: Ready to begin Sprint 03
