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
