# PR Review — Lightbox Story Lenses (Slice 4C)

**Author:** okeylanders · **PR:** [#156](https://github.com/okeylanders/prose-minion-vscode/pull/156) (open, unmerged at review)
**Branches:** `epic/lightbox-slice-4c-story` → `epic/lightbox` (retargeted after PR #155 merged; initially stacked on `epic/lightbox-slice-4b-craft`)
**Reviewed implementation head:** `797e1663ce534207d4086b032d8fd4caef55c14e`
**Current target base:** `d6069e821eb1bcb8ca151768aa2c0808d701eb1c` (PR #155 merge)
**Tested implementation base / verified merge-base:** `16e85b11908978a18c48aed6bd6aa462ecff9b17` (PR #155's corrected head; current base differs only by its review report)
**Scope:** 138 files · +6,837 / −341 · 4 commits
**Reviewed:** 2026-10-21 · **Reviewer:** Astra
**Mode:** independent source/spec review; production codec/service/carry/Bring counterexamples and negative controls; controlled lifecycle and production DOM probes; supplied visual evidence inspection; exact-base/head gates

## Summary

**Verdict: Request changes.** Group E's four lenses and six tile kinds are connected through the intended host-owned gates, explicit reading lifecycle and bounded Workshop transfer. The coupled template/summary refresh and all-or-nothing movement/engagement rules survive the exercised failures, cancellations and partial reads. Three new deterministic defects remain:

1. A thread planted and resolved in the same paragraph can count as open in a compressed ribbon column, even though it is open in no paragraph.
2. A blank line in valid leading YAML front matter causes metadata to become measured chapter structure.
3. Story lanes and the main ribbon do not share their horizontal paragraph grid. The mismatch grows when stale labels appear, misplacing pressure bars and movement/section boundaries under the chapter.

A separate nonblocking tally defect underreports fresh artifact steps withheld for order. These are reproducible host/UI issues, not judgements of live model quality. No implementation edit is made by this review.

The PR's checkpoint record and product decisions 10–16 remain **author-authored claims**. No authenticated writer acceptance was independently established. This report is not native VS Code/live-provider acceptance, Slice 5 readiness, or approval to freeze the saved-board format.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| F-01 | Medium / P2 | An empty pressure interval becomes nonzero inside a multi-paragraph ribbon column | **Open** |
| F-02 | Medium / P2 | Blank-line YAML front matter produces false measured Sections | **Open** |
| F-03 | Medium / P2 | Story ribbon lanes use a different horizontal paragraph grid | **Open** |
| N-01 | Low / P3 · nonblocking | Fresh artifact order withholding is absent from the aggregate quote tally | **Open** |

## F-01 — Do not count a same-paragraph resolved thread as open

**Primary location:** [`lightboxPlot.ts:216–217`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/shared/constants/lightboxPlot.ts#L216-L217).

`lightboxThreadOpenAcross` tests whether the plant is at or before the column's end and the resolution is after its start. That intersection test assumes a nonempty `[plant, resolution)` interval. A plant and resolution in the same paragraph violate the assumption, but are valid readings under this slice's rules. The documented rule explicitly says such a thread adds nothing to the lane.

**Independent production reproduction:** Build 192 paragraphs, which the existing ribbon buckets into 96 columns. Put `She takes down a jar. To her disappointment it was empty.` in ¶2. Read one pressure thread with question `What is in the jar?`, plant quote `She takes down a jar` at ¶2, resolution quote `it was empty` at ¶2, no escalations and `dormant: false`.

The real codec/assembler accepts both exact witnesses. Individual paragraph columns all count **0**. The real compressed first column, ¶1–¶2, counts **1 open thread**. Carry rechecks the same quotes and reproduces that false count. The rebuilt production webview renders the column title **“¶1–¶2 · 1 open thread, counted by code”** on the real service board. Bring correctly preserves the two ¶2 anchors, so neither a missing quote nor model uncertainty explains the discrepancy.

**Controls:** Put the same plant and resolution in ¶1, the column's first paragraph, and the count is 0. A genuine thread planted in ¶1 and resolved in ¶2 counts 1 in the bucket. This is sensitive to bucket alignment, not an intended alternative interpretation of same-paragraph resolution. The two-level ribbon redesign being out of scope does not make the existing compressed columns exempt from the stated counting rule.

**Requested correction:** Require the pressure interval to be nonempty before intersecting it with a column, or derive each bucket's count from the same open-at-paragraph predicate. Cover a same-paragraph plant/resolution at both ends and inside a bucket, including carry, without dropping genuinely open intervals.

## F-02 — Exclude the entire leading metadata block before detecting Sections

**Primary location:** [`LightboxSections.ts:73–79`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/infrastructure/lightbox/LightboxSections.ts#L73-L79); [`isFrontMatter:132–133`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/infrastructure/lightbox/LightboxSections.ts#L132-L133).

The exclusion recognizes front matter only when the complete block is the first blank-line-delimited paragraph. YAML allows blank lines within a document. The ordinary board paragraph splitter consequently divides valid front matter into multiple paragraphs, and the closing delimiter becomes a setext underline for a metadata field.

**Minimal source:**

```text
---
title: Chapter One

author: Alice
---

The chapter begins.
```

The production splitter gives ¶1 `---\ntitle: Chapter One`, ¶2 `author: Alice\n---`, and ¶3 `The chapter begins.`. `LightboxService` and the detector report:

- `signal: headings`, `level: 2`;
- `Opening`, ¶1–¶1;
- **`author: Alice`**, ¶2–¶3, marker ¶2;
- fired headings `[2]` and scene breaks `[1]`.

The rebuilt production webview renders **“Section 2: author: Alice, ¶2–¶3”** and **“2 sections from headings”** on that service board, with all five reading groups still `not-run`. This is metadata presented as measured chapter structure before any model call. Removing **only the blank line inside the YAML** produces `signal: none`, with no markers. A valid closing delimiter immediately followed by body prose in the same board paragraph also defeats the current last-line check and leaks a scene-break marker, though that smaller example does not create two sections by itself.

**Controls:** Genuine ATX/setext headings, heading-level precedence, separated thematic breaks, terminal/adjacent breaks, numbered/Roman/spelled chapter lines, ordinary `Chapter 12 was where…` prose and unsupported ornaments were exercised separately. No general Markdown parser or change to paragraph addressing is needed to fix the metadata witness.

**Requested correction:** Identify the leading front-matter span across the paragraph model, excluding its metadata/delimiters from structural detection while retaining the board's paragraph addresses. Cover blank lines, both supported closing delimiters, prose after the closing delimiter and a real body heading after metadata. Do not silence ordinary in-body scene breaks.

## F-03 — Give all ribbon lanes one shared horizontal grid

**Primary location:** [`LightboxRibbonPlot.tsx:67–88`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/presentation/webview/components/lightbox/LightboxRibbonPlot.tsx#L67-L88), particularly the separate label and plot tracks at lines 84–88; existing sizing in [`ribbon.css:56–64`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/presentation/webview/styles/lightbox/ribbon.css#L56-L64).

The new story ribbon is a second independent flex row. Both rows declare a 74px label basis, but neither fixes the label's automatic minimum width. The longer story labels, especially `Engagement` plus its stale badge, expand that row independently. The plot rows share the right edge but not the left edge or cell width. Thus identical column indices do not represent identical horizontal positions.

**Observed in the supplied PNG pixels, at every supplied width:**

| Width | Fresh main / story start | Stale main / story start | Shared right edge |
| --- | --- | --- | --- |
| 1440 | 427 / 432 px | 455 / 475 px | 1056 px |
| 1000 | 399 / 404 px | 427 / 447 px | 964 px |
| 500 | 115 / 120 px | 143 / 163 px | 468 px |

For example, in [`lightbox-stale-ribbon-500.png`](evidence/lightbox-slice-4c-visual/lightbox/lightbox-stale-ribbon-500.png), ¶4 begins at about x253 while movement II and the first nonzero pressure bar begin at x266. ¶6 begins at x325 while Scene 2 starts at x334. These are the correct host paragraph addresses drawn against different physical grids, not a relocated-boundary calculation error. Fresh captures are already displaced by 5px; stale labels enlarge the error to 20px at the start. The module promises the story lanes sit on the same column grid.

**Requested correction:** Use a common label track/column grid for both portions of the ribbon, including stale badges, rather than relying on independent flex minimums. Add layout assertions that the main and story column edges coincide at the supported widths in fresh and stale states. Preserve readable labels instead of merely clipping them to force a match.

This finding uses inspected supplied pixels plus source inspection. It does **not** claim a newly launched reviewer browser or native VS Code layout measurement; the production DOM sweep establishes semantics and protocol, not CSS geometry.

## N-01 — Count fresh artifact steps withheld for order

**Location:** [`LightboxPlotTiles.ts:147–155`](https://github.com/okeylanders/prose-minion-vscode/blob/797e1663ce534207d4086b032d8fd4caef55c14e/packages/core/src/infrastructure/lightbox/LightboxPlotTiles.ts#L147-L155).

Reverse the rabbit-hole's two arc steps in the shipped Group E example. Both quotes are found, but the later step in the supplied order refers to the earlier paragraph. Production `lightboxArtifactArc` correctly withholds that ¶4 step with `reason: out-of-order`, and the tile's withheld list exposes it. However, `verifyQuotes` has already recorded 9 artifact quotes checked and 0 withheld; the added `arc.withheld` is passed into the tile's prechecked evidence but never added to the assembler tally. The board reports **29 quotes checked / 0 withheld** despite that rejected step. The rebuilt production webview shows that same run-line tally while its inspector says the ¶4 quote was found but stands before the step it follows.

The equivalent order rejection on carry correctly increments withholding to 1. An ordinary missing fresh quote also increments it. This is a local accounting inconsistency, not an accepted false arc: the offending step is absent and its explanation survives. Include order withholding in the fresh lens/group totals without double-counting quote-verification failures.

## Scope, architecture and plan

Read the complete PR body, repository `AGENTS.md` / `.ai/central-agent-setup.md`, architecture guide, Lightbox ADR and D7 addendum, Slice 4C spec and implementation notes, epic progress/decisions, Slice 4D and Slice 5 plans, Group E response-ceiling debt, prior PR #155 report **and author response**, and relevant earlier Lightbox reports. No checkout-local `.agents/skills` directory was available.

- Group E adds template/freshness, pressure, artifacts and summary/movements through explicit group/lens/kind unions, register maps, prompt planning, estimation and execution. The six new tile kinds have owned render/inspect/Bring paths. Prompts 53–56 and worked example 44 are part of the composed request, with requested-lens filtering. The estimates remain labelled guesses rather than measured live costs.
- The template/summary read-together rule is shared by planning, estimates and settling ownership. Fresh engagement joins by response movement key onto host tile ids, requiring exactly one entry per drawn movement; missing, duplicate and unknown entries withhold the whole set. Carried movement ids retain their marks only while the complete movement set survives.
- Movement boundaries are re-found on current text; carried ranges end before the next relocated boundary, and the last ends at the current chapter end. Deleted/reordered boundaries fail the whole set rather than projecting old ranges. No fixed chapter outline or model-produced numerical span is trusted as measured output.
- Artifacts reuse the longest-term occurrence counter, count mentions/first paragraph deterministically and re-evaluate the explicitly defined two-paragraph `planted, unused` predicate on carry. A later mention removes the flag; removing that mention restores the original read flag. No universal claim that proximity proves narrative disuse is implied.
- Pressure order is **paragraph** order, not within-paragraph textual order; this limit is documented. Missing resolution withholds a thread instead of making it appear unresolved. Bring retains plant/resolution anchors, synopsis minimum evidence and movement boundaries under the common transfer limits. The browser posts ids, not model-authored replacement text or authority.
- Freshness is labelled a reading, not a grade. Its shared basis is joined from current stock tiers and template beats, not trusted from the model. Missing, stale or pending source lenses suppress the basis and identify the reason. Engagement is explicitly distinct from tension.
- The core contains no `vscode` import. New infrastructure/UI modules stay within the house module ceiling; the changed reading handler is 497 lines. The architecture inventory and boundary tests cover the added modules. This review does not approve a larger monolithic handler or a saved-board schema.
- The PR #155 merge was inspected at `LightboxTileHandoff`: the story anchor/travel/points additions retain the pair-specific transfer path, fail-closed current standout requirement and source-span familiar-phrase witness. Independent corrected phrase/pair probes were rerun against this exact #156 head, not inferred solely from the merge message.

## Bounded limits and nonblocking consistency notes

- The Sections detector intentionally works in the board's blank-line paragraph model, not a full Markdown/linguistic parser. It documents unsupported midparagraph headings, short setext underlines and some manuscript ornaments. One wording exception remains: `# # #`, listed as unsupported, actually matches the ATX rule and creates a heading labelled `#`. That may be legitimate Markdown precedence, but the declared unsupported-mark behavior should be clarified; it is not an additional blocker here.
- Artifact quotes need not themselves contain a named object term. The documented gate is at least one counted term in the chapter plus a found arc step. This is a deliberate bounded witness contract, not evidence that every model-labelled step semantically describes that object.
- The 32,000-character Group E response ceiling can be smaller than the sum of all maximum item/field bounds. The PR records this as debt; quarantine/recovery remains the present fallback. No live completion-rate, model-quality or cost conclusion is drawn from the stub example.
- The known narrow Workshop composer reflow limitation persists at 500px. It is recorded pre-existing debt, not a new story-lens regression. No claim is made that all controls fit merely because document-level horizontal overflow is absent.

## Independent verification

Original probes use synthetic/public-domain text and controlled providers only. Passing defect-witness assertions mean the counterexamples were reproduced, not that the behavior is correct. Temporary probes were kept outside the normal full-suite collection after their targeted runs.

| Check | Independent result |
| --- | --- |
| Exact-base full Jest | 411 suites / 5,712 tests / 59 snapshots passed (241.179 s), exact `16e85b1` coordinated run |
| Head full Jest | **419 suites / 5,802 tests / 59 snapshots passed** (263.908 s) |
| Exact-base/head typecheck | All three stages passed on both |
| Exact-base/head lint parity | **0 errors / 1,133 warnings** on both; normalized file/rule/severity/message multiset identical |
| Exact-base/head production build and `verify:bundle` | Passed; same three webpack size/performance warnings |
| Rebuilt head bundle provenance | Build succeeds consistently, but exact supplied-bundle identity is **unverified**: rebuilt SHA-256 `65228e9a07eeba50adf2f11af72430d16c903a34519ffb15e137d035d2aea0ab`, versus supplied `97658a69eba4a22bf26a4674bf2b3b18c68c65ea9ebca01d2cdca8ddffaf64bf` |
| `git diff --check 16e85b1..797e166` | Passed |
| Independent story gate/carry/Bring probes | Pressure/tally witnesses and controls passed; movement relocation, whole-set loss, engagement coverage, longest-term counts, unused-flag restoration, exact input nonmutation and Bring anchors passed |
| Independent service/handler ownership probes | 10 tests passed (3.511 s): coupled replacement, malformed/unrequested results, unrelated-lens preservation, cancellation/failure, late completion, repeated presses, close/reopen, no unsolicited call and source preservation |
| Independent Sections controls | 10 checks passed, including front-matter witness and contrasting structural/no-structure cases |
| Merged PR #155 phrase/pair controls | 19 checks passed at #156 head, including source-span/tokenizer parity, repeated-sentence pair Bring, intact-pair relocation and transfer limits |
| Merged PR #155 numbers controls | **15/15** service/handler lifecycle tests passed (5.444 s), including held-response/reference/direction/adoption races; original rounding controls, 119 exact-threshold cases + 4 formatting controls, 11 baseline/detector checks and soft-cap witness passed |
| Supplied host evidence regeneration | Passed: `chapter.json`, `workshop.json` and `log.txt` byte-identical to committed evidence |
| Production DOM story/Workshop sweep | **325 assertions passed** across all 18 story tiles / 6 kinds, focus/pin/Escape, filters/lenses, stale lanes/Bring, ids-only transfer/tray, Workshop pill and coupled reread controls; **8 targeted DOM assertions passed** for F-01, F-02 and N-01 |
| Implementation-head PR CI | [CI run 39517805922](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39517805922/job/118954064075) succeeded through install, typecheck, tests, lint and build |

Base gates are reused from the [coordinated independent PR #155 re-review](https://github.com/okeylanders/prose-minion-vscode/blob/46aff15fa62c8e25cd6ec5cb970df065cdabbf5e/docs/pr-reviews/pr-155-lightbox-craft-lenses-review.md#independent-re-review-2026-10-21) of the **identical** `16e85b1` commit. Its completed logs and lint JSON were inspected; head gates are run independently here. During this review #155 received report-only `46aff15`, then merged as `d6069e8`; #156 was retargeted to `epic/lightbox` without changing its head. The GitHub comparison independently confirms `16e85b1..d6069e8` changes only that PR #155 report (+67 lines), with no implementation change. The retargeted comparison remains 138 files / 4 head commits, with merge-base `16e85b1`. Therefore the same completed base gates remain applicable; no new-base implementation test is falsely claimed. Runtime: Node `v24.19.0`, npm `11.9.0`; CI separately uses Node 18. The complete head suite passed on its first full attempt with `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB --cacheDirectory=/workspace/scratch/648605e0fc08/pr156-jest-cache`. Typecheck used `npm run typecheck`; lint used the repository ESLint CLI over `packages apps --ext ts,tsx` with JSON output; builds used `npm run build`. The exact-base re-review records its earlier resource-killed/incomplete attempts separately; only its completed final run is reused here. No tracked test, implementation or lockfile was edited.

## Visual evidence and acceptance limits

All **36 supplied PNGs** were inspected as actual pixels, covering 12 state/surface captures at 1440, 1000 and 500px. The template/beat/engagement/freshness content, pressure spans/count labels, artifact mentions/arcs/unused flags, synopsis/movement ranges, measured Sections and stale explanations are visible. All four new lens cards are readable in the supplied responsive views apart from F-03's positional alignment defect.

There are 33 unique PNG contents: each artifacts capture is byte-identical to its same-width pressure capture because both cards fit in the bottom-clamped view. This is duplicated coverage, not falsified extra visual states. At 500px the inspector capture shows the title, chips and first quote; the lower span/order/friction/Bring controls are below that screenshot. The 1000/1440 views provide the fuller inspector evidence.

The exact screenshot-bundle identity could not be confirmed: three ordinary head builds produced the same `65228e9a…` hash rather than the recorded `97658a69…`. A physical-workspace working directory and materialized workspace-package controls did not change that result; lockfiles and the dependency installation manifest match the exact-base environment. No unsupported explanation or claim of invalid screenshots follows from the mismatch. The DOM checks use the actual reviewed-head build, and F-03 is independently supported by supplied pixels plus the current source/CSS.

The committed host-state builder was rerun against the reviewed head; its chapter, Workshop and log outputs are byte-identical. It exercises real services, handlers, runner, codec and Workshop seed delivery with a stub filesystem/baseline/provider/model/pricing. Groups A–C are off; this is D/E evidence, not all-group native acceptance. The visual harness replays host state and controlled handoff answers behind a stub VS Code API. It does not prove connected native IPC.

The original `facts.json` and `errors.txt` are not committed. Their claimed no-page-error/no-document-overflow results therefore remain author reports, not a fresh reviewer browser measurement; the harness's document-width check also does not rule out inner clipping. Production DOM probes test actual bundled rendering and controlled protocol/focus events, not layout, browser hit-testing, real keyboard activation or native VS Code. No previously denied local-file route, sandbox-blocked Chromium launch or unauthorized user computer was retried. No live/billable model call or private chapter was used.

The author reports successful real-chapter use and acceptance of decisions 10–16. Those statements are attributed author evidence, not independently authenticated writer acceptance. The separate native/live checkpoint and any acceptance required before Slice 5 remain unverified.

The final pre-publication remote/ancestry check at 03:48 UTC on 2026-10-21 confirmed story head `797e166`, the new target `epic/lightbox` at `d6069e8`, and merge-base `16e85b1`. The existing implementation-head CI was successful; no separate retarget-triggered CI result is claimed.

## Next step

Correct F-01–F-03 with targeted regressions, then re-review the changed head. N-01 can be handled as a small accounting correction. The completed retarget/ancestry check above found no additional base implementation delta; recheck again if either implementation head or target changes. Publication is report-only, authorized by the user on 2026-10-21. It does not authorize implementation edits, GitHub comments/formal reviews, merging or deployment.
