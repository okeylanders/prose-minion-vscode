# Sprint 02: Rewind

**Status:** Planned
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
2. **Coordinator operation.** Add `rewindTo(turnId)` in `WorkshopSessionPersistenceCoordinator`, following the ADR §6 sequence:
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
