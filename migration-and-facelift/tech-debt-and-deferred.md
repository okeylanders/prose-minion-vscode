# Tech Debt & Deferred — Migration & Facelift

Things consciously punted, with the reason and when to revisit. Keep this honest —
silent deferrals read as "done" when they aren't.

## Deferred (intentional, scheduled)

| Item | Why deferred | Revisit |
|---|---|---|
| **WordSearch defaults: adopt the ADR's `7 / 150`?** | The 2025-11-03 unified-settings ADR specifies `contextWords: 7 / clusterWindow: 150`, but `package.json` ships `3 / 50`, so the running extension's effective default has always been `3 / 50 / 2`. Pass 1 centralized on the **shipped** values (behavior-preserving, D18). Bumping to `7 / 150` is a real, user-visible default change (wider context window + cluster grouping) — a deliberate product decision, not a refactor. | Post-migration, if desired |
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

## Resolved review findings (loose pass, pre–Wave 3 pt 2)

All four notes from the pre-wave review were addressed in the fixups commit:

| Finding | Reviewer | Disposition |
|---|---|---|
| `AppMessagePort` (webview port) untracked in plan | Marcus | ✅ Added as an explicit Stage-2 checklist item in [plan.md](plan.md). |
| Platform fakes too permissive (`createFakeFileSystem` never throws) | Cal/Stan | ✅ Hardened to throw on unseeded `stat`/`readFile` + `files` seed map (D19); added a focused `TextSourceResolver` test. `ConfigurationHandler.test` stays loose-`any` until that handler is ported (Wave 4 tail), then it gets port-typed doubles. |
| WordSearch defaults drifting across 4 sites | Bria/Parker | ✅ Centralized on `@shared/constants/wordSearchDefaults.ts` = `3/50/2` (D18); `ToolOptionsProvider` `minClusterSize` bug `3`→`2`. 7/150 deferred (above). |
| Adapter comments overclaim virtual/remote preservation | Marcus/Oliver | ✅ Tightened `VsCodeFileSystem`/`VsCodeWorkspace` comments to state the `Uri.file()` scheme-forcing caveat honestly. |

## Notes

- `FileSystem` adapter wraps `vscode.workspace.fs` (not Node `fs`) to preserve
  virtual/remote-FS behavior — but the string-path port + `Uri.file()` boundary
  means non-`file://` schemes degrade. Acceptable (file scheme is the norm); the
  Electron adapter will be Node-`fs`-backed.
