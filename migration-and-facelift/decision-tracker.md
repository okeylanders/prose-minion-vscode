# Decision Tracker — Migration & Facelift

Running log of decisions. Architectural ones of record live as ADRs; this is the
fuller trail, including the smaller calls.

| # | Date | Decision | Rationale | Status |
|---|---|---|---|---|
| D1 | 2026-06-16 | **Integration branch**, not a fresh repo | PM's `.git` is a clean 42 MB / 577 commits — nothing to escape. A branch keeps blame + issues + marketplace continuity and yields an identical structure when merged. | ✅ |
| D2 | 2026-06-16 | **Monorepo first, facelift second** | Separates structural change from visual change; each pass independently verifiable, regressions easy to localize. | ✅ |
| D3 | 2026-06-16 | **FM chassis + PM engine** (transplant) | Copy FrameMinion's skeleton/tooling/ports; move PM's domain in. Copying FM wholesale would import video/image ballast; rebuilding from scratch discards working logic. | ✅ |
| D4 | 2026-06-16 | **Ports-first, then move** | Land the risky dependency inversion while PM is still only the extension (proven by the test suite); the monorepo split then becomes a no-logic file move. | ✅ |
| D5 | 2026-06-16 | **7 ports**, not FM's 8 | Drop `StateStore` (no `globalState` use) and `AssetUrlResolver` (only the shell uses `asWebviewUri`); add `EditorContext` (PM's "Analyze selection" flow, which FM lacks). | ✅ |
| D6 | 2026-06-16 | **Structural-satisfier for `SecretStore` + `LogSink`** | Native `context.secrets` / `OutputChannel` satisfy the interfaces directly — no adapter class, no wiring change. Mirrors FM. | ✅ |
| D7 | 2026-06-16 | `Workspace` port gains `asRelativePath` + `findFiles` | PM's context/metrics resolvers discover reference files via user glob patterns; FM's `Workspace` had no glob need. | ✅ |
| D8 | 2026-06-16 | `ShellService` scoped to PM's real surface | Only info/modal messages, clipboard read+write, open-in-editor. Editor-column ("beside the webview") logic lives in the VS Code adapter, not core. | ✅ |
| D9 | 2026-06-16 | **Local checkpoint commits per wave** | A staged, branch-isolated restructure needs rollback points; each wave is green before commit. (Pushing authorized 2026-06-17.) | ✅ |
| D10 | 2026-06-16 | **TS 4.9 → 5.x deferred to Stage 2** | FM's single shared `paths` table relies on TS 5.0+ resolving an extended config's paths relative to the defining file. Not needed for in-place Stage 1. | ⏳ Stage 2 |
| D11 | 2026-06-16 | **React 17 stays for Pass 1** | Behavior-preserving; any React 18 move rides with the Pass-2 facelift. | ⏳ Pass 2 |
| D12 | 2026-06-16 | Port-import alias `@/platform` (in-place) | Resolves via the existing `@/*` alias now; stays stable when `platform/` moves into `packages/core/src/` in Stage 2. Adapters use relative `../X` (fixed to the core barrel at move time). | ✅ |
| D13 | 2026-06-17 | **`vsce package --no-dependencies`** (Stage 2) | With a `@prose-minion/core` workspace dependency, vsce must not traverse it — webpack bundles everything. | ⏳ Stage 2 |
| D14 | 2026-06-17 | **`Platform` bundle through the shell; individual ports to leaves** | The wiring (extension.ts → provider → MessageHandler) threads ONE `Platform` object so the shell's constructors don't sprout a parallel param per port; leaf consumers still take only the specific ports they need (drawn from the bundle at the construction site). Resolves the open wiring-style question. | ✅ |
| D15 | 2026-06-17 | **`TextSourceResolver` = shared injected singleton, not per-call `new`** | It's stateless (only the optional `LogSink`), so building it once in `MessageHandler` from the ports and injecting into Metrics+Search is simpler than the old per-call `await import(...)` + `new`. The dynamic import (added "to avoid cyclic deps") is unnecessary once the instance is injected — no path runs from the resolver back to either handler. | ✅ |
| D16 | 2026-06-17 | **`FileOperationsHandler` saved-path uses `asRelativePath(path, false)`** | The original `vscode.workspace.asRelativePath(uri)` passed no 2nd arg, so vscode defaulted `includeWorkspaceFolder` to `true` in **multi-root** workspaces (prepends the folder name). The port forces an explicit boolean; `false` matches single-root (the documented file:// norm) and every other call site. Behavior delta is multi-root display only — the saved file always lives under `workspaceFolders[0]`. | ✅ (noted) |
| D17 | 2026-06-17 | **Wave 3 pt 2 "convert fully" absorbed most of Wave 4** | Converting the four file-handling handlers end-to-end (not just their fs/workspace bits) pulled `ShellService`+`EditorContext` forward for those consumers. Cleaner than a second editing pass over the same files; leaves only `ConfigurationHandler`'s one info-message for Wave 4's tail. | ✅ |

## Open decisions

- **Resource bundling mechanism** (Stage 2): copy `packages/core/resources` into
  the VSIX vs. webpack copy step vs. ship from the app dir.
- **Config-watcher relocation** (Wave 5): move `MessageHandler`'s
  `onDidChangeConfiguration` watcher to the shell (FrameMinion pattern), passing a
  vscode-free `affectsConfiguration` predicate inward.
