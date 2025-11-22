# Sprint 02: Shared Types & Imports Hygiene

**Sub-Epic**: [Foundation Cleanup](../epic-foundation-cleanup.md)
**Status**: Blocked by Sprint 01
**Priority**: MEDIUM
**Duration**: 4-6 hours (3 phases)
**Branch**: `sprint/foundation-cleanup-02-types-imports`

---

## Problem

Three related issues:

1. **base.ts bloated**: 214 lines with 8 domain-specific types that belong elsewhere
2. **Deep imports everywhere**: 46 occurrences of `../../../` across 20 files
3. **No import aliases**: Despite being configured, aliases are unused

**Impact**:
- ❌ Hard to discover types (all dumped in base.ts)
- ❌ Fragile refactoring (deep imports break on file moves)
- ❌ Poor DX (no IDE autocomplete for deep paths)

---

## Solution (3 Phases)

### Phase 1: Type Relocation (1-2 hrs)
Move domain-specific types from base.ts to their domain files

### Phase 2: Import Aliases (2-3 hrs)
Configure and migrate to `@messages` aliases

### Phase 3: Documentation (1 hr)
Document type location conventions

---

## Tasks

### Phase 1: Type Relocation (1-2 hrs)

#### 1A: Move Category Search Types
- [ ] Open `src/shared/types/messages/base.ts`
- [ ] Cut these types:
  - `CategoryRelevance`
  - `CategoryWordLimit`
  - `CATEGORY_RELEVANCE_OPTIONS`
- [ ] Open `src/shared/types/messages/search.ts`
- [ ] Paste types at top of file
- [ ] Update all imports referencing these types

#### 1B: Move Model Configuration Types
- [ ] Cut from `base.ts`:
  - `ModelScope`
  - `ModelOption`
- [ ] Paste to `src/shared/types/messages/configuration.ts`
- [ ] Update all imports

#### 1C: Move Save/Results Types
- [ ] Cut from `base.ts`:
  - `SaveResultMetadata`
- [ ] Paste to `src/shared/types/messages/results.ts`
- [ ] Update all imports

#### 1D: Move UI Types
- [ ] Cut from `base.ts`:
  - `TabId` (if in base.ts)
  - `SelectionTarget` (if in base.ts)
- [ ] Paste to `src/shared/types/messages/ui.ts`
- [ ] Update all imports

#### 1E: Verify base.ts
- [ ] Confirm base.ts now only has truly shared base types
- [ ] Target size: < 150 lines
- [ ] Run: `npm run build` (should succeed)

---

### Phase 2: Import Aliases (2-3 hrs)

#### 2A: Configure TypeScript Paths
- [ ] Open `tsconfig.json`
- [ ] Add to `compilerOptions.paths`:
```json
"paths": {
  "@shared/*": ["src/shared/*"],
  "@messages": ["src/shared/types/messages/index.ts"],
  "@messages/*": ["src/shared/types/messages/*"]
}
```

- [ ] Open `tsconfig.webview.json`
- [ ] Add same `paths` configuration

#### 2B: Configure Webpack (Extension)
- [ ] Open webpack config (if exists)
- [ ] Add webpack resolve alias:
```javascript
resolve: {
  alias: {
    '@shared': path.resolve(__dirname, 'src/shared'),
    '@messages': path.resolve(__dirname, 'src/shared/types/messages/index.ts')
  }
}
```

#### 2C: Configure Jest
- [ ] Open `jest.config.js`
- [ ] Add `moduleNameMapper`:
```javascript
moduleNameMapper: {
  '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  '^@messages$': '<rootDir>/src/shared/types/messages/index.ts',
  '^@messages/(.*)$': '<rootDir>/src/shared/types/messages/$1'
}
```

#### 2D: Migrate Presentation Layer Imports (10+ files)
- [ ] Find all files with `../../../` or deeper
- [ ] Bash: `grep -r "from '\.\./\.\./\.\." src/presentation/webview/hooks/`

Files to update (domain hooks):
- [ ] `useAnalysis.ts`
- [ ] `useDictionary.ts`
- [ ] `useContext.ts`
- [ ] `useSearch.ts`
- [ ] `useMetrics.ts`
- [ ] `useSettings.ts`
- [ ] `useSelection.ts`
- [ ] `usePublishing.ts`
- [ ] All settings hooks (6 files)

Replace:
```typescript
// Before
import { MessageType, ... } from '../../../../shared/types/messages';

// After
import { MessageType, ... } from '@messages';
```

#### 2E: Migrate Infrastructure Layer Imports (4 files)
- [ ] `AIResourceManager.ts`
- [ ] `StandardsService.ts`
- [ ] Other services with deep imports

#### 2F: Migrate Test Files
- [ ] All `__tests__` files with deep imports
- [ ] Update to use `@messages` or `@shared/*`

#### 2G: Verify Builds
- [ ] Run: `npm run build` (extension build)
- [ ] Run: `npm run compile` (webview build)
- [ ] Both should succeed

---

### Phase 3: Documentation (1 hr)

#### 3A: Update CLAUDE.md
- [ ] Open `.ai/central-agent-setup.md` (or `.claude/CLAUDE.md`)
- [ ] Add "Type Locations" section:

```markdown
## Type Locations

### Where to Put New Types

**Domain-Specific Types** → `src/shared/types/messages/<domain>.ts`
- Analysis types → `analysis.ts`
- Dictionary types → `dictionary.ts`
- Search types → `search.ts`
- Metrics types → `metrics.ts`
- Configuration types → `configuration.ts`
- Publishing types → `publishing.ts`
- UI types → `ui.ts`
- Results types → `results.ts`

**Shared Base Types** → `src/shared/types/messages/base.ts`
- Only types used across 3+ domains
- MessageEnvelope, MessageType enum, BaseMessage
- TokenUsage, TextSourceSpec, etc.

### Import Aliases

Use aliases for cleaner imports:

```typescript
// Good - use aliases
import { MessageType } from '@messages';
import { SomeUtil } from '@shared/utils/someUtil';

// Avoid - no deep relative imports
import { MessageType } from '../../../../shared/types/messages';
```

**Available Aliases**:
- `@messages` - Barrel export of all message types
- `@messages/*` - Specific message domain files
- `@shared/*` - Any file under src/shared/
```

#### 3B: Document Conventions
- [ ] Add section on when base.ts additions are acceptable
- [ ] Add examples of good vs bad type locations

---

## Acceptance Criteria

### Phase 1: Type Relocation
- ✅ All domain types moved to domain files
- ✅ base.ts < 150 lines (only shared base types)
- ✅ All imports updated
- ✅ Builds succeed

### Phase 2: Import Aliases
- ✅ Aliases configured in tsconfig.json
- ✅ Aliases configured in tsconfig.webview.json
- ✅ Webpack resolves aliases
- ✅ Jest resolves aliases
- ✅ Zero `../../../` imports (use aliases)
- ✅ Both builds succeed (extension + webview)

### Phase 3: Documentation
- ✅ Type location guide in CLAUDE.md
- ✅ Import alias examples documented
- ✅ Conventions clearly stated

### Overall
- ✅ All tests pass: `npm test`
- ✅ No TypeScript errors
- ✅ Clean import statements everywhere

---

## Files to Update

### Type Relocation (Phase 1)
```
src/shared/types/messages/
├─ base.ts (remove domain types)
├─ search.ts (add category types)
├─ configuration.ts (add model types)
├─ results.ts (add save metadata)
└─ ui.ts (add UI types)
```

### Config Files (Phase 2)
```
Root/
├─ tsconfig.json
├─ tsconfig.webview.json
├─ webpack.config.js (if exists)
└─ jest.config.js
```

### Import Migration (Phase 2)
```
src/presentation/webview/hooks/domain/
└─ (10+ hook files)

src/infrastructure/api/services/
└─ (4 service files)

src/__tests__/
└─ (test files)
```

### Documentation (Phase 3)
```
.ai/
└─ central-agent-setup.md
```

---

## Testing Checklist

### After Phase 1
- [ ] Run: `npm run build`
- [ ] Verify: No TypeScript errors
- [ ] Check: All type imports resolve

### After Phase 2
- [ ] Run: `npm run build` (extension)
- [ ] Run: `npm run compile` (webview)
- [ ] Run: `npm test` (jest with aliases)
- [ ] Check: IDE autocomplete works with aliases
- [ ] Verify: No `../../../` imports remain

### After Phase 3
- [ ] Review documentation for clarity
- [ ] Verify examples are accurate

---

## Migration Script (Optional Helper)

```bash
# Find all deep imports (3+ levels)
grep -r "from '\.\./\.\./\.\." src/presentation/webview/hooks/ src/infrastructure/

# Count occurrences
grep -r "from '\.\./\.\./\.\." src/ | wc -l

# After migration, verify zero results
grep -r "from '\.\./\.\./\.\." src/ | wc -l
# Should output: 0
```

---

## References

**Architecture Debt**:
- [2025-11-19-shared-types-imports-hygiene.md](../../../architecture-debt/2025-11-19-shared-types-imports-hygiene.md)

**Related ADRs**:
- [ADR: Message Architecture Organization](../../../../docs/adr/2025-10-26-message-architecture-organization.md)

**Related Files**:
- [src/shared/types/messages/base.ts](../../../../src/shared/types/messages/base.ts)
- [tsconfig.json](../../../../tsconfig.json)
- [tsconfig.webview.json](../../../../tsconfig.webview.json)

---

## Outcomes (Post-Sprint)

*To be filled after sprint completion*

**Completion Date**:
**Actual Duration**:
**PR**:
**Deep Imports Eliminated**: (count before/after)
**base.ts Line Count**: (before/after)
**Lessons Learned**:

---

**Created**: 2025-11-21
**Status**: Blocked by Sprint 01
**Previous**: [01-result-formatter-decomposition.md](01-result-formatter-decomposition.md)
**Next**: [03-prop-drilling-type-safety.md](03-prop-drilling-type-safety.md)
