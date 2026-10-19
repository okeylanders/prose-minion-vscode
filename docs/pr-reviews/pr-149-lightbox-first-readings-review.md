# PR Review — Lightbox Slice 2B: First Readings

**Author:** okeylanders · **PR:** [#149](https://github.com/okeylanders/prose-minion-vscode/pull/149) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-2b-readings` → `epic/lightbox`
**Verified base / merge-base:** `3e6eba3c5c0e76afb72280691b7b6a0a5b9e7d7b`
**Reviewed correction head:** `bf8f1ca2502441133216ca5013480da9aa37f9cf`
**Initial implementation head:** `305ce1e2b9924d817c66c39514f2511118082c44` · **Initial report commit:** `9ad4e34f32fcea8037b240fe555df9944b47925f`
**Current scope against base:** 126 files · +11,244 / −253 · 29 commits (including the initial review report)
**Correction delta since initial report:** 57 files · +2,771 / −457 · 12 commits
**Reviewed and independently re-reviewed:** 2026-10-19 · **Reviewer:** Astra
**Mode:** independent source/spec review; real-service, runner and engine probes with synthetic streaming transport; codec/evidence probes; real-root and production-bundle DOM witnesses; supplied-image inspection; Workshop lifecycle parity; full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **Partially addressed** = reproduced residual remains · **N/A** = no action. Author-proposed deferrals are discussed below; this review does not record acceptance on the writer's behalf.

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Normalized quote matching can return the wrong source span after supplementary Unicode characters | **Addressed** |
| F-02 | Medium / P2 | Closing the tab during prompt preparation does not prevent its paid run from starting afterward | **Addressed** |
| F-03 | Medium / P2 | Original board/run correlation repaired; selected-model changes can still accept an old-model estimate and start on that old model | **Partially addressed — remains blocking** |
| F-04 | Medium / P2 | Withheld headline claims and blocks disappear behind the ordinary fallback heading | **Addressed** |
| F-05 | Medium / P2 | Model-controlled keys and raw provider errors enter Lightbox logs and failed-group diagnostics | **Addressed** |
| F-06 | Low / P3 · nonblocking | A low-affinity genre neighbor can omit its required near-miss explanation | **Addressed** |
| F-07 | Low / P3 · nonblocking | “Quotes checked” omits successfully verified quotes on a withheld motif | **Addressed** |
| F-08 | Low / P3 · nonblocking | Inspector re-read remains enabled for an off lens or a too-large call | **Addressed** |
| F-09 | Low / P3 · nonblocking | Rare compatibility-mark sequences still miss whole-string NFKC-equivalent quotes | **Open** |

**Verdict: Request changes.** Seven original findings are independently addressed. F-03 remains P2 because the new Lightbox estimate/request integration can start a reading on a model other than the one the writer just selected while that selection is being saved. The old-model estimate is internally consistent, so this is **not** a demonstrated higher-price spend against that estimate; it is a selected-model ownership failure. After the save completes, the host safely refuses the stale key and re-estimates. F-09 is a separate, conservative false-negative and is nonblocking. Passing deterministic tests and correction-head CI do not resolve either finding.

This is a review for integration into `epic/lightbox`, not merge authorization, native VS Code acceptance or live-provider acceptance. Any later approval remains conditional on required CI passing on the exact report-only head. The author's response is preserved verbatim below; its all-fixed assessment is not the independent verdict.

**Inherited PR #148 F-05 is independently addressed here.** It is distinct from this report's new F-05. Both an exact repeated jump to ¶812 and sparse ¶100 → ¶101 refocus the landing chip. Passive board updates do not steal focus. Real-root and rebuilt-bundle witnesses pass, as do the existing bounded 5,000-address navigation and pin-ownership cases.


## Re-review of `bf8f1ca` — 2026-10-19

All twelve commits after the initial report were inspected, including the author response, new ownership/correlation modules, changed tests, six new screenshots and their request-aware harness. The base remains `3e6eba3`. The correction head was fetched into the same isolated worktree; the earlier probes were adapted to the new request-id/estimate-key protocol without changing production files.

### Independently verified resolutions

- **F-01 addressed:** every emitted UTF-16 code unit now has a source mapping; matches must respect normalization-unit boundaries and the returned source span must fold back to the matched form. The original emoji case returns exactly `“Alice waited”`. Decomposed Hangul, compatibility ligatures, combining accents, supplementary characters inside quotes, whitespace and dash cases pass. The original wrong-span blocker is closed; the broader NFKC claim has the distinct F-09 limitation below.
- **F-02 addressed:** the host captures the priced snapshot and reserves a minted run identity before loading prompts, then verifies ownership and the live key before starting. Closing during preparation produces **zero provider calls and zero later posts**. Independent context add/remove, one/all lens toggles, model, price, window and source changes each refuse without sending and release the reservation for an explicit fresh press. Duplicate pending presses, a removed engine, prompt-load failure and a closed-handler/reopened-handler interleaving also behave safely. F-03's remaining selected-model intent gap occurs before the shared configuration state has changed; it is not a failure of this new host snapshot comparison.
- **F-03 substantially repaired, still open:** old-board and out-of-order estimates cannot overwrite a newer request; price is withdrawn while that request is pending; progress and Stop are scoped by board/token. Original wrong-board price, late finish disabling another board's Stop, mismatched cancellation, reload ownership and replaced-run cases now pass. The model-selection integration below is still missing.
- **F-04 addressed:** a withheld headline claim/block and failed/cancelled headline call are visible beneath the fallback heading. Independent tests run the real codec, verifier and assembly before rendering; rejected text is not promoted to the headline, and valid sibling tiles survive.
- **F-05 addressed within its original Lightbox scope:** arbitrary root/nested keys no longer enter ordinary failure reasons; raw provider error bodies/strings/objects/null and custom error names are reduced to host-owned categories and bounded HTTP status. Root diagnostics reach only the recovery capture beside the quarantined body. These checks used the real runner, real `p-limit` and real `AgentRunEngine`, with synthetic provider streams. The unchanged engine-level interrupted-stream `errorType` log remains an inherited limitation, discussed below.
- **F-06 addressed:** blank/whitespace near-miss explanations fail for low-affinity neighbors, including values rounded to 0.40. Sufficiently valid neighbors still survive a malformed sibling. Discarding unsolicited near-miss prose above 0.40 is an explicit, reasonable leniency.
- **F-07 addressed:** per-lens counters record all quote checks before evidence deduplication. The original withheld-motif witness now reports three checks. Successful single-lens replacement, failed/stopped re-read retention, duplicate/failed quotes and full-run reset preserve the intended totals.
- **F-08 addressed:** inspector re-read is disabled with a reason for an off lens, pending/missing single-lens estimate, too-large call, running board or unavailable provider. A deliberately unknown model window remains labeled and permitted; unknown is not silently treated as a known fit.

**Inherited PR #148 F-05 reconfirmed on the corrected production bundle:** exact ¶812 twice, sparse ¶100 → ¶101 followed by ¶101 again, and passive-update focus preservation all pass.

### F-03 residual — Bind a usable estimate to the selected model and its confirmed configuration

**Severity:** Medium / P2; blocking. **Changed Lightbox paths:** [`LightboxApp.tsx:81–92`](https://github.com/okeylanders/prose-minion-vscode/blob/bf8f1ca2502441133216ca5013480da9aa37f9cf/packages/core/src/presentation/webview/LightboxApp.tsx#L81-L92), [`useLightbox.ts:214–227`](https://github.com/okeylanders/prose-minion-vscode/blob/bf8f1ca2502441133216ca5013480da9aa37f9cf/packages/core/src/presentation/webview/hooks/domain/useLightbox.ts#L214-L227) and [`277–284`](https://github.com/okeylanders/prose-minion-vscode/blob/bf8f1ca2502441133216ca5013480da9aa37f9cf/packages/core/src/presentation/webview/hooks/domain/useLightbox.ts#L277-L284).

The latest request id and board id do not prove that a reply priced the model selected in the UI. The inherited shared picker updates its selection optimistically, while `ConfigurationHandler.handleSetModelSelection` awaits `SettingsStore.update`, then waits 50 ms and sends `MODEL_DATA`. Lightbox requests an estimate immediately on the optimistic model-id change. Its host can still correctly see the old model, and the reply is accepted because the current request does not carry or validate the intended model. When saving completes, the same selected model id/window produces no further estimate request. The panel's asynchronous message delivery does not serialize the configuration write with these reading requests.

**Independent integrated reproduction:** the rebuilt production bundle in JSDOM, actual model-picker interaction, real `ConfigurationHandler`, real Lightbox handler/runner/engine, public-domain chapter, held settings-write seam and stub catalog/provider transport. No native host or live inference is involved.

1. Begin on `provider/cheap`, with a usable estimate. Select **“Expensive new model”** (`provider/expensive`) in the actual picker while its settings write is held.
2. Lightbox's new estimate request is answered from the still-current `provider/cheap` host state. The selector says **Expensive new model**, the line says **3 calls · est. $0.07**, and **Read is enabled**.
3. Press before the write resolves: **three provider-adapter requests start on `provider/cheap`**, with no refusal. The visible selected-model intent is not honored.
4. In a separate run, resolve the write before pressing. The identical-value `MODEL_DATA` confirmation requests no new estimate; the old one remains enabled. Pressing now makes **zero provider calls**, emits the stale-key refusal, and requests a correct expensive-model estimate. There is no automatic paid retry.
5. A same-model price-only `MODEL_DATA` refresh also leaves the old estimate enabled because `modelKey` contains only model id/window. The witness retained **$0.068778** until a safe refused press refreshed it to **$0.081816**, with **zero provider calls**.

The host key guard is doing useful work: once host configuration changes, it prevents old pricing from authorizing the new model. It cannot detect UI intent that the Lightbox request never conveyed. The pre-existing optimistic picker and async save are not themselves introduced by this PR; the new Lightbox feature must integrate with that lifecycle rather than assume the estimate request runs after persistence.

**Requested correction:** keep reading unavailable until the usable estimate corresponds to the current selected **and confirmed** model/configuration; reject an old-model answer even when its request id is latest. Re-estimate on authoritative configuration confirmation and relevant catalog-price changes, including same-id/window confirmations. Carry enough request identity to avoid accepting old-model replies during a pending selection; do not rely on a faster settings write or automatically retry a paid press. Add integrated regression coverage for a held settings write, actual picker change, old-model latest reply, press before/after confirmation, and a price-only refresh. All original board/token protections must remain intact.

### F-09 — Rare compatibility-mark sequences are still not whole-string NFKC equivalent

**Severity:** Low / P3; nonblocking. **Location:** [`LightboxQuoteVerifier.ts:168–178`](https://github.com/okeylanders/prose-minion-vscode/blob/bf8f1ca2502441133216ca5013480da9aa37f9cf/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L168-L178).

The pairwise normalization-unit builder can commit an earlier unit before a later compatibility-mark sequence enables composition across that boundary. For source `Alice Aﾞﾟ̣ waited.`, the quote `source.normalize('NFKC')` is `Alice Ạ゙゚ waited.`. The production fold is `Alice Ạ゙゚ waited.`, so the verifier reports `found: false, reason: 'not-in-chapter'` despite whole-string NFKC equivalence.

This same narrow case fails at the initial `305ce1e2` head: it is a residual of this PR's normalization implementation, not a regression introduced by the correction. It can unnecessarily withhold a genuine quote/claim and contradicts the new comment's universal whole-string guarantee. It does **not** reproduce the original wrong verified source span, and it requires unusual mixed-script compatibility marks; no ordinary-script/combining-mark counterexample was found.

An independent 10,000-sample corpus of ordinary combining marks, Hangul, Thai/Lao fragments, compatibility capitals, ligatures and emoji had no fold differences or missed equivalent quotes. Another 10,000 samples allowing adversarial halfwidth voicing marks produced seven false negatives, with no incorrect returned spans/reference-fold mismatches among accepted quotes across both corpora. These probes do not prove universal Unicode safety.

**Requested follow-up:** either make normalization units agree with full-string NFKC across such boundaries, retaining accurate original-span mappings and boundary checks, or document the narrower supported equivalence honestly. Add the minimal case as a regression. Conservative withholding is the safe failure mode, which is why this remains nonblocking rather than reopening F-01.

### Re-review checks and limits

| Check | Independently observed result at `bf8f1ca` |
| --- | --- |
| Full `npm test -- --runInBand` | **349 suites / 5,115 tests / 2 snapshots passed**, 145.735 seconds |
| `npm run typecheck` | Core, webview and extension passed |
| Full `npm run lint` | **0 errors / 1,135 warnings**; per-file/message/rule multiset exactly matches the initial reviewed baseline |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; all three bundle sentinels present |
| Whole-PR and correction-delta `git diff --check` | Passed |
| Real-engine host checks | **73 assertions passed**: 21 retained positives, 46 ownership/estimate/fit checks, 6 close/reopen/prompt-failure checks |
| Focused existing evidence/codec/runner/state suites | **7 suites / 115 tests passed** |
| Independent codec/evidence probes | Original **13 positive boundaries** and **11 closure assertion groups passed**; one broader normalization-property group reproduces F-09 |
| Additional Unicode stress | **20,000 cases**; seven conservative false negatives in the adversarial subset, no observed wrong accepted spans |
| Real-root UI checks | **3 suites / 18 tests passed** |
| Exact corrected Lightbox production bundle | **38 assertions passed**, including original UI defect closures and inherited PR #148 focus checks |
| Integrated picker/configuration/host witness | Three model-order/price-refresh scenarios reproduce the F-03 residual above; expected-safe behavior is **not** claimed |
| Workshop lifecycle comparison | **9 checkpoints / 27 parity assertions passed**, against the reviewed PR #147 integrated bundle |
| New visual evidence | All **6 new PNGs** inspected at actual pixels, at 1440/1000/500 px; new harness/builder/state provenance inspected |
| Exact new report-head CI | **Pending separate post-publication verification**; correction-head CI is not report-head CI |

Corrected production `webview.js` SHA-256: `1894febb83bca93f49cc95baaa18c00759c0af28fc7157e18ce28bb0bc61f85b`.

The new captures clearly show withheld headlines and disabled off-lens re-read reasons. The prior fourteen captures were inspected in the initial pass; their model/prices and hand-adjusted group A are still synthetic. The request-aware screenshot harness now answers each live request id with its recorded estimate. The author's pixel-stability, no-overflow and browser-page-error claims were **not** independently rerun in Chromium here. JSDOM's known stylesheet-parser diagnostic persists; DOM/event/focus checks are not native-browser layout, accessibility or VS Code acceptance.

**Privacy scope:** the new Lightbox codec/runner failure paths are sanitized, but the unchanged [`AgentRunEngine.ts:867–870`](https://github.com/okeylanders/prose-minion-vscode/blob/bf8f1ca2502441133216ca5013480da9aa37f9cf/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L867-L870) interpolates provider `errorType` after an interrupted visible stream. A synthetic multiline value still reaches that inherited log while the Lightbox outcome stays sanitized. The original F-05 explicitly excluded global engine logging; closing it is not a claim that all provider diagnostics are safe. Recovery capture/presentation remained mocked in these probes.

D4 stale-reading retention remains author-proposed work due before Slice 3 handoffs; live-provider/cache/cost calibration remains due in the Slice 6 pass. Neither is accepted on the writer's behalf or silently marked complete by this re-review. An already-started run intentionally survives a source switch and settles only on its retained canonical owner; a pending obsolete press does not send. The disclosed prompt-load estimate-failure behavior can still leave the UI at “Estimating…” until another request; this is not evidence of a successful estimate.

Only this existing report is changed for publication. The original author response below is preserved byte-for-byte; no source, tests, screenshots or configuration are modified.

## Initial review findings — historical at `305ce1e2`

The sections below retain the initial evidence and requested repairs. Their original open states are superseded by the current resolution ledger and re-review above.

## F-01 — Preserve UTF-16 source-span identity through quote folding

**Location:** [`LightboxQuoteVerifier.ts:113–147`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L113-L147), consumed at [`65–69`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L65-L69).

`foldWithMap` pushes one mapping entry for each Unicode code point, but `indexOf` and `form.length` address the joined string in UTF-16 code units. A supplementary character before or inside a normalized match separates these coordinate systems. The resulting slice is returned as verified evidence without checking that it still represents the matched quote.

**Independent reproduction:** Paragraph `😀😀😀😀 “Alice waited” today.`; requested quote `"Alice waited"`. The result is `{ found: true, match: 'normalized', text: 'ce waited” tod' }`, rather than `“Alice waited”`. The erroneous span reaches the assembled tile as verified. The exact-match path is unaffected.

The same normalization boundary has a smaller false-negative: `The 가 house waited.` and `The 가 house waited.` are NFKC-equivalent, but the current base-plus-combining-marks segmentation separates Hangul Jamo and reports `not-in-chapter`. Accent composition and compatibility ligature expansion pass.

**Requested change:** Use a consistent UTF-16 mapping for every emitted code unit, with source spans that remain correct through expansions, contractions and dash/space folding. Preserve whole-string NFKC equivalence rather than assuming that every composition is a base plus combining marks. Add supplementary characters before/inside a match, Hangul composition, ligatures, combining marks and repeated dashes to the tests. Assert the actual returned source span, not only `found` and `match`; it must fold to the quote form that matched.

## F-02 — Own a run before awaiting its prompt files

**Location:** [`LightboxReadingHandler.ts:126–167`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/application/handlers/domain/LightboxReadingHandler.ts#L126-L167), with disposal at [`96–103`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/application/handlers/domain/LightboxReadingHandler.ts#L96-L103) and ownership acquired at `210–213`.

The handler captures the source and lenses, then awaits `runner.prepare`. A pending press is not in `ownRuns` yet. `dispose()` therefore cannot stop it, and the post-await guard checks only the current board and an already-active run, never `disposed` or a pending-request identity.

**Independent reproduction:** Use the real handler, service, measurements, `PromptLoader`, runner, `p-limit`, `AgentRunEngine` and conversation manager. Hold only prompt-file reads, and use a synthetic provider stream.

1. Press Read on the current board; hold its prompt reads.
2. Dispose the handler, as closing the tab does.
3. Release the prompt reads.
4. Observe **three provider-transport invocations**, all three groups settling `ok`, and **eight post-disposal messages**.

No live provider was called. The witness demonstrates the point at which real execution would spend after the tab was closed; it is not merely a stale UI message.

Related controlled interleavings expose the unversioned preparation snapshot: removing a context file during preparation still sends its captured text, turning every lens off still starts the previously planned three groups, and switching the model sends on the new model after the old model's estimate was displayed. Click-time context/lens snapshot semantics can be a deliberate product choice, but they need to be explicit and coherent with the run's disclosure. They do not justify starting work after disposal.

**Requested change:** Give preparation a lifecycle-owned identity before the first await, invalidate it on disposal, and check ownership before starting or publishing. Define which source/context/lens/model snapshot the press owns; freeze that snapshot or invalidate and re-estimate it when it changes. In particular, a new model must not silently inherit another model's displayed price. Add close-before-start, close/reopen, changed-input preparation and delayed-prompt tests using the real runner boundary, alongside the existing close-after-start test. Preserve the passing guard that refuses an old prepared request after a different board is adopted.

## F-03 — Correlate the estimate, progress and Stop with their owner

**Locations:** [`useLightbox.ts:165–195`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/hooks/domain/useLightbox.ts#L165-L195), [`lightboxRunLine.ts:87–113`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxRunLine.ts#L87-L113), [`LightboxApp.tsx:81–92`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/LightboxApp.tsx#L81-L92), and host publication at [`LightboxReadingHandler.ts:316–339`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/application/handlers/domain/LightboxReadingHandler.ts#L316-L339).

Board changes leave the previous estimate usable. Estimate messages overwrite both estimate and active-run state without board/request correlation. Any `finished` or `cancelled` progress clears `activeRun`, even when it belongs to another board. Although the run line filters progress by board, its fallback active-run token is not similarly filtered. Runs intentionally continue across source switches, so these are reachable lifecycle combinations.

**Independent real-root and production-bundle reproductions:**

- Switch A → B. B shows A's old enabled priced press while B's estimate is pending.
- Deliver B's `too-large` estimate, then a late A estimate. B's disabled press becomes enabled with A's price.
- Switch the assistant model. A fresh estimate is requested, but the old priced press remains enabled meanwhile.
- While B runs, A finishes. B's Stop becomes disabled because A clears B's active-run state and its progress replaces B's progress.
- Deliver a late A estimate carrying active run A, then A streaming progress. Stop posts `{ boardId: 'B', token: 'run-A' }`, which cannot stop B.

The host has the matching stale-publication defect even without a board change: hold an all-lenses estimate, switch every lens off and let the new zero-group estimate publish, then release the old estimate. The last host message restores three groups for the same board. `boardId` alone cannot distinguish these requests.

**Impact:** A writer can see a price/call count for the wrong inputs and lose effective cancellation for a paid current run. The host still rechecks fit before sending; this is **not** a demonstrated context-window bypass. Likewise, retained board results remain attached to the correct board in the passing service tests. The defect is in ownership of estimates and run controls.

**Requested change:** Version estimates by their full input/request identity, suppress stale host completions, invalidate the usable estimate while relevant inputs change, and accept only the matching current reply. Keep active runs/progress scoped to both board and token; one board finishing must not clear another's controls. Construct cancellation from the correlated active run rather than mixing the current board with an arbitrary token. Cover different-board and same-board out-of-order estimates, model/context/lens changes, concurrent retained-board runs and late progress after Stop/new run. F-02's pending-start ownership is a separate host boundary; fixing only one does not fix the other.

## F-04 — Show withheld headline claims and blocks

**Location:** [`LightboxHeadline.tsx:16–20`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/components/lightbox/LightboxHeadline.tsx#L16-L20).

Unlike the other reading surfaces, the headline renderer reads only a surviving headline tile. If there is none, it returns the ordinary heading and never examines the headline lens's withheld claims/blocks or failure state.

**Independent reproduction:** Feed the production codec/verifier the worked example with all headline quotes replaced by nonexistent text. It correctly yields a withheld headline claim with its title and reason, while valid sibling readings survive. Separately remove the headline's required friction: the codec correctly withholds that block. In both cases the real root displays neither the reason nor the rejected claim's title. The rebuilt production bundle confirms the same hidden rejection.

This violates D7's explicit “withheld, not hidden” contract. A run-line aggregate count does not identify which claim failed or why.

**Requested change:** Project the headline lens's state alongside the fallback heading, including its withheld title/reason, withheld block and relevant failure state. Keep the ordinary heading when no valid headline exists, but make the rejected reading discoverable. Test these cases through codec → board → root rather than only the standalone tile renderer.

## F-05 — Keep arbitrary diagnostics out of ordinary Lightbox logs

**Locations:** [`LightboxReadingCodec.ts:61–65`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts#L61-L65) and [`LightboxReadingRunner.ts:308–310,392–400`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts#L308-L310).

The new Lightbox diagnostic paths treat arbitrary model/provider strings as safe reasons:

- A framed response with an unknown root key `Synthetic private note` echoes that key into Output and the failed group's error. Cutting the key to 24 characters limits volume; it does not prevent copied chapter/context prose from entering logs.
- A synthetic provider error containing `Provider rejected input: Synthetic private note`, a newline and 600 further characters passes unchanged through `runGroup` into Output and the failed-group error.

The second witness uses the real `AgentRunEngine` and real `p-limit` with a mocked provider stream. The engine's ability to propagate an `OpenRouterApiError` is pre-existing; the finding is the **new Lightbox catch/log/publication boundary** at lines 308–310, plus the new codec's field-name interpolation. It does not claim this PR introduced a global engine logging policy.

Malformed JSON is handled more carefully: only a safe position enters diagnostics, while the original response is quarantined. That separation should extend to arbitrary field names and transport details. These probes used synthetic strings, and recovery capture/presentation was stubbed; no recovery files or private manuscripts were involved.

**Requested change:** Use host-owned categories and bounded safe messages for ordinary Output and board errors. Keep raw keys/provider detail behind an explicit recovery or diagnostic boundary with the appropriate privacy contract. Test prose in root keys, multiline/oversized provider errors, and safe failure/recovery notices. Truncation alone is not redaction.

## Nonblocking correctness notes

### F-06 — Require the low-affinity near-miss explanation

[`LightboxReadingCodec.ts:302–307`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxReadingCodec.ts#L302-L307) bounds `nearMiss` but permits it to be blank at affinity ≤0.40. Two otherwise-valid neighbors at 0.8 and 0.4 with `nearMiss: ''` both decode/assemble; the low-affinity card has no explanation. Require nonblank text for the low-affinity case, as the genre prompt and implementation notes promise. The converse empty-string rule for higher affinity should also be explicit if it is intended as a strict contract.

### F-07 — Count checked quotes consistently, or name the displayed subset

At [`LightboxReadingTiles.ts:217–222`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/infrastructure/lightbox/LightboxReadingTiles.ts#L217-L222), a motif with two valid quotes from only one paragraph is correctly withheld for insufficient recurrence, but its successful quote checks are not retained. [`lightboxReadings.ts:122–129`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts#L122-L129) later reconstructs “checked” from retained evidence and failed quotes. A fixture with one valid headline quote and two valid same-paragraph motif quotes reports **3** checks during assembly but **1** in the UI tally. Preserve an appropriate per-lens check count, or label the UI figure as retained evidence rather than all checks performed. This does not invalidate the motif withholding itself.

### F-08 — Disable unavailable inspector re-reads with their reason

[`LightboxApp.tsx:109–117`](https://github.com/okeylanders/prose-minion-vscode/blob/305ce1e2b9924d817c66c39514f2511118082c44/packages/core/src/presentation/webview/LightboxApp.tsx#L109-L117) gates re-read only on provider availability and another run. A pinned motif remains re-readable when its own estimate is `too-large`; turning its lens off leaves an enabled button saying only “1 call.” The host safely refuses both cases, so there is no demonstrated spend bypass. Gate by a current matching single-lens estimate and lens availability, and show the reason instead of offering a press known to fail.

## Initial scope assessment and retained guarantees

The new reading modules preserve the ports/adapters direction, named Lightbox routes and composition-root construction. The core has no new VS Code dependency. The closed tile/register maps, separate context shelf, per-block codec boundary, required friction, host term counting and chapter-only verifier are appropriate foundations. Readings remain ephemeral; no saving or Workshop handoff is quietly introduced.

Independent positive probes verified that:

- Exact prepared system/user messages have the same estimated input-token count as the messages sent through the real engine; each provider call reserves 8,000 output tokens. Actual engine usage fans out once per settled call, and reading conversations are discarded.
- Stop aborts pending provider signals, keeps arrived groups, rejects late outcomes and prevents queued calls in a real serial `p-limit` run.
- A new board adopted during preparation prevents the obsolete request from sending.
- Identical display paths/text at different canonical URIs retain distinct board identities. A hidden board's result lands only on that retained board; returning to its URI recovers its reading. Hash-normalized unchanged re-reading retains identity.
- Invalid items/blocks can be withheld while valid siblings survive; blank friction fails; unrequested lenses are ignored; quote-size and positive paragraph bounds hold. Wrong, undeclared and context-only quotes fail without carrying failed quote text into the board. The two-paragraph motif rule and host-only term counting/deduplication hold.

The word-frequency tokenizer's ASCII-oriented behavior remains an inherited limitation, not a new finding about this PR's source ownership. Prompt wording governs semantic “describe, never grade” behavior; strict JSON and quoted-evidence validation do not prove that a model's interpretation is sound or that prompt injection is impossible.

**D4 stale readings:** The author explicitly proposes deferring carry-over/reverification until before Slice 3's handoffs. That is a bounded staging choice on this epic branch because there is no handoff in Slice 2B, and a changed source gets empty readings rather than falsely current evidence. It still loses paid readings after a small text edit. A run for a changed/evicted board also continues but drops its result. The debt remains open; neither D4 completion nor writer acceptance is inferred here. Before Slice 3, verify moved/removed quotes, stale labeling and fresh-read replacement against the current source. At the initial review, F-02/F-03 were current lifecycle defects, not covered by that deferral; their current statuses are above.

**Live-provider/caching pass:** Moving the cache-read experiment and estimate-to-processed ratio to Slice 6 is transparently recorded. No cache savings are claimed; the differing group system prefixes make the lack of a shared leading cache prefix real. Typical output lengths, provider adherence, timeout/concurrency choices and cost calibration remain unmeasured. The original Slice 2B live “Done when” criterion is therefore not completed. These are explicit future acceptance gates, not evidence supplied by the stub-priced screenshots.

**Tension per column:** The exact array length, 0–9 range and host-specified bucket ranges are coherent with the 96-column ribbon bound. A one-score-per-column representation is a reasonable bounded output decision; the live pass still needs to establish how reliably models produce it.

## Initial verification and visual limits

Runtime: **Node 24.19.0 / npm 11.9.0**, isolated cloud worktree. Dependencies were copied with relative workspace symlinks preserved after the lockfile was verified identical to the reviewed PR #148 checkout. No dependency/source/configuration changes were made. All probes used synthetic text or committed public-domain Alice fixtures; no live or billable provider calls.

| Check | Independently observed result |
| --- | --- |
| Full `npm test -- --runInBand` | **344 suites / 5,058 tests / 2 snapshots passed**, 165.501 seconds |
| `npm run typecheck` | Core, webview and extension passed |
| Full `npm run lint` | **0 errors / 1,135 warnings**; normalized per-file/message/rule multiset exactly matches PR #148's corrected baseline |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; all three bundle sentinels present |
| Whole-PR `git diff --check` | Passed |
| Independent real-engine host positives | **21 assertions passed**, including actual prompt/message estimation, usage, cancellation, queueing and canonical source ownership |
| Independent host defect witnesses | Close-during-prepare, context/lens/model interleavings and out-of-order same-board estimates reproduce F-02/F-03 |
| Focused existing evidence/prompt/runner suites | **5 suites / 76 tests passed**, in addition to the full run |
| Independent codec/evidence boundaries | **13 assertions passed**; separate defect probes reproduce F-01/F-05/F-06/F-07 |
| Independent real-root UI tests | **3 suites / 15 tests passed**, including defect witnesses and inherited paging/focus checks |
| Rebuilt Lightbox production bundle | **24 assertions passed**; confirms F-03/F-04 and PR #148 F-05 resolution |
| Workshop lifecycle comparison | **9 checkpoints / 27 parity assertions passed** against the reviewed PR #147 integrated bundle |
| Supplied visual evidence | All **14 PNGs** inspected at actual pixels; harness, builder and recorded-state provenance reviewed |
| Exact report-head CI | **Pending separate post-publication verification** |

Production `webview.js` SHA-256: `9b4dd41647ccb5927274bf3a33c6597f36ff535d62409bf8dc039c67473470b0`.

The passing defect-witness assertions record the observed bugs; they are not passing expected-safe regressions. The author's 5,058-test suite has no reported failure. Scratch probes remain outside the tracked checkout so the developer can add focused permanent regressions without inheriting review-only harness code.

The supplied 1440/1000/500 px captures show coherent idle, streaming, done, too-large and stacked-inspector states. Replaying their recorded messages confirms the 31 tension cells, three pending skeletons, 25 checked/one withheld display, evidence and withheld-reason-only presentation. Their model and prices are synthetic; groups B/C use worked examples, while group A's full-chapter tension scores/claim and deliberately paraphrased quote are hand-adjusted as documented. They were authored in headless Chromium with a stub VS Code API/theme, not captured from a native VS Code host. The “Moderate” measured-stat label exceeding its card at 1440 is an inherited presentation observation, not a new reading blocker.

This review rebuilt and exercised the exact-head bundle in JSDOM, not a real browser. JSDOM reports its known stylesheet-parser limitation. DOM/event/focus assertions do not establish browser layout, screen-reader behavior or native-host acceptance. The author's no-overflow/no-page-error and pixel-stability claims were not independently rerun in Chromium here. Workshop DOM, persistence and outbound-message multisets match at loading, empty, excerpt, provider pause/recovery, widget reopen, sessions/tools, repeated key state and remount checkpoints.

Only this report is published. No functional changes, formal GitHub review/comment, merge, deployment, release, notification change or branch cleanup is performed. At the initial implementation head there was no pre-existing PR #149 report/author response; this re-review preserves the subsequently added author response below.

## Author response (2026-10-19)

All eight findings are fixed on `epic/lightbox-slice-2b-readings`, one commit each, plus a small follow-up to the F-02 reservation, the visual evidence and the slice/epic notes. Every regression runs the real code its finding names: the real `LightboxReadingHandler`, `LightboxService`, `LightboxReadingRunner` and context shelf with only the provider, the prompt files and the picker played (F-02, F-03 host side, F-05); the production codec, verifier and assembly (F-01, F-04, F-06, F-07); the real Lightbox root (F-03, F-04, F-08). The ledger statuses above are unchanged and left for independent verification. No live or billable provider call was made.

| ID | Commit(s) | What changed | Regression tests | Notes (deviations and why) |
| --- | --- | --- | --- | --- |
| F-01 | `ab75786` | The fold emits one map entry per UTF-16 code unit (both halves of a surrogate pair). Normalization units are base-plus-marks segments, widened whenever NFKC of a segment joined to the run before it differs from their separate NFKCs (Hangul jamo, compatibility jamo, halfwidth sound marks), so the units' forms concatenate to the whole string's NFKC. A match, exact or folded, counts only on unit boundaries; a folded match counts only when its source span folds back to exactly the matched form, otherwise the search continues. | `LightboxQuoteVerifier.test.ts`, "the fold's span map" (7): your witness (`😀😀😀😀 “Alice waited” today.` → `“Alice waited”`) and mathematical-script capitals before a match; supplementary characters inside one (an emoji, `𝒜lice`, em dashes); Hangul jamo ↔ syllable both ways and compatibility jamo, half a syllable refused; ligatures expanded, half a ligature refused; combining marks composed both ways, `cafe` refused against `café`; repeated dashes (`——`, `- - -`, `--`/`——` after an emoji); the per-code-unit map. Each asserts the returned text, that it stands in the paragraph, and that it folds back to the quote's (wrapped or unwrapped) form. All 7 fail on `9ad4e34`. | **Deviation:** exact matches are held to unit boundaries too, one invariant for both paths, so `cafe` no longer exactly quotes the decomposed `café`. A match inside a unit is refused, not widened: a widened span would show text that is not the quote. JavaScript has no normalization-property tables, so unit boundaries come from the pairwise test (skipped below U+0300); the fold-back check guards the span whatever the boundaries. Cost: about 2× the old fold on a deliberately non-Latin-heavy 770,000-character probe (0.59 s against 0.30 s to build); Latin prose mostly takes the fast path. |
| F-02 | `b174d16`, `83daf86` | The estimate carries a host-computed `key` naming every input it priced (`LightboxPressSnapshot`: board id and content hash, lenses on, the context shelf's new `revision()`, model, window, prices), and `LIGHTBOX_RUN` must name it (`estimateKey`). A stale key is refused at once. Before its first await the press reserves its board under a minted token (`LightboxReadingRunner.reserve`); `cancel` and `dispose` release a reservation, and the handler's `dispose` stops its own. After the prompt files load it starts (`startReserved`) only if the tab is open, the reservation holds and a fresh snapshot has the same key; otherwise nothing is sent and the refusal carries `reestimate: true`. The fit check prices with the press's own facts. A disposed handler posts nothing. `83daf86` keeps the reserved run's identity and refuses calls it did not reserve. | New `LightboxRunOwnership.test.ts` (10, prompt files held): close before start (no provider call, no post after close, board released, the next tab reads it); close and reopen (the reopened tab's press runs as `run-2`, the closed tab's never starts and posts nothing); the board held during preparation (no Stop yet, a second press refused, the run starts once the prompts load); six inputs changed during preparation (context removed, context added, every lens off, model switched, price changed, another board adopted), each refused with nothing sent; a press priced on another model refused before any prompt read, then the fresh estimate's press runs. `LightboxReadingRunner.test.ts` (5): reserve and start; stopped and disposed before start; release; calls not reserved. `LightboxAppReadings.test.tsx`: the press posts its `estimateKey`; a `reestimate` refusal asks again. Kept: "stops the runs it started when its tab closes" (close after start) and the guard against an obsolete request after another board is adopted (now the "another board adopted" case). | **Snapshot:** a press owns exactly what its estimate priced; it is frozen at the press and verified before the engine starts, never re-priced silently, so a model change can never inherit another model's price. The suite uses the new press contract, so it cannot run unchanged on `9ad4e34`; the same synthetic harness on an export of `9ad4e34` gives: close before start, 3 provider calls and 6 posts after close; model switched during preparation, 3 calls on the new model; context removed during preparation, 3 calls carrying the removed text. Stop is not offered during preparation (the token reaches the webview at start; preparation is local prompt reads); closing the tab is the release that matters. A prompt-load failure now refuses and releases instead of rejecting unhandled. The last host decision point is checked; model resolution inside the engine after dispatch is the engine's own, unchanged for every tool. |
| F-03 | `1ddecb1` | Every `LIGHTBOX_SET_LENSES` carries a webview-minted `requestId`, echoed by `LIGHTBOX_RUN_ESTIMATE`. The webview withdraws its usable estimate when it asks ("Estimating the cost…"; Lenses card "Estimating…"), accepts only the reply to its latest request for the board it asked about, exposes only the on-screen board's estimate, and asks again when the context list changes. The host drops an answer overtaken by a newer request while its prompt files loaded and no longer posts an estimate unasked (after a run, a stop or a context change). Runs and progress are kept per board and token (`lightboxRuns.ts`); a current estimate reply is the host's word on its board's run; Stop is built from the board's own run; the run line takes Stop and groups from that run and treats another board's estimate as none. | `LightboxAppEstimates.test.tsx` (6, real root, all fail with the pre-fix webview modules): A → B withdraws A's price, and B's too-large reply holds against a late A reply; same-board replies out of order (the latest request wins, and the press names its key); a model change withdraws the price until the new model's reply; A finishing leaves B's run, progress and Stop (`{ boardId: 'B', token: 'run-B' }`); a late A estimate carrying run A, then A streaming, never becomes B's Stop; late progress after Stop and from a replaced run ignored. `lightboxRuns.test.ts` (7). Host, `LightboxEstimateCorrelation.test.ts` (3): the id echoed; an all-lenses answer overtaken by an all-off request while its prompts loaded is never posted; no estimate after a finish, a stop, or a context add or removal. `lightboxRunLine.test.ts` (+2). | Every estimate is now initiated by the webview, so it can correlate all of them. Without a named run (the instant between a run's board message and its `started`, or a reload before the estimate reply) the run line offers no Stop and counts the groups visibly running. If the prompt files cannot be read, the estimate stays "Estimating…" with the logged reason rather than showing a stale price. F-02's pending-start ownership is fixed separately on the host, as you noted. |
| F-04 | `8926e8a` | With no headline tile, `LightboxHeadline` keeps the plain heading and draws the headline lens's own state under it: the claim withheld by title with its reason and its quotes' reasons, the block withheld with its reason, or the failure or stop of its call. The reading frame's withheld lists became `LightboxWithheldBlocks` and `LightboxWithheldClaims`, shared by both. | `LightboxHeadlineWithheld.test.tsx` (4; worked example → production codec, verifier and assembly → real root): no verified headline quote (plain heading; "Withheld · <title>", its reason, "¶3: Not found in the chapter…"; the rejected sentence is never a heading; the motifs still land); no friction ("Headline withheld" and the codec's reason); a failed group A (the call's failure under the heading); nothing read yet (the heading alone). 3 of 4 fail on `9ad4e34`. | The failure line is not an alert: the motif frame already announces the same group's failure. No "reading…" state was added to the heading; it was not asked. |
| F-05 | `7055451` (the rejection mapping moved beside the call failures in `b174d16`, keeping the runner under 500 lines) | `LightboxCallFailure` reduces a failed call to a closed category (the engine's `AgentRunUnavailableError` reasons, `provider-rejected`, `unexpected`) with a fixed writer-facing sentence; Output gets the category plus at most a numeric HTTP status or a built-in error class name. Provider text is never read. The codec counts fields the format does not define, at the root and in every block and item (`strictObject`), and never names them. A frame error may carry a `diagnostic` (the undefined root names, bounded to 10 names of 120 characters), which the runner hands only to the recovery store. | Codec (2): prose in a root key ("has 3 fields the format does not define"; the names only in `diagnostic`); prose in a block key and an item key, counted. Runner (5): an unclassified rejection (HTTP 400), an unavailable provider with details, a plain `Error`, a thrown string, each multiline with 700 characters echoing the request: Output shows `provider-rejected (HTTP 400)`, `provider-unavailable`, `unexpected (Error)`, `unexpected`, the board a fixed sentence, and neither contains the private text; a reply with prose in a root key: the logged and board reasons count the field, the board error names the recovery file, and the recovery capture receives the body and the names. 6 runner tests fail on `9ad4e34`; the codec suite does not compile against the old wire. | Block and item reasons go beyond the two paths named: they carried the same interpolation through `exactKeys`. A failed call keeps no provider text anywhere: there is no body to recover, and the recovery store is a body quarantine, so keeping provider detail would mean a new diagnostic store with its own privacy contract, which is beyond this fix. The engine's own logging is unchanged, as you scoped. |
| F-06 | `f141293` | At or below 0.40 (the drawn two-decimal affinity, the figure the block rule and the tile read) a blank `nearMiss` withholds the neighbor by its title. Above 0.40 the converse is explicit and lenient: `nearMiss` must still be a bounded string, but is not a withholding rule, and the host keeps none. | Codec (2): blank near misses at 0.40 and 0.38 withhold both, and with them the neighborhood ("drew no near miss"); one blank withheld while another at 0.399 (drawn 0.40) with its line keeps the block; a closer neighbor's near-miss text is dropped, not withheld. Both fail on `9ad4e34`. | Not strict above 0.40: withholding a close neighbor for an extra remark would discard a paid reading for a cosmetic deviation, while the tile only ever draws a low-affinity neighbor's near miss. |
| F-07 | `0876217` | Assembly counts quotes checked and withheld per lens as the checks run; a group carries them as `quoteChecks` (one entry per decoded block, merged per lens on a re-read like `frictions`, kept by a failed re-read, cleared by a full run); `lightboxQuoteTally` sums them. | Your fixture through the production codec and assembly (one headline quote, a motif with two found quotes in one paragraph): `quoteChecks` headline 1/0 and motif 2/0, the tally 3 checked, the motif still withheld. `LightboxReadingState.test.ts`: a re-read replaces only its lens's checks. | Per-lens counts rather than relabeling the figure: the run line keeps meaning "every check performed". The group outcome carries `quoteChecks` instead of group totals (the assembly keeps its totals for the log). The evidence fixture's tally is unchanged (25 checked, 1 withheld). |
| F-08 | `23efa98` | `lightboxRereadAvailability`: a tile's re-read needs its lens on and a current estimate pricing a single-lens call for it that fits; otherwise the press is disabled and the reason shown (no key, a run in flight, the lens off, estimating, no priced call, or the call's size against the model's window). | `lightboxRunLine.test.ts` (1, every reason); `LightboxAppReadings.test.tsx` (1, real root): "Going down" pinned, the motif lens off → disabled with the lens-off reason; back on with a too-large re-read estimate → disabled with the size reason. | `LightboxRereadControl.reason` is now per lens. |

**F-02/F-03 ownership design, in short.**

- **One owner per press, from the press.** The handler reads the press's snapshot synchronously (`LightboxPressSnapshot`), checks its key against the one the press names, and reserves the board in the runner before anything is awaited. The reservation is the run's identity: its token is minted then and becomes the run's token at start.
- **Starting is conditional, and nothing runs that was not priced.** After the prompt files load, the engine starts only if the tab is open, the reservation still holds, and a fresh snapshot's key equals the press's. Closing the tab releases the reservation, a closed tab posts nothing, and any change to the board, lenses, context, model, window or prices refuses the press with nothing sent and asks the webview to re-estimate.
- **The estimate is only ever an answer.** Each request carries a webview-minted id; the host echoes it and drops an answer overtaken by a newer request; the webview has no usable estimate between asking and its own answer, and accepts only that answer for the board it asked about.
- **Runs belong to their board.** The webview keeps each board's run and progress by token. A message changes only the board it names, under that board's run; a current estimate reply is the host's word on the board's run; Stop names the board's own run.

**F-05 privacy boundary.** Output and board errors carry host-owned words only: a call failure's category with at most an HTTP status or a built-in error class, and the codec's reasons, which name protocol paths, counts and positions, never a field name or value the model wrote. Model-controlled detail crosses one boundary: the rejected-response recovery store, which keeps the quarantined body and, in its metadata sidecar, the rejection with its diagnostic (the undefined root field names), in the project's gitignored `prose-minion/recovery/` folder (or extension storage), retained to the newest 20. The body is shown to the writer locally (opened beside the editor, with a notice to reveal it); the sidecar is not opened. The store's own log lines name the tool, the provider response id, the file path and any file-system error, never the body or the rejection. A failed call has no body, so none of its provider text is kept.

**Verification** (review head `9ad4e34` → fix head):

| Check | Before | After |
| --- | --- | --- |
| Full `npx jest` | 344 suites / 5,058 tests / 2 snapshots | 349 suites / 5,115 tests / 2 snapshots (+5 suites, +57 tests) |
| `npm run typecheck` | Passes | Passes |
| `npm run lint` | 0 errors / 1,135 warnings (889 naming-convention, 237 curly, 9 eqeqeq) | 0 errors / 1,135 warnings, identical per file, rule and message |
| `npm run build` (with `verify:bundle`) | Passes | Passes; three webpack size warnings; bundle sentinels present |
| `git diff --check 9ad4e34` | — | Passes |

Production `webview.js` SHA-256 at the fix head: `1894febb83bca93f49cc95baaa18c00759c0af28fc7157e18ce28bb0bc61f85b`. Required CI on the pushed head is not yet observed.

**Visual evidence** (`09a0de5`, [README](evidence/lightbox-slice-2b-visual/README.md#pr-149-review-fixes-2026-10-19)). The state builder now speaks the fixed protocol, and the harness answers the tab's own estimate requests from recorded host answers instead of replaying them. States were rebuilt by the fixed host from freshly cut public-domain fixtures and match the earlier ones apart from the protocol fields. New at 1440, 1000 and 500 px: `headline-withheld` (F-04) and `reread-off` (F-08). The 14 earlier shots re-render pixel-identical or within anti-aliasing (at most 19 px by 1/255), so they stand. No page errors and no horizontal overflow. Headless Chromium with a stub VS Code API, not a native host.

**Unchanged on purpose.** D4 stale readings and the live-provider and caching pass stay deferred as recorded; the Slice 2B scope is otherwise unchanged.
