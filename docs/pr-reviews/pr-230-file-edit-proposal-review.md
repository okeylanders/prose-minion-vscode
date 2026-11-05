# PR #230 review: File-edit proposals and session state

**Latest disposition: F-01 closed after independent re-review of `6200733a`; no remaining Slice 3 code blocker found.** Current-head CI and combined-stack acceptance are separate gates, recorded in the PR conversation. No merge performed.

**Original disposition at `16718261`: changes required for one P2 staging-to-persistence integration defect.** The finding and reproduction below remain as history.

- PR: [#230](https://github.com/okeylanders/prose-minion-vscode/pull/230)
- Reviewed code head: `16718261307b57e99f8d78ddf578e8610108c6fb`
- PR branch: `epic/workshop-persona-file-edits-slice-3-proposal`
- Epic base at review: `b14c46b8ca1e3e37966c27eccd0eb916c590c316`
- Inherited planner: #227 `f4dcc641`; #227's current head `21c994cf` also merges the revised spec.
- Staging counterpart inspected: #229 `778a09a6e8113475e8fa25a969b978d396727f67`.
- Before review, #230 had no submitted reviews or discussion comments.
- Scope: trailer codec/scanner and memory extraction compatibility, bounds and settings, asynchronous staging/completion, persisted state/outcomes/reopen rules, host/webview projection, export/recall boundaries, and the real #229 staging-output contract. Apply/claims/UI remain Slice 4, not claimed as implemented or accepted here.

## F-01 (P2): A staged excerpt card can make an otherwise valid session unsaveable

**Anchor:** [`WorkshopFileEditProposalRecords.ts:155–160`](https://github.com/okeylanders/prose-minion-vscode/blob/16718261307b57e99f8d78ddf578e8610108c6fb/packages/core/src/application/services/workshop/session/WorkshopFileEditProposalRecords.ts#L155-L160).

`assertStaging` subjects every host-owned `target.relativePath`, including an excerpt's display path, to the model's configured-resource path grammar and 1,200-character input limit. The real staging port does not promise either restriction for excerpts: [`FileEditStagingService`](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/application/services/fileEdits/FileEditStagingService.ts) copies `excerpt.relativePath` into a successfully staged identity. [`WorkshopExcerptFileEditDocument`](https://github.com/okeylanders/prose-minion-vscode/blob/778a09a6e8113475e8fa25a969b978d396727f67/packages/core/src/application/services/workshop/WorkshopExcerptFileEditDocument.ts) takes it from the authorized room excerpt. The existing excerpt codec requires a string, not a configured-resource target.

Concrete witness: `draft:one.md` is a legal workspace filename on POSIX. The existing excerpt can be saved, and real #229 `FileEditStagingService.stage({ kind: 'excerpt' })` returns `staged`, class `prose`, retaining that display path. #230 then adds a pending card successfully. Saving the same room now throws because `isSafeConfiguredResourcePath('draft:one.md')` reads the colon as a URI scheme. A valid nested excerpt path over 1,200 characters triggers the length mismatch too.

This is more than an unusable card: [`WorkshopSessionStore.validateSessionForWrite`](https://github.com/okeylanders/prose-minion-vscode/blob/16718261307b57e99f8d78ddf578e8610108c6fb/packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L999-L1001) validates the entire checkpoint. The accepted reply leaves subsequent session saves/recovery checkpoints failing until the offending state is removed or corrected. There is no need for Apply, and no malformed model path: the trailer is simply `<excerpt/>`.

**Required correction:** agree on the staging-output/persisted-identity contract and enforce it before adopting a card. Distinguish a host display path from a model-supplied lookup path, or turn unsupported staged metadata into a bounded, persistable refusal. Keep URI containment/authorization intact; loosening those guards is not the fix. No accepted card should make the session impossible to persist.

**Acceptance:** use the real excerpt/staging path, complete a persona reply, then save and reopen the full session for (1) `draft:one.md`, (2) a nested path beyond the model lookup bound, and (3) an ordinary chapter control. Either preserve the authorized staged identity and round-trip it, or emit a persistable refusal without losing the reply. Include URI/display limits and the existing illegal model-path refusals.

**Reproduction:** [two-case persistence witness](probes/pr-230-excerpt-persistence-probe.test.ts.txt). Copy it to `packages/core/src/__tests__/application/services/workshop/session/Review230Independent.test.ts` and run `npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/application/services/workshop/session/Review230Independent.test.ts`. Both tests pass at the reviewed head by asserting the current defect: the pre-card session parses and the post-card checkpoint throws. Its staging stub reproduces the counterpart's actual output contract, not an untyped malformed result. The real #229 staging half was independently run with `FileEditStagingService`, `FakeDocuments` and its existing host fixtures and confirmed the colon-path result.

## Reviewed behavior with no additional blocker found

- File-edit and memory trailers share one scanner. Frame positioning, nested/mismatched markers, stripping/redaction/streaming, duplicate targets, operation bounds and the cap have focused coverage. The memory codec extraction retains its existing accepted grammar; no memory assertion was weakened.
- The staging seam has no document-write method. Missing/disabled ports stage nothing, port rejection becomes a bounded refusal, prose rewrites retain identity as refused, and duplicate document identities are dropped.
- The stored record validates exact keys, target/class/baseline grouping, operation/outcome cardinality, applied/partial/unknown consistency and bounded landed records. `applying` stays literal in the codec and settles to `unknown` only on hydration.
- Turn and snapshot posts remove `documentUri`. Export carries display path/why/state; operation text and URI stay out. Recall and turn preview remain card-free. The setting defaults to `ask`, unknown values fail closed, and prompt teaching follows the setting.
- New feature modules remain below 500 lines and core gains no VS Code import. Existing large orchestrators receive wiring seams rather than a new edit engine.

## Combined integration gate, not a standalone approval

A read-only merge-tree check of #230 `16718261` with #229 `778a09a6` confirms three conflict files: the epic README, `MessageHandlerContracts.ts`, and `promptBudgets.ts`. No merge or conflict resolution was committed by this review. Preserve the union of budget keys and choose the real staging-port requirement deliberately. #229's composition root already provides `fileEditStaging`, so combining it with #230's consumer binds staging before Slice 4; the claim that only Slice 4 binds it must be reconciled with the assembled code.

After the planner/gateway findings and F-01 are addressed, rerun the **combined** stack with real staging → proposal completion → save/reopen → sanitized snapshot/export. Check notes, chapter/excerpt aliases, failed catalog reads, cancellation/room replacement while staging is pending, and settings changes. Then run Slice 4's Apply/Review/Decline, durable checkpoint, duplicate-click, generation, stale/partial/unknown and real VS Code preview tests. An isolated green slice is not evidence that these interactions work. The inherited planner and gateway have their own reviews; this report neither waives their findings nor approves merging the stack.

## Verification

At code head `16718261`:

- `npm run typecheck`: passed for core, webview and extension.
- `npm run lint`: passed, 0 errors / 1,165 warnings (matching the PR's reported baseline).
- Focused proposal/protocol/settings/session/route suite: **9 suites / 239 tests passed**.
- Independent persistence witnesses: **2/2 reproduced F-01**. These assert the observed bad behavior, not a corrected implementation.
- Exact-head GitHub [CI run 42128504349](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42128504349): completed successfully. Its `verify` job independently reports successful typecheck, tests, lint and both webpack bundles.
- Full local `npm test -- --runInBand`: **762 suites / 10,670 tests / 59 snapshots passed** (515.963 seconds).
- The report-only commit does not change runtime code; its own current-head CI result is recorded separately in the PR conversation after completion.
- No native VS Code acceptance, live model call, combined integration test run, Apply flow or deployment was performed.

Only this report and its reproduction artifact are published by the review. They do not change runtime behavior.



## Independent correction re-review: `6200733a`

**F-01 is closed.** `workshopFileEditIdentityHoldable` now defines one host-identity contract shared by pre-adoption staging and the persisted codec: nonempty, single-line URI and display path, each bounded at 8,192 characters. The display path is no longer mistaken for the model's configured-resource lookup input. Metadata outside that contract becomes an `identity-unpersistable` refusal before completion, without retaining the unpersistable target; the valid reply can still be saved. The model's original lookup-path validation remains unchanged.

Independently converted the original witness to assert the corrected result and added an ordinary chapter control: [correction probe](probes/pr-230-excerpt-persistence-correction.test.ts.txt). All **3 cases passed**, preserving the pending identity through completion and strict full-checkpoint parsing. The correction's new regression tests additionally exercise save/reopen/hydration, oversize URI/display and multiline refusal, and invalid model-path controls.

Verification repeated on `6200733a`:

- Typecheck: all three targets passed.
- Lint: 0 errors / 1,165 warnings.
- Focused proposal/protocol/session/settings/route suite: **10 suites / 251 tests passed**.
- Independent corrected-output probe: **3/3 passed**.
- The original-head full suite and report-head `527f26ae` CI passed, but neither is represented as verification of this newer correction. No PR-triggered CI run was returned for `6200733a` at the time of re-review; the new report-only head's CI is checked separately and recorded in the PR conversation.

This closes the specific producer/codec mismatch, not the combined-stack integration gate above, #229's findings, or Slice 4 acceptance. No runtime code was changed by the reviewer.

Before publishing this re-review, the PR advanced to `150d5899` by merging the epic's now-landed planner/report history. The `6200733a..150d5899` diff changes only the epic README and #227 review artifacts; `packages/` and `apps/` have no diff. The correction verification therefore covers its unchanged runtime tree.
