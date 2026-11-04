# PR #187 review: Workshop Wayfinding Slice 3, read-in provenance

**Disposition: changes requested. One reproduced P2 focus regression and one P3 range-scroll concern. Review continues.**

**Reviewed implementation:** `3174e66a54aa2f73928ca15e9f95df8e95c40400`  
**Base:** `d59b6510735dd48fed6d58587193f230749e890d`  
**PR:** [#187](https://github.com/okeylanders/prose-minion-vscode/pull/187) · **Reviewed:** 2026-11-04

The PR is still marked draft; its slice documentation marks implementation built. This early report is offered while the privacy, persistence and remaining integration review continues. It is not a formal GitHub review, approval or authorization to merge.

## F-01: P2: the reader's jump loses focus to the old opener

**Locations:** [`useWorkshopTurnJump.ts:68–84`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/useWorkshopTurnJump.ts#L68-L84), [`useOverlayDismiss.ts:124–143`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/hooks/useOverlayDismiss.ts#L124-L143).

In an independent full-App probe, open a resource reader, choose **Show where it was read**, and allow the overlay-close effects and queued microtask to settle. The jump scrolls and initially focuses the correct capability card, but the overlay cleanup's queued opener restoration then focuses the original Read in row instead. The writer is left at the rail rather than at the card the action promised to show.

Coordinate the jump with overlay focus restoration so a deliberate post-close destination wins. Cover the complete App path through the real overlay cleanup, including microtasks; a hook-only assertion before the cleanup settles misses the regression. Preserve ordinary Close/Escape return-to-opener behavior and the outside-window notice.

## N-01: P3: the initial range scroll runs while the Source pane is hidden

**Locations:** [`WorkshopReadInLines.tsx:33–42`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopReadInLines.tsx#L33-L42), [`WorkshopTextSheet.tsx:250–256`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L250-L256), [`WorkshopTextSheet.tsx:358–371`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/presentation/webview/components/workshop/WorkshopTextSheet.tsx#L358-L371).

With the normal asynchronous reader reply, an independent full-App probe records the range-start line's only `scrollIntoView` call while its Source panel still has `hidden`. The parent then switches Preview to Source, but the line component does not call it again. An element in a hidden pane has no rendered scroll position, so the requested “open at the first line read” behavior is at risk for long files.

Schedule the range scroll after Source is visible, and cover the asynchronous reply path rather than mounting the line component already visible. The hidden-at-call sequencing is reproduced in the App; actual browser scroll geometry was not verified in this environment, so this is a nonblocking concern pending native acceptance.

## Verification so far

Nine existing focused suites pass **115 tests**. Two independent full-App probes reproduce the focus ordering and hidden-at-scroll sequencing above; they are separate from the passing test total. Resource privacy, persistence/rewind, remaining reader states and exact-head CI are still being reviewed. Native VS Code and browser geometry were not exercised. No implementation change, formal approval or merge was made.


## F-02: P2: a validated writer-source fingerprint crosses the host-private boundary

**Locations:** [`WorkshopSessionStateV1Shape.ts:512–525`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/application/services/workshop/WorkshopSessionStateV1Shape.ts#L512-L525), [`WorkshopSessionRecords.ts:283–285`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/application/services/workshop/WorkshopSessionRecords.ts#L283-L285), [`WorkshopSessionService.ts:1157–1166`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1157-L1166), [`WorkshopRoomHandler.ts:1501–1509`](https://github.com/okeylanders/prose-minion-vscode/blob/3174e66a54aa2f73928ca15e9f95df8e95c40400/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L1501-L1509).

The new strict codec permits `sourceFingerprint` on persisted context-source rows, including writer-source rows. `collectWriterSources` calls `cloneSourceEntry`, which now preserves the stored fingerprint, and `activeContextBudget` forwards those clones to the webview without the new display-safe projection. In an independent production room-route probe, a valid checkpoint with a fingerprint on an existing host writer-source row is hydrated; `WORKSHOP_REQUEST_SESSION` then emits that digest in `WORKSHOP_SESSION_STATE.session.contextBudget.sources[0]`.

The current ordinary writer-source producers do not add a fingerprint, so this witness is a **validated loaded-checkpoint boundary**, not a claim that a normal resource read currently leaks it. Nevertheless the codec accepts the shape and the field is explicitly host-private. Apply the public projection to writer sources as well, or reject the impossible combination consistently at the codec boundary. Add a real route/snapshot regression for validated host, guest and tool writer-source rows, alongside existing fetched-source privacy tests; retain the fingerprint internally where legitimate.


## Completed review and verification

No additional actionable issue was established in the persistence, access, hashing or response-correlation review. The current normal resource-read path keeps the digest out of capability metadata/evidence and projects fetched rows before sending them; F-02 is specifically the separately validated writer-source checkpoint path described above. Full-file fingerprint controls cover CRLF/Unicode, changes beyond the display cap and empty files. A delayed host lookup can observe a newer target after a read, but the production reader discards its old request after room/target replacement; no user-visible defect was established for that observation.

Independent checks on `3174e66`:

- **11 production suites / 186 tests** pass for lifecycle, persistence, range, jump and related behavior; separate full-App probes reproduce F-01 and N-01. Both fake-timer and real JavaScript microtask variants confirm F-01.
- **5 production suites / 78 tests** pass for access and provenance; 9 independent probes cover the F-02 witness, target timing, App correlation and full-file fingerprints. These suite groups may overlap.
- A separate rewind/projection control passes: the earlier delivery reactivates with provenance intact, ranges are defensively copied and the fetched-row fingerprint stays out of the display projection.
- [CI run 41756624553](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41756624553) passed on the reviewed implementation. The report-only commits through `cbf24e64` change no executable source.

Correct F-01 and F-02 and re-review the new exact head; N-01 remains a separate nonblocking concern. Native browser geometry, VS Code editor behavior, screen-reader and live provider acceptance were not exercised. No formal approval or merge was made.

## Author response

All three findings are fixed on `epic/workshop-wayfinding-slice-3-read-in-provenance`, each in its own commit with a test that fails without the fix.

| Finding | Status | Commit | What changed | Covered by |
|---|---|---|---|---|
| F-01 (P2) | Fixed | `16aa38c` | `useOverlayDismiss` gains `focusAfterOverlaysClose(destination)`. When the last overlay closes, its restore microtask runs the destination in place of the opener, and falls back to the opener when the destination takes no focus. `useWorkshopTurnJump.jumpAfterClosing` registers the jump there before it closes the sheet, so the jump runs after the closing commit (the frame is no longer `inert`) and the restore can't override it. The hook's own pending state and effect are gone. | `WorkshopApp.readInProvenance`: the real App and overlay cleanup with microtasks settled. The card keeps focus; ordinary Close and Escape return to the Read in row; a card outside the window shows its notice and returns focus to the row. `useOverlayDismiss.destination`: the real hook under real microtasks. `useWorkshopTurnJump`. |
| F-02 (P2) | Fixed, both sides | `6575bbb` | **Codec:** `assertContextSource` (writer rows only) no longer lists `sourceFingerprint`, so a writer row carrying one is refused as an unknown field. Fetched rows in the conversation archive keep it, host-side. **Projection:** `activeContextBudget` maps every row it sends, writer rows included, through `projectContextSource`. | `WorkshopWriterSourcePrivacy.integration`: the real routes. It gives the host's, a guest's and a tool's writer rows a fingerprint behind the codec's back, then checks that no `WORKSHOP_SESSION_STATE` carries it, for each chat target. `WorkshopReadInProvenanceCodec`: refused on host, tool and guest writer rows. |
| N-01 (P3) | Fixed | `9801e01` | `WorkshopReadInLines` takes `visible` (the Source pane is shown). It scrolls to the range start the first time it is visible, once per range, so switching tabs later keeps the writer's own scroll position. | `WorkshopApp.readInProvenance`: with the async reply, the only range scroll is on line 3 with no `hidden` ancestor. `WorkshopTextSheet`: no scroll while loading, one scroll after, none on a tab round trip. |

**Choice for F-02.** A writer row can't legitimately hold a fingerprint, so the codec refuses it rather than keeping it host-side. The projection on every outgoing row is the second guard.

**Verification at `9801e01`:**
- 613 suites / 8,695 tests / 59 snapshots, all passing.
- `npm run typecheck` is clean.
- `npm run lint` has 0 errors and 1,138 warnings, unchanged.
- `packages/core/src` has no `from 'vscode'`.

Native focus and scroll geometry remain Slice 8's live check.


## Independent re-review of `119a0ce` (2026-11-04)

**Disposition: F-01, F-02 and N-01 are resolved; no new actionable defect found in the corrective delta.** This is a branch report, not a formal GitHub approval or authorization to merge.

- **F-01:** The original real-microtask App witness now passes: the card keeps focus after overlay cleanup. Ordinary Close/Escape still restores the opener; missing-card fallback and nested-overlay controls pass. An already-open notice defers the requested destination until it closes and consumes it once; a notice arriving in a later task does not replay the completed jump.
- **F-02:** The original validated writer-row fingerprint input is now rejected on parse and hydration, and the outgoing snapshot also projects all writer and fetched sources. Independent controls verify host, guest and tool writer rows preserve permitted provenance, injected fingerprints are stripped without changing host data, and legitimate fetched fingerprints survive checkpoint/archive roundtrips while staying out of the webview.
- **N-01:** The asynchronous range witness now records its first and only scroll while Source is visible. Tab toggles and unrelated snapshots do not repeat it; reopening scrolls once again.

**Independent checks:** 10 UI/overlay/Lightbox production suites / **89 tests** plus **8 separate full-App probes** pass. Privacy/access verification has **68 production tests** and **6 independent probes** passing. The full local suite was not rerun independently; native browser focus and scroll geometry, VS Code editor behavior and screen-reader acceptance remain unverified.

[CI run 41759107828](https://github.com/okeylanders/prose-minion-vscode/actions/runs/41759107828) passed on synthetic merge `4190711` of `119a0ce` into `d59b651`: **613 suites / 8,695 tests / 59 snapshots**, typecheck, lint and both builds. No implementation change, formal approval, merge or paid provider call was made during this re-review.
