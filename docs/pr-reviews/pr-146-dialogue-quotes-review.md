# PR Review — Dialogue Quotes Prerequisite

**Author:** okeylanders · **PR:** [#146](https://github.com/okeylanders/prose-minion-vscode/pull/146) (open, unmerged at review)
**Branches:** `epic/lightbox-prereq-dialogue-quotes` → `epic/lightbox`
**Verified base / merge-base:** `df50039a432b80906f893625e8828856378aef22`
**Reviewed implementation head:** `030ce56948c6886968dfe1bc1ff619dd72aab259`
**Scope:** 8 files · +446 / −12 · 2 commits
**Reviewed:** 2026-10-19 · **Reviewer:** Astra · **Mode:** independent source/spec review, deterministic matcher and public-metric probes, baseline comparison, and full verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = separately tracked follow-up · **Addressed** = independently verified fix · **N/A** = no action. An author's declaration is distinguished from independent verification below.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| — | — | No actionable defect found in the implemented double-quote prerequisite | Full checks and independent edge-case, compatibility, and paragraph-additivity probes below | **N/A** |

**Verdict: Approved for merge into `epic/lightbox` for the implemented double-quote prerequisite.** The shared matcher fixes curly-double-quoted dialogue and preserves the documented straight-quote behavior. No implementation change is requested. Single-quoted dialogue remains an **author-declared, separately tracked follow-up**; the original broader requirement is not fully implemented. Actual shared-matcher integration with the Lightbox paragraph model remains pending in Slice 2A. Exact report-head CI is checked separately after this report-only commit; this verdict does not claim those later integration or native acceptance checks have happened.

## Scope and specification assessment

The review covers the [Lightbox epic](../../.todo/epics/epic-lightbox-2026-10-19/README.md), [ADR D4](../adr/2026-10-19-lightbox-inspiration-board.md#d4-one-paragraph-model-addresses-everything), [Slice 2A](../../.todo/epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md), and the [original prerequisite and added resolution](../../.todo/tech-debt/2026-10-19-prose-stats-dialogue-curly-quotes.md). The original prerequisite asks for single-quoted dialogue where appropriate, unchanged straight-quoted output, and one matcher used by both consumers. The implementation deliberately narrows those statements; they should not be read as three unqualified completed criteria.

1. **Single quotes are a real remaining limitation, not a completed requirement.** `‘Hello,’ she said.` still reports 0% dialogue. The new [single-quote convention debt](../../.todo/tech-debt/2026-10-19-dialogue-single-quote-convention.md) records that limitation, and the Metrics legend now explicitly says double quotes. Independently checking elisions, contractions, and plural possessives supports the technical reason for avoiding unconditional single-quote pairing: narration such as `He said ‘cause the boys’ bikes aren’t here. Tell ’em.` must not become speech. I consider the isolated double-quote fix sound to merge without a new convention heuristic. That is a review of this narrow implementation, not evidence of the writer accepting the omitted capability or its assigned priority.
2. **Straight-quote compatibility applies when each paragraph's quotes balance.** Odd-quote recovery intentionally changes: `He cut 12" of rope.\n\nShe left. "Bye," he said.` changes from 60% to 40%. The unmatched inches mark still misclassifies the end of its own paragraph, but no longer shifts pairing across later paragraphs. This behavior is documented and tested, and gives the paragraph-additive contract needed by D4. It is not an unnoticed compatibility regression.
3. **The second consumer is future work.** This PR supplies a pure reusable matcher and wires `PassageProseStats` to it. Slice 2A owns the actual Lightbox paragraph model and its integration tests. The existing promise that the two cannot disagree is verified here as a helper/count contract, not as an end-to-end Lightbox result. No missing future-slice code is treated as a prerequisite defect.

## Independently verified behavior

- **Shared ownership and architecture.** [`dialogueSpans.ts`](https://github.com/okeylanders/prose-minion-vscode/blob/030ce56948c6886968dfe1bc1ff619dd72aab259/packages/core/src/utils/dialogueSpans.ts#L33-L92) is a 92-line pure core utility, with no host dependency, network access, persistence, mutable cross-call regex state, or new service construction. [`PassageProseStats`](https://github.com/okeylanders/prose-minion-vscode/blob/030ce56948c6886968dfe1bc1ff619dd72aab259/packages/core/src/tools/measure/passageProseStats/index.ts#L108-L113) uses its count with the existing total-word denominator and one-decimal rounding.
- **Curly, straight, and mixed styles.** The author's 22-word scene now gives 59.1% with either double-quote style; independent public-API fixtures confirm the count/denominator/rounding relationship. Cross-style pairs close at the first supported closer. Stray curly closers do not open a narration span.
- **Nesting and apostrophes.** Single quotes nested inside double quotes remain inside the outer span. Contractions, elisions, and possessives cannot independently open or close a span. Double-in-double curly nesting intentionally closes at the first `”`; the rest of that quotation can be undercounted. This limited recovery behavior is explicit in the module and tests, rather than an assertion of arbitrary nested-quotation parsing.
- **Unbalanced and multi-paragraph speech.** An unclosed quote ends at the paragraph boundary. Conventional speech with an opener at each paragraph and a closer only on the last paragraph is counted paragraph by paragraph. Single line breaks remain inside a span; blank lines, including whitespace-only blank lines and CRLF input, separate spans consistently with the existing paragraph rule.
- **Offsets and repeatability.** Independent astral-character fixtures verify UTF-16 offsets, including `🙂 “Go.”` producing `{ start: 3, end: 8, closed: true }`. Generated inputs verify ordered, bounded, non-overlapping spans, supported endpoint characters, repeat-call determinism, and absence of cross-paragraph spans.
- **Paragraph additivity.** For 10,000 independently generated mixed inputs, `countDialogueWords(text)` equals the sum over `text.split(/\n\s*\n/)`. This includes odd quotes, single quotes, curly/straight mixtures, nonbreaking whitespace, CRLF, and astral characters. The result supports the planned shared-count contract; it does not substitute for Slice 2A's consumer test.
- **Legacy compatibility.** An additional 3,000 generated texts with balanced straight quotes in every paragraph match both the original regex word count and the actual baseline `PassageProseStats` percentage. Empty quotes, adjacent spans, whitespace, apostrophes, and multiline spans are included. Nineteen hand-selected fixtures also preserve every unrelated public metric field against the actual baseline implementation.
- **Inherited numerical limitation.** Adjacent quoted spans can still produce more than 100% because the numerator counts whitespace tokens separately inside each span while the denominator counts whole-text tokens. For example, `"a""b"` remains 200%, exactly as on the baseline; curly equivalents inherit the same counting rule. The PR explicitly preserves this behavior. It is not a new defect attributed to this patch, and this review does not claim the measure is a general-purpose linguistic speech classifier.

## Independent verification at `030ce569`

These are reviewer-run results, separate from the author's PR verification table. The checkout was clean before verification. Dependencies were copied from the independently checked base checkout, whose package lock is identical to this PR's. Local verification used Node 24.19.0 / npm 11.9.0; repository CI uses Node 18 and remains a separate exact-head gate.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **316 suites / 4,742 tests / 2 snapshots passed**, 146.621 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,140 warnings**; identical baseline file/message/rule warning multiset, allowing line-number shifts |
| `npm run build`, including `verify:bundle` | Passed; three webpack size/performance warnings; all three Tailwind sentinels verified |
| `git diff --check df50039a..030ce569` | Passed |
| Independent public-metric and matcher probes | **19 hand fixtures + 10,000 generated mixed inputs + 3,000 generated balanced-straight inputs passed**; 224,481 assertions |
| Larger synthetic input | 20,000 words across 5,000 paragraphs; expected 10,000 dialogue tokens returned, approximately 4.5 ms for one local count; a sanity check, not a performance guarantee |

The independently established base result was **315 suites / 4,702 tests / 2 snapshots passed**, with clean typechecking and the same 1,140 lint warnings. This PR adds one suite and forty passing tests. The independent probes loaded the actual current and baseline TypeScript modules and compared public outputs; they did not replace the matcher with a duplicate implementation. Probe scripts and logs remain outside the tracked checkout, and only this report is committed.

## Limits and follow-through

- No native Extension Development Host or visual acceptance pass was performed. The formatter legend change was inspected in source and included in typecheck/build verification.
- The review does not approve or implement later Lightbox slices, the single-quote convention heuristic, arbitrary nested quotation parsing, or changes to the inherited tokenizer.
- Required checks must be verified on the new report commit after publication, not inferred from implementation-head or base results.
- No functional changes, merge, deployment, extension release, live provider call, or branch cleanup were performed by the reviewer.
