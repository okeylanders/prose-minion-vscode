# ADR: Monorepo + Ports-and-Adapters (ship as VS Code extension AND desktop app)

**Date**: 2026-06-16
**Status**: Accepted — implementation in progress on `epic/monorepo-ports-and-adapters`
**Deciders**: Okey Landers, Ada Forge (Claude Code)
**Related**:
- FrameMinion `docs/adr/012-electron-desktop-port-ports-and-adapters.md` — the sibling decision this mirrors (the proven reference implementation)
- [Secure API Key Storage](2025-10-27-secure-api-key-storage.md)
- [Unified Settings Architecture](2025-11-03-unified-settings-architecture.md)
- [Infrastructure Layer Reorganization](2025-11-29-infrastructure-layer-reorganization.md)

---

## Context

Prose Minion is a single-package VS Code extension. We want it to **also** ship as a standalone desktop ("OS") app, without forking the valuable domain logic — analysis, metrics, dictionary, publishing standards, word-frequency/NLP. FrameMinion, its sibling, already solved this exact problem (ADR-012): a monorepo with one platform-agnostic `core` consumed by thin app shells, with every VS Code API hidden behind a small set of platform **ports**.

An audit of PM's tree (2026-06-16) establishes the facts the decision rests on:

- **~75/25 split.** Of 161 source files, ~120 are platform-agnostic domain/presentation; only `extension.ts` and `ProseToolsViewProvider.ts` are *truly* VS Code shell.
- **`vscode` coupling is concentrated, not pervasive.** Most coupled files take their dependency as a single injected constructor parameter — `SecretStorageService` takes `vscode.SecretStorage`; ~6 services take a `vscode.OutputChannel` purely for logging.
- **The renderer is already platform-agnostic except one file.** The React tree under `presentation/webview/` speaks only `MessageEnvelope<T>` / `MessageType`; the lone runtime touchpoint is `acquireVsCodeApi()` in `useVSCodeApi`.
- **PM already follows** Clean Architecture + Message Envelope + Strategy routing + domain hooks — the very patterns FrameMinion extracted from.

In short, PM is **accidentally hexagonal already**, exactly as FM was. The seams that look like obstacles to a desktop port are the adapter boundaries.

## Decision

Adopt FrameMinion's structure in two behavior-preserving stages: **(1) extract platform ports in-place first, then (2) split into a monorepo** with one `@prose-minion/core` and a thin `apps/vscode-extension` shell (`apps/desktop` slots in later). Sequencing ports-first lands the risky dependency inversion while PM is still only the extension — validated by the existing test suite — after which the monorepo split is a no-logic file move.

### 1. Ports (interfaces in core; VS Code adapters in the shell)

Derived from how PM uses `vscode` today:

| Port (in core) | Replaces (VS Code) | VS Code adapter | (future) Desktop adapter |
| --- | --- | --- | --- |
| `AppMessagePort` (webview-side) | `acquireVsCodeApi()` / `postMessage` + get/setState | webview API wrapper | `ipcRenderer` via preload |
| `SecretStore` | `vscode.SecretStorage` (API key) | thin wrapper (already is one) | `safeStorage`-backed blob |
| `SettingsStore` | `workspace.getConfiguration('proseMinion')` + `onDidChangeConfiguration` | config wrapper | app settings store |
| `FileSystem` | `workspace.fs` read/write/dir + `Uri.joinPath` | wraps `workspace.fs` | Node `fs` |
| `Workspace` | `workspaceFolders`, `asRelativePath`, `findFiles`/`RelativePattern` (glob) | workspace paths + `findFiles` | fs globbing + app roots |
| `ShellService` | `window.show*Message`, `env.clipboard`, `window.showTextDocument` | `vscode.window`/`env` | Electron `dialog`/`clipboard`/`shell` |
| `EditorContext` | `window.activeTextEditor` (selection), `visibleTextEditors` | vscode editor wrapper | desktop editor binding |
| `LogSink` | `vscode.OutputChannel` (logging — already injected everywhere) | output channel | rotating log file |

`MessageEnvelope<T>` / `MessageType` and all payload types are the **unchanged shared contract** carried over `AppMessagePort` in both apps.

### 2. Monorepo with one core + app shells

```text
prose-minion-vscode/
  package.json                  # private root: workspaces[], orchestration scripts only
  tsconfig.base.json            # single root-relative paths table (one source of truth)
  packages/
    core/                       # application/ + domain/ + infrastructure/ + presentation/
                                #   + platform/ (ports) + shared/ + tools/ + resources/
                                #   — depends on the ports, NEVER on `vscode` or `electron`
  apps/
    vscode-extension/           # main, engines.vscode, contributes{}; VS Code adapters
                                #   + composition root (extension.ts); build: webpack · package: vsce → .vsix
    # desktop/  (deferred)      # Electron main/preload/renderer; Electron adapters; package: electron-builder
```

Both apps depend on `@prose-minion/core`. The `vscode` specifics live **only** in `apps/vscode-extension`, behind the ports. One domain fix, both products inherit it — the explicit defense against "fix every analysis bug twice." Migration order: (a) extract ports in `src/platform/` in-place (ships as the same extension), (b) hoist `core` via `git mv` (bundlers consume core TS source via tsconfig paths — no separate build step), (c) `apps/desktop` later writes adapters against interfaces that already have a working VS Code reference.

### PM-specific notes (where PM differs from FrameMinion)

- **No `StateStore` port.** PM has no `globalState`/`workspaceState` usage (no license gate). Webview state goes through `AppMessagePort`'s get/setState. *(Confirm zero host-side `globalState` use in Stage 1.)*
- **No `AssetUrlResolver` port.** Only `ProseToolsViewProvider` uses `asWebviewUri` (shell-side HTML). PM's webview renders markdown/text, not media URLs. *(Confirm in Stage 1.)*
- **`EditorContext` is a PM port FM lacks.** PM's "Analyze with Prose Minion" context-menu + selection sync needs the active-editor selection; FM has no editor concept. The desktop adapter binds to the desktop app's own editor later.
- **TypeScript 4.9 → 5.x.** FM's single `tsconfig.base.json` paths table relies on TS **5.0+** resolving an extended config's `paths` relative to the file that *defines* them. PM is on TS 4.9. Upgrade to TS 5.3 (FM's version) during Stage 2 so one shared paths table serves all tsconfigs.
- **Packaging: `vsce package --no-dependencies`.** With a `@prose-minion/core` workspace dependency, vsce must not traverse it (webpack bundles everything). Switch from today's plain `vsce package`.
- **Resource packaging.** prompts/guides load via `Uri.joinPath(extensionUri, 'resources', …)`. After the move, resources live in `packages/core/resources`; the shell passes the resolved base path into core's loaders (via `FileSystem`/composition root) and the VSIX must still bundle them. Mechanism settled in Stage 2 against FM's approach.
- **React 17 stays for Pass 1.** PM is on React 17, FM on 18. Pass 1 is behavior-preserving — no upgrade. Any React 18 move rides with the **Pass 2** visual facelift, not here.

## Alternatives Considered

1. **Copy FrameMinion wholesale, convert to PM.** *Rejected* — imports FM's video/image domain as ballast to delete; keeps less than it discards.
2. **Rebuild PM from scratch in a fresh repo.** *Rejected* — throws away 577 commits of working domain logic + marketplace continuity; PM's `.git` is a clean 42 MB with no bloat to escape.
3. **Restructure to monorepo first, extract ports after.** *Rejected* — core would import `vscode` during the interim, the eslint app→core boundary can't be enforced, and a broken-boundary move is harder to verify. Ports-first keeps every stage green.

## Implementation (staged on `epic/monorepo-ports-and-adapters`)

- **Stage 0** — cut branch, baseline green (`test`/`typecheck`/`build`), this ADR. ✅
- **Stage 1** — ports in `src/platform/` + adapters in `src/platform/vscode/`; refactor ~20 coupled files to inject ports; wire composition root in `extension.ts`; assert core is `vscode`-free. Verify green.
- **Stage 2** — workspaces + `packages/core` + `apps/vscode-extension` (FM config shapes); `git mv`; single `tsconfig.base.json` paths table (TS 5.x); webpack pointed at the core webview entry; core `index.ts` barrel (named re-exports, never `export *`); eslint `no-restricted-imports` app→core boundary. Verify green + F5 smoke + `vsce package`.

## Consequences

**Easier:** de-risking is real — ports are proven by the current ~124-test suite while PM is still only the extension; the monorepo split becomes a file move; the desktop app becomes "write adapters against working interfaces"; divergence is prevented by construction (shared `core`).

**Harder / trade-offs:** genuine up-front labor — ~8 ports defined, ~20 files refactored to constructor-inject them, ~15–20 tests inject in-memory fakes instead of mocking `vscode` (net *cleaner* tests). One-time costs: the TS upgrade, the `vsce` flag, and the resource-path wiring. Sidebar views built for a narrow column will look sparse in a full desktop window — responsive work deferred to the desktop phase (design, not architecture).

## Validation

Every stage ends green: `npm run typecheck` (both projects) → `npm test` (all ~124) → `npm run build` (both bundles) → `npm run package` (VSIX) → **F5 smoke**: sidebar loads, run an analysis + word frequency + dictionary lookup, save a report, settings overlay round-trips, API key store/clear. Diff against the Stage 0 baseline build — behavior identical.

## Open Questions

1. **Resource bundling mechanism** — copy `packages/core/resources` into the VSIX at package time vs. a webpack copy step vs. shipping resources from the app dir. Settle in Stage 2 against how FM ships its resources.
2. **TS project references (`tsc -b` + `composite`)** — compiler-level boundary enforcement + incremental builds. FM deferred this; PM defers too (eslint enforces the boundary; the incremental win is marginal at 2–3 projects).
