# ADR 2026-09-30: Workshop Rewind and Branch

**Status:** Proposed
**Date:** 2026-09-30
**Extends:** [ADR 2026-07-14 — Workshop Session Persistence](2026-07-14-workshop-session-persistence.md); [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](2026-07-24-workshop-room-ledger-and-delivery-offsets.md); [ADR 2026-07-30 — Workshop Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md)
**Answers:** [ADR 2026-07-25 — Workshop Scope Immutability](2026-07-25-workshop-scope-immutability.md), rejected alternative "Fork or branch the conversation into the new session"
**Epic:** [Workshop Rewind and Branch](../../.todo/epics/epic-workshop-rewind-and-branch-2026-09-30/README.md)

## Context

Writers want two per-bubble actions in the Workshop thread:

- **Rewind to here.** Return the room to the chosen point and remove everything after it.
- **Branch from here.** From a saved session, open a new session that starts from exactly that point. An unsaved room is asked to save first.

The visible thread is not the whole room. Per ADR 2026-07-24 §1, a room is one ordered ledger (`WorkshopSessionService.turns`) plus an independent retained provider history per participant: the host, each persona guest and each tool sidecar (`ConversationManager`). The ledger is canonical. Each history is an append-only projection of it, specialized by reader:

- A participant's own replies are `assistant` messages.
- Every other participant's words arrive later as quoted text inside a `user` message.
- One committed run can append several user/assistant pairs: capability rounds, the forced-final retry and invalid-request recovery.
- Several ledger turns can share one `user` message, as room catch-up.

A session file persists both halves: `workshop` (`WorkshopSessionStateV1`) and `conversations` (`ConversationArchiveEntryV1[]`). Archived messages are bare `{ role, content }` pairs with no turn identity. The only link between the halves is each reader's offset, `lastSeenRoomTurnId`, which points into the ledger, not into a history.

That has been sufficient because no operation has ever had to cut both halves at the same moment. Operations either append to both, or load and save both whole. The one existing removal, `rollbackMessageRun`, removes a writer turn whose run never committed provider history. Rewind is the first operation that has to answer "which history index corresponds to ledger turn T?". Nothing stored today can answer that exactly.

Three existing properties shape the decision:

1. **Writer messages cannot be kept while the host's history is cut before them.** `isWorkshopTurnAlreadyVisibleToPrincipal` treats a writer→host message as already visible to the host, because it *is* the host's own user message. A ledger that keeps it while the host's history drops it would never deliver it. The host would silently never have heard the writer.
2. **The working set has no history.** Only the current and shelved excerpt, the current context attachments, the current to-do state and the current widget and directive configs are stored. An excerpt revision cannot be undone, because the earlier text is gone.
3. **Some participant histories are discarded before the rewind point is chosen.** A replaced tool sidecar, a dismissed guest, and every participant after an assistant-resource generation loss (`clearAllConversations`) have no history left to cut.

## Decision

### 1. A rewind cut is a real historical rest point

A rewind targets a **cut point C**, a ledger position at which the room was actually at rest between runs. The per-bubble actions map to cut points as follows:

| Bubble | Action meaning | Cut point C |
|---|---|---|
| Agent reply: `persona_message`, `persona_synthesis`, `tool_report`, `direct_tool_response` | Keep this reply; drop everything after it | the reply turn itself |
| Writer message: `persona_message` by the writer, `direct_tool_message` | Drop this message and everything after it; its text returns to the composer | the turn immediately before the writer message |

Both are genuine rest points. A reply turn is appended as its run commits. Because the Workshop admits one active room run, the room was necessarily at rest just before any writer message started a run.

Capability cards, dividers (session, context, excerpt and directive markers), tool-request dividers, and turns outside the snapshot window offer no action. A writer-bubble rewind is an **edit** in UI copy terms:

- The message text is re-seeded through the existing `WORKSHOP_COMPOSER_DRAFT_RESTORED` route.
- Its one-shot thread artifacts are restaged as pending message attachments, keeping their `ta-N` ids.
- A widget commit that produced the message gets its linkage cleared, exactly as `rollbackMessageRun` does today, so the config becomes a retry token.

### 2. The conversation rewinds; the working set stays current

Rewind restores the thread and every participant's memory to C. It does **not** restore the excerpt, context attachments, to-do statuses or widget configs. Those have no history, and inventing one is out of scope. The honest reconciliation reuses existing delivery machinery:

- **Excerpt.** The host's delivered excerpt version is re-derived from its cut writer-source pin rows. If the current version is newer, `revisions.pendingExcerpt` is re-queued. The next host turn then receives the existing "the writer has revised the pinned excerpt" frame.
- **Context.** If any dropped turn is a `context_change` divider, `revisions.pendingContext` is re-queued at the current context revision.
- **To-dos.** To-dos whose `source.turnId` was dropped are removed. Surviving to-dos keep their current status.
- **Scope.** Scope is immutable, so the cut room keeps it. A cut before the host's first reply restores host-persona selectability. It does not unlock scope while any participant tombstone remains (Roster `hasRoomMemory`).

The Rewind confirm dialog says this plainly: the excerpt and context stay as they are now.

### 3. Retained-history marks record where each history stood

The aggregate records a **retained-history mark** each time a participant's history commits:

```ts
interface WorkshopRetainedHistoryMarkV1 {
  /** Ledger turn at which this participant state held (reply/report/join turn, or head for a baseline). */
  turnId: string;
  conversationKey: WorkshopConversationLogicalKey;
  /** Archived message count, system message excluded. Always even. */
  messageCount: number;
  /** Committed ConversationManager contextSources rows at this point. */
  contextSourceCount: number;
  /** The participant's writer-source manifest rows at this point. */
  writerSourceCount: number;
  /** Reader offset at this point; absent for tool sidecars (instruments read nothing). */
  lastSeenRoomTurnId?: string;
  origin: 'commit' | 'baseline';
}
```

These rules govern marks:

- **Recording.** Marks are recorded at the two provider-history commit sites: `completeRun` (host, guest join and guest reply, persona synthesis, direct tool message) and `completeToolReport`. The run-completion boundary supplies the committed counts. An architecture guard proves that every commit into a Workshop retained conversation records a mark, in the same spirit as ADR 2026-07-24 §4's single-delivery-site guard.
- **Pruning.** Whenever a participant's conversation is discarded, that conversation key's marks are removed. This covers sidecar replacement, guest dismissal, `clearAllConversations`, reset, and hydration degradation. A re-invited guest reuses its `guest:<id>` key, so marks from its previous membership must never describe its new history.
- **Baseline.** When a room is hydrated and a live participant has no mark, the aggregate records an `origin: 'baseline'` mark at the ledger head from the imported counts. Sessions saved before this ADR therefore become exactly rewindable from the point they are reopened onward. No backfill heuristic is required.
- **Validation.** Marks are host-private and never enter the webview snapshot. Integrity requires each mark's `turnId` to exist, `messageCount` to be even, and marks to be non-decreasing per key in ledger order. At the persisted-session boundary, a key whose marks exceed its archive is treated as unmarked: its marks are dropped with a logged normalization. A bad mark degrades rewindability, never the session open.

### 4. Rewindability is host policy, published per turn

The aggregate computes whether each turn in the snapshot window offers Rewind/Branch. The result is published as a display-safe per-turn field. The webview renders it and never re-derives it, the same pattern as `participantSubjectReady`. The rewind and branch handlers re-check it before cutting.

A cut point C is rewindable only when all of these hold:

1. It maps from an eligible bubble per §1.
2. No run is active and no session operation is pending.
3. **Host exactness.** If any host-authored reply exists at or before C, the host has a mark at or before C. This makes pre-baseline turns of reopened legacy sessions, and turns before a host-memory loss, non-rewindable.
4. **Directive floor (v1).** C is at or after the latest `standing_directive_change` turn. A shifted directive's earlier draft is not retained, so crossing it cannot be made honest yet.

Guests and tool sidecars never block a rewind. If one has no mark at or before C, it did not exist at C, or its history there was already discarded. It is dropped: a sidecar is removed, and a guest becomes `disposed` with its conversation discarded. The outcome is reported through the existing degraded-conversation notice. Non-rewindable eligible bubbles show a disabled action with a reason, for example "Saved before rewind support", rather than hiding it.

### 5. One pure transform over the persisted shape

All cutting happens in one pure function over the persisted shapes, not by surgery on live collaborators:

```ts
rewindWorkshopSession(input: {
  workshop: WorkshopSessionStateV1;          // includes retainedHistoryMarks
  conversations: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
  cut: { kind: 'afterTurn' | 'beforeTurn'; turnId: string };
}): {
  workshop: WorkshopSessionStateV1;
  conversations: ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
  droppedConversationKeys: WorkshopConversationLogicalKey[];
  composerRestore?: { text: string; attachmentIds: string[] };
}
```

It lives in its own module under `application/services/workshop/session/`. It does not grow `WorkshopSessionService`. Its rules:

- **Ledger.** Keep turns through C. Drop `threadArtifacts` whose `turnId` was dropped.
- **Histories.** For each key, take the last mark at or before C.
  - Slice `messages` to `messageCount`.
  - Slice `contextSources` to `contextSourceCount`.
  - Keep `nextArtifactNumber`. `art-N` ids are never reused, and skipped numbers are already legal.
  - A key with no such mark is dropped, per §4.
- **Participants.**
  - Restore each reader's `lastSeenRoomTurnId` from its mark.
  - Drop sidecars whose `latestReportTurnId` was dropped or whose key was dropped.
  - Dispose guests whose key was dropped.
  - Repair `chatTarget` to host when its target is gone. The transform does this itself, because strict validation runs before hydration's chat-target repair.
  - Remove the host binding entirely when the host has no mark at or before C.
- **Writer sources.**
  - Slice each participant's rows to its mark's `writerSourceCount`.
  - Recompute the host pin stale chain so that only the last pin row is live.
  - Drop tool and guest manifests with their participants.
- **Widgets and directives.**
  - One-shot configs whose commit turn was dropped have their linkage cleared, following the `rollbackThreadCommit` template.
  - Standing directives cannot be affected, because the directive floor (§4) forbids it.
- **Pending state.** Re-queue pending excerpt and context per §2, but only when the host survives.
- **Behavior.** Recompute `lastCommittedPersonaBehavior` from the last surviving persona reply that carries `behavior`, or leave it `undefined`.
- **Capability publication.** `publishedWithTurnId` cannot dangle, because a rest point never splits a run.
- **Counters.** Every counter is kept as-is and is **never lowered**. This covers turn, to-do, thread-artifact, widget-config, standing-directive and attachment counters. Model-visible ids (`ta-N`, `pd-N`, `art-N`) and webview references must never recur.
- **Marks.** Keep marks at or before C for surviving keys.

The output must pass the same strict validation as any checkpoint. The transform is deterministic and I/O-free, so it is tested as a table of scripted rooms by cut points.

### 6. Rewind installs the cut room through the Open path

Rewind is a coordinator session operation, serialized behind queued autosaves and earlier session operations like New and Open:

1. Refuse while a run is active, and re-check rewindability.
2. `captureRollback()`.
3. Export the live aggregate and its conversation archive, the same data `capture()` writes to disk.
4. Apply the transform.
5. Import the cut archive (fresh runtime ids, system prompts rebuilt from current settings, including standing-directive frames) and hydrate the cut aggregate. This is the proven promotion path Open uses.
6. Discard every prior runtime conversation id; the imported ones replace them.
7. Mark dirty so the ordered autosave writes `current.json` and, for an associated named room, the named file.
8. Post session state, the action result, and any degradation notice. For a writer-bubble rewind, also post `WORKSHOP_COMPOSER_DRAFT_RESTORED`.

On any failure, `restoreRollback` reinstates the prior room untouched. Rewind on a named room is deliberately destructive to that named file's future. The confirm copy points the writer to Branch when they want to keep both.

Reading the JSON from disk is equivalent in shape, but it races the autosave queue and named-checkpoint authority. The live export is the same data without that race.

Rewind is also cheap to run. A cut history is a byte-identical prefix of what was sent before, so the first post-rewind request can reuse the provider prompt cache when the provider offers it.

### 7. Branch is Save-as-new of a cut room, then Open

Branch is a coordinator session operation:

1. Refuse while a run is active or persistence is unavailable, and re-check rewindability.
2. **Require a saved source.** Branch is available only in a room associated with a named session. An unnamed room's only durable copy is `current.json`, which opening the branch would overwrite.
   - The webview does not send the request for an unnamed room. It shows a popup explaining that the session must be saved before branching, with a "Save session…" action that opens the existing Save modal.
   - After saving, the writer clicks Branch again. Nothing is saved automatically.
   - The host refuses an unnamed-room request anyway, with the same explanation, so a stale webview cannot bypass the rule.
3. Queued autosaves complete first, via `serializeSessionOperation`, so the associated named file is current on disk.
4. Export and transform exactly as in §6.
5. Build a new persisted session:
   - fresh `sessionId` and timestamps;
   - title `"<source title> — branch"` (collision-safe, renamable);
   - summary rebuilt from the cut aggregate.
   Write it with the existing named `saveNamed` path.
6. Promote it into the live room through the existing open/promotion path.
7. Post session state and a result naming both sessions. Re-seed the composer for a writer-bubble branch.

The source session is never modified by Branch. Branch lineage (`branchedFrom`) is not persisted in v1. See Follow-ups.

### 8. Why this is not the fork ADR 2026-07-25 rejected

ADR 2026-07-25 rejected forking because "a forked host inherits a history it never lived and speaks as though it had". The fork there carried a conversation into a room with a *different scope and subject*.

A branch at a rest point inherits a history every surviving participant **did** live, byte for byte, in the same immutable scope. Anything the room did not have at C is dropped, not reinterpreted:

- a guest who joined later;
- a sidecar that was replaced;
- a directive change after C (refused by the floor).

The working-set difference (a newer excerpt or context) is delivered as an explicit, dated revision frame rather than silently assumed. The rejection's premise does not hold, and the "prior conversation as a resource" direction is unaffected.

### 9. Codec

`retainedHistoryMarks` is an **optional** field on `WorkshopSessionStateV1`. Absent means no marks, and hydration records baselines. Adding an optional field makes no formerly valid shape invalid, so per ADR 2026-07-30 it needs no `schemaVersion` bump. It follows the precedent of `widgetConfigs` and `standingDirectives`.

The exact-key shape validator and integrity validator gain the field in the same change. As with those precedents, a build older than this change will not open a file that carries marks.

**Downgrade compatibility (decided 2026-09-30: in-file field).** Every Workshop validator is exact-key, from the envelope (`assertSupportedWorkshopPersistedSessionEnvelope`) down. A build older than this change therefore refuses any session this build writes, not only files that use Rewind. The refusal is safe: a named file is left untouched, and a failed `current.json` is protected from overwrite. Writers who sync sessions through Git must update every machine before opening sessions saved by this release. Release notes say so.

A sidecar marks file was considered and rejected for v1. It would have kept session files readable by older builds, at the cost of a second file's lifecycle across save, mirror, duplicate, rename, delete and recovery. Because marks and archive are written atomically in one file, an older build can never leave marks stale. The per-mark history hash that the sidecar needed is therefore unnecessary.

## Consequences

**Good**

- Rewind and Branch are exact for every session from the moment this ships, and for legacy sessions from the point they are reopened.
- No heuristic reads provider message formats.
- The cutting logic is one pure, table-tested function. The install path is the already-proven Open/promotion path, with rollback.
- Private capability evidence, delivery offsets and prompt-cache prefixes survive a rewind. A cheaper design would have lost them all.
- The planned context-compaction epic gains a reliable map from history spans to ledger turns.

**Costs and limits**

- A small host-private field grows with each committed run: one mark per commit per participant.
- Rewinding across a prose-directive change is refused in v1.
- Pre-baseline turns in reopened legacy sessions are not rewindable.
- Guests dismissed after C are not resurrected. Sidecars replaced after C are dropped, and the writer can re-run the tool.
- The working set does not rewind, and to-do status edits are not undone.

## Alternatives considered

- **Truncate only the visible thread.** Rejected. Participants would remember a future the thread says never happened.
- **Wipe participant histories and let hydration degrade them.** Rejected. Hydration normalizes an absent offset to the ledger head, so a fresh host would not even receive the kept thread as catch-up. It forgets everything and re-bills the whole context.
- **Store a full checkpoint per turn.** Rejected. It costs O(n²) storage and duplicates what marks provide.
- **Infer cut points by counting final assistant messages.** Rejected as the primary mechanism, because it couples correctness to message formats: capability requests, retry instructions and fallback text. A verified backfill (count, then compare reply text after the retention sanitizer) remains a possible follow-up for pre-baseline turns.
- **Mutate live collaborators in place.** Rejected in favor of §5–§6. The persisted shape already has one strict validator, one import path, and a rollback template.

## Follow-ups

- Branch lineage metadata and a "branched from" row in the session browser. This belongs with the parked [Branch Board](../../.todo/features/feature-workshop-branch-board/README.md) feature's explicit branch model.
- Crossing standing-directive changes, which needs directive revision history.
- Optional verified backfill of marks for pre-baseline turns.
