# PR Review — Lightbox Slice 2B: First Readings

**Author:** okeylanders · **PR:** [#149](https://github.com/okeylanders/prose-minion-vscode/pull/149) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-2b-readings` → `epic/lightbox`
**Verified base / merge-base:** `3e6eba3c5c0e76afb72280691b7b6a0a5b9e7d7b`
**Reviewed third correction head:** `56cb4316484162ecf61afa83859a9e3cfbd3470d`
**Second correction head / report:** `50b5b858720a6e1a0b6a1e1a6565468fffb8aa95` / `b1200f06b0e9d2e48bcab3758c833b2e1df84c11`
**First correction head / report:** `bf8f1ca2502441133216ca5013480da9aa37f9cf` / `b5350a1440c182a891bb1f149a8decfb50ba7862`
**Initial implementation head:** `305ce1e2b9924d817c66c39514f2511118082c44` · **Initial report commit:** `9ad4e34f32fcea8037b240fe555df9944b47925f`
**Current scope against base:** 132 files · +12,706 / −261 · 41 commits (including prior review reports)
**Third correction delta since `b1200f0`:** 15 files · +741 / −127 · 5 commits
**Second correction delta since `b5350a1`:** 18 files · +758 / −83 · 5 commits
**First correction delta since initial report:** 57 files · +2,771 / −457 · 12 commits
**Reviewed and independently re-reviewed:** 2026-10-19 · **Reviewer:** Astra
**Mode:** independent source/spec review; real-service, runner and engine probes with synthetic streaming transport; codec/evidence probes; real-root and production-bundle DOM witnesses; supplied-image inspection; Workshop lifecycle parity; full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **Partially addressed** = reproduced residual remains · **N/A** = no action. Author-proposed deferrals are discussed below; this review does not record acceptance on the writer's behalf.

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Normalized quote matching can return the wrong source span after supplementary Unicode characters | **Addressed** |
| F-02 | Medium / P2 | Closing the tab during prompt preparation does not prevent its paid run from starting afterward | **Addressed** |
| F-03 | Medium / P2 | Board/run correlation and selected-model/settings-write ownership failures | **Addressed** |
| F-04 | Medium / P2 | Withheld headline claims and blocks disappear behind the ordinary fallback heading | **Addressed** |
| F-05 | Medium / P2 | Model-controlled keys and raw provider errors enter Lightbox logs and failed-group diagnostics | **Addressed** |
| F-06 | Low / P3 · nonblocking | A low-affinity genre neighbor can omit its required near-miss explanation | **Addressed** |
| F-07 | Low / P3 · nonblocking | “Quotes checked” omits successfully verified quotes on a withheld motif | **Addressed** |
| F-08 | Low / P3 · nonblocking | Inspector re-read remains enabled for an off lens or a too-large call | **Addressed** |
| F-09 | Low / P3 · nonblocking | Rare compatibility-mark sequences miss whole-string NFKC-equivalent quotes | **Addressed** |
| F-10 | Medium / P2 | Unbounded normalization-unit spread throws on accepted long non-Latin paragraphs and strands the active reading | **Addressed** |

**Verdict: Conditional approval for integration.** F-01 through F-10 are independently addressed within their recorded scope. The accepted long Japanese/CJK reproductions now complete, and setup or reply-check exceptions terminate safely instead of stranding the run. Unicode source-span and selected-model protections remain green. Two bounded, nonblocking exceptional-path accounting observations are recorded below; neither demonstrates unconsented spending or incorrect engine-wide cost tracking. Required CI must still pass on the exact report-only head before this becomes a ready signal.

This is a review for integration into `epic/lightbox`, not merge authorization, native VS Code acceptance or live-provider acceptance. Approval remains conditional on required CI passing on the exact report-only head. All three author responses are preserved verbatim below; their fixed assessments do not supersede the independent ledger.

**Inherited PR #148 F-05 is independently addressed here.** It is distinct from this report's new F-05. Both an exact repeated jump to ¶812 and sparse ¶100 → ¶101 refocus the landing chip. Passive board updates do not steal focus. Real-root and rebuilt-bundle witnesses pass, as do the existing bounded 5,000-address navigation and pin-ownership cases.




## Third re-review of `56cb4316` — 2026-10-19

All five commits after report `b1200f0` were inspected: the two F-10 corrections, the reply-processing extraction and its boundaries/tests, inherited tokenizer debt, slice/epic notes and the third author response. The base remains `3e6eba3`. No screenshots, visual harness or webview source changed in this round; the rebuilt production webview is byte-identical to the previously reviewed bundle.

### F-10 addressed — Bounded appends and settled run failures

Both flush paths in [`LightboxQuoteVerifier.ts:183–198`](https://github.com/okeylanders/prose-minion-vscode/blob/56cb4316484162ecf61afa83859a9e3cfbd3470d/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L183-L198) append units individually, removing the function-argument limit without altering the normalization-unit or fold-back checks. The runner begins execution on the next microtask, catches verifier/counter setup failures, settles every planned group with a host-owned failure, isolates exceptions while checking a reply, and releases/finishes the current run. Group/finish listener exceptions are contained; the production progress-listener path also reaches a terminal outcome in the independent throw witness.

The original failing **162,014-character Japanese source**, `'Alice waited. ' + '彼女は静かな部屋で時計の音を聞いた。'.repeat(9000)`, was rerun through the actual board measurements, service, handler, prompts, runner and engine with only synthetic provider transport. It remains accepted as one paragraph/three words and its headline-only estimate remains **fits / 124,820 input tokens** against the synthetic 200,000-token model. It now makes **one mocked call**, settles the headline group `ok`, posts `finished`, releases its token and emits no unhandled rejection.

Additional independent real-host witnesses cover all three lenses:

| Accepted source | Input-token estimates A / B / C | Result |
| --- | --- | --- |
| Same Japanese paragraph, 162,014 characters / 3 words | 125,403 / 125,130 / 124,736 | 3 calls; all groups `ok`; finished and released |
| `'漢'.repeat(150000) + ' Alice waited.'`, 150,014 characters / 3 words | 116,403 / 116,130 / 115,736 | ASCII flush succeeds; 3 calls; all groups `ok`; finished and released |
| `'漢'.repeat(150000)`, 150,000 characters / 1 word | 116,400 / 116,127 / 115,733 | End flush succeeds; 3 calls; all groups `ok`; finished and released |

Seven verifier variants cover end flush, ASCII flush, two long runs, supplementary-character source mapping, Hangul composition, compatibility expansion and unspaced Latin. The six non-Latin cases throw with the prior `b1200f0` verifier and pass now; the Latin control passes both. The largest of these probes is 450,014 characters. This establishes the demonstrated regression's repair, not an unlimited input-size or native-runtime performance guarantee.

Failure handling was exercised separately from successful long inputs:

- Injected verifier-factory and term-counter-factory exceptions each produce **zero provider calls**, three bounded failed outcomes, `finished`, no active token and no unhandled rejection. Error text/private markers reach neither ordinary logs nor the board. Restoring the factory and explicitly pressing again completes three calls.
- An ordinary provider failure settles only its group while siblings finish. An injected post-reply checker exception similarly preserves successful siblings; the real bundle presents **Read the rest**, which retries only the failed group. Nothing is automatically retried.
- Throwing group, finish and progress listeners do not strand the run in the exercised real-engine cases. Execution callbacks start after the caller receives its run; immediate cancellation before the execution microtask makes **zero calls and zero callbacks**.
- Actual-host-to-production-bundle witnesses show that setup failure removes Stop and permits a successful explicit retry, while a 150,014-character CJK run reaches terminal Re-read without Stop or an unhandled rejection.

The new `LightboxGroupReply` extraction was independently compared with the prior implementation across **14 real-engine cases**, including partial withholding, host-counted support, unknown fields, invalid/duplicate framing, output truncation, absent recovery receipt and worked examples. Outcomes, logs, recovery captures, presentation and usage match on these ordinary paths. Unexpected decoder diagnostics remain quarantined, and twelve additional host-failure privacy cases pass. **F-10 is addressed.**

### Nonblocking exceptional-path accounting observations

These are open, bounded follow-up notes, not F-10 reopenings. They concern the newly supported host-failure outcomes, rather than an ordinary provider reply demonstrated to break the run.

1. **Distinguish planned groups from dispatched calls after setup failure.** [`lightboxReadings.ts:116–123`](https://github.com/okeylanders/prose-minion-vscode/blob/56cb4316484162ecf61afa83859a9e3cfbd3470d/packages/core/src/presentation/webview/hooks/domain/lightbox/lightboxReadings.ts#L116-L123) counts every `failed` group as a call. Consequently, an injected setup failure displays **“3 calls” despite zero dispatch**, alongside the correct explicit explanation that nothing was sent. The tally predates this correction; the new pre-send failure path exposes the mismatch. Consider labeling this as groups/attempts or carrying dispatch status. **Low / P3, nonblocking:** no provider spend occurs and the detailed failure explanation is accurate.
2. **Retain known usage/model when post-call checking throws.** The outer catch in [`LightboxReadingRunner.ts:383–388`](https://github.com/okeylanders/prose-minion-vscode/blob/56cb4316484162ecf61afa83859a9e3cfbd3470d/packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts#L383-L388) builds a failure without the already obtained `ExecutionResult`. With a checker exception injected after group A completes, the real engine records **$0.03 / 3,600 tokens**, but the board total and handler finish log include only B/C: **$0.02 / 2,400 tokens**; A's outcome also lacks its model. Preserve available result metadata across this new catch and add a regression. **Low / P3, nonblocking:** global engine usage and the processed-chip fanout remain correct, current Lightbox UI does not show the omitted group actual-usage/model fields, and no ordinary provider-body trigger was found. Production recovery implementations already catch normal disk/open failures. This is not evidence of an unpriced or extra call.

### Third re-review checks and limits

| Check | Independently observed result at `56cb4316` |
| --- | --- |
| Full `npm test -- --runInBand` | **352 suites / 5,135 tests / 2 snapshots passed**, 128.110 seconds |
| `npm run typecheck` | Core, webview and extension passed |
| Full `npm run lint` | **0 errors / 1,135 warnings**; normalized per-file/message/rule multiset unchanged from the prior reviewed head |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; three bundle sentinels present |
| Whole-PR and correction-delta `git diff --check` | Passed |
| Retained real-engine host checks | **87 assertions passed**, including estimate/fit, ownership, cancellation, disposal and explicit model intent |
| New long-input/setup/completion probes | **91 assertions passed** (37 long/setup, 54 completion/listener/provider cases), plus the original headline-only witness and 7 verifier variants |
| Integrated selected-model/configuration scenarios | **72 assertions / 8 scenarios passed** on the exact production bundle |
| Retained source-root / production-bundle checks | **18 tests / 38 assertions passed** |
| New actual-host-to-bundle terminal/retry scenarios | **39 assertions / 3 scenarios passed** |
| Focused evidence/codec/runner/state suites | **9 suites / 130 tests passed** |
| Independent evidence boundaries / closure groups | **13 boundaries / 12 groups passed**, including the retained 10,000-case property |
| Additional Unicode probes | **20,000 retained stress cases; 5,768 expanded whole-string cases; 25,000 fragments; 4 extra span assertions** completed with no observed wrong accepted spans |
| Reply extraction / new failure diagnostics | **27 checks passed**, including 14 differential scenarios and 12 host-failure privacy cases |
| Workshop lifecycle comparison | **9 checkpoints / 27 parity assertions passed** against the reviewed PR #147 integrated bundle |
| Visual evidence | No changes; prior inspection of all 20 supplied images/provenance retained; bundle hash unchanged |
| Exact new report-head CI | **Pending separate post-publication verification** |

Production `webview.js` SHA-256 remains `7d94bad5d80c8bece790821f4bdcc61dd7dd45e0f2f47d31f4a20f75ab10c897`.

F-01's source-span honesty, F-09's mixed compatibility-mark example/property, F-03's held settings writes, identical `MODEL_DATA` and same-model repricing, and all other original closures remain sound in this rerun. Inherited PR #148 F-05's repeated ¶812, sparse ¶100→¶101/repeat and passive-update focus behavior are independently reconfirmed. The inherited engine error-type logging caveat remains reproducible and separately recorded; F-05's scoped Lightbox closure does not claim to fix engine-wide logging.

The new [long-token POS-tokenizer debt](../../.todo/tech-debt/2026-10-19-pos-tagger-long-token-backtracking.md) is a coherent record of a separate inherited measurement cost: its tokenizer implementation is unchanged by this correction. The large unspaced Latin control here exercises verifier/runner paths, not a full board build; the author's approximately two-minute full-board measurement was not independently repeated in this pass. Do not confuse that existing cost with the now-fixed accepted Japanese/CJK setup exception.

All transport/model/pricing data in these checks are synthetic or public-domain fixtures. No live or paid inference was used. Native VS Code, real-browser layout, screen-reader behavior and live cache/cost behavior remain unverified here; the bundle witnesses run in JSDOM with its known stylesheet-parser limitation. Unicode probes are empirical, not exhaustive. The earlier D4 retention and Slice 6 live/cache scope decisions remain bounded proposals and are not silently accepted on the writer's behalf. This report-only update preserves all three author responses verbatim.

## Second re-review of `50b5b858` — historical, 2026-10-19

The evidence and statuses below describe the second correction pass; the current ledger and third re-review above supersede them.

All five commits after report `b5350a1` were inspected, including the model-confirmation integration, quote-unit rewrite, new integrated tests, inherited engine-log debt and second author response. The base remains `3e6eba3`. There are no new or modified PNGs in this correction round; the evidence builder now sends the required press model.

### F-03 addressed — Selected and confirmed model ownership

The production root routes every `MODEL_DATA` to both the shared chrome and Lightbox. The hook distinguishes the selected model from the last host-confirmed selection, records the intended model on each estimate request, rejects a reply priced for another model, and exposes an estimate only for the selected/confirmed model. Every confirmation, including identical values and price-only catalog updates, requests fresh pricing. A press names its model, which the host checks before prompt preparation.

The retained counterexample was rerun against the exact rebuilt production bundle with the real configuration/Lightbox handlers, runner and engine, held settings writes and synthetic catalog/provider adapters. **72 assertions across eight integrated scenarios passed:**

- While the actual picker's new selection is still saving, Read remains disabled and sends **zero run messages / zero provider calls**. A latest-request old-model estimate cannot enable it.
- After authoritative confirmation, the usable estimate names the selected expensive model and all **three** explicit reading requests use that model. Nothing is auto-pressed or auto-retried.
- An identical `MODEL_DATA` confirmation increments the estimate request count and withdraws the old estimate. A same-model price refresh replaces **$0.068778** with **$0.081816 before any press**.
- Failed writes and a restored optimistic selection stay blocked until current confirmation; missing/mismatched `LIGHTBOX_RUN.model` is host-refused.
- Rapid and delayed confirmations preserve the new estimate/model checks. The unchanged shared picker can visibly revert to an earlier confirmed choice while a later write is pending; resulting enabled calls match that displayed choice and the current estimate. This inherited picker-ordering caveat is distinct from the fixed hidden selector/estimate mismatch. A stale confirmation naming a model different from the host's actual model leaves Read disabled until a current confirmation.

The original board/request/token/Stop protections remain green. **F-03 is addressed**, not merely relabeled based on the author's test claims.

### F-09 addressed — Whole-string NFKC equivalence, with conservative boundaries

The rare `Alice Aﾞﾟ̣ waited.` counterexample now verifies against its NFKC form and returns the original source text. Runs are split at safe low-code-point starters; if their pairwise units do not reproduce the whole run's NFKC, the run remains a single unit. Original boundary/fold-back protections remain in place. This preserves whole-run equivalence conservatively: a quote cutting into a fallback unit can still be withheld rather than risk a false span.

The previously failing 10,000-case property, both retained 10,000-case stress corpora, 5,768 expanded whole-string cases (including all 768 proposed delimiters below U+0300), and 25,000 fragment probes completed without an incorrect accepted span. Of the fragment probes, 13,980 verified and 11,020 were withheld; four extra boundary/span assertions also passed. This is substantial empirical coverage, not exhaustive Unicode proof. **F-09's demonstrated false-negative is addressed.** The new array-append regression below is a separate failure introduced by the repair.

### F-10 — Avoid argument-limit failure while assembling normalization units

**Severity:** Medium / P2; blocking. **Introduced at:** [`LightboxQuoteVerifier.ts:185–191`](https://github.com/okeylanders/prose-minion-vscode/blob/50b5b858720a6e1a0b6a1e1a6565468fffb8aa95/packages/core/src/infrastructure/lightbox/LightboxQuoteVerifier.ts#L185-L191). **Propagation:** verifier setup at [`LightboxReadingRunner.ts:329`](https://github.com/okeylanders/prose-minion-vscode/blob/50b5b858720a6e1a0b6a1e1a6565468fffb8aa95/packages/core/src/infrastructure/lightbox/LightboxReadingRunner.ts#L321-L352), with the handler publishing running state at [`LightboxReadingHandler.ts:266–269`](https://github.com/okeylanders/prose-minion-vscode/blob/50b5b858720a6e1a0b6a1e1a6565468fffb8aa95/packages/core/src/application/handlers/domain/LightboxReadingHandler.ts#L260-L269).

Both `units.push(...runUnits(run))` sites turn an unbounded normalization run into function arguments. A long run without a below-U+0300 starter can exceed the runtime's argument/stack limit, even when the source is accepted and the request fits the selected model. This is not a deliberately unsupported input rejected by the product's limits.

**Independent real-host reproduction**, using actual measurement/service/handler/runner/engine code and synthetic transport:

- Source: `'Alice waited. ' + '彼女は静かな部屋で時計の音を聞いた。'.repeat(9000)`.
- Production board accepts **162,014 characters, three whitespace-counted words, one paragraph**.
- With only the headline lens on, the real estimator reports **fits**, **124,820 input tokens**, against the synthetic model's **200,000-token window**, with the ordinary output reservation.
- Press Read with the current estimate key and matching model. Verifier setup throws **`RangeError: Maximum call stack size exceeded`** before transport. The returned `done` promise rejects without a handler; runner cleanup/finish is never reached. The board retains **group A running**, the active run token remains, and the only progress phase is **started**. **Zero provider calls** occur.
- **Stop** releases the active run and marks the group cancelled. It is a stranded run requiring intervention, not evidence that the extension process itself crashed.

A separate all-lenses witness with `'漢'.repeat(150000)` is also accepted (one word/one paragraph), fits the same window at roughly 116,000 input tokens per group, and leaves all three groups running with zero calls. In this Node 24.19 runtime, the threshold varied with call depth/warm-up around 125,000–150,000 units; **150,000 reliably reproduced**. Both end-of-paragraph and later ASCII-flush paths fail. A same-length unspaced Latin paragraph succeeds because its runs are split. No universal native-host threshold is claimed.

**Baseline isolation:** the `b5350a1` verifier folds the identical Japanese source successfully and finds exact `Alice waited.`. Replacing only the verifier export with that prior implementation inside a scratch process leaves the current host stack otherwise unchanged: one headline provider-adapter call settles `ok`, emits `finished` and releases the active token. No tracked source was changed. This isolates the new failure to the correction's unbounded spread, rather than inherited word counting or a paid-provider response.

**Requested correction:** append normalization units without spreading an unbounded array into call arguments. Ensure verifier/setup failure cannot leave a registered run and its groups permanently running or produce an unobserved rejection. Add accepted long non-Latin paragraph tests through the real host/runner, including end and ASCII-flush boundaries, ordinary Latin control, and final run cleanup. Keep all quote-equivalence/span guards and model-intent protections intact.

### Second re-review checks and limits

| Check | Independently observed result at `50b5b858` |
| --- | --- |
| Full `npm test -- --runInBand` | **350 suites / 5,123 tests / 2 snapshots passed**, 145.892 seconds |
| `npm run typecheck` | Core, webview and extension passed |
| Full `npm run lint` | **0 errors / 1,135 warnings**; normalized per-file/message/rule multiset unchanged |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; three bundle sentinels present |
| Whole-PR and correction-delta `git diff --check` | Passed |
| Independent real-engine host checks | **87 assertions passed**: prior 73 lifecycle/estimate/fit/ownership checks plus 14 explicit model-intent checks |
| Integrated selected-model/configuration scenarios | **72 assertions / 8 scenarios passed** on the rebuilt production bundle |
| Retained source-root / production-bundle checks | **18 tests / 38 assertions passed**, including F-04, F-08, board/Stop races and inherited PR #148 focus |
| Focused evidence/codec/runner/state suites | **7 suites / 118 tests passed** |
| Independent evidence boundaries / closure groups | **13 boundaries / 12 groups passed**, including the former failing 10,000-case property |
| Additional normalization probes | **20,000 retained stress cases; 5,768 expanded whole-string cases; 25,000 fragments; 4 extra span assertions** completed with no observed wrong accepted spans |
| New accepted-input regression probes | **F-10 reproduced**; prior-verifier isolation completes the same run normally; not a passing expected-safe regression |
| Workshop lifecycle comparison | **9 checkpoints / 27 parity assertions passed** against the reviewed PR #147 integrated bundle |
| Visual evidence | No PNG changes; all 20 images were inspected in earlier passes; builder/provenance delta inspected |
| Exact new report-head CI | **Pending separate post-publication verification** |

Production `webview.js` SHA-256: `7d94bad5d80c8bece790821f4bdcc61dd7dd45e0f2f47d31f4a20f75ab10c897`.

Single-run scratch measurements on 770,000-character controls were approximately 311→334 ms for Latin and 332→471 ms for spaced non-Latin text (prior→current verifier). They are observations, not a performance guarantee. The large uninterrupted-run failure is separately reproducible and not explained away by those successful spaced controls.

All F-01/F-02/F-04–F-08 closures remain sound in the rerun. PR #148's repeated ¶812, sparse ¶100→¶101/repeat, and passive-update focus behavior are reconfirmed in the exact bundle. The inherited engine `errorType` log remains unchanged and reproducible, now accurately tracked in [dedicated debt](../../.todo/tech-debt/2026-10-19-agent-run-engine-provider-error-log.md); scoped F-05 stays closed. A failed model save waits for a later current confirmation, which reopening the picker supplies.

The author reports byte-identical recorded states and pixel-identical re-renders; no native browser/VS Code rerun was performed here. JSDOM retains its known stylesheet-parser limitation. No live/paid inference was used. D4 retention and the Slice 6 live/cache/cost gates retain the previously stated scope and acceptance limits. Only this report is published, preserving both author responses byte-for-byte.

## First re-review of `bf8f1ca` — historical, 2026-10-19

The evidence and statuses below describe the first correction pass; the current ledger and third re-review above supersede them.

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

## Author response to re-review (2026-10-19)

Both open findings are fixed on `epic/lightbox-slice-2b-readings`, one commit each, and the engine-log limitation is recorded as tech debt without changing the engine. The ledger statuses above are unchanged and left for independent verification. No live or billable provider call was made; the fixtures are the public-domain Alice chapter and the prompt bundle's worked examples.

| ID | Commit | Root cause | What changed | Regression tests |
| --- | --- | --- | --- | --- |
| F-03 residual | `1d38c2b` | Correlation by latest request id and board never bound the model. The shared picker shows a new selection at once, while `ConfigurationHandler` saves it, waits 50 ms and only then confirms it with `MODEL_DATA`; the Lightbox asked for an estimate on the optimistic change, the host priced the model it still had, and that answer was accepted. The root re-estimated only when the model id or window changed, so the confirmation of the same id, and a price-only catalog refresh, asked for nothing. | `useLightbox({ assistantModel })` takes the picker's selected assistant model and handles every `MODEL_DATA` (`handleModelData`), recording the confirmed assistant model. An estimate is usable only when it priced the selected model and that selection is the one the host last confirmed; until then Read shows "Estimating the cost…" and a press sends nothing. Each request records the model it was asked for, and a reply that priced another model is refused even when its request id is the latest. Every `MODEL_DATA` is an authoritative confirmation and asks for a fresh estimate, the same values included, so a saved selection, a price-only refresh and any other confirmation the host sends all re-price. `LightboxApp` routes `MODEL_DATA` to both the chrome and the Lightbox; the model-key effect is gone. `LIGHTBOX_RUN` now names the model the press priced (`LightboxRunPayload.model`), and the host refuses a press naming any model but the one in use, with `reestimate`. Nothing is pressed or retried automatically, and nothing depends on how fast the settings write is. | New `LightboxModelSelection.test.tsx` (3), one real root wired to the real `ConfigurationHandler` (its settings write held open), `LightboxHandler`, `LightboxReadingHandler`, `LightboxService`, runner and `OpenRouterModels` pricing (catalog served by a stubbed `fetch`), with the write's model hot-swap as the config watcher applies it and messages crossing asynchronously both ways; only the provider is played, recording the model each call runs on. (1) The actual picker changes `provider/cheap` → "Expensive new model" with the write held: the selector shows the new model, Read is disabled, a press sends no `LIGHTBOX_RUN` and makes no provider call; after the write lands and `MODEL_DATA` confirms it, the estimate prices `provider/expensive` and a press runs three calls on it, naming it, with no refusal. (2) A lens toggle while the write is held is answered for the latest request id with a `provider/cheap` estimate: it is refused and Read stays disabled; after confirmation the `provider/expensive` estimate is usable. (3) Same-model price-only refresh: opening the picker refetches the catalog and confirms the unchanged selection; the old price is withdrawn ("Estimating…") until the new one arrives, which differs, and a press then runs on `provider/cheap`. `LightboxAppEstimates.test.tsx` (+1): every confirmation, an identical one included, asks again and waits for that answer. `LightboxRunOwnership.test.ts` (+1): a press naming a model other than the one in use is refused with `reestimate` and no provider call. All 5 fail with `bf8f1ca`'s `useLightbox`, `LightboxApp` and `LightboxReadingHandler` in place. Board and token protections are unchanged, and their suites pass as before. |
| F-09 | `21aa86a` | The unit builder merged segments pairwise and committed a unit as soon as the next pair normalized the same apart as together. In `Alice Aﾞﾟ̣ waited.`, NFKC composes the `A` with the dot below past two halfwidth sound marks; every adjacent pair is stable on its own, so the units' forms no longer concatenated to the whole string's NFKC and the NFKC quote was `not-in-chapter`. | The text is first cut into runs before every code point below U+0300. Those are starters that combine with nothing before them and decompose to a starter, so NFKC never reaches back across the cut, and the runs' forms concatenate to the whole text's exactly. Within a run, segments still merge pairwise; a run whose units do not concatenate to its own NFKC is kept as one unit. A quote can then match all of such a run but never part of it: a conservative miss, never a wrong span. Boundary checks and the fold-back check are unchanged. | `LightboxQuoteVerifier.test.ts`, "whole-string NFKC equivalence across several segments" (3): the review's case, the whole paragraph quoted as its NFKC form, found with the original source text; a quote spanning the composed unit (`Ạ゙゚ waited`) maps back to `Aﾞﾟ̣ waited`, while one starting inside it (`゙゚ waited.`) is not found; a weighted property over 3,000 seeded strings of Latin, combining marks, halfwidth kana and sound marks, Hangul jamo and syllables, ligatures, Indic vowel signs, dashes, emoji and mathematical capitals: each string folds exactly as its NFKC form folds, and that form is found with the original as its text. All 3 fail on `bf8f1ca`; the 7 Unicode span tests from F-01 stay green. Cost: 0.78 s against 0.59 s to build the fold of the same deliberately non-Latin-heavy 770,000-character probe; Latin prose, cut into one-segment runs, takes the direct path. |

**Recorded, not changed (privacy scope).** `2c69602` adds [the engine's verbatim provider error-type log](../../.todo/tech-debt/2026-10-19-agent-run-engine-provider-error-log.md) to the tech-debt index: `AgentRunEngine.ts:867–870` interpolates the provider's `metadata.error_type` after an interrupted visible stream. The note proposes logging the engine's own closed vocabulary instead and gives completion criteria. The engine is unchanged here, as F-05 scoped.

**Notes.**

- A save that fails sends an error and no `MODEL_DATA`, so Read keeps waiting until the next confirmation, which opening the picker sends. It never prices or runs the model the picker shows but the host does not use.
- The integrated suite waits up to 10 seconds for a host round trip; under eight parallel copies on four cores each mount took up to 8 seconds, and all 24 runs passed.
- The evidence builder's press names its model as the tab's now does. Its states rebuild byte-identical and all twenty shots re-render pixel-identical, so no evidence changed. Slice and epic notes: `437c7e9`.
- For the next slice: `LightboxRunPayload.model` is required, `useLightbox` takes `{ assistantModel }` and exposes `handleModelData`, the root routes `MODEL_DATA` to both the chrome and the Lightbox, and an estimate is usable only for the selected, confirmed model.

**Verification** (re-review head `b5350a1` → fix head):

| Check | Before | After |
| --- | --- | --- |
| Full `npx jest` | 349 suites / 5,115 tests / 2 snapshots | 350 suites / 5,123 tests / 2 snapshots (+1 suite, +8 tests) |
| `npm run typecheck` | Passes | Passes |
| `npm run lint` | 0 errors / 1,135 warnings | 0 errors / 1,135 warnings, identical per file, rule and message |
| `npm run build` (with `verify:bundle`) | Passes | Passes; three webpack size warnings; bundle sentinels present |
| `git diff --check b5350a1` | — | Passes |

Production `webview.js` SHA-256 at the fix head: `7d94bad5d80c8bece790821f4bdcc61dd7dd45e0f2f47d31f4a20f75ab10c897`. Required CI on the pushed head is not yet observed.

## Author response to second re-review (2026-10-19)

F-10 is fixed on `epic/lightbox-slice-2b-readings` in two commits: the unit builder, then the runner's guarantee that every started run finishes. A tokenizer cost found while testing it is recorded as tech debt and left unchanged. The ledger statuses above are unchanged and left for independent verification. No live or billable provider call was made; the long paragraphs are synthetic, and the replies are the prompt bundle's worked examples from the public-domain Alice chapter.

| ID | Commit(s) | Root cause | What changed | Regression tests |
| --- | --- | --- | --- | --- |
| F-10 | `462c976` (units), `96d1f48` (runs finish) | Two faults in sequence. **The spread:** the F-09 builder appended each run's units with `units.push(...runUnits(run))`. CJK text has no code point below U+0300, so a paragraph of it is one run, and the board accepts a long one as a few counted words that the estimate says fit. Spread into call arguments, such a run passed the engine's limit (in this Node 22 between 125,000 and 130,000 arguments) and building the verifier threw `RangeError`. **The stranded run:** the runner built the verifier and term counter inside `execute()` with nothing around them, after the handler had already published the run as started. The throw rejected `done`, which nothing observed; the run kept its board and token, and every group showed running until Stop. | **Units** (`462c976`): appended one by one at both flushes, before a code point below U+0300 and at the end of the paragraph. The other call spreads in the Lightbox are over host-bounded lists only: the ribbon's `Math.max` (at most 96 columns), the top words' `Math.min`/`Math.max` (24) and the tension column lines (96); array-literal spreads are not argument-limited. **Runs finish** (`96d1f48`): `done` never rejects. A setup over the chapter that throws fails every group with nothing sent, in the new host category `setup-failed` ("The chapter could not be prepared for checking quotes, so nothing was sent."). A group that throws while its reply is checked fails alone (`check-failed`), and the others carry on. A listener that throws is logged by its class. Either way the run is released and finished. Both categories go through `describeLightboxHostFailure`, whose log names at most a built-in error class and never the error's text (F-05). The run begins on the next microtask, so the listener hears nothing before `startReserved` returns the run to its caller. The part of the runner that turns a reply into an outcome (output-ceiling and frame checks, quarantine, assembly) moved to `LightboxGroupReply` with its behavior unchanged, which keeps the runner at 458 lines. `failedLightboxGroup` joined the run contracts. | 12 new tests. `LightboxQuoteVerifier.test.ts`, "long normalization runs" (3): the verifier builds over `'Alice waited. '` plus the Japanese sentence repeated 9,000 times (the end-of-paragraph flush) and over `'漢'.repeat(150000)` followed by `' Alice waited.'` (the later ASCII flush), and finds exact quotes in and around each run; unspaced Latin of the first paragraph's length is the control. New `LightboxLongParagraph.test.ts` (3), on the real handler, service, measurements, runner, verifier and term counter: both accepted paragraphs (one paragraph each, estimate `fits`) are read through, with three calls, `finished` posted, every group `ok`, the run released and no unhandled rejection; and an injected setup failure gives three failed groups with the host's sentence, `finished`, a released run (the next press reads) and no unhandled rejection or private text in the log. New `LightboxRunCompletion.test.ts` (6), on the real runner: the two long paragraphs and the Latin control read through, `done` resolving; an injected setup failure; a reply check that throws, failing one group only; a listener that throws. The 10 tests other than the two Latin controls fail with `50b5b85`'s verifier, runner, contracts and failure module in place; the controls pass on both, as controls should. The F-09 property test, the 7 span tests and the F-03 model-intent suites stay green. |

**Notes.**

- The unspaced Latin control runs through the verifier and the runner, not through a board. Building a board over 162,014 unspaced Latin characters takes about two minutes in word frequency: the part-of-speech tokenizer's e-mail pattern backtracks across a run of word characters (about 7 seconds at 40,000 characters). That cost is inherited, and is recorded in [tech debt](../../.todo/tech-debt/2026-10-19-pos-tagger-long-token-backtracking.md) (`f2fcd68`). At the verifier the control takes about 125 ms.
- For the next slice there are no message contract changes. `LightboxRunStart.done` never rejects, and the listener hears nothing before `start` or `startReserved` returns. `LightboxCallFailureCategory` gains `setup-failed` and `check-failed`. `LightboxGroupReply` (`readLightboxGroupReply`, `LightboxGroupTools`) is a new module in `LIGHTBOX_MODULES`. The handler harness takes `createLightboxReadingHost({ text })`.
- Visual evidence is unchanged: `webview.js` is byte-identical to the reviewed bundle, and the recorded states rebuild byte-identical. Slice and epic notes: `6600dc9`.

**Verification** (second re-review head `b1200f0` → fix head):

| Check | Before | After |
| --- | --- | --- |
| Full `npx jest` | 350 suites / 5,123 tests / 2 snapshots | 352 suites / 5,135 tests / 2 snapshots (+2 suites, +12 tests) |
| `npm run typecheck` | Passes | Passes |
| `npm run lint` | 0 errors / 1,135 warnings | 0 errors / 1,135 warnings, identical per file, rule and message |
| `npm run build` (with `verify:bundle`) | Passes | Passes; three webpack size warnings; bundle sentinels present |
| `git diff --check b1200f0` | — | Passes |

Production `webview.js` SHA-256 at the fix head: `7d94bad5d80c8bece790821f4bdcc61dd7dd45e0f2f47d31f4a20f75ab10c897`, unchanged. Required CI on the pushed head is not yet observed.
