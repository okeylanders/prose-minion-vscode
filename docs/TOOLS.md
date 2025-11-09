<p align="center">
  <img src="../assets/prose-minion-book.png" alt="Prose Minion" width="120"/>
</p>

<p align="center">
  <strong>Prose Minion Tools Guide</strong><br/>
  Complete reference for all analysis and measurement tools
</p>

---

# Prose Minion Tools Guide

## Overview

The extension includes **7 integrated prose analysis tools** organized in clean architecture:

### AI-Powered Tools (require OpenRouter API key)
1. **Dialogue Microbeat Assistant** – Analyzes dialogue and suggests tags/beats (uses the Assistant model scope)
2. **Prose Assistant** – General prose analysis and improvements (uses the Assistant model scope)
3. **Context Assistant** – Project-aware insights using your reference materials (uses the Context model scope)
4. **Dictionary Utility** – Generates rich fiction-focused dictionary entries (uses the Dictionary model scope)

### Measurement Tools (work without API key)
5. **Prose Statistics** – Word count, pacing, readability scores, lexical density, FKGL
6. **Style Flags** – Identifies style patterns (placeholders, intensifiers, hedges, etc.)
7. **Word Frequency** – Comprehensive word usage analysis with n-grams, POS tagging, hapax legomena

## Project Structure

```
src/
├── tools/                   # All analysis tools (clean separation)
│   ├── assist/             # AI-powered assist tools
│   │   ├── contextAssistant.ts
│   │   ├── dialogueMicrobeatAssistant.ts
│   │   └── proseAssistant.ts
│   ├── measure/            # Deterministic measurement tools
│   │   ├── passageProseStats/
│   │   ├── styleFlags/
│   │   └── wordFrequency/
│   ├── utility/            # Utility tools
│   │   └── dictionaryUtility.ts
│   └── shared/             # Shared utilities
│       ├── prompts.ts      # Prompt loading
│       └── guides.ts       # Craft guide loading
├── infrastructure/api/      # API clients and service implementation
│   ├── OpenRouterClient.ts
│   └── ProseAnalysisService.ts
└── resources/              # Prompts and guides
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
- Strengthens narrative prose passages
- Provides craft-grounded suggestions
- Offers vocabulary palettes and focused rewrites
- Analyzes pacing, imagery, and cadence
- Recommends improvements based on writing craft principles

**Features**:
- Accepts optional focus guidance (tone, imagery, cadence priorities)
- Uses context for POV, tense, genre awareness
- Applies craft guides when enabled
- Supports verbalized sampling for creative diversity

### 3. Context Assistant

**Location**: [src/tools/assist/contextAssistant.ts](src/tools/assist/contextAssistant.ts)

**What it does**:
- Provides project-aware insights using your reference materials
- Accesses Characters, Locations, Themes, and other project resources
- Two-turn workflow for focused analysis
- Includes full source document on first turn (when available)

**Features**:
- Configurable via Context Resource Paths (Settings overlay)
- Uses glob patterns to discover reference files (`.md` and `.txt` only)
- Dedicated model scope for cost/performance tuning
- Reads and incorporates project structure automatically

**Use Cases**:
- "Who is this character and what's their arc?"
- "What are the themes related to redemption in my story?"
- "Summarize the setting described in my location notes"
- "What's the tone and style guide for this project?"

### 4. Dictionary Utility

**Location**: [src/tools/utility/dictionaryUtility.ts](src/tools/utility/dictionaryUtility.ts)

**What it does**:
- Produces long-form dictionary entries tuned for fiction writers
- Adapts to optional context excerpts
- Respects the Dictionary model selection for cost/performance tuning

**Features**:
- Falls back to clipboard when no editor selection exists
- Displays source path when content came from an editor selection
- Persists word/context across tabs and sessions
- Suppresses auto-fill after manual edits (prevents unwanted overwrites)
- Includes definitions, connotations, tonal notes, usage examples, and related words

---

## Measurement Tools (No API Key Required)

### 5. Prose Statistics

**Location**: [src/tools/measure/passageProseStats/index.ts](src/tools/measure/passageProseStats/index.ts)

**Comprehensive prose metrics**:
- **Basic counts**: Words, sentences, paragraphs
- **Averages**: Words/sentence, sentences/paragraph
- **Dialogue analysis**: Percentage of text in quotes
- **Lexical density**: Content word ratio (non-stopwords/total)
- **Stopword ratio**: Function word percentage
- **Vocabulary**: Unique words, Type-Token Ratio, Hapax count/percentage
- **Readability**: Simplified Flesch Reading Ease, Flesch-Kincaid Grade Level
- **Pacing**: Qualitative assessment based on sentence length
- **Reading time**: Estimated minutes and hours
- **Word length distribution**: Percentage by character length

**Additional Features**:
- Chapter-by-chapter analysis for multi-file sources
- Publishing standards comparison (when preset selected)
- Publishing format with trim size and page estimate
- Detailed per-chapter breakdown tables (optional on save/copy)

### 6. Style Flags

**Location**: [src/tools/measure/styleFlags/index.ts](src/tools/measure/styleFlags/index.ts)

**Identifies style patterns**:
- **Placeholders**: Generic descriptors needing specificity
- **Intensifiers**: Overused emphasis words
- **Hedges**: Uncertainty markers
- **Noun fog**: Heavy nominalization
- **Value labels**: Telling instead of showing
- **Fillers**: Empty words adding no meaning
- **Cognition tags**: Thought verbs vs. direct thought

**Output**:
- Count per category
- Example sentences for each pattern found
- Configurable max examples per category

### 7. Word Frequency

**Location**: [src/tools/measure/wordFrequency/index.ts](src/tools/measure/wordFrequency/index.ts)

**Comprehensive word usage analysis**:
- **Top Words**: Most frequent content words (stopwords excluded by default)
- **Stopwords Table**: Top function words with counts
- **Hapax Legomena**: Words appearing exactly once (alphabetized list)
- **Part-of-Speech**: Separate lists for nouns, verbs, adjectives, adverbs (via wink-pos-tagger)
- **N-grams**: Top bigrams and trigrams for phrase patterns
- **Word Length Histogram**: Visual distribution of word lengths (1-10+ characters)
- **Lemmas** (optional): Groups inflected forms (running/ran/runs → run)

**Configurable Options** (via Settings):
- `topN`: Number of words to display (default 100)
- `includeHapaxList`: Show hapax section (default true)
- `hapaxDisplayMax`: Max hapax words shown (default 300)
- `includeStopwordsTable`: Show stopwords analysis (default true)
- `contentWordsOnly`: Exclude stopwords from top words (default true)
- `posEnabled`: Enable POS tagging (default true)
- `includeBigrams/Trigrams`: Show n-gram analysis (default true)
- `enableLemmas`: Group by lemma (default false)
- `lengthHistogramMaxChars`: Max word length shown (default 10)

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

## Context Assistant Notes

- The first turn includes the full source document content (when available) in addition to the excerpt and the project resource catalog. This improves guide selection and thematic coherence.
- Responses append a truncation notice when the model stops due to token limits.

## Token Limits & Models

- A unified `proseMinion.maxTokens` applies across all tools (default 10000). Increase if you routinely see truncation notices.
- Models can be selected per scope via `assistantModel`, `dictionaryModel`, and `contextModel` (legacy `model` is a fallback).

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
