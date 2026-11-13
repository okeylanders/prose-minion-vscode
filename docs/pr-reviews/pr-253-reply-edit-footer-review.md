# PR #253: Reply Edit Actions Slice 3 review

## Scoped re-review: N1 resolved (2026-11-10)

- **Reviewed fix:** `8be7c0b06d02dd827aff027e9419656342822e1d`.
- **Verdict:** **Approved on technical review. N1 is resolved; no remaining findings.**
- The footer copies the incoming offers before sorting by `WORKSHOP_EDIT_OFFER_KINDS`, whose declared order is fixes then rewrites. It keeps the same offer objects, kind-based React keys, and action payloads. The new regression checks both reversed input and preservation of the incoming array.
- Independent rerun: **7 suites / 93 tests passed**, covering the footer, chip view, edit-offer hook, real app edit offers and reactions, stylesheet order, and Chromium CSS floor. `npm run typecheck` passed all three stages; `git diff --check ba2ab3d3..8be7c0b0` passed.
- Both exact-fix CI runs passed: [PR CI 42817230016](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42817230016) and [push CI 42817219042](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42817219042). This scoped pass relies on those runs for the full suite, lint, and build; the prior independent full-suite result below remains tied to its original reviewed SHA.
- No live VS Code/model pass or merge was performed. The documentation update recording this re-review has its own CI status.

The original review below is retained as the historical record.

## Resolution ledger

| Finding | What changed | Test |
|---|---|---|
| **N1** (P3, non-blocking) Fixes before rewrites, whatever order the reply declared | `WorkshopTurnFoot` draws a sorted copy of the turn's offers, by `WORKSHOP_EDIT_OFFER_KINDS`. The turn is not mutated, and which action each chip asks for is unchanged. | `WorkshopTurnFoot.test.tsx`: a rewrites-first reply draws fixes first, and the declared list keeps its order. |

- **Reviewed code:** `22668b920b578070d0052717ccb995f25e8e830d`.
- **Base:** `e250a6d7656398079adf987403c489849afb7045` (`epic/workshop-reply-edit-actions`).
- **Date:** 2026-11-10.
- **Verdict:** **Approved on technical review, with one non-blocking P3 finding.** No blocking correctness or safety regression found in this slice.
- **Scope:** The footer, edit-offer chips, hook and message routing, request/answer lines, card marks, offer-only reply handling, changed tests, and supplied visual evidence. No merge performed.

## N1 (P3): Keep fixes before rewrites regardless of declaration order

**Location:** [`WorkshopTurnFoot.tsx:54–62`](https://github.com/okeylanders/prose-minion-vscode/blob/22668b920b578070d0052717ccb995f25e8e830d/packages/core/src/presentation/webview/components/workshop/editOffers/WorkshopTurnFoot.tsx#L54-L62).

The footer maps `turn.editOffers` directly. The protocol allows either declaration order, and the resolver, stored turn, and webview projection preserve that order. A valid reply that declares rewrites first therefore renders **rewrites, fixes**, including that keyboard order. U1 specifies **fixes, rewrites**. The existing footer test only supplies its offers in the desired order, so it does not catch this.

An independent temporary component probe passed `[offer('rewrites', 2), offer('fixes', 3)]` into the real `WorkshopTurnBubble` and checked its `[data-pm-offer]` nodes. The expected `['fixes', 'rewrites']` failed with `['rewrites', 'fixes']`.

Render a non-mutating ordering by kind before mapping, and add the reversed-input case. This is a presentation consistency issue: each button still carries the correct kind and target, so it does not block approval.

## What checked out

- The new hook sends only the minted request id, room revision, source turn id, and kind. Its synchronous pending set prevents repeated presses on the same chip. Duplicate and unrelated results are not announced or adopted.
- The host remains the authority for offer availability and status. The UI adds only this webview's pending state; it does not infer edits from prose, resolve files, or write them. Turning file edits off removes offers from the host projection, and the existing settings watcher republishes that projection.
- Asked chips remain mounted and focusable. Waiting chips use `aria-disabled`, explain why they wait, and do not dispatch. Answered chips navigate even while the room is busy. The hook, rather than individual chips, owns the result announcement.
- The request and answer links use the existing scroll/focus path. Requests render as event lines. Answer text is rendered as plain text, and the existing Apply, Review, and Decline card controls retain their behavior.
- The reaction corner remains mounted inside the new footer, including when its empty row is hidden. Its removal focus fallback still reaches the enclosing focusable bubble. The changed reaction assertion correctly reflects the added wrapper.
- An offer-only reply receives the host's empty-reply line in both display and retained history, loses its offers, and has no model attribution. The implementation's deliberate choice not to assign the reaction-specific `noMessage` marker is documented.
- Inspected the supplied wide footer, all chip states, answer cards, and narrow-column PNGs. The supplied narrow example wraps the widget chip and keeps reactions aligned at the right. This was inspection of supplied rendered evidence, not a fresh interactive VS Code pass.

## Independent verification

Checks ran on the reviewed code under Node `v24.22.1`, without live provider calls.

- `npm run typecheck`: passed core host, webview, and extension stages.
- `npm run build`: passed both production bundles and bundle verification. Webpack reports its existing size warnings.
- `npm run lint`: passed with **0 errors and 1,171 warnings**, matching the PR's stated baseline.
- `git diff --check e250a6d7`: passed.
- `npm test -- --runInBand`: **836 suites, 11,779 tests, and 59 snapshots passed**, with a clean process exit.
- Additional temporary reversed-offer probe: **1 expected failure**, reproducing N1 above. The temporary test was removed; no production code was changed.

## CI and remaining scope

[CI run 42812862886](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42812862886) passed for exact reviewed head `22668b920b578070d0052717ccb995f25e8e830d`. Its job records successful install, all three typechecks, tests, lint, and both-bundle build. The review-report commit is documentation only and will have its own CI status.

No Extension Development Host session, assistive-technology session, or billable-model call was run. The epic's planned live pass remains useful for settings changes with visible offers, rapid presses on the two chips, Stop/retry, and keyboard/screen-reader behavior. This review does not mark the epic's live-verification slice complete.

The publishing account is also the PR author. Technical approval is recorded here and in a COMMENT review rather than a formal self-approval.
