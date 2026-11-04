# PR #189 review: Workshop Wayfinding Slice 5, bookmark UI

**Disposition: changes requested. Two independently reproduced P2 lifecycle issues. Review continues.**

**Reviewed implementation:** `9b2a60585a443dd19cc622d441f84e19faccd8d0`  
**Base:** `356c7519b9ed5355cb86027bb55f6eae389a43af`  
**PR:** [#189](https://github.com/okeylanders/prose-minion-vscode/pull/189) · **Reviewed:** 2026-11-04

The PR is marked draft and its slice remains in progress. This early report shares confirmed issues while the remaining implementation and review continue; it is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: a refused rename can discard the writer's draft

**Location:** [`useWorkshopBookmarkRename.ts:103–114`](https://github.com/okeylanders/prose-minion-vscode/blob/9b2a60585a443dd19cc622d441f84e19faccd8d0/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopBookmarkRename.ts#L103-L114).

The controller posts a valid rename and immediately closes the field and clears its draft, before the host has accepted the mutation. A real App → refresh/bookmark route probe demonstrates a reachable refusal:

1. Begin renaming a bookmark and type a valid new label.
2. Switch to Material and invoke **Refresh changed files** while prior persistence I/O is held. The host has acquired its session-operation gate, but the later scanning snapshot has not yet been posted.
3. Switch back to Notes and choose Save; it is still enabled.
4. The host refuses the rename under the gate. The stored label remains original, but the field has closed; reopening shows the original label and the typed draft is lost.

This is not a synthetic submit through a disabled control. Keep a submitted draft until the host confirms the change, or restore it on refusal, while preserving ordinary save, Escape and room-replacement behavior. Add a production App/host regression for a gate refusal and a successful-rename control. The probe uses the real routes and holds the persistence wait at its documented gate seam.

## F-02: P2: a preview requested in one room can briefly show another room's turn

**Location:** [`WorkshopBookmarkHandler.ts:88–110`](https://github.com/okeylanders/prose-minion-vscode/blob/9b2a60585a443dd19cc622d441f84e19faccd8d0/packages/core/src/application/handlers/domain/workshop/WorkshopBookmarkHandler.ts#L88-L110).

The preview route waits for a pending session operation, then reads whichever room is current. A request is correlated by request ID and turn ID, but not by the room generation in which it was made. If Open is pending and the old and new checkpoints share a turn ID, a request from the old room can be answered with the new room's content before the new-room snapshot invalidates the old sheet.

An independent test using both production message handlers, real router, coordinator, store and aggregate holds Open during its context scan. It observes the actual post order `WORKSHOP_TURN_PREVIEW` with the new room's content, then `WORKSHOP_SESSION_STATE`. A full-App probe delivers those messages in that order: the old bookmark's dialog accepts the other room's content, then closes once the new room-revision snapshot arrives. The mismatch is transient in this witness, not a claim of a lasting cross-room state or an external disclosure.

Bind the read to the originating room generation and refuse or discard it if replacement changes that generation, including while waiting. Test a shared turn ID across rooms and both successful and failed replacement, as well as the normal current-room control. Recheck queued replacements rather than relying solely on a single captured queue promise.

## Verification so far

Independent production coverage so far includes **12 suites / 219 tests** for bookmark UI/state and **9 suites / 180 tests** for preview/access boundaries; these may overlap. The separate lifecycle probes reproduce F-01 and F-02 and are not part of those passing totals. More privacy, preview completeness and room-operation review remains. Exact-head CI is still in progress. No implementation change, formal approval or merge was made.


## N-01: P3: the preview drops the private-audience label

**Locations:** [`WorkshopTurnPreview.ts:24–45`](https://github.com/okeylanders/prose-minion-vscode/blob/d76180c2510a905da98645ef856cc5e382b83eaa/packages/core/src/application/services/workshop/transcript/WorkshopTurnPreview.ts#L24-L45), [`WorkshopTextSheet.tsx:206–216`](https://github.com/okeylanders/prose-minion-vscode/blob/d76180c2510a905da98645ef856cc5e382b83eaa/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L206-L216).

The preview payload preserves `privateWith`, but the sheet does not display it. A real-route/App witness pins an excerpt, runs Prose, selects that target, sends a private message and bookmarks both writer and assistant turns. In-window, both bubbles say “Private · you + Prose.” After the ledger advances beyond the 200-turn window, the actual preview route returns `privateWith: 'Prose'` for both, yet neither preview displays the private label. The writer's preview does not name Prose at all; the assistant preview names its speaker but is indistinguishable from a room-visible tool report.

This does not transmit private data to a new recipient, but it omits useful context about who heard the exchange. Render the safe private-audience label in the read-only preview and test both writer and assistant turns against their in-window labels. This is nonblocking.

## Further verification

The F-01 reproduction has now been strengthened through the real App, production routes, persistence coordinator and store; only a disk write was deferred to model slow I/O. The latest `d76180c` delta after `9b2a605` splits App tests and updates documentation only; production behavior is unchanged. Independent verification includes **12 suites / 219 tests** on the implementation, the latest split suites and real-coordinator lifecycle probes, plus **9 suites / 180 tests** for preview/access boundaries. The App and route witnesses for F-01 and F-02 remain separate from passing production totals.

[CI run 41772202938](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41772202938) passed on synthetic merge `6a30822` of `9b2a605` into `356c751`: **625 suites / 8,891 tests / 59 snapshots**, typecheck, lint and both builds. Current-head CI is being checked. F-01 and F-02 remain open despite green CI; the broader review is continuing.


## Completed review

The initial review is complete. F-01 and F-02 require correction; N-01 is a separate nonblocking loss of private-audience context. No additional actionable defect was established in snapshot-only toggles, bookmark badge identity/order, writer jump targets, supported overlay focus paths, route eligibility, or host-private preview projection. The preview's intentionally narrow subset also omits safe widget/attachment/citation metadata; a blank widget-only history is supported by transcript fixtures, but no current ordinary UI producer of such a blank turn was established, so no separate production-flow finding is asserted.

The real coordinator/store F-01 witness and the real handlers/router plus full-App F-02 witness both reproduce the reported outcomes. Five independent lifecycle probes also cover rename survival through tab and unrelated snapshot changes, room-generation reset, visible-lock preservation, badge behavior and failed New rollback. Five independent preview App probes include the normal-route private-turn witness. These are separate from the production suite totals above.

The latest implementation-bearing head `d76180c` differs from `9b2a605` only in documentation and test organization. [Its CI run 41773308472](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41773308472) was still running at review completion; the earlier implementation run passed. Native VS Code focus and live writer acceptance remain unverified. Correct F-01/F-02 and re-review the exact new head. No formal approval or merge was made.

## Author response

Both findings are fixed in `10e4f4b`, on top of the reviewed `9b2a605` and the docs commit `d76180c`.

| Finding | Status | Fix | Regression |
|---|---|---|---|
| F-01 (P2): a refused rename discards the draft | Fixed in `10e4f4b` | `WORKSHOP_RENAME_BOOKMARK` carries a webview-minted `requestId`. The host answers it with `WORKSHOP_RENAME_BOOKMARK_RESULT` (`accepted`, or refused with the host's reason), including the session-operation gate's refusal, through the route's `onBlocked`. `useWorkshopBookmarkRename` keeps the submitted draft, read-only and marked "Saving…", with Save disabled, until that request is answered. Accepted closes the field. Refused gives the draft back with the reason (`role="alert"`, `aria-invalid`). A later snapshot's label is never read as the answer. Escape and room replacement still close the field. | `WorkshopApp.bookmarkHost.test.tsx`: the real App bridged to the real router, slice composition and session. Cases: a gate refusal keeps the draft and shows the reason, and the label is unchanged, then the same draft saves; an accepted rename closes onto the new label; a reset to the default closes, though its snapshot alone is ambiguous; Escape; room replacement. Also `WorkshopRoutes.bookmarks.test.ts` (results for gate, ledger and label refusals; accepted after the snapshot; a rename without a request id is malformed), `WorkshopBookmarkList.test.tsx` and `useWorkshopBookmarks.test.ts` (only the pending request's answer is taken). |
| F-02 (P2): a preview requested in one room can show another room's turn | Fixed in `10e4f4b` | `WORKSHOP_REQUEST_TURN_PREVIEW` carries the snapshot's `roomRevision`, which the host echoes. The host waits while any session operation is pending, re-checking after each one, so it never relies on one captured queue promise. It then refuses with "The room changed before this message could be shown." and no turn when the current room is another. That covers a request that arrives after the room was already replaced. As a second guard, the webview drops a reply that names another room, or that arrives once its room is no longer on screen. | `WorkshopTurnPreviewRoomBinding.test.ts`: the real handler and router over the real coordinator, store and aggregate, with two saved rooms sharing a turn id. Cases: Open landing while the request waits; Open already landed; a second Open queued after the request began waiting; a failed Open (answered from the unchanged room); the current-room control. Against the old logic, the revision check fails three of these and the single wait fails the queued case. `WorkshopApp.turnPreview.test.tsx` covers the observed order, preview first and then the new room's snapshot: the refusal shows, then the sheet closes, and a reply naming another room is never shown. |

- **Counts at `10e4f4b`, clean tree.**
  - 628 suites / 8,910 tests / 59 snapshots, all passing.
  - Typecheck clean.
  - Lint: 0 errors, 1,150 warnings, up from 1,146. All four new ones are `naming-convention`: `WORKSHOP_RENAME_BOOKMARK_RESULT`, the bridge test's `PmLogo` mock, and the jsdom `TextEncoder`/`TextDecoder` shim.
  - No `from 'vscode'` in core.
- **Note.** The bridge test imports `__tests__/presentation/webview/support/jsdomTextEncoding.ts` first, because the session store creates a `TextEncoder` at load and jsdom has none.
