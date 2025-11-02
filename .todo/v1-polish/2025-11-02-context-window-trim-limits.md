# Context Window Trim Limits

**Date**: 2025-11-02
**Priority**: HIGH (v1.0 blocker candidate)
**Status**: Planned
**Estimated Time**: 2-3 hours

## Problem

Non-technical users may not self-manage context windows, potentially:
- Sending huge files that hit token limits (128K+ tokens)
- Incurring unexpected API costs
- Causing API errors or degraded responses
- Not understanding why things fail

## Solution

Simple, settings-based approach:
- Add checkbox setting: `proseMinion.applyContextWindowTrimming` (default: **true**)
- Silently trim total content to stay within conservative limits
- Target **128K token context window** (lowest common denominator across models)
- User can disable if they know they selected a larger context model

### Limits (When Enabled)

**UI Excerpt Limit**: 500 words (Frontend validation)
- Applied in UI before sending to backend
- Show word count indicator: "245 / 500 words"
- Visual warning at 400+ words (yellow)
- Visual alert at 500+ words (red)
- Allow exceeding, but show clear indicator

**Context Agent**: 50K words total (Backend)
- No file limits
- Trim total context if exceeds 50K words
- Leaves plenty of margin for output (50K words ≈ 66K tokens)

**Analysis Agents**: 75K words total with prioritization (Backend)
- Priority 1: **Excerpt** (user's selection - never trim in backend)
- Priority 2: **Incoming context** (what they're analyzing)
- Priority 3: **Guides** (craft guides - trim first if needed)
- ≈100K tokens, leaving 28K for output

### Backend Trimming: No Popups, No Warnings

- Just trim silently if setting enabled
- Log to Output Channel when trimming occurs
- User opted in via setting (on by default)
- Power users can disable if using models with larger context windows

### UI Excerpt Indicator: Subtle Visual Feedback

- Show word count below excerpt input
- Color coding: green (<400), yellow (400-499), red (500+)
- Still allow sending (no blocking)
- Helps users understand size before sending

## Setting Configuration

```json
"proseMinion.applyContextWindowTrimming": {
  "type": "boolean",
  "default": true,
  "markdownDescription": "Apply context window trimming to prevent token limit errors. **Limits**: Context Agent (50K words), Analysis Agents (75K words total: excerpt + context + guides). Targets 128K token context window. Disable if using models with larger context windows (e.g., 200K+).",
  "order": 35
}
```

## Implementation Approach

### 0. UI Excerpt Word Counter (Frontend)

Add word counter to excerpt input fields (Analysis, Context, Dictionary tabs):

```tsx
// In AnalysisTab.tsx, UtilitiesTab.tsx, etc.
const excerptWordCount = React.useMemo(() => {
  return countWords(excerptText);
}, [excerptText]);

const getWordCountColor = (count: number): string => {
  if (count >= 500) return 'red';
  if (count >= 400) return 'yellow';
  return 'green';
};

// In render:
<div className="excerpt-input-container">
  <textarea
    value={excerptText}
    onChange={(e) => setExcerptText(e.target.value)}
    placeholder="Paste your excerpt here..."
    rows={8}
  />
  <div className={`word-counter ${getWordCountColor(excerptWordCount)}`}>
    {excerptWordCount} / 500 words
    {excerptWordCount > 500 && ' (⚠️ Large excerpt)'}
  </div>
</div>
```

**Note**: This is just a visual indicator, not a hard limit. Users can still send larger excerpts.

### 1. Context Agent (50K words total)

```typescript
// In AIResourceOrchestrator or Context handler
const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
  .get<boolean>('applyContextWindowTrimming', true);

if (applyTrimming) {
  const MAX_CONTEXT_WORDS = 50000;

  // Combine all context pieces
  let totalContext = excerpt + generatedContext + requestedResources;

  // Trim if over limit
  if (countWords(totalContext) > MAX_CONTEXT_WORDS) {
    const result = trimToWordLimit(totalContext, MAX_CONTEXT_WORDS);
    totalContext = result.trimmed;

    // Log to output channel (not user-facing)
    this.outputChannel.appendLine(
      `[Context Trim] Trimmed from ${result.originalWords} to ${result.trimmedWords} words`
    );
  }
}
```

### 2. Analysis Agents (75K words with prioritization)

```typescript
// In AIResourceOrchestrator for dialogue/prose analysis
const applyTrimming = vscode.workspace.getConfiguration('proseMinion')
  .get<boolean>('applyContextWindowTrimming', true);

if (applyTrimming) {
  const MAX_ANALYSIS_WORDS = 75000;

  // Priority 1: Excerpt (never trim - user's selection)
  const excerptWords = countWords(excerpt);

  // Priority 2: Incoming context
  const contextWords = countWords(incomingContext);

  // Priority 3: Guides (trim if necessary)
  let guidesContent = loadedGuides;
  const guidesWords = countWords(guidesContent);

  const totalWords = excerptWords + contextWords + guidesWords;

  if (totalWords > MAX_ANALYSIS_WORDS) {
    // Calculate how many words to trim from guides
    const wordsToTrim = totalWords - MAX_ANALYSIS_WORDS;
    const remainingGuideWords = Math.max(0, guidesWords - wordsToTrim);

    if (remainingGuideWords < guidesWords) {
      const result = trimToWordLimit(guidesContent, remainingGuideWords);
      guidesContent = result.trimmed;

      this.outputChannel.appendLine(
        `[Analysis Trim] Guides trimmed from ${guidesWords} to ${remainingGuideWords} words (total: ${MAX_ANALYSIS_WORDS})`
      );
    }
  }
}
```

### Priority Logic

1. **Never trim excerpt** - this is what the user selected
2. **Trim incoming context only if guides are already empty**
3. **Prefer trimming guides first** - least critical for analysis

## Affected Files

### Backend
- `src/application/services/AIResourceOrchestrator.ts`
  - Add `countWords()` utility
  - Add `trimToWordLimit()` utility
  - Apply limits before API calls
  - Check setting: `proseMinion.applyContextWindowTrimming`

- `src/tools/shared/CraftGuideRepository.ts` (optional)
  - Helper to prioritize requested guides over auto-included
  - Trim from auto-included guides first

### Configuration
- `package.json`
  - Add new setting: `proseMinion.applyContextWindowTrimming`
  - Clear description with limits documented

### Frontend Changes
- Add word counter to excerpt inputs (Analysis, Context, Dictionary)
- Color-coded visual feedback (green/yellow/red)
- Helper: `countWords()` utility (shared or per-component)
- CSS styling for word counter

## Word Counting Utility

```typescript
/**
 * Count words in text using simple whitespace splitting
 * Matches typical word processor counts
 */
function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Trim text to maximum word count, preserving sentence boundaries when possible
 */
function trimToWordLimit(text: string, maxWords: number): {
  trimmed: string;
  originalWords: number;
  trimmedWords: number;
  wasTrimmed: boolean;
} {
  const words = text.trim().split(/\s+/);
  const originalWords = words.length;

  if (originalWords <= maxWords) {
    return {
      trimmed: text,
      originalWords,
      trimmedWords: originalWords,
      wasTrimmed: false
    };
  }

  // Trim to max words
  const trimmedWords = words.slice(0, maxWords);
  let trimmed = trimmedWords.join(' ');

  // Try to end at a sentence boundary (. ! ?) within last 50 words
  const lastFiftyWords = trimmedWords.slice(-50).join(' ');
  const lastSentenceMatch = lastFiftyWords.match(/[.!?]\s+/);

  if (lastSentenceMatch && lastSentenceMatch.index !== undefined) {
    const cutPoint = trimmed.length - lastFiftyWords.length + lastSentenceMatch.index + 1;
    trimmed = trimmed.substring(0, cutPoint).trim();
  }

  return {
    trimmed,
    originalWords,
    trimmedWords: countWords(trimmed),
    wasTrimmed: true
  };
}
```

## Testing Checklist

### UI Word Counter
- [ ] Word counter appears below excerpt inputs
- [ ] Counter updates in real-time as user types/pastes
- [ ] Green color for 0-399 words
- [ ] Yellow color for 400-499 words
- [ ] Red color + warning for 500+ words
- [ ] Counter visible in Analysis tab
- [ ] Counter visible in Context tab
- [ ] Counter visible in Dictionary tab
- [ ] Works in light and dark themes

### Backend Trimming
- [ ] Setting appears in package.json with clear description
- [ ] Setting appears in Settings overlay
- [ ] Default is **true** (enabled)
- [ ] Create 60K word test file for context agent
- [ ] Verify trimmed to 50K words silently
- [ ] Check Output Channel shows trim log
- [ ] Create 100K word test (excerpt + guides) for analysis
- [ ] Verify excerpt never trimmed in backend (handled by UI counter)
- [ ] Verify guides trimmed first
- [ ] Check total ≤ 75K words
- [ ] Disable setting → no trimming applied
- [ ] Re-enable setting → trimming works again
- [ ] Test with extremely large inputs (200K+ words)
- [ ] Verify no crashes or errors

## Acceptance Criteria

### UI
- [ ] Excerpt word counter visible on all relevant tabs
- [ ] Real-time word count updates
- [ ] Color coding works (green/yellow/red)
- [ ] Doesn't block user from sending large excerpts (just warns)

### Backend
- [ ] Setting `proseMinion.applyContextWindowTrimming` exists
- [ ] Default value is `true`
- [ ] Setting description clearly explains limits (including 500-word UI recommendation)
- [ ] Context agent respects 50K word limit when enabled
- [ ] Analysis agents respect 75K word limit when enabled
- [ ] Prioritization works (excerpt > context > guides)
- [ ] Excerpt is never trimmed by backend (UI handles via counter)
- [ ] Trimming logged to Output Channel
- [ ] No backend warnings or popups
- [ ] Disabling setting removes all backend limits (UI counter still shows)
- [ ] Word counting is accurate
- [ ] Sentence boundary preservation works

## Output Channel Logging

```
[Context Trim] Trimmed from 62,341 to 50,000 words
[Analysis Trim] Guides trimmed from 48,230 to 23,157 words (total: 75,000)
```

Users can view these if they want to see what's happening, but no in-your-face warnings.

## Rationale for Limits

**Context Agent: 50K words**
- 50K words ≈ 66K tokens (1.33 tokens/word estimate)
- Output: ~60K tokens available
- Total: ~126K tokens (under 128K limit)
- Generous margin for context generation

**Analysis Agents: 75K words**
- 75K words ≈ 100K tokens
- Output: ~28K tokens available
- Total: ~128K tokens (at limit)
- Prioritization ensures user content takes precedence

**Conservative Target: 128K tokens**
- Works across most modern models (GPT-4, Claude, Gemini, etc.)
- Users with larger context models (200K+) can disable
- Better to be conservative than hit limits

## User Scenarios

### Scenario 1: New User, Default Settings
- Trimming enabled (default)
- Pastes 80K word manuscript into analysis
- Guides trimmed to fit 75K total
- Analysis succeeds without errors
- User doesn't notice (it just works)

### Scenario 2: Power User, Large Context Model
- User knows they selected Claude Opus (200K context)
- Disables `applyContextWindowTrimming` in settings
- Can send full 100K+ word contexts
- No limits applied

### Scenario 3: Context Generation
- User requests context with 10 character files (70K words)
- Trimmed to 50K words silently
- Context generation succeeds
- Output channel shows trim log (if they check)

## Future Enhancements (v1.1+)

- [ ] Per-model limits based on known context windows
- [ ] Smart truncation (keep beginning + end, summarize middle)
- [ ] User notification when significant trimming occurs (>30%)
- [ ] Configurable limits for power users
- [ ] Token count estimation (more accurate than word count)
- [ ] "Input size estimator" in UI showing current vs. limit

## Success Metrics

- Zero "token limit exceeded" errors reported by users
- Feature is invisible to most users (default just works)
- Power users can easily disable if needed
- Output channel provides transparency
- No complaints about unexpected API costs
