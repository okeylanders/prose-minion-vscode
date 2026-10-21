# PR Review — Lightbox Craft Steering (Slice 4F)

**Author:** okeylanders · **PR:** [#160](https://github.com/okeylanders/prose-minion-vscode/pull/160) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4f-steering` → `epic/lightbox`
**Reviewed implementation head:** `7bd016fd27626e3a69c01015d20d51898bfad888`
**Exact implementation base / verified merge-base:** `20775cf969f273bde2dc15cb5426b48516113eb3`
**Scope:** 150 files · +13,843 / −237 · 6 commits
**Reviewed:** 2026-10-21 · **Reviewer:** Astra
**Mode:** independent source/spec review; deterministic measurement, codec, gates, carry, Bring, digest and lifecycle probes; exact production build/DOM and host-state regeneration; supplied PNG inspection; baseline/head gate comparison

## Summary

**Verdict: Request changes.** Two introduced P2 defects remain: the new synchronous measurement repeatedly scans paragraph-wide arrays and becomes prohibitively slow on a large valid paragraph; and example anchoring can expand an accepted `before` beyond its bound, causing Bring to silently cut the suggested `after`. A small contradictory numbers empty-state is a nonblocking P3.

The host/model boundary is otherwise well separated in the exercised paths. Shared detectors agree with counts and accepted instance quotes; G participates in the chapter phase before F; stale carry, reread ownership, cancellation and disabled-lens controls pass; the Opinion digest includes measured construction evidence but excludes the nudge and illustrative rewrite. Full head gates pass with no lint regression.

**Integration is a separate, still-open gate.** The implementation reviewed here does not contain the later #158 floor change or the promised #159/sentence-rule integration. At 17:54 UTC, GitHub still reported `mergeable=false`, `mergeable_state=dirty`; the live base branch was already `e8389bf32574ef5888bd1ad3c1d0a96fc8b807bb`, although PR metadata still named `20775cf`. This report neither resolves those conflicts nor clears an unreviewed combined tree. Writer/native/real-chapter acceptance and Slice 5 readiness are not inferred from author-authored checkpoint claims.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | Paragraph-wide rescans make automatic steering measurement quadratic | **Open** |
| F-02 | Medium / P2 | Reanchored example bypasses its bounds and is silently cut by Bring | **Open** |
| N-01 | Low / P3 · nonblocking | Numbers empty-state denies the steering standout displayed above it | **Open** |

## F-01 — Index the measured instances instead of rescanning from the start

**Primary location:** [`LightboxSteeringMeasure.ts:245–247`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxSteeringMeasure.ts#L245-L247), also the per-instance span scans at [`163–169`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxSteeringMeasure.ts#L163-L169).

For every detected instance, `classify()` runs `tokens.findIndex()` from the beginning of its paragraph. The same loop also scans `runs` and dialogue spans from the start; `shortRunSpans()` returns an entry for each qualifying sentence, not one interval for a contiguous run. With many instances in one paragraph, this is quadratic work in the number of tokens/sentences, not just the cost of tagging the text.

The new measurement is called synchronously by [`buildLightboxMeasuredSet`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxMeasures.ts#L278-L279) for every board, before any model press and regardless of whether the steering lens is enabled. There is no yield or cancellation point inside that call. A large paragraph can therefore block the extension host while opening or rereading a source; switching G off does not avoid it.

### Independent witness and scaling

Use one paragraph formed by repeating the synthetic sentence `It was cold.` with ordinary spaces. The largest witness is **49,998 words**, below `PROMPT_BUDGETS.lightbox.sourceWords = 50_000`. A book-sized advisory above 12,000 words does not refuse that source. No malformed frame, provider, private manuscript, or oversized source is involved.

The actual `tagTextTokens(source)` was timed separately. Then the production function was called with those exact precomputed tokens through its supported tagger seam:

```ts
const source = Array.from({ length: Math.floor(words / 3) }, () => 'It was cold.').join(' ');
const tokens = tagTextTokens(source);
measureLightboxSteering({ text: source, paragraphs: [source], tag: () => tokens });
```

| Words | Jest: actual tagger | Jest: measure with precomputed tags | Direct Node: measure with precomputed tags |
| ---: | ---: | ---: | ---: |
| 999 | 21.6 ms | 36.1 ms | 7.4 ms |
| 4,998 | 7.3 ms | 894.3 ms | 62.5 ms |
| 9,999 | 14.4 ms | 3,820.9 ms | 250.9 ms |
| 24,999 | 35.6 ms | 22,864.6 ms | 1,182.3 ms |
| 49,998 | 82.6 ms | 100,060.2 ms | 4,845.5 ms |

**Timing qualification, independently extended at 18:02 UTC:** the 100-second figure is the Jest/VM stress-harness time, **not native VS Code latency**. A second control transpiled the unchanged production TypeScript to ES2020/CommonJS and ran it directly in Node, outside Jest. Its largest measurement was **4.846 seconds**, excluding **107.8 ms** for actual tagging. The same 49,998 words arranged in **1,667 paragraphs of up to 30 words** took **37.1 ms** for measurement, excluding **221.6 ms** tagging. Both shapes retained exactly **16,666 being-verb instances**. This isolates paragraph-sensitive scanning rather than general input size or tagging alone. These are single-run environment-specific timings, not a calibrated benchmark or native VS Code measurement.

Every scaling result retained the expected count. The direct-Node control corroborates the quadratic growth without Jest's substantial overhead: the new synchronous measure alone can block for several seconds on a valid large paragraph, while ordinary short paragraphs avoid that case. Disabling G does not bypass it: the service unconditionally builds this measured set and the measurement accepts no lens-enable option. The independent disabled-G handler/digest probe separately confirms measured steering evidence remains present while no G provider call is sent.

**Requested correction:** locate token offsets once, or use an ordered cursor/index rather than a fresh `findIndex` for each match. Join sorted instances to dialogue/run intervals without restarting every scan; coalesce contiguous short-run sentences where appropriate. Add deterministic count-equivalence and growth/work-bound regressions for large single paragraphs as well as normal paragraph shapes, including disabled steering. Preserve the current detector semantics rather than dropping instances to obtain a faster result.

## F-02 — Revalidate the actual anchored example before rendering or transfer

**Primary location:** [`LightboxSteeringTiles.ts:130–135`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxSteeringTiles.ts#L130-L135), with the initial checks in [`LightboxSteeringCodec.ts:188–200`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxSteeringCodec.ts#L188-L200) and the final point slicing in [`LightboxTileHandoff.ts:292–295`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/infrastructure/lightbox/LightboxTileHandoff.ts#L292-L295).

The codec validates the model's `before` at 56 characters/eight words. The anchor then replaces it with `verdict.text`, which is the chapter's exact whitespace/typography, without rechecking those bounds. Normalized quote verification can make that result longer. Fresh assembly, carried readings and Bring all use the same unchecked replacement.

The Slice 4F plan explicitly reduced both example fields to 56 characters so that the complete `before → after` fits one 120-character Workshop point. That guarantee no longer holds after anchoring. Bring applies the generic `slice(0, 120)` and reports success, silently changing the illustrative rewrite rather than withholding it with a reason.

### Independent witness and rejecting/control paths

A single paragraph with ordinary indented soft line breaks is sufficient. The following strings use `\n` for the two actual line breaks:

```text
Chapter: She was waiting beside\n    the window\n    contemplating daylight
before:  She was waiting beside the window contemplating daylight
after:   Daylight brightened motionless drapes beside floorboards
```

- The model's `before` is **56 characters/eight words**, `after` is **56 characters**, and the quoted span contains the actual `was` instance. The valid frame decodes and assembles without withholding.
- Anchoring produces the chapter's **64-character** `before`. The rebuilt production UI shows that expanded `before` and the complete `after`.
- `prepareLightboxTileHandoff()` returns `ok: true`, but its “One way it could go” point is exactly 120 characters and ends **`Daylight brightened motionless drapes beside floorboa`**. The last three letters of `floorboards` have been cut without an omission marker or host reason.
- With the identical chapter written on one line using single spaces, the complete 115-character pair transfers unchanged. The problem is the newly expanded anchor, not the model exceeding its wire limits.
- Carrying the valid one-line note onto the soft-wrapped source also retains the expanded 64-character example. The fresh and carried paths need the same correction.

A related witness reaches the same missing post-anchor validation boundary: for chapter `She was—quiet beside the window.`, model `before: "was-quiet"` and `after: "was—quiet"` pass the initial comparison, then anchoring produces **identical** `before` and `after` values. The nominal rewrite becomes a no-op, contrary to the unchanged-example rule.

**Requested correction:** after canonical anchoring, enforce the example's complete contract again, including length/word bounds, actual difference and full transfer fit. Withhold only the invalid example with a truthful host reason, retaining the valid note/nudge. Do not silently clip either half or widen the Workshop contract by accident. Add fresh, carried and Bring controls for normalized whitespace/dashes and exact boundary values.

## N-01 — Scope the numbers empty-state to the figures that remain in D

**Location:** [`LightboxNumbers.tsx:78–82`](https://github.com/okeylanders/prose-minion-vscode/blob/7bd016fd27626e3a69c01015d20d51898bfad888/packages/core/src/presentation/webview/components/lightbox/LightboxNumbers.tsx#L78-L82).

The condition now checks only `LIGHTBOX_NUMBERS_READ_STATS`, but its false text still says **“Nothing in the numbers stands out, so there was nothing to read.”** When only an intensifier/adverb/being-verbs row stands out, that same card shows its standout and “Read under Craft steering, below,” then denies that anything stands out.

An independent production-service fixture repeated `She was very quiet. He was very calm.` 50 times (400 words) and used a 4,000-word synthetic baseline with all matching rates except half the intensifier rate. Only intensifiers stood out. A valid empty D response was accepted, and the rebuilt production DOM displayed both contradictory messages. This is the intended D/G ownership split, not a malformed response.

**Suggested correction:** distinguish “none of the figures read here stands out” from “no figure stands out,” and point to Craft steering when it owns the standout. Keep the honest “reading said nothing” state for omitted D-owned standouts.

## Architecture and boundary review

The review followed `AGENTS.md`, its central setup references, the [Slice 4F plan and implementation notes](../../.todo/epics/epic-lightbox-2026-10-19/slice-4f-craft-steering.md), the [Lightbox ADR](../adr/2026-10-19-lightbox-inspiration-board.md), especially D7's second addendum, the typed messages/budgets and earlier house-format reports.

- **Measurement and quote agreement:** a mixed-typography synthetic fixture produced 11 being verbs, nine -ly words and five intensifiers. All 25 detector instances agreed with accepted quote spans and the corresponding counts. Narration/dialogue and construction partitions, short runs, punctuation, contractions and shared detector exclusions were checked. Tagger failure does not invent construction counts. The documented heuristic limitations are not promoted to linguistic certainty.
- **Malformed output and language fences:** strict shapes, extra/unknown fields, bad stances, invalid evidence and isolated invalid examples remain bounded. Eighty-seven targeted phrasing checks and ten invalid-example cases exercised order language, whole-word versus substring matching, quote marks, figures, earned notes, long/unchanged examples and isolated withholding. Passing these finite English rules does not prove that every imperative or unsupported semantic claim is recognized.
- **D/G ownership:** the numbers rows remain measured; D's codec/fresh/carry gates reject the three figures now owned by G. G's whole-figure reads do not depend on a standout threshold. The P3 above is presentation copy left behind by that otherwise coherent split.
- **Digest authority:** host-measured totals, construction partitions and short-run counts enter the digest as measured evidence. A note contributes its why/stance/checked quote, not its nudge or illustrative `after`. Sentinel controls confirmed that those excluded fields cannot supply Opinion evidence. Opaque ID digits are excluded; host numeric counts remain available. Measured steering items remain when G is disabled, without manufacturing model readings.
- **Ownership and sequencing:** eight held-promise tests exercised configured three-call concurrency, G after queued A–E slots, F only after G's host settlement, cancellation exactly at that boundary, Stop before queued G, wrong-token cancellation, late old G after replacement, retained-board switching, changed-source relocation, and cited steering pending/cancel/success standing. Default concurrency remains seven, so all six chapter calls can be admitted together before F. Disabled G is never sent.
- **Estimate parity:** an additional independent handler/runner probe compared G's priced input to the actual stub-engine system/user payload: 1,053 estimated input tokens, 1,640 expected output tokens and an 8,000-token reserve. With synthetic catalog prices, its $0.027759 exactly accounts for the difference between all-lens and G-disabled totals; G is also absent from disabled reread estimates. This verifies arithmetic and payload identity, not live token usage or prices.
- **Carry and Bring:** a moved paragraph relocates a valid note/example; changed source rejects the old in-flight result; a current host resolves Bring from IDs and checks the instance again. The exercised ordinary cases pass. F-02 concerns the extra contract checks missing after a successful canonical anchor, not a bypass of source-quote checking.

A conservative optional-example limitation also remains: `before: "was"`, `"are"`, `"am"` or `"be"` is withheld by the shared verifier's four-letter minimum even when it is a whole, in-span instance. The existing reason inaccurately implies that it is not such a span. This is disclosed here as a low-priority boundary/diagnostic issue, not an additional release blocker or evidence that the quote verifier should be weakened globally.

## Independent verification

All probes used synthetic/public-domain fixtures and stub providers. A passing defect-witness test means the bad behavior was reproduced, not approved. No tracked implementation/test/lockfile was edited. Probe files and regenerated evidence stayed outside the report-only publication.

| Check | Independent result |
| --- | --- |
| Head full Jest | **439 suites / 6,047 tests / 59 snapshots passed**, 314.216 s |
| Reusable baseline full Jest | **430 suites / 5,916 tests / 59 snapshots passed** in the completed independent #157 correction review; implementation equivalence verified below |
| Head typecheck | Passed all package stages |
| Head lint and baseline parity | **0 errors / 1,133 warnings**; normalized per-file/rule/severity/message multiset identical |
| Head production build and `verify:bundle` | Passed; same three known webpack size/performance warnings |
| Production bundle SHA-256 | **`6c2963092fae2bf4c6565a2ade0aa01eb08a934a3acde099ab85979642f73468`**, exactly matching supplied evidence |
| Independent core, lifecycle, performance and host-state regeneration probes | **17 tests / four suites passed**, 136.717 s; includes the isolated five-size performance witness |
| Direct-Node performance/shape controls | Unchanged production TypeScript, no Jest: 49,998-word single paragraph **4.846 s** vs **37.1 ms** in 1,667 short paragraphs; same 16,666 instances, tagging excluded |
| Independent exact-payload estimate/disabled-price control | **1/1 passed**, 4.359 s |
| Canonical example and D/G empty-state probes | **2/2 passed**, 4.156 s |
| Supplied host-state regeneration | `chapter.json`, `workshop.json` and `log.txt` **byte-identical** to committed evidence |
| Rebuilt production-bundle DOM | **34 assertions passed**: measurement/read separation, earns behavior, examples not quotes, hover/pin/inspector, IDs-only Bring, bound response, withholding, stale recount, F-02 and N-01 witnesses; no runtime errors/provider runs in these cases |
| `git diff --check 20775cf..7bd016f` | Passed |
| Implementation-head push CI | [Run 39643871716](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39643871716) completed successfully |
| Implementation-head PR CI | [Run 39644040462](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39644040462) completed successfully |

The previous independently tested implementation `889e69f43607a55b8a421b2a4adef6fe9b59dea7` and this PR's exact base `20775cf` have **no differences in packages, apps, scripts, package/lock files or configuration files**. The completed baseline logs were inspected and reused on that byte-equivalence basis; no new baseline run is claimed. Head gates were run independently here, on Node `v24.19.0` / npm `11.9.0`, using disk-backed dependencies/cache and `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB --cacheDirectory=<disk-backed-review-cache>`.

The initial small empty-state fixture fell below the existing 300-word/2,000-word comparison thresholds and was corrected before the passing witness. An initial DOM locator computed accessible names for every board button and was interrupted for probe overhead; the final check used direct DOM selectors/text. These are harness corrections, not product failures or native accessibility measurements.

## Visual evidence and acceptance limits

Eight actual supplied PNGs were inspected: measured 1440px, being-verbs 1440px, inspector 1000px, bound 1440px, withheld-examples 500px and 1000px, stale-adverbs 500px, and Workshop composer 500px. They show the intended measured/read separation, examples as illustrations, per-note withholding, inspector/Bring and recounted stale adverbs. The known narrow Workshop composer clipping is inherited debt, not a new G finding. The other supplied PNGs were not independently visually cleared.

The matching rebuilt bundle and byte-identical regenerated host states tie these artifacts to the reviewed implementation. The real service/handler/runner/codec/prompt/Workshop path was exercised behind controlled files/baseline/provider fixtures. Supplied `facts.json` and `errors.txt` were read as author evidence; they were not recreated by a fresh browser layout run. JSDOM establishes the stated DOM/protocol behavior, **not CSS geometry, hit-testing, native VS Code IPC, native keyboard behavior, live-model quality, real pricing accuracy or writer acceptance**. No denied browser route or unauthorized user computer was retried. No paid/live model call or private manuscript was processed.

The documented construction heuristics, underscore-emphasis detector exclusion, conservative English phrasing rules, calibrated-output/cost limitations and existing module-size debt remain visible. The new findings above are not substitutes for the promised integrated-head evidence or the separate native/writer checkpoint.

## Next step

Correct F-01 and F-02 with regression controls; fix N-01's scoped wording when convenient. Then integrate the intended #158/#159/sentence-rule changes, preserving any unresolved #159 inspector-navigation finding until its actual correction is reviewed. Regenerate the examples/evidence and rerun the combined gates on the **actual integrated head**, including short-run sentence boundaries, inspector navigation, G→F ordering/digest authority and carried/Bring examples. A clean result on this pre-integration tree does not clear conflicts or later code.

Publication is limited to **this report only**. No implementation edit, GitHub comment/formal review, merge, deployment or extension publication accompanies it. Post-publication CI is checked against the exact report commit separately; the successful implementation-head runs above are not substituted for it.

## Author response (2026-10-21)

**F-01: fixed. F-02: fixed. N-01: fixed.** The three fixes share one
commit, each with its own failing-before tests. `epic/lightbox` at
`1fe931a` is merged in: PR #158's VS Code 1.82 floor and PR #159's Slice
4E. The evidence was re-rendered from the merged head's bundle. The docs
commit on top records this response, the slice notes, the epic progress,
the agents guide and the tech-debt index. Nothing above this section was
edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| F-01 | Medium / P2 | **Fixed** | The measure reads the tagger's tokens once and finds each instance's token by binary search. Each token's neighbour past markup, adverbs or fillers comes from one sweep per rule. Short runs are one interval per run (`shortRunIntervals`), and dialogue and run membership is a binary search over starts, with the furthest end reached so far. Every answer is the one the scan gave, and no instance is dropped | `LightboxSteeringMeasureScale.test.ts` (6): token reads bounded and linear, long filler and adverb runs, 49,998 words in one paragraph under a coarse 3 s bound, and counts equal across paragraph shapes with literal values. `LightboxSteeringRun.test.ts`: a 49,998-word board built with steering off, under a coarse 15 s bound, with no G call. `LightboxSteeringMeasure.test.ts`: run intervals with literal offsets | `1def703` |
| F-02 | Medium / P2 | **Fixed** | The pair as the chapter has it is held to the example's contract again: both parts within their words and characters, a change between them, and the whole pair within one Workshop point. This holds fresh, on carry and at Bring. "No change" uses the quote verifier's own fold, so `was-quiet` against `was—quiet` is caught at decoding and again after anchoring. A failing pair withholds only the example, with a host reason; the note and nudge stand. Bring never clips: it carries the pair whole, or an "Example withheld" point that says why | `LightboxSteeringExampleAnchor.test.ts` (8): soft wrap, a doubled space one character over, a spaced dash over the word bound, the dash no-op at decoding and at the anchor, carried, and Bring's exact 115-character pair and its withheld point. `LightboxSteeringHandoff.test.ts`: the unanchored case now names its reason | `1def703` |
| N-01 | Low / P3 · nonblocking | **Fixed** | When only a figure craft steering reads stands out, the card says "None of the figures this lens reads (sentence length, dialogue, passive voice) stands out, so it had nothing to read. Craft steering reads the figure that does, below." The other two messages are unchanged | `LightboxAppSteering.test.tsx`: your intensifier-only case, as an adverb-only board with an empty numbers reading | `1def703` |
| Integration | Merge | **Merged and verified** | `epic/lightbox` at `1fe931a` (PRs #158, #159). Conflicts are listed below; both sides were kept in each | Full gates below | `d9db6e5` |
| Short example forms | Low · disclosed | **Tracked** | You noted that a `before` of `was`, `are`, `am` or `be` alone is withheld by the verifier's four-letter minimum, and the reason says it is not a whole-word span. This is now tech debt; the verifier is unchanged | — | docs |

### How each new test was checked against `7bd016f`

The implementation at `2f3327a` is byte-identical to `7bd016f`. Every new
test ran there first.
- **F-01, `LightboxSteeringMeasureScale` (6 tests).**
  - **Failed (4):**
    - 1,000 sentences: 2,006,000 token reads against a bound of 64,000.
    - Growth: 8,012,000 reads for ten times the paragraph, against a bound of 974,400.
    - 1,500 fillers: 3,387,747 reads against 24,032.
    - The 49,998-word paragraph: 81,576 ms against 3,000 ms.
  - **Passed (2):** the count-equivalence tests, with the same literal counts before and after.
  - **The steering-off board test** failed at 86,301 ms against 15,000 ms. I ran it with `7bd016f`'s measure put back in place, then restored the fix.
- **F-02, `LightboxSteeringExampleAnchor` (8 tests).**
  - **Failed (6):** the soft wrap, the doubled space, the spaced dash, the dash no-op, the carried case, and Bring. Bring returned your witness: "… beside floorboa".
  - **Passed (2):** the exact-bounds controls, fresh and at Bring.
- **N-01.** The new test failed with both messages on the card, as you found.

With the fixes, all pass:
- The 1,000-sentence paragraph reads 4,000 token slots, one per token.
- The 49,998-word paragraph's measure takes about 0.2 s under Jest.
- Its whole board builds in under a second (0.7 s, against about 80 s before).

### F-01: what was quadratic, and what is now

There were three per-instance scans from the paragraph's start, plus one
more found while fixing them:
- `tokens.findIndex` for the instance's token;
- `dialogue.some` and `runs.some` over every span;
- `step()` walking past fillers or adverbs to the next head. A run of
  fillers ("very very … big") or of adverbs made every instance walk the
  rest of the run. Your report didn't name this one; the filler and adverb
  tests pin it.

The fix:
- **Token lookup.** The tagger's placed tokens are in-order, non-overlapping slices (`tagTextTokens` scans forward). So the token holding an offset is the last placed token starting at or before it, if it reaches the offset. A binary search finds it.
- **Neighbours.** Each neighbour rule (next, previous, next past adverbs, previous past adverbs, next past fillers) is one backward or forward sweep, done once per paragraph.
- **Dialogue and runs.** "Some interval holds the instance" is "the furthest end among intervals starting at or before it reaches it". That is exact even for overlapping intervals.

A run is coalesced to one interval. Between two sentences of a run lies
only what the sentence rule set aside (spaces, end marks, a span with no
letter), where no instance starts, so the counts do not move.

The measure still runs with every board, lens on or off. The digest and
the tile both show its counts when G is off, and it is now cheap.

### F-02: the anchored pair keeps the contract

`anchorLightboxSteeringExample` now returns either the anchored example
or the fault (`unanchored`, `long`, `same`, `fit`). It applies
`lightboxSteeringExamplePairFault`, the codec's own contract, to the
chapter's pair.
- **The fit check** asks that `lightboxSteeringExampleText(pair)` fits one Workshop point. Today the two 56-character bounds already imply it (115 ≤ 120). It is checked anyway, so a budget change can never bring clipping back.
- **Fresh and carried tiles** take the host reason for the fault.
- **Bring** carries either the whole pair, or `Example withheld` with a short reason under 120 characters.

The Workshop point contract is unchanged.

### Integration: conflicts and how each was kept

- **`styleFlags`.** Both slices exported `STYLE_FLAG_WEAK_VERBS`, with the same list. I kept 4E's `findWeakVerbs` for the tool's flag, and the header names both uses.
- **`wordFrequency`.** 4F's `tagTextTokens` stream now feeds `tagPartsOfSpeech`, which carries 4E's token `length`.
- **`LightboxMeasures`, the messages barrel, `lightboxItems`.** 4E's hapax, style-flag instances, passages and term refs sit beside 4F's steering measure, contracts and item ref. `lightboxItems.ts` is 436 lines after 4E's term module.
- **Agents guide, epic README.**
  - 4E's tree entry, decisions 17–19, slice row and progress notes sit beside 4F's.
  - The Chromium 114 ribbon rule follows the craft-steering rules.
  - The test inventory is the merged count.
- **`LightboxAppPassages` (4E)** now mocks the steering stylesheet, as every other Lightbox root test does.

`steering.css` and the measured-ramp tokens pass the Chromium 114 guard,
with nothing added to `KNOWN`. I did not wire 4E's sentence well to
steering's instances. That is recorded as a follow-up.

### Verification of the merged head

All gates ran at the merge `d9db6e5`, after `npm ci` into the worktree's
own `node_modules`.

| Check | Result |
| --- | --- |
| Full Jest | **451 suites / 6,167 tests / 59 snapshots passed**: `epic/lightbox` at `1fe931a` records 440 / 6,019 / 59, your review head ran 439 / 6,047 / 59 against a shared base of 430 / 5,916 / 59, and this response adds 2 suites and 17 tests. 4E's `LightboxCountAgreement` and passage suites pass |
| Lint | **0 errors / 1,133 warnings**, identical per file and rule to `20775cf` |
| Typecheck | Passed all package stages |
| Build and `verify:bundle` | Passed; the same three webpack size warnings |
| Production bundle SHA-256 | `24658aba3f52180b878e3e08bb19cb03bf6ee07e1c432bdb11d4b9c590a71b59` |
| `git diff --check origin/epic/lightbox HEAD` | Clean (the incoming PR #159 report's Markdown line breaks are its own) |
| Evidence | Re-rendered from that bundle. `facts.json` is identical entry for entry, and `errors.txt` is empty. `states/chapter.json` changed only by 4E's board fields (the hapax list, style-flag ids and paragraphs) |

### Not done here

- **The sentence-rule fix (PR #161)** is not merged. When it lands in `epic/lightbox`, I'll merge it and regenerate the worked examples and evidence whose sentence figures move.
- **Writer, native and live-provider acceptance** remain open, as you said.

## Independent correction re-review (2026-10-21)

**Reviewed correction/integration head:** `27b646a65610065fc2723c89de4f40a5a41e81c9`
**Exact base / verified merge-base:** `1fe931ad5f929586865acab4332ac271d9e2efc3`
**Fix:** `1def703f76ee6d7e00d64184cbee5c06b9ad96e2` · **integration merge:** `d9db6e5bf96ca73d5a99b4454c37210f576dc7b2`
**Reviewer:** Astra · **Mode:** correction-focused source review, old/new differential controls, fresh integrated gates, actual-host evidence regeneration and rebuilt production-bundle DOM checks

**Updated code-review disposition: F-01, F-02 and N-01 addressed; no remaining finding in the reviewed correction.** This supersedes the original open dispositions, not the historical evidence. The original report and entire author response above are preserved byte-for-byte. The #158/#159 integration is now actually present and reviewed. **The future combined tree with #161 remains an explicit verification gate**, not inferred clearance from this result. This is not a formal GitHub approval, merge instruction, native/live-provider acceptance or Slice 5 sign-off.

### Resolution ledger

| ID | Independent disposition | Evidence |
| --- | --- | --- |
| F-01 | **Addressed** | Token/span lookup no longer restarts a paragraph scan; neighbour sweeps cover the additional filler/adverb path. Old/new measured outputs agree in 984 comparisons, and independent property-read instrumentation confirms bounded growth even after the token-array copy |
| F-02 | **Addressed** | Exact soft-wrap witness is withheld alone fresh and on carry; Bring rechecks the canonical pair and sends a host reason instead of a clipped rewrite. The full 115-character exact-bounds control remains intact; normalized no-op is withheld |
| N-01 | **Addressed** | The original intensifier-only fixture now shows scoped numbers wording and the Craft steering pointer, without the contradictory no-standout statement |
| #158/#159 integration | **Verified at this head** | Actual merge ancestry, conflict-resolution review, inherited fixes preserved, fresh combined gates and #159 navigation/count probes |
| #161 integration | **Not in this tree; still pending** | The reviewed sentence-rule head `6cbd27b` is not an ancestor. Whichever PR merges second must integrate the other and regenerate/reverify the affected requests/evidence |

### F-01: the work is bounded without changing the measured answer

The correction indexes placed token offsets and searches them rather than using per-instance `findIndex`. Precomputed forward/backward neighbours avoid repeatedly walking a filler/adverb run. Dialogue spans use sorted starts and prefix maximum ends; short sentences are coalesced into run intervals with the same membership semantics. The tagger's forward placement guarantees the ordered, non-overlapping offsets the token lookup relies on. Work now comprises linear preprocessing and logarithmic searches, rather than quadratic rescanning; no count ceiling or sampling shortcut was added.

An independent differential probe compared the original and corrected production measures on **328 fixtures**, including 320 deterministic seeded combinations and eight explicit punctuation/typography/dialogue/markup cases. Each ran with real wink tokens, selectively unplaced tokens, and a throwing tagger: **984 complete measured-output comparisons passed**. This checks counts, constructions, narration/dialogue, weak-verb totals, short runs and paragraph membership, not just a selected headline total.

A separate probe instrumented **token property reads**, so copying the token array could not hide repeated accesses. For 100 versus 1,000 repetitions:

| Shape | Corrected property reads at 100 | Corrected at 1,000 | Original at 100 |
| --- | ---: | ---: | ---: |
| `It was cold.` | 3,000 | 30,000 | 80,400 |
| `very` filler run | 700 | 7,000 | 30,298 |
| `slowly` adverb run | 1,195 | 11,995 | 30,793 |

Counts agree in the old/new controls. The repository's new large-paragraph, long-neighbour-run and steering-disabled full-board tests also pass in the fresh full suite.

**Timing context before the figures:** these controls run the unchanged corrected TypeScript transpiled to ES2020/CommonJS in **direct Node 24.19.0, outside Jest**, in the cloud review environment. They are single-run observations, **not native VS Code/Chromium latency or a statistical benchmark**. The same 49,998-word single-paragraph fixture now spends **60.5 ms in the steering measure**, excluding **121.6 ms tagging**, retaining all **16,666 instances**. The original direct-Node observation above was 4.846 seconds for that measure. The corrected 1,667-short-paragraph control takes **108.3 ms measurement**, excluding 283.3 ms tagging, with the same count. The independent operation-count/differential tests, rather than a hardware-specific speed ratio, establish the correction. No old 100-second Jest stress run was repeated.

### F-02 and N-01: original witnesses now reject the fault, not the note

The same original 56-character `before`, 56-character `after` and 64-character soft-wrapped chapter span were replayed through production decoding, assembly, carry and transfer. The fresh and carried note retain the why, nudge and correctly checked source quote, but expose an explicit anchored-length reason instead of the example. Passing the originally valid one-line note to Bring against the soft-wrapped source produces **“Example withheld”**, never the prior `…floorboa` truncation. Every transferred point remains within the unchanged 120-character contract. The one-line control still carries the exact complete **115-character** pair.

The original dash-normalized no-change witness is withheld, and the broader ten-case malformed-example matrix still isolates the example rather than destroying a valid note. The existing 87 phrasing checks, detector/count agreement and digest exclusion controls still pass. The truthful new length reason applies only to the canonical expansion; the separately documented short one-word-example limitation is not claimed fixed.

The actual intensifier-only comparison fixture again uses a 400-word synthetic source and a 4,000-word baseline. D correctly returns an empty reading while intensifiers stand out. The rebuilt UI now says none of the figures **this lens reads** stands out and points to Craft steering; the original contradictory global denial is absent.

### Actual integration and remaining merge-order gate

This is a real merge, not a conclusion drawn from files appearing or disappearing at an endpoint. `d9db6e5` has parents `1def703` and `1fe931a`; the exact merge-base with current `epic/lightbox` is `1fe931a`. Ancestors include #158's floor merge `e8389bf`, #159's navigation fix `86d269ad`, passage-scaling fix `31a4550d`, and independent correction report `95c933a`.

The conflict resolutions retain both slices: `findWeakVerbs` remains the flag's shared detector; POS occurrences carry both the token stream's offsets and 4E's lengths; hapax/flag/passages/term refs coexist with steering; the message barrel exports both contracts. The floor manifest/lockfile and CSS guard, corrected passage cutter and pending-request hook are unchanged from `1fe931a`. The fresh combined suite exercises those inherited corrections alongside G; no CSS-floor allowance was added for steering.

Independent #159 controls were replayed against the combined implementation: cached pin return, cached board return, late abandoned response, a new unanswered pin, and unpin/reopen; count/instance agreement across all listed word/POS/phrase/hapax/flag entries on six edge fixtures; malformed requests and source bounds; and actual-host export for rebuilt-bundle interaction checks. These pass without reverting either integration side. G lifecycle, cancellation, disabled-lens, digest and exact-payload estimate controls also pass unchanged.

The live PR now explicitly permits #160 or #161 to merge first, with the second integrating the first and regenerating the sentence-dependent requests/evidence. **#161 is not merged here.** This review clears neither that future combined implementation nor its changed short-run/sentence evidence. Recheck it at the actual integrated SHA; the pending gate is not misrepresented as a new #160 correction defect. Steering-instance sentence wells remain separately disclosed low-priority debt, not silently implemented by this merge.

### Fresh verification and evidence

| Check | Independent result at `27b646a` |
| --- | --- |
| Full repository Jest | **451 suites / 6,167 tests / 59 snapshots passed**, 326.458 s |
| Typecheck | Passed all package stages |
| Lint | **0 errors / 1,133 warnings**; exact normalized file/rule/severity/message parity with the independent #159 baseline |
| Production build and `verify:bundle` | Passed; same three known webpack size/performance warnings |
| External correction/integration probes | **30 tests / nine suites passed**, 10.830 s; includes the 984 differential comparisons above |
| Host-state regeneration | `chapter.json`, `workshop.json` and `log.txt` **byte-identical** to the revised committed evidence |
| Rebuilt production DOM | **73 assertions passed**: 36 steering/correction checks plus 37 passage/navigation checks, with actual-host replies and no provider execution/runtime errors |
| `git diff --check 1fe931a..27b646a` | Passed |

The independently rebuilt production bundle SHA-256 is **`24658aba3f52180b878e3e08bb19cb03bf6ee07e1c432bdb11d4b9c590a71b59`**, exactly matching the revised evidence. Both implementation-head CI events at `27b646a` also succeeded: [push 39654409932](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39654409932) and [pull request 39654420066](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39654420066).

Head gates above are fresh, not reused from the two formerly separate PRs. Baseline lint/gate context from the independent #159 correction run at `2e62aa7` is reused only after verifying no package/app/script/dependency/configuration differences between that implementation and merge base `1fe931a`. Runtime is Node `v24.19.0` / npm `11.9.0`; tests use one worker, a 2 GiB heap and a disk-backed cache. External probes do not inflate the repository suite totals.

Visually inspected four newly supplied images from the merged evidence: **being-verbs 500px, withheld-examples 500px, stale-adverbs 500px and inspector 1000px**. The notes/examples, per-example withholding, stale recount and inspector remain legible in the inspected regions. Author `facts.json` is exactly equal to the original evidence and `errors.txt` is empty; those remain author browser facts, not new reviewer geometry measurements. The newly rebuilt bundle and regenerated host output tie the independent DOM checks to this head. No native VS Code/Chromium 114 run, screen-reader or actual keyboard test, private manuscript, paid/live model call or authenticated writer acceptance is claimed.

### Disposition and next check

The two P2 defects and P3 copy issue are closed for the reviewed correction. No new implementation defect was found in the exercised correction/integration paths. Preserve the pending #161 combined-head regeneration/reverification, the explicit native/live writer checkpoint and the pre-Slice-5 data-basis work. Only this report is updated; the existing report and author response are retained, and no implementation change, formal review/comment, merge or publication action accompanies it. Exact report-head push and PR CI are checked separately after publication.
