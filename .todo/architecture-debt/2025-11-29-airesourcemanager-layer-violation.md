# AIResourceManager Layer Violation

**Date Identified**: 2025-11-29
**Identified During**: Sprint 02 - Token Usage Centralization (code review)
**Priority**: Low
**Estimated Effort**: 2-3 hours

## Problem

`AIResourceManager` is located in the infrastructure layer but imports from the application layer, violating Clean Architecture's dependency rule (dependencies should point inward).

**Current location**: `src/infrastructure/api/services/resources/AIResourceManager.ts`

**Problematic imports**:
```typescript
import { AIResourceOrchestrator } from '@/application/services/AIResourceOrchestrator';
import { ConversationManager } from '@/application/services/ConversationManager';
```

Infrastructure → Application is the wrong direction.

## Current State

This violation exists but doesn't cause immediate issues because:
1. AIResourceManager is injected via dependency injection from `extension.ts`
2. Services receive it as a dependency, they don't instantiate it directly
3. The dependency flows downward through injection from the composition root

## Complication

Moving AIResourceManager to application layer would create a similar violation in reverse:
- `DictionaryService`, `AssistantToolService`, `ContextAssistantService`, `CategorySearchService` (all in infrastructure) import AIResourceManager
- If AIResourceManager moves to application, those infrastructure services would import from application

This suggests a deeper architectural issue where the boundary between "AI orchestration" and "infrastructure" isn't cleanly defined.

## Recommendation

**Option A (Simple)**: Accept the current state as pragmatic for this codebase size. Document it and move on.

**Option B (Future refactor)**: Introduce interface inversion:
1. Define `IAIResourceManager` interface in application layer
2. AIResourceManager implements it (stays in infrastructure)
3. Services depend on interface only
4. Factory pattern for creation

**Recommendation**: Option A for now. This is a medium-effort refactor with low immediate benefit. Revisit if codebase grows significantly.

## Impact

- No functional impact (code works correctly)
- Theoretical Clean Architecture violation
- May make future refactoring slightly harder

## Files Affected

- `src/infrastructure/api/services/resources/AIResourceManager.ts`
- 8 files that import AIResourceManager

## References

- Sprint 02: Token Usage Centralization
- Clean Architecture by Robert C. Martin (Chapter 22: The Clean Architecture)
