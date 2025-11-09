# Changelog

All notable changes to the Prose Minion VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
