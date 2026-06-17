# Plan — Prose Minion Migration & Facelift

> Operational plan. For *why*, see the [ADR](../docs/adr/2026-06-16-monorepo-ports-and-adapters.md).
> For *current state*, see [status.md](status.md).

## North star

Mirror FrameMinion's shape: one platform-agnostic `@prose-minion/core` consumed
by thin app shells, VS Code APIs hidden behind a small set of ports. **Take
FrameMinion's chassis, drop in Prose Minion's engine** — copy FM's monorepo
skeleton/tooling/ports, transplant PM's domain logic (analysis, metrics,
dictionary, publishing standards, word-frequency/NLP).

## Target structure

```
prose-minion-vscode/                 # private "prose-minion-monorepo"
  tsconfig.base.json                 # single root-relative paths table
  packages/core/                     # @prose-minion/core — never imports vscode
    src/{application,domain,infrastructure,presentation,platform,shared,tools}
    resources/                       # system-prompts, craft-guides, repository JSON
  apps/vscode-extension/             # publishable manifest; VS Code adapters + extension.ts
  # apps/desktop/  (deferred)        # Electron shell, later
```

## Ports (the seam)

`SecretStore`, `LogSink` (structural — no adapter), `SettingsStore`, `FileSystem`,
`Workspace`, `ShellService`, `EditorContext` (adapter classes in `platform/vscode/`).
Deltas from FM: **no** `StateStore`/`AssetUrlResolver` (unused); **added**
`EditorContext` (the "Analyze selection" flow); `Workspace` gains `asRelativePath`
+ `findFiles`.

## Stage 0 — Safety net ✅

- [x] Cut `epic/monorepo-ports-and-adapters` from a green `main`
- [x] Confirm baseline green (`npm run build` = test + typecheck + webpack)
- [x] Write the ADR

## Stage 1 — Extract ports in-place (behavior-preserving)

Ports + adapters live in `src/platform/` / `src/platform/vscode/` (relative
imports) while still a single package; the monorepo move (Stage 2) then becomes a
no-logic relocation.

- [x] **Ports + adapters** authored, typecheck green
- [x] **Wave 1 — `LogSink` + `SecretStore`** (structural swaps, ~24 files)
- [x] **Wave 2 — `SettingsStore`** (replace `getConfiguration('proseMinion')`, 8 files) — `7b6809a`
- [x] **Wave 3 — `FileSystem` + `Workspace`** (convert `vscode.Uri` ops → string paths)
  — part 1 (loaders + metrics/search reads, `9df924f`); part 2 = the 4 file-handling
  handlers, converted FULLY (fs/workspace/shell/editor), `TextSourceResolver` now a
  shared injected singleton
- [~] **Wave 4 — `ShellService` + `EditorContext`** (dialogs/clipboard/open-in-editor + selection)
  — mostly pulled forward by Wave 3 pt 2's "convert each fully"; `EditorContext` fully done,
  `ShellService` only `ConfigurationHandler`'s one `showInformationMessage` remains
- [ ] **Wave 5 — Wiring** (config-watcher → shell; `postMessage` → injected fn; assemble adapters in `extension.ts`)
- [ ] **Wave 6 — Tests** inject in-memory fakes instead of vscode mocks
- [ ] **Assert core is `vscode`-free** (grep guard) + green build

## Stage 2 — Monorepo move

- [ ] Scaffold workspaces + `packages/core` + `apps/vscode-extension` (FM config shapes)
- [ ] `git mv` source into core/app; presentation/webview → core
- [ ] Single `tsconfig.base.json` paths table; **TS 4.9 → 5.x**
- [ ] Point webpack at the core webview entry; core `index.ts` barrel (named exports)
- [ ] ESLint `no-restricted-imports` app→core boundary
- [ ] `vsce package --no-dependencies`; resource-bundling mechanism settled
- [ ] Final verify: typecheck + tests + build + package + **F5 smoke**

## Pass 2 — Facelift (after Stage 2)

Apply the design refresh to the sidebar to match FrameMinion. Blocked on the
design HTML being saved to disk.

## Verification (every wave)

`npm run typecheck` (both) → `npm test` → (stage ends) `npm run build` →
`npm run package` → **F5 smoke**: sidebar, analysis, word-frequency, dictionary,
save report, settings round-trip, API key store/clear. Diff against the Stage-0
baseline — behavior identical.
