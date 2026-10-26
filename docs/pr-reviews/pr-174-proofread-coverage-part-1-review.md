# PR Review — Draft Edit Slice 3b, part 1: categories and narration baseline

**Latest disposition — re-review of `f06b2afc`: Changes requested. F-02 is resolved; F-01 remains for possessives and trailing elisions inside single-quoted speech. See the re-review section below.**

**Author:** okeylanders · **PR:** [#174](https://github.com/okeylanders/prose-minion-vscode/pull/174)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `e100ef6c6bb56b4e711b923e666edc1a9c12eccc`

**Base and merge-base:** `611bebd63cd782c481c55768c53ff8af840517c8`

**Scope:** 23 changed files · +756 / −68

**Reviewed:** 2026-10-26 · **Reviewer:** Astra

**Mode:** independent complete-diff and contracts review; production baseline, service, codec, use case and VS Code adapters exercised with public-domain Alice adaptations and controlled host/transport doubles; Node 18 aggregate gates. No native VS Code or live provider run.

## Initial review summary (`e100ef6c`)

**Changes requested before integration into `epic/lightbox`: two P2 findings in the new narration baseline.**

The four new categories correctly remain warnings with non-preferred suggestions. Neither Fix nor Fix all applies them; an explicit individual Replace with does. The new summary and request metadata integrate correctly, and PR #173's optional Flag-versus-Fix documentation clarification is addressed.

The baseline does not yet uphold two advertised contracts: single-quoted multi-sentence dialogue can become narration, and the sentence sampler does not actually bound the words given to the synchronous tagger. Both are deterministic host-code defects, distinct from the still-unrun model-quality fixture acceptance.

## Findings

### F-01 · P2 · Interior sentences of single-quoted speech contaminate narration

**Location:** [`narrationBaseline.ts:79–83`](../../packages/core/src/utils/proofread/narrationBaseline.ts#L79), with the sentence-local check at lines 142–151.

`findDialogueSpans` intentionally matches double quotes only. The additional `holdsQuotationMark` filter runs independently on each sentence, so only a single-quoted speech's opening and closing sentences are excluded. An interior sentence has no quotation mark and is tagged as narration. This affects both straight and curly single quotes, including quoted thought.

**Independent reproduction:** wrap twenty repetitions of this Alice-derived passage in one pair of single quotation marks:

> I am beginning to get very tired of sitting by my sister on the bank. I have nothing to do. I see no pictures in the book.

| Input | Actual baseline | Required behavior |
| --- | --- | --- |
| Only that single-quoted monologue | `{tense: 'present', person: 'first'}` | No narration baseline from speech |
| Existing `ALICE_THIRD_PAST` fixture, then the monologue | `{person: 'first'}` | Preserve `{tense: 'past', person: 'third'}` |
| Same added speech, but double-quoted | `{tense: 'past', person: 'third'}` | Correct control |

The source narration alone is measured past/third. These observations use the real sentence splitter and tagger, not fabricated POS tokens. The chapter-plus-speech case changes the metadata sent to every chunk: it removes the known past baseline and prevents the prompt from reporting person slips, since that prompt allows them only against named third-person narration. A longer speech can similarly supply its present tense.

**Requested correction:** exclude the *whole* single-quoted speech region (or conservatively the relevant enclosing scope when ambiguous), including interior sentences, while retaining the deliberate handling of contractions and possessives. Add multi-sentence straight- and curly-single-quoted controls, speech-only and appended to known narration. Do not alter the shared Lightbox dialogue rule without its separate compatibility contract; a narration-specific conservative exclusion is sufficient.

### F-02 · P2 · Sampling by sentence index does not bound synchronous tagger work

**Location:** [`narrationBaseline.ts:113–116`](../../packages/core/src/utils/proofread/narrationBaseline.ts#L113), consumed synchronously at line 90.

`every = ceil(totalWords / sampleWords)` limits the *number of selected sentences*, not their total length. Selecting every kth sentence can preferentially select long sentences, and the first sentence is always selected regardless of its size. There is no remaining word budget or oversized-sentence handling. Thus `sampleWords: 20_000` is not an upper bound, despite the ADR, slice documentation and PR's extension-host responsiveness claim.

**Independent reproductions, instrumenting only the tagger input:**

- A 35,400-word passage of 600 pairs of alternating Alice-derived sentences, 56 words then 3 words, sends **33,600 words** to the tagger. These are ordinary sentence lengths, not one pathological sentence.
- A 55,000-word unpunctuated draft sends **all 55,000 words**. Increasing that one sentence increases the tagger input without limit.

The tagger is synchronous on the extension host, and even a tiny selection run measures the whole document. This reintroduces document-size-dependent blocking before the provider call. The existing long-book test happens to use similarly distributed sentence lengths and checks a 10% tolerance; it does not establish a bound for other sentence distributions.

**Requested correction:** enforce an actual word/work budget while retaining coverage across the document, with defined behavior for a single oversized sentence. Add heterogeneous-sentence and one-oversized-sentence tests that assert the real budget rather than only one repeated fixture's sample size. Update any “up to” claims if a deliberately bounded overshoot is chosen.

## Independent verification

Read the repository agent guidance, Draft Edit ADR and Slice 3b amendment, slice plan, every changed source/test/prompt/document, and the unchanged placement, application, annotation and lifetime contracts. No repository `.agents/skills` directory or dedicated review template exists; this follows the established `docs/pr-reviews` format.

### What passed

- **Categories end to end:** raw framed replies pass through the production reader and codec into the use case and real `VsCodeDocumentEditor` / `VsCodeIssueAnnotator` over the controlled host. All four new categories produce warnings and non-preferred suggestions. Flag, Fix and Fix all leave them alone. Each explicit individual replacement applies only its chosen correction and retains the other flags.
- **Mixed review:** a preview containing the four new categories plus an old mechanical typo offers only the mechanical fix. Applying it leaves all four judgment flags and the correct summary count. A run containing only the new categories opens no edit preview.
- **Lifetime and location:** a new-category occurrence edited during the held response is dropped as stale rather than searched for again; closing the document before reply suppresses the flags. No new native-preview lifetime mechanism is introduced.
- **Baseline capture and payload:** the whole gesture snapshot is measured once, including for a selection. Quick fixes do not measure again. A real multi-chunk use-case → service execution sends the same narration and spelling metadata beside every chunk, not as part of the passage; absent, empty and partial baselines serialize correctly. Instruction-shaped quoted data cannot create outer metadata.
- **Protection:** fenced code, nested fenced code, inline code, front matter, HTML comments and raw script blocks do not contaminate the baseline; protected content remains absent from the provider passage. Double-quoted multi-sentence speech is excluded correctly.
- **Tagger failure:** throwing at the actual `tagTextTokens` seam is caught by the use case; the run completes without narration metadata and logs the controlled reason. This is independent of the repository test that stubs the entire estimator.
- **Prompt, summary and architecture:** the new category vocabulary and worked example remain aligned; no write authority is widened. Core has no VS Code dependency, and no new `any` or upward import was added. Changed production modules remain below 500 lines (`DraftEditUseCase.ts`: 483). Implementation and report whitespace checks pass.

### Gates

Dependencies were reused from the retained review environment, not freshly installed. The lockfile matches the preceding reviewed checkout byte for byte (SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`), and aliases resolve to this isolated checkout. Local gates used **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| Typecheck | Pass: core, webview and adapter |
| Lint | Pass: 0 errors / 1,133 existing warnings |
| Production build + `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full repository Jest | Pass: **555 suites / 7,734 tests / 59 snapshots**, exit 0 |
| Independent scratch suites | Pass: **3 suites / 32 tests**; includes explicit reproductions of F-01/F-02, not assertions that those defects are fixed |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40363614353), exact head `e100ef6c` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40363684988), exact head `e100ef6c` |
| Whitespace | Pass |

Representative commands:

```sh
npm run typecheck
npm run lint
npm run build
npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB \
  --cacheDirectory=../retained-jest-cache
```

Scratch-only evidence and logs are retained outside the checkout in `../pr174-review-evidence/`. The independent host double needed a direct-apply response and the selection fixture needed sufficient narration for the specified person threshold; those harness adjustments are not product defects. No source, tests, manifest, dependencies or prior report was changed by the reviewer.

## Integration and remaining acceptance

**Hold PR #174 for F-01 and F-02, then re-review the corrected head and its exact-head CI.** These findings concern the new estimator; they do not authorize widening any new category from flag-only to fixable.

PR #175 is being reviewed independently against the same current epic base. Its current changed-file list has no direct overlap with this implementation. This report does not approve its changes or the combined merge result; recheck the integration tree after either branch changes. Slice 3b parts 2 and 3 are decisions/plans, not implemented or cleared here.

**PR #172 F-02 remains explicitly accepted risk, not fixed:** native Refactor Preview can commit after a lifetime/language change, then the run reports closed and suppresses flags. This PR does not regress that accepted behavior or restore global Discard. Native VS Code warning/lightbulb/preview interaction and live provider false-positive rates remain separate acceptance work. No connected Mac, live/billable provider, implementation edit, merge, deployment, formal GitHub review or PR comment was used.

The report-only publication's exact-head CI is checked after publication and reported separately from the implementation-head result above.

## Author response — 2026-10-26

**Correction head:** this response's commit (base `611bebd6`, unchanged). F-01 and F-02 are fixed in `95319050`; the docs are in `9b59f59f`. Thank you for both reproductions: the tests now use them.

| ID | Status | Commits |
| --- | --- | --- |
| F-01 | Fixed: single-quoted speech is left out whole, its interior sentences included | `95319050`, `9b59f59f` |
| F-02 | Fixed: the tagger reads at most `sampleWords` words, chosen by word position | `95319050`, `9b59f59f` |

### F-01 — single-quoted speech left out whole

- **The detector.** `singleQuotedSpans` (`narrationBaseline.ts`) is narration-only and reads each paragraph's single quotation marks, straight and curly:
  - A mark between two letters or digits is an apostrophe.
  - Otherwise a mark with nothing word-like before it opens a span, and one with nothing word-like after it closes the open span.
  - A span still open at its paragraph's end runs to it, as speech running over several paragraphs is written. An elided "'tis" also opens one, which only leaves more out.
  - A closing mark with nothing open, a plural possessive, opens nothing.
- **How it joins the baseline.** Its spans join the double-quoted dialogue and the protected regions that sentences are checked against. The per-sentence quotation-mark check stays as a second net. The shared Lightbox dialogue rule is unchanged, as you asked.
- **One sweep.** Exclusion is now one sorted sweep over sentences and ranges, not a scan of every range for every sentence, since the range list grew.
- **Tests** (`narrationBaseline.test.ts`, "Single-quoted speech is left out whole"):
  - your monologue, twenty sentences in one pair of straight and of curly single quotation marks: alone it names nothing, and after the opening it leaves `{past, third}`;
  - the same speech over three paragraphs, the first two unclosed;
  - your double-quoted control;
  - a plural possessive in narration with nothing open.

  Without the detector, the three speech cases fail.
- **A stated limit.** A single quotation mark nested inside single-quoted speech closes that speech early, so the sentences after it, up to the outer close, can count as narration. British style nests double marks inside single ones, and the dialogue rule leaves those out, so I left this as a limit.

### F-02 — a real word budget

- **Pieces.** A sentence over `NARRATION_BASELINE.sentenceWords` (500) is read in pieces of 500 words, so an unpunctuated draft is sampled like any other.
- **The budget.** Pieces are taken by word position: a piece is taken while the words taken lag the budget's share of the words seen, and only if it still fits. The tagger never reads more than `sampleWords` (20,000) words, and the sample still spans the document.
- **Tests** ("The tagger reads at most sampleWords words, across the whole document"):
  - your witness, 600 pairs of 56- and 3-word sentences (35,400 words);
  - a 55,002-word unpunctuated draft, whose last tenth (a different word) must appear in the tagger's input;
  - the long-book test, which now asserts the budget exactly, with no 10% tolerance.

  Each asserts the tagger's actual input against the budget. Restoring every-k-th sampling fails all three; leaving long sentences uncut fails the draft's.
- **The claims.** The ADR's Slice 3b amendment, the slice doc, the agent guide and the memory bank now state the bound as built: at most 20,000 words.

### Verification

| Check | Result |
| --- | --- |
| `npx jest` | 555 suites / 7,741 tests / 59 snapshots, under Node 18.20.8 and Node 22 |
| `npm run lint` | 0 errors / 1,133 warnings (unchanged) |
| `npm run typecheck` | Pass, under Node 18.20.8 |
| `npm run build` (incl. `verify:bundle`) | Pass, under Node 18.20.8 |
| Mutations | No single-quoted spans: 3 tests fail. Every k-th sentence: 3 fail. No pieces: 1 fails |

Your report above is unchanged; this response is appended. No new category was made fixable.


## Re-review — first corrections (`9b59f59f`), 2026-10-26

**Reviewed branch head:** `f06b2afccb58cc4596c2e178cbc49d4bea1b8df3` (implementation `95319050`, documentation `9b59f59f`, author response/inventory `f06b2afc`). Local gates ran at `9b59f59f300723d3c2bb3a0d0e7741eec0208555`; the subsequent commit changes only the report and test inventory, with all implementation bytes identical. The full correction delta and author response were independently inspected; the response is retained above. The branch derives from `611bebd6`; the actual epic ref advanced to `44127c92` when PR #175 merged during this re-review. Final combined-tree acceptance remains pending while F-01 is open.

**Disposition: changes still requested for F-01. F-02 is resolved.**

### F-01 remains · P2 · A possessive or trailing elision inside speech closes its exclusion early

The original simple multi-sentence monologue is now excluded, including its interior sentences. However, [`collectSingleQuoted`](../../packages/core/src/utils/proofread/narrationBaseline.ts#L147) treats every single mark with no word character immediately after it as the end of an open speech (lines 162–164). A plural possessive or trailing elision has exactly that shape.

For a curly-quoted reproduction, put this at the beginning of the same monologue, inside its opening `‘` and final `’`:

> I am sitting by the sisters’ bank.

The apostrophe after `sisters` prematurely ends the exclusion. The remaining unquoted-looking interior sentences are again tagged as narration. The fully quoted passage alone yields `{tense: 'present', person: 'first'}`; appending it to `ALICE_THIRD_PAST` yields `{person: 'first'}` instead of past/third. Straight-quoted speech with `sisters'` fails identically. Replacing that opening sentence with “I am sittin’ by my sister on the bank.” reproduces the same leak for a trailing elision, in both quote styles. These four controls use the real production tagger.

The author response acknowledges nested single quotation marks as a limit. These witnesses are **ordinary possessives and elisions, not nested quotations**; using the usual British single-outside/double-inside quotation convention does not avoid them. The new repository possessive test covers a possessive **outside** speech, when no span is open; it does not cover this case. This is the same F-01 contract still incomplete, not a new restriction on dialect or a request to change the shared Lightbox matcher.

**Required:** when single-quote/apostrophe roles are ambiguous inside speech, keep the ambiguous enclosing scope excluded rather than releasing subsequent speech sentences into the baseline. A conservative narration-only paragraph exclusion is acceptable. Add plural-possessive and trailing-elision-in-speech controls, both straight and curly, alone and following known narration.

### F-02 resolved

The corrected sampler counts actual words, refuses a piece that would exceed the budget, and splits oversized sentences into at most 500-word pieces before sampling by word position. The original heterogeneous-sentence and 55,000-word single-sentence witnesses now stay at or below 20,000 words. The long-book prologue control and coverage of the end of an oversized sentence pass. The new `clearOf` sweep also avoids the former per-sentence full exclusion-list scan. The shared dialogue matcher is unchanged.

### Re-review verification

| Check | Result on `9b59f59f` |
| --- | --- |
| Node 18 typecheck | Pass: core, webview and adapter |
| Node 18 lint | Pass: 0 errors / 1,133 existing warnings |
| Node 18 production build + bundle verification | Pass; three existing webpack size/performance warnings |
| Node 18 full Jest | **555 suites / 7,741 tests / 59 snapshots**, exit 0 |
| Independent scratch suites | **3 suites / 36 tests pass**, including four residual F-01 witnesses and corrected F-02 bounds |
| Exact branch-head CI (`f06b2afc`) | [Push](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40376887459) and [pull request](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40376897243): completed/success |

The unchanged category/application/payload/lifecycle witnesses were rerun against this head, not merely inferred from the original review. The source module remains below the 500-line limit (261 lines); no new host dependency, shared measurement-rule change or widened write authority was introduced. Scratch evidence is in `../pr174-rereview-evidence/`; only this report is published. Native VS Code and live provider-quality acceptance, and the explicitly accepted PR #172 preview limitation, remain separate as above.


## Author response — re-review, 2026-10-26

**Head:** the fix `cecdac55`; `epic/lightbox` at `44127c92` (PR #175) merged in as `45194c86`; the docs `ff32a6e3`; and this response with the test inventory. The gates ran on `45194c86`'s tree, and the commits after it change only documentation.

### F-01 · fixed in `cecdac55`

You're right: these are ordinary possessives and elisions, not nested quotation marks, and the limit I stated didn't cover them.

- **The rule.** An open span now closes only at a mark after closing punctuation (`?’`, `,’`, `—’`) with nothing word-like after it (`closesSpeech`). A mark after a letter may close the speech or belong to its word, so it leaves the span open, to its paragraph's end if nothing closes it. Opening is unchanged: a mark after a letter or digit opens nothing. The shared dialogue rule is untouched, and `narrationBaseline.ts` is 267 lines.
- **Your four witnesses are tests:** plural possessive and trailing elision, straight and curly. Each names nothing alone, and past and third after the opening.
- **One more, of the same shape:** a leading elision after a dash inside speech (`—’tis`), straight and curly. There is punctuation before the mark but a word after it, so it does not close.
- **The other direction:** speech closed after punctuation, followed by the opening's narration in the same paragraph, still names past and third. A rule that ran every span to its paragraph's end would fail it.
- **Mutations:**
  - the old close rule (any mark with no word after it) fails 4 tests;
  - never closing fails 2;
  - closing after punctuation even before a word fails 2.
- **The cost, stated:** a quoted word closed after a letter ("the word ‘jam’ was"), or speech closed after a letter ("‘Off with her head’ said"), takes the rest of its paragraph out of the baseline. That only leaves narration out. A document left with too little names nothing, and the prompt falls back to the passage's own narration.

The ADR's Slice 3b row, the slice doc, the agent guide and the memory bank say the same.

### Combined tree

`epic/lightbox` at `44127c92` is merged in as a merge commit, with no conflicts. PR #175 touches only Lightbox files and none of this PR's. Everything below ran on the combined tree.

| Check | Result on `45194c86` (combined tree) |
| --- | --- |
| Node 18.20.8 typecheck | Pass: core, webview and adapter |
| Node 18.20.8 full Jest | **559 suites / 7,780 tests / 59 snapshots**, exit 0: `epic/lightbox`'s 556 / 7,741 (your PR #175 report) and this PR's 3 / 39 |
| Node 18.20.8 lint | Pass: 0 errors / 1,133 existing warnings |
| Node 18.20.8 build (incl. `verify:bundle`) | Pass; the three existing webpack size warnings |
| Mutations | Old close rule: 4 tests fail. Never closing: 2 fail. Closing before a word: 2 fail |

Your report above is unchanged; this response is appended. No new category was made fixable.
