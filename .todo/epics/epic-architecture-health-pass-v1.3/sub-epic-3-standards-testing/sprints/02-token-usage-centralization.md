# Sprint 02: Token Usage Centralization

**Status**: ✅ Complete
**Completed**: 2025-11-29
**Duration**: ~2 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub3-02-token-usage-centralization`
**Commit**: e7541fb

---

## Problem

Token tracking duplicated across 10+ services and handlers.

---

## Tasks

1. **AIResourceOrchestrator emits token usage** ✅
   - Added `TokenUsageCallback` type
   - Added `tokenUsageCallback` to constructor
   - Added `setTokenUsageCallback()` method
   - Added `emitTokenUsage()` helper called after each API response
   - All 3 execution methods emit token usage automatically

2. **Wire callback through AIResourceManager** ✅
   - Added `tokenUsageCallback` field
   - Added `setTokenUsageCallback()` that propagates to all orchestrators
   - Updated `dispose()` to clear callback

3. **Wire callback from MessageHandler** ✅
   - Added `aiResourceManager.setTokenUsageCallback()` in constructor
   - Callback calls existing `this.applyTokenUsage()`

4. **Remove token extraction from handlers** ✅
   - AnalysisHandler: removed `applyTokenUsageCallback` and extraction code
   - DictionaryHandler: removed `applyTokenUsageCallback` and extraction code
   - ContextHandler: removed `applyTokenUsageCallback` and extraction code
   - SearchHandler: removed `applyTokenUsageCallback` and extraction code
   - Updated all handler tests

---

## Outcomes

### Files Changed (10)

- `src/application/services/AIResourceOrchestrator.ts` - Added callback pattern
- `src/infrastructure/api/services/resources/AIResourceManager.ts` - Propagates callback
- `src/application/handlers/MessageHandler.ts` - Wires callback, removes handler params
- `src/application/handlers/domain/AnalysisHandler.ts` - Simplified
- `src/application/handlers/domain/DictionaryHandler.ts` - Simplified
- `src/application/handlers/domain/ContextHandler.ts` - Simplified
- `src/application/handlers/domain/SearchHandler.ts` - Simplified
- 3 test files updated

### Metrics

- Lines: +106, -104 (net +2)
- Tests: 259/259 passing
- Handlers simplified: 4 handlers (removed ~20 lines each)
- Double-counting eliminated: ✅

---

## Acceptance Criteria

- ✅ AIResourceOrchestrator emits TOKEN_USAGE automatically via callback
- ⏭️ Services still return `usage` field (informational, not used for tracking)
- ✅ All handlers simplified (no token extraction)
- ✅ Frontend token tracking still works
- ✅ Single source of truth for token parsing (AIResourceOrchestrator)
- ✅ All 259 tests pass

**Note**: Services still return `usage` in results for backward compatibility and debugging purposes. The critical goal (single source of truth, no double-counting) has been achieved.

---

**Created**: 2025-11-29
**Completed**: 2025-11-29
