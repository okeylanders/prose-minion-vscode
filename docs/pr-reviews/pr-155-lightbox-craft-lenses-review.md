# PR Review — Lightbox Craft Lenses (Slice 4B)

**Author:** okeylanders · **PR:** [#155](https://github.com/okeylanders/prose-minion-vscode/pull/155) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4b-craft` → `epic/lightbox`
**Reviewed implementation head:** `8b930fbdaef04a03e5ca68537f6ce0b4a95765d2`
**Verified base / merge-base:** `eca952a59552b13fc62d46b22a2188ea3a15cf49` (merged PR #154)
**Scope:** 148 files · +8,120 / −340 · 4 commits
**Reviewed:** 2026-10-20 · **Reviewer:** Astra
**Mode:** independent source/spec review; original production-service/codec/carry/Bring counterexamples and negative controls; exact rebuilt-production-bundle DOM; all 30 supplied PNGs inspected; base/head gates

## Summary

**Verdict: Request changes.** The implementation adds the intended fourth reading group and generally preserves the measured/read boundary, host-owned validation and explicit-press lifecycle. Four new correctness defects are independently reproduced:

1. A same-text rebuild can change the numbers' baseline or preset while leaving old number-usage readings current, including a result from a call already in flight. The UI and Workshop then present a reading of a figure that no longer stands out.
2. A valid handoff between two identically worded adjacent sentences is reduced to one quote by generic deduplication, so Bring refuses the pair it just verified.
3. Familiar-phrase support can be attached to a quote cut inside another word: `very` cut from `every` passes if a real `very` occurs elsewhere in the chapter.
4. Rounding rates before comparing them can invent an above-average standout and can label a nonzero baseline as “none.”

These are deterministic correctness findings, not assertions about live model quality or vulnerabilities granting filesystem or provider authority. No implementation change is made by this review.

The PR's checkpoint record and decisions 10–16 are author-authored claims. Their internal plan consistency was reviewed, but no authenticated writer acceptance of that checkpoint or those new product decisions was independently established here. This is not Slice 5, native VS Code acceptance, or approval to freeze the saved-board format.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Baseline/preset-only rebuild preserves number usages and accepts in-flight results against obsolete standouts | **Open** |
| F-02 | Medium / P2 | Bring deduplicates two distinct adjacent sentences with the same words and refuses a valid handoff | **Open** |
| F-03 | Medium / P2 | Familiar-phrase evidence re-tokenizes a clipped quote rather than validating the source occurrence | **Open** |
| F-04 | Medium / P2 | Display rounding changes standout eligibility, ratios and zero-baseline claims | **Open** |
| N-01 | Low / P3 · nonblocking | A surviving first-sentence copy can mask an intact handoff relocated to another paragraph | **Open, conservative carry limitation** |

## F-01 — Revalidate number usages when their measurement context changes

**Primary location:** [`LightboxService.ts:250–251`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxService.ts#L250-L251).

`assemble` remeasures the writer's baseline and publishing ranges on every build. If the chapter's content hash is unchanged, `buildBoard` preserves the board id and replaces the newly assembled readings with `latest.readings` without revalidating or marking the numbers lens stale. Number usages additionally depend on the board's standout set, direction and sentence-length reference, not only the unchanged prose.

**Independent reproduction, real service and reading handler:**

1. Build the public-domain Alice excerpt against a synthetic writer baseline, with no publishing ranges. Sentence length, dialogue and intensifiers stand out. Read Group D using the shipped response through the actual runner, codec and gates.
2. Remove that baseline and Re-read the **identical** source text. All three figures cease standing out; the board correctly drops their baseline/reference data.
3. The three previous `number-usage` tiles remain in the `ok` group, with the same board id and no stale mark. Bring still succeeds for them.
4. Hold the provider result, perform the same baseline-only rebuild, then release the old Group D result. It lands as current for the same reason: completion ownership identifies the board/run, not the new measurement context.

The production webview, not just a simplified component, reproduces the visible consequence: **zero standout rows, three current usage readings, zero stale warnings**. Pinning Sentence length still says each quote holds an instance checked by its detector, enables Bring and posts the ids-only handoff. [`LightboxNumbers.tsx:51–59,90–92`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/presentation/webview/components/lightbox/LightboxNumbers.tsx#L51-L59) renders an existing usage independently of `row.standout`.

There is also a host-side fallback: [`LightboxTileHandoff.ts:123–125`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L123-L125) uses ordinary quote verification when the figure is no longer in the standout map, instead of refusing a number usage. That lets an obsolete reading travel with the board's new figure/reference presentation.

**Controls:** A fresh read under the absent baseline rejects these usages. A changed-text rebuild takes the carry path and correctly withholds them. The new estimate key does reject an old estimate and a changed baseline while prompts are being prepared, before spend. The defect is not a missing pre-spend key: it is the already-completed/already-started reading's ownership after adoption of new measured context.

**Requested correction:** Treat changes to the numbers' eligibility and witness definition as a numbers-reading invalidation. Recheck retained number usages, stale or withhold those whose measured basis changed, and prevent an already-started result from becoming fresh against a different measurement context. Bring should fail closed if its number usage no longer has the required current standout. Cover baseline disappearance, a changed reference/direction with the stat still present, preset-only changes and delayed completion, while preserving unchanged Groups A–C and unrelated craft lenses.

## F-02 — Preserve the two roles of a repeated-sentence handoff

**Primary location:** [`LightboxTileHandoff.ts:124–138`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L124-L138).

The adjacent-sentence verifier correctly finds two distinct sentence positions even when their words are identical. The accepted tile consequently contains two entries. Bring then applies the generic `(paragraph, text)` deduplication to them, keeping only one. Its later “never half a pair” check sees one entry and refuses the handoff.

**Minimal reproduction:** Source paragraph `She waited. She waited.`; `from` and `to` each quote `She waited.` in ¶1. Production `findLightboxSentencePair` returns `ok: true`; fresh production assembly draws the handoff with both evidence entries. `prepareLightboxTileHandoff` returns `handoffIncomplete`: “Its two sentences … cannot both travel … Nothing was cut.” Both quotes are short enough, both really exist, and there is no changed/stale source.

**Controls:** `She waited. Nobody came.` brings both quotes in order. Asking for two `She waited.` quotes when the source contains only one is correctly rejected during fresh assembly. This is not a request to accept one occurrence twice; the verifier has already proven the two roles refer to adjacent occurrences.

**Requested correction:** Prepare a handoff through its pair-specific verification/projection and retain both ordered roles even if their displayed text and paragraph are equal. Apply size/count limits to that pair without the generic evidence deduplication. Add fresh, carry and Bring tests for intentional repetition and the one-occurrence negative control.

## F-03 — Anchor familiar phrases to whole occurrences in the source span

**Primary location:** [`LightboxTileGates.ts:190–197`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxTileGates.ts#L190-L197).

The chapter-wide term counter uses whole tokens, but the familiar-phrase gate tokenizes the **already clipped quote text** again. A quote's artificial edge can therefore turn a word suffix into a whole token. An unrelated real occurrence elsewhere satisfies the separate positive-count gate.

**Minimal reproduction:**

- ¶1: `We watched every bright window.`
- ¶2: `The road was very quiet.`
- Familiar phrase: `very`; quoted evidence: `very bright window` in ¶1.

The ordinary quote verifier legitimately finds those characters inside `every`. Re-tokenizing the substring then sees `very` as a complete word. The production tile draws with its only evidence in ¶1 but support `{ term: 'very', count: 1, paragraphs: [2] }`. The same false witness survives carry and is accepted by Bring. The counted occurrence and the displayed supporting quote do not refer to the same phrase occurrence.

**Controls:** Quoting the complete `every bright window` is withheld. A genuine `a very bright window` source passes. Removing ¶2's real `very` causes the chapter-wide count to reject the tile. The defect needs both gates and is not merely a wrong chapter count.

**Requested correction:** Verify familiar evidence with source-span occurrence containment under the term counter's tokenization/normalization rules, rather than treating a newly clipped substring as an independent token stream. Reuse that witness rule for fresh assembly, carry and Bring, including repeated exact/normalized candidates. The new numbers implementation already shows the needed principle: compute detector matches over the full paragraph, then require the accepted quote span to contain a real match.

## F-04 — Decide standouts and ratios from unrounded counts

**Primary location:** [`LightboxNumbers.ts:166–171`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxNumbers.ts#L166-L171), with the rounding in [`lightboxFigureValue:125–132`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxNumbers.ts#L125-L132) and the comparison in [`standoutOf:265–272`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxNumbers.ts#L265-L272).

Chapter and writer rates are rounded to one decimal **before** their ratio and standout threshold are computed. Display precision therefore changes whether a model is asked to interpret the figure, rather than merely formatting the measured answer.

**Ordinary-length synthetic reproduction:** Three passive constructions in a 4,000-word chapter and 27 in a 50,000-word baseline produce exact rates `0.75` and `0.54` per 1,000 words. The real ratio is `1.3889`, below the `1.5` standout threshold. The implementation first rounds these to `0.8` and `0.5`, displays `1.6×`, and marks the figure as standing out above the writer's average. The minimum-three-instances and minimum-text gates are satisfied; this is not an underpowered sample bypass.

**Nonzero-to-zero reproduction within the published text bounds:** Three intensifiers in 50,000 source words versus 14 in 300,000 baseline words have a real ratio of `1.2857`. Rounding turns the baseline rate `0.0467` into zero and the source rate `0.06` into `0.1`; the zero-baseline branch marks a standout and the production value helper says **“none in your other chapters”**, despite the 14 detected instances. A truly zero-instance baseline correctly stands out; 20/30-instance baseline controls do not, demonstrating that the false decision follows rounding rather than a broken detector.

**Requested correction:** Keep full-precision rates or compare the integer counts/denominators for threshold and ratio decisions. Determine “none” from an actual zero count, not a display-rounded average. Round only the shown rate/ratio, with an honest representation for nonzero values below the chosen precision. Add both ordinary-threshold and nonzero-to-zero controls.

## N-01 — A surviving first sentence can hide a relocated intact pair

**Location:** [`LightboxCarryQuotes.ts:130–145`](https://github.com/okeylanders/prose-minion-vscode/blob/8b930fbdaef04a03e5ca68537f6ce0b4a95765d2/packages/core/src/infrastructure/lightbox/LightboxCarryQuotes.ts#L130-L145).

Start with ¶1 `She waited. Nobody came.` and ¶2 `The clock kept ticking.`. After editing, ¶1 is `She waited. A bell rang.` and ¶2 is the original intact pair `She waited. Nobody came.`. Fresh verification at ¶2 accepts the pair, but carry rejects it as “One of its two sentences is no longer in the chapter.” Since the first sentence still matches in the old paragraph, the relocation candidate list is empty. Removing that old first-sentence copy lets carry follow the pair to ¶2; genuinely inserting a sentence between the pair correctly withholds it.

This is conservative paid-reading loss with an inaccurate explanation, not acceptance of false evidence. It resembles the previously recorded moved-Subtext limitation in [PR #153](pr-153-lightbox-carried-subtext-evidence-review.md), although the handoff path is new. It is kept nonblocking rather than treating universal original-wire/fresh/carry equivalence as a newly implied requirement. Consider searching candidate paragraphs for the intact pair, and avoid saying words vanished when they are known elsewhere.

## Scope, architecture and plan

Read repository `AGENTS.md` (the `.ai/central-agent-setup.md` guide), the Lightbox ADR, complete 4B spec, 4C/4D plans, changed Slice 5 prerequisites/format plan, ribbon feature note, response-ceiling debt, design canvas snapshot and prior PR #149–#154 house reviews. No checkout-local `.agents/skills` directory was available.

- Group D joins the explicit closed unions, host register/lens maps, prompt file selection, group planner, output estimate, runner and board initialization. The default concurrency is the number of groups; no additional implicit provider action is introduced.
- The eight new infrastructure modules are each below 500 lines and present in the Lightbox architecture boundary inventory. `LightboxWriterBaseline` is constructed at the extension composition root, not in a handler. Core has no `vscode` import.
- The shared Style Flags detectors are exported and consumed by the existing class, not replaced by a second Lightbox matcher; being verbs are a separately tested deterministic helper. Metrics parity and the existing Workshop snapshot gates remain part of the verification.
- The writer baseline reads only catalog-admitted text files; the independent real-catalog control rejects a symlink ancestor. Its 200-entry cache retains counts and file metadata, not manuscript text. Logs report totals/outcomes rather than paths, prose or exception bodies. Baseline measurement has no model/network dependency; derived references enter the explicit reading request. Craft UI uses ordinary React text rendering, and Bring remains an ids-only request resolved by the host. These observations do not claim race-proof filesystem containment or native acceptance.
- Host counts, quoted readings and measured figures are visibly distinguished. Stock is the mix of the verified/classified sample, not a claim about all chapter beats. Echo resemblance is expressly unverified; the accuracy callout travels to the inspector and Workshop. No claim is made that a word list can universally infer directive intent or factual provenance.
- The plan adds E/F only as future slices. No implementation of those groups or saved-board format is claimed. The design is explicitly an illustrative draft; its stub figures are not test oracles. The D7 addendum fences the proposed Opinion/freshness behavior, but author-authored “writer decisions” do not establish user approval by themselves.

## Bounded limits and nonblocking consistency notes

- **Sentence boundaries are the repository's punctuation rule**, not linguistic parsing. The unchanged `proseSentenceSpans` splits `We found Dr. Chen waiting.` after `Dr.` and retains a final closing quote as a nonblank tail. The new pair matcher correctly reuses that documented rule; “checked adjacent” should be understood within it. Paragraph sentence counts may also differ from whole-text counts for unpunctuated headings, as the existing paragraph model documents. No NLP rewrite is requested here.
- **Below-dialogue row/quote consistency:** The row counts only paragraphs containing no dialogue, but the quote filter permits narration spans inside mixed paragraphs. A mixed paragraph `“Go,” she said. The cart rolled down the winding road toward the distant mill.` can report zero narration-only instances and light no paragraphs while accepting the narration as a below-dialogue usage witness. Its displayed row label does describe the narrower count, so this is a nonblocking consistency refinement, not another false-quote blocker. Align the count/hover definition with the documented witness contract or explicitly distinguish them.
- **The baseline's 300,000-word boundary is soft at file boundaries.** It checks the accumulated words before adding the next complete file. Three allowed files of 120,000 words each (575,999 bytes) produce 360,000 words and `capped: false` if there are no further files. This was reproduced in 153 ms with an in-memory filesystem, not a claim about real disk latency. The class describes stopping once the threshold is reached; whole-file sampling may be intentional. Make the advertised limit/summary precise or enforce a hard limit, rather than describing this as a security finding. The independent file-count cap, file metadata guard and bounded cache remain useful.
- A same-size, same-mtime content change is outside the cache's declared invalidation policy. Whole-book manuscript fallback can include the source chapter internally; source exclusion is path-based, not manuscript segmentation. Sequential reads are awaited on each board build and have no separate cancellation/deadline: no real native/cloud-filesystem latency bound was established. Conservative skipped-file and unavailable-baseline behavior does not call a model or leak exception text.
- Being verbs intentionally omit contractions; dialogue inherits the recorded single-quote convention limitation. Number directive/likelihood word lists are bounded heuristics with declared false positives/negatives, not universal intent/provenance guarantees. These are not reopened as blockers.
- Maximal Group D item bounds can exceed the 32,000-character group response cap, as the PR's explicit Low-priority debt records. The whole-response prompt cap and recovery/quarantine remain the current fallback; the worked example is substantially smaller. Typical output-token estimates are labelled guesses until live measurement, not measured costs.
- The Numbers card places its ordinary stale warning after all usage rows because read and measured parts share the frame's `aside`; Stock/Rhythm warn before read content. The warning, inspector and Bring gate are still present in ordinary stale carry. Moving it before the first reading is an optional clarity improvement, separate from F-01's missing invalidation.

## Independent verification

Original probes use public-domain or synthetic text and controlled providers only. They assert observed counterexamples plus contrasting controls; a passing defect-witness test is not a claim that the tested behavior is correct.

| Check | Independent result |
| --- | --- |
| Base full Jest | 397 suites / 5,597 tests / 59 snapshots passed (208.746 s) |
| Head full Jest | 407 suites / 5,693 tests / 59 snapshots passed (229.418 s) |
| Base and head typecheck | All three stages passed on both |
| Base and head lint | 0 errors / 1,133 warnings on both; normalized file/rule/severity/message multiset identical |
| Base and head production build, including `verify:bundle` | Passed; same three webpack size/performance warnings |
| Materialized-dependency head rebuild | Passed; `webview.js` SHA-256 `caaa2e3333222f4bba6e72d592c3c74e3dccf3a5812de242da4e0b7dbe03bf39`, exactly the supplied evidence's hash |
| `git diff --check eca952a..8b930fb` | Passed |
| Original craft gate/carry/Bring probes | 10 tests passed, including F-02/F-03/N-01 witnesses and negative controls |
| Original numbers lifecycle/instance probes | 10 tests passed; completed/in-flight invalidation witnesses and pre-spend/fresh/carry controls |
| Additional baseline/detector controls | 11 checks passed, including real catalog symlink refusal, source exclusion, metadata-cache invalidation, bounds/failure handling and complete Style Flags output parity with base over 300 synthetic fixtures |
| Premature-rounding probes | Ordinary-length false standout and nonzero-baseline “none” reproduced; real-zero and non-standout controls checked |
| Supplied host evidence regeneration | Passed; chapter, Workshop and log files byte-identical to committed evidence |
| Production DOM craft/Workshop sweep | 292 assertions passed across all 16 craft tiles / 8 kinds, accessible button names/focus/pin/Escape, measured/filter/lens views, stale endings/Bring guards, tray and removable two-quote Workshop pill |
| Production DOM numbers lifecycle witness | 5 assertions passed against real service output and exact rebuilt bundle |
| Exact implementation-head PR CI | [CI run 39505395654](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39505395654/job/118912921144) succeeded through install, typecheck, tests, lint and build |

Runtime: Node `v24.19.0`, npm `11.9.0`; CI separately uses Node 18. The initial simultaneous base/head full-suite attempts were killed with exit 137 under resource pressure, with no assertion failure before the kill; neither attempt counts as a pass. Sequential 4 GB in-band retries were also killed. The complete suites were then run sequentially with `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1200MB`: one recycled Jest worker, a 2 GB heap and a 1,200 MB idle-memory limit. The table records only completed runs. No lockfile or tracked implementation file was edited.

## Visual evidence and acceptance limits

All **30 supplied PNGs** were inspected as actual pixels, covering ten state/surface captures at 1440, 1000 and 500 px. Stock, rhythm and numbers layouts fit coherently at the supplied widths; register labels, Echo accuracy wording, handoff evidence, ending marks and stale blanking are visible. `inspector@500` itself shows the selected card rather than the inspector; `bound@500` supplies the narrow inspector view. The narrow ribbon-only shots cut off much of the ribbon; other supplied stock/rhythm/stale captures show it. These are evidence-coverage distinctions, not invented layout failures.

The 500px Workshop screenshot still shows only the pill's left portion, matching the expressly recorded pre-existing narrow Workshop reflow debt. No new Workshop pixel-layout regression is inferred from that known limitation.

The rebuilt production hash verifies the bundle bytes cited by the evidence. The committed state builder was independently rerun: `chapter.json`, `workshop.json` and `log.txt` are byte-identical to the committed files. It uses real services/handlers/codec/Workshop seed delivery but a synthetic baseline, controlled filesystem/model/pricing and stub provider. Groups A–C are off in that builder; screenshots are not four-group acceptance. The harness replays host state and predetermined handoff answers, not connected native IPC. `facts.json` and `errors.txt` are not committed, so the original no-page-error/no-overflow measurements remain author reports, not fresh reviewer-browser results. Production DOM probes verify rendering, controls and posted protocol under controlled transport, not layout, native focus, native IPC or browser hit-testing. No fresh Chromium launch, previously denied local-file route, or user-laptop access was attempted. No live/billable provider call or private manuscript was used.

The author says real chapters “are working great” and marks the earlier checkpoint passed. That remains attributed author evidence in this review, not independently verified writer acceptance. The separate native/live pass and any authenticated acceptance required before Slice 5 remain outside this code-review clearance.

The final pre-publication remote-ref check at 22:36 UTC confirmed the implementation head and base above were unchanged. The review adds only this report; its subsequent report-commit CI is tracked separately, not presented here as an implementation test that already ran.

## Next step

Fix F-01 through F-04, retain the contrasting negative controls and rerun the affected full gates. Keep N-01 and the documented bounded heuristics visible without requiring a universal linguistic or model-intent guarantee. Report publication does not authorize implementation edits, a formal GitHub review, merge or deployment.
