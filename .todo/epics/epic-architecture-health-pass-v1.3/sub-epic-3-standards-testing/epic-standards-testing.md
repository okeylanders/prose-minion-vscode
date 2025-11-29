# Sub-Epic 3: Standards & Testing

**Created**: 2025-11-29
**Status**: In Progress
**Parent Epic**: [Architecture Health Pass v1.3](../epic-architecture-health-pass-v1.3.md)
**Duration**: 2-3 days (estimated)
**Progress**: 2/6 sprints complete (33%)

---

## Overview

Build on clean architecture from Sub-Epics 1-2 to establish architectural compliance, centralized token tracking, comprehensive documentation, and robust testing.

**Goal**: Compliance, documentation, and quality assurance

---

## Prerequisites

- ✅ Sub-Epic 1: Foundation Cleanup (Complete)
- ✅ Sub-Epic 2: Component Decomposition (Complete)

---

## Sprints

### Sprint 01: StandardsService Compliance (1-2 hrs) - MEDIUM
**Status**: ✅ **ALREADY RESOLVED** (2025-11-15, Technical Debt Cleanup Epic)
**Goal**: Fix Single Responsibility Principle violation

This was already fixed before this epic was planned. See [sprint doc](sprints/01-standardsservice-compliance.md) for details.

📁 [sprints/01-standardsservice-compliance.md](sprints/01-standardsservice-compliance.md)

---

### Sprint 02: Token Usage Centralization (~2 hrs) - MEDIUM

**Status**: ✅ **COMPLETE** (2025-11-29)
**Goal**: Single source of truth for token tracking

AIResourceOrchestrator now emits token usage automatically via callback, eliminating duplication.

📁 [sprints/02-token-usage-centralization.md](sprints/02-token-usage-centralization.md)

---

### Sprint 03: Infrastructure Reorganization (2-3 hrs) - MEDIUM
**Status**: 🟡 Ready to Start
**Goal**: Fix layer violation and organize AI Gateway layer

Move AIRO, ConversationManager, and related files to infrastructure, creating clean `providers/`, `orchestration/`, `parsers/`, `services/` structure.

📁 [sprints/03-infrastructure-reorganization.md](sprints/03-infrastructure-reorganization.md)

---

### Sprint 04: Domain Hooks JSDoc Completion (1-2 hrs) - MEDIUM
**Status**: ⏸️ Blocked on Sprint 03
**Goal**: Comprehensive documentation for all domain hooks

Copy JSDoc template from `useWordSearchSettings` to 6 other hooks.

📁 [sprints/04-domain-hooks-jsdoc.md](sprints/04-domain-hooks-jsdoc.md)

---

### Sprint 05: useEffect Extraction Pattern (2-4 hrs) - MEDIUM
**Status**: ⏸️ Blocked on Sprint 04
**Goal**: Testable, reusable effect logic

Extract inline useEffect logic to named methods wrapped in `useCallback`.

📁 [sprints/05-useeffect-extraction-pattern.md](sprints/05-useeffect-extraction-pattern.md)

---

### Sprint 06: Settings Hooks Unit Tests (1 day) - HIGH
**Status**: ⏸️ Blocked on Sprint 05
**Goal**: Comprehensive test coverage for settings hooks

Add unit tests for all 6 settings hooks business logic.

📁 [sprints/06-settings-hooks-unit-tests.md](sprints/06-settings-hooks-unit-tests.md)

---

## Architecture Debt Addressed

| Item | Priority | Sprint |
|------|----------|--------|
| StandardsService Responsibility Violation | MEDIUM | 01 |
| Token Usage Centralization | MEDIUM | 02 |
| Infrastructure Layer Violation | MEDIUM | 03 |
| Domain Hooks JSDoc Completion | MEDIUM | 04 |
| useEffect Extraction Pattern | MEDIUM | 05 |
| Settings Hooks Unit Tests | HIGH | 06 |

---

## Success Criteria

After completing this sub-epic:

- ✅ StandardsService only handles publishing standards (SRP restored)
- ✅ AIResourceOrchestrator is single source of truth for token tracking
- ✅ All domain hooks have comprehensive JSDoc
- ✅ useEffect logic extracted to named, testable methods
- ✅ All settings hooks have comprehensive unit tests
- ✅ Infrastructure layer has clean organization (providers/, orchestration/, parsers/, services/)
- ✅ No Clean Architecture layer violations
- ✅ All 259+ tests passing

---

## References

- [Master Plan](../../../ARCHITECTURE-HEALTH-PASS-V1.3-PLAN.md)
- [Architecture Debt Status](../../../architecture-debt/STATUS-SUMMARY.md)
- [ADR: Unified Settings Architecture](../../../../docs/adr/2025-11-03-unified-settings-architecture.md)

---

**Last Updated**: 2025-11-29 (reordered: Infrastructure Reorg now Sprint 03)
