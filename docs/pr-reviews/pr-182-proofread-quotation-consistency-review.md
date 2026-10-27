# PR #182 — Proofread quotation marks and spelling consistency review

## Scope and disposition

- **PR:** [#182](https://github.com/okeylanders/prose-minion-vscode/pull/182)
- **Reviewed head:** `4ff69dde890344ec038fb9cae4a8e07ae3471272` (`claude/upbeat-galileo-y1l4yf`)
- **Base:** `1b2b3ac92ec9ec206a35e15cb1c1f8e3430d7e7c` (`epic/lightbox`)
- **Reviewed:** 2026-10-27; Slice 3b part 3, both host checks, their table, placement/annotation/individual-application path, protected text, and the existing host/model boundary.
- **Disposition: changes requested in this report.** Three P2 findings remain. F-01 offers a replacement for the wrong source range; F-02 bypasses an explicitly accepted word; F-03 produces two warnings on valid formatted dialogue. None is covered by the explicitly documented inch-mark, mixed-case, or “all right” limitations.

This is a report-only review, not a formal GitHub review submission. No implementation changes or merge/release actions were made.

## Findings

### F-01 — P2: derive compound-part offsets from the original text, not its lowercase key

**Location:** `packages/core/src/utils/proofread/spellingConsistency.ts:148–155`, with `keyOf` at `169–171`.

The hyphen walk splits the lowercased lookup key, then advances source offsets by those normalized parts' lengths. Unicode lowercase conversion need not preserve UTF-16 length: U+0130 (`İ`) becomes `i` plus a combining dot. An ASCII initial capital makes `keyOf` lowercase the entire compound, including this character.

**Reproduction:** run Proofread and Flag on:

```text
Aİ-gray paint. The grey sky. The grey sea.
```

The host reports `[4,8)` with original `ray ` and replacement `grey`, instead of the actual `gray` at `[3,7)`. Choosing that issue's individual **Replace with** traverses the real `DraftEditUseCase.applyShown` and `DraftEditApplier`, returns `applied: 1 / refused: 0`, and writes:

```text
Aİ-ggreypaint. The grey sky. The grey sea.
```

The ASCII control `Ai-gray paint. The grey sky. The grey sea.` correctly becomes `Ai-grey paint…`. The existing anchoring/live-text checks cannot catch this: the host already records the wrong slice as its original. This is **not** an automatic Fix/Fix-all finding; these categories correctly remain flag-only, but their individually offered replacement must still name the actual word.

**Correction:** calculate each part's source span using the original compound and lowercase only for lookup, or retain an explicit original-to-key map. Cover a length-expanding character before a recognized part, exact diagnostic bounds, and individual application with surrounding text preserved. Rejecting an unsafe mapping is preferable to offering a shifted edit.

### F-02 — P2: keep the accepted whole-word context when flagging a compound's part

**Location:** `packages/core/src/utils/proofread/spellingConsistency.ts:94–97`; the compound uses are reduced to subranges at `148–155`.

With `proseMinion.proofread.wordList: ["grey-green"]`, this text still receives a consistency warning and `grey → gray` replacement:

```text
A grey-green cloak. A gray sky. A gray sea.
```

The word-list normalizer preserves `grey-green` as one accepted word. `isAcceptedWord(keys, 'grey-green')` is true, and the chunk's accepted-word reader also recognizes it. But the new checker retains only the component's span and later asks whether `grey` is accepted, which is false. The real individual replacement succeeds and changes the explicitly accepted compound to `gray-green`.

This contradicts the setting/ADR promise that a listed word counts but is never flagged; accepting `grey-green` should not require globally accepting every standalone `grey` too.

**Correction:** retain or check the containing word's acceptance as well as the component's, while still counting that occurrence toward the document's spelling totals. Cover an accepted compound, an unlisted standalone component elsewhere, accepted individual parts, and the individual-application path.

### F-03 — P2: account for emphasis when deciding a quotation mark's role

**Location:** `packages/core/src/utils/proofread/quotationMarks.ts:128–132`, consumed at `95–108`.

The next-paragraph check explicitly skips emphasis markers, but the per-mark role check reads the immediate raw neighbor. For correct Markdown such as:

```markdown
She said, *“...and then?”*
```

`placeOf` sees `*` before the opening mark and `.` after it. It decides the opener is a closer, producing both **“This opening quotation mark … stands where a quotation closes”** and **“This closing quotation mark has no opening mark”**. Removing emphasis yields no warnings. The same problem occurs with straight quotes, strong emphasis, underscore emphasis, a single ellipsis character, or an initial em dash (`*“—No!”*`). These are ordinary valid dialogue/formatting combinations, not missing quotation marks.

**Independent production-path controls:** 40 scenarios through `DraftEditUseCase` and the annotation port: 24 false-positive witnesses (two quote styles × four emphasis wrappers × three initial punctuation forms), and 16 clean controls (unformatted punctuation and formatted text without initial punctuation). The unwanted annotations have no replacement, as intended, but still misdiagnose correct text.

**Correction:** use consistent prose/markup-aware boundary context for the mark's role and continuation detection, preserving the original offsets and bounded scan. Keep genuine missing/reversed-mark witnesses alongside formatted balanced controls; do not broadly turn off quotation checks in emphasized text.

## Architecture and behavioral review

- The two checks are pure, host-agnostic utilities. `draftEditHostRead` remains the whole-document owner; the VS Code composition root and core boundary are unchanged. No new `vscode` import or `any` is introduced in the changed core implementation.
- The closed host category list keeps model-produced `quotation`/`consistency` replies malformed. Host findings take precedence over overlapping model issues, and a selection run filters findings against the selected source range after reading whole-document context.
- Both categories retain `flag` disposition. Quotations carry no replacement; consistency replacements are non-preferred and are excluded from Fix/Fix all. F-01/F-02 concern the separate, intentionally supported individual replacement path.
- The fixed table keeps paired inflections explicit, with uniqueness/shape tests; conventions are applied only after both sides occur. Ties without a deciding convention remain silent. Accepted occurrences count toward preference. The documented limits are not treated as additional findings.
- The new modules are below 500 lines and follow semantic aliases. The change adds no provider calls, persistence format, cross-layer dependency, or new mutable model state.

## Independent verification

Read `AGENTS.md` (the `.ai/central-agent-setup.md` symlink), the Draft Edit ADR and slice notes, changed tests/implementation, and adjacent word-list, protection, placement, annotation and applier contracts. No repository `.agents/skills` directory or dedicated review template exists; this follows the existing `docs/pr-reviews` format.

Checks run in an isolated cloud worktree on **Node 18.20.8 / npm 10.8.2**. Retained dependencies were copied after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; the workspace package resolves to this checkout.

| Check | Independent result |
| --- | --- |
| Typecheck | Passed: core, webview and adapter |
| Lint | Passed: 0 errors / 1,133 existing warnings |
| Production build, including `verify:bundle` | Passed; three existing webpack size/performance warnings |
| Full typed Jest, `--runInBand` | Running at initial publication; the terminal result will be recorded separately |
| Diff hygiene | `git diff --check` passed |
| Exact implementation-head push CI | [40574686321: success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40574686321) |
| Exact implementation-head PR CI | [40574772111: success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40574772111), every verify step passed |

Scratch evidence is outside the repository in `../pr182-review-evidence/`: production utility probes, the three spelling application scenarios, 40 quotation use-case scenarios, and aggregate logs. The pass replies are controlled; production use cases/applier and the repository's fake document/annotation ports perform placement and application. No paid/live inference or native VS Code execution was performed. These findings do not depend on a model response or on the native Refactor Preview lifetime race accepted for PR #172.

## Integration and remaining acceptance

Resolve **F-01, F-02 and F-03** before integration, with regression witnesses and controls. Corrected code requires independent delta review and final-head checks. The exact report-only commit will be verified remotely, and its CI followed separately.

Native editor rendering/interaction and live editorial acceptance remain separate from automated host-side correctness. The reviewer has not merged, released, modified source/tests/dependencies, rewritten prior reports, posted comments/formal reviews, or accessed the connected Mac.

## Verification completion — 2026-10-27 20:36 UTC

The full independent typed Jest run on implementation `4ff69dde` completed successfully: **589 suites / 8,330 tests / 59 snapshots**, **558.431 s**, exit 0. All local aggregate checks now pass, together with the previously completed typecheck, lint and production build.

Report commit `069e76b5dc85b537ef846ce051a2fdfffd077757` was verified remotely as exactly this new report path, with parent `4ff69dde890344ec038fb9cae4a8e07ae3471272`, matching the submitted bytes. Its [push CI 40578061470](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40578061470) and [PR CI 40578072613](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40578072613) both completed successfully; every verify step passed.

**Disposition unchanged: F-01, F-02 and F-03 remain open and require correction.** Green regression checks do not cover the independent counterexamples above. Native/live acceptance remains separate. The exact head created by this verification appendix will be checked independently after publication.

## Author response (`5fd75565`)

**All three are taken.** Your report above, through the verification appendix, is unchanged. Each counterexample now passes through the production use case and applier, and each fix has a witness that fails on `4ff69dde`.

### F-01: a compound's parts are placed where they are written

The hyphen walk now splits the word as written for offsets, and the lowered word only to look each part up (`spellingConsistency.ts`, `usesOf`). Lowering never adds or removes a hyphen, so the two splits pair index by index. A flag's bounds, its original and the case of its replacement all come from the part as written.

- `Aİ-gray paint. The grey sky. The grey sea.` flags `[3,7)`, `gray`, with *Replace with* `grey`; choosing it through `DraftEditUseCase.applyShown` and `DraftEditApplier` writes `Aİ-grey paint. The grey sky. The grey sea.` and nothing else.
- Controls: the ASCII `Ai-gray …` flags the same bounds; a later part after two expanding characters (`Aİİ-paint-gray`) is placed exactly.

I did not reject the mapping instead: with offsets taken from the word as written there is no shifted edit left to reject, and the part is still read.

### F-02: a listed compound keeps its parts

Each use now also records the start and end of the word that holds it (`STRIDE` 5). Before a use is flagged, the word list is asked about the use, then, when the use is part of a hyphenated word, about that word whole. A listed compound still counts toward the document's totals.

- With `grey-green` listed, `A grey-green cloak. A gray sky. A gray sea.` is not flagged. `blue-grey` listed keeps a later part too.
- The compound still counts: two listed `grey-green` against one `gray` flags the `gray`.
- `grey` written alone elsewhere is still flagged, alone: only its own range, never the compound's part. Its individual *Replace with* writes `gray dawn` and leaves `grey-green` as written.
- A listed part (`grey`) still keeps its uses, alone and in a compound.

### F-03: emphasis is read past

`placeOf` now reads a mark's neighbours past the `*` and `_` written beside it, within the paragraph, so `*“...and then?”*` places its marks as `“...and then?”` does. A run of markers is read only by the marks beside it, so the walk stays linear, and offsets are untouched. The next-paragraph check now asks `placeOf` too: a paragraph's first mark continues the speech before it exactly when the paragraph's own reading gives that mark the role "open".

- Your 24 witnesses pass as balanced: two quote styles × `*`, `**`, `_`, `__` × `...`, `…`, `—` (`quotationMarks.test.ts`), plus a paragraph that is only `*“...and then?”*`. Through the use case, three such sentences in one paragraph flag nothing.
- Slips inside emphasis are still flagged, one per kind: left open (`*“...and then?*`), a misshaped opener (`*”No!”*`), a misshaped closer (`_“Who are you?“_`), a closing mark with nothing open (`**”**`), and one left open before the next (`*“...and then?* *“Who are you?”*`). Through the use case, the left-open control flags its mark.
- Continuation reads past emphasis both ways: `*“...And yet …”*` continues the speech before it; `”*...*` is a closing mark its place leaves undecided, so it continues nothing, and both slips are flagged.
- One older test moved. `She whispered *"Hello"* …` was the witness for a straight mark whose place says nothing. With emphasis read past, its place now decides, so the witness is `Alice could answer "yes"/"no" and nothing else.`, where the slash leaves the place undecided. The emphasis sentence stays as a balanced case.

### Controls

- **Mutations: 34, each caught by a failing test.** The 24 from the PR, their patterns updated, plus:
  - F-01: parts placed by the lowered word;
  - F-02: the compound's acceptance not asked; the holding word's end, or its start, not kept;
  - F-03: emphasis not read past before the mark, or after it; `_` not emphasis; `*` not emphasis; the backward read stopping one short of the paragraph's start; the next-paragraph check reading the raw neighbour.
- **The witnesses against `4ff69dde`:** with only the two source files reverted, 8 tests fail: the five new unit tests and the three new use-case tests.

### Verification

Node 18.20.8 / npm 10.8.2 on `5fd75565`:
- typecheck passes;
- Jest 589 suites / 8,338 tests / 59 snapshots;
- lint 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes;
- `git diff --check` passes.

All ran on `5fd75565` before it was pushed. `quotationMarks.ts` is now 191 lines and `spellingConsistency.ts` 216. No provider calls were made. The ADR's "As built (part 3)" note, the slice doc and the memory bank record the three changes.

## Independent re-review — 2026-10-27 21:04 UTC

Reviewed correction `5fd75565` and author-response head `391a4b4cefe7bcb9a0824addbdaa16fe4ff6903d`. The original report, verification appendix and author response above are preserved.

### F-01, F-02 and F-03 resolved

- **F-01:** the compound's original segments now determine source offsets; folded segments are lookup keys only. All original wrong-range witnesses now point to and replace the intended component. Surrounding Unicode, punctuation and whitespace survive individual application.
- **F-02:** each use retains its containing word's range. A listed compound's parts are no longer offered for replacement; its occurrences still count, and an unlisted standalone component remains independently flaggable.
- **F-03:** role inference reads past adjacent emphasis markers in both directions, and continuation detection shares that role decision. All 40 original formatted/plain quotation scenarios are now clean, while 48 additional emphasized genuine-slip controls retain their flags.

Independent scratch checks additionally passed **444 spelling scenarios** (every table inflection in both directions plus Unicode-offset/accepted-parent controls) and **33 production use-case/individual-application scenarios**. These are separate from repository Jest counts. No provider calls were made.

### F-04 — P2: cache the containing word's acceptance instead of reparsing it for every part

**New regression in the F-02 correction. Location:** `packages/core/src/utils/proofread/spellingConsistency.ts:97–100`, calling `proofreadWordList.ts:85–91`.

Every flagged component now calls `isAcceptedWord` on the entire containing compound. That helper reparses the entire string with `proofreadWords` **before** checking whether the accepted set is empty. A compound containing `k` recognized parts therefore incurs `k` whole-compound scans: quadratic synchronous work on the extension host, with no work budget. A nonempty unrelated word list has the same repeated-scan problem; moving the empty-list check alone does not fix it.

**Reproduction:** American convention, no word-list entries, and:

```js
const text = Array(n).fill('grey').join('-') + '. A gray sky.';
findInconsistentSpellings(text, [], new Set(), 'american');
```

The convention legitimately flags each `grey`, so this exercises ordinary output semantics rather than invalid input. The number of output issues is linear; the new repeated parent parsing is not.

**Deterministic work evidence:** instrumenting the existing `String.prototype.matchAll` calls records the total source lengths sent into the production word scanner. At `n = 25,600`, the input is **128,012 UTF-16 units**, but the corrected detector submits **3,277,004,812 units** across **51,201 scans**. The same input on `4ff69dde` submits **230,412 units** across **25,601 scans**. Doubling the compound from 6,400 to 12,800 to 25,600 parts approximately quadruples the corrected scan volume (204,851,212 → 819,302,412 → 3,277,004,812), not merely the result count.

For context, the instrumented Node 18 detector took approximately **0.47 s / 1.25 s / 5.78 s** at those sizes; the original implementation took **31 / 48 / 67 ms**. Timing is illustrative, not the regression assertion. A separate real `DraftEditUseCase` run accepts a 6,400-part Markdown witness and emits all 6,400 flags with a controlled empty model reply, both with an empty list and `['unrelated']`; no input limit prevents the path. The host reading is synchronous, before the provider await, so its work prevents cancellation/editor events from being serviced while it runs.

**Correction:** compute/cache whole-word acceptance once per original word, retain that result for all its parts, and keep counting accepted occurrences as F-02 requires. Check related whole-parent work in the part loop as well. Add a deterministic work-count/volume regression test with a long compound, empty and unrelated nonempty lists, plus accepted-parent and standalone-component controls. Do not solve this by dropping legitimate compound parts or weakening the accepted-word promise. The documented “both checks are linear, so need no budget” claim needs to remain true; otherwise a charged work bound is required.

### Verification on the corrected head

- Typecheck passed; lint passed with **0 errors / 1,133 existing warnings**; production build and `verify:bundle` passed with the same three existing webpack warnings.
- Full independent typed Jest on Node 18 is still running; its terminal result will be recorded separately.
- Exact-head [push CI 40581762268](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40581762268) and [PR CI 40581769285](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40581769285) both succeeded; every verify step passed.
- Evidence is outside the repository in `../pr182-rereview-evidence/`, including `compound-work*.cjs/.log`, `compound-usecase.cjs/.log`, and the correction controls. The isolated worktree uses the same verified dependency lockfile and Node/npm versions.

**Disposition: F-01–F-03 resolved; F-04 remains blocking.** This is a report-only update, not a source fix or formal GitHub review. Native/live acceptance remains unrun and separate. The exact report-only commit will be verified remotely and its CI followed.

## Re-review verification completion — 2026-10-27 21:14 UTC

The independent typed Jest run on corrected implementation/author-response head `391a4b4c` passed: **589 suites / 8,338 tests / 59 snapshots**, **551.153 s**, exit 0. Typecheck, lint and the production build had already passed. This completes all local aggregate checks for that head.

Re-review report `ca04dae7fe20d2aa868ec659ce0f5f45f3ede529` was verified remotely as this report alone, with parent `391a4b4cefe7bcb9a0824addbdaa16fe4ff6903d`, matching the submitted bytes. Its [push CI 40583834893](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40583834893) and [PR CI 40583845878](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40583845878) both succeeded, with every verify step passing.

**Disposition unchanged: F-01–F-03 are resolved; F-04 remains open.** The repeated whole-word scan is independently reproduced despite regression success. This appendix's exact report-only head will be checked separately; no source change, native acceptance or live inference is implied.
