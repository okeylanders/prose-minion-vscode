# ADR 2026-09-10: Workshop loading does not create author work

**Status:** Accepted — PR #115 remediation implemented for PR #115; failure-path re-review pending
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

## Review clarification — 2026-09-10

Named authority also applies when Git reverts real autosaved author work. Once
that work was successfully written to named, its verified clean rolling copy
follows the reverted named file without recovery. Unsaved work here means work
not successfully committed to the named checkpoint, not work uncommitted to Git.
No timestamp heuristic or additional backup file is introduced.

A successful hydration or named write is independent of its rolling cache copy.
A failed startup mirror keeps the hydrated room, named association, accepted
baseline and pending resume. A later reveal adopts a changed named checkpoint;
if named is unchanged, reveal or flush retries only its original cache payload.
Cache retries do not capture runtime context, touch activity, or rewrite named.
New author work supersedes an older cache retry; strict named-write checks remain.
Save-as-new and explicit updates return the successful named result even if the
cache copy fails, reporting that failure separately through save status.

Pending cache copies are tracked separately from author dirty revisions and
survive replacement rollback. A protected unreadable current file stays protected
through rescue saves and flush; explicit Open or reset is required to replace it.
Recovery notices describing successfully written files survive hydration and
rollback, and are delivered even when the subsequent session load fails.
Archive-free loads do not wait for provider readiness merely to copy a checkpoint.

### Release review: manual refresh ownership

Manual **Refresh changed files** holds the persistence coordinator's existing serialized
session operation for the complete scan, including asynchronous authorization and reads.
The session message owner handles this lifecycle and emits the same scan busy state as
loading; the context handler continues to own file intake and applying refreshed content.
Open/New and message/tool/guest mutations are blocked while the scan owns the room.
Refresh also rejects an already-active response or Context wizard before reading files.
This prevents results captured in one session from replacing another session's attachment
with the same session-local ID. Automatic Open/reveal scans already hold the operation
and do not reacquire it. Failure releases ownership and clears the scan indicator.
