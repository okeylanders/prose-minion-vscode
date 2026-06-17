# PR Review — Stage 2: Monorepo move — @prose-minion/core + apps/vscode-extension

**Author:** okeylanders · PR #60
**Reviewed:** 2026-06-17 (pre-merge multi-agent pass — 10 reviewers + Sensei)
**Base:** `epic/monorepo-ports-and-adapters` (`ae617df`) · **Head:** `claude/funny-davinci-yqautn` (`c33a0b4`)
**Status:** ✅ **Fixups landed in `62e125f`** — every actionable finding addressed on-branch (no 🔴 blockers were raised). **Both 🟠 High fixed:** (1) F5 dev-launch repointed — `.vscode/launch.json` `extensionDevelopmentPath`/`outFiles` → `apps/vscode-extension[/dist]` (+ watch task runs in the app dir, `reveal: silent`); (2) verification gate restored — root `prepackage` = `typecheck && test` before any package, plus a new `.github/workflows/ci.yml` (typecheck+test+lint+build on push/PR — D23). **All Standards/Nits fixed** except #9 (`export *` — recharacterized, matches FM's actual barrel, no action) and #14 (informational). The D22 resource path now has an automated witness (`resourceStaging.test.ts`). Post-fixup: **315 tests / 41 suites · 3 typechecks clean · build · `npm run lint` 0 errors · gated `vsce package` VSIX (128 files, 10.44 MB)**. The original review (below) stands as the record; see **Resolution Status** at the bottom for the per-item disposition.

> ⚠️ Diff is +3241 / −915 across **338 files**, above the ~800-line focus threshold — but **294 of 338 are pure `git mv` renames** (`src/**` → `packages/core/src/**`; 7 shell files → `apps/vscode-extension/src/**`; `resources/` → `packages/core/resources/`), content-identical (`git log --follow` intact). Agent attention was weighted to the ~30 content-bearing **wiring** files (the two new `package.json`s, `tsconfig.base.json` + the 4 leaf tsconfigs, `jest.config.js`, `webpack.config.js`, `.eslintrc.json`, `copy-resources.js`, the barrel `index.ts`, `.vscodeignore`, `extension.ts`, the `AppMessagePort` seal, the rewritten `boundaries.test.ts`) plus the **unchanged** `.vscode/launch.json`/`tasks.json` (stale post-move) and the absent CI. The post-move repo was read on disk to verify behavior-preservation claims.

---

## Blast Radius

- **338 files** · **+3241 / −915** · **294 pure renames** (0 content change), ~30 content-bearing wiring files, 2 test files edited (`boundaries.test.ts` rewrite, `wordSearchDefaultsSync.test.ts` repoint).
- New files: `apps/vscode-extension/package.json` (the VS Code manifest, lifted verbatim) · `packages/core/package.json` (`@prose-minion/core`) · `apps/vscode-extension/tsconfig.json` · `apps/vscode-extension/scripts/copy-resources.js` · `apps/vscode-extension/.vscodeignore`. Removed: old root `tsconfig.json` / `tsconfig.webview.json` / `webpack.config.js` / `.vscodeignore` (cleanly, no leftovers). Migrations: **none**. New runtime services/handlers: **none** (pure structural move).
- Character: physical split into a workspace monorepo — platform-agnostic **`@prose-minion/core`** (now `vscode`-free with **no** sanctioned-shell exceptions) consumed by a thin **`apps/vscode-extension`** shell via the public barrel; a single `tsconfig.base.json` paths table (TS 5.x relative-to-defining-file resolution); jest mapper + webpack `TsconfigPathsPlugin` derived from it; an eslint `no-restricted-imports` app→core boundary; `vsce package --no-dependencies`; resources owned by core and build-copied into the app (D22). Builds on Stage 1 (ports-and-adapters, PR #59).
- Verification claimed: 313 tests / 40 suites · all 3 typechecks · both webpack bundles · `vsce package --no-dependencies` → `prose-minion-1.10.4.vsix` (128 files, 10.45 MB). **F5 smoke deferred to the author** (no interactive VS Code in CI).

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B |
| 🛡️ Security | A− |
| 🧪 Tests | B− |
| 📖 Quality | B |
| ⚡ Performance | A− |
| 🎯 Domain | B− |

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Status |
|---|----------|---------|-------------|--------|
| 1 | 🟠 High | **F5 dev-launch is broken by the move.** `.vscode/launch.json` (unchanged by the PR) sets `extensionDevelopmentPath=${workspaceFolder}` (repo root) and `outFiles=${workspaceFolder}/dist/**/*.js`, but post-move the root `package.json` has no `main`/`engines`/`contributes` and webpack writes to `apps/vscode-extension/dist/`. F5 loads no extension; breakpoints never bind. The sibling (FrameMinion) repointed both; this PR didn't. **The deferred F5 smoke — the only verification of "no behavior change" — fails at step zero.** | Marcus · Blake · Oliver · Bria · Stan · Sam (🎯🎯 Strong Consensus, 6) | ✅ Fixed in `62e125f` — fix: `extensionDevelopmentPath`/`outFiles` → `${workspaceFolder}/apps/vscode-extension[/dist/**/*.js]`. (Bria · Stan argued 🔴 Blocking; orchestrator scoped 🟠 High — shipped VSIX unaffected, dev-tooling not a runtime/data/contract failure, tests green.) |
| 2 | 🟠 High | **No automated gate before a VSIX ships.** Root `build` now delegates to app webpack only (no longer runs typecheck/test — acknowledged delta), both bundles set `transpileOnly: true`, and there is **no CI** (`.github/` = only `FUNDING.yml`). `vscode:prepublish`→`build`→`package` produces a VSIX over a type error or failing test; the only gate is a human running `npm run typecheck` + `npm test`. The most likely failure mode of a 294-rename rewire — a cross-package type regression — is exactly what the dismantled gate used to catch. | Blake · Oliver · Marcus · Parker · Tim (🎯🎯 Strong Consensus theme, 5) | ✅ Fixed in `62e125f` — fix: chain `npm run typecheck && npm test` into `vscode:prepublish`/a `prepackage` script, and/or add a minimal CI workflow. |
| 3 | 🟡 Standard | **The one true behavior risk (D22 resources) has no automated witness.** Core owns `resources/`; `copy-resources.js` stages them into the app at build; runtime reads `extensionPath/resources/...`. Every test mocks the resource loaders, so nothing proves the staged files land where the runtime expects. Correct-by-inspection today; decays the moment the copy script is edited. Deferred F5 is the only net, and no CI enforces it. | Cal (raised High) · Bria · Oliver | ✅ Fixed in `62e125f` — add a thin integration witness that resolves a real staged resource path; or gate on F5 + CI. |
| 4 | 🟡 Standard | **`copy-resources.js` silently skips symlinks.** `copyDir` branches only on `isDirectory()`/`isFile()`; a symlink entry falls through both with no warn/throw. No symlinks under `packages/core/resources/` today, but this is now the canonical staging mechanism — a future shared/symlinked resource would vanish from the VSIX with no build-time signal. | Sam | ✅ Fixed in `62e125f` — `fs.cpSync(SRC, DEST, {recursive:true})` (Node 16.7+) or an explicit `isSymbolicLink()` branch. |
| 5 | 🟡 Standard | **`tasks.json` watch task can't surface build errors.** The default build task is `npm: watch` with no `options.cwd`; it runs at repo root and forwards via `-w apps/vscode-extension`, so webpack output is wrapped by an npm layer the `problemMatcher` regex won't match, and `presentation.reveal: "never"` keeps the terminal hidden. A ts-loader/config error during watch won't reach the Problems panel. | Oliver | ✅ Fixed in `62e125f` — `options.cwd` → app dir + `reveal: "silent"` on failure. |
| 6 | 🟡 Standard | **App-side test scaffolding is half-wired.** `jest.config.js` lists `apps/vscode-extension/src` as a root "for future app-side adapter tests (none today)," but the `vscode` mock lives only in core's `setup.ts` (out of scope for app tests), and `tsconfig.test.json` `include` + jest `testMatch` are `.ts`-only — a `.tsx` app test would be neither type-checked nor discovered. The scaffolding invites a test that silently won't run. | Cal · Sam | ✅ Fixed in `62e125f` — add the `.tsx` globs + a TODO pointing at the missing app-side vscode-mock seam. |
| 7 | 🟡 Standard | **`@types/marked ^6.0.0` is vestigial in core devDeps.** `marked` self-types since v5; at `^16` the bundled declarations are authoritative. The sibling core carries **zero** devDeps. Dead weight carried forward from the pre-move root, with a duplicate-declaration risk. | Stan | ✅ Fixed in `62e125f` — drop it; TS picks up marked's own types. |
| 8 | 🟡 Standard | **Stale `jest.config.js` comment.** `testEnvironment: 'node', // 'jsdom' for React component tests later` — but 8 hook tests **already** opt into `@jest-environment jsdom` per-file. The comment misdirects a contributor into thinking jsdom isn't needed yet. | Parker | ✅ Fixed in `62e125f` — reword to describe the per-file override (or default to jsdom). |
| 9 | 🟢 Nit | **Barrel `export *` — recharacterized, not a deviation.** Marcus & Parker flagged the two `export *`s (over `@shared/types` and `@/platform`) as diverging from FrameMinion's "never `export *`" rule. **Stan read FM's actual barrel and the orchestrator confirmed it (`frame-minion-vscode/.../index.ts:23,26`): FM does the same `export *` over the same bounded namespaces.** PM faithfully mirrors the sibling's *code*; the "rule" lives only in FM's *prose*. Residual real point: `export * from '@shared/types'` auto-widens the public type surface as that module grows. | Marcus · Parker (flagged) · Stan (refuted) | ◐ Recharacterized — no action on PM; the `export *` is intentional + sibling-consistent. (FM's CLAUDE.md prose is the thing that's imprecise.) |
| 10 | 🟢 Nit | **Build-delta is documented only in the PR body.** A reader of `package.json` alone gets no hint that `build` no longer typechecks/tests; the deferral isn't in `tech-debt-and-deferred.md` either. | Marcus · Parker | ✅ Fixed in `62e125f` — one-line comment above `build` + a deferred-ledger row. |
| 11 | 🟢 Nit | **Production source maps built then excluded.** Both webpack configs hardcode `devtool: 'source-map'`; `--mode production` generates `.map`s that `.vscodeignore`'s `**/*.map` then strips — built work that never ships. | Tim | ✅ Fixed in `62e125f` — conditionally `devtool: false` for the prepublish build, or accept it. |
| 12 | 🟢 Nit | **Two ~7.8 MB runtime GIFs ship undocumented.** `.vscodeignore` explicitly excludes several README-only assets but (correctly) ships `assistant-working-*.gif` (webview loading animation). A one-line comment would tell the next auditor their inclusion is intentional, not bloat. | Patricia | ✅ Fixed in `62e125f` — add the comment. |
| 13 | 🟢 Nit | **"Identical VSIX contents" is loose wording.** The claim holds for the file *set* (dist/+resources/+assets/, src-free) and runtime behavior, but the archive's internal root changed (packaged from the app dir). Worth clarifying "same file set/sizes" vs "byte-identical/reproducible." | Bria | ✅ Fixed in `62e125f` — tighten the PR/changelog wording. |
| 14 | ↪ Informational | **Build/test costs are trivial at current scale.** `copy-resources` full wipe+recopy (~114 files / 1.2 MB, one-shot per build) and ts-jest full type-check per run (no incremental cache, 178 files) are both immeasurable today; revisit at ~2× the file count (`isolatedModules`/mtime-gating are the future moves). | Tim | ↪ Out of scope (informational) |
| P1 | 🟢 Praise | **The rewritten boundary guard is a tight living witness.** `boundaries.test.ts` catches static / namespace / `require` / dynamic `import('vscode')`, scans `.tsx`, has no stateful-regex (`/g`) bug, skips only `__tests__`, and documents the one intentional exemption (`acquireVsCodeApi()` global). The old exception list is gone because it's no longer needed. | Cal (verified) | — |
| P2 | 🟢 Praise | **VSIX exclusion is now structural, not declarative.** Moving the packaging root into `apps/vscode-extension/` means repo-root tracking dirs (`.ai`, `.memory-bank`, `.research`, `.todo`, `migration-and-facelift`, `docs`) **can't reach** the packaging root — a stronger guarantee than any `.vscodeignore` line you remember to write. | Patricia | — |
| P3 | 🟢 Praise | **Behavior-preserving at runtime and ship time.** Every load-bearing path traced clean: the composition root constructs + injects all 14 barrel imports + the `Platform` bundle; the webview bundle resolves core to source; resources stage via prepublish→build→copy; `--no-dependencies` is correct (all bundled). | Blake | — |

---

## Executive Briefing

🟠 **[Marcus · Blake · Oliver · Bria · Stan · Sam — 🎯🎯 Strong Consensus]** **F5 dev-launch is broken** — `launch.json`/`outFiles` still aim at the repo root; the extension + `dist/` moved to `apps/vscode-extension/`. The deferred F5 smoke (the only "no behavior change" verification) fails at step zero. Two-line fix.

🟠 **[Blake · Oliver · Marcus · Parker · Tim — 🎯🎯 Strong Consensus]** **No automated ship gate** — `build` ≠ typecheck, webpack `transpileOnly`, and no CI; a VSIX can ship over a type error or red test. Wire `prepublish`→typecheck+test (or add CI).

🟡 **[Cal · Bria · Oliver]** **The one true behavior risk is unwitnessed** — the D22 resource-staging path is mocked on both sides of every test; nothing proves staged resources land where the runtime reads them.

🟡 **[Stan]** **`@types/marked ^6` is dead weight** in core devDeps (`marked ^16` self-types; sibling core carries zero devDeps).

🟡 **[Cal · Sam]** **App-side test scaffolding is half-wired** — `apps/*` jest root with no `vscode` mock in scope and `.ts`-only includes; a future `.tsx` adapter test compiles-but-won't-run.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — launch.json breaks F5 on two axes and isn't tracked as a deferral [🎯🎯 Strong Consensus]

`.vscode/launch.json` — `extensionDevelopmentPath=${workspaceFolder}` resolves to the repo root, whose `package.json` has no `engines`/`contributes`/`main` (confirmed); VS Code refuses to load an extension there. Separately `outFiles=${workspaceFolder}/dist/**/*.js` watches a root `dist/` that doesn't exist — webpack writes to `apps/vscode-extension/dist/`, so breakpoints never bind even if path 1 is hand-fixed. FrameMinion explicitly repointed its launch.json at `apps/vscode-extension`; this PR defers the F5 smoke but doesn't record the launch.json prerequisite in `tech-debt-and-deferred.md`. The structure itself is clean — this is the one config that lives outside the "source being moved" mental model.

### 🟢 Nit — Barrel `export *` over `@/platform` diverges from the stated FM rule (but matches FM's code)

`packages/core/src/index.ts:29`. The FM *prose* says "never `export *`"; FM's *barrel* does it anyway over the same bounded namespaces (verified). The risk is low (8 stable port files) and the rationale is sound, but it lives only in a code comment, not a guard — a stray `export { SomethingInternal }` in a platform file would join the public API unnoticed. If FM parity matters, name-export the ports; if the divergence is accepted, record it in the ADR rather than only the comment.

### 🟢 Nit — Root `build` silently dropped its pre-build verification gate

`package.json`. Intentional and low-risk given green tests, but not recorded in the deferred ledger the team otherwise maintains diligently. A one-liner closes the gap.

> *"The structure is clean, the boundary enforcement is real, the wiring compiles — but `extensionDevelopmentPath` still points at a manifest-less workspace root, which means the thing this whole move exists to develop can't be developed with F5 until someone patches two lines."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🟠 High — F5 "Run Extension" loads nothing [🎯🎯 Strong Consensus]

Traceable: `extensionDevelopmentPath=${workspaceFolder}` = repo root; root `package.json` has none of `main`/`engines`/`contributes`/`activationEvents` (searched — not found). `outFiles=${workspaceFolder}/dist/**/*.js` references a root `dist/` that's never written; the build emits to `apps/vscode-extension/dist/`. Net: a dead/empty Extension Dev Host. **DEV-ONLY** — the VSIX ships and loads correctly (manifest, dist, resources, assets all under `apps/vscode-extension/`, `vsce package` runs from there), so 🟠 High, not 🔴 Blocking. Repoint both before anyone trusts F5.

### 🟡 Standard — Nothing catches a type error or red test before `package` ships [🎯🎯 Strong Consensus theme]

`.github/` = only `FUNDING.yml` (no workflow); `build` no longer chains typecheck/test; both webpack configs `transpileOnly: true`. `vscode:prepublish`→`build`→`package` ⇒ a VSIX with zero static gating. The wiring I traced is coherent and the suites are claimed green, so process risk, not a current bug. Chain typecheck+test into `vscode:prepublish`.

> *"The VSIX is clean and it'll install fine — but the day someone hits F5 to debug a hotfix and gets a dead host, then `vsce package`s straight past a type error because nothing's watching, that's the 3am page. Wire prepublish to typecheck+test and repoint launch.json before you call this done."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — launch.json: traced the full F5 dead-end [🎯🎯 Strong Consensus]

Step by step: `${workspaceFolder}` → repo root → VS Code reads its manifest-less `package.json` → silent no-op / "not loadable"; `outFiles` → `/repo/dist/` (confirmed absent) while webpack writes `apps/vscode-extension/dist/`; the `preLaunchTask` builds successfully into the *right* dir, so even the build working can't save the launch — the debugger looks in the wrong place. Searched for a root `dist/` symlink/redirect — not found.

### 🟡 Standard — `copy-resources.js` silently drops symlinks

`apps/vscode-extension/scripts/copy-resources.js:23`. `copyDir` handles only `isDirectory()`/`isFile()`; a symlink falls through with no warn/exit. Searched `packages/core/resources/` for symlinks — none today. But this is now the canonical staging path; a future symlinked shared resource vanishes from the VSIX with no signal and a runtime missing-file error. `fs.cpSync(..., {recursive:true})` resolves the whole tree.

### 🟢 Nit — `tsconfig.test.json`/`testMatch` are `.ts`-only for the app root

A `apps/vscode-extension/src/__tests__/*.test.tsx` would be neither type-checked (`include` is `.ts` for the app) nor discovered (`testMatch` is `.test.ts`). No `.tsx` under the app today; the "future app tests" comment invites the trap. Additive fix.

> *"Three trap doors, one already acknowledged — the F5 one is just waiting for the first `git pull` + debug session to make itself very loudly known."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — `testEnvironment: 'node'` comment says "jsdom later" — 8 tests already override to jsdom

`jest.config.js:7`. Searched `__tests__/` for `@jest-environment jsdom` — found in 8 files (`useAnalysis`, `useStreaming`, `useWordFrequencySettings`, `useModelsSettings`, `useContextPathsSettings`, `usePublishingSettings`, `useTokensSettings`, `useWordSearchSettings`). The comment says jsdom is a future concern; the suite already depends on per-file overrides. Honest version: `// Default: node; hook/component tests override per-file via /** @jest-environment jsdom */`.

### 🟢 Nit — Barrel header reads as self-contradictory against the stated rule

`packages/core/src/index.ts`. (See item 9 — Stan's sibling read resolves most of this: PM's barrel is internally consistent and matches FM's code; it's the FM *prose* "never `export *`" that's the imprecise thing.) If anything, name the public types rather than `export *`-ing all of `@shared/types`.

### 🟢 Nit — Build behavior-delta is invisible from `package.json`

`package.json:23`. A contributor reading the script alone has no hint `build` stopped type-checking. Three-second comment saves a "wait, did types stop being checked on build?" moment.

> *"The barrel comment says 'never export *' and then does it twice in the next two lines — I appreciate the optimism, but future-me is going to read that and start questioning my own sanity."* — Parker *(note: resolved by Stan — FM's barrel does the same; PM is consistent.)*

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟡 Standard — The move's highest-risk path (D22 staging) has no end-to-end test

`apps/vscode-extension/scripts/copy-resources.js`. Searched for tests covering copy-resources / the resource loaders with real paths / "D22" — not found; both loaders are mocked in every test that touches them. The suite proves message routing is correct and zero about whether staged files land where the runtime joins `extensionPath + 'resources/...'`. Correct today (verified on disk), but no automated witness against a future path refactor — and no CI to enforce the deferred F5.

### 🟡 Standard — `apps/*` jest root is scaffolded but the vscode-mock isn't

`jest.config.js:17`. Zero app-side tests today; `tsconfig.test.json` includes `apps/vscode-extension/src/**/*.ts` but the `vscode` mock lives in core's `setup.ts` (out of scope). The first adapter test that touches a `vscode` global will need a mock scaffold that doesn't exist yet. A TODO pointing at it keeps the "future" from silently shipping half-wired.

### 🟢 Praise — The boundary guard is genuinely tight

`packages/core/src/__tests__/architecture/boundaries.test.ts`. Verified against all import forms (static / namespace / `require` / dynamic `import()`); no `/g` flag so `.test()` is stateless; `/\.tsx?$/` scans the 24 presentation `.tsx` files; `SKIP_DIRS` is just `__tests__`; the `acquireVsCodeApi()` global exemption is documented. A permanent living witness, not a one-time check.

> *"Green tests on a pure rename prove the rename was pure — they do not prove the build artifact that runtime depends on lands where runtime expects it, and those are different questions wearing the same color."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟠 High — launch.json not updated; FM updated both paths [🎯🎯 Strong Consensus]

FM's monorepo move set `extensionDevelopmentPath=${workspaceFolder}/apps/vscode-extension` and `outFiles=.../apps/vscode-extension/dist/**/*.js`. PM's is unchanged from the single-package layout — two concrete breaks (manifest-less root; wrong `dist/`). A contributor who pulls and hits F5 gets a silent failure. FM's fix is two lines; no reason to ship it broken.

### 🟡 Standard — `@types/marked ^6` is vestigial alongside `marked ^16`

`packages/core/package.json:20`. FM core has **zero** devDeps; PM core carries this one. `@types/marked` was a stub for marked <5; since 5.0 marked ships its own declarations, and at `^16` those are authoritative. `^6` against `^16` risks a duplicate-identifier conflict and at minimum misleads. Drop it — TS uses marked's bundled types.

### 🟢 Nit — The `export *` "deviation" is on FM's CLAUDE.md, not PM's code

`packages/core/src/index.ts:9`. PM's two `export *`s match FM's *actual* barrel (`export * from '@messages'`/`@/platform`, same "bounded, stable" rationale). PM mirrors FM's code, not FM's prose. No action in PM; the imprecise "NEVER export *" wording is FM's to fix.

> *"We have a sibling next door who solved this exact problem fourteen months ago — I'm looking at her launch.json right now, and she updated both paths."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — ts-jest type-checks all ~178 core files every `npm test`, no incremental cache

`jest.config.js:8`. `tsBuildInfoFile` isn't wired; cold runs pay full tsc analysis each time. Manageable at 178 files / 313 tests; genuinely painful around 400–600. `isolatedModules: true` (with a separate `typecheck:test` pass) or an esbuild transform are the moves when it bites. No action today.

### 🟢 Nit — Production source maps built then `.vscodeignore`'d

`apps/vscode-extension/webpack.config.js:23`. `devtool: 'source-map'` on both configs; `--mode production` generates `.map`s that the VSIX strips. ~1–5 s of map generation that never ships. Conditionally disable for the prepublish build, or accept it.

### 🟢 Nit — `copy-resources` full wipe+recopy is one-shot and trivial

`apps/vscode-extension/scripts/copy-resources.js:40`. 114 files / 1.2 MB, ~10–30 ms, runs once per build (not per webpack recompile in watch). Not a problem at this scale; mtime-gating would be premature.

> *"Three real costs, two of them trivial at 178 files and 1.2 MB — check back when either number doubles."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Nit — Two ~7.8 MB runtime GIFs ship without a `.vscodeignore` note

`apps/vscode-extension/.vscodeignore:30-35`. The file excludes several README-only assets but ships `assistant-working-*.gif` (referenced by `ProseToolsViewProvider` for the loading animation) — correct, but a reader can't tell intentional-runtime-asset from bloat. One comment closes it. Theoretical, not exploitable. (The `copy-resources` `rmSync` runs on a fully hardcoded path — no env/argv/stdin — so it's not attacker-influenceable.)

### 🟢 Praise — The VSIX boundary is structural now

`apps/vscode-extension/.vscodeignore:1-2`. Repo-root tracking dirs (`.ai`/`.memory-bank`/`.research`/`.todo`/`migration-and-facelift`/`docs`) live outside the app dir, so `vsce` running there can't see them — moving the packaging root made the exclusion impossible-to-misconfigure rather than remember-to-list.

> *"The VSIX boundary is clean — what can't reach the packaging root can't reach the installer, which is a better guarantee than any `.vscodeignore` line you remember to write."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — Type errors build clean; no CI gate [🎯🎯 Strong Consensus theme]

`apps/vscode-extension/webpack.config.js:43`. `transpileOnly: true` ships JS regardless of type correctness; `build` runs no typecheck/test; searched `.github/workflows/` — only `FUNDING.yml`. A cross-package type regression (the most likely failure of a 294-rename rewire) yields a green build, a packaged VSIX, and a runtime crash the developer back-traces through source maps to find what `tsc` would have flagged at the commit. `prebuild`→typecheck+test, or a minimal workflow, closes it.

### 🟠 High — F5 Extension Dev Host loads nothing, opaquely [🎯🎯 Strong Consensus]

`.vscode/launch.json:9`. Beyond the broken paths (item 1), the *failure is silent*: VS Code gives no "your `extensionDevelopmentPath` is stale" signal — you get a blank Dev Host and a debugging session to figure out why. Two-line fix; the diagnosability is the SRE concern.

### 🟡 Standard — Watch task's problemMatcher won't surface webpack errors

`.vscode/tasks.json:4`. No `options.cwd`, so the task runs at root and forwards via `-w`; the npm layer prefixes lines the `problemMatcher` regex won't match, and `reveal: "never"` hides the terminal. A real build error during watch never reaches the Problems panel. `cwd` → app dir + `reveal: "silent"` on failure.

> *"'The extension host is running' and the sidebar is empty — see you at the retro, bring the launch.json."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — The deferred acceptance gate (F5 smoke) will fail before it can validate anything [🎯🎯 Strong Consensus]

The PR's only human-in-the-loop verification of "no behavior change" is the deferred F5 smoke (sidebar · analysis · craft-guides · settings round-trip · …). But `extensionDevelopmentPath=${workspaceFolder}` points at a manifest-less root, so the extension never starts — the gate fails at step zero, before a single craft-guide or settings round-trip can be exercised. *Is the intent to repoint launch.json as part of the deferred smoke setup, or was it expected to work as committed?*

### 🟡 Standard — Even with the path fixed, watch stages resources once

`.vscode/tasks.json`. `npm run watch` = `copy:resources && webpack --watch`, so `copy-resources` runs at watch *start* only; a `packages/core/resources/` edit mid-session (read from disk at runtime, not bundled) won't reflect until watch restarts. Dev-ergonomics gap, not a VSIX gap (build/package re-stage fresh). Intentional, or should a resource-watcher ride alongside webpack?

### 🟢 Nit — "Identical VSIX contents" is loose

The claim holds for the file *set* + runtime behavior (`context.extensionUri` resolves `resources/` correctly), but the archive's internal root changed. Clarify "same file set/sizes," not "byte-identical," so a future auditor doesn't read it as "reproducible build."

> *"The ticket says 'no behavior change' and the code agrees — but the one human who has to verify that is about to run F5 into a wall, which is a behavior change in the experience of discovering there's no behavior change."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Map Is Not the Territory's Tooling

Illuminated by: the F5 consensus (6 reviewers); the D22 staging path

We build a mental model of "the thing being changed" — here, "source code being moved" — and our care flows perfectly inside that boundary and stops dead at its edge. `launch.json`, `tasks.json`, and the build pipeline aren't source; they're the apparatus that *points at* source, so they fell outside the frame even as 294 renames executed flawlessly. A relocation isn't done when the files arrive; it's done when everything that *references* their old location has been re-aimed.

→ Carry forward: When you move or rename anything, ask "what points *at* this?" before "what's *inside* this?" — grep the old path across configs, CI, launch/debug files, and docs, not just imports.

### Lesson 2 — A Removed Net Is a Change, Not a Subtraction

Illuminated by: the build-gate theme (5 reviewers); the unwitnessed staging path

Root `build` quietly stopped running typecheck+test, `transpileOnly` waved off the compiler, and CI is absent — each felt like simplification, but removing a safety mechanism is an active change to the system's failure modes. The cruelest part is the timing: a 294-rename rewire's single most likely failure is a cross-package type regression — exactly the class the dismantled gate caught. We account for what we add and treat what we remove as free; a net's whole value is invisible until the day you fall.

→ Carry forward: When you take out a check, name what now catches the thing it used to catch. If the answer is "I'll remember to run two commands," that's a wish, not a net.

### Lesson 3 — "No Behavior Change" Is a Claim That Demands a Witness

Illuminated by: the D22 resource staging; "every test mocks the loaders"

"Pure structural move, no behavior change" is one of the most confident things an engineer can say — and confidence is precisely where verification quietly goes missing. The one path that *could* change behavior is the one path no test exercises, because both sides are mocked. Correct-by-inspection-today and correct-by-construction-tomorrow are different states; the first decays the moment someone edits the copy script.

→ Carry forward: For every "this doesn't change behavior," point at the test that goes red if you're wrong. If the risky seam is mocked on both sides, that's not proof of safety — it's the absence of a witness.

### Lesson 4 — Trust the Sibling's Source, Not Its Sermon

Illuminated by: the `export *` self-correction (two flagged, a third read the actual barrel)

Two careful reviewers flagged a "convention violation" against FrameMinion's documented "never `export *`" — and both were wrong, because the rule lived only in FM's prose; its barrel does the same `export *`. Documentation is a snapshot of intent; code is what's true now, and the two drift the instant nobody reconciles them. The most expensive deviations are the imaginary ones, conjured by trusting a doc over the source it describes.

→ Carry forward: Before enforcing or copying a "documented convention," open the code and confirm it still obeys. When prose and source disagree, the source is the fact and the prose is the bug.

### Lesson 5 — A Decision Log Earns Its Keep by Also Logging the Deferrals

Illuminated by: the D1–D22 tracker (praised) meeting the deferred-F5 gap (consensus)

The decision tracker is a genuine strength — auditable reasoning, exactly the discipline we want more of. But a log that records every *decision* and goes silent on what was *postponed* creates a dangerous asymmetry: the recorded calls look complete, so the deferred F5 and the unwitnessed staging path hide in the negative space. A deferral you don't write down isn't deferred — it's forgotten with extra steps.

→ Carry forward: Give the log a "Deferred / Unverified / Trusted-by-hand" section with equal weight. The point isn't to do everything now — it's to make the gaps *visible* gaps, not absences disguised as completeness.

> *"Care is not a floodlight that fills a room; it's a flashlight that brightens wherever you happen to be pointing it — and mastery is less about holding the beam steadier than about remembering, again and again, to sweep it toward the corners you've decided aren't part of the room."* — Sensei

---

## The Closer

### 🐾 If this MR were an animal…

…it would be a **hermit crab moving into a bigger shell.** It transfers itself into a roomier, better-organized home with extraordinary care — every appendage accounted for, each of the 294 belongings logged on the way in (D1–D22). The new shell is sound and it will live in it just fine. But it left the forwarding address painted on the *old* shell — `launch.json` still directs anyone knocking to the empty former home — and it molted its old armor (the build-time test gate) before confirming the new plating had hardened. Beautiful relocation. Update the address and grow the shell back before the next tide.

---

## Summary

This is a careful, unusually well-documented structural move, and the **shipped artifact is sound** — the panel traced the VSIX/runtime/webview paths clean and the move is genuinely behavior-preserving (313 tests green both sides, composition root fully wired, boundary guard tightened into a real living witness). The problems are not in what was moved but in the **tooling that points at it and the safety net that used to guard it**: `.vscode/launch.json` + `tasks.json` were left aimed at the pre-move root (🎯🎯 6-reviewer consensus), so the deferred F5 smoke — the only verification of the whole "no behavior change" claim — will fail at launch; and `build` no longer typechecks/tests while `transpileOnly` + zero CI mean a VSIX can ship over a type error (🎯🎯 5-reviewer consensus). Both are two-to-three-line fixes. Beneath them sits a tidy cluster of Standards (the unwitnessed D22 staging path, the symlink-skipping copy script, the half-wired app-test scaffold, the vestigial `@types/marked`) and Nits. **Recommendation:** not a 🔴 blocker, but **repoint `launch.json`/`outFiles`, restore a verification gate (prepublish chain or a minimal CI workflow), and run the F5 smoke before merge** — then this is a clean Stage 2. Nearly there.

---

## Resolution Status

All fixups in **`62e125f`** (same branch, `claude/funny-davinci-yqautn`). Post-fixup: **315 tests / 41 suites · 3 typechecks clean · `npm run build` · `npm run lint` 0 errors · gated `vsce package` VSIX (128 files, 10.44 MB)**.

- **#1 🟠 F5 dev-launch — ✅ Fixed.** `.vscode/launch.json`: `extensionDevelopmentPath` + `outFiles` → `${workspaceFolder}/apps/vscode-extension[/dist/**/*.js]` (mirrors FrameMinion). The smoke can now launch.
- **#2 🟠 Ship gate — ✅ Fixed.** Root `prepackage` = `npm run typecheck && npm test` (npm runs it before `package`), so a type error / red test blocks the VSIX. Added `.github/workflows/ci.yml` (typecheck + test + **lint** + build on push/PR) — also CI-enforces the app→core import boundary. (Decision D23.)
- **#3 🟡 D22 witness — ✅ Fixed.** `packages/core/src/__tests__/architecture/resourceStaging.test.ts`: stages the real `packages/core/resources` via the same `fs.cpSync` the script uses, then reads a prompt back through the **real** `PromptLoader` over a Node-fs `FileSystem`, plus a file-count parity check. A copy-script or loader-path regression now goes red.
- **#4 🟡 Symlink-safe copy — ✅ Fixed.** `copy-resources.js` → `fs.cpSync(SRC, DEST, { recursive: true, dereference: true })` (resolves symlinked resources to real files in the staged output).
- **#5 🟡 Watch task — ✅ Fixed.** `tasks.json` watch now sets `options.cwd` → the app dir (webpack output no longer npm-wrapped) and `presentation.reveal: "silent"` so build errors surface.
- **#6 🟡 App test scaffold — ✅ Fixed.** jest `testMatch` + `tsconfig.test.json` include `.tsx`; a comment in `jest.config.js` flags the missing app-side `vscode` mock for the first adapter test, and a tech-debt row tracks it.
- **#7 🟡 `@types/marked` — ✅ Fixed.** Dropped from core devDeps (marked ^16 self-types; verified the 3 typechecks pass without it). Core now carries zero devDeps, matching the sibling.
- **#8 🟡 Stale jest comment — ✅ Fixed.** Reworded to describe the per-file `@jest-environment jsdom` override.
- **#9 🟢 `export *` — ◐ No action (recharacterized).** Confirmed PM mirrors FrameMinion's actual barrel over the same bounded namespaces; the "never `export *`" rule lives only in FM's prose. Left intentional + sibling-consistent.
- **#10 🟢 Build-delta visibility — ✅ Fixed.** `package.json` is strict JSON (no inline comment possible), so the delta is recorded in `CHANGELOG-DETAILED.md` (Behavior delta) + a `tech-debt-and-deferred.md` row, and is now **mitigated** by the #2 gate.
- **#11 🟢 Prod source maps — ✅ Fixed.** webpack `devtool: false` under `--mode production` (dev/watch keeps maps). Surfaced + fixed an adjacent gap: PM had **no clean step**, so stale `*.map` lingered — added `scripts/clean-dist.js`, wired into the app `build`.
- **#12 🟢 GIF note — ✅ Fixed.** `.vscodeignore` now documents that `assistant-working-*.gif` ship intentionally (the loading animation).
- **#13 🟢 Wording — ✅ Fixed.** Changelog now says "same file set" with identical runtime behavior, not "byte-identical/reproducible."
- **#14 ↪ Informational — not actioned** (build/test costs trivial at this scale; `isolatedModules`/mtime-gating revisited at ~2× file count).

**Still open (by design):** the **author F5 smoke** — now unblocked by #1; no interactive VS Code in CI, so it remains the human acceptance step.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
