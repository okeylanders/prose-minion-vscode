# Agents Guide for Prose Minion VSCode Extension

This document provides guidance for AI agents (like Claude) working with the Prose Minion VSCode extension codebase.

## Project Overview

Prose Minion is a VSCode extension that provides AI-powered prose analysis and writing assistance for creative writers. It uses OpenRouter API to access various LLMs (primarily Claude 3.5 Sonnet) for analyzing dialogue, prose, and providing writing metrics.

## Architecture

The project follows **Clean Architecture** principles with clear separation of concerns:

```
src/
├── application/        # Application layer (orchestration)
│   ├── providers/      # VSCode webview providers
│   └── handlers/       # Message handlers for webview communication
├── domain/            # Domain layer (business logic)
│   ├── models/        # Domain models and entities
│   └── services/      # Service interfaces
├── infrastructure/    # Infrastructure layer (external integrations)
│   └── api/          # OpenRouter API client and implementations
├── presentation/      # Presentation layer (UI)
│   └── webview/      # React components for the webview
└── shared/           # Shared types and utilities
    └── types/        # Message contracts between extension and webview
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
     - `wordFrequency`: Analyzes word usage patterns

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

1. Create a new class in `src/tools/assist/` or `src/tools/measure/`
2. Follow the pattern from existing tools (e.g., `proseAssistant.ts`)
3. Create system prompts in `resources/system-prompts/[tool-name]/`
4. Update the message handler to route to the new tool
5. Add UI components in `src/presentation/webview/components/`

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

### Important Files to Know

- [package.json](package.json) - Extension manifest and configuration
- [extension.ts](src/extension.ts) - Extension activation and setup
- [shared/types/messages.ts](src/shared/types/messages.ts) - Message contracts
- [OpenRouterModels.ts](src/infrastructure/api/OpenRouterModels.ts) - Available AI models
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture documentation

### Resource Files

The `resources/` directory contains:
- **system-prompts/**: AI instructions for each tool
- **craft-guides/**: Writing craft examples and best practices
  - `scene-example-guides/`: Specific scene examples
  - `descriptors-and-placeholders/`: Emotion and expression snippets

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
7. **Maintain Backward Compatibility**: Preserve the legacy `proseMinion.model` fallback and message contracts
8. **Respect Persistence Hooks**: Keep the result cache (`MessageHandler`) and `vscode.setState` synchronization intact; Dictionary inputs persist at App level
9. **Surface Truncation**: Propagate `finish_reason` and append a truncation note when responses hit the token cap
10. **Source-Aware Context**: Include `sourceUri`/`relativePath`; context assistant includes full source content on first turn

## What's New

- Multi-model orchestration per scope with live model switching in the UI
- Default `maxTokens` increased to 10000 and applied uniformly
- Truncation notice appended when AI returns `finish_reason: "length"`
- Context assistant includes the full source document on initial turn (when available)
- Paste-selection carries source metadata; clipboard fallback when no selection
- Dictionary inputs persist across tabs/sessions; auto-fill suppressed after user edits; source displayed when available
- UI consistency: paste buttons sized to match the context-assist button

## Questions and Support

For questions about the codebase:
1. Check [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture info
2. Review existing tool implementations as examples
3. Check the VSCode Extension API documentation for platform-specific features
4. Refer to OpenRouter API documentation for model capabilities

## Related Projects

- **Prose Minion MCP Tool**: The original MCP-based version
- **Claude Desktop**: Can integrate with this extension via MCP protocol (planned)
