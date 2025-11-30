# ADR: Infrastructure Layer Reorganization

**Date**: 2025-11-29
**Status**: Implemented
**Deciders**: Claude Code (AI Agent)
**Related**: [Architecture Debt: AIResourceManager Layer Violation](../../.todo/architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)

---

## Context

During Sprint 02 (Token Usage Centralization), a Clean Architecture violation was discovered: `AIResourceManager` (infrastructure layer) was importing from the application layer (`AIResourceOrchestrator`, `ConversationManager`).

```typescript
// VIOLATION: Infrastructure importing from Application
import { AIResourceOrchestrator } from '@/application/services/AIResourceOrchestrator';
import { ConversationManager } from '@/application/services/ConversationManager';
```

This revealed a deeper issue: the "AI Gateway" components (AIRO, ARM, ConversationManager) were scattered across application and infrastructure layers with unclear ownership.

---

## Decision

Reorganize `src/infrastructure/api/` into a clean four-tier structure that consolidates the AI Gateway layer within infrastructure:

```plaintext
src/infrastructure/api/
├── providers/          # External API clients
├── orchestration/      # AI Gateway layer
├── parsers/            # Request/response parsing
└── services/           # Domain services
```

### Tier Definitions

| Tier | Purpose | Contents |
|------|---------|----------|
| **providers/** | External API clients | OpenRouterClient, OpenRouterModels |
| **orchestration/** | AI Gateway - manages lifecycle, conversations, resource bundles | AIResourceOrchestrator, AIResourceManager, ConversationManager, ResourceLoaderService |
| **parsers/** | Request/response parsing | ResourceRequestParser, ContextResourceRequestParser |
| **services/** | Domain-specific AI services | analysis/, dictionary/, search/, measurement/ |

### Dependency Flow

```plaintext
services/ → orchestration/ → providers/
         ↘ parsers/ ↗
```

All dependencies flow inward/downward. No layer violations.

---

## Alternatives Considered

### 1. Move AIResourceManager to Application Layer

**Rejected** because:
- ARM is fundamentally an infrastructure concern (managing API clients)
- Would require moving more code to application layer
- Blurs the line between orchestration and business logic

### 2. Create Abstract Interfaces

**Rejected** because:
- Over-engineering for the current scale
- AIRO/ARM are tightly coupled by design
- Interfaces would add indirection without benefit

### 3. Keep Scattered (Status Quo)

**Rejected** because:
- Violates Clean Architecture
- Confusing mental model
- Harder to understand dependency flow

---

## Implementation

### Files Moved (8)

| From | To |
|------|-----|
| `infrastructure/api/OpenRouterClient.ts` | `providers/` |
| `infrastructure/api/OpenRouterModels.ts` | `providers/` |
| `application/services/AIResourceOrchestrator.ts` | `orchestration/` |
| `application/services/ConversationManager.ts` | `orchestration/` |
| `infrastructure/api/services/resources/AIResourceManager.ts` | `orchestration/` |
| `infrastructure/api/services/resources/ResourceLoaderService.ts` | `orchestration/` |
| `application/utils/ResourceRequestParser.ts` | `parsers/` |
| `application/utils/ContextResourceRequestParser.ts` | `parsers/` |

### New Path Aliases

Added to `tsconfig.json`, `tsconfig.webview.json`, `webpack.config.js`, `jest.config.js`:

```typescript
"@providers/*": ["src/infrastructure/api/providers/*"],
"@orchestration/*": ["src/infrastructure/api/orchestration/*"],
"@parsers/*": ["src/infrastructure/api/parsers/*"]
```

### Import Updates

29 files updated to use new semantic aliases:
- Orchestration layer (internal imports)
- Domain services (4 files)
- Application layer (4 files)
- Tools layer (4 files)
- Test files (1 file)
- Webview layer (2 files)

---

## Consequences

### Positive

- ✅ **Clean Architecture compliance**: No more layer violations
- ✅ **Clear mental model**: AI Gateway layer is explicit and discoverable
- ✅ **Better organization**: Related files grouped together
- ✅ **Semantic imports**: `@orchestration/`, `@providers/`, `@parsers/`
- ✅ **Easier onboarding**: New developers can understand the flow

### Negative

- ⚠️ **Breaking change**: All imports to moved files updated (alpha - acceptable)
- ⚠️ **Git history**: Files show as renamed (history preserved with `git mv`)

### Neutral

- Documentation needs updating (CLAUDE.md alias tables)
- Future moves follow established pattern

---

## Validation

- ✅ All 259 tests pass
- ✅ TypeScript compilation passes
- ✅ Webpack build succeeds
- ✅ No circular dependencies introduced

---

## References

- [Sprint 03: Infrastructure Reorganization](../../.todo/epics/epic-architecture-health-pass-v1.3/sub-epic-3-standards-testing/sprints/03-infrastructure-reorganization.md)
- [Architecture Debt: Layer Violation](../../.todo/architecture-debt/2025-11-29-airesourcemanager-layer-violation.md)
- Clean Architecture by Robert C. Martin (Chapter 22: The Clean Architecture)
