# Prose Minion Tools Guide

## Overview

The extension now includes **5 integrated prose analysis tools** organized in clean architecture:

### AI-Powered Tools (require OpenRouter API key)
1. **Dialogue Microbeat Assistant** – Analyzes dialogue and suggests tags/beats (uses the Assistant model scope)
2. **Prose Assistant** – General prose analysis and improvements (shares the Assistant model scope)
3. **Dictionary Utility** – Generates rich fiction-focused dictionary entries (uses the Dictionary model scope)

### Measurement Tools (work without API key)
4. **Prose Statistics** – Word count, pacing, readability scores
5. **Style Flags** – Identifies common style issues
6. **Word Frequency** – Analyzes word usage patterns

## Project Structure

```
src/
├── tools/                   # All analysis tools (clean separation)
│   ├── assist/             # AI-powered assist tools
│   │   ├── dialogueMicrobeatAssistant.ts
│   │   └── proseAssistant.ts
│   ├── measure/            # Deterministic measurement tools
│   │   ├── passageProseStats/
│   │   ├── styleFlags/
│   │   └── wordFrequency/
│   └── shared/             # Shared utilities
│       ├── prompts.ts      # Prompt loading
│       └── guides.ts       # Craft guide loading
├── infrastructure/api/      # API clients and service implementation
│   ├── OpenRouterClient.ts
│   └── ProseAnalysisService.ts
└── resources/              # Prompts and guides (to be added)
    ├── system-prompts/
    └── craft-guides/
```

## Setup

### 1. Test Measurement Tools (No API Key Required)

The measurement tools work immediately:

1. Open the Prose Minion panel
2. Go to **Metrics** tab
3. Type or paste some text
4. Click any of the measurement buttons:
   - **Prose Statistics**
   - **Style Flags**
   - **Word Frequency**

### 2. Enable AI-Powered Tools

To use the AI analysis features:

1. **Get an API key**:
   - Go to https://openrouter.ai/
   - Sign up for an account
   - Create an API key

2. **Configure VS Code**:
   - Open Settings: `Cmd+,` (Mac) or `Ctrl+,` (Windows/Linux)
   - Search for "Prose Minion"
   - Paste your API key in "OpenRouter API Key"
   - (Optional) Choose default models for assistants, dictionary, and the upcoming context bot scopes

3. **Test AI tools**:
   - Go to **Analysis** tab
   - Select a model from the dropdown under the tab bar if you want to override the default
   - Click "Analyze Dialogue" or "Analyze Prose"
   - You should get AI-powered analysis!

## Tool Details

### 1. Dialogue Microbeat Assistant

**Location**: [src/tools/assist/dialogueMicrobeatAssistant.ts](src/tools/assist/dialogueMicrobeatAssistant.ts)

**What it does**:
- Analyzes dialogue passages
- Suggests appropriate dialogue tags
- Recommends action beats to show emotion
- Helps with show vs. tell in dialogue

**Example usage**:
```
Input: "I'm not going," she said.

Output: Suggestions for action beats that show emotion through physical actions rather than telling.
```

### 2. Prose Assistant

**Location**: [src/tools/assist/proseAssistant.ts](src/tools/assist/proseAssistant.ts)

**What it does**:
- General prose analysis
- Identifies show vs. tell opportunities
- Suggests sensory details
- Evaluates pacing and voice
- Recommends improvements

### 3. Dictionary Utility

**Location**: [src/tools/utility/dictionaryUtility.ts](src/tools/utility/dictionaryUtility.ts)

**What it does**:
- Produces long-form dictionary entries tuned for fiction writers
- Adapts to optional context excerpts
- Respects the Dictionary model selection for cost/performance tuning

### 4. Prose Statistics

**Location**: [src/tools/measure/passageProseStats/index.ts](src/tools/measure/passageProseStats/index.ts)

**Metrics provided**:
- Word count
- Sentence count
- Paragraph count
- Average words per sentence
- Average sentences per paragraph
- Dialogue percentage
- Lexical density (unique words ratio)
- Pacing assessment
- Readability score

**Example output**:
```json
{
  "wordCount": 247,
  "sentenceCount": 15,
  "paragraphCount": 3,
  "averageWordsPerSentence": 16.5,
  "dialoguePercentage": 35.2,
  "pacing": "Moderate",
  "readabilityScore": 67.0
}
```

### 5. Style Flags

**Location**: [src/tools/measure/styleFlags/index.ts](src/tools/measure/styleFlags/index.ts)

**Identifies**:
- Adverbs (-ly words)
- Passive voice constructions
- Weak verbs (is, was, has, get, etc.)
- Filler words (just, really, very, etc.)
- Repetitive words
- Common clichés

**Example output**:
```json
{
  "flags": [
    {
      "type": "Adverbs (-ly words)",
      "count": 12,
      "examples": ["quickly", "softly", "really"]
    },
    {
      "type": "Weak Verbs",
      "count": 8,
      "examples": ["was", "were", "has"]
    }
  ],
  "summary": "Top style issues: Adverbs: 12, Weak Verbs: 8"
}
```

### 6. Word Frequency

**Location**: [src/tools/measure/wordFrequency/index.ts](src/tools/measure/wordFrequency/index.ts)

**Analyzes**:
- Total and unique word counts
- Most frequently used words
- Top verbs, adjectives, and nouns
- Word usage percentages

**Example output**:
```json
{
  "totalWords": 500,
  "uniqueWords": 250,
  "topWords": [
    { "word": "darkness", "count": 8, "percentage": 1.6 },
    { "word": "shadow", "count": 6, "percentage": 1.2 }
  ]
}
```

## Customization

### Adding System Prompts

Create markdown files in `resources/system-prompts/`:

```
resources/system-prompts/
├── format.md           # Shared formatting instructions
├── voice.md            # Shared voice guidelines
├── style.md            # Shared style preferences
└── dialog-microbeat-assistant/
    ├── instructions.md # Tool-specific instructions
    └── examples.md     # Tool-specific examples
```

### Adding Craft Guides

Create markdown files in `resources/craft-guides/`:

```
resources/craft-guides/
├── dialogue-tags.md
├── action-beats.md
├── showing-emotion.md
├── show-dont-tell.md
├── pacing.md
└── sensory-details.md
```

These will be automatically loaded and included in AI prompts.

## Session Persistence & Model Sync

- Long-running OpenRouter calls continue even if you switch away from the Prose Minion view. When you return, cached status updates and final responses are replayed automatically.
- Model selections made via the dropdown are written back to `settings.json` instantly. The assistant, dictionary, and (future) context scopes each remember the last model you chose.
- UI state (active tab, latest results, status ticker) is restored on reload, so you can treat the panel like a focused workspace and pick up where you left off.

## Architecture Benefits

### Clean Separation of Concerns

Each tool is **self-contained**:
- Input/Output interfaces defined
- No dependencies on VS Code or UI
- Easy to test and modify

### Easy to Add New Tools

To add a new tool:

1. Create tool file in `src/tools/assist/` or `src/tools/measure/`
2. Implement the tool logic
3. Add method to `IProseAnalysisService` interface
4. Implement in `ProseAnalysisService`
5. Add handler in `MessageHandler`
6. Add UI in React component

### Testable

Each tool can be tested independently:

```typescript
// Example test
const stats = new PassageProseStats();
const result = stats.analyze({ text: "Sample text." });
expect(result.wordCount).toBe(2);
```

## OpenRouter API Details

### Supported Models

Recommended and curated models are defined in [OpenRouterModels.ts](src/infrastructure/api/OpenRouterModels.ts). Choose models in Settings (`assistantModel`, `dictionaryModel`, `contextModel`) or via the UI dropdown; the selection is injected into the appropriate OpenRouter client on the next request.

### API Costs

- OpenRouter charges per token
- Check current prices at https://openrouter.ai/docs#models
- Claude 3.5 Sonnet is recommended for best results

### Rate Limits

OpenRouter has rate limits based on your plan. The extension handles errors gracefully if limits are exceeded.

## Troubleshooting

### "API key not configured" message

- Check Settings → Prose Minion → OpenRouter API Key
- Make sure the key is copied correctly (no extra spaces)
- Restart the Extension Development Host after changing settings

### AI tools not working

1. Check Output → Extension Host for errors
2. Verify API key is valid at https://openrouter.ai/
3. Check your OpenRouter account has credits
4. Look for network/firewall issues

### Measurement tools work but show weird results

- Check that your text is valid
- Some metrics require minimum text length
- Empty or very short text may give unexpected results

## Next Steps

1. **Test all tools** with sample text
2. **Add system prompts** to customize AI behavior
3. **Add craft guides** for better AI suggestions
4. **Customize models** or temperature via Settings or the inline model picker
5. **Add more tools** following the same patterns

## Examples

See [example-repos/prose-minion](example-repos/prose-minion) for reference implementations and prompt examples.
