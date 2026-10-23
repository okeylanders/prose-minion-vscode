# Agents Guide for Prose Minion VSCode Extension

This document provides guidance for AI agents (like Claude) working with the Prose Minion VSCode extension codebase.

## Project Overview

Prose Minion is a VSCode extension that provides AI-powered prose analysis and writing assistance for creative writers. It uses OpenRouter API to access various LLMs for analyzing dialogue, prose, and providing writing metrics.

## Monorepo Layout (Ports & Adapters)

**As of [ADR 2026-06-16](docs/adr/2026-06-16-monorepo-ports-and-adapters.md), the project is an npm-workspaces monorepo split into a host-agnostic core and a thin VS Code adapter:**

```
prose-minion-vscode/
├── packages/core/          # Host-AGNOSTIC engine. ZERO `vscode` imports.
│   ├── src/                # All domain/application/infrastructure/presentation logic
│   ├── resources/          # system-prompts/ + craft-guides/
│   └── tsconfig.json + tsconfig.webview.json
└── apps/vscode-extension/  # The VS Code ADAPTER + composition root
    └── src/
        ├── extension.ts                      # Composition root: builds services + Platform, injects inward
        ├── application/providers/             # ProseToolsViewProvider (webview shell)
        └── platform/vscode/                   # VS Code implementations of the Platform ports
```

**The two rules that define this architecture:**
- **`packages/core` never imports `vscode`.** It depends only on the `Platform` ports (`packages/core/src/platform/`: `LogSink`, `SecretStore`, `SettingsStore`, `FileSystem`, `Workspace`, `ShellService`, `EditorContext`). A non-VS-Code host (e.g. a console app) can reuse core by implementing these ports. **Verify before adding host-coupled code: no `from 'vscode'` in `packages/core/src`.**
- **`apps/vscode-extension` is the only composition root.** `extension.ts` constructs concrete services + the VS Code Platform implementations and threads them inward. The app imports core *only* through the `@prose-minion/core` barrel (enforced via `eslint no-restricted-imports`); core never imports the app.

`extension.ts` builds a typed `CoreServices` bundle alongside `Platform`.
`ProseToolsViewProvider` threads both bundles into `MessageHandler`, which wires
domain handlers and lifecycle callbacks but does not construct infrastructure.
This single-composition-root invariant is guarded by architecture and assembly
tests. See [ADR 2026-06-18: MessageHandler Composition-Root Consolidation](docs/adr/2026-06-18-messagehandler-composition-root-consolidation.md).

## Architecture (`packages/core/src`)

The core follows **Clean Architecture** principles with clear separation of concerns:

```
packages/core/src/
├── platform/           # Ports the host must implement (LogSink, SecretStore, FileSystem, …)
├── application/        # Application layer (orchestration)
│   ├── services/       # Cross-domain application services (e.g. StandardsComparisonService)
│   │   └── lightbox/LightboxBoardLibrary.ts # When Lightbox boards save, open as snapshots, restore after a reload, list and delete (Slice 5A); names and spark marks in place through LightboxBoardEdits (Slice 5A.1)
│   └── handlers/       # Message routing and domain handlers
│       ├── MessageHandler.ts    # Main dispatcher (routes messages)
│       ├── MessageHandlerContracts.ts # CoreServices + typed transport/cache/secrets seams
│       ├── MessageRouter.ts     # Strategy registry (MessageType → handler)
│       └── domain/              # 12 flat domains + the Workshop feature family
│           ├── AnalysisHandler.ts
│           ├── DictionaryHandler.ts
│           ├── ContextHandler.ts
│           ├── MetricsHandler.ts
│           ├── SearchHandler.ts
│           ├── ConfigurationHandler.ts
│           ├── PublishingHandler.ts
│           ├── SourcesHandler.ts
│           ├── UIHandler.ts
│           ├── FileOperationsHandler.ts
│           ├── AccountBalanceHandler.ts   # OpenRouter account-balance slice
│           ├── LightboxHandler.ts         # Lightbox board: source, refusal, LIGHTBOX_* routes (ADR 2026-10-19)
│           ├── LightboxHandoffRoute.ts    # Its handoffs to the Workshop (Build as a lens, Bring to Workshop) and the Workshop tray
│           ├── LightboxReadingHandler.ts  # Lightbox readings: lenses, estimate, runs, context files, spark set-aside
│           ├── LightboxPressRun.ts        # A press's run listener and landing, and group F's digest port by board id (Slice 4D)
│           ├── LightboxProjectFiles.ts    # The shared project picker's catalog, search and key → workspace file (text only, contained)
│           ├── LightboxContextIntake.ts   # Context files by the system picker or the project picker, under the shelf's rules
│           ├── LightboxPassageHandler.ts  # The inspector's passages: a pinned paragraph's text, a counted item's sentences, by board id and hash (Slice 4E)
│           ├── LightboxBoardsHandler.ts   # The rail's saved boards: shelf, open, delete, rename (5A.1), and each committed save pushed (Slice 5A)
│           └── workshop/                  # Room owner + 12 composed route owners
│               ├── WorkshopRoomHandler.ts # Room/run orchestrator + session-state envelope
│               ├── WorkshopSliceComposition.ts # Sibling construction + guarded route assembly
│               ├── WorkshopRouteContracts.ts
│               ├── WorkshopContextHandler.ts
│               ├── WorkshopExcerptScopeHandler.ts
│               ├── WorkshopSessionMessageHandler.ts
│               ├── WorkshopSessionExportHandler.ts   # Read-only transcript export
│               ├── WorkshopStandingDirectiveHandler.ts
│               ├── WorkshopTodoHandler.ts
│               ├── WorkshopLightboxTileHandler.ts # A Lightbox tile offered, then staged above the composer (seed kind `lightbox-tile`)
│               └── widgets/
│                   ├── WorkshopWidgetHostHandler.ts
│                   ├── creativeVariations/WorkshopCreativeVariationsHandler.ts
│                   ├── gesturePlayground/WorkshopGesturePlaygroundHandler.ts
│                   ├── lexicalGravity/WorkshopLexicalGravityHandler.ts
│                   └── showVsTell/WorkshopShowVsTellHandler.ts
├── domain/            # Domain layer (business logic)
│   └── models/        # Domain models and entities
├── infrastructure/    # Infrastructure layer (external integrations)
│   ├── api/           # OpenRouter API: providers/ orchestration/ parsers/ services/; parsers/ModelJsonRepair.ts reads a model's JSON with a structure-only repair under a content guard, and salvages a reply cut off at its ceiling (Lightbox Slice 4H; feature-agnostic, imports nothing)
│   ├── account/       # OpenRouter account-balance client + service
│   ├── lightbox/      # Lightbox paragraph model, measured set, LightboxService (boards kept in memory); readings: prompts, codec (+ gravity/palette, story and craft blocks), quote verifier, dialogue anchor, spark phrasing, sentence pairs (handoff adjacency), term and field counts, runner, estimate, press snapshot, call-failure categories, stale carry-over (+ craft quotes), spark lane, handoff checks (field and tile); the numbers (standouts, instance filters) and the writer's baseline (Slice 4B); group E's plot codec, gates, tiles, carry and handoff points, and the Sections detector (Slice 4C); group F's Opinion: wire, codec, text rules, gates, the board's digest, reply, call and handoff (Slice 4D); the inspector's passages: instance finders by each figure's own rule, the board's text kept beside it, passages cut from it (Slice 4E); group G's craft steering: the measure (counts, splits, short runs, constructions), wire, text rules, codec, tiles with the example's anchor, and Bring's points (Slice 4F); where a steering note's instance stands, dialogue being voice (Slice 4G); each paragraph's instances and dialogue spans, indexed once per text (PR #162); context shelf and opaque file keys; the boards the service keeps (`LightboxRetainedBoards`), a board's assembly and a saved board's rebuilt parts, the source key, and the rule ids a board records (Slice 5A)
│   ├── context/ guides/ secrets/ standards/ storage/ text/   # storage/ holds the saved Lightbox board's codec (format 1, by layer), its files (one folder per source, read whole) and store (Slice 5A; PR #163), its rewrites in place under a claim (Slice 5A.1), and its claims, live or abandoned by age (PR #164)
├── presentation/      # Presentation layer (UI)
│   └── webview/      # React components + domain hooks for the webview
├── tools/            # Assist + Measure tools (assist/ measure/ shared/ utility/)
├── utils/            # Shared helpers
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
            ├── accountBalance.ts # OpenRouter account balance
            ├── configuredResources.ts # The configured-resource catalog shapes the shared project picker browses (Workshop and Lightbox)
            ├── lightboxBarrel.ts # The Lightbox domain's own barrel (every lightbox*.ts below) and its parts of the routing unions; index.ts re-exports it (Slice 5A.1)
            ├── lightbox.ts       # Lightbox board, source, refusal, tile kinds
            ├── lightboxReadings.ts # Lightbox reading tiles, groups, lenses and the estimate's shapes
            ├── lightboxRuns.ts   # Lightbox run messages: scope, phases, progress, set lenses, estimate answer, run, cancel, group result
            ├── lightboxGravity.ts  # Lexical gravity and palette tiles (fields, collisions, set-asides, clusters, swatches)
            ├── lightboxStoryTiles.ts # Lineage, subtext and spark tiles; spark set-aside request
            ├── lightboxCraftTiles.ts # Group D tiles: tier mix, signature, familiar phrase, air-lock, echo, endings, handoff, number usage
            ├── lightboxNumbers.ts  # The measured numbers: rows, standouts, the writer's baseline summary, sentence summary
            ├── lightboxPlotTiles.ts # Group E tiles: template (freshness, engagement by movement tile id), template beat, pressure thread, artifact, synopsis, movement
            ├── lightboxSections.ts # The measured Sections lane: signal, sections, and where each signal fired
            ├── lightboxOpinion.ts  # Group F's Opinion tile: observations and their cites, three views, what was withheld, the digest it read
            ├── lightboxSteering.ts # Group G's craft steering: the measure per figure, the reading and instance-note tiles, stance, nudge, the one example
            ├── lightboxContextFiles.ts # Lightbox context files and their messages
            ├── lightboxEstimate.ts # Fit and per-call/run estimates
            ├── lightboxHandoff.ts  # LIGHTBOX_HAND_OFF (a field or a tile, by id), its result, and the Workshop tray
            ├── lightboxProjectFiles.ts # The project picker's catalog (rows with opaque file keys) and search, correlated by request id; a source or context by catalog key
            ├── lightboxPassages.ts # The inspector's passages (Slice 4E): a paragraph's text or a term's sentences, by request id, board id and hash; refusals
            ├── lightboxBoards.ts  # Saved boards (Slice 5A): the rail's shelf (availability, summaries, snapshot state; 5A.1: names and models), open, delete, rename, by request id
            ├── sources.ts        # File/glob operations
            ├── ui.ts            # Tab changes, selections, guides
            ├── results.ts       # Result messages
            └── workshop/        # Workshop contracts behind one subdomain barrel
                ├── index.ts
                ├── session.ts
                ├── context.ts
                ├── participants.ts
                ├── widgets.ts
                ├── standingDirectives.ts
                ├── creativeVariations.ts
                ├── gesturePlayground.ts
                ├── lexicalGravity.ts
                ├── showVsTell.ts
                ├── recovery.ts
                ├── seedDelivery.ts
                ├── lightboxTiles.ts
                └── settings.ts
```

### Presentation Hooks (Webview)

The presentation layer now mirrors backend domain organization via custom React hooks. App.tsx is a thin orchestrator that composes hooks, routes messages, and persists state.

Structure:

```
packages/core/src/presentation/webview/
├── hooks/
│   ├── useVSCodeApi.ts         # acquireVsCodeApi() wrapper (singleton via ref)
│   ├── usePersistence.ts       # Compose domain persisted state into vscode.setState
│   ├── useMessageRouter.ts     # Strategy: MessageType → handler; stable listener
│   ├── useAppMessageRouter.ts  # Pure buildAppMessageRoutes() map (extracted from App.tsx)
│   ├── fulltab/
│   │   └── useFullTabChrome.ts # Generic full-tab chrome state + buildFullTabChromeRoutes (Workshop, Lightbox)
│   └── domain/
│       ├── useAccountBalance.ts        # OpenRouter account balance (ephemeral; empty persistedState)
│       ├── useThemeSettings.ts         # Sidebar palette (follow-vscode default)
│       ├── useAnalysis.ts              # Analysis results, guides, status ticker
│       ├── useContext.ts               # Context text, requested resources, loading/status
│       ├── useContextPathsSettings.ts  # Context paths configuration
│       ├── useDictionary.ts            # Word/context state and tool name
│       ├── useDictionaryHistory.ts     # Lookup history: host summaries, ‹ › cursor, draft slot (ADR 2026-10-14)
│       ├── useMetrics.ts               # Per-subtool cache; source mode/path helpers
│       ├── useModelsSettings.ts        # Model selection settings
│       ├── usePublishingSettings.ts    # Publishing presets and trim size
│       ├── useSearch.ts                # Search results and targets
│       ├── useSelection.ts             # Selected text + source metadata
│       ├── useSettings.ts              # Overlay state, API key management
│       ├── useTokensSettings.ts        # Max tokens configuration
│       ├── useTokenTracking.ts         # Token usage tracking
│       ├── useWordFrequencySettings.ts # Word frequency tool settings
│       ├── useWordSearchSettings.ts    # Word search tool settings
│       ├── useLightbox.ts              # Lightbox board, refusal, estimate, run and context; persists UI prefs only (filter, pin, lenses)
│       ├── lightbox/
│       │   ├── lightboxItems.ts        # Hoverable/pinnable item refs → paragraphs (pure); a paragraph may carry the term it was reached from (`via`)
│       │   ├── lightboxTerms.ts        # Counted terms as items: top word, part of speech, phrase, hapax word, style flag (pure; Slice 4E)
│       │   ├── lightboxPassages.ts     # The inspector's wells as drawn: what a pin asks for, waiting, changed text, bounds, refusals (pure; Slice 4E)
│       │   ├── lightboxReadings.ts     # Lens views, tallies, withheld-quote wording, group merges (pure)
│       │   ├── lightboxRunLine.ts      # The Read press's states, cost and reason (pure)
│       │   ├── lightboxRuns.ts         # Each board's run and progress, by token; Stop from the board's own run (pure)
│       │   ├── lightboxGravity.ts      # Orbit placements, pull/drift/degree wording (pure)
│       │   ├── lightboxHandoff.ts      # "Build as a lens" view and request; handoff state matching (pure)
│       │   ├── lightboxBring.ts        # "Bring to Workshop" view and request; Bound from the Workshop tray (pure)
│       │   ├── lightboxSparks.ts       # The spark lane: shown and set aside (pure)
│       │   ├── lightboxCraft.ts        # Group D as drawn: tier shares, endings tally and lane, sentence columns, number bars (pure)
│       │   ├── lightboxPlot.ts         # Group E as drawn: Sections note and bands, movement/pressure/engagement lanes, thread tracks, inspector details (pure)
│       │   ├── lightboxOpinion.ts      # The Opinion as drawn: view tabs, Why rows, observations and what changed, Bring block, inspector details (pure)
│       │   ├── lightboxSteering.ts     # Craft steering as drawn: figure sections and construction shares, the `steering` item ref, inspector details (pure)
│       │   ├── lightboxBoardsView.ts   # The rail's Boards section in words: dates, lenses, stale, cost, the snapshot note, session-only (pure; Slice 5A); names, models, the head, the notice above the board (5A.1)
│       │   └── controllers/            # useLightboxFocus (ribbon focus), useLightboxInspector (pinned item), useLightboxEscape, useLightboxOpinionView (the view chosen per board)
│       ├── useLightboxHandoff.ts       # Handoffs as the webview asks for them, the Workshop tray, Open Workshop
│       ├── useLightboxProjectFiles.ts  # The project picker: which one is open (source, context), its catalog, search, and choices by key
│       ├── useLightboxBoards.ts        # The rail's saved boards: the shelf of the board on screen by request id, Open, Delete, Rename (5A.1); persists nothing (Slice 5A)
│       ├── useLightboxPassages.ts      # The inspector's passages: one request per pin, board and text; takes only the pending answer; persists nothing (Slice 4E)
│       └── workshop/
│           ├── useWorkshopRoom.ts      # Room/thread/context/stream state
│           ├── useWorkshopSessions.ts  # Named-session lifecycle
│           ├── useWorkshopWidgetHost.ts
│           ├── useWorkshopStandingDirectives.ts
│           ├── useWorkshopSeedReceiver.ts  # This mount's seed receiver id, announced once listening (PR #150 F-08)
│           ├── useWorkshopSeedClaim.ts     # Hold, claim and answer a handed-over seed, per kind
│           ├── useWorkshopLightboxTiles.ts # A Lightbox tile: claim, accept after the grant, answer
│           ├── controllers/            # Transient modal/surface state machines
│           │   ├── creativeVariations/useCreativeVariationsAuthoring.ts
│           │   └── showVsTell/         # useShowVsTellAuthoring, Intake, CommitFlow, InvalidationWatch
│           └── widgets/                # Named feature transport/correlation hooks
│               ├── creativeVariations/useCreativeVariations.ts
│               ├── showVsTell/useShowVsTell.ts
│               ├── useGesturePlayground.ts
│               └── useLexicalGravity.ts
```

Patterns and conventions:
- Strategy routing: `useMessageRouter({ [MessageType.X]: handler })` with a ref to maintain a stable event listener.
- Persistence: Each hook exposes `persistedState`; App composes them into `usePersistence` to sync `vscode.setState`.
- Full-tab shell: editor-tab roots (`WorkshopApp`, `LightboxApp`) render through
  `components/fulltab/FullTabShell` (brand, header actions, banners, rail, main,
  optional aside) and take generic chrome state and routes from
  `useFullTabChrome`. Shared frame styles live in `styles/fulltab/`, scoped to
  `[data-pm-frame="fulltab"]` and imported first from `index.tsx`; a tab's own
  styles stay under its `[data-pm-surface="…"]`. Surfaces are an exhaustive
  `Record<WebviewSurface, …>` map in `index.tsx` and `webviewHtml.ts`. A tab
  with an aside (the Lightbox inspector) gets `.pm-ws-with-aside` on the frame
  root: at 1240px and below the tab scrolls as one page with the aside under
  the rail, and at 760px everything stacks. See
  [ADR 2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md) D1–D2.
- Shared project picker: "Choose from project" is one component,
  `components/fulltab/ProjectResourcePickerModal`, with
  `ProjectResourceAttachFooter` for attach mode. The Workshop's
  `WorkshopContextSelectorModal` and the Lightbox's `LightboxProjectPicker`
  are thin wrappers that give it copy, footers and callbacks.
  - It posts nothing and names no route. Each tab keeps its own routes and
    names files by catalog key (`ConfiguredResourceRef`, `{ group, path }`),
    never a path or URI.
  - Its rules, and the modal chrome's (`WorkshopModalShell`), are the
    frame's, in `styles/fulltab/modal.css`.
  - The Workshop's behavior is pinned by `WorkshopContextSelectorParity` and
    `WorkshopApp.contextSelectorParity`, recorded against the original modal.
    A change to the shared picker that alters the Workshop fails them; update
    them only with a deliberate Workshop change.
  - `boundaries.test.ts` pins its imports.
  - The Lightbox's routes add two rules the Workshop's do not have (PR #154).
    Each catalog and search request carries a webview-minted `requestId`
    the host echoes, and `useLightboxProjectFiles` takes only the answer it
    still waits for. Catalog rows and context-shelf files carry `fileKey`
    (`LightboxFileKey`, a session-keyed HMAC of the absolute path), and
    "attached" compares keys, never display paths.
- Workshop ownership: `useWorkshopRoom` and `useWorkshopSessions` replace the
  retired `useWorkshop` facade. Generic widget mechanics use explicit closed
  registries; Gesture Playground, Creative Variations, Lexical Gravity, and Show
  vs. Tell keep feature-specific contracts, handlers, codecs, prompts, and
  presentation hooks in named slices. Show vs. Tell's five-position → Controller
  mapping lives only in `shared/constants/narrativeHandlingVocabulary.ts`.
- Message enums: Use `STATUS` for status messages, `MODEL_DATA`/`REQUEST_MODEL_DATA` for model options, and `SET_MODEL_SELECTION` for user selection. Avoid ad-hoc enums like `STATUS_MESSAGE`, `MODEL_OPTIONS_DATA`, or `SET_MODEL`.
- UI settings: Toggle UI prefs (e.g., token widget) via `UPDATE_SETTING` with nested keys like `ui.showTokenWidget`.
- Metrics: Provide `setPathText` and `clearSubtoolResult` so subtools can refresh independently.
- **useEffect extraction**: Extract inline useEffect logic to named methods wrapped in `useCallback` for testability, reusability, and clarity. Use semantic naming: `request*` (data fetching), `sync*` (synchronization), `clear*When*` (conditional state updates), `initialize*` (initialization), `validate*` (validation). See [Architecture Debt: useEffect Extraction Pattern](.todo/archive/tech-debt/2025-11-05-useeffect-extraction-pattern.md).

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
| useDictionaryHistory | DictionaryHandler (+ `DictionaryHistoryStore`) | Dictionary lookup history |
| useContext | ContextHandler | Context generation |
| useSearch | SearchHandler | Word search |
| useSettings | ConfigurationHandler | Settings, models, API keys |
| usePublishing | PublishingHandler | Publishing standards |
| useSelection | UIHandler | Selection/paste operations |
| useAccountBalance | AccountBalanceHandler | OpenRouter account balance |
| useLightbox | LightboxHandler, LightboxReadingHandler (+ `LightboxService`, `LightboxReadingRunner`) | Lightbox counted board and readings |
| useLightboxHandoff | LightboxHandoffRoute (in LightboxHandler) | Lightbox handoffs to the Workshop and its tray |
| useLightboxProjectFiles | LightboxHandler (catalog, search, source) and LightboxReadingHandler (context), through `LightboxProjectFiles` | The Lightbox's project picker |
| useLightboxPassages | LightboxPassageHandler (+ `LightboxService.passageSource`) | The inspector's passages: a paragraph's text, a counted item's sentences |
| useWorkshopLightboxTiles | WorkshopLightboxTileHandler | A Lightbox tile staged in the Workshop |

**Benefits**:
- ✅ Same domain boundaries on both sides
- ✅ Easier to trace message flows
- ✅ Consistent naming conventions
- ✅ Reduced context switching when working across layers

#### 4. Tripartite Hook Interface Pattern
**Location**: All domain hooks in `packages/core/src/presentation/webview/hooks/domain/`
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

**Presentation controllers** are UI state machines under a domain's
`controllers/` directory. They still honor the tripartite interface, including
an explicit empty `Persistence` contract when the host owns durable truth.
Unlike transport-owning domain hooks, controllers receive host effects as
injected callbacks or narrow ports; they must not reference `useVSCodeApi`,
`MessageType`, or `postMessage` directly.

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
**Location**: `packages/core/src/presentation/webview/hooks/`
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

1. **Extension Entry Point** ([extension.ts](apps/vscode-extension/src/extension.ts)) — *the composition root*
   - Initializes the extension
   - Constructs concrete services as `CoreServices` + the VS Code `Platform` implementations
   - Injects them inward; registers commands and providers

2. **Webview Provider** ([ProseToolsViewProvider.ts](apps/vscode-extension/src/application/providers/ProseToolsViewProvider.ts))
   - Manages the webview lifecycle (a thin shell — passes injected services through to `MessageHandler`)
   - Handles communication between extension and React UI
   - Routes messages to appropriate tools

3. **Analysis Tools** (packages/core/src/tools/)
   - **Assist Tools**: AI-powered analysis tools
     - `dialogueMicrobeatAssistant`: Analyzes dialogue and suggests tags/action beats
     - `proseAssistant`: General prose analysis and improvement suggestions
   - **Measure Tools**: Statistical analysis tools
     - `passageProseStats`: Word count, sentence analysis, pacing metrics; its vocabulary tokenizer is exported (`proseStatsWords`), so the Lightbox's hapax list is exactly the stats row's count
     - `styleFlags`: Identifies style patterns and issues; its adverb, passive-voice, filler and weak-verb detectors are exported, with offsets, so the Lightbox's numbers and its sentence wells count by the same rules
     - `beingVerbs`: The forms of "be", whole and contracted (the Lightbox's being-verbs figure; epic decision 26): I'm, 're, 's where the word-frequency tagger reads a verb, or reads a possessive the next word makes *is* (an adjective, -ing word, adverb, preposition or determiner: "Tobin's late"), and it is not *has* (been, got, gotten or had follow), isn't, aren't, wasn't, weren't, ain't, 'tis, 'twas and 'twere; never a possessive 's before a noun, name or pronoun, let's, 'd, 'll or 've. Every reader (rate, numbers row, writer's average, steering totals, quote check) calls `findBeingVerbs`, so they agree; "he's gone" counts as *is*, the stated limit
     - `wordFrequency`: Word usage patterns, Top 100, stopwords, hapax (list), POS via wink (its tagged occurrences carry each token's offset and length), bigrams/trigrams, length histogram, optional lemmas; `tagTextTokens` gives each token's tag and offset (the Lightbox's craft steering sorts instances by construction with it)

4. **OpenRouter Integration** ([OpenRouterClient.ts](packages/core/src/infrastructure/api/providers/OpenRouterClient.ts))
   - HTTP client for OpenRouter API
   - Reads the API key host-side from SecretStorage (via the `SecretStore` port)
   - Supports multiple AI models (Claude, GPT-4, Gemini)
   - Instantiated per model scope (assistant, dictionary, context)

5. **Prompt System** ([prompts.ts](packages/core/src/tools/shared/prompts.ts))
   - Loads system prompts from `packages/core/resources/system-prompts/`
   - Each tool has its own prompt directory with numbered markdown files
   - Prompts define the AI's behavior and instructions

6. **Craft Guides** ([guides.ts](packages/core/src/tools/shared/guides.ts))
   - Optional writing craft guides from `packages/core/resources/craft-guides/`
   - Provides examples and best practices to the AI
   - Can be toggled via settings

## Working with This Codebase

### Common Tasks

#### Adding a New Analysis Tool

1. **Define message types**: Add to appropriate domain file in `packages/core/src/shared/types/messages/` (or create a new one)
   - Add message interface extending `BaseMessage`
   - Add to `MessageType` enum in `base.ts`
   - Export from `index.ts` barrel export

2. **Add domain handler** (if new domain):
   - Create new handler in `packages/core/src/application/handlers/domain/`
   - Inject dependencies via constructor (service, helper methods)
   - Type `postMessage` as `MessageTransport` — never `any`
   - Require `outputChannel: LogSink` (every sibling does; don't make it optional)
   - Implement handler methods for the domain

3. **Create service** (if needed):
   - Create new service in `packages/core/src/infrastructure/api/services/` under appropriate subdirectory:
     - `analysis/` - Analysis tools (AssistantToolService, ContextAssistantService)
     - `dictionary/` - Dictionary services (DictionaryService)
     - `measurement/` - Metrics services (ProseStatsService, StyleFlagsService, WordFrequencyService)
     - `search/` - Search services (WordSearchService)
     - `resources/` - Resource management (AIResourceManager, StandardsService)
   - Follow Single Responsibility Principle (one clear purpose)
   - Keep services focused (< 500 lines)
   - Inject dependencies via constructor
   - If extending existing functionality, add method to existing service instead

4. **Wire it up at the composition root**:
   - Construct any new service(s) in `apps/vscode-extension/src/extension.ts` and add them to `CoreServices` — do **not** `new` infrastructure inside `MessageHandler` (see [ADR 2026-06-18](docs/adr/2026-06-18-messagehandler-composition-root-consolidation.md))
   - In `MessageHandler`, instantiate the domain handler with its injected services and call its `registerRoutes()`
   - Bind any handler-method callbacks (status emitters, listeners) post-construction, per the `setStatusEmitter` pattern

5. **Create system prompts** in `packages/core/resources/system-prompts/[tool-name]/`

6. **Add UI components** in `packages/core/src/presentation/webview/components/`

7. **Create corresponding domain hook** in `packages/core/src/presentation/webview/hooks/domain/`
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

**Reference Implementation**: See `usePublishingSettings.ts` for clean example.

#### Modifying AI Behavior

1. Edit system prompts in `packages/core/resources/system-prompts/`
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

Message contracts live in `packages/core/src/shared/types/messages/` organized by domain:

```plaintext
packages/core/src/shared/types/messages/
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
├── results.ts           # Save/copy result messages
└── streaming.ts         # Streaming response messages
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

All aliases now re-root into `packages/core/src`. The single source of truth for the path table is **`tsconfig.base.json`** ([ADR 2026-06-16](docs/adr/2026-06-16-monorepo-ports-and-adapters.md)); per-TS-5.x rules, `paths` resolve relative to that file regardless of which leaf config extends it.

| Alias | Resolves To | Used In |
|-------|-------------|---------|
| `@prose-minion/core` | `packages/core/src/index.ts` | The app's ONLY entry into core (barrel) |
| `@messages` | `packages/core/src/shared/types/messages/index.ts` | Both (barrel import) |
| `@messages/*` | `packages/core/src/shared/types/messages/*` | Both (specific files) |
| `@shared/*` | `packages/core/src/shared/*` | Both |
| `@handlers/*` | `packages/core/src/application/handlers/*` | Core (backend) |
| `@services/*` | `packages/core/src/infrastructure/api/services/*` | Core (backend) |
| `@providers/*` | `packages/core/src/infrastructure/api/providers/*` | Both |
| `@orchestration/*` | `packages/core/src/infrastructure/api/orchestration/*` | Core (backend) |
| `@parsers/*` | `packages/core/src/infrastructure/api/parsers/*` | Core (backend) |
| `@standards` | `packages/core/src/infrastructure/standards` | Core (backend) |
| `@secrets` | `packages/core/src/infrastructure/secrets` | Core (backend) |
| `@components/*` | `packages/core/src/presentation/webview/components/*` | Webview |
| `@hooks/*` | `packages/core/src/presentation/webview/hooks/*` | Webview |
| `@utils/*` | `packages/core/src/presentation/webview/utils/*` | Webview |
| `@formatters` | `packages/core/src/presentation/webview/utils/formatters` | Webview |
| `@formatters/*` | `packages/core/src/presentation/webview/utils/formatters/*` | Webview |
| `@/*` | `packages/core/src/*` | Both (universal fallback) |

**Configuration Files:**

- `tsconfig.base.json` - **Single source of truth** for the alias `paths` table (shared by all packages)
- `packages/core/tsconfig.json` - Core (backend) type resolution
- `packages/core/tsconfig.webview.json` - Webview type resolution (DOM/JSX libs)
- `apps/vscode-extension/tsconfig.json` - Adapter type resolution
- `tsconfig.test.json` / `jest.config.js` - Test resolution (single-root jest across the workspace)

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

- [apps/vscode-extension/package.json](apps/vscode-extension/package.json) - Extension manifest and configuration (`contributes.*`)
- [extension.ts](apps/vscode-extension/src/extension.ts) - Composition root: activation, service construction, DI
- [MessageHandler.ts](packages/core/src/application/handlers/MessageHandler.ts) - Main message dispatcher (routes to domain handlers)
- [packages/core/src/application/handlers/domain/](packages/core/src/application/handlers/domain/) - 12 flat domain handlers plus the `handlers/domain/workshop/` feature family
- [packages/core/src/platform/](packages/core/src/platform/) - The host ports a non-VS-Code app must implement
- [packages/core/src/shared/types/messages/](packages/core/src/shared/types/messages/) - Message contracts by domain; Workshop is split under `shared/types/messages/workshop/` while consumers keep importing from the `@messages` barrel
- [OpenRouterModels.ts](packages/core/src/infrastructure/api/providers/OpenRouterModels.ts) - Available AI models
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
| `.todo/features/` | Active standalone feature ideas; one folder per feature so screenshots/docs can live nearby |
| `.todo/tech-debt/` | Tracked technical debt for future resolution |
| `.todo/archive/` | Completed or superseded epics, features, specs, and tech debt |
| `.memory-bank/` | Session continuity snapshots (format: `YYYYMMDD-HHMM-title.md`) |

### Development Flow

```
1. ADR → 2. Epic → 3. Sprint → 4. Implement → 5. PR → 6. Archive
```

**ADR-First**: For architectural changes, create ADR in `docs/adr/YYYY-MM-DD-title.md` BEFORE coding. Iterate until architecture is sound.

**Branching**: `sprint/<epic-slug>-<NN>-<sprint-slug>` (e.g., `sprint/epic-message-envelope-01-structure`)

### `.todo` Work Tracking

Use `.todo` as the source of truth for active planned work. Pick the smallest
honest container:

- **Epic**: `.todo/epics/epic-short-name-YYYY-MM-DD/` for multi-sprint or
  architecture-heavy work.
- **Feature**: `.todo/features/feature-short-name/` for standalone product or UX
  work. Features are folders by default so they can accumulate screenshots,
  mockups, notes, fixtures, and supporting docs.
- **Tech debt**: `.todo/tech-debt/YYYY-MM-DD-short-name.md` for focused cleanup
  or maintenance concerns. Use a folder only when the item needs supporting
  artifacts.

Every new item should state status, priority, problem/motivation, related files,
and completion criteria. If you discover out-of-scope work while implementing,
capture it in `.todo` and continue unless it blocks the current task.

Archive completed or superseded work under `.todo/archive/` only after any live
follow-ups have been split into new `.todo` entries. For large folders, add an
`ARCHIVE.md` or top-level README note with the archive date, release/PR, summary,
and links to follow-up items.

### Architecture Debt

When you discover issues out of scope for current work:

1. Create `.todo/tech-debt/YYYY-MM-DD-issue-name.md`
2. Assign priority (High/Medium/Low)
3. Reference in sprint completion notes
4. Continue sprint - don't let debt tracking block progress

### Memory Bank

Use `.memory-bank/YYYYMMDD-HHMM-short-title.md` for session continuity and
completion records. Create or update a memory-bank entry when:

- A release is prepared or completed.
- An epic, major feature, or large archive pass completes.
- An architecture change lands.
- A debugging session uncovers context that would be expensive to reconstruct.
- Work pauses with important state, decisions, or verification results.

Memory-bank entries should record facts, decisions, verification run, known
follow-up work, and links to `.todo`, ADRs, PR reviews, or release docs. Do not
hide active work in memory-bank; active tasks belong in `.todo`.

## Testing and Development

### Automated Testing Framework

The project uses **Jest** with **ts-jest** for automated testing. Tests follow an **Infrastructure-First Lightweight Testing** approach focusing on protecting core architectural patterns and business logic.

**Test Organization** (single-root jest; `testMatch` is `**/__tests__/**/*.test.ts(x)`):
```
packages/core/src/__tests__/   # All tests in a separate dir mirroring the source tree
├── setup.ts           # VSCode API mocks and global test setup
├── architecture/      # Boundary/contract guards (e.g. boundaries.test.ts, showVsTellWitnesses.test.ts)
├── application/
│   ├── handlers/      # MessageRouter + domain handler tests
│   └── services/      # Application service tests
├── presentation/
│   └── webview/{hooks,components}/  # Hook contract + pure-function tests (e.g. balanceFormat)
├── infrastructure/
│   ├── account/       # Account-balance service + client tests
│   ├── api/services/  # Business logic tests (word search, etc.)
│   ├── standards/     # Publishing standards tests
│   ├── storage/ text/ # pathContainment, TextSourceResolver
└── tools/measure/     # Measurement tool tests (prose stats, word frequency, etc.)
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

**Test Inventory** (measured 2026-10-22, Lightbox Slice 5A.1 (board names, rewrites in place, the models that read a board, the changed-file notice above the board, and a spark set aside saved at once) with PR #164's corrections (claims live or abandoned by age, deletes that claim, restores that settle a claimed file, a spark's write scoped to its tile, the name field's own edits) and its re-review's (deletes acknowledged only once retired, every missing read classified), on `epic/lightbox-slice-5a1-board-names`, from `epic/lightbox` at `3e5c3a1`):
- 482 suites / 6,653 tests / 59 snapshots
- Coverage report saved to `coverage/` (gitignored)
- Includes `__tests__/architecture/` guards that fail the build on boundary/contract drift

**What's Tested**:
- ✅ **Tier 1 - Infrastructure Patterns**: MessageRouter (Strategy pattern), domain hooks (Tripartite Interface), message routing
- ✅ **Tier 2 - Domain Handlers**: Route registration for all 12 flat domain handlers and Workshop's twelve route owners
- ✅ **Tier 3 - Business Logic**: Word clustering algorithm, publishing standards lookup, prose statistics calculations

**What's NOT Tested** (intentionally deferred):
- ❌ Interactive Extension Development Host behavior and visual inspection
- ❌ Live, billable provider calls (provider clients are tested with mocked transport)
- ❌ End-to-end VS Code activation through `@vscode/test-electron`

**Testing Philosophy**:
- **Infrastructure-First**: Protect architectural patterns that every feature depends on
- **Confidence-driven**: Protect contracts, state transitions, failure modes, and
  architecture boundaries rather than optimizing for a coverage percentage
- **Proportionate**: Match verification depth to the behavior and blast radius

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

5. **Track Debt Immediately**: Document in `.todo/tech-debt/` with priority. Don't let tracking block progress.

6. **Alpha Freedom**: No backward compatibility until v1.0. Remove dead code aggressively. Breaking changes are free.

### Workshop Session Codec Evolution

Workshop session JSON is a Marketplace-published writer-data contract even
while Workshop features are under active development. Follow [ADR
2026-07-30](docs/adr/2026-07-30-workshop-session-codec-evolution.md):

- During an unfinished epic, put narrowly named, deterministic repairs for
  local development checkpoints in `WorkshopSessionCheckpointNormalization`.
  Log and regression-test every normalization; do not call it a version
  migration.
- When a Marketplace release changes persisted session semantics or makes a
  formerly valid shape newly required, increment `schemaVersion` and add an
  explicit adjacent released-codec migration. Test with an authentic fixture
  from the preceding Marketplace version and write only the current version.
- Do not create placeholder migrations or copy intermediate development
  normalizations into a release migration unless the prior released format
  genuinely requires that transformation.
- Keep the top-level session codec as the public version boundary. When a
  second widget makes the widget-config codec genuinely plural, extract each
  widget's persisted draft/config validation, cloning, and checkpoint
  normalization into a widget-local codec. Widget pills remain session-owned;
  they do not need independent schema versions unless they become separately
  stored or decoded outside a Workshop session.

### Workshop Rewind and Branch

Follow [ADR 2026-09-30](docs/adr/2026-09-30-workshop-rewind-and-branch.md) when
touching retained histories or whole-room operations:

- **Marks.** Every settled commit records a retained-history mark. Discarding
  or replacing a conversation prunes its marks. Marks are host-private: the
  webview receives only `turnRewindability` and never re-derives it. A new
  commit path must record a mark after settlement; an architecture guard pins
  the chain.
- **One transform.** `rewindWorkshopSession` is the only code that cuts a room.
  It slices histories only at marks, never parses provider message formats,
  and never lowers an id counter.
- **Operations.** The coordinator's `rewindTo` and `branchFrom` back the
  `WORKSHOP_REWIND_SESSION` and `WORKSHOP_BRANCH_SESSION` routes. Handlers map
  a bubble to its cut and reach the cut vocabulary only through the
  coordinator, never through session collaborators.
- **Room replacement.** New, Open, Rewind and Branch share the coordinator's
  room-replacement transaction. A new whole-room operation joins it rather
  than hand-rolling rollback.
- **Branch.** Branch never writes its source session file. It refuses an
  unnamed room, a named room with unsaved work, and a room whose file on
  disk no longer matches it. It checks the file again at the commit that
  replaces `current.json`, through the store's `beforeCommit` seam.

### Workshop Seed Delivery

Follow [ADR 2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md) D11
(PR #150 F-03 and F-08) when handing anything from another tab into the
Workshop:

- **Claim before open.** The panel provider offers a seed through the
  panel's own MessageHandler (`WorkshopSeedDelivery`, one per
  `WorkshopSeedKind`); the webview holds it and claims it, and opens or
  stages it only on a grant. A grant is the commit point and cannot be
  revoked: a newer seed waits behind it. The 20-second deadline covers
  unclaimed offers only.
- **Receivers.** Each Workshop mount announces a receiver id once listening
  (`useWorkshopSeedReceiver`), and every claim and answer names it. A seed is
  sent only after an announcement; a new receiver on the same panel settles
  what the old one held as `reset` and resends what it never claimed. Late
  replies from an old receiver are ignored.
- **Acting on a grant.** A follow-up that changes session state (a tile's
  `WORKSHOP_ACCEPT_LIGHTBOX_TILE`) names its receiver, and the provider
  forwards it only while `WorkshopSeedDelivery.isGranted` holds for that
  delivery and receiver (PR #151 F-06).
- **Visibility** is checked at dispatch, not at the grant.
- **A new kind** joins `WorkshopSeedKind`, gets a delivery in the provider's
  `Record`, a receiver hook composing `useWorkshopSeedClaim`, and an entry in
  `dispatchWorkshopSeedClaimResult`'s receivers; one kind's claim result
  never reaches another's receiver.
- **The Lightbox sends ids only.** Its host resolves the item, re-checks its
  quotes and builds the payload; the Workshop checks it again on arrival.
  "Sent" or "staged" waits for the Workshop's own answer, or for its session
  holding the tile when that answer was lost.
- **Attachment kinds.** A staged attachment that is not a file declares its
  frame kind in `shared/constants/workshopThreadArtifactKinds.ts`; the frame
  builder, the session codec and the session's commit check all read that
  registry, and the body is neutralized like any other. A committed artifact
  has one owner, a widget commit or a message attachment, and each owner's
  kind is checked (PR #151 F-05).
- **Attachment identity.** A tile is its board and tile ids. Staging,
  Rewind's restage and hydration all ask `WorkshopMessageAttachmentIdentity`
  whether two attachments are one source, so no whole-room operation puts a
  tile above the composer twice (PR #151 F-01).

### Workshop Transcript Export

Follow [ADR 2026-10-05](docs/adr/2026-10-05-workshop-transcript-export.md) when
touching what the thread shows or how it is styled:

- **One projection.** `projectWorkshopTranscript` alone decides what a
  transcript contains; Markdown, JSON, and HTML only render it. A new turn
  shape or bubble element gets an explicit include/omit decision there, with a
  test. Host-private bodies (attachment text, widget payloads, capability
  evidence, context details) never enter it.
- **Full ledger, read-only.** Export reads `readRoomLedger()`, never the
  snapshot window, and never writes session state. It waits out room
  replacement instead of joining the mutation gate.
- **Not the session codec.** The JSON export has its own `formatVersion`;
  session-codec migrations do not apply to it.
- **Mirrored styles.** The HTML export copies thread CSS rules verbatim and a
  test pins them to their sources. Restyling the thread means regenerating the
  mirror; export-only rules live in the page layer.

### Workshop Session Recall

Follow [ADR 2026-10-05](docs/adr/2026-10-05-workshop-session-transcript-recall.md)
when touching the `transcript.*` family or what a persona may read from saved
sessions:

- **One projection.** Recall shows a saved turn only through
  `projectWorkshopTranscriptTurn`, the same rule export uses. It never defines
  its own idea of what a persona may see, and never reads `preview`, context
  bodies, attachment text, widget payloads, or conversation archives.
- **Read-only ports.** `recall/` reaches session files only through the
  service's ports (`availability()`, `list()` without a query, `readNamed()`)
  and the coordinator's `recallScope()`. It imports the store and coordinator
  as types only, never the room-frame renderers, and never writes or flushes.
- **Exhaustive families.** A new operation joins
  `WORKSHOP_CAPABILITY_OPERATIONS`; the compiler then requires a case in
  `workshopCapabilityFamily()` and every family switch. A switch that can
  return `undefined` carries an explicit `never` default.
- **The engine's window seam.** `AgentCapability.fulfill(request, window?)`
  is the one change outside the Workshop: the engine measures the free
  context window with the preflight's estimator, and recall clamps each read
  to half of it. Other capabilities ignore the window. With no window (an
  unknown context length), a turn's reads share one read's worth.
- **Hints decode as written.** Every continuation and hint a renderer emits
  must decode, exactly as written, through the codec, alone and followed
  together. The grammar prompt teaches each form, and a sync test pins its
  numbers to `PROMPT_BUDGETS` and its forms to the renderers' output.
- **Boundary lists.** A new `recall/` module joins `WORKSHOP_RECALL_MODULES`
  and the capability boundary in `boundaries.test.ts`, and stays under 500
  lines. No handler constructs the recall service; one instance owns the cache.

### Lightbox Source Ownership

Follow PR #148 F-01 and PR #152 F-01 (ADR
[2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md) D1, D12) when
adding a way to put a source on the Lightbox board:

- **One owner.** The shared `LightboxService` owns the writer's source intent.
  Each source request takes a ticket from `beginSourceRequest()`, and only the
  newest ticket may adopt a board or publish a refusal.
- **Before the first await.** Take the ticket when the writer's choice is
  concrete and before anything is awaited, including host work upstream of
  the handler:
  - Open File in Lightbox takes it before `openTextDocument`.
  - The system picker (`LIGHTBOX_PICK_SOURCE_FILE`, the project picker's
    "Explore project folders…") takes it when the picker returns a file, not
    when it opens.
  - Choose from project (`LIGHTBOX_CHOOSE_PROJECT_SOURCE`) takes it when the
    picked row's message arrives, before the catalog is opened. A payload
    naming no catalog file takes none.
- **Host-only tickets.** A host seed passes its ticket as an argument
  (`LightboxPanelProvider.seedSource` → `MessageHandler.seedLightboxSource` →
  `LightboxHandler.seedSource`), never as a message field. The
  `LIGHTBOX_SET_SOURCE` route always mints its own.
- **Refusals.** A refusal made without awaiting takes no ticket and changes
  nothing. One made after the ticket was taken still counts as the newest
  choice, but sends nothing: the board and standing refusal stay, and the next
  choice takes a newer ticket.
- **Overtaken seeds open nothing.** `seedSource` returns false, and reveals no
  tab, for a ticket a newer choice has overtaken. A current one lands in
  whichever tab is open, reopening a closed one.
- **Witnesses.** Order a new entry point against the others with held
  promises through `lightboxHandlerHarness`, as
  `openFileInLightboxOwnership.integration.test.ts` does.

### Lightbox Reading Groups

Follow [ADR 2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md)
D3, D4 and D7 (Slices 4B, 4C, 4D and 4F) when adding a lens or a reading tile kind:

- **Everything a kind joins.** A lens belongs to one group
  (`LIGHTBOX_LENSES`), with that group's numbered prompt files, its worked
  example (a request byte-identical to the builder's, decoding through the
  production codec and verifier) and a codec block. A new kind joins
  `LightboxReadingTile`, `LIGHTBOX_TILE_REGISTER`, `LIGHTBOX_TILE_RENDERERS`,
  `LightboxTileGates` (one gate, fresh and carried), the carry in
  `LightboxStaleReadings`, the carry parity sweep and every-kind test, and
  Bring's points. Its bounds live in `PROMPT_BUDGETS.lightbox`, pinned to
  the prompt text by `lightboxPromptBudgetsSync.test.ts`.
- **Asks, not gates (Slice 4H; epic decision 37; ADR D6/D7 addendum of
  2026-10-23).** Every length and count a prompt states is an ask: read a
  field with `LightboxReadingFields.text(value, path, ask)` and a list with
  `listAt(value, path, minimum, noun)`, never a maximum. Withhold only a
  real fault (a missing field, a wrong type, a value outside its
  vocabulary, fewer items than a stated minimum, an unknown key, a quote the
  verifier cannot find) or a structural rule (one entry per ribbon column,
  movements tiling the chapter, one example per note); check a structural
  count exactly with `boundedArrayAt`, and say why beside it. One safety
  ceiling (`safetyMultiple` times the ask, never in a prompt) clips a
  runaway field with an ellipsis and counts it. A surface with bounds of
  its own clips there with `clipLightboxText`, after its anchors are
  checked whole: Bring holds a tile to `WORKSHOP_LIGHTBOX_TILE_LIMITS`,
  which stay as they are.
- **A frame's JSON goes through the shared parser** (Slice 4H; decisions
  39 and 40). `LightboxReadingFrame` keeps the Lightbox's sentinels, a
  fence around the frame and the missing closing sentinel; the JSON itself
  is `parseModelJson` (structure-only repairs under a content guard) or,
  at the output ceiling, `salvageModelJson` (the finished blocks read, the
  cut one withheld with `LIGHTBOX_CUT_OFF_REASON`). Never add a JSON repair
  to a Lightbox module, and never let `@parsers/*` import a feature:
  `boundaries.test.ts` fails on either. Log each repair by its kind, never
  with text.
- **Lenses read together.** When one lens's reading names another's items
  (engagement names movements), the two are read in one call:
  `LIGHTBOX_READ_TOGETHER` in `shared/constants/lightbox.ts`, through
  `lightboxRereadLenses`, which the planner, the estimate's re-read prices
  and the webview's re-read line all use. With the partner lens off, the
  task asks for nothing that needs it.
- **Cross-group figures are host joins.** A figure joining two groups' tiles
  (the freshness basis) is one shared pure function over the board
  (`shared/constants/lightboxPlot.ts`), used by the webview and by Bring
  alike. It is shown only while both halves are current, and it never enters
  a model's task.
- **References by tile id.** A reading that refers to another tile
  (engagement on a movement) stores the host's tile id, never the reading's
  label or a position, so a re-read or a carry cannot attach it to the wrong
  item.
- **Sets gate as sets.** Items that only mean something together (movements
  tiling the chapter) pass one set gate, fresh and carried alike, and a
  failure withholds the whole set as one claim naming the rule it broke.
- **Measured lanes are recomputed, never carried.** The Sections lane
  (`LightboxSections`) is measured with every board and is never stale.
- **A group that reads the board (group F, the Opinion, Slice 4D).**
  `lightboxGroupReadsBoard` marks it.
  - **When it runs.** It runs after a press's chapter groups settle, only
    while the run owns its board.
  - **What it reads.** It reads `LightboxOpinionDigest`, built through the
    press owner's port by board id, never the chapter. The digest is bounded
    by `opinionDigestTokens` and priced at that bound, "up to". Its key
    covers the board's measurement context.
  - **What it can cite.** It cites board items by host key: tile ids and
    measured refs, from `lightboxOpinionItems`. That one shared function
    renders the digest, gates the reply and decides the Opinion's standing.
  - **Standing is derived, never stored.** A cited item gone, not current
    or saying something else (its basis) makes it stale. A new kind that
    can be cited joins `lightboxOpinionItems`, with its own lines in host
    words.
  - **The text rules.** The one evaluative tile's rules are
    `LightboxOpinionPhrasing`, a conservative word check with its limits
    stated. Keep it stricter than it needs to be, not looser.
- **Craft steering (group G, Slice 4F; ADR D7 second addendum).** The
  second fenced exception to "describe, never grade".
  - **Ownership.** Steering owns being verbs, adverbs and intensifiers
    (`LIGHTBOX_STEERING_STATS`); the numbers lens reads only
    `LIGHTBOX_NUMBERS_READ_STATS`, and its codec and gate refuse the rest.
    A new figure belongs to exactly one of the two lists.
  - **Measured first, by the numbers' own detectors.** Totals and rates
    come from `LIGHTBOX_NUMBER_PATTERNS`, so they equal the numbers rows;
    constructions come from the word-frequency tagger. Every quote is
    checked with `lightboxPatternInstanceFilter`, the same detector, fresh,
    on carry and at Bring.
  - **Measured in work that grows with the text (PR #160 F-01).** The
    measure runs with every board, lens on or off, so no step rescans a
    paragraph per instance: tokens are indexed once, neighbours come from
    one sweep per rule, and span membership is a binary search. A test
    counts the tagger's token reads, and one holds a 49,998-word paragraph
    to a coarse bound. A reading's quote check, a note's voice and its
    example's anchor share one index (`LightboxSpanIndex`, PR #162 F-01):
    each paragraph is run through each figure's detector and the dialogue
    matcher once per text (keyed by the verifier's paragraphs array and
    each paragraph's string), and every check is a binary search. A new
    check of a steering quote asks that index, never the detector or
    `findDialogueSpans` per note; a test counts both through fresh
    assembly, carry and Bring.
  - **The fence.** `LightboxSteeringPhrasing` holds every claim, why, nudge
    and example: no listed word (cut, delete, remove, fix, wrong, bad,
    should, must), no quotation mark, no figure, and no clause opened with
    an order in a why or nudge. A nudge exists only for a note that leans
    or compensates.
  - **The one example is never a quote.** Its `before` is anchored by code
    inside the note's checked quote, holding the instance, and the pair as
    the chapter has it is held to the example's bounds again (PR #160
    F-02), fresh, on carry and at Bring; it is never evidence, never
    searched by the verifier, never in the Opinion's digest, and drawn and
    brought under "One way it could go", whole or not at all. A fault
    withholds the example alone, with the host's reason.
  - **Dialogue is voice (epic decision 26, Slice 4G; ADR D7 third
    addendum).** A note whose instance stands in dialogue keeps its stance
    but carries no nudge or example, for all three figures: a host rule in
    `LightboxSteeringVoice`, applied fresh, on carry and at Bring. The codec
    reads a leaning note with a null nudge, and the gate withholds one in
    narration. Dialogue is the steering measure's split (`findDialogueSpans`,
    double quotation marks only). An example anchors only on an instance in
    narration, on a span that takes in no speech at all: a mixed note keeps
    its nudge, but an example crossing into a character's words is
    withheld alone (PR #162 F-02). Every note in dialogue, Earns included,
    carries the host's voice line, which the digest, the board, the
    inspector and Bring read as the mark of the character's voice (PR #162
    N-01).
  - **Host titles carry no digit** ("Being verbs · note II"), so nothing the
    Opinion is shown offers a figure it might state.
  - **Sentences are the shared rule's.** The short-run signal reads
    `proseSentenceSpans` and never splits text itself.
- **One ribbon grid, on the Chromium 114 floor.** Every ribbon label block
  and track is a direct child of `.pm-lb-ribbon-grid` (one label track,
  one column track), never a row with its own label width, so a column
  index is one horizontal place in every lane (PR #156 F-03). The grid must
  hold on Chromium 114, the floor VS Code 1.82 sets (`engines.vscode:
  ^1.82.0`; [ADR 2026-10-21](docs/adr/2026-10-21-vscode-engine-floor.md)):
  plain CSS grid, no `subgrid` (Chrome 117) or row wrappers (F-04).
  `webviewCssFloor.test.ts` fails on any new CSS feature above that floor;
  the only uses it allows are features Chromium 114 drops gracefully
  (its `GRACEFUL` list). The visual evidence harness measures the column
  edges and each label block beside its track, including in states that
  simulate the floor.

### Lightbox Passages

Follow [ADR 2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md)
D10 (Passages, Slice 4E) when changing what the inspector's wells show:

- **One rule per figure.** A well finds instances with the rule that made
  the figure it shows (`LightboxInstances`):
  - the word-frequency tokenizer for top words and phrases (phrases across
    paragraph breaks included);
  - the tagger's placed occurrences for parts of speech;
  - `proseStatsWords` for hapax;
  - Style Flags' detectors for the flags that count instances.

  A figure counted another way gets no well. Repetitive Words and Clichés
  count words, not instances.
- **A new figure that opens a well** joins `LightboxPassageTerm`,
  `lightboxBoardCountOf`, `LightboxPassageIndex.instancesOf` and the
  every-entry test in `LightboxCountAgreement.test.ts`.
- **Correlated, never persisted.** Each request names its board by id and
  content hash, under a webview-minted id. `useLightboxPassages` takes only
  the answer still pending, for the board on screen. A newer board says "the
  text changed" until its answer lands. No passage text enters `setState`.
- **Pending is only the pin on screen's.** Going back to a pin or board
  whose answer is held asks nothing and drops any other request, so a late
  answer can never replace what is shown (PR #159 F-01).
- **An instance outside every sentence keeps its own row.** A counted
  token can stand where no sentence is (a lone `'` is a hapax word). Its row
  is that stretch of its own paragraph, lit, and the passage counts it apart
  (`outside`, "1 instance, outside any sentence"). Never put it in the
  nearest sentence, and never count it as one (PR #161 N-01).
- **Cut in linear time.** The row bound limits rows, not what one row
  holds. Match ranges to instances in one walk and cut segments in one
  open/close sweep, never by scanning every instance per segment (PR #159
  N-01).
- **Sentences are the board's.** Rows use each paragraph's
  `proseSentenceSpans`. Change the sentence rule there, never in the well.
  A sentence keeps the closing marks written directly after its end, and
  a lower-case speech tag continues its speech's sentence
  ([ADR 2026-10-21](docs/adr/2026-10-21-sentence-closing-marks.md)). The
  rule feeds every sentence figure, so a change to it moves measured
  figures: pin it with literal before/after figures on the *Alice*
  fixtures, and regenerate any worked example whose request states them.

### Lightbox Saved Boards

Follow [ADR 2026-10-19](docs/adr/2026-10-19-lightbox-inspiration-board.md)
D12 and its addendum of 2026-10-22 (Slice 5A) when touching what a board
records, when it saves, or how a saved one comes back:

- **The format is a contract.** `LightboxBoardCodec` (format 1, pure, its
  decoders split by layer) reads and writes the board whole. Its decoders
  are typed against the contracts, so a new field or tile kind does not
  compile until the codec reads it; give it a decoder and a round-trip
  case in `LightboxBoardCodec.test.ts`. Keys are exact. Invalid tiles and
  group notes are dropped and counted; the measured layers, the paragraph
  model, a group's own fields and its stale marks decode whole or not at
  all. Never add a migration for a development shape: a change that cannot
  read `__tests__/fixtures/board-v1.json` is a new format, with a new
  fixture and ADR 2026-07-30's release rule.
- **Rule ids move with their rules.** A board records the ids of the rules
  that measured it (`LightboxMeasureRules`). Change what a rule returns and
  give it a new id beside the rule, then record its fingerprint as a new
  entry in `measurementRuleIds.test.ts`; never edit a recorded one. The
  Opinion's basis is fingerprinted over the fixture's board.
- **A saved board only ever loses standing, never the board** (the
  writer-data rule). Any well-formed rule id decodes and is kept. A board
  whose Opinion was cited under another basis rule opens whole; its Opinion
  is stale with `LIGHTBOX_OPINION_EARLIER_RULE`, and its Bring is refused
  with it, until it is read again (group F's landing moves
  `rules.opinionBasis` to this build's). Never add a file-rejection reason
  for an internal rule change: lose the standing it affects instead.
- **The Opinion's basis is data.** A citation's basis hashes the cited
  item's canonical data (`lightboxOpinionBasis`), never the digest's
  words. A new item kind gives its canonical data there, with a case that
  rewording keeps it and a changed field moves it.
- **One store, one queue.** `LightboxBoardStore` is built only in
  `extension.ts`. It writes a new file per save through its queue: staged
  under a name with a random UUID (another window's store shares the
  folder, not the queue), a synchronous commit point, then a rename that
  never overwrites; a taken final name is never reported as this save. It
  never deletes or overwrites a file it cannot read. Availability is read
  live: one folder saves; none, or several, is session-only.
- **One folder per source, read whole.** `<source-slug>-<source-hash>/`:
  never a folder by slug alone. `LightboxBoardFiles` lists every board of
  the source; never cap a listing or a same-text check. The rail pages
  what it shows and says how many there are.
- **One library decides.** `LightboxBoardLibrary`, built only in
  `extension.ts`, saves after a run that landed a group and on a source's
  first measured board, opens and restores. Handlers call it; none
  constructs it, and none writes a board.
- **Open and restore are source choices.** Each takes the service's ticket
  before its first await and adopts only under the newest (PR #148 F-01).
  Neither replaces a board a run is reading: checked at once, and again
  with nothing awaited at the adoption. A restore takes a ticket only when
  no source was chosen this session. Witness each with held promises
  (`LightboxBoardOwnership.test.ts`).
- **A board id is not an adoption.** Snapshots keep their board's id.
  Work that awaits captures `LightboxService.adoptionOf` before and checks
  it after (a press's snapshot holds it beside its estimate key, and the
  press checks both once its prompts load; a shelf names it, and
  `describesCurrent` gates its post). Within one adoption a shelf names its
  `observation`, taken before its first await: a handler never sends a
  shelf observed before one it sent of the same board, and the webview
  never takes one. A new kind of rail change must start a new
  observation (a push or an answer), or the rail will not hear it. Every adoption moves the reload
  pointer (`LightboxBoardAdoptions.test.ts`).
- **Names and rewrites in place (Slice 5A.1).** A board's name is
  optional writer text (`lightboxBoardName`: trimmed, one line, at most
  120 characters), saved as `board.name` in format 1; never log it or
  persist it in the webview. It belongs to the board: the retained board
  keeps it and every save writes it. A rename, and a spark set aside,
  rewrite the file that holds the board through `LightboxBoardStore.replace`
  (`LightboxBoardRewrite`): checked, staged privately, the file *claimed*
  by an atomic rename that never overwrites, then committed. Never rewrite
  a saved file another way: a plain overwrite can bring back a board
  another window deleted. A new in-place change joins `LightboxBoardEdits`,
  finds its file at the rewrite's turn in the queue, changes only what the
  writer acted on (one spark's mark, not the board's every mark: PR #164
  F-03), and never writes a file that does not read whole.
- **Claims are live or abandoned by age (PR #164 F-01, F-02).**
  `LightboxBoardClaims` names a claim with the time it was taken; younger
  than `LIGHTBOX_BOARD_CLAIM_LEASE_MS` it is live and no other window
  touches it. Abandoned claims are settled when a listing finds claims or
  a read, rewrite or delete finds its file gone: put back when the saved
  name is empty, removed (never put back) beside a standing file. A delete
  claims the file too and retires every other claim of it, and is
  acknowledged only when a second look finds none left; otherwise it puts
  the board back and fails, so a deleted board never comes back. A folder
  read error is `unknown`, never an empty folder. `missing` means the
  folder was read and neither file nor claim is there (every `missing` a
  read returns is classified); a live claim is `busy`, and a restore keeps
  its pointer on anything but `missing`. Never move, delete or put back a
  claim except through `LightboxBoardClaims`.
- **One notice, two places.** The changed-file notice above the board is
  `lightboxChangedFileNotice` over the rail's own shelf; never compute it
  another way.
- **A snapshot is exactly as saved.** Nothing is measured again; its
  host-side parts are rebuilt from its own saved text. A changed file is
  said in the rail, and Bring is refused with words that point to "Read the
  current text", the existing re-read.
- **The rail is correlated.** `useLightboxBoards` takes only the pending
  request's answer, and a push (`requestId: null`) only for the board on
  screen, never an earlier adoption's or observation's over a later one;
  a Delete makes it ask again on return; it persists nothing. File ids are the host's; the
  webview never names a path.
- **Logs never carry the writer's text,** nor do tests, fixtures or
  evidence: use *Alice* or made-up names.

### Operational Tips

**Parallel Subagents**: For independent tasks (e.g., updating multiple components), launch multiple Task tool calls in a single message. 3-5x faster than sequential.

**Testing**: Press F5 to launch Extension Development Host. Check Output Channel for backend logging. Verify persistence across reloads.

**GitHub CLI Authentication**: This machine's valid `gh` authentication is loaded by the interactive Zsh environment. A non-interactive shell can falsely report an invalid token. Run GitHub CLI authentication checks and GitHub CLI operations through an interactive login shell, for example `zsh -ic 'gh auth status'`.

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
