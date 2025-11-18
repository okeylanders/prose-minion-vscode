# Sprint 03: Focused Dialogue Analysis Buttons

**Epic**: [epic-v1-polish](../epic-v1-polish.md)
**Date**: 2025-11-07
**Completed**: 2025-11-07
**Status**: ✅ **COMPLETE**
**Branch**: `sprint/epic-v1-polish-03-focused-dialogue-buttons` (merged)
**Estimated Time**: 2-3 hours
**Actual Time**: ~2 hours
**Priority**: MEDIUM (v1.0 Polish)

## Goals

Replace the single "Tune Dialog Beat" button with four focused buttons that allow users to specify their analysis intent:
- 🎭 **Dialogue & Beats** (primary) - Balanced analysis
- 📝 **Prose** (primary) - Prose analysis (existing)
- 💬 **Dialogue Only** (focused) - Line-level improvements
- 🎭 **Microbeats Only** (focused) - Action beat suggestions

## Problem

### Current State
- Single button: "Tune Dialog Beat"
- Unclear what the tool does (dialogue? beats? both?)
- Non-standard spelling ("Dialog" vs "Dialogue")
- No way to focus analysis on specific aspect
- Generic analysis means AI guesses what user needs

### User Impact
- **Unclear naming**: "Tune" is vague, "Dialog Beat" combines two concepts
- **Hidden dual functionality**: Tool analyzes both dialogue AND microbeats, but UI doesn't show this
- **No focus control**: User can't request dialogue-only or beats-only analysis
- **Lost results**: Running analysis twice overwrites previous results (30s wait × 2)
- **Suboptimal AI responses**: AI doesn't know whether to emphasize dialogue or beats

## Solution

Four-button UI with clear visual hierarchy:

```
Analyze & Suggest Improvements:
[🎭 Dialogue & Beats]  [📝 Prose]

Focused:
[💬 Dialogue Only]  [🎭 Microbeats Only]
```

**Backend**: Add `focus` parameter to message payload, create focus-specific prompts
**Frontend**: Replace button, add visual hierarchy, dispatch focus in message

## Implementation Plan

### Phase 1: Backend Support ✅ (Planned)

1. **Update Message Type**
   - [ ] Add `focus?: 'dialogue' | 'microbeats' | 'both'` to `AnalyzeDialogueRequest` payload
   - [ ] Update type exports

2. **Create Focus Prompts**
   - [ ] Create `resources/system-prompts/dialog-microbeat-assistant/focus/` directory
   - [ ] Write `dialogue.md` - 80/20 emphasis on dialogue improvements
   - [ ] Write `microbeats.md` - 80/20 emphasis on action beats
   - [ ] Write `both.md` - 50/50 balanced analysis (default)

3. **Update DialogueMicrobeatAssistant**
   - [ ] Add `focus` parameter to `loadToolPrompts()` method
   - [ ] Update `loadToolPrompts()` to append focus-specific prompt
   - [ ] Add `focus` to `DialogueMicrobeatOptions` type
   - [ ] Update `analyze()` to accept and pass focus

4. **Update AnalysisHandler**
   - [ ] Extract `focus` from message payload
   - [ ] Pass focus to `dialogueAssistant.analyze()`
   - [ ] Add default: `focus ?? 'both'`

### Phase 2: Frontend UI ✅ (Planned)

5. **Update AnalysisTab Component**
   - [ ] Replace single "Tune Dialog Beat" button with four-button layout
   - [ ] Add section headers ("Analyze & Suggest Improvements:", "Focused:")
   - [ ] Create primary button container (Dialogue & Beats, Prose)
   - [ ] Create focused button container (Dialogue Only, Microbeats Only)
   - [ ] Add icons to buttons (🎭, 📝, 💬)

6. **Update useAnalysis Hook**
   - [ ] Update dialogue analysis dispatcher to include `focus` in payload
   - [ ] Create helper for each button variant

7. **Add CSS Styling**
   - [ ] Add `.analysis-buttons-section` styles
   - [ ] Add `.primary-buttons` container (flex, larger buttons)
   - [ ] Add `.focused-buttons` container (flex, smaller buttons)
   - [ ] Add `.action-button.primary` styles
   - [ ] Add `.action-button.secondary` styles
   - [ ] Add hover/disabled states
   - [ ] Test in light and dark themes

### Phase 3: Testing ✅ (Planned)

8. **Functional Testing**
   - [ ] Verify "Dialogue & Beats" produces balanced analysis
   - [ ] Verify "Dialogue Only" emphasizes dialogue, minimal beats
   - [ ] Verify "Microbeats Only" emphasizes beats, minimal dialogue
   - [ ] Verify "Prose" button unchanged
   - [ ] Test focus parameter flows through backend correctly

9. **UI Testing**
   - [ ] Verify visual hierarchy (primary vs focused clear)
   - [ ] Test hover states on all buttons
   - [ ] Test disabled states during analysis
   - [ ] Verify layout on narrow windows
   - [ ] Test in both light and dark themes
   - [ ] Verify icons render correctly

10. **Documentation**
    - [ ] Update memory bank with completion summary
    - [ ] Create PR description

## Tasks Breakdown

### Backend (60 min)
1. **Message Types & Focus Prompts** (30 min)
   - Add focus parameter to message type
   - Create focus directory and three prompt files
   - Write emphasis instructions for each focus

2. **Tool & Handler Updates** (30 min)
   - Update DialogueMicrobeatAssistant to load focus prompts
   - Update AnalysisHandler to extract and pass focus
   - Verify backward compatibility (default: 'both')

### Frontend (60 min)
3. **Component Updates** (30 min)
   - Replace button in AnalysisTab.tsx
   - Add four-button layout with section headers
   - Wire up focus parameter in message dispatchers

4. **Styling** (30 min)
   - Add primary/secondary button styles
   - Add section header styles
   - Test responsive layout
   - Verify both themes

### Testing & Documentation (30 min)
5. **Testing** (20 min)
   - Manual functional testing (all 4 buttons)
   - UI testing (layout, themes, states)
   - Verify AI responses reflect focus

6. **Documentation** (10 min)
   - Memory bank update
   - PR description

## Acceptance Criteria

### Backend
- [ ] `focus` parameter added to `AnalyzeDialogueRequest` message type
- [ ] Three focus prompt files created (dialogue, microbeats, both)
- [ ] `DialogueMicrobeatAssistant.loadToolPrompts()` accepts focus parameter
- [ ] Focus-specific prompt appended to base prompts
- [ ] `AnalysisHandler` extracts and passes focus to tool
- [ ] Default focus is 'both' (backward compatible)
- [ ] Build passes with no TypeScript errors

### Frontend
- [ ] Four buttons render with clear visual hierarchy
- [ ] Section headers clarify button organization
- [ ] Icons render correctly (🎭, 💬, 📝)
- [ ] Primary buttons larger and more prominent
- [ ] Focused buttons smaller and secondary styled
- [ ] Focus parameter included in message payload
- [ ] All buttons dispatch correct focus value

### Functional
- [ ] "Dialogue & Beats" produces balanced analysis (existing behavior)
- [ ] "Dialogue Only" emphasizes dialogue improvements (80/20)
- [ ] "Microbeats Only" emphasizes action beats (80/20)
- [ ] "Prose" button unchanged and working
- [ ] No results lost when clicking different buttons
- [ ] AI responses clearly reflect focus emphasis

### UI/UX
- [ ] Visual hierarchy clear (primary vs focused)
- [ ] Hover states work on all buttons
- [ ] Disabled states work during analysis
- [ ] Layout works on narrow windows
- [ ] Works in light theme
- [ ] Works in dark theme
- [ ] No layout shifts or visual bugs

## Related

### ADR
- [2025-11-07-focused-dialogue-analysis-buttons.md](../../../docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md)

### Files to Modify

**Backend**:
- `src/shared/types/messages/analysis.ts` - Add focus parameter
- `src/tools/assist/dialogueMicrobeatAssistant.ts` - Accept and use focus
- `src/application/handlers/domain/AnalysisHandler.ts` - Pass focus to tool
- `resources/system-prompts/dialog-microbeat-assistant/focus/` - New prompt files

**Frontend**:
- `src/presentation/webview/components/AnalysisTab.tsx` - Four-button UI
- `src/presentation/webview/hooks/domain/useAnalysis.ts` - Dispatch focus
- `src/presentation/webview/index.css` - Button styling

### Reference Implementations
- Existing dialogue analysis flow (for message pattern)
- Context model selector UI (for button layout inspiration)
- Primary/secondary button patterns (for visual hierarchy)

## Testing Checklist

### Functionality
- [ ] **Dialogue & Beats Button**
  - [ ] Sends `focus: 'both'` in message payload
  - [ ] AI response includes balanced dialogue and beat suggestions
  - [ ] Response structure matches existing output

- [ ] **Dialogue Only Button**
  - [ ] Sends `focus: 'dialogue'` in message payload
  - [ ] AI response emphasizes line-level improvements
  - [ ] Beat suggestions minimal and only where critical

- [ ] **Microbeats Only Button**
  - [ ] Sends `focus: 'microbeats'` in message payload
  - [ ] AI response emphasizes action beat suggestions
  - [ ] Dialogue critique minimal and structural only

- [ ] **Prose Button**
  - [ ] Still works unchanged
  - [ ] No regression in prose analysis

### UI/Styling
- [ ] **Layout**
  - [ ] Primary buttons in top row
  - [ ] Focused buttons in bottom row
  - [ ] Section headers render correctly
  - [ ] Icons display next to button text

- [ ] **Visual Hierarchy**
  - [ ] Primary buttons larger and more prominent
  - [ ] Focused buttons smaller and subtle
  - [ ] Clear distinction between primary and secondary

- [ ] **States**
  - [ ] Hover effect on all buttons
  - [ ] Disabled state during analysis
  - [ ] Focus outline for keyboard navigation

- [ ] **Responsive**
  - [ ] Works on wide windows (> 800px)
  - [ ] Works on medium windows (400-800px)
  - [ ] Works on narrow windows (< 400px)
  - [ ] Buttons wrap gracefully if needed

- [ ] **Themes**
  - [ ] Light theme: good contrast, readable
  - [ ] Dark theme: good contrast, readable
  - [ ] Icons visible in both themes

### Backend
- [ ] **Message Flow**
  - [ ] Focus parameter extracted from message payload
  - [ ] Focus passed to DialogueMicrobeatAssistant
  - [ ] Correct focus prompt loaded and appended
  - [ ] No errors in Output Channel

- [ ] **Backward Compatibility**
  - [ ] Messages without focus default to 'both'
  - [ ] Existing behavior preserved when focus='both'
  - [ ] No breaking changes to message contracts

## Success Metrics

- **User Clarity**: Users understand button purposes without trial-and-error
- **Focused Results**: AI responses clearly emphasize requested focus area
- **Workflow Efficiency**: Users get targeted help without filtering generic analysis
- **No Confusion**: Zero user-reported confusion about button organization
- **Better Suggestions**: User feedback indicates improved relevance of AI suggestions
- **No Regressions**: All existing functionality works unchanged

## Notes

- **Existing Prompts Unchanged**: Base dialogue/microbeat prompts (`00-`, `01-`) remain as-is
- **Additive Pattern**: Focus prompts appended to base prompts (not replacements)
- **Default Behavior**: `focus: 'both'` preserves existing analysis behavior
- **Visual Consistency**: Follows established button patterns from rest of extension
- **Keyboard Accessible**: All buttons support Tab + Enter navigation

## Branch Strategy

**Branch**: `sprint/epic-v1-polish-03-focused-dialogue-buttons`

**Commit Strategy**:
1. Backend: Message types + focus prompts
2. Backend: Tool and handler updates
3. Frontend: Component and hook updates
4. Frontend: CSS styling
5. Testing: Manual verification and fixes
6. Documentation: Memory bank and PR

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Visual clutter (4 buttons vs 2) | Clear hierarchy via styling and section headers |
| User confusion about which to choose | Section labels guide users; "Dialogue & Beats" is primary |
| Breaking existing workflows | "Dialogue & Beats" replicates existing behavior exactly |
| AI doesn't respect focus | Explicit emphasis in focus prompts (80/20, 50/50) |
| Increased maintenance (3 prompt paths) | Conditional prompts use same loading pattern |

## Future Enhancements (v1.1+)

- Character voice-only analysis
- Subtext analysis focus
- Pacing analysis focus
- User-defined focus areas
- Save preferred focus per project
- Combo buttons (dialogue + prose, etc.)

## Completion Summary

**Status**: ✅ **COMPLETE**
**Completion Date**: 2025-11-07
**Actual Time**: ~2 hours (matched estimate)

### ✅ Implemented

**Files Modified**:
- `src/presentation/webview/components/AnalysisTab.tsx` - Four-button UI with section headers
- `src/tools/assist/dialogueMicrobeatAssistant.ts` - Focus parameter support
- `src/application/handlers/domain/AnalysisHandler.ts` - Extract and pass focus to tool
- `src/shared/types/messages/analysis.ts` - Added focus to AnalyzeDialogueRequest
- `resources/system-prompts/dialog-microbeat-assistant/focus/` - Created focus-specific prompts
  - `both.md` - Balanced analysis (50/50)
  - `dialogue.md` - Dialogue emphasis (80/20)
  - `microbeats.md` - Microbeats emphasis (80/20)

**Features**:
- ✅ Four-button layout with clear visual hierarchy
- ✅ Primary buttons: 🎭 Dialogue & Beats, 📝 Prose
- ✅ Focused buttons: 💬 Dialogue Only, 🎭 Microbeats Only
- ✅ Section headers: "Analyze & Suggest Improvements:" and "Focused:"
- ✅ Focus parameter flows through full stack (UI → Handler → Service → Tool)
- ✅ Focus-specific prompts appended to base prompts
- ✅ Default behavior: `focus: 'both'` (backward compatible)

**What Was NOT Implemented**:
- None - all planned features implemented

### Testing Notes

**Manual Testing Verified**:
- ✅ All four buttons render correctly with icons
- ✅ Visual hierarchy clear (primary vs focused distinction)
- ✅ Focus parameter included in message payload
- ✅ AI responses reflect focus emphasis (dialogue-heavy vs beats-heavy)
- ✅ No regressions in existing prose analysis button
- ✅ Works in both light and dark themes

### Next Steps

- Epic complete - all 4 sprints done (Sprint 03 was last)
- v1 Polish epic ready for archival or final review
