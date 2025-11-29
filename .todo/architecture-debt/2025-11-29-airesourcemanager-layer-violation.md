# AIResourceManager Layer Violation → Infrastructure Reorganization

**Date Identified**: 2025-11-29
**Identified During**: Sprint 02 - Token Usage Centralization (code review)
**Priority**: Medium (upgraded from Low)
**Estimated Effort**: 2-3 hours
**Status**: 🟡 Plan Approved - Ready for Sprint

---

## Problem

`AIResourceManager` is located in the infrastructure layer but imports from the application layer, violating Clean Architecture's dependency rule (dependencies should point inward).

**Current location**: `src/infrastructure/api/services/resources/AIResourceManager.ts`

**Problematic imports**:

```typescript
import { AIResourceOrchestrator } from '@/application/services/AIResourceOrchestrator';
import { ConversationManager } from '@/application/services/ConversationManager';
```

Infrastructure → Application is the wrong direction.

---

## Solution: Infrastructure Reorganization

After analysis, the cleanest solution is to **move AIRO, ConversationManager, and related utilities INTO infrastructure** rather than moving AIResourceManager out. These components form an "AI Gateway" layer - the smart client that mediates all AI interactions.

### Current Structure (Scattered)

```plaintext
src/
├── application/
│   ├── services/
│   │   ├── AIResourceOrchestrator.ts  ❌ Should be infra
│   │   └── ConversationManager.ts     ❌ Should be infra
│   └── utils/
│       └── ResourceRequestParser.ts   ❌ Should be infra
├── infrastructure/
│   └── api/
│       ├── OpenRouterClient.ts
│       ├── OpenRouterModels.ts
│       └── services/
│           ├── resources/
│           │   ├── AIResourceManager.ts
│           │   └── ResourceLoaderService.ts
│           ├── analysis/
│           ├── dictionary/
│           └── ...
```

### Target Structure (Organized)

```plaintext
src/infrastructure/api/
├── providers/                          # External API clients
│   ├── OpenRouterClient.ts             # ← move from api/
│   └── OpenRouterModels.ts             # ← move from api/
│
├── orchestration/                      # AI Gateway layer
│   ├── AIResourceOrchestrator.ts       # ← move from application/services/
│   ├── AIResourceManager.ts            # ← move from api/services/resources/
│   ├── ConversationManager.ts          # ← move from application/services/
│   └── ResourceLoaderService.ts        # ← move from api/services/resources/
│
├── parsers/                            # Request/response parsing
│   ├── ResourceRequestParser.ts        # ← move from application/utils/
│   └── ContextResourceRequestParser.ts # ← if exists
│
└── services/                           # Domain services (unchanged internally)
    ├── analysis/
    │   ├── AssistantToolService.ts
    │   └── ContextAssistantService.ts
    ├── dictionary/
    │   └── DictionaryService.ts
    ├── search/
    │   ├── WordSearchService.ts
    │   └── CategorySearchService.ts
    └── measurement/
        ├── ProseStatsService.ts
        ├── StyleFlagsService.ts
        └── WordFrequencyService.ts
```

### Rationale

1. **providers/**: External API clients (OpenRouter). Clear boundary for external dependencies.
2. **orchestration/**: The "AI Gateway" - manages client lifecycle, conversations, resource bundles. This is the smart layer that domain services depend on.
3. **parsers/**: Request/response parsing utilities used by orchestration and services.
4. **services/**: Domain-specific AI services that consume orchestration layer.

**Dependency flow (all within infrastructure):**

```plaintext
services/ → orchestration/ → providers/
         ↘ parsers/ ↗
```

All dependencies point inward/down. No violations.

---

## Files to Move

| Current Location | New Location |
|-----------------|--------------|
| `src/infrastructure/api/OpenRouterClient.ts` | `providers/OpenRouterClient.ts` |
| `src/infrastructure/api/OpenRouterModels.ts` | `providers/OpenRouterModels.ts` |
| `src/application/services/AIResourceOrchestrator.ts` | `orchestration/AIResourceOrchestrator.ts` |
| `src/application/services/ConversationManager.ts` | `orchestration/ConversationManager.ts` |
| `src/infrastructure/api/services/resources/AIResourceManager.ts` | `orchestration/AIResourceManager.ts` |
| `src/infrastructure/api/services/resources/ResourceLoaderService.ts` | `orchestration/ResourceLoaderService.ts` |
| `src/application/utils/ResourceRequestParser.ts` | `parsers/ResourceRequestParser.ts` |

Total: 7-8 files to move

---

## Import Updates Required

After moving files, imports throughout the codebase will need updating:

1. **MessageHandler.ts** - imports AIRO, ARM
2. **Domain services** - import from orchestration/
3. **extension.ts** - composition root updates
4. **Test files** - import path updates
5. **tsconfig paths** - add new aliases (@providers, @orchestration, @parsers)

---

## Implementation Notes

1. **Use `git mv`** to preserve history
2. **Update tsconfig.json** with new path aliases
3. **Update webpack.config.js** for new alias resolution
4. **Run tests after each file move** to catch import breaks early
5. **Remove empty directories** after moves complete

---

## Impact

- ✅ Clean Architecture compliance restored
- ✅ Clear "AI Gateway" layer emerges
- ✅ Better discoverability (related files together)
- ✅ Easier to understand dependency flow
- ⚠️ Many import updates required (but straightforward)

---

## References

- Sprint 02: Token Usage Centralization (where this was identified)
- Sprint 03: Infrastructure Reorganization (where this will be implemented)
- Clean Architecture by Robert C. Martin (Chapter 22)

---

**Last Updated**: 2025-11-29
