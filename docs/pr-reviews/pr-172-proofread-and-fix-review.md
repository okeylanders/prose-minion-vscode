# PR Review — Draft Edit Proofread and Fix, Slice 2

**Author:** okeylanders · **PR:** [#172](https://github.com/okeylanders/prose-minion-vscode/pull/172)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8`

**Base and merge-base:** `e3a7fac09e503b17ecbc78bc7629540a0c8db61f`

**Scope:** 44 changed files · +3,128 / −183

**Reviewed:** 2026-10-25 · **Reviewer:** Astra

**Mode:** independent source/contracts review; production use-case, applier, guards and VS Code adapters with synthetic documents and controlled host behavior; official VS Code source verification; local aggregate gates

## Summary

**Request changes. Four P2 findings remain open.** The direct retry can write into newly protected code; a held native preview can write after a language change ends the watched lifetime; count-preserving spacing changes can create Markdown structure; and native large-edit coalescing breaks applied counts and loses untouched leftover flags.

These are write-side findings, not reopened Slice 1 dispositions. PR #171's read-and-flag clearance did not clear document writes. The one-door architecture, non-writing quick-fix commands, same-occurrence tracking, partial-preview handling, line-break hardening and normalized-anchor boundary fix are valuable, but the uncovered paths need correction before this write side is approved for `epic/lightbox`.

**No native VS Code session or live provider call was run.** All writes below modified synthetic in-memory documents. Native-behavior witnesses use production adapters over a controlled API double backed by pinned VS Code source, not an Extension Development Host. Source verification and controlled doubles do not establish native UI acceptance or live proofreading quality.

## Findings and disposition

| ID | Priority | Status | Finding |
| --- | --- | --- | --- |
| F-01 | P2 | Open, blocking | A stale direct retry skips the new live protected-region check |
| F-02 | P2 | Open, blocking | Native preview can commit after a language change ends the watched lifetime |
| F-03 | P2 | Open, blocking | Equal markup-character counts do not prevent a fix from creating tags or fences |
| F-04 | P2 | Open, blocking | Native coalescing of large edit sets loses applied counts and untouched flags |

## F-01 — Revalidate safety before the direct retry

**Locations:** [`DraftEditApplier.ts:122–128`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L122-L128), [`DraftEditApplier.ts:228–231`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L228-L231).

`check` recomputes protection only before the first ask. On a stale direct result, `followGroups` moves untouched occurrences and compares their original text, then the loop sends them at the new version without rerunning protection. Unchanged text is not evidence that it is still prose.

Independent witness, first at the applier and then through both public use-case paths:

1. Start with `Alice saw teh rabbit.` and the safe spelling suggestion `teh` → `the`.
2. While the first direct apply is out, the host double inserts a `text` fence before the sentence and its closing fence after it, then returns `stale`.
3. The retry submits the shifted typo inside the fenced region and writes `the` there.
4. Direct **Proofread and Fix** reports one applied fix and zero protected drops. **Replace with**, after a real Flag run, likewise applies it and withdraws its flag.

Controls: an initially protected edit is refused; preview does not retry and therefore leaves the newly fenced text unchanged; ordinary prefix insertion can still be followed safely. The production adapter can return `stale` after its awaited `workspace.applyEdit` finds a moved text version, so the retry is reachable without changing its port contract.

**Requested correction:** revalidate every surviving retry candidate against the settled document's current protection and all applicable write rules before sending another edit. Preserve member identities and truthful refusal counts. Retain direct Fix and Replace-with regressions for new fenced/inline code and link targets, alongside harmless-prefix and preview-no-retry controls.

## F-02 — A lifetime check after native preview is too late to protect the write

**Locations:** [`VsCodeDocumentEditor.ts:99–116`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L99-L116), [`DraftEditApplier.ts:113–119`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L113-L119).

The watch correctly marks a language change as closing the old document lifetime. However, native preview and its eventual commit are both inside the awaited `workspace.applyEdit`. Checking the watch after that promise resolves can suppress flags, but cannot prevent a write that already happened.

The native-source assumption needs a narrower statement than “the preview becomes stale if the document changes”:

- VS Code handles a language change by firing document remove/add events without changing its text version. See [`extHostDocuments.ts`, 1.82.0](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/api/common/extHostDocuments.ts#L107-L121) and [`textModel.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/editor/common/model/textModel.ts#L1927-L1939).
- The preview conflict detector watches content changes and disk events, not language changes. See [`conflicts.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/conflicts.ts#L58-L87).
- The text edit task checks a numeric model version, not the extension's watched lifetime or language. See [`bulkTextEdits.ts`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/bulkTextEdits.ts#L89-L94).

These relevant behaviors were also checked at the PR's pinned current-source commit `4f383697191fef7129052d5396d5709d5799934a`.

Independent execution uses the real use case, applier and both VS Code adapters. While the controlled native preview is held, it fires the documented language-change close event, changes the language with no text-version increment, then accepts the proposed edits as the native numeric-version path permits:

| Scenario | Observed controlled result |
| --- | --- |
| Markdown → JavaScript during preview | Both spelling fixes modify the buffer; the run subsequently returns `closed` |
| Plain text containing a `~~~text` fence → Markdown during preview | The now-protected fenced contents are corrected; the run subsequently returns `closed` |

An additional same-version reopen witness establishes the port-level gap, but **is not claimed as native tab-close behavior**: preview/diff model-reference retention makes that UI sequence host-dependent. The language-change case is the source-grounded blocker and needs no reopened model.

**Requested correction:** make lifetime/language validity part of the decision that occurs **before** the host commits, not only post-write reconciliation. If `workspace.applyEdit`'s built-in preview cannot provide that barrier, revise the review/write protocol or the supported preview strategy; merely reporting `closed` afterward, or attempting a compensating undo, does not preserve writer data. Record the changed contract in the ADR. Retain held-preview language-change tests with an assertion that no mutation occurs, and perform the native acceptance checks separately.

## F-03 — A spacing fix can create protected syntax without changing delimiter counts

**Locations:** [`proofreadGuard.ts:53–68`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/utils/proofread/proofreadGuard.ts#L53-L68), [`DraftEditApplier.ts:136–145`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/application/services/draftEdit/DraftEditApplier.ts#L136-L145).

The new guard counts each markup character. It does not preserve their arrangement or whether surrounding whitespace makes them syntax. Both following changes pass as automatic `spacing` fixes, leave every line break unchanged, and keep the counts of every character in `MARKUP_CHARACTERS` identical.

Independent production-use-case witnesses:

1. `Alice wrote < Rabbit > in her notebook.` with `< Rabbit >` → `<Rabbit>`: the original is unprotected prose; the fix is applied. The resulting `<Rabbit>` is a protected HTML tag. The repository's actual `marked` renderer escapes the original literal angle-bracket phrase but emits the resulting raw tag, so the visible word is no longer literal prose.
2. Source and accepted proposals (`\n` denotes a newline):

   ~~~text
   Source:       ` ``text\nAlice saw teh rabbit.
   Spacing fix:  ` ``text  →  ```text
   Spelling fix: teh       →  the
   ~~~

   The source has no protected region: the unequal unmatched backtick runs are literal. The spacing fix combines them into a fence opener. Direct Fix applies **both** proposals, returns two applied fixes, and leaves a document whose entire text is now a protected fenced block. Protection was checked only against the original text, so the batch also changed the sentence inside the structure it created.

This is not the explicit non-preferred Replace-with action for a judgment call. These suggestions are classified as Proofread's own safe fixes and included automatically by Fix/Fix all. A preview preference does not make a structurally unsafe suggestion safe, and `apply` bypasses preview by design.

**Requested correction:** fail closed on changes that create, destroy or alter Markdown structure through delimiter placement or adjacent whitespace, including interactions among proposed edits. Use syntax/context-aware validation or a conservative rule that preserves that structure; character counts alone are not sufficient. Keep ordinary spelling corrections beside unchanged markup working. Add full use-case and combined-batch regressions, not just unit assertions about delimiter counts.

## F-04 — Reconcile native coalesced edits without discarding unchanged leftovers

**Locations:** [`reconcileEdits.ts:49–62`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/utils/draftEdit/reconcileEdits.ts#L49-L62), [`DraftEditUseCase.ts:353–358`](https://github.com/okeylanders/prose-minion-vscode/blob/7f180ab7947bbfc5b8f6f475b32e99cefaa9c6c8/packages/core/src/application/services/draftEdit/DraftEditUseCase.ts#L353-L358).

The implementation handles native changes smaller than a proposed replacement, but assumes a change crossing its boundary means the writer touched it. Native VS Code can also make the opposite transformation: at **1,000 or more untracked operations**, its text buffer combines them into one spanning replacement, including the unchanged text between them. This is an implementation behavior, not a hypothetical provider response. See [`PieceTreeTextBuffer._reduceOperations`, 1.82.0](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBuffer.ts#L416-L430), also present at [the pinned current-source commit](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/editor/common/model/pieceTreeTextBuffer/pieceTreeTextBuffer.ts#L420-L434). Ordinary bulk text replacements are eligible; their marker movement is not the `_isTracked` exception.

The source-backed controlled witness runs the real use case, anchoring, guard, applier and both adapters over **30 actual chunks**, with 34 synthetic spelling findings per chunk: **1,020** disjoint fixes total, plus an untouched tense finding inside their span. This does not assume a 1,020-issue single provider reply. The native double performs the accepted replacements through one coalesced content-change event, retaining all interstitial text.

Actual result:

- Every spelling correction is present in the final document.
- The outcome reports `fix.applied = 0`, `fix.unknown = 1020`.
- The unchanged tense issue disappears: `flagged = 0`, `dropped.stale = 1`.
- The summary's unknown-fix wording attributes these native edits to the writer editing during review, although the writer changed nothing.

A separate 1,001-edit applier/annotator witness reproduces the same boundary failure and loss of an already-shown untouched flag. The public workflow allows whole long files and imposes no total fix cap below this native threshold.

**Requested correction:** support coalesced native change events in both reconciliation and leftover/annotation placement, while still failing closed on genuine unrelated writer edits. An explicitly bounded safe write strategy is another option if it preserves the promised single undo/review behavior and makes any limit clear. Retain threshold-adjacent tests, all/subset acceptance, unchanged flags inside the combined span, and genuine user changes; do not infer all edits landed merely from the native boolean.

## Verification and positive coverage

Read `AGENTS.md`, the Draft Edit ADR and Slice 2 plan/amendment, architecture guards, command/adapter tests and the preceding PR #171 report. No repository `.agents/skills` directory or dedicated PR-review template was present; this follows the existing `docs/pr-reviews` report format. Scope includes the complete 44-file delta, integration wiring, the retained read-side lifecycle, usage and recovery contracts.

- One core write door remains enforced; the commands submit issue IDs to core rather than embedding raw edits. Fix all excludes judgment-call and downgraded suggestions; an explicitly selected judgment suggestion is intentionally allowed, subject to write guards.
- Small direct/preview applications, partial acceptance, discard, ordinary text-version staleness, one run per document, Dismiss/Clear and fresh diagnostic placement are covered by the repository suite and controlled integration tests.
- The previous partial-ellipsis-anchor issue is fixed: partial normalized expansions fail closed; complete expansions still anchor. Independent CRLF/line-boundary controls and 14,641 canonical string-pair checks for each of LF and CRLF found no new line-break-guard defect.
- Joined touching edits reconcile correctly through ordinary smaller native edits. Official source confirms minimization occurs after preview selection, so it does not expose separate sub-edits for the writer to tick inside an already joined group. That investigated concern is **not** a finding.
- The command/manifest keeps the setting at `preview`, offers Fix where Flag is offered, and hides internal quick-fix commands from the palette. `extension.ts` is still the exceptional oversized composition root; the PR records that existing debt rather than silently introducing another owner.
- Usage aggregation and recovery-saved/unsaved reporting remain on the corrected Slice 1 paths. No new provider implementation or credential ownership was introduced by this delta.

Dependencies were reused from the retained review environment against an unchanged lockfile. TypeScript, Jest and webpack resolve workspace source aliases into this checkout; no fresh `npm ci` was claimed. Required local gates used task-local Node **18.20.8 / npm 10.8.2**. An initial Node 24 in-band full-suite attempt was resource-killed (exit 137), not a passing run; the Node 18 full run uses one memory-recycled worker instead. A build attempt was interrupted while correcting that orchestration and was rerun to completion.

| Check | Independent result |
| --- | --- |
| Typecheck, Node 18 | Pass: core, webview and adapter |
| Lint, Node 18 | Pass: 0 errors / 1,133 warnings |
| Production build + `verify:bundle`, Node 18 | Pass; three existing webpack size warnings |
| Full repository Jest, Node 18 | Pass: **545 suites / 7,614 tests / 59 snapshots** |
| Scratch witnesses/controls, Node 18 | 4 suites / 21 tests pass; assertions reproduce the four findings above, not a claim that the product behavior passes |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40203497008), exact head `7f180ab7` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40203549000), exact head `7f180ab7` |
| Report-only whitespace check | Pass: report-only `git diff --check`; two pre-existing new-blank-line warnings in the implementation delta’s `.todo` files were left untouched |

Representative local commands:

```sh
npm run typecheck
npm run lint
npm run build
npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB \
  --cacheDirectory=../pr172-review-evidence/jest-cache
```

Independent scratch harnesses and logs are retained outside the repository under `pr172-review-evidence/{applier,adapter,core}`; only this report is published. The findings include their source locations and synthetic reproduction recipes above. No implementation fix, test fixture, build artifact or unrelated author change is included in the report commit.

## Acceptance limits and recommendation

**Not approved for merge into `epic/lightbox` on this head.** Correct F-01 through F-04, add discriminating regressions, and independently re-review the resulting delta before changing that verdict. Green CI does not cover the demonstrated native-source edge cases or unsafe syntax transformations.

Never run here: native Extension Development Host; actual Refactor Preview selection/discard/language-change behavior; single-step native undo/redo; native lightbulb/Problems/F8 and accessibility; live model quality/false-positive acceptance. The writer's reported Flag experience and ADR writer decisions are author-supplied context, not independent acceptance of Fix. Those native and live-quality gates remain separate even after code review becomes clear.

No private manuscript, paid/live provider call, formal GitHub review/comment, merge or deployment was used. Publication is report-only on this PR branch. Its remote bytes, sole parent, single changed path and exact report-head CI are verified separately after publication; this report does not pre-claim a future CI outcome.

## Author response — 2026-10-25

**Correction head:** `fa617eae` (base `e3a7fac0`, unchanged since the review). F-01, F-03 and F-04 are fixed in `f57060f6`, with regressions that fail on the reviewed head. `fa617eae` lists the two new bounds in the prompt-budget guard. The docs are in `fe166f9c`, and the ADR's new "Amendment 2026-10-25: PR #172 review (Slice 2)" section records each decision. **F-02 is still open:** its fix changes the review step itself, and that is the writer's call. The options are below.

| ID | Status | Commits |
| --- | --- | --- |
| F-01 | Fixed | `f57060f6` |
| F-02 | Open, pending the writer's decision | — |
| F-03 | Fixed | `f57060f6`, `fa617eae` |
| F-04 | Fixed | `f57060f6`, `fa617eae` |

### F-01 — a retry checks every rule again

- **The fix.** `DraftEditApplier`'s checks are now one module function, `check(document, edits, policy, refused)`: text unchanged, protection, line breaks, overlaps and Markdown structure.
  - A stale direct apply follows its standing edits through the writer's changes (`reconcileEdits`, then `placeMembers`), then runs `check` on the settled snapshot before it asks again.
  - Whatever `check` refuses is counted under its own reason. If nothing survives, nothing is asked.
  - Members keep their identities through the move, so the refusal counts are true.
- **Unchanged.** A reviewed apply never retries. Only one retry is made.
- **Tests:**
  - `DraftEditApplier.test.ts`, "the direct retry checks again": a fence, inline code or a link target typed around the edit while it is out is refused as `protected` and never asked. Controls: a harmless prefix is followed and asked once more; a reviewed apply never asks again, so a fence typed during review is left alone.
  - `DraftEditFix.test.ts`: your fenced-sentence witness through the use case. The text is unchanged, there is one apply call, `stale`, `applied: 0`, `dropped.protected: 1`, and nothing is flagged.
  - `DraftEditQuickFixes.test.ts`: Replace with after a real Flag run, with the flag fenced as the fix goes in. Nothing is written into the code.
  - The use-case and quick-fix regressions fail on `7f180ab7`. The applier suite cannot compile there, because its policy type gained a field, so the use-case tests carry that proof.

### F-03 — a fix keeps the block's Markdown structure

- **The rule** (`utils/draftEdit/markdownStructure.ts`, `editsChangingStructure`). Each top-level block an edit touches is lexed with `marked` before and after the edits. The inline content uses the document's own link definitions (a fresh `Lexer` per read, with the document's `links`). The block's *shape* must match:
  - token types and their nesting;
  - heading depth;
  - list kind (ordered or not, loose or tight), items and task items;
  - table rows and columns;
  - text runs with non-text children.

  Adjacent text runs collapse, so a spelling fix inside a sentence never changes the shape.
- **Judged together.** The batch is checked as a whole. When a block's shape moves, its edits are kept in order only while the shape still holds, and the rest are refused. In your fence witness, the spacing fix is refused and the spelling fix it would have swallowed still applies.
- **Fails closed.** A block over `MAX_VERIFIED_BLOCK_LENGTH` (50,000 characters) refuses its edits. Plain text has no structure and refuses nothing.
- **Where it applies:**
  - The policy row gains `preservesMarkdownStructure: true` for Proofread.
  - At placement, such a fix is downgraded to a flag with `downgradeReason: 'markup-change'`, so it is never preferred and Fix all never takes it.
  - The applier checks again on the live text (and on a retry, per F-01), refusing as `markup`. An applier refusal for markup or a line break also leaves a standing flag, downgraded.
- **The character-count guard stays** as the first, cheap rule.
- **Tests:**
  - `markdownStructure.test.ts`, 13 cases: a tag, a link, a heading, a list item, a removed hard line break, a fence opener, and a reference link the document defines elsewhere (with its control: no definition, no refusal). Ordinary fixes beside markup are kept; the joint emphasis case refuses only the edit that completes it; the fence case keeps the spelling fix; there is the long-block refusal, and plain text.
  - `DraftEditFix.test.ts`, three cases through the use case: your `< Rabbit >` witness is flagged, never written, and its Replace with is not preferred; your fence-and-spelling witness applies the spelling fix alone and flags the spacing fix; and Fix all after a Flag run takes the spelling fix and leaves the tag-maker.
  - All three use-case cases fail on `7f180ab7`.

### F-04 — reconciliation reads a merged change as the edits it is made of

- **Replay** (`utils/draftEdit/reconcileEdits.ts`). Reconciliation now replays the document from the text the edits were made against.
  - A host change and the edits it touches (edges inclusive) form a cluster.
  - The cluster's new text must read, **in exactly one way**, as the text between the edits unchanged, with each edit either its original or its replacement. A forward and backward pass keeps at most 64 readings (`MAX_READINGS`); past that, or with none, the cluster is unread.
  - Read that way, each edit is applied or not applied, where it now stands.
  - Read any other way, an edit a change *reached into* is unknown. An edit a change only met at an edge keeps its standing.
- **Normalized history.** A read cluster is given back as exactly its edits' replacements, so ranges moved through the history stay on their text between the edits. The use case moves its leftover flags through that history.
- **Quick fixes.** The annotator moves flags change by change and drops any flag inside a spanning change. After a quick fix applies, `applyShown` therefore shows the untouched flags again at their normalized positions (`reshow`), falling back to removal.
- **Genuine writer edits still fail closed.** A spanning change that also changed the text between edits reads no way, and every edit it reached into is unknown.
- **The double.** `fakeDocuments.ts` gained `applyLikeVsCode`, which merges at `VS_CODE_MERGE_THRESHOLD = 1000` operations as `PieceTreeTextBuffer._reduceOperations` does (interstitial text kept), with an optional ticked subset.
- **Tests:**
  - `DraftEditManyFixes.test.ts`: 999, 1,000 and 1,001 fixes, each counted applied with the untouched tense flag on its text. A ticked subset of 1,300 merges because 1,040 are ticked, and the 260 unticked are counted and flagged on their text. Fix all with 1,001 shown fixes applies them all and shows the tense flag again.
  - `reconcileEdits.test.ts`, "one change spanning many edits": all applied, with the history given back as the edits; a subset; a flag between edits kept on its text; a spanning change that starts and ends inside its first and last edits; and the tampered-interstitial control (all unknown, history unchanged).
  - The 1,000, 1,001 and subset cases and the Fix all case fail on `7f180ab7`. The 999 case passes there, as it should.

### F-02 — open: the barrier has to come before Apply, and Refactor Preview has none

I agree with the finding as stated. The preview's selection and its commit both happen inside the awaited `workspace.applyEdit`. There is no hook between the writer's Apply and the write, and a language change leaves the version number alone. So no post-write check can be a barrier, and a compensating undo is not one either.

The fix is a different review step, so I've put the choice to the writer. The options:

1. **Keep Refactor Preview and narrow the window.** Discard a held preview the moment the watched lifetime ends (close, reopen or language change), through the `refactorPreview.discard` command. Record the remaining gap, an Apply racing that discard, as a stated limit in the ADR. This keeps the side-by-side diff and native per-entry ticking, but it is not a strict barrier.
2. **Our own review.** A checklist of the fixes in the extension's own UI. The decision is ours, so lifetime and language are checked after the writer's choice and before the one direct `applyEdit`. This is a strict barrier, but loses VS Code's diff view.
3. **Direct only.** Drop the preview setting. Fix applies directly, with one undo step, and Flag remains the reviewable path.

The ADR's F-02 row says this is open. This response and the ADR will record the chosen option and its tests (a held preview plus a language change, asserting no mutation wherever the chosen path allows) when it lands.

### Verification

| Check | Result |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass: core, webview and adapter |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings (the baseline) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass; the three existing webpack size warnings |
| Full Jest, Node 18.20.8 | Pass: **547 suites / 7,648 tests / 59 snapshots** |
| Full Jest, Node 22.22.0 | Pass: 547 suites / 7,648 tests / 59 snapshots |
| Regressions on the reviewed head `7f180ab7` | In a worktree with the new tests copied in, 9 fail on assertions: F-01 (use case, quick fix), F-03 (three use-case cases) and F-04 (1,000, 1,001, subset, Fix all). The 999 case passes there |

The first full Node 18 run caught `promptBudgets.test.ts` flagging the two new bounds. `fa617eae` lists them as non-prompt limits, with their reasons, and the counts above are from the rerun. No live provider call, private manuscript or native Extension Development Host was used. The fixtures are synthetic or *Alice*. The native acceptance checks you list (Refactor Preview selection, discard, language change, undo, lightbulb and Problems) remain the writer's, in an Extension Development Host.

## Astra independent re-review — 2026-10-25, correction head `3914c103`

**Reviewed head:** `3914c103922068bf59474946877a6a9ca3f555d5`, including `f57060f6`, `fe166f9c`, `fa617eae` and the author response above. **Delta from the published review:** 21 files, +1,238 / −237; base remains `e3a7fac0`.

**Request changes. Two P2 blockers remain: F-03 and F-05.** F-01 and F-04 are independently closed. F-02 is **an explicitly accepted native-preview limitation, not a corrected defect**; it is no longer a merge blocker under the writer's decision. This re-review supersedes the original disposition and the author's claimed closure where they differ; both earlier accounts are retained above as history.

| ID | Re-review disposition | Evidence |
| --- | --- | --- |
| F-01 | Closed | Every surviving stale direct candidate is checked against the settled snapshot before the single retry; newly fenced/inline-code/link-target candidates are refused |
| F-02 | Accepted risk, not fixed | Writer explicitly chose to retain VS Code's native preview despite its disclosed lifetime race on 2026-10-25; the same controlled language-change witnesses still reproduce on this head |
| F-03 | Open, blocking | Original paragraph/fence witnesses are corrected, but table-cell token contents are omitted from the new structure fingerprint |
| F-04 | Closed | Native coalescing, selected subsets, normalized history and untouched leftover flags reconcile correctly in independently executed controls |
| F-05 | New, P2, blocking | Completing a pending Fix all restores leftover flags after Clear this file or Clear all |

### F-01 closure — retry protection is checked again

The retry runs the same `check` function on the settled snapshot. Independent applier/use-case controls confirm that new fences, inline code and link targets prevent the second ask; direct Fix reports the protection refusal truthfully and Replace with performs no write. A harmless prefix still follows the original occurrence, and a reviewed apply still never retries. No repeat-text search or replacement-occurrence substitution was added. This closes the reported retry hole; it does not assert that every other check is correct (F-03 remains separate).

### F-03 remains open — table cells are absent from the Markdown fingerprint

**Location:** [`markdownStructure.ts:157–160`](https://github.com/okeylanders/prose-minion-vscode/blob/3914c103922068bf59474946877a6a9ca3f555d5/packages/core/src/utils/draftEdit/markdownStructure.ts#L157-L160).

`describeToken` reduces a table to its column and row counts. Unlike paragraphs and other nested tokens, it never describes the header/body cells' inline tokens. Therefore any inline syntax transformation that keeps the table dimensions is invisible to both placement-time downgrade and the applier's final structure check.

Independent production-use-case reproduction:

```markdown
| Note |
| --- |
| Alice wrote < Rabbit > here. |
```

Return the synthetic `spacing` finding `< Rabbit >` → `<Rabbit>`. The original occurrence is unprotected prose. Direct **Proofread and Fix** applies it, reports one applied fix and no flag; the repository's actual `marked` renderer changes escaped literal text into a raw `<Rabbit>` tag. The same result occurs in a header cell and a quoted table. A real Flag run labels the proposal preferred, and **Fix all** applies it as well.

A second witness uses `See [Alcie] go.` in a cell with `[alice]: https://example.invalid` defined elsewhere. Correcting `Alcie` → `Alice` creates a reference link, also accepted automatically. This is not merely a formatting disagreement or the writer's explicit non-preferred Replace-with choice.

Controls confirm the original paragraph tag-maker is now downgraded, and the combined fence/typo witness refuses only the fence-maker while safely applying the spelling fix. The correction is effective outside the uncovered table path, but does not yet close F-03.

**Requested correction:** include all table header/body inline structure in the fingerprint (including table nodes nested under other tokens), while retaining ordinary cell spelling corrections. Add full-use-case direct Fix and Flag→Fix all regressions for syntax creation in header/body cells, plus reference-link and unchanged-markup controls. Apply the same fail-closed rule to the live applier check.

### F-04 closure — coalesced edits and untouched leftovers

The replacement-aware cluster reader reconstructs unchanged interstitial text, accepts only an unambiguous original/replacement reading, and returns normalized edit history. Independent execution through production core and both VS Code adapters confirms:

- **30 actual chunks / 1,020 spelling fixes:** all 1,020 reported applied, zero unknown, untouched tense flag retained.
- **40 chunks / 1,360 proposals / 1,088 ticked:** Proofread and Fix in preview mode and real Flag→Fix all each retain the 272 unticked fixes plus the tense flag, report the correct applied/not-applied counts and preserve their live ranges. The accepted count remains above the native 1,000-operation merge threshold.
- Generated variable-length/deletion/subset/CRLF/prefix-movement controls preserve normalized-history equivalence. Genuine writer changes to interstitial text still fail closed rather than being relabeled as accepted fixes.

The old large-file fixture began each paragraph with a typo. Because affected block spans include their edges and merge when touching, this can join many paragraphs into a span exceeding the new 50,000-character verification bound; those fixes are conservatively downgraded. Adding harmless `Alice ` before each paragraph's first typo isolates coalescing from that separate bound. The whole-document refusal is recorded as a conservative availability limitation, not a safety blocker or evidence that reconciliation failed.

### F-05 — Clear is undone when a pending quick fix re-shows leftovers

**Locations:** [`DraftEditUseCase.ts:164–187`](https://github.com/okeylanders/prose-minion-vscode/blob/3914c103922068bf59474946877a6a9ca3f555d5/packages/core/src/application/services/draftEdit/DraftEditUseCase.ts#L164-L187), [`DraftEditUseCase.ts:203–237`](https://github.com/okeylanders/prose-minion-vscode/blob/3914c103922068bf59474946877a6a9ca3f555d5/packages/core/src/application/services/draftEdit/DraftEditUseCase.ts#L203-L237).

The F-04 repair captures the old per-document `issues` map before awaiting the write, then `reshow` uses it to restore untouched flags. `clear(uri)` deletes the outer map entry, and `clear()` clears the outer map, but neither invalidates that captured map. Completing the pending write repopulates annotations and retained issues from stale state.

Independent witnesses at both the use case and production adapters:

1. Run Flag on a synthetic sentence with a safe spelling fix and a tense judgment flag.
2. Start **Fix all** and hold its preview.
3. Invoke **Clear this file** (repeat with **Clear all**); verify all flags disappear immediately.
4. Accept the already-pending spelling fix. The cleared tense flag reappears, with its quick-fix state restored.

Dismiss is a discriminating passing control: it deletes from the captured inner map and therefore is respected. Normal no-clear coalesced leftovers are also preserved correctly. This is a new correction regression, not a reopening of Slice 1's prior Clear behavior and not part of the writer's F-02 risk acceptance.

**Requested correction:** give pending quick-fix re-show an ownership/invalidation check so a later Clear cannot be undone. Retain restoration for unchanged interstitial flags when no Clear occurred. Cover document-only/global Clear, Dismiss, and unrelated documents' flags across the awaited write.

### F-02 writer decision and acceptance boundary

On 2026-10-25 the writer explicitly chose to keep the VS Code preview screen and accept the disclosed edge risk. Accordingly no replacement review UI is required for this review. The acceptance is scoped to native preview's lifetime/language race; it does **not** waive table syntax safety, Clear behavior, or unrelated/new defects.

At this reviewed head the adapter's language/lifetime behavior is unchanged: the language-change witnesses still modify the synthetic buffer before the run reports `closed`. No best-effort discard mitigation has landed here, and none is claimed verified. If such mitigation is added, it must be tested as best effort, not described as a guaranteed pre-commit barrier. The same-version reopen probe remains port-level evidence only, not a claim about native tab-close/model retention.

### Independent re-review verification

| Check | Independent result on `3914c103` |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass: core, webview and adapter |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings (unchanged baseline) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass; three existing webpack size warnings |
| Full Jest, Node 18.20.8 | **547 suites / 7,648 tests / 59 snapshots pass** |
| Independent scratch re-review | **7 suites / 47 tests pass**, including 1,040 generated reconciliation cases; defect-witness assertions are not successful product acceptance |
| Exact implementation-head CI | [Push 40210638865](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40210638865) and [PR 40210643924](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40210643924): completed, success |

The full local Jest run used the same one-worker/memory-bounded command recorded above. Dependencies remain reused from the prior checkout against an identical lockfile; this is not a fresh `npm ci`. Node 22 was author-reported, not independently rerun. Scratch evidence and logs are retained outside the repository at `pr172-review-evidence/rereview/{applier,adapter,core}`; no test or implementation file is published. The report's own resulting remote commit and CI are checked after publication, not assumed from the implementation-head runs.

**Not approved for merge into `epic/lightbox` on `3914c103`.** Correct F-03 and F-05 and independently re-review the resulting delta. F-02 may remain as the explicitly accepted limitation. Native VS Code UI/undo/accessibility acceptance and live proofreading quality remain separate, never-run stages; all review writes used synthetic in-memory documents and controlled provider stubs. No live provider call, manuscript, implementation edit, formal GitHub review/comment, merge or deployment was used.

## Author response to the re-review — 2026-10-25

**Correction head:** `6f025ba7` (base `e3a7fac0`, unchanged). This answers your re-review of `3914c103`.
- **F-03 and F-05** are fixed in `3e2d0a25`; their docs are in `6f025ba7`.
- **F-02's mitigation** reached the branch after your re-review head: `e4c353b9` (code) and `8803b521` (docs).
- **F-02's wording.** You asked that any mitigation be tested and described as best effort, never as a guaranteed pre-commit barrier. `3e2d0a25` (the adapter) and `6f025ba7` (the ADR, the agent guide and the Slice 2 doc) reword it to say so.

| ID | Status | Commits |
| --- | --- | --- |
| F-01 | Closed in your re-review | — |
| F-02 | Accepted limit (the writer's decision), with a best-effort discard | `e4c353b9`, `8803b521`, `3e2d0a25`, `6f025ba7` |
| F-03 | Fixed: table cells now in the fingerprint | `3e2d0a25`, `6f025ba7` |
| F-04 | Closed in your re-review | — |
| F-05 | Fixed | `3e2d0a25`, `6f025ba7` |

### F-03 — every table cell's inline shape is fingerprinted

- **The fix.** `describeToken` gives a table's column alignment and each header and body cell's inline shape (`cell(…)`, through the same `describe`). A table nested in a quote or a list item reaches it by the same recursion. Task items now also record whether they are ticked.
- **Both places.** Placement's downgrade and the applier's live check both call `editsChangingStructure`, so both refuse such a fix.
- **Tests:**
  - `markdownStructure.test.ts`:
    - refused: a tag made in a body cell, in a header cell, in a table inside a quote, and in a table inside a list item; a reference link made in a cell (its definition elsewhere); a column's alignment changed; a task ticked;
    - kept: ordinary cell fixes beside markup they leave alone.

    All seven refusals fail on `3914c103`'s fingerprint; the control passes on both.
  - `DraftEditFix.test.ts`, through the use case:
    - direct Fix flags the tag-maker in a body cell and in a header cell, with a non-preferred *Replace with*, and writes nothing;
    - Flag → Fix all takes only the spelling fix beside it;
    - the reference-link fix in a cell is flagged;
    - control: an ordinary spelling fix in a cell applies.

    The first four fail on `3914c103`.
  - `DraftEditApplier.test.ts`: the applier refuses as `markup` a tag made in prose and one made in a table cell. This is the live check a writer's explicit *Replace with* reaches.
- **Your availability note** (a run of paragraphs whose edits touch their edges, joined past the 50,000-character bound) is recorded in the ADR's F-03 row as a conservative limit. The rule stays as it is.

### F-05 — a Clear is for good

- **Cause, as you found.** `applyShown` captured the document's inner issue map before awaiting the write. Clear deleted the outer entry, and the captured map never saw that.
- **The fix.** When the write lands, `reshow` runs only while `shownIssues.get(uri)` is still the captured map.
  - Clear this file deletes the entry and Clear all empties the map, so nothing comes back and the annotator stays cleared.
  - A Dismiss deletes from the captured map itself, so it is kept, as before.
  - Nothing else replaces the map meanwhile, since a new run is refused while the document is in flight.
- **Tests:**
  - `DraftEditQuickFixes.test.ts`, with Fix all held in review:
    - Clear this file, or Clear all, then release the write. Two fixes are applied, nothing is flagged, and a later Fix all finds nothing to fix, so no quick-fix state came back.
    - A Dismiss during the write is kept.
    - Control: with neither, the untouched tense flag comes back.

    Both Clear cases fail on `3914c103`; the Dismiss case and the control pass on both.
  - `draftEditPreviewLifetime.integration.test.ts`, through the production adapters, with one use case and annotator over two flagged chapters:
    - Clear the first chapter while its Fix all is held, then the writer applies: the first stays cleared, and the second keeps its three flags.
    - Clear all: both stay empty.
    - Control: clearing the other chapter brings back the first's untouched flag, and leaves the second cleared.

    The two Clear cases fail with `3914c103`'s use case.

### F-02 — an accepted limit, with a best-effort discard

The writer kept Refactor Preview and accepted its lifetime race, as your re-review records. The mitigation narrows the race without closing it:

- **What it does.**
  - While a review is held, `VsCodeDocumentEditor` answers the document's close event by running VS Code's own Discard, `refactorPreview.discard`. A close, a reopen or a language change fires that event; for a language change it is close, then open, through `$acceptModelLanguageChanged`.
  - The command (`bulkEdit.contribution.ts`, the same at 1.82.0 and at `4f383697`) settles the held preview with nothing applied (`BulkEditPane.discard` → `_done(false)`). `registerAction2` registers `action.run` as its handler, so `executeCommand` runs it; the `refactorPreview.enabled` precondition only gates the menu and the palette.
  - The adapter then answers `closed`, even when the document stayed open at its version (a language change). The run, or Fix all, shows nothing.
  - It is sent only while a review of ours is held: with none open, Discard would open an empty Refactor Preview panel. A discard VS Code refuses is logged; the adapter now takes the extension's `LogSink`.
- **What it does not do** (the stated limit). The discard is sent when the close event reaches the extension host. Two cases fall outside it:
  - an Apply the writer makes in that interval;
  - a preview VS Code is still opening when the discard arrives.

  Either way the run still reports the document closed and shows nothing. VS Code gives the extension no way to stop its own commit, so this is a mitigation, not a barrier.
- **The port** says a review belongs to one lifetime of its document, and that a host which cannot always stop its own commit states how close it comes.
- **The wording.** A closed run now says the document "was closed or changed language".
- **A correction.** Slice 2 said the extension API had no call to close an open preview; Discard is that call. The progress notification's Cancel does not use it yet.
- **Tests:**
  - `draftEditPreviewLifetime.integration.test.ts` runs the production use case, applier and both adapters on a double built from VS Code's source: a held preview whose Apply writes at an unmoved version, a language change that fires close and leaves the version alone, and a Discard that settles the preview with nothing applied.
  - The writer presses Apply right after each change:
    1. **Markdown → JavaScript:** no mutation, `closed`, nothing flagged, the discard sent.
    2. **Plain text with a `~~~text` fence → Markdown:** the fenced sentence is unchanged.
    3. **A close during review:** no mutation.
    4. **Fix all after a Flag run, then a language change:** `closed`, no mutation.
  - **Controls:** with no change, the plain-text fix is in the preview and Apply writes it. The stated limit is pinned: an Apply that lands before the close event arrives is reported `closed`, with nothing shown.
  - `VsCodeDocumentEditor.applyEdits.test.ts` adds close, language change (answered `closed`, not `declined`), another document's close, a direct apply, a settled review, and a refused discard (logged).
  - **On `3914c103`'s adapter** (given an ignored constructor argument and the command's name, so the suites compile): the four witnesses and the adapter's three discard cases fail, each witness on its text assertion. The controls and the stated-limit case pass there.

### Verification

| Check | Result on `6f025ba7` |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings (the baseline) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass |
| Full Jest, Node 18.20.8 | Pass: **548 suites / 7,681 tests / 59 snapshots** |
| Full Jest, Node 22.22.0 | Pass: 548 suites / 7,681 tests / 59 snapshots |

No live provider call, private manuscript or native Extension Development Host was used. The native checks remain the writer's. For F-02:
- change a file's language while its review is open, and confirm the preview closes and nothing is written;
- close it while its review is open, and confirm the same.

For F-05: Clear this file, then Clear all, each while a Fix all is open in review, and confirm the cleared flags stay gone after Apply.

## Astra independent re-review — table/Clear corrections and native-preview mitigation, head `58693f03`

**Reviewed:** 2026-10-25. **Head:** `58693f0369e57c68e279841b4935a6834255a9e4`; cumulative delta from report head `b52feced`: 21 files, +931 / −43. This includes the F-02 mitigation (`e4c353b9`), its docs and report merge, then the F-03/F-05 corrections (`3e2d0a25`), updated decisions (`6f025ba7`) and author response (`58693f03`). The intermediate `4fa857c7` was independently checked before the latest corrections arrived; its results are not silently relabeled as this head.

**Request changes: new F-06 is the sole P2 blocker.** F-03 and F-05 are independently closed on this head; F-01/F-04 remain closed. F-02 remains the writer's explicitly accepted residual native-preview risk, now with a verified best-effort mitigation—not a guaranteed barrier or a fully fixed defect. The author's latest best-effort wording correctly preserves that distinction.

### F-02 — best-effort behavior verified, acceptance unchanged

The adapter records preview requests while awaiting `workspace.applyEdit`, notices the corresponding document's close/language event and sends VS Code's global Discard command. Source-backed controlled execution confirms that a timely discard of its already-visible preview prevents the write and returns `closed`; ordinary unchanged-language Apply continues to work. This is useful mitigation for the accepted limitation.

The accepted residual race remains real. An Apply that wins before the close event/Discard is processed can change the buffer and then report `closed`; a preview still opening or a failed/delayed Discard is likewise not a strict pre-commit barrier. No compensating undo is attempted. The writer's choice to retain native review remains respected; no replacement review UI is requested.

**Wording correction, not a renewed race blocker:** [`draftEditSummary.ts:119–120`](https://github.com/okeylanders/prose-minion-vscode/blob/58693f0369e57c68e279841b4935a6834255a9e4/packages/core/src/application/services/draftEdit/draftEditSummary.ts#L119-L120) still says a closed quick fix means “nothing was changed.” An independent production Fix-all witness changes `begining`/`vrey` to `beginning`/`very` in the accepted late-discard sequence, returns `closed`, then emits that false assurance. This overclaim predates the mitigation (which adds language-change wording); use wording that does not assert no buffer change when the lifetime is no longer observable. Full Fix's closed summary accurately limits its assurance to no flags being shown. The latest ADR/adapter wording now explicitly calls the mitigation best effort rather than a complete barrier.

### F-06 — global Discard can cancel a preview this request does not own

**Locations:** [`VsCodeDocumentEditor.ts:133–144`](https://github.com/okeylanders/prose-minion-vscode/blob/58693f0369e57c68e279841b4935a6834255a9e4/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L133-L144), [`VsCodeDocumentEditor.ts:187–208`](https://github.com/okeylanders/prose-minion-vscode/blob/58693f0369e57c68e279841b4935a6834255a9e4/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L187-L208).

`reviews.add` records a pending `applyEdit` before its preview necessarily owns the native pane. A close/language event for that pending request sends global `refactorPreview.discard`, which has no request/document/session target. “Our applyEdit is pending” is not proof that the currently displayed preview belongs to it.

The official VS Code implementation makes this distinction observable: while another preview is current, `_previewEdit` awaits replacement confirmation **before** replacing its session. Discard acts on the pane's current input, not the waiting request. See [`bulkEdit.contribution.ts:120–148`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts#L120-L148), [global Discard at 209–212](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts#L209-L212) and [`BulkEditPane.discard`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts#L268-L275). The same ordering is present at the PR's [current-source pin](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts#L121-L149).

Independent production-adapter witness:

1. An unrelated provider's preview **A** is current, including the writer's pending selection.
2. Proofread **B** submits a preview and remains in the native replacement-confirmation await. B has not acquired the pane; the writer has not agreed to discard A.
3. B receives a programmatic language/close event. The adapter's global Discard settles **A** as discarded.
4. B can still be rejected at the confirmation dialog, but A's review has already been lost.

The same cancellation is independently reproduced with two concurrent Proofread documents; a direct apply for the waiting document does not interfere. An additional delayed-command probe can reach a subsequent preview, but is only controlled RPC-ordering evidence, not observed native timing.

This witness models the official asynchronous host sequence; **no native modal clicking or Extension Development Host execution is claimed**. A programmatic lifecycle event can occur while confirmation is pending. The issue is loss of another review and its selection, not a claim that this sequence writes A's document. It is new interference introduced by the mitigation, separate from the accepted risk that B's own lifetime race may still permit B's write.

**Requested correction:** do not send a destructive global preview command without establishing that it targets the request whose lifetime ended. Preserve unrelated/native-provider reviews and other documents' reviews across pending replacement and delayed command delivery; retain no-preview/direct/settled-request controls. If the public host API cannot establish ownership, prefer a narrower or omitted best-effort discard over cancelling an unowned preview. The writer's accepted native-preview risk does not require a replacement UI or a perfect lifetime barrier.

### F-03 and F-05 closure

- **F-03:** the fingerprint now recursively includes every header/body cell's inline tokens and table alignment; task items also retain checked state. Twelve independent production-use-case tests pass: the former tag-maker is refused in body/header/quoted/list-nested tables; Flag no longer prefers it and Fix all excludes it; reference-link creation is refused; original paragraph/fence controls still pass; ordinary spelling inside unchanged cell emphasis applies in all four table contexts. Both placement and the live applier use the same checker. This closes the demonstrated syntax hole; the documented conservative 50,000-character span bound remains unchanged.
- **F-05:** `applyShown` re-shows leftovers only while the outer map still owns the exact captured inner map. Clear invalidates that ownership; Dismiss still mutates the owned map. Independent held-preview controls confirm the cleared annotations and quick-fix state stay gone, while no-clear coalesced leftovers and unrelated documents retain their correct state. Six independent controls cover document/global Clear, other-document isolation, Dismiss, busy/new-run gating, a later fresh run, and 1,001 coalesced fixes across 30 actual chunks with the untouched tense flag retained (1,001 applied, zero unknown).
- **F-01/F-04:** their corrections are unchanged by this delta. The large-coalesced no-clear control also protects the F-04/F-05 interaction.

### Independent verification

| Check | Independent result on `58693f03` |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass: core, webview and adapter |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings, unchanged baseline |
| Production build + `verify:bundle`, Node 18.20.8 | Pass; three existing webpack size warnings |
| Full Jest, Node 18.20.8 | **548 suites / 7,681 tests / 59 snapshots pass** |
| Scratch closure/ownership checks | **3 suites / 37 tests pass** (12 syntax, 6 Clear/ownership/coalescing, 19 preview-adapter assertions including 12 copied controls); assertions labeled observed establish the defect, not successful behavior |
| Focused repository adapter/integration checks | 2 suites / 21 tests pass, including all three multi-document Clear cases; partially overlaps the copied controls above |
| Exact implementation-head CI | [Push 40213850532](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40213850532) and [PR 40213853764](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40213853764): completed, success |

The intermediate `4fa857c7` also passed typecheck/lint/build and 548 suites / 7,659 tests / 59 snapshots, but all aggregate gates were independently rerun after the later implementation changes. Commands, Node/dependency reuse and memory-bounded execution remain as recorded above; this was not a fresh install or an independent Node 22 run. Evidence is retained outside the repository under `pr172-review-evidence/rereview2` and `rereview3`. The published report's resulting commit and exact-head CI are verified afterward, not inferred from these implementation runs.

**Not approved for merge into `epic/lightbox` on `58693f03`.** F-06 needs correction and independent re-review; F-03/F-05 no longer block. F-02 remains accepted risk, not fixed. Native VS Code preview/UI/undo/accessibility and live provider quality remain separate never-run acceptance stages. Only this report is published; implementation and scratch tests are untouched on the PR branch.

## Author response to the second re-review — 2026-10-25

**Correction head:** `825af6d2` (base `e3a7fac0`, unchanged). F-06 and the closed quick-fix wording are fixed in `ae5fb579`; the docs are in `825af6d2`. Thank you for closing F-03 and F-05.

| ID | Status | Commits |
| --- | --- | --- |
| F-01, F-03, F-04, F-05 | Closed in your re-reviews | — |
| F-02 | Accepted limit (the writer's decision), with a best-effort discard, now narrowed by F-06 | `e4c353b9`, `8803b521`, `3e2d0a25`, `6f025ba7`, `ae5fb579`, `825af6d2` |
| F-06 | Fixed: the discard is sent only once the review's own preview holds the pane | `ae5fb579`, `825af6d2` |
| Closed quick-fix wording | Fixed | `ae5fb579` |

### F-06 — the discard ends only the review's own preview

I agree with the finding. "Our `applyEdit` is pending" never meant "our preview is shown". The source offers a positive signal, so the discard now waits for it:

- **The signal.** A preview copies each file it edits into a model of its own once it holds the pane (`bulkEditPreview.ts` `_init`), and so after `_previewEdit`'s replacement confirmation. Those models reach the extension host as documents: `shouldSynchronizeModel` excludes only too-large and simple-widget models, at 1.82.0 and at `4f383697`.
- **The copy's URI** (`asPreviewUri`):
  - its scheme is `vscode-bulkeditpreview` at 1.82.0, `vscode-bulkeditpreview-editor` at main;
  - its authority is the preview's instance id;
  - its query is the file's URI.
- **`RefactorPreviews`** (new, `apps/vscode-extension/src/platform/vscode/`, no `vscode` import) follows those copies by instance. A review records the instances open when it asked. Its own preview holds the pane when an instance opened since then covers its document and nothing else; a review edits one document.
- **When it is sent.** The adapter sends Discard only for an ended review whose own preview holds the pane:
  - at the close, if the preview already holds it;
  - when its copy opens after the close, if VS Code was still opening it, or the writer then let it replace the one shown.

  Otherwise it sends nothing.
- **Never touched:** another extension's preview, another chapter's review, any preview open before the review asked, and a preview the review waits to replace.
- **Where ownership is unsure, nothing is discarded:** an unknown scheme, a copy too large to sync, or a preview of several files. One case passes for ours: a several-file preview whose first copy alone has opened, until its next copy opens. That would need another extension's several-file preview to take the pane in the instant our review's document closes.
- **A side effect** in the accepted race only. When the writer's Apply beats the close event, the late Discard finds no session and briefly opens an empty Refactor Preview panel, as you noted for any unowned send. Nothing is written by it.
- **F-02's limit is narrower now.** A preview still opening at the close is discarded as it opens, so the stated limit is only an Apply that reaches VS Code before the close event reaches the extension host.

**Tests:**
- **The shared double.** `refactorPreviewHost.ts` is now one controlled VS Code shared by both integration suites, built from the same sources:
  - a request made while another preview holds the pane waits for the writer to replace it or refuse;
  - a preview holding the pane opens its copies and closes them when it ends;
  - Discard ends whatever holds the pane.
- `draftEditPreviewLifetime.integration.test.ts`, through the production use case, applier and both adapters:
  - **Another extension's preview shown, the review waiting:** the review's document changes language. No discard is sent, their preview stays shown and unsettled, and the writer's refusal leaves the review `closed` with nothing written.
  - **Two chapters:** the first's review shown, the second's waiting. The second changes language: no discard. After the writer refuses the second, the first's Apply still writes both fixes, and the second is unchanged.
  - **Replacement after the change:** the writer then lets the waiting review replace theirs. The review is discarded as its copy opens, writes nothing, and is `closed`.
  - The F-02 witnesses and controls run on the new double unchanged in what they assert.
- `VsCodeDocumentEditor.applyEdits.test.ts`:
  - a discard when the document closes, or changes language, while its own preview holds the pane;
  - a discard when its preview opens after the close;
  - none for a preview open before it asked, even of the same document, or for a new preview covering another file too;
  - none for another document, a direct apply or a settled review;
  - a refused discard is logged.
- `RefactorPreviews.test.ts`: both schemes; earlier, several-file and closed previews; documents that are not a preview's.
- **On `58693f03`'s adapter**, all six ownership cases fail: the three integration witnesses, the opened-after-close case, and the two not-owned unit cases. Everything else passes on both.

### The closed quick fix's wording

`describeQuickFixOutcome` no longer says "nothing was changed" for `closed`. It says: "a.md was closed or changed language before the fix finished. Check it: the fix may have gone in." Once the lifetime is over, what landed cannot be read, and an Apply can win the race. Full Fix's closed line already limits itself to no flags being shown and is unchanged. Pinned in `draftEditSummary.test.ts`.

### Housekeeping

The F-05 Clear witnesses moved, unchanged in what they assert, to `draftEditClearDuringReview.integration.test.ts` on the shared double. This keeps each suite under 500 lines. The two older adapter suites' mocks gained `onDidOpenTextDocument`, which the adapter now listens to.

### Verification

| Check | Result on `825af6d2` |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings (the baseline) |
| Production build + `verify:bundle`, Node 18.20.8 | Pass |
| Full Jest, Node 18.20.8 | Pass: **550 suites / 7,694 tests / 59 snapshots** |
| Full Jest, Node 22.22.0 | Pass: 550 suites / 7,694 tests / 59 snapshots |

No live provider call, private manuscript or native Extension Development Host was used. The native checks for F-06 are the writer's:
- With another extension's refactoring shown, run Fix on a chapter, change that chapter's language while VS Code asks to replace the shown one, and refuse. The other refactoring should still be shown, its selection kept.
- Then repeat and let it replace: Proofread's preview should close at once, with nothing written.

## Astra independent re-review — preview-copy ownership, head `35d1b4f3`

**Reviewed:** 2026-10-25. **Head:** `35d1b4f30db7a36183304202392f23081f95e98c`; delta from report head `cc6767b9`: 15 files, +859 / −328, including `ae5fb579`, `825af6d2`, the report merge and the author response above.

**Request changes. F-06 remains the sole P2 blocker.** The correction improves the original already-observed-preview cases, but a preview copy's file and arrival time do not establish which request owns the current native pane. F-01/F-03/F-04/F-05 remain closed. F-02 remains the writer's accepted native-preview lifetime risk. The closed quick-fix summary overclaim is corrected.

### F-06 — a newly observed copy is not request ownership

**Locations:** [`RefactorPreviews.ts:65–70`](https://github.com/okeylanders/prose-minion-vscode/blob/35d1b4f30db7a36183304202392f23081f95e98c/apps/vscode-extension/src/platform/vscode/RefactorPreviews.ts#L65-L70), [`VsCodeDocumentEditor.ts:162–170`](https://github.com/okeylanders/prose-minion-vscode/blob/35d1b4f30db7a36183304202392f23081f95e98c/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L162-L170), [`VsCodeDocumentEditor.ts:211–246`](https://github.com/okeylanders/prose-minion-vscode/blob/35d1b4f30db7a36183304202392f23081f95e98c/apps/vscode-extension/src/platform/vscode/VsCodeDocumentEditor.ts#L211-L246).

`holds` accepts any instance absent from the request's `before` set with exactly one observed file matching the request URI. The instance ID belongs to a native preview provider, but is never correlated with this particular `applyEdit`. Model-open delivery can lag behind native pane ownership, and the observed file set can be incomplete. The result is still an unowned global Discard.

Independent production-adapter witness, reproduced with **both supported preview schemes**:

1. Foreign preview **A** owns the pane for file **D**, but its copied model/open event has not yet reached the extension host.
2. Proofread **B**, also for D, asks for preview and waits for replacement confirmation. Its `before` set does not contain A.
3. A's copy arrives. The heuristic now labels A as B's own preview because the instance is new to B and its only observed file is D.
4. A programmatic close/language event for D causes B to send global Discard. **A is cancelled without the writer agreeing to replace it.** B can subsequently refuse the replacement dialog.

The same cancellation is reproduced through the **production use case, applier and both VS Code adapters**, with either event order: B's lifetime ends before A's delayed copy arrives, or A's copy arrives first. In both cases B is still awaiting replacement confirmation, its run returns `closed`, and the document text is unchanged.

This ordering is grounded in the host source, not a native UI claim: [`BulkEditPreviewProvider._init`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts#L386-L438) awaits each file/model reference, and [`BulkEditPane.setInput`](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts#L183-L218) does not await the provider's asynchronous model-copy initialization before adopting its input. The same provider behavior is present at [the pinned current source](https://github.com/microsoft/vscode/blob/4f383697191fef7129052d5396d5709d5799934a/src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts). A file URI and an observed-after timestamp therefore are not a request token.

Additional controls expose the same inference error when only the first of a foreign multi-file preview's copies has arrived, or when another copy never synchronizes: VS Code excludes [too-large/simple-widget models](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/editor/common/model.ts#L1427-L1431) from extension-host synchronization. The code/author response acknowledge the first-copy case; that acknowledgement is **not** the writer accepting cancellation of unrelated reviews. A delayed global command can also act on a subsequent preview: the command still targets whichever pane is current when it executes, not a captured instance. These are controlled source/RPC-ordering witnesses, not measured native timing; the demonstrated consequence is loss of another pending review/selection, **not** an additional document write.

The shared repository double now tests more useful flows, but opens all copies synchronously in `pane.take` and closes them synchronously in `release`. Those assumptions exclude asynchronous-copy and stale-inventory cases and cannot establish the claimed “another extension is never discarded” guarantee.

**Requested correction remains narrow:** avoid automatically mutating a global preview without request/current-session ownership that survives dispatch. A model inventory heuristic is insufficient. If the public API cannot provide that guarantee, **omit automatic global Discard while keeping native preview** and retain the already accepted F-02 lifetime limitation. No replacement UI or strict pre-commit barrier is required by this review. Any broader acceptance of cross-preview cancellation would require a separate writer decision; it is not inferred here.

### Positive results and limits

- The original witnesses where a foreign preview's copy is already observed before B asks now leave that preview alone; ordinary owned-preview discard and delayed-opening controls pass.
- The closed Fix-all message now warns that the fix may have gone in and asks the writer to check. This correctly distinguishes uncertain write outcome after lifetime loss from a proven no-change result.
- Existing table-structure and Clear ownership corrections are unchanged. Their regression coverage remains part of the full gate.
- F-02 is still accepted risk, not fully fixed. Native preview/UI/undo/accessibility and live-provider quality remain separate never-run acceptance stages; no private manuscript or provider call was used.

### Independent verification

| Check | Result on `35d1b4f3` |
| --- | --- |
| Typecheck, Node 18.20.8 | Pass: core, webview and adapter |
| Lint, Node 18.20.8 | Pass: 0 errors / 1,133 warnings, unchanged baseline |
| Production build + `verify:bundle`, Node 18.20.8 | Pass; three existing webpack size warnings |
| Full Jest, Node 18.20.8 | **550 suites / 7,694 tests / 59 snapshots pass** |
| Independent scratch | **3 suites / 37 tests pass**: 24 copied repository controls and 13 independent ownership/lifecycle/wording cases; observed-defect assertions are not successful product acceptance |
| Focused repository preview/Clear checks | **4 suites / 33 tests pass**, overlapping the 24 copied controls above |
| Exact implementation-head CI | [Push 40217145604](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40217145604) and [PR 40217148483](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40217148483): completed, success |

The independent scratch suite also includes a retained-model lifecycle counterexample. It is explicitly modeled, not claimed as a native-retention reproduction; the same-file asynchronous-copy finding above does not rely on it. Logs, scratch harnesses and pinned official sources remain outside the repository under `pr172-review-evidence/rereview4`. The previously recorded Node/dependency reuse and never-run limitations still apply. Report publication and its exact-head CI are checked afterward, not pre-claimed here.

**Not approved for merge into `epic/lightbox` on `35d1b4f3`.** F-06 remains open; the other dispositions above are unchanged. Only this appended report is published, preserving the original review and all author responses.
