# Status — Prose Minion Migration & Facelift

**Branch:** `pass-2/design-facelift` · **Last updated:** 2026-06-17
**Health:** 🟢 green — **Stage 1 COMPLETE** (core is `vscode`-free) · **Stage 2 COMPLETE** (monorepo move, all 5 waves) · **PR #60 review fixups LANDED**. Current release target: VS Code app manifest `2.0.0`; `@prose-minion/core` is stamped `2.0.0` to match. **Pass 2 facelift: Wave 1 (React 18) ✅ + Wave 2 (account surface) ✅ + Wave 3 (sidebar reskin + All Tools picker) ✅ green** — 339 tests / 45 suites · 3 typechecks · build + `verify:bundle` · lint 0-err. F5 smoke for Wave 2 (live balance fetch) + Wave 3 (visual reskin) handed to the author.

## PR #60 review fixups (2026-06-17)

Multi-agent review (`docs/pr-reviews/pr-60-stage-2-monorepo-move-review.md`) — no 🔴 blockers; every actionable finding addressed on-branch:

- 🟠 **F5 launch** repointed to `apps/vscode-extension` (the smoke would have failed at step zero); watch task runs in the app dir + `reveal: silent`.
- 🟠 **Gate restored** — root `prepackage` = `typecheck && test`; new `.github/workflows/ci.yml` (D23).
- **D22 witness** — `resourceStaging.test.ts` proves staged resources resolve through the real loader (+2 tests).
- copy-resources `fs.cpSync` (symlink-safe) + new `clean-dist.js`; prod `devtool:false`; dropped `@types/marked`; jest `.tsx` globs + app-mock TODO; `.vscodeignore` GIF note; changelog wording.
- `export *` finding = no action (matches FM's actual barrel; recharacterized).

**Post-smoke regression fix (F5 found it):** the F5 smoke caught a real Stage-2 regression the review missed — webview **Tailwind utilities were purged** (textareas lost `w-full`/`h-32`). Cause: the move changed the build cwd (root → app dir) and Tailwind resolves its config from `process.cwd()` → found none → default empty-content → purged everything (webpack still "compiled successfully"). Fixed: absolute `__dirname` content glob + explicit Tailwind config path in the webpack `postcss-loader` (`config: false`). **Guard added:** `scripts/verify-bundle.js` fails the production build + CI if sentinel utilities are absent from `webview.js`. Lesson 3 in action — the one unwitnessed delivery path (CSS) is where "behavior-identical" broke; now witnessed.

## Pass 2 Wave 3 — sidebar reskin + All Tools picker (2026-06-17)

Adopted FrameMinion's design language from the handoff bundle. Author calls
(2026-06-17): **theme-adaptive** (FM is the source of truth — `--pm-*` tokens
derived from `--vscode-*`, like FM's `sidebar-design-tokens`; the desktop app
will map a Kimbie-style palette later), coral kept as PM's one fixed brand
accent; balance widget reworked to a **full in-flow dropdown** (pill→strip), not
the Wave-2 popup; Assistant **decluttered** to 3 primary buttons + All Tools.
Landed in three green sub-waves:

- **3a — foundation + chrome** (`1b183bf`): `--pm-*` token layer (scoped to
  `.app-container`); ported the handoff's Lucide icons to a typed `Icon`
  component (38 glyphs); top utility strip (title + settings gear); FM header
  band with white logo tile (coral skull mark) + coral accent line; balance
  `AccountBalancePill` (header) + `AccountBalanceStrip` (in-flow, below header),
  expand state lifted to App; `TabBar` gained `variant` ('cards' | 'segment') +
  React-node icons — main nav is now icon-above-label coral-ringed cards, sub-tabs
  a segmented control.
- **3b — tab bodies** (`bf570bf`): retheme the existing class vocabulary onto
  `--pm-*` (design brief = match visual output, not prototype structure) — inset
  rounded mono inputs with coral focus, card containers, coral-gradient primary
  buttons, accent-soft icon buttons, inset **monospace result panels** with FM
  tables (mono, zebra, accent numerics), chips, metric rows, mono-eyebrow labels.
- **3c — All Tools modal** (_this commit_): `AllToolsModal` guide-style picker
  (grouped icon-tile cards) over PM's REAL tools — the 12 `WritingToolsFocus`
  values + the 2 focused dialogue variants + prose, each wired to the existing
  `handleAnalyzeDialogue`/`handleAnalyzeProse`/`handleAnalyzeWritingTools`
  handlers (focus strings are compiler-guarded by the union types). Assistant now
  shows 3 primary buttons + an "All tools" button; the full grid moved into the
  modal.

**No component tests** added — consistent with the project's lightweight ethos
(React components deferred to v1.0); type-checking guards the tool→focus wiring.
**F5 owed (visual):** confirm the reskin under both a light and a dark VS Code
theme (the tokens are theme-adaptive), the balance pill→strip disclosure, the
icon-above-label tab cards, and the All Tools modal launching each analysis.

## Pass 2 Wave 2 — account surface (2026-06-17)

OpenRouter balance + last-request cost, built as a new vertical slice mirroring
FrameMinion's ADR-010 chassis, trimmed to PM's reality (OpenRouter-only, single
webview, `LogSink` not `LoggingService`). Author chose: **credits + key
spend-limit** (collapsed pill discloses all limits with a refresh, per the design
chevron) and **debounced auto-refresh** after each AI request.

- **Infra (`packages/core/src/infrastructure/account/`):** `OpenRouterAccountClient`
  (`/key` + `/credits`, `AbortSignal.timeout`, sanitized results — no key/raw body
  escapes), `AccountBalanceService` (120s TTL cache, concurrent-fetch coalescing,
  forced-refresh rate-limit, 10s trailing-debounce `scheduleRefresh` + listener
  fan-out for OpenRouter's eventually-consistent billing).
- **Messages:** `accountBalance.ts` (single-provider `OpenRouterBalance`),
  `REQUEST_ACCOUNT_BALANCE` / `ACCOUNT_BALANCE_DATA`; `lastRequestCostUsd` added to
  the `TOKEN_USAGE_UPDATE` payload (distinct from cumulative `totals.costUsd`).
- **Handler/wiring:** `AccountBalanceHandler` (thin, never throws); `MessageHandler`
  owns the service (PM has one webview), records last-request cost in
  `applyTokenUsage`, arms the debounced refresh on real requests, and broadcasts
  refreshed balances via a registered listener; disposed cleanly. Reset
  (`ConfigurationHandler`) now also clears `costUsd` + `lastRequestCostUsd` (fixed a
  latent cumulative-cost-not-reset gap while there).
- **Webview:** `useAccountBalance` (mount fetch · refresh-on-key-configured ·
  manual refresh), `AccountBalanceWidget` (collapsed pill + disclosed panel +
  spinner refresh), `balanceFormat` headline helper; last-request cost threaded
  from `useTokenTracking`. Themed with `--vscode-*` vars — **the Wave-3 reskin
  moves it into the warm-brown FM design language + final header slot.**
- **Tests (+4 suites / +24):** client (fetch-mocked parsing, no-key, 403,
  malformed, timeout), service (cache/coalesce/partial-failure/no_key/debounce/
  dispose), handler (routes + post + never-throw), hook (mount/refresh/data/
  key-transition).
- **F5 not run here** (no interactive VS Code / live OpenRouter key in this loop) —
  handed to the author: open sidebar → confirm the balance widget fetches a real
  number, expand it for the key-limit detail, run an analysis and watch the
  balance tick down after ~10s, and check "Last request $X" updates per request.

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
| P2 | Wave 0 — orientation + design artifact fetch | ✅ done (Claude link 403/auth-gated; local handoff zip inspected) | — |
| P2 | Wave 1 — React 17 → 18 + React 18 test harness | ✅ done (315 tests / 41 suites · 3 typechecks · build + verify:bundle) | `c79d8c7` |
| P2 | Wave 2 — OpenRouter balance + last-request cost | ✅ done (339 tests / 45 suites · 3 typechecks · build + verify:bundle · lint 0-err) | `6f9710d` |
| P2 | Wave 3 — sidebar facelift + All Tools picker | ✅ done (3a chrome `1b183bf` · 3b bodies `bf570bf` · 3c modal _this commit_) | — |

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
- **Tests:** 339 passing / 45 suites (incl. PR #60 review fixups + Pass-2 Wave-2 account slice)
- **Ports done:** all seven — `LogSink` ✅, `SecretStore` ✅, `SettingsStore` ✅, `FileSystem` ✅,
  `Workspace` ✅, `EditorContext` ✅, `ShellService` ✅
- **Platform bundle:** assembled in `extension.ts`, threaded provider → MessageHandler

## Notes for the next session (resume point)

- **NEXT: Pass 2 — Wave 4 (final verify + docs)** per [plan.md](plan.md): full gate vs the
  baseline, `verify:bundle`, package/CI confidence, and the F5 smoke handoff (Wave 2 live
  balance + Wave 3 reskin under light AND dark VS Code themes). Then the facelift is done.
- **Deferred design follow-ups (not Wave 3):** the full-tab Assistant directions (A/B/C — the
  "Assistant as a real editor tab" with conversation thread / split-pin / branch board) remain
  a separate, later product decision per the handoff. Optional reskin polish not yet touched:
  streaming/loading panels, context-preview, settings overlay still use `--vscode-*` directly
  (functional, just not retokenized).
- **Wave 3 done (sidebar reskin + All Tools picker).** See the "Pass 2 Wave 3" section above.
  Author preferences honored: theme-adaptive `--pm-*` (FM as source of truth), balance widget
  as a full in-flow pill→strip dropdown (not the popup), Assistant decluttered to 3 primary +
  All Tools modal.
- **Wave 2 done (account surface).** See the "Pass 2 Wave 2" section above. **Author F5 still
  owed:** confirm the balance widget fetches a real number against a live OpenRouter key, the
  panel shows the key-limit detail, the balance auto-refreshes ~10s after an analysis, and
  "Last request $X" updates per request.
- **Stage 2 is COMPLETE** (all 5 waves green + pushed; final verify matches the Wave-0
  baseline). The author F5 smoke found + fixed the Tailwind purge regression (guarded by
  `verify-bundle`).
- **Deferred (logged, not lost):** logging + AI-alias modernization (FM's `@ai`/`@logging`
  barrels + `LoggingService` + `outputChannel`→`logger`) — Pass 2 or a focused follow-up. Note:
  the Wave-2 account slice intentionally uses `LogSink` (no `LoggingService` yet), so it'll ride
  that modernization when it lands.
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
