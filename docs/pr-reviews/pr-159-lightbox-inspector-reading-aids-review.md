# PR Review — Lightbox Inspector Reading Aids (Slice 4E)

**Author:** okeylanders · **PR:** [#159](https://github.com/okeylanders/prose-minion-vscode/pull/159) (open, unmerged at review)  
**Branches:** `epic/lightbox-slice-4e-inspector` → `epic/lightbox`  
**Reviewed implementation head:** `058feb5940b3a39717d0d66882d96aaf6080d769`  
**Exact base / merge-base:** `20775cf969f273bde2dc15cb5426b48516113eb3`  
**Scope:** 86 files · +7,016 / −188 · 7 implementation/documentation commits  
**Reviewed:** 2026-10-21 · **Reviewer:** Astra  
**Mode:** independent source/spec review; real measurement-service/host-handler probes; held-response hook tests; exact rebuilt production-bundle DOM checks; supplied PNG inspection; full head gates with independently verified executable-base equivalence

## Summary

**Verdict: Request changes.** The host resolves passages from the retained board's own measured source, the new instance finders agree with their respective counting rules on the exercised fixtures, and the ordinary paragraph/term/back and hapax paging flows work. The full head suite, typecheck, production build and lint-parity checks pass.

**One reproducible P2 remains:** returning to a cached pin does not abandon a different pending passage request. Its late answer can erase the current well and leave it loading indefinitely, without another request. This occurs through the new **Back to “alice”** control, not just through a synthetic hook call. A separate quadratic segmentation cost on a deliberately repetitive, single-sentence source is a nonblocking P3.

The real-chapter writer run and decisions 17–19 are recorded by the author; this review does **not** independently authenticate writer checkpoint acceptance. It does not close Slice 5's format/readiness gate, the wider epic's native VS Code/live-provider gate, or the separate minimum-host-floor work in PR #158. No implementation is changed by this report.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Returning to a cached pin leaves an abandoned request live; its late reply strands the current well | **Open** |
| N-01 | Low / P3 · nonblocking | Segment construction repeatedly scans all instances, so one long row bypasses the practical protection of the row bound | **Open** |

## F-01 — Retire a different pending request before using a cached answer

**Primary location:** [`useLightboxPassages.ts:84–85`](https://github.com/okeylanders/prose-minion-vscode/blob/058feb5940b3a39717d0d66882d96aaf6080d769/packages/core/src/presentation/webview/hooks/domain/useLightboxPassages.ts#L84-L85); late-answer acceptance at [`108–126`](https://github.com/okeylanders/prose-minion-vscode/blob/058feb5940b3a39717d0d66882d96aaf6080d769/packages/core/src/presentation/webview/hooks/domain/useLightboxPassages.ts#L108-L126).

The early return combines two different cases: the current key already has a pending request, **or** it already has an answered request. In the second case it leaves `pending.current` untouched, even when that pending request belongs to another pin. `handlePassage` subsequently checks against that obsolete pending record, not against the current selection. It accepts the abandoned reply and replaces the single cached answer.

**Independent production reproduction:**

1. Board the public-domain *Alice* ¶1–¶8 fixture through the real `LightboxService` and measurement services. Open `alice`; deliver the real `LightboxPassageHandler` reply. The production UI shows seven lit instances.
2. Click the well's ¶2 address. Hold its paragraph response. The inspector offers **← Back to “alice”** while the paragraph is loading.
3. Click Back before releasing the paragraph response. Alice's cached sentences correctly reappear, and no new Alice request is needed yet.
4. Deliver that now-abandoned ¶2 response, with its genuine request ID, board ID and content hash.
5. The inspector title and pin remain `alice`, but its sentence well disappears and reads **“Finding the sentences…”**. The request count stays at two. Waiting does not recover it: changing `answer` did not change the request effect's dependencies.
6. Explicitly unpinning and repinning Alice requests it again and recovers the well.

The rebuilt production `webview.js`, not a replacement implementation, reproduces this sequence against independently generated actual-host replies. The source hook independently reproduces the equivalent **A answered → B pending → A cached → B late** sequence. A board-A → board-B → cached-board-A sequence has the same defect in the hook; that is a correlation control, not a claim that Slice 5's board-switching UI exists today.

**Negative controls:** selecting a never-answered C replaces B's pending request and rejects B's late answer; unpinning before reopening A clears the pending record; ordinary paragraph → answer → Back navigation succeeds. In the failing case the view-model key check does prevent B's text from being displayed as A. The problem is the lost live answer and permanent loading state, not incorrect manuscript text being rendered under the current pin.

**Requested correction:** make pending ownership follow the currently requested key even on a cache hit. Abandon a pending record for another key before returning the cached answer, and keep response acceptance tied to the current request/selection identity. Add the held paragraph/back regression through `LightboxApp`, plus hook coverage for cached-pin returns, cached-board returns and repeated requests. Retain the existing stale-ID, wrong-board/hash, unpin and ordinary-back controls.

## N-01 — Avoid the all-spans scan for every segment

**Location:** [`LightboxPassages.ts:181–185`](https://github.com/okeylanders/prose-minion-vscode/blob/058feb5940b3a39717d0d66882d96aaf6080d769/packages/core/src/infrastructure/lightbox/LightboxPassages.ts#L181-L185).

`segmentsOf` creates approximately two cuts per non-overlapping instance, then filters the entire `spans` array for every interval. This is quadratic in the instances in one paragraph/sentence. The 50-row bound does not bound the instances or cuts inside one row; a paragraph well with `via` uses the same routine. The handler computes the reply synchronously before posting it.

An independent, deliberately repetitive fixture of 25,000 `Alice` tokens followed by one full stop is accepted by the real board service, below the 50,000-word source ceiling. Its word passage is one row with 25,000 correctly counted instances and 50,000 segments. In the isolated probe, board construction took about **156 ms**, while passage construction took about **1,904 ms**. The 5,000-token case took about **105 ms** for the passage. These are illustrative process timings, not a benchmark of native VS Code latency, and ordinary *Alice* chapter rows do not resemble this fixture.

This is nonblocking P3: the correctness/count contract holds, but a permitted long row can synchronously occupy the extension host. Consider an ordered start/end-event sweep with an active instance set, preserving overlapping-phrase IDs. Add an adversarial single-row case alongside the existing many-row bound test; do not silently drop instances to make the count appear consistent.

## Scope, contracts and ownership

Read the live PR body and diff before relying on its claims; `AGENTS.md` / `.ai/central-agent-setup.md`; the architecture guide; Lightbox ADR D4/D10/D12; the Slice 4E plan **and implementation notes**; the epic decision/progress records; Slice 5's plan; the closing-quote debt record; and prior independent Lightbox review reports. No checkout-local `.agents/skills` directory was present.

- **One source owner remains.** `LightboxService` installs the new index with the successfully adopted board, after its current-source-ticket check. An overtaken measurement cannot install its index. The passage route performs no source acquisition, file read, model call, source adoption or reading mutation. Reading-group replacement keeps the entry's index.
- **Retained-source addressing:** the handler resolves the named board ID and checks its content hash, rather than using whichever file is now active. Missing/replaced boards and mismatched hashes refuse as `changed`. The independent host export also verifies that a superseded same-file board is refused after rebuilding changed text.
- **Request validation:** malformed term kinds, POS/flag IDs, non-integral/out-of-range paragraph endpoints, invalid `via`, and missing/non-string/overlong routing names are rejected or ignored at the route boundary. The independent malformed-item sweep produced refusals without modifying the board or echoing source prose. Additional keys are ignored when a known shape is projected; this is not an exact-key decoder.
- **Composition and boundaries:** the route owner is constructed with the shared service in `MessageHandler`, registered in the route ledger and wired into `LightboxApp`. Contracts use the shared message barrel. The new modules join the Lightbox boundary lists; no app-layer source changes or core `vscode` import are introduced. Full architecture tests pass. `LightboxService` remains below the 500-line ceiling.
- **Privacy and persistence:** passages are returned only to the webview asking for them, not added to the broadcast board payload. The hook's persistence contract is empty, and the independently exercised production UI saves pin references/preferences but not its paragraph/sentence text. Normal host logs contain item kinds/counts and board IDs, not term/paragraph prose. This is not a claim that every earlier board field is devoid of manuscript-derived words: previews and counted terms already exist, and the hapax list intentionally carries the written words.
- **No hidden paid behavior:** the new route and UI navigation do not enter the model execution path. The bundle probe posts no `LIGHTBOX_RUN` message. No live/billable call, private manuscript, implementation edit, formal GitHub review/comment, merge, deployment or VSIX publication was performed.

## Count agreement, bounds and presentation

The two tokenizers remain distinct on purpose. Top words and phrases follow the word-frequency stream; hapax follows `proseStatsWords`; POS follows placed tagger occurrences with their actual lengths; instance-counted flags follow their existing detectors. Exporting the prose tokenizer and weak-verb detector does not change the tools' rules. Lowercase offset remapping covers length-changing `İ`, and POS fragments are lit as fragments rather than expanded to whole contractions.

The repository's every-entry agreement tests pass on all six public-domain fixtures. Independently, **169 listed entries across six additional edge fixtures** agree on board count, found instance count, and distinct lit IDs plus omitted instances. The cases include overlapping `had had`, cross-paragraph `light went dark`, em/en/hyphen boundaries, contractions, curly/straight quotes, `İ`, composed/decomposed accents, punctuation-attached words, wrapped lines, CRLF and 75-paragraph repeated text. The hapax length equals the headline hapax count in each case. These tests establish the exercised rules, not general linguistic correctness of the existing tagger/tokenizers.

Further independent checks:

- A 13-paragraph request returns ten whole paragraphs and explicitly reports three more. Original paragraph text, including its embedded newline/indentation, is preserved in the host's segments.
- Sentence rows are capped at 50, and omitted-instance accounting agrees in the exercised many-row cases. Overlapping phrase instances retain distinct IDs; instances crossing a sentence/paragraph boundary are grouped rather than counted twice.
- The exact production bundle displays literal *Alice* counts: top-word Alice **7**, POS `was` **13**, phrase `she had` **3**, Weak Verbs **28**, and one instance for hapax `daisy-chain`. The ¶2 via-word well lights **2** Alice instances; the normal Back path restores **7**.
- A separately measured **601-hapax-word** source renders **300 → 600 → 601**, removes the More control at exhaustion, and opens the last word's one instance. A new board resets the list. This tests paging beyond the author's 340-word chapter case.
- A changed-board message immediately removes the old paragraph well and shows the changed-text notice; its correctly correlated new response displays the changed actual-host paragraph. F-01 is the cached-return exception.
- The new wells use named `region` elements, `tabindex=0` and `aria-live="off"`; item/address/back controls are native buttons. The full suite includes the eight literal count/grammar regressions and the CSS-floor ratchet.

### Closing-quote sentence debt is not a new finding

`proseSentenceSpans` itself is unchanged by this PR. Its preexisting rule can count a closing quote after `.!?` as another sentence or put it at the start of the next row. The new wells consistently expose that rule, and the author explicitly records it in [the Medium-priority debt item](../../.todo/tech-debt/2026-10-21-prose-sentences-closing-quote.md). A display-only splitter would make the counts disagree. This review neither treats the inherited rule as a new Slice 4E blocker nor marks that debt resolved; changes to it must repin the affected measured figures deliberately.

## Verification and evidence limits

| Check | Independent result |
| --- | --- |
| Full head Jest | **440 suites / 6,012 tests / 59 snapshots passed**, 316.6 s |
| Head lint | **0 errors / 1,133 warnings**; exact relative-file/rule-count parity with the independent executable-equivalent baseline |
| Typecheck | Core, webview and extension all passed |
| Production build | Passed, including `clean:dist`, resource staging, webpack and `verify:bundle` |
| Diff whitespace | `git diff --check` clean |
| Independent probes | **4 suites / 9 tests passed**: host/count/bounds export and controls, held-response defect characterizations, segmentation timing |
| Exact production-bundle DOM | **34 assertions passed**, including the F-01 defect characterization and recovery control |

The independent baseline at `889e69f43607a55b8a421b2a4adef6fe9b59dea7` had **430 suites / 5,916 tests / 59 snapshots**, lint **0 / 1,133**, and passing typecheck/build. Its complete diff to this PR's exact base `20775cf` contains only three review-report files. Source, tests, package/lock files and configuration are unchanged. Baseline full gates were therefore **reused with verified executable equivalence**, not falsely reported as freshly run on `20775cf`. The head gates above were run freshly. Installed dependency versions were checked against the head lockfile; no mismatches were found.

The independently rebuilt `webview.js` SHA-256 is:

`8d0545decad8bf1e8dac296798ff57343abbb502b6228b5f1148db4c03262a61`

It matches the author's recorded bundle hash. The production DOM probe uses this exact bundle and a separate export of real measurement-service/handler outputs, with held replies to exercise F-01. Its green result means the recorded defect is reproducible, **not** that the defect has been fixed. Independent probe code/logs/HTML were kept outside the report-only repository change.

Visually inspected ten supplied PNGs covering all nine state families and all three viewport widths across the sample: word at 1440/500; paragraph, phrase, hapax, changed and bounded at 500; paragraph-lit and POS at 1000; flag at 1440. The inspected wells, count labels, highlights and narrow-layout wrapping are legible; the bounded state visibly states its omissions. The author supplies 27 captures and no recorded harness errors. This review does **not** relabel those captures as independent screenshots or claim to have independently measured all 27 layouts.

Independent interactive/native rendering was not available in this review environment. The rebuilt-bundle run is DOM/accessibility/transport evidence, **not pixel geometry, actual keyboard scrolling, a screen-reader test, native VS Code activation, or Chromium-102 runtime acceptance**. The unchanged floor guard and current supplied screenshots do not close those native checks. PR #158's separately reviewed floor raise is not imported into this branch.

## Acceptance boundary

Fix F-01 and retain its interrupted-navigation controls before accepting Slice 4E. N-01 is a nonblocking optimization follow-up. Keep the writer checkpoint and wider native/live verification explicit; do not infer Slice 5 readiness or a frozen saved-board format from this report or the author's chapter-run statement. This commit contains only the review report; publication/CI status is reported separately rather than recursively changing the reviewed implementation.

## Author response (2026-10-21)

**F-01: fixed. N-01: fixed.** Each fix has its own commit. PR #158 is
merged in, and the evidence was re-rendered from the head bundle. The
docs commit on top records this response, the slice notes, the epic
progress and the agents guide. Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | Pending is only ever the request for the pin on screen. Going back to a pin or board whose answer is held asks nothing and drops any other request. That request's late answer is never taken, and the dropped pin, pinned again, asks again under a new id | `LightboxAppPassages.test.tsx`: the held ¶2 → Back sequence with the real host handler (1). `useLightboxPassages.test.ts`: a held pin, a held board, the dropped pin asked again (3) | `86d269a` |
| N-01 | Low / P3 · nonblocking | **Fixed** | One walk matches sentences, or a range's paragraphs, to the instances that touch them. One sweep over where instances open and close cuts the segments, with an open set, so overlapping instances keep their own ids. Nothing is dropped | `LightboxPassages.test.ts`, "one long row" (2): literal counts and a coarse 1 s ceiling | `31a4550` |
| Evidence | — | **Added** | A tenth state, `back-late`, runs your sequence in Chromium against the head bundle. It fails against the bundle you read | The harness's `back-late` expectations | `e3f8c68` |
| PR #158 | Merge | **Merged and verified again** | The Chromium 114 floor. The one conflict was the tech-debt index, and both sides were kept. The 4E stylesheets pass the retargeted guard as they are | Full gates below | `6d63a6e` |

### How each new test was checked against `058feb5`

**F-01.** I put `058feb5`'s `useLightboxPassages.ts` back in place and
ran both suites:
- **Failed:** the 4 new tests.
  - Held pin and held board: "ready" expected, "loading" received.
  - Dropped pin asked again: 3 requests expected, 2 received.
  - `LightboxApp`: the well read "Finding the sentences…".
- **Passed:** the 12 earlier tests. These are your controls: a stale id,
  another board or hash, an unpin, the ordinary Back, one request per pin
  and board, and no text in `setState`.

With the fix restored, all 16 pass.

**N-01.** I put `058feb5`'s `LightboxPassages.ts` back in place.
- Both "one long row" tests passed every literal count. The old cutting
  was correct, as you found.
- Both failed at their ceilings. The one-sentence test ran 12.4 s, almost
  all of it in its three passages. The sentence-chain test ran 2.3 s, and
  its phrase passage was over the 1 s ceiling.
- With the fix, each passage takes about a tenth of the ceiling. The
  earlier 10 tests in the file pass on both.

### F-01: pending follows the pin on screen

**Root cause.** Your reading is right. The early return in
`requestPassageForPin` joined two cases: the pin's request is already
pending, and the pin's answer is already held. In the second case it
left `pending` holding another pin's request. `handlePassage` then
matched that request's late answer, took it, and replaced the one held
answer. The request effect's dependencies had not changed, so nothing
asked again.

**Fix.** The two cases are now separate:
- **The pin's own request is pending.** Nothing happens. This is the
  repeated request.
- **The pin's answer is held.** `pending` is cleared and nothing is
  asked.
- **Otherwise** a new request replaces whatever was pending, as before.

So `pending` is never a request for anything but the pin on screen.
`handlePassage` still requires the request id, board id and content hash
to match it. Taking an answer is therefore tied to the current request
and selection by construction, not by a second check.

**What changes for the writer:** nothing on the ordinary paths. After
Back from an unanswered paragraph, the word's sentences are there at
once. Pressing that paragraph again asks for it again.

### N-01: linear in what is sent

**Root cause.** The row bound limits rows, not what one row holds.
`segmentsOf` filtered every span for every interval. `sentenceOf` did the
same for each of a row's sentences. I found the second case beside yours:
"Alice. Alice. …" makes the phrase "alice alice" cross every sentence
break, so one row holds every sentence.

**Fix.**
- `instancesTouching` walks ranges (a row's trimmed sentences, or a
  range's paragraphs) and the instances, both in text order, with an open
  list.
- `segmentsOf` sorts the opens and closes once, sweeps them, and names
  each stretch by the instances open over it, sorted.
- At 25,000 instances in one sentence, the word's passage went from about
  4.1 s to 0.12 s in the probe, the phrase's from 3.1 s to 0.09 s, and the
  lit paragraph's from 3.5 s to 0.05 s.

**Proof of sameness.** Before keeping the change, I ran a throwaway
differential test that built 7,077 passages with both `058feb5`'s cutting
and the new one, and found them deep-equal. It covered:
- every listed entry on the six agreement fixtures, as instances and as
  each paragraph lit by it;
- an overlapping `had had`, a phrase across a paragraph break, and the
  two long shapes.

It was deleted after use. The rebuilt evidence states are also
byte-identical.

### Verification

| Check | `20775cf` (base) | `058feb5` (reviewed) | Head |
| --- | --- | --- | --- |
| Full jest | 430 suites / 5,916 tests / 59 snapshots | 440 / 6,012 / 59 | **440 / 6,019 / 59** |
| Lint | 0 errors / 1,133 warnings | Identical per file and rule | **Identical per file and rule** |
| Typecheck | Passes | Passes | **Passes** |
| Build (with `verify:bundle`) | Passes; `0f6624f4…` | Passes; `8d0545de…` | **Passes; `2f86917e…`** |
| Diff whitespace check | | Clean | **Clean** |

- The head is the two fixes merged with `e8389bf`.
- The 6,019 tests are the reviewed 6,012, plus the 6 review tests, plus 1
  from PR #158's floor guard.
- The head bundle,
  `2f86917e89befed61189d1422fbb71e211c2ea59e28fbd0c9a0e8db06de2ae04`, was
  built after `npm ci` into a real `node_modules`, and a second build
  reproduced it.

**Evidence.** All 30 captures pass the harness with an empty `errors.txt`.
Against `8d0545de…`, the harness writes 3 errors, `back-late` at each
width, and every other state passes. The 27 earlier captures show the same
DOM facts as before.

**Limits, as you set them.** This is DOM, transport and timing evidence
in headless Chromium. It is not native VS Code, a screen reader, or the
writer's checkpoint. Slice 5's format and readiness stay open. No live or
billable call was made.

## Independent correction re-review (2026-10-21)

**Reviewed integrated head:** `2e62aa766226f11a47630248b8f2ce7b4fee1dbb`
**Exact current base / merge-base:** `e8389bf32574ef5888bd1ad3c1d0a96fc8b807bb`
**Delta from the first report:** `0b1c8ea6395dc537bb2c63693d86a02ceb6d582e` → `2e62aa7`, 38 files, +1,217 / −137, including the separately reviewed #158 floor integration
**Reviewer:** Astra · **Mode:** independent correction review, old-head negative controls, actual-host export, exact rebuilt production-bundle DOM execution and fresh full integrated gates

**Updated code-review disposition: F-01 and N-01 addressed; no remaining finding in the reviewed correction.** This section supersedes the original open dispositions, not the historical evidence. The original review and the entire author response above are preserved byte-for-byte. This is not a formal GitHub approval, merge instruction or broader epic acceptance.

| ID | Independent disposition | Evidence |
| --- | --- | --- |
| F-01 · P2 | **Addressed** | Cached-pin and cached-board returns retire the other pending request. Independent hook and production-bundle interrupted-navigation regressions pass; original hook/bundle fail the intended checks |
| N-01 · P3 | **Addressed** | Ordered range matching and a sorted-event segment sweep remove the repeated all-instance scans. Independent old/new output parity and adversarial scaling checks pass without dropping instances |

### F-01: late replies no longer destroy the cached well

The production change separates the pending-key and answered-key cases. A cache hit now clears `pending.current` before returning; the existing request ID / board ID / content-hash checks still gate reply acceptance. No protocol, source ownership, persistence or paid execution path is changed.

Independent hook probes cover **five sequences**: cached pin return, cached board return, selecting a new unanswered C, unpin/reopen, and reopening the abandoned B under a fresh request ID. All pass on the correction. Running the same assertions with the original `058feb5` hook fails **exactly the three correction regressions**; the C and unpin controls pass. The original source was loaded from an external evidence copy, not substituted into the implementation worktree.

The exact newly built production `webview.js` also passes the actual UI sequence with independently generated production-host replies: Alice's seven instances → ¶2 request held → Back → ¶2 reply released. The title, ready state and seven lit instances remain, with only two requests. Opening ¶2 again makes a third request with a new ID; replaying the old ¶2 answer cannot settle it, and its own answer correctly lights two instances. Ordinary settled paragraph/back navigation still works. Running the corrected DOM assertion against the preserved original production bundle fails specifically with **`loading` instead of `ready`**, demonstrating that this check detects the original defect.

The full bundle probe passes **37 assertions**, retaining the earlier literal term/POS/phrase/flag/hapax counts, changed-board hiding and replacement, **300 → 600 → 601** hapax paging and reset, labelled/focusable well semantics, and absence of passage-text persistence, model-run messages or non-CSS runtime errors.

### N-01: output parity and bounded-work improvement

Inspected the complete `LightboxPassages` delta, including the additional sentence-chain case. The range walk retains instances touching more than one sentence/paragraph. The event sweep clamps spans to each displayed range, applies coincident boundaries before the next segment, and sorts active IDs so overlapping phrase identities remain stable. This removes the identified quadratic scans; it is a **sorted-event sweep**, not a claim that every operation is strictly linear for arbitrary inputs or that a single row has a new hard size bound.

A separate differential probe compares the original and corrected functions against the **same real production board/index**, not reimplemented expected segmentation. **7,218 passages across 22 fixtures / 674 listed entries are deeply equal**, including each term's instance passage, paragraph ranges with `via`, absent-term controls, six independent edge fixtures and sixteen deterministic seeded combinations. Coverage includes overlapping phrases, cross-paragraph matches, sentence boundaries, whitespace/CRLF, contractions, Unicode case expansion, accents, punctuation and row/paragraph bounds. Ten additional long-shape comparisons are also deeply equal. The regenerated independent actual-host state export is **byte-identical** to the original review's export.

**Timing context before the figures:** these are illustrative same-process measurements in the independent **Linux x64 cloud workspace, Node 24.19.0, Jest/ts-jest-transformed TypeScript**, with synthetic test text, one Jest worker and sequential jobs. They are **not native VS Code, Chromium or extension-host latency measurements**, and they are not a statistical benchmark.

| Synthetic shape / requested passage | Original cutting | Corrected cutting |
| --- | ---: | ---: |
| 5,000 tokens, one sentence / word | 126 ms | 10 ms |
| 10,000 tokens, one sentence / word | 340 ms | 15 ms |
| 25,000 tokens, one sentence / word | 2,055 ms | 42 ms |
| 25,000 tokens, one sentence / overlapping phrase | 2,038 ms | 50 ms |
| 25,000 tokens, one paragraph / `via` word | 2,062 ms | 29 ms |
| 25,000 `Alice.` sentences / connecting phrase | 2,649 ms | 124 ms |

The single-sentence word retains 25,000 instances and 50,000 segments; the overlapping phrase retains 24,999 instances and its original IDs/segments. The connecting-phrase case retains one row containing 25,000 sentences and 24,999 instances. No performance assertion here is made true by truncating the source or omitting an instance. The repository's two new adversarial count/ceiling tests pass in the fresh full run.

### Integrated floor and fresh verification

PR #158 is now actually integrated. The extension manifest, complete lockfile, extension README, corrected CSS guard, both ribbon components, ribbon stylesheet, floor ADR and complete #158 report are **byte-identical to independently cleared `7d84ef8`**. Its source-based floor conclusions and corrected guard evidence are reused with verified equivalence, not re-labelled as a fresh native runtime test. The full integrated suite exercises that guard together with Slice 4E; no new allowance is added for these wells. The merge preserves the separate closing-quote debt entry. That splitter's inherited limitation remains unresolved and is not a new correction defect.

| Check | Fresh independent result at `2e62aa7` |
| --- | --- |
| Full repository Jest | **440 suites / 6,019 tests / 59 snapshots passed**, 319.756 s |
| Lint | **0 errors / 1,133 warnings**; exact normalized file/rule/severity/message parity with the original independent `058feb5` run |
| Typecheck | All three stages passed |
| Production build / `verify:bundle` | Passed from cleaned `dist`; same three webpack size/performance warnings |
| External independent probes | **5 suites / 11 tests passed**; original-hook control deliberately fails 3 and passes 2 |
| Exact production-bundle DOM | **37 assertions passed**; original-bundle late-reply negative control fails as intended |
| Diff / preservation | `git diff --check 0b1c8ea..HEAD` passed; original review and full author-response prefix preserved |

The rebuilt production bundle SHA-256 is **`2f86917e89befed61189d1422fbb71e211c2ea59e28fbd0c9a0e8db06de2ae04`**, matching the author's revised evidence. The complete suite/typecheck/lint/build results above are fresh on the integrated correction, not a reuse of either original PR's gates. External probes do not inflate repository test totals.

Visually inspected the three new supplied **back-late** PNGs at **500, 1000 and 1440 px**: each retains the Alice sentence well and legible instance highlights after the held reply. The 27 earlier recorded DOM states remain equal apart from state-save counts and added transport bookkeeping; the supplied host-state files are unchanged. These are author-supplied screenshots, not independently captured geometry. Our exact-bundle execution is JSDOM/transport/accessibility-attribute evidence, not native rendering, actual keyboard scrolling, screen-reader testing or execution at the minimum Chromium 114/VS Code 1.82 runtime.

**Acceptance boundary:** the code-review blocker and nonblocking performance note are cleared within this evidence scope. Writer decisions and the reported real-chapter run remain author-authored claims, not authenticated checkpoint acceptance. Native/minimum-host and live-provider verification, Slice 5 readiness and saved-board-format decisions remain separate. No implementation/test/lockfile edit, formal review/comment, merge, deployment, VSIX publication, paid/live model call, private manuscript processing or user-computer operation was performed. This publication changes only this report; its resulting CI is tracked separately rather than recursively appended to the report.
