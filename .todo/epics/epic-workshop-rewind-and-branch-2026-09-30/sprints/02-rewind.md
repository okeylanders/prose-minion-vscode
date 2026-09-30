# Sprint 02: Rewind

**Status:** In review — delivered 2026-09-30 on `sprint/workshop-rewind-and-branch-02-rewind`, PR into `epic/workshop-rewind-and-branch` (see [Delivery notes](#delivery-notes-2026-09-30))
**Branch:** `sprint/workshop-rewind-and-branch-02-rewind`
**Depends on:** Sprint 01
**Blocks:** Sprint 03

## Goal

Let a writer rewind the room to any rewindable rest point, exactly. All cutting happens in one pure transform, installed through the proven Open/promotion path.

## Deliverables

1. **Pure transform.** Add `session/WorkshopSessionRewind.ts`, exporting `rewindWorkshopSession` (ADR §5). It takes the persisted shapes (`WorkshopSessionStateV1` plus `ConversationArchiveEntryV1[]`) and a cut `{ kind: 'afterTurn' | 'beforeTurn'; turnId }`. It returns:
   - the cut state and archives;
   - `droppedConversationKeys`;
   - an optional `composerRestore { text, attachmentIds }`.

   It performs no I/O and has no clock. It implements every rule in ADR §5:
   - ledger and thread artifacts;
   - history, context-source and writer-source slicing per mark;
   - offsets from marks;
   - sidecar, guest and host drop rules;
   - `chatTarget` repair;
   - host pin stale chain;
   - one-shot widget linkage clearing, per the `rollbackThreadCommit` template;
   - to-do pruning;
   - pending excerpt and context re-queue;
   - `lastCommittedPersonaBehavior`;
   - counters never lowered;
   - marks kept at or before C.

   For a `beforeTurn` cut, restage the writer turn's `messageAttachments` bodies from `threadArtifacts` into `pendingMessageAttachments` with their original `ta-N` ids.

   The result also carries a **cut summary**: `{ removedTurnCount, droppedConversationKeys, removedTodoCount }`. The action result and Side Quest's closing divider both use it, so no caller recounts.
2. **Coordinator operation.** Add a generic `rewindTo(cut, { origin: 'writer' | 'sideQuestEnd' })` in `WorkshopSessionPersistenceCoordinator`. It validates the cut with `evaluateCut`, not the bubble layer. The `origin` selects notice copy and whether the composer is re-seeded (`'writer'` only); a later origin needs no new operation. Only `'writer'` is wired to a route in this sprint. It follows the ADR §6 sequence:
   - `serializeSessionOperation`;
   - active-run refusal and policy re-check;
   - `captureRollback`;
   - export;
   - transform;
   - `importWorkshopConversationArchive` + `hydrateCommittedState`, sharing the promotion code with `promoteNamedSession` rather than copying it;
   - discard prior conversation ids;
   - `markDirty`;
   - `restoreRollback` on any throw.

   A rewind is author work, so the named file updates through the ordinary identity-checked autosave.
3. **Contract and route.**
   - Add `MessageType.WORKSHOP_REWIND_SESSION` with payload `{ turnId: string }` in `shared/types/messages/workshop/session.ts`.
   - Add `'rewind'` to `WorkshopSessionAction`.
   - Register the handler in `WorkshopSessionMessageHandler` via `registerMutation` + `rejectWhileRunning`.
   - Post session state, the action result (with turn count removed and any degraded participants), recovery/degradation notices, and `WORKSHOP_COMPOSER_DRAFT_RESTORED` for a writer-bubble rewind.
4. **Webview.**
   - **Bubble actions.** Add a "Rewind to here" action to the existing agent footer (`WorkshopTurnBubble.tsx` `.pm-ws-turn-actions`). Add a new, matching footer to writer bubbles. Render from the host rewindability flag. A disabled state carries the reason tooltip, for example "Saved before rewind support" or "Can't cross a prose directive change yet".
   - **Icon.** Add a rewind or history glyph to `components/shared/Icon.tsx`.
   - **Gating.** Hide or disable while `showLiveTurn || roomMutationLocked`.
   - **Plumbing.** Thread the callback through `WorkshopThread` → `WorkshopApp` → `useWorkshopSessions.rewindTo(turnId)`. Do not reset optimistically: the host snapshot replaces the turn list wholesale.
   - **Confirm.** Extend the `sessionConfirm` union in `useWorkshopSessionSurfaces` with `{ kind: 'rewind'; turnId; removedCount }`. Copy: "Rewind to here? N turns will be removed. Your excerpt and context stay as they are now. To keep this conversation too, use Branch instead."
   - **Composer.** Confirm the composer re-seed and restaged attachment pills appear after a writer-bubble rewind.
5. **Diagnostics.** Log one output-channel line per rewind with the cut turn, removed turn count, per-key message counts before and after, and dropped keys. Never log message content.

## Inputs from Sprint 01

- **Oracle source.** `runCanonicalScriptedRoom()` (in `__tests__/application/services/workshop/session/ScriptedWorkshopRoom.ts`) supplies `restPoints: { label, headTurnId, workshop, archive }[]`. It already replaces a still-live sidecar. Extend the script rather than writing a second one: add a committed one-shot widget and a standing-directive change (PR #117 review F-02).
- **Provider seam proof.** The scripted room writes history through `ConversationManager.addMessages`, not `AgentRunEngine`. Add one focused integration case with a real `AgentRunEngine`, scripted transport and the production count reader for a multi-round commit (F-02).
- **Cut validation.** `WorkshopRewindPolicy.evaluateCut(cut)` normalizes every accepted cut to `keptThroughTurnId`, the last kept turn. The transform can slice from that id. `busy` is evaluated first; the coordinator must pass pending session operations in as busy.
- **Hydration baselines.** `hydrateCommittedState(state, bindings, behavior, importedHistory)` takes the imported archive counts. Pass the cut archive's counts, so any participant left unmarked is baselined, and a mark that disagrees with its imported history is dropped.
- **Open questions to settle before the transform.** Settled at kickoff; see below.
  - **Context-source supersede.** Re-delivered resources overwrite their row (ADR finding 6). Recommendation: append plus stale chain.
  - **Temporal state.** Per-persona time notices are not rewound: `WorkshopSessionTimeService` state lives outside `workshop`. Decide whether it stays current, like the working set.
  - **Conversation `lastActivity`.** It is wall-clock and never rewound. Treat it as an intended oracle difference.

## Kickoff decisions (2026-09-30)

Confirmed with Okey before the transform was written. The ADR records each one in its [Sprint 02 kickoff decisions](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-02-kickoff-decisions).

1. **Context-source supersede: append plus stale chain.** Re-delivery appends a row and marks the superseded row stale; the transform recomputes the chain inside the kept prefix. Replacing in place could leave a kept row naming an `art-N` the cut history no longer holds.
2. **Temporal state stays current.** Rewind does not re-hydrate the time service, so it queues no resume notices and records no "Session resumed" marker. That is why Rewind shares Open's import-and-hydrate core rather than calling `hydrate()` whole.
3. **Conversation `lastActivity` is an intended oracle difference.**
4. **Host marks record the context revision the host holds.** The ADR §2 divider rule misses a kept divider after the host's last kept commit (the canonical "context added" rest point), context edits during a host run, and silent session-open file refreshes. The transform re-queues `pendingContext` exactly when the cut host mark's `contextRevision` is older than the current revision.
5. **Rewind writes inside the operation.** An unnamed room writes `current.json`; a named room writes its named file through the identity-checked update and then schedules the rolling mirror. Any failure before the durable write completes rolls back. This gives the "write" failure point in the coordinator tests something real to roll back.

Also decided, as implementation calls within the plan:

- Participants a rewind drops are named in the action result, not in the degraded-memory banner, whose copy ("will begin fresh on their next turn") describes hydration loss.
- Direct tool messages are private and never publish thread artifacts, so their attachment bodies exist only in the tool's provider history. A writer-bubble rewind of one restores the text and names any attachments that must be re-attached; it never parses provider history for them.
- A writer-bubble rewind points the chat target back at the rewound message's addressee when that participant survives, so the edited text goes back where it went.

## Tests

- **Equivalence oracle** (the core proof). Using the Sprint 01 scripted room, rewind from the final state to every rest point. Assert the result equals that point's recorded oracle snapshot modulo the intended differences:
  - current excerpt and context;
  - counters equal to the final state's;
  - re-queued pending excerpt and context;
  - current to-do statuses;
  - cleared one-shot widget linkage.
- **Transform unit table.** Cover:
  - host-only;
  - capability rounds;
  - tool report with and without synthesis;
  - direct sidecar follow-ups;
  - a sidecar replaced after C (dropped and reported);
  - a guest joined after C (disposed);
  - a guest dismissed after C (stays disposed);
  - a cut before the host's first reply (host binding removed, persona selectable);
  - excerpt revision after C (pending excerpt re-queued);
  - context change after C;
  - to-do sourced after C (removed);
  - one-shot widget commit after C;
  - a `beforeTurn` cut with attachments (restaged with the same ids).
- **Generic cuts.** Cutting at a divider or at the idle head through `rewindTo(cut, { origin: 'sideQuestEnd' })` works and does not re-seed the composer. The cut summary counts are correct.
- **Property checks.** Output always passes strict `validateWorkshopSessionStateV1`. Counters are never lower. Rewinding to the head is the identity.
- **Coordinator.**
  - Injected failures at transform, import, hydrate and write each leave the prior room and bindings intact.
  - Only superseded conversation ids are discarded.
  - Refusal while a run is active and while a session operation is pending.
- **Route.** `WorkshopRouteTestHarness` covers the rewind happy path, the non-rewindable turn refusal (policy re-check), and the composer-restore message.
- **Webview.**
  - Bubble renders the enabled and disabled states with the reason.
  - Writer footer exists.
  - Callback fires with the turn id.
  - Confirm dialog flow in `WorkshopApp.test.tsx`.
  - A shorter snapshot replaces the thread.

## Exit

The equivalence oracle passes for every rest point in the scripted room. Rewind works end to end in unit, route and webview tests. Full Jest, all TypeScript projects, ESLint and `git diff --check` pass.

## Delivery notes (2026-09-30)

Every deliverable landed. The corrections below are also recorded in the ADR's [Sprint 02 implementation findings](../../../../docs/adr/2026-09-30-workshop-rewind-and-branch.md#sprint-02-implementation-findings).

**Plan deviations.**
- **Durable write.** The coordinator writes inside the operation rather than calling `markDirty` and leaving the write to autosave (kickoff decision 5). A named room updates its file through the identity-checked `updateNamed`; an unnamed room writes `current.json`.
- **Result shape.** The transform returns `summary { keptThroughTurnId, removedTurnCount, droppedConversationKeys, removedTodoCount }`. `composerRestore` gains `unrestoredAttachmentLabels`, and the result reports `unverifiedConversationKeys` for diagnostics.
- **Action result.** It names the participants the rewind dropped. Hydration-degraded participants still arrive as recovery notices.
- **Confirm union.** It carries `edit`, so a writer message reads "Edit this message?" with the label "Rewind and edit".
- **Gating.** Actions are disabled with a reason rather than hidden: one busy reason while the room is busy, and the D7 reason while persistence is unavailable. The latest reply offers no Rewind action (ADR finding 5).
- **Offset normalization.** `headed-missing-room-offsets` now leaves an absent offset absent for a participant with no retained conversation. A cut before the host's first reply depends on it (ADR finding 1).

**Modules.**
- `session/WorkshopSessionRewind.ts` holds the pure transform and `WorkshopRewindRefusedError`.
- `WorkshopSessionPersistenceCoordinator` adds `rewindTo`, `commitRewoundRoom` and `logRewind`. It shares three extracted cores:
  - `installRoom` (import plus hydrate) with `hydrate`, and so with Open;
  - `exportLiveRoom` with `capture`;
  - `acceptNamedWrite` with the named write path.
- `WorkshopSessionService` gains two delegating methods: `evaluateRewindCut` and `rewindCutForBubble`.
- `WORKSHOP_REWIND_SESSION` is a registered mutation in `WorkshopSessionMessageHandler`. The writer-facing refusal copy lives in `shared/constants/workshopRewind.ts`.
- On the webview side, `useWorkshopRoom.turnRewindability` feeds the bubble action (`WorkshopTurnBubble`), `useWorkshopSessions.rewindTo` sends the request, and `workshopSessionConfirmCopy.ts` holds the confirm copy.

**Supporting changes.**
- Context-source re-delivery now appends a row and stales the superseded one.
- Host marks record `contextRevision`.
- The canonical scripted room installs a standing directive before the host's first reply, commits a one-shot widget and re-delivers a resource (PR #117 F-02).
- One integration case drives a real `AgentRunEngine` through two multi-round commits with the production count reader (F-02).

**Proof.**
- **Equivalence oracle** (`WorkshopSessionRewind.oracle.test.ts`):
  - Every rest point after the directive floor rewinds to its recorded room, modulo eight named intended differences, and a vacuity guard proves each difference occurs.
  - It is mutation-checked: the ADR's original divider rule fails it, and so does removing the stale-chain recompute.
- **Transform table and properties** (`WorkshopSessionRewind.test.ts`, 23 tests). The unit table, strict validation, counters never lowered, and rewinding to the head as the identity.
- **Coordinator** (`WorkshopSessionRewindCoordinator.test.ts`, 16 tests):
  - named and unnamed writes;
  - rollback at transform, import, hydrate and write;
  - refusals (a run, a pending operation, a split run, the directive floor, no workspace);
  - the protected `current.json` case;
  - generic cuts for a Side Quest end;
  - a removed host's full catch-up;
  - temporal state kept current.
- **Route** (`WorkshopRoutes.rewind.test.ts`, 7 tests) and the **webview** bubble, confirm, composer and snapshot tests.

**Follow-ups captured.**
- [Rewound widget commits: reopen the released config](../../../tech-debt/2026-09-30-workshop-rewound-widget-commit-reopen.md).
- [Time notices outlive their conversations](../../../tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md). A fresh host after an "Edit from here" on the first message gets no time frame for up to an hour.

Manual Extension Development Host smoke is recorded with Sprint 03's, as that plan specifies.
