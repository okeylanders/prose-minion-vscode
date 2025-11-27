# Changelog

All notable changes to the Prose Minion VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-11-27

### Overview

This release focuses on **architecture health** and **developer experience**, with two major refactoring epics completing 8 sprints of internal improvements. The user-facing highlight is **phrase lookup support** in the dictionary.

**Key Highlights:**
- 📝 **Phrase Lookup** - Dictionary now supports multi-word phrases (up to 6 words)
- 🤖 **New AI Models** - Claude Opus 4.5 and Cogito v2.1 671B added
- 🏗️ **Architecture Health Pass** - Foundation Cleanup (3 sprints) + Component Decomposition (5 sprints)
- 🐛 **Stability Fixes** - Context assistant, dictionary race conditions, UI polish
- 🛠️ **Developer Tools** - `/release-vsce` slash command with branch strategy

**Statistics:**
- 80 commits over 6 days
- 190 files changed (+16,087 insertions, -4,351 deletions)
- 10 merged PRs (#31-40)
- 2 completed epics (8 sprints total)
- 12 memory bank entries

---

### Features

#### 📝 Phrase Lookup - Multi-Word Dictionary Support (PR #40)

**What It Does:**
Dictionary now accepts phrases up to 6 words, enabling lookup of idioms, expressions, and contextual phrases.

**Examples:**
- "kick the bucket" → idiom meaning, usage, alternatives
- "once in a blue moon" → definition, frequency, creative uses
- "break a leg" → theatrical origin, modern usage

**Technical Implementation:**
- Updated word validation to accept multi-word inputs
- Phrase-aware prompt adjustments in dictionary service
- UI improvements: auto-scroll to results, cleaner "More to explore" display

**Files Modified:**
- `src/tools/utility/dictionaryUtility.ts` - Phrase validation
- `src/presentation/webview/components/UtilitiesTab.tsx` - UX improvements

---

#### 🤖 New AI Models

Added two new frontier models to both CATEGORY_MODELS and RECOMMENDED_MODELS:

| Model | Description |
|-------|-------------|
| **Claude Opus 4.5** | Anthropic's frontier reasoning model optimized for complex software engineering and agentic workflows |
| **Cogito v2.1 671B** | One of the strongest open MoE models globally, trained via self-play RL for instruction following, coding, and creative writing |

**Files Modified:**
- `src/infrastructure/api/OpenRouterModels.ts` - Added new model entries

---

### Architecture

#### 🏗️ Sub-Epic 1: Foundation Cleanup (PRs #32-34)

**Sprint 01: Result Formatter Decomposition**
- Decomposed 769-line `resultFormatter.ts` into 8 focused formatter files
- Each formatter handles one domain (analysis, metrics, dictionary, etc.)
- Added foundation tests for formatters

**Sprint 02: Shared Types & Imports Hygiene**
- Organized message types into domain-specific files
- Established semantic import aliases (`@messages`, `@handlers`, `@services`, etc.)
- Zero relative imports policy enforced

**Sprint 03: Prop Drilling & Type Safety**
- Eliminated callback prop drilling via hook object pattern
- Comprehensive type safety across presentation layer
- Simplified MetricsTab by removing callback props

**Files Added/Modified:**
- `src/presentation/webview/utils/formatters/` - 8 new formatter files
- `src/shared/types/messages/` - Reorganized type structure
- `tsconfig.json`, `webpack.config.js` - Path alias configuration

---

#### 🏗️ Sub-Epic 2: Component Decomposition (PRs #35-40)

**Sprint 00: Domain-Oriented Directory Structure**
- Reorganized components into domain folders
- Clear separation: `analysis/`, `metrics/`, `search/`, `utilities/`, `shared/`

**Sprint 01: ScopeBox Shared Component**
- Extracted common scope selection UI into reusable component
- Consolidated message posting inside ScopeBox

**Sprint 02: Loading Indicator + StatusEmitter Unification**
- Created unified `LoadingIndicator` component
- Established `StatusEmitter` pattern for consistent progress tracking
- Added ticker message support across all tools

**Sprint 03: Subtab Panel Extraction + Universal TabBar**
- Extracted subtab panels from SearchTab and MetricsTab
- Created universal TabBar component for consistent navigation
- Fixed empty Publishing Standards well display

**Sprint 04: WordCounter Shared Component**
- Extracted word counter logic into reusable component
- Consistent word counting across all text inputs

**Architectural Benefits:**
- Reduced component line counts by 30-50%
- Improved testability through isolated components
- Consistent UX patterns across all tabs
- Better maintainability and faster feature development

---

### Fixed

#### Context Assistant Max Turns Recovery (PR #40)
- **Issue**: Context assistant could get stuck after hitting max turns
- **Fix**: Added recovery logic and improved catalog prioritization
- **Impact**: More reliable multi-turn conversations

#### Dictionary Auto-Run Race Condition (Multiple PRs)
- **Issue**: Multiple root causes causing duplicate dictionary lookups
- **Fixes**:
  - Eliminated auto-run race in initialization
  - Fixed context prompt emphasis timing
  - Added proper debouncing
- **Impact**: Cleaner single-lookup behavior

#### UI Polish
- **SearchTab**: Added margin bottom for better spacing
- **MetricsTab**: Hide empty Publishing Standards well, TabBar spacing
- **Ticker**: Fixed animation reset on content updates
- **Webpack**: Resolved @messages alias runtime error

---

### Developer Tools

#### `/release-vsce` Slash Command
- Streamlined release workflow with checkpoints
- Release branch strategy (work on `release/vX.Y.Z`, merge to main only after validation)
- Orchestration support for parallel tasks
- Memory bank integration for pause/resume

**Files Added:**
- `.claude/commands/release-vsce.md` - Release workflow command

---

### References

- Epic: [Architecture Health Pass](.todo/archived/epics/epic-architecture-health-pass-2025-11-21/)
- Epic: [UX Polish 2025-11-24](.todo/archived/epics/epic-ux-polish-2025-11-24/)
- Memory Bank: [20251125-2110-epic-ux-polish-complete](.memory-bank/20251125-2110-epic-ux-polish-2025-11-24-complete.md)

---

## [1.1.1] - 2025-11-20

### Overview

This patch release introduces **Fast Generate (Experimental)**, a new parallel dictionary generation feature that generates dictionary entries 2-4× faster using concurrent API calls.

**Key Highlights:**
- ⚡ **Fast Generate** - Experimental parallel dictionary generation
- 🔧 **Bug Fixes** - Error recovery and loading state improvements

---

### Features

#### ⚡ Fast Generate - Parallel Dictionary Generation (Experimental)

**What It Does:**
Generate dictionary entries 2-4× faster by running multiple API calls in parallel.

**How It Works:**
- **14 Dictionary Blocks**: Definition, pronunciation, parts of speech, etymology, synonyms, antonyms, usage examples, collocations, register notes, common mistakes, idioms, word family, mnemonic, and summary
- **Parallel Execution**: 7-thread concurrency limit (configurable) using `p-limit`
- **Progress Bar**: Real-time progress indicator showing completed blocks
- **Token Aggregation**: Total token usage calculated across all parallel API calls

**Technical Implementation:**
- Fan-out pattern: Single request spawns 7 parallel API calls
- Each block has its own focused prompt for better quality
- Results assembled in deterministic order regardless of completion order
- Graceful error handling: Partial failures don't crash the entire generation

**UI Changes:**
- New "⚡ Fast Generate (Experimental)" button in Dictionary tab
- Progress bar shows `X / 14 blocks` completion
- Loading widget displays during generation

**Files Added/Modified:**
- `src/infrastructure/api/services/dictionary/DictionaryService.ts` - Added `generateParallelDictionary()` method
- `src/application/handlers/domain/DictionaryHandler.ts` - Added fast generation message handler
- `src/shared/types/messages/dictionary.ts` - Added fast generation message types
- `src/presentation/webview/hooks/domain/useDictionary.ts` - Added fast generation state
- `src/presentation/webview/components/UtilitiesTab.tsx` - Added Fast Generate button and progress UI
- `resources/system-prompts/dictionary-fast/` - 14 block-specific prompt files

**User Notes:**
- Marked as "Experimental" - some models may struggle with high concurrency
- Works best with newer fast models (Haiku 4.5, Sonnet 4.5, Gemini Flash 2.5, GPT **5.1**)
- Uses same API key and model as regular dictionary lookup

---

### Fixed

#### Error Recovery for Fast Generation
- **Issue**: When fast generation encountered an API error, the `isFastGenerating` state wasn't being reset, leaving the UI stuck in loading state
- **Fix**: Added `setFastGenerating(false)` to error handler in App.tsx
- **Impact**: UI now correctly recovers from errors during fast generation

#### Loading Widget Consistency
- **Issue**: Fast generation loading indicator was missing the animated LoadingWidget that regular dictionary lookup has
- **Fix**: Added `<LoadingWidget />` component to fast generation loading section
- **Impact**: Consistent visual feedback during all dictionary operations

---

### References

- ADR: [docs/adr/2025-11-20-parallel-dictionary-generation.md](docs/adr/2025-11-20-parallel-dictionary-generation.md)
- Epic: [.todo/epics/epic-parallel-dictionary-generation-2025-11-20/](.todo/epics/epic-parallel-dictionary-generation-2025-11-20/)

---

## [1.1.0] - 2025-11-20

### Overview

This release introduces **Context Search**, a major new AI-powered semantic word discovery feature, alongside comprehensive architectural improvements, a robust testing framework, and critical bug fixes. The codebase has been further refined with the elimination of the final god component (ProseAnalysisService) ( *well, let's not get carried away there's a couple others* ) and the addition of 207 automated tests protecting core patterns.

**Key Highlights:**
- 🔍 **Context Search** - AI-powered semantic word discovery by category/concept
- 🏗️ **Service-Based Architecture** - 11 focused domain services (from 1 god component)
- 🧪 **Testing Infrastructure** - 207 automated tests with 43.1% coverage
- 🎨 **Custom Model Support** - Power users can use any OpenRouter model
- 🐛 **Critical Bug Fixes** - Token reset, category search parsing, context model refresh

**Statistics:**
- 73 commits over 11 days
- 159 files changed (+33,758 insertions, -2,402 deletions)
- 5 merged PRs (#24-30)
- 5 completed epics
- 5 new ADRs

---

## Features

### Added

#### Context Search - AI-Powered Semantic Word Discovery (PR #30)
**The marquee feature of v1.1.0** - Search your manuscript by category, concept, or natural language description.

**What It Does:**
- **Semantic Search**: Find words by meaning, not just spelling
  - `[clothing]` → coat, pants, jeans, shirt, jacket, shoes, etc.
  - `[angry]` → pissed, upset, furious, irate, seething, etc.
  - `[color red]` → crimson, scarlet, ruby, burgundy, etc.
- **Natural Language Queries**: Describe what you're looking for in plain English
- **Export Results**: Save to markdown reports with full occurrence details
- **Batch Processing**: Process large texts (10K+ words) in chunks for reliability
- **Cost-Effective**: ~$0.02 per search for 50K word novel using Haiku model

**Architecture Wins:**
- **Composition over Duplication**: Delegates to WordSearchService for occurrence counting
- **Tokenization Reuse**: Uses WordFrequency tokenization (consistent across features)
- **Zero New Settings**: Reuses existing Word Search settings (contextWords, clusterWindow, etc.)
- **Multi-File Support FREE**: Batch processing via delegation
- **Cluster Analysis FREE**: Chapter detection via delegation

**Usage:**
1. Open Context Search subtab in Search tab
2. Select context model (recommend Haiku for cost efficiency)
3. Enter category query (e.g., `[emotions]`, `[weather]`, `[movement verbs]`)
4. Click "Search Category"
5. View word list with occurrence counts, clusters, and chapter locations
6. Export to markdown for reference

**Files Added:**
- `src/infrastructure/api/services/search/CategorySearchService.ts` (401 lines)
- `resources/system-prompts/category-search/` (3 prompt files)
- `src/presentation/webview/components/CategorySearch.tsx`

**References:**
- ADR: [docs/adr/2025-11-17-context-search-component.md](docs/adr/2025-11-17-context-search-component.md)
- Epic: [.todo/archived/epics/epic-context-search-2025-11-17/](.todo/archived/epics/epic-context-search-2025-11-17/)
- Memory Bank: [.memory-bank/20251120-1515-category-search-polish-and-presentation-debt.md](.memory-bank/20251120-1515-category-search-polish-and-presentation-debt.md)

---

## Enhanced

### Custom Model IDs for Power Users (PR #28)

**What Changed:**
- Removed enum constraints from `package.json` for 3 model settings
- Settings Overlay detects custom models and displays "(Custom)" label
- VSCode Settings pane now accepts free-text input for any OpenRouter model ID
- Future-proof: No extension updates needed when OpenRouter adds new models

**Use Case:**
Power users can access newly released models immediately by entering the model ID directly (e.g., `anthropic/claude-3.7-sonnet:beta`, `openai/gpt-5-turbo`, etc.)

**Format:** `provider/model-name:variant`

**Files Modified:**
- `package.json` - Removed enum constraints
- `src/presentation/webview/components/SettingsOverlay.tsx` - Custom model detection

**References:**
- ADR: [docs/adr/2025-11-17-ux-polish-enhancements.md](docs/adr/2025-11-17-ux-polish-enhancements.md)
- Sprint: [.todo/archived/epics/epic-ux-polish-2025-11-17/sprints/01-custom-model-ids.md](.todo/archived/epics/epic-ux-polish-2025-11-17/sprints/01-custom-model-ids.md)

---

### N-Gram Filter Description Enhancement (PR #29)

**What Changed:**
Added clear, example-driven description to Settings Overlay explaining `minCharacterLength` filter behavior for bigrams/trigrams.

**Description Added:**
> "This filter applies to **all words** in a bigram/trigram. For example, if set to 4:
> - ✅ 'walked through' (both ≥4 characters) → shown
> - ❌ 'walked in' (second word <4 characters) → hidden
>
> This is useful for filtering out common phrases with articles/prepositions."

**User Impact:**
Users now understand why some bigrams/trigrams disappear when adjusting the min length filter.

**Files Modified:**
- `src/presentation/webview/components/SettingsOverlay.tsx`

**References:**
- Sprint: [.todo/archived/epics/epic-ux-polish-2025-11-17/sprints/02-ngram-filter-description.md](.todo/archived/epics/epic-ux-polish-2025-11-17/sprints/02-ngram-filter-description.md)

---

## Fixed

### Critical Bug Fixes

#### Token Totals Not Resetting on Startup
- **Issue**: Token usage totals persisted across extension reloads
- **Fix**: Added cost fallback parsing, proper reset on startup
- **Impact**: Users now see accurate per-session token costs
- **Commit**: `1b0a8ec`

---

#### Context Model Selection Refresh
- **Issue**: Context model selection not refreshing properly in UI
- **Fix**: Proper state sync between Settings Overlay and context components
- **Impact**: Model changes now immediately reflect across UI
- **Commit**: `19e24df`

---

#### Word Search Save Functionality
- **Issue**: Word search results not saving to file correctly
- **Fix**: Fixed export logic for word search markdown reports
- **Impact**: Users can now reliably export search results
- **Commit**: `1740d4a`

---

#### Category Search Parsing and Save Issues
- **Issue**: Category Search result parsing errors, save functionality broken
- **Fix**: Robust parsing for AI-generated word lists, fixed export logic
- **Impact**: Category Search results now parse and save reliably
- **Commit**: `77408c9`

---

#### Subtab Switching During Loading
- **Issue**: Category Search blocked subtab switching while loading
- **Fix**: Allowed tab navigation during long-running searches
- **Impact**: Better UX for large manuscript searches (no UI lock)
- **Commit**: `0956c5e`

---

#### CategoryModel Config Watcher
- **Issue**: Category model changes not triggering config refresh
- **Fix**: Added categoryModel to MODEL_KEYS in ConfigurationHandler
- **Impact**: Category model changes now sync properly
- **Commit**: `b781fb6`

---

## Refactored

### ProseAnalysisService Domain Services Refactor (PR #24)

**The Final God Component Elimination** - Achieved Clean Architecture (10/10 score)

**What Changed:**
Eliminated the 916-line `ProseAnalysisService` god component and extracted **11 focused domain services** organized by responsibility.

**Services Created:**

1. **Analysis Services** (`src/infrastructure/api/services/analysis/`)
   - `AssistantToolService` (208 lines) - Dialogue & prose analysis
   - `ContextAssistantService` (202 lines) - Context generation

2. **Dictionary Services** (`src/infrastructure/api/services/dictionary/`)
   - `DictionaryService` (139 lines) - Word definitions and context

3. **Measurement Services** (`src/infrastructure/api/services/measurement/`)
   - `ProseStatsService` (47 lines) - Prose statistics calculations
   - `StyleFlagsService` (46 lines) - Style pattern detection
   - `WordFrequencyService` (57 lines) - Word frequency analysis

4. **Search Services** (`src/infrastructure/api/services/search/`)
   - `WordSearchService` (466 lines) - Word pattern search, clustering

5. **Resource Services** (`src/infrastructure/api/services/resources/`)
   - `AIResourceManager` (247 lines) - Context path resolution
   - `StandardsService` (213 lines) - Publishing standards comparison
   - `ResourceLoaderService` (84 lines) - System prompts & craft guides
   - `ToolOptionsProvider` (103 lines) - Shared tool configuration

**Success Metrics:**
- ProseAnalysisService: **868 lines → 0 lines** (100% elimination)
- Largest service: **868 lines → 466 lines** (46% smaller)
- Average service size: **181 lines** (79% smaller than original)
- Zero TypeScript errors (all sprints compiled on first try)

**Architecture Improvements:**
- **Single Responsibility Principle**: Each service has one clear purpose
- **Dependency Injection**: Services injected via handler constructors
- **Testability**: Focused services are easier to unit test
- **Maintainability**: < 500 lines per service (readable in one sitting)
- **Clean Architecture**: Handlers orchestrate (application layer), services execute (infrastructure layer)

**Developer Impact:**
- 50% faster to add new features (clear service boundaries)
- Easier debugging (focused responsibility per service)
- Better code navigation (semantic file names)

**References:**
- ADR: [docs/adr/2025-11-11-prose-analysis-service-refactor.md](docs/adr/2025-11-11-prose-analysis-service-refactor.md)
- Epic: [.todo/archived/epics/epic-prose-analysis-service-refactor-2025-11-11/](.todo/archived/epics/epic-prose-analysis-service-refactor-2025-11-11/)
- Memory Bank: [.memory-bank/20251111-1730-prose-analysis-service-refactor-complete.md](.memory-bank/20251111-1730-prose-analysis-service-refactor-complete.md)

---

### Technical Debt Cleanup Epic (PR #27)

**3 Architecture Debt Items Resolved** across 3 focused sprints

#### Sprint 01: StandardsService Responsibility Fix
**Issue**: `computePerFileStats()` method violated Single Responsibility Principle

**Resolution:**
- Moved `computePerFileStats()` from StandardsService to ProseStatsService
- Restored clean domain boundaries (standards = lookup, stats = computation)
- Added 9 new tests for the method

**Impact:**
- StandardsService now focused solely on publishing standards lookup
- ProseStatsService owns all prose statistics computations
- Clear responsibility boundaries

---

#### Sprint 02: Settings Hooks Unit Tests
**Issue**: Zero test coverage for 6 settings hooks

**Resolution:**
- Added comprehensive unit tests for all settings hooks:
  - `useWordSearchSettings` (18 tests)
  - `useWordFrequencySettings` (18 tests)
  - `useContextPathsSettings` (13 tests)
  - `useModelsSettings` (13 tests)
  - `useTokensSettings` (6 tests)
  - `usePublishingSettings` (6 tests)
- **Total: 74 new tests**
- **Coverage achieved: 91.72%** (exceeded 80% target)

**Test Coverage:**
- State initialization and updates ✅
- Persistence contracts ✅
- VSCode settings sync ✅
- Message handling ✅
- Edge cases (null values, invalid input) ✅

**Impact:**
- Regression protection for settings sync
- Confidence in bidirectional sync
- Documented behavior via tests

---

#### Sprint 03: useEffect Extraction Pattern
**Issue**: Inline useEffect logic reduced testability and readability

**Resolution:**
- Extracted inline useEffect callbacks to named methods wrapped in `useCallback`
- Applied consistent naming pattern:
  - `request*` - Data fetching operations
  - `sync*` - Synchronization operations
  - `initialize*` - Initialization logic
  - `clear*When*` - Conditional state updates

**Hooks Modified:**
- `usePublishingSettings` - Extracted `requestPublishingSettings()`
- `useDictionary` - Extracted `syncDictionaryInput()`
- `useContext` - Extracted `clearResultsWhenSourceChanged()`
- `useAnalysis` - Extracted `initializeAnalysisState()`

**Benefits:**
- **Testability**: Named methods can be tested in isolation
- **Reusability**: Methods can be called from multiple places
- **Clarity**: Semantic names document intent
- **Debugging**: Named functions appear in stack traces

**References:**
- Architecture Debt: [.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md](.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md)
- ADR: [docs/adr/2025-11-17-technical-debt-cleanup.md](docs/adr/2025-11-17-technical-debt-cleanup.md) (implied)
- Epic: [.todo/archived/epics/epic-technical-debt-cleanup-2025-11-15/](.todo/archived/epics/epic-technical-debt-cleanup-2025-11-15/)

---

## Testing

### Infrastructure Testing Framework (PR #25)

**Added 207 Automated Tests** protecting core architectural patterns

**What Was Added:**

#### Test Framework Setup
- **Jest with ts-jest**: Full TypeScript support
- **TypeScript Path Aliases**: `@/` → `src/` for cleaner imports
- **Separate Test Directory**: `src/__tests__/` mirrors `src/` structure
- **VSCode API Mocking**: Complete mock suite for extension APIs

**Test Organization:**

1. **Tier 1 - Infrastructure Patterns** (25 tests)
   - Message envelope validation
   - MessageRouter (Strategy pattern)
   - usePersistence (state composition)
   - Domain hook contracts (Tripartite Interface)

2. **Tier 2 - Domain Handlers** (25 tests)
   - Route registration for all 10 domain handlers
   - Error handling and edge cases

3. **Tier 3 - Business Logic** (74 tests)
   - Word clustering algorithm (14 tests)
   - Publishing standards lookup (13 tests)
   - Prose statistics calculations (47 tests)

**Coverage Achieved:**
- **Statements**: 43.1% (target: 40%) ✅
- **Functions**: 46.52% (target: 40%) ✅
- **Lines**: 41.58% (target: 40%) ✅
- **Branches**: 20.72%

**High Coverage Areas:**
- `PublishingStandardsRepository`: 100% statements
- `PassageProseStats`: 99.27% statements
- `MessageRouter`: 93.33% statements
- `AnalysisHandler`: 89.13% statements

**Testing Philosophy:**
- **Infrastructure-First**: Protect patterns that all features depend on
- **Lightweight**: 40% coverage target (not 80-100%) to balance velocity with safety
- **Token-Conscious**: Focus on high-value tests, defer comprehensive TDD to v1.0+

**NPM Scripts:**
```bash
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
npm run test:watch        # Watch mode (re-runs on changes)
npm run test:tier1        # Run infrastructure tests only
```

**References:**
- ADR: [docs/adr/2025-11-15-lightweight-testing-framework.md](docs/adr/2025-11-15-lightweight-testing-framework.md)
- Epic: [.todo/archived/epics/epic-infrastructure-testing-2025-11-15/](.todo/archived/epics/epic-infrastructure-testing-2025-11-15/)
- Memory Bank: [.memory-bank/20251115-1730-infrastructure-testing-complete.md](.memory-bank/20251115-1730-infrastructure-testing-complete.md)

---

## Documentation

### Added

#### Architecture Decision Records (5 New ADRs)
1. **[2025-11-11: ProseAnalysisService Domain Services Refactor](docs/adr/2025-11-11-prose-analysis-service-refactor.md)**
   - Documents elimination of 916-line god component
   - Service extraction strategy and organization

2. **[2025-11-15: Lightweight Testing Framework](docs/adr/2025-11-15-lightweight-testing-framework.md)**
   - Infrastructure-first testing approach
   - 40% coverage target rationale
   - Tier system (Infrastructure, Domain, Business Logic)

3. **[2025-11-17: Context Search Component](docs/adr/2025-11-17-context-search-component.md)**
   - AI-powered semantic word discovery design
   - Composition pattern (delegates to WordSearchService)
   - Tokenization reuse strategy

4. **[2025-11-17: UX Polish Enhancements](docs/adr/2025-11-17-ux-polish-enhancements.md)**
   - Custom model ID support
   - N-gram filter description
   - Settings UI improvements

5. **[2025-11-19: Shared Types & Imports Hygiene](docs/adr/2025-11-19-shared-types-imports-hygiene.md)**
   - `@shared/` import pattern for cross-layer types
   - Prevents circular dependencies
   - Clean Architecture layer boundaries

---

#### Agent Guidance Updates
Updated [`.ai/central-agent-setup.md`](.ai/central-agent-setup.md) with:
- Service composition pattern guidance
- WordFrequency tokenization reuse documentation
- WordSearchService delegation pattern
- useEffect extraction pattern guidelines
- Testing framework documentation

---

#### Archived Epics (5 Completed)
Moved to `.todo/archived/epics/`:
1. **epic-prose-analysis-service-refactor-2025-11-11** (6 sprints)
2. **epic-infrastructure-testing-2025-11-15** (3 sprints)
3. **epic-technical-debt-cleanup-2025-11-15** (3 sprints)
4. **epic-ux-polish-2025-11-17** (2 sprints)
5. **epic-context-search-2025-11-17** (5 sprints)

**Total**: 19 sprints completed, fully documented with outcomes and PR links

---

#### README Updates - Context Search Documentation

Added comprehensive Context Search section to [README.md](../README.md):

**What Was Added:**
- New subsection under Search: "Context Search (AI-Powered)"
- Marked as "NEW in v1.1.0"
- Detailed feature description with examples:
  - `[clothing]` → coat, pants, jeans, shirt, jacket, shoes, dress
  - `[angry]` → pissed, upset, furious, irate, seething, livid
  - `[color red]` → crimson, scarlet, ruby, burgundy, rose
  - `[movement verbs]` → walked, ran, stumbled, rushed, crept
- Key features list (natural language queries, semantic discovery, export, batch processing, cost info)
- Step-by-step usage guide (7 steps)
- "Best For" use cases (synonyms, semantic patterns, vocabulary diversity, thematic tracking)
- Example queries for inspiration (5 examples)
- Clear API key requirement callout

**Updated Sections:**
- "Features at a Glance" - Added mention of Context Search
- "OpenRouter API: When You Need It" - Clarified Word Search (offline) vs. Context Search (requires API key)

**Impact:**
Users can now discover and understand the Context Search feature directly from the README.

---

#### Model Reference Guide - Clickable Documentation Link

Added clickable documentation link to Settings Overlay Models section:

**UI Implementation:**
- Right-aligned link: "Click For Model Reference Guide → 📖"
- Opens `docs/RECOMMENDED_MODELS.md` in VSCode editor (column 2)
- Styled with lighter color (#999) and smaller font for subtlety
- Implemented using new `OPEN_DOCS_FILE` message type

**Backend Implementation:**
- New message type: `OpenDocsFileMessage` in `src/shared/types/messages/ui.ts`
- Added `MessageType.OPEN_DOCS_FILE` to enum
- Created `handleOpenDocsFile()` in UIHandler
- Added `'ui.docs'` to ErrorSource type
- Opens files from `docs/` directory (similar to guide files from `resources/craft-guides/`)

**Files Modified:**
- `src/presentation/webview/components/SettingsOverlay.tsx` - Added clickable link
- `src/shared/types/messages/ui.ts` - New message type
- `src/shared/types/messages/base.ts` - Added to MessageType enum
- `src/shared/types/messages/results.ts` - Added 'ui.docs' to ErrorSource
- `src/application/handlers/domain/UIHandler.ts` - New handler method

**User Impact:**
Easy access to model recommendations directly from Settings panel.

---

#### RECOMMENDED_MODELS.md - Reformatted for Raw Markdown Readability

Completely reformatted [docs/RECOMMENDED_MODELS.md](RECOMMENDED_MODELS.md) for better readability in raw markdown:

**Changes:**
- **Removed**: Markdown tables (hard to read in raw form)
- **Added**: Clean bullet-list format with:
  - Section headers with emojis (🎭, 🧠, 🚀, ⚡, 💻)
  - Each model as `###` heading with descriptive subtitle
  - Bullet points for key details (Best For, Description)
  - Indented sub-bullets for links (OpenRouter, Provider)
  - All plain text lists (no table parsing needed)

**Example Format:**
```markdown
### Claude Sonnet 4.5 — The Gold Standard

- **Best For:** Top-tier powerhouse for all creative tasks
- **Description:** Exceptional at natural prose, deep subtext, and complex narrative construction
- **Links:**
  - OpenRouter: https://openrouter.ai/anthropic/claude-sonnet-4.5
  - Anthropic: https://www.anthropic.com
```

**Sections:**
1. Creative Prose & Storytelling (7 models)
2. Deep Analysis & Structural Logic (5 models)
3. Frontier Powerhouses (3 models)
4. Fast & Efficient (3 models)
5. Specialized Coding (3 models)

**User Impact:**
Users viewing the raw markdown file (via clickable link) can easily scan through models without needing markdown preview.

---

#### Architecture Debt - Tailwind + Custom CSS Pattern

Created new architecture debt document: [.todo/architecture-debt/2025-11-20-tailwind-custom-css-pattern.md](.todo/architecture-debt/2025-11-20-tailwind-custom-css-pattern.md)

**Problem Identified:**
- Tailwind CSS is fully configured but unused
- Current codebase uses only custom CSS classes
- One-off styles require inline `style={{}}` (triggers linter warnings)
- No established pattern for when to use custom classes vs. Tailwind utilities

**Recommendation:**
Hybrid pattern - Custom CSS for reusables, Tailwind for one-offs:
- **Custom CSS**: Reusable component styles (`.settings-section`, `.settings-label`, etc.)
- **Tailwind utilities**: Unique, one-off styles (`flex justify-between`, `text-sm`, etc.)
- **Never inline styles**: Avoid `style={{}}` in JSX

**Priority:** Low (quality-of-life improvement)
**Estimated Effort:** 2-4 hours (one sprint)

**Migration Strategy:** Opportunistic refactoring + document pattern for new code (no mass refactor)

---

#### README Screenshots - Settings Access & Configuration Guide

Added 6 new screenshots to help users understand how to launch settings, configure API keys, customize AI behavior, and use new features:

**Screenshots Added:**

1. **screenshot-click-to-open-settings.png** - Shows gear icon location in panel header (added to "Getting Started" section)
2. **screenshot-set-openrouter-api-key.png** - Shows API key entry with secure storage notice (added to "OpenRouter API: When You Need It" section)
3. **screenshot-settings-models.png** - Shows model selection dropdowns (added to "Choose Your Models" step)
4. **screenshot-ai-model-controls.png** - Shows AI configuration options: craft guides, temperature, max tokens, context trimming, token widget (added to "Configure AI Settings" step)
5. **screenshot-search-category-search.png** - Showcases Context Search UI (added to "Context Search" section)
6. **screenshot-settings-pane.png** - Shows full settings overlay (added to "Settings: Complete Control" section)

**User Impact:**

- Users were confused about how to access settings, configure API keys, and customize AI behavior
- Visual guidance now appears in 6 key locations in README
- Shows secure storage notice for API key entry
- Demonstrates temperature control, token limits, and context trimming options
- Helps onboarding for new users discovering extension features

**Locations in README:**

- Line 47: Getting Started → Accessing Settings
- Line 86: OpenRouter API setup → API Key entry screen
- Line 93: Model Selection → Choose your models
- Line 102: AI Settings → Configure temperature, tokens, trimming
- Line 148: Context Search (AI-Powered) feature showcase
- Line 395: Settings: Complete Control section

---

### Changed

#### ARCHITECTURE.md Updates
- Added service-based architecture section
- Documented ProseAnalysisService refactor outcomes
- Updated directory structure diagrams
- Added testing framework documentation

---

## Developer Experience

### Added

#### Claude Code Agent Commands (2 New)
1. **`/archive-epic`** - Archives completed epics to `.todo/archived/`
   - Preserves full directory structure
   - Updates epic status to "Complete"
   - Adds completion date and PR links
   - Creates memory bank summary

2. **`/resume-epic`** - Resumes work on existing epic from memory bank
   - Loads epic context
   - Identifies next sprint
   - Provides sprint checklist
   - References relevant ADRs

**Files Added:**
- `.claude/commands/archive-epic.md`
- `.claude/commands/resume-epic.md`

**Impact:**
Streamlines AI agent workflow for epic/sprint management

---

## Technical Details

### Repository Statistics

**Changes Since v1.0.0:**
- **Commits**: 73 commits over 11 days
- **Files Changed**: 159 files
- **Lines Added**: +33,758
- **Lines Deleted**: -2,402
- **Net Growth**: +31,356 lines
- **PRs Merged**: 5 (#24-30)
- **Tests Added**: 207 tests (from 0)
- **Test Coverage**: 43.1% statements
- **ADRs Written**: 5
- **Epics Completed**: 5
- **Sprints Completed**: 19

**Code Metrics:**
- ProseAnalysisService: **868 lines → 0 lines** (100% elimination)
- Domain Services: **11 services** (avg 181 lines each)
- Test Count: **0 → 207 tests**
- Coverage: **0% → 43.1%**
- Architecture Score: **9.8/10 → 10/10**

---

### Breaking Changes

**None for end users** - All changes are additive or internal refactors.

For contributors/developers:
- `ProseAnalysisService` eliminated (replaced by 11 domain services)
- Import paths changed for services (now organized by subdirectory)
- Test framework requires Jest configuration

---

### Known Issues & Future Work

#### Deferred to v1.2+
- **Word Counter Component**: Duplication across 3 inputs (working, but could be DRYer)
- **Context Search Polish**: Loading state improvements, better error messages
- **Comprehensive Test Coverage**: Expand beyond infrastructure to full application layer

#### Backlog Features
- **Hyphenated Compound Words Analysis**
- **Per-Model Context Limits**
- **Smart Truncation** (summarize middle instead of trimming)
- **Token Counting** (vs. word counting for more accurate cost estimation)
- **Batch Context Search** (search multiple categories at once)

---

### Upgrade Notes

**From v1.0.0:**
1. Update extension via VSCode Marketplace
2. No configuration changes required
3. All settings persist automatically
4. Context Search available immediately (requires API key)

**Testing:**
If you're a contributor, run `npm test` to verify your environment:
```bash
npm install         # Install new dev dependencies (Jest, ts-jest)
npm test            # Run all 207 tests
npm run test:watch  # Watch mode for development
```

---

### Credits

**Development**: AI-driven development (Claude Code, Cline, Codex) with human oversight

**Architecture**: Clean Architecture principles, SOLID design patterns, service composition

**Testing**: Infrastructure-first lightweight testing approach

**Documentation**: Comprehensive ADR/Epic/Sprint system for architectural decision tracking

---

### Support & Feedback

**GitHub Issues**: [https://github.com/okeylanders/prose-minion-vscode/issues](https://github.com/okeylanders/prose-minion-vscode/issues)

**Documentation**: See [README.md](README.md) for comprehensive usage guide

**Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details

**Support Development**: If Prose Minion helps your writing, consider [buying me a coffee](https://buymeacoffee.com/okeylanders)! ☕

---

### Links

- [GitHub Repository](https://github.com/okeylanders/prose-minion-vscode)
- [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode)
- [OpenRouter API](https://openrouter.ai/) - Required for AI features
- [Documentation](docs/)
- [Buy Me a Coffee](https://buymeacoffee.com/okeylanders) - Support development ☕

---

**Thank you for using Prose Minion! Happy writing!** 🎉

---

## [1.0.0] - 2025-11-09

### Overview

The first stable release of Prose Minion: Writing Toolkit! This release represents a complete AI-powered writing assistant for fiction authors, with comprehensive prose analysis tools, context-aware features, and a polished user experience.

**Key Highlights:**
- 🔒 Secure API key storage via OS-level encryption
- 🎨 Marketplace documentation with screenshots
- 🤖 Multiple AI model support through OpenRouter
- 📊 Offline metrics and search (no API key required)
- 🎯 Context-aware dialogue analysis with focused critique modes

---

## Architecture & Infrastructure

### Added

#### Message Envelope Architecture (PRs #12, #13)
- **Strategy Pattern Message Routing**: Eliminated switch statements in favor of map-based routing for both backend and frontend
- **Source Tracking**: All messages now include source metadata for debugging, audit trails, and echo prevention
- **Echo Prevention**: Solved configuration race conditions using source tracking
- **Handler Lifecycle Management**: Handlers now own complete message lifecycle from reception to response
- **Code Reduction**: MessageHandler reduced from 1,091 → 495 lines (54% reduction)

**Benefits:**
- Extension without modification (Open/Closed Principle)
- Domain-specific error handling via source metadata
- Prevents settings from being overwritten during sync

**References:**
- ADR: [docs/adr/2025-10-28-message-envelope-architecture.md](docs/adr/2025-10-28-message-envelope-architecture.md)

---

#### Presentation Layer Domain Hooks (PR #13)
- **8 Domain Hooks**: Extracted from 697-line App.tsx god component
  - `useAnalysis` - Dialogue and prose analysis state
  - `useMetrics` - Prose statistics, style flags, word frequency
  - `useDictionary` - Word definitions and context
  - `useContext` - Context assistant state
  - `useSearch` - Word search results
  - `useSettings` - General settings (later split into specialized hooks)
  - `usePublishingSettings` - Publishing standards configuration
  - `useSelection` - Text selection and paste operations
- **Frontend/Backend Domain Mirroring**: Hooks mirror backend domain handlers for cognitive consistency
- **Tripartite Hook Interface**: All hooks export State, Actions, and Persistence interfaces
- **Infrastructure Hooks**:
  - `useVSCodeApi` - Singleton wrapper for VSCode API
  - `usePersistence` - Automatic vscode.setState() synchronization
  - `useMessageRouter` - Strategy pattern for message routing with stable references
- **Code Reduction**: App.tsx reduced from 697 → 394 lines (43% reduction)
- **Architecture Score**: 9.8/10 (from comprehensive architectural review)

**Benefits:**
- Clear separation of concerns
- Type-safe composition
- Referential stability
- Testability (can mock infrastructure)
- Framework independence

**References:**
- ADR: [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Architectural Review: [.memory-bank/20251102-1845-presentation-layer-architectural-review.md](.memory-bank/20251102-1845-presentation-layer-architectural-review.md)

---

#### Unified Settings Architecture (PRs #18, #19, #20, #21)
- **6 Specialized Settings Hooks**: Eliminated 360-line god hook
  - `useWordSearchSettings` - Word search configuration (4 settings)
  - `useWordFrequencySettings` - Metrics configuration (11 settings)
  - `useContextPathsSettings` - Context paths configuration (8 settings)
  - `useModelsSettings` - AI model selection (8 settings)
  - `useTokensSettings` - Token usage UI preferences (1 setting)
  - `usePublishingSettings` - Publishing standards (2 settings)
- **`useTokenTracking`**: Separate state hook for ephemeral token usage tracking
- **100% Persistence Coverage**: All 29 settings now persist across sessions
- **Backend Semantic Methods**: Replaced hardcoded key lists with semantic methods
  - `getWordSearchSettings()`
  - `getWordFrequencySettings()`
  - `shouldBroadcastGeneralSettings()`
  - etc.
- **Developer Velocity**: 50% faster to add new settings (30 min → 15 min)
- **Naming Convention**: All settings hooks end with "Settings", state hooks don't
- **Consistent Pattern**: Object-based props for all settings hooks

**Benefits:**
- Single source of truth per settings group
- Bidirectional sync (Settings Overlay ↔ VSCode settings panel)
- Clear contracts for persistence
- Eliminates pattern confusion

**References:**
- ADR: [docs/adr/2025-11-03-unified-settings-architecture.md](docs/adr/2025-11-03-unified-settings-architecture.md)
- Epic: [.todo/archived/epics/epic-unified-settings-architecture-2025-11-03/](.todo/archived/epics/epic-unified-settings-architecture-2025-11-03/)

---

### Changed

#### Domain-Organized Message Architecture
- **Message Contracts**: Split from single 532-line file into 11 domain-specific files (674 lines total)
  - `base.ts` - MessageType enum, common types
  - `analysis.ts` - Dialogue & prose analysis
  - `dictionary.ts` - Dictionary operations
  - `context.ts` - Context generation
  - `metrics.ts` - Prose stats, style flags, word frequency
  - `search.ts` - Word search
  - `configuration.ts` - Settings, models, tokens
  - `publishing.ts` - Publishing standards
  - `sources.ts` - File/glob operations
  - `ui.ts` - Tab changes, selections, guides
  - `results.ts` - Result messages
- **10 Domain Handlers**: Extracted from monolithic MessageHandler
  - `AnalysisHandler` - Dialogue and prose analysis
  - `DictionaryHandler` - Word definitions
  - `ContextHandler` - Context generation
  - `MetricsHandler` - Prose statistics
  - `SearchHandler` - Word search
  - `ConfigurationHandler` - Settings management
  - `PublishingHandler` - Publishing standards
  - `SourcesHandler` - File operations
  - `UIHandler` - UI state changes
  - `FileOperationsHandler` - File I/O
- **Backward Compatible**: Barrel export at `src/shared/types/messages/index.ts` maintains existing imports

**Benefits:**
- Easier to find message types
- Better code organization
- Focused, testable handlers
- Scales better with new features

**References:**
- ADR: [docs/adr/2025-10-26-message-architecture-organization.md](docs/adr/2025-10-26-message-architecture-organization.md)

---

## Features

### Added

#### Focused Dialogue Analysis Buttons (PR #22)
- **Four Analysis Modes**:
  - **General Analysis** - Comprehensive dialogue critique (default)
  - **Action & Emotions** - Focus on beats, gestures, emotional subtext
  - **Dialogue Lines** - Focus on word choice, rhythm, authenticity
  - **Creative Variations** - Alternative phrasings and word choices
- **Focus-Specific Prompts**: 4 specialized prompt files override base prompt sections
- **Visual Hierarchy**: Primary/secondary button styling
- **Logging**: Output Channel logs track focus parameter and prompt loading

**Use Case**: Writers can get targeted feedback instead of always receiving general critiques

**References:**
- Sprint: [.todo/archived/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md](.todo/archived/epics/epic-v1-polish-2025-11-02/sprints/03-focused-dialogue-buttons.md)
- Memory Bank: [.memory-bank/20251107-1530-focused-dialogue-buttons-sprint-complete.md](.memory-bank/20251107-1530-focused-dialogue-buttons-sprint-complete.md)

---

#### Context Window Safety (PR #14)
- **UI Word Counters**: Color-coded feedback (green/yellow/red thresholds) on all text inputs
  - Analysis inputs: Yellow at 60K words, red at 75K words
  - Context input: Yellow at 40K words, red at 50K words
- **Backend Silent Trimming**: Sentence boundary-aware trimming prevents token overflow
  - Context Agent: 50,000 words max
  - Analysis Agents: 75,000 words max
- **Transparent Logging**: Output Channel records all trimming operations with word counts
- **Settings Toggle**: `proseMinion.applyContextWindowTrimming` (enabled by default)
- **Clean Architecture**: UI feedback separate from backend trimming concern

**Benefits:**
- Prevents "context length exceeded" errors
- Reduces unexpected API costs
- Preserves sentence integrity

**References:**
- ADR: [docs/adr/2025-11-02-context-window-trim-limits.md](docs/adr/2025-11-02-context-window-trim-limits.md)
- Epic: [.todo/archived/epics/epic-context-window-safety-2025-11-02/](.todo/archived/epics/epic-context-window-safety-2025-11-02/)

---

#### Clickable Resource Pills (PR #15)
- **Interactive Pills**: Resource pills in Context Assistant now open referenced files in VSCode
- **Smart Column Selection**: Opens in second column to prevent excessive editor splits
- **Error Handling**: Graceful handling for non-existent or inaccessible files
- **Consistent Pattern**: Matches existing guide pill interaction behavior

**Use Case**: Quick navigation to referenced chapters/characters/locations from context responses

**References:**
- ADR: [docs/adr/2025-11-02-clickable-resource-pills.md](docs/adr/2025-11-02-clickable-resource-pills.md)
- Epic: [.todo/archived/epics/epic-clickable-resource-pills-2025-11-02/](.todo/archived/epics/epic-clickable-resource-pills-2025-11-02/)

---

#### Word Length Filter for Metrics (PR #17)
- **Tab-Based UI**: Filter word frequency results by minimum character length (1+, 2+, 3+, 4+, 5+, 6+)
- **Backend Filtering**: Filtering happens server-side (not UI-only)
- **Settings Integration**: `proseMinion.wordFrequency.minLength` setting persists choice
- **Segregated Architecture**: Separate `WordFrequencyControls` component for clean separation

**Use Case**: Filter out articles/prepositions (1-2 chars) to focus on content words

**References:**
- ADR: [docs/adr/2025-11-02-word-length-filter-metrics.md](docs/adr/2025-11-02-word-length-filter-metrics.md)
- Epic: [.todo/archived/epics/epic-word-length-filter-metrics-2025-11-02/](.todo/archived/epics/epic-word-length-filter-metrics-2025-11-02/)

---

#### Verbalized Sampling for Creative Diversity (PR #4)
- **Enhanced Prompts**: Dialogue microbeat and prose assistant prompts updated with verbalized sampling techniques
- **Research-Backed**: Techniques from Stanford, Northeastern, and West Virginia University research
- **1.6–2.1× More Creative Range**: Fresher microbeats and richer wordbanks
- **Low-Probability Exploration**: Encourages AI to explore less obvious alternatives

**Benefits:**
- More diverse, creative suggestions
- Reduces repetitive patterns
- Better exploration of vocabulary space

**References:**
- ADR: [docs/adr/2025-10-26-verbalized-sampling.md](docs/adr/2025-10-26-verbalized-sampling.md)
- Epic: [.todo/archived/epics/epic-verbalized-sampling-2025-10-26/](.todo/archived/epics/epic-verbalized-sampling-2025-10-26/)

---

### Security

#### Secure API Key Storage (PR #11)
- **OS-Level Encryption**: Migrated from plain-text settings to platform keychains
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: libsecret
- **Automatic Migration**: One-time migration from legacy `proseMinion.openRouterApiKey` setting
- **Custom UI**: Password-masked input with Save/Clear buttons in Settings overlay
- **Privacy**: Keys never appear in settings files or sync to cloud

**Security Impact**: API keys no longer stored in plain text on disk

**References:**
- ADR: [docs/adr/2025-10-27-secure-api-key-storage.md](docs/adr/2025-10-27-secure-api-key-storage.md)
- Epic: [.todo/archived/epics/epic-secure-storage-2025-10-27/](.todo/archived/epics/epic-secure-storage-2025-10-27/)

---

## Settings & Configuration

### Added

#### Multi-Model Orchestration
- **Scoped Models**: Three independent model selections
  - Assistant Model (dialogue/prose analysis)
  - Dictionary Model (word definitions)
  - Context Model (context generation)
- **Legacy Fallback**: Falls back to general `model` setting if scope-specific not set
- **Live Switching**: Change models in Settings overlay without reload
- **Model Indicators**: Visual indicators show which model is used for each scope

---

#### Enhanced Publishing Standards
- **Dropdown Presets**: Genre and trim size selection in Settings overlay
- **Genre Options**: General Fiction, Mystery/Thriller, Romance, Fantasy/Sci-Fi, Literary Fiction, Young Adult, Middle Grade, Historical Fiction
- **Trim Sizes**: Trade Paperback, Mass Market, Digest, Large Print, Hardcover
- **Comparison View**: Metrics tab shows manuscript stats vs. chosen standard

**Settings:**
- `proseMinion.publishing.genre`
- `proseMinion.publishing.trimSize`

---

#### Comprehensive Word Frequency Settings
- **11 Settings** for fine-grained control:
  - `minLength` - Minimum character length (1-10)
  - `showTopWords` - Toggle Top 100 words
  - `showStopwords` - Toggle Top Stopwords
  - `showHapax` - Toggle Hapax (words used once)
  - `showPOS` - Toggle Part-of-Speech tagging
  - `showBigrams` - Toggle bigrams (2-word phrases)
  - `showTrigrams` - Toggle trigrams (3-word phrases)
  - `showLengthHistogram` - Toggle word length distribution
  - `showLemmas` - Toggle lemmatized forms
  - `listHapax` - Show full hapax list or just count
  - `topWordsCount` - Number of top words to show (10-200)

---

#### Context Paths Configuration
- **8 Context Groups**: Organize manuscript resources
  - Manuscript (polished chapters)
  - Chapters (work-in-progress)
  - Characters (profiles, bios)
  - Locations (place descriptions)
  - Themes (motifs, narrative threads)
  - Things (magic systems, technology, artifacts)
  - Project Brief (synopsis, story bible)
  - General (research, worldbuilding notes)
- **Glob Patterns**: Use wildcards like `chapters/**/*.md`
- **Flexible Organization**: Mix and match groups to suit project structure

**Documentation:** Comprehensive guide in README with examples

---

### Changed

#### Settings Overlay
- **Full-Screen Modal**: Settings now open in full-screen overlay (was sidebar section)
- **Gear Icon**: Access settings via gear icon in title bar
- **Inline Descriptions**: All settings include descriptions and examples
- **Save/Clear Buttons**: Explicit save/clear actions for API key
- **Organized Sections**: Settings grouped by domain (General, Models, Context Paths, Publishing, Word Frequency, etc.)

---

### Fixed

#### SearchTab Settings Bug (PR #18)
- **CRITICAL FIX**: 4 settings were completely non-functional
  - `contextWords` - Number of words to show around matches (default 3)
  - `clusterWindow` - Words between matches to form cluster (default 50)
  - `minClusterSize` - Minimum matches to show cluster (default 2, was 3)
  - `caseSensitive` - Case-sensitive search toggle (default false)
- **No Sync**: Settings changes in SearchTab or Settings Overlay were not syncing
- **No Persistence**: All settings lost on webview reload
- **Wrong Defaults**: `minClusterSize` defaulted to 3 instead of 2

**Resolution:** Created `useWordSearchSettings` domain hook with full bidirectional sync and persistence

**User Impact:** Users no longer lose search customizations on reload

---

## Models & AI

### Added

#### New AI Models
- **Claude Haiku 4.5** (`anthropic/claude-3.5-haiku-20250103:beta`) - Fast, cost-effective
- **Claude Sonnet 4.5** (`anthropic/claude-sonnet-4-5-20250929`) - Default model (best balance)
- **Kimi K2 Thinking** (`moonshot/kimi-k2-thinking:free`) - Thinking/reasoning model (free)
- **Virtuoso Large** (`nousresearch/virtuoso-large:free`) - Large language model (free)

#### Custom Model ID Support
- **Direct Input**: Enter any OpenRouter model ID directly in Settings
- **Documentation**: Comprehensive guide added to README
- **Format**: `provider/model-name:variant`
- **Validation**: Settings validates model ID format

**Use Case**: Access newly released models before they're added to presets

---

### Changed

#### Model Defaults
- **Default Model**: Changed to Claude Sonnet 4.5 (was Claude Sonnet 3.5)
- **Alphabetical Sorting**: Model dropdown now sorted alphabetically for easier browsing
- **Better Organization**: Models grouped by provider (Anthropic, OpenAI, Google, etc.)

---

### Removed

#### Dead Settings
- **`defaultTargets`**: Removed unused search target default setting
- **Legacy API Key Storage**: Plain-text `proseMinion.openRouterApiKey` deprecated (auto-migrates to SecretStorage)

---

## UI/UX Improvements

### Added

#### Professional Marketplace Documentation
- **6 Professional Screenshots**:
  - Dialogue microbeat analysis with resource pills
  - Word pattern search with cluster detection
  - Word frequency with POS tagging and bigrams
  - Prose statistics with publishing standards comparison
  - Style flags detection
  - Fiction-focused dictionary entry
- **Total**: 1.37MB of visual documentation
- **Animated Icon**: GIF for README header (7.28MB)
- **Full-Color PNG Icon**: 128×128px marketplace-compatible icon (621KB)

---

#### README Complete Overhaul
- **New Structure**:
  - ✨ Features at a Glance
  - 🚀 Getting Started
  - 🔑 OpenRouter API: When You Need It
  - 📖 Tools Overview (with screenshots and best practices)
  - 🏗️ Project Structure (recommended directory tree)
  - ⚙️ Settings: Complete Control
  - 🎯 Use Cases (novelists, short story writers, editors)
  - 💡 Tips & Best Practices
- **Critical Usage Notes**:
  - Sidebar width recommendation (400-600px)
  - Excerpt Assistant scope (100-500 words, NOT full chapters)
  - Offline features (Metrics & Search free, no API key)
  - AI features (Assistant & Dictionary require OpenRouter API)
  - Project organization (one chapter per file)
- **Accessible Terminology**: Replaced "Type-token ratio" with "Word variety ratio (unique words ÷ total words)"
- **8 Context Path Groups**: Complete documentation with glob pattern examples

**References:**
- Memory Bank: [.memory-bank/20251109-0809-marketplace-documentation-v1-release.md](.memory-bank/20251109-0809-marketplace-documentation-v1-release.md)

---

#### Loading Animations
- **Custom Prose Minion Animations**: Two themed loading GIFs
  - Green/black VHS glitch: "my world is user generated"
  - Orange/black monochrome monitor glitch: "hello world"
- **Context**: Show while waiting for AI responses
- **Branding**: Reinforces Prose Minion identity

---

#### Dictionary Status Messages (Recent)
- **Status Updates**: Dictionary now shows loading states and error messages
- **Better Feedback**: Users know when definition lookup is in progress

---

### Changed

#### Package Metadata
- **Version**: `0.0.1` → `1.0.0`
- **Display Name**: `Prose Minion` → `Prose Minion: Writing Toolkit`
- **Description**: Enhanced to highlight features and offline capabilities (237 chars)
  > AI prose analysis and writing assistant for fiction authors. Dialogue suggestions, context-aware dictionary, comprehensive prose metrics, style flags, word frequency, and manuscript search. Metrics/search work offline—no API key needed.
- **Publisher**: `okeylanders` → `OkeyLanders`
- **Icon**: SVG → PNG (marketplace requirement)

---

#### Asset Organization
- **Directory Rename**: `resources/` → `assets/` for icon files
- **Consistent Paths**: All icon references updated throughout codebase
- **Better Structure**: Clearer separation between static assets and system prompts

---

### Fixed

#### Metrics Export Duplicate Legend
- **Bug**: Metrics export/copy included duplicate legend in output
- **Fix**: Legend now only appears in on-screen display, not in exported text
- **Scope**: "Copy Report" and "Save Report" functions

---

## Documentation

### Added

#### Architecture Documentation
- **31 Architecture Decision Records (ADRs)**: Comprehensive decision documentation
- **Agent Guidance**: `.ai/central-agent-setup.md` (symlinked to all AI agent configs)
- **Epic/Sprint Structure**: Detailed planning documents for all major features
- **Memory Bank**: 50+ session continuity snapshots for development context
- **Repository Workflow**: Complete guide to ADRs, epics, sprints, and memory bank usage

---

#### Agent Anti-Patterns Guide
- **AI Agent Guardrails**: Documented common anti-patterns and prevention strategies
- **ADR-First Process**: Mandatory architectural planning before coding
- **Architecture Debt Tracking**: Systematic documentation of pragmatic technical decisions
- **Case Studies**: Real examples from this project's development
- **Token Budget Advice**: Spend tokens on planning to save on refactoring

---

#### Author's Note (README)
- **Cline Pairing Note**: Recommendation to use Prose Minion alongside Cline for creative writing workflow
- **Integration Tip**: Use Cline for coding/editing, Prose Minion for prose analysis
- **Workflow**: Separate tools for separate concerns (general vs. specialized AI assistance)

---

### Changed

#### Documentation Headers
- **Copyright/Source Headers**: Updated in 7 documentation files
- **Consistency**: Standardized format across all docs

---

## Technical Details

### Repository Statistics

**Before v1.0 Refactors:**
- MessageHandler: 1,091 lines
- App.tsx: 697 lines
- Switch statements: ~130 lines
- Settings persistence: 86% (25/29)
- TypeScript compilation errors: Various
- Architecture score: ~4/10

**After v1.0:**
- MessageHandler: 495 lines (54% reduction)
- App.tsx: 394 lines (43% reduction)
- Switch statements: 0 (eliminated)
- Settings persistence: 100% (29/29)
- TypeScript compilation errors: 0
- Architecture score: 9.8/10

---

### Breaking Changes

**None for end users** - This is the first release, so no prior versions to break.

For contributors/developers:
- Message types now organized by domain (import from `src/shared/types/messages/` still works)
- Settings must use Domain Hooks pattern (message-based pattern deprecated)
- `useSettings` hook eliminated (replaced by 6 specialized hooks)

---

### Known Issues & Future Work

#### Deferred to v1.1+
- **Automated Test Suite**: Comprehensive test coverage for settings sync (manual testing complete)
- **Word Counter Component**: UI component duplication across 3 inputs (working, but could be DRYer)
- **Documentation**: Comprehensive ARCHITECTURE.md expansion (basic docs complete in CLAUDE.md)

#### Backlog Features
- **Context Search** (AI-assisted search expansion)
- **Hyphenated Compound Words Analysis**
- **Per-Model Context Limits**
- **Smart Truncation** (summarize middle instead of trimming)
- **Token Counting** (vs. word counting for more accurate cost estimation)

---

### Credits

**Development**: AI-driven development (Claude Code, Cline, Codex) with human oversight

**Architecture**: Clean Architecture principles, SOLID design patterns, domain-driven design

**Research**: Verbalized sampling techniques from Stanford, Northeastern, and West Virginia University

**Testing**: Comprehensive manual testing with documented checklists per epic

---

### Upgrade Notes

**First-Time Installation:**
1. Install from VSCode Marketplace
2. Open Settings (gear icon in Prose Minion sidebar)
3. Add OpenRouter API key (optional - only needed for AI features)
4. Configure context paths to point to your manuscript

**From Pre-Release Versions:**
- API key will automatically migrate from settings to SecretStorage on first launch
- All settings will persist automatically using new hooks architecture
- No manual migration required

---

### Support & Feedback

**GitHub Issues**: [https://github.com/okeylanders/prose-minion-vscode/issues](https://github.com/okeylanders/prose-minion-vscode/issues)

**Documentation**: See [README.md](README.md) for comprehensive usage guide

**Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details

**Support Development**: If Prose Minion helps your writing, consider [buying me a coffee](https://buymeacoffee.com/okeylanders)! ☕

---

### Links

- [GitHub Repository](https://github.com/okeylanders/prose-minion-vscode)
- [VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=OkeyLanders.prose-minion-vscode) (coming soon)
- [OpenRouter API](https://openrouter.ai/) - Required for AI features
- [Documentation](docs/)
- [Buy Me a Coffee](https://buymeacoffee.com/okeylanders) - Support development ☕

---

**Total PRs in v1.0**: 23 pull requests merged
**Total Commits**: 100+ commits
**Development Time**: October 2025 - November 2025 (1 month intensive development)
**Lines of Planning Documentation**: 2,000+ lines across ADRs, epics, sprints, memory bank

---

## v1.0.0 - The Journey

This release represents a complete transformation from initial concept to production-ready tool. Key milestones:

1. **Architecture Foundation** (Oct 26-27): Message organization, domain hooks, secure storage
2. **Message Envelope Refactor** (Oct 28-Nov 1): Eliminated switch statements, added source tracking
3. **Settings Unification** (Nov 3-7): Fixed critical bugs, achieved 100% persistence, eliminated god hooks
4. **v1.0 Polish** (Nov 2-9): Context window safety, clickable pills, word filters, focused dialogue
5. **Marketplace Preparation** (Nov 9): Professional documentation, screenshots, metadata

**Architecture Achievement**: Started at ~4/10, achieved 9.8/10 through systematic refactoring and ADR-first process.

**Philosophy**: Spend tokens on planning to save on refactoring. The comprehensive ADR/Epic/Sprint system prevented architectural debt and enabled rapid, confident iteration.

---

Thank you for using Prose Minion! Happy writing! 🎉
