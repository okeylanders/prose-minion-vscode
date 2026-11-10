# Workshop: a reply is retained before its run is settled

- **Status:** Open; pre-existing, not changed by the PR that found it.
- **Priority:** Medium.
- **Source:** [PR #252 re-review, R1](../../docs/pr-reviews/pr-252-reply-edit-press-rereview.md). R1 fixed this for a reply edit offer's press only, by its scope.

## Problem

`AgentRunEngine` commits a turn's exchange to retained history before it returns. `WorkshopRoomHandler.executeMessage` then awaits the reply's project-memory context and its file-edit staging, and only afterwards runs `completeWorkshopRun`.

If the writer presses Stop during those awaits, completion takes its cancelled branch: the run is abandoned and no reply turn is adopted. The persona's retained history still holds the exchange. The writer's message stays in the thread with no reply under it, and later turns can see a reply the thread never showed. The tool side-pass's synthesis leg has the same order.

This is the same window PR #252 R1 closed for a press, where a hidden exchange also contradicted the host's own "nothing was suggested". For an ordinary message the visible harm is smaller: the writer's turn stays, and the retained reply is the persona's real answer to it.

## Relevant files

- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts` (`deferRetention`, added for R1)
- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts` (`executeMessage`, the guest-join path)
- `packages/core/src/application/services/workshop/RunWorkshopToolSidePass.ts`
- `packages/core/src/application/services/workshop/WorkshopRunCompletion.ts`
- `packages/core/src/application/services/workshop/fileEdits/WorkshopEditOfferAnswerCompletion.ts` (the press's use of it)

## Completion criteria

Decide whether an ordinary persona run should hold its retention until its reply is adopted, as a press does. If so, use the engine's `deferRetention` in each Workshop run path, commit at adoption before the retained-history mark is recorded (ADR 2026-09-30), and cover Stop during staging and during memory resolution with whole-history and ledger assertions, in both transports. If not, record why the retained reply is the intended state for a stopped message.
