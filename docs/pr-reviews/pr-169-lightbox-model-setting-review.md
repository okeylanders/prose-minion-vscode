# PR Review — Lightbox Model Setting, Slice 4L

**Author:** okeylanders · **PR:** [#169](https://github.com/okeylanders/prose-minion-vscode/pull/169) (open, unmerged at review)  
**Branches:** `epic/lightbox-model-setting` → `epic/lightbox`  
**Reviewed implementation head:** `a2fc71f8cc84ed42845cba60fdf1658f3cd7c1bb`  
**Base and verified merge-base:** `cf7f2607aceeb0fa107306870d35fb4066035b9b`  
**Scope:** 84 files · +7,443 / −177  
**Reviewed:** 2026-10-24 · **Reviewer:** Astra  
**Mode:** independent full-delta/contracts review; production-host lifecycle probes with base controls; regenerated host evidence; exact rebuilt-bundle DOM execution; supplied pixel inspection; fresh aggregate gates

## Summary

**Request changes: one P2 lifecycle regression remains.** The separate Lightbox scope correctly isolates ordinary model picks from the Workshop and preserves its cache indicator. However, an active Lightbox run retains its old disposable engine after the API key is cleared. The host acknowledges that the key is gone, then the later Opinion call can still start a new provider request through that old engine.

The empty default, following the Workshop until explicitly picked, and the “Same as Workshop” wording implement decision 51. The PR's questions about first-open seeding and alternate wording are product decisions, not review defects or decisions made on the writer's behalf.

This is a review report, not a formal GitHub review, merge instruction, release approval, or combined clearance for the separate Slice 4J / PR #168 work. A later integrated head must be checked as that actual tree.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | A deferred Opinion call can start after clearing the API key has been acknowledged |

## F-01 — Detach the old Lightbox transport when its bundle is retired

**Locations:** new bundle at [`AIResourceManager.ts:229–241`](https://github.com/okeylanders/prose-minion-vscode/blob/a2fc71f8cc84ed42845cba60fdf1658f3cd7c1bb/packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts#L229-L241), retained engine at [`LightboxReadingRunner.ts:292–305`](https://github.com/okeylanders/prose-minion-vscode/blob/a2fc71f8cc84ed42845cba60fdf1658f3cd7c1bb/packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts#L292-L305), and its retirement path at [`AIResourceManager.ts:453–460`](https://github.com/okeylanders/prose-minion-vscode/blob/a2fc71f8cc84ed42845cba60fdf1658f3cd7c1bb/packages/core/src/infrastructure/api/orchestration/AIResourceManager.ts#L453-L460).

Moving the runner from the retained assistant engine to a disposable Lightbox engine changes what happens on a key refresh. `disposeDisposableResources()` calls `engine.dispose()` on the old Lightbox bundle, but that method only clears the cleanup interval. It does not detach the `OpenRouterClient`. The runner already captured this engine for the entire run, including group F, which deliberately starts only after the chapter groups settle. Removing the bundle from the manager does not invalidate that captured reference.

Independent sequence through the production `ConfigurationHandler`, `LightboxReadingHandler`, `LightboxService`, `LightboxReadingRunner`, `AIResourceManager`, and `AgentRunEngine`, using real `p-limit` with the production default concurrency:

1. Build an Alice board and enable Headline and Opinion. Accept its current estimate and start the run.
2. Hold A's already-started transport response. Clear the API key through `handleDeleteApiKey`.
3. Wait for the successful `API_KEY_STATUS { hasSavedKey: false }` acknowledgment. The manager now has no Lightbox engine.
4. Release A with its valid worked-example response. It lands successfully and gives the real Opinion digest something to weigh.
5. **F starts a new streaming provider request through the old engine after the clear acknowledgment.** This is a new request, not merely completion of the request already sent before the key was cleared.

The identical default-concurrency host probe on `cf7f260` starts only A. F is refused with `missing-credentials`, because the formerly shared assistant engine has had its provider detached. On this head, the additional F transport start is observed. All transports were stubs and no real key, private manuscript, live request, or charge was involved.

A separate serialized-concurrency witness also records three transport starts on this head versus one on the base after the same clear acknowledgment. Explicit Stop still prevents the queued calls; missing-key presses are correctly refused before reservation; adding a key enables a fresh reservation. Those positive controls do not close the active-run retirement gap.

**Impact:** clearing the key no longer reliably prevents not-yet-started Lightbox inference. In ordinary production scheduling this affects the deferred Opinion call, which may transmit its board digest and incur an additional charge under the credential the writer just removed locally.

**Requested correction:** retire the old engine's ability to start new provider calls when its bundle is replaced or credentials are removed. Preserve any deliberate policy allowing an already-issued request to settle, and preserve landed readings and Stop behavior. Do not rely only on `getEngine('lightbox')` being absent: an active runner already holds the previous engine. Keep the default-concurrency A → clear-key acknowledgment → F witness and its base/control cases, and cover key replacement and multiple refresh listeners without restoring stale transports.

## Verified behavior and scope boundaries

- **Scope isolation:** the settings key, scope table, manager bundle, runner model facts and engine lookup, estimate/fit/price/model contract, Lightbox header and Settings row all use `lightbox`. The application still constructs one shared manager; no handler constructs engines or clients.
- **Following is distinct from pinning the same id:** empty/whitespace/unset Lightbox settings follow the resolved assistant model. A concrete Lightbox choice is independent, including choosing the current Workshop id explicitly. Returning to following sends `modelId: null` and removes the global setting. Workshop changes affect Lightbox only while it follows.
- **Synchronization:** the model watcher includes the new key. The repository tests cover the real watcher independently and the three-surface configuration/manager flow; the latter's watcher is a test reproduction, not a native VS Code event source. The regenerated evidence uses production handlers and manager with a stub catalog. Its Workshop room/cache seed is synthetic, not a provider cache measurement.
- **No-key behavior:** a fresh missing-key press cannot reserve a run on this head; resolved Lightbox model facts still exist for estimates. This positive change is separate from F-01's already-active-run case.
- **Before-start identity:** existing selected/confirmed-model and press-snapshot checks have been moved to the Lightbox scope. They reject stale estimates and selections while a pick or prompt preparation is pending. They are not a guarantee that every later group is pinned to the original model after a run has started.
- **Existing in-flight behavior, not attributed to this PR:** changing the selected scope's model after the first call begins can move later queued calls to the new model. The same controlled sequence occurs on the base and head, including the normally deferred Opinion at production default concurrency: the accepted estimate names model A, then Opinion starts on newly selected model B. This review does not claim run-wide model/price pinning is newly established by the scope split.
- **Settings hierarchy:** the existing `SettingsStore`/VS Code adapter deliberately writes only global/user settings. Workspace overrides still take precedence; clearing a global value does not remove an overriding workspace value. That inherited adapter limitation is not silently treated as new multi-scope support here.
- **Architecture/hygiene:** no added production `any`, no core `vscode` import, no second composition root. The extracted scope helper is 85 lines and the manager is reduced to 462. The already-oversized watcher, configuration handler and Settings overlay grow slightly; the slice/ADR describe that existing debt. Saved-board codec/format and manuscript persistence are not changed.

## Verification and evidence boundaries

| Check | Independent result on `a2fc71f8` |
| --- | --- |
| Full repository Jest, cloud workspace Node 24.19.0 | **508 suites / 7,053 tests / 59 snapshots pass**, 371.612 s reported by Jest |
| Typecheck | **Pass** |
| Lint | **0 errors / 1,133 warnings**, identical to independently linted base by file/rule/severity |
| Production build including `verify:bundle` | **Pass**; both bundle hashes match the author’s recorded hashes |
| Key-clearing lifecycle regressions | **3 controls pass / 1 desired-behavior failure**, 4 tests, 4.844 s; identical base suite **4 pass**, 4.819 s |
| Actual default-concurrency host probe, real `p-limit` | **Head fails / base passes** the no-new-request-after-clear assertion; A succeeds on both, only head starts F's transport |
| Regenerated production-host evidence | **1 builder test passes**, 6.431 s; log byte-identical; model-state JSON differs only in the newly generated source `capturedAt` timestamp |
| Exact production-bundle DOM | **10 state checkpoints pass, zero runtime/assertion errors** across Lightbox, sidebar Settings and Workshop; repeated pick/follow, Escape/Close/backdrop cancellation, focus restoration, external change while open, unmatched search and cache retention |
| Supplied pixels | All **24 current captures and 3 base controls** inspected in contact sheets at 500/1000/1440 px; narrow following browser and Settings row also inspected individually |
| `git diff --check` | **Pass** on the implementation delta |
| Configured implementation-head CI | **Both push and pull-request events success**; PR job inspected at Node 18.20.8, **508 / 7,053 / 59**, 286.438 s |

CI: [push run 40136881696](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40136881696), [pull-request run 40136961248](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40136961248). The PR job checked merge commit `aaeaa4fe6a67e5e5f00a43a0f313900ee96f4525`, combining this exact implementation head with `cf7f260`.

Dependency reuse was confined to an isolated cloud checkout after a byte-identical lockfile check; workspace links resolve to this checkout's packages. The repository had no `.agents/skills` directory. Tests, builder outputs and regression scripts were kept outside the implementation tree. No implementation change is part of this report.

Rebuilt bundle SHA-256: `webview.js` `6a08cf5c82fb84691c7daba7dde3cef97fd87066e5bfe7144356a540f2b23f45`; `extension.js` `ee1ecf3159692348532db00428326439f71cbf6d2c0ada909eefdb215e5dc8c3`.

The supplied pixels show the intended following/explicit selections and unchanged Workshop state. The documented 500 px Workshop overflow is pre-existing. The screenshot count is 24 current states plus three base controls, not 27 independent new-state captures. Supplied geometry was not independently re-rendered. Production-bundle JSDOM checks establish only DOM, message and focus behavior: not native VS Code geometry, Chromium 114 rendering, native select behavior, screen-reader behavior, or writer acceptance. No denied browser route was retried. All timings above are cloud/CI execution context, not native UI latency measurements.

## Merge recommendation

Fix F-01 and re-run its discriminating lifecycle witness before merging. Preserve the passing isolated/following model behavior and cache regression coverage. Keep the seeding/wording choices explicit as product questions, and recheck any later base integration rather than assuming parallel README conflicts are data loss or integration clearance.

## Author response (2026-10-24)

**F-01 is fixed** in `1d0b9753`, on top of your report's commit
`d13377e`. After it:
- `b53232d0`: the correction recorded in the slice notes, the
  ADR's D6 addendum and the agents guide;
- `36e71be4`: the merge of `epic/lightbox` at `13aff89` (Slice 4K, PR
  #168), which merged first. Its conflicts were only the epic README
  (4K's decision 50 and slice row before this slice's 51 and row) and the
  agents guide's test inventory. The ADR's addenda do not overlap;
- the commit that adds this response.

Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | P2 | **Fixed** | **A retired engine starts no new provider call.** `AIResourceManager.disposeDisposableResources()` now detaches each retired disposable engine's provider before disposing it, for every disposable scope (the Lightbox's, and the dictionary, context, category and widget engines, which a service can also hold across a call). It runs whenever a bundle is retired: a key removed or replaced, any rebuild, and disposal. An engine a run still holds then refuses its next call in `requireProvider()` as `missing-credentials`, the same failure `cf7f260` gave through the detached assistant engine: the Opinion fails with "Add an OpenRouter API key in Settings to run AI analyses.", and nothing is sent. A request already sent keeps the provider it took at its start, so it settles; landed readings and Stop are unchanged. The runner is not changed: the fix holds for anything that keeps an engine, not only `getEngine('lightbox')` being absent.<br>**Overlapping rebuilds are ordered.** Each webview's handler refreshes the manager on a key change, so rebuilds overlap. Each now takes a number; one that a newer rebuild overtook while it read the key builds nothing and settles with the newest, so a rebuild that read the old key can never replace the new key's transports. A failed overtaken rebuild no longer clears the newer one's promise | `LightboxKeyRetirement.test.ts` (new, 5), through the production `ConfigurationHandler` key routes, `LightboxReadingHandler`, `LightboxService`, `LightboxReadingRunner`, `AIResourceManager` and `AgentRunEngine`, with real `OpenRouterClient`s whose streaming transport records each start and holds group A; the p-limit mock runs every chapter call at once, as the default concurrency does:<br>• **Your witness:** A started and held, `DELETE_API_KEY` acknowledged (`API_KEY_STATUS { hasSavedKey: false }`, no Lightbox engine), A released: one transport start only, A `ok`, F `failed` with the missing-key words<br>• **Key replacement and several refresh listeners:** `UPDATE_API_KEY` beside two more `refreshConfiguration()` calls at once, then a hot-swap. The held engine stays detached, the current engine is new and carries the new key, F is refused with nothing sent, and an Opinion pressed again runs on the new engine and key<br>**Controls:** the key kept, A and F both start; Stop keeps F from starting; a press with no key is refused before anything is reserved, then runs once a key is added<br>`AIResourceManager.test.ts` (+2): every retired disposable engine refuses a new call as `missing-credentials` while the new one is attached; a rebuild that read the old key and answers last leaves the newer engines, and the assistant engine's new key, in place | `1d0b9753` |

### What fails where

The new and changed tests, run against other source trees:

- **Your reviewed head** (`a2fc71f`'s sources, at `d13377e`): 4 of 19
  fail. They are the witness (two transport starts, both on the first
  key), the replacement case (the held engine is still attached), and
  both manager cases. The three controls pass.
- **`cf7f260`**, type checks off since the file names the `lightbox`
  scope: the witness passes there, as your base probe found, and so do
  the key-kept and Stop controls. Two fail, as they should:
  - **The replacement case:** the shared assistant engine took the new
    key and sent the Opinion on it.
  - **The no-key control:** the offline assistant engine accepted the
    press. That refusal before reserving is this slice's own positive
    change, which you noted.

### On the behavior a writer sees

- **Key removed during a run:** the Opinion fails with the missing-key
  words, as on `cf7f260`.
- **Key replaced during a run:** the Opinion also fails with those words,
  where `cf7f260` would have sent it on the new key. A run that began on
  one credential does not continue on another. Finish or the Opinion's
  Analyze runs it on the new key, as the replacement test's second press
  shows. Under 4J's keep-readings rule, the earlier Opinion stays beside
  that failure on that branch; here, F simply fails cleanly.
- **Other features:** a dictionary fan-out or widget step that has not
  started when the key changes now fails the same way instead of using
  the retired client. This is the same policy, and no test needed to
  change.

### Verification

On the merge, `36e71be4`, after `npm ci` into the worktree's own
`node_modules` (the commit that adds this response changes only docs):

| Check | Result |
| --- | --- |
| Full Jest, Node 22 | 512 suites / 7,141 tests / 59 snapshots, all passing (the fix alone, before the merge: 509 / 7,060 / 59) |
| Full Jest, Node 18.20.8 | The same counts, all passing |
| Lint | 0 errors, 1,133 warnings, identical to `13aff89` and to `cf7f260` per file, rule and severity |
| Typecheck | Passes under Node 22 and Node 18 |
| `npm run build` (with `verify:bundle`), twice under each Node | `webview.js` `6a08cf5c82fb84691c7daba7dde3cef97fd87066e5bfe7144356a540f2b23f45`; `extension.js` `17b0bf40eccca7d56f0be523937cf92de5849cdc04da34df3299bfd25b7e3227`, all four times |
| `git diff --check` | Clean |

`webview.js` is unchanged from your reviewed head, since the fix is
host-side only. The visual evidence is unchanged for the same reason.

The writer's questions, seeding the Lightbox model on first open and the
"Same as Workshop" wording, stay open with the coordinator.
