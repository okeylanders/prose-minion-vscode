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
- Epic: [.todo/archived/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md](.todo/archived/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md)

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

**Reference Implementation**: See `usePublishing.ts` for clean example

**Active Work**: [Epic: Unified Settings Architecture](.todo/epics/epic-unified-settings-architecture-2025-11-03/) is standardizing all settings to domain hooks pattern.

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

## Repository Workflow: ADRs, Epics, Sprints, Memory Bank

### Document Structure

#### .ai/central-agent-setup.md (This File)
- **Purpose**: Central agent guidance document
- **Symlinked by**: `.codex/agents.md`, `.claude/CLAUDE.md`, `.cline-rules/prose-minion-agent`
- **Update Policy**: Update this file to change agent guidance everywhere

#### docs/adr/ - Architecture Decision Records
- **Purpose**: Holds decision documents that drive notable changes and features
- **Coupling**: Epics and sprints reference ADRs for traceability and rationale
- **Naming**: `YYYY-MM-DD-descriptive-title.md` (e.g., `2025-10-28-message-envelope-architecture.md`)
- **Status Tracking**: Each ADR includes implementation status (Proposed, Accepted, Implemented, Superseded)

#### .todo/epics/ - Long-Running Feature Tracks
- **Purpose**: Long-running themes or feature tracks
- **Structure**: Each epic folder (e.g., `epic-verbalized-sampling-2025-10-26/`) contains:
  - Epic overview markdown (`epic-[name].md`)
  - `sprints/` subfolder with individual sprint documents
- **Coupling**: Epics link to ADR(s) that provide architectural rationale

#### .todo/epics/[epic-name]/sprints/ - Execution Units
- **Purpose**: Execution units under an epic
- **Naming**: `NN-descriptive-title.md` (e.g., `01-prompt-enhancements.md`)
- **Contents**: Each sprint doc includes:
  - Scope and goals
  - Task breakdown
  - Acceptance criteria
  - Links to relevant ADR(s)
  - Implementation outcomes (added after completion)
- **Coupling**: Sprints call out exactly which ADR(s) they implement

#### .todo/architecture-debt/ - Tracked Technical Debt
- **Purpose**: Document architecture issues discovered during development for future resolution
- **When to Create**:
  - During sprint work when you identify a pattern that should be refactored but is out of scope
  - After completing a sprint, during architectural review
  - When you notice duplication, inconsistency, or violations of established patterns
- **Naming**: `YYYY-MM-DD-descriptive-issue-name.md`
- **Required Sections**:
  ```markdown
  # [Issue Title]

  **Date Identified**: YYYY-MM-DD
  **Identified During**: [Sprint/Epic name or "Architectural Review"]
  **Priority**: High | Medium | Low
  **Estimated Effort**: [Time estimate]

  ## Problem
  [Clear description of the architectural issue]

  ## Current Implementation
  [Code examples or file references showing the problem]

  ## Recommendation
  [Proposed solution or refactoring approach]

  ## Impact
  [Benefits of fixing, risks of not fixing]

  ## References
  - Related ADRs: [links]
  - Related files: [file paths]
  ```
- **Example**: See [.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md](.todo/architecture-debt/2025-11-02-settings-architecture-analysis.md)

#### .todo/archived/ - Completed Work Archive
- **Purpose**: Keep `.todo/` focused on active work by archiving completed items
- **Structure**: Mirrors active `.todo/` structure
  ```
  .todo/archived/
  ├── epics/              # Completed epic folders (with full sprint history)
  │   ├── epic-message-envelope-2025-10-28/
  │   ├── epic-presentation-refactor-2025-10-27/
  │   └── ...
  └── specs/              # Completed standalone spec directories
      ├── search-module/
      ├── metrics-module/
      └── ...
  ```
- **Archive Principle**: **Archive = DONE**. Only completed work goes to `archived/`. Planning, backlog, and pending items stay in active `.todo/` directories.
- **When to Archive**:
  - Epic is complete (all sprints done, PR merged)
  - Standalone spec is fully implemented
  - Work is superseded by a better approach
- **How to Archive**:
  - Move entire directory tree (preserve structure)
  - Update epic/sprint status to "Complete" with completion date
  - Add link to final PR and Memory Bank entry
  - Reference from `.memory-bank/` summary

#### .memory-bank/ - Session Continuity Snapshots
- **Purpose**: Working context snapshots for agent continuity between sessions
- **Contents**: Lightweight notes capturing:
  - Current focus and active epic/sprint
  - Links to relevant ADRs
  - Open questions or decisions needed
  - State snapshots (like `20251103-1230-state-of-repo-snapshot.md`)
  - Sprint completion summaries
  - Architectural review outcomes
- **Naming**: `YYYYMMDD-HHMM-descriptive-title.md` (time is REQUIRED for chronological clarity)
- **Usage**: Provide quick on-ramps for agents and maintain continuity between sessions

### Development Flow & Process

The repository follows a structured flow from ideation to implementation:

```
1. Planning/Ideation
   ↓
2. Architecture Decision Record (ADR)
   ↓
3. Epic Creation
   ↓
4. Sprint Breakdown
   ↓
5. Implementation in Feature Branch
   ↓
6. PR Review & Merge
   ↓
7. Archive & Document
```

#### Detailed Flow

**1. Planning/Ideation**
- Identify need or improvement opportunity
- Document initial thoughts in `.memory-bank/` if exploring multiple options
- Consider architecture implications

**2. Architecture Decision Record (ADR)**
- Create ADR in `docs/adr/YYYY-MM-DD-descriptive-title.md`
- Document:
  - Context and problem statement
  - Considered alternatives
  - Decision and rationale
  - Consequences (benefits and trade-offs)
  - Implementation approach
- Mark status as "Proposed" or "Accepted"
- **CRITICAL**: Iterate on the ADR multiple times before coding
  - First draft: Propose solution
  - Review: Identify potential anti-patterns (god components, dependency violations, etc.)
  - Iterate: Address anti-patterns in ADR
  - Approve: Only when architecture is sound

**3. Epic Creation**
- Create epic folder in `.todo/epics/epic-[name]-YYYY-MM-DD/`
- Write epic overview (`epic-[name].md`) with:
  - Goals and success criteria
  - Link to ADR(s)
  - High-level scope
  - Expected outcomes
- Create `sprints/` subfolder

**4. Sprint Breakdown**
- Break epic into executable sprints (1-3 days each recommended)
- Create sprint documents in `sprints/NN-descriptive-title.md`
- Each sprint includes:
  - Specific scope (subset of epic)
  - Task breakdown (checklist)
  - Acceptance criteria
  - Links to ADR(s) being implemented
  - Branch name suggestion

**5. Implementation in Feature Branch**
- Create branch: `sprint/epic-[name]-YYYY-MM-DD-NN-[sprint-slug]`
  - Example: `sprint/epic-message-envelope-2025-10-28-01-envelope-structure`
- Implement according to sprint scope
- **During Implementation**:
  - Track architecture debt discovered (create `.todo/architecture-debt/` entries)
  - Update sprint doc with progress notes
  - Add Memory Bank entries for complex decisions or blockers
    - **IMPORTANT**: All memory bank entries MUST include time in filename: `YYYYMMDD-HHMM-descriptive-title.md`

**6. PR Review & Merge**
- Open PR referencing:
  - Sprint document
  - ADR(s) implemented
  - Any architecture debt identified
- PR description should summarize:
  - What was implemented
  - How it aligns with ADR
  - Any deviations or discoveries
- After merge:
  - Update ADR status to "Implemented" (if fully complete)
  - Update sprint doc with outcomes and PR link

**7. Archive & Document**
- **Complete Sprints**: Update status to "Complete" in sprint doc
- **Complete Epics**: When all sprints done:
  - Move entire epic folder from `.todo/epics/` to `.todo/archived/epics/`
  - Preserve full directory structure (including `sprints/` subfolder)
  - Add final summary to epic doc (completion date, total PRs, outcomes)
- **Memory Bank**: Create completion summary in `.memory-bank/` with:
  - **Filename format**: `YYYYMMDD-HHMM-descriptive-title.md` (time is REQUIRED)
  - Links to ADR, Epic, PRs
  - Key achievements
  - Any follow-up items or debt identified
- **State Snapshot**: Update or create repo state snapshot if major milestone

### Branching Strategy

- **Branch Naming**: `sprint/<epic-slug>-<NN>-<sprint-slug>`
  - Example: `sprint/epic-verbalized-sampling-2025-10-26-01-prompt-enhancements`
- **Isolation**: Each sprint runs on its own Git branch to isolate work and simplify review
- **PR References**: Open PRs should reference the sprint doc and the ADR(s) it implements
- **Post-Merge**: Update sprint doc with outcomes and memory bank with brief summary + links

### Architecture Debt Tracking - Agent Responsibilities

**When to Document Architecture Debt:**

1. **During Sprint Implementation**:
   - You discover code duplication that should be extracted but is out of scope
   - You notice inconsistent patterns across similar features
   - You implement a workaround that should be refactored later
   - You identify violations of established architectural patterns

2. **After Sprint Completion**:
   - During code review or self-review
   - When writing sprint completion summary
   - If architectural review reveals issues

3. **During Architectural Reviews**:
   - Systematic review of a layer or domain
   - Performance analysis
   - Security audit

**Agent Process**:

```markdown
1. Identify Issue
   - Notice pattern violation, duplication, or inconsistency
   - Assess if fixing is in scope for current sprint

2. Document Immediately (if out of scope)
   - Create `.todo/architecture-debt/YYYY-MM-DD-[issue-name].md`
   - Use template format (Problem, Current Implementation, Recommendation, Impact)
   - Assign priority (High, Medium, Low) based on:
     * High: Affects new feature development velocity or introduces bugs
     * Medium: Maintenance burden or minor velocity impact
     * Low: Nice-to-have, doesn't impact current work

3. Reference in Sprint Doc
   - Add "Architecture Debt Identified" section to sprint completion
   - Link to debt document(s)

4. Continue Sprint Work
   - Don't let debt tracking block current sprint
   - Acknowledge debt, document it, move forward

5. Periodic Review
   - After epic completion, review all debt identified
   - Consider if debt should become its own epic
```

**Example Workflow**:

```markdown
## During Sprint Implementation

Agent notices: "I'm implementing word filter settings using message-based config,
but Publishing Standards uses domain hooks. This is inconsistent."

Action:
1. Create `.todo/architecture-debt/2025-11-02-configuration-strategy-inconsistency.md`
2. Document the inconsistency, show examples, recommend unified approach
3. Assign priority: Medium (doesn't block current work, but affects future settings)
4. Continue sprint using current approach (message-based)
5. Add to sprint completion notes: "Architecture debt identified: configuration strategy inconsistency"

## After Sprint Completion

Agent reviews code and notices: "Word counter UI pattern is duplicated in 3 places"

Action:
1. Create `.todo/architecture-debt/2025-11-02-word-counter-component.md`
2. Document duplication, propose extraction to shared component
3. Assign priority: Low (working fine, but DRY violation)
4. Add to Memory Bank sprint summary
```

### Development Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Planning & Decision                                    │
├─────────────────────────────────────────────────────────────────┤
│ • Identify problem or opportunity                               │
│ • Explore solutions (document in .memory-bank/ if complex)      │
│ • Write ADR in docs/adr/YYYY-MM-DD-title.md                     │
│ • ITERATE on ADR (identify anti-patterns, refine architecture)  │
│ • Status: "Proposed" → "Accepted" (after review)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Epic & Sprint Planning                                 │
├─────────────────────────────────────────────────────────────────┤
│ • Create .todo/epics/epic-[name]-YYYY-MM-DD/                    │
│ • Write epic-[name].md (goals, scope, link to ADR)              │
│ • Break into sprints in sprints/ subfolder                      │
│ • Each sprint: scope, tasks, acceptance criteria, ADR links     │
│ • ITERATE on sprint breakdown until clear                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Implementation (Per Sprint)                            │
├─────────────────────────────────────────────────────────────────┤
│ • Create branch: sprint/epic-[name]-NN-[sprint-slug]            │
│ • Implement according to ADR and sprint scope                   │
│ • Track architecture debt in .todo/architecture-debt/           │
│ • Update sprint doc with progress notes                         │
│ • Add memory bank entries for complex decisions                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Review & Merge                                         │
├─────────────────────────────────────────────────────────────────┤
│ • Open PR (reference sprint, ADR, any debt identified)          │
│ • Review and merge                                              │
│ • Update ADR status → "Implemented" (if complete)               │
│ • Update sprint doc with outcomes and PR link                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5: Documentation & Archival                               │
├─────────────────────────────────────────────────────────────────┤
│ • Mark sprint as "Complete" in sprint doc                       │
│ • If epic complete: Move to .todo/archived/epics/               │
│   (preserve full directory tree including sprints/)             │
│ • Create memory bank completion summary                         │
│ • Update repo state snapshot if major milestone                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌──────────────────┐
                    │ Archived & Ready │
                    │  for Reference   │
                    └──────────────────┘
```

**Active Example**: The [Unified Settings Architecture Epic](.todo/epics/epic-unified-settings-architecture-2025-11-03/) is currently in Phase 2 (ADR complete, Sprint 01 ready to begin). This epic demonstrates the full flow: identified critical bug → comprehensive analysis → ADR with multiple iterations → epic with 5 sprints → ready for implementation.

## Repository Structure

```
Project Root
├── src/                          # Source code (see Architecture section)
├── resources/                    # System prompts, craft guides
├── docs/
│   ├── adr/                      # Architecture Decision Records
│   │   ├── 2025-10-28-message-envelope-architecture.md
│   │   ├── 2025-10-27-presentation-layer-domain-hooks.md
│   │   ├── 2025-11-03-unified-settings-architecture.md
│   │   └── ... (31+ decision records)
│   └── ARCHITECTURE.md           # Detailed architecture documentation
├── .todo/
│   ├── epics/                    # Active epics
│   │   ├── epic-unified-settings-architecture-2025-11-03/
│   │   │   ├── epic-unified-settings-architecture.md
│   │   │   └── sprints/
│   │   │       ├── 01-searchtab-urgent-fix.md
│   │   │       ├── 02-backend-semantic-methods.md
│   │   │       └── ...
│   │   ├── epic-search-architecture-2025-10-19/
│   │   └── epic-v1-polish-2025-11-02/
│   ├── architecture-debt/        # Tracked technical debt
│   │   ├── 2025-11-02-settings-architecture-analysis.md
│   │   ├── 2025-11-02-settings-sync-registration.md
│   │   ├── 2025-11-02-configuration-strategy-inconsistency.md
│   │   └── 2025-11-02-word-counter-component.md
│   └── archived/                 # Completed work (archive = done)
│       ├── epics/                # Completed epic folders (with full history)
│       │   ├── epic-message-envelope-2025-10-28/
│       │   ├── epic-presentation-refactor-2025-10-27/
│       │   ├── epic-context-window-safety-2025-11-02/
│       │   ├── epic-clickable-resource-pills-2025-11-02/
│       │   ├── epic-word-length-filter-metrics-2025-11-02/
│       │   ├── epic-secure-storage-2025-10-27/
│       │   └── epic-verbalized-sampling-2025-10-26/
│       └── specs/                # Completed standalone specs
│           ├── search-module/
│           ├── metrics-module/
│           ├── token-cost-widget/
│           ├── settings-module/
│           └── v1-polish/
├── .memory-bank/                 # Session continuity & state snapshots
│   ├── 20251103-1230-state-of-repo-snapshot.md
│   ├── 20251103-1415-unified-settings-architecture-planning.md
│   ├── 20251102-1845-presentation-layer-architectural-review.md
│   ├── 20251102-1620-context-window-safety-sprint-complete.md
│   └── ... (15+ entries)
├── .ai/
│   └── central-agent-setup.md    # This file (symlinked to agent configs)
├── .claude/
│   └── CLAUDE.md                 # Symlink → .ai/central-agent-setup.md
├── .codex/
│   └── agents.md                 # Symlink → .ai/central-agent-setup.md
└── .cline-rules/
    └── prose-minion-agent        # Symlink → .ai/central-agent-setup.md
```

**Key Directories**:

- **docs/adr/**: Architectural decisions (31+ records, linked from epics/sprints)
- **.todo/epics/**: Active feature tracks with sprint breakdowns
- **.todo/architecture-debt/**: Identified issues for future resolution (prioritized)
- **.todo/archived/**: Completed epics and specs (preserves full directory trees)
- **.memory-bank/**: Working context for agent continuity and state snapshots
- **.ai/central-agent-setup.md**: Central guidance (symlinked to all agent configs)

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
- [Epic: Infrastructure Testing](.todo/archived/epics/epic-infrastructure-testing-2025-11-15/)

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

When working with this codebase:

### Architecture & Design Patterns

1. **Respect the Architecture**: Keep clear boundaries between layers
   - Presentation depends on domain hooks
   - Domain hooks depend on infrastructure hooks
   - Infrastructure depends on framework (React, VSCode API)
   - Never reverse dependencies (Dependency Inversion Principle)

2. **Follow Existing Patterns**: Match the style of existing tools and components
   - Use Message Envelope pattern for all extension ↔ webview communication
   - Use Strategy pattern for message routing (never switch statements)
   - Follow Tripartite Hook Interface (State, Actions, Persistence)
   - Mirror domain organization between frontend and backend

3. **Preserve Type Safety**: Maintain TypeScript types throughout
   - All hooks export explicit interfaces (State, Actions, Persistence)
   - Message payloads use typed interfaces from `src/shared/types/messages/`
   - Avoid `any` except for pragmatic cases (document rationale in comments)

4. **Domain Mirroring**: Frontend hooks should mirror backend handlers
   - When adding a backend domain handler, add corresponding frontend domain hook
   - Use consistent naming (AnalysisHandler ↔ useAnalysis)
   - Maintain symmetry in message handling patterns

### Development Process

5. **Follow the Development Flow**:
   - Planning → ADR → Epic → Sprint → Implementation → Archive
   - Don't skip ADRs for architectural changes
   - Link sprints to ADRs for traceability
   - Archive completed epics to keep `.todo/` focused

6. **Track Architecture Debt Proactively**:
   - Document debt as you discover it (don't defer)
   - Use `.todo/architecture-debt/` with proper template
   - Assign realistic priority (High/Medium/Low)
   - Reference debt in sprint completion notes
   - Don't let debt tracking block current sprint progress

7. **Document Changes**: Update relevant documentation when adding features
   - Update this file (central-agent-setup.md) for new patterns or conventions
   - Create or update ADRs for architectural decisions
   - Add Memory Bank entries for complex decisions or sprint completions
     - **Format**: `YYYYMMDD-HHMM-descriptive-title.md` (time is REQUIRED)
   - Update "What's New" section when merging major features

8. **Test Incrementally**: Run the extension after changes to verify behavior
   - Use F5 in VSCode to launch Extension Development Host
   - Test both happy path and error cases
   - Verify persistence works across sessions (reload webview)
   - Check Output Channel for backend logging

9. **Use Parallel Subagents for Independent Tasks**: Maximize efficiency by splitting work
   - **When to use**: Tasks with clear, non-overlapping boundaries that can run simultaneously
   - **How to launch**: Send a single message with multiple Task tool calls
   - **Good candidates**:
     - Updating multiple similar components (e.g., 3 tab components with same refactor pattern)
     - Independent file modifications (e.g., updating separate domain handlers)
     - Parallel research tasks (e.g., analyzing different parts of codebase)
   - **Benefits**:
     - ✅ 3-5x faster than sequential execution
     - ✅ Fresh context for each subtask (no token bloat)
     - ✅ Better focus (each agent works on one clear task)
   - **Example** (Sprint 03): Launched 3 parallel subagents to update SearchTab, MetricsTab, UtilitiesTab simultaneously, completing in ~10 minutes vs ~30 minutes sequential
   - **Pattern**:

     ```typescript
     // Launch multiple agents in one message:
     <function_calls>
       <invoke name="Task">...</invoke>  // Agent 1: Update SearchTab
       <invoke name="Task">...</invoke>  // Agent 2: Update MetricsTab
       <invoke name="Task">...</invoke>  // Agent 3: Update UtilitiesTab
     </function_calls>
     ```

### Code Quality

10. **Consider Performance**: Be mindful of API costs and token usage
   - Use context window limits (Context: 50K words, Analysis: 75K words)
   - Apply sentence-boundary-aware trimming
   - Log truncation transparently in Output Channel
   - Surface `finish_reason: "length"` to user

10. **Maintain Clean Code**:
    - Single Responsibility: Each hook/handler owns one domain
    - Open/Closed: Extend via registration, not modification
    - **Composition over Duplication** (when use cases align):
      - Prefer composition pattern to maintain DRY (e.g., ContextSearchService delegates to WordSearchService)
      - **CRITICAL**: Only apply when use cases genuinely align
      - What looks like duplication now may not be duplication later as use cases diverge
      - Example: Context Search + Word Search both need occurrence counting → composition makes sense
      - Counter-example: Two features happen to format strings similarly but for different purposes → duplication is acceptable
      - Document composition decisions in ADRs with use case alignment rationale
    - No God Components: Keep orchestrators thin (App.tsx, MessageHandler)

### Integration & Compatibility

11. **Respect Persistence Hooks**:
    - Keep result cache (`MessageHandler`) synchronized
    - Maintain `vscode.setState` via composed `usePersistence`
    - Dictionary inputs persist at App level (not component level)
    - Each domain hook declares its `persistedState` interface

12. **Source-Aware Context**:
    - Include `sourceUri`/`relativePath` in messages when available
    - Context assistant includes full source content on first turn
    - Paste operations carry source metadata
    - Selection updates include source tracking

13. **Alpha Development Freedom**:
    - **No backward compatibility required** until v1.0
    - Remove dead code immediately (no "deprecated" paths)
    - Breaking changes are free and encouraged for cleaner architecture
    - If refactoring, fully commit (no dual behavior flags)

### Message Passing

14. **Message Envelope Pattern**:
    - Always use envelope structure: `{ type, source, payload, timestamp }`
    - Source format: `'webview.domain.component'` or `'extension.handler.domain'`
    - Never send raw payloads without envelope
    - Use source tracking for echo prevention and debugging

15. **Message Type Conventions**:
    - Use `STATUS` for status messages (not `STATUS_MESSAGE`)
    - Use `MODEL_DATA`/`REQUEST_MODEL_DATA` for model options
    - Use `SET_MODEL_SELECTION` for user selection (not `SET_MODEL`)
    - Use `UPDATE_SETTING` with nested keys for UI prefs (`ui.showTokenWidget`)

### Common Anti-Patterns to Avoid

❌ **Don't**:
- Add switch statements for message routing (use Strategy pattern)
- Create god components (keep orchestrators thin)
- Mix concerns (e.g., UI logic in domain hooks)
- Skip ADRs for architectural changes
- Leave architecture debt undocumented
- Keep completed epics in active `.todo/` (archive them)
- Use ad-hoc message type names (follow conventions)
- Maintain deprecated code paths (alpha allows breaking changes)

✅ **Do**:
- Use Strategy pattern (map-based routing)
- Extract domain hooks (single responsibility)
- Separate concerns (State, Actions, Persistence)
- Write ADRs before major changes
- Document debt immediately in `.todo/architecture-debt/`
- Archive completed work to `.todo/archived/`
- Follow established message type conventions
- Remove old code when refactoring (clean breaks)

## AI Agent Anti-Patterns & Guardrails

### Context: Lessons from Rapid AI-Driven Development

This project was built primarily by AI agents (Claude Code, Cline, Codex). Through rapid iteration, we discovered that AI agents under time pressure make the same architectural mistakes humans make when rushing - just compressed into days instead of weeks.

**Key Discovery**: Without guardrails, AI agents accumulate architectural debt at an impressive rate. The solution isn't to code manually - it's to establish a process that forces the agent to **think before coding**.

---

### Common AI Agent Anti-Patterns

When AI agents rush to implement features without architectural planning, they tend to create these patterns:

#### 1. God Component Complex
**Symptom**: Single component/handler with excessive responsibilities

**Example**:
- App.tsx: 697 lines with 42 useState hooks (before refactor)
- MessageHandler: 1,091 lines with switch statements (before refactor)

**Prevention**:
- ✅ Write ADR defining domain boundaries BEFORE coding
- ✅ Force agent to extract domain hooks/handlers in planning phase
- ✅ Set line count limits (hooks < 200 lines, handlers < 150 lines)

**Fix**: See [ADR: Presentation Layer Domain Hooks](docs/adr/2025-10-27-presentation-layer-domain-hooks.md)

---

#### 2. Cross-Cut Crisis
**Symptom**: Cross-cutting concerns (persistence, logging, error handling) scattered throughout codebase

**Example**:
- Persistence logic duplicated in 42 places
- Error handling inconsistent across components
- Settings sync logic repeated per component

**Prevention**:
- ✅ Identify cross-cutting concerns in ADR
- ✅ Design infrastructure layer patterns first (useVSCodeApi, usePersistence, useMessageRouter)
- ✅ Force agent to use established patterns (reference implementations)

**Fix**: Extracted to infrastructure hooks (usePersistence, useMessageRouter)

---

#### 3. Dependency Elevators (Dependency Inversion Violations)
**Symptom**: Dependencies going up, down, sideways - circular references, high-level depending on low-level

**Example**:
- Components directly calling VSCode API
- Domain logic depending on UI state
- Handlers importing from presentation layer

**Prevention**:
- ✅ Draw dependency diagram in ADR (flows inward only)
- ✅ Enforce layer boundaries (no imports "up" the stack)
- ✅ Use dependency injection at layer boundaries

**Fix**: Clean Architecture refactor with clear layer boundaries

---

#### 4. Domain Boundary Adoption Center
**Symptom**: Domain boundaries unclear - everything belongs everywhere, nothing has a clear "home"

**Example**:
- Settings logic in UI components
- Business logic in message handlers
- State management scattered across layers

**Prevention**:
- ✅ Define domain boundaries in ADR (Analysis, Metrics, Dictionary, Context, etc.)
- ✅ Create domain-specific handlers/hooks
- ✅ Mirror domains between frontend and backend

**Fix**: See [ADR: Message Envelope Architecture](docs/adr/2025-10-28-message-envelope-architecture.md) and [ADR: Presentation Layer Domain Hooks](docs/adr/2025-10-27-presentation-layer-domain-hooks.md)

---

#### 5. Use Case Scattergories
**Symptom**: Related use cases scattered across components instead of cohesively clustered

**Example**:
- Word search initialization in one file, execution in another, state in a third
- Settings update in component, sync in handler, persistence in App.tsx

**Prevention**:
- ✅ Group use cases by domain in ADR
- ✅ Each domain hook/handler owns complete use case lifecycle
- ✅ Single Responsibility: one domain, one reason to change

**Fix**: Tripartite Hook Interface pattern (State, Actions, Persistence all in one hook)

---

#### 6. Typing Tapestry (Type Safety Erosion)
**Symptom**: `any` types spreading like wildfire, implicit types, type assertions everywhere

**Example**:
- Message handlers accepting `any`
- Props interfaces missing
- Return types inferred (and wrong)

**Prevention**:
- ✅ Define message contracts in ADR with full TypeScript interfaces
- ✅ Require explicit return types for all hooks/handlers
- ✅ Forbid `any` except with documented rationale
- ✅ Force agent to export State/Actions/Persistence interfaces

**Fix**: Explicit interfaces for all domain hooks, message contracts organized by domain

---

#### 7. Premature DRY / Composition Overreach
**Symptom**: Extracting shared code or using composition pattern when use cases don't genuinely align

**Example**:

- Two features format strings similarly → agent extracts shared formatter (but purposes differ)
- Similar-looking logic → agent creates shared service (but use cases will diverge)
- "DRY at all costs" mentality ignoring use case boundaries

**Prevention**:

- ✅ Ask: "Do these use cases genuinely align long-term?"
- ✅ Document composition decisions in ADRs with use case alignment rationale
- ✅ Accept duplication when use cases are distinct (even if code looks similar now)
- ✅ Remember: What looks like duplication now may not be duplication later as use cases diverge

**Good Composition** (Context Search epic):

- ContextSearchService delegates to WordSearchService for occurrence counting
- ✅ Use cases align: Both need occurrence counts, clusters, chapter detection
- ✅ Shared settings, shared data structures, shared purpose
- ✅ Composition eliminates genuine duplication

**Bad Composition** (Hypothetical):

- Two features both format dates → extract shared DateFormatter
- ❌ Use cases differ: One needs ISO format for API, other needs human-readable for UI
- ❌ Coupling unrelated features through shared formatter
- ❌ When UI formatting changes, API formatting shouldn't be affected

**Fix**: Apply composition only when use cases genuinely align. Document rationale in ADRs.

---

### Guardrails: The ADR-First Process

**Problem**: AI agents rushing to code accumulate architectural debt rapidly

**Solution**: Force the agent to **plan architecturally before writing code**

#### The Process (Proven Effective)

```
1. Iterate on ADR (Multiple Passes)
   ↓
   - First draft: Agent proposes solution
   - Review: Identify anti-patterns (god components, dependency violations, etc.)
   - Iterate: Force agent to address anti-patterns in ADR
   - Approve: Only when architecture is sound

   💡 Token Budget: Spend tokens on planning, save on refactoring

2. Divide into Epic & Sprints
   ↓
   - Agent writes epic overview
   - Agent writes sprint breakdowns
   - Each sprint: scope, tasks, acceptance criteria, branch name
   - Iterate until sprints are clear and achievable

3. Implementation (Per Sprint)
   ↓
   - Agent follows sprint plan (not ad-hoc coding)
   - Agent handles commits, memory bank entries
   - Agent tracks tech debt discovered during implementation
   - Review at PR time (not mid-sprint)

4. Tech Debt Tracking
   ↓
   - Agent documents "pragmatic decisions" in .todo/architecture-debt/
   - Review accumulation after epic
   - Decide: acceptable technical debt or needs cleanup?

5. Architectural Reviews
   ↓
   - After major epics, comprehensive review
   - Identify anti-patterns that slipped through
   - Document as architecture debt for next epic
```

---

### Agent Instructions: Preventing Anti-Patterns

When working on this codebase, AI agents should:

#### Before Writing Code:
1. **Read the ADR** (if it exists) or **draft an ADR** (if architectural change)
2. **Identify potential anti-patterns**:
   - "Am I creating a god component?" (check line counts, responsibility count)
   - "Am I violating dependency inversion?" (check import directions)
   - "Are domain boundaries clear?" (check if logic has obvious "home")
   - "Are use cases clustered?" (check if related operations in same place)
   - "Is this type-safe?" (check for `any`, implicit types)
3. **Revise architecture** in ADR until anti-patterns eliminated
4. **Get approval** before coding

#### During Implementation:
5. **Follow the sprint plan** (don't improvise architecture mid-sprint)
6. **Track tech debt** as you discover it:
   - "I'm duplicating this pattern because extracting it is out of scope"
   - Document in `.todo/architecture-debt/` immediately
   - Continue sprint (don't let debt tracking block progress)
7. **Reference existing patterns**:
   - Use established hooks as templates (usePublishing, useAnalysis)
   - Match naming conventions
   - Mirror domain organization

#### After Implementation:
8. **Review for anti-patterns** before requesting PR
9. **Document debt discovered** during sprint
10. **Update memory bank** with outcomes and lessons learned
    - Use format: `YYYYMMDD-HHMM-descriptive-title.md` (time is REQUIRED)

---

### Case Study: Settings Architecture Refactor

**Epic**: [Unified Settings Architecture](.todo/epics/epic-unified-settings-architecture-2025-11-03/)

**Problem Discovered**: SearchTab settings completely broken (no sync, no persistence, wrong defaults)

**Root Cause**: Two anti-patterns collided:
1. **Pattern Inconsistency**: Publishing Standards used domain hooks, Word Search used messages
2. **Use Case Scattergories**: Settings state in component, sync in handler, no persistence

**ADR-First Process Applied**:
1. ✅ Comprehensive analysis documented in architecture-debt/
2. ✅ ADR written with multiple iterations ([ADR-2025-11-03](docs/adr/2025-11-03-unified-settings-architecture.md))
3. ✅ Epic broken into 5 sprints with clear scope
4. ✅ Phase 0 (critical fix): 2 hours, low risk
5. ✅ Phased approach reduces risk, allows incremental progress

**Outcome** (Planned):
- ✅ Fix critical bug (SearchTab settings work)
- ✅ Eliminate pattern inconsistency (domain hooks everywhere)
- ✅ 100% persistence coverage (29/29 settings)
- ✅ 50% faster to add new settings (backend cleanup)

**Lesson**: Spending 4 hours on ADR/Epic/Sprint planning saves weeks of refactoring later.

---

### Testing Strategy & Token Budget

**Challenge**: Writing comprehensive tests consumes significant tokens

**Strategy** (Token-Disciplined Development):
- **Manual testing** during sprints (checklists in sprint docs)
- **Automated tests** for infrastructure (hooks, message routing)
- **Integration tests** for critical flows (settings sync, persistence)
- **Defer comprehensive test suite** to dedicated sprint (Phase 5)

**Reflection**: Unknown if TDD/TLD would have caught anti-patterns earlier. Test complexity might have revealed architectural issues (complex mocks = bad architecture).

**Recommendation**: For alpha development, manual testing is acceptable. For v1.0+, invest in automated tests.

---

### Summary: AI Agent Success Factors

**What Works**:
1. ✅ ADR-first process (iterate on architecture before coding)
2. ✅ Epic/sprint breakdown (clear scope, small iterations)
3. ✅ Tech debt tracking (acknowledge pragmatic decisions)
4. ✅ Architectural reviews (catch anti-patterns between epics)
5. ✅ Reference implementations (copy proven patterns)
6. ✅ Alpha freedom (break things to fix architecture)

**What Doesn't Work**:
1. ❌ "Just start coding" (accumulates debt rapidly)
2. ❌ Thin code reviews (anti-patterns slip through)
3. ❌ No planning docs (agent improvises badly)
4. ❌ Ignoring tech debt (compounding interest)
5. ❌ Mixing patterns (god components + scattered use cases = disaster)

**Token Budget Advice**:
- Spend tokens on **planning** (ADRs, epics, sprints) → saves tokens on **refactoring**
- Cheap: Iterating on ADR (no code changes)
- Expensive: Refactoring god components after coding

**Architecture Score Before/After Process**:
- Before: ~4/10 (god components, dependency violations, scattered use cases)
- After: **9.8/10** (clean architecture, clear boundaries, proven patterns)

---

### Quick Reference: Anti-Pattern Checklist

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

## What's New

### Recent Architectural Improvements (October - November 2025)

#### Message Envelope Architecture (Oct 28 → Nov 1, 2025) ✅
**Status**: Complete | **PRs**: #12, #13 | **Impact**: Critical architectural refactor

**Achievements**:
- MessageHandler reduced from 1,091 → 495 lines (54% reduction)
- Eliminated switch-based routing (replaced with map-based MessageRouter using Strategy pattern)
- Solved configuration race conditions via echo prevention using source tracking
- Added source tracking to all messages for debugging, audit trails, and domain-specific error handling
- Handlers now own complete message lifecycle
- Strategy pattern for handler registration enables extension without modification

**References**:
- [ADR](docs/adr/2025-10-28-message-envelope-architecture.md)
- [Memory Bank](.memory-bank/20251101-1630-epic-message-envelope-complete.md)

---

#### Presentation Layer Domain Hooks Refactoring (Oct 27, 2025) ✅
**Status**: Complete | **PR**: #13 | **Impact**: Eliminated god component anti-pattern

**Achievements**:
- App.tsx reduced from 697 → 394 lines (43% reduction)
- Extracted 8 domain hooks (useAnalysis, useMetrics, useDictionary, useContext, useSearch, useSettings, usePublishing, useSelection)
- Mirrors backend domain handler organization for cognitive consistency
- Strategy pattern for message routing in webview
- Improved maintainability and testability
- **Architecture Score**: 9.8/10 (from comprehensive review)

**References**:
- [ADR](docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
- [Epic](.todo/archived/epics/epic-presentation-refactor-2025-10-27/)
- [Architectural Review](.memory-bank/20251102-1845-presentation-layer-architectural-review.md)

---

#### Context Window Safety (Nov 2, 2025) ✅
**Status**: Complete | **PR**: #14 | **Impact**: Prevents token limit errors, reduces unexpected API costs

**Achievements**:
- UI word counters with color-coded feedback (green/yellow/red thresholds)
- Backend silent trimming (Context Agent: 50K words, Analysis Agents: 75K words)
- Sentence boundary preservation during trimming
- Output Channel logging for transparency
- Settings toggle: `proseMinion.applyContextWindowTrimming`
- Clean Architecture adherence (UI feedback vs backend trimming separation)

**References**:
- [ADR](docs/adr/2025-11-02-context-window-trim-limits.md)
- [Epic](.todo/archived/epics/epic-context-window-safety-2025-11-02/)
- [Memory Bank](.memory-bank/20251102-1620-context-window-safety-sprint-complete.md)

---

#### Clickable Resource Pills (Nov 2, 2025) ✅
**Status**: Complete | **PR**: #15 | **Impact**: UX improvement for context navigation

**Achievements**:
- Resource pills in Context Assistant now clickable
- Opens referenced files in VSCode editor
- Smart column selection (prevents excessive editor splits)
- Matches existing guide pill interaction pattern
- Error handling for non-existent resources

**References**:
- [ADR](docs/adr/2025-11-02-clickable-resource-pills.md)
- [Epic](.todo/archived/epics/epic-clickable-resource-pills-2025-11-02/)
- [Memory Bank](.memory-bank/20251102-1530-clickable-resource-pills.md)

---

#### Word Length Filter for Metrics (Nov 2, 2025) ✅
**Status**: Complete | **PR**: #17 | **Impact**: Better metrics discovery (filter out noise)

**Achievements**:
- Tab-based filter UI (1+, 2+, 3+, 4+, 5+, 6+ characters)
- Backend filtering (not UI-only)
- Segregated component architecture
- Settings integration (`proseMinion.wordFrequency.minLength`)
- Persistent across sessions

**References**:
- [ADR](docs/adr/2025-11-02-word-length-filter-metrics.md)
- [Epic](.todo/archived/epics/epic-word-length-filter-metrics-2025-11-02/)

---

#### Secure API Key Storage via SecretStorage (Oct 27, 2025) ✅
**Status**: Complete | **PR**: #11 | **Impact**: Security improvement with OS-level encryption

**Achievements**:
- Migrated from plain-text settings to OS-level encrypted SecretStorage
- Platform keychains: macOS Keychain, Windows Credential Manager, Linux libsecret
- Automatic one-time migration from legacy `proseMinion.openRouterApiKey` setting
- Custom UI in Settings overlay (password-masked input, Save/Clear buttons)
- Keys never appear in settings files or sync to cloud

**References**:
- [ADR](docs/adr/2025-10-27-secure-api-key-storage.md)
- [Epic](.todo/archived/epics/epic-secure-storage-2025-10-27/)

---

#### Verbalized Sampling for Creative Diversity (Oct 26, 2025) ✅
**Status**: Complete | **PR**: #4 | **Impact**: More diverse, creative AI suggestions

**Achievements**:
- Enhanced dialogue microbeat and prose assistant prompts
- Research-backed sampling techniques (Stanford/Northeastern/WVU)
- 1.6–2.1× more creative range
- Fresher microbeats, richer wordbanks

**References**:
- [ADR](docs/adr/2025-10-26-verbalized-sampling.md)
- [Epic](.todo/archived/epics/epic-verbalized-sampling-2025-10-26/)

---

### Earlier Features

- **Domain-Organized Message Architecture** (Oct 2025): Complete refactor of messaging layer for better maintainability
  - Message contracts split from single `messages.ts` (532 lines) into 11 domain-specific files (674 lines total)
  - 10 domain handlers extract feature-specific logic into focused, testable modules
  - Backward compatible via barrel export at `src/shared/types/messages/index.ts`
  - See [ADR](docs/adr/2025-10-26-message-architecture-organization.md)

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
