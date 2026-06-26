# Tools

> **Status**: Current as of v2.0.1. Tool implementations live in `packages/core/src/tools/` and supporting application services under `packages/core/src/infrastructure/api/services/`.

## Overview

Prose Minion includes **9 integrated prose tools** organized in clean architecture — 5 AI-powered (require OpenRouter API key) and 4 deterministic (work offline, no API key).

### AI-Powered Tools (require OpenRouter API key)

| # | Tool | Model Scope | Location |
|---|------|-------------|----------|
| 1 | **Dialogue Microbeat Assistant** | Assistant | `tools/assist/dialogueMicrobeatAssistant.ts` |
| 2 | **Prose Assistant** | Assistant | `tools/assist/proseAssistant.ts` |
| 3 | **Context Assistant** | Context | `tools/assist/contextAssistant.ts` |
| 4 | **Dictionary Utility** | Dictionary | `tools/utility/dictionaryUtility.ts` |
| 5 | **Category Search** | Category Search | `infrastructure/api/services/search/CategorySearchService.ts` |

### Measurement Tools (no API key required)

| # | Tool | Location |
|---|------|----------|
| 6 | **Prose Statistics** | `tools/measure/passageProseStats/index.ts` |
| 7 | **Style Flags** | `tools/measure/styleFlags/index.ts` |
| 8 | **Word Frequency** | `tools/measure/wordFrequency/index.ts` |
| 9 | **Word Search** | `infrastructure/api/services/search/WordSearchService.ts` |

---

## AI-Powered Tools

### 1. Dialogue Microbeat Assistant

**Location**: `packages/core/src/tools/assist/dialogueMicrobeatAssistant.ts`

Analyzes dialogue passages and suggests:
- Appropriate dialogue tags
- Action beats that show emotion through physical actions
- Show-don't-tell improvements in dialogue

Supports focus modes: dialogue only, microbeats only, or both.

### 2. Prose Assistant

**Location**: `packages/core/src/tools/assist/proseAssistant.ts`

Strengthens narrative prose with:
- Craft-grounded suggestions and vocabulary palettes
- Focus guidance (tone, imagery, cadence priorities)
- POV, tense, and genre awareness via context
- Pacing, imagery, and cadence analysis
- Verbalized sampling for creative diversity

Craft guides are included when `proseMinion.includeCraftGuides` is enabled.

### 3. Context Assistant

**Location**: `packages/core/src/tools/assist/contextAssistant.ts`

Project-aware insights using your reference materials:
- Two-turn workflow: first turn catalogs resources + includes full source document; second turn delivers analysis
- Accesses Characters, Locations, Themes, Things, Manuscript, Drafts, and General reference paths
- Configurable via Context Resource Paths (Settings Overlay)
- Glob-based file discovery (`.md` and `.txt` only)
- Dedicated model scope for cost/performance tuning

### 4. Dictionary Utility

**Location**: `packages/core/src/tools/utility/dictionaryUtility.ts`

Long-form fiction-focused dictionary entries:
- Definitions, connotations, tonal notes, usage examples
- Adapts to optional context excerpts
- Pronunciation (IPA, phonetic, syllables, stress)
- Parts of speech, sense explorer, synonyms
- Falls back to clipboard when no editor selection exists
- Persists word/context across tabs and sessions
- Suppresses auto-fill after manual edits

### 5. Category Search

Semantic word discovery by meaning, not exact match. Uses the Category Search model scope (`proseMinion.categoryModel`).

- `[clothing]` → finds: coat, pants, jeans, shirt, jacket...
- `[angry]` → finds: pissed, upset, furious, irate, seething...
- `[color red]` → finds: crimson, scarlet, ruby, burgundy, rose...

**Features**:
- Natural language category queries
- N-gram mode (words, bigrams, trigrams)
- Cancellation support with partial results
- Full word search integration (occurrence counts, clusters, chapter locations)
- Markdown export

---

## Measurement Tools (No API Key Required)

### 6. Prose Statistics

**Location**: `packages/core/src/tools/measure/passageProseStats/index.ts`

Comprehensive prose metrics:
- **Counts**: Words, sentences, paragraphs
- **Averages**: Words/sentence, sentences/paragraph
- **Dialogue**: Percentage of text in quotes
- **Lexical density**: Content-word ratio (non-stopwords/total × 100)
- **Vocabulary**: Unique words, Type-Token Ratio, hapax count/percentage
- **Readability**: Flesch Reading Ease, Flesch-Kincaid Grade Level
- **Pacing**: Qualitative assessment from sentence length
- **Reading time**: Estimated minutes/hours
- **Word length distribution**: Percentage by character length

**Multi-file features**:
- Chapter-by-chapter analysis
- Publishing standards comparison (when preset selected)
- Publishing format with trim size and page estimate
- Optional chapter breakdown tables on save/copy

### 7. Style Flags

**Location**: `packages/core/src/tools/measure/styleFlags/index.ts`

Identifies style patterns that need attention:
- **Adverbs** (‑ly words)
- **Weak verbs** (forms of "be", passive constructions)
- **Filler words** (just, really, actually, basically, etc.)
- **Repetitive words** (close-proximity repeats)
- **Placeholder words** (draft markers)
- **Intensifiers** (overused emphasis)
- **Hedges** (uncertainty language)
- **Noun fog** (heavy nominalization)
- **Value labels** (telling instead of showing)
- **Cognition tags** (thought verbs vs. direct thought)

Output: count per category + example sentences.

### 8. Word Frequency

**Location**: `packages/core/src/tools/measure/wordFrequency/index.ts`

Comprehensive word usage analysis:
- **Top Words** — most frequent content words (stopwords excluded by default)
- **Stopwords Table** — top function words with counts
- **Hapax Legomena** — words appearing exactly once (alphabetized list)
- **Parts of Speech** — nouns, verbs, adjectives, adverbs via `wink-pos-tagger`
- **N-grams** — top bigrams and trigrams
- **Word Length Histogram** — distribution of word lengths (1–10+ characters)
- **Lemmas** (optional) — groups inflected forms (running/ran/runs → run)

Configurable via `proseMinion.wordFrequency.*` settings. POS tagging uses `wink-pos-tagger` bundled with the extension.

### 9. Word Search

Advanced word pattern matching with context windows and cluster detection.

- **Scope options**: Active File, Manuscripts, Chapters, Selection
- **Glob patterns**: Target specific folders (e.g., `Drafts/**/*.md`)
- **Context window**: N words before/after each match
- **Cluster detection**: Group nearby matches within a word-distance window
- **Min cluster size**: Only report clusters with N+ hits
- **Case sensitive**: Toggle exact case matching
- **AI expansion** (optional): Use assistant model for synonym/inflection expansion

Results: total occurrences, average gap, per-file breakdown, cluster locations.

---

## Customization

### System Prompts

Tool-specific prompts live in `packages/core/resources/system-prompts/`:

```
system-prompts/
├── category-search/
├── context-assistant/
├── dialog-microbeat-assistant/
├── dictionary-fast/
├── dictionary-utility/
├── prose-assistant/
└── writing-tools-assistant/
```

Each directory contains numbered markdown files (00-, 01-, etc.) loaded by `packages/core/src/tools/shared/prompts.ts`.

### Craft Guides

Optional writing craft guides in `packages/core/resources/craft-guides/`:
- `descriptors-and-placeholders/` — sensory details, emotions, movements
- `scene-example-guides/` — scene examples (campfire, basketball, etc.)

Loaded by `packages/core/src/tools/shared/guides.ts` when `proseMinion.includeCraftGuides` is enabled.

---

## Token Limits & Models

- A unified `proseMinion.maxTokens` applies across all tools (default 10,000). Responses hitting the cap show a truncation notice.
- Models are scoped per feature: `assistantModel`, `dictionaryModel`, `contextModel`, `categoryModel`. See the in-app **Model Browser** for the full curated list.
- Curated model IDs are defined in `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts` and verified against the live OpenRouter API.

---

## Session Persistence & Model Sync

- Long-running OpenRouter calls continue when you switch away from Prose Minion. Cached status updates and final responses are replayed on return.
- Model selections are written back to `settings.json` instantly via the Domain Hooks sync.
- UI state (active tab, latest results, status ticker) is restored on reload.

---

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design and patterns
- [CONFIGURATION.md](CONFIGURATION.md) — Complete settings reference
- [TESTING.md](TESTING.md) — Test strategy and commands
