# PR Review — Draft Edit Slice 3b, part 2: word list and name consistency

**Author:** okeylanders · **PR:** [#176](https://github.com/okeylanders/prose-minion-vscode/pull/176)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `24842647296c3ba32eac1dfcb6a11dd01ab613e0`

**Base and merge-base:** `57489816467eac1e6e82a2a889487b7fc310cae9` (PR #174 merged, including PR #175)

**Scope:** 31 changed files · +1,253 / −75 · **Reviewed:** 2026-10-26 · **Reviewer:** Astra

## Summary

**Changes requested before integration into `epic/lightbox`: two P2 findings in the new host name check.** Its advertised work bound does not cover the expensive deletion generation/index construction, and valid setext/container headings still become name evidence. Two nonblocking consistency/coverage notes are also recorded below.

The new word list, request metadata, model-category boundary and flag-only integration otherwise behave as designed in the checks below. Names remain warnings with non-preferred suggestions: neither Fix nor Fix all applies them, while their own explicit Replace with uses the existing guarded applier. This is independent source and controlled-host verification, **not native VS Code or live-provider acceptance**.

## Findings

### F-01 · P2 · Deletion generation and index construction bypass the work budget

**Location:** [`nameConsistency.ts:108–120`](../../packages/core/src/utils/proofread/nameConsistency.ts#L108) and [`144–169`](../../packages/core/src/utils/proofread/nameConsistency.ts#L144).

The budget is created only after every common name's deletion index has been built. For a rare name, `deletionsOf(variant)` also materializes its complete set before `candidatesOf` checks the budget. The only charged work is the size of matching buckets, so generating signatures with no matches costs zero budget. `deletionsOf` has no token-length, signature-count or character-allocation bound; a length-n token can generate quadratically many strings of roughly length n.

**Independent Node 18 reproduction:** a deterministic 501-letter capitalized word made from `A` and 500 deterministic lowercase ASCII letters produces **125,711 distinct zero/one/two-deletion signatures**, already beyond the documented 100,000-entry limit. In `Then <word>.` (507 characters), the production check returns `checked` after approximately **551 ms**, despite there being no common name to compare. Repeating that sentence three times (1,523 characters) builds all 125,711 common-name index entries, then also returns `checked` after approximately **663 ms**. Neither case returns `stopped` or logs the promised skip. A separate 1,001-letter witness exhausted an explicitly capped 384 MiB subprocess before it could reach the budget; that bounded scratch failure is not a claim about VS Code's exact heap limit.

The bounded witness generates the token as follows (no private text):

```js
let seed = 9381;
const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const word = 'A' + Array.from({ length: 500 }, () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return alphabet[seed % 26];
}).join('');
```

This synchronous work runs before the provider call and covers the whole document even for a tiny selection. Thus a pasted long token can block or exhaust the extension host independently of the candidate-visit guard. The existing dense-short-name test covers bucket visits, not these unbounded allocations.

**Requested correction:** enforce a real work/allocation limit before and during signature generation and common-name indexing, with a defined conservative outcome for an oversized token. Keep the all-or-nothing `stopped` result and log rather than returning biased partial findings. Add witnesses for one oversized rare token with no candidates, an oversized common token with no rare variants, and many ordinary common names; assert the bound at the generation/index seam, not only the number of visited candidate buckets.

### F-02 · P2 · Setext and container headings are treated as prose names

**Location:** [`nameConsistency.ts:80–84`](../../packages/core/src/utils/proofread/nameConsistency.ts#L80) and [`272–274`](../../packages/core/src/utils/proofread/nameConsistency.ts#L272).

`HEADING_LINE` recognizes only top-level ATX headings. Markdown setext headings and headings inside blockquotes or lists remain in `uses` and `named`; the existing protected-region reader does not exclude them, since heading text is otherwise editable prose. This breaks the explicit exclusion of heading title case from name evidence.

**Independent reproduction**, using production protected-region handling and the repository's real Markdown parser: after three prose mentions of **Rose**, a heading **The Rise** has these results:

| Heading source | Actual name check |
| --- | --- |
| `# The Rise` | No variant — correct control |
| `The Rise` followed by `========` | Flags **Rise → Rose** |
| `> # The Rise` | Flags **Rise → Rose** |
| `- # The Rise` | Flags **Rise → Rose** |

Here *Rise* is an ordinary capitalized title word, not a misspelled character name. Heading occurrences can also alter the frequency ratios used for flags elsewhere. The resulting suggestion is non-preferred, so this does not claim an automatic write.

**Requested correction:** identify heading spans through the established Markdown block/container machinery, or an equivalently complete conservative reader, rather than only the top-level ATX regex. Cover setext, blockquoted and list-nested headings both as rare words and as frequency/evidence for common words, with ordinary prose controls.

## Nonblocking notes

### N-01 · P3 · Use one acceptance rule for hyphenated words

[`proofreadWordList.ts:84–91`](../../packages/core/src/utils/proofread/proofreadWordList.ts#L84) accepts a hyphenated word when every part is listed; [`nameConsistency.ts:123`](../../packages/core/src/utils/proofread/nameConsistency.ts#L123) checks only the whole key. With `['Glimmer', 'fox']`, `isAcceptedWord(..., 'Glimmer-fox')` is true, but `I saw Glimmer-fix and Glimmer-fix and Glimmer-fix. I saw Glimmer-fox.` still produces the host suggestion **Glimmer-fox → Glimmer-fix**. Consider sharing the acceptance predicate, or explicitly documenting a narrower rule for names. Listing the complete compound is a workaround; this is not a third merge blocker.

### N-02 · P3 · Resolve host precedence before pruning model/model overlaps

[`draftEditPlacement.ts:94–104`](../../packages/core/src/application/services/draftEdit/draftEditPlacement.ts#L94) first drops overlapping model findings, then removes those overlapping a host finding. In `Alice sat. We saw Alice. We liked Alice. We told Alcie come after teh ceremony.`, a model's broad missing-word quote `Alcie come after teh` suppresses its independent `teh → the` spelling finding; the host's **Alcie → Alice** then removes the broad finding. Only the name remains, with two overlaps counted, although the surviving name does not overlap `teh`. A full-use-case witness reproduces this. Filtering host-overlapping candidates first would retain the independent spelling issue. No write-safety defect is implied.

## Independent verification

Read the relevant agent guidance, full changed-file diff, Draft Edit ADR/amendment, Slice 3b plan, prompt and worked-example contracts, preceding review format, and unchanged placement/application/lifetime paths. No `.agents/skills` directory or dedicated review template exists in this checkout; this follows `docs/pr-reviews` conventions. The isolated cloud checkout's **complete tree and every fetched blob hash match GitHub** (`c82595ea71e3313553788b4b5f1805ceed6ac357`); the recorded base is an ancestor, not an untested divergent integration.

- **Word-list boundaries:** 266 independent cases cover invalid setting entries, normalization idempotence, NFC/decomposed forms, case, curly/straight apostrophes, possessives, whole-word boundaries and hyphenated parts. The separate N-01 witness records the acceptance mismatch rather than treating it as a pass.
- **Name matching:** 1,500 deterministic ASCII mutation pairs agree with an independent full-matrix optimal-string-alignment oracle, covering insertion, deletion, substitution and adjacent transposition across lengths 3–14. The explicit F-01/F-02 reproductions complement, not replace, the repository's ratio, ties, lower-case, plural, skip-context and budget tests.
- **Live host behavior:** 12 independent production-use-case/applier probes pass: prefix edits move the same name occurrence; editing it makes it stale; newly inserted inline-code protection suppresses it; document close shows nothing; partial-name selections produce no out-of-selection flag; mixed Fix applies only the mechanical spelling issue; Fix all leaves names untouched; individual Replace follows the live location; possessive replacement preserves its suffix; selection runs keep outside flags; accepted drops are not reported as unplaced; cancellation keeps prior flags; and Clear during a held Replace does not resurrect leftovers. Several assertions share one scenario; the count is 12 probes, not a native UI test count.
- **Contracts and privacy:** the setting is read and normalized at the gesture, carried on the pass, and sent only for matching words in each already-masked chunk. The prompt teaches `acceptedWords` as quoted data; the model codec cannot forge the host-only `name` category. New findings join the existing lifetime, protection, selection, annotation and applier paths. No new persistence store, webview writer-text state or write authority was introduced; logs record counts, not names.

Runtime: **Node 18.20.8 / npm 10.8.2**. Retained dependencies were reused only after verifying identical lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; aliases resolve to this checkout. Scratch probes are separate from the full typed repository suite.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest | Pass: **562 suites / 7,846 tests / 59 snapshots**, 534.967 s, exit 0 |
| Independent probes | 266 word-list cases; 1,500 OSA comparisons; 12 host scenarios pass, plus explicit finding witnesses |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40392904538](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40392904538), all verify steps passed |
| Exact implementation-head PR CI | [Success, 40392982507](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40392982507), all verify steps passed |

The aggregate suite emitted the existing ts-jest configuration deprecation warning; no worker-teardown warning appears in the captured log.

Scratch evidence and logs remain outside the checkout in `../pr176-review-evidence/`. Reviewer changes are confined to this report: no source fixes, repository-test changes, dependencies, formal GitHub review/comments, merge, connected-Mac access or provider calls.

## Integration and remaining acceptance

**Hold for F-01 and F-02, then re-review the corrected head for integration into `epic/lightbox`.** Exact report-head CI is checked separately after publication; an implementation/base advance requires a delta or integration recheck.

Native VS Code acceptance (workspace setting, Problems and quick-fix UI) and live fixture false-positive rates remain unrun and separate. PR #172's explicitly accepted native-preview lifetime race remains **not fixed**, not reopened by this review; no global preview-discard mechanism was reintroduced. Slice 3b part 3 and queued Slice 3c are plans, not implementation-approved by this report.


## Author response — 2026-10-26

**Head:** the fixes are `93034da4` and the docs `efb709ee`; the test inventory and this response are the commit after them. Both P2 findings are fixed, and both notes are taken.

### F-01 · fixed in `93034da4`

You're right: the budget charged only the index entries a lookup visited, so making and indexing deletions cost nothing. Now all the work is charged where it is generated:

- **No word over 20 letters is a name** (`maximumLength`). So no one word makes more than 211 deletions, and an oversized token has a defined, conservative outcome: it is never read as a name, and costs nothing.
- **Every unit of work is charged before it is done:** each deletion made, indexing or looking up; each index entry visited; and each pair of names compared. A charge that would pass `workBudget` (250,000) is refused, and the check stops: it finds nothing, the host logs why, and nothing partial is shown. Either result reports the work spent, so the bound is asserted where the work is made.
- **Your witnesses are tests:**
  - your deterministic 501-letter word, once and three times: `checked`, no variants, work 0;
  - the 20- and 21-letter boundary;
  - 2,000 common 20-letter names: it stops while indexing, within the budget;
  - a small chapter's work, pinned exactly at 42: 16 deletions for *Alice*, 16 for *Alcie*, 9 index entries and 1 comparison. Leaving out any of the four charges changes it.
- **Measured on Node 18:**

  | Document | Work | Time | Result |
  | --- | --- | --- | --- |
  | A novel: 4,500 distinct names, 70,500 words | 121,845 | 139 ms | checked |
  | 10,000 near-alike names (10-letter alphabet, one initial) | 250,000 | 688 ms, of which reading 106 | stopped |
  | 6,000 names of 15 to 20 letters, 123,000 words | 250,000 | 547 ms, of which reading 142 | stopped |

  Reading the document is linear and is not charged; the name work stays under about 0.6 s beyond it.

### F-02 · fixed in `93034da4`

Confirmed: the line pattern knew only top-level ATX headings. The Markdown block reader already visits every heading wherever block quotes and lists put them. It now records each one as whole source lines, a setext underline included. `readDocumentRegions` returns the headings beside the protected regions from one reading, and the host read skips both. The pattern is gone. Plain text has no headings, as it has no protected regions.

- **Your table is a test** (`DraftEditNames.test.ts`): *The Rise* as an ATX heading, a setext heading, in a block quote and in a list item flags nothing beside *Rose*. The same words mid-sentence in prose flag *Rise → Rose*, as the control.
- **Frequency too:** *Alice* used twice in prose and once in a setext, block-quoted or list heading leaves *Alcie* alone. The third use in prose flags it.
- **The reader's own tests** cover ATX (closed, indented), setext with `=` and `-`, in a block quote, in a list item, setext in a block quote, and a list in a block quote. Paragraphs, plain text and fenced code have no headings, and the protected regions match `findProtectedRegions`.

### N-01 · taken

The name check now asks the word list's own `isAcceptedWord`, so `['Glimmer', 'fox']` accepts *Glimmer-fox* there too. Your witness is a test, with `['Glimmer']` alone still flagging it.

### N-02 · taken

`placeFindings` now drops a model issue overlapping a host issue before weighing model issues against each other. Your witness is a test: *Alcie* and *teh* are both flagged, and one overlap is counted.

### Verification

| Check | Result on `93034da4` |
| --- | --- |
| Node 18.20.8 typecheck | Pass: core, webview and adapter |
| Node 18.20.8 full Jest | **562 suites / 7,870 tests / 59 snapshots**, exit 0 (24 tests more than `24842647`) |
| Node 18.20.8 lint | Pass: 0 errors / 1,133 existing warnings |
| Node 18.20.8 build (incl. `verify:bundle`) | Pass; the three existing webpack size warnings |
| Mutations | Each of ten fails a test: headings recorded, headings skipped, the maximum length, each of the four charges, a charge allowed to overshoot, N-01, and N-02 |

The ADR's "As built (part 2)" note, the slice doc, the agent guide and the memory bank say the same. Your report above is unchanged; this response is appended.
