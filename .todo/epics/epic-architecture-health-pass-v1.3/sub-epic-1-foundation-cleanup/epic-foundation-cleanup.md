# Sub-Epic 1: Foundation Cleanup

**Part of**: [Architecture Health Pass (v1.3)](../epic-architecture-health-pass-v1.3.md)
**Status**: Ready to Start
**Duration**: 2-3 days
**Sprints**: 3

---

## Overview

Fix the foundational architecture issues that block all other improvements: type safety, clean organization, and proper imports. This sub-epic establishes the foundations needed for safe component extraction in Sub-Epic 2.

**Why First**: Everything else depends on type safety and clean imports.

---

## Goals

1. **Eliminate grab bags**: Break down 763-line formatter into focused files
2. **Organize types**: Move domain types to domain files, establish import aliases
3. **Establish type safety**: Type VSCode API and all message handlers
4. **Enable safe refactoring**: TypeScript catches bugs at compile time

---

## Sprints

### Sprint 01: Result Formatter Decomposition
**Duration**: 3-4 hours
**Priority**: HIGH
**Status**: Ready

**Problem**: 763-line grab bag mixing 6 unrelated domains

**Solution**: Extract into 7 focused formatter files

**Deliverable**: Clean, domain-organized formatters

📁 [sprints/01-result-formatter-decomposition.md](sprints/01-result-formatter-decomposition.md)

---

### Sprint 02: Shared Types & Imports Hygiene
**Duration**: 4-6 hours (3 phases)
**Priority**: MEDIUM
**Status**: Blocked by Sprint 01

**Problem**: base.ts bloated, 46 deep imports, no aliases

**Solution**: Move types to domain files, add import aliases

**Deliverable**: Clean type organization, `@messages` aliases everywhere

📁 [sprints/02-shared-types-imports-hygiene.md](sprints/02-shared-types-imports-hygiene.md)

---

### Sprint 03: Prop Drilling & Type Safety
**Duration**: 4-6 hours
**Priority**: HIGH
**Status**: Blocked by Sprint 02

**Problem**: Untyped VSCode API, untyped message handlers, 30-52 props per tab

**Solution**: Create typed interfaces, type all handlers

**Deliverable**: Full type safety, IDE autocomplete, compile-time errors

📁 [sprints/03-prop-drilling-type-safety.md](sprints/03-prop-drilling-type-safety.md)

---

## Success Criteria

- ✅ No grab bag files > 400 lines
- ✅ All types in domain files (base.ts < 150 lines)
- ✅ Zero `../../../` imports (use `@messages` aliases)
- ✅ All VSCode API calls typed (no `any`)
- ✅ All message handlers typed (no `any`)
- ✅ IDE autocomplete works for message payloads
- ✅ Tests pass

---

## Impact

### Unblocks
- ✅ Sub-Epic 2: Component Decomposition (needs typed interfaces)
- ✅ Sub-Epic 3: Standards & Testing (needs clean organization)
- ✅ Sub-Epic 4: Polish & UX (needs safe refactoring)

### Enables
- ✅ Safe component extraction (type safety prevents regressions)
- ✅ Clean imports everywhere (better DX)
- ✅ Faster development (IDE autocomplete)
- ✅ Catch bugs early (compile-time validation)

---

## Architecture Debt Resolved

1. **Result Formatter Grab Bag** (HIGH) - Sprint 01
   - File: `.todo/architecture-debt/2025-11-19-result-formatter-grab-bag.md`

2. **Shared Types & Imports Hygiene** (MEDIUM) - Sprint 02
   - File: `.todo/architecture-debt/2025-11-19-shared-types-imports-hygiene.md`

3. **Prop Drilling & Type Safety** (HIGH) - Sprint 03
   - File: `.todo/architecture-debt/2025-11-19-prop-drilling-and-type-safety.md`

---

## Timeline

```
Day 1:
├─ Morning: Sprint 01 (Result Formatter) - 3-4 hrs
└─ Afternoon: Start Sprint 02 (Phase 1)

Day 2:
├─ Morning: Sprint 02 (Phases 2-3) - complete
└─ Afternoon: Sprint 03 (Type Safety) - start

Day 3:
└─ Morning: Sprint 03 (Type Safety) - complete
```

---

## Dependencies

```
Sprint 01: Result Formatter
  └─ No dependencies (can start immediately)

Sprint 02: Shared Types
  └─ Requires: Sprint 01 (clean formatters for import updates)

Sprint 03: Type Safety
  └─ Requires: Sprint 02 (clean imports ready)
```

---

## Branching Strategy

Each sprint uses its own branch:

```bash
# Sprint 01
git checkout -b sprint/foundation-cleanup-01-result-formatter

# Sprint 02
git checkout -b sprint/foundation-cleanup-02-types-imports

# Sprint 03
git checkout -b sprint/foundation-cleanup-03-type-safety
```

---

## Testing Strategy

### Sprint 01: Result Formatter
- Run existing tests: `npm test`
- Verify tab components render correctly
- Check markdown export functionality

### Sprint 02: Shared Types & Imports
- Run tests after each phase
- Verify webpack build succeeds
- Test both extension and webview builds

### Sprint 03: Type Safety
- TypeScript compilation (should have no errors)
- Test IDE autocomplete
- Run all tests

---

## References

**Planning**:
- [Master Epic](../epic-architecture-health-pass-v1.3.md)
- [Comprehensive Plan](../../ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md)
- [Quick Start Guide](../../QUICKSTART-EPIC-1.md)

**Architecture Debt**:
- [Result Formatter Grab Bag](../../architecture-debt/2025-11-19-result-formatter-grab-bag.md)
- [Shared Types & Imports Hygiene](../../architecture-debt/2025-11-19-shared-types-imports-hygiene.md)
- [Prop Drilling & Type Safety](../../architecture-debt/2025-11-19-prop-drilling-and-type-safety.md)

**Related ADRs**:
- [Message Architecture Organization](../../../docs/adr/2025-10-26-message-architecture-organization.md)
- [Presentation Layer Domain Hooks](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)

---

## Progress

| Sprint | Status | Duration | Completion |
|--------|--------|----------|------------|
| 01. Result Formatter | 🔵 Ready | 3-4 hrs | - |
| 02. Types & Imports | ⏸️ Blocked | 4-6 hrs | - |
| 03. Type Safety | ⏸️ Blocked | 4-6 hrs | - |

**Sub-Epic Progress**: 0/3 sprints (0%)

---

**Last Updated**: 2025-11-21
**Created By**: Claude Code (AI Agent)
**Next**: Start [Sprint 01](sprints/01-result-formatter-decomposition.md)
