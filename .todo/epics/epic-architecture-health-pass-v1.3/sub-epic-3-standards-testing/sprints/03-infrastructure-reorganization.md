# Sprint 03: Infrastructure Reorganization

**Status**: 🟡 Ready to Start
**Priority**: MEDIUM
**Estimated Duration**: 2-3 hours
**Branch**: `sprint/epic-ahp-v1.3-sub3-03-infrastructure-reorg`

---

## Problem

AIResourceManager (infrastructure) imports from application layer, violating Clean Architecture's dependency rule. This reveals a deeper issue: the "AI Gateway" layer (AIRO, ARM, ConversationManager) is scattered across application and infrastructure.

See: [Architecture Debt: AIResourceManager Layer Violation](../../../../architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)

---

## Goal

Reorganize `src/infrastructure/api/` into a clean four-tier structure:

```plaintext
src/infrastructure/api/
├── providers/          # External API clients (OpenRouter)
├── orchestration/      # AI Gateway layer (AIRO, ARM, CM)
├── parsers/            # Request/response parsing
└── services/           # Domain services (analysis, dictionary, etc.)
```

---

## Tasks

### 1. Create Directory Structure

- [ ] Create `src/infrastructure/api/providers/`
- [ ] Create `src/infrastructure/api/orchestration/`
- [ ] Create `src/infrastructure/api/parsers/`

### 2. Move Provider Files (git mv)

- [ ] `OpenRouterClient.ts` → `providers/OpenRouterClient.ts`
- [ ] `OpenRouterModels.ts` → `providers/OpenRouterModels.ts`

### 3. Move Orchestration Files (git mv)

- [ ] `application/services/AIResourceOrchestrator.ts` → `orchestration/AIResourceOrchestrator.ts`
- [ ] `application/services/ConversationManager.ts` → `orchestration/ConversationManager.ts`
- [ ] `api/services/resources/AIResourceManager.ts` → `orchestration/AIResourceManager.ts`
- [ ] `api/services/resources/ResourceLoaderService.ts` → `orchestration/ResourceLoaderService.ts`

### 4. Move Parser Files (git mv)

- [ ] `application/utils/ResourceRequestParser.ts` → `parsers/ResourceRequestParser.ts`
- [ ] Check for `ContextResourceRequestParser.ts` and move if exists

### 5. Update Path Aliases

- [ ] Add to `tsconfig.json`:
  - `@providers/*` → `src/infrastructure/api/providers/*`
  - `@orchestration/*` → `src/infrastructure/api/orchestration/*`
  - `@parsers/*` → `src/infrastructure/api/parsers/*`
- [ ] Update `webpack.config.js` with same aliases
- [ ] Update `jest.config.js` moduleNameMapper

### 6. Update Imports Throughout Codebase

- [ ] `MessageHandler.ts` - update AIRO/ARM imports
- [ ] `extension.ts` - update composition root
- [ ] All domain services - update orchestration imports
- [ ] Test files - update import paths

### 7. Cleanup

- [ ] Remove empty directories (`application/services/`, `api/services/resources/`)
- [ ] Run `npm run compile` to verify no TypeScript errors
- [ ] Run `npm test` to verify all 259 tests pass

---

## Acceptance Criteria

- [ ] All files moved to new locations with git history preserved
- [ ] No TypeScript compilation errors
- [ ] All 259 tests pass
- [ ] Clean dependency flow: `services/ → orchestration/ → providers/`
- [ ] No application → infrastructure imports remain

---

## Files Affected

### Files to Move (7)

| From | To |
|------|-----|
| `src/infrastructure/api/OpenRouterClient.ts` | `providers/` |
| `src/infrastructure/api/OpenRouterModels.ts` | `providers/` |
| `src/application/services/AIResourceOrchestrator.ts` | `orchestration/` |
| `src/application/services/ConversationManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/AIResourceManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/ResourceLoaderService.ts` | `orchestration/` |
| `src/application/utils/ResourceRequestParser.ts` | `parsers/` |

### Config Files to Update (3)

- `tsconfig.json`
- `webpack.config.js`
- `jest.config.js`

### Import Updates (estimated 15-20 files)

- `MessageHandler.ts`
- `extension.ts`
- All domain services in `services/`
- Test files for moved components

---

## Risk Assessment

**Risk**: Low-Medium

- File moves are straightforward with `git mv`
- Import updates are mechanical (find/replace)
- Tests will catch any broken imports immediately
- No behavioral changes - purely structural

**Mitigation**:
- Run tests after each major move
- Commit incrementally
- Keep old empty directories until end (cleanup last)

---

## References

- [Architecture Debt: Layer Violation](../../../../architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)
- [Sprint 02: Token Usage Centralization](02-token-usage-centralization.md) (where this was identified)
- Clean Architecture by Robert C. Martin

---

**Created**: 2025-11-29
