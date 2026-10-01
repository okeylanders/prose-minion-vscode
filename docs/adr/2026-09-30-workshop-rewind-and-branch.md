# ADR 2026-09-30: Workshop Rewind and Branch

**Status:** Proposed — amended by Sprint 01 findings (see [Sprint 01 implementation findings](#sprint-01-implementation-findings)), Sprint 02 kickoff decisions (see [Sprint 02 kickoff decisions](#sprint-02-kickoff-decisions)), Sprint 02 findings (see [Sprint 02 implementation findings](#sprint-02-implementation-findings)) and Sprint 03 kickoff decisions (see [Sprint 03 kickoff decisions](#sprint-03-kickoff-decisions))
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
- **Context.** If the host's cut mark records an older context revision than the current one, `revisions.pendingContext` is re-queued at the current context revision. (Amended at Sprint 02 kickoff: the original divider rule missed kept dividers, context edits during a host run, and silent session-open refreshes. See [Sprint 02 kickoff decisions](#sprint-02-kickoff-decisions), item 4.)
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
  /** Host only: the context revision the host holds at this point (Sprint 02 kickoff, item 4). */
  contextRevision?: number;
  origin: 'commit' | 'baseline';
}
```

These rules govern marks:

- **Recording.** Marks are recorded at the two run-completion boundaries once the run has **settled**: `completeWorkshopRun` (host message, persona synthesis, guest join and guest reply, direct tool message) and `WorkshopAnalysisSidePass.adoptWriterReport` (tool report). A commit is more than `completeRun`: after the reply is adopted, handlers acknowledge room delivery (the reader offset), commit pending host updates (the host pin row) and ship attachments (manifest rows). `completeWorkshopRun` therefore takes a `settleCommittedRun` hook for that bookkeeping and records the mark after it, in a `finally`. The boundary reads committed counts through `AssistantToolService.readWorkshopRetainedHistory`; `WorkshopSessionService.recordRetainedHistoryMark` adds `writerSourceCount` and the offset. An unreadable history or a conversation mismatch prunes the key instead of recording a guess. An architecture guard pins the chain, in the same spirit as ADR 2026-07-24 §4's single-delivery-site guard.
- **Commit-only change.** A participant's history, manifest rows and offset change only inside its own settled commit, or when its conversation is discarded. Its latest mark therefore describes it exactly at every rest point until its next commit. The one exception found was a one-shot widget artifact row stamped at room acceptance that survived an abandoned run; `abandonRun` now removes it, as `rollbackMessageRun` already did.
- **Pruning.** Whenever a participant's conversation is discarded or replaced, that conversation key's marks are removed. This covers sidecar replacement, sidecar retirement on an excerpt revision, guest dismissal, a completion that rebinds a participant to a different conversation, `clearAllConversations`, reset, and hydration degradation. A re-invited guest reuses its `guest:<id>` key, so marks from its previous membership must never describe its new history; adoption of a fresh conversation also prunes defensively.
- **Baseline.** When a room is hydrated and a live participant has no mark, the aggregate records an `origin: 'baseline'` mark at the ledger head from the imported counts. Sessions saved before this ADR therefore become exactly rewindable from the point they are reopened onward. No backfill heuristic is required.
- **Validation.** Marks are host-private and never enter the webview snapshot. The exact-key shape validator refuses a structurally malformed mark like any malformed field. Integrity requires each mark's `turnId` to exist (for a commit mark, a reply that committed into its own key), its key to be well-formed and held by a live participant, `messageCount` to be even, counts and offsets to be non-decreasing per key in ledger order, a baseline only as a key's first mark, **every commit after a key's first mark to carry a mark**, and no mark to claim more manifest rows or a later offset than its participant holds. Coverage is what §4's host exactness relies on: any mark at or before a cut proves the last commit before it is marked. An inconsistent key is dropped with a logged checkpoint normalization, so strict integrity holds for in-memory and written states. At the persisted-session boundary, a key is unverifiable when its archive entry is missing, any mark exceeds it, or its **latest mark does not equal it** (an unmarked tail would make a cut slice at the wrong commit); its marks are dropped with a logged normalization. Export drops any inconsistent key as a backstop, so a bookkeeping slip can never block a save. A bad mark degrades rewindability, never the session open.

### 4. Rewindability is host policy, published per turn

The aggregate computes whether each turn in the snapshot window offers Rewind/Branch. The result is published as a display-safe per-turn map, `WorkshopSessionSnapshot.turnRewindability`. The webview renders it and never re-derives it, the same pattern as `participantSubjectReady`. The rewind and branch handlers re-check it before cutting.

A cut point C is rewindable only when all of these hold:

1. It maps from an eligible bubble per §1.
2. No run is active and no session operation is pending.
3. **Host exactness.** If any host-authored reply exists at or before C, the host has a mark at or before C. This makes pre-baseline turns of reopened legacy sessions, and turns before a host-memory loss, non-rewindable.
4. **Directive floor (v1).** C is at or after the latest `standing_directive_change` turn. A shifted directive's earlier draft is not retained, so crossing it cannot be made honest yet.

The ledger records no run boundaries, so rest points are proven conservatively: after a run-ending reply or a writer-requested tool report, after a ledger event appended while no run was open, immediately before any run-starting writer turn, and at the idle head. A position inside an abandoned run's tail that none of these rules reaches is refused. `busy` takes precedence over every other reason; the snapshot evaluates it from the aggregate's active run, and the rewind operations add pending session operations when they re-check.

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
  summary: {                                   // counted once; callers never recount
    keptThroughTurnId: string;
    removedTurnCount: number;
    droppedConversationKeys: WorkshopConversationLogicalKey[];
    removedTodoCount: number;
    releasedWidgetConfigIds: string[];         // one-shot commits the cut removed
  };
  composerRestore?: {                          // writer-bubble cuts only
    text: string;
    attachmentIds: string[];                   // restaged under their original ta-N ids
    unrestoredAttachmentLabels: string[];      // the writer re-attaches these
  };
  widgetRestore?: {                            // a widget commit's own message only
    widgetConfigId: string;                    // its released config reopens in the widget sheet
  };
  unverifiedConversationKeys: WorkshopConversationLogicalKey[]; // diagnostics
}
```

A refused cut throws `WorkshopRewindRefusedError` carrying the policy's refusal reason. (Result shape amended in Sprint 02, see [Sprint 02 implementation findings](#sprint-02-implementation-findings), item 6; and in Sprint 03, see [Sprint 03 kickoff decisions](#sprint-03-kickoff-decisions), item 3.)

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
  - Repair `chatTarget` to host when its target is gone. The transform does this itself, because strict validation runs before hydration's chat-target repair. A writer-bubble cut first points the target back at the rewound message's addressee when that participant survives (Sprint 02 finding 4).
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
7. Write the cut room durably before reporting success, as New and Open do: an unnamed room writes `current.json`; an associated named room writes its named file through the identity-checked update, then schedules the rolling mirror. A failure before the durable write completes restores the prior room. (Amended at Sprint 02 kickoff; the original step marked the room dirty and left the write to autosave, which left no write failure to roll back. See [Sprint 02 kickoff decisions](#sprint-02-kickoff-decisions), item 5.)
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

## Sprint 01 implementation findings

Recorded 2026-09-30 while building the marks. Each item corrects or completes a detail above; the decision itself stands.

1. **Marks are recorded after settlement, not inside `completeRun`.** The composer, guest-join and synthesis paths all commit the reader offset, the host pin row and shipped attachment rows *after* `completeWorkshopRun` returns. A mark taken inside `completeRun` would carry a stale offset — so a rewound reader would receive the same catch-up twice — and too few manifest rows. The scripted-room oracle fails when the mark is moved back before settlement. §3 **Recording** now says where marks are recorded.
2. **Excerpt revision retires sidecars under the scope lock.** `replaceExcerpt` discards every tool sidecar, a discard site missing from the original pruning list. Rebinding a participant to a different conversation is another. §3 **Pruning** lists both.
3. **Abandoned widget commits left a manifest row behind.** The one-shot widget coordinator stamps its artifact into the target's manifest at room acceptance, before inference. A cancelled or failed run kept a row for an artifact the participant never received. `abandonRun` now removes it. Participant state thus changes only at commits (§3 **Commit-only change**).
4. **The persisted boundary requires equality, not just an upper bound.** "Marks exceed the archive" misses an archive that grew past its latest mark. The boundary now also requires the latest mark to equal the archive. Hydration applies the same check against freshly imported histories.
5. **Recovery equality ignores marks.** Opening a legacy file records baselines. Without this, the live room differs from its file only by marks, and a later Open of the same session preserves a spurious "(local recovery)" copy. An integration test covers it.
6. **Open question for Sprint 02: context-source supersede.** *(Resolved at Sprint 02 kickoff: append plus stale chain. See [Sprint 02 kickoff decisions](#sprint-02-kickoff-decisions), item 1.)* `ConversationManager.appendContextSources` *replaces* a row in place when a canonical resource is re-delivered. Slicing to `contextSourceCount` restores the right set of rows, but a re-delivered row keeps its later metadata (`deliveredAt`, `sizeChars`, `promptTokensDelta`, `artifactId`). Recommendation: make re-delivery append a new row and mark the superseded one stale, then recompute that stale chain in the transform exactly as §5 already does for host pins. The alternative is to accept the metadata drift as an intended oracle difference.
7. **Anchors and coverage (PR #117 review F-01).** Ordered, monotonic, tail-verified marks could still omit an intermediate commit, or anchor a commit mark to another participant's turn. Either one survived every boundary and published a cut that would slice the wrong prefix. Integrity now requires both properties (§3 **Validation**), degrading the whole key otherwise.

## Sprint 02 kickoff decisions

Confirmed 2026-09-30 before the transform was written. Each confirms or corrects a detail above.

1. **Context-source re-delivery appends (resolves finding 6).** `ConversationManager.appendContextSources` appends a new row when a canonical resource is re-delivered and marks the superseded row `stale`, the dimmed-history rule host pins already follow. A mark's `contextSourceCount` then slices to exactly the rows the history held at the mark, and the transform recomputes the stale chain inside the kept prefix. Replacing in place was worse than metadata drift: a kept row could name an `art-N` that the cut history no longer contains.
2. **Temporal state stays current.** Per-persona time notices are not rewound, like the working set. Rewind does not re-hydrate the time service, so it queues no resume notices and records no "Session resumed" marker. A dropped participant's notice entry ends with its conversation, so a fresh conversation under the same key receives its own session-start frame. (Amended at Sprint 03 kickoff: the original sentence kept the entry, as dismissal and generation loss then did, and a fresh host could go up to an hour without a time frame. See [Sprint 03 kickoff decisions](#sprint-03-kickoff-decisions), item 2.)
3. **Conversation `lastActivity` is wall-clock and never rewound.** It is an intended oracle difference.
4. **Host marks record the context revision the host holds (amends §2 Context and §3).** The divider rule is not exact. A kept divider after the host's last kept commit is undelivered at the cut. A context edit made during a host run is not delivered by that run. A session-open file refresh changes the revision with no divider at all. Excerpt delivery has a record, the host pin rows; context delivery had none. Host marks therefore carry an optional `contextRevision`: the context revision the host holds at that rest point, which is `revisions.context` when no context update is pending and `revisions.pendingContext − 1` otherwise (a pending revision is always the current one). It is recorded at settlement and at baseline, and validated as host-only, non-decreasing, and never later than the revision the host currently holds. The transform re-queues `pendingContext` at the current revision exactly when the host's cut mark records an older one. Marks are unreleased, so there is no schema bump; an integration-branch checkpoint whose host marks lack the field degrades through the existing inconsistent-mark normalization.
5. **Rewind is durable before it succeeds (amends §6 step 7).** Like New and Open, the operation writes inside itself. Any failure at transform, import, hydrate or write restores the prior room through `restoreRollback`, and the prior provider conversations are discarded only after the durable write succeeds. A rolling-mirror failure after a successful named write stays independently retryable and does not roll back. While `current.json` is protected, Rewind stays in memory, like every other mutation in that state.

## Sprint 02 implementation findings

Recorded 2026-09-30 while building Rewind. Each item corrects or completes a detail above; the decision itself stands.

1. **An absent room offset stays absent for a participant with no retained conversation.** A cut before the host's first reply removes the host binding (§5), and the next host must receive the kept thread as catch-up. The hydration normalization `headed-missing-room-offsets` headed every absent `lastSeenRoomTurnId` to the ledger head, which is exactly the failure the "wipe participant histories" alternative describes: the fresh host would have received nothing. The normalization now heads offsets only for a host that retains a conversation and for live guests that do. An unbound host or a disposed guest has read nothing, so absence is its truth. The named-room coordinator test found this; regression tests cover both the normalization and the fresh host's catch-up after a rewind.
2. **Participants a rewind drops are named in the action result, not in the degraded-memory banner.** The banner's copy ("will begin fresh on their next turn") describes hydration loss. A dropped participant is a consequence the writer chose, so the result says it plainly: the host starts fresh, a guest left the room, a tool's conversation was set aside and can be re-run.
3. **A direct tool message's attachments are named for re-attach, not restaged.** Direct tool messages are private and never publish thread artifacts, so their attachment bodies exist only in the tool's provider history. Restaging them would mean parsing provider messages (invariant 2). A writer-bubble rewind of one restores the text and lists the attachments to re-attach. The same list names any attachment that no longer fits the composer's staging limit.
4. **A writer edit returns the chat target to the message's addressee.** Without this, an edit of a message sent to a guest or a tool would be re-sent to whoever the target had become since. When the addressee did not survive the cut, the §5 repair applies and the target falls back to the host.
5. **The latest reply offers no Rewind action.** The host still publishes a verdict for it, because the idle head is a real rest point: Side Quests pin it, and Branch from the latest reply is meaningful (Sprint 03). Rewinding there would change nothing, so the webview omits only that one action. This is a presentation choice, not a re-derived verdict.
6. **The transform returns a cut summary, not loose fields.** `droppedConversationKeys` lives in `summary` beside `keptThroughTurnId`, `removedTurnCount` and `removedTodoCount`, so the action result, the log line and a future Side Quest divider read one count. `composerRestore` gains `unrestoredAttachmentLabels` (item 3), and `unverifiedConversationKeys` reports marks the transform could not trust, which it treats as unmarked, as the persisted boundary does. §5 shows the amended signature.
7. **D7 gating in the webview.** Rewind follows New-session availability. While persistence is unavailable, every Rewind action is disabled with the reason ("Rewind needs a single-root workspace" or "Rewind needs an open workspace folder"). While the room is busy (a live turn, a run, the Context wizard, or a pending session change), every action is disabled with one busy reason. The host still refuses on its own; webview gating remains advisory.
8. **Session handlers reach the rewind vocabulary through the coordinator.** The architecture guard forbids handlers from importing session collaborators. `WorkshopSessionPersistenceCoordinator` therefore re-exports `WorkshopRewindCut` and `WorkshopRewindRefusedError`. The bubble-to-cut mapping stays in `WorkshopSessionService` as thin delegation to the Sprint 01 policy.

## Sprint 03 kickoff decisions

Confirmed 2026-10-01 before Branch was written. Each confirms or corrects a detail above.

1. **One room-replacement transaction.** New, Open, Rewind and Branch all replace the live room, and all four share one sequence:
   - capture the rollback;
   - prepare, install and write the new room durably;
   - restore the prior room on any failure;
   - discard the replaced conversations only after success.

   A private coordinator helper owns that sequence. New, Rewind and the named-session promotion use it; Open, refresh and Branch reach it through the promotion. No room-replacement collaborator is extracted yet.
2. **Time notices end with their conversation (amends Sprint 02 kickoff decision 2).** A notice entry is per-conversation delivery state, like a room offset. `WorkshopSessionTimeService.forgetNotices(keys)` removes a persona key's entry and any pending resume notice wherever a persona conversation ends with no replacement history:
   - the persona keys a rewind drops, inside the operation and before its durable write, so rollback restores them;
   - guest dismissal;
   - an assistant generation loss.

   Surviving participants keep their entries, so temporal state otherwise stays current. A branch starts with no persona notices at all (§7).
3. **A rewound widget commit reopens its widget.** The transform's summary reports the one-shot configs a cut released. A writer-bubble cut on a widget commit's own message is an edit of that widget: its released config reopens in the widget sheet, the widget twin of the composer re-seed (§1). A cut that skips past a commit releases its config silently, and that residue is accepted.
4. **Manual smoke is recorded by the writer.** A cloud session cannot run the Extension Development Host, so the epic's smoke criterion stays open until Okey records results.
5. **What's New uses the existing startup notice.** ADR 2026-08-05's notice ledger is not implemented. The release prepends a Rewind and Branch page to the Workshop startup notice and moves its version from `v3` to `v4`.

Also settled at kickoff, within §7:

- The coordinator's `branchFrom` takes a cut, like `rewindTo`. The route maps a bubble to its cut.
- The branch's temporal state is fresh: its start and last activity are the branch time, and it keeps the source's timezone and no persona notices. Promotion is Open's path, so retained personas receive a resume frame and the first interaction records "Session resumed".
- A named room whose latest autosave has not landed is refused. Branch never writes the source file, so it cannot flush that file either.
- The title is `"<source title> — branch"`. The source title is trimmed so the suffix fits the 160-character title limit; the store already makes the file name collision-free.

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

- [Side Quests](../../.todo/features/feature-workshop-side-quests/README.md): Start pins the current idle head and End rewinds to it. This ADR's cut policy therefore answers for any rest point, dividers included, and the rewind operation is generic over its origin. Side Quest state and UI are decided in that feature, not here.

- Branch lineage metadata and a "branched from" row in the session browser. This belongs with the parked [Branch Board](../../.todo/features/feature-workshop-branch-board/README.md) feature's explicit branch model.
- Crossing standing-directive changes, which needs directive revision history.
- Optional verified backfill of marks for pre-baseline turns.
