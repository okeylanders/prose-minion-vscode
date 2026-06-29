# PR Review — Stage 1: ports-and-adapters — core is now vscode-free

**Author:** okeylanders · PR #59
**Reviewed:** 2026-06-17 (pre-merge multi-agent pass — 10 reviewers + Sensei)
**Base:** `epic/monorepo-ports-and-adapters` (`78c504a`) · **Head:** `claude/vigilant-cannon-jma748` (`9f313a0`)
**Status:** ✅ Addressed in `32c7ed2` — **No blockers, merge-ready.** 15 of 18 actionable findings fixed on-branch (both consensus themes — boundary-guard width #1/#17 and the "single source of truth" formatter gap #2 — fully closed); the user approved the security harden-now (#6/#7). **F5 smoke run locally 2026-06-17 — clean** (closes #16; #8's untitled edge is low-risk happy-path-clean). **2 deferred with rationale**: #14 (constructor-callback seam → Stage-2 interface lock), #19 (perf nit). 313 tests green / both typechecks / both bundles. See **Resolution Status** below.

> ⚠️ Diff is 2069 lines (above the ~800-line focus threshold) — agent attention was weighted to the highest-churn files (`MessageHandler.ts`, `TextSourceResolver.ts`, `UIHandler.ts`, `FileOperationsHandler.ts`, the new tests). The pre-existing `src/platform/vscode/*` adapters (not in the diff) were read to verify the behavior-preservation claims.

---

## Blast Radius

- **28 files** · **+734 / −382**
- New files: **3** — `src/__tests__/architecture/coreVscodeFree.test.ts` (boundary guard) · `src/__tests__/infrastructure/text/TextSourceResolver.test.ts` · `src/shared/constants/wordSearchDefaults.ts` · New test files: 2 · Migrations: **none** · New runtime services: **none** (pure refactor)
- Character: four file-handling handlers (`FileOperationsHandler`, `UIHandler`, `SourcesHandler`, `MetricsHandler`/`SearchHandler`) + `TextSourceResolver` + the config-change watcher lifted off `vscode` onto injected platform ports (`FileSystem` / `Workspace` / `ShellService` / `EditorContext` / `SettingsStore`); `MessageHandler.webview` field → injected `post` fn; `MessageHandler`'s `onDidChangeConfiguration` watcher relocated to the shell behind a vscode-free `affects(section)` predicate; WordSearch defaults centralized into one constant; one test-enforced architectural boundary added.
- Verification claimed: 304/304 tests (37 suites) · both typechecks · both webpack bundles · `vsce package` clean. **F5 smoke NOT run** (no interactive VS Code in CI).

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B+ |
| 🛡️ Security | B+ |
| 🧪 Tests | B− |
| 📖 Quality | B |
| ⚡ Performance | A− |
| 🎯 Domain | B |

---

## Status by item

| # | Severity | Finding | Reviewer(s) | Status |
|---|----------|---------|-------------|--------|
| 1 | 🟡 Standard | **Boundary guard narrower than its claim**: `coreVscodeFree.test.ts` regex misses dynamic `import('vscode')`; doesn't cover the webview's `acquireVsCodeApi()` coupling; single-witness file vs the sibling's multi-invariant registry | Cal · Marcus · Stan (🎯🎯 Strong Consensus) | ✅ Fixed in `32c7ed2` (regex catches dynamic import; `acquireVsCodeApi()` gap named at the test site, closed in Stage-2) |
| 2 | 🟡 Standard | **"Single source of truth" incomplete**: `wordSearchFormatter.ts:37` + `categorySearchFormatter.ts:41` still hardcode `?? 7 / ?? 150 / ?? 3` — the values the PR says never shipped; centralization missed the display/hydration layer | Stan · Bria (🎯 Consensus) | ✅ Fixed in `32c7ed2` (both formatters read `WORD_SEARCH_DEFAULTS` + fallback-path test) |
| 3 | 🟡 Standard | `ToolOptionsProvider.getWordSearchOptions()` has **no test**, so the `minClusterSize 3→2` "straggler fix" is unverified (safe in the shipped extension only because `package.json` supplies `2`) | Cal (raised High; orchestrator-moderated → Standard) | ✅ Fixed in `32c7ed2` (`ToolOptionsProvider.test.ts` pins `minClusterSize === 2`) |
| 4 | 🟡 Standard | No guard test pins `WORD_SEARCH_DEFAULTS` to `package.json`'s contributed defaults — the constant's own comment admits "must be kept in sync by hand"; a ~6-line fixture test makes drift a CI failure | Cal | ✅ Fixed in `32c7ed2` (`wordSearchDefaultsSync.test.ts`) |
| 5 | 🟡 Standard | **"Strictly behavior-preserving" vs D16**: `asRelativePath(path, false)` drops the workspace-folder prefix in multi-root workspaces (saved-file toast). Disclosed in the decision tracker; the top-line claim doesn't carry the caveat | Bria | ✅ Fixed in `32c7ed2` (caveat surfaced at the claim in `readme.md`) |
| 6 | 🟡 Standard | `UIHandler.handleOpenResource`: `path.join(workspaceRoot, resourcePath)` from a webview/AI-model-supplied payload, **no containment guard**. Pre-existing (old `Uri.joinPath` didn't guard either); the string-path rewrite was the moment to add the sibling's `safeRelativeSegments()` | Patricia | ✅ Fixed in `32c7ed2` (`isPathWithinRoot` guard; user-approved harden-now) |
| 7 | 🟡 Standard | `UIHandler.handleOpenGuideFile`/`handleOpenDocsFile`: `path.join(extensionPath, …, payload)` with no containment; the `stat` existence check is **not** a containment guard | Patricia | ✅ Fixed in `32c7ed2` (both joins guarded by `isPathWithinRoot`) |
| 8 | 🟡 Standard | **Untitled-document `activeFile` edge**: `selection.fsPath` round-tripped through `Uri.file()` forces `file:` scheme, which may diverge from the old direct-URI path for an unsaved buffer. Needs the deferred F5 to confirm whether the old path actually succeeded | Sam (raised High; orchestrator-moderated → Standard, verify in F5) | ◐ F5 happy-path clean; untitled-buffer edge low-risk (old path likely also failed), not a merge blocker — spot-check if unsaved-buffer analysis becomes a supported flow |
| 9 | 🟡 Standard | `TextSourceResolver.test.ts` has **no `chapters`-mode coverage** — the structurally-identical sibling of the tested `manuscript` path, reading a different settings key (`contextPaths.chapters`) | Sam | ✅ Fixed in `32c7ed2` (chapters-mode block added) |
| 10 | 🟡 Standard | `MessageHandler` has both an injected field `post` (raw transport) AND a method `postMessage` (logging wrapper). The next contributor wiring a handler can grab the unwrapped `post` and silently bypass logging | Parker | ✅ Fixed in `32c7ed2` (`post` → `transport` + warning comment) |
| 11 | 🟡 Standard | `handleOpenResource`'s payload field renamed `path`→`resourcePath` to dodge shadowing the `path` module, but `path.join(workspaceRoot, resourcePath)` still echoes it; `relativePath` would describe the value and drop the echo | Parker | ✅ Fixed in `32c7ed2` (`resourcePath` → `relativePath`) |
| 12 | 🟡 Standard | `FileOperationsHandler` save-then-open is a silent black hole: `catch { /* silently ignore */ }` around `openFileInEditor` with no log line; the adapter now does more (`openTextDocument`+`showTextDocument`), widening the throw surface. Pre-existing | Oliver | ✅ Fixed in `32c7ed2` (injected `LogSink`; failure logged, still best-effort) |
| 13 | 🟡 Standard | `void (async IIFE)` config broadcasts in `handleConfigurationChange` drop `sendModelData`/`handleRequestSettingsData` rejections silently. Pre-existing (moved verbatim); a `.catch(appendLine)` makes the watcher's failures diagnosable | Oliver | ✅ Fixed in `32c7ed2` (`.catch(logBroadcastError)` on all three) |
| 14 | 🟡 Standard | `handleConfigurationChange(affects)` is a **public method** — a wider seam than the sibling's constructor-callback pattern (any handler holder can feed a synthetic predicate). Worth sealing before the Stage-2 interface lock | Marcus | ⏸️ Deferred (Stage-2 interface lock — provider↔handler wiring reshaped by the move; in-process the provider is the only caller) |
| 15 | 🟡 Standard | `findFilesAcrossWorkspaces` reads matched files sequentially (`for … await readFileUtf8`) — unchanged by this PR, invisible at manuscript scale; a `Promise.all` is the out-of-scope follow-up | Tim | ↪ Out of scope (informational) |
| 16 | 🟢 Nit | The most behaviorally-sensitive change — the **config-watcher relocation** — is verified only by the **deferred F5 smoke**; no automated integration test wires the provider's `onDidChangeConfiguration` through to the broadcast logic | Bria · Blake · Marcus (🎯 Consensus) | ✅ Confirmed via F5 (author ran it locally 2026-06-17; Settings-UI round-trip + guide/resource open clean) |
| 17 | 🟢 Nit | `coreVscodeFree.test.ts` is a single-`it` witness; the sibling keeps a multi-invariant `boundaries.test.ts` registry ("add your seam's witness here"). A rename + comment pays forward | Stan (relates to #1) | ✅ Fixed in `32c7ed2` (renamed → `boundaries.test.ts`, registry comment) |
| 18 | 🟢 Nit | `wordSearchDefaults.ts` comment overclaims its own sync mechanism ("keep these equal" with no map); point at the `package.json` keys by name or the test that pins them | Parker | ✅ Fixed in `32c7ed2` (comment names the keys + the sync test) |
| 19 | 🟢 Nit | Boundary guard reads ~134 production `.ts` files synchronously (`fs.readFileSync`) per run — O(repo), immeasurable against Jest startup today; switch to a ripgrep subprocess if the repo hits thousands of files | Tim | ⏸️ Deferred (perf nit — immeasurable at current scale) |
| 20 | ↪ Withdrawn | `configWatcher` "leak" — Sam flagged it not being in `context.subscriptions`. Reconciled against Blake/Marcus: the **dispose path is unchanged** from the prior code (both old and new dispose via `webviewView.onDidDispose`). **Not a regression** | Sam (withdrawn on orchestrator self-consistency pass) | ↪ Withdrawn |
| P1 | 🟢 Praise | Refactor is genuinely behavior-preserving and fully wired at the composition root (all seven ports incl. `shell`/`editor` constructed; ctor arg orders match; `FileType` enum byte-compatible; watcher lifecycle clean — disposed before re-register AND on dispose) | Blake | — |
| P2 | 🟢 Praise | Per-call `await import()` + fresh allocation eliminated by the D15 shared singleton — removes three module-registry lookups + allocations per metrics/search action and a now-false "dynamic import to avoid cyclic deps" comment | Tim | — |
| P3 | 🟢 Praise | The boundary guard is a meaningful supply-chain/portability control — narrows the blast radius of any future host-API issue to the adapter layer and encodes the invariant in CI, not reviewer memory | Patricia | — |
| P4 | 🟢 Praise | `createFakeFileSystem` throws on unseeded `stat`/`readFile` — matches the sibling FrameMinion fail-loud mock convention beat-for-beat; a forgetful test fails loud, not false-green | Stan | — |
| P5 | 🟢 Praise | Every `[ConfigWatcher]` log line survived the relocation **verbatim** — none dropped; the watcher's diagnosability is fully preserved | Oliver | — |

---

## Executive Briefing

**No blockers. No high-severity findings.** The top actionable signals are the two consensus items (the panel's highest-confidence signal):

- 🟡 **[Cal · Marcus · Stan 🎯🎯 Strong Consensus]** The boundary guard is narrower than the claim it backs. `coreVscodeFree.test.ts` misses dynamic `import('vscode')`, ignores the webview's `acquireVsCodeApi()` coupling, and is a single-witness file where the sibling project keeps a multi-invariant registry.
- 🟡 **[Stan · Bria 🎯 Consensus]** "Single source of truth" is incomplete — two formatters (`wordSearchFormatter.ts:37`, `categorySearchFormatter.ts:41`) still hardcode the old `?? 7 / 150 / 3`, the exact values the PR says never shipped.
- 🟡 **[Cal]** `ToolOptionsProvider.getWordSearchOptions()` has no test, so the `minClusterSize 3→2` "straggler fix" is unverified (safe in the shipped extension only because `package.json` supplies `2`).
- 🟡 **[Bria]** "*Strictly* behavior-preserving" carries an undisclosed-at-the-top asterisk: the D16 `asRelativePath(path, false)` change alters the saved-file path display in multi-root workspaces.
- 🟢 **[Bria · Blake · Marcus]** The one seam CI cannot cover — the relocated config watcher — is verified only by the deferred F5 smoke. Run it once before merge.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### ⏳ Open — 🟡 Standard — `handleConfigurationChange` is a public push-in, a wider seam than a ctor callback

`src/application/handlers/MessageHandler.ts` — D20 achieves vscode-freedom cleanly, but exposing `handleConfigurationChange(affects)` as a *public method* means any holder of the handler can feed a synthetic predicate and trigger `refreshServiceConfiguration()` / broadcasts. The sibling FrameMinion pattern injects the watcher registration as a constructor callback, sealing the seam. Not a blocker — but worth migrating to the callback shape before the Stage-2 monorepo move locks the interface.

### ⏳ Open — 🟡 Standard — the guard backs a "portable core" claim it doesn't fully cover [🎯🎯 Strong Consensus w/ Cal · Stan]

`src/__tests__/architecture/coreVscodeFree.test.ts` is green and accurate *within its scope*, but `src/presentation/webview/hooks/useVSCodeApi.ts` still calls `acquireVsCodeApi()` — a renderer global the guard doesn't scan. The "core is vscode-free" title reads wider than the test asserts. Correctly tracked as the deferred Stage-2 `AppMessagePort` item in `plan.md`; the gap deserves a comment at the test site, not only in the plan.

> *"The boundary is now real and verifiable — a genuine structural achievement — but the guard and the 'portable' claim are one step ahead of the webview's `acquireVsCodeApi` coupling, the one seam that will surprise the Stage-2 move if it isn't made explicit where it fails."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

**No blocking findings.** Walked every candidate: watcher lifecycle (disposed before re-register AND on dispose; closure reads the current handler — no leak, no double-register), the injected `post` fn (same try/catch failure semantics as the old `webview.postMessage`), the `vscode.Uri → string` path joins (all roots are absolute `fsPath`; `path` module not shadowed), `FileSystem.writeFile`'s mkdir-p (a superset of the deleted explicit `createDirectory`), and the config-watcher relocation (verbatim logic — same keys, same echo guards, same 50ms delay). `FileType` matches `vscode.FileType` exactly. Nothing produces data loss, a runtime exception, or a broken contract in production.

### ⏳ Open — 🟢 Praise — Composition root + adapters fully wired; refactor is genuinely behavior-preserving [P1]

`src/extension.ts` assembles all seven ports incl. the new `shell: new VsCodeShellService()` / `editor: new VsCodeEditorContext()`, so no `platform.shell`/`platform.editor` NPE (which the fake-injecting test suite could not have caught). Constructor argument orders match the diff'd signatures exactly.

> *"The only thing that can still bite is the one thing CI can't see — F5 it once and confirm a Settings-UI change round-trips to the webview, because the relocated watcher is the single seam no test exercises end-to-end."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### ⏳ Open — 🟡 Standard (raised High; orchestrator-moderated) — untitled-document `activeFile` edge

`src/infrastructure/text/TextSourceResolver.ts` (editor fallback `return selection.fsPath`). For an *unsaved* buffer, `fsPath` is a synthetic slug (`/Untitled-1`); reading it routes through `VsCodeFileSystem` → `vscode.Uri.file()`, forcing `file:` scheme → a path that was never on disk. The old code passed `editor.document.uri` (preserving the `untitled:` scheme) directly. **Orchestrator note:** the old path likely *also* failed (`workspace.fs.readFile` on an `untitled:` URI is not generally supported), so this is at minimum an error-message divergence and possibly a regression — exactly what the deferred F5 should confirm.

### ⏳ Open — 🟡 Standard — `chapters` mode has no test coverage

`src/__tests__/infrastructure/text/TextSourceResolver.test.ts` covers `selection`/`activeFile`/`manuscript` but has no `chapters` block. `resolveChapters` is structurally identical to the tested `resolveManuscript` but reads a *different* settings key (`contextPaths.chapters`); a miswired key wouldn't be caught.

*Orchestrator reconciliation (item #20):* Sam also raised a `configWatcher` leak (not in `context.subscriptions`). On review against Blake/Marcus, the **dispose path is unchanged from the prior code** — the old watcher was also disposed only via `webviewView.onDidDispose` (through `MessageHandler.dispose()`). **Not a regression; withdrawn.**

> *"The trap door is `selection.fsPath` — looks like a path, smells like a path, but for an untitled buffer it's `Uri.file()`-bait the filesystem has never seen."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### ⏳ Open — 🟡 Standard — `post` vs `postMessage`: a two-level naming trap

`src/application/handlers/MessageHandler.ts` now has a private field `post` (injected raw transport) AND a method `postMessage` (the logging/caching wrapper that calls `this.post`). Handlers receive `this.postMessage.bind(this)`. The next contributor wiring a handler has a coin-flip chance of grabbing the unwrapped `post` and silently bypassing the logging the wrapper exists to guarantee. Rename the field (`transport` / `sendToWebview`) so the dangerous one is unmistakable.

### ⏳ Open — 🟡 Standard — `resourcePath` rename dodges the shadow but keeps the echo

`src/application/handlers/domain/UIHandler.ts` correctly renamed the payload `path`→`resourcePath` to stop shadowing the `path` module — but `path.join(workspaceRoot, resourcePath)` still reads like joining two absolute paths. `relativePath` would describe the value *and* drop the module-name echo.

### ⏳ Open — 🟢 Nit — `wordSearchDefaults.ts` comment overclaims its own safety

"Must be kept in sync by hand" gives the reader no map. Point at the `package.json` keys by name, or note the test that pins it — so drift is a one-line grep, not a memory test.

> *"It works — and the `affects` predicate threading is clean — but whoever adds the next handler will spend real time wondering whether to pass `this.post` or `this.postMessage`, and the answer is buried 300 lines below the question."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### ⏳ Open — 🟡 Standard (HIGH confidence on the gap) — the `minClusterSize 3→2` change has no test

`src/infrastructure/api/services/shared/ToolOptionsProvider.ts` `getWordSearchOptions()` has zero unit coverage (the only caller mocks it). The PR's "straggler bug fix" `3→2` is correct *because* `package.json` contributes `2` — but that reasoning is narrative, not pinned. A regression back to `3` (or a stripped manifest in a source build) would ship silently.

### ⏳ Open — 🟡 Standard — no guard test for the `WORD_SEARCH_DEFAULTS` ↔ `package.json` hand-sync

The constant's own comment admits the JSON "must be kept in sync by hand." A fixture test reading `package.json` and asserting equality is ~6 lines and converts a human chore into a CI failure. The sibling project pins exactly these invariants.

### ⏳ Open — 🟡 Standard — boundary-guard regex misses `import('vscode')` [🎯🎯 Strong Consensus w/ Marcus · Stan]

Verified empirically: the regex matches static `import`/`require` but returns false for `import('vscode')` / `await import('vscode')` — and D15 notes a *prior* `TextSourceResolver` used precisely that dynamic-import idiom. One-line fix: add `|import\s*\(\s*['"]vscode['"]\s*\)`.

> *"The edge case we never test is always the one that gets copy-pasted into production at 4 PM on a Friday and silently ships the wrong cluster size to everyone on a source build."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### ⏳ Open — 🟡 Standard — two formatter escapees still run the old defaults [🎯 Consensus w/ Bria]

`src/presentation/webview/utils/formatters/wordSearchFormatter.ts:37` and `categorySearchFormatter.ts:41` still hardcode `?? 7 / ?? 150 / ?? 3` — display fallbacks for the Criteria line of every saved report. The shipped defaults are `3 / 50 / 2`. If an `options`-less payload ever arrives, the report prints values that contradict the extension, the webview hook, AND `package.json`. The FrameMinion lesson: the analogue constant is consumed at *every* hydration site — the formatter layer is a hydration site.

### ⏳ Open — 🟢 Nit — `coreVscodeFree.test.ts` is a single-witness file [🎯🎯 Strong Consensus theme w/ Cal · Marcus]

The sibling keeps a multi-invariant `boundaries.test.ts` registry — a living "add your seam's witness here" home. A rename + a `// add new architectural invariants here` comment costs nothing and pays forward when the Electron port lands.

### ⏳ Open — 🟢 Praise — `createFakeFileSystem` throws on unseeded paths [P4]

Matches FrameMinion's fail-loud mock convention beat-for-beat (throw on unseeded `stat`/`readFile`, `readDirectory` → `[]`, writes succeed). Standard applied, not invented — keeps the suite honest.

> *"Two formatter files are still running on the old defaults. The single source of truth is not yet single."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### ⏳ Open — 🟢 Praise — D15 singleton eliminates three per-action dynamic imports [P2]

The old code did `await import(...)` + `new TextSourceResolver(...)` at three call sites per metrics/search action; the new code builds one instance at composition. Microseconds at current scale, but it removes three redundant module-registry lookups + allocations per user action and deletes a now-false "dynamic import to avoid cyclic deps" comment.

### ↪ Out of scope — 🟡 Standard — sequential file reads in `manuscript`/`chapters` are unchanged

`src/infrastructure/text/TextSourceResolver.ts`: `for (...) await readFileUtf8(...)` is serial — invisible on a local FS at manuscript scale (20–80 files), and unchanged by this PR. A `Promise.all` is the natural follow-up but is correctly out of scope for a behavior-preserving pass.

### ⏳ Open — 🟢 Nit — boundary guard reads ~134 files synchronously per run

Immeasurable against Jest startup today. Fine until the repo hits thousands of files (then a ripgrep subprocess is a one-liner).

> *"The per-call dynamic-import cost — three registry lookups and three allocations per action — removed cleanly; the sequential reads were already there and still don't matter on a local FS."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### ⏳ Open — 🟡 Standard — `handleOpenResource` joins a webview/AI-supplied path with no containment

`src/application/handlers/domain/UIHandler.ts`: `path.join(workspaceRoot, resourcePath)` where `resourcePath` flows extension→webview→extension from the **AI model's tool-use output**. A prompt-injected `../../.ssh/id_rsa` in an analyzed document could open a file outside the workspace (read-only, in the editor — no write/exfil, which bounds severity). **Pre-existing** (the old `Uri.joinPath` didn't guard either) — but the string-path rewrite was the natural moment to add the sibling's `safeRelativeSegments()` / `isPathWithinRoot()`, and it wasn't taken.

### ⏳ Open — 🟡 Standard — guide/docs open: `stat` is not a containment check

`handleOpenGuideFile`/`handleOpenDocsFile` join payload paths onto `extensionPath`; the existence `stat` only prevents "not found" — a traversal to a real file passes it and proceeds to open. Same pre-existing class; same cheap-now fix.

### ⏳ Open — 🟢 Praise — the boundary guard is a real supply-chain control [P3]

Keeping `vscode` out of core narrows the blast radius of any future host-API issue to the adapter layer, and encodes an architectural invariant in CI rather than in reviewer memory.

> *"The stat check proves the file exists, not that it belongs where the caller assumed — existence at a traversed path is the traversal, not a defense against it."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### ⏳ Open — 🟡 Standard — save-then-open is a silent black hole

`src/application/handlers/domain/FileOperationsHandler.ts`: `try { await this.shell.openFileInEditor(absolutePath); } catch { /* silently ignore */ }`. Pre-existing, but the adapter now does *more* (`openTextDocument` + `showTextDocument`), widening the throw surface. User sees "Saved" but the file silently never opens, with zero Output-channel trace. One `appendLine` in the catch closes it.

### ⏳ Open — 🟡 Standard — `void (async IIFE)` config broadcasts drop rejections

In `handleConfigurationChange`, a `sendModelData()`/`handleRequestSettingsData()` throw before the post escapes the `void` with no catch — "settings changed but the webview didn't update, and nothing in the log says why." Pre-existing (moved verbatim); a `.catch(err => appendLine(...))` would make the watcher's failures diagnosable.

### ⏳ Open — 🟢 Praise — config-watcher logs preserved verbatim [P5]

Every `appendLine('[ConfigWatcher] …')` from the original inline watcher appears in the new `handleConfigurationChange` at a matching position. None dropped.

> *"The save worked, the file didn't open, and the Output channel has nothing — see you at the retro where we explain why 'silently ignore' means 'silently debug.'"* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### ⏳ Open — 🟡 Standard — "single source of truth" doesn't hold for the display layer [🎯 Consensus w/ Stan]

The claim is true for the three runtime sites, but the two formatters still carry `7/150/3`, and the formatter *tests* assert those old values — cementing the inconsistency rather than catching it.

### ⏳ Open — 🟡 Standard — "strictly behavior-preserving" vs the D16 multi-root delta

`asRelativePath(path, false)` forces single-root semantics; a multi-root user's saved-file toast now drops the folder prefix it showed yesterday. Documented in the decision tracker (D16) — but the top-line "strictly behavior-preserving" claim doesn't carry the caveat where a reader meets it.

### ⏳ Open — 🟢 Nit — the most behaviorally-sensitive change is verified only by a deferred F5 [🎯 Consensus w/ Blake · Marcus]

The config-watcher relocation has no integration test wiring the provider's registration through to the broadcast logic (it's pure `vscode` shell). The structural audit is clean; the F5 belongs on the merge checklist as an explicit gate.

> *"'Core is vscode-free' is technically correct — and yet the webview still calls `acquireVsCodeApi()`, two formatters still carry `?? 7 / 150 / 3`, and a multi-root user sees a shorter save path than yesterday; all disclosed, but 'strictly behavior-preserving' is doing more load-bearing work than the term usually carries."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — A Source of Truth Has Read-Sites, Not Just a Write-Site

Illuminated by: Stan + Bria consensus (#2); Cal's sync-guard finding (#4)

Declaring a constant "the single source of truth" centralizes only the *write* — where the value is born. A value's truth is the union of everywhere it's *read*, and a stale `?? 7` fallback is still authoritative the instant the real value is absent. Centralization is a graph operation, not a declaration.

→ Carry forward: after centralizing a default, grep for the *old literals* and the `??`/`||` idiom across the whole tree — "single source of truth" is a claim you must falsify before you write it in a comment.

### Lesson 2 — A Guard Is a Claim, and It Must Be As Wide As the Claim It Backs

Illuminated by: Cal + Marcus + Stan strong consensus (#1)

A test named `coreVscodeFree` advertises an invariant; it enforces only what its assertions cover. When the regex catches `import` but not `import('vscode')`, and ignores `acquireVsCodeApi()`, the green check actively *reassures* future contributors about cases it never checked. A guard narrower than its name is worse than none — it manufactures false confidence.

→ Carry forward: when you write an invariant test, enumerate every form the violation could take (static import, dynamic import, renderer global, transitive re-export) and either cover it or name the gap *in the test* — then ask "could a computer verify what I'm asking a human to remember?"

### Lesson 3 — "Behavior-Preserving" Is a Measurement, Not a Vibe

Illuminated by: Bria (#5, #16); Sam (#8)

The moment a refactor crosses a boundary — multi-root path formatting, `Uri.file()` scheme coercion, a relocated watcher — "strictly behavior-preserving" acquires exceptions the top-line summary smooths over. A delta disclosed three layers down is documented, but not *visible* where the claim is made.

→ Carry forward: when you assert "no behavior change," immediately write the sentence "…except:" and see what honesty forces you to append. A non-empty list belongs next to the claim, not beneath it.

### Lesson 4 — The Refactor That Touches a Line Inherits Its Sins

Illuminated by: Patricia (#6, #7); Oliver (#12, #13)

"It was already unguarded" is true but incomplete — once you rewrite `path.join(root, userPath)`, you're the author of record, and the string-path rewrite is the *exact* moment a containment guard becomes cheap. Carrying a flaw forward verbatim is a decision even when it looks like inaction.

→ Carry forward: when a refactor rewrites a security- or failure-sensitive line, ask "is this the cheapest this fix will ever be?" — and if you defer, *say so* (a `// TODO: containment`) rather than letting silence imply safety.

### Lesson 5 — Two Names for Two Things at One Seam Is a Trap for the Next Contributor

Illuminated by: Parker (#10, #11)

Naming at a boundary isn't about each identifier being correct; it's whether the *pair* makes the wrong choice hard to make. `post` and `postMessage` are individually defensible and collectively a tripwire — guess wrong and you silently bypass the logging wrapper.

→ Carry forward: when two similar names share a seam, ask "if a newcomer guessed, which would they grab, and what breaks silently if they guess wrong?" — then make the dangerous one harder to reach.

> *"The green check is a promise to whoever reads it next, and the kindest thing you can do for that future stranger — usually you — is make the promise exactly as wide as the words you wrapped around it."* — Sensei

---

## The Closer

### ⭐ Yelp Review — 4 / 5 stars

Ordered the **"core, hold the `vscode`"** and it arrived exactly as plated — every port wired, the kitchen clearly tasted it before it left (304 tests, zero blockers), and the dynamic-import grease was scraped right off the pan. Took one star because the menu boasted "single source of truth" yet two side dishes came seasoned with the old `7/150/3` recipe, and the "strictly behavior-preserving" special hides an asterisk the waiter only mentions if you ask about multi-root. **Would absolutely return for Stage 2** — just bring the F5 smoke test to the table and weatherstrip the boundary guard so the "vscode-free" sign on the door actually covers the back entrance.

---

## Summary

Stage 1 lands the ports-and-adapters boundary as a **real, test-enforced seam with zero blocking issues** and genuine behavior preservation on the `file://` norm — confident, mergeable work, and a clean foundation for the Electron port. Before merge, the cheap wins are two one-line formatter fixes (close the "single source of truth" gap two reviewers independently caught) and tightening the boundary guard that a three-agent consensus called narrower than its name. The one thing CI can't hand you is the **F5 smoke on the relocated config watcher** — run it once, and this is a clean merge.

---

## Resolution Status

Fixups landed in **`32c7ed2`** on `claude/vigilant-cannon-jma748` (313 tests · both typechecks · both bundles).

**✅ Fixed (15):**
- **#2 / #18 [consensus]** — `wordSearchFormatter.ts` + `categorySearchFormatter.ts` now read `WORD_SEARCH_DEFAULTS` (the never-shipped `7/150/3` literals gone); a fallback-path test asserts the criteria line prints `3/50/2`; the constant's comment names the `package.json` keys + the sync test.
- **#1 / #17 [strong consensus]** — guard renamed `coreVscodeFree.test.ts` → `boundaries.test.ts` (registry shape, "add invariants here"); regex extended to catch dynamic `import('vscode')`; the `acquireVsCodeApi()` Stage-2 gap is now spelled out at the test site, not just in the plan.
- **#3** — `ToolOptionsProvider.test.ts` pins `getWordSearchOptions().minClusterSize === 2` (+ defaults fall-through + seeded-wins).
- **#4** — `wordSearchDefaultsSync.test.ts` reads `package.json` and fails CI on any drift from `WORD_SEARCH_DEFAULTS`.
- **#5** — the `readme.md` "behavior-preserving" line now carries the two disclosed exceptions (D16 multi-root toast; the new containment rejection).
- **#6 / #7** — `isPathWithinRoot` (`src/infrastructure/storage/pathContainment.ts`, unit-tested) guards all three `UIHandler` open-file joins. **User-approved harden-now**; folds into FrameMinion's shared helper at Stage 2.
- **#9** — `TextSourceResolver.test.ts` gained a `chapters`-mode block (distinct `contextPaths.chapters` key).
- **#10** — `MessageHandler.post` → `transport` + a comment warning the wrapped `postMessage` is the one handlers get.
- **#11** — `resourcePath` → `relativePath`.
- **#12** — `FileOperationsHandler` takes a `LogSink`; the swallowed `openFileInEditor` failure is logged (still best-effort, no user error).
- **#13** — the three `handleConfigurationChange` broadcasts `.catch(logBroadcastError)` to the Output channel.

**✅ Confirmed via F5 (author ran locally 2026-06-17 — clean):**
- **#16** — config-watcher relocation works end-to-end (Settings-UI change broadcasts back to the webview); guide/resource open confirms the new containment guard didn't break the happy path.
- **#8** — happy-path clean; the untitled-buffer edge wasn't specifically exercised but is low-risk (the old `untitled:`-URI read likely also failed) — marked ◐, not a blocker.

**⏸️ Deferred (with rationale — originally tracked in `.todo/archive/epics/epic-migration-and-facelift-2026-06-16/tech-debt-and-deferred.md`; active follow-ups now live in `.todo/tech-debt/` and `.todo/features/`):**
- **#14** — public `handleConfigurationChange` → constructor-callback seam: do it at the **Stage-2 interface lock** (the provider↔handler wiring is being reshaped by the monorepo move anyway; in-process the provider is the only caller, so the wider seam is safe meanwhile).
- **#19** — boundary-guard sync file reads: immeasurable at current scale; ripgrep-subprocess swap is a one-liner if the repo grows.

**↪ Out of scope / withdrawn:** #15 (sequential reads — unchanged, behavior-preserving pass), #20 (watcher "leak" — withdrawn; dispose path unchanged).

**Merge gate:** ✅ clear — F5 smoke passed locally; no owed items remain.

_Original pre-fixup table preserved above with per-row `✅/⏸️` dispositions + the `32c7ed2` sha._

**Recommended pre-merge (cheap, high-signal):**
- [ ] #2 — point `wordSearchFormatter.ts:37` + `categorySearchFormatter.ts:41` at `WORD_SEARCH_DEFAULTS` (and update the formatter tests off `7/150/3`).
- [ ] #1 / #17 — add `import('vscode')` to the boundary-guard regex; consider renaming the file to `boundaries.test.ts` with an "add invariants here" comment + a note on the `acquireVsCodeApi()` Stage-2 gap.
- [ ] #4 — add the ~6-line `package.json` ↔ `WORD_SEARCH_DEFAULTS` sync fixture test.
- [ ] #3 — add a `ToolOptionsProvider.getWordSearchOptions()` test pinning `minClusterSize === 2`.
- [ ] #16 — run the F5 smoke (sidebar load, analysis, word-frequency, dictionary, save report, settings round-trip, API key store/clear, **and a Settings-UI change broadcasting back to the webview**) and record the result.

**Worth a decision (cheap, or consciously defer with rationale):**
- [ ] #9 — add a `chapters`-mode test to `TextSourceResolver.test.ts`.
- [ ] #10 / #11 — rename `MessageHandler.post` → `transport` (or similar); rename `resourcePath` → `relativePath`.
- [ ] #12 / #13 — add a `logger.appendLine` to the swallowed `openFileInEditor` catch and the `void (async IIFE)` config broadcasts.
- [ ] #6 / #7 — add containment (`safeRelativeSegments`-style) to the `UIHandler` path joins, or file as tracked tech-debt with rationale.
- [ ] #14 — consider the constructor-callback seam for the config watcher before the Stage-2 interface lock.
- [ ] #5 / #8 / #18 / #19 — disclose the multi-root delta at the claim; confirm the untitled-doc edge in F5; tighten the `wordSearchDefaults.ts` comment; (the sync-read boundary test is fine as-is at current scale).

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
