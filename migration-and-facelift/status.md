# Status — Prose Minion Migration & Facelift

**Branch:** `epic/monorepo-ports-and-adapters` · **Last updated:** 2026-06-17
**Health:** 🟢 green — **Stage 1 COMPLETE** (core is `vscode`-free) · **Stage 2 COMPLETE** (monorepo move, all 5 waves) · **PR #60 review fixups LANDED** (315 tests / 41 suites · 3 typechecks · build · lint 0-err · VSIX). **F5 smoke passed and caught one post-move Tailwind regression; that regression is fixed and now guarded by `verify-bundle`.** Current release target: VS Code app manifest `2.0.0`; `@prose-minion/core` is stamped `2.0.0` to match. Next: Pass 2 facelift.

## PR #60 review fixups (2026-06-17)

Multi-agent review (`docs/pr-reviews/pr-60-stage-2-monorepo-move-review.md`) — no 🔴 blockers; every actionable finding addressed on-branch:

- 🟠 **F5 launch** repointed to `apps/vscode-extension` (the smoke would have failed at step zero); watch task runs in the app dir + `reveal: silent`.
- 🟠 **Gate restored** — root `prepackage` = `typecheck && test`; new `.github/workflows/ci.yml` (D23).
- **D22 witness** — `resourceStaging.test.ts` proves staged resources resolve through the real loader (+2 tests).
- copy-resources `fs.cpSync` (symlink-safe) + new `clean-dist.js`; prod `devtool:false`; dropped `@types/marked`; jest `.tsx` globs + app-mock TODO; `.vscodeignore` GIF note; changelog wording.
- `export *` finding = no action (matches FM's actual barrel; recharacterized).

**Post-smoke regression fix (F5 found it):** the F5 smoke caught a real Stage-2 regression the review missed — webview **Tailwind utilities were purged** (textareas lost `w-full`/`h-32`). Cause: the move changed the build cwd (root → app dir) and Tailwind resolves its config from `process.cwd()` → found none → default empty-content → purged everything (webpack still "compiled successfully"). Fixed: absolute `__dirname` content glob + explicit Tailwind config path in the webpack `postcss-loader` (`config: false`). **Guard added:** `scripts/verify-bundle.js` fails the production build + CI if sentinel utilities are absent from `webview.js`. Lesson 3 in action — the one unwitnessed delivery path (CSS) is where "behavior-identical" broke; now witnessed.

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
| P2 | Design facelift | ⬜ next (design refresh starting from this integration branch) | — |

## Stage 2 — wave tracker (resumable; pick up from the first ⬜)

> Each wave lands green (both typechecks · 313 tests · both webpack bundles) + committed + pushed.
> Sequencing approved by author 2026-06-17 (see decision-tracker D22 for the resource call).

| Wave | Scope | Status | Commit |
|---|---|---|---|
| 0 | Branch/baseline confirm; lock resource (D22) + logging-defer decisions | ✅ done | `d571959` |
| 1 | **AppMessagePort** (webview port, in-place, pre-move) — plan task #1 | ✅ done | `874b4d5` |
| 2 | **TS 4.9 → 5.x** (D10, in-place) | ✅ done (→ TS 5.9.3, zero code changes) | `41af823` |
| 3 | **The move** — `git mv` core/app split; `tsconfig.base.json` paths; core barrel; shell imports→barrel; rewrite boundary guard; resources→`packages/core/resources` + copy script | ✅ done (A `fe0e6cb` pure-mv · B `7777119` wiring) | — |
| 4 | **Packaging + boundary** — `vsce package --no-dependencies` (D13); eslint `no-restricted-imports` app→core; verify VSIX ships resources | ✅ done | _this commit_ |
| 5 | **Final verify + docs** — full matrix vs Wave-0 baseline; F5 smoke handoff; doc tick | ✅ done | _this commit_ |

**Wave 0 baseline (the diff target):** 313 tests / 40 suites · extension+webview typechecks CLEAN · webpack both bundles (`extension.js` + `webview.js` 484 KiB, size-warnings only) · `vsce package` deferred (not installed; `@vscode/vsce` added to app devDeps in Wave 3).

**Stage 2 end-state (matches baseline):** 3 typechecks CLEAN (core host · core webview · app) · 313 tests / 40 suites · app webpack both bundles · `vsce package --no-dependencies` → clean VSIX (128 files / ~10.45 MB; `dist/` + `resources/` + `assets/`, `src/`-free) · `npm run lint` 0 errors. **F5 smoke passed locally:** sidebar loads · run an analysis · word-frequency report · dictionary lookup · save a report · settings overlay round-trip · API key store/clear · the right-click "Analyze/Word Lookup selection" editor commands · craft-guides/prompts load from the staged `resources/` (proves D22 packaging).

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

- Historical Stage 1 gate: `npm test` → **304 / 304** (37 suites) · `npm run typecheck` (both) → clean ·
  `webpack --mode production` (both bundles) → clean · `vsce package` built clean (no `src/`, no tracking docs).
- Current Stage 2 gate: 315 tests / 41 suites · 3 typechecks · app build with `verify-bundle` · lint 0 errors · gated VSIX.
- ✅ **F5 smoke PASSED** (author ran locally 2026-06-17) — sidebar, analysis, word-frequency,
  dictionary, save report, settings round-trip, API key store/clear all working, **and the
  Settings-UI → webview broadcast** (the relocated config watcher) confirmed. The containment
  guard didn't break guide/resource opening. Stage 1 is fully verified and merge-ready.

## Metrics

- **vscode imports remaining in core:** **0** (was 37 at Stage-0). VS Code imports now live only in
  `apps/vscode-extension/src/extension.ts`, `ProseToolsViewProvider.ts`, and `platform/vscode/**`.
  Guarded by `packages/core/src/__tests__/architecture/boundaries.test.ts`.
- **Tests:** 315 passing / 41 suites (incl. PR #60 review fixups)
- **Ports done:** all seven — `LogSink` ✅, `SecretStore` ✅, `SettingsStore` ✅, `FileSystem` ✅,
  `Workspace` ✅, `EditorContext` ✅, `ShellService` ✅
- **Platform bundle:** assembled in `extension.ts`, threaded provider → MessageHandler

## Notes for the next session (resume point)

- **Stage 2 is COMPLETE** (all 5 waves green + pushed; final verify matches the Wave-0
  baseline). The author F5 smoke is complete and found the Tailwind purge regression; the fix
  landed with an automated `verify-bundle` witness.
- **Next: Pass 2 — Design Facelift.** Start from this integration branch. Per
  `tech-debt-and-deferred.md`, the FIRST action when Pass 2 starts is to actually attempt the
  fetch of the "Prose Minion – Design Refresh" (share links / bundle / chat thread) via
  `WebFetch`/`WebSearch` before assuming it's auth-gated. React 17 → 18 rides with Pass 2.
- **Deferred (logged, not lost):** logging + AI-alias modernization (FM's `@ai`/`@logging`
  barrels + `LoggingService` + `outputChannel`→`logger`) — Pass 2 or a focused follow-up.
- **Wave 4 done — packaging + boundary verified.** `vsce package --no-dependencies` → clean
  `prose-minion-1.10.4.vsix` (128 files / 10.45 MB) shipping `dist/` + `resources/` (all 4
  subdirs, copy-staged from core) + runtime `assets/`, **`src/`-free**. `npm run lint` = 0
  errors (469 pre-existing warnings). The eslint app→core boundary FIRES (a deep `@/`-import in
  a shell file errors with the barrel message). Fixed a Wave-3 slip: an illegal `"//"` key inside
  the eslint `overrides[0]` (schema-invalid) was removed.
- **Wave 3 done — the monorepo move is GREEN.** Structure now: `packages/core` (vscode-free,
  consumed via the `@prose-minion/core` barrel) + `apps/vscode-extension` (the 7 shell files +
  manifest + webpack). Single `tsconfig.base.json` paths table; TS 5.9.3; resources owned by
  `packages/core/resources` and copy-staged into the app for the VSIX (D22). All three typechecks
  clean, 313/313 tests, both webpack bundles. The build/test commands now run from the workspace
  root (`npm test`, `npm run typecheck`, `npm run build`) or per-workspace (`-w apps/vscode-extension`).
- **Behavior delta to note:** root `npm run build` now delegates to the app's webpack only
  (it no longer runs test+typecheck first, as the pre-move single-package `build` did). Run
  `npm test` + `npm run typecheck` explicitly (or in CI). Net coverage unchanged.
- Push target is `epic/monorepo-ports-and-adapters` (run `npm install` on a fresh container —
  workspaces relink `@prose-minion/core`).
- Reference chassis: FrameMinion at `../frame-minion-vscode`.
