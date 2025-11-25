# Micro-Epic: UX Polish & Model Updates

**Created**: 2025-11-24
**Status**: Ready to Start
**Duration**: 2.75-3 hours (estimated)
**Sprints**: 3
**Priority**: Medium

---

## Overview

A focused micro-epic addressing three user-facing improvements before continuing with Architecture Health Pass Sub-Epic 3. These changes improve model selection, context generation quality, and dictionary UX flow.

**Scope**: Small, independent improvements that don't require architectural changes.

---

## Sprints

### Sprint 01: Add New Models
**Duration**: 30 min
**Priority**: HIGH

Add two new frontier models to both `CATEGORY_MODELS` and `RECOMMENDED_MODELS`:
- `deepcogito/cogito-v2.1-671b` - Cogito v2.1 671B
- `anthropic/claude-opus-4.5` - Claude Opus 4.5

**Files**: `src/infrastructure/api/OpenRouterModels.ts`

📁 [sprints/01-add-new-models.md](sprints/01-add-new-models.md)

---

### Sprint 02: Context Prompt Enhancement + 3-Turn Support
**Duration**: 1.25 hrs
**Priority**: MEDIUM

Two parts:
1. **Backend**: Extend AIResourceOrchestrator to support 3 turns (2 resource request rounds)
2. **Prompt**: Enhance context assistant prompt to:
   - Prioritize `[projectBrief]` category and overview files
   - Add specific file patterns to look for
   - Establish hierarchy (overview → source → characters)
   - Guide model to use 2 resource turns when catalog is rich

**Files**:
- `src/application/services/AIResourceOrchestrator.ts`
- `resources/system-prompts/context-assistant/00-context-briefing.md`

📁 [sprints/02-context-prompt-enhancement.md](sprints/02-context-prompt-enhancement.md)

---

### Sprint 03: Dictionary UX Improvements
**Duration**: 1 hour
**Priority**: HIGH

Three improvements to dictionary flow:
1. Rename buttons to "Run Dictionary Lookup" terminology
2. Auto-run fast lookup when triggered via Command Palette
3. Show toast notification on auto-run

**Files**:
- `src/presentation/webview/components/tabs/UtilitiesTab.tsx`
- `src/extension.ts`
- `src/application/providers/ProseToolsViewProvider.ts`

📁 [sprints/03-dictionary-ux-improvements.md](sprints/03-dictionary-ux-improvements.md)

---

## Success Criteria

- [ ] Cogito v2.1 671B and Claude Opus 4.5 appear in model dropdowns
- [ ] Context assistant requests story-bible/overview files when available
- [ ] Dictionary buttons renamed to "Run Dictionary Lookup" terminology
- [ ] Command Palette "Word Lookup" auto-runs fast dictionary lookup
- [ ] Toast notification appears on auto-run
- [ ] All tests pass
- [ ] Build succeeds

---

## Dependencies

None - this epic is independent of Architecture Health Pass.

---

## Branching Strategy

Single branch for all 3 sprints (small scope):
```bash
git checkout -b epic/ux-polish-2025-11-24
```

---

## References

**User Feedback**: GitHub issue discussion about dictionary UX confusion
**Model Sources**:
- [Cogito v2.1 on OpenRouter](https://openrouter.ai/deepcogito/cogito-v2.1-671b)
- [Claude Opus 4.5 Announcement](https://www.anthropic.com/news/claude-opus-4-5)

---

**Last Updated**: 2025-11-24
**Created By**: Claude Code (AI Agent)
