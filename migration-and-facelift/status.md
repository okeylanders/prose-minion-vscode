# Status — Prose Minion Migration & Facelift

**Branch:** `epic/monorepo-ports-and-adapters` · **Last updated:** 2026-06-17
**Health:** 🟢 green at `9df924f` — full build passing (296 tests · both typechecks · both webpack bundles)

## Pass / Stage tracker

| Stage | Item | Status | Commit |
|---|---|---|---|
| 0 | Branch + baseline + ADR | ✅ done | `0cd194c` |
| 1 | Platform ports + VS Code adapters | ✅ done | `5a4b1d8` |
| 1 | Wave 1 — `LogSink` + `SecretStore` | ✅ done | `5a4b1d8` |
| 1 | Wave 2 — `SettingsStore` | ✅ done | `7b6809a` |
| 1 | Wave 3 — `FileSystem` + `Workspace` | 🚧 part 1 done · part 2 (handlers) next | `9df924f` |
| 1 | Wave 4 — `ShellService` + `EditorContext` | ⬜ todo | — |
| 1 | Wave 5 — Wiring (watcher→shell, post fn, adapters) | ⬜ todo | — |
| 1 | Wave 6 — Tests + assert core `vscode`-free | ⬜ todo | — |
| 2 | Monorepo move (`git mv`, aliases, TS 5.x, boundary) | ⬜ todo | — |
| P2 | Design facelift | ⬜ blocked (needs design HTML) | — |

## Current focus — Wave 3 part 2 (👈 resume here)

Part 1 (`9df924f`) converted the resource loaders + metrics/search file reads to
`FileSystem`/`Workspace`. **Remaining: four file-handling consumers** that intertwine
file I/O with dialogs/editor — so convert each FULLY (FileSystem + Workspace +
ShellService + EditorContext, plus any leftover settings), not a partial pass:

- **`TextSourceResolver`** — fs + workspace + settings (manuscript/chapters globs) +
  editor (`activeTextEditor` in `resolveSelection`/`resolveSingleFilePath`). It's built
  per-call in `MetricsHandler` (~146) and `SearchHandler` (~167); cleanest fix: build ONE
  instance in `MessageHandler` with the ports and inject it into both handlers.
- **`FileOperationsHandler`** — fs (write/readDir/createDir) + workspace (folder,
  asRelativePath) + shell (modal Yes/No confirm, clipboard write, open saved file).
  Make `saveResultToFile` return a string path; open via `shell.openFileInEditor(path)`.
- **`UIHandler`** — fs (stat existence) + workspace (extensionPath + workspace root) +
  shell (`openFileInEditor(path, { beside: true })`, `readClipboard`) + editor
  (`getActiveSelection`).
- **`SourcesHandler`** — editor (`getActiveSelection` → relativePath + uriString);
  settings already done in Wave 2, so this is the new `editor` arg only.

Wire the new ports from `this.platform.*` at each construction site in `MessageHandler`.
Test doubles are in `src/__tests__/mocks/platform.ts` (`createFakeSettings`,
`createFakeFileSystem`, `createFakeWorkspace`); add `createFakeShellService` /
`createFakeEditorContext` for the handler tests (`UIHandler.test`, and re-touch
`SourcesHandler.test` for the editor arg).

**After the handlers**, only the final wave remains: `ConfigurationHandler` (one
`showInformationMessage` → shell), `MessageHandler` (move the `onDidChangeConfiguration`
watcher to the shell + swap `webview.postMessage` for an injected post fn), and the two
genuine shells (`extension.ts`, `ProseToolsViewProvider.ts` — they keep `vscode`). Then
assert core is vscode-free, run the full build + `vsce package`, and F5 smoke-test.

## Metrics

- **vscode imports remaining in core:** 8 files (was 37 at Stage-0) — and 2 of those
  (`extension.ts`, `ProseToolsViewProvider.ts`) are legitimately shell, so **6 real**.
- **Tests:** 296 passing / 35 suites
- **Ports done:** `LogSink` ✅, `SecretStore` ✅, `SettingsStore` ✅, `FileSystem`/`Workspace`
  ✅ for loaders + metrics/search reads (part 1) · **remaining:** `FileSystem`/`Workspace`
  for the 4 handlers, then `ShellService` + `EditorContext`
- **Platform bundle:** assembled in `extension.ts`, threaded provider → MessageHandler

## Notes for the next session

- Each wave ends green + committed; pick up from the first unchecked box in
  [plan.md](plan.md).
- `extension.ts` + `ProseToolsViewProvider.ts` stay shell (keep `vscode`); they're
  rewired last (Wave 5).
