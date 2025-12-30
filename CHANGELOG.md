# Changelog

For detailed technical documentation, see [docs/CHANGELOG-DETAILED.md](docs/CHANGELOG-DETAILED.md).

## [1.7.0] - 2025-12-30

### Added

- **🤖 Z.AI GLM 4.7 Model**: New Chinese-developed LLM available in all model dropdowns
  - Added to both Category Models and Recommended Models
  - Competitive reasoning and language capabilities

### Changed

- **🔄 Default Fallback Model**: Changed from `z-ai/glm-4.6` to `anthropic/claude-sonnet-4.5`
  - More reliable default when no model is explicitly selected
  - Applies to all model scopes (assistant, dictionary, context)

### Removed

- **🗑️ Legacy Model Setting**: Removed deprecated `proseMinion.model` setting
  - Scoped settings (`assistantModel`, `dictionaryModel`, `contextModel`) are the standard approach
  - Simplifies configuration and reduces confusion

### Technical Details

- PR: [#53](https://github.com/okeylanders/prose-minion-vscode/pull/53)

---

## [1.6.1] - 2025-12-18

### Added

- **🤖 Gemini 3 Flash Preview Model**: New high-speed thinking model for agentic workflows
  - Near Pro-level reasoning at lower latency
  - Available in all model dropdowns

- **📚 New Craft Guides**: Added 3 new creative writing guides
  - Deep POV guide for immersive narration
  - Indirect dialogue techniques
  - Subtext and implication patterns

### Fixed

- **📂 Documentation Path References**: Fixed stale `.todo/architecture-debt/` → `.todo/tech-debt/`
- **📖 Domain Hooks Documentation**: Updated list from 8 to 14 hooks

### Technical Details

- Documentation cleanup: central-agent-setup.md reduced by 58% (1,653 → 694 lines)
- PR: [#52](https://github.com/okeylanders/prose-minion-vscode/pull/52)

---

## [1.6.0] - 2025-12-16

### Added

- **🔤 N-gram Mode for Category Search**: Search for 2-word (bigrams) or 3-word (trigrams) phrases
  - Tab-based mode selector: Words / Bigrams / Trigrams
  - Min occurrences filter (1-5) to reduce noise from rare phrases
  - Useful for finding full names, compound concepts, or multi-word expressions
  - Warning message about increased token usage for phrase-based searches

- **⏹️ Category Search Cancellation**: Cancel long-running searches with partial results
  - Red "✕ Cancel" button during search
  - Preserves matches found before cancellation
  - Warning message indicates how many batches completed

### Enhanced

- **🧹 Punctuation Stripping**: N-grams now strip punctuation for cleaner phrase matching
  - Preserves apostrophes for contractions (e.g., "don't", "it's")
  - Prevents artifacts like "cold," or "night." in results

### Technical Details

- New types: `NGramMode`, `MinOccurrences` with const arrays for UI iteration
- New message type: `CANCEL_CATEGORY_SEARCH_REQUEST`
- AbortController pattern for graceful cancellation
- Mode-aware batch sizing: 400 words, 200 bigrams, 150 trigrams
- System prompt updated with bigram/trigram examples
- PR: [#51](https://github.com/okeylanders/prose-minion-vscode/pull/51)

---

## [1.5.0] - 2025-12-11

### Added

- **✍️ Writing Tools Assistant**: Six specialized writing analysis tools
  - **Cliche Analysis**: Detects dead metaphors, stock phrases, and overused expressions
  - **Continuity Check**: Finds scene choreography issues and timeline inconsistencies
  - **Style Consistency**: Identifies tense shifts, POV breaks, and register drift
  - **Editor (Grammar)**: Copyediting for grammar, spelling, and punctuation
  - **Fresh Check**: Engagement analysis for character depth, pacing, and stakes
  - **Repetition Analysis**: Detects echo words, recycled metaphors, and structural redundancy

- **📖 Narrative Sequence Context**: Context Assistant now outputs structured sequence info
  - Previous scene summary with tension level and function
  - Excerpt's structural role in the narrative
  - Following scene preview (when available)
  - Position in story arc

### Enhanced

- **🔄 Streaming Improvements**: Cancel preserves partial content instead of clearing
- **📋 Ctrl+V Source Detection**: Native paste now detects source file from clipboard
- **🔒 Security Hardening**: Context assistant validates resource paths
- **🧪 Test Coverage**: Added WritingToolsAssistant tests (11 new tests)

### Fixed

- Type safety improvements (removed `any` assertions in orchestration layer)
- Missing message types added to union exports
- React ref cleanup for memory leak prevention
- Logging consistency (console.warn → outputChannel)

### Technical Details

- New `ANALYZE_WRITING_TOOLS` message type with `WritingToolsFocus` discriminant
- FILE_PREFIX_MAP for Open/Closed Principle compliance
- Strategy pattern in useSelection for message handling
- PR: [#50](https://github.com/okeylanders/prose-minion-vscode/pull/50)

---

## [1.4.0] - 2025-12-06

### Added

- **🌊 Streaming Responses**: AI responses now stream in real-time
  - Watch dialogue analysis, prose analysis, context generation, and dictionary lookups as they generate
  - Live token count display during streaming
  - Progressive rendering for faster perceived performance

- **⏹️ Request Cancellation**: Stop AI operations mid-stream
  - Cancel button appears during all streaming operations
  - Graceful abort with "(Cancelled)" message instead of errors
  - Immediate token savings when you cancel early

- **🔄 Race Condition Protection**: Prevents wasted API tokens
  - Starting a new request automatically cancels any in-progress request
  - Backend receives cancel signal to stop generating immediately
  - No orphaned requests burning tokens in the background

### Enhanced

- **Context Preview UX**: Toggle button with flash animation for context visibility
- **AbortError Handling**: User-friendly cancellation messages across all services
- **HTTP Cleanup**: Stream connections closed immediately on abort
- **Debug Logging**: SSE parsing issues logged to Output Channel

### Technical Details

- New message types: `STREAM_STARTED`, `STREAM_CHUNK`, `STREAM_COMPLETE`, `CANCEL_*_REQUEST`
- AbortSignal threads through entire stack (UI → handlers → services → OpenRouter)
- Shared `useStreaming` hook for consistent streaming state management
- PR: [#49](https://github.com/okeylanders/prose-minion-vscode/pull/49)

---

## [1.3.3] - 2025-12-04

### Enhanced

- **⚡ React.memo Performance**: All tab components wrapped in React.memo
  - `AnalysisTab`, `SearchTab`, `MetricsTab`, `UtilitiesTab`, `SettingsOverlay` memoized
  - Prevents unnecessary re-renders when parent state changes
  - displayName added for React DevTools debugging
  - PR: [#47](https://github.com/okeylanders/prose-minion-vscode/pull/47)

---

## [1.3.2] - 2025-12-04

### Added

- **🛡️ Error Boundaries**: Graceful error handling prevents UI crashes
  - `ErrorBoundary` component catches React rendering errors
  - `TabErrorFallback` provides friendly error UI with retry/reload buttons
  - All 5 tabs wrapped in isolated error boundaries (one crash doesn't affect others)
  - MarkdownRenderer wrapped in 7 panel components for parsing error fallback
  - Errors logged to Output Channel via `WEBVIEW_ERROR` telemetry

### Enhanced

- **🏗️ Architecture Health Pass (Sub-Epic 4, Sprint 01)**
  - Error boundary pattern with refs for programmatic reset
  - Unified error logging through UIHandler
  - VSCode-themed fallback UI with retry functionality

### Technical Details

- Components created: `ErrorBoundary.tsx`, `TabErrorFallback.tsx`
- Files modified: App.tsx, UIHandler.ts, 7 panel components
- PR: [#46](https://github.com/okeylanders/prose-minion-vscode/pull/46)

---

## [1.3.1] - 2025-11-29

### Fixed

- **Dictionary Save**: Fast Dictionary results now save correctly to dictionary-entries folder
  - Previously only standard Dictionary Lookup results were saved
  - Fast Generate results now follow the same save path

---

## [1.3.0] - 2025-11-27

### Added

- **📝 Phrase Lookup**: Dictionary now supports multi-word phrases up to 6 words
  - Look up idioms, expressions, and contextual phrases
  - Improved dictionary UX with auto-scroll to results
  - Cleaner "More to explore" display format

- **🤖 New AI Models**:
  - Claude Opus 4.5 - Anthropic's frontier reasoning model for complex tasks
  - Cogito v2.1 671B - One of the strongest open models globally

- **📝 Experiment with Larger Passages**: Assistant tab now allows up to 2000 words before warning
  - Try analyzing whole chapter scenes for larger revision suggestions

### Enhanced

- **🏗️ Architecture Health Pass**: Major internal refactoring (2 sub-epics, 8 sprints)
  - Result Formatter decomposition: 769 lines → 8 focused files
  - Shared types & semantic import aliases (zero relative imports)
  - Prop drilling elimination + comprehensive type safety
  - Domain-oriented component directory structure
  - Shared components: ScopeBox, LoadingIndicator, WordCounter, TabBar
  - StatusEmitter unification with ticker message support

### Fixed

- Context assistant max turns recovery and catalog prioritization
- Dictionary auto-run race condition (multiple root causes addressed)
- SearchTab and MetricsTab UI spacing improvements
- SearchHandler ticker forwarding
- Ticker animation reset on content updates
- @messages alias webpack runtime resolution

### Developer Tools

- `/release-vsce` slash command for streamlined extension releases
- Release branch strategy with orchestration support

---

## [1.1.1] - 2025-11-20

### Added

- **⚡ Fast Generate (Experimental)**: Parallel dictionary generation using concurrent API calls (2-4× faster)
  - 14 dictionary blocks generated in parallel with 7-thread concurrency
  - Progress bar UI with real-time updates
  - Token usage aggregation across all API calls
  - Fan-out pattern using `p-limit` for rate limiting

### Fixed

- Error recovery for fast generation loading state (UI no longer gets stuck on API errors)
- Added loading widget consistency for fast generation loading indicator

---

## [1.1.0] - 2025-11-20

### Added

- **Context Search**: AI-powered semantic word discovery - search by category or concept (e.g., `[clothing]`, `[angry]`, `[color red]`) to find related words in your manuscript
- **Custom Model IDs**: Power users can now enter any OpenRouter model ID directly in VS Code's settings interface. ( Curated dropdown remains in Prose Minion settings pane )
- **Testing Framework**: 207 automated tests protecting core functionality (43.1% coverage)
- **Agent Commands**: `/archive-epic` and `/resume-epic` for development workflow

### Enhanced

- Added clear description for N-gram filter behavior in Settings
- Better model selection sync across UI
- Improved category search loading states

### Fixed

- Token totals not resetting on extension startup
- Context model selection refresh issues
- Word search save functionality
- Category search parsing and export errors
- UI blocking during long category searches
- Category model config watcher not triggering updates

### Refactored

- Eliminated 916-line god component into 11 focused services
- Improved code maintainability and developer velocity
- Resolved 3 architecture debt items
- Better test coverage for settings hooks

### Documentation

- 5 new Architecture Decision Records
- Updated agent guidance and testing documentation
- Archived 5 completed epics (19 sprints total)
- Added Context Search section to README with usage examples
- Added clickable model reference guide link in Settings (opens RECOMMENDED_MODELS.md)
- Reformatted RECOMMENDED_MODELS.md for better raw markdown readability (no tables)
- Created architecture debt document for Tailwind + Custom CSS pattern
- Added 6 screenshots to README showing complete setup flow: accessing settings, API keys, model selection, AI configuration, and new features

---

## [1.0.0] - 2025-11-09

### Overview

First stable release of Prose Minion: Writing Toolkit - a complete AI-powered writing assistant for fiction authors.

### Key Features

- **AI-Powered Analysis**: Dialogue microbeat suggestions, prose analysis with multiple critique modes
- **Context-Aware Dictionary**: Fiction-focused word definitions with manuscript context
- **Comprehensive Metrics**: Prose statistics, style flags, word frequency analysis (with POS tagging, bigrams, trigrams, hapax)
- **Manuscript Search**: Word pattern search with clustering and chapter detection
- **Publishing Standards**: Compare your manuscript against industry standards
- **Offline Features**: Metrics and search work without API key

### Architecture & Infrastructure

- Message Envelope Architecture with Strategy Pattern routing
- Domain-organized message system (11 domain-specific contracts)
- Presentation Layer Domain Hooks (8 hooks mirroring backend handlers)
- Unified Settings Architecture (6 specialized settings hooks, 100% persistence)
- Clean Architecture (9.8/10 score)

### Security

- Secure API key storage via OS-level encryption (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Automatic migration from legacy plain-text storage

### Settings & Configuration

- Multi-model orchestration (separate models for assistant, dictionary, context)
- Context window safety with color-coded UI feedback and automatic trimming
- Publishing standards presets (genre + trim size selection)
- 11 word frequency settings for fine-grained control
- 8 context path groups for manuscript organization

### UI/UX Improvements

- Full-screen Settings overlay with gear icon access
- Professional marketplace documentation with 6 screenshots
- Custom loading animations
- Clickable resource pills in Context Assistant
- Word length filter for metrics (1+ to 6+ characters)
- Focused dialogue analysis buttons (General, Action & Emotions, Dialogue Lines, Creative Variations)

### Models & AI

- Claude Haiku 4.5, Claude Sonnet 4.5 (default)
- Kimi K2 Thinking, Virtuoso Large
- Custom model ID support
- Verbalized sampling for creative diversity (1.6-2.1× more creative range)

### Known Features

- Dialogue microbeat analysis with action beats and emotional subtext
- Prose assistant for general prose improvement
- Context assistant with multi-turn conversations
- Word search with clustering (smart grouping of nearby matches)
- Chapter-by-chapter prose statistics
- Publishing standards comparison (word count, pages, readability)
- Export results to markdown reports

---

## Support & Feedback

**Issues**: [GitHub Issues](https://github.com/okeylanders/prose-minion-vscode/issues)

**Documentation**: See [README.md](README.md) for comprehensive usage guide

**Support Development**: [Buy me a coffee](https://buymeacoffee.com/okeylanders) ☕

---

**Thank you for using Prose Minion! Happy writing!** 🎉
