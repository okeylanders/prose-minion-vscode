# Workshop named checkpoint authority

Status: Accepted

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
  session operation boundary. Do not replace a room during an active run.
- Retain the complete accepted named checkpoint as the optimistic-concurrency
  baseline. Compare the full decoded checkpoint, including metadata and provider
  archives; a summary file or matching session ID is not write authority.
- Require that baseline for named updates and recheck the destination after the
  temporary file is prepared, immediately before rename. Reject changed, missing,
  or unreadable destinations. An autosave conflict reports an error and leaves
  the named file intact; loading the room again adopts its authoritative contents.
- Commit named updates before their rolling mirror. A failed rolling write can
  be recovered from the named file on the next load. A failed named write must
  not advance the accepted baseline.

## Consequences

The existing coordinator owns hydration, queues, and accepted session state; the
store owns full-file validation and optimistic replacement. No new persisted
schema, file watcher, provider calls, or host-specific imports are required.
Named precedence deliberately replaces divergent rolling state on room loading,
as requested; this is not automatic transcript merging.

Full named checkpoint reads cost more than summary-only autosave validation.
Existing exact-read bounds remain in force. This is optimistic concurrency, not
a filesystem compare-and-swap: the filesystem port cannot atomically compare
contents and rename against an unrelated Git process. A change in that final
read/rename interval remains a platform limitation; atomic rename alone cannot
provide such a guarantee.
