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
