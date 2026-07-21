# ADR: Workshop Thread Artifacts & Context Compaction

- **Status**: Accepted — 2026-07-21
- **Decision owner**: Okey
- **Planning source**: skeleton captured 2026-07-18 during Sprint 12; its
  decision and delivery plan were completed 2026-07-21.
- **Delivery**: [Workshop Context Compaction epic](../../.todo/epics/epic-workshop-context-compaction-2026-07-21/README.md).
  Sprint 12 establishes only this decision; the follow-on epic implements the
  affordances and retained-history surgery after the current Workshop epic's
  persistence pass.
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

## Decision

The Context Bar exposes all three explicit, writer-visible affordances in the
follow-on epic. None may run automatically from token pressure or a provider
compression signal.

| Affordance | Result | Cost and guardrail |
|---|---|---|
| **Release** | Replaces one addressable artifact with a tombstone. | No model call. A writer may release any removable context/artifact. A persona may invoke the allowlisted release capability only for agent-fetched evidence; writer-owned material always requires an explicit writer action. |
| **Compress** | Replaces a writer-selected retained span with a bounded, deterministic head/tail representation and a provenance tombstone. | No model call. It is an explicitly lossy, inspectable fallback; it never silently changes the conversation. |
| **Compact** | Replaces a writer-selected retained span with an attributed assistant-written summary and a source-span tombstone. | One bounded model call, with cancellation preserving the original span. The summary is a new artifact with stable provenance, not an invented historical turn. |

The three controls are real follow-on-epic work, not disabled theater. They are
enabled only when a selectable, safe target exists; otherwise their disabled
state explains why. The UI must distinguish this product-level **Compress**
action from provider-reported context compression.

### Release actors and visibility

- Writer release is a direct, deliberate action from an inspectable context or
  artifact row.
- Persona release is a closed, allowlisted `context.release-artifact` request,
  validated host-side against a stable artifact id and ownership before any
  mutation. It may release only agent-fetched evidence. It must create a visible
  turn such as “Jill released chapter-4.8 from context”; it never silently
  drops writer-supplied excerpt or attachments.
- All three affordances mutate history only between turns. The atomic history
  commit and context-source manifest commit succeed together; cancellation,
  validation failure, and transport failure preserve the prior history and
  manifest.

### Persistence decision

Tombstones, compressed spans, and compacted summaries persist with the session.
They are display-safe, attributable transcript provenance—not erased history.
Because this follow-on runs after Sprint 10 establishes
`WorkshopSessionSnapshotV1`, it introduces the next schema version rather than
retrofitting a released v1 contract. That version carries each retained entry's
stable id, kind, action/actor, reason, timestamp, and (for compaction)
source-span and summary provenance. On restore they remain inert transcript
records; no old provider conversation, pending action, or live capability state
is revived.

## Mechanisms and selection framework

- **Release / stale-evidence eviction** is the narrowest first move: targeted,
  explainable, and free. It is suitable for delivered resource, tool, and
  dictionary evidence whose purpose has passed.
- **Compress** is deterministic head/tail reduction of a selected old span,
  with the omitted middle named in its tombstone. It is faster and cheaper than
  a summary, but it can break nuance and attribution, so it is never the
  default recommendation.
- **Compact** produces an attributed summary of a selected contiguous span. It
  is the highest-quality space recovery and costs a dedicated model call; the
  original span remains recoverable as persisted provenance, while its prompt
  projection becomes the compacted artifact.

The Context Bar's Phase 7 manifest tells the writer what is actually occupying
the conversation. It informs which target to select—standing context churn,
agent evidence, or old exchanges—but does not autonomously select, release,
compress, or compact anything. The follow-on epic must use measured/estimated
source sizes honestly and label the estimate.

## Follow-on epic contract

The associated epic must:

1. migrate standing context from full-list re-shipping to the canonical,
   addressable entry with send-time coalescing for alternation-strict providers;
2. deliver writer and persona release paths, then Compress and Compact, with
   visible outcomes and no automatic retention mutation;
3. introduce the next versioned snapshot schema/serializer and restore
   projection for persisted surgery provenance;
4. preserve stable-id addressing, prompt-frame neutralization, ownership
   boundaries, atomic commit semantics, and reset/delete/expiry behavior; and
5. prove cancellation, failed mutation, provider variation, accessibility,
   source-manifest attribution, persistence, and no-raw-path boundaries with
   focused tests plus an Extension Development Host pass.
