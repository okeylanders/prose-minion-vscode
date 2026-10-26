# PR Review — Draft Edit Slice 3b, part 1: categories and narration baseline

**Author:** okeylanders · **PR:** [#174](https://github.com/okeylanders/prose-minion-vscode/pull/174)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `e100ef6c6bb56b4e711b923e666edc1a9c12eccc`

**Base and merge-base:** `611bebd63cd782c481c55768c53ff8af840517c8`

**Scope:** 23 changed files · +756 / −68

**Reviewed:** 2026-10-26 · **Reviewer:** Astra

**Mode:** independent complete-diff and contracts review; production baseline, service, codec, use case and VS Code adapters exercised with public-domain Alice adaptations and controlled host/transport doubles; Node 18 aggregate gates. No native VS Code or live provider run.

## Summary

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
