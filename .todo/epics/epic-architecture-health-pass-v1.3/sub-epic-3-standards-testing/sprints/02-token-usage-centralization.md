# Sprint 02: Token Usage Centralization

**Status**: ⏸️ Pending (Blocked on Sprint 01)
**Estimated Time**: 3-4 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub3-02-token-usage-centralization`

---

## Problem

Token tracking duplicated across 10+ services and handlers.

---

## Tasks

1. **AIResourceOrchestrator emits token messages** (1-2 hrs)
   - Add `postMessageCallback` to constructor
   - Emit `TOKEN_USAGE` messages in all 3 execution methods
   - Add `calculateCost()` helper

2. **Wire message callback through MessageHandler** (30 min)
   - Pass `this.postMessage` to AIResourceOrchestrator

3. **Remove token tracking from services** (1 hr)
   - Remove `usage?` field from all service result interfaces
   - Remove token tracking logic from 4+ services

4. **Remove token extraction from handlers** (1 hr)
   - Remove `applyTokenUsage()` calls from 5+ handlers
   - Handlers just use domain data

---

## Acceptance Criteria

- ✅ AIResourceOrchestrator emits TOKEN_USAGE automatically
- ✅ All services return only domain data (no `usage` field)
- ✅ All handlers simplified (no token extraction)
- ✅ Frontend token tracking still works
- ✅ Single source of truth for token parsing
- ✅ Tests pass

---

**Created**: 2025-11-29
