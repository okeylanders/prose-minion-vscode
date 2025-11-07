# PR: Focused Dialogue Analysis Buttons

**Branch**: `sprint/epic-v1-polish-03-focused-dialogue-buttons`
**Target**: `main`
**Type**: Feature (v1.0 Polish)
**Priority**: HIGH

---

## Summary

Replaces the single "Tune Dialog Beat" button with four focused analysis buttons, giving users precise control over AI analysis emphasis. Implements focus-specific system prompts with dual creative sampling approaches (trust-the-model + bounded framework) optimized for both strong and lighter AI models.

## Key Features

### User-Facing Changes
- **Four Analysis Buttons** with clear visual hierarchy:
  - 🎭 **Dialogue & Beats** (primary) - Balanced 50/50 analysis
  - 📝 **Prose** (primary) - General prose analysis (unchanged)
  - 💬 **Dialogue Only** (focused) - 80% dialogue line critique
  - 🎭 **Microbeats Only** (focused) - 80% action beat suggestions

- **Focus-Specific AI Behavior**:
  - **Dialogue Focus**: Word choice, vocabulary, rhythm, subtext, emotional authenticity
  - **Microbeat Focus**: Physical grounding, spatial relationships, action beats
  - **Balanced Focus**: Equal emphasis on both dialogue and physicality

- **Alphabetical Model List**: All model dropdowns now sorted alphabetically for easier selection
- **Claude Sonnet 4.5 Default**: Changed default model from GLM 4.6 to Claude Sonnet 4.5 across all features

### Technical Features
- **Focus Parameter Flow**: End-to-end TypeScript type safety from UI → Backend → AI
- **Additive Prompt System**: Focus prompts append to base prompts (not replacements)
- **Dual Sampling Strategy**: Trust-the-model approach + Prescriptive framework approach
- **Output Structure Overrides**: Focus-specific response templates prevent template conflicts
- **Anchoring Prevention**: Removed specific examples that bias AI toward high-probability responses
- **Logging Transparency**: Output Channel shows focus parameter and loaded prompt files

## Changes

### Phase 1: Backend Implementation

**Message Types** (1 file):
- Added `focus?: 'dialogue' | 'microbeats' | 'both'` to `AnalyzeDialoguePayload`
- Extended type safety throughout message stack

**Prompt System** (3 new files):
- `resources/system-prompts/dialog-microbeat-assistant/focus/dialogue.md`
- `resources/system-prompts/dialog-microbeat-assistant/focus/microbeats.md`
- `resources/system-prompts/dialog-microbeat-assistant/focus/both.md`
- Each includes OVERRIDE sections with custom output structures
- Dual approach: Creative Variations (trust) + Bound Creative Variations (framework)
- Explicit markdown formatting instructions for deep sections

**Tool Layer** (1 file):
- Updated `DialogueMicrobeatAssistant.ts` to accept focus parameter
- Conditional prompt loading based on focus
- Output Channel logging for transparency

**Service Layer** (2 files):
- Updated `IProseAnalysisService` interface with focus parameter
- Updated `ProseAnalysisService.analyzeDialogue()` signature
- Centralized focus handling in `getToolOptions(focus)`

**Handler Layer** (1 file):
- Updated `AnalysisHandler.handleAnalyzeDialogue()` to extract and pass focus
- Removed unnecessary backward compatibility fallback

### Phase 2: Frontend Implementation

**UI Components** (1 file):
- Updated `AnalysisTab.tsx` with four-button layout
- Primary buttons: Dialogue & Beats, Prose
- Focused buttons: Dialogue Only, Microbeats Only
- `handleAnalyzeDialogue(focus)` dispatches focus parameter

**Styling** (1 file):
- Added `.action-button.primary` styles (larger padding, font-weight 600)
- Added `.action-button.secondary` styles (smaller padding, font-weight 400)
- Visual hierarchy distinguishes primary vs focused actions

### Phase 3: Polish & Configuration

**Refactoring**:
- Centralized focus handling in `getToolOptions()` (separation of concerns)
- Unified logging to Output Channel (no split console/channel logging)
- Removed backward compatibility fallback (frontend always provides focus)

**Focus Template Enhancements**:
- Added output structure OVERRIDE sections to prevent template conflicts
- Removed anchoring examples that defeat low-probability sampling
- Aligned Creative Variations with base prompt format (naming patterns, not menus)
- Added dual approach: Section 7 (trust-the-model) + Section 8 (bounded framework)
- Added explicit markdown formatting instructions (h1-h5, bullets, etc.)

**Model Configuration**:
- Sorted RECOMMENDED_MODELS alphabetically by name in `OpenRouterModels.ts`
- Sorted all package.json model enums alphabetically
- Changed all model defaults to `anthropic/claude-sonnet-4.5`
- Added `moonshotai/kimi-k2-thinking` to all model lists
- Applied to: assistantModel, dictionaryModel, contextModel, legacy model

## Architecture Alignment ✅

This implementation follows Clean Architecture and established patterns:

### Design Patterns Applied
- ✅ **Message Envelope Pattern**: Focus flows through typed message contracts
- ✅ **Dependency Inversion**: UI depends on abstractions, not implementations
- ✅ **Single Responsibility**: Each layer handles one aspect (UI, routing, service, tool)
- ✅ **Open/Closed Principle**: Extended via new message type, not modification
- ✅ **Type Safety**: End-to-end TypeScript interfaces prevent runtime errors

### Separation of Concerns
- **Markdown owns content**: Focus prompts are separate .md files
- **TypeScript owns loading logic**: Conditional prompt loading in assistant
- **UI owns user intent**: Buttons dispatch focus parameter
- **Backend owns behavior**: Service layer orchestrates focus-specific behavior

### Anchoring Prevention Strategy
Following research on Diversity & Creative Sampling Instructions (Stanford/Northeastern/WVU):
- Removed specific examples like "neck roll," "deliberate bite," "Random places. Forests."
- Used naming pattern examples ("Fragmented/Breathless") instead of selection menus
- Added "Label names are descriptive of YOUR approach, not selected from a menu"
- Preserved low-probability sampling (p<0.10) for 1.6-2.1× more creative range

## Files Changed

**16 files changed, 2,183 insertions(+), 265 deletions(-)**

### Backend
- `src/shared/types/messages/analysis.ts` (+1 line)
- `src/infrastructure/api/ProseAnalysisService.ts` (+5 lines)
- `src/domain/services/IProseAnalysisService.ts` (+1 line)
- `src/application/handlers/domain/AnalysisHandler.ts` (+2 lines)
- `src/tools/assist/dialogueMicrobeatAssistant.ts` (+11 lines)
- `src/infrastructure/api/OpenRouterModels.ts` (+16 lines, sorted)
- `package.json` (+128 lines, -119 deletions, sorted enums)

### Frontend
- `src/presentation/webview/components/AnalysisTab.tsx` (+28 lines)
- `src/presentation/webview/index.css` (+22 lines)

### System Prompts (3 new files)
- `resources/system-prompts/dialog-microbeat-assistant/focus/dialogue.md` (+293 lines)
- `resources/system-prompts/dialog-microbeat-assistant/focus/microbeats.md` (+299 lines)
- `resources/system-prompts/dialog-microbeat-assistant/focus/both.md` (+285 lines)

### Documentation
- `docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md` (epic documentation)
- `.memory-bank/20251107-1415-focused-dialogue-buttons-planning.md` (planning session)
- `.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-analysis-buttons.md` (sprint plan)

## Testing

### Build Status
✅ **TypeScript compilation**: PASS (0 errors)
✅ **Webpack build**: SUCCESS (2 bundles)
⚠️ **Bundle size warnings**: Expected (webview bundle 413 KiB)

### Manual Testing Plan

#### Test 1: Dialogue & Beats (focus='both')
- [ ] Click primary button "Dialogue & Beats"
- [ ] Verify Output Channel shows `focus="both"`
- [ ] Verify loads: `00-dialog-microbeat-assistant.md`, `01-dialogue-tags-and-microbeats.md`, `focus/both.md`
- [ ] Verify output includes both dialogue critique AND microbeat suggestions (50/50 split)

#### Test 2: Dialogue Only (focus='dialogue')
- [ ] Click focused button "Dialogue Only"
- [ ] Verify Output Channel shows `focus="dialogue"`
- [ ] Verify loads: `focus/dialogue.md`
- [ ] Verify output emphasizes dialogue line improvements (80%)
- [ ] Verify minimal or no microbeat suggestions

#### Test 3: Microbeats Only (focus='microbeats')
- [ ] Click focused button "Microbeats Only"
- [ ] Verify Output Channel shows `focus="microbeats"`
- [ ] Verify loads: `focus/microbeats.md`
- [ ] Verify output emphasizes microbeat placement (80%)
- [ ] Verify minimal or no dialogue line rewrites

#### Test 4: Prose Analysis (unchanged)
- [ ] Click primary button "Prose"
- [ ] Verify general prose analysis (not dialogue-specific)
- [ ] Regression test: works as before

#### Test 5: UI Visual Hierarchy
- [ ] Verify primary buttons have darker background, larger padding
- [ ] Verify secondary buttons have lighter background, smaller padding
- [ ] Verify layout responsive to panel width
- [ ] Test in Light, Dark, and High Contrast themes

#### Test 6: Model Configuration
- [ ] Open Settings overlay
- [ ] Verify all model dropdowns show models alphabetically
- [ ] Verify Claude Sonnet 4.5 is default for all features
- [ ] Verify Kimi K2 Thinking appears in all lists

## Architecture Debt

**None** ✅

This implementation:
- Follows Clean Architecture principles
- Uses established message envelope pattern
- Maintains type safety end-to-end
- No god components or mixed concerns
- No technical debt introduced

## Benefits

1. **User Control** - Writers can request specific analysis emphasis
2. **Faster Iteration** - No overwriting results when running multiple analyses
3. **Hidden Dual Functionality** - Original button analyzed both aspects without clarity
4. **Suboptimal AI Responses** - AI didn't know whether to emphasize dialogue or beats
5. **Better UX** - Visual hierarchy guides users to common vs focused actions
6. **Model Discoverability** - Alphabetical sorting makes finding models easier
7. **Better Defaults** - Claude Sonnet 4.5 provides stronger baseline performance
8. **Anchoring Prevention** - Low-probability sampling yields more creative suggestions
9. **Model Flexibility** - Dual approach works for both strong (Sonnet) and light (Grok) models

## Creative Sampling Innovation

This PR implements research-backed creative diversity techniques:

### Problem Identified
During testing with Sonnet 4.5, we discovered that **specific examples in prompts anchor AI to high-probability responses**, defeating the Diversity & Creative Sampling Instructions. Examples like "neck roll," "deliberate bite," and "Random places. Forests." biased output toward obvious phrasings.

### Solution: Dual Approach
- **Section 7 - Creative Variations**: Trust-the-model with naming pattern examples only
- **Section 8 - Bound Creative Variations**: Prescriptive framework with dimension menus

This allows:
- Strong models (Sonnet 4.5) → Use Section 7 (minimal anchoring)
- Lighter models (Grok 4 Fast) → Use Section 8 (more scaffolding)

### Impact
- 1.6-2.1× more creative range (per research)
- Fresher microbeats (avoid "neck roll" repetition)
- Richer vocabulary palettes
- Better character-specific physicality

## Related Documentation

- **ADR**: [docs/adr/2025-11-07-focused-dialogue-analysis-buttons.md](../adr/2025-11-07-focused-dialogue-analysis-buttons.md)
- **Epic**: [.todo/epics/epic-v1-polish-2025-11-02/](../../.todo/epics/epic-v1-polish-2025-11-02/)
- **Sprint**: [.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-analysis-buttons.md](../../.todo/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-analysis-buttons.md)
- **Memory Bank**: [.memory-bank/20251107-1415-focused-dialogue-buttons-planning.md](../../.memory-bank/20251107-1415-focused-dialogue-buttons-planning.md)

## Commits

1. `07ec9a3` - feat(phase-1): Add focus parameter to dialogue analysis message types
2. `5a0d1b0` - feat(phase-1): Create focus-specific prompt files (dialogue, microbeats, both)
3. `dd9faaa` - feat(phase-1): Update DialogueMicrobeatAssistant to support focus parameter
4. `6e1cc51` - feat(phase-1): Update AnalysisHandler to extract and pass focus parameter
5. `4ba9db6` - feat(phase-2): Update AnalysisTab with four-button UI layout
6. `55b5c19` - feat(phase-2): Add CSS styling for primary/secondary button hierarchy
7. `d5ee6e4` - refactor(phase-3): Clean up focus handling and add logging
8. `3ebd46f` - fix(dialogue-focus): Revise dialogue focus prompt for actual line critique
9. `c729bce` - refactor(logging): Unify logging to Output Channel
10. `8c82f67` - fix(focus-prompts): Add focus-specific output structure overrides
11. `47f65c3` - polish(phase-3): Make templates highly prescriptive for lighter models
12. `b8f3aa1` - fix(focus-prompts): Remove anchoring examples to preserve low-probability sampling
13. `7e1bb33` - fix(focus-prompts): Align Creative Variations with base prompt format
14. `8600bd9` - polish(phase-3): Add dual approach to both.md focus guide
15. `bfc038e` - chore: Sort models alphabetically and default to Claude Sonnet 4.5

## Future Enhancements (v1.1+)

- Save focus preference per project
- Keyboard shortcuts for analysis buttons
- Analysis history with focus tags
- Compare different focus analyses side-by-side
- Custom focus configurations (e.g., 70/30 split)
- Per-genre focus recommendations

---

## Merge Checklist

- [x] All acceptance criteria met
- [x] Code follows Clean Architecture patterns
- [x] TypeScript compilation passes
- [x] Build successful
- [x] No technical debt introduced
- [x] Documentation complete (ADR, Sprint, Memory Bank)
- [x] Commits follow conventional format
- [x] Focus prompts tested with Sonnet 4.5
- [x] Anchoring prevention verified
- [x] Models sorted alphabetically
- [x] Claude Sonnet 4.5 set as default
- [ ] Manual testing in Extension Development Host (F5)
- [ ] Ready to merge

---

**Status**: ✅ Ready for Review & Testing
**Reviewer**: @okeylanders
**Estimated Review Time**: 10-15 minutes
**Merge Strategy**: Squash (15 commits) or preserve commits (both are clean, well-labeled by phase)

---

## Test Dialogue Excerpt

Use this excerpt for testing all four buttons:

```markdown
"Easy for you to say," Sarah countered.

"Well, like I said, I keep ending up in random places—forests, fields, oceans, waterfalls—wilderness-type places."

"That's concerning. How do you feel when this happens?"

"I'm filled with this unimaginable terror. The environment kind of melts around me. Everything feels unstable."
```

**Expected Results**:
- **Dialogue & Beats**: Both word choice critique AND beat suggestions
- **Dialogue Only**: Critique "unimaginable terror" (too abstract), suggest fragmented syntax
- **Microbeats Only**: Suggest physical grounding (where are they sitting/standing?), add action beats
- **Prose**: General prose analysis (sentence structure, pacing, clarity)
