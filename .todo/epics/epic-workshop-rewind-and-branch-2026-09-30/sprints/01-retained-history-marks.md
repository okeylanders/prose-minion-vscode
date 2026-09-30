# Sprint 01: Retained-History Marks

**Status:** Planned
**Branch:** `sprint/workshop-rewind-and-branch-01-marks`
**Depends on:** ADR 2026-09-30 (proposed is enough to start)
**Blocks:** Sprints 02 and 03
**Mergeable alone:** Yes. There is no user-visible behavior; marks begin accruing in real sessions.

## Goal

Make "where did each participant's history stand after turn T?" an exact, persisted, validated fact. Publish, host-side, which turns may offer Rewind/Branch.

## Deliverables

1. **Contract.** Add `WorkshopRetainedHistoryMarkV1` (ADR §3) beside `WorkshopSessionStateV1`. Add an optional `retainedHistoryMarks?: WorkshopRetainedHistoryMarkV1[]` field to the state.
2. **Collaborator.** Add `session/WorkshopRetainedHistoryLedger.ts` following the session collaborator conventions in `session/README.md`:
   - `record`, `pruneKey`, `marksAtOrBefore(turnId)` and `latestFor(key)`;
   - `exportState` / `prepareState` / `installPreparedState` / `reset`.
   It knows turn ids and ledger order, but no provider vocabulary. `WorkshopSessionService` owns it and delegates; do not grow the aggregate beyond thin delegation.
3. **Recording.** At both commit sites, `WorkshopSessionService.completeRun` (via `WorkshopRunCompletion.ts`) and `completeToolReport` (via `WorkshopAnalysisSidePass.ts`), the completion boundary supplies the committed `messageCount` and `contextSourceCount`. Source them from `ConversationManager` through the existing `AssistantToolService` seam; do not reach into the manager from the aggregate. The aggregate adds `writerSourceCount` and the reader offset. Cover:
   - host message;
   - persona synthesis;
   - guest join (the first mark lands on the join reply turn);
   - guest reply;
   - direct tool message;
   - tool report.
4. **Pruning.** Remove a key's marks wherever its conversation is discarded:
   - sidecar replacement in `adoptToolSidecar`;
   - `dismissPersonaGuest`;
   - `clearAllConversations`;
   - `reset`;
   - each degradation branch of `hydrateCommittedState`.
5. **Baseline.** At the end of `hydrateCommittedState`, record an `origin: 'baseline'` mark at the ledger head for every live participant with no mark. Use the imported archive counts, which the coordinator passes in from the import step.
6. **Codec and validation.**
   - Extend the exact-key shape validator (`WorkshopSessionStateV1Shape.ts`).
   - Add integrity rules in `WorkshopSessionStateV1Integrity.ts`: the turn exists, the key is well-formed, `messageCount` is even and ≥ 0, and marks are non-decreasing per key in ledger order.
   - At the persisted-session boundary, check each key against its archive length. A key whose marks exceed its archive is dropped with a logged `WorkshopSessionCheckpointNormalization`-style entry.
   - No `schemaVersion` bump (ADR §9).
7. **Rewindability.** Add `session/WorkshopRewindPolicy.ts` with two layers. They stay separate so that non-bubble callers, starting with [Side Quests](../../../features/feature-workshop-side-quests/README.md), can cut at dividers.
   - **Cut layer: `evaluateCut(cut)`.** A pure function from ledger + marks + directive markers + run state that answers "can the room be cut here?" for any cut `{ kind: 'afterTurn' | 'beforeTurn'; turnId }`, including dividers and session markers. It returns `{ ok: true } | { ok: false; reason: 'not-a-rest-point' | 'before-rewind-support' | 'before-directive-change' | 'busy' }`, covering ADR §1 rest points and §4. The ledger head while idle is always a valid `afterTurn` cut.
   - **Bubble layer.** A thin mapping from eligible bubbles to their cut (ADR §1 table), then `evaluateCut`. Ineligible bubbles report `not-a-rest-point`.
   - **Snapshot.** Publish the bubble result on the snapshot for windowed turns only, as a display-safe map or per-turn field. Update `WorkshopSessionSnapshot` docs and the webview type, but do not render it yet.
8. **Architecture guard.** Add a test in `__tests__/architecture/` that fails if a Workshop code path commits a retained conversation without recording a mark, for example by asserting that the two completion functions are the only callers that finalize Workshop runs. Model it on the existing single-delivery-site guard.

## Tests

- **Scripted room builder** (shared with Sprint 02). A helper that drives a real `WorkshopSessionService` plus a fake conversation store through:
  - host messages with capability rounds;
  - tool run → report → synthesis;
  - direct sidecar follow-ups;
  - guest invite → reply → dismiss → re-invite;
  - excerpt revision and context change;
  - a cancelled writer turn.

  After each rest point, capture `{ exportCommittedState(), archive }` as the oracle snapshot.
- Each mark equals the real history counts at its turn, for every commit type above.
- Pruning removes stale marks on sidecar replacement, guest dismissal and re-invite (no cross-membership marks), `clearAllConversations` and reset.
- Baseline:
  - A legacy fixture without marks gains baselines on hydrate.
  - Save → open round-trips marks unchanged.
  - Mismatched marks degrade to "unmarked" without failing the open.
- Shape and integrity reject malformed marks. A legacy fixture (no field) still opens.
- Policy truth table:
  - `evaluateCut` on dividers, session markers and the idle head (valid), and mid-run positions (invalid);
  - every bubble type;
  - pre-baseline host turns;
  - a directive floor;
  - an active run;
  - dropped-participant cases, which remain rewindable.

## Exit

Scripted-room marks match oracle counts at every rest point. Marks persist, round-trip and prune correctly. The rewindability flag is on the snapshot. Full Jest, all TypeScript projects, ESLint and `git diff --check` pass.
