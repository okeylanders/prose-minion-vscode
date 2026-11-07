# Feature: Memories That Cite Turns From More Than One Session

**Date Identified:** 2026-11-05
**Status:** Idea. It was deferred from the [bookmark recall epic](../../archive/epics/epic-workshop-bookmark-recall-2026-11-05/README.md) (ADR 2026-11-05 D10; PR #214 F-06).
**Priority:** Low
**Related:** [ADR 2026-11-04: Workshop Project Memory](../../../docs/adr/2026-11-04-workshop-project-memory.md) (D3: provenance, D4: format 1)

## Problem

A memory records one `sourceSession` and its `sourceTurns`, and the memory manager resolves every turn against that one session. So a persona in room A that proposes a memory from a bookmark in saved session B can't cite B's turn. Saved under A, the turn would be looked up in A and come back missing, or match the wrong turn.

## Shape

- **Session-qualified sources.** For example, `sources: [{ session, turns }]` in a new memory format.
  - A codec change, plus compatibility: format 1 files read unchanged, and this follows ADR 2026-07-30's release rule if format 1 has shipped by then.
  - Updates to the library, the manager and the provenance UI.
- **Proposal citations.** The proposal trailer accepts saved-session citations as `{ session, turn }`, each checked through recall's `positionsOf`.
- **Bounds.** Deduplication, and a per-memory bound (today it's 32 turns).

## Completion Criteria

- [ ] A memory can cite turns from the live room and from saved sessions, and reads them back in their own sessions.
- [ ] Format 1 memories read unchanged.
- [ ] Tests cover live plus saved sources, two saved sessions, turn ids that overlap across sessions, and reopening.
