# PR Review — Lightbox Slice 2B: First Readings

**Author:** okeylanders · **PR:** [#149](https://github.com/okeylanders/prose-minion-vscode/pull/149) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-2b-readings` → `epic/lightbox`
**Verified base / merge-base:** `3e6eba3c5c0e76afb72280691b7b6a0a5b9e7d7b`
**Reviewed implementation head:** `305ce1e2b9924d817c66c39514f2511118082c44`
**Scope:** 109 files · +8,757 / −251 · 16 commits
**Reviewed:** 2026-10-19 · **Reviewer:** Astra
**Mode:** independent source/spec review; real-service, runner and engine probes with synthetic streaming transport; codec/evidence probes; real-root and production-bundle DOM witnesses; supplied-image inspection; Workshop lifecycle parity; full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. Author-proposed deferrals are discussed below; this review does not record acceptance on the writer's behalf.

| ID | Sev | Finding | Status |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Normalized quote matching can return the wrong source span after supplementary Unicode characters | **Open** |
| F-02 | Medium / P2 | Closing the tab during prompt preparation does not prevent its paid run from starting afterward | **Open** |
| F-03 | Medium / P2 | Uncorrelated estimates and progress show another request's price and break the current run's Stop control | **Open** |
| F-04 | Medium / P2 | Withheld headline claims and blocks disappear behind the ordinary fallback heading | **Open** |
| F-05 | Medium / P2 | Model-controlled keys and raw provider errors enter Lightbox logs and failed-group diagnostics | **Open** |
| F-06 | Low / P3 · nonblocking | A low-affinity genre neighbor can omit its required near-miss explanation | **Open** |
| F-07 | Low / P3 · nonblocking | “Quotes checked” omits successfully verified quotes on a withheld motif | **Open** |
| F-08 | Low / P3 · nonblocking | Inspector re-read remains enabled for an off lens or a too-large call | **Open** |

**Verdict: Request changes.** The five P2 findings affect the feature's evidence, lifecycle, spending disclosure, cancellation and privacy contracts. The deterministic suite is green, but it does not cover these independently reproduced boundaries. This is a review for integration into `epic/lightbox`, not merge authorization, native VS Code acceptance or live-provider acceptance. Any later approval remains conditional on required CI passing on the exact report-only head; green CI alone does not resolve this ledger.

**Inherited PR #148 F-05 is independently addressed here.** It is distinct from this report's new F-05. Both an exact repeated jump to ¶812 and sparse ¶100 → ¶101 refocus the landing chip. Passive board updates do not steal focus. Real-root and rebuilt-bundle witnesses pass, as do the existing bounded 5,000-address navigation and pin-ownership cases.

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

## Scope decisions and retained guarantees

The new reading modules preserve the ports/adapters direction, named Lightbox routes and composition-root construction. The core has no new VS Code dependency. The closed tile/register maps, separate context shelf, per-block codec boundary, required friction, host term counting and chapter-only verifier are appropriate foundations. Readings remain ephemeral; no saving or Workshop handoff is quietly introduced.

Independent positive probes verified that:

- Exact prepared system/user messages have the same estimated input-token count as the messages sent through the real engine; each provider call reserves 8,000 output tokens. Actual engine usage fans out once per settled call, and reading conversations are discarded.
- Stop aborts pending provider signals, keeps arrived groups, rejects late outcomes and prevents queued calls in a real serial `p-limit` run.
- A new board adopted during preparation prevents the obsolete request from sending.
- Identical display paths/text at different canonical URIs retain distinct board identities. A hidden board's result lands only on that retained board; returning to its URI recovers its reading. Hash-normalized unchanged re-reading retains identity.
- Invalid items/blocks can be withheld while valid siblings survive; blank friction fails; unrequested lenses are ignored; quote-size and positive paragraph bounds hold. Wrong, undeclared and context-only quotes fail without carrying failed quote text into the board. The two-paragraph motif rule and host-only term counting/deduplication hold.

The word-frequency tokenizer's ASCII-oriented behavior remains an inherited limitation, not a new finding about this PR's source ownership. Prompt wording governs semantic “describe, never grade” behavior; strict JSON and quoted-evidence validation do not prove that a model's interpretation is sound or that prompt injection is impossible.

**D4 stale readings:** The author explicitly proposes deferring carry-over/reverification until before Slice 3's handoffs. That is a bounded staging choice on this epic branch because there is no handoff in Slice 2B, and a changed source gets empty readings rather than falsely current evidence. It still loses paid readings after a small text edit. A run for a changed/evicted board also continues but drops its result. The debt remains open; neither D4 completion nor writer acceptance is inferred here. Before Slice 3, verify moved/removed quotes, stale labeling and fresh-read replacement against the current source. F-02/F-03 are current lifecycle defects, not covered by that deferral.

**Live-provider/caching pass:** Moving the cache-read experiment and estimate-to-processed ratio to Slice 6 is transparently recorded. No cache savings are claimed; the differing group system prefixes make the lack of a shared leading cache prefix real. Typical output lengths, provider adherence, timeout/concurrency choices and cost calibration remain unmeasured. The original Slice 2B live “Done when” criterion is therefore not completed. These are explicit future acceptance gates, not evidence supplied by the stub-priced screenshots.

**Tension per column:** The exact array length, 0–9 range and host-specified bucket ranges are coherent with the 96-column ribbon bound. A one-score-per-column representation is a reasonable bounded output decision; the live pass still needs to establish how reliably models produce it.

## Verification and visual limits

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

Only this report is published. No functional changes, formal GitHub review/comment, merge, deployment, release, notification change or branch cleanup is performed. There was no pre-existing PR #149 report/author response to overwrite at this head.
