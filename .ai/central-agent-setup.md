# Agents Guide for Prose Minion VSCode Extension

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

### Presentation Hooks (Webview)

The presentation layer now mirrors backend domain organization via custom React hooks. App.tsx is a thin orchestrator that composes hooks, routes messages, and persists state.

Structure:

```
src/presentation/webview/
├── hooks/
│   ├── useVSCodeApi.ts         # acquireVsCodeApi() wrapper (singleton via ref)
│   ├── usePersistence.ts       # Compose domain persisted state into vscode.setState
│   ├── useMessageRouter.ts     # Strategy: MessageType → handler; stable listener
│   └── domain/
│       ├── useAnalysis.ts      # Analysis results, guides, status ticker
│       ├── useMetrics.ts       # Per-subtool cache; source mode/path helpers
│       ├── useDictionary.ts    # Word/context state and tool name
│       ├── useContext.ts       # Context text, requested resources, loading/status
│       ├── useSearch.ts        # Search results and targets
│       ├── useSettings.ts      # Overlay, settings data, model selections, tokens, API key
│       ├── useSelection.ts     # Selected text + source metadata; dictionary injection
│       └── usePublishing.ts    # Publishing presets and trim size
```

Patterns and conventions:
- Strategy routing: `useMessageRouter({ [MessageType.X]: handler })` with a ref to maintain a stable event listener.
- Persistence: Each hook exposes `persistedState`; App composes them into `usePersistence` to sync `vscode.setState`.
- Message enums: Use `STATUS` for status messages, `MODEL_DATA`/`REQUEST_MODEL_DATA` for model options, and `SET_MODEL_SELECTION` for user selection. Avoid ad-hoc enums like `STATUS_MESSAGE`, `MODEL_OPTIONS_DATA`, or `SET_MODEL`.
- UI settings: Toggle UI prefs (e.g., token widget) via `UPDATE_SETTING` with nested keys like `ui.showTokenWidget`.
- Metrics: Provide `setPathText` and `clearSubtoolResult` so subtools can refresh independently.
- **useEffect extraction**: Extract inline useEffect logic to named methods wrapped in `useCallback` for testability, reusability, and clarity. Use semantic naming: `request*` (data fetching), `sync*` (synchronization), `clear*When*` (conditional state updates), `initialize*` (initialization), `validate*` (validation). See [Architecture Debt: useEffect Extraction Pattern](.todo/architecture-debt/2025-11-05-useeffect-extraction-pattern.md).

References:
- ADR: [docs/adr/2025-10-27-presentation-layer-domain-hooks.md](docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- Epic: [.todo/archive/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md](.todo/archive/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md)

### Core Architecture Patterns

The codebase implements several key patterns that should be understood and followed when making changes:

#### 1. Message Envelope Pattern
**Location**: All message passing between extension and webview
**Purpose**: Standardized communication with source tracking, echo prevention, and audit trails

```typescript
// All messages use this envelope structure
interface MessageEnvelope {
  type: MessageType;
  source: string;          // e.g., 'webview.domain.component' or 'extension.handler.analysis'
  payload: T;              // Typed data specific to message type
  timestamp: number;       // For debugging and audit trails
}
```

**Benefits**:
- ✅ Prevents configuration race conditions via echo detection
- ✅ Enables debugging and tracing of message flows
- ✅ Symmetric pattern used on both frontend and backend
- ✅ Source tracking enables domain-specific error handling

**References**: [ADR 2025-10-28](docs/adr/2025-10-28-message-envelope-architecture.md)

#### 2. Strategy Pattern for Message Routing
**Location**: `MessageHandler.ts` (backend), `useMessageRouter.ts` (frontend)
**Purpose**: Eliminates switch statements, enables extension without modification (Open/Closed Principle)

```typescript
// Backend (MessageHandler.ts)
private routeMessage(message: MessageEnvelope): void {
  const handler = this.messageRouter.get(message.type);
  if (handler) {
    handler(message);
  }
}

// Frontend (useMessageRouter.ts)
useMessageRouter({
  [MessageType.ANALYSIS_RESULT]: analysis.handleResult,
  [MessageType.METRICS_RESULT]: metrics.handleResult,
  // ... register handlers declaratively
});
```

**Benefits**:
- ✅ No switch statements to maintain
- ✅ Handlers registered at initialization
- ✅ Easy to add new message types without modifying router
- ✅ Clear, declarative handler registry

#### 3. Domain Mirroring (Frontend ↔ Backend)
**Purpose**: Symmetric organization reduces cognitive load and ensures consistency

**Mapping**:
| Frontend Hook | Backend Handler | Domain |
|--------------|----------------|---------|
| useAnalysis | AnalysisHandler | Prose/dialogue analysis |
| useMetrics | MetricsHandler | Word frequency, stats, style flags |
| useDictionary | DictionaryHandler | Word lookups |
| useContext | ContextHandler | Context generation |
| useSearch | SearchHandler | Word search |
| useSettings | ConfigurationHandler | Settings, models, API keys |
| usePublishing | PublishingHandler | Publishing standards |
| useSelection | UIHandler | Selection/paste operations |

**Benefits**:
- ✅ Same domain boundaries on both sides
- ✅ Easier to trace message flows
- ✅ Consistent naming conventions
- ✅ Reduced context switching when working across layers

#### 4. Tripartite Hook Interface Pattern
**Location**: All domain hooks in `src/presentation/webview/hooks/domain/`
**Purpose**: Clear separation of concerns within each hook

```typescript
// Each domain hook exports three interfaces:
export interface DomainState {
  // Read-only state (what the UI displays)
  result: string;
  isLoading: boolean;
}

export interface DomainActions {
  // Write operations (what the UI can trigger)
  handleMessage: (msg: Message) => void;
  performAction: () => void;
}

export interface DomainPersistence {
  // What gets saved to vscode.setState
  lastResult: string;
  userPreferences: Record<string, any>;
}

// Composed return type
export type UseDomainReturn = DomainState & DomainActions & {
  persistedState: DomainPersistence
};
```

**Benefits**:
- ✅ Clear contracts for hook consumers
- ✅ Type-safe composition in App.tsx
- ✅ Explicit persistence declarations
- ✅ Consistent pattern across all domain hooks

#### 5. Composed Persistence Pattern
**Location**: `App.tsx` + `usePersistence.ts`
**Purpose**: Automatic, type-safe state synchronization across sessions

```typescript
// Each domain hook declares what to persist
const analysis = useAnalysis();
const metrics = useMetrics();

// App.tsx composes all persistence
usePersistence({
  activeTab,
  ...analysis.persistedState,
  ...metrics.persistedState,
  // ... all domain state
});
```

**Benefits**:
- ✅ Declarative - hooks own their persistence contract
- ✅ Automatic - syncs on every state change
- ✅ Type-safe - TypeScript validates shape
- ✅ Centralized - one place to manage all persistence

#### 6. Infrastructure Hooks Pattern
**Location**: `src/presentation/webview/hooks/`
**Purpose**: Abstract framework concerns from domain logic

**Infrastructure Hooks**:
- `useVSCodeApi`: Singleton wrapper around acquireVsCodeApi()
- `usePersistence`: vscode.setState() management
- `useMessageRouter`: Event listener with stable reference via useRef

**Benefits**:
- ✅ Domain hooks depend on stable abstractions
- ✅ Framework independence (could swap React)
- ✅ Testability - can mock infrastructure
- ✅ Referential stability via useRef/useMemo

**References**: [Presentation Layer Review](.memory-bank/20251102-1845-presentation-layer-architectural-review.md)

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

3. **Create service** (if needed):
   - Create new service in `src/infrastructure/api/services/` under appropriate subdirectory:
     - `analysis/` - Analysis tools (AssistantToolService, ContextAssistantService)
     - `dictionary/` - Dictionary services (DictionaryService)
     - `measurement/` - Metrics services (ProseStatsService, StyleFlagsService, WordFrequencyService)
     - `search/` - Search services (WordSearchService)
     - `resources/` - Resource management (AIResourceManager, StandardsService)
   - Follow Single Responsibility Principle (one clear purpose)
   - Keep services focused (< 500 lines)
   - Inject dependencies via constructor
   - If extending existing functionality, add method to existing service instead

4. **Update MessageHandler**:
   - Instantiate service(s) in `MessageHandler` constructor (if new services)
   - Inject required services into domain handler constructor
   - Handler registers its routes via `registerRoutes()` method

5. **Create system prompts** in `resources/system-prompts/[tool-name]/`

6. **Add UI components** in `src/presentation/webview/components/`

7. **Create corresponding domain hook** in `src/presentation/webview/hooks/domain/`
   - Follow Tripartite Hook Interface pattern (State, Actions, Persistence)
   - Mirror backend domain handler organization
   - Export all interfaces explicitly

#### Adding New Settings

**IMPORTANT**: All settings must use the **Domain Hooks pattern** for consistency and persistence.

**Process** (following [ADR-2025-11-03](docs/adr/2025-11-03-unified-settings-architecture.md)):

1. **Add to package.json** `contributes.configuration`
2. **Backend**: Add to `ConfigurationHandler` getter method (e.g., `getWordSearchSettings()`)
3. **Frontend**: Add to corresponding domain hook (e.g., `useWordSearch`)
4. **Register in MessageHandler** config watcher using semantic method
5. **Wire into App.tsx**: Message routing + persistence composition
6. **Test bidirectional sync**: Settings Overlay ↔ VSCode settings panel ↔ Webview state

**Reference Implementation**: See `usePublishing.ts` for clean example.

#### Modifying AI Behavior

1. Edit system prompts in `resources/system-prompts/`
2. Each tool loads prompts from numbered markdown files (00-, 01-, etc.)
3. Shared prompts apply to all tools
4. Craft guides provide additional context (optional)

### Code Style and Patterns

- **Dependency Injection**: Services are injected through constructors
- **Interface Segregation**: Domain layer defines interfaces, infrastructure implements
- **Message Passing**: Extension and webview communicate via typed messages using Message Envelope pattern
- **TypeScript**: Strict typing throughout the codebase
- **Error Handling**: Try/catch with fallbacks for missing resources

### Type Organization & Import Conventions

**Sprint 02 (Foundation Cleanup) established clear type organization and semantic import patterns.**

#### Message Type Organization

Message contracts live in `src/shared/types/messages/` organized by domain:

```plaintext
src/shared/types/messages/
├── index.ts              # Barrel export (import from here)
├── base.ts              # MessageType enum, MessageEnvelope, common base types
├── error.ts             # Error suite (ErrorSource, ErrorPayload, ErrorMessage)
├── status.ts            # Status messages (StatusPayload, StatusMessage)
├── tokenUsage.ts        # TokenUsage interface (first-class app behavior)
├── analysis.ts          # Dialogue & prose analysis messages
├── dictionary.ts        # Dictionary lookup messages
├── context.ts           # Context generation messages
├── metrics.ts           # Prose stats, style flags, word frequency
├── search.ts            # Word search messages
├── configuration.ts     # Settings, models, tokens messages
├── publishing.ts        # Publishing standards messages
├── sources.ts           # File/glob operation messages
├── ui.ts                # Tab changes, selections, guide messages
└── results.ts           # Save/copy result messages
```

**Type Location Guidelines:**

| Type Category | Location | Example |
|--------------|----------|---------|
| **Cross-cutting concerns** | Dedicated files (error, status, tokenUsage) | `ErrorPayload`, `StatusMessage`, `TokenUsage` |
| **Domain-specific messages** | Domain file (analysis, dictionary, etc.) | `AnalyzeDialoguePayload` in `analysis.ts` |
| **First-class app behaviors** | Own file at messages root | `TokenUsage` in `tokenUsage.ts` |
| **Base/shared types** | `base.ts` only | `MessageEnvelope`, `MessageType` enum |

**Import from barrel export:**
```typescript
// ✅ Correct: Import from barrel export
import { MessageType, ErrorPayload, TokenUsage } from '@messages';
import { AnalyzeDialoguePayload } from '@messages';

// ❌ Incorrect: Don't import from specific files
import { MessageType } from '@messages/base';
import { ErrorPayload } from '@messages/error';
```

#### Semantic Import Aliases

**Zero relative imports policy**: All imports use semantic aliases (no `../../../`).

**Extension (Backend) Aliases:**
```typescript
import { AnalysisHandler } from '@handlers/domain/AnalysisHandler';
import { DictionaryService } from '@services/dictionary/DictionaryService';
import { PublishingStandardsRepository } from '@standards';
import { SecretStorageService } from '@secrets';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { DialogueMicrobeatAssistant } from '@/tools/assist/dialogueMicrobeatAssistant';
```

**Webview (Frontend) Aliases:**
```typescript
import { AnalysisTab } from '@components/AnalysisTab';
import { useAnalysis } from '@hooks/domain/useAnalysis';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { formatSearchResultAsMarkdown } from '@formatters/wordSearchFormatter';
import { TextUtils } from '@utils/textUtils';
```

**Shared Aliases (Both):**
```typescript
import { MessageType, ErrorPayload } from '@messages';
import { CustomTypes } from '@shared/types/customTypes';
```

**Universal Fallback:**
```typescript
// Use @/* for anything without a specific alias
import { SomeUtility } from '@/utils/someUtility';
import { ApplicationService } from '@/application/services/ApplicationService';
```

**Alias Reference Table:**

| Alias | Resolves To | Used In |
|-------|-------------|---------|
| `@messages` | `src/shared/types/messages/index.ts` | Both (barrel import) |
| `@messages/*` | `src/shared/types/messages/*` | Both (specific files) |
| `@shared/*` | `src/shared/*` | Both |
| `@handlers/*` | `src/application/handlers/*` | Extension |
| `@services/*` | `src/infrastructure/api/services/*` | Extension |
| `@providers/*` | `src/infrastructure/api/providers/*` | Both |
| `@orchestration/*` | `src/infrastructure/api/orchestration/*` | Extension |
| `@parsers/*` | `src/infrastructure/api/parsers/*` | Extension |
| `@standards` | `src/infrastructure/standards` | Extension |
| `@secrets` | `src/infrastructure/secrets` | Extension |
| `@components/*` | `src/presentation/webview/components/*` | Webview |
| `@hooks/*` | `src/presentation/webview/hooks/*` | Webview |
| `@utils/*` | `src/presentation/webview/utils/*` | Webview |
| `@formatters` | `src/presentation/webview/utils/formatters` | Webview |
| `@formatters/*` | `src/presentation/webview/utils/formatters/*` | Webview |
| `@/*` | `src/*` | Both (universal fallback) |

**Configuration Files:**

- `tsconfig.json` - Extension + test type resolution (includes webview aliases for tests)
- `tsconfig.webview.json` - Webview type resolution (includes infrastructure for OpenRouterModels)
- `webpack.config.js` - Both extension and webview module resolution
- `jest.config.js` - Test module resolution (order-specific: most specific first)

**Best Practices:**

- ✅ Always use semantic aliases (never `../../../`)
- ✅ Import from barrel exports when available (`@messages` not `@messages/base`)
- ✅ Prefer specific aliases over `@/*` when available
- ✅ Keep cross-cutting concerns in dedicated files (error, status, tokenUsage)
- ❌ Don't add types to `base.ts` unless truly shared across all domains
- ❌ Don't import directly from domain files when barrel export exists

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

## Development Workflow

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `docs/adr/` | Architecture Decision Records (ADRs) - document decisions before coding |
| `.todo/epics/` | Active feature work with sprint breakdowns |
| `.todo/architecture-debt/` | Tracked technical debt for future resolution |
| `.todo/archive/` | Completed epics and specs |
| `.memory-bank/` | Session continuity snapshots (format: `YYYYMMDD-HHMM-title.md`) |

### Development Flow

```
1. ADR → 2. Epic → 3. Sprint → 4. Implement → 5. PR → 6. Archive
```

**ADR-First**: For architectural changes, create ADR in `docs/adr/YYYY-MM-DD-title.md` BEFORE coding. Iterate until architecture is sound.

**Branching**: `sprint/<epic-slug>-<NN>-<sprint-slug>` (e.g., `sprint/epic-message-envelope-01-structure`)

### Architecture Debt

When you discover issues out of scope for current work:
1. Create `.todo/architecture-debt/YYYY-MM-DD-issue-name.md`
2. Assign priority (High/Medium/Low)
3. Reference in sprint completion notes
4. Continue sprint - don't let debt tracking block progress

## Testing and Development

### Automated Testing Framework

The project uses **Jest** with **ts-jest** for automated testing. Tests follow an **Infrastructure-First Lightweight Testing** approach focusing on protecting core architectural patterns and business logic.

**Test Organization**:
```
src/__tests__/         # All tests in separate directory (mirrors src/ structure)
├── setup.ts           # VSCode API mocks and global test setup
├── application/
│   └── handlers/      # MessageRouter + domain handler tests
├── presentation/
│   └── webview/hooks/domain/  # Domain hook contract tests
├── infrastructure/
│   ├── api/services/  # Business logic tests (word search, etc.)
│   └── standards/     # Publishing standards tests
└── tools/measure/     # Measurement tool tests (prose stats, etc.)
```

**Running Tests**:
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run tests in watch mode (re-runs on changes)
npm run test:watch

# Run only infrastructure tests
npm run test:tier1
```

**Test Coverage** (as of 2025-11-15):
- 124 tests across 3 tiers
- 43.1% statement coverage (target: 40%) ✅
- 46.52% function coverage (target: 40%) ✅
- 41.58% line coverage (target: 40%) ✅
- Coverage report saved to `coverage/` (gitignored)

**What's Tested**:
- ✅ **Tier 1 - Infrastructure Patterns**: MessageRouter (Strategy pattern), domain hooks (Tripartite Interface), message routing
- ✅ **Tier 2 - Domain Handlers**: Route registration for all 10 domain handlers
- ✅ **Tier 3 - Business Logic**: Word clustering algorithm, publishing standards lookup, prose statistics calculations

**What's NOT Tested** (intentionally deferred):
- ❌ UI components (React components - deferred to v1.0)
- ❌ OpenRouter API integration (external dependency - manual testing only)
- ❌ VSCode extension activation (requires @vscode/test-electron)

**Testing Philosophy**:
- **Infrastructure-First**: Protect architectural patterns that every feature depends on
- **Lightweight**: 40% coverage target (not 80-100%) to balance velocity with safety
- **Token-Conscious**: Focus on high-value tests; defer comprehensive TDD until v1.0

**References**:
- [ADR-2025-11-15: Lightweight Testing Framework](docs/adr/2025-11-15-lightweight-testing-framework.md)
- [Epic: Infrastructure Testing](.todo/archive/epics/epic-infrastructure-testing-2025-11-15/)

---

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

- **API key stored in VSCode SecretStorage** - OS-level encryption via platform keychains (macOS Keychain, Windows Credential Manager, Linux libsecret); automatic migration from legacy settings-based storage
- Scoped models per role: `assistantModel`, `dictionaryModel`, `contextModel` with legacy fallback `model`
- Unified `maxTokens` across tools (default 10000) with truncation notices when responses hit the cap
- Cost tracking available through OpenRouter dashboard
- Managed via Settings overlay UI (gear icon) with Save/Clear buttons

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

### Essential Principles

1. **Respect Layer Boundaries**: Presentation → Domain Hooks → Infrastructure → Framework. Never reverse dependencies.

2. **Follow Established Patterns**: Use patterns documented in "Core Architecture Patterns" section (Message Envelope, Strategy routing, Tripartite Interface, Domain Mirroring).

3. **Preserve Type Safety**: Export explicit interfaces; use typed messages from `@messages`; avoid `any` without documented rationale.

4. **ADR-First for Architecture Changes**: Create ADR before coding. Iterate until sound.

5. **Track Debt Immediately**: Document in `.todo/architecture-debt/` with priority. Don't let tracking block progress.

6. **Alpha Freedom**: No backward compatibility until v1.0. Remove dead code aggressively. Breaking changes are free.

### Operational Tips

**Parallel Subagents**: For independent tasks (e.g., updating multiple components), launch multiple Task tool calls in a single message. 3-5x faster than sequential.

**Testing**: Press F5 to launch Extension Development Host. Check Output Channel for backend logging. Verify persistence across reloads.

**Memory Bank**: Use format `YYYYMMDD-HHMM-title.md` for all entries.

## Anti-Pattern Checklist

Before approving any PR, check for these anti-patterns:

- [ ] **God Component**: Any file > 500 lines? Any component with > 10 responsibilities?
- [ ] **Cross-Cut Crisis**: Persistence/logging/error handling duplicated?
- [ ] **Dependency Elevators**: Any imports going "up" the layer stack?
- [ ] **Domain Boundaries**: Clear which domain owns this logic?
- [ ] **Use Case Scattergories**: Related operations scattered across files?
- [ ] **Typing Tapestry**: `any` types without documented rationale?

If any checked, **request ADR revision** before coding.

## Publishing Standards + Metrics

- Use the `PublishingStandardsRepository` and `StandardsComparisonService` patterns when adding or modifying comparison logic.
- Do not conflate Type-Token Ratio (TTR) with lexical density; lexical density is the content-word ratio (non-stopwords/total) × 100.
- When exporting metrics, rely on the extension-side modal prompt to include/exclude the "## Chapter Details" section. Never remove the on-screen "📖 Chapter-by-Chapter Prose Statistics" summary table.
- Metrics reports should save under `prose-minion/reports/` using timestamped filenames.

## Questions and Support

For questions about the codebase:
1. Check [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture info
2. Review existing tool implementations as examples
3. Check the VSCode Extension API documentation for platform-specific features
4. Refer to OpenRouter API documentation for model capabilities

## Related Projects

- **Prose Minion MCP Tool**: The original MCP-based version
- **Claude Desktop**: Can integrate with this extension via MCP protocol (planned)
