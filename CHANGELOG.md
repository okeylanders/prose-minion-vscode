# Changelog

For detailed technical documentation, see [docs/CHANGELOG-DETAILED.md](docs/CHANGELOG-DETAILED.md).

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
