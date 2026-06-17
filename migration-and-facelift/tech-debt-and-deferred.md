# Tech Debt & Deferred — Migration & Facelift

Things consciously punted, with the reason and when to revisit. Keep this honest —
silent deferrals read as "done" when they aren't.

## Deferred (intentional, scheduled)

| Item | Why deferred | Revisit |
|---|---|---|
| **`apps/desktop` (Electron shell)** | Pass 1 scope is monorepo + VS Code shell. The ports make the desktop adapter a "fill-in-the-interfaces" job later. | After Stage 2 |
| **TS 4.9 → 5.x upgrade** | Only needed for FM's single shared `paths` table; Stage 1 runs fine on 4.9. | Stage 2 (D10) |
| **React 17 → 18** | Pass 1 is behavior-preserving; FM's components/design assume 18. | Pass 2 facelift |
| **TS project references (`tsc -b` + `composite`)** | Would give compiler-level boundary enforcement + incremental builds, but is a dedicated change with its own footguns; eslint enforces the boundary and the incremental win is marginal at 2–3 projects. FM deferred it too. | Post-desktop |
| **Resource bundling mechanism** | Prompts/guides load from `extensionUri/resources`; after the move they live in `packages/core/resources` and must still ship in the VSIX. Mechanism (copy vs. webpack-copy vs. app-dir) decided when the move happens. | Stage 2 |

## Blocked

| Item | Blocker |
|---|---|
| **Pass 2 — Design Facelift** | Needs the "Prose Minion – Design Refresh" artifacts available to tooling. **First action when Pass 2 starts: actually attempt the fetch** (share links, any downloadable bundle/zip, the chat thread + assets) via `WebFetch`/`WebSearch` before assuming it's auth-gated — the earlier "can't be fetched" note was untested pessimism. Fall back to "save the HTML to `docs/design/` or `/tmp`" only if the tooling genuinely hits an auth wall. In the meantime, FrameMinion's design language (`--fm-*` tokens, flame brand marks, sidebar/header chrome) is the reference to absorb. |

## Discovered debt (note as we go)

| Item | Severity | Note |
|---|---|---|
| `.vscodeignore` did not exclude `migration-and-facelift/**` | Low | Added 2026-06-17 so root packaging never bundles tracking docs. Moot after Stage 2 (packaging moves into `apps/vscode-extension`). |
| Long constructors (`MessageHandler` 12 params, `ProseToolsViewProvider` 11) | Low–Med | Adding ports risks 16+ params. Mitigation: thread a `Platform` bundle (Wave 5) rather than more individual params. |
| `outputChannel`-named params now typed `LogSink` | Cosmetic | Param name kept to minimize Wave-1 churn; the name still reads "output channel" though the type is the narrower port. Rename opportunistically. |

## Notes

- `FileSystem` adapter wraps `vscode.workspace.fs` (not Node `fs`) to preserve
  virtual/remote-FS behavior — but the string-path port + `Uri.file()` boundary
  means non-`file://` schemes degrade. Acceptable (file scheme is the norm); the
  Electron adapter will be Node-`fs`-backed.
