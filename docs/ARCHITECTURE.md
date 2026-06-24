<p align="center">
  <img src="../assets/prose-minion-book.png" alt="Prose Minion" width="120"/>
</p>

<p align="center">
  <strong>Prose Minion Architecture Documentation</strong><br/>
  System design and architectural principles
</p>

---

# Architecture Documentation

## Overview

This VS Code extension follows **Clean Architecture** principles with clear separation of concerns across multiple layers.

Recent updates introduce multi-model orchestration, unified token budgeting, explicit truncation notices, and richer context priming using the full source document.

## Layer Structure

```
src/
├── application/          # Application Layer
│   ├── providers/        # VS Code providers (WebviewViewProvider)
│   └── handlers/         # Message routing and domain handlers
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
├── domain/              # Domain Layer (Business Logic)
│   ├── models/          # Domain models
│   └── services/        # Service interfaces (contracts)
├── infrastructure/      # Infrastructure Layer
│   └── api/            # External API implementations
├── presentation/        # Presentation Layer
│   └── webview/        # React UI components
│       ├── hooks/       # Custom React hooks
│       │   ├── useVSCodeApi.ts       # VSCode API singleton
│       │   ├── usePersistence.ts     # State persistence composition
│       │   ├── useMessageRouter.ts   # Strategy-based message routing
│       │   └── domain/               # Domain-specific hooks
│       │       ├── useModelsSettings.ts        # Model selections + agent behavior (8 settings)
│       │       ├── useWordSearchSettings.ts    # Word search configuration (6 settings)
│       │       ├── useWordFrequencySettings.ts # Word frequency options (11 settings)
│       │       ├── useContextPathsSettings.ts  # Context resource paths (8 settings)
│       │       ├── useTokensSettings.ts        # Token widget UI preference (1 setting)
│       │       ├── usePublishingSettings.ts    # Publishing standards (2 settings)
│       │       ├── useTokenTracking.ts         # Token usage tracking (ephemeral state)
│       │       ├── useAnalysis.ts              # Analysis results and guides
│       │       ├── useMetrics.ts               # Metrics results and scope
│       │       ├── useDictionary.ts            # Dictionary state
│       │       ├── useContext.ts               # Context generation state
│       │       ├── useSearch.ts                # Search results and targets
│       │       └── useSelection.ts             # Selected text and metadata
│       ├── components/  # React components
│       ├── App.tsx     # Main app component (thin orchestrator)
│       ├── index.tsx   # Entry point
│       └── index.css   # Styles
└── shared/             # Shared Layer
    └── types/          # Shared type definitions
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

### Message Handler (Domain-Organized Architecture)
- **Main Dispatcher**: [src/application/handlers/MessageHandler.ts](src/application/handlers/MessageHandler.ts)
  - **Purpose**: Routes messages to domain handlers, manages result cache for webview replay
  - **Pattern**: Mediator + Delegation (495 lines, down from 1091)
  - **Responsibilities**: Message routing, result caching, helper methods for sending responses

- **Domain Handlers**: [src/application/handlers/domain/](src/application/handlers/domain/)
  - **AnalysisHandler**: Dialogue and prose analysis operations
  - **DictionaryHandler**: Dictionary lookup operations
  - **ContextHandler**: Context generation with project resources
  - **MetricsHandler**: Prose stats, style flags, word frequency analysis
  - **SearchHandler**: Word search across files
  - **ConfigurationHandler**: Settings, model selection, token tracking
  - **PublishingHandler**: Publishing standards and genre presets
  - **SourcesHandler**: File and glob request operations
  - **UIHandler**: UI interactions (selections, guide files)
  - **FileOperationsHandler**: Copy and save result operations

Each handler encapsulates domain-specific logic with clear dependencies injected via constructor. This organization improves maintainability, testability, and makes it easy to locate and modify feature-specific behavior.

### Infrastructure Services Layer

The infrastructure layer consists of **11 focused services** organized by capability domain. Each service has a single responsibility and is injected directly into handlers.

#### Service Organization

```
src/infrastructure/api/services/
├── analysis/                  # AI-powered analysis services
│   ├── AssistantToolService.ts      # Dialogue & prose analysis (208 lines)
│   └── ContextAssistantService.ts   # Context generation (202 lines)
├── dictionary/
│   └── DictionaryService.ts         # Dictionary lookups (139 lines)
├── measurement/               # Statistical measurement services
│   ├── ProseStatsService.ts         # Prose statistics (47 lines)
│   ├── StyleFlagsService.ts         # Style pattern detection (46 lines)
│   └── WordFrequencyService.ts      # Word frequency analysis (57 lines)
├── search/
│   └── WordSearchService.ts         # Word search & clustering (466 lines)
├── resources/                 # Resource management services
│   ├── AIResourceManager.ts         # OpenRouter client lifecycle (247 lines)
│   ├── StandardsService.ts          # Publishing standards enrichment (213 lines)
│   ├── ResourceLoaderService.ts     # Prompt/guide loading (84 lines)
│   └── ToolOptionsProvider.ts       # Tool options configuration (103 lines)
└── shared/
    └── (shared utilities)
```

#### Service Descriptions

**Analysis Services** (`analysis/`):
- **AssistantToolService**: Wraps DialogueMicrobeatAssistant and ProseAssistant for AI-powered analysis
  - Dialogue analysis with focus modes (dialogue/microbeats/both)
  - Prose analysis with craft guide integration
  - Uses assistant-scoped OpenRouter client
- **ContextAssistantService**: Context generation with project resource integration
  - Two-turn conversation workflow
  - Resource provider integration
  - Uses context-scoped OpenRouter client

**Dictionary Service** (`dictionary/`):
- **DictionaryService**: AI-powered dictionary lookups with context awareness
  - Word definitions, synonyms, usage
  - Context-aware explanations
  - Uses dictionary-scoped OpenRouter client

**Measurement Services** (`measurement/`):
- **ProseStatsService**: Statistical analysis wrapper for PassageProseStats tool
  - Word count, sentence count, pacing metrics
  - Simple delegation pattern
- **StyleFlagsService**: Style pattern detection wrapper
  - Identifies style patterns and issues
  - Simple delegation pattern
- **WordFrequencyService**: Word usage analysis wrapper
  - Top 100 words, stopwords, hapax legomena
  - POS tagging, bigrams/trigrams, lemmatization
  - Configurable via settings

**Search Service** (`search/`):
- **WordSearchService**: Word search with cluster detection
  - Multi-file search support
  - Context window extraction
  - Cluster detection algorithm

**Resource Services** (`resources/`):
- **AIResourceManager**: Manages OpenRouter client lifecycle per model scope
  - Creates scoped clients (assistant, dictionary, context)
  - Handles model configuration changes
  - Propagates status callbacks
- **StandardsService**: Publishing standards enrichment and comparison
  - Enriches metrics with publishing standards
  - Computes per-file stats for multi-file sources
  - Supports genre and trim size selection
- **ResourceLoaderService**: Centralized resource loading
  - Prompts, guides, publishing standards
  - Singleton instances for shared resources
- **ToolOptionsProvider**: Tool options configuration
  - Provides options for analysis tools
  - Handles temperature, max tokens, etc.

#### Architectural Pattern

**Before (God Component)**:
```
extension.ts → ProseAnalysisService (868 lines, all responsibilities)
                    ↓
               Domain Handlers
```

**After (Focused Services)**:
```
extension.ts → 11 Focused Services (< 500 lines each)
                    ↓
            Domain Handlers (inject what they need)
```

**Benefits**:
- ✅ Single Responsibility Principle: Each service has one clear purpose
- ✅ Dependency Inversion: Handlers depend on services, not a facade
- ✅ Open/Closed: Easy to add new services without modifying existing ones
- ✅ Interface Segregation: Handlers only inject what they need
- ✅ No god components: Largest service is 466 lines (WordSearchService)

**References**:
- [ADR-2025-11-11: ProseAnalysisService Domain Services Refactor](../adr/2025-11-11-prose-analysis-service-refactor.md)
- [Epic: ProseAnalysisService Refactor](./../.todo/epics/epic-prose-analysis-service-refactor-2025-11-11/)
- [Memory Bank: Sprint 05 Complete](./../.memory-bank/20251114-1233-sprint-05-facade-deleted-complete.md)

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

## Presentation Hooks Architecture

The presentation layer uses custom React hooks organized by domain, mirroring the backend handler layout. `App.tsx` is a thin orchestrator that composes domain hooks, wires message routing, and composes persistence.

Directory structure:

```
src/presentation/webview/
├── hooks/
│   ├── useVSCodeApi.ts         # Singleton wrapper for acquireVsCodeApi()
│   ├── usePersistence.ts       # Compose domain persisted state into vscode.setState
│   ├── useMessageRouter.ts     # Strategy: MessageType → handler, stable listener
│   └── domain/
│       ├── useAnalysis.ts      # Analysis results, guides, status ticker
│       ├── useMetrics.ts       # Per-subtool cache (prose_stats/style_flags/word_frequency), source mode/path
│       ├── useDictionary.ts    # Word/context and tool state
│       ├── useContext.ts       # Context text, requested resources, loading/status
│       ├── useSearch.ts        # Search results and targets
│       ├── useSettings.ts      # Overlay visibility, settings data, model selections, tokens, API key
│       ├── useSelection.ts     # Selected text and source metadata + dictionary injection
│       └── usePublishing.ts    # Preset and trim selection (genres)
```

Core patterns:
- Strategy routing: `useMessageRouter({ [MessageType.X]: handler })` with a ref to avoid re-registering listeners.
- Declarative persistence: `usePersistence({ ...domain.persistedState })` composed across domains.
- Domain boundaries: Each hook returns state, actions, and `persistedState`; components receive hook spreads.

Implementation notes:
- Settings uses `UPDATE_SETTING` for UI prefs (e.g., `ui.showTokenWidget`) and `SET_MODEL_SELECTION` for model choices; model options come via `MODEL_DATA`.
- Status messaging uses `MessageType.STATUS`.
- Metrics exposes `setPathText` and `clearSubtoolResult` to support explicit reruns without clearing unrelated subtool results.

References:
- ADR: docs/adr/2025-10-27-presentation-layer-domain-hooks.md
- Epic: .todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md

## Settings Management Architecture

The extension uses a **unified Domain Hooks pattern** for all settings management, providing 100% persistence coverage, bidirectional sync, and type-safe configuration. This architecture was established in Sprint 04 (November 2025) to eliminate the god hook anti-pattern and achieve Clean Architecture principles.

### Specialized Settings Hooks

All settings are managed through 6 specialized domain hooks, each owning a specific configuration domain:

| Hook | Settings Count | Purpose | Used By |
|------|---------------|---------|---------|
| **useModelsSettings** | 8 | Model selections + agent behavior | All tabs (model config), SettingsOverlay |
| **useWordSearchSettings** | 6 | Word search configuration | SearchTab, SettingsOverlay |
| **useWordFrequencySettings** | 11 | Word frequency display options | MetricsTab (word frequency), SettingsOverlay |
| **useContextPathsSettings** | 8 | Context resource glob patterns | Context agent ([bot] button), SettingsOverlay |
| **useTokensSettings** | 1 | Token widget UI preference | TokenWidget, SettingsOverlay |
| **usePublishingSettings** | 2 | Publishing standards (genre + trim) | MetricsTab (prose stats), SettingsOverlay |

**Additional State Hook**:
- **useTokenTracking**: Ephemeral token usage tracking (not configuration settings)

**Total Configuration Settings**: 36 settings with 100% persistence coverage

### Tripartite Hook Interface Pattern

Each settings hook follows a consistent three-part interface:

```typescript
// Example: useWordSearchSettings
export interface WordSearchSettingsState {
  // Read-only state (what the UI displays)
  settings: {
    defaultTargets: string;
    contextWords: number;
    clusterWindow: number;
    minClusterSize: number;
    caseSensitive: boolean;
    enableAssistantExpansion: boolean;
  };
}

export interface WordSearchSettingsActions {
  // Write operations (what the UI can trigger)
  updateSetting: (key: string, value: any) => void;
}

export interface WordSearchSettingsPersistence {
  // What gets saved to vscode.setState
  persistedState: {
    wordSearch: {
      defaultTargets: string;
      contextWords: number;
      // ... all settings
    };
  };
}

export type UseWordSearchSettingsReturn =
  WordSearchSettingsState &
  WordSearchSettingsActions &
  WordSearchSettingsPersistence;
```

**Benefits**:
- ✅ Clear separation of concerns (state vs actions vs persistence)
- ✅ Type-safe contracts for hook consumers
- ✅ Explicit persistence declarations
- ✅ Consistent pattern across all hooks

### Bidirectional Sync Flow

Settings sync bidirectionally between three sources:

```
┌─────────────────────┐
│  VSCode Settings    │ (Native settings panel)
│  Panel              │
└──────────┬──────────┘
           │
           ↓ Configuration change event
┌─────────────────────┐
│  ConfigurationHandler│ (Backend)
│  + Echo Prevention  │
└──────────┬──────────┘
           │
           ↓ SETTINGS_DATA message
┌─────────────────────┐
│  Domain Hook        │ (Frontend: useWordSearchSettings, etc.)
│  (useState)         │
└──────────┬──────────┘
           │
           ↓ Props
┌─────────────────────┐     ┌─────────────────────┐
│  SettingsOverlay    │ ←→  │  Feature Component  │
│  (Gear icon)        │     │  (SearchTab, etc.)  │
└──────────┬──────────┘     └─────────────────────┘
           │
           ↓ updateSetting()
┌─────────────────────┐
│  UPDATE_SETTING     │ (Message to backend)
│  message            │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  VSCode Config API  │ (Persists to workspace/user settings)
└─────────────────────┘
```

**Flow Steps**:

1. **User changes setting** (in SettingsOverlay or native panel)
2. **Hook sends `UPDATE_SETTING`** message to backend
3. **Backend updates VSCode config** via Configuration API
4. **Config watcher detects change** and checks echo prevention
5. **Backend broadcasts `SETTINGS_DATA`** to webview (if not an echo)
6. **Hook receives message**, updates state
7. **React re-renders** component with new state
8. **`usePersistence` saves** state to webview storage

### Persistence Composition

All domain hooks expose `persistedState` which is composed in `App.tsx`:

```typescript
// App.tsx - Persistence composition
const modelsSettings = useModelsSettings(vscode);
const wordSearchSettings = useWordSearchSettings(vscode);
const wordFrequencySettings = useWordFrequencySettings(vscode);
const contextPathsSettings = useContextPathsSettings(vscode);
const tokensSettings = useTokensSettings(vscode);
const publishingSettings = usePublishingSettings(vscode);
const tokenTracking = useTokenTracking(vscode);

// Compose all persistence into single state object
usePersistence({
  activeTab,
  ...modelsSettings.persistedState,        // Model configuration (8 settings)
  ...wordSearchSettings.persistedState,    // Word search (6 settings)
  ...wordFrequencySettings.persistedState, // Word frequency (11 settings)
  ...contextPathsSettings.persistedState,  // Context paths (8 settings)
  ...tokensSettings.persistedState,        // Token widget UI (1 setting)
  ...publishingSettings.persistedState,    // Publishing standards (2 settings)
  ...tokenTracking.persistedState,         // Token usage (ephemeral state)
  ...analysis.persistedState,              // Analysis results
  ...metrics.persistedState,               // Metrics results
  ...dictionary.persistedState,            // Dictionary state
  ...context.persistedState,               // Context state
  ...search.persistedState,                // Search state
  ...selection.persistedState              // Selection state
});
```

**Benefits**:
- ✅ Declarative: Each hook owns its persistence contract
- ✅ Automatic: Syncs on every state change via `vscode.setState`
- ✅ Type-safe: TypeScript validates shape
- ✅ Centralized: One place to manage all persistence

### Echo Prevention System

To prevent infinite loops during bidirectional sync, the backend uses an echo prevention system in `ConfigurationHandler`:

```typescript
// ConfigurationHandler.ts
private webviewOriginatedUpdates = new Set<string>();

public shouldBroadcastConfigChange(key: string): boolean {
  // Check if this change originated from webview
  if (this.webviewOriginatedUpdates.has(key)) {
    this.webviewOriginatedUpdates.delete(key);
    return false; // Don't broadcast back to webview
  }
  return true; // Broadcast (external change)
}

public async updateSetting(key: string, value: any, fromWebview: boolean) {
  if (fromWebview) {
    // Track this update to prevent echo
    this.webviewOriginatedUpdates.add(`proseMinion.${key}`);
    setTimeout(() => this.webviewOriginatedUpdates.delete(`proseMinion.${key}`), 100);
  }
  await this.config.update(key, value, vscode.ConfigurationTarget.Global);
}
```

**How it works**:
1. Webview sends `UPDATE_SETTING` with setting key
2. Backend adds key to `webviewOriginatedUpdates` Set
3. Backend updates VSCode config
4. Config change event fires
5. Backend checks `shouldBroadcastConfigChange()` → returns `false` (echo)
6. No broadcast sent back to webview (loop prevented)
7. After 100ms timeout, key removed from Set

### Message Routing Strategy

Settings hooks register handlers with `useMessageRouter` using the Strategy pattern:

```typescript
// App.tsx - Message routing
useMessageRouter({
  [MessageType.SETTINGS_DATA]: (msg) => {
    // All settings hooks handle SETTINGS_DATA
    modelsSettings.handleSettingsMessage(msg);
    wordSearchSettings.handleSettingsMessage(msg);
    wordFrequencySettings.handleSettingsMessage(msg);
    contextPathsSettings.handleSettingsMessage(msg);
    tokensSettings.handleSettingsMessage(msg);
    publishingSettings.handleSettingsMessage(msg);
  },
  [MessageType.MODEL_DATA]: modelsSettings.handleModelData,
  [MessageType.PUBLISHING_STANDARDS_DATA]: publishingSettings.handleStandardsData,
  // ... other message types
});
```

**Pattern Benefits**:
- ✅ No switch statements
- ✅ Declarative handler registration
- ✅ Easy to add new message types
- ✅ Stable event listener (ref-based)

### Adding a New Setting

Follow this checklist to add a new setting:

#### 1. Add to package.json (Backend)

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "proseMinion.wordSearch.newSetting": {
          "type": "boolean",
          "default": true,
          "description": "Description of new setting"
        }
      }
    }
  }
}
```

#### 2. Add to ConfigurationHandler (Backend)

```typescript
// src/application/handlers/domain/ConfigurationHandler.ts
public getWordSearchSettings() {
  return {
    defaultTargets: this.config.get('wordSearch.defaultTargets', 'just'),
    contextWords: this.config.get('wordSearch.contextWords', 7),
    // ... existing settings
    newSetting: this.config.get('wordSearch.newSetting', true) // Add here
  };
}
```

#### 3. Update Settings Keys Constant (Backend)

```typescript
// src/application/handlers/MessageHandler.ts
private readonly WORD_SEARCH_KEYS = [
  'proseMinion.wordSearch.defaultTargets',
  'proseMinion.wordSearch.contextWords',
  // ... existing keys
  'proseMinion.wordSearch.newSetting' // Add here
] as const;
```

#### 4. Add to Domain Hook Interface (Frontend)

```typescript
// src/presentation/webview/hooks/domain/useWordSearchSettings.ts
export interface WordSearchSettings {
  defaultTargets: string;
  contextWords: number;
  // ... existing settings
  newSetting: boolean; // Add here
}
```

#### 5. Update Hook Defaults (Frontend)

```typescript
// useWordSearchSettings.ts
const [settings, setSettings] = React.useState<WordSearchSettings>({
  defaultTargets: 'just',
  contextWords: 7,
  // ... existing defaults
  newSetting: true // Add here
});
```

#### 6. Update Message Handler (Frontend)

```typescript
// useWordSearchSettings.ts - handleSettingsMessage
const wordSearchSettings = {
  defaultTargets: payload.wordSearch?.defaultTargets ?? 'just',
  contextWords: payload.wordSearch?.contextWords ?? 7,
  // ... existing settings
  newSetting: payload.wordSearch?.newSetting ?? true // Add here
};
```

#### 7. Add to SettingsOverlay UI (Frontend)

```typescript
// src/presentation/webview/components/SettingsOverlay.tsx
<label>
  <input
    type="checkbox"
    checked={wordSearchSettings.settings.newSetting}
    onChange={(e) => wordSearchSettings.updateSetting('newSetting', e.target.checked)}
  />
  New Setting Description
</label>
```

#### 8. Test Bidirectional Sync

- [ ] Change in SettingsOverlay → verify feature component updates
- [ ] Change in VSCode settings panel → verify SettingsOverlay updates
- [ ] Reload webview → verify setting persists
- [ ] Check Output Channel for echo prevention (no duplicate broadcasts)

**Estimated Time**: 15 minutes (following this checklist)

### Naming Conventions

**Hook Naming**:
- **Settings hooks**: `use[Domain]Settings` (e.g., `useWordSearchSettings`)
  - Manage VSCode configuration settings
  - Persist to workspace/user settings
  - Bidirectional sync with native settings panel

- **State hooks**: `use[Domain]` (e.g., `useTokenTracking`, `useAnalysis`)
  - Manage UI/result state (ephemeral or persisted to webview state)
  - No connection to VSCode configuration
  - Persist only to webview storage

**Persistence Key Naming**:
- Settings hooks: `persistedState: { [domain]: settings }` (e.g., `{ wordSearch: settings }`)
- State hooks: `persistedState: { [stateKey]: value }` (e.g., `{ tokenUsage: state }`)

### Common Pitfalls

**❌ Don't**:
- Create settings in `useSettings` (eliminated god hook)
- Skip echo prevention (causes infinite loops)
- Forget to add to `package.json` (setting won't appear in native panel)
- Use hardcoded defaults (always match `package.json` defaults)
- Mix concerns (keep settings in settings hooks, state in state hooks)

**✅ Do**:
- Follow the checklist above (mechanical process)
- Use existing hooks as templates (`useWordSearchSettings` is a clean example)
- Test bidirectional sync thoroughly
- Update all 3 locations: package.json, backend handler, frontend hook
- Match naming conventions ("Settings" suffix for config hooks)

### References

**Architecture Decision Records**:
- [ADR-2025-11-03: Unified Settings Architecture](../adr/2025-11-03-unified-settings-architecture.md)
- [ADR-2025-10-27: Presentation Layer Domain Hooks](../adr/2025-10-27-presentation-layer-domain-hooks.md)
- [ADR-2025-10-28: Message Envelope Architecture](../adr/2025-10-28-message-envelope-architecture.md)

**Epic & Sprint Documentation**:
- [Epic: Unified Settings Architecture](./../.todo/epics/epic-unified-settings-architecture-2025-11-03/)
- [Sprint 04: Domain Hooks Extraction](./../.todo/epics/epic-unified-settings-architecture-2025-11-03/sprints/04-domain-hooks-extraction.md)

**Code Locations**:
- Frontend hooks: [src/presentation/webview/hooks/domain/](../../src/presentation/webview/hooks/domain/)
- Backend handler: [src/application/handlers/domain/ConfigurationHandler.ts](../../src/application/handlers/domain/ConfigurationHandler.ts)
- Message routing: [src/application/handlers/MessageHandler.ts](../../src/application/handlers/MessageHandler.ts)
- Settings UI: [src/presentation/webview/components/SettingsOverlay.tsx](../../src/presentation/webview/components/SettingsOverlay.tsx)

### Selection and Context Details

- Selection messages include `sourceUri` and `relativePath` when text is selected in the editor; when no selection exists, the handler falls back to the clipboard (no source metadata).
- The context assistant two-turn flow now includes the full source document content in the first turn (when available) in addition to the excerpt and resource catalog.

## State & Session Management

- **Result Cache**: Each `MessageHandler` instance keeps the latest analysis/dictionary/metrics/status/error messages for replay while that webview instance is alive. The cache is deliberately instance-bound so disposed webviews cannot leak stale results into replacements.
- **UI Persistence**: The React app mirrors all important state (active tab, last responses, model selections) to VS Code's webview storage, preserving context across focus changes and reloads. Dictionary inputs (word/context/edited flag) are lifted to App state to avoid unintended auto-fill and preserve user input across tab switches.
- **Background Execution**: `AIResourceOrchestrator` continues running OpenRouter calls even if the webview is hidden. Once a response arrives it is cached and logged, ready for replay when the user returns.
- **Context Retention**: The webview is registered with `retainContextWhenHidden` (with a polyfill cast for older API signatures) to minimize disposals during normal sidebar switching.

## Type Safety

All messages between extension and webview are **strongly typed** using domain-organized shared interfaces:

- [src/shared/types/messages/](src/shared/types/messages/) - Message contracts organized by domain
  - **index.ts**: Barrel export for backward compatibility (import from this for all message types)
  - **base.ts**: `MessageType` enum, `BaseMessage`, common types (`TokenUsage`, `ModelScope`, etc.)
  - **Domain modules**: Each feature area has its own message file (analysis, dictionary, context, metrics, search, configuration, publishing, sources, ui, results)

This organization makes it easy to find and modify message contracts for specific features while maintaining backward compatibility through the barrel export.

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

1. **Single Responsibility**: Each service has one clear purpose and reason to change
   - Example: AssistantToolService only handles dialogue/prose analysis
2. **Open/Closed**: Extensible without modification (add new services without changing existing ones)
   - Example: Adding SearchHandler didn't require modifying other handlers
3. **Liskov Substitution**: Services implement focused contracts that can be swapped
   - Example: Different AI orchestrators could be injected into services
4. **Interface Segregation**: Handlers inject only the services they need
   - Example: SearchHandler only injects WordSearchService, not all 11 services
5. **Dependency Inversion**: Handlers depend on service abstractions, not concrete implementations
   - Example: MetricsHandler depends on injected services, enabling testability

### Clean Code Practices

- Meaningful names
- Small functions
- No code duplication
- Clear comments explaining "why" not "what"
- Consistent formatting

## Future Integration

### Prose Minion MCP Tools

The infrastructure services layer is designed to integrate with MCP tools:

**Current**: Direct OpenRouter API integration via AIResourceManager

**Future**:
- MCP protocol integration for tool communication
- Subprocess execution of prose-minion MCP tools
- Additional analysis capabilities via MCP server

### Extension Points

To add a new feature:

1. **Define message types**: Add to appropriate domain file in [src/shared/types/messages/](src/shared/types/messages/) (or create a new one)
   - Add message interface extending `BaseMessage`
   - Add to `MessageType` enum in `base.ts`
   - Export from `index.ts` barrel export

2. **Create service** (if needed):
   - Create new service in [src/infrastructure/api/services/](src/infrastructure/api/services/)
   - Follow Single Responsibility Principle (one clear purpose)
   - Keep services focused (< 500 lines)
   - Inject dependencies via constructor

3. **Add domain handler** (if new domain):
   - Create new handler in [src/application/handlers/domain/](src/application/handlers/domain/)
   - Inject required services via constructor (only what's needed)
   - Implement handler methods
   - Register routes with MessageRouter

4. **Update MessageHandler**:
   - Construct the service in `apps/vscode-extension/src/extension.ts`
   - Add it to the typed `CoreServices` bundle
   - `ProseToolsViewProvider` passes `CoreServices` to `MessageHandler`
   - MessageHandler instantiates domain handler with services
   - Register handler routes with MessageRouter

5. **Add frontend hook** (if needed):
   - Create domain hook in [src/presentation/webview/hooks/domain/](src/presentation/webview/hooks/domain/)
   - Follow Tripartite Hook Interface pattern (State, Actions, Persistence)
   - Register message handlers with useMessageRouter

6. **Add UI**: Create or update React component in [src/presentation/webview/components/](src/presentation/webview/components/)

**Example Flow**:
```
User action in UI → Domain Hook → postMessage
  → MessageHandler → Domain Handler → Service(s)
  → Result → MessageHandler → postMessage
  → Domain Hook → Update state → UI re-renders
```

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

## Testing

### Automated Testing Framework

The codebase uses **Jest** with **ts-jest** for automated testing. The testing strategy follows an **Infrastructure-First Lightweight** approach, targeting 40% code coverage while protecting core architectural patterns and business logic.

**Test Structure**:
- All tests located in `src/__tests__/` (separate from source code)
- Mirrors `src/` directory structure for easy navigation
- Path aliases supported: `@/` maps to `src/`

**Test Commands**:
```bash
# Run all tests (124 tests)
npm test

# Run with coverage report
npm run test:coverage

# Watch mode (auto-rerun on changes)
npm run test:watch

# Run only Tier 1 infrastructure tests
npm run test:tier1
```

**Coverage Goals** (Achieved 2025-11-15):
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Statements | 40% | 43.1% | ✅ |
| Functions | 40% | 46.52% | ✅ |
| Lines | 40% | 41.58% | ✅ |
| Branches | 20% | 20.72% | ✅ |

**What's Tested**:

**Tier 1 - Infrastructure Patterns** (25 tests):
- MessageRouter (Strategy pattern implementation)
- Domain hooks (Tripartite Interface: State, Actions, Persistence)
- Message routing and handler registration

**Tier 2 - Domain Handlers** (25 tests):
- Route registration for all 10 domain handlers
- Handler initialization and dependency injection
- Error handling for handler operations

**Tier 3 - Business Logic** (74 tests):
- Word clustering algorithm (window size, minimum cluster size, case sensitivity)
- Publishing standards lookup and caching
- Prose statistics calculations (word count, dialogue %, lexical density, pacing, etc.)

**Not Tested** (Intentionally Deferred):
- UI components (React - complex mocking, high churn)
- OpenRouter API integration (external dependency - manual testing)
- VSCode extension activation (requires @vscode/test-electron)

**Testing Philosophy**:
- Focus on **architectural patterns** that every feature depends on
- Test **complex business logic** (algorithms, calculations)
- **Defer UI testing** until v1.0 (presentation layer has high churn)
- Target **40% coverage** (not 80-100%) for alpha development velocity

**References**:
- [ADR-2025-11-15: Lightweight Testing Framework](adr/2025-11-15-lightweight-testing-framework.md)
- [Infrastructure Testing Epic](.todo/archive/epics/epic-infrastructure-testing-2025-11-15/)

---

### Manual Testing the Extension

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
