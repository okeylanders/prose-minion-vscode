# PR #213 review: Context-sheet pin marks

## Final correction re-review — 2026-11-05

- **Reviewed head:** `f2d5a6c29a099897ce44d440fde9f1e66a5f8941`; implementation correction `0121923820ef76e9ef4be46b1436b33c8d94ecdc`.
- Target: `epic-pinned-context`, observed at `fe30330e177a1396cc82748110f290fd34e8591a`.
- **Verdict: Review clear. F01 and N01 are closed. No confirmed findings remain.**
- [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41975707448/job/127073931693) passed typecheck, tests, lint and both webpack bundles. GitHub reported mergeable/clean.
- No formal approval, merge, provider call or deployment performed.

### What closed the findings

**F01:** a posted Pin now records the room revision and the attachment's owner key (id, kind, paths and added time). Pill-specific refusal and landing state require both to match. `WorkshopApp` passes the snapshot's `roomRevision`; the aggregate mints a new revision on reset and hydration/replacement. Global pin marks and the Slice 3 observation-order rules remain independent of action ownership.

**N01:** focus returns only if that pill's Pin held it when its ref was detached for removal. The pending button uses `aria-disabled` and a guarded click instead of native `disabled`, preserving focus while the request waits. Deliberate blur and movement to another control remain respected. Ref-detach focus state is cleared after the commit.

The original four probe cases now pass with only the newly required room input supplied. Additional checks confirm:
- Identical file/id/added time reused in a different room cannot inherit a late refusal or success.
- A valid same-room refreshed snapshot retains its own refusal and landing.
- A changed attachment identity cannot inherit an old refusal.
- Pending Pin retains focus, announces disabled state and does not repeat its request.
- A later panel remount cannot reclaim focus from an old landing.
- Existing same-room pin, mark, count, refusal and Remove behavior still passes.

Preserved correction evidence:
- [Original probe adapted only for the room API](probes/pr-213-pill-identity-adapted.test.tsx.txt).
- [Additional ownership and focus edges](probes/pr-213-pill-edges.test.tsx.txt).

### Final verification

- All **1,986 apps/packages blobs** matched the exact correction head, independently verified and rechecked after testing.
- Complete local baseline: **724 suites / 10,148 tests / 59 snapshots passed in one uninterrupted run** (886 seconds), including the promoted regression tests.
- `npm run typecheck`: **pass**, all three projects.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings; temporary review probes excluded.
- Independent targeted replays: **3 suites / 19 tests passed** (the original four, eight additional edges and seven supplied identity regressions).
- Exact-head CI: **pass**, including both bundles.
- The earlier original-head full run encountered temporary-disk exhaustion in resource-staging only. That unchanged 3-test suite passed on retry. The final correction baseline used workspace-backed temporary storage and passed completely.
- React/jsdom and real host/aggregate fixtures were exercised. Native Chromium remained blocked by the execution environment's Unix-socket restriction, so no native visual/focus result, native Windows runtime or live provider call is claimed. The planned live Extension Development Host pass remains separate.

This verdict applies to the exact implementation and target above. The historical finding text follows for traceability and is superseded by this final result.

---

## Initial review (historical)

- Reviewed head: `ecfde3ea5ca8f750211ded813a6c8fe7ea1879a6`.
- Target: `epic-pinned-context`, observed at `fe30330e177a1396cc82748110f290fd34e8591a`.
- Date: 2026-11-05.
- **Verdict: Changes required.** One medium-priority stale-ownership finding, plus a low-priority focus note.
- Scope: Slice 4's derived pin marks, pill action/result identity, match rule, request ordering, focus behavior, count, styling, accessibility markup and integration with the Slice 3 hook.
- No implementation changes, formal approval, merge or provider call performed.

## F01 · Medium / P2 · Bind pill outcomes to the room and attachment that requested them

**Locations:** `useWorkshopPinnedPills.ts:63–68,70–78`; `workshopPinnedPills.ts:100–102`; the controller is mounted in `WorkshopApp.tsx:260`.

The controller remembers only `{ attachmentId, requestId }` and survives room replacement. The view treats any current attachment with that id as the owner of the old request. Attachment ids are local to a room: `WorkshopSessionService.reset({ clearWorkingSet: true })` clears `attachmentCounter` at line 2039, and hydration restores saved ids. A new room can legitimately contain a different `ctx-1`.

**Confirmed with the real host handler, library/store/intake and aggregate reset, joined to the real hook/controller/ContextPanel:**

1. Room 1 has Alice as `ctx-1`. Click its Pin button.
2. The handler captures room 1 and begins its asynchronous validation.
3. Replace the room, clear its working set and add Bob. Bob's real generated id is also `ctx-1`.
4. The host correctly refuses Alice's old request: “The workspace changed, so pinned context wasn’t changed.”
5. The UI associates that old outcome with Bob and renders the refusal directly under Bob's pill.

The host's stale-room guard works; this finding is the new pill UI's attribution of that result. It does not imply the wrong file was written or attached.

A second, UI-level witness covers the success branch: if Bob is independently present in the global pin list, a delayed successful answer for Alice makes Bob appear to be the pill whose Pin just landed and focuses Bob's label. This test controls the incoming host answer; the first refusal witness exercises the real host.

**Required correction:** bind the posted pill action to stable room/attachment ownership, and invalidate its pill-specific outcome and focus state when that owner is replaced. Do not use a room-local id alone. Keep the global pinned list and observation ordering intact, and preserve ordinary same-room success/refusal behavior. Include a room replacement with reused ids, not only removal of the old id.

Probe: [pill identity and focus](probes/pr-213-pill-identity.test.tsx.txt), first two cases.

## N01 · Low / P3 · Restore focus only when the removed Pin owned it

**Location:** `ContextPanel.tsx:77–81` (`takeLostFocus`), used by the landed label ref.

The callback infers “focus was lost with Pin” merely because the document's current active element is the body. If the writer deliberately blurs the pending Pin before its answer, a successful answer still focuses the label. The independent expected-behavior probe reproduces this. Moving focus to another actual control is already respected and passes the control test.

Consider tracking the initiating button's focus ownership rather than treating every body-focused state as removal-caused focus loss. This is a low-priority focus refinement, not a claim that the browser's native disabled-button behavior was verified.

Probe: [pill identity and focus](probes/pr-213-pill-identity.test.tsx.txt), third case and fourth passing control.

## Verification

- All **1,985 apps/packages blobs** matched the exact reviewed head, independently verified.
- `npm run typecheck`: **pass**, all three projects.
- `npm run lint`: **pass**, 0 errors / 1,165 warnings, with temporary review probes excluded.
- Supplied focused checks: **29 suites / 311 tests / 16 snapshots passed**, including ContextPanel, pin views, the Slice 3 hook, WorkshopApp integration, architecture boundaries and CSS-floor checks.
- Independent expected-behavior probe: **3 failures / 1 passing control**. These are review artifacts outside normal CI.
- The derived match uses the existing shared host-platform rule; Windows case folding, NFC and POSIX distinction remain shared rather than reimplemented. Text notes and wizard pills do not offer Pin; pinned wizard files may still show a derived mark, as specified. Counts derive from current attachment views, not the global list length.
- Pin uses the existing attachment-id route. Remove remains separate and unchanged. No persisted pin flag or session-format change was introduced.
- Original full baseline later completed with 722 suites passing and only resource-staging failing (3 tests) because shared temporary storage filled up. The unchanged resource-staging suite passed when rerun with workspace-backed temporary storage. Original-head and report-head CI both passed. The correction's full uninterrupted result is recorded above.
- Tests use React/jsdom and real host/aggregate fixtures. Native Chromium launch was attempted, including the reviewed execution path, but aborted on a system Unix-socket `EPERM` restriction. No native visual result, native disabled-button focus result, Windows runtime or live provider call is claimed. The epic's live Extension Development Host pass remains separate.

## Reproduction

Copy [the preserved probe](probes/pr-213-pill-identity.test.tsx.txt) to `packages/core/src/__tests__/presentation/webview/components/workshop/PinnedPillIdentity213.review-probe.test.tsx`, remove the final `.txt`, and run Jest with `--runInBand --runTestsByPath`. The first test uses the real host harness and real aggregate reset; the others isolate focus/result rendering in the actual hooks and component.

The verdict applies to the exact implementation above. Corrections and the resulting integration head require re-review.
