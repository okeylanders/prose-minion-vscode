# ADR: Workshop Thread Artifacts & Context Compaction (DRAFT)

- **Status**: Draft — skeleton captured 2026-07-18 from design discussion
  (Okey + Ada) during Sprint 12; fleshing out is the Sprint 12 Phase 8
  deliverable, implementation is the post-launch fast-follow.
- **Context**: Sprint 12 established standing context attachments; the
  Context Bar v2 comp reserves Compress/Compact affordances; retained
  conversations are append-only today, so removed/superseded context is
  instructed-away, never physically removed.

## The reframe that makes this tractable

**There is no conversation stored at the provider.** `ConversationManager`
holds the messages array host-side and every request re-sends it whole.
"Append-only" is our policy, not physics. Retained-history surgery is
therefore an edit to OUR stored array between turns — no API support needed.

## Artifact taxonomy (the frame contract)

Three kinds of prompt material, each with distinct lifecycle and framing:

1. **Context-artifacts** (standing): the Sprint 12 attachment list.
   Live in the session aggregate; budgeted (aggregate word cap).
   **Decided direction (2026-07-18, Okey): canonical-entry edit-in-place
   replaces full-list supersede.** The shipped Sprint 12 behavior (re-ship
   the WHOLE list inside `<workshop-host-update>` after any change) has an
   absurd consequence: removing context GROWS the next prompt. Instead,
   standing context becomes its OWN dedicated array entry near the front of
   the conversation — one addressable region, coalesced at send time for
   alternation-strict providers. Changes edit that entry in place: removals
   tombstone (id/name survive), additions insert. The next user message
   carries a small `<context-edited>` heads-up frame listing deltas
   (names/ids only, NO content) so nothing mutates silently and the model
   has a temporal marker for content that now appears "always present".
   Pending semantics simplify: edits apply to the canonical entry
   immediately (nothing ships until the next call anyway); the heads-up
   lists deltas since the last delivered turn. Cost trade, eyes open:
   every churn invalidates provider prompt cache from the entry forward
   (one full-price call) in exchange for permanent window relief — the
   right trade for prose (token-heavy files, 35k lists, window pressure,
   provider caching varies on OpenRouter anyway).
2. **Thread-artifacts** (one-shot, writer-added via chat): BUILT in Sprint 12
   Phase 6B. The composer `+` offers "Attach to this message" beside "Add to
   standing context"; staged attachments live host-side
   (`WorkshopSessionService.pendingMessageAttachments`, ids minted `ta-N`,
   per-message item cap + per-artifact head-slice in
   `promptBudgets.workshopThreadArtifacts`), render as removable composer
   pills, ride exactly one send, and are committed off the pending list only
   after that turn succeeds (failed/cancelled sends retain them). The turn
   records display-safe refs (`WorkshopTurn.messageAttachments`) — the
   manifest's Phase 7 hook. Contract: `<thread-artifact id="ta-N">` with the
   host-minted id as the ONLY attribute; writer-controlled name/source/slice
   provenance ride as neutralized header lines per the house rule, and
   `thread-artifact` is a reserved delimiter in the neutralizer.
   Storage note: today the frame rides WITHIN the send's one user entry
   (wire shape unchanged; the id-delimited frame span is the surgery
   address); the separate-array-entry storage + send-time coalescing
   described under Engineering caveats arrives with the surgery
   fast-follow, and new artifacts get their own entries then.
3. **Agent-fetched artifacts** (capability evidence): resource reads, tool
   run reports, dictionary evidence. ALREADY separate user-role array
   entries injected per capability round by `AgentRunEngine`, already
   identifiable by their closed frames (`<workshop-capability-result>`,
   `<workshop-tool-evidence>`, …). Since Sprint 12 Phase 6, retained-run
   injections are additionally wrapped in `<agent-artifact id="art-N">`
   (ids minted per conversation by `ConversationManager.nextArtifactId`,
   monotonic and never reused; cancelled turns may skip numbers) so the
   Phase 7 manifest and tombstone surgery can address the stored entry.
   They are thread-artifacts in lifecycle terms: one-shot,
   history-resident, surgery-addressable.

## Surgery mechanism: tombstones, not deletion

Removing an artifact edits its array entry in place: the wrapper message
SURVIVES, content is replaced by a tombstone —
`Artifact removed by: writer|<persona> · name: chapter-4.8 — ask to
re-attach if needed.` The name survives so earlier assistant references
don't dangle unexplained and re-attachment stays one ask away.

- **Addressing**: stable ids only (`ctx-N` / `art-N`), never indices —
  insertion and send-time merging shift indices.
- **Writer-initiated**: manifest row → remove control.
- **Agent-initiated**: a closed capability op (e.g.
  `context.release-artifact`), allowlisted and parsed like every other op,
  surfaced as a visible turn ("Jill released chapter-4.8 from context") —
  never silent.

## Engineering caveats

- **Role alternation**: some providers require user/assistant alternation;
  store artifacts as separate entries (easy surgery targets) and coalesce
  consecutive user entries at SEND time when the provider needs it.
  Storage shape ≠ wire shape.
- **Prompt caching**: editing an early entry invalidates provider prompt
  cache from that point; the next call re-pays full input once. Surgery is
  occasional, not per-turn.
- **Atomic commit**: surgery only between turns, never mid-flight; the
  manifest marks entries removed rather than vanishing them; cancelled
  turns preserve prior state (existing 11B/12 semantics).

## Candidate mechanisms for the Compress/Compact affordances (v2 comp)

- **Stale-evidence eviction** (this ADR's tombstone surgery) — leading
  candidate; targeted, explainable, cheap.
- **Compress** (head/tail/middle-out truncation of history) — blunt;
  breaks attribution; likely last resort.
- **Compact** (agent-written summary replacing a span) — highest quality,
  costs a model call; summary becomes a tombstone-like entry with
  provenance ("Compacted summary of turns 3–17").

Decision framework: let Phase 7 manifest data show what actually dominates
real sessions (repeated context-artifact re-ships vs. tool evidence vs.
guest catch-ups) and evict the dominant class first.

## Open questions for the full ADR

- ~~Delta-shipping context-artifact additions vs. full-list supersede~~ —
  RESOLVED 2026-07-18 by canonical-entry edit-in-place (taxonomy item 1):
  no re-shipping in either direction; the heads-up frame carries deltas by
  name/id only.
- Migration: retire the `<workshop-host-update>` context section and the
  initial-message embedding in favor of the dedicated standing-context
  entry + send-time coalescing; ensure ConversationManager's atomic commit
  covers the in-place entry edit.
- Snapshot semantics: how surgered history serializes into Sprint 10's
  `WorkshopSessionSnapshotV1`.
- Budget interaction: do tombstoned words return to the standing budget?
  (Standing list: yes by construction. History: N/A until compaction.)
