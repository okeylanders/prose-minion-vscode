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
