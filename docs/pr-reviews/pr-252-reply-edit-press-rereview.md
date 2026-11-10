# PR #252 re-review: reply edit press fixes

## Resolution ledger

Checked against the code first: R1 reproduced as described, and is the limit the first ledger declared. Fixed in `a31ea6c2` on the slice branch.

| Finding | Verified | What changed | Tests |
|---|---|---|---|
| **R1** Undo the retained exchange when completion refuses a continued press | Reproduced. The engine committed the exchange before it returned; the room then awaited staging; completion's failure path discarded history only for a newly created conversation. | **Retention is deferred, not compensated.** A run may set `AgentRunOptions.deferRetention`: the engine commits nothing (messages, context-source rows, context snapshot) and hands its owner the commit. The press's completion calls it only after the session has taken the answer turn, and before the retained-history mark is recorded. A press that fails at any point after the reply ended never retained anything. | `WorkshopEditOfferEngine.integration.test.ts`, both transports, through the real engine, conversation store, router and completion, with staging held open by a gate (no sleeps): Stop during staging and file edits turned off during staging, each asserting the ledger and the whole retained history equal their pre-press state, then the same press succeeding and retaining exactly its own exchange. |
| R1: never touch a newer exchange | — | A held commit belongs to the history its run read. If the conversation is gone, or its history has changed since, the commit retains nothing and answers false. It is single-use. | `AgentRunEngine.finalReplyCheck.test.ts`: a held commit called after a newer exchange is dropped and the newer history stands; never called, the next run reads the conversation as it was; a conversation gone; no commit handed over for a rejected reply; a corrected exchange held whole. Integration: a newer message that preempts a press while its edits are staged keeps its own exchange, and the press adds nothing. |

**Why deferral.** A compensation would have to cut this run's messages back out, and with them the context-source rows and the context snapshot the commit wrote, and then prove no newer run had written since. Deferral writes none of them until adoption, so there is nothing to cut, no provider message to parse, no mark to prune and no id counter to lower (ADR 2026-09-30). The retained-history mark is recorded after the commit, as before, so marks still describe a settled participant. The one thing a held run has already spent is its `art-N` artifact ids: the counter is not lowered.

**Also changed:** a press preempted by a newer message now rolls its request turn back (`WorkshopRoomHandler.preemptActiveRun`), as a stopped or failed press does. Before, the newer run's preemption left the press's request turn in the thread.

**The earlier ledger's "one limit left" is closed** for a press. Nothing remains of it: a press retains its exchange only when its answer turn is in the ledger.

**Scope.** Ordinary messages are unchanged. The same order (retained before settled) exists for them and is filed as [tech debt](../../.todo/tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md), not widened into this PR.

**The scope note on rereading an old excerpt file** stands as written: the bound identity reaches staging and Apply, but no capability rereads a file outside the catalog after the excerpt changes. It is not addressed here.

**After the fix:** 812 suites / 11,454 tests / 59 snapshots, all passing; typecheck clean; lint 0 errors / 1,165 warnings; build passing. Node 22.

**Verdict: changes requested. One P2 retention/settlement blocker remains.**

- PR: [#252](https://github.com/okeylanders/prose-minion-vscode/pull/252)
- Reviewed head: `babdbd51636695d1819ba725609c00c75593a04f`
- Fix commit: `087bc1586f23da92b8a2935d06dee9a23840a795`
- Base: `603ad3646f08434ecb723e965173060c1a24a606`
- Date: 2026-11-10
- Earlier review: [initial report](pr-252-reply-edit-press-review.md)

## Resolution of the earlier findings

- **F-01's truncation/interruption mismatch is fixed.** The final check receives the cleaned semantic reply and an explicit incomplete flag, before display notices. A press refuses incomplete answers without correction or retention, and completion uses the same finish-reason rule. The new integration regressions cover a token ceiling in both transports and an actual interrupted stream, including whole-history/ledger equality and a successful retry.
- **F-02 is fixed.** Rejected final responses are identified separately in the pending exchange. The model still sees its original response during correction, but the retained copy goes through the owner's sanitizer. Capability requests and evidence remain unchanged. The successful-correction tests inspect the entire retained exchange, and the generic engine tests still cover capabilities after correction.
- **F-03's target-identity failure is fixed.** The directive names the stored path, and `boundExcerpt` reaches staging. The real staging service uses A rather than current B, including a bound file outside the catalog, with containment, symlink, text and size checks. Apply continues to authorize the recorded excerpt identity and classify it as prose, independently of the room's current excerpt. The earlier wrong-file refusal is no longer the expected result.
- **Engine-test cleanup is fixed.** The suites dispose their engines, and the focused serial runs now exit normally.

These are substantive fixes. The explicitly deferred stop/settings window still violates the same retained-history/ledger invariant, as shown below.

## R1 · P2 · Roll back the press's retained exchange when completion refuses it

**Location:** [`WorkshopEditOfferAnswerCompletion.ts:110–118`](https://github.com/okeylanders/prose-minion-vscode/blob/babdbd51636695d1819ba725609c00c75593a04f/packages/core/src/application/services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion.ts#L110-L118), reached after [`WorkshopRoomHandler.ts:1222–1226`](https://github.com/okeylanders/prose-minion-vscode/blob/babdbd51636695d1819ba725609c00c75593a04f/packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L1222-L1226).

The engine commits the accepted answer before `executeMessage` awaits reply-memory resolution and file staging. Stop and setting changes remain possible throughout those awaits. If either arrives then, completion rolls the request out of the ledger, but its failure path discards history only for a **newly created** conversation. An ordinary press continues the source persona's existing conversation, so its accepted exchange remains there.

This is not only an instantaneous scheduling gap. Staging can be waiting on a catalog or file read. Four deterministic probes used the real engine, conversation store, router and completion with a deferred staging port, without sleeps or guessed timing:

1. Start from a completed source reply with a fixes offer.
2. Return a complete valid edit frame.
3. Wait until staging is actually entered. At this point the real retained history has already grown by two messages.
4. Either send the actual Stop route, or turn suggested edits off.
5. Release staging and wait for completion.

**Both transports produce the same result:** the result is `failed/stopped` or `failed/file-edits-off`; the complete ledger equals its pre-press value; yet retained history still holds the request directive and **“Suggested 1 fix as file edits.”** No corresponding answer/card exists in the thread. Subsequent model turns can therefore see a claimed suggestion the writer was told did not happen, and a retry repeats an invisible request. Two additional controls confirm that switching the setting off **before** the engine's final check leaves both history and ledger clean, isolating the remaining boundary.

**This window should still block approval.** The early setting check is useful but does not cover asynchronous staging. Make the press's history and ledger settlement agree: defer committing its retained exchange until adoption, or compensate only that run's owned provisional history and associated metadata when adoption fails. Do not blindly restore an old conversation snapshot if a newer run has already started. Add Stop/off-during-staging regressions asserting complete history and ledger equality, plus an ownership case with a newer run.

No file was wrongly applied in these probes. The defect is hidden conversational state and a false retained success after the visible operation failed.

## Verification

- Local `npm run typecheck`: all three stages passed.
- Seven changed/shared-engine/staging/gateway suites: **188 tests passed**, process exited normally.
- Six temporary timing probes: **6 passed**, comprising four reproductions and two clean-history controls. The probes were removed afterward; no production or existing test files were changed.
- A separate focused staging/gateway/resource-capability pass also passed.
- `git diff 6841476..babdbd51 --check`: passed.
- Exact-head [push CI 42785092245](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42785092245) and [PR CI 42785104979](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42785104979): passed. The PR job's install, typecheck, full tests, lint and build steps were individually verified successful.
- The full local suite, lint and build were not rerun during this re-review; their exact-head CI results above are the aggregate checks. No live model or interactive VS Code run was performed.

## Scope notes

The bound-identity fix does not add a model capability to freshly reread an old file outside the configured catalog after switching excerpts: the capability still receives the current excerpt and `resource.read` remains catalog-scoped. The canned-answer integration tests do not validate that fresh-read instruction. This is a separate capability limitation, not a new wrong-file write or a reason to undo the identity fix.

This re-review changes documentation only and does not merge the PR. Its publication creates another documentation head whose CI must be checked separately from the reviewed code head.
