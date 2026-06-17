# Status — Prose Minion Migration & Facelift

**Branch:** `claude/vigilant-cannon-jma748` (≡ `epic/monorepo-ports-and-adapters`) · **Last updated:** 2026-06-17
**Health:** 🟢 green — full build passing (304 tests · both typechecks · both webpack bundles · `vsce package` clean). **Stage 1 COMPLETE — core is `vscode`-free.**

## Pass / Stage tracker

| Stage | Item | Status | Commit |
|---|---|---|---|
| 0 | Branch + baseline + ADR | ✅ done | `0cd194c` |
| 1 | Platform ports + VS Code adapters | ✅ done | `5a4b1d8` |
| 1 | Wave 1 — `LogSink` + `SecretStore` | ✅ done | `5a4b1d8` |
| 1 | Wave 2 — `SettingsStore` | ✅ done | `7b6809a` |
| 1 | Wave 3 — `FileSystem` + `Workspace` | ✅ done (pt 1 `9df924f` · pt 2 `a42c2e8`) | — |
| 1 | Wave 4 — `ShellService` + `EditorContext` | ✅ done (`ConfigurationHandler` info-message → shell this wave) | — |
| 1 | Wave 5 — Wiring (watcher→shell, post fn) | ✅ done | — |
| 1 | Wave 6 — Tests + assert core `vscode`-free | ✅ done (boundary guard test green) | — |
| 2 | Monorepo move (`git mv`, aliases, TS 5.x, boundary) | ⬜ todo (👈 next) | — |
| P2 | Design facelift | ⬜ blocked (needs design HTML — but try fetching first, see tech-debt) | — |

## Stage 1 complete — what closed it

This wave finished the last two `vscode` consumers in core:

- **`ConfigurationHandler`** (Wave 4 tail) — its two `showInformationMessage` calls (API key
  saved/cleared) now go through `ShellService`; no more `vscode` import.
- **`MessageHandler`** (Wave 5) — (a) injected `post: (message) => PromiseLike<unknown>`
  replaces the `vscode.Webview` field + `this.webview.postMessage`; (b) the dead `extensionUri`
  ctor param is gone; (c) the `onDidChangeConfiguration` watcher is **relocated to the shell**:
  the provider registers it and forwards a vscode-free `affects(section)` predicate into the new
  public `handleConfigurationChange(affects)` — all broadcast logic stays in core. The
  `vscode.Disposable[]` field is gone (the shell owns the watcher disposable now).
- **`ProseToolsViewProvider`** (shell, keeps `vscode`) — builds the `post` closure
  (`(msg) => webviewView.webview.postMessage(msg)`), registers/disposes the config watcher.
- **Wave 6** — `src/__tests__/architecture/coreVscodeFree.test.ts` scans production `src/` and
  fails if anything outside the two sanctioned shells (+ `platform/vscode/**`) imports `vscode`.

## Verification

- `npm test` → **304 / 304** (37 suites) · `npm run typecheck` (both) → clean ·
  `webpack --mode production` (both bundles) → clean · `vsce package` → `prose-minion-1.10.4.vsix`
  built clean (no `src/`, no tracking docs).
- ✅ **F5 smoke PASSED** (author ran locally 2026-06-17) — sidebar, analysis, word-frequency,
  dictionary, save report, settings round-trip, API key store/clear all working, **and the
  Settings-UI → webview broadcast** (the relocated config watcher) confirmed. The containment
  guard didn't break guide/resource opening. Stage 1 is fully verified and merge-ready.

## Metrics

- **vscode imports remaining in core:** **2 files** (was 37 at Stage-0) — `extension.ts` +
  `ProseToolsViewProvider.ts`, both legitimately shell. **0 real** remaining. Guarded by a test.
- **Tests:** 313 passing / 40 suites (incl. PR #59 review fixups)
- **Ports done:** all seven — `LogSink` ✅, `SecretStore` ✅, `SettingsStore` ✅, `FileSystem` ✅,
  `Workspace` ✅, `EditorContext` ✅, `ShellService` ✅
- **Platform bundle:** assembled in `extension.ts`, threaded provider → MessageHandler

## Notes for the next session

- Stage 1 is done and PR'd. **Stage 2 (monorepo move) is next** — pick up from the first
  unchecked box in [plan.md](plan.md), starting with the new `AppMessagePort` extraction item.
- `extension.ts` + `ProseToolsViewProvider.ts` stay shell (keep `vscode`) — that's by design.
