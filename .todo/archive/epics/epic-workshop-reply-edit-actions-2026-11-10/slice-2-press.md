# Slice 2: The press

**Status:** Built and pushed on `epic/workshop-reply-edit-actions-slice-2-press`. PR #252 was reviewed with three findings; all are fixed on the branch, and so is the re-review's one ([review](../../../../docs/pr-reviews/pr-252-reply-edit-press-review.md), [re-review](../../../../docs/pr-reviews/pr-252-reply-edit-press-rereview.md)).
**Date:** 2026-11-10
**Decisions:** ADR 2026-11-10 D3–D7 and D9, and D8's new keys.
**Scope:** Host, contracts and the turn's view. No component, no CSS, no webview hook.

## What was built

| Piece | Where |
|---|---|
| The press's contracts: request and answer keys, the derived status, the route's payloads, the closed refusal list | `shared/types/messages/workshop/editOffers.ts`; `MessageType.WORKSHOP_EDIT_OFFER_ACTION` / `_RESULT` |
| `editOfferRequest` and `editOfferAnswer` on a turn; `intent` on a proposal | `workshop/session.ts`, `workshop/fileEdits.ts` |
| The refusal words and the host's sentences, one table | `shared/constants/workshopEditOfferWords.ts` |
| The route's owner: D4's checks in order, then the run | `handlers/domain/workshop/WorkshopEditOfferHandler.ts`, composed in `WorkshopSliceComposition` |
| The room's seam: a host-directed run on the one message path | `WorkshopDirectedRun` in `WorkshopRouteContracts.ts`; `WorkshopRoomHandler.executeMessage` |
| The directive frame, its words and the correction | `utils/workshopEditRequestFrame.ts` |
| The no-file-edit frame's codec, joined to the tail's one pass | `utils/workshopNoFileEditProtocol.ts`, `utils/workshopReplyControls.ts` |
| Reading an answer; the engine's check for a press | `utils/workshopEditOfferAnswer.ts` |
| The engine seams `finalReplyCheck` and `deferRetention`, and `finalReplyRejected` on the result | `AgentRunContracts.ts`, `AgentRunEngine.ts`; passed through `AssistantToolService`'s `finalReply` option |
| The answer's own completion | `services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion.ts` |
| The fixes policy, as data, and its one check | `FILE_EDIT_INTENT_POLICIES` in `domain/models/FileEdit.ts`; `intentFaults` in `fileEditPolicyChecks.ts`; `ProjectFileEditGateway` |
| The derived status, and the webview's view of a turn's offers | `fileEdits/WorkshopEditOfferStatus.ts`, `fileEdits/WorkshopFileEditWebviewView.ts` |
| The session codec's three new shapes | `session/WorkshopEditOfferRecords.ts`, `session/WorkshopFileEditProposalRecords.ts`, `WorkshopSessionStateV1Shape.ts` |
| The transcript's two decisions | `transcript/WorkshopTranscript.ts` |
| The persona prompt's press section | `resources/system-prompts/workshop-personas/reply-edit-offers.md` |

## How a press runs

1. **The route** carries `{ requestId, roomRevision, turnId, kind }`. It is registered behind the session-operation gate.
2. **Before anything is awaited,** the handler checks, in D4's order:
   - the room generation and that no run is going (a reply or the context wizard): refused, never queued;
   - the turn is in the full ledger and holds an offer of that kind;
   - its derived status is open, or D7 lets it be asked again;
   - file edits are still `ask`;
   - the reply's author is still in the room.
3. **The run** goes to the author's own conversation through `executeMessage`, with a target override. The to-do evidence, host updates, catch-up and time notice are built by the same code as for any message.
4. **The directive frame** rides the thread-artifact frames' slot, last before the writer-message slot. That slot holds a one-line host pointer.
5. **Nothing streams.** The engine checks the final reply with the press's check. A reply that is neither edits nor the no-edit frame gets one correction turn. A reply the provider cut short is refused at once.
6. **Completion** reads the answer, holds each card to the offer's file and (for fixes) the fixes policy, and commits a host line with `editOfferAnswer`. It runs neither the findings reader nor the widget reader.
7. **The result** names the answer turn, the outcome, and the cards and changes, or a refusal kind with its words.

## Choices taken

Each follows how file-edit proposals do it, unless said otherwise.

1. **A status also says whether it may be asked again.** The ADR lists five states, and D7 lets a `none` answer be asked again. So every answered status carries `askAgain`: `nothing-to-change` always has it, `ask-again` is a `proposed` answer whose cards are all spent, and `answered` never has it. The host takes a press when the state is `open` or `askAgain` holds. Slice 3 decides how a "nothing to change" chip offers the second press.
2. **A failed or stopped press rolls its writer turn back.** `abandonRun` keeps the writer turn of an ordinary failed message; a press uses `rollbackMessageRun` instead, in completion and in `executeMessage`'s catch. Capability cards the run already published stay, as on any rollback.
3. **Retention waits for adoption; a rejected final reply is never retained.** When the engine's check refuses the reply, or still does with no correction turn left, the run returns `finalReplyRejected` and commits nothing to retained history. When a correction succeeds, the rejected reply is retained in the owner's form ("Did not answer with file edits."), never as the persona wrote it (PR #252 F-02).
4. **The correction budget is shared.** `maxCorrectionTurns` is 1 for a persona turn. A press whose run already spent it on a rejected capability request gets no correction for its final reply.
5. **The no-file-edit tag joins the one pass.** It is stripped from every reply's display, stream and retained history, and redacted in logs. Only an answer gives it meaning. In any other reply it is dropped and earns no host line.
6. **`none` needs no file-edit frame at all.** A reply with a dropped file-edit frame beside the no-edit frame is `neither`: it tried to edit and did not.
7. **An answer with frames but no card left is a failure** (`no-answer`). A frame the reader kept but staging never saw (the reply changed, or the run was stopped) makes no card.
8. **`intent` is only `fixes`.** A rewrites answer's cards carry no intent and take their class policy unchanged. A card's "rewrites" mark comes from its turn's `editOfferAnswer.kind`.
9. **One fault for the fixes policy:** `more-than-a-fix`. The gateway checks it before planning (so a refused rewrite reads as this fault, not the planner's) and again before every attempt. With an intent, the applier runs with no line-break change and the `strict` structure mode.
10. **A card for another file keeps its identity** and reads `refused` with `not-the-offered-file`. A card refused at staging keeps its own reason.
11. **The directive names the offered file by its display path,** for a file and for the excerpt. An excerpt offer keeps the document it was bound to: the directive says `<excerpt/>` means that file, and the answer is staged against it through the staging port's `boundExcerpt` option, whatever the room's excerpt is now (PR #252 F-03).
12. **The host's lines name no pronoun.** The request reads "Asked Jill to suggest the fixes from their reply as file edits." and the answer "Suggested 3 fixes to chapters/…, from the 2:02 pm reply."
13. **The answer's count is its changes:** the operations across its cards. The status and the result carry `cards` and `changes` both.
14. **The request turn is an event in the transcript,** holding its host sentence: the writer wrote nothing. The answer is the persona's reply entry, with its cards as any reply's.
15. **The view leaves offers out while file edits are off,** and adds `blocked: 'author-left'` when the author is gone. A host persona cannot be changed once its conversation started, so in practice only a guest leaves.
16. **The time in the directive and the host line** is the source turn's, in the session's timezone, formatted "2:02 pm".
17. **The reserved-tag list** gained `prose-minion-edit-request`, `prose-minion-edit-offer`, `prose-minion-no-file-edit` and `source-reply`.
18. **`completeRun` gained a fourteenth positional argument** (`editOfferAnswer`), after Slice 1's `editOffers`. Message Reactions' own argument meets both at the merge.
19. **No checkpoint normalization was added.** No development checkpoint held another shape of the new keys.

## Things to know

- **A cut-off answer is a failure, never salvaged** (PR #252 F-01). The engine's check and completion read the same reply and the same `finishReason`, so nothing is retained and the writer reads the `cut-off` words. The gap this note used to describe is closed.
- **A press retains nothing until its answer is adopted** (PR #252 R1). The engine holds the run's exchange (`deferRetention`), and completion commits it once the session has taken the answer turn. Stop, or file edits turned off, while the answer's edits are staged leaves the persona's history as it was. A held commit is dropped if the conversation has moved on.
- **A press preempted by a newer message rolls its request turn back,** as a stopped press does.
- **Ordinary messages still retain before they settle.** That is filed as [tech debt](../../../tech-debt/2026-11-10-workshop-reply-retained-before-settlement.md).
- **A press's request turn reads as a writer message to other participants' catch-up,** with the host's sentence as its text.
- **`WorkshopRoomHandler.ts` grew by 42 lines,** all of it the seam: the option, the frame's slot, the two run options, the completion choice, the rollback, and the view's room facts.
- **`AgentRunEngine.ts` grew by 58 lines** (the check, the retained copies and the held commit). Its diff is larger, because the capability rounds are re-indented inside the check's loop.
- **Not done here, by design:** the chips, the request line, the answer's line and marks, the live region, and any webview hook. They are Slice 3.

## Tests added

| Suite | Covers |
|---|---|
| `handlers/domain/workshop/WorkshopEditOfferRoutes.test.ts` | The route through the real router, room handler and completion: the directive, both outcomes, every refusal, stop and failure, the offered-file and fixes checks, a guest's press, and the log sentinel sweep |
| `services/workshop/session/WorkshopEditOfferWholeRoom.test.ts` | The witnesses: Rewind, Branch and reopen through the real transform and coordinator; two presses turns apart; a guest answered in their own conversation |
| `services/workshop/session/WorkshopEditOfferPressTurns.test.ts` | The codec's round trip and 14 refused shapes; the transcript, its three exports and recall |
| `services/workshop/fileEdits/WorkshopEditOfferStatus.test.ts` | The status by state, D7 over every card state, and the webview's view |
| `services/AgentRunEngine.finalReplyCheck.test.ts` | The engine seam, with a mocked transport and no Workshop name: correction, refusal, the `incomplete` fact, and what is retained |
| `handlers/domain/workshop/WorkshopEditOfferEngine.integration.test.ts` | PR #252's witnesses through the real engine, conversation store, router and completion, in both transports: a cut-off answer, a successful correction's whole retained history, and an excerpt offer pressed after the excerpt changed |
| `services/fileEdits/FileEditStagingBoundExcerpt.test.ts` | The real staging service against a bound excerpt document, in and out of the catalog |
| `services/fileEdits/ProjectFileEditGatewayFixes.test.ts` | The fixes policy as data, its measure and bounds, and each row at Apply against the same edit with no intent |
| `utils/workshopEditOfferAnswer.test.ts` | The no-file-edit codec, the answer reader, and the directive frame with hostile quoted text |
| `architecture/replyEditOfferPressPromptSync.test.ts` | The prompt's press section against the frame, the policy, the bounds and the refusal words |

Updated: `boundaries.test.ts` (the new route owner, its construction, and the second completion that records a mark), `WorkshopRoomHandler.seams.test.ts` (92 routes), `workshopFileEditWords.test.ts` (two reasons), `replyEditOfferPromptSync.test.ts` (the two new numbers), and the scripted room (a press, and a staged reply).

## Verification

| Check | Baseline (epic tip `603ad364`) | After |
|---|---|---|
| `npx jest` | 802 suites / 11,284 tests / 59 snapshots, all passing | 812 suites / 11,454 tests / 59 snapshots, all passing (810 / 11,415 before the review; 812 / 11,440 after its first round) |
| `npm run typecheck` | — | passes |
| `npm run lint` | 0 errors, 1,165 warnings | 0 errors, 1,165 warnings |
| `npm run build` | — | passes |

- The baseline was taken in a clean worktree of the epic's tip, under Node 22.
- `packages/core/src` has no `from 'vscode'`.
- No new file is over 500 lines; the largest is the route test at 354. Files already over grew only by the seam: `WorkshopRoomHandler.ts` +42, `AgentRunEngine.ts` +58, `WorkshopSessionService.ts` +12, `AssistantToolService.ts` +13, `WorkshopSessionStateV1Shape.ts` +4, `session.ts` +4.
- No test makes a model call.
- The press's logs carry turn ids, kinds, counts and fault names. Sentinel tests hold that: no path, URI, reply text, stray prose or why in any line.
