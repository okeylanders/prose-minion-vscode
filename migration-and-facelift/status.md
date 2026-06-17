# Status — Prose Minion Migration & Facelift

**Branch:** `claude/vigilant-cannon-jma748` (≡ `epic/monorepo-ports-and-adapters`) · **Last updated:** 2026-06-17
**Health:** 🟢 green — full build passing (296 tests · both typechecks · both webpack bundles)

## Pass / Stage tracker

| Stage | Item | Status | Commit |
|---|---|---|---|
| 0 | Branch + baseline + ADR | ✅ done | `0cd194c` |
| 1 | Platform ports + VS Code adapters | ✅ done | `5a4b1d8` |
| 1 | Wave 1 — `LogSink` + `SecretStore` | ✅ done | `5a4b1d8` |
| 1 | Wave 2 — `SettingsStore` | ✅ done | `7b6809a` |
| 1 | Wave 3 — `FileSystem` + `Workspace` | ✅ done (part 1 `9df924f` · part 2 this wave) | — |
| 1 | Wave 4 — `ShellService` + `EditorContext` | ◐ mostly done (pulled forward by Wave 3 pt 2 "convert fully") — only `ConfigurationHandler`'s one info-message left | — |
| 1 | Wave 5 — Wiring (watcher→shell, post fn, adapters) | ⬜ todo | — |
| 1 | Wave 6 — Tests + assert core `vscode`-free | ⬜ todo | — |
| 2 | Monorepo move (`git mv`, aliases, TS 5.x, boundary) | ⬜ todo | — |
| P2 | Design facelift | ⬜ blocked (needs design HTML — but try fetching first, see tech-debt) | — |

## Current focus — Wave 4 remainder + Wave 5 (👈 resume here)

Wave 3 part 2 converted all **four** file-handling handlers FULLY (FileSystem + Workspace +
ShellService + EditorContext, plus the leftover settings reads in `TextSourceResolver`),
which is why **Wave 4 is now mostly done** — `EditorContext` has no remaining consumers,
and the only un-ported `ShellService` call left is `ConfigurationHandler`'s single
`showInformationMessage`. What landed this wave:

- **`TextSourceResolver`** — fully port-driven on string paths; now **stateless and built
  ONCE** in `MessageHandler` (from `this.platform.*`) and **injected** into both
  `MetricsHandler` and `SearchHandler` (the per-call `await import(...)` + `new` is gone).
- **`FileOperationsHandler`** — fs/workspace/shell; `saveResultToFile` now returns
  `{ relativePath, absolutePath }` and opens via `shell.openFileInEditor(absolutePath)`.
- **`UIHandler`** — fs stat + `workspace.extensionPath`/workspace root + `shell.openFileInEditor(path, { beside: true })` (the column logic lives in the adapter) + `editor.getActiveSelection()` + `shell.readClipboard()`. No longer takes `extensionUri`.
- **`SourcesHandler`** — `editor.getActiveSelection()` for the active-file path/uri.

**Remaining (Wave 4 tail + Wave 5):** `ConfigurationHandler` (one `showInformationMessage`
→ `shell`), `MessageHandler` (move the `onDidChangeConfiguration` watcher to the shell +
swap `webview.postMessage` for an injected post fn — and drop its now-unused `extensionUri`
ctor param), and the two genuine shells (`extension.ts`, `ProseToolsViewProvider.ts` — they
keep `vscode`). Then assert core is vscode-free, run the full build + `vsce package`, and F5
smoke-test.

## Metrics

- **vscode imports remaining in core:** 4 files (was 37 at Stage-0; was 8 before this wave) —
  2 of those (`extension.ts`, `ProseToolsViewProvider.ts`) are legitimately shell, so only
  **2 real** left: `MessageHandler.ts` (Wave 5) + `ConfigurationHandler.ts` (Wave 4 tail).
- **Tests:** 296 passing / 35 suites
- **Ports done:** `LogSink` ✅, `SecretStore` ✅, `SettingsStore` ✅, `FileSystem` ✅,
  `Workspace` ✅, `EditorContext` ✅ (all consumers ported), `ShellService` ◐ (only
  `ConfigurationHandler` left)
- **Platform bundle:** assembled in `extension.ts`, threaded provider → MessageHandler

## Notes for the next session

- Each wave ends green + committed; pick up from the first unchecked box in
  [plan.md](plan.md).
- `extension.ts` + `ProseToolsViewProvider.ts` stay shell (keep `vscode`); they're
  rewired last (Wave 5).
