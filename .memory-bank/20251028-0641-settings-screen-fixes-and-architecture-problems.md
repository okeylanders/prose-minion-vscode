# Settings Screen Fixes & Architectural Problems Discovery

**Date**: 2025-10-28 06:41
**Branch**: `sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks`
**Status**: Settings screen partially working, but fundamental architectural issues identified

## Context

After presentation hooks refactor (domain hooks pattern), the settings screen was completely broken. Through debugging, we discovered this wasn't just bugs—it revealed fundamental architectural problems with the event-driven configuration system.

## What We Fixed (Partially)

### 1. Model Dropdowns Empty
**Bug**: Dropdowns showed no options
**Root Cause**: Message property mismatch after refactor
**Fix**: `useSettings.handleModelOptionsData` was looking for `message.modelOptions` but backend sends `message.options`

**File**: `src/presentation/webview/hooks/domain/useSettings.ts:144-147`

### 2. Settings Fields Reverting While Typing
**Bug**: Text inputs would reset to old values while typing
**Root Cause**: No optimistic state updates in `updateSetting`
**Fix**: Added immediate local state update before sending to backend

**File**: `src/presentation/webview/hooks/domain/useSettings.ts:159-176`

### 3. Model Selection Resetting to Random Values
**Bug**: Changing model dropdown would show wrong/random model
**Root Cause**: Multiple issues:
- Message property name: `model` → `modelId` mismatch
- Config watcher race condition (see below)

**Fix**: Changed `setModelSelection` to send `modelId` property
**File**: `src/presentation/webview/hooks/domain/useSettings.ts:200-219`

### 4. Removed Number Input Spinners
**Change**: Converted all `type="number"` inputs to `type="text"`
**Reason**: User request - number spinners are annoying
**Files**: `src/presentation/webview/components/SettingsOverlay.tsx` (8 inputs changed)

### 5. Config Watcher Race Conditions
**Bug**: Config changes triggered duplicate service refreshes and sent stale MODEL_DATA
**Root Cause**: Config watcher in MessageHandler would:
1. Fire immediately on config.update()
2. Read config BEFORE save completed (race condition)
3. Send MODEL_DATA with OLD values
4. Overwrite user's selection

**Attempted Fix**: Made config watcher "intelligent"
- Model changes: Only refresh service, DON'T send MODEL_DATA
- UI changes: Send MODEL_DATA
- `handleSetModelSelection` owns MODEL_DATA response for model changes

**Files**:
- `src/application/handlers/MessageHandler.ts:81-99`
- `src/application/handlers/domain/ConfigurationHandler.ts:129-153`

## Fundamental Architectural Problems Discovered

Through this debugging session, we identified **systemic architecture issues** that can't be fixed with patches:

### 1. Multiple Sources of Truth

The same data exists in 4 places with unclear precedence:

```
┌─────────────────────────────────────┐
│ 1. VSCode Config (proseMinion.*)   │ ← Settings.json / UI
│ 2. Frontend State (modelSelections) │ ← React state
│ 3. Backend Cache (sharedResultCache)│ ← MessageHandler
│ 4. Service State (ProseAnalysisService)│ ← Infrastructure
└─────────────────────────────────────┘
```

**Problem**: No clear answer to "what's the current model?"

### 2. Unclear Ownership

Who responds to model selection changes?
- ❓ Config watcher in MessageHandler?
- ❓ handleSetModelSelection in ConfigurationHandler?
- ❓ Frontend optimistic update?
- ❓ All of the above? (Current broken state)

### 3. Event Spaghetti

Circular event dependencies create race conditions:

```
User clicks dropdown
  ↓
Frontend: setState + send SET_MODEL_SELECTION
  ↓
Backend: config.update()
  ↓
Config Watcher: fires immediately
  ↓
Read config (still OLD due to async save)
  ↓
Send MODEL_DATA with OLD values
  ↓
Frontend: receives OLD data, overwrites user selection
  ↓
User sees wrong model ❌
```

### 4. No Clear Contracts

Questions with no clear answers:
- When does frontend trust its state vs. backend messages?
- What's the single source of truth for model selection?
- How do we prevent race conditions by design (not setTimeout hacks)?
- What data flows where and when?

### 5. Temporal Coupling

VSCode's config system is async but reads appear sync:
```typescript
await config.update(key, value);  // Async save
const read = config.get(key);     // Sync read returns OLD value!
```

**Current Hack**: `await setTimeout(50ms)` to let config settle
**Problem**: This is a code smell indicating architectural mismatch

## What Still Doesn't Work

- Model selection **may** still show wrong values intermittently
- Config changes from settings.json may not propagate correctly
- Multiple rapid changes cause unpredictable behavior
- Service refreshes happen multiple times per change

## The Right Path Forward

### Stop Patching, Start Redesigning

We need to **pause development** and design a unified architecture:

#### Required Design Decisions:

1. **Single Source of Truth**
   - Where does authoritative state live?
   - How do other layers sync from it?

2. **Ownership Model**
   - Domain: Owns business logic (what models are valid?)
   - Application: Owns orchestration (how to change models?)
   - Infrastructure: Owns persistence (where to save models?)
   - Presentation: Owns UI state (what user selected?)

3. **Interface Contracts**
   - Clear message flow diagrams
   - Invariants at each layer
   - Who responds to what events?

4. **State Management Pattern**
   - One pattern used across all layers
   - Command/Query separation?
   - Event sourcing?
   - CQRS?

5. **Config Integration Strategy**
   - How does VSCode config fit in?
   - Is it source of truth or persistence layer?
   - How do we handle async nature?

## Next Session Goals

1. **Document Current Pain Points** as requirements
2. **Design Unified Architecture**
   - State management pattern
   - Clear ownership model
   - Interface contracts
3. **Create Implementation Plan**
4. **Rebuild from ground up** (if needed)

## Files Modified (Commit 8951d26)

- `src/application/handlers/MessageHandler.ts` - Made config watcher intelligent
- `src/application/handlers/domain/ConfigurationHandler.ts` - Fixed handleSetModelSelection
- `src/presentation/webview/components/SettingsOverlay.tsx` - Removed number inputs
- `src/presentation/webview/hooks/domain/useSettings.ts` - Fixed message properties, optimistic updates

## Related Documents

- Epic: `.todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md`
- ADR: `docs/adr/2025-10-27-presentation-layer-domain-hooks.md`
- Previous Memory: `.memory-bank/20251027-1848-hierarchical-error-sources.md`

## Key Insight

> "The event-driven architecture with config watcher is causing a lot of problems. We need to back up and plan what a unifying architecture should look like that creates intelligence at every nested level with common interfaces, contracts, etc." — User

This is correct. The problems we're seeing are **symptoms of architectural mismatch**, not individual bugs. Patching won't work—we need architectural redesign.

---

**Status**: Paused for architectural planning
**Next**: Design unified state management architecture
