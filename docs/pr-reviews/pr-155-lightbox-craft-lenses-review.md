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

## Author response (2026-10-20)

**F-01 to F-04 and N-01: addressed. The three nonblocking consistency notes: taken.** Every fix is in `fc4c564`. `2ef5d74` reruns the visual evidence and records the review in the slice notes, the epic README and the agents guide. Nothing above this section was edited.

**How each new test was checked against `8b930fb`.** I extracted `8b930fb`'s `packages/core/src`, `packages/core/resources` and test configuration with `git archive` into a scratch directory, copied this change's tests over them, and ran them with ts-jest type diagnostics off. Across the eight affected test files, 22 of 71 tests failed there: the 19 new tests and the 3 existing cases this change updates (two unrounded-value expectations in `LightboxNumbers.test.ts` and the "less dialogue" case in `LightboxCraftReadings.test.ts`). Each failed at its behavioral assertion, except the two `lightboxTermSpans` tests, which fail with a `TypeError` because the helper is new. The other 49 pass on both.

### F-01: number usages belong to the measurement they were read under

**Root cause.** The finding is correct. A usage's validity depends on the board's standout set (direction, bases and the sentence-length reference), and the content hash does not cover that set. Three places assumed it did:
- `LightboxService.buildBoard`'s same-text path replaced the freshly assembled readings with `latest.readings`, unchanged.
- The reading handler settled a landing group against the board without comparing the measurement the press read with the board's current one.
- `LightboxNumbers.tsx` drew a usage whether or not its row stood out, and Bring fell back to ordinary quote verification when the figure had no standout.

**Fix.**
- **One hold, applied in two places.** `holdLightboxNumberUsages(group, readUnder, current)` (`LightboxNumberInstances`) keeps a number usage only while its figure's `lightboxStandoutSignature` (`[direction, against, reference]`) exists and is equal under both measurements. Otherwise the usage is withheld by its title, with no quotes and a host reason: `numberNotStandout.carried` when the figure no longer stands out, or the new `numberRemeasured` when it stands out differently. Every other tile passes through untouched.
  - **Same-text rebuild.** `buildBoard` runs every retained group through the hold, from the previous board's rows to the new ones.
  - **Landing.** A landing group runs through it from the press snapshot's rows (`press.source.material.numbers`) to the board's rows at landing. For this, the `updateReadings` callback also receives the current board, as `(readings, board) => readings`. A one-argument callback still works.
- **Bring fails closed.** A number usage whose figure has no standout on the board is refused with the new `notStandout`. It no longer falls back to plain verification.
- **Webview.** The numbers tile draws a usage only under a row that stands out.

A remeasure marks no lens stale, because the text has not changed; the withheld reason itself says to re-read the numbers. The tests assert that groups A–C and the stock and rhythm readings are untouched.

**Tests.**

| Test | Reproduction, and its control | On `8b930fb` |
| --- | --- | --- |
| `LightboxNumbersRemeasure.test.ts`, baseline gone | Same text with no writer's average: all three usages withheld (`numberNotStandout.carried`), and Bring refuses one. Control: a rebuild with nothing changed leaves every reading equal; group A and the stock and rhythm tiles stay equal; no lens goes stale | The usages stayed current |
| … reference change | The writer now averages 12 words a sentence: sentence length still stands out above, but against 12, not 14. Only that usage is withheld (`numberRemeasured`); the intensifiers and dialogue usages stay | All three stayed |
| … direction change | Dialogue now stands out above the writer's average, not below. Only that usage is withheld; the other two stay | All three stayed |
| … preset-only change | Preset ranges arrive, so sentence length and dialogue stand out against the preset and the writer. Those two are withheld; intensifiers, still against the writer alone, stays | All three stayed |
| `LightboxNumbersLanding.test.ts` (real handler, service and runner) | Group D held in flight, the same file rebuilt with no writer's average, then released: its usages are withheld and the rest of the group lands. Control: released after an unchanged rebuild, all three usages land | The usages landed as current |
| `LightboxCraftWitnesses.test.ts`, Bring and a numbers reading | On a board with no standouts: refused with `notStandout`. Control: brought while the figure stands out | Brought |
| `LightboxAppCraft.test.tsx`, production `LightboxApp` | The dialogue reading leaves the numbers tile once the board no longer marks dialogue as standing out. Control: shown while it does | Still shown |

### F-02: a handoff keeps both of its roles

**Root cause.** The finding is correct. Bring passed a handoff's quotes through the generic `(paragraph, text)` de-duplication that every tile shares. Two roles with the same words became one, and the "never half a pair" check then refused it.

**Fix.** `prepareLightboxTileHandoff` prepares a handoff in its own `handoffOf`. It finds the pair again with `findLightboxSentencePair` (the check that fresh assembly and carry use), sends `from` and `to` in that order, and applies the Workshop quote bound to each. Any other outcome is refused with `handoffIncomplete`; a pair is never halved. Other kinds keep the de-duplication.

**Tests.** `LightboxCraftWitnesses.test.ts`, "is drawn fresh, carried and brought with both roles, in order":
- `She waited. She waited.` is drawn with two entries.
- It carries with both roles onto ¶2 when a paragraph is inserted above.
- Bring sends both, in order.

Controls: `She waited. Nobody came.` brings both quotes in order, and two `She waited` quotes against a single occurrence are withheld fresh (`handoffNotAdjacent`). On `8b930fb`, Bring refused with `handoffIncomplete`.

### F-03: a familiar phrase is witnessed by a whole occurrence in a quote's span

**Root cause.** The finding is correct. The gate tokenized the clipped quote text on its own (`lightboxTextHoldsTerm(quote.text, phrase)`). A quote edge inside a word therefore made a whole token the term counter never counted, and the chapter-wide count, satisfied elsewhere, let it through.

**Fix.**
- `lightboxTermSpans(text, term)` (`LightboxTermCounts`) finds each whole occurrence of a term in a full paragraph. It uses the term counter's own tokenizer, mapped back to source characters; a test pins it to the counter, token for token.
- `lightboxPhraseHeld(verifier, quotes, phrase)` verifies each quote again in its paragraph, with a span filter that accepts a found span only when it contains a whole occurrence. The verifier's own folding applies, so a normalized match is judged by its source span. When the quoted words stand twice, any span holding an occurrence witnesses the phrase.
- The gate candidate carries `phraseHeld: boolean` in place of `phrase`. Fresh assembly (`LightboxReadingTiles`) and carry (`LightboxStaleReadings`) compute it, and Bring refuses with the new `phraseGone` when none of its quotes holds an occurrence.

**Tests.** Three in `LightboxCraftWitnesses.test.ts` and two in `LightboxTermSpans.test.ts`.
- **Fresh.** The reproduction (`very bright window` cut from `every bright window`, with a real `very` in ¶2) is withheld as `familiarUnquoted`. Controls:
  - quoting the whole `every bright window` is withheld;
  - a genuine `a very bright window` is drawn;
  - with no real `very` anywhere, the phrase is withheld as `familiarUncounted`;
  - when the quoted words stand twice in one paragraph, once inside `every`, the whole occurrence is drawn;
  - `Queen's very own`, quoted against `Queen’s very own`, is drawn with a normalized match.
- **Carry.** A phrase read on the genuine text is withheld once an edit leaves its quote only inside `every`. Control: unchanged text keeps it.
- **Bring.** Brought on the genuine text; refused with `phraseGone` on the clipped text.

On `8b930fb`, all three drew, kept or brought the false witness.

### F-04: standouts are decided from counts, rounded only for display

**Root cause.** The finding is correct, in three steps:
- `lightboxFigureValue` rounded each rate to one decimal.
- `writerAverage` computed the ratio from those rounded rates.
- `standoutOf` compared rounded values and took an average that rounded to zero as "none".

**Fix.**
- **Counts decide.** `lightboxFigureFraction(stat, counts)` gives each figure as a numerator and denominator. `standoutOf` decides the 1.5× threshold by cross-multiplying the counts, and "none" only from a zero count.
- **Rows stay unrounded.** `LightboxNumberRow.value`, `writer.average` and `writer.ratio` are unrounded; sentence length's value is the headline mean. `ratio` is absent only for a zero count. The sentence-length reference stays a whole number of words, because an instance is a whole sentence.
- **Rounding is for display.** `formatLightboxFigure` (one decimal, `<0.1` for a nonzero figure below it) and `formatLightboxRatio` (two decimals, `<0.01`), in `shared/constants/lightbox.ts`, are used by the numbers tile, the ribbon's standout item and the Workshop's Figure point.

**Tests.** Two in `LightboxNumbers.test.ts`.
- **Ordinary threshold.** 3 passive constructions in 4,000 words against 27 in 50,000: value 0.75, average 0.54, ratio 1.389, no standout. Shown as "0.8 per 1,000 words · 1.39× your average of 0.5".
- **Nonzero to zero.** 3 intensifiers in 50,000 words against 14 in 300,000: no standout, shown as "0.1 per 1,000 words · 1.29× your average of <0.1". Controls: a real zero stands out and reads "none in your other chapters"; 20 and 30 instances do not stand out.

On `8b930fb`, both fail at their first assertion, on the rounded figures: 0.8 against 0.5, and an average of 0. These are the review's own counts, which that code marked as standing out, the second as "none".

### N-01: a carried handoff follows its intact pair

**Root cause.** The finding is correct. `carryHandoff` looked for the pair elsewhere only when its first sentence was missing from the paragraph it named, so a surviving copy there left no candidates. The miss was then reported as "no longer in the chapter" whenever the named paragraph had lost a quote.

**Fix.** The candidates are every other paragraph that holds the first sentence's words, found through the verifier's span filter, nearest first. When no intact pair is found, the tile is "gone" (`no-longer-in-chapter`) only if one of its sentences stands nowhere in the chapter. Otherwise it is "not adjacent", with no lost quotes.

**Tests.** Two in `LightboxCraftWitnesses.test.ts`:
- **The reproduction.** Carry follows the pair to ¶2.
- **Both sentences remain, apart.** Withheld as `handoffNotAdjacent.carried`, with no lost quotes.
- **Control: the second sentence is truly gone.** Withheld as `handoffGone.carried`, with ¶1 `no-longer-in-chapter`.

On `8b930fb`, the first was withheld as gone and the second gave the "gone" reason.

### Nonblocking notes

- **Below-dialogue consistency: taken.** The instance filter accepts narration only from a paragraph with no dialogue, the definition the row counts and lights. The group D task line, `52-numbers.md` and worked example 43's request now say so. The "less dialogue" case in `LightboxCraftReadings.test.ts` takes a narration-only paragraph as its witness, with narration from a mixed paragraph (`said the Rabbit`) as its control. On `8b930fb`, the mixed paragraph's narration was accepted.
- **Baseline bound: taken, as a precise summary.** Whole-file sampling is intended, since a chapter is never cut. The bound stays soft by less than one file, and the class doc now says so. `capped` is true whenever a bound limited the reading, including words read past the word bound. New test: three 120,000-word files give 360,000 words and `capped: true`. Control: two 150,000-word files, exactly at the bound with nothing unread, give `capped: false`. On `8b930fb`, the first case reported `capped: false`.
- **Numbers stale warning: taken.** `LightboxReadingFrame` gains `staleFirst`. The numbers tile sets it, so the stale note stands before the first figure, as Stock and Rhythm's notes do. A test in `LightboxAppCraft.test.tsx` pins the order; on `8b930fb`, the note came after the figures.
- **The other bounded limits stand as recorded:** the sentence rule, the cache policy, the manuscript fallback, being verbs and contractions, the word lists, and the group D response-ceiling debt. None changed.

### Contract changes

These are kept small for the branch built on this one.
- **Callback.** `LightboxService.updateReadings`' callback receives `(readings, board)`. A one-argument callback is unaffected.
- **Number rows.** `LightboxNumberRow.value` and `writer.average` and `writer.ratio` are unrounded; format them with `formatLightboxFigure` and `formatLightboxRatio`. `lightboxFigureValue` is replaced by `lightboxFigureFraction` and `lightboxFigureRate`.
- **Gate candidate.** `phrase` is replaced by `phraseHeld`.
- **New exports:**
  - `holdLightboxNumberUsages` and `lightboxStandoutSignature`, in `LightboxNumberInstances`;
  - `lightboxTermSpans` and `lightboxPhraseHeld`, in `LightboxTermCounts`;
  - the gate reason `numberRemeasured`;
  - the Bring refusals `notStandout` and `phraseGone`;
  - `LightboxReadingFrame`'s `staleFirst` prop;
  - the reading harness's `writerBaseline` option.
- **Changed text.** The below-dialogue witness and its task line; worked example 43's request line.

### Verification

| Check | Result |
| --- | --- |
| `npx jest` | 411 suites / 5,712 tests / 59 snapshots (from 407 / 5,693 / 59 at `8b930fb`) |
| `npm run lint` | 0 errors / 1,133 warnings, identical per file and rule to `8b930fb` |
| `npm run typecheck` | Passes |
| `npm run build` (with `verify:bundle`) | Passes; `webview.js` SHA-256 `0ea742557a244fd503a184f13ecb8c6d662b3a7728b7d6f052b631735170c9ae` |
| `git diff --check` | Passes |
| Visual evidence | Rerun from that bundle. `states/chapter.json` was rebuilt; `workshop.json` and `log.txt` are byte-identical. 15 of 30 screenshots changed: ratios shown from unrounded figures, and the numbers tile's stale note before its first figure. No page errors, no horizontal overflow |

No live or billable call was made.
