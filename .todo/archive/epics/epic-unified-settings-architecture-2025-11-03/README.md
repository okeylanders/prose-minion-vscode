# Epic: Unified Settings Architecture

**Quick Start**: See [epic-unified-settings-architecture.md](./epic-unified-settings-architecture.md) for full details.

---

## Overview

Unify all settings management using Domain Hooks to fix critical bugs and improve maintainability by 50%.

### Critical Issue

**SearchTab settings are completely broken** - users lose all customizations on reload. This must be fixed before v1.0.

---

## Phases

| Phase | Sprint | Effort | Priority | Target |
|-------|--------|--------|----------|--------|
| Phase 0 | [01-searchtab-urgent-fix](sprints/01-searchtab-urgent-fix.md) | 2 hours | 🚨 CRITICAL | Before v1.0 |
| Phase 1 | [02-backend-semantic-methods](sprints/02-backend-semantic-methods.md) | 30 min | HIGH | Next week |
| Phase 2 | [03-metricstab-migration](sprints/03-metricstab-migration.md) | 1 hour | MEDIUM | v1.1 |
| Phase 3 | [04-domain-hooks-extraction](sprints/04-domain-hooks-extraction.md) | 1 week | MEDIUM | v1.1 |
| Phase 4 | [05-documentation-testing](sprints/05-documentation-testing.md) | 3 days | MEDIUM | v1.1 |

---

## Quick Links

**Documentation**:
- [ADR: Unified Settings Architecture](../../docs/adr/2025-11-03-unified-settings-architecture.md)
- [Epic Overview](./epic-unified-settings-architecture.md)

**Analysis**:
- [Settings Architecture Analysis](../../.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md)
- [Settings Architecture Summary](../../.todo/architecture-debt/2025-11-02-settings-architecture-SUMMARY.md)

**Memory Bank**:
- [Settings Analysis Complete](../../.memory-bank/20251102-settings-architecture-analysis-complete.md)
- [Repository State Snapshot](../../.memory-bank/20251103-1230-state-of-repo-snapshot.md)

---

## Start Here

1. **Read**: [ADR](../../docs/adr/2025-11-03-unified-settings-architecture.md) (decision rationale)
2. **Understand**: [Epic Overview](./epic-unified-settings-architecture.md) (full context)
3. **Start**: [Sprint 01](sprints/01-searchtab-urgent-fix.md) (critical fix)

---

## Success Metrics

**Phase 0** (Before v1.0):
- ✅ SearchTab settings work correctly
- ✅ No user data loss
- ✅ Bidirectional sync functional

**Full Epic** (v1.1):
- ✅ 100% persistence coverage (29/29 settings)
- ✅ One unified pattern (Domain Hooks)
- ✅ 50% faster to add new settings
- ✅ Clear documentation

---

## Key Decisions

1. **Pattern**: Domain Hooks everywhere (not message-based)
2. **Urgency**: Phase 0 before v1.0 (critical user bug)
3. **Approach**: Phased migration (reduce risk)
4. **Testing**: Manual for Phase 0, automated for full epic

---

**Status**: Planned
**Created**: 2025-11-03
**Owner**: Development Team
