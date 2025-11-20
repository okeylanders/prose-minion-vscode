# Shared Types & Imports Hygiene

**Date Identified**: 2025-11-19
**Identified During**: Code Review / Architecture Analysis
**Priority**: Medium
**Estimated Effort**: 4-6 hours (across 3 phases)

## Problem

The `src/shared/types/messages/base.ts` file has become a catch-all for types that don't belong to a specific domain, making it hard to discover types and encouraging anti-patterns. Additionally, deep relative imports (3+ levels) are scattered across the codebase without consistent aliasing.

### Symptoms

1. **base.ts bloat**: 214 lines with 8 domain-specific types that should live elsewhere
2. **Import fragility**: 46 occurrences of `../../../` imports across 20 files
3. **Unused aliases**: `@/*` exists in main tsconfig but is rarely used
4. **No webview aliases**: tsconfig.webview.json lacks any path configuration

## Current Implementation

### Types in base.ts that shouldn't be there

```typescript
// Category search domain (should be in search.ts)
export type CategoryRelevance = 'broad' | 'focused' | 'specific' | 'synonym';
export type CategoryWordLimit = 20 | 50 | 75 | 100 | 250 | 350 | 500;
export const CATEGORY_RELEVANCE_OPTIONS: readonly CategoryRelevance[] = ['broad', 'focused', 'specific', 'synonym'];

// Model configuration domain (should be in configuration.ts)
export type ModelScope = 'assistant' | 'dictionary' | 'context' | 'category';
export interface ModelOption {
  id: string;
  label: string;
  description?: string;
}

// Results/file ops domain (should be in results.ts)
export interface SaveResultMetadata {
  word?: string;
  excerpt?: string;
  // ...
}

// UI domain (should be in ui.ts)
export enum TabId { ... }
export type SelectionTarget = 'assistant_excerpt' | 'assistant_context' | ...;
```

### Deep import examples

```typescript
// src/presentation/webview/hooks/domain/useSettings.ts
import { MessageType, ... } from '../../../../shared/types/messages';

// src/infrastructure/api/services/resources/AIResourceManager.ts
import { ... } from '../../../../shared/types/messages';
```

### Files with most deep imports

| File | Occurrences |
|------|-------------|
| useContextPathsSettings.test.ts | 7 |
| AIResourceManager.ts | 6 |
| useModelsSettings.ts | 3 |
| StandardsService.ts | 3 |
| Multiple hooks | 2 each |

## Recommendation

Follow the ADR at [docs/adr/2025-11-19-shared-types-imports-hygiene.md](../../docs/adr/2025-11-19-shared-types-imports-hygiene.md):

### Phase 1: Type Relocation

Move types to their domain files:
- CategoryRelevance, CategoryWordLimit, CATEGORY_RELEVANCE_OPTIONS → search.ts
- ModelScope, ModelOption → configuration.ts
- SaveResultMetadata → results.ts
- TabId, SelectionTarget → ui.ts

### Phase 2: Import Aliases

Add to both tsconfigs:
```json
"paths": {
  "@shared/*": ["src/shared/*"],
  "@messages": ["src/shared/types/messages/index.ts"],
  "@messages/*": ["src/shared/types/messages/*"]
}
```

Configure webpack and jest to respect aliases.

### Phase 3: Documentation

- Add "Type Locations" section to CLAUDE.md
- Document where to put new types
- Add convention for when base.ts additions are acceptable

## Impact

### Benefits of Fixing

1. **Faster type discovery** - Types live in domain files
2. **Clearer ownership** - Each file has single responsibility
3. **Easier refactoring** - Aliases make moves less disruptive
4. **Better DX** - Shorter imports, IDE autocomplete works better
5. **Prevents future bloat** - Convention stops catch-all pattern

### Risks of Not Fixing

1. **Continued base.ts growth** - Anti-pattern becomes entrenched
2. **Fragile refactoring** - Deep imports break on moves
3. **Poor discoverability** - Hard for agents/devs to find types
4. **Inconsistent patterns** - No clear guidance for new types

## Related Files

### Primary files to modify

- [src/shared/types/messages/base.ts](../../src/shared/types/messages/base.ts) - Source of types
- [src/shared/types/messages/search.ts](../../src/shared/types/messages/search.ts) - Category types target
- [src/shared/types/messages/configuration.ts](../../src/shared/types/messages/configuration.ts) - Model types target
- [src/shared/types/messages/results.ts](../../src/shared/types/messages/results.ts) - Save metadata target
- [src/shared/types/messages/ui.ts](../../src/shared/types/messages/ui.ts) - UI types target
- [tsconfig.json](../../tsconfig.json) - Extension aliases
- [tsconfig.webview.json](../../tsconfig.webview.json) - Webview aliases

### Files with deep imports (need alias migration)

- src/presentation/webview/hooks/domain/*.ts (10+ files)
- src/infrastructure/api/services/**/*.ts (4 files)
- src/__tests__/**/*.ts (test files)

## References

- **ADR**: [2025-11-19-shared-types-imports-hygiene.md](../../docs/adr/2025-11-19-shared-types-imports-hygiene.md)
- **Related ADR**: [2025-10-26-message-architecture-organization.md](../../docs/adr/2025-10-26-message-architecture-organization.md)
