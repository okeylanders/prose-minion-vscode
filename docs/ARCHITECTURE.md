# Architecture Documentation

## Overview

This VS Code extension follows **Clean Architecture** principles with clear separation of concerns across multiple layers.

Recent updates introduce multi-model orchestration, unified token budgeting, explicit truncation notices, and richer context priming using the full source document.

## Layer Structure

```
src/
├── application/          # Application Layer
│   ├── providers/        # VS Code providers (WebviewViewProvider)
│   └── handlers/         # Message handlers
├── domain/              # Domain Layer (Business Logic)
│   ├── models/          # Domain models
│   └── services/        # Service interfaces (contracts)
├── infrastructure/      # Infrastructure Layer
│   └── api/            # External API implementations
├── presentation/        # Presentation Layer
│   └── webview/        # React UI components
│       ├── components/  # React components
│       ├── App.tsx     # Main app component
│       ├── index.tsx   # Entry point
│       └── index.css   # Styles
└── shared/             # Shared Layer
    └── types/          # Shared type definitions
```

## Dependency Flow

Following Clean Architecture, dependencies flow **inward**:

```
Presentation → Application → Domain ← Infrastructure
                    ↓
                  Shared
```

- **Presentation Layer** depends on Shared types
- **Application Layer** depends on Domain and Shared
- **Domain Layer** is independent (defines interfaces)
- **Infrastructure Layer** implements Domain interfaces
- **Shared Layer** has no dependencies

## Key Components

### Extension Entry Point
- **File**: [src/extension.ts](src/extension.ts)
- **Purpose**: Activates extension, registers providers and commands
- **Pattern**: Dependency Injection

### WebviewViewProvider
- **File**: [src/application/providers/ProseToolsViewProvider.ts](src/application/providers/ProseToolsViewProvider.ts)
- **Purpose**: Manages webview lifecycle and HTML generation
- **Pattern**: Provider Pattern

### Message Handler
- **File**: [src/application/handlers/MessageHandler.ts](src/application/handlers/MessageHandler.ts)
- **Purpose**: Routes messages between webview and services, caches the latest results/status for replay when the webview is recreated
- **Pattern**: Command Pattern + Mediator

### Domain Service Interface
- **File**: [src/domain/services/IProseAnalysisService.ts](src/domain/services/IProseAnalysisService.ts)
- **Purpose**: Defines contract for prose analysis operations
- **Pattern**: Interface Segregation

### Infrastructure Service
- **File**: [src/infrastructure/api/ProseAnalysisService.ts](src/infrastructure/api/ProseAnalysisService.ts)
- **Purpose**: Implements IProseAnalysisService, spins up dedicated OpenRouter clients per feature scope (assistant, dictionary, context). A unified `maxTokens` (default 10000) is applied across all tools. The context assistant now reads and includes the full source document on the initial turn when `sourceFileUri` is provided. Aggregates per-file stats for multi-file sources (chapters/manuscripts) and enriches metrics with publishing standards via StandardsComparisonService.
- **Pattern**: Dependency Inversion

### AI Orchestrator
- **File**: [src/application/services/AIResourceOrchestrator.ts](src/application/services/AIResourceOrchestrator.ts)
- **Purpose**: Wraps conversation management, guide loading, and OpenRouter calls for each model scope. Detects `finish_reason: length` from the API and appends a truncation notice to results.
- **Pattern**: Facade + Strategy

### React Components
- **TabBar**: [src/presentation/webview/components/TabBar.tsx](src/presentation/webview/components/TabBar.tsx)
- **AnalysisTab**: [src/presentation/webview/components/AnalysisTab.tsx](src/presentation/webview/components/AnalysisTab.tsx)
- **MetricsTab**: [src/presentation/webview/components/MetricsTab.tsx](src/presentation/webview/components/MetricsTab.tsx)
- **SuggestionsTab**: [src/presentation/webview/components/SuggestionsTab.tsx](src/presentation/webview/components/SuggestionsTab.tsx)

### Standards Comparison Service
- **File**: [src/application/services/StandardsComparisonService.ts](src/application/services/StandardsComparisonService.ts)
- **Purpose**: Map measured metrics to publishing standard ranges, compute status (below/within/above), and derive Publishing Format estimates (words/page, estimated pages) using genre + trim size.
- **Pattern**: Pure service (deterministic mapping)

### Publishing Standards Repository
- **File**: [src/infrastructure/standards/PublishingStandardsRepository.ts](src/infrastructure/standards/PublishingStandardsRepository.ts)
- **Purpose**: Load and query `resources/repository/publishing_standards.json` (genres + manuscript format). Resolve genre keys (slug/abbr/name) and trim size keys (format or WxH).
- **Pattern**: Repository

## Message Flow

### From Webview to Extension

1. User clicks button in React component
2. Component calls `vscode.postMessage()` with typed message
3. WebviewViewProvider receives message
4. MessageHandler routes to appropriate domain service
5. Service processes request using the appropriate orchestrator/model scope (scoped OpenRouter client)
6. Handler sends result back to webview and stores a copy in the result cache for replay

### From Extension to Webview

1. MessageHandler receives result from service
2. Handler creates typed response message
3. Handler calls `webview.postMessage()`
4. React App component receives message via event listener
5. App updates state, persists it via `vscode.getState/setState`, and re-renders with new data

### Selection and Context Details

- Selection messages include `sourceUri` and `relativePath` when text is selected in the editor; when no selection exists, the handler falls back to the clipboard (no source metadata).
- The context assistant two-turn flow now includes the full source document content in the first turn (when available) in addition to the excerpt and resource catalog.

## State & Session Management

- **Result Cache**: `MessageHandler` keeps the latest analysis/dictionary/metrics/status/error messages in memory so that a newly created webview can immediately replay the final state.
- **UI Persistence**: The React app mirrors all important state (active tab, last responses, model selections) to VS Code's webview storage, preserving context across focus changes and reloads. Dictionary inputs (word/context/edited flag) are lifted to App state to avoid unintended auto-fill and preserve user input across tab switches.
- **Background Execution**: `AIResourceOrchestrator` continues running OpenRouter calls even if the webview is hidden. Once a response arrives it is cached and logged, ready for replay when the user returns.
- **Context Retention**: The webview is registered with `retainContextWhenHidden` (with a polyfill cast for older API signatures) to minimize disposals during normal sidebar switching.

## Type Safety

All messages between extension and webview are **strongly typed** using shared interfaces:

- [src/shared/types/messages.ts](src/shared/types/messages.ts)

## Build System

### Dual Webpack Configuration

The project uses **two webpack configurations** in [webpack.config.js](webpack.config.js):

1. **Extension Config** (Node.js runtime)
   - Target: `node`
   - Entry: `src/extension.ts`
   - Output: `dist/extension.js`

2. **Webview Config** (Browser runtime)
   - Target: `web`
   - Entry: `src/presentation/webview/index.tsx`
   - Output: `dist/webview.js`

## Design Principles Applied

### SOLID Principles

1. **Single Responsibility**: Each class/module has one reason to change
2. **Open/Closed**: Extensible without modification (add new tools by implementing interfaces)
3. **Liskov Substitution**: IProseAnalysisService can be swapped with any implementation
4. **Interface Segregation**: Small, focused interfaces
5. **Dependency Inversion**: High-level modules depend on abstractions

### Clean Code Practices

- Meaningful names
- Small functions
- No code duplication
- Clear comments explaining "why" not "what"
- Consistent formatting

## Future Integration

### Prose Minion MCP Tools

The infrastructure layer is designed to integrate with the prose-minion MCP tool:

**Current**: Placeholder implementations in [ProseAnalysisService.ts](src/infrastructure/api/ProseAnalysisService.ts)

**Future**:
- Integrate with OpenRouter API
- Use MCP protocol for tool communication
- Subprocess execution of prose-minion tools

### Extension Points

To add a new tool:

1. Add message types to [src/shared/types/messages.ts](src/shared/types/messages.ts)
2. Add method to [IProseAnalysisService](src/domain/services/IProseAnalysisService.ts)
3. Implement in [ProseAnalysisService](src/infrastructure/api/ProseAnalysisService.ts)
4. Add handler case in [MessageHandler](src/application/handlers/MessageHandler.ts)
5. Add UI in appropriate React component

## Development Workflow

```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run watch

# Build for production
npm run build

# Debug in VS Code
# Press F5 to launch Extension Development Host
```

## Testing the Extension

1. Open this project in VS Code
2. Press F5 to launch Extension Development Host
3. Look for "Prose Minion" icon in the Activity Bar
4. Open any text file and select text
5. Right-click and choose "Analyze with Prose Minion"
6. The webview will open with your selected text

## Key Files Reference

| File | Purpose |
|------|---------|
| [package.json](package.json) | Extension manifest and dependencies |
| [tsconfig.json](tsconfig.json) | TypeScript config for extension |
| [tsconfig.webview.json](tsconfig.webview.json) | TypeScript config for webview |
| [webpack.config.js](webpack.config.js) | Build configuration |
| [tailwind.config.js](tailwind.config.js) | Tailwind CSS configuration |
| [.vscodeignore](.vscodeignore) | Files excluded from package |

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
