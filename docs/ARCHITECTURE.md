# Architecture

> **Status**: Current as of v2.0.1 (monorepo ports-and-adapters split, June 2026).

## Overview

Prose Minion is an npm-workspaces monorepo with a **host-agnostic core** and a **thin VS Code adapter**. The core engine contains all domain logic, infrastructure, and presentation code with zero `vscode` imports. The VS Code extension app is a composition root that wires concrete platform implementations into core.

```
prose-minion-vscode/
├── packages/core/          # Host-AGNOSTIC engine (zero vscode imports)
│   ├── src/
│   ├── resources/          # system-prompts/ + craft-guides/
│   └── tsconfig.json + tsconfig.webview.json
└── apps/vscode-extension/  # VS Code ADAPTER + composition root
    └── src/
        ├── extension.ts              # Composition root
        ├── application/providers/     # ProseToolsViewProvider (webview shell)
        └── platform/vscode/           # VS Code Platform port implementations
```

### The Two Invariants

1. **`packages/core` never imports `vscode`.** It depends only on the `Platform` ports (`packages/core/src/platform/`). A non-VS-Code host can reuse core by implementing these ports.
2. **`apps/vscode-extension` is the only composition root.** `extension.ts` constructs concrete services + the VS Code Platform and threads them inward. The app imports core only through the `@prose-minion/core` barrel (enforced via `eslint no-restricted-imports`).

---

## Platform Ports

Core defines host-agnostic ports in `packages/core/src/platform/`. The VS Code adapter implements each one in `apps/vscode-extension/src/platform/vscode/`.

| Port | Purpose |
|------|---------|
| `LogSink` | Structured logging (Output Channel) |
| `SecretStore` | Encrypted secret storage (API key) |
| `SettingsStore` | VS Code configuration read/write |
| `FileSystem` | File reads for context/prompts/guides |
| `Workspace` | Workspace folder + glob discovery |
| `ShellService` | Subprocess execution (future MCP) |
| `EditorContext` | Active editor selection + source metadata |

All ports are composed into a single `Platform` bundle at the composition root.

---

## Core Architecture (`packages/core/src`)

Clean Architecture with dependencies flowing inward:

```
Presentation → Application → Domain ← Infrastructure
                    ↓
                  Shared
```

```
packages/core/src/
├── platform/           # Ports the host must implement
├── application/         # Orchestration
│   ├── services/       # Cross-domain services (StandardsComparisonService)
│   └── handlers/       # Message routing + domain handlers
│       ├── MessageHandler.ts           # Main dispatcher
│       ├── MessageHandlerContracts.ts  # CoreServices + typed transport/cache/seams
│       ├── MessageRouter.ts            # Strategy registry (MessageType → handler)
│       └── domain/                     # 12 domain handlers (including Workshop)
├── domain/             # Domain models
│   └── models/
├── infrastructure/     # External integrations
│   ├── api/           # OpenRouter: providers/ orchestration/ parsers/ services/
│   ├── account/       # OpenRouter account-balance client + service
│   ├── context/ guides/ secrets/ standards/ storage/ text/
├── presentation/       # React webview UI
│   └── webview/       # Components + domain hooks
├── tools/             # Assist + Measure tools
│   ├── assist/ measure/ shared/ utility/
├── utils/             # Shared helpers
└── shared/            # Shared types
    └── types/messages/  # Message contracts (domain-organized)
```

---

## Composition Root

`apps/vscode-extension/src/extension.ts` is the **single composition root**. It:

1. Constructs concrete infrastructure services into a typed `CoreServices` bundle.
2. Constructs the VS Code `Platform` implementations.
3. Threads both bundles into `ProseToolsViewProvider`, which passes them to `MessageHandler`.
4. `MessageHandler` wires domain handlers and lifecycle callbacks but does **not** construct infrastructure.

This invariant is guarded by architecture and assembly tests (`packages/core/src/__tests__/architecture/`).

**Reference**: [ADR 2026-06-18: MessageHandler Composition-Root Consolidation](adr/2026-06-18-messagehandler-composition-root-consolidation.md)

---

## Core Architectural Patterns

### 1. Message Envelope Pattern

All extension ↔ webview communication uses a typed envelope with source tracking and echo prevention:

```typescript
interface MessageEnvelope {
  type: MessageType;
  source: string;          // e.g. 'webview.domain.component' or 'extension.handler.analysis'
  payload: T;
  timestamp: number;
}
```

**Reference**: [ADR 2025-10-28](adr/2025-10-28-message-envelope-architecture.md)

### 2. Strategy Pattern for Message Routing

Both backend (`MessageRouter`) and frontend (`useMessageRouter`) use a declarative handler registry — no switch statements:

```typescript
// Backend
private routeMessage(message: MessageEnvelope): void {
  const handler = this.messageRouter.get(message.type);
  if (handler) handler(message);
}

// Frontend
useMessageRouter({
  [MessageType.ANALYSIS_RESULT]: analysis.handleResult,
  [MessageType.METRICS_RESULT]: metrics.handleResult,
});
```

### 3. Domain Mirroring (Frontend ↔ Backend)

Frontend hooks mirror backend handlers by domain:

| Frontend Hook | Backend Handler | Domain |
|---------------|-----------------|--------|
| `useAnalysis` | `AnalysisHandler` | Prose/dialogue analysis |
| `useMetrics` | `MetricsHandler` | Word frequency, stats, style flags |
| `useDictionary` | `DictionaryHandler` | Word lookups |
| `useContext` | `ContextHandler` | Context generation |
| `useSearch` | `SearchHandler` | Word search |
| `useSettings` (+ 6 settings hooks) | `ConfigurationHandler` | Settings, models, API keys |
| `usePublishingSettings` | `PublishingHandler` | Publishing standards |
| `useSelection` | `UIHandler` | Selection/paste operations |
| `useAccountBalance` | `AccountBalanceHandler` | OpenRouter balance |
| `useWorkshop` | `WorkshopHandler` | Pinned excerpt, persona host, and retained tool sidecars |

### 4. Tripartite Hook Interface

Each domain hook in `packages/core/src/presentation/webview/hooks/domain/` exports three interfaces:

- **State** — read-only state the UI displays
- **Actions** — write operations the UI triggers
- **Persistence** — what gets saved to `vscode.setState`

### 5. Composed Persistence

`App.tsx` composes each hook's `persistedState` into a single `usePersistence()` call that syncs to webview storage on every state change.

### 6. Workshop Host and Retained Participants

Workshop session truth lives in the composition-root-owned
`WorkshopSessionService`, never in React. Its private participant graph has one
selected persona host, the latest retained conversation for each tool, and an
optional direct-tool target. Provider conversation ids never cross the
extension/webview boundary; `WorkshopSessionSnapshot` exposes only host
identity, each sidecar's latest report correlation/availability, the current
target, and the in-flight phase.

`WORKSHOP_SEND_MESSAGE` is the only composer action. It starts or continues
the selected persona host unless `WORKSHOP_SET_CHAT_TARGET` selects a live tool
sidecar; the handler validates that sidecar rather than trusting the webview.
Persona prompts are immutable for a retained conversation, assembled through
`PromptLoader` from a shared base and one curated prompt under
`packages/core/resources/system-prompts/workshop-personas/`. The deterministic
persona catalog stays in shared code; presentation-only focus icons stay in
the webview.

`RunWorkshopToolSidePass` is a composition-root-owned application use case.
Every user-triggered tool run starts a fresh retained tool conversation,
atomically adopts its exact report as the latest sidecar for that tool, and
only then starts/continues the host with bounded structured evidence. The
report and persona synthesis remain separately attributed turns; synthesis
failure never rolls back the valid report. Reserved persona-frame delimiters
inside quoted excerpts/evidence are encoded before prompt assembly.

Direct-tool exchanges continue the report-owned sidecar without a persona
relay call. Returning to the host prepares at most the newest 8 unseen turns
and 20,000 characters; omission/truncation provenance is explicit, and the
per-sidecar delivery cursors advance only after the host turn is successfully
adopted. Quick actions carry the report turn id and are rejected once a newer
run replaces that sidecar. Reset and excerpt replacement dispose every
retained participant; reset also restores Jill while preserving the excerpt.

**Reference**: [Workshop Persona Host, Tool Sidecars, and Capabilities (2026-07-09)](adr/2026-07-09-workshop-persona-hosted-conversations.md)

---

## Settings Architecture

All settings use the **Domain Hooks pattern** (6 specialized hooks) with bidirectional sync between VS Code Settings, the backend `ConfigurationHandler`, and the webview. An echo-prevention system in `ConfigurationHandler` stops infinite loops.

**Reference**: [ADR 2025-11-03: Unified Settings Architecture](adr/2025-11-03-unified-settings-architecture.md)

---

## Import Conventions

Prefer semantic aliases for cross-boundary imports and barrel imports where available. Local sibling/nearby module imports still exist in app and webview code; the important boundary rule is that the VS Code adapter enters core through `@prose-minion/core`, and shared/core imports use the alias table from `tsconfig.base.json` as the single source of truth.

| Alias | Resolves To | Used In |
|-------|-------------|---------|
| `@prose-minion/core` | `packages/core/src/index.ts` | App (barrel only) |
| `@messages` | `packages/core/src/shared/types/messages/index.ts` | Both |
| `@handlers/*` | `packages/core/src/application/handlers/*` | Core (backend) |
| `@services/*` | `packages/core/src/infrastructure/api/services/*` | Core (backend) |
| `@providers/*` | `packages/core/src/infrastructure/api/providers/*` | Both |
| `@standards` | `packages/core/src/infrastructure/standards` | Core (backend) |
| `@secrets` | `packages/core/src/infrastructure/secrets` | Core (backend) |
| `@components/*` | `packages/core/src/presentation/webview/components/*` | Webview |
| `@hooks/*` | `packages/core/src/presentation/webview/hooks/*` | Webview |
| `@formatters` | `packages/core/src/presentation/webview/utils/formatters` | Webview |
| `@/*` | `packages/core/src/*` | Both (fallback) |

---

## Build System

The VS Code adapter uses **dual webpack** (`apps/vscode-extension/webpack.config.js`):

1. **Extension** — Node target, entry `extension.ts`, output `dist/extension.js`
2. **Webview** — Browser target, entry `presentation/webview/index.tsx`, output `dist/webview.js`

---

## Key ADRs

- [Monorepo Ports and Adapters (2026-06-16)](adr/2026-06-16-monorepo-ports-and-adapters.md)
- [MessageHandler Composition-Root Consolidation (2026-06-18)](adr/2026-06-18-messagehandler-composition-root-consolidation.md)
- [Presentation Layer Domain Hooks (2025-10-27)](adr/2025-10-27-presentation-layer-domain-hooks.md)
- [Message Envelope Architecture (2025-10-28)](adr/2025-10-28-message-envelope-architecture.md)
- [Unified Settings Architecture (2025-11-03)](adr/2025-11-03-unified-settings-architecture.md)
- [Secure API Key Storage (2025-10-27)](adr/2025-10-27-secure-api-key-storage.md)
- [Lightweight Testing Framework (2025-11-15)](adr/2025-11-15-lightweight-testing-framework.md)
- [Workshop Persona Host, Tool Sidecars, and Capabilities (2026-07-09)](adr/2026-07-09-workshop-persona-hosted-conversations.md)

See [TESTING.md](TESTING.md) for the test strategy, [CONFIGURATION.md](CONFIGURATION.md) for settings, and [TOOLS.md](TOOLS.md) for the tool inventory.
