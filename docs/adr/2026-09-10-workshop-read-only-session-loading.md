# ADR 2026-09-10: Workshop loading does not create author work

**Status:** Accepted — implemented locally; manual VS Code verification pending
**Date:** 2026-09-10
**Supersedes:** load-time mutation behavior in ADR 2026-09-08 (named authority retained)

## Context

The September 10 incident preserved an older committed 17-turn room plus an
automatic resume as a recovery after Git delivered 33 turns. Discard restored the
tracked named files but could not reset ignored current.json. Startup treated a
stale clean cache as unsaved work. Resume autosave and automatic context refresh
then dirtied the named file again without author interaction.

## Decision

Use a clean-cache provenance marker on the rolling checkpoint, bound to its full
normalized content by SHA-256. Only checkpoints mirrored from an accepted named
file receive it. Author edits saved only to rolling state have no clean marker.
A matching marker proves the rolling state was already saved and can be replaced
by incoming named state without recovery. A missing, invalid, or mismatched marker
never proves that; older rolling files remain conservatively recoverable.
The marker is not an optimistic-write token and never authorizes a named write.
Named checkpoints do not carry rolling provenance.

Startup, Open and reveal hydrate without adding resume turns or activity times,
and mirror accepted named state only into current.json. Automatic context rereads
update the runtime working set without autosave or dated transcript notices.
Messages/tool interactions add the pending resume boundary before their turns;
committed author activity and explicit Save/Refresh persist the working set.
Explicit context, todo and widget edits retain their existing autosave durability.
Live dirty revisions determine whether an incoming named replacement needs a copy;
automatic runtime refresh alone does not make the room author-dirty.

## Consequences

Opening a saved room must leave named bytes and timestamps unchanged. Repeated
opening, discard/pull/reopen and automatic source refresh do not manufacture
recovery files once rolling provenance is established. Failed named saves retain
unmarked rolling author work for recovery after restart. Altering a rolling payload
invalidates its clean proof. No Git process, timestamp ordering or turn-count
heuristic is used to decide which work can be discarded.

The optional rolling marker extends the V2 envelope without changing named-file
shape. Legacy checkpoints can cause one conservative recovery when provenance is
unknown. The existing full-checkpoint optimistic-write checks and final filesystem
compare/rename limitation remain unchanged.
