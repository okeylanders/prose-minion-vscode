# PR #233 review: Host Apply and durable checkpoint

**Disposition: approve the host slice, with one nonblocking outcome-copy correction below. No new dispatch, claim, checkpoint, codec or durability blocker found.**

- PR: [#233](https://github.com/okeylanders/prose-minion-vscode/pull/233).
- Implementation reviewed: `d0c172b79d12e5a441416802f023580f44156703`.
- Base: `2ddddce75f185f0112a8bfa93fe9c0e1d2987b25`.
- Date: 2026-11-06.
- Initial and pre-publication checks found no existing review or discussion on this PR.
- Scope: all 34 changed files, the stored-proposal codec, persistence queues/store, live document applier/adapter, lifecycle and route composition, plus ADR D7–D10. The webview in #234 is reviewed separately. Nothing was merged.

## N-01: Partial-state wording overstates what is known

**Anchor:** [workshopFileEditWords.ts:104](https://github.com/okeylanders/prose-minion-vscode/blob/d0c172b79d12e5a441416802f023580f44156703/packages/core/src/shared/constants/workshopFileEditWords.ts#L104).

The `partial` line says: “Some of the changes were applied; the rest were not.” A partial card may also contain `unknown` outcomes. The production handler, coordinator, gateway and applier correctly retain `['landed', 'unknown']`, including after persistence, but the result message still asserts that the unknown operation was not applied.

Independent witness: stage two replacements in separate paragraphs; during review, land the first replacement and change the second passage to other text. The real applier classifies the second operation as unknown. The saved card remains partial with that uncertainty intact, while the result uses the stronger sentence above.

This sentence already existed in the earlier gateway copy. This PR centralizes it and exposes it through the new host/card contract, so it is documented as inherited, nonblocking copy debt rather than a new loss of outcome data. No blind retry is introduced: partial cards still replay, and the webview's per-operation badges preserve uncertainty.

**Suggested correction:** use a neutral partial summary such as “Some changes were applied. Check each operation below; an outcome may be unknown. The file is not saved yet.” Alternatively, select the line from per-operation outcomes. Cover both landed/not-applied and landed/unknown cases in the host answer and persisted card display.

A related wording detail: `room-changed` says “nothing changed,” although a review already dispatched before room replacement can still land. The source session correctly reopens as unknown. The #234 client filters old-room receipts, so this is not a presently demonstrated UI defect; keep that filter, or give a dropped post-dispatch outcome uncertainty wording before exposing it.

## Safety and durability conclusions

- **Authority is stored, not supplied by the action.** The request names its room, turn, index and action. Operations, baseline, identity and class come from the host's card. Room revision is checked before a claim, including same-id reopen cases.
- **The claim precedes every await.** Apply/Review duplicates join the held card, and Decline cannot change it during the claim. Terminal cards replay. An independent append witness confirms that duplicate requests produce one append, rather than merely relying on replace freshness to hide a double write.
- **The durable checkpoint is a real result.** It waits for earlier autosaves and session operations, writes the named source before the rolling mirror, and reads them back. A write, capture or mirror failure does not reach the document. Independent corrupted-read-back probes for rolling and named/mirror paths also refuse before dispatch.
- **Ordering remains intact.** Later room replacement queues behind the checkpoint. The gateway's final synchronous predicate, and its per-attempt callback, reject an obsolete generation or disabled setting. The checkpoint itself need not sit between planning and applying: completing awaited persistence before gateway resolution keeps the final document boundary synchronous.
- **Replacement after dispatch remains conservative.** An independent held-review witness lets a host edit actually finish after reset. It produces one write, drops the old-generation outcome, leaves the named source applying, and reopens as unknown. A subsequent Apply does not write again. This is the ADR's accepted uncancellable-review limit, not a claim that switching rooms cancels VS Code's review.
- **Settlement is codec-checked and atomic in the ledger.** Invalid settlements leave the previous card unchanged; the handler falls back to unknown when a gateway result cannot be represented. Known landings, non-landings and unknown outcomes remain distinct in valid settlements.
- **Landed records cover actual known landings.** They retain the planned before/after, separators, bounded context and settled version, with hashes beyond the revert bound. Context is intentionally derived from planned text; future Revert must revalidate it against the actual buffer. This review does not approve a future Revert implementation.
- **Preview is read-only apart from a guarded stale mark.** It shares identity resolution, verifies the rewrite baseline, and only marks a still-pending, unclaimed card in its own room stale.
- **Composition and architecture remain explicit.** The gateway stays behind `FileEditApplyPort`, the handler constructs no infrastructure, mutations use the room gate, and the pure checkpoint contract is separate. The already-large persistence coordinator grows by about 70 lines to use its existing queue/authority state. Keep that extraction debt visible; no second persistence queue or competing store owner was introduced.
- **Shutdown does not wait indefinitely for a review.** Recovery relies on acknowledged applying state. This review did not perform an interactive extension-host shutdown or claim that a pending VS Code Refactor Preview can be revoked.

## Verification

At implementation `d0c172b7`:

- Local `npm run typecheck`: passed for core, webview and extension.
- Local `npm run lint`: 0 errors / 1,165 warnings, matching the PR's baseline.
- Focused Jest: **15 suites / 396 tests passed**, covering handler/actions/proposals, checkpoint integration, gateway, landed records, shared words and architecture boundaries.
- Independent production-stack witnesses: **8 tests passed**. They cover mixed landed/unknown outcomes, failed rolling read-back, failed named mirror read-back, setting loss during delayed resolution, duplicate append, dispatched review after room replacement, old-generation same-id requests, and discarded-review retry. The outcome-copy test deliberately asserts the observed defect; it is not evidence that the copy is fixed.
- [Exact-head CI run 42138844932](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42138844932): **success**. Its `verify` job reports successful dependency install, three typechecks, tests, lint and both webpack bundles.
- The entire test suite and production build were not repeated locally; their result above is from CI, not inferred from the focused run. No interactive VS Code UX, live provider request or real filesystem crash was exercised.
- `git diff --check`: clean for the review artifacts.

The report-only commit leaves implementation unchanged. Its own current-head CI is a separate gate and must be checked on the PR after publication; the successful implementation run is not a claim that a later commit's CI has finished.

## Reproduce the independent witnesses

The full source is [probes/pr-233-apply-checkpoint-review.test.ts](probes/pr-233-apply-checkpoint-review.test.ts). It is outside normal Jest discovery so the observed-defect assertion does not become a permanent desired-behavior test.

From the repository root:

```sh
cp docs/pr-reviews/probes/pr-233-apply-checkpoint-review.test.ts \
  packages/core/src/__tests__/application/services/fileEdits/pr233IndependentReview.test.ts
npm test -- --runInBand --runTestsByPath \
  packages/core/src/__tests__/application/services/fileEdits/pr233IndependentReview.test.ts
rm packages/core/src/__tests__/application/services/fileEdits/pr233IndependentReview.test.ts
```
