# Claude Code Guide for Prose Minion VSCode Extension

This document is specifically for developers using Claude Code (Anthropic's AI coding assistant) to work on the Prose Minion VSCode extension.

## Quick Start for Claude Code

When working on this codebase, Claude Code should be aware of:

### Project Context

This is a **VSCode extension** that helps creative writers analyze and improve their prose using AI. The extension:
- Uses OpenRouter API to access Claude 3.5 Sonnet and other LLMs
- Provides dialogue analysis, prose analysis, and writing metrics
- Has a React-based webview UI with multiple tabs
- Follows Clean Architecture principles
- Persists UI state and cached responses so analysis continues while the view is hidden

### Key Technologies

- **Language**: TypeScript
- **Framework**: VSCode Extension API
- **UI**: React 17 with Tailwind CSS
- **Build Tool**: Webpack 5
- **AI Integration**: OpenRouter API (supports Claude, GPT-4, Gemini)

## Architecture Overview

```
Clean Architecture Layers:
┌─────────────────────────────────────────┐
│ Presentation (React UI)                 │
├─────────────────────────────────────────┤
│ Application (Providers, Handlers)       │
├─────────────────────────────────────────┤
│ Domain (Models, Service Interfaces)     │
├─────────────────────────────────────────┤
│ Infrastructure (OpenRouter API)         │
└─────────────────────────────────────────┘
```

**Key Principle**: Dependencies point inward. Infrastructure implements domain interfaces.

## File Navigation

### Most Important Files

1. **[extension.ts](src/extension.ts)** - Extension entry point, dependency injection
2. **[ProseToolsViewProvider.ts](src/application/providers/ProseToolsViewProvider.ts)** - Webview orchestration (registers with `retainContextWhenHidden`)
3. **[MessageHandler.ts](src/application/handlers/MessageHandler.ts)** - Routes messages between UI and tools, caches latest responses
4. **[OpenRouterClient.ts](src/infrastructure/api/OpenRouterClient.ts)** - API client for LLM calls (instantiated per model scope)
5. **[App.tsx](src/presentation/webview/App.tsx)** - Main React component (persists UI state with `vscode.setState`)

### Tool Implementations

AI-powered analysis tools:
- [dialogueMicrobeatAssistant.ts](src/tools/assist/dialogueMicrobeatAssistant.ts) - Dialogue tag and action beat suggestions
- [proseAssistant.ts](src/tools/assist/proseAssistant.ts) - General prose improvement

Statistical tools:
- [passageProseStats/index.ts](src/tools/measure/passageProseStats/index.ts) - Word count, pacing
- [styleFlags/index.ts](src/tools/measure/styleFlags/index.ts) - Style pattern detection
- [wordFrequency/index.ts](src/tools/measure/wordFrequency/index.ts) - Word usage analysis

### Configuration

- [package.json](package.json):60-182 - Extension settings schema
- User settings: `proseMinion.openRouterApiKey`, `proseMinion.assistantModel`, `proseMinion.dictionaryModel`, `proseMinion.contextModel`, plus the legacy `proseMinion.model` fallback

## Common Development Tasks

### Task 1: Adding a New AI Analysis Tool

**Example**: Add a "Character Voice Analyzer" tool

Steps:
1. Create `src/tools/assist/characterVoiceAnalyzer.ts` following the pattern in `proseAssistant.ts`
2. Create prompts in `resources/system-prompts/character-voice-analyzer/00-character-voice.md`
3. Update [MessageHandler.ts](src/application/handlers/MessageHandler.ts) to route messages
4. Add UI tab in `src/presentation/webview/components/CharacterVoiceTab.tsx`
5. Update [App.tsx](src/presentation/webview/App.tsx) to include new tab

**Pattern to follow**:
```typescript
export class CharacterVoiceAnalyzer {
  constructor(
    private readonly openRouterClient: OpenRouterClient,
    private readonly promptLoader: PromptLoader,
    private readonly guideLoader: GuideLoader
  ) {}

  async analyze(input: CharacterVoiceInput, options?: Options): Promise<string> {
    // 1. Load prompts and guides
    // 2. Build system message
    // 3. Build user message
    // 4. Call OpenRouter API
    // 5. Return response
  }
}
```

### Task 2: Modifying AI Behavior

**Example**: Change how dialogue analysis works

Edit the prompt files:
- [resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md](resources/system-prompts/dialog-microbeat-assistant/00-dialog-microbeat-assistant.md)
- [resources/system-prompts/dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md](resources/system-prompts/dialog-microbeat-assistant/01-dialogue-tags-and-microbeats.md)

The tool automatically loads these prompts at runtime. No code changes needed unless you want to add/remove prompt files.

### Task 3: Adding New Configuration Options

**Example**: Add a "focus area" setting for prose analysis

1. Edit [package.json](package.json):49-103
```json
"proseMinion.focusArea": {
  "type": "string",
  "default": "general",
  "enum": ["general", "dialogue", "description", "action"],
  "description": "Primary focus area for prose analysis"
}
```

2. Access in code (refresh orchestrators if the setting affects runtime behaviour):
```typescript
const config = vscode.workspace.getConfiguration('proseMinion');
const focusArea = config.get<string>('focusArea', 'general');
```

3. Pass through service layer (dependency injection pattern)

### Task 4: Updating the React UI

**Example**: Add a new feature to the Analysis tab

1. Edit [AnalysisTab.tsx](src/presentation/webview/components/AnalysisTab.tsx)
2. Use existing VSCode webview API message passing:
```typescript
vscode.postMessage({
  type: 'analyzeDialogue',
  payload: { text, options }
});
```

3. The message is automatically routed via [MessageHandler.ts](src/application/handlers/MessageHandler.ts)

### Task 5: Testing Changes

```bash
# Watch mode for development
npm run watch

# Then press F5 in VSCode to launch Extension Development Host
# Make changes, reload extension with Cmd+R (Mac) or Ctrl+R (Windows)

# Build for production
npm run build
```

## Important Patterns and Conventions

### Dependency Injection

Services are injected via constructors, never instantiated directly:

```typescript
// ✅ Good - in extension.ts
const proseAnalysisService = new ProseAnalysisService(context.extensionUri);
const provider = new ProseToolsViewProvider(context.extensionUri, proseAnalysisService);

// ❌ Bad - inside a class
const client = new OpenRouterClient();  // Don't do this
```

### Message Passing (Extension ↔ Webview)

Defined in [shared/types/messages.ts](src/shared/types/messages.ts):

```typescript
// Extension → Webview
type MessageToWebview =
  | { type: 'selectionUpdate'; payload: { text: string } }
  | { type: 'analysisResult'; payload: { result: string } };

// Webview → Extension
type MessageFromWebview =
  | { type: 'analyzeDialogue'; payload: { text: string } }
  | { type: 'analyzeProse'; payload: { text: string } };
```

### Error Handling

Always provide fallbacks for missing resources:

```typescript
try {
  return await this.promptLoader.loadPrompts(['tool/prompt.md']);
} catch (error) {
  console.warn('Could not load prompts, using defaults');
  return this.getDefaultInstructions();
}
```

### TypeScript Patterns

- Use `readonly` for constructor parameters
- Define interfaces in domain layer, implement in infrastructure
- Export types alongside implementations
- Use strict TypeScript settings

### Persistence & Replay

- `MessageHandler` caches the latest analysis, dictionary, metrics, status, and error payloads so a recreated webview can instantly display the final state.
- `App.tsx` mirrors key UI state (active tab, recent results, model selections) into `vscode.setState`. When adjusting the UI, include any new state slices in the persisted object.
- The webview is registered with `retainContextWhenHidden` (with a compatibility cast for older VS Code versions). Only remove this if you provide an equivalent persistence mechanism.

## Resource Files

### System Prompts (resources/system-prompts/)

Structure:
```
resources/system-prompts/
├── prose-assistant/
│   └── 00-prose-assistant.md
└── dialog-microbeat-assistant/
    ├── 00-dialog-microbeat-assistant.md
    └── 01-dialogue-tags-and-microbeats.md
```

Numbering convention: `00-`, `01-`, `02-` for load order.

### Craft Guides (resources/craft-guides/)

Optional writing examples provided to AI:
- Scene examples (basketball game, car ride, etc.)
- Emotion descriptors (joy, sadness, recognition, etc.)
- Can be toggled via `proseMinion.includeCraftGuides` setting

## API and External Services

### OpenRouter Integration

- Base URL: `https://openrouter.ai/api/v1`
- API key from user settings: `proseMinion.openRouterApiKey`
- Default model: `anthropic/claude-3.5-sonnet`
- Available models defined in [OpenRouterModels.ts](src/infrastructure/api/OpenRouterModels.ts)

### VSCode Extension API Usage

Key APIs used:
- `vscode.window.registerWebviewViewProvider` - Register custom webview
- `vscode.workspace.getConfiguration` - Access settings
- `vscode.window.activeTextEditor` - Get current editor
- `vscode.commands.registerCommand` - Register commands

## Debugging Tips

### Common Issues

1. **Webview not loading**: Check webpack build output, ensure React bundle is created
2. **API calls failing**: Verify API key in settings, check network tab in webview DevTools
3. **Messages not received**: Check message type matches exactly in [messages.ts](src/shared/types/messages.ts)
4. **Extension not activating**: Check `activationEvents` in [package.json](package.json)

### Debugging Tools

- **Extension Host**: F5 to launch, Cmd/Ctrl+R to reload
- **Webview DevTools**: Cmd/Ctrl+Shift+P → "Developer: Open Webview Developer Tools"
- **Extension Logs**: Check Debug Console in VSCode
- **Console Logs**: Use `console.log()` - appears in Extension Host console

## Code Quality Guidelines

### When Adding New Code

1. **Follow Clean Architecture**: Keep layer boundaries clear
2. **Use Existing Patterns**: Match the style of similar existing code
3. **Maintain Type Safety**: No `any` types without good reason
4. **Add Error Handling**: Try/catch with meaningful fallbacks
5. **Document Public APIs**: Add JSDoc comments for exported functions
6. **Keep Functions Small**: Single responsibility principle

### When Refactoring

1. **Don't Break Public APIs**: Extension commands and settings are public
2. **Test Incrementally**: Run extension after each change
3. **Preserve Existing Behavior**: Unless explicitly changing it
4. **Update Documentation**: Keep README and ARCHITECTURE.md current

## Working with Claude Code Specifically

### Using Context Effectively

When asked to work on this project:
1. **Read** [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design decisions
2. **Check** existing tool implementations as examples
3. **Look** at message types in [shared/types/messages.ts](src/shared/types/messages.ts) for communication contracts
4. **Review** [package.json](package.json) for available configurations

### Suggesting Changes

When proposing changes:
- Reference specific files with line numbers
- Show before/after code snippets
- Explain impact on other parts of the codebase
- Consider backward compatibility

### Understanding User Intent

Common user requests:
- "Add a new analysis tool" → Follow pattern in `src/tools/assist/`
- "Change AI behavior" → Edit prompt files in `resources/system-prompts/`
- "Fix UI issue" → Look in `src/presentation/webview/`
- "Add setting" → Update [package.json](package.json) configuration

## Build and Deployment

### Development Build

```bash
npm run watch  # Continuous build with source maps
```

### Production Build

```bash
npm run build  # Optimized build, minified
npm run package  # Creates .vsix file for distribution
```

### Dependencies

- Don't add new dependencies without justification
- Prefer VSCode built-in APIs over external libraries
- Keep bundle size small (impacts extension load time)

## Related Documentation

- [README.md](README.md) - User-facing documentation
- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture decisions
- [AGENTS.md](AGENTS.md) - General AI agent guidance
- [package.json](package.json) - Extension manifest

## Getting Help

If you need more context:
1. Read the existing tool implementations for patterns
2. Check VSCode Extension API docs: https://code.visualstudio.com/api
3. Review OpenRouter API docs: https://openrouter.ai/docs
4. Look at similar VSCode extensions for examples

---

**Remember**: This is a creative writing tool. Changes should enhance the writing experience while respecting the author's voice and style. The AI should assist, not dictate.
