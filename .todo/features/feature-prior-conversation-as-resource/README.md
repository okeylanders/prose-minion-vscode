# Feature: A prior conversation is a resource, not a branch

- **Status**: Idea captured — not scheduled
- **Priority**: Low (unblocks nothing; improves an existing answer)
- **Captured**: 2026-07-25 (Okey's design call)

## The idea

When a writer wants a new Workshop session to know what was discussed in an
earlier one, do **not** fork or branch the conversation. Instead, make a prior
session's transcript an ordinary **context resource**, delivered one of two
ways:

1. **Writer opt-in** — a widget button / attach affordance that adds the prior
   conversation to context, the same way any file or note is attached.
2. **Host fetch** — the persona requests it through the existing capability
   system when the writer's message implies it ("like we talked about
   yesterday…").

## Why this shape rather than branching

**It is honest by construction.** [ADR 2026-07-24](../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
establishes that cross-participant material always arrives as quoted,
speaker-labeled text inside the **user** message — never as the recipient's own
`assistant` turns. A transcript delivered as a resource inherits that invariant
for free: the host *reads a record of* a conversation instead of *remembering*
one.

A forked host would instead inherit a history it never lived and speak as
though it had — which is precisely the failure mode
[ADR 2026-07-25](../../../docs/adr/2026-07-25-workshop-scope-immutability.md)
and the [PR #86 review](../../../docs/pr-reviews/pr-86-open-chat-session-scope-review.md)
exist to prevent. This shape cannot produce that state.

**It reuses machinery that already exists.** No new delivery protocol, no
divergence rules, no parent/child lifecycle, no shared-cost questions:

- `ContextResourceProvider` (`listResources` / `loadResources`) already backs
  `resource.catalog` and `resource.read`, resolving against a pre-enumerated
  allowlist rather than a persona-supplied path — so host-initiated fetch adds
  no new security surface.
- `WorkshopSessionStore` already enumerates saved sessions with summaries and
  search, so the catalog of "prior conversations" is already built.

**It closes a known cost.** ADR 2026-07-25 locks session scope once the room
has a memory, which means changing mode costs the thread. This feature makes
that thread *readable* from the new session, turning the ADR's one honest loss
into a recoverable one.

## Open questions for whoever picks this up

- **Bounding.** A transcript is large. The excerpt caps at 10,000 words and
  context attachments share a 35,000-word budget (`PROMPT_BUDGETS`). A
  conversation resource needs its own ceiling and probably a condensed form —
  decide whether the payload is the raw ledger, a slice, or a generated
  summary, and who pays for generating it.
- **What counts as the transcript.** Writer + host turns only, or also tool
  reports, guest exchanges, and session dividers? The ledger holds all of them;
  the useful payload is probably narrower.
- **Staleness.** If the source session is later deleted or renamed, what does
  an already-delivered reference say? (The `stale` flag on manifest rows is the
  existing vocabulary for this.)
- **Relationship to the persona chronicle.** [ADR 2026-07-18](../../../docs/adr/2026-07-18-workshop-living-room-chronicle-and-episodic-memory.md)
  covers persona *world* memory (Diffuser / Chronicler / Day Cards), which is a
  different concern — but both end up projecting bounded history into a prompt,
  so the budgeting approach should at least be consistent.

## Explicit non-goal

Conversation forking or branching, in any form. It was considered and rejected
in [ADR 2026-07-25](../../../docs/adr/2026-07-25-workshop-scope-immutability.md)
§"Alternatives considered"; this feature is the intended answer instead.
