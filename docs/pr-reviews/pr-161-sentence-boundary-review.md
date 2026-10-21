# PR Review — Sentence Closing Marks and Speech Tags

**Author:** okeylanders · **PR:** [#161](https://github.com/okeylanders/prose-minion-vscode/pull/161) (open, unmerged at review)  
**Branches:** `epic/lightbox-sentence-rule` → `epic/lightbox`  
**Reviewed implementation head:** `6cbd27bcc84617d07866ba416a622c37d4e20091`  
**Current base:** `1fe931ad5f929586865acab4332ac271d9e2efc3` · **Merge-base:** `2e62aa766226f11a47630248b8f2ce7b4fee1dbb`  
**Scope:** 38 files · +1,904 / −101 relative to the merge-base  
**Reviewed:** 2026-10-21 · **Reviewer:** Astra  
**Mode:** independent source/contracts review, literal and generated span probes, real measurement-service/reader checks, regenerated host evidence, exact production-bundle DOM execution, supplied PNG inspection and fresh full head gates

## Summary

**Verdict: No blocking finding; one nonblocking P3 follow-up.** The shared splitter implements the documented closing-mark and lower-case continuation rules, including interleaved enders. The ordinary reader paths agree with the new measurements. The full repository suite, typecheck, lint-parity check and production build pass. Both production bundle hashes reproduce the author's values.

The narrow exception is a punctuation-only token that the existing hapax tokenizer still counts: dropping its only sentence span makes the sentences well claim an instance that it cannot light, and can point it at an unrelated paragraph. This is not a failure of the ordinary dialogue/tag join, and does not warrant blocking the sentence fix.

This is a code-review disposition, not a formal GitHub approval, merge instruction, writer checkpoint, real-chapter acceptance, native/minimum-host verification or Slice 5 readiness decision. PR #160's separate craft-steering implementation and its eventual integration are not cleared here.

## Findings and disposition

| ID | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| N-01 | Low / P3 · nonblocking | A counted apostrophe-only hapax can lose its sentence witness when closing-only stretches are discarded | **Open** |

## N-01 — Reconcile counted tokens outside every sentence span

**Changed location:** [`passageProseStats/index.ts:53–54,117–118`](https://github.com/okeylanders/prose-minion-vscode/blob/6cbd27bcc84617d07866ba416a622c37d4e20091/packages/core/src/tools/measure/passageProseStats/index.ts#L53-L54).  
**Exposed assumption:** [`LightboxPassages.ts:120–142`](https://github.com/okeylanders/prose-minion-vscode/blob/6cbd27bcc84617d07866ba416a622c37d4e20091/packages/core/src/infrastructure/lightbox/LightboxPassages.ts#L120-L142).

`holdsSentence` now excludes an apostrophe-only stretch. The unchanged `proseStatsWords` intentionally retains straight apostrophes, however, so a standalone `'` is still a vocabulary token and can be a listed hapax. The passage builder assumes each counted instance belongs to a sentence; its binary search does not represent “outside every sentence.”

**Independent production reproductions:**

- On `'Oh dear! '` (a space before the final straight single quote), the final `'` is a listed hapax. Its well reports **1 instance in 1 sentence**, returns the first sentence `'Oh dear!`, and lights **zero** instances. The sole occurrence was in the discarded trailing stretch.
- On a paragraph containing only `'`, followed by a blank line and `Alice ran.`, pinning that hapax displays **“Sentences · 1 instance in 1 sentence”** and **¶2 `Alice ran.`**, with no highlight. The actual occurrence is in ¶1.
- On a source consisting only of `'`, the reply still claims one sentence but returns a row with an empty `sentences` array.

The real board, index and passage builder reproduce all three. The exact newly built production webview, driven by the real passage handler, reproduces the second case. The original splitter loaded separately from `058feb5` lights the correct occurrence in all three controls. Normal single-quoted speech with attached closing marks is unaffected.

**Why nonblocking:** these are punctuation-only vocabulary artifacts or malformed spacing, not ordinary prose words. Counting an apostrophe as a vocabulary item is inherited; losing its witness is new. No source text is altered and the well is recoverable by choosing another item.

**Follow-up:** define how a counted item with no sentence witness is represented or declined, rather than assigning it to the nearest sentence or inventing a sentence count. Reconcile any change to punctuation-only vocabulary eligibility deliberately with the headline/hapax contract. Add trailing-closing-only, separate-paragraph and empty-index regressions, checking actual lit IDs and row text rather than only the reported count. Do not undo the intended removal of phantom sentences just to satisfy the old assumption.

## Rule, contracts and source fidelity

Read the live PR, `AGENTS.md` and its central setup, architecture/testing guidance, the sentence ADR and resolved debt record, Lightbox ADR D4/D5/D10/D12, the Slice 4E plan and implementation notes, the epic progress record, and the existing #159 report with its author response and later independent re-review. No checkout-local `.agents/skills` directory was present.

- **One rule:** all direct `proseSentenceSpans` / `countProseSentences` consumers still use the shared implementation. The only other executable-source-file delta is a comment in `LightboxNumbers`. No reader introduces a display-only splitter.
- **Closing marks and nesting:** attached straight/curly single and double quotes, parentheses and square brackets remain with their ender. Mixed/interleaved runs such as `!'?”` terminate once. Leading whitespace and UTF-16 offsets remain exact source slices; no normalization is introduced by the splitter.
- **Continuation:** a quote must directly follow an ender within the run, then whitespace must lead to a Unicode lower-case letter. LF/CRLF soft wraps join. LF/CRLF blank lines, including indented blank lines, do not. Bare punctuation, bracket-only runs, a quote after a space, capital/title-case names, digits, emoji and an elision before the next word do not trigger a tag join.
- **Independent coverage:** 34 literal slice cases include astral characters before the quote, astral lower-case letters, composed/decomposed accents, nonbreaking/em spaces, nested quotes, brackets, blank lines and missing final punctuation. A separate character-wise contract oracle agrees on **12,000 deterministic generated inputs**. These checks verify this punctuation rule, not general linguistic sentence parsing.
- **Documented limits are not new findings:** capital-name tags, abbreviations, the distinction between `...` and `…`, guillemets, missing-space cases and joining any lower-case continuation after a qualifying quote remain explicitly bounded by the ADR. The inherited whole-text/per-paragraph discrepancy for unpunctuated headings also remains; using one splitter does not imply that splitting separately by paragraph must equal the whole-text count.
- **Persistence and ownership:** no board/session schema, source-intent ownership, handler correlation, cache-lifetime or model-execution code changes. Boards and writer-baseline measurements remain ephemeral; Workshop tiles already brought in retain their historical quoted figures. This does not freeze the future saved-board format.

## Measurements, readers and exact builder evidence

Recomputed the original (`058feb5`), closing-only (`fabd95d`) and reviewed rules from their actual source, without replacing implementation files. Public-domain *Alice* Chapter I was regenerated with the repository's cutter and matches the earlier fixture's SHA-256 `52801900…1088`; the twelve regenerated chapters form the whole-book fixture. Literal expected counts pass for ten fixture/settings combinations, including all four opening quote/wrap variants and both Tea-Party settings.

| Fixture | Whole-text sentences: original → closing → head | Words per sentence | Per-paragraph sentences, summed |
| --- | --- | --- | --- |
| Worked-example ¶1–¶8 | 17 → 16 → 15 | 29.9 → 31.8 → 33.9 | 19 → 17 → 16 |
| Opening, each quotation/wrap setting | 10 → 9 → 8 | 22.6 → 25.1 → 28.3 | 12 → 10 → 9 |
| Repeated-opening vocabulary, 6,000 words | 244 → 244 → 217 | 24.6 → 24.6 → 27.6 | 292 → 290 → 263 |
| Tea-Party, each setting | 33 → 32 → 27 | 13.2 → 13.6 → 16.1 | 40 → 32 → 27 |
| Chapter I | 85 → 85 → 78 | 25.7 → 25.7 → 28.0 | 98 → 91 → 84 |
| Whole book | 1,629 → 1,628 → 1,388 | 16.2 → 16.2 → 19.1 | 2,028 → 1,702 → 1,462 |

The same runs record readability, grade and pacing from the real stats tool. Head sentence summaries reproduce the book's **192 very-short sentences** and longest sentence of **179 words in ¶146**.

**Reader checks go beyond count-only agreement:**

- Across **165 listed entries on ten additional speech/Unicode/line-wrap/boundary fixtures**, actual found instances, displayed segment IDs and omitted-instance counts agree. Every displayed sentence reconstructs the exact source slice; each segment's IDs are independently checked against the real instance offsets. The sample includes overlapping phrases, cross-paragraph phrases, curly/straight speech, Unicode case expansion and a 75-paragraph row-bound case. N-01 is separately characterized rather than hidden by these passing ordinary fixtures.
- The passage index, per-paragraph rhythm, sentence summary, writer-baseline counts, standout quote filter, handoff adjacency and collision witness read the changed sentence coherently. An independent emoji-prefixed quote checks UTF-16 offsets in both the standout filter and handoff/collision paths. Speech-to-own-tag is no longer adjacent; speech/tag-to-next-sentence is.
- The full suite exercises the four-sentence synopsis bound, Metrics/standards consumers and the existing count-agreement fixtures alongside these changes.
- **A–F requests were rebuilt, not inferred from their counts.** Every chapter-group request is byte-identical to its committed worked example. Group F's real digest builder reproduces its entire request, including **15 sentences**, **33.9 words per sentence** and **×2.37**. Its reply passes the production codec/gates with six observations, three views and nothing withheld.
- The selected four new rule/reader suites contain 75 tests. With the original splitter, **62 fail / 13 pass**; with closing-only, **31 fail / 44 pass**; all pass in the fresh head suite. These are this review's explicit final-file negative controls, not a reassertion of the author's intermediate-stage fail counts.

## Host evidence and presentation

Relocated and reran the supplied production-host state generator externally, with only its output/resource paths adjusted and the splitter selected through the test resolver. **All three regenerated state files are byte-identical** to the committed original/closing/head states. No live model/provider was reached.

The exact rebuilt `webview.js` passes **40 independent DOM assertions** across those three states and N-01's real-host reproduction. Tea-Party ¶17 displays the literal **4 → 3 → 2 sentences**, **7.8 → 10.3 → 15.5 words per sentence**, matching rhythm chips, unchanged complete paragraph text and the correctly labelled/focusable well. Passage text is not persisted and no model-run message is posted.

Visually inspected all three supplied inspector PNGs: the claims and rhythm chips match the state data and the paragraph remains legible. These are author-supplied images, not independent captures. The independent run is **JSDOM/transport/accessibility-attribute evidence**, not browser pixel geometry, actual keyboard scrolling, screen-reader testing, native VS Code activation or execution at the minimum Chromium 114/VS Code 1.82 runtime.

## Performance context

**Before interpreting timings:** these are warmed, sequential **direct Node 24.19.0 / Linux x64 cloud-workspace** measurements of the actual TypeScript-transpiled splitter, with nine samples per shape. They do not use Jest's VM and are not native extension-host latency measurements or a statistical benchmark.

| Shape | Original median | Head median |
| --- | ---: | ---: |
| Whole *Alice* book | 0.377 ms | 0.273 ms |
| 50,000 `Alice.` sentence tokens | 7.545 ms | 5.600 ms |
| Approximately 50,000 words of ordinary speech/tag pairs | 2.437 ms | 4.336 ms |
| 25,000 successive joinable quote/tag fragments, one final sentence | 2.193 ms | 3.590 ms |
| One million spaces after a closing quote, capitalized next word | 0.576 ms | 8.230 ms |

The pathological whitespace control is deliberately not representative of a chapter. Additional lower-case, blank-line and long interleaved-run controls complete without dropping text/instances to manufacture a ceiling. No material splitter-performance blocker was found. This says nothing about #160's separate steering classifier or its eventual integrated timing.

## Verification and integration history

| Check | Fresh independent result at `6cbd27b` |
| --- | --- |
| Full repository Jest | **444 suites / 6,102 tests / 59 snapshots passed**, 301.527 s |
| Lint | **0 errors / 1,133 warnings**, exact normalized relative-file/rule/severity/message parity with the independently reviewed #159 baseline |
| Typecheck | Core, webview and extension passed |
| Production build / `verify:bundle` | Passed from cleaned `dist`; same three webpack size/performance warnings |
| External independent probes | **4 suites / 7 tests passed**; includes explicit N-01 characterization, not a claim that N-01 is fixed |
| Host-state regeneration | Three runs passed; all three outputs byte-identical to the supplied states |
| Exact production-bundle DOM | **40 assertions passed**, including N-01 defect characterization |
| Diff whitespace | `git diff --check 2e62aa7..HEAD` passed |

Dependencies are a real worktree-local copy of the prior verified installation, not a symlinked repository. The complete lockfile is byte-identical; **977 installed package versions match**, with nine platform-specific optional packages absent as expected. No dependency or lockfile was edited.

Rebuilt SHA-256 values:

- `webview.js`: `2f86917e89befed61189d1422fbb71e211c2ea59e28fbd0c9a0e8db06de2ae04`
- `extension.js`: `865b2c9fda25ab98a72cfe41979281f11b4d1189b0f06137b383130662d3b56f`

Both match the author's evidence. The webview is byte-identical to independently cleared #159; its earlier interrupted-navigation correction evidence is therefore reused with verified executable equivalence, not presented as a new native test.

#159's final implementation `2e62aa7`, including #158's floor change, is an ancestor of this head. The later review-only `95c933a` is not. The current base differs from `2e62aa7` only by that independent report append, so its previously recorded full baseline gates are reused with verified executable equivalence. An endpoint diff can misleadingly look like the addendum was removed: a read-only three-way merge calculation produces a clean tree that **preserves the entire addendum and the author's response**, alongside this branch's archived-debt link change. There is no review-history-loss finding.

## Acceptance boundary

No blocking defect was found in the reviewed sentence change; retain N-01 as the bounded follow-up above. Do not infer #160 integration acceptance, writer/real-chapter checkpoint acceptance, minimum-host/native/live-provider verification or Slice 5 readiness from these results. Historical evidence from earlier slices remains historical, as the author documents.

This publication changes only this report. No implementation/test/lockfile edit, older-review rewrite, formal GitHub review/comment, merge, deployment, VSIX publication, paid/live call, private-manuscript processing or user-computer operation was performed. Publication and exact report-head CI are tracked separately rather than recursively changing this report.
