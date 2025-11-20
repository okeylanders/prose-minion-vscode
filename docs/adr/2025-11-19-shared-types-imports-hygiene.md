# ADR: Shared Types & Imports Hygiene

**Date**: 2025-11-19
**Status**: Proposed
**Author**: Claude Code

## Context

The `src/shared/types/messages/base.ts` file has become a catch-all for types that don't clearly belong to a specific domain. At 214 lines, it's the largest message file and contains a mix of:

- **Foundational types** (MessageType enum, MessageEnvelope, MessageSource, BaseMessage) - appropriate
- **Domain-specific types** that leaked into base:
  - Category search: `CategoryRelevance`, `CategoryWordLimit`, `CATEGORY_RELEVANCE_OPTIONS`
  - Model configuration: `ModelScope`, `ModelOption`
  - File operations: `SaveResultMetadata`
  - UI primitives: `SelectionTarget`, `TabId`

This pattern encourages "just dump it in base" behavior and makes it harder to discover domain types.

Additionally, imports across the codebase suffer from:
- **46 occurrences of 3+ level deep imports** (`../../../`) across 20 files
- **No path aliases in webview** (tsconfig.webview.json lacks `paths` configuration)
- **Unused alias** in main tsconfig (`@/*` exists but is rarely used)

### Problem Statement

1. **base.ts as catch-all** → Hard to discover domain types, encourages anti-pattern
2. **Deep relative imports** → Fragile, hard to refactor, poor DX
3. **No import conventions** → Inconsistent patterns across codebase

## Decision

### 1. Minimize base.ts to Truly Foundational Types

Keep only cross-cutting primitives in `base.ts`:

**Keep in base.ts:**
- `MessageType` enum (routing contract)
- `MessageEnvelope` (envelope pattern)
- `MessageSource` (source tracking)
- `BaseMessage` (legacy compatibility)

**Move to domain files:**

| Type | Current Location | Target Location | Rationale |
|------|-----------------|-----------------|-----------|
| `CategoryRelevance` | base.ts | messages/search.ts | Category search domain |
| `CategoryWordLimit` | base.ts | messages/search.ts | Category search domain |
| `CATEGORY_RELEVANCE_OPTIONS` | base.ts | messages/search.ts | Category search domain |
| `ModelScope` | base.ts | messages/configuration.ts | Model config domain |
| `ModelOption` | base.ts | messages/configuration.ts | Model config domain |
| `TokenUsage` | base.ts | messages/configuration.ts | Token tracking domain (alongside TokenUsageUpdateMessage) |
| `SaveResultMetadata` | base.ts | messages/results.ts | Results/file ops domain |
| `SelectionTarget` | base.ts | messages/ui.ts | UI domain |
| `TabId` | base.ts | messages/ui.ts | UI domain |

> **Note**: TokenUsage belongs in configuration.ts where TokenUsageUpdateMessage and TokenUsageTotals already live. This keeps the token tracking domain cohesive. If token tracking grows in complexity, consider extracting to a dedicated `messages/tokens.ts`.

### 2. Establish Import Aliases

Add consistent path aliases across both tsconfigs:

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@messages": ["src/shared/types/messages/index.ts"],
      "@messages/*": ["src/shared/types/messages/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@application/*": ["src/application/*"],
      "@domain/*": ["src/domain/*"],
      "@presentation/*": ["src/presentation/*"]
    }
  }
}

// tsconfig.webview.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@messages": ["src/shared/types/messages/index.ts"],
      "@messages/*": ["src/shared/types/messages/*"]
    }
  }
}
```

### 3. Add Lint/Convention Guardrails

Document conventions to prevent regression:

**Convention: Where to put new types**

1. **Domain-specific messages** → `messages/<domain>.ts`
   - Analysis types → `messages/analysis.ts`
   - Search types → `messages/search.ts`
   - etc.

2. **Cross-cutting infrastructure** → `base.ts` (requires justification)
   - Must be used by 3+ domains
   - Examples: MessageEnvelope, TokenUsage

3. **New domain files** → Create when needed
   - If adding 3+ related types, consider new file
   - Follow existing naming: `messages/<domain>.ts`

**Suggested lint rule (future):**
```typescript
// eslint rule to flag base.ts additions
"no-restricted-imports": [
  "error",
  {
    "patterns": [{
      "group": ["**/base"],
      "importNames": ["*"],
      "message": "Prefer importing from domain-specific message files"
    }]
  }
]
```

## Consequences

### Benefits

1. **Faster discovery** - Types live in their domain files
2. **Clearer ownership** - Each domain file owns its types
3. **Less fragile imports** - Aliases reduce `../../../` chains
4. **Reduced base-bloat risk** - Convention prevents future catch-all patterns
5. **Better refactoring** - Aliases make moves less disruptive

### Trade-offs

1. **Migration effort** - Need to update imports across 20+ files
2. **Webpack/Jest config** - May need alias configuration
3. **Learning curve** - Team needs to learn new conventions

### Risks

1. **Circular imports** - Moving types could create cycles (mitigate: barrel exports)
2. **Build issues** - Alias misconfiguration in webpack (mitigate: test both builds)

## Implementation

### Phase 1: Type Relocation (Low Risk)

1. Move domain types from base.ts to domain files
2. Update barrel export in index.ts
3. Existing imports through barrel remain unchanged

**Estimated effort**: 1-2 hours

### Phase 2: Import Aliases (Medium Risk)

1. Add paths to both tsconfigs
2. Configure webpack aliases (if needed)
3. Configure Jest moduleNameMapper
4. Migrate imports incrementally (can be done file-by-file)

**Estimated effort**: 2-3 hours

### Phase 3: Documentation & Guardrails

1. Add "Type Locations" section to CLAUDE.md
2. Document import conventions
3. (Optional) Add eslint rule

**Estimated effort**: 1 hour

## Alternatives Considered

### 1. Keep base.ts as-is, just add aliases
- Pro: Less disruptive
- Con: Doesn't solve discoverability issue, base will keep growing

### 2. Split into more granular files (e.g., models.ts, category.ts)
- Pro: Maximum granularity
- Con: Over-segmentation, file explosion
- Decision: Prefer domain alignment over maximum granularity

### 3. Use TypeScript project references
- Pro: Better isolation, faster incremental builds
- Con: Complex setup, overkill for this project size
- Decision: Aliases are sufficient for current needs

## Metrics

**Before:**
- base.ts: 214 lines, 9 non-foundational types
- Deep imports (3+ levels): 46 occurrences across 20 files

**Target After:**

- base.ts: ~100 lines, only 4 foundational types (MessageType, MessageEnvelope, MessageSource, BaseMessage)
- Deep imports: < 10 occurrences (legacy/edge cases)

## References

- Current base.ts: [src/shared/types/messages/base.ts](../../src/shared/types/messages/base.ts)
- Message architecture ADR: [2025-10-26-message-architecture-organization.md](2025-10-26-message-architecture-organization.md)
- Presentation layer hooks ADR: [2025-10-27-presentation-layer-domain-hooks.md](2025-10-27-presentation-layer-domain-hooks.md)
