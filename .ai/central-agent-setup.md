# Agentss Guide for Prose Minion VSCode Extension

This document provides guidance for AI agents (like Claude) working with the Prose Minion VSCode extension codebase.

## Project Overview

Prose Minion is a VSCode extension that provides AI-powered prose analysis and writing assistance for creative writers. It uses OpenRouter API to access various LLMs for analyzing dialogue, prose, and providing writing metrics.

## Architecture

The project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── application/        # Application layer (orchestration)
│   ├── providers/      # VSCode webview providers
│   └── handlers/       # Message routing and domain handlers
│       ├── MessageHandler.ts    # Main dispatcher (routes messages)
│       └── domain/              # Domain-specific handlers
│           ├── AnalysisHandler.ts
│           ├── DictionaryHandler.ts
│           ├── ContextHandler.ts
│           ├── MetricsHandler.ts
│           ├── SearchHandler.ts
│           ├── ConfigurationHandler.ts
│           ├── PublishingHandler.ts
│           ├── SourcesHandler.ts
│           ├── UIHandler.ts
│           └── FileOperationsHandler.ts
├── domain/            # Domain layer (business logic)
│   ├── models/        # Domain models and entities
│   └── services/      # Service interfaces
├── infrastructure/    # Infrastructure layer (external integrations)
│   └── api/          # OpenRouter API client and implementations
├── presentation/      # Presentation layer (UI)
│   └── webview/      # React components for the webview
└── shared/           # Shared types and utilities
    └── types/        # Shared type definitions
        └── messages/   # Message contracts (domain-organized)
            ├── index.ts          # Barrel export
            ├── base.ts           # MessageType enum, common types
            ├── analysis.ts       # Dialogue & prose analysis
            ├── dictionary.ts     # Dictionary operations
            ├── context.ts        # Context generation
            ├── metrics.ts        # Prose stats, style flags, word frequency
            ├── search.ts         # Word search
            ├── configuration.ts  # Settings, models, tokens
            ├── publishing.ts     # Publishing standards
            ├── sources.ts        # File/glob operations
            ├── ui.ts            # Tab changes, selections, guides
            └── results.ts       # Result messages
```

### Key Components

1. **Extension Entry Point** ([extension.ts](src/extension.ts))
   - Initializes the extension
   - Sets up dependency injection
   - Registers commands and providers

2. **Webview Provider** ([ProseToolsViewProvider.ts](src/application/providers/ProseToolsViewProvider.ts))
   - Manages the webview lifecycle
   - Handles communication between extension and React UI
   - Routes messages to appropriate tools

3. **Analysis Tools** (src/tools/)
   - **Assist Tools**: AI-powered analysis tools
     - `dialogueMicrobeatAssistant`: Analyzes dialogue and suggests tags/action beats
     - `proseAssistant`: General prose analysis and improvement suggestions
   - **Measure Tools**: Statistical analysis tools
     - `passageProseStats`: Word count, sentence analysis, pacing metrics
     - `styleFlags`: Identifies style patterns and issues
     - `wordFrequency`: Word usage patterns, Top 100, stopwords, hapax (list), POS via wink, bigrams/trigrams, length histogram, optional lemmas

4. **OpenRouter Integration** ([OpenRouterClient.ts](src/infrastructure/api/OpenRouterClient.ts))
   - HTTP client for OpenRouter API
   - Handles API key management from VSCode settings
   - Supports multiple AI models (Claude, GPT-4, Gemini)
   - Instantiated per model scope (assistant, dictionary, context)

5. **Prompt System** ([prompts.ts](src/tools/shared/prompts.ts))
   - Loads system prompts from `resources/system-prompts/`
   - Each tool has its own prompt directory with numbered markdown files
   - Prompts define the AI's behavior and instructions

6. **Craft Guides** ([guides.ts](src/tools/shared/guides.ts))
   - Optional writing craft guides from `resources/craft-guides/`
   - Provides examples and best practices to the AI
   - Can be toggled via settings

## Working with This Codebase

### Common Tasks

#### Adding a New Analysis Tool

1. **Define message types**: Add to appropriate domain file in `src/shared/types/messages/` (or create a new one)
   - Add message interface extending `BaseMessage`
   - Add to `MessageType` enum in `base.ts`
   - Export from `index.ts` barrel export

2. **Add domain handler** (if new domain):
   - Create new handler in `src/application/handlers/domain/`
   - Inject dependencies via constructor (service, helper methods)
   - Implement handler methods for the domain

3. **Update MessageHandler routing**:
   - Instantiate domain handler in `MessageHandler` constructor
   - Add case to switch statement to delegate to domain handler

4. **Add service method**:
   - Add method to `IProseAnalysisService` interface
   - Implement in `ProseAnalysisService`

5. **Create system prompts** in `resources/system-prompts/[tool-name]/`

6. **Add UI components** in `src/presentation/webview/components/`

#### Modifying AI Behavior

1. Edit system prompts in `resources/system-prompts/`
2. Each tool loads prompts from numbered markdown files (00-, 01-, etc.)
3. Shared prompts apply to all tools
4. Craft guides provide additional context (optional)

#### Adding New Configuration Options

1. Update `package.json` in the `contributes.configuration` section
2. Access scoped settings via `vscode.workspace.getConfiguration('proseMinion')`
3. Pass settings through the service layer (dependency injection) and ensure the relevant orchestrator is refreshed (`ProseAnalysisService.refreshConfiguration`)

### Code Style and Patterns

- **Dependency Injection**: Services are injected through constructors
- **Interface Segregation**: Domain layer defines interfaces, infrastructure implements
- **Message Passing**: Extension and webview communicate via typed messages
- **TypeScript**: Strict typing throughout the codebase
- **Error Handling**: Try/catch with fallbacks for missing resources

### Alpha Development Guidelines

**This is alpha software with no released versions. Backward compatibility is NOT required.**

- **No Backward Compatibility Required**: All changes are breaking changes until v1.0 release. Don't maintain deprecated code paths, interfaces, or legacy routes.
- **Remove Dead Code Aggressively**: When refactoring, fully remove old implementations rather than marking them "deprecated" or adding compatibility shims.
- **Clean Architecture Over Compatibility**: Favor simplicity, clarity, and maintainability over hypothetical future needs.
- **Breaking Changes Are Free**: Feel empowered to make large architectural improvements without worrying about existing deployments.
- **Incremental Cleanup**: If a feature has both old and new paths during development, remove the old path in the same PR or immediately after verification.

**Examples**:

- ✅ Remove old message types entirely when introducing new ones
- ✅ Delete unused interfaces and handlers immediately
- ❌ Don't keep "legacy routes" with comments like "keep for backward compatibility"
- ❌ Don't add boolean flags like `asOldBehavior` to maintain dual behavior

### Important Files to Know

- [package.json](package.json) - Extension manifest and configuration
- [extension.ts](src/extension.ts) - Extension activation and setup
- [MessageHandler.ts](src/application/handlers/MessageHandler.ts) - Main message dispatcher (routes to domain handlers)
- [src/application/handlers/domain/](src/application/handlers/domain/) - Domain-specific handlers (10 handlers organized by feature)
- [src/shared/types/messages/](src/shared/types/messages/) - Message contracts organized by domain (import from `index.ts` barrel export)
- [OpenRouterModels.ts](src/infrastructure/api/OpenRouterModels.ts) - Available AI models
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Detailed architecture documentation

### Resource Files

The `resources/` directory contains:
- **system-prompts/**: AI instructions for each tool
- **craft-guides/**: Writing craft examples and best practices
  - `scene-example-guides/`: Specific scene examples
  - `descriptors-and-placeholders/`: Emotion and expression snippets

## Repository Workflow: ADRs, TODOs, Memory Bank

- **.ai/central-agent-setup.md** is a symlinked by: .codex/agents.md, .claude/CLAUDE.md, .cline-rules/prose-minion-agent so that each agent assisted tool is sourced against a central document. Update this document to change agent guidance everywhere.

- docs/adr/: Architecture Decision Records
  - Holds decision docs that drive notable changes and features.
  - Epics and sprints reference ADRs for traceability and rationale.

- .todo/: Epics and Sprints
  - `epics/`: Long-running themes or feature tracks. Each epic folder (e.g., `epic-verbalized-sampling-2025-10-26/`) contains an epic overview markdown and a `sprints/` subfolder.
  - `sprints/`: Execution units under an epic (e.g., `01-prompt-enhancements.md`). Each sprint lists scope, tasks, acceptance criteria, and links to relevant ADRs.
  - Coupling: Epics and sprints are tied to ADRs. New or updated ADRs should be linked from the epic and each sprint that implements them. Sprints should call out exactly which ADR(s) they implement.

- .memory-bank/: Working context snapshots
  - Lightweight notes that capture current focus, links to ADRs, the active epic/sprint, and any open questions.
  - Use it to provide quick on-ramps for agents and maintain continuity between sessions.

- Branching per sprint
  - Each sprint runs on its own Git branch to isolate work and simplify review.
  - Suggested naming: `sprint/<epic-slug>-<NN>-<sprint-slug>`
    - Example: `sprint/epic-verbalized-sampling-2025-10-26-01-prompt-enhancements`
  - Open PRs should reference the sprint doc and the ADR(s) it implements.
  - When merging, ensure the sprint doc is updated with outcomes and the memory bank receives a brief summary + links.

## Testing and Development

### Running the Extension

```bash
npm install
npm run watch
```

Then press F5 in VSCode to launch the Extension Development Host.

### Building for Production

```bash
npm run build
npm run package  # Creates .vsix file
```

## Integration Points

### OpenRouter API

- API key configured in VSCode settings
- Scoped models per role: `assistantModel`, `dictionaryModel`, `contextModel` with legacy fallback `model`
- Unified `maxTokens` across tools (default 10000) with truncation notices when responses hit the cap
- Cost tracking available through OpenRouter dashboard

### VSCode Extension API

- Uses webview API for React UI
- Context menu integration for "Analyze with Prose Minion"
- Real-time selection updates (optional)
- Configuration API for user settings (keep UI dropdowns and settings synchronized)

## Future Enhancements

Potential areas for expansion:
- MCP (Model Context Protocol) integration for direct tool communication
- Additional analysis tools (character voice, setting description, etc.)
- Batch processing for multiple files
- Custom prompt templates per project
- Integration with writing project management tools

## Best Practices for AI Agents

When working with this codebase:

1. **Respect the Architecture**: Keep clear boundaries between layers
2. **Follow Existing Patterns**: Match the style of existing tools and components
3. **Preserve Type Safety**: Maintain TypeScript types throughout
4. **Test Incrementally**: Run the extension after changes to verify behavior
5. **Document Changes**: Update relevant documentation when adding features
6. **Consider Performance**: Be mindful of API costs and token usage
7. **Maintain Backward Compatibility**: Preserve the legacy `proseMinion.model` fallback and message contracts (metrics renderers for Word Frequency evolve in lockstep with payloads)
8. **Respect Persistence Hooks**: Keep the result cache (`MessageHandler`) and `vscode.setState` synchronization intact; Dictionary inputs persist at App level
9. **Surface Truncation**: Propagate `finish_reason` and append a truncation note when responses hit the token cap
10. **Source-Aware Context**: Include `sourceUri`/`relativePath`; context assistant includes full source content on first turn

## Publishing Standards + Metrics

- Use the `PublishingStandardsRepository` and `StandardsComparisonService` patterns when adding or modifying comparison logic.
- Do not conflate Type-Token Ratio (TTR) with lexical density; lexical density is the content-word ratio (non-stopwords/total) × 100.
- When exporting metrics, rely on the extension-side modal prompt to include/exclude the "## Chapter Details" section. Never remove the on-screen “📖 Chapter-by-Chapter Prose Statistics” summary table.
- Metrics reports should save under `prose-minion/reports/` using timestamped filenames.

## What's New

- **Domain-Organized Message Architecture** (Oct 2025): Complete refactor of messaging layer for better maintainability
  - Message contracts split from single `messages.ts` (532 lines) into 11 domain-specific files (674 lines total)
  - MessageHandler reduced from 1091 lines → 495 lines (54% reduction!)
  - 10 domain handlers extract feature-specific logic into focused, testable modules
  - Backward compatible via barrel export at `src/shared/types/messages/index.ts`
  - See [ADR](docs/adr/2025-10-26-message-architecture-organization.md) and [Memory Bank](../.memory-bank/20251026-2130-message-architecture-refactor.md)

- **Verbalized Sampling for Creative Diversity**: Dialogue and prose assistants now provide more diverse, character-specific suggestions while maintaining craft quality. Using research-backed techniques from Stanford/Northeastern/WVU, suggestions are sampled from the "tails of the probability distribution" to unlock 1.6–2.1× more creative range. Expect fresher microbeats, richer wordbanks, and unexpected-yet-grounded alternatives.

- **Multi-Model Orchestration & Settings UI**:
  - Multi-model orchestration per scope with live model switching in the UI
  - Full-screen Settings overlay with gear icon toggle in title bar
  - All settings configurable in-app with inline descriptions and examples
  - Publishing Standards as dropdowns (genre + trim options)
  - Reset Token Usage button in settings

- **Enhanced Features**:
  - Default `maxTokens` increased to 10000 and applied uniformly
  - Truncation notice appended when AI returns `finish_reason: "length"`
  - Context assistant includes the full source document on initial turn (when available)
  - Paste-selection carries source metadata; clipboard fallback when no selection
  - Dictionary inputs persist across tabs/sessions; auto-fill suppressed after user edits; source displayed when available
  - UI consistency: paste buttons sized to match the context-assist button
  - Word Frequency: Top 100 words, Top Stopwords, Hapax list (+count/%), POS via wink (offline), bigrams/trigrams, word-length histogram (1–10 chars), optional Top Lemmas view; settings under `proseMinion.wordFrequency.*`

## Questions and Support

For questions about the codebase:
1. Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture info
2. Review existing tool implementations as examples
3. Check the VSCode Extension API documentation for platform-specific features
4. Refer to OpenRouter API documentation for model capabilities

## Related Projects

- **Prose Minion MCP Tool**: The original MCP-based version
- **Claude Desktop**: Can integrate with this extension via MCP protocol (planned)
