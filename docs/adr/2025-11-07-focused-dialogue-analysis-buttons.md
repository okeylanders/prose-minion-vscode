# ADR: Focused Dialogue Analysis Buttons

**Date**: 2025-11-07
**Status**: Implemented (with changes)
**Implemented**: 2025-11-08
**Priority**: MEDIUM (v1.0 Polish)
**Category**: UX Improvement

> **Implementation Note**: The final implementation evolved from this proposal. Instead of the 4-button layout proposed here (Dialogue & Beats, Prose, Dialogue Only, Microbeats Only), the actual implementation uses **4 Focus Tools**: Fresh Check, Writing Tools, Dialogue, and Prose. The core concept of focused analysis was preserved, but the specific button structure and focus options differ. See commits 18f4cbe, 909f004, 60ad091 for implementation details.

## Context

The Assistant tab currently provides two analysis buttons:
1. **"Tune Dialog Beat"** - Analyzes dialogue and suggests microbeats
2. **"Tune Prose"** - Analyzes prose quality

### Current State

The dialogue analysis tool (`dialogueMicrobeatAssistant`) performs **dual functionality**:
- Suggests improvements to dialogue lines (word choice, subtext, character voice)
- Suggests action beats/microbeats to break up dialogue and add physical grounding

However, the current single-button UI hides this dual functionality and doesn't allow users to focus the analysis on their specific needs.

**Current Button Labels**:
```
[Tune Dialog Beat]  [Tune Prose]
```

## Problem

### 1. Unclear Naming
- **"Tune Dialog Beat"** - What does "tune" mean in this context?
  - Is it improving dialogue? Adding beats? Both?
  - "Dialog" is a less common spelling (standard is "dialogue")
- **Cognitive Load** - User must click to discover what the tool does

### 2. Hidden Dual Functionality
- Tool provides both dialogue refinement AND microbeat suggestions
- Single button obscures this dual capability
- Users can't choose to focus on one aspect

### 3. Forced Sequential Workflow
Without separate focused buttons:
- User clicks "Tune Dialog Beat" → waits 30s → gets dialogue + microbeat suggestions
- If user wants ONLY dialogue help → no way to request focused analysis
- If user wants ONLY microbeat help → no way to exclude dialogue analysis
- **Result**: AI must guess what user needs instead of being told explicitly

### 4. Lost Results Problem
If trying to get separate focused analyses:
1. Click button → wait 30s → get results
2. Click button again with different focus → **previous results overwritten**
3. User must manually save results between runs (copy/paste workflow)

### 5. Suboptimal AI Responses
- AI doesn't know whether to emphasize dialogue or microbeats
- Generic "analyze everything" approach reduces quality
- Wastes tokens on unwanted analysis

## Decision

**Split dialogue analysis into focused buttons with clear visual hierarchy:**

```
Analyze & Suggest Improvements:
[🎭 Dialogue & Beats]  [📝 Prose]

Focused:
[💬 Dialogue Only]  [🎭 Microbeats Only]
```

**Button Responsibilities**:

1. **🎭 Dialogue & Beats** (Primary)
   - Analyzes both dialogue lines AND microbeat opportunities
   - Balanced focus on both aspects
   - Default choice for most users
   - Replaces current "Tune Dialog Beat" button

2. **📝 Prose** (Primary)
   - Existing prose analysis tool
   - Unchanged functionality

3. **💬 Dialogue Only** (Focused)
   - Analyzes dialogue lines exclusively
   - Emphasizes word choice, subtext, character voice
   - Only mentions beats where critical for clarity

4. **🎭 Microbeats Only** (Focused)
   - Suggests action beats and physical grounding
   - Focuses on pacing and static dialogue issues
   - Only mentions dialogue where it impacts beat placement

## Solution

### 1. Backend: Add Focus Parameter

Update message contract to support analysis focus:

```typescript
// src/shared/types/messages/analysis.ts
export interface AnalyzeDialogueRequest extends BaseMessage {
  type: MessageType.ANALYZE_DIALOGUE;
  payload: {
    text: string;
    context?: string;
    guides?: string[];
    focus?: 'dialogue' | 'microbeats' | 'both'; // NEW
    // ... other fields
  };
}
```

**Default**: `focus: 'both'` (maintains backward compatibility)

### 2. System Prompt: Focus-Specific Emphasis (Additive)

**Existing prompts remain unchanged**:

- `00-dialog-microbeat-assistant.md` - Role definition, structure, examples (comprehensive)
- `01-dialogue-tags-and-microbeats.md` - Craft guide with tags and microbeat examples

**Add new `focus/` subfolder** with emphasis prompts that are **appended** to base prompts:

```text
resources/system-prompts/dialog-microbeat-assistant/
├── 00-dialog-microbeat-assistant.md      # UNCHANGED - Base role
├── 01-dialogue-tags-and-microbeats.md    # UNCHANGED - Craft guide
└── focus/                                # NEW - Conditional emphasis
    ├── dialogue.md                       # Loaded when focus='dialogue'
    ├── microbeats.md                     # Loaded when focus='microbeats'
    └── both.md                           # Loaded when focus='both' (default)
```

**Focus-specific prompts** (short, emphasis-only):

**`focus/dialogue.md`**:

```markdown
# ANALYSIS FOCUS: Dialogue Line Refinement

For this analysis, prioritize dialogue line improvements:

**PRIMARY EMPHASIS** (80% of suggestions):
- Word choice and vocabulary precision
- Subtext and implied meaning
- Character voice consistency
- Rhythm, cadence, and flow
- Emotional authenticity in lines

**SECONDARY** (20% of suggestions):
- Microbeat opportunities ONLY where critical for clarity or pacing
- Keep beat suggestions minimal and focused on essential moments

Your 🎲 Creative Variations section should explore different dialogue phrasings, word choices, and subtext approaches rather than beat variations.
```

**`focus/microbeats.md`**:
```markdown
# ANALYSIS FOCUS: Action Beats and Physical Grounding

For this analysis, prioritize microbeat suggestions:

**PRIMARY EMPHASIS** (80% of suggestions):
- Breaking up long dialogue sequences
- Physical grounding and setting details
- Pacing variety through action
- Showing character state via movement
- Preventing talking-heads syndrome

**SECONDARY** (20% of suggestions):
- Dialogue issues ONLY where they directly impact beat placement or pacing
- Keep dialogue critique minimal and structural

Your 🎲 Creative Variations section should explore different beat types, physical actions, and pacing rhythms rather than line rewrites.
```

**`focus/both.md`**:
```markdown
# ANALYSIS FOCUS: Balanced Dialogue and Microbeats

For this analysis, provide balanced coverage of both aspects:

**EQUAL EMPHASIS** (50/50 split):
- Dialogue quality: word choice, subtext, voice, rhythm, authenticity
- Microbeat opportunities: action beats, pacing, grounding, physicality

Your 🎲 Creative Variations section should explore variations that combine different dialogue approaches WITH different beat strategies.
```

### 3. Frontend: Four-Button UI

Replace single "Tune Dialog Beat" button with four focused buttons:

```tsx
// src/presentation/webview/components/AnalysisTab.tsx

<div className="analysis-buttons-section">
  <h4>Analyze & Suggest Improvements:</h4>
  <div className="primary-buttons">
    <button
      className="action-button primary"
      onClick={() => handleAnalyze('dialogue', 'both')}
      disabled={isAnalyzing}
    >
      🎭 Dialogue & Beats
    </button>
    <button
      className="action-button primary"
      onClick={() => handleAnalyze('prose', undefined)}
      disabled={isAnalyzing}
    >
      📝 Prose
    </button>
  </div>

  <h5>Focused:</h5>
  <div className="focused-buttons">
    <button
      className="action-button secondary"
      onClick={() => handleAnalyze('dialogue', 'dialogue')}
      disabled={isAnalyzing}
    >
      💬 Dialogue Only
    </button>
    <button
      className="action-button secondary"
      onClick={() => handleAnalyze('dialogue', 'microbeats')}
      disabled={isAnalyzing}
    >
      🎭 Microbeats Only
    </button>
  </div>
</div>
```

### 4. Styling: Visual Hierarchy

Differentiate primary vs focused buttons:

```css
/* Primary actions: larger, more prominent */
.primary-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.action-button.primary {
  flex: 1;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.action-button.primary:hover {
  background: var(--vscode-button-hoverBackground);
}

/* Focused analysis: smaller, secondary styling */
.focused-buttons {
  display: flex;
  gap: 8px;
}

.action-button.secondary {
  flex: 1;
  padding: 6px 12px;
  font-size: 13px;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.action-button.secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}
```

## Architecture Alignment

### Clean Architecture Adherence ✅

1. **Domain Separation**
   - UI layer: Button clicks and user interaction
   - Message layer: Focus parameter in typed contracts
   - Domain layer: Analysis logic respects focus setting
   - Infrastructure layer: Prompt loading and OpenRouter calls

2. **Message Envelope Pattern**
   - Uses standard envelope structure
   - Source tracking: `webview.analysis.tab` → `extension.analysis`
   - Focus parameter in payload (type-safe)

3. **Single Responsibility**
   - UI owns button presentation and user intent capture
   - AnalysisHandler owns orchestration
   - ProseAnalysisService owns AI interaction
   - Prompts define AI behavior based on focus

4. **Open/Closed Principle**
   - Extends existing dialogue analysis without breaking changes
   - Focus parameter is optional (defaults to 'both')
   - New buttons call existing message types with different payloads

## Implementation Approach

### Phase 1: Backend Support

**1. Update message type** (`src/shared/types/messages/analysis.ts`):

```typescript
export interface AnalyzeDialogueRequest extends BaseMessage {
  type: MessageType.ANALYZE_DIALOGUE;
  payload: {
    text: string;
    context?: string;
    guides?: string[];
    focus?: 'dialogue' | 'microbeats' | 'both'; // NEW
  };
}
```

**2. Create focus-specific prompts** (`resources/system-prompts/dialog-microbeat-assistant/focus/`):

- `dialogue.md` - Emphasis on dialogue line improvements
- `microbeats.md` - Emphasis on action beats
- `both.md` - Balanced analysis (default)

**3. Update `DialogueMicrobeatAssistant`** (`src/tools/assist/dialogueMicrobeatAssistant.ts`):

```typescript
// Update loadToolPrompts to accept focus
private async loadToolPrompts(focus: 'dialogue' | 'microbeats' | 'both' = 'both'): Promise<string> {
  try {
    // Always load base prompts
    const basePaths = [
      'dialog-microbeat-assistant/00-dialog-microbeat-assistant.md',
      'dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md'
    ];

    // Add focus-specific prompt (appended to base)
    const focusPath = `dialog-microbeat-assistant/focus/${focus}.md`;

    return await this.promptLoader.loadPrompts([
      ...basePaths,
      focusPath
    ]);
  } catch (error) {
    console.warn('Could not load dialog microbeat prompts, using defaults');
    return this.getDefaultInstructions();
  }
}

// Update analyze method to accept focus
async analyze(
  input: DialogueMicrobeatInput,
  options?: DialogueMicrobeatOptions & { focus?: 'dialogue' | 'microbeats' | 'both' }
): Promise<ExecutionResult> {
  const sharedPrompts = await this.promptLoader.loadSharedPrompts();
  const toolPrompts = await this.loadToolPrompts(options?.focus ?? 'both');
  // ... rest of method unchanged
}
```

**4. Update `AnalysisHandler`** to extract and pass focus:

```typescript
async handleAnalyzeDialogue(message: AnalyzeDialogueMessage): Promise<void> {
  const { text, context, guides, focus } = message.payload;

  const result = await this.dialogueAssistant.analyze(
    { text, contextText: context },
    {
      includeCraftGuides: guides && guides.length > 0,
      focus: focus ?? 'both' // Pass focus, default to 'both'
    }
  );
  // ... rest of handler
}
```

### Phase 2: Frontend UI

**5. Update `AnalysisTab.tsx`** to render four buttons with visual hierarchy:

- Replace single "Tune Dialog Beat" button
- Add section headers for organization
- Implement primary/secondary button styling

**6. Update `useAnalysis` hook** to dispatch focus parameter in message payload

**7. Add CSS** for primary vs secondary button styling (visual hierarchy)

### Phase 3: Testing

**8. Functional Testing**:

- Verify "Dialogue & Beats" produces balanced analysis (existing behavior)
- Verify "Dialogue Only" emphasizes line-level improvements
- Verify "Microbeats Only" emphasizes action beats
- Verify "Prose" button unchanged

**9. UI Testing**:

- Test visual hierarchy (primary vs focused buttons clear)
- Verify hover states and disabled states
- Test in light and dark themes

## Benefits

### User Experience
1. **Clear Intent** - User tells AI exactly what they need
2. **Focused Results** - AI emphasizes requested aspect (better quality)
3. **No Lost Results** - User can get both analyses without overwriting
4. **Discoverability** - Dual functionality now visible in UI
5. **Professional Terminology** - "Dialogue" (standard spelling) and "Microbeats" (industry term)

### Development
6. **Better AI Prompts** - Conditional focus yields more targeted suggestions
7. **Token Efficiency** - Focused analysis may use fewer tokens (less to analyze)
8. **Extensibility** - Easy to add more focused analysis types in future
9. **Clean Architecture** - Follows established message and domain patterns

### Power Users
10. **Workflow Optimization** - Run only needed analysis (save time/cost)
11. **Comparative Analysis** - Run dialogue-only, then microbeats-only to see differences
12. **Learning Tool** - Focused results help writers understand each aspect separately

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Visual clutter (4 buttons vs 2) | Clear hierarchy via styling (primary/focused) and headings |
| User confusion about "Both" vs focused | "Dialogue & Beats" is primary, focused are labeled as advanced |
| Breaking existing workflows | "Dialogue & Beats" replicates existing behavior exactly |
| Increased maintenance (3 prompt paths) | Conditional prompts use same file with template logic |
| Users unsure which to choose | Section headings guide users; "Both" is default choice |

## Testing Checklist

- [ ] **Dialogue & Beats** produces balanced analysis (dialogue + microbeats equally)
- [ ] **Dialogue Only** emphasizes line improvements, minimal beat suggestions
- [ ] **Microbeats Only** emphasizes action beats, minimal dialogue critique
- [ ] **Prose** button unchanged and working
- [ ] Visual hierarchy clear (primary buttons prominent, focused buttons secondary)
- [ ] Button disabled states work during analysis
- [ ] Results don't overwrite between button clicks
- [ ] Hover states provide visual feedback
- [ ] Works in light and dark themes
- [ ] No TypeScript errors
- [ ] No regression in existing prose analysis

## Architecture Debt

**None**. This implementation:
- ✅ Follows message envelope pattern
- ✅ Extends existing contracts (backward compatible)
- ✅ Uses domain-specific handlers
- ✅ Maintains clean layer boundaries
- ✅ No god components or cross-cutting violations

## Alternatives Considered

### 1. Keep Single Button (Status Quo)
- **Pros**: Simpler UI, no changes needed
- **Cons**: Unclear naming, hidden functionality, no user control
- **Decision**: Rejected - Doesn't solve core problems

### 2. Three Buttons (No "Both" Option)
```
[💬 Dialogue]  [🎭 Microbeats]  [📝 Prose]
```
- **Pros**: Simpler, no "Both" needed
- **Cons**: User must run both tools sequentially, results overwrite (30s × 2 = 60s wait)
- **Decision**: Rejected - Forces poor workflow, loses previous results

### 3. Dropdown/Split Button
```
[🎭 Dialogue & Beats ▼]  [📝 Prose]
  ↓ Dialogue Only
  ↓ Microbeats Only
  ↓ Both
```
- **Pros**: Compact, single button with options
- **Cons**: Hidden options, extra click required, less discoverable
- **Decision**: Rejected - Hides focused options, adds complexity

### 4. Four Equal Buttons (No Hierarchy)
```
[💬 Dialogue]  [🎭 Microbeats]  [💬🎭 Both]  [📝 Prose]
```
- **Pros**: All options visible and equal
- **Cons**: No guidance on which to choose, visual clutter
- **Decision**: Rejected - Lacks clear default choice

### 5. Radio Buttons + Single Analyze Button
```
○ Dialogue Only
○ Microbeats Only
● Both
[Analyze Dialogue]  [Analyze Prose]
```
- **Pros**: Explicitly shows options
- **Cons**: Requires two clicks (select + analyze), stateful UI, less intuitive
- **Decision**: Rejected - More complex interaction pattern

## Future Enhancements (v1.1+)

### Advanced Focus Options
- **Character Voice Only** - Focus exclusively on voice consistency
- **Subtext Analysis** - Surface implied meanings and undertones
- **Pacing Analysis** - Analyze dialogue rhythm and tempo

### Customizable Focus
- User-defined focus areas via settings
- Save preferred focus per project
- Quick-pick menu for focus selection

### Focus Presets
- "Line Polish" preset (dialogue + voice + subtext)
- "Pacing Fix" preset (microbeats + rhythm)
- "Full Scene Analysis" preset (dialogue + beats + prose)

### Combo Buttons
- "Dialogue & Prose" (analyze dialogue and prose together)
- "Full Scene" (dialogue, beats, prose all at once)

## Acceptance Criteria

- [ ] Four buttons render with clear visual hierarchy
- [ ] "Dialogue & Beats" produces balanced analysis (existing behavior maintained)
- [ ] "Dialogue Only" emphasizes dialogue, minimal beat suggestions
- [ ] "Microbeats Only" emphasizes beats, minimal dialogue critique
- [ ] "Prose" button works unchanged
- [ ] Primary buttons visually distinct from focused buttons
- [ ] Section headings clarify button organization
- [ ] No results lost when clicking different buttons
- [ ] Focus parameter properly passed through message envelope
- [ ] System prompt respects focus parameter
- [ ] Works in light and dark themes
- [ ] Build passes with no TypeScript errors
- [ ] No regression in existing functionality

## References

- Current Implementation: [AnalysisTab.tsx](../../src/presentation/webview/components/AnalysisTab.tsx) (lines 78-84 in screenshot)
- Message Contracts: [src/shared/types/messages/analysis.ts](../../src/shared/types/messages/analysis.ts)
- Analysis Handler: [src/application/handlers/domain/AnalysisHandler.ts](../../src/application/handlers/domain/AnalysisHandler.ts)
- System Prompts: [resources/system-prompts/dialogue-microbeat-assistant/](../../resources/system-prompts/dialogue-microbeat-assistant/)
- Similar Pattern: Clickable Resource Pills ([ADR 2025-11-02](./2025-11-02-clickable-resource-pills.md))

## Success Metrics

- **User Clarity**: Users understand button purposes without trial-and-error
- **Focused Results**: AI responses clearly emphasize requested focus area
- **Workflow Efficiency**: Users can get targeted help without filtering generic analysis
- **No Confusion**: Zero user-reported confusion about button organization
- **Better Suggestions**: User feedback indicates improved relevance of AI suggestions

## Icon Rationale

- **🎭 Theater Mask**: Represents both dialogue (spoken performance) and microbeats (physical performance)
- **💬 Speech Bubble**: Represents spoken dialogue
- **📝 Writing**: Represents prose crafting

The theater mask (🎭) serves double-duty for "Dialogue & Beats" since theatrical performance inherently combines both spoken lines and physical action - a perfect metaphor for the dual focus.
