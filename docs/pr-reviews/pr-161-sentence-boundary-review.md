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

## Author response (2026-10-21)

**N-01: fixed** in `f0b1967`, with tests that fail on the reviewed head.
Whether a punctuation-only token is vocabulary at all is the inherited
contract you named. It is unchanged and now Low tech debt.

PR #160 (Slice 4F) merged first, so this PR carries the integration:
- `epic/lightbox` at `2f040ab` is merged in at `2c45aa3`;
- the evidence states were rebuilt on the merged tree at `0e85dce`.

Every figure that moved is listed below, for your re-check of the
combined tree. Nothing above this section was edited.

### Resolution ledger

| ID | Severity | Disposition | Fix | Regression tests | Commit |
| --- | --- | --- | --- | --- | --- |
| N-01 | Low / P3 · nonblocking | **Fixed** | An instance no sentence touches gets a row of its own: the stretch of its paragraph between the sentences around it, outer space trimmed, with the instance lit and marked "outside any sentence". The passage counts it as `outside` (and `more.outside` past the row bound), never as a sentence, and never puts it in the nearest one. The phantom-sentence removal stays. `LightboxPassageRow` is a union of a sentence row and an outside row, so a row cannot be both | `LightboxPassagesOutside.test.ts` (7): your three cases through the production board and index, checking lit instance ids and row text; the outside row's ¶ pin; and, on a real index with instances placed by hand, text order between sentences, two instances in one stretch, and the row bound. `lightboxPassages.test.ts`: the header and bound wording. `LightboxPassageWell.test.tsx`: the row rendered, lit, marked and pinned. `LightboxCountAgreement` now also checks outside instances | `f0b1967` |
| Punctuation-only vocabulary | Inherited · out of scope | **Tracked** | `proseStatsWords` still counts a lone `'` as a word. Whether it should is a vocabulary decision with its own figures to re-pin, so it is [Low tech debt](../../.todo/tech-debt/2026-10-21-prose-stats-punctuation-only-words.md) | — | `f0b1967` |
| Integration | Merge | **Merged and verified** | `epic/lightbox` at `2f040ab` (PR #160, Slice 4F). Conflicts and moved figures are below | Full gates below | `2c45aa3` |

### How each new test was checked against `6cbd27b`

I put `6cbd27b`'s passage builder, passage types, view model and well
back in place, with type diagnostics off, since the row type changed. I
ran the nine new tests there, then restored the fix.

**Failed (8).** The three cases reproduced exactly what you found:
- **`'Oh dear! '`:** "1 instance in 1 sentence", the row `'Oh dear!`,
  nothing lit.
- **`'`, a blank line, `Alice ran.`:** the row was ¶2 `Alice ran.`,
  nothing lit.
- **`'` alone:** "1 instance in 1 sentence", and a row with an empty
  `sentences` list. The index holds no sentence.

The three hand-placed cases, the header wording and the well's render
failed too.

**Passed (1).** The ¶ pin control passes on both, since the pin was
never wrong.

With the fix:
- **Your three cases.** Each case gives one outside row in ¶1, the
  segment `'` with instance 0 lit. Each counts 1 instance, 0 sentences
  and 1 outside, which the header reads as "1 instance, outside any
  sentence". The well's test renders that header and the row "' · outside
  any sentence".
- **The text-order case** (`Alice ran. ' . Alice sat.`) gives a sentence
  row, an outside row (`'` lit, then ` .`) and a sentence row. It counts
  3 instances in 2 sentences, 1 outside.
- **Past the row bound**, `more` is
  `{ rows: 3, sentences: 2, instances: 3, outside: 1 }`.

### The 4F merge: conflicts, and what moved

**Conflicts**, with both sides kept in each:
- **Group F's worked example.** 4F renumbered the tiles. Its request is
  the builder's output on the merged code, byte for byte
  (`LightboxOpinionBundle`). The response keeps 4F's tile ids
  (`D-10`, `D-11` and so on) and this branch's figures.
- **The tech-debt index.** 4F's rows are kept, and so is the punctuation
  row. The closing-quote row stays resolved.
- **The agents guide's inventory** is the merged count. **The epic
  README** keeps 4F's entries, then this branch's, then a dated entry
  for N-01 and the merge.

**Every figure that moved on the combined tree, against `2f040ab`:**

| Where | At `2f040ab` | Combined |
| --- | --- | --- |
| Group F worked example, request: headline | 17 sentences · 29.9 words per sentence · pacing Slow (longer sentences) | 15 · 33.9 · Very slow (very long sentences) |
| Group F worked example, request: `standout:sentence-length` and tile `D-10` | 29.9 words per sentence (×2.09) | 33.9 (×2.37) |
| Group F worked example, request: voice trait | measured: 29.9 avg | 33.9 avg |
| Group F worked example, response: O2, Blunt's body, and the note after it | 29.9, "about twice" | 33.9, "more than twice" |
| `LightboxCraftHandoff.test.ts`: the number reading's Figure point | "Sentence length: 29.9 words per sentence; your average 14.3" | "… 33.9 …", with a comment |
| `LightboxSteeringMeasure.ts` header | Named a closing mark the rule left alone | Names the merged rule (comment only) |

**Nothing else moved:**
- **Groups A–E's and G's requests** still equal their builders
  (`LightboxPromptBundle`), so none was regenerated.
  - D's request names its threshold, not the figure.
  - D's response passes its gates unchanged: its sentence-length quotes
    still sit inside sentences of more than 14 words.
- **Craft steering's counts are unchanged.**
  - Every 4F suite passes as written.
  - The rule can move a short run in general: a closing mark no longer
    adds a word to the next sentence, and a speech tag lengthens its
    speech's sentence.
  - Neither the 4F excerpt nor the Tea-Party has an instance in a run,
    under any of the three rules.

**4F's committed evidence** is left as recorded at its head. I rebuilt
it into a scratch folder with its own `tools/build-steering.test.ts`, on
the merged tree:
- `workshop.json` is byte-identical.
- `log.txt` differs only in group F's digest line: about 4,020 → 4,022
  tokens, and its key.
- `chapter.json` differs in 130 fields, all sentence figures or group F's.
  - The headline: 17 → 15 sentences, 29.9 → 33.9, pacing Slow → Very
    slow, readability 40.2 → 32.3, grade 12 → 13.6.
  - The longest sentence: 107 → 106.
  - The ribbon: ¶2 28.5 → 57 and ¶8 8.2 → 12.3.
  - Group B's "29.9 avg".
  - Group F's estimate: +3 tokens.
  - Group F's reading.
  - The steering measure, notes and examples do not move.

The full list is in the
[sentence-rule evidence](evidence/sentence-rule/README.md#what-else-moved).

**This branch's evidence** was rebuilt the same way, at `0e85dce`.
- The three Tea-Party states differ from the earlier build only by 4F's
  fields: the steering measure, group G's slot, and the estimate. Every
  sentence figure is unchanged.
- Re-rendered with the merged `webview.js`, the facts are identical. Two
  captures came out byte-identical. The third differs in 34 pixels by one
  level of one channel, so it was kept.

### Verification of the merged head

All gates ran at `2c45aa3`, after `npm ci` into the worktree's own
`node_modules`. The later commits change only docs and evidence.

| Check | Result |
| --- | --- |
| Full Jest | **456 suites / 6,259 tests / 59 snapshots passed**. The reviewed head ran 444 / 6,102 / 59, the N-01 fix 445 / 6,111 / 59, and `2f040ab` brings 4F's 11 suites and 148 tests |
| Named suites | 4F's (`LightboxSteering*`, `LightboxBeingVerbsAgreement`, `LightboxOpinionDigest`), `LightboxCountAgreement`, the four sentence reader suites, `LightboxPassagesOutside`, `LightboxPromptBundle`, `LightboxOpinionBundle` and `LightboxCraftHandoff`: **19 suites / 310 tests passed** |
| Lint | **0 errors / 1,133 warnings**, identical per file and rule to the N-01 head; 4F's 21 new files add none |
| Typecheck | Passed all package stages |
| Build and `verify:bundle` | Passed; the same three webpack size warnings |
| `webview.js` SHA-256 | `cb08d7b9cc645e1104cb7d9c9a6f0d3035aaa0c4c7b8d66fbfb4523070dc7482`, reproduced by a second build. The N-01 fix alone was `700b6816…`; 4F adds steering |
| `extension.js` SHA-256 | `a548648cc4af07ad531a0ce7fd1a1f9ef168adeccbaa0241ec420af73cdee86d`, reproduced. The N-01 fix alone was `70c37eb0…` |
| `git diff --check` | Clean against `2c45aa3`'s first parent. Against `origin/epic/lightbox`, it flags only this report's header line breaks, which are yours |

No live or billable call was made, and no unpublished manuscript was
used.

### Not done here

- **4F's evidence** is not re-rendered: earlier slices' evidence stays as
  recorded. The fields it would move are listed above.
- **Steering's sentence wells** (4F's debt) are not wired here.
- **Writer, native and live-provider acceptance** remain open, as you
  said.

## Independent integrated-head re-review (Astra, 2026-10-21)

**Reviewed head:** `c9c9e3a1db0df12ba4d7b01a229c076e59dfc0d8`
**Integrated base:** `2f040ab1c9e07ac0d8e5aa3c0abdb542b790a999` (PR #160)
**Relevant changes:** N-01 correction `f0b1967c4`; base integration `2c45aa322`; rebuilt evidence `0e85dce08`; author response `c9c9e3a1d`.

### Disposition

**N-01 is addressed. No remaining blocking or nonblocking code-review finding was found on this combined tree.** This addendum clears the previously pending #160/sentence-rule integration review for this exact head, not just the sentence branch in isolation. It supersedes the earlier open N-01 disposition and earlier exclusion of #160 integration; the initial report and the complete author response above are preserved unchanged.

The punctuation-only vocabulary decision remains the separately documented Low tech debt, not an unresolved witness bug. This is still not a formal GitHub approval, merge instruction, writer/real-chapter acceptance, native/minimum-host verification, live-provider acceptance or Slice 5 readiness decision.

### N-01: independent before/after and reader evidence

- Replayed all three original witnesses through the production board, passage index and builder: trailing `'` after a space, `'` alone in ¶1 before `Alice ran.` in ¶2, and a source containing only `'`. Each now reports **1 instance, 0 sentences, 1 outside**, returns the exact `'` lit as instance 0 in its own ¶1, and preserves the correct paragraph text and highlight when pinned through `via`.
- Loaded the actual `6cbd27b` passage builder separately as a runtime negative control, with the current sentence rule and index. All three still reproduce their former unlit/empty-witness behavior; the correction is not a changed fixture or a restored phantom sentence. Its historical type references were excluded from typechecking because that old return shape predates the new discriminated row union; its executable body was not changed.
- Checked **34 listed hapax entries over ten further punctuation/Unicode/line-wrap fixtures**, including apostrophe runs, closing brackets, CRLF, soft wraps, nonbreaking/em spaces, astral neighbors and separate punctuation-only paragraphs. Every displayed segment reconstructs a literal source slice within its own paragraph; lit IDs match independently computed overlap with actual found offsets. Outside-instance and omitted-instance accounting agree, and an outside instance intersects no sentence.
- Replayed the prior **165-entry, ten-fixture** ordinary-reader checks unchanged: exact source slices, overlapping and cross-paragraph phrases, UTF-16 offsets, lit IDs, row bounds and omission accounting remain correct. The repository's mixed sentence/outside, shared outside-stretch and 50-row-bound tests also pass in the full run.
- The fresh production webview, driven by the real passage handler rather than handwritten replies, displays all three original cases with one literal marked quote, the truthful outside-sentence count/label, no borrowed `Alice ran.` sentence, and a working own-paragraph pin retaining the lit token.

The union is handled by host construction, presentation counts, row text, paragraph pins and omission copy. No nearest-sentence fallback remains for the no-intersection case.

### Shared sentences in craft steering and Opinion

The splitter itself is byte-identical to the initially reviewed `6cbd27b` implementation. Relative to the cleared #160 base, `LightboxSteeringMeasure.ts` changes only its explanatory comment; it continues to consume the shared splitter. This is not grounds to assume its derived short-run counts are unchanged.

Independent historical-rule controls load the actual original (`058feb5`), closing-only (`fabd95d`) and current splitter implementations into the same steering measure:

- `“It was very cold!” she said softly. “It was quite dark!” she said quietly.` has four short sentences under the first two rules and two under the current rule. Being-verb/adverb/filler instances inside a qualifying three-sentence run change from **[2, 2, 2] to [0, 0, 0]**.
- A three-speech control still qualifies; a blank-line-separated control never qualifies. LF soft wraps join like spaces; capital-name tags retain the documented separate-sentence behavior.
- In all five controls, **every other measured field is deeply equal**, including total/rate, dialogue/narration, construction partitions, paragraph attribution and weak-verb counts. The additional `really` in the three-speech control is correctly both a filler and an `-ly` occurrence, not a sentence-rule discrepancy.
- Substituting only the old versus new measured short-run figures on the same board changes the actual F digest item's evidence basis, digest key and built request. F therefore does not silently reuse the prior identity when this shared measurement changes.

**Actual builders and host execution:** rebuilt every A–G request, including F's real digest, and compared each complete string to its committed worked example. All are byte-identical. F contains **15 sentences**, **33.9 words per sentence** and **×2.37**, and its actual response passes the codec/gates with six observations, three views and nothing withheld. The production-host evidence generator also checks G's full request and the F request dispatched after G settles against their worked examples, byte for byte.

The retained lifecycle probes verify three-call admission, G before F, no F after cancellation on G landing, stopped/late G rejection, retained-board identity, changed-source carry/reanchoring and Opinion standing through pending/cancelled/completed G rereads. The actual dispatched F request equals the digest of the settled originating board. These are no-provider tests, not live model results.

### Previously corrected regressions remain corrected

- **#160 F-01, measurement scaling:** replayed all **984 complete old/new output comparisons** over 328 fixed/generated fixtures and three tagger modes. Both detector implementations deliberately use the current shared splitter in this differential, isolating the optimization; the historical sentence comparison is separate above. Token-property work remains linear: 100→1,000 repeated `It was cold.` units take **3,000→30,000** reads, `very` **700→7,000**, and `slowly` **1,195→11,995**.
- **Performance context:** direct **Node 24.19.0 / Linux x64**, outside Jest's VM, using the actual transpiled source. A sequential 49,998-word single-paragraph control measures **53.4 ms** for steering after **100.3 ms** of tagging and retains all 16,666 being-verb instances. The earlier independently cleared direct-Node control was 60.5 ms plus 121.6 ms tagging. These single observations are consistent with the retained bounded-work implementation, not a claimed speedup or native VS Code latency benchmark.
- **#160 F-02, post-anchor example bounds:** the original soft-wrapped canonical-before witness still withholds only the oversized example on fresh assembly, changed-text carry and Bring. Its nudge and source quote survive; the exact-bound, one-line control travels whole without slicing. The normalized-dash no-op and ten malformed-example checks also pass.
- **#160 scoped numbers copy:** the steering-only standout fixture renders the scoped empty-number-lens explanation, not the old contradictory “nothing in the numbers” claim.
- **#159 late-response correction:** the hook source is byte-identical to the cleared integrated base. Both hook and exact-bundle replay retain cached A when B arrives late, including a return to the earlier board, and preserve pending/unpin/fresh-request controls.

### Regenerated host evidence and exact bundle linkage

Regenerated the current supplied evidence tools outside the checkout, changing only resource/output paths and selecting historical sentence modules through the test resolver. No implementation, repository test or historical evidence file was rewritten.

- All **three Tea-Party states are byte-identical** to this PR's rebuilt committed states. The exact new bundle still displays ¶17 as **4→3→2 sentences**, **7.8→10.3→15.5 words per sentence**, matching rhythm and complete unchanged paragraph text.
- Rebuilt the actual Slice 4F host path against this combined tree and compared it with the independently regenerated #160 baseline, rather than treating historical 4F captures as current. `workshop.json` is byte-identical. `chapter.json` has exactly **130 changed leaf fields**, confined to sentence-derived measurements/ribbon, Group B's measured average, F's estimate/reading/citation bases/digest key and corresponding replay states. Steering measurements, notes and examples are unchanged on this particular excerpt.
- The 4F log changes only F's digest size (**4,020→4,022 estimated tokens**) and the digest key in its construction/landing messages. F's request estimate moves by three tokens; that is a different quantity from the two-token digest change.
- **145 independent DOM assertions** execute the exact rebuilt production webview: 72 sentence/outside-row assertions, 36 steering assertions and 37 inherited passage/late-response assertions. Regenerated host states drive the steering reads, withholding, own-quote navigation, Bring IDs/acknowledgement and stale state. No model-run message is emitted.

This is production-bundle/DOM/transport/accessibility-attribute evidence in JSDOM, not new browser screenshots, pixel-layout testing, actual keyboard/screen-reader testing or native VS Code activation. The earlier supplied PNG inspection remains historical; no blocked browser route was retried.

### Fresh combined-head gates

| Check | Independent result at `c9c9e3a` |
| --- | --- |
| Full Jest | **456 suites / 6,259 tests / 59 snapshots passed**, 321.655 s |
| Typecheck | All package stages passed |
| Lint | **0 errors / 1,133 warnings**, exact normalized relative-file/rule/severity/message parity with the cleared #160 baseline |
| Production build and bundle verification | Passed; existing webpack size warnings only |
| Independent targeted probes | **33 tests across 10 external suites passed**: inherited correction/lifecycle/reader/builder/pricing checks plus four new integration checks |
| Host regeneration | Four successful runs: three sentence-rule variants and the combined 4F host path |
| Exact production-bundle DOM | **145 assertions passed** |

Reproduced both author-reported production hashes:

- `webview.js`: `cb08d7b9cc645e1104cb7d9c9a6f0d3035aaa0c4c7b8d66fbfb4523070dc7482`
- `extension.js`: `a548648cc4af07ad531a0ce7fd1a1f9ef168adeccbaa0241ec420af73cdee86d`

Dependency reuse was limited to the same verified package-lock bytes, copied into this isolated worktree's own directory. All combined gates above ran afresh, sequentially, with the bounded worker/heap configuration. No prior full-suite result was substituted for this integrated pass.

**Publication boundary:** append only this re-review to the existing #161 report, preserving both its original review and the complete author response. No implementation edit, older-report rewrite, formal review/comment, merge, deployment, paid/live call, private manuscript or user-computer operation. Publication verification and both exact report-head CI events are tracked separately without a recursive CI-only report commit.
