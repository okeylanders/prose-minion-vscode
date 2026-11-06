# PR #224 review: Pinned Context close-out and memory integration

## Verdict

**Written approval of code head `2abdc79fb51c79e2df2ffbe63c0e12276678ae6a`. No new blocking finding.** The code head's own CI is green. This report's documentation-only publication commit will receive its own CI check; its terminal result will be recorded in the PR conversation. This is not a formal self-approval or authorization to merge.

- PR: [#224](https://github.com/okeylanders/prose-minion-vscode/pull/224).
- Reviewed base: `epic/workshop-bookmark-recall`, `9991e6c867c7b9f577c3892f842b9686809165f8`.
- Reviewed head: `epic/workshop-bookmark-recall-sync-pinned-context-close`, `2abdc79fb51c79e2df2ffbe63c0e12276678ae6a`.
- Reviewed: 2026-11-05.
- Scope: all 35 changed paths, merge ancestry and conflict resolution, the extracted memory helpers, retained receipt and menu behavior, Pinned Context close-out records, and exact-head CI.

## Reconciliation and ancestry

Existing review work was checked before repeating it. #222 already has its committed report, written approval, final-head CI and independent probes, and was merged as `9991e6c8`. #223 merged as `4cf03982`; its code-head CI is green ([run 42103314766](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42103314766)). This review checks their integration, rather than claiming a new full feature review of #223.

The Git objects confirm:

1. `c42ce07c` has parents `4de1bad3` and `c3253e3d`: Bookmark Recall plus Pinned Context's close-out and main's Project Memory fix.
2. `9add0744` has parents `5263e579` and `9991e6c8`: the helper refactor plus #222's merged menu change.
3. `2abdc79f` has parents `9add0744` and `4cf03982`. Both `2abdc79f` and `9add0744` have tree `39b5b0c4244dfaf571aa9279fe3b9fe780f34edf`, so this last merge really is ancestry-only.
4. #223's merge `4cf03982` and its reviewed head `c3253e3d` share tree `f825db4a046b8955d676c05cbd406630dd81ea48`.
5. `9991e6c8`, `4cf03982` and #221's receipt correction `12e575b3` are all ancestors of the reviewed head.

## What reviewed cleanly

- **Both conflict sides survive.** `WorkshopApp.tsx` retains the Bookmark Browser hook and the hoisted `roomKey` passed into `useWorkshopProjectMemory`. The rail and Read in use the same room generation. Receipt busy/error maps remain in the controls and memo dependencies. No `railRoomKey` remains.
- **#222's entrance is retained.** Sessions → Memory uses `openMemoryManager`; Conversation settings uses that same wrapper, and the saved-card entrance keeps its focused behavior. The adjacent test file contains both the receipt-refusal block and the Sessions → Memory test with correct scopes.
- **The refactor is mechanical.** Comparing `5263e579` to its parent shows no changed receipt ownership, correlation, retry, failure fallback, or room cleanup logic. Set/map helpers preserve immutable updates and existing empty-card-error normalization. Returning the existing collection on a no-op does not discard a state change.
- **Every sheet route is preserved.** Card, current-room turn, saved-session turn, saved-memory edit and new memory emit the previous message types and payloads. Optional `roomRevision` remains conditional; the hook still owns request IDs, pending ownership and posting. The helper's hook import is type-only, so it creates no runtime import cycle.
- **The hook is 498 lines.** Its two focused helpers are 41 and 45 lines. The larger existing App gains only integration wiring. No new host coupling, persistence schema, provider call, dependency, or storage protocol is introduced by this refactor.
- **Pinned Context close-out is carried forward.** The accepted ADR, archive, source-identity/locking rules and existing limitations remain consistent with the integrated feature. Native Windows checks and large-list start timing remain explicit follow-ups, not claims of this review.
- The receipt component and receipt styles are byte-identical to main `4cf03982`. The earlier receipt correction is retained rather than reimplemented.

## Verification

Fresh isolated checkout at the reviewed head, Node `24.22.1`, npm `11.9.0`, dependencies installed from the lockfile with `npm ci`. CI uses Node 18 independently.

- All three local typechecks pass.
- **47 focused production suites / 598 tests pass**, covering memory hook/helpers, receipts and manager, sessions menu, Bookmark Browser, rail, Pinned Context/pills and architecture boundaries.
- **11 archived independent probes pass unchanged**: all five #221 receipt probes and all six #222 menu/manager probes. Coverage includes Forget/Restore refusal visibility, pending controls, request correlation, reversed concurrent replies, retries, room replacements with reused IDs, memory-Off entry during a run, sheet layering and dismissal, repeated opening/focus/search reset, stale listings, unavailable workspaces and archive refusal.
- Full local lint: **0 errors / 1,165 existing warnings**.
- Both local webpack bundles and bundle verification pass; the existing three webview size/performance warnings remain.
- A full local production run is still in progress at publication. Its terminal result will be added to the PR conversation; the focused and probe totals above are not represented as a complete local pass.
- Exact-code-head [CI run 42109011061](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42109011061), verify job `127531321843`, **passed** all three typechecks, **753 suites / 10,481 tests / 59 snapshots**, lint, both bundles and bundle verification. Its checkout log explicitly identifies merge candidate `8ce9811e`: `Merge 2abdc79fb51c79e2df2ffbe63c0e12276678ae6a into 9991e6c867c7b9f577c3892f842b9686809165f8`.
- `git diff --check 9991e6c8 HEAD` finds one inherited documentation-only blank line at the end of the Pinned Context ADR, line 526. No code whitespace error was found. This is not a blocker. The review publication itself is checked separately.
- [Reproduction commands and output summaries](probes/pr-224-integration-verification.txt).

## Limits and carried follow-ups

These are code-level and JSDOM/host-mock checks, not a native VS Code visual, operating-system focus, screen-reader, Windows or billable-provider pass. This sync does not claim to fix the separately mentioned session-store identity issue. Existing low-priority Pinned Context UTF-8 byte-bound debt and Project Memory distinct-slug ID collision debt remain documented; neither is newly introduced here.

Only this review and its verification record are published. No product code change, merge, deployment, release or deferred #205 work was performed.
