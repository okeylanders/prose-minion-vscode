# PR #256: Writer-message reaction tapback review

## Verdict

**Scoped technical approval at `0e5b316f5aaa281ba728013743b0a0998a5d8b18`. No blocking findings.** The writer's reaction corner is moved into a small, presentation-only wrapper. Existing removal, lock, duplicate-activation and focus behavior remains intact. No production code was changed by this review.

This is a **post-merge review**. PR #256 had already merged into `epic/workshop-reply-edit-actions` at `d483124b222adee55190f6fc5f504bc0d1d01706` on 2026-11-11 at 19:26 UTC before this pass began. This report does not grant or imply a merge decision. No merge, auto-merge or deployment was performed. A report subsequently committed to the original source branch is not automatically part of that earlier epic merge.

- PR: <https://github.com/okeylanders/prose-minion-vscode/pull/256>
- Reviewed head: `0e5b316f5aaa281ba728013743b0a0998a5d8b18`, `epic/workshop-message-reactions-slice-3c-tapback`.
- Base: `16690cc5b6a720cfb4b2cf6fcaa728762a5fc261`, `epic/workshop-reply-edit-actions`.
- The production Workshop components and reaction CSS at the epic merge match the reviewed head.
- Reconciliation: no submitted GitHub reviews or conversation comments at the start or before publication; no concurrent reviewer identified. The original branch still exists and retained the reviewed SHA before publication.
- Scope: the new `WorkshopWriterMessage`, its integration into `WorkshopTurnBubble`, reaction CSS, the changed tests, ADR/epic notes and visual-harness evidence, plus the existing corner and reaction controls. Unrelated epic features and deferred PR #205 are outside this review.

## Findings

No correctness, persistence, privacy or authorization regression was found in this slice. There are no requested production changes.

1. **Composition and layout.** `WorkshopWriterMessage.tsx:29–39` derives the tapback class from the turn's current reaction list. The corner follows the message text and precedes the writer's widget/action rows. The one-column grid and in-flow negative margin let a wrapped cluster consume vertical space without a separately guessed action-row offset. The frame is bounded by both the available width and the existing 640 px bubble ceiling. Additional bottom padding applies only while reactions exist.
2. **Empty and changing state.** The corner remains mounted when its reaction list becomes empty. This preserves the existing ref-based focus fallback to the enclosing turn, while `:empty` removes its layout box. The wrapper does not add a focus stop, event handler or independent pending state.
3. **Actions and focus.** `WorkshopTurnReactionCorner` and the hook/host mutation paths are unchanged. Existing production tests cover hide, next/previous/last-removal focus, double activation, locked-but-focusable controls, and persona behavior. Independent probes additionally exercised a delayed hide after focus moves elsewhere, host refusal followed by retry, and three consecutive lock/unlock/appear/remove cycles. All passed.
4. **Persona isolation.** The assistant/persona path continues to use `WorkshopTurnFoot`; it does not use the writer wrapper. The new background/ring and overlap selectors are scoped below `.pm-ws-turn-message-frame`. The committed before/after persona captures preserve the same geometry; their pixels are not identical, so they are not treated as a pixel-diff test.
5. **Persistence and data handling.** No session, transcript, codec, message contract, prompt, provider request or write path changes. Text remains a React text child, without new HTML interpretation. Existing sessions supply the same reaction summaries to the new visual placement. The saved/exported data is not given a new schema obligation.
6. **Architecture.** The new component is 40 lines and keeps a single presentation responsibility. `WorkshopTurnBubble` remains a pre-existing oversized component, but this change reduces its size rather than adding behavior to it. No layer boundary or `vscode` dependency is added.

## Verification

Independent local checks ran on Node `v24.22.1` with the reviewed checkout's locked dependencies (`npm ci --ignore-scripts`). No dependency manifest or lockfile changed.

| Check | Result |
|---|---|
| Reaction/tapback/footer/CSS production tests | **24 suites / 324 tests passed** |
| Independent interruption/focus probes | **1 suite / 3 tests passed** |
| Core, webview and extension typechecks | **Passed** |
| Repository lint | **0 errors / 1,171 warnings**, matching the reviewed CI count |
| Production build and bundle sentinel check | **Passed**; the existing three webpack size/performance warnings remain |
| `git diff --check` | **Passed** |

Focused command:

```sh
npm test -- --runInBand --testPathPattern='(Reaction|reactions|writerTapback|WorkshopTurnFoot|workshopStyles|webviewCssFloor)'
```

The independent test is preserved at [probes/pr-256-tapback-interruption.test.tsx.txt](probes/pr-256-tapback-interruption.test.tsx.txt). Copy it to `packages/core/src/__tests__/presentation/webview/Review256Independent.test.tsx`, run the following, then remove the temporary copy:

```sh
npm test -- --runInBand --runTestsByPath packages/core/src/__tests__/presentation/webview/Review256Independent.test.tsx
```

Full tests were not rerun locally. The logs for [CI 43085483970](https://github.com/okeylanders/prose-minion-vscode/actions/runs/43085483970) independently confirm **843 suites / 11,915 tests / 59 snapshots**, all three typechecks, lint and both production bundles passed on Node `v18.20.8`. The checkout log identifies synthetic merge `25f6978`, merging the exact reviewed head `0e5b316f...` into base `16690cc5...`. This is the PR-associated merge validation, not a claim that CI checked out the source branch directly.

## Visual evidence and limits

I inspected the committed `after-thread-900.png`, `after-writer-wrap.png` and `before-writer-three.png` from [the supplied evidence](evidence/workshop-reactions-slice-3c-tapback/README.md). The supplied captures show the intended attached reaction chip, clear action rows, and a wrapped cluster within the short writer bubble. I also inspected both persona captures; their dimensions and reaction placement match, although there is a small rendered-text difference in the action area, so no byte- or pixel-identical claim is made. The 170/260 px examples constrain individual turn widths inside a wide Workshop viewport; they are not evidence that the entire Workshop shell is responsive at those viewport widths.

**A fresh independent Chromium replay could not start.** Both the normal launch and an escalated launch failed before loading the page because this environment refused Chromium's process-singleton socket (`socket() failed: Operation not permitted`). No browser geometry or keyboard probe from that attempt executed, and no new screenshot is claimed. DOM tests verify element order, handlers and focus transitions, not native tab navigation, layout or assistive-technology behavior.

No installed VS Code Extension Development Host, screen reader, live provider call, user session file or broad epic integration acceptance pass was exercised. These limits qualify the scope of approval; they are not reproduced defects.

The report-only commit's CI is separate from the reviewed code's existing successful run and must be checked after publication. Because the PR is already merged, the source branch's push workflow may run without a new pull-request workflow.
