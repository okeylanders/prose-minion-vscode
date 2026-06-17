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

## Stage 1 — Extract ports in-place (behavior-preserving) ✅ COMPLETE

> Core is `vscode`-free (guarded by a test). 304 tests · both typechecks · both bundles · `vsce package` clean. F5 smoke deferred to the reviewer (no interactive VS Code in CI).

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
- [x] **Wave 4 — `ShellService` + `EditorContext`** (dialogs/clipboard/open-in-editor + selection)
  — `EditorContext` + most of `ShellService` rode Wave 3 pt 2; `ConfigurationHandler`'s one
  `showInformationMessage` finished it
- [x] **Wave 5 — Wiring** — `MessageHandler` config-watcher → shell (vscode-free `affects()`
  predicate into `handleConfigurationChange`); `webview.postMessage` → injected `post` fn;
  dead `extensionUri` param + `Disposable[]` field removed; provider owns the watcher.
  `extension.ts` needed no change (platform already assembled there)
- [x] **Wave 6 — Tests** — handler tests already inject fakes (Wave 3 pt 2); added the boundary guard
- [x] **Assert core is `vscode`-free** — `coreVscodeFree.test.ts` (2 sanctioned shells only) + green build + `vsce package`

## Stage 2 — Monorepo move ✅ COMPLETE (2026-06-17 — all waves green + pushed; author F5 smoke pending)

- [x] **Extract `AppMessagePort` (webview-side)** — ✅ Wave 1. `presentation/webview/ports/AppMessagePort.ts`
  is the canonical `{ postMessage, getState, setState }` seam; `VSCodeAPI extends AppMessagePort`
  (27 consumers untouched); `useVSCodeApi` is the named VS Code adapter and the ONLY module
  referencing the `acquireVsCodeApi()` global (index.tsx routes through its exported
  `getVSCodeApi()`). Done *before* the move so `presentation/webview` carries no VS Code
  renderer assumption into core. (Review finding — Marcus.)
- [x] **TS 4.9 → 5.x** (✅ Wave 2, in-place) — bumped to `^5.3` (resolved 5.9.3) +
  `ignoreDeprecations: "5.0"` in both tsconfigs; zero code changes; matrix green. Required
  for the shared base paths table.
- [x] Scaffold workspaces + `packages/core` + `apps/vscode-extension` — ✅ Wave 3
- [x] `git mv` source into core/app; presentation/webview → core — ✅ Wave 3 (313 pure renames, `--follow` intact)
- [x] Single `tsconfig.base.json` paths table (TS 5.x bumped in Wave 2) — ✅ Wave 3
- [x] Point webpack at the core webview entry; core `index.ts` barrel (named exports) — ✅ Wave 3
- [x] ESLint `no-restricted-imports` app→core boundary — ✅ Wave 4 (rule fires; lint 0 errors)
- [x] `vsce package --no-dependencies` (resource bundling settled = D22) — ✅ Wave 4 (VSIX ships dist+resources+assets, src-free)
- [x] Final verify: typecheck + tests + build + package — ✅ Wave 5 (3 typechecks · 313 tests · VSIX 128 files, matches Wave-0 baseline). **F5 smoke** handed to the author (no interactive VS Code in CI).

## Pass 2 — Facelift (after Stage 2)

Apply the design refresh to the sidebar to match FrameMinion. The Claude Design
link was attempted first and returned a Cloudflare/403 auth wall; the local
handoff bundle in `.temp/Prose Minion-handoff.zip` unblocked the sidebar design
inspection. The full VS Code tab remains out of scope until the design is ready.

- [x] **Wave 0 — orient + fetch artifacts** — read migration docs; attempted the
  Claude Design URL via tooling; inspected the local handoff bundle.
- [x] **Wave 1 — React 18 foundation** — runtime `createRoot`, React 18 deps,
  and test harness moved from `@testing-library/react-hooks` to
  `@testing-library/react`.
- [ ] **Wave 2 — account surface** — OpenRouter balance from real `/credits`
  data plus last-request cost display from existing `TokenUsage.costUsd`.
- [ ] **Wave 3 — sidebar reskin + tools picker** — FrameMinion-style header,
  tab chrome, cards/results, and an All Tools modal that preserves existing PM
  tool actions.
- [ ] **Wave 4 — final verify + docs** — full gate, `verify:bundle`, package/CI
  confidence, and F5 smoke handoff.

## Verification (every wave)

`npm run typecheck` (both) → `npm test` → (stage ends) `npm run build` →
`npm run package` → **F5 smoke**: sidebar, analysis, word-frequency, dictionary,
save report, settings round-trip, API key store/clear. Diff against the Stage-0
baseline — behavior identical.
