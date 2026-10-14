# PR Review — Dictionary Lookup History

**Author:** okeylanders · **PR:** [#144](https://github.com/okeylanders/prose-minion-vscode/pull/144) (open, unmerged at review)
**Branches:** `epic/dictionary-lookup-history` → `main`
**Verified base / merge-base:** `db3e49b8081629d27646125132def2b90d1ffd32`
**Reviewed implementation head:** `6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c`
**Scope:** 46 files · +5,903 / −155 · 11 commits
**Reviewed:** 2026-10-14 · **Reviewer:** Astra · **Mode:** independent source/spec review, host and real-hook/component lifecycle witnesses, real-engine model-swap probe with synthetic transport, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | Completing the stream before awaiting history persistence admits another lookup, then lets the first result overwrite its state | Real handler/store delayed-write witness; real Dictionary/history hooks and app router reproduce the mismatched subject/result | **Open** |
| F-02 | Medium / P2 | A cached failed lookup overwrites a restored history entry whenever the sidebar reappears | Real hook/router replay plus actual UtilitiesTab Copy/Save callbacks reproduce an old error exported under the restored word | **Open** |
| F-03 | Medium / P2 | The recorded model can differ from the model that actually generated the entry | Real Dictionary service/utility/run engine, delayed prompt loading, and in-place model swap produce a B result recorded as A | **Open** |
| F-04 | Medium / P2 | Invalid-history diagnostics copy manuscript fragments into the Output log | Real codec/store with malformed context reproduces a source excerpt in the logged JSON-parser reason | **Open** |

**Verdict: Changes requested.** The four findings below remain open at `6ee5587d`. Passing deterministic gates and implementation-head CI do not cover these missing boundary cases. The native Extension Development Host pass is separately pending in the epic; no native or live-provider acceptance is claimed here.

## F-01 — Keep completion and final-result ownership coherent across the history write

**Changed-code location:** [`DictionaryHandler.ts:249–263`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/application/handlers/domain/DictionaryHandler.ts#L249-L263), particularly the new `await this.recordHistory(...)` at lines 256–261.

The handler posts `STREAM_COMPLETE`, then waits for the history store to create/write/rename the file before posting `DICTIONARY_RESULT`. `useDictionary.handleStreamComplete` ends streaming and clears `loading`; the history lock and both Run buttons therefore reopen during this new disk-I/O interval. The completed content is not installed as `result` by that handler, so the result pane also goes blank until the write finishes.

**Reproduction:** Delay the history `writeFile` promise. Finish a Standard lookup for `first`, process `STREAM_COMPLETE`, and submit another lookup for `second` before releasing the write. The new submit sets `lookupSubject.word = 'second'`. When the first write finishes, its uncorrelated `DICTIONARY_RESULT` still runs through `handleDictionaryResult` and `followRecordedEntry`, producing:

- displayed result: `# first result`;
- lookup subject: `second`;
- history cursor: `first-entry`;
- `loading: false`, despite the newer request being outstanding.

The real host/store witness establishes that completion is emitted while both persistence and the final result are still pending. A separate real-hook/router witness establishes the incorrect newer-request state. If the writer navigates history instead, that entry load queues behind the same store write; the first final result can clear its `pendingEntryId`, so the eventual entry reply is ignored. Slow or remote workspace storage makes this window user-visible; no provider timing assumption is needed after the first response completes.

**Requested change:** Keep the lookup owned and locked until its final result/history identity are settled, or correlate final results so an old completion cannot replace a newer request or navigation. Do not leave a user-interactive gap around the persistence await. Preserve cancelled-lookup behavior if the settlement order changes. Add a deferred-write integration regression that attempts both a second Run and history navigation before the write resolves, and verifies result, subject, cursor, loading, and Copy/Save coherence afterward.

## F-02 — Identify cached delivery independently of whether a result enters history

**Changed-code location:** [`useAppMessageRouter.ts:91–101`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/presentation/webview/hooks/useAppMessageRouter.ts#L91-L101), with [`useDictionaryHistory.ts:311–314`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/presentation/webview/hooks/domain/useDictionaryHistory.ts#L311-L314).

The new replay protection works only when `historyEntryId` is defined. Failed and unconfigured Standard lookups deliberately have no history entry, yet `MessageHandler.postMessage` still caches their `DICTIONARY_RESULT`; `ProseToolsViewProvider.onDidChangeVisibility` replays that cache on each return to the sidebar. `hasFollowedEntry(undefined)` always returns false.

**Reproduction:** Receive a failed Standard result `Error: provider unavailable`, open a saved successful `umbra` entry from history, then hide and show the sidebar. Replaying the exact failed result replaces the restored Markdown and clears the cursor while leaving the `umbra` form and `lookupSubject` intact. The actual `UtilitiesTab` Copy and Save callbacks both then send:

```text
# umbra

Error: provider unavailable
```

Save also sends `metadata.word = 'umbra'`. The saved history entry on disk is not deleted, but the restored view is silently replaced and an export can carry the wrong content. This is the same user-visible mismatch the new replay guard and D8 are intended to prevent, reachable through ordinary provider failure rather than a rare malformed message.

**Requested change:** Give result delivery/replay a stable identity or ownership rule that also covers non-recorded outcomes. Continue showing a genuinely new failed/unconfigured lookup; do not fix this by discarding every no-ID result. Test failed/unconfigured replay after a history restore and after a newer Fast result, alongside the existing recorded-success replay control and normal fresh-error delivery.

## F-03 — Store the generating model, not an earlier mutable selection snapshot

**Changed-code location:** [`DictionaryHandler.ts:223–225`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/application/handlers/domain/DictionaryHandler.ts#L223-L225) and the equivalent capture in the Fast handler at lines 292–294. The new [`DictionaryService.getActiveModelId`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts#L205-L211) reads the manager's current selection, rather than provenance returned by the execution.

Capturing earlier prevents a later selection from relabelling an already-started provider request, but it does not establish which model that request will use. `DictionaryUtility.lookup` awaits shared/tool prompt loading before `runInitial`. The supported model hot-swap mutates the existing engine/provider in place (`AIResourceManager.refreshModelSelections` → `engine.setModel`); the provider request selects its model afterward. Thus a swap during prompt I/O makes a real request on B while the history permanently records A. Comparing reruns and models is one of the stated reasons for preserving each entry.

**Independent reproduction:** Use the real `DictionaryHandler`, `DictionaryHistoryStore`, `DictionaryService`, `DictionaryUtility`, `AgentRunEngine`, and `ConversationManager`, with only prompt I/O and the provider transport made synthetic. Begin on `model/A`, hold `loadSharedPrompts`, call the real engine's `setModel('model/B')` exactly as the manager's hot-swap path does, and release the prompt. The provider receives B and returns `# generated by model/B`; the saved entry contains `modelId: 'model/A'`. No network or billable inference is involved.

The Fast path also reuses a mutable engine across its queued blocks, so a single selected-model snapshot does not by itself prove that all blocks used that model. This latter consequence follows from the production concurrency and engine path; the independently executed witness above is Standard.

**Requested change:** Bind the run to an immutable model/provider snapshot and record that same identity, or propagate actual execution provenance through the service result and represent mixed-model Fast output truthfully. Add a regression that changes the model during prompt loading; for Fast, also cover a change between queued block waves. Merely moving the manager read to after completion trades this error for the opposite one.

## F-04 — Keep invalid-file reasons free of writer-owned text

**Changed-code location:** [`dictionaryHistoryCodec.ts:47–55`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/storage/dictionaryHistoryCodec.ts#L47-L55), consumed verbatim by [`DictionaryHistoryStore.ts:244–246`](https://github.com/okeylanders/prose-minion-vscode/blob/6ee5587dc7ba2a631c0eff28f7693b5d176cbf5c/packages/core/src/infrastructure/storage/DictionaryHistoryStore.ts#L244-L246) and its failure path.

The codec appends `JSON.parse`'s raw exception message to its invalid-file reason. Modern Node parser errors include a nearby source excerpt, so malformed history can copy the writer's context/result into the Output channel. The unknown-version path also interpolates the entire unvalidated `formatVersion` value; an independent test reproduces arbitrary marker text in logs through this path without depending on the Node parser version. This contradicts the store's stated no-words/context/results logging contract.

**Reproduction:** Load this deliberately malformed synthetic history through the real store:

```text
{"formatVersion":1,"entries":[{"request":{"context":SECRET_MANUSCRIPT_WORDS}}]}
```

On the independently tested Node 24 runtime, the parser reason includes `..."context":SECRET_MAN"...`; the store logs that excerpt while quarantining the file. Quarantine itself correctly preserves the original file. The defect is disclosure into diagnostics, not destruction or an observed network transmission.

**Requested change:** Return fixed, bounded reason codes/messages for malformed JSON and invalid version types. If useful, log a safe numeric offset or validated numeric version without embedding source fragments or arbitrary objects. Add tests asserting that distinctive word/context/result markers never appear in logs for malformed JSON, unknown-version values, or quarantine failure.

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
