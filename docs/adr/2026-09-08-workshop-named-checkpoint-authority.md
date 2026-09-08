# ADR 2026-09-08: Workshop named checkpoint authority

**Status:** Accepted; review remediation in progress
**Date:** 2026-09-08
**Extends:** [Workshop session persistence](2026-07-14-workshop-session-persistence.md)

## Context

A Git pull can replace a named Workshop session after the extension has restored
its local rolling checkpoint. Startup-only divergence detection leaves later
autosaves free to overwrite the incoming conversation. The named file must take
precedence over current.json, regardless of timestamps or transcript length.

## Decision

- Restore the uniquely matching named session whenever current.json identifies
  one. Refresh current.json from that session, including the new resume marker.
- Recheck the associated named session when the webview requests its room state,
  before refreshing file-backed context. Revealing a retained editor tab routes
  the same request because React does not remount. If it changed since the last accepted
  checkpoint, hydrate and promote the named file through the existing serialized
  session operation boundary. That boundary also spans the context scan; room
  mutations and another load cannot interleave with it. Do not replace a room
  during an active run. Replay current scan state after each load request so a
  missed completion message cannot leave a retained tab blocked.
- Retain the complete accepted named checkpoint as the optimistic-concurrency
  baseline. Compare the full decoded checkpoint, including metadata and provider
  archives; a summary file or matching session ID is not write authority.
- Require that baseline for named updates and recheck the destination after the
  temporary file is prepared, immediately before rename. Reject changed, missing,
  or unreadable destinations. An autosave conflict reports an error and leaves
  the named file intact; loading the room again adopts its authoritative contents.
- Attempt named updates before their rolling mirror, but preserve the live
  snapshot in current.json even when a named write fails. Report the named
  failure and retain its dirty revision for retry; do not advance the accepted
  named baseline. If both writes fail, report both failures.
- An inconclusive startup lookup restores current.json without named-write
  authority. This prevents an unrelated corrupt sibling from locking the room.
  Unassociated rooms do not scan for same-ID named files on each reveal; explicit
  Open or the next startup establishes a new association.
- A confirmed missing active named file detaches the room and preserves it in
  current.json, with a writer-visible Save-as-new notice. Delete handles an
  already-missing active file the same way. Malformed or ambiguous associated
  files remain errors, not proof that a file is absent.

## Consequences

The existing coordinator owns hydration, queues, and accepted session state; the
store owns full-file validation and optimistic replacement. No new persisted
schema, file watcher, provider calls, or host-specific imports are required.
Named precedence selects the loaded room and does not merge transcripts.
Before replacing a differing same-session local checkpoint, preserve meaningful
local content in a separate named session with a fresh ID and a `(local recovery)`
title suffix. Save the complete aggregate, temporal state and provider archives
before hydration, then notify the writer with the recovery filename after the
named room loads successfully. If preservation fails, abort replacement; startup
protects current.json and reveal retains the live room.

Recovery eligibility is separate from strict optimistic-write equality. Ignore
canonical automatic resume dividers, their turn counts and participant-cursor
movement, derived summaries, and save/activity timestamps. Preserve other
content differences, including transcript, excerpt, context and provider history.
On reveal or same-ID Open, a room unchanged from its accepted baseline needs no
copy merely because the incoming named file changed. Startup has no accepted
baseline, so other divergence is conservatively preserved. Opening a different
session keeps its existing explicit-switch behavior. The author approved this
policy with the explicit condition that resume notices alone do not count as work.

Full named checkpoint reads cost more than summary-only autosave validation.
Existing exact-read bounds remain in force. This is optimistic concurrency, not
a filesystem compare-and-swap: the filesystem port cannot atomically compare
contents and rename against an unrelated Git process. A change in that final
read/rename interval remains a platform limitation; atomic rename alone cannot
provide such a guarantee.
