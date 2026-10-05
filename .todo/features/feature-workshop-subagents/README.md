# Feature: Workshop Subagents

**Date Identified:** 2026-10-05
**Status:** Idea. A larger lift that needs an ADR; nothing builds on it yet
**Priority:** Medium
**Origin:** Okey, while settling Session Recall Slice 2B

## Problem

Recall results (search hits, read windows, and soon to-do lists) land in the
persona's own thread. A persona that searches, then parses the hits, then
reads, fills its context with material it mostly discards. The bounds keep
that small today, but a thorough look across many sessions will want more
than a persona should carry.

## Idea

A subagent is a short-lived delegate thread run on a fast, inexpensive model.
For example, an open-weight model served at around 1,000 tokens per second
can absorb roughly 100K characters of recall results, decide what is
relevant to the persona's question, and return only that shortlist, with its
ids, to the persona.

Later, subagents could also edit files on the persona's behalf. That shares
the write-back concerns already parked in
[Workshop Apply to Draft](../feature-workshop-apply-to-draft/README.md).

## What is already in place

- **A principal for it.** The [room-ledger ADR](../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
  reserves `private(tangent:<id>)` for a sub-agent thread. It needs no new
  visibility value, cursor, or schema change.
- **Recall's results are ready to delegate** ([Slice 2B plan](../../epics/epic-workshop-session-recall-2026-10-05/slice-2b-transcript-todos.md#later-what-2b-leaves-the-door-open-for)):
  - The service returns data, not prose.
  - Renderer caps are options, not constants.
  - Every item carries its session, turn, and to-do ids.

## What the ADR has to settle

- **Delegation.** Who starts a subagent: the persona through a capability
  call, or the host automatically for oversized results?
- **Model and cost.** Model choice, cost and token accounting, and the cap
  on what a subagent may read.
- **What comes back.** A bounded shortlist with ids and a one-line reason
  for each. Never the raw material, which would refill the thread it was
  meant to protect.
- **Failure.** On timeout, refusal, or a malformed shortlist, fall back to
  the bounded direct result and say so.
- **Deterministic edges.** Budgets, id validation, and the shortlist codec
  are code, tested without a model; only the relevance judgment is the
  model's.
- **Visibility.** Whether the subagent's thread is shown to the writer, and
  whether its shortlist is publishable evidence like `transcript.read`.

## Related

- [Workshop Task Sidecar Conversations](../feature-workshop-task-sidecar-conversations/README.md)
  (another delegated conversation shape)
- [ADR 2026-10-05: session transcript recall](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md)

## Completion Criteria

- [ ] An ADR covers the questions above.
- [ ] A first subagent filters recall results, behind the existing recall
      budgets, with a fallback witness.
