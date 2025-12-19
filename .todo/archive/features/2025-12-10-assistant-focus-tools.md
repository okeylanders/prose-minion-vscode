# Feature: Additional Assistant Focus Tools

**Date**: 2025-12-10
**Status**: Proposed
**Priority**: Medium

## Overview

Expand the Assistant Tool's focus modes beyond the current **Dialogue Focus** and **Beat Focus** to include additional specialized analysis tools for prose refinement.

## Proposed Focus Tools

### 1. Cliché Analysis

**Purpose**: Identify overused phrases, dead metaphors, and stock expressions that weaken prose.

**What It Catches**:
- Dead metaphors ("cold as ice", "heart of gold")
- Stock phrases ("at the end of the day", "when all is said and done")
- Overused descriptors ("piercing blue eyes", "raven black hair")
- Tired similes and comparisons
- Genre-specific clichés (romance, thriller, fantasy tropes)

**Output**:
- Highlighted clichés with severity rating (mild, moderate, egregious)
- Suggested alternatives or "consider rephrasing" prompts
- Count and density metrics

**Example**:
```
⚠️ CLICHÉ DETECTED: "her heart skipped a beat"
   Frequency: Very common in romance
   Suggestion: Consider a fresh physical reaction specific to this character
```

---

### 2. Scene Continuity Check

**Purpose**: Catch logical inconsistencies within a scene—things that contradict, teleport, or break the reader's spatial/temporal model.

**What It Catches**:

**Choreography Issues**:
- Character positioned at door, then suddenly at window without movement
- Physical impossibilities (reaching something too far away)
- Missing transitions between locations

**Dialogue Contradictions**:
- Character says X, then later claims they said Y
- Information revealed that character shouldn't know yet
- Tone shifts that don't match stated emotion

**Object/Environment Continuity**:
- Items appearing/disappearing (the vanishing coffee cup)
- Weather/lighting inconsistencies within scene
- Props mentioned once then forgotten

**Character State**:
- Injured arm suddenly working fine
- Clothing changes without explanation
- Emotional state whiplash without trigger

**Output**:
```
🔍 CONTINUITY: Sarah set down her wine glass (line 12)
   ⚠️ She "gripped her wine glass tighter" (line 47)
   Note: Glass was set down and not picked up again

🔍 CHOREOGRAPHY: Marcus is "across the room" (line 23)
   ⚠️ He "touched her shoulder" (line 25)
   Note: No movement described between these actions
```

---

### 3. Style Consistency

**Purpose**: Detect stylistic drift within a passage—where voice, tense, POV, or register shifts unintentionally.

**What It Catches**:

**Tense Shifts**:
- Past to present tense drift
- Inconsistent past perfect usage

**POV Breaks**:
- Head-hopping in limited POV
- Knowing things the POV character can't know
- Unearned omniscience in limited perspective

**Register/Voice Drift**:
- Formal to casual language shifts
- Vocabulary level inconsistency
- Character voice bleeding into narration

**Stylistic Inconsistencies**:
- Suddenly using contractions (or not)
- Sentence length pattern breaks
- Punctuation style changes (Oxford comma, em-dash usage)

**Output**:
```
📝 TENSE SHIFT: Passage is past tense
   Line 34: "She walks to the door" (present)
   Suggestion: "She walked to the door"

📝 POV BREAK: Limited 3rd (Sarah's POV)
   Line 56: "Marcus thought she looked beautiful"
   Issue: Sarah can't know Marcus's thoughts
   Suggestion: "Marcus's gaze softened" (observable)
```

---

### 4. Editor (Grammar & Mechanics)

**Purpose**: Traditional copyediting—grammar, spelling, punctuation, and mechanical issues.

**What It Catches**:

**Grammar**:
- Subject-verb agreement
- Pronoun reference clarity
- Dangling/misplaced modifiers
- Comma splices, run-ons, fragments (when unintentional)

**Spelling & Typos**:
- Misspellings
- Homophones (their/there/they're, its/it's)
- Character name consistency

**Punctuation**:
- Dialogue punctuation (commas before tags, periods inside quotes)
- Apostrophe errors
- Missing/extra commas

**Formatting**:
- Inconsistent capitalization
- Number formatting (spelled out vs. digits)
- Ellipsis and em-dash formatting

**Output**:
```
✏️ GRAMMAR: "Neither of the boys were ready"
   Issue: Subject-verb agreement
   Fix: "Neither of the boys was ready"

✏️ HOMOPHONE: "She lead him to the door"
   Issue: Past tense of "lead" is "led"
   Fix: "She led him to the door"

✏️ DIALOGUE PUNCTUATION: "I don't know." She said.
   Issue: Dialogue tag punctuation
   Fix: "I don't know," she said.
```

---

## UI Integration

### Focus Selector (existing pattern, extended)

```
┌─── ANALYSIS FOCUS ─────────────────────────────────┐
│                                                     │
│  ○ Dialogue Focus    ○ Beat Focus                  │
│  ○ Cliché Analysis   ○ Continuity Check            │
│  ○ Style Consistency ○ Editor                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Single-select only. One focus per analysis run to keep output focused and model load manageable.

---

## Implementation Notes

### System Prompts

Each focus tool needs its own system prompt in `resources/system-prompts/assistant/`:

```
resources/system-prompts/assistant/
├── 00-assistant-core.md         # Existing
├── 01-dialogue-focus.md         # Existing
├── 02-beat-focus.md             # Existing
├── 03-cliche-analysis.md        # NEW
├── 04-continuity-check.md       # NEW
├── 05-style-consistency.md      # NEW
├── 06-editor.md                 # NEW
```

### Message Types

May need new focus type enum values:

```typescript
export type AssistantFocus =
  | 'dialogue'
  | 'beat'
  | 'cliche'        // NEW
  | 'continuity'    // NEW
  | 'style'         // NEW
  | 'editor';       // NEW
```

### Settings

Add settings for each focus tool:
- `proseMinion.clicheAnalysis.severity` — minimum severity to report
- `proseMinion.continuityCheck.scope` — scene vs. chapter
- `proseMinion.styleConsistency.strictness` — pedantic vs. relaxed
- `proseMinion.editor.rules` — which rules to enforce

---

## Priority Order

1. **Editor** — Most universally useful, straightforward to implement
2. **Cliché Analysis** — Clear value, bounded scope
3. **Style Consistency** — Valuable for longer works
4. **Continuity Check** — Most complex, requires scene context

---

## Related Files

- Current assistant: `src/tools/assist/proseAssistant.ts`
- Current prompts: `resources/system-prompts/assistant/`
- Focus selection UI: `src/presentation/webview/components/AnalysisTab.tsx`

---

## Design Decisions

1. **Prompt Strategy**: Start with existing assistant core prompt—it templates toward prose/dialogue/beats but should work. If model struggles, add better templates in the focus-specific prompts. Test-drive first.

2. **No Multi-select**: Single focus at a time. Multiple focuses = too much output, model overload.

3. **Context Scope**: Current architecture handles this fine. Users paste whole scene if needed. Tool use already baked in.

4. **Editor**: Standalone via prompt. No integration with VSCode spellcheck—keep it self-contained.

---

*Feature proposed for Prose Minion v1.x*
