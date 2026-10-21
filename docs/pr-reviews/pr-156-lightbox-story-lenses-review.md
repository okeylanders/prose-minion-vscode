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

## Author response (2026-10-21)

**F-01, F-02, F-03 and N-01 are addressed, and the `# # #` note is taken.** Each finding has its own commit: F-01 `30047f0`, F-02 `1a82d29`, F-03 `3caadaa`, N-01 `3f9126c`. The docs commit that follows them adds this response and updates the slice notes, epic progress and agents guide. Nothing above this section was edited.

**How each new test was checked against `797e166`.** Each test was written and run before its fix, while `packages/core` was still identical to `797e166`. After the fixes, I checked out `797e166`'s versions of the seven changed source files (including the two stylesheets the F-03 pin reads) over the fixed tree, ran the four affected test files, and restored the fixes.
- 11 of 56 tests failed there: exactly the 11 new witnesses (F-01 3, F-02 6 including `# # #`, F-03 1, N-01 1), each at its assertion. The F-03 DOM pin fails at its first query, because there is no grid.
- The two new control tests and the 43 existing tests in those files pass on both trees.

### Resolution ledger

| ID | Fix | Proving test(s) | On `797e166` |
| --- | --- | --- | --- |
| F-01 | `30047f0` | `LightboxPressureBuckets.test.ts` (production boards of 192 and 288 ¶, fresh and carried) | 3 witnesses fail, 1 control passes |
| F-02 | `1a82d29` | `LightboxSections.test.ts`, "leading front matter across paragraphs" and the `# # #` case | 5 front-matter witnesses and the `# # #` case fail; the controls pass |
| F-03 | `3caadaa` | `LightboxAppPlot.test.tsx`, "one grid, with one label track" (DOM and CSS); the visual harness's `ribbonGrid` measurement (`facts.json`, `errors.txt`) | The DOM pin fails (no grid); the harness records 93 misalignments (`errors-797e166.txt`) |
| N-01 | `3f9126c` | `LightboxPlotReadings.test.ts`, "counts a step withheld for its order in the tallies, once" | Fails (0 withheld) |

### F-01: a same-paragraph thread is open in no column

**Root cause.** The finding is correct. `lightboxThreadOpenAcross` intersected `[plant, resolution)` with the column as "plant ≤ column end and resolution > column start". That test assumes the interval is nonempty. When plant and resolution share a paragraph the interval is empty, but any column whose first paragraph comes before that paragraph still passed.

**Fix.** The predicate now asks whether the thread is open in some paragraph of the column. Let `first` be the later of the plant and the column's start. The thread counts when `first` is within the column and before the resolution (or the thread is unresolved).
- One function serves the fresh lane, the carried lane and the webview's lane (`lightboxPressureLane`, `lightboxPressureLaneView`).
- The lane item already lights paragraphs from the plant up to the resolution's paragraph, not including it, so it agrees.

**Tests.** `LightboxPressureBuckets.test.ts` builds boards with the production `LightboxService`. Readings go through the production codec, verifier and assembly, and the carry through the production rebuild.
- **192 paragraphs (96 columns of two).** A same-paragraph thread at the column's end (¶2) and at its start (¶1) adds nothing to any column.
- **288 paragraphs (columns of three).** Inside the column (¶2) it adds nothing.
- **Carry.** After a rebuild with ¶100 changed, the same-paragraph thread adds nothing, and the lane the webview draws agrees.
- **Controls.** A ¶1→¶2 thread counts 1 in ¶1–¶2 and 0 in ¶3–¶4, and so does a ¶2→¶3 thread. A thread still open counts in every column from its plant on. Carried, the ¶2→¶3 thread still counts 1.

### F-02: front matter is metadata across blank lines

**Root cause.** The finding is correct. `isFrontMatter` recognised only a first paragraph that both opened and closed the block. A blank line in the YAML split it, and the closing `---` then read as a setext underline under `author: Alice`. Prose directly after the closing delimiter defeated the last-line check, so the opening `---` read as a break.

**Fix.** `frontMatterEnd` finds the leading block across the paragraph model:
- It opens with `---` as the chapter's first line.
- It continues with YAML-shaped lines: a `key:` with no space in the key, a list item, a comment, or an indented continuation.
- It closes at `---` or `...` alone on a line.

Inside that span:
- Nothing is a marker.
- Lines after the closing delimiter in its paragraph are read as that paragraph's start, so a heading there marks it.
- Paragraph addresses are unchanged; the metadata stays in the opening section.

A block never closed, or holding a line that isn't YAML-shaped, is not front matter. So a chapter that opens with a `---` break followed by prose keeps every break. The recognition is by line shape, not a YAML parse. The module now states the two limits this leaves:
- an indented continuation that opens a paragraph loses its indentation to the paragraph model;
- a chapter opening with `---` followed only by `Word:` lines up to a later `---` is taken for front matter.

**Tests.** In `LightboxSections.test.ts`:
- your minimal source, with the paragraph addresses checked;
- a block closed by `...`, with a comment and a list inside;
- prose directly after the closing line, with and without a blank line in the YAML;
- body headings after the metadata, in their own paragraphs and right after the delimiter;
- the body's scene breaks after the metadata;
- a board built by the production service from the metadata plus the worked example's chapter.

Controls: `---` then prose then `---`, `---` with prose in the same paragraph, and an unclosed block all keep their breaks as before.

**The `# # #` note.** Taken, by changing behavior rather than the docs. `#` marks separated by spaces (`# # #`, `# #`) now form a scene break, the manuscript convention. The check runs before the ATX rule could read the line as a heading of `#`, and the module's notes say so. A real `# The bank` heading on the same board is unaffected (tested).

### F-03: one grid for the ribbon's paragraph and story lanes

**Root cause.** The finding is correct. The story lanes were a second flex row with their own 74px label basis and no fixed minimum, so the wider story labels moved their column track.

**Fix.** Both parts are rows of one CSS grid, `.pm-lb-ribbon-grid`:
- **One label track.** `minmax(74px, max-content)`, sized to the widest label including its stale badge.
- **One column track.** Each part (`.pm-lb-ribbon-wrap`) spans both tracks as a `subgrid` row, and both column tracks keep the same 2px gap.

Labels keep their full text. The label track is 78.8px fresh and 121.8px with the stale badges, and no label is clipped.

**Tests.**
- **DOM and CSS (jsdom).** `LightboxAppPlot.test.tsx` pins:
  - one grid whose two rows each hold a label block and a column track;
  - the stale badges inside the shared label track;
  - equal column templates;
  - from the stylesheet text: the shared label track, the subgrid rows, no flex basis on the labels, and the shared gap.
- **Layout (Chromium).** The visual harness now measures, in every Lightbox state at 1440, 1000 and 500px:
  - each paragraph column's left and right edges against the story lanes' column of the same index (the Pressure lane's per-column cells);
  - the two tracks' edges;
  - every section, movement and engagement band against the paragraph columns it spans;
  - any clipped label.

  It records the measurements as `ribbonGrid` in the committed `facts.json` and writes any mismatch over 0.5px to `errors.txt`.
  - On the `797e166` bundle it records 93 misalignments: 4.8px in every fresh state and 19.44px in every stale state, at every width, matching your measurement from the screenshots.
  - On the fix, every edge coincides at 0px, 8 or 9 columns and 6 or 8 bands per state; `errors.txt` is empty.

**The bundle hash.** Your rebuilt `65228e9a…` was right. The recorded `97658a69…` came from a build whose `node_modules` was a symlink to another checkout's install. The installed versions matched the lockfile, but webpack resolved those modules to paths outside this checkout, and production module ids derive from paths.
- On a clean `npm ci` here, `797e166` builds to exactly `65228e9a07eeba50adf2f11af72430d16c903a34519ffb15e137d035d2aea0ab`.
- The regenerated evidence comes from the same clean install: `webview.js` SHA-256 `9493dfce5941aeccbbab03366f2905e6b0a91c24803176141098df849442415b`.
- The host states regenerate byte-identical.
- Apart from the new `ribbonGrid`, every page fact equals the first run's.
- `facts.json`, `errors.txt` and `errors-797e166.txt` are committed.

### N-01: a fresh arc step withheld for its order is counted

**Root cause.** The finding is correct. `verifyQuotes` counted the step's quote as checked and found. The order rule then withheld it from the tile, but nothing added that to the tally.

**Fix.** The claim assembler gains `withholdFound(lens, count)`, which counts quotes that verification found but a block's own rule withheld. It adds to the withheld counts only, because they were already checked. The artifacts block calls it with its order-withheld steps. A step whose quote is not found is counted once, by verification, so no quote is counted twice.

**Tests.**
- Reversing the rabbit-hole's arc: the artifacts lens tally and the group totals gain exactly one withheld and no check.
- An arc with one step out of order and one not found: two withheld, one more check.

On `797e166` the first assertion fails with 0 withheld. It also fails with only the new call removed.

### Verification at the new head

| Check | Result |
| --- | --- |
| Full Jest | 420 suites / 5,815 tests / 59 snapshots, all passing (from 419 / 5,802 / 59 at `797e166`) |
| `npm run lint` | 0 errors / 1,133 warnings, identical per file, rule and severity to the base |
| `npm run typecheck` | Passes |
| `npm run build` with `verify:bundle` | Passes (clean `npm ci`); the same three webpack size warnings |
| `git diff --check` | Clean |
| `vscode` imports in `packages/core/src` | None; changed modules stay under 500 lines (`LightboxReadingHandler` unchanged at 497) |

No live or billable call was made. The fixtures are public-domain text and lines written for the tests.

## Independent re-review (2026-10-21)

**Reviewer:** Astra · **Correction head:** `e7e1536ee935df5fa54f0df3c8d2f8230cc4e5c1` · **Target:** `epic/lightbox` at `d6069e821eb1bcb8ca151768aa2c0808d701eb1c`.

**Verdict: Request changes, for one newly introduced compatibility defect (F-04).** The original F-01, F-02, F-03 and N-01 witnesses are addressed. The shared grid corrects the supplied modern-Chromium layout, but its unconditional `subgrid` dependency breaks the repository's expressly supported VS Code 1.75 / Chromium 102 runtime. This is not a reopening of the old horizontal-offset witness under another name: the original offset is fixed; the replacement introduces a different failure on a declared-supported host.

The original review and complete author response above are preserved verbatim. This re-review checks the five correction commits after report-only `e8d0c6d`, reuses the original adversarial probes with corrected expectations, and independently challenges the replacements. It does not repeat or silently supersede the original review's acceptance limits.

### Updated disposition

| ID | Independent disposition at `e7e1536` |
| --- | --- |
| F-01 · P2 | **Addressed.** A same-paragraph resolved thread contributes zero in compressed columns, fresh and carried; genuine nonempty/open intervals still count. |
| F-02 · P2 | **Addressed within the stated line-shape/paragraph-model contract.** Blank-line front matter and a closing delimiter followed directly by prose no longer become measured structure. Genuine body markers remain. |
| F-03 · P2 | **Addressed for the original modern-browser misalignment.** Shared tracks and supplied fresh/stale pixels agree at all three widths. The separate compatibility regression is F-04 below. |
| N-01 · P3 | **Addressed.** Found-but-out-of-order arc steps increment fresh lens and aggregate withholding once, without adding another check or double-counting missing quotes. |
| F-04 · P2 · new | **Open.** Unguarded CSS subgrid breaks the ribbon on the documented minimum VS Code runtime. |

### F-04 — Keep the shared ribbon grid compatible with the declared host floor

**Primary location:** [`ribbon.css:65–68`](https://github.com/okeylanders/prose-minion-vscode/blob/e7e1536ee935df5fa54f0df3c8d2f8230cc4e5c1/packages/core/src/presentation/webview/styles/lightbox/ribbon.css#L65-L68), introduced by `3caadaa`.

The replacement removes the flex-row rule and unconditionally gives each `.pm-lb-ribbon-wrap` `display: grid; grid-template-columns: subgrid`. Its two children are the complete label block and the plotted-column track. Neither child is explicitly placed into a second column. No alternate wrapper rule, `@supports` fallback or subgrid polyfill exists in the production styles/build. The emitted production bundle retains the subgrid declaration; an independent PostCSS/Autoprefixer transformation targeting Chrome 102 also leaves it unchanged.

This is outside the supported runtime, not merely a preference for an older browser:

- [`apps/vscode-extension/package.json:20–22`](https://github.com/okeylanders/prose-minion-vscode/blob/e7e1536ee935df5fa54f0df3c8d2f8230cc4e5c1/apps/vscode-extension/package.json#L20-L22) declares `engines.vscode: ^1.75.0`; the [README:318–321](https://github.com/okeylanders/prose-minion-vscode/blob/e7e1536ee935df5fa54f0df3c8d2f8230cc4e5c1/apps/vscode-extension/README.md#L318-L321) expressly supports 1.75.0 and higher.
- The same epic's [Slice 2A notes:234–238](https://github.com/okeylanders/prose-minion-vscode/blob/e7e1536ee935df5fa54f0df3c8d2f8230cc4e5c1/.todo/epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md#L234-L238) already identify Chromium 102 as the floor and explain avoiding `:has()` because of it. No newer minimum-runtime decision was found.
- Microsoft's [VS Code 1.75.0 `.yarnrc`](https://github.com/microsoft/vscode/blob/1.75.0/.yarnrc) targets Electron 19.1.9. The [official Electron 19.1.9 release](https://releases.electronjs.org/release/v19.1.9) uses Chromium 102. [Chrome's official 117 release notes](https://developer.chrome.com/blog/new-in-chrome-117) introduce CSS subgrid.

**Result, inferred from these verified versions and the CSS rules:** on Chromium 102 the unsupported `subgrid` value is discarded, but `display: grid` remains. Without an accepted column template, the wrapper has no explicit columns; default row auto-placement puts the label block and the plotted track in successive rows of an implicit single-column grid. Labels therefore sit above their charts instead of beside their matching lanes. Both the measured paragraph ribbon and the story ribbon are affected, including the pre-read board. The parent grid does not automatically share its columns through an ordinary nested grid. These consequences follow from [invalid declaration handling](https://www.w3.org/TR/css-syntax-3/#style-rules), [the initial `none` track template](https://www.w3.org/TR/css-grid-1/#track-sizing), and [row auto-placement](https://www.w3.org/TR/css-grid-1/#grid-auto-flow-property).

This is a **source/runtime-compatibility finding, not a fresh Chromium 102 or native VS Code reproduction**. No previously denied browser route was retried. The supplied modern-Chromium screenshots cannot establish compatibility with the advertised floor. Moreover, the new evidence harness checks horizontal edges, not whether each label block is beside its track; equal-width stacked tracks could satisfy its horizontal comparisons.

**Requested correction:** retain shared, readable tracks using a floor-compatible layout or a tested compatible fallback. Alternatively, explicitly decide, document and validate a higher supported engine floor rather than raising it implicitly through CSS. Cover the unsupported-subgrid/minimum-runtime path, asserting label/track vertical adjacency as well as fresh/stale horizontal column and band alignment. This report does not authorize changing the minimum runtime.

### Fix witnesses and contrasting controls

**F-01.** The original production 192-paragraph jar witness now renders **“¶1–¶2 · 0 open threads, counted by code”**, and remains zero on carry. Five additional production-board cases cover 192, 288 and 289 paragraphs, start/end/interior/late bucket positions and insertion before the quoted paragraph; fresh and carried presentation lanes agree. An independent exhaustive comparison of `lightboxThreadOpenAcross` with the literal “open in at least one paragraph” predicate passes **7,020 interval/column combinations**. The original `797e166` implementation fails 286 of those cases. Genuine intervals and unresolved threads are retained, not indiscriminately zeroed.

**F-02.** The original minimal YAML witness now returns `signal: none`, empty sections and no fired markers on a real service board with every reading group still `not-run`. Expanded cases cover both closing delimiters, LF/CRLF, blank paragraphs, comments/lists, prose and ATX/setext headings immediately after the closing line, subsequent body headings and actual scene breaks. Three contrasting ordinary-prose/unclosed-block controls pass on both old and corrected implementations. Spaced `# #` / `# # #` and tab-spaced marks are now scene breaks; actual ATX headings retain their precedence. This is a verified intentional behavior change, not merely corrected documentation. The documented indentation-loss and YAML-shaped-prose ambiguities remain limits of the paragraph/line-shape detector, not a claim of full YAML parsing.

**N-01.** The original reversed rabbit-hole arc yields **29 checked / 1 withheld** at group/run level and **9 checked / 1 withheld** for Artifacts. The inspector still explains the actual withheld step. Adding a missing arc quote yields **10 artifact checks / 2 withheld**, with one order rejection and one verification failure, not a duplicate count. Carry retains the same two withheld reasons. The original implementation fails the corrected fresh-tally expectations.

Across these expanded independent probes, **19 cases pass at the corrected head**; **16 corrective witnesses fail on `797e166` and all three negative controls pass**. The original broad story-gate controls also pass again: moved/deleted/reordered movement boundaries, whole-set engagement refusal, missing/duplicate/unknown engagement references, longest-term counting, unused-flag restoration, nonmutation and preserved Bring anchors. No implementation file was temporarily replaced to obtain these results.

### Independent verification

| Check | Result at `e7e1536` |
| --- | --- |
| Clean dependency installation | `npm ci --ignore-scripts`, isolated disk-backed checkout/cache; lockfile unchanged |
| Full Jest | **420 suites / 5,815 tests / 59 snapshots passed**, 251.318 s |
| Typecheck | Passed: core, webview and extension |
| Lint | **0 errors / 1,133 warnings**; exact file/rule/severity/message-multiset parity with the preserved original-head lint output |
| Production build and `verify:bundle` | Passed; three existing webpack size warnings |
| Bundle SHA-256 | **`9493dfce5941aeccbbab03366f2905e6b0a91c24803176141098df849442415b`**, exactly matching the revised evidence |
| Independent service/handler ownership controls | **10/10 passed**, including the two corrected Sections expectations, coupled malformed/unrequested replacement, cancellation/failure/late completion, repeated presses and close/reopen |
| Host evidence regeneration | Builder passed; `chapter.json`, `workshop.json` and `log.txt` byte-identical to committed states |
| Production-bundle DOM | **325 general + 8 targeted assertions passed**: all 18 story tiles / 6 kinds, focus/pin/Escape, lenses/filters, stale Bring, ids-only transfer/tray, Workshop pill, coupled reread, and corrected F-01/F-02/N-01 displays |
| Diff / boundaries | `git diff --check` clean; no added core `vscode` import; all changed production modules below 500 lines |
| Exact correction-head GitHub CI | Both [pull-request CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39543729462) and [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39543724661) completed successfully |

Full tests used `NODE_OPTIONS=--max-old-space-size=2048 npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB` with a disk-backed Jest cache. Runtime remains Node 24.19.0 / npm 11.9.0; GitHub CI separately uses Node 18. External probe files do not join or inflate the full repository-suite totals. Their relocated-test module-resolution setup and obsolete original bug-expectations were corrected before the final probe pass; these were harness/expectation issues, not hidden repository test failures. Tracked implementation, tests and lockfiles remained unchanged.

The effective implementation base remains `16e85b11908978a18c48aed6bd6aa462ecff9b17`; `16e85b1..d6069e8` still changes only the prior PR #155 review report. No new base implementation is inferred from the retarget. The report-only publication gets its own subsequent exact-head push/PR CI check; the successful implementation-head runs above are not substituted for that check.

### Visual provenance and remaining acceptance limits

All **33 changed Lightbox PNGs** were inspected as actual pixels at 1440, 1000 and 500px. The original fresh/stale horizontal displacement is removed and the labels, including stale badges, remain readable. The three unchanged Workshop screenshots were not claimed as new captures. The existing narrow inspector screenshot still shows only its upper content, not off-screen lower controls.

The newly committed `facts.json` is internally consistent: **33 matching main/story track comparisons**, plus **249 compared paragraph/pressure-cell pairs and 198 section/movement/engagement bands** across 30 populated states, with recorded maximum edge deltas of zero and no clipped labels. The three pre-read `sections-measured` captures compare tracks only, with zero cells/bands; the author's “every state” cell/band wording is too broad. `errors.txt` is actually empty, and the 93 old-error lines match the harness's 33 track, 30 cell and 30 band comparisons. Those are independently audited **supplied measurements**, not newly measured reviewer geometry. The harness can skip absent tracks or mismatched cell counts and does not test vertical adjacency, so process success alone is not sufficient layout acceptance.

The current rebuilt bundle now matches the author-recorded screenshot-bundle hash exactly, closing the previous mismatch for the revised evidence. The earlier clean `797e166` hash `65228e9a…` remains preserved reviewer evidence. The claimed historical symlinked-install cause is consistent with path-derived webpack module ids, but that exact historical installation was not reconstructed; no stronger claim about its provenance is made.

No fresh browser/native VS Code run, live/billable model call or private manuscript input was used. DOM probes establish bundled semantics and controlled protocol, not browser hit-testing, CSS geometry or native IPC. The author's real-chapter acceptance and product decisions 10–16 remain attributed, unauthenticated acceptance claims. **This report is not Slice 5 readiness, saved-board-schema approval, merge permission or deployment authorization.** Next step: correct F-04, verify the declared minimum runtime alongside modern layouts, then re-review that delta.

## Author response to the re-review (2026-10-21)

**F-04 is addressed in `9fadf6d`, without raising the floor.** The ribbon is one plain CSS grid with no row wrappers and no `subgrid`. Every label block and track is a direct child, placed by column: labels in the shared `minmax(74px, max-content)` track, tracks in the column track, and the story part's rule across both. The evidence README now states which measurements compare cells and bands, correcting the earlier "every state" wording.

**Floor guard.** A new architecture test, `webviewCssFloor.test.ts`, scans every webview stylesheet (comments stripped) for features newer than Chromium 102. Each feature carries its first Chrome version from MDN browser-compat-data 6.1.5: `subgrid` 117, `:has()` 105, `@container` and container units 105, nesting 112/120, and more. `@layer` (99) is at the floor and allowed. The guard pins `engines.vscode: ^1.75.0`, keeps the ribbon's two sheets free of all such features, and fails on `e7e1536`'s `ribbon.css`. It also found older uses outside this PR, the largest being 99 `color-mix()` (Chrome 111) uses, including the theme tokens. They are inventoried per file as a ratchet and filed as Medium tech debt (`2026-10-21-webview-css-above-chromium-102.md`), since the floor itself is the writer's decision.

**Harness and proof.** The harness now checks that each label block is beside its track: to its left, overlapping it vertically, with every lane label's centre inside it. It fails rather than skips on a missing track or label block, mismatched cells, or absent bands. Three `floor-` states drop every `subgrid` declaration before measuring, which is how Chromium 102 treats it (a simulation in Chromium 141, not a 102 run).
- **On `e7e1536`'s bundle** (clean rebuild, the recorded `9493dfce…`), every ordinary state passes. Each floor state stacks the labels above their tracks: 54 faults (`errors-e7e1536.txt`, one picture under `before/`), while every edge still coincides at 0px.
- **On the fix**, there are 0 faults across 42 measurements:
  - 36 with readings, comparing 300 cell pairs and 240 bands at 0px;
  - 6 pre-read, comparing tracks and adjacency only, as the README now states.
- The bundle is `webview.js` SHA-256 `c016b535a53b38451e4676b494fe8a5477ce8dfbc1d27de67746ff8f14bb34c2` (clean `npm ci` and `npm run build`), and the host states regenerate byte-identical.

**Verification at the fix head:** full Jest 421 suites / 5,821 tests / 59 snapshots, all passing; lint identical (0 errors / 1,133 warnings); typecheck, build with `verify:bundle` and `git diff --check` pass.

## Independent F-04 re-review (2026-10-21)

**Reviewer:** Astra · **Correction head:** `d98780b6221dccb2cdfce80068eb01a855ad1375` · **Target:** `epic/lightbox` at `d6069e821eb1bcb8ca151768aa2c0808d701eb1c`.

**Code-review disposition: F-04 addressed; no remaining blocking finding in the reviewed PR #156 corrections.** The original F-01, F-02, F-03 and N-01 dispositions remain addressed. This is a focused review of `9fadf6d` and its evidence/documentation commit after report-only `dc3d5f9`, not native-host acceptance or a formal GitHub approval. Every line of the original review, first author response, first re-review and second author response above is preserved.

### Why the F-04 correction holds

The unsupported dependency is removed rather than hidden behind a fallback. [`LightboxRibbon.tsx:117–156`](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/presentation/webview/components/lightbox/LightboxRibbon.tsx#L117-L156) and [`LightboxRibbonPlot.tsx:73–101`](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/presentation/webview/components/lightbox/LightboxRibbonPlot.tsx#L73-L101) now emit the label blocks and plotted tracks as direct children of one grid; the React fragment adds no wrapper box. [`ribbon.css:62–72`](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/presentation/webview/styles/lightbox/ribbon.css#L62-L72) keeps one shared label column and one plotted column, explicitly placing labels in column 1 and [paragraph tracks in column 2](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/presentation/webview/styles/lightbox/ribbon.css#L116-L120). The [story separator spans both columns](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/presentation/webview/styles/lightbox/plot.css#L237-L252). Main and story paragraph tracks retain identical templates and 2px gaps.

Consequently, ordinary grid auto-placement pairs each label block with its track on the same row, instead of relying on a nested grid inheriting the parent's columns. No `subgrid` declaration or row wrapper remains in this production path or its rebuilt CSS. The replacement uses ordinary CSS Grid, [shipped in Chrome 57](https://developer.chrome.com/blog/new-in-chrome-57), rather than the Chrome 117 feature. The declared [`engines.vscode: ^1.75.0`](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/apps/vscode-extension/package.json#L20-L22), documented floor and Electron/Chromium mapping established above are unchanged. This closes the specific newly introduced floor incompatibility without silently raising the supported host version; it does not certify every pre-existing webview style on that host.

Independent production-bundle controls exercise pre-read, fresh and stale boards: five correctly ordered direct children, explicit column placement, equal inner track declarations, expected individual lane-label order, no subgrid, preserved named story-track group, clickable Sections/Pressure labels and visible stale badges. **All 40 assertions pass.** The same structural control rejects the old `e7e1536` production bundle at the direct-child assertion. These are actual bundled DOM/declaration/interaction checks, not fabricated browser geometry. The story group role now encloses the track rather than the label block; the label buttons and outer ribbon group remain available.

### Guard and visual-evidence controls

The new [`webviewCssFloor.test.ts`](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/packages/core/src/__tests__/architecture/webviewCssFloor.test.ts) is a useful **selective feature/debt ratchet**, not a complete CSS parser or compatibility certification. Independently applying its detector to the unchanged old ribbon flags one subgrid use; the fixed ribbon has none. Contrasting subgrid, `:has()`, stripped-comment and ordinary-grid controls behave as intended. All **14 existing inventory files** have identical detected feature counts before and after this correction, including the pre-existing `color-mix()` debt. No causal new defect in that older debt was found, and it is not being added to this PR's findings.

All **22 changed PNGs** were inspected as pixels: the retained broken-before image, nine floor-simulation captures and 12 ordinary captures, at 1440, 1000 and 500px. The old supplied image visibly stacks labels above their tracks; the corrected supplied images put them beside the lanes while retaining F-03's shared horizontal alignment. The 12 ordinary captures differ from their predecessors by only 386 pixels combined, with no channel changing by more than 1, and no substantive layout regression was observed. The floor and ordinary captures are not claimed to be universally pixel-identical.

The supplied `facts.json` reconciles to **42 Lightbox measurements: 36 populated captures with 300 compared cell pairs and 240 bands, plus six pre-read track/adjacency-only captures**. All recorded track/cell/band edge discrepancies are 0px; all **84 label-block adjacency entries** pass, with no clipped labels. Current `errors.txt` is empty. The retained old log contains **54 faults**, six per floor capture, consistent with the old stacked-label image. All nine corrected floor captures record zero dropped declarations, as expected now that subgrid is absent.

The improved [harness](https://github.com/okeylanders/prose-minion-vscode/blob/d98780b6221dccb2cdfce80068eb01a855ad1375/docs/pr-reviews/evidence/lightbox-slice-4c-visual/harness.js#L244-L368) no longer silently skips a missing measurement/track/label block or a mismatched pressure-cell count. Independent isolated Node controls confirm these rejection paths, rejection when all populated bands are absent, and six faults for stacked labels despite unchanged horizontal edges. All 42 supplied Lightbox facts also pass its current fault function. The source, controls and supplied pixels jointly substantiate the correction; the measurements were audited, not freshly captured by this reviewer.

**Nonblocking evidence limits:** adjacency checks encompass a whole track, not exact individual label-to-lane correspondence; swapping individual label rectangles within that track can pass. Missing one band can pass while another remains, and unexpected aligned pre-read bands are not rejected despite the README's broader wording. The descriptive facts extractor now records `lanes.labels: []` because labels moved outside its scoped story group; those are the only 33 prior descriptive-fact changes outside `ribbonGrid`, so the README's claim that every other fact is unchanged is not literal. Visible labels, source order and the independent DOM checks were verified separately. These are harness/report precision limits, not reproduced product failures or reopened blockers.

The author's floor scenario removes subgrid declarations in **Chromium 141**. That accurately isolates the former lone unsupported declaration, but it is **not a Chromium 102 execution**, emulation of all older CSS/JavaScript behavior, or native VS Code acceptance. No previously denied browser route was retried.

### Independent final-head verification

| Check | Result at `d98780b` |
| --- | --- |
| Clean install | `npm ci --ignore-scripts` in a new isolated disk-backed checkout; physical dependencies and unchanged lockfile |
| Full Jest | **421 suites / 5,821 tests / 59 snapshots passed**, 262.554 s |
| Typecheck | Passed for core, webview and extension |
| Lint | **0 errors / 1,133 warnings**, exact file/rule/severity/message-multiset parity with the preceding reviewed head |
| Production build / `verify:bundle` | Passed; the same three webpack size warnings |
| Bundle SHA-256 | **`c016b535a53b38451e4676b494fe8a5477ce8dfbc1d27de67746ff8f14bb34c2`**, matching the committed evidence exactly |
| Production-bundle DOM | **373 assertions passed**: 325 existing general, eight original-defect controls, and 40 new flat-grid/label controls |
| Original fix witnesses | All **19 expanded cases and 7,020 pressure interval/column comparisons** pass again, together with the original story-gate and Sections service probes |
| Host / ownership | **11 external tests passed**: ten ownership/service controls and the production host-evidence builder |
| Regenerated host evidence | `chapter.json`, `workshop.json` and `log.txt` byte-identical to committed states |
| Source boundaries | All four changed production files below 500 lines; no new core `vscode` dependency; `git diff --check` clean |
| Exact implementation-head CI | Both [PR CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39547097176) and [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/39547090705) completed successfully |

Full tests again used Node 24.19.0 / npm 11.9.0, `NODE_OPTIONS=--max-old-space-size=2048`, one Jest worker, `--workerIdleMemoryLimit=1000MB` and a disk-backed cache. GitHub CI separately uses Node 18. External probes do not inflate repository-suite totals. Their old story-group selector was updated to the replacement track; no implementation was edited or swapped to obtain these results. Exact report-head push and PR CI will be checked separately after publication.

**Final boundary:** all five reported items are addressed in code review for PR #156. No new blocking regression was found in this focused correction. No fresh browser/native-host run, live/billable model call or private manuscript input was used. Writer real-chapter acceptance and product decisions remain attributed, unauthenticated author claims. This is not whole-app minimum-runtime certification, Slice 5 readiness, saved-schema approval, merge permission or deployment authorization. PR #157 is separate; this disposition does not assert that its branch has incorporated these fixes.
