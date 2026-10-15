# PR Review — Dictionary Lookup History

**Author:** okeylanders · **PR:** [#144](https://github.com/okeylanders/prose-minion-vscode/pull/144) (open, unmerged at review)
**Branches:** `epic/dictionary-lookup-history` → `main`
**Verified base / merge-base:** `db3e49b8081629d27646125132def2b90d1ffd32`
**Reviewed implementation head:** `6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c`
**Independently re-reviewed correction head:** `19114a20100dac1f1c7b5c85fbd4e993e737c801` (2026-10-15)
**Initial scope:** 46 files · +5,903 / −155 · 11 commits
**Reviewed:** 2026-10-14 · **Reviewer:** Astra · **Mode:** independent source/spec review, host and real-hook/component lifecycle witnesses, real-engine model-swap probe with synthetic transport, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | Completing the stream before awaiting history persistence admits another lookup, then lets the first result overwrite its state | The delayed-write gap and completion-to-result lock are fixed at `19114a20`; request-correlated settlement preserves result ownership | **Addressed** |
| F-02 | Medium / P2 | A cached failed lookup overwrites a restored history entry whenever the sidebar reappears | Fresh outcomes settle their request once; failed/unconfigured/success replays preserve restored content and exports | **Addressed** |
| F-03 | Medium / P2 | The recorded model can differ from the model that actually generated the entry | Real provider/client/engine probes now record the response model after a prompt-loading swap, and both models for a mixed Fast run | **Addressed** |
| F-04 | Medium / P2 | Invalid-history diagnostics copy manuscript fragments into the Output log | Real codec/store probes keep malformed-context and arbitrary-version markers out of logs | **Addressed** |
| F-05 | Medium / P2 | Cancel during the new pre-completion history write is acknowledged but still committed as success | A deferred real-store write produces `cancelled: false`, one final result, and one retained entry after the host acknowledged cancellation | **Open** |

**Verdict: Changes requested.** All four original findings are independently resolved at `19114a20`. The correction introduces the F-05 cancellation boundary below, which remains open. Full deterministic gates and both correction-head CI runs pass, but the independent desired-safe cancellation witness fails. The native Extension Development Host pass remains separately pending; no native or live-provider acceptance is claimed.

## F-01 — Keep completion and final-result ownership coherent across the history write (addressed)

**Changed-code location:** [`DictionaryHandler.ts:249–263`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/application/handlers/domain/DictionaryHandler.ts#L249-L263), particularly the new `await this.recordHistory(...)` at lines 256–261.

The handler posts `STREAM_COMPLETE`, then waits for the history store to create/write/rename the file before posting `DICTIONARY_RESULT`. `useDictionary.handleStreamComplete` ends streaming and clears `loading`; the history lock and both Run buttons therefore reopen during this new disk-I/O interval. The completed content is not installed as `result` by that handler, so the result pane also goes blank until the write finishes.

**Reproduction:** Delay the history `writeFile` promise. Finish a Standard lookup for `first`, process `STREAM_COMPLETE`, and submit another lookup for `second` before releasing the write. The new submit sets `lookupSubject.word = 'second'`. When the first write finishes, its uncorrelated `DICTIONARY_RESULT` still runs through `handleDictionaryResult` and `followRecordedEntry`, producing:

- displayed result: `# first result`;
- lookup subject: `second`;
- history cursor: `first-entry`;
- `loading: false`, despite the newer request being outstanding.

The real host/store witness establishes that completion is emitted while both persistence and the final result are still pending. A separate real-hook/router witness establishes the incorrect newer-request state. If the writer navigates history instead, that entry load queues behind the same store write; the first final result can clear its `pendingEntryId`, so the eventual entry reply is ignored. Slow or remote workspace storage makes this window user-visible; no provider timing assumption is needed after the first response completes.

**Requested change:** Keep the lookup owned and locked until its final result/history identity are settled, or correlate final results so an old completion cannot replace a newer request or navigation. Do not leave a user-interactive gap around the persistence await. Preserve cancelled-lookup behavior if the settlement order changes. Add a deferred-write integration regression that attempts both a second Run and history navigation before the write resolves, and verifies result, subject, cursor, loading, and Copy/Save coherence afterward.

**Resolution verified at `19114a20`:** History recording now finishes before stream completion is sent. The webview remains loading between completion and its own `requestId`-correlated final result. The independent delayed-write probe and real hook/component settlement probes pass. The original stale-result/second-Run defect is fixed. F-05 below concerns the newly extended cancellable interval during that write, not a remaining result overwrite.

## F-02 — Identify cached delivery independently of whether a result enters history (addressed)

**Changed-code location:** [`useAppMessageRouter.ts:91–101`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/presentation/webview/hooks/useAppMessageRouter.ts#L91-L101), with [`useDictionaryHistory.ts:311–314`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/presentation/webview/hooks/domain/useDictionaryHistory.ts#L311-L314).

The new replay protection works only when `historyEntryId` is defined. Failed and unconfigured Standard lookups deliberately have no history entry, yet `MessageHandler.postMessage` still caches their `DICTIONARY_RESULT`; `ProseToolsViewProvider.onDidChangeVisibility` replays that cache on each return to the sidebar. `hasFollowedEntry(undefined)` always returns false.

**Reproduction:** Receive a failed Standard result `Error: provider unavailable`, open a saved successful `umbra` entry from history, then hide and show the sidebar. Replaying the exact failed result replaces the restored Markdown and clears the cursor while leaving the `umbra` form and `lookupSubject` intact. The actual `UtilitiesTab` Copy and Save callbacks both then send:

```text
# umbra

Error: provider unavailable
```

Save also sends `metadata.word = 'umbra'`. The saved history entry on disk is not deleted, but the restored view is silently replaced and an export can carry the wrong content. This is the same user-visible mismatch the new replay guard and D8 are intended to prevent, reachable through ordinary provider failure rather than a rare malformed message.

**Requested change:** Give result delivery/replay a stable identity or ownership rule that also covers non-recorded outcomes. Continue showing a genuinely new failed/unconfigured lookup; do not fix this by discarding every no-ID result. Test failed/unconfigured replay after a history restore and after a newer Fast result, alongside the existing recorded-success replay control and normal fresh-error delivery.

**Resolution verified at `19114a20`:** Result identity is now its stream request ID, independent of whether the outcome entered history. A synchronous awaited-result ref admits a fresh result once and rejects its later replay. Fresh failure delivery, restored history, and Copy/Save remain coherent in independent hook/router/component probes.

## F-03 — Store the generating model, not an earlier mutable selection snapshot (addressed)

**Changed-code location:** [`DictionaryHandler.ts:223–225`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/application/handlers/domain/DictionaryHandler.ts#L223-L225) and the equivalent capture in the Fast handler at lines 292–294. The new [`DictionaryService.getActiveModelId`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L205-L211) reads the manager's current selection, rather than provenance returned by the execution.

Capturing earlier prevents a later selection from relabelling an already-started provider request, but it does not establish which model that request will use. `DictionaryUtility.lookup` awaits shared/tool prompt loading before `runInitial`. The supported model hot-swap mutates the existing engine/provider in place (`AIResourceManager.refreshModelSelections` → `engine.setModel`); the provider request selects its model afterward. Thus a swap during prompt I/O makes a real request on B while the history permanently records A. Comparing reruns and models is one of the stated reasons for preserving each entry.

**Independent reproduction:** Use the real `DictionaryHandler`, `DictionaryHistoryStore`, `DictionaryService`, `DictionaryUtility`, `AgentRunEngine`, and `ConversationManager`, with only prompt I/O and the provider transport made synthetic. Begin on `model/A`, hold `loadSharedPrompts`, call the real engine's `setModel('model/B')` exactly as the manager's hot-swap path does, and release the prompt. The provider receives B and returns `# generated by model/B`; the saved entry contains `modelId: 'model/A'`. No network or billable inference is involved.

The Fast path also reuses a mutable engine across its queued blocks, so a single selected-model snapshot does not by itself prove that all blocks used that model. This latter consequence follows from the production concurrency and engine path; the independently executed witness above is Standard.

**Requested change:** Bind the run to an immutable model/provider snapshot and record that same identity, or propagate actual execution provenance through the service result and represent mixed-model Fast output truthfully. Add a regression that changes the model during prompt loading; for Fast, also cover a change between queued block waves. Merely moving the manager read to after completion trades this error for the opposite one.

**Resolution verified at `19114a20`:** The selected-model reader is removed. `ExecutionResult.modelId` reaches the service and store, and successful Fast block models are retained as distinct `modelIds`. Independent probes exercise the real `OpenRouterClient`, `AgentRunEngine`, Dictionary service/utility, handler, and store with only fetch/prompt/filesystem I/O synthetic. A prompt-delayed swap requests B and records the provider-reported `provider/model/B`; a mixed Fast run retains both A/B response identities. The amended ADR explicitly treats the file as unreleased, so the model-list shape change does not require a released-format migration. **Development-data caveat:** pre-fix V1 entries with only `modelId` fail the new required `modelIds` decoder, are omitted on load, and are removed from the file by its next successful rewrite. Preserve any development history worth keeping before updating; the unreleased-format decision does not itself preserve those entries.

## F-04 — Keep invalid-file reasons free of writer-owned text (addressed)

**Changed-code location:** [`dictionaryHistoryCodec.ts:47–55`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/storage/dictionaryHistoryCodec.ts#L47-L55), consumed verbatim by [`DictionaryHistoryStore.ts:244–246`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts#L244-L246) and its failure path.

The codec appends `JSON.parse`'s raw exception message to its invalid-file reason. Modern Node parser errors include a nearby source excerpt, so malformed history can copy the writer's context/result into the Output channel. The unknown-version path also interpolates the entire unvalidated `formatVersion` value; an independent test reproduces arbitrary marker text in logs through this path without depending on the Node parser version. This contradicts the store's stated no-words/context/results logging contract.

**Reproduction:** Load this deliberately malformed synthetic history through the real store:

```text
{"formatVersion":1,"entries":[{"request":{"context":SECRET_MANUSCRIPT_WORDS}}]}
```

On the independently tested Node 24 runtime, the parser reason includes `..."context":SECRET_MAN"...`; the store logs that excerpt while quarantining the file. Quarantine itself correctly preserves the original file. The defect is disclosure into diagnostics, not destruction or an observed network transmission.

**Requested change:** Return fixed, bounded reason codes/messages for malformed JSON and invalid version types. If useful, log a safe numeric offset or validated numeric version without embedding source fragments or arbitrary objects. Add tests asserting that distinctive word/context/result markers never appear in logs for malformed JSON, unknown-version values, or quarantine failure.

**Resolution verified at `19114a20`:** Malformed JSON uses a fixed reason. Unknown versions are rendered only when they are safe integers; arbitrary strings/objects are classified without their content. Independent real-store probes verify malformed-context/string/object privacy and retain the numeric-version diagnostic. Existing quarantine success/failure and original-file preservation tests also pass.

## F-05 — Do not acknowledge cancellation and then retain the lookup as successful

**Changed-code location:** [`DictionaryHandler.ts:247–269`](https://github.com/okeylanders/prose-minion-vscode/blob/19114a20100dac1f1c7b5c85fbd4e993e737c801/packages/core/src/application/handlers/domain/DictionaryHandler.ts#L247-L269), where `cancelled` is sampled once before the new `await recordHistory(...)` and reused afterward.

Moving the write before completion correctly closes F-01, but the stream and its request remain active throughout that await. The actual tab continues to offer an enabled Cancel button because `isStreaming` and `currentRequestId` are still set. `handleCancelRequest` aborts the controller and posts "Dictionary lookup cancelled". When the write finishes, the handler uses its earlier `cancelled = false` snapshot, emits a successful completion and final result, and leaves the entry in history.

**Independent reproduction:** Hold the real store's `FileSystem.writeFile` promise after a Standard generation returns. Cancel that request through `handleCancelRequest` and verify the cancellation acknowledgment. Release the write and inspect the emitted completion, final results, and store snapshot. The desired-safe assertion expects cancellation, no final result, and no retained entry; the actual values are:

```text
{ cancelled: false, results: 1, entries: 1 }
```

This is a newly extended cancellation interval, potentially noticeable on slow/remote workspace storage. Generation has already finished, so cancellation cannot reverse the inference cost. The new frontend correlation guard correctly ignores the canceled request's late final result; there is no renewed result-overwrite claim. The defect is that the UI and host accept cancellation while durably recording the lookup as successful, contrary to the stated cancelled-lookup exclusion.

**Requested change:** Define one consistent boundary for cancellation and history commitment. Either honor an accepted cancellation through the save and avoid retaining/publishing that entry, or explicitly end the cancellable phase before saving while maintaining a separate busy/settlement lock. Merely re-reading the signal after the write can correct the completion flag but still leave the canceled entry on disk. Add a deferred-write regression that exercises the visible Cancel action, acknowledgment, completion, final result, and retained history together. Preserve the now-passing F-01/F-02 request-ownership cases.

## Scope and independently checked behavior

- Read the current PR description, all production changes, relevant changed tests, the Dictionary-history ADR, all three slice specs, the epic, and the existing review format. `main` at `db3e49b8` is the actual base and merge-base, including the v2.10.1 work; this PR is a feature addition, not the Argon-only release branch.
- The composition root owns one history store; core remains host-independent. Summary messages omit result bodies, entries are loaded individually, and new store/hook/modal modules stay below the repository's 500-line guideline. The existing app/provider cache lifecycle was traced as part of the new feature's integration.
- Reviewed serialized lazy load, atomic sibling-write/rename, entry cap, defensive copies, partial-entry decoding, duplicate-ID handling, quarantine refusal, write-failure session fallback and subsequent recovery, listener cleanup, and project/session durability. The existing committed tests cover these paths; F-04 qualifies their privacy claim.
- Reviewed outcome-based recording, cancelled/unconfigured/failed exclusions, successful and partial Fast recording, source/option retention, and Workshop's direct service path. F-01 and F-03 qualify completion/model ownership.
- Reviewed latest-wins entry loads, ref-backed back-to-back message handling, draft restoration/discard, delete/clear/eviction cursor behavior, Copy/Save subject ownership, popup confirmation/focus restoration, disabled row selection while generating, timestamp formatting, and narrow-sidebar CSS. F-02 qualifies cached-result restoration.
- The documented right-click source omission and two-window last-writer-wins behavior are existing explicit follow-ups, not newly claimed fixes or independently accepted deferrals. Assistant/Category Search history remains out of scope.

## Verification actually run

All implementation checks target **`6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c`**, before this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**, isolated cloud checkout, lockfile dependencies installed with lifecycle scripts disabled. No dependency or functional source change was made.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **312 suites / 4,641 tests / 2 snapshots passed**, 193.803 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,138 warnings** |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; bundle sentinels verified |
| `git diff --check db3e49b8...6ee5587d` | Passed |
| Independent real-hook/router/component witnesses | **2 characterization tests passed** (4.964 s); **2 desired-safe assertions failed** (4.124 s), reproducing F-01/F-02; these are defect witnesses, not correctness passes |
| Independent host/store/real-engine witnesses | **5 characterization tests passed** (6.761 s); **4 desired-safe assertions failed** (4.320 s), reproducing F-01/F-03/F-04, including an arbitrary unknown-version privacy case |
| Implementation-head GitHub CI | **Success**, [run 38653447616](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38653447616) at `6ee5587d` |

The independent witnesses use synthetic data, mocked filesystem/prompt/provider boundaries, and JSDOM where appropriate. They are not native visual, keyboard, Extension Development Host, real-disk crash, or live-provider quality evidence. The epic's native Standard/Fast/cancel/reload/no-folder acceptance pass and ADR acceptance remain pending. No merge, deployment, publication, credentials setup, or billable provider call was performed. Required checks on the final report-only head are a separate verification step.

## Author response (2026-10-15)

All four findings were reproduced against `6ee5587d` and fixed. One commit
covers each, and F-01 and F-02 share a root cause and one commit. The ledger
statuses above are left for re-verification, because **Addressed** here means
independently verified. The ADR's [2026-10-15 amendment](../adr/2026-10-14-dictionary-lookup-history.md#amendment-2026-10-15-pr-144-review)
records the changed decisions.

| ID | Fix | What changed | Regressions |
| --- | --- | --- | --- |
| F-01 | `111b759` | The host records history **before** `STREAM_COMPLETE`, then posts completion and result back to back. The webview holds a completed stream (`loading`, so Run and `‹` `›` stay locked) until its own `DICTIONARY_RESULT` settles it (`useDictionary.isAwaitedResult`, ref-backed for back-to-back delivery). Cancelled lookups still release at once. A latent bug is also fixed: a cancelled request's id was deleted from the ignored set before the check, so its late completion was never ignored. | `DictionaryHandler.test.ts`: a deferred write shows `STREAM_COMPLETE` waits for it, with only a status reset between completion and result. `UtilitiesTabLookupSettlement.test.tsx` uses the real hooks, tab, and app router: after completion but before the result, a second Run and `‹` are blocked; afterwards the result, subject, cursor, loading, and Copy are coherent. `useDictionary.test.ts`: superseded, cancelled-late, and new-stream supersession cases. |
| F-02 | `111b759` | `DICTIONARY_RESULT` carries its stream's `requestId`. A result applies only if it settles the awaited request, whatever its outcome, so replays, superseded results, and cancelled results are dropped. A fresh failed or unconfigured result still shows. This replaces the `historyEntryId`-keyed `hasFollowedEntry` guard. | `UtilitiesTabLookupSettlement.test.tsx`: for failed, unconfigured, and recorded results, a fresh result shows and its replay after a history restore is ignored, with Copy and Save naming the restored entry. A failure replayed after a newer Fast result is also ignored. `useDictionary.test.ts` covers the same at hook level. |
| F-03 | `c4a348a` | History records what the provider reported for the call (`ExecutionResult.modelId`) through `DictionaryLookupResult.modelId`. A fast lookup collects the distinct models of its successful blocks. The entry shape is `modelIds: string[]`, empty when unreported and never guessed, and lists both models when a swap lands between blocks. The format is unreleased, so there is no migration. `getActiveModelId()` is removed. | `DictionaryService.test.ts`: a model swap held inside prompt loading (standard and streaming) yields model B. A swap between fast blocks yields `['model/A', 'model/B']`. Failed blocks contribute no model, and an unattributed run reports none. Handler tests record exactly what the service reports. |
| F-04 | `5b512e5` | Invalid-file reasons are fixed phrases. The parser message is dropped, and an unknown version is named only when it is a whole number. | The codec and store plant a marker in malformed JSON and in an arbitrary `formatVersion`, and assert it never reaches the reason or the log, whether the file is set aside or cannot be. |

Each regression was mutation-checked:
- Restoring the selection snapshot fails 3 provenance tests.
- Treating every result as awaited fails 11 tests.
- Releasing loading on completion fails 3.
- Completing before recording fails the deferred-write test.
- The old codec fails 8 privacy tests.

**Verification at `111b759`:**
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors, 1,137 warnings (1,138 at `6ee5587d`).
- Full `npx jest`: **313 suites / 4,673 tests passing**.

The native Extension Development Host pass is still pending.

## Independent re-review at `19114a20` (2026-10-15)

The complete correction delta from report head `bbd29c27` is **26 files, +998/−187**, comprising fixes `5b512e54`, `c4a348a4`, and `111b7596`, plus the ADR/epic/author-response update `19114a20`. The implementation, updated contracts/codecs/components, regression additions, and amended decision were inspected. The original four issues are addressed; F-05 is the one remaining finding. The author response above is preserved as the author's record, distinct from this independent verification.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **313 suites / 4,673 tests / 2 snapshots passed**, 141.877 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,137 warnings** |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; sentinels verified |
| `git diff --check bbd29c27..19114a20` | Reports only an extra blank line at EOF in the changed epic README and implementation record; no production-source whitespace error |
| Independent correction host/provider/store probes | **7 passed / 1 desired-safe assertion failed**, 2.584 seconds; only F-05 fails |
| Independent correction UI probes | **12 desired-safe tests passed**, 3.371 seconds; real hooks, UtilitiesTab, and window-message routing cover settlement, fresh outcomes/replays, Copy/Save, Cancel→Run and interleaved deliveries, tab unmount, clear-history, and instantaneous streams |
| Correction-head GitHub CI | **Success** for both [pull-request run 38757680942](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38757680942) and [push run 38757674086](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38757674086), exact head `19114a20` |

The earlier report-only head `bbd29c27` also passed both [pull-request run 38655081313](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38655081313) and [push run 38655077359](https://github.com/okeylanders/prose-minion-vscode/actions/runs/38655077359). Required checks on the new report-only head remain a separate step. No functional edit, merge, deployment, native EDH run, or live/billable provider call was made during this re-review.

## Author response to the re-review (2026-10-15)

Thank you for the independent verification of F-01 to F-04. F-05 reproduces
as described, and the F-01 reorder introduced it. It is fixed in `a1b2ed2`.
The status above is left for re-verification.

**Fix: the lookup stays cancellable through the save, and a cancel there is
honored.** This is the requested change's first option.
- `DictionaryHistoryStore.record(input, signal)` withdraws the entry when the
  signal aborts, before the insert or during the write. The rollback restores
  memory and file exactly, including an entry the insert would have evicted
  at the limit, re-persists, and emits nothing.
- The store's last check follows its last `await`. No macrotask (that is, no
  cancel message) can land between it and the handler resuming and posting.
- The handler reads `controller.signal.aborted` only after the save. An
  acknowledged cancel therefore completes with `cancelled: true`, posts no
  `DICTIONARY_RESULT`, and retains no entry.
- Fast lookups have no Cancel action, so their record takes no signal.

I chose this over ending the cancellable phase before the save. That option
leaves a window: a Cancel pressed while completion is in flight to the webview
is applied locally, but the host would already treat the lookup as
uncancellable.

**Regressions:**
- `UtilitiesTabCancelDuringSave.test.tsx` (new) runs the real tab and hooks,
  through the app router and a message bridge, to the real `DictionaryHandler`
  and a project-backed `DictionaryHistoryStore`. The entry's file write is held
  while the writer presses the visible **Cancel** button. The test asserts:
  - the acknowledgment ("Dictionary lookup cancelled");
  - `STREAM_COMPLETE` with `cancelled: true`;
  - no final result;
  - no retained entry, in memory or on disk;
  - the webview unlocked with no history cursor.

  A control without the cancel records the entry and shows it as `1 / 1`.
- `DictionaryHandler.test.ts` covers the same cancel-during-save at the host,
  with the store's write held.
- `DictionaryHistoryStore.test.ts` covers an already-aborted signal (nothing
  written or emitted), an abort during the write (rollback, including a
  restored evicted entry, with no emit), and a signal that never aborts.
- Mutation checks:
  - Reading `cancelled` before the save, as at `19114a2`, fails 3 tests.
  - Dropping the store's post-write rollback fails 3 tests.
- The F-01 and F-02 ownership suites pass unchanged.

**Also addressed:** the trailing blank line at EOF in the epic README and the
memory-bank entry (`git diff --check` is clean).

**Noted:** the development-data caveat for pre-fix `modelId` entries. No
entries were written from this branch here, and the epic's verification
section records it before the live pass.
