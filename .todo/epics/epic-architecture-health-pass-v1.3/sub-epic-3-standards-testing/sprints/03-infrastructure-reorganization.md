# Sprint 03: Infrastructure Reorganization

**Status**: ✅ Complete (2025-11-29)
**Priority**: MEDIUM
**Duration**: ~1.5 hours
**Branch**: `sprint/epic-ahp-v1.3-sub3-03-infrastructure-reorg`
**Commit**: `55838b9`

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

- [x] Create `src/infrastructure/api/providers/`
- [x] Create `src/infrastructure/api/orchestration/`
- [x] Create `src/infrastructure/api/parsers/`

### 2. Move Provider Files (git mv)

- [x] `OpenRouterClient.ts` → `providers/OpenRouterClient.ts`
- [x] `OpenRouterModels.ts` → `providers/OpenRouterModels.ts`

### 3. Move Orchestration Files (git mv)

- [x] `application/services/AIResourceOrchestrator.ts` → `orchestration/AIResourceOrchestrator.ts`
- [x] `application/services/ConversationManager.ts` → `orchestration/ConversationManager.ts`
- [x] `api/services/resources/AIResourceManager.ts` → `orchestration/AIResourceManager.ts`
- [x] `api/services/resources/ResourceLoaderService.ts` → `orchestration/ResourceLoaderService.ts`

### 4. Move Parser Files (git mv)

- [x] `application/utils/ResourceRequestParser.ts` → `parsers/ResourceRequestParser.ts`
- [x] `application/utils/ContextResourceRequestParser.ts` → `parsers/ContextResourceRequestParser.ts`

### 5. Update Path Aliases

- [x] Add to `tsconfig.json`:
  - `@providers/*` → `src/infrastructure/api/providers/*`
  - `@orchestration/*` → `src/infrastructure/api/orchestration/*`
  - `@parsers/*` → `src/infrastructure/api/parsers/*`
- [x] Update `webpack.config.js` with same aliases
- [x] Update `jest.config.js` moduleNameMapper
- [x] Update `tsconfig.webview.json` with `@providers/*` alias

### 6. Update Imports Throughout Codebase

- [x] `MessageHandler.ts` - update ARM imports
- [x] `extension.ts` - update composition root
- [x] All domain services - update orchestration imports
- [x] Test files - update import paths
- [x] Tools layer - update AIRO imports
- [x] Webview components - update OpenRouterModels imports

### 7. Cleanup

- [x] Remove empty directory (`application/utils/`)
- [x] TypeScript type check passes
- [x] All 259 tests pass

---

## Acceptance Criteria

- [x] All files moved to new locations with git history preserved
- [x] No TypeScript compilation errors
- [x] All 259 tests pass
- [x] Clean dependency flow: `services/ → orchestration/ → providers/`
- [x] No application → infrastructure imports remain

---

## Files Affected

### Files Moved (8)

| From | To |
|------|-----|
| `src/infrastructure/api/OpenRouterClient.ts` | `providers/` |
| `src/infrastructure/api/OpenRouterModels.ts` | `providers/` |
| `src/application/services/AIResourceOrchestrator.ts` | `orchestration/` |
| `src/application/services/ConversationManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/AIResourceManager.ts` | `orchestration/` |
| `src/infrastructure/api/services/resources/ResourceLoaderService.ts` | `orchestration/` |
| `src/application/utils/ResourceRequestParser.ts` | `parsers/` |
| `src/application/utils/ContextResourceRequestParser.ts` | `parsers/` |

### Config Files Updated (4)

- `tsconfig.json`
- `tsconfig.webview.json`
- `webpack.config.js`
- `jest.config.js`

### Import Updates (29 files total)

Used parallel subagents to update imports across layers:
- Orchestration layer (internal imports)
- Domain services (4 files)
- Application layer (4 files)
- Tools layer (4 files)
- Test files (1 file)
- Webview layer (2 files)

---

## References

- [Architecture Debt: Layer Violation](../../../../architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)
- [Sprint 02: Token Usage Centralization](02-token-usage-centralization.md) (where this was identified)
- Clean Architecture by Robert C. Martin

---

**Created**: 2025-11-29
**Completed**: 2025-11-29
