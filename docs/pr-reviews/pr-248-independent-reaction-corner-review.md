# PR #248 independent review: reaction corner

- PR: https://github.com/okeylanders/prose-minion-vscode/pull/248
- Reviewed head: `7549ac85d96c9ddd53275199d13de0f01dbbfede`
- Base: `3b8b0902ed5f68113dd655f6a9733e96d6bb6dc2` (`epic/workshop-message-reactions`)
- Date: 2026-11-09
- Verdict: **Changes needed.** F-01 is a P2 wrong-target removal risk; F-02 is a P3 keyboard-focus regression. Both are reproduced through the real WorkshopApp.

## Publication context

The PR was open when this review began. It merged into the reactions epic at
15:16:08 UTC as `fa68772f8ba54f15eb03f844e7cb26194ac1f9b0`, before this review
was published. Its code head did not change. These findings are therefore
follow-up work on the merged implementation, not an assertion that a review
blocked that merge. This report is committed to the original PR branch; it
does not itself enter the epic. No merge, auto-merge or production edit was
performed by this review.

## Findings

### F-01 (P2): the first removal response re-arms the double-click hazard

**Location:** [WorkshopTurnReactions.tsx:92–95](https://github.com/okeylanders/prose-minion-vscode/blob/7549ac85d96c9ddd53275199d13de0f01dbbfede/packages/core/src/presentation/webview/components/workshop/reactions/WorkshopTurnReactions.tsx#L92-L95), [114–120](https://github.com/okeylanders/prose-minion-vscode/blob/7549ac85d96c9ddd53275199d13de0f01dbbfede/packages/core/src/presentation/webview/components/workshop/reactions/WorkshopTurnReactions.tsx#L114-L120).

The corner ignores subsequent presses only while its reaction-list identity
is unchanged. The host's successful removal gives it a new list and the effect
immediately clears `removingFrom`. That is also when the right-aligned cluster
reflows and a neighboring reaction can move under the pointer. If the host
answers before the second click, that second click is accepted for the neighbor.
Persona reactions cannot be restored by the writer's Add reaction control.

The host changes the in-memory ledger and posts its snapshot synchronously in
`WorkshopReactionHandler.apply`; it does not wait for disk persistence or a
model call. A response within an ordinary double-click interval is plausible.

**Reproduction:** start a writer turn with Margot's eyes followed by Jill's
heart. Click Jill, deliver the resulting snapshot containing only Margot, then
activate the next item as the second click. The real-App probe receives both:

```json
[
  { "turnId": "turn-1", "reaction": "heart", "author": { "kind": "host" } },
  { "turnId": "turn-1", "reaction": "eyes", "author": { "kind": "personaGuest", "personaId": "margot" } }
]
```

Only Jill's Hide should be posted. The checked-in M1 test sends all of its
double-activation presses before a snapshot, when no item has moved yet. It
then explicitly verifies that the next snapshot re-arms the corner, so it
does not cover the dangerous ordering.

**Required correction:** keep repeated-gesture protection independent of the
host snapshot that reflows the cluster. Preserve deliberate later clicks and
keyboard activation. Add a regression with the successful snapshot between
the first and second activations, plus a rendered same-coordinate pointer
check. A target-changing double click must not rely solely on the DOM target's
click count.

### F-02 (P3): an unrelated snapshot cancels the removal's focus handoff

**Location:** [WorkshopTurnReactions.tsx:94–98](https://github.com/okeylanders/prose-minion-vscode/blob/7549ac85d96c9ddd53275199d13de0f01dbbfede/packages/core/src/presentation/webview/components/workshop/reactions/WorkshopTurnReactions.tsx#L94-L98).

The new effect treats every new list that still contains the selected reaction
as a refusal and clears `pendingFocus`. Session snapshots are not correlated
with this removal. A snapshot from an earlier bookmark/settings action can
arrive while the removal's actual response is still in flight. The reactions
hook reconstructs per-turn arrays for every such snapshot, even if their
contents are unchanged.

**Reproduction:** focus and remove Jill's heart on a writer turn with Jill's
heart and Margot's eyes. Deliver an earlier unchanged snapshot, then the actual
removal snapshot containing Margot only. The first snapshot leaves Jill's
button focused but clears its pending handoff. The second removes that button;
`document.activeElement` becomes `document.body` instead of Margot's remaining
button. The independent real-App assertion fails exactly this way. The base's
key-based effect did not clear pending focus on an unchanged reaction list.

**Correction:** distinguish an answer to this removal from unrelated session
updates, or keep the handoff alive while its original button still owns focus.
Retain the existing protections against stealing focus after the writer moves
elsewhere. Cover an unchanged intermediate snapshot with a remaining neighbor
and with the last persona reaction.

### N-01: the refusal test assumes a response the host does not send

The checked-in refusal test supplies a retained-reaction session snapshot.
Actual busy/error paths in `WorkshopReactionHandler.apply` (99–104, 116–123)
call `reportError` without `postSessionState`. The shared session-operation
gate does likewise (`WorkshopSliceComposition`, 470–499), and
`WorkshopRoomHandler.sendError` (1711–1726) posts only `ERROR`.

An independent webview probe delivers the real refusal `ERROR`, then a save
`WORKSHOP_SESSION_ACTION_RESULT`, and retries. The new `removingFrom` latch
still suppresses the retry because neither message supplies a new reaction
list. Later ordinary session updates can clear it; busy-run completion usually
does. A complete background-save race was not reproduced end to end, so this
is a qualified protocol/test gap rather than a separate claim of permanent
lockout. Include actual error-only refusals when fixing the response handling.

## Existing work reconciled

- Read the implementation review and resolution ledger before reviewing.
  GitHub review submissions and discussion were empty at initial inspection.
- The normal last-persona-reaction sequence now focuses the writer bubble,
  fixing #247 F-01. The remaining F-02 race above is narrower.
- The new modules preserve host-owned reaction state, ids-only requests,
  writer-first ordering, shared reactability, locked focusable controls,
  keyboard palette movement, Escape and outside-focus dismissal.
- The spacing/title fixes and measured up/down placement are present. The
  implementation's screenshot evidence was inspected; it is not an independent
  browser run. The reaction-only slim line's retained glyph remains the
  explicitly accepted product decision.
- No host, wire or codec production code changes in this slice. Reaction
  modules are below 500 lines. WorkshopApp and WorkshopTurnBubble are already
  above that limit on the base; this PR does not create that existing debt.

## Verification

**Exact reviewed head, GitHub CI:** [run 42641401200](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42641401200), job `129243150273`, passed. The completed steps and logs were inspected:

- 815 suites, 11,422 tests, 59 snapshots passed.
- All three typechecks passed.
- Lint: 0 errors, 1,171 warnings.
- Both production bundles and bundle-sentinel verification passed; webpack
  reported three warnings.

**Independent local verification, Node 24.22.1:**

- `npm run typecheck`: passed.
- `npm run lint`: passed, 0 errors / 1,171 warnings.
- `npm run build`: passed, with three webpack warnings.
- The checked-in real-App reaction/persona-reaction suites and palette suite:
  3 suites / 49 tests passed.
- Three additional desired-behavior probes failed as described in F-01, F-02
  and N-01. Temporary test files were removed from the tracked checkout; they
  were not committed as assertions that these defects are desired behavior.

The regression probes exercise the real App and message handling in jsdom;
they do not simulate browser hit testing. An independent Chromium harness was
prepared, but browser launch failed on the environment's socket restriction.
No new rendered same-coordinate
double-click result, interactive VS Code pass, screen-reader session, or live
model run is claimed. Slice 4's live reaction-frequency/tone pass remains
separate. A full local aggregate run was still in progress when this report
was prepared; the full pass above is the inspected GitHub CI result, not an
invented local result.
