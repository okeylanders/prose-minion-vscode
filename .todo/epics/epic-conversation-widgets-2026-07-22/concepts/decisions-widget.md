# Concept Spring: Decisions

**Status**: Concept spring
**Priority candidate**: High
**Classification**: Conversation Widget + derived transcript view
**Likely rail**: One-shot thread artifact

## Product idea

Workshop conversations make decisions gradually: alternatives are proposed,
pressure-tested, rejected, and finally chosen. **Decisions** turns the chosen
result into a compact structured event without asking the writer to maintain a
second decision log.

The widget has two tabs:

1. **Log decision** — capture or refine one decision.
2. **All decisions** — assemble every decision currently retained in the
   conversation, with status and provenance.

At the end of a session the writer can ask a persona for the decisions, a
handoff, or an update plan. The persona requests the assembled list through a
closed capability rather than trying to remember or rediscover it from prose.

## Decision record

The committed payload should stay small and structured:

- decision / chosen option;
- alternatives considered;
- short rationale;
- affected scope (passage, character, scene, project, architecture, etc.);
- places that may need updating (free text plus optional project-resource refs);
- status: `decided`, `deferred`, `superseded`, or `reversed`;
- optional stable id of the earlier decision this one supersedes;
- actor and source-turn provenance, minted or verified by the host.

This is append-only history. Correcting a decision creates a new record that
supersedes the old stable id; it never rewrites the turn the room already saw.

## Interaction and permissions

- **Writer**: launch empty, edit any fields, and commit.
- **Persona**: recommend or launch prefilled for writer review.
- **Persona direct log**: may bypass the modal through a closed
  `decisions.log` capability. The host validates the payload, commits it as a
  visible attributed event, and returns the stable id. It is never a hidden
  memory write.
- **Persona read**: `decisions.list` deterministically scans the retained
  decision frames and returns the assembled list. Filtering by status/scope is
  allowed; an unconstrained raw transcript search is not the contract.

The host, not model-authored text, creates the reserved frame and its id. The
frame joins the delimiter neutralizer in the same change.

## Storage contract: no shadow decision log

The canonical decision record is a structured, stable-id artifact on the
extension-owned Workshop turn. The same trusted frame is delivered into
`ConversationManager` for the live conversation. Sprint 10 now persists that
history as part of T3 restore, but provider history is still not its sole
durable home: the canonical typed payload belongs to the product session graph.
**All decisions** is a projection produced by scanning the full session turn
record; it is not another mutable decision collection in
`WorkshopSessionService`.

That constraint has two consequences to settle before promotion:

1. **Compaction must preserve decision semantics.** General conversation spans
   may be compacted around decision frames, but a retained decision record is
   copied verbatim into the compacted projection or explicitly superseded. A
   lossy summary must not become the source of truth for what was decided.
2. **Restored-session behavior must be honest.** Decision artifacts round-trip
   in both the canonical extension-owned turn graph and the retained
   conversation archive. The deterministic list still scans the canonical turn
   graph, so degraded T2 recovery and later conversation compaction cannot erase
   what was decided. No parallel mutable decision database is introduced.

## Likely UI

**Log decision**

- prominent decision field;
- option cards with chosen/rejected/deferred states;
- rationale and implications;
- "Update these places" resource picker plus free text;
- preview of the compact record before commit.

**All decisions**

- chronological list with active/superseded/reversed filters;
- scope and actor filters;
- links back to the originating turn/chip;
- copy/export/"ask the room for a summary" actions based on the assembled
  projection.

## Smallest useful slice

Writer log + persona prefill/direct-log + deterministic `decisions.list` + the
two-tab UI. Defer resource-aware update automation and aggregation across
separate named sessions; one restored session's decision projection works from
its persisted turn record.

## Promotion questions

- Are decision records protected from manual Release as well as Compact, or can
  the writer explicitly remove one with a tombstone?
- Does `decisions.list` scan only the host conversation, or host plus guest
  sidecars? The host transcript is the simpler canonical boundary.
- Which "update here" references are validated project resources versus plain
  descriptive text?
