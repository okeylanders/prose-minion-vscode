# PR #183 — Lightbox / Draft Edit aggregate integration review

## Scope and disposition

- **PR:** [#183 — integrate Lightbox, saved boards, and Draft Edit](https://github.com/okeylanders/prose-minion-vscode/pull/183), draft, `epic/lightbox` → `main`.
- **Reviewed head:** `688d4a72fb84cb6d618ece4c4765cfb95cdbc353`.
- **Base:** `d1f25db2a93ee8e6831c22937b728b98b0a2c06e`.
- **Reviewed:** 2026-10-28, independently against the aggregate diff, not merely by accepting earlier slice reviews.
- **Scope:** GitHub reports 566 commits and 1,720 changed files, +243,595 / −3,238. The tree diff includes 404 production-source paths, 339 test paths, and substantial documentation, prompts, and visual evidence. Local history is shallow (515 reachable commits), but the verified base/head and aggregate tree diff match the remote PR.
- **Disposition: changes requested in this report.** F-01, F-02 and F-03 remain open. Green existing tests and CI do not cover these independent counterexamples.

This is a local report-only review, not a formal GitHub approval/request-changes review. Opening the draft PR was authorized. No source fixes, merge, auto-merge, release, deployment, paid inference, or report publication was performed.

## Findings

### F-01 — P2: preserve resolved Markdown reference destinations when correcting prose

**Locations:** `packages/core/src/utils/draftEdit/markdownInlineRegions.ts:105–113`; `packages/core/src/utils/draftEdit/markdownStructure.ts:167–169`.

The inline scanner protects destinations after `](`, but not explicit reference identifiers. Shortcut/collapsed references also use their visible text as the lookup identifier. The structural backstop compares link/image token type and nesting without comparing resolved destinations. Consequently, a spelling correction can leave a link structurally a link while silently changing where it goes.

```markdown
Alice reads [chapter][teh].

[teh]: https://example.invalid/first
[the]: https://example.invalid/second
```

A controlled, valid spelling finding quoting `teh` and replacing it with `the` passes the real `DraftEditUseCase`, mechanical guard, placement, live protection, and `DraftEditApplier`. Direct Fix reports **one applied fix**, with no remaining flag, while rendered `href` changes from `/first` to `/second`. The same witness succeeds for `![chapter][teh]` (image source changes), `[teh]`, and `[teh][]`. The ordinary inline-link destination control remains protected.

This is a manuscript-content defect, not model-quality speculation: model output is the controlled untrusted input and the production safety path admits it. It occurs on the original unchanged document without opening Refactor Preview. The common applier also serves individual fixes.

**Correction:** protect explicit reference identifiers before sending/placing findings, and have the structural safety check preserve resolved link/image destinations and other non-prose attributes. Keep visible labels fixable only when their target stays unchanged. Cover full, collapsed and shortcut references, reference images, valid-to-valid destination changes, visible-label controls, and ordinary inline links.

**Evidence:** `../pr183-review-evidence/draft-edit/reference-link-witness.{test.ts,json,log}` — Node 18, five reviewer tests: four assert the demonstrated unsafe behavior and one asserts the safe inline-link control. These are defect witnesses, not five passing acceptance cases.

### F-02 — P2: acquire Proofread's document-lifetime guard before its confirmation

**Locations:** `apps/vscode-extension/src/application/commands/proofreadCommands.ts:189–203`; supporting watch acquisition in `packages/core/src/application/services/draftEdit/DraftEditUseCase.ts:144` and URI/version lookup in `apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts:80–85`.

Proofread captures the document and prepares its plan, awaits confirmation for a whole-file target over 15,000 words, and only then acquires `DocumentEditor.watch`. A document that closes/reopens under the same URI/version during that await is a new lifetime, but the newly acquired watch attaches to it. A language-change close/open can similarly move the original Markdown request into an unsupported TypeScript lifetime.

The production command/use-case/native-adapter witness uses synthetic text beginning `Alice saw teh rabbit.` and the real long-file threshold. During the confirmation callback it supplies the lifecycle event, then confirms:

| Case | Observed current behavior |
| --- | --- |
| No-change control | One pass invocation, one Markdown flag |
| Close/reopen, same URI/version/language | One pass invocation and one flag on the new lifetime |
| Markdown → TypeScript close/open, same version | One pass invocation and one TypeScript flag |
| Same language change, Proofread and Fix with `fixReview = apply` | One `workspace.applyEdit`; live text becomes `Alice saw the rabbit.`; direct fix reports applied: 1 |

Only VS Code event/WorkspaceEdit transport and the non-billable model pass are doubles; the command, use case, applier, document editor and annotator are production code. This proves the missed lifetime guard and its write consequence, not native modal interaction behavior.

**Correction:** begin/hold the Proofread gesture and lifetime watch before any confirmation await, consume that same watch through planning/running, refuse an ended lifetime before model calls, and release on every terminal path. Craft Flags already implements this pattern. Rechecking URI/version/language alone does not catch a reopened identical document. Preserve no-change, decline, live-edit reconciliation and replacement-gesture behavior; cover Flag and direct Fix.

**Evidence:** `../pr183-review-evidence/host/proofread-confirmation-lifetime.{test.ts,log}` — four Node 18 reviewer cases. **This is not the accepted #172 risk:** it happens before any native review is submitted, and the direct-write witness opens no Refactor Preview.

### F-03 — P2: drain Lightbox persistence before deactivation completes

**Locations:** `apps/vscode-extension/src/extension.ts:841–845`; supporting disposal/save paths in `packages/core/src/application/handlers/domain/LightboxReadingHandler.ts:155–161,385–391` and queue ownership in `packages/core/src/infrastructure/storage/LightboxBoardStore.ts:413–416`.

The composition root still describes Lightbox as writing nothing. Its deactivation disposes the panel, then awaits **only Workshop's** persistence flush. Saved boards added asynchronous storage later: disposing a Lightbox handler stops its runs and fire-and-forgets `saveAfterRun` when any group has landed. The library only unsubscribes on dispose, and there is no root-owned drain/flush for these owed writes.

The independent real-service/handler/runner/library/store witness saves a measured-only board, lets a paid reading's group B land while other groups are pending, and holds the board file's next read to prevent its queued rewrite from committing. It then executes the **exact extracted production `deactivate` body**, with real tab disposal and an already-quiet Workshop. Deactivation resolves, the runner is stopped, and library disposal returns, but disk still has zero group-B tiles while memory contains usable characters. Keeping the host alive and releasing the I/O gate lets that same save commit.

This establishes the missing awaited shutdown boundary. **Native process termination/data loss was not simulated**; the resulting risk is that normal extension-host shutdown or reload can abandon the latest paid readings or another pending board update. Existing claim/rollback recovery does not persist data that never reached disk.

**Correction:** keep a composition-root-owned Lightbox persistence drain; quiesce/cancel producers first so their partial-result saves are queued, then await all owed saves and pending board edits before deactivation resolves. A queue snapshot taken before disposal enqueues its saves is insufficient. Preserve idempotent tab closing and shared-service ownership. Merely making a subscribed `dispose` async is insufficient because [VS Code does not await asynchronous subscription disposal](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext).

**Evidence:** the last case in `../pr183-review-evidence/persistence/integration.review.test.ts`; `final-integration.{log,json,exit}`. Four cases pass: this defect characterization and three positive provenance/carry/restore controls. Add a regression that holds I/O, asserts deactivation stays pending, releases it, and verifies the partial board is committed before shutdown completes.

## Architecture and cross-slice review

Five coordinated review lanes inspected production code, contracts, tests and prior decisions. Prior reports were used to distinguish resolved issues and known limitations, not as a substitute for reviewing the integrated implementation.

| Area | Evidence-grounded review |
| --- | --- |
| Host/core composition | Activation constructs shared services and platform adapters; app consumes the core barrel; static production scans found no `vscode`/app imports in core. Checked command/menu/settings consistency, separate Proofread/Craft diagnostic ownership, provider assembly, serializer and disposal ownership. |
| Provider/model contracts | Reviewed manager key-generation ordering, refresh ownership and retired-engine detachment; following versus independently selected model scopes; confirmed/estimated model correlation; request-level model pinning for Draft Edit; mandatory-reasoning refusal and reasoning budget/usage separation; scoped recovery and Workshop multi-call rejection guidance. |
| Lightbox persistence/provenance | Traced source/adoption generations, rail observation ordering, store serialization, revision/claim checks, rewrite recovery, owed-run capture, spark metadata merging, imported snapshots, per-lens earlier provenance and stale carry. Fresh real handler/service/store probes cover successful reading → failed rerun → changed-text carry → save/reload; cancelled reread preserving paid tiles; and outside snapshot → local save without mutating outside bytes. |
| Draft Edit safety | Reviewed protected blocks/inlines, structural checks, exact/normalized anchoring, line-break guards, selection retention, live-edit reconciliation and readback, annotation/quick-fix ownership, word-list/name/quotation/compound scans, bounded phrase scans, speech handling, continuity's two-place and current-section checks. F-01 and F-02 are gaps across otherwise separate guards. |
| UI and Workshop handoffs | Reviewed shared full-tab chrome, both app compositions, model/estimate and board/token correlation, saved-board/passage/project-picker ordering, offer → claim → grant → accept/reset, separate seed kinds, receiver checks, overlay/focus ownership, and attachment identity/validation. No independent blocking UI/handoff defect established. |
| Packaging and shared measurements | Reviewed prompt/resource copy and bundle verification paths and `.vscodeignore`; canonical resources are staged before builds. Traced shared sentence/dialogue and measurement-rule IDs into saved-board standing. Native Chromium/editor acceptance is separate. |

The high-risk cross-slice ownership paths, rather than every historical screenshot or every line of the 566 commits, were the manual review focus. Automated regression coverage spans the full repository.

## Independent verification

Repository `AGENTS.md` (the `.ai/central-agent-setup.md` link), relevant ADR/epic documents and existing report conventions were read. No `.agents/skills` directory or dedicated PR-review template is present; this follows `docs/pr-reviews` practice.

The existing clean cloud worktree was reused without cloning dependencies or deleting others' artifacts. Node **18.20.8** is the CI-aligned runtime. The retained dependency lockfile matches the previous validated tree: SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`. No installation or lockfile modification was performed. The available npm 11.9.0 launcher warned that Node 18 is outside its supported range; the spawned TypeScript/Jest/ESLint/webpack tools nevertheless ran under Node 18 and all commands exited 0. CI independently used its configured Node 18 setup and a fresh npm ci. Full Jest is serial with `--no-cache` because this shared filesystem has limited free space.

| Check | Result |
| --- | --- |
| Core, webview and adapter typecheck | Passed |
| Full typed Jest, Node 18, `--runInBand --no-cache` | Passed: 589 suites / 8,353 tests / 59 snapshots, zero failed/pending; 590.449 s |
| Repository lint | Passed: 0 errors / 1,130 warnings |
| Production webpack bundles and `verify:bundle` | Passed; three webpack size/performance warnings |
| Fresh focused persistence/source/provenance tests | 12 suites / 140 tests passed; 4 real integration probes passed (three positive controls and the F-03 defect characterization) |
| Fresh focused Draft Edit tests | 8 suites / 176 tests passed; 5 defect/control witnesses passed |
| Fresh focused host/adapter tests | 7 suites / 133 tests passed; 4 defect/control witnesses passed |
| Fresh focused UI/handoff tests | 15 suites / 135 tests passed; conditional resilience witnesses are not counted as acceptance |
| Exact-head PR CI | [40679943874](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40679943874): success, including npm ci, typecheck, tests, lint and build |
| Aggregate `git diff --check` | Nonzero for existing report Markdown trailing spaces and added blank EOFs, including two test files; no semantic defect inferred from whitespace |

Focused counts overlap the full regression suite and must not be added as unique coverage. All reviewer probes are external to tracked source. Evidence is retained in `../pr183-review-evidence/`, with separate lane summaries and exact harnesses/logs.

## Known limits and separate acceptance

- **Explicitly accepted #172 tradeoff:** native Refactor Preview can commit after its pending document lifetime changes, because the public API cannot safely bind/discard that specific preview. This narrow accepted risk remains, is not claimed fixed, and does not excuse F-01/F-02.
- **Previously documented Lightbox model drift remains:** a configuration change after a run starts can move deferred Opinion/queued calls to the new model. A fresh exact-head production-handler/real-concurrency probe on Node 18 reproduced A on model A, then deferred F on model B after hot-swap. Draft Edit now pins models; Lightbox does not. This is disclosed as the existing #169 limitation, not a novel scope-split finding or an implicitly accepted #172 risk.
- **Already tracked usage debt:** Lightbox `sumUsage` treats missing reported cost as zero and can understate totals; `.todo/tech-debt/2026-10-25-shared-token-usage-sum.md` tracks migration to the stricter shared helper.
- **Persistence boundaries remain documented:** equal-timestamp claim recovery after multiple filesystem failures, lease/final-rename boundaries, soft busy/unreadable restore without automatic retry, and the previous reload pointer for an outside snapshot before its first local save are not newly claimed fixed.
- **Conditional reveal resilience, not a blocker:** injected loss of started/finished messages can leave a missing Stop token or stale saved-board reading gate after same-board replay. No ordinary retained-tab hiding trigger was established: [VS Code's guide](https://code.visualstudio.com/api/extension-guides/webview#retaincontextwhenhidden) says hidden retained webviews keep scripts running and can receive messages. Those fault-injection tests do not prove a native hide/reveal regression.
- The earlier Node 26.1 JSON-overflow witness failures were reproduced on baseline/current before this review; this review's aggregate gate uses Node 18. Do not turn that known test-runtime portability issue into a new catalog regression.
- Native VS Code/Extension Development Host activation, actual Refactor Preview interaction, screen-reader/Chromium-floor behavior, remote filesystem shutdown and live-provider/editorial quality were not newly exercised. No billable provider calls were made.

## Integration recommendation

Keep #183 in draft and correct the concrete findings before merging. Review fixes independently against the final head, rerun affected witnesses plus aggregate gates, and verify exact-head CI. Native smoke acceptance should cover long-file confirmation/language changes, preview Apply/Cancel and live edits, saving/reloading partial boards, cross-window board operations, repeated run/Stop/re-run, and Workshop handoff receiver/overlay transitions.

All local aggregate checks and exact-head PR CI completed before this report was finalized. The reviewed remote main/epic refs remained unchanged at final verification. The worktree was clean after all builds; only this new local review report was then added.

The report remains local pending publication authorization. No implementation or source history was changed by the review.

## Author response (`83b23457`)

**All three are taken.** Your report above is unchanged. Each counterexample now passes through the production path it named, and each fix has a witness that fails without it.

### F-01: a reference's label is protected, and every link keeps its target

Two guards, as you asked, one in front of the other.

- **The label is protected.** `markdownInlineRegions` reads `]` then `[` as a full reference's label, through the next unescaped `]`, never across a blank line or another `[`, and protects it. It reads on inside it, so a code span there still binds tighter and `[a][b][c]` protects both labels. Scans stop at the next bracket, so no two overlap: linear (a 60,000-character chain and a 200,000-character unclosed label, timed).
- **The structure check compares where things go.** `markdownStructure` describes each `link` and `image` with its resolved `href` and `title`, read with the document's own definitions, before and after. A collapsed or shortcut reference shows its label as its text, so the label stays prose and fixable, and is refused only when the fix moves its target.
- Your witnesses, through `DraftEditUseCase` and `DraftEditApplier` with a direct Fix: `[chapter][teh]` and `![a picture][teh]` are masked, so the quote anchors nowhere (`unanchored: 1`) and nothing is written; `[teh]` and `[teh][]` are flagged with the fix offered but not applied (`applied: 0`), the document unchanged. Both checks run again in the applier on the live text, so *Replace with* is held to them too.
- Controls: fixes to visible text (`[chpater][teh]`, `![a pictur][teh]`, `[teh book](chapter.md)`) still land, and so does a case-only change that resolves to the same definition (`[Teh]` → `[teh]`). An escaped bracket, a nested `[`, a blank line, or `[and] [the]` makes no label.

### F-02: Proofread's gesture is held, as Craft Flags' is

`DraftEditUseCase` now takes `begin(target, pass)` synchronously at the gesture: the busy check, the masked chunks, the watch at the gesture's version, and a selection's kept flags. It returns the plan the confirmation reads. Then `run(gesture)` sends it once, and `release(gesture)` ends it unsent. The command releases it however it ends, declined, run or thrown. `plan(target)` and `run(target, …)` are gone, so nothing can take a watch after a confirmation again. `run` refuses a lifetime that ended since `begin` with `changed`, before anything is sent. The pass is also asked `stillCurrent` in the turn each chunk starts, which closes the gap while the prompts load, and a lifetime that ends mid-run starts no more chunks.

- Your four cases, through the production commands, use case, applier, `VsCodeDocumentEditor` and annotator, at the real threshold (`proofreadConfirmationLifetime.integration.test.ts`): the no-change control flags once; a close and reopen at the same URI, version and language, and a Markdown → TypeScript change at the same version, each send nothing and flag nothing; the same language change under Proofread and Fix with `fixReview = apply` makes no `applyEdit`, and the text is unchanged. No Refactor Preview is opened.
- Preserved, with controls: a direct Fix with nothing changed writes its fix; decline sends nothing and the next gesture begins; a selection's kept flags are chosen at the gesture.
- **One behavior change.** An edit the writer makes while the confirmation is open is now followed, as one made while the model works is: the flag lands on the moved text. Before, that run was refused as `changed`. A held gesture also keeps the document's in-flight slot through the confirmation, so a quick fix there answers `busy`, as Craft Flags' does.
- `DraftEditUseCase.ts` would have grown past 500 lines, so the Fix run's write step moved, verbatim apart from becoming a function, to `draftEditRunFixes.ts` (`applyRunFixes`, `fixReport`), and `followIssues` joined `draftEditIssues.ts`. The use case is now 451 lines.

### F-03: deactivation drains the Lightbox's owed writes

- `LightboxBoardLibrary` holds every write it starts as owed until it settles: a save after a run, a measured board's first save (through `LightboxBoardSaves`' new `owe` port, where there was a bare `void`), a rename, a spark's mark and a delete. `drain()` waits until none is left, including any started while it waits, and never rejects.
- `deactivate` now hands its parts to `shutDownExtension` (`apps/vscode-extension/src/application/extensionShutdown.ts`). It disposes both tabs first, so the Lightbox handler stops its runs and queues each landed run's save. It then awaits the Lightbox drain alongside the Workshop's flush, in the promise `deactivate` returns, and awaits the drain even when the flush throws. As you noted, VS Code does not await an async subscription's dispose, so the wait is not there.
- Your regression, over the real handlers, service, runner, store and library (`extensionShutdown.integration.test.ts`): group B lands while C is out, the board file's next read is held, and `shutDownExtension` runs. The run is stopped, shutdown stays pending, and disk still holds the measured board; once the read is released, shutdown resolves with B's tiles on disk and no group `running`. A rename still going out, and one started while the drain waits, are waited for too. Controls: with nothing owed, shutdown settles without touching the boards folder. The order test shows the tabs disposed before either wait, and the drain awaited when the flush rejects.
- `providerAssembly.test.ts` now checks that `deactivate` hands all four parts to `shutDownExtension` and awaits it; the order itself is the new test's.

### Witnesses against the reviewed code

- F-01: with the two scanner and structure files reverted, 10 unit tests and 4 use-case tests fail (full, image, shortcut and collapsed references); the controls pass.
- F-02: with the four production files reverted, the integration witness fails your three defect cases and the edit-while-confirming case; its three controls pass.
- F-03: with the drain left out of the shutdown parts (the old `deactivate`), the held-save and rename witnesses fail; the nothing-owed control and the order test pass.

### Verification

Node 18.20.8 on `83b23457`:
- typecheck (core, webview, adapter) passes;
- Jest 591 suites / 8,390 tests / 59 snapshots;
- lint 0 errors / 1,130 warnings (unchanged);
- build, with `verify:bundle`, passes, with the three known webpack size warnings;
- `git diff --check` passes.

No provider calls were made. Native VS Code acceptance (a long-file confirmation with a language change, deactivation with a save held) was not run. The ADRs (Draft Edit's 2026-10-28 amendment; the Lightbox's D12 addendum), the agent guide and the memory bank record the changes.

## Independent re-review — `28751221` (2026-10-28)

**Reviewed head:** `28751221fb2fe25d98350abebe1979ff38186d36`, including implementation `83b23457b` and the author's response. The correction delta from report commit `6d4cf863b4c1651ed06bfeaa49ac1e96b3b3f44c` changes 41 files (+1,503 / −304). Base remains `d1f25db2a93ee8e6831c22937b728b98b0a2c06e`.

**Current disposition: F-01 and F-02 are resolved; F-03 is partially resolved and remains P2.** This ledger supersedes the original open/closed disposition, not its historical evidence. The original paid partial-run shutdown defect is fixed. A different producer path within the requested shutdown boundary remains unguarded, as detailed below. Green regression gates and exact-head CI do not exercise that sequence.

### Correction ledger

| Finding | Independent result |
| --- | --- |
| **F-01 — Markdown reference destinations** | **Resolved.** Full-reference identifiers are protected, and the structural guard compares resolved link/image destinations and titles. Eighteen new production-use-case/applier acceptance and control witnesses pass, including shortcut/collapsed images, target-only selection, a live definition change before an individual Replace, visible-text controls, same-target case-only corrections, and long-offset/performance probes. Mapping only the two corrected utilities to their pre-fix versions yields 12 expected failures and 6 passing controls, without changing the checkout. |
| **F-02 — Proofread confirmation lifetime** | **Resolved.** A synchronous held gesture owns the watch, plan, pass and busy slot before confirmation; run consumes that gesture and releases it on terminal paths. Reopen-identical and Markdown→TypeScript cases send, flag and write nothing. Fourteen independent checks cover unchanged Flag/Fix, ordinary edits, decline/exception cleanup, competing/duplicate gestures, initialization/prompt-load lifetime endings, and actual three-call concurrency: already-started calls finish, all queued calls are suppressed after closure, and no result is shown. The extracted Fix body is equivalent after only the intended receiver/callback/helper substitutions; `fixReport` matches exactly. |
| **F-03 — Lightbox shutdown** | **Partially resolved.** The original held partial paid-run save now delays exact production deactivation, commits its landed group, and restores correctly in a fresh host. First saves already owed, rename, Spark, delete, writes added during an active drain, rejection handling and idempotent disposal pass. A source request whose save is produced after the drain becomes empty still escapes, below. |

The intentional F-02 behavior change is verified: an ordinary edit during confirmation now relocates the result through the held watch instead of refusing the whole run. Holding the busy slot through confirmation is also verified. Neither change broadens the separately accepted #172 pending-native-preview lifetime risk.

### Remaining F-03 — quiesce source producers before treating the drain as complete

**Primary location:** `apps/vscode-extension/src/application/extensionShutdown.ts:30–35`. Supporting paths: `packages/core/src/application/handlers/domain/LightboxHandler.ts:362–394`, `packages/core/src/application/services/lightbox/LightboxBoardLibrary.ts:158–180`, and `packages/core/src/application/services/lightbox/LightboxBoardSaves.ts:82–90`.

The new shutdown helper disposes the tabs, starts one Lightbox drain, then awaits Workshop's flush and that drain. The drain correctly waits for the owed set while it is nonempty. However, tab disposal stops model runs, **not pending source reads/builds**. A source request accepted before shutdown may finish after the drain has resolved empty; the service still adopts its board, and the library's outcome listener then starts its first measured-board save.

Independent production-path sequence:

1. Choose a source file and hold the real resolver's file read before measurement/adoption; its source ticket already exists.
2. Execute the exact extracted production `deactivate` body and production shutdown helper. The real tab is disposed; Lightbox has no write yet, so its drain resolves. Hold Workshop's unrelated flush.
3. Release the source read. It adopts the measured board and starts its first save; hold the real store's staging write. No saved board file exists.
4. Release Workshop's flush. **Deactivation resolves while that first save remains pending.** Keeping the host alive and releasing the staging write subsequently commits one board.

A second witness has **no Workshop coordinator at all**: deactivation returns while the accepted source read is held; releasing it afterward still adopts and starts the first save. Thus the defect does not depend on the artificial Workshop delay. Both desired-behavior guards fail. Conversely, if an earlier owed rename keeps the drain active, the same late source save joins it and shutdown waits correctly. This isolates the gap to producer ownership after the drain has finished, not failure of `owe` to track a running save.

**Bounded impact:** an accepted source request's newly measured board can still have its first save abandoned at shutdown. These probes do **not** demonstrate loss of paid readings, and the original paid partial-run case is now safe under the controlled I/O test. Native host termination or actual on-disk loss was not simulated.

**Required correction:** establish a shutdown-specific boundary that invalidates/quiesces all relevant source producers, or awaits already-accepted source work and its resulting saves before returning. Source requests intentionally survive ordinary tab closure and can land in a replacement tab; preserve that behavior. Blanket cancellation on every panel dispose would regress that ownership contract. A second drain alone is not sufficient if a source producer can still enqueue after it resolves.

**Reproduction evidence:** `../pr183-rereview-evidence/persistence/shutdown.review.test.ts:102–117,142–153`; `final-external.{log,json,exit}`. The harness removes only TypeScript annotations from the exact deactivation body, injects real tab/library/service/store objects, and releases all held work after recording the observations. This is not native extension activation. The remaining case is one P2 finding with two timing variants, not two new findings.

### Independent verification of the correction head

The existing clean worktree and unchanged lockfile were reused. All commands ran with Node **18.20.8** and supported npm **10.8.2**; no dependency installation or source/test edits were made. An initial external npm-wrapper packaging mistake ran no repository checks; correcting only that external launcher produced the results below. Jest remained serial and uncached because of limited shared disk space.

| Check | Result at `28751221` |
| --- | --- |
| Core, webview and adapter typecheck | Passed |
| Full typed Jest (`--runInBand --no-cache`) | **591 suites / 8,390 tests / 59 snapshots passed**, zero failed/pending; 689.8 s |
| Repository lint | Passed: **0 errors / 1,130 warnings** |
| Production webpack bundles and `verify:bundle` | Passed; the existing three size/performance warnings remain |
| Correction delta `git diff --check` | Passed |
| Focused F-01 repository regressions | 7 suites / 176 tests passed; 18 external acceptance/control checks passed |
| Focused F-02 repository regressions | 13 suites / 235 tests passed; 14 external checks passed |
| Focused F-03 repository regressions | 5 suites / 50 tests passed; external probes: **12 passed / 2 failed desired guards** for the single remaining issue |
| Exact-head PR CI | [40719385372](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40719385372): terminal success; all verification steps passed |
| Exact-head push CI | [40719367315](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40719367315): terminal success; all verification steps passed |

Focused repository counts overlap the full suite and must not be added as unique coverage. One passing persistence probe only characterizes the unawaited `memory.update` reload-pointer promise: it does not establish native pointer loss because VS Code's main-process persistence boundary was not exercised. It is not promoted to a second blocker.

Full logs and lane ledgers are retained under `../pr183-rereview-evidence/`. The worktree is clean after the gates. No implementation changes, provider calls, formal review, comment, merge or additional report publication were performed by this re-review. Native VS Code/Refactor Preview, process shutdown, remote filesystem and live-provider acceptance remain unrun; the original report's separate known limitations still apply.

**Recommendation:** keep F-03 open for the bounded late-source shutdown case; F-01/F-02 need no further correction on this evidence. Re-review the producer-boundary fix independently and verify the final head and CI before closing the remaining finding.

## Author response to the re-review (`e1ba8b67`)

**Taken.** Your re-review above is unchanged. The remaining F-03 case now adopts nothing, and the ordinary tab-close behavior you asked me to preserve has a control.

### Source requests end at shutdown, and only there

- **The boundary is the producer's own.** Every Lightbox source (a choice, a pick, a seed, a re-read, an open, a restore) adopts only under the service's current ticket. `LightboxBoardLibrary.shutDown()` first calls the service's new `endSourceRequests()`, so no ticket taken before or after is current again, and then waits for every owed write, including any started while it waits. A request still reading or measuring when deactivation begins therefore finishes `superseded`. It adopts no board and starts no first save, whichever side of the drain it would have landed on.
- **Only deactivation ends them.** `shutDownExtension` calls `shutDown()` once the tabs are disposed, and no tab's dispose calls it, so a request that outlives its tab still lands in the replacement tab. `drain` is no longer public, so nothing else can be mistaken for the shutdown wait.
- **What is given up.** A file the writer chose in the last moment before deactivation is not measured or saved. The source is still on disk, and no paid reading is involved: readings already landed were saved when their run ended, and that is what the drain waits for.
- **The service stayed under its guard.** `LightboxService.ts` was at 495 lines against the Lightbox modules' 500-line guard, so its tickets moved to `LightboxSourceRequests.ts` (`begin`, `isCurrent`, `any`, `end`), listed in `LIGHTBOX_MODULES`. The service delegates and re-exports `LightboxSourceTicket`, so no importer changed, and it is now 491 lines.

### Your sequence, and its control

In `extensionShutdown.integration.test.ts`, over the real handlers, service, runner, store and library:

- **No Workshop at all.** The source is chosen and its read held; deactivation resolves; the read is released. No board is adopted and nothing is saved.
- **The Workshop's flush held.** Shutdown stays pending on the flush; the source read is released meanwhile; no board is adopted. Once the flush resolves, shutdown resolves with nothing saved and nothing still going out.
- **Control: an ordinary tab close.** The same held source, with the tab disposed and a new tab opened, lands in the new tab and saves its file.
- `LightboxService.test.ts`: a build whose first ticket check passed, then ended mid-measurement, finishes `superseded`; a ticket taken after the end adopts and refuses nothing; no outcome is published; the board on screen stays.
- **Against the previous head:** with `endSourceRequests` made a no-op, the two shutdown cases fail and the control passes. The earlier F-03 witnesses (the held partial run, renames during the drain, nothing owed, the order) still pass.

### Verification

Node 18.20.8 on `e1ba8b67`:
- typecheck (core, webview, adapter) passes;
- Jest 591 suites / 8,394 tests / 59 snapshots;
- lint 0 errors / 1,130 warnings (unchanged);
- build, with `verify:bundle`, passes, with the three known webpack size warnings;
- `git diff --check` passes.

No provider calls were made, and native deactivation was not run. The Lightbox ADR's D12 addendum, the agent guide and the memory bank record the boundary.

## Final independent correction re-review — `21aa11bb` (2026-10-28)

**Reviewed head:** `21aa11bbc1e63f12df7841876a348517f336f9d5`, including implementation `e1ba8b672` and the author's response; correction delta from `550077ad` is 11 files (+237 / −44). Base remains `d1f25db2a93ee8e6831c22937b728b98b0a2c06e`.

**Current disposition: F-01, F-02 and F-03 are resolved. No new blocking finding was established in the correction delta.** This supersedes the previous open-finding ledger; the historical findings and both author responses above are preserved. F-01/F-02 have no implementation changes in this round and retain their independently verified resolutions. This is a report-only engineering assessment, not a formal GitHub approval or authorization to merge.

### F-03 resolution: a terminal source boundary, then owed writes

`LightboxBoardLibrary.shutDown()` now synchronously calls the service's `endSourceRequests()` before its first await, then waits for its owed writes (`LightboxBoardLibrary.ts:182–186`). `LightboxSourceRequests.end()` clears the current ticket and permanently seals that service instance; a later `begin()` cannot install a current ticket. `buildBoard` checks ownership both before and after asynchronous measurement, saved adoption checks before publishing, and refusals use the same guard. No await separates the final ownership check from adoption and the first-save listener.

The exact production `deactivate`/shutdown path still disposes both panels first, queues saves for landed partial runs, starts the terminal Lightbox shutdown, and awaits it even if Workshop flush fails. Only extension deactivation seals source requests; ordinary tab disposal does not. A native launcher also checks its ticket before reopening or revealing a panel.

**The selected policy is explicit:** source work that has not adopted its board when deactivation starts is cancelled at adoption, not awaited and newly saved. Both prior late-read witnesses now produce no adoption, outcome or write after source release, with Workshop absent or with its flush pending. This does not discard the already-landed paid results in the tested paths: the original held partial-run save still blocks shutdown, commits group B, and restores correctly in a fresh host. Ordinary tab close/reopen still allows accepted source work to land in the replacement tab.

### Independent counterexamples and controls

Two coordinated read-only lanes, plus the aggregate gate, checked the correction rather than relying on the author's pass claims:

- **Persistence: 20 external probes passed.** Covers both original late-read timing variants; a hold inside real measurement after the first ticket check; changed-text reread; saved-board open, restore and outside-board open; the original paid-run wait/restore; first save already owed; rename, Spark and delete; additional writes during the drain; rejection handling; independent service instances sharing workspace files; and retained provenance/carry/import controls.
- **Host/source lifecycle: 10 external probes passed.** Covers a held native launcher without reopening its disposed tab, requests seeded after the seal, late file-picker success/error, held project-catalog success/error, late read refusal, repeated terminal calls, identity ownership, a fresh independent session, and ordinary close/reopen for native launch and picker.
- **Negative controls are discriminating.** Making only `endSourceRequests` a no-op causes both prior late-read desired guards to fail; the native-launch guard also fails, while ordinary-close controls still pass and confirm the seal is not called. These are intentional mutation-control failures, not failures at the corrected head. No production file was changed for them.
- **No ownership expansion:** the seal belongs to the service instance, not the panel or workspace. Shutting down one host does not prevent a second host from restoring, renaming or measuring/saving another source. The extracted ticket module preserves the public type export and the architecture/size boundaries.

Evidence and exact external harnesses are retained in `../pr183-final-rereview-evidence/{persistence,host}/`, including separate lane ledgers and mutation-control logs. Native UI/extension activation is not simulated by these tests: the persistence lane uses the extracted production deactivation body with real handlers/service/library/store, while the host lane uses real launcher/provider/service ownership over native transport doubles.

### Final verification

Node **18.20.8**, npm **10.8.2**, unchanged dependency lockfile, no installs or tracked source/test modifications. One local aggregate attempt was interrupted by an executor-session disconnect before writing a terminal result; its 439 passing-suite lines are retained separately and are **not** counted as a completed gate. A fresh full run completed:

| Check | Result at `21aa11bb` |
| --- | --- |
| Core, webview and adapter typecheck | Passed |
| Full typed Jest (`--runInBand --no-cache`) | **591 suites / 8,394 tests / 59 snapshots passed**, zero failed/pending; 645.298 s |
| Repository lint | Passed: **0 errors / 1,130 warnings** |
| Production bundles and `verify:bundle` | Passed; the existing three webpack size/performance warnings remain |
| Correction delta `git diff --check` | Passed |
| Focused persistence regressions | 8 suites / 93 tests passed |
| Focused host/source regressions | 6 suites / 114 tests passed |
| Exact-head PR CI | [40730098498](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40730098498): terminal success, every verification step passed |
| Exact-head push CI | [40730078905](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40730078905): terminal success, every verification step passed |

Focused counts overlap the full suite. The worktree remained clean after the checks. Report-only publication is authorized; no implementation fix, paid inference, formal approval, merge, auto-merge or release was performed by this review.

**Integration assessment:** the three concrete aggregate-review findings are closed on this evidence. Native VS Code shutdown/remote-filesystem acceptance, actual Refactor Preview interaction and live-provider/editorial quality remain unrun. The explicitly accepted #172 preview-lifetime tradeoff and the separate previously documented model-drift, usage and persistence limitations in the original report are unchanged, not newly accepted or claimed fixed. This report does not broaden the result into a claim that every host state/memento write is awaited or every possible regression is excluded.
