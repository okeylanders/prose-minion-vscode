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

| Words | Actual tagger | New measure with precomputed tags |
| ---: | ---: | ---: |
| 999 | 21.6 ms | 36.1 ms |
| 4,998 | 7.3 ms | 894.3 ms |
| 9,999 | 14.4 ms | 3,820.9 ms |
| 24,999 | 35.6 ms | 22,864.6 ms |
| 49,998 | 82.6 ms | 100,060.2 ms |

Every result retained the expected number of being verbs. These are measurements in the review's Node/Jest environment, not native VS Code latency measurements or universal hardware predictions. The separately measured tagger and isolated new function establish that the new scanning work itself accounts for the delay. The roughly quadratic growth and synchronous host call are the correctness concern; ordinary short paragraphs need not exhibit the maximum delay.

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
