# Focused Dialogue Analysis Buttons - Planning Session

**Date**: 2025-11-07
**Time**: 11:30 AM
**Type**: Planning & Design
**Status**: ADR Approved, Sprint Ready

## Session Summary

Planned UX improvement for dialogue analysis buttons based on user feedback about unclear naming and hidden dual functionality. Designed a four-button system with visual hierarchy that allows users to focus analysis on specific aspects.

## Problem Identified

User initiated discussion about button naming and styling for "Tune Dialog Beat" and "Tune Prose" buttons:

**Current Issues**:
1. **Unclear naming**: "Tune" is vague, "Dialog" is non-standard spelling
2. **Hidden dual functionality**: Tool analyzes both dialogue AND microbeats, but UI doesn't show this
3. **No focus control**: User can't request dialogue-only or microbeat-only analysis
4. **Lost results**: Running analysis twice overwrites previous results (30s API call × 2)
5. **Suboptimal AI**: AI doesn't know whether to emphasize dialogue or beats

## Solution Designed

### Four-Button UI with Visual Hierarchy

```
Analyze & Suggest Improvements:
[🎭 Dialogue & Beats]  [📝 Prose]

Focused:
[💬 Dialogue Only]  [🎭 Microbeats Only]
```

**Key Design Decisions**:
- **Primary buttons** (top row): Most common use cases, larger and prominent
- **Focused buttons** (bottom row): Power user options, smaller and subtle
- **Section headers**: Guide users to appropriate button
- **Icons**: Visual differentiation (🎭 theater mask, 💬 speech bubble, 📝 writing)

### Backend Architecture

**Additive Prompt System** (preserves existing prompts):
```
resources/system-prompts/dialog-microbeat-assistant/
├── 00-dialog-microbeat-assistant.md      # UNCHANGED - Base role
├── 01-dialogue-tags-and-microbeats.md    # UNCHANGED - Craft guide
└── focus/                                # NEW - Conditional emphasis
    ├── dialogue.md                       # 80/20 emphasis on dialogue
    ├── microbeats.md                     # 80/20 emphasis on beats
    └── both.md                           # 50/50 balanced (default)
```

**Focus Parameter Flow**:
1. User clicks button → `focus` parameter in message payload
2. AnalysisHandler extracts focus → passes to DialogueMicrobeatAssistant
3. Tool loads base prompts + focus-specific prompt (appended)
4. AI receives emphasis guidance → produces focused analysis

### Key Architectural Decisions

**1. Preserve Existing Prompts**
- User expressed: "I really like how it's currently working"
- Decision: Keep base prompts (`00-`, `01-`) unchanged
- Focus prompts are **additive** (appended to base)

**2. Respect Existing Architecture**
- No auto-discovery of prompt files (explicit file listing)
- Use existing `PromptLoader.loadPrompts()` pattern
- Focus parameter flows through established message envelope pattern

**3. Backward Compatibility**
- Default `focus: 'both'` preserves existing behavior
- Optional parameter (doesn't break existing calls)
- Existing "Dialogue & Beats" button replicates current functionality

## Iterative Design Process

### Initial Suggestion
Proposed template-based conditional text in prompts:
```markdown
{{#if focus === 'dialogue'}}
  PRIMARY FOCUS: Dialogue improvements
{{/if}}
```

**User Feedback**: "I don't like the text be appended via code b/c it breaks our pattern and concerns are crossed, right? the mds own the prompt text."

### Revised Approach
Respect separation of concerns:
- **Markdown files own prompt text** (not TypeScript)
- **TypeScript owns loading logic** (which files to load)
- **Conditional via file selection** (load different file based on focus)

**Result**: `focus/` subfolder with three prompt files, loaded conditionally

## ADR Created

**Document**: [docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md](../../docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md)

**Key Sections**:
- **Problem**: Unclear naming, hidden dual functionality, no user control
- **Decision**: Four-button UI with focus parameter and additive prompts
- **Solution**: Backend focus prompts + frontend visual hierarchy
- **Implementation**: Three phases (backend, frontend, testing)
- **Architecture Alignment**: Follows message envelope, domain handlers, clean architecture

**Iterations**:
1. Initial draft with template-based prompts
2. Revised to file-based conditional loading (respects existing patterns)
3. Added detailed code examples
4. Added emphasis percentages (80/20, 50/50)

## Sprint Documentation

### Epic Assignment
**Epic**: v1-polish-2025-11-02 (existing)
**Sprint**: 03-focused-dialogue-buttons

**Why This Epic**:
- Sprint 03 was already labeled "Tune Button Refinements (Potential)"
- Fits v1.0 polish goals (UX improvement, no major features)
- Estimated 2-3 hours (matches epic scope)

### Sprint Document
**Created**: [.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md](../../.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md)

**Contents**:
- Three-phase implementation plan (backend, frontend, testing)
- Task breakdown with time estimates (60min backend, 60min frontend, 30min testing)
- Comprehensive acceptance criteria (backend, frontend, functional, UI/UX)
- Testing checklist (functionality, UI/styling, backend, backward compat)
- Risk mitigation table
- Future enhancements for v1.1+

## Implementation Phases

### Phase 1: Backend Support (60 min)
1. Update message type with `focus` parameter
2. Create three focus prompt files (dialogue, microbeats, both)
3. Update `DialogueMicrobeatAssistant.loadToolPrompts()` to accept focus
4. Update `AnalysisHandler` to extract and pass focus

### Phase 2: Frontend UI (60 min)
5. Update `AnalysisTab.tsx` with four-button layout
6. Add section headers and icons
7. Update `useAnalysis` hook to dispatch focus
8. Add primary/secondary CSS styling

### Phase 3: Testing (30 min)
9. Functional testing (all 4 buttons produce correct emphasis)
10. UI testing (layout, themes, states)
11. Documentation (memory bank, PR description)

## Key Learnings

### Pattern Recognition
- **Separation of Concerns**: Markdown owns content, TypeScript owns loading
- **Additive Over Replacement**: Don't modify working code, extend it
- **User-Centered Design**: Listen to user pain points (30s wait, lost results)
- **Visual Hierarchy**: Primary vs focused buttons guide user choice

### Architectural Adherence
- **Message Envelope Pattern**: Focus parameter in payload
- **Domain Handlers**: AnalysisHandler owns orchestration
- **Clean Architecture**: UI → Message → Handler → Tool → Infrastructure
- **Backward Compatibility**: Optional parameter with sensible default

## Next Steps

1. **Implementation**: Begin Phase 1 (backend support)
2. **Branch**: `sprint/epic-v1-polish-03-focused-dialogue-buttons`
3. **Testing**: Manual verification in Extension Development Host
4. **PR**: Merge to main after testing
5. **Memory Bank**: Update with completion summary

## Files Created

- [docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md](../../docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md) - Architecture decision record
- [.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md](../../.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md) - Sprint plan
- [.todo/epics/epic-v1-polish-2025-11-02/epic-v1-polish.md](../../.todo/epics/epic-v1-polish-2025-11-02/epic-v1-polish.md) - Updated with Sprint 03

## Success Metrics (Planned)

- **User Clarity**: Users understand button purposes without trial-and-error
- **Focused Results**: AI responses emphasize requested focus area (80/20 split)
- **No Lost Results**: Users can run multiple analyses without overwriting
- **Better Suggestions**: User feedback indicates improved relevance
- **No Regressions**: Existing behavior preserved when `focus='both'`

## References

- **User Request**: Screenshot of current button layout
- **Existing Prompts**: `resources/system-prompts/dialog-microbeat-assistant/`
- **Similar Pattern**: Context Model Selector UI (Sprint 01)
- **Message Pattern**: Existing dialogue analysis message contracts
- **ADR**: [2025-11-07-focused-dialogue-analysis-buttons.md](../../docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md)

## Commit Plan

Commit all planning artifacts together:
- ADR document
- Sprint document
- Epic update
- Memory bank entry

**Branch**: `main` (planning artifacts only, no code changes yet)
**Commit Message**: "docs(v1-polish): Add ADR and sprint for focused dialogue analysis buttons"
