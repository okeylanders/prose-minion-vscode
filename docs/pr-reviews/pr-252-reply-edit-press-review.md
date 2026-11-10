# PR #252 review: Reply Edit Actions press

**Verdict: changes requested. Three P2 findings block approval of Slice 2.**

- **PR:** [#252](https://github.com/okeylanders/prose-minion-vscode/pull/252)
- **Reviewed code head:** `6841476c8d36ef99aaa7f4c537d11bc398cbe586`
- **Base:** `603ad3646f08434ecb723e965173060c1a24a606` (`epic/workshop-reply-edit-actions`)
- **Branch:** `epic/workshop-reply-edit-actions-slice-2-press`
- **Reviewed:** 2026-11-10

## Findings

### F-01 · P2 · Make the final check and completion agree before retaining the exchange

**Location:** [`AgentRunEngine.ts:564–579`](https://github.com/okeylanders/prose-minion-vscode/blob/6841476c8d36ef99aaa7f4c537d11bc398cbe586/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L564-L579), with `WorkshopEditOfferAnswerCompletion.ts:134–137`.

The engine checks `last.content`, but the completion and retention sanitizer read the later `visibleContent`. When a reply contains a complete valid file-edit frame and ends with `finishReason: 'length'`, the check accepts it without spending its correction. `toVisibleContent` then appends the truncation warning **after** the frame. That makes the same frame `misplaced` to the tail reader. The engine has already retained the request and a host-written “Did not answer with file edits.” response when completion fails with `no-answer` and rolls the request out of the ledger.

This also happens for `provider-interrupted`, which appends a different notice at the same boundary. Independent engine-to-router reproductions confirmed both cases, in streaming and non-streaming paths: the ledger returns to its pre-press contents, but retained history grows by two messages, and no correction is requested. The writer loses otherwise complete cards, sees the offer reopen, and a retry silently includes an exchange that is absent from the thread and has no settlement mark.

**Answer to the PR's known-gap question: yes, this should block.** It is a deterministic disagreement in this slice's new acceptance/retention boundary, not merely an already-cancelled run completing late. Validate and complete against the same semantic reply, keeping presentation notices separate, or reject the incomplete response before retaining anything. Whichever policy is chosen, a refused press must not leave this hidden exchange. Add an end-to-end engine/completion regression for both finish reasons, including the retained-history and ledger assertions.

### F-02 · P2 · Do not persist the rejected prose when a correction succeeds

**Location:** [`AgentRunEngine.ts:575–579`](https://github.com/okeylanders/prose-minion-vscode/blob/6841476c8d36ef99aaa7f4c537d11bc398cbe586/packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts#L575-L579), through `runInstructedTurn` at lines 422–429 and the commit at lines 595–600.

The new final-reply correction calls `runInstructedTurn`, which appends the rejected assistant response to `pendingMessages` using only the capability's private-control redactor. That redactor removes control payloads, not ordinary prose. When the correction succeeds, the engine sanitizes only the **last** assistant response and commits the entire pending exchange, including the rejected prose.

Reproduction: return an ordinary prose-only answer containing a sentinel, then a valid `<prose-minion-no-file-edit><why>Already correct.</why></prose-minion-no-file-edit>` on correction. The press succeeds and the ledger contains only the host's line, but `ConversationManager.getMessages` still contains the rejected prose verbatim. This was reproduced in both transport paths. The new generic engine test even asserts that the original rejected prose is retained, but there is no Workshop-level retention test to enforce ADR D5's stronger requirement.

D5 says a press's persona prose is never shown **or kept**. This hidden response can be sent to subsequent model turns and saved with the conversation despite being discarded from the visible thread. Keep the original response available to the correction request if needed, but give these rejected final replies the owner's retention treatment before committing them. Preserve capability-call/evidence replay semantics rather than indiscriminately rewriting every intermediate message. Add a successful-correction test with the Workshop sanitizer that checks the complete retained history, not only its final entry.

### F-03 · P2 · Keep an old excerpt offer directed at its original file

**Location:** [`workshopEditRequestFrame.ts:82–85`](https://github.com/okeylanders/prose-minion-vscode/blob/6841476c8d36ef99aaa7f4c537d11bc398cbe586/packages/core/src/utils/workshopEditRequestFrame.ts#L82-L85).

For an offer whose target kind is `excerpt`, the directive says only “Edit only `<excerpt/>`, the file your reply named.” It discards the stored original file path. Replacing the pinned excerpt preserves the source reply, its offer and author, and the room revision. The old offer therefore remains eligible, but `<excerpt/>` now means the newly pinned file to both the room's usual context and `FileEditStagingService.identify`, which reads `currentDocument()` at staging.

Reproduction: pin file A, obtain an excerpt-targeted fixes offer, pin B, then press A's old offer. The directive still names only `<excerpt/>`; a compliant excerpt-targeted answer resolves to B and is refused by `workshopEditOfferAnswerCards` as `not-the-offered-file`. The safety guard prevents the wrong write, but the writer pays for a run that cannot fulfill the old button's promise. A temporary scripted-room test verified that the old offer and room revision survive the excerpt change and that this refusal occurs.

Carry the offer's bound identity through both the instruction and staging. The solution must also handle a formerly pinned file outside the configured resource catalog; merely asking for its path is not enough there. Do not silently retarget it to B. Add a real press/staging regression after changing the excerpt, asserting that the original file is still the target. This follows D2's explicit rule that a later excerpt never retargets an offer.

## Scope and what checked out

Reviewed the 47 changed paths, the press and room integration, capability/final-response loop, completion and retained history, directive and trailer parsing, fixes policy at staging and Apply, full-ledger status, codec, transcript/recall decisions, prompts, architecture guards, and the slice's documented choices. The PR was open, ready, mergeable, and had no existing comments/review when the pass began.

- The press is ids-only at the trust boundary and reads the source reply from the ledger. It checks room/run/status/setting/author before handing over to the ordinary message path. The guest targets its own conversation without moving the composer.
- Fixes are policy data, restricted to small find/replace changes, with line-break and structure enforcement at Apply. The offered-file guard refuses a different identity rather than writing it.
- Answered status is derived from the full ledger. D7 permits another press only for `none` or entirely spent, non-landed cards. Persistence preserves the optional request/answer/intent shapes and rejects malformed ones.
- The new completion does not publish persona prose, next-step findings, or widget recommendations. Transcript and recall use the host-authored request/answer and existing card projection. The webview does not receive document URIs.
- Shared correction budget, explicit `askAgain`, a request-turn rollback on failure, and global stripping of the no-file-edit trailer are reasonable scoped decisions. The history defects above are not approval of an alternative retention policy.

## Verification

Local checks use Node `v24.22.1` and the existing dependency installation from the sibling review checkout. This PR changes no dependency manifest or lockfile. All model responses are mocked; no live provider was called.

- `npm run typecheck`: all three stages passed.
- `npm run lint`: **0 errors / 1,165 warnings**, matching the recorded baseline after removing review probes.
- `npm run build`: both bundles and `verify:bundle` passed; the three existing webview bundle-size/performance warnings remain.
- All 12 changed production test suites: **291 tests passed**.
- Independent review probes: **7 passing checks**. Six bridge the real engine, conversation manager, router, and completion using mocked transport/capability/staging seams (three streaming, three non-streaming). One exercises the scripted real session/completion plus directive/author checks with a fake staging port modeling current-excerpt resolution. The latter does not claim an end-to-end run through the real `FileEditStagingService`; that service's resolution was separately inspected.
- `git diff 603ad364...6841476c --check`: passed.
- The full local `npm test -- --runInBand` run is still underway at initial publication. Its final result will be appended; it is not represented as passed here.

**Test-harness follow-up:** the new `AgentRunEngine.finalReplyCheck.test.ts` creates engines without calling `dispose()`. The focused run prints all 291 assertions as passed but then reports that Jest has not exited. Add `afterEach(() => engine.dispose())`, as the existing engine suites do, so the new cleanup intervals do not keep serial test runs alive. This is separate from the three product findings.

### Exact-code-head CI

Both [push CI 42779142432](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42779142432) and [PR integration CI 42779237187](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42779237187) passed for `6841476c` against the stated epic base. The PR run's dependency install, all typechecks, tests, lint, and both-bundle build steps were individually verified as successful. CI uses Node 18.

These green checks do not cover the three independently reproduced failure cases above. Publishing the report creates a documentation-only head and separate CI runs; the code-head results do not describe those future runs.

## Acceptance limits

- This is the host/contracts slice. The future footer, webview hook, keyboard/accessibility behavior, and interactive VS Code acceptance were not tested here.
- Message Reactions integration still needs its own review. Keep both trailer-table additions and all completion arguments when the branches meet.
- This review does not change production code or existing tests, merge the PR, or authorize a release. Temporary reproduction tests are removed before publication.
