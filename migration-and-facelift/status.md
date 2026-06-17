# Status — Prose Minion Migration & Facelift

**Branch:** `epic/monorepo-ports-and-adapters` · **Last updated:** 2026-06-17
**Health:** 🟢 green — typecheck (both projects) + 296 tests passing at HEAD

## Pass / Stage tracker

| Stage | Item | Status | Commit |
|---|---|---|---|
| 0 | Branch + baseline + ADR | ✅ done | `0cd194c` |
| 1 | Platform ports + VS Code adapters | ✅ done | `5a4b1d8` |
| 1 | Wave 1 — `LogSink` + `SecretStore` | ✅ done | `5a4b1d8` |
| 1 | Wave 2 — `SettingsStore` | 🚧 in progress | — |
| 1 | Wave 3 — `FileSystem` + `Workspace` | ⬜ todo | — |
| 1 | Wave 4 — `ShellService` + `EditorContext` | ⬜ todo | — |
| 1 | Wave 5 — Wiring (watcher→shell, post fn, adapters) | ⬜ todo | — |
| 1 | Wave 6 — Tests + assert core `vscode`-free | ⬜ todo | — |
| 2 | Monorepo move (`git mv`, aliases, TS 5.x, boundary) | ⬜ todo | — |
| P2 | Design facelift | ⬜ blocked (needs design HTML) | — |

## Current focus

**Wave 2 — `SettingsStore`.** Replace `vscode.workspace.getConfiguration('proseMinion')`
reads/writes with the injected `SettingsStore` port across the configuration
handler, tool-options provider, AI resource manager/orchestrator, analysis/sources/
publishing handlers, and standards service; thread the adapter through the
composition root.

## Metrics

- **vscode imports remaining in core:** ~26 files (was 37 at Stage-0)
- **Tests:** 296 passing / 35 suites
- **Ports done:** `LogSink` ✅, `SecretStore` ✅ · **remaining:** `SettingsStore`,
  `FileSystem`, `Workspace`, `ShellService`, `EditorContext`

## Notes for the next session

- Each wave ends green + committed; pick up from the first unchecked box in
  [plan.md](plan.md).
- `extension.ts` + `ProseToolsViewProvider.ts` stay shell (keep `vscode`); they're
  rewired last (Wave 5).
