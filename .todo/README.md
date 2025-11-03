# .todo Directory Structure

This directory tracks epics, sprints, and architecture debt for the Prose Minion VSCode extension.

## Directory Organization

```
.todo/
├── epics/              # Active epics (work in progress)
├── architecture-debt/  # Identified technical debt and improvements
├── search-module/      # Active search specs (planning/backlog)
├── metrics-module/     # Active metrics specs (planning/backlog)
├── archived/           # Completed work (historical reference)
│   ├── epics/         # Completed epic folders
│   └── specs/         # Completed standalone specifications
└── README.md          # This file
```

## Active Work

### Epics (`.todo/epics/`)

Contains **active** epic folders for ongoing or planned work:

- **epic-search-architecture-2025-10-19** - Partially complete (5/8 phases done)
  - Phases 1-5: ✅ DONE (archived)
  - Phases 6-7: 🟡 PENDING (architecture passes)
  - Phase 8: 📋 PLANNING (context search)

- **epic-v1-polish-2025-11-02** - Mostly complete (3/4 sprints done)
  - Sprints 01, 02, 04: ✅ DONE
  - Sprint 03: Backlog (Tune Button refinements)

### Active Specs

**search-module/** - Context search planning (Phase 8 of Search & Architecture epic)
- `2025-10-24-context-search-component.md` - AI-assisted search expansion spec

**metrics-module/** - Metrics enhancements (research/planning)
- `2025-11-02-hyphenated-compound-words-analysis.md` - Hyphenated compound words handling

### Architecture Debt (`.todo/architecture-debt/`)

Contains documented technical debt and improvement opportunities:

1. **Settings Architecture Analysis** (HIGH priority)
   - Mixed patterns (hooks vs messages)
   - Hardcoded settings keys
   - Inconsistent configuration strategy

2. **Settings Sync Registration** (MEDIUM priority)
   - Duplication in refresh logic
   - No single source of truth

3. **Configuration Strategy Inconsistency** (MEDIUM priority)
   - Two patterns for managing config
   - Needs unified approach

4. **Word Counter UI Component Duplication** (LOW priority)
   - UI component pattern duplicated across 3 locations
   - Simple extraction opportunity

**Action**: These items are ready for epic creation when prioritized.

## Archived Work (`.todo/archived/`)

Contains **completed** epics and specs for historical reference. Work is archived when:

- All acceptance criteria met
- PR merged to main branch
- Memory bank entry created
- No active development remaining

### Archived Epics (`.todo/archived/epics/`)

**7 completed epics** (Oct-Nov 2025):

1. **epic-verbalized-sampling-2025-10-26** (PR #4)
   - Enhanced dialogue/prose suggestions with creative diversity

2. **epic-secure-storage-2025-10-27** (PR #11)
   - API key storage via OS-level encryption (SecretStorage)

3. **epic-presentation-refactor-2025-10-27** (PR #13)
   - Domain hooks refactoring, App.tsx reduction (43%)

4. **epic-message-envelope-2025-10-28** (PR #12, #13)
   - MessageHandler reduction (54%), strategy pattern routing

5. **epic-context-window-safety-2025-11-02** (PR #14)
   - Word counter UI, backend trimming, Output Channel logging

6. **epic-clickable-resource-pills-2025-11-02** (PR #15)
   - Resource pills now clickable in Context Assistant

7. **epic-word-length-filter-metrics-2025-11-02** (PR #17)
   - Tab-based word length filtering in metrics

### Archived Specs (`.todo/archived/specs/`)

**5 completed specification directories**:

1. **search-module/** - Phases 1-2 of Search & Architecture epic (DONE)
   - `2025-10-24-move-word-search-component.md` - Word search relocation

2. **metrics-module/** - Phase 3 of Search & Architecture epic (DONE)
   - `2025-10-24-metrics-module.md` - Metrics UX improvements

3. **token-cost-widget/** - Phase 4 of Search & Architecture epic (DONE)
   - Token usage tracking specs
   - Cost display widget design

4. **settings-module/** - Phase 5 of Search & Architecture epic (DONE)
   - Settings overlay UI specs
   - Configuration management design

5. **v1-polish/** - Completed v1 polish items (DONE)
   - Context model selector UI
   - Word length filter metrics
   - Context window trim limits
   - Clickable resource pills

## Working with This Structure

### Adding New Work

1. **New Epic**: Create under `.todo/epics/epic-[name]-[YYYY-MM-DD]/`
2. **Architecture Debt**: Document in `.todo/architecture-debt/`
3. **Follow ADR pattern**: Create ADR first, then epic, then sprints

### Completing Work

When an epic or spec is complete:

1. ✅ Verify all acceptance criteria met
2. ✅ PR merged to main
3. ✅ Memory bank entry created
4. ✅ Update epic status to "Complete"
5. ✅ Move to `.todo/archived/epics/` or `.todo/archived/specs/`

### Archiving Criteria

Archive work when:

- **Epics**: All sprints complete, no pending items
- **Specs**: Implemented and merged to main
- **Architecture Debt**: Resolved or superseded

**Do NOT archive**:

- Partially complete epics (leave in `.todo/epics/` with updated status)
- Active architecture debt (leave in `.todo/architecture-debt/`)

## Related Documentation

- **ADRs**: [docs/adr/](../docs/adr/) - Architecture Decision Records
- **Memory Bank**: [.memory-bank/](../.memory-bank/) - Session continuity
- **Agent Guide**: [.claude/CLAUDE.md](../.claude/CLAUDE.md) - AI agent instructions

## Maintenance

- **Weekly**: Review active epics, update statuses
- **Monthly**: Archive completed work, audit stale items
- **Quarterly**: Review architecture debt priorities

---

**Last Updated**: 2025-11-03
**Archived Items**: 7 epics, 5 spec directories
**Active Items**: 2 epics, 4 architecture debt issues
