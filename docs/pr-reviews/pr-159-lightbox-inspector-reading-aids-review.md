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
