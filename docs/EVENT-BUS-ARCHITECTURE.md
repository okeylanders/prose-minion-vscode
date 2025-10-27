# Event Bus Architecture

## Overview

Prose Minion uses a **message-passing architecture** to communicate between the React webview (presentation layer) and the VSCode extension (application/domain/infrastructure layers). This follows a clean **event bus pattern** with typed messages, centralized routing, and domain-specific handlers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WEBVIEW LAYER                                │
│                    (React Components + Hooks)                        │
│                                                                       │
│  Components:                                                         │
│  - SearchTab, MetricsTab, AnalysisTab, UtilitiesTab                 │
│  - SettingsOverlay, TabBar, etc.                                    │
│                                                                       │
│  Domain Hooks:                                                       │
│  - useSearch, useMetrics, useAnalysis, useDictionary                │
│  - useContext, useSettings, useSelection, usePublishing             │
│                                                                       │
│  Infrastructure Hooks:                                               │
│  - useVSCodeApi (postMessage sender)                                │
│  - useMessageRouter (message receiver with Strategy pattern)        │
│  - usePersistence (state sync)                                      │
└────────────────────┬────────────────────┬───────────────────────────┘
                     │                    │
                     │ postMessage()      │ window.addEventListener('message')
                     │                    │
                     ▼                    ▲
              ┌──────────────────────────────────┐
              │   VSCode Webview Message Bus     │
              │  (webview.postMessage/onMessage) │
              └──────────────────────────────────┘
                     │                    │
                     ▼                    ▲
┌─────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                               │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ProseToolsViewProvider.ts                                      │ │
│  │                                                                 │ │
│  │  webviewView.webview.onDidReceiveMessage(                      │ │
│  │    message => messageHandler.handleMessage(message)            │ │
│  │  )                                                              │ │
│  │                                                                 │ │
│  │  webview.postMessage(message) // Sends back to webview         │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                           │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ MessageHandler.ts (Central Router)                             │ │
│  │                                                                 │ │
│  │  handleMessage(message: WebviewToExtensionMessage) {           │ │
│  │    switch (message.type) {                                     │ │
│  │      case RUN_WORD_SEARCH:                                     │ │
│  │        → searchHandler.handleMeasureWordSearch()               │ │
│  │      case ANALYZE_DIALOGUE:                                    │ │
│  │        → analysisHandler.handleAnalyzeDialogue()               │ │
│  │      case UPDATE_SETTING:                                      │ │
│  │        → configurationHandler.handleUpdateSetting()            │ │
│  │      // ... 20+ message types                                  │ │
│  │    }                                                            │ │
│  │  }                                                              │ │
│  │                                                                 │ │
│  │  Helper methods for sending responses:                         │ │
│  │  - sendAnalysisResult(), sendMetricsResult()                   │ │
│  │  - sendError(), sendStatus()                                   │ │
│  │  - postMessage() (generic)                                     │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                           │
│                          ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Domain Handlers (10 handlers)                                  │ │
│  │                                                                 │ │
│  │  AnalysisHandler        MetricsHandler      SearchHandler      │ │
│  │  DictionaryHandler      ContextHandler      SettingsHandler    │ │
│  │  ConfigurationHandler   PublishingHandler   SourcesHandler     │ │
│  │  UIHandler              FileOperationsHandler                  │ │
│  │                                                                 │ │
│  │  Each handler:                                                 │ │
│  │  1. Receives typed message from MessageHandler                │ │
│  │  2. Calls domain/infrastructure services                       │ │
│  │  3. Sends results back via callback methods                    │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DOMAIN & INFRASTRUCTURE LAYERS                     │
│                                                                       │
│  Domain Services:                                                    │
│  - IProseAnalysisService (interface)                                │
│                                                                       │
│  Infrastructure:                                                     │
│  - ProseAnalysisService (OpenRouter API client)                     │
│  - SecretStorageService (API key management)                        │
│  - PublishingStandardsRepository (genre data)                       │
│  - PromptLoader, GuideLoader (resource files)                       │
│                                                                       │
│  VSCode APIs:                                                        │
│  - vscode.workspace (file I/O, settings)                            │
│  - vscode.window (selection, editors)                               │
│  - vscode.env.clipboard (copy operations)                           │
└─────────────────────────────────────────────────────────────────────┘
```

## Message Flow: Webview → Extension

### 1. Component Initiates Action

A React component (e.g., `SearchTab`) triggers an action:

```typescript
// SearchTab.tsx
const handleRun = () => {
  vscode.postMessage({
    type: MessageType.RUN_WORD_SEARCH,
    targets: wordSearchTargets,
    source: {
      mode: sourceMode,
      pathText: pathText,
      text: selectedText
    }
  });
};
```

### 2. Message Crosses Webview Boundary

The message is serialized and sent through VSCode's webview message channel.

### 3. ProseToolsViewProvider Receives

[ProseToolsViewProvider.ts:51](../src/application/providers/ProseToolsViewProvider.ts#L51)

```typescript
webviewView.webview.onDidReceiveMessage(
  message => this.messageHandler?.handleMessage(message),
  undefined,
  []
);
```

### 4. MessageHandler Routes to Domain Handler

[MessageHandler.ts:173-211](../src/application/handlers/MessageHandler.ts#L173-L211)

```typescript
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  switch (message.type) {
    case MessageType.RUN_WORD_SEARCH:
      await this.searchHandler.handleMeasureWordSearch(message);
      break;

    case MessageType.ANALYZE_DIALOGUE:
      await this.analysisHandler.handleAnalyzeDialogue(message);
      break;

    // ... 20+ other message types
  }
}
```

### 5. Domain Handler Processes Request

[SearchHandler.ts](../src/application/handlers/domain/SearchHandler.ts)

```typescript
async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
  try {
    // Extract parameters
    const { targets, source } = message;

    // Call service layer
    const result = await this.proseAnalysisService.measureWordSearch(
      source.text,
      source.paths,
      source.mode,
      { targets }
    );

    // Send result back to webview
    this.sendSearchResult({
      type: MessageType.SEARCH_RESULT,
      result,
      toolName: 'word_search',
      timestamp: Date.now()
    });
  } catch (error) {
    this.sendError(`Search failed: ${error.message}`);
  }
}
```

### 6. Service Layer Executes Business Logic

[ProseAnalysisService.ts](../src/infrastructure/api/ProseAnalysisService.ts)

```typescript
async measureWordSearch(
  text: string,
  files?: string[],
  sourceMode?: string,
  options?: { targets?: string }
): Promise<any> {
  // Determine if we're searching selection or files
  const useTextMode = sourceMode === 'selection' && text?.trim().length > 0;

  if (useTextMode) {
    // Search the provided text
    return this.searchInText(text, options.targets);
  } else {
    // Search files from workspace
    return this.searchInFiles(files, options.targets);
  }
}
```

## Message Flow: Extension → Webview

### 1. Domain Handler Sends Response

Domain handlers use callback methods provided by `MessageHandler`:

```typescript
// In SearchHandler
this.sendSearchResult({
  type: MessageType.SEARCH_RESULT,
  result: searchResults,
  toolName: 'word_search',
  timestamp: Date.now()
});
```

### 2. MessageHandler Posts to Webview

[MessageHandler.ts](../src/application/handlers/MessageHandler.ts)

```typescript
private sendSearchResult(result: any, toolName: string): void {
  const message: SearchResultMessage = {
    type: MessageType.SEARCH_RESULT,
    result,
    toolName,
    timestamp: Date.now()
  };

  // Store in cache for visibility changes
  sharedResultCache.search = message;

  // Post to webview
  this.postMessage(message);
}

private postMessage(message: ExtensionToWebviewMessage): void {
  this.webview.postMessage(message).then(
    undefined,
    err => this.outputChannel.appendLine(`Failed to post message: ${err}`)
  );
}
```

### 3. Message Crosses Back to Webview

VSCode serializes and sends the message to the React app.

### 4. useMessageRouter Receives and Routes

[useMessageRouter.ts](../src/presentation/webview/hooks/useMessageRouter.ts)

```typescript
export const useMessageRouter = (handlers: MessageHandlerMap) => {
  React.useEffect(() => {
    const messageHandler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const handler = handlers[event.data.type];
      if (handler) {
        handler(event.data);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [handlers]);
};
```

### 5. Domain Hook Updates State

[useSearch.ts](../src/presentation/webview/hooks/domain/useSearch.ts)

```typescript
const handleSearchResult = React.useCallback((message: SearchResultMessage) => {
  setSearchResult(message.result);
  setSearchLoading(false);
}, []);

// Returned to App.tsx for routing
return {
  searchResult,
  searchLoading,
  handlers: {
    [MessageType.SEARCH_RESULT]: handleSearchResult
  }
};
```

### 6. App.tsx Wires Handlers to Router

[App.tsx](../src/presentation/webview/App.tsx)

```typescript
const search = useSearch();

useMessageRouter({
  [MessageType.SEARCH_RESULT]: search.handlers[MessageType.SEARCH_RESULT],
  // ... other handlers
});
```

### 7. Component Receives Updated State

[SearchTab.tsx](../src/presentation/webview/components/SearchTab.tsx)

```typescript
// Props passed from App.tsx via useSearch hook
const SearchTab: React.FC<SearchTabProps> = ({
  searchResult,
  searchLoading,
  // ...
}) => {
  return (
    <div>
      {searchLoading && <LoadingWidget message="Searching..." />}
      {searchResult && <MarkdownRenderer content={searchResult} />}
    </div>
  );
};
```

## Message Type Contracts

All message types are defined in [src/shared/types/messages/](../src/shared/types/messages/), organized by domain:

### Message Structure

**Webview → Extension** (commands):
```typescript
interface RunWordSearchMessage extends BaseMessage {
  type: MessageType.RUN_WORD_SEARCH;
  targets: string;                    // Words to search for
  source: {
    mode: TextSourceMode;             // 'selection' | 'active_file' | 'manuscripts' | 'chapters'
    pathText?: string;                // File path or glob pattern
    text?: string;                    // Selected text (if mode === 'selection')
    paths?: string[];                 // Resolved file paths
  };
}
```

**Extension → Webview** (responses):
```typescript
interface SearchResultMessage extends BaseMessage {
  type: MessageType.SEARCH_RESULT;
  result: any;                        // Markdown formatted search results
  toolName: 'word_search';
  timestamp: number;
}
```

### Message Organization

Messages are grouped into domain files:

- **[analysis.ts](../src/shared/types/messages/analysis.ts)** - `ANALYZE_DIALOGUE`, `ANALYZE_PROSE`, `ANALYSIS_RESULT`
- **[metrics.ts](../src/shared/types/messages/metrics.ts)** - `MEASURE_PROSE_STATS`, `MEASURE_STYLE_FLAGS`, `MEASURE_WORD_FREQUENCY`, `METRICS_RESULT`
- **[search.ts](../src/shared/types/messages/search.ts)** - `RUN_WORD_SEARCH`, `SEARCH_RESULT`
- **[dictionary.ts](../src/shared/types/messages/dictionary.ts)** - `LOOKUP_DICTIONARY`, `DICTIONARY_RESULT`
- **[context.ts](../src/shared/types/messages/context.ts)** - `GENERATE_CONTEXT`, `CONTEXT_RESULT`
- **[configuration.ts](../src/shared/types/messages/configuration.ts)** - Settings, models, tokens, API keys
- **[publishing.ts](../src/shared/types/messages/publishing.ts)** - Publishing standards
- **[sources.ts](../src/shared/types/messages/sources.ts)** - File/glob operations
- **[ui.ts](../src/shared/types/messages/ui.ts)** - Tab changes, selections, guides
- **[results.ts](../src/shared/types/messages/results.ts)** - `COPY_RESULT`, `SAVE_RESULT`
- **[base.ts](../src/shared/types/messages/base.ts)** - `MessageType` enum, common types

Import from barrel export:
```typescript
import { MessageType, RunWordSearchMessage } from '../../shared/types/messages';
```

## Domain Handler Responsibilities

Each domain handler is responsible for:

### 1. Message Handling
- Receive typed messages from `MessageHandler`
- Validate message parameters
- Extract data from message payload

### 2. Service Orchestration
- Call domain services (e.g., `IProseAnalysisService`)
- Call infrastructure services (e.g., `SecretStorageService`)
- Coordinate multiple service calls if needed

### 3. Response Sending
- Use callback methods to send results back:
  - `this.sendAnalysisResult()`
  - `this.sendMetricsResult()`
  - `this.sendSearchResult()`
  - `this.sendError()`
  - `this.sendStatus()`
  - `this.postMessage()` (generic)

### 4. Error Handling
- Try/catch around service calls
- Send user-friendly error messages to webview
- Log errors to OutputChannel for debugging

### Example Handler Structure

```typescript
export class SearchHandler {
  constructor(
    private readonly proseAnalysisService: IProseAnalysisService,
    private readonly outputChannel: vscode.OutputChannel,
    private readonly sendSearchResult: (result: any, toolName: string) => void,
    private readonly sendError: (message: string) => void
  ) {}

  async handleMeasureWordSearch(message: RunWordSearchMessage): Promise<void> {
    try {
      this.outputChannel.appendLine('[SearchHandler] Processing word search...');

      const result = await this.proseAnalysisService.measureWordSearch(
        message.source.text,
        message.source.paths,
        message.source.mode,
        { targets: message.targets }
      );

      this.sendSearchResult(result, 'word_search');
    } catch (error: any) {
      this.outputChannel.appendLine(`[SearchHandler] Error: ${error.message}`);
      this.sendError(`Search failed: ${error.message}`);
    }
  }
}
```

## Adding New Message Types

To add a new message type and handler:

### 1. Define Message Contract

Add to appropriate domain file in `src/shared/types/messages/`:

```typescript
// src/shared/types/messages/myDomain.ts

export interface MyNewRequestMessage extends BaseMessage {
  type: MessageType.MY_NEW_REQUEST;
  inputText: string;
  options?: {
    flag?: boolean;
  };
}

export interface MyNewResultMessage extends BaseMessage {
  type: MessageType.MY_NEW_RESULT;
  result: string;
  timestamp: number;
}
```

Add to `MessageType` enum in [base.ts](../src/shared/types/messages/base.ts):

```typescript
export enum MessageType {
  // ... existing types
  MY_NEW_REQUEST = 'MY_NEW_REQUEST',
  MY_NEW_RESULT = 'MY_NEW_RESULT',
}
```

Export from barrel [index.ts](../src/shared/types/messages/index.ts):

```typescript
export * from './myDomain';
```

### 2. Add Handler Method to Domain Handler

```typescript
// src/application/handlers/domain/MyDomainHandler.ts

async handleMyNewRequest(message: MyNewRequestMessage): Promise<void> {
  try {
    const result = await this.someService.doSomething(
      message.inputText,
      message.options
    );

    this.sendResult({
      type: MessageType.MY_NEW_RESULT,
      result,
      timestamp: Date.now()
    });
  } catch (error: any) {
    this.sendError(`Operation failed: ${error.message}`);
  }
}
```

### 3. Add Route in MessageHandler

[MessageHandler.ts](../src/application/handlers/MessageHandler.ts):

```typescript
async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
  switch (message.type) {
    // ... existing cases

    case MessageType.MY_NEW_REQUEST:
      await this.myDomainHandler.handleMyNewRequest(message);
      break;
  }
}
```

### 4. Add Webview Hook Handler

```typescript
// src/presentation/webview/hooks/domain/useMyDomain.ts

export const useMyDomain = () => {
  const [result, setResult] = React.useState<string>('');
  const vscode = useVSCodeApi();

  const handleResult = React.useCallback((message: MyNewResultMessage) => {
    setResult(message.result);
  }, []);

  const runRequest = React.useCallback((inputText: string) => {
    vscode.postMessage({
      type: MessageType.MY_NEW_REQUEST,
      inputText
    });
  }, [vscode]);

  return {
    result,
    runRequest,
    handlers: {
      [MessageType.MY_NEW_RESULT]: handleResult
    }
  };
};
```

### 5. Wire in App.tsx

```typescript
const myDomain = useMyDomain();

useMessageRouter({
  // ... existing handlers
  [MessageType.MY_NEW_RESULT]: myDomain.handlers[MessageType.MY_NEW_RESULT],
});

// Pass to component
<MyTab result={myDomain.result} onRun={myDomain.runRequest} />
```

## Best Practices

### Message Design
- **Keep messages flat**: Avoid deep nesting
- **Use discriminated unions**: TypeScript can narrow types based on `message.type`
- **Include timestamps**: Helps with debugging and caching
- **Be explicit**: Don't rely on undefined behavior

### Handler Design
- **Single Responsibility**: Each handler manages one domain
- **Dependency Injection**: Receive services via constructor
- **Error Boundaries**: Always try/catch service calls
- **Logging**: Use OutputChannel for diagnostics

### Webview Hooks
- **Use useCallback**: Prevent unnecessary re-renders
- **Return handler maps**: Makes routing explicit in App.tsx
- **Persist state**: Use `usePersistence` for state that should survive refreshes
- **Clear separation**: UI state vs domain state

### Performance
- **Debounce rapid messages**: Avoid spamming the event bus
- **Cache results**: `MessageHandler` caches results for visibility changes
- **Lazy load**: Don't load all data upfront
- **Use loading states**: Provide feedback during async operations

## State Persistence

The webview state is persisted across VSCode sessions using `vscode.setState()`:

```typescript
// usePersistence.ts
export const usePersistence = <T extends Record<string, any>>(state: T) => {
  const vscode = useVSCodeApi();

  React.useEffect(() => {
    vscode.setState(state);
  }, [vscode, state]);
};

// App.tsx
usePersistence({
  searchResult: search.searchResult,
  metricsResultsByTool: metrics.metricsResultsByTool,
  analysisResult: analysis.result,
  // ... all state to persist
});
```

On webview reload, state is hydrated:

```typescript
const persistedState = usePersistedState<AppState>();

// Initialize hooks with persisted values
const search = useSearch(persistedState?.searchResult);
```

## Debugging Messages

### Extension Side (Output Channel)

View in VSCode: **Output** panel → **Prose Minion** dropdown

Domain handlers log to OutputChannel:
```typescript
this.outputChannel.appendLine('[SearchHandler] Processing search...');
this.outputChannel.appendLine(`[SearchHandler] Mode: ${mode}, Targets: ${targets}`);
```

### Webview Side (Browser Console)

Open: **Help** → **Toggle Developer Tools**

Add debug logging:
```typescript
useMessageRouter({
  [MessageType.SEARCH_RESULT]: (message) => {
    console.log('[useMessageRouter] SEARCH_RESULT received:', message);
    search.handlers[MessageType.SEARCH_RESULT](message);
  }
});
```

### Message Flow Tracing

To trace a complete message flow:

1. **Webview sends**: Add console.log in component
2. **Extension receives**: Check OutputChannel for handler log
3. **Service executes**: Add logging in service method
4. **Extension sends back**: Check MessageHandler.postMessage log
5. **Webview receives**: Add console.log in hook handler
6. **Component updates**: Add useEffect with logging

## Error Handling

### Extension → Webview Errors

```typescript
// Domain handler catches and sends error message
try {
  const result = await this.service.doSomething();
  this.sendResult(result);
} catch (error: any) {
  this.sendError(`Operation failed: ${error.message}`);
}

// MessageHandler sends ERROR message
private sendError(message: string): void {
  const errorMessage: ErrorMessage = {
    type: MessageType.ERROR,
    message,
    timestamp: Date.now()
  };
  this.postMessage(errorMessage);
}
```

### Webview Error Display

```typescript
// useSettings.ts (or other domain hook)
const handleError = React.useCallback((message: ErrorMessage) => {
  setError(message.message);
  setTimeout(() => setError(''), 5000); // Clear after 5s
}, []);

return {
  error,
  handlers: {
    [MessageType.ERROR]: handleError
  }
};

// Component displays error
{error && <div className="error-banner">{error}</div>}
```

### Webview Init Errors

Special `WEBVIEW_ERROR` message for initialization failures:

```typescript
// index.tsx
try {
  const root = createRoot(container);
  root.render(<App />);
} catch (error: any) {
  vscode.postMessage({
    type: MessageType.WEBVIEW_ERROR,
    message: 'Webview initialization failed',
    details: error.message
  });
}

// MessageHandler logs to OutputChannel
case MessageType.WEBVIEW_ERROR: {
  const m = message as any;
  this.outputChannel.appendLine(
    `[Webview Error] ${m.message}${m.details ? ` - ${m.details}` : ''}`
  );
  break;
}
```

## Related Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall architecture
- [ADR: Message Architecture Organization](adr/2025-10-26-message-architecture-organization.md) - Message organization decision
- [ADR: Presentation Layer Domain Hooks](adr/2025-10-27-presentation-layer-domain-hooks.md) - Hook refactor decision
- [VSCode Webview API](https://code.visualstudio.com/api/extension-guides/webview) - Official VSCode docs
