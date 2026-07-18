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
   Live in the session aggregate; serialized into the initial host message
   and re-shipped WHOLE (full content, changed and unchanged) inside
   `<workshop-host-update>` on the next turn after any change, with
   supersede semantics. Removable from the standing list; historical copies
   remain until compaction. Budgeted (aggregate word cap).
2. **Thread-artifacts** (one-shot, writer-added via chat): NOT YET BUILT.
   A file/note attached to a single message rides ONE user turn as its own
   array entry (`<thread-artifact id=… name=…>`), then becomes ordinary
   history — never re-shipped, no standing budget, visible in the manifest.
   The composer `+` would offer "attach to this message" beside "add to
   standing context".
3. **Agent-fetched artifacts** (capability evidence): resource reads, tool
   run reports, dictionary evidence. ALREADY separate user-role array
   entries injected per capability round by `AgentRunEngine`, already
   identifiable by their closed frames (`<workshop-capability-result>`,
   `<workshop-tool-evidence>`, …). For surgery they additionally need
   **stable artifact ids** stamped at injection and registered in the
   Phase 7 manifest. They are thread-artifacts in lifecycle terms:
   one-shot, history-resident, surgery-addressable.

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

- Delta-shipping context-artifact additions (vs. full-list supersede) —
  removals still need full-list semantics; is a hybrid worth the model-
  reliability risk?
- Snapshot semantics: how surgered history serializes into Sprint 10's
  `WorkshopSessionSnapshotV1`.
- Budget interaction: do tombstoned words return to the standing budget?
  (Standing list: yes by construction. History: N/A until compaction.)
