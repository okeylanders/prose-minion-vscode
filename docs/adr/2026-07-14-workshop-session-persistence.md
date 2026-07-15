# ADR 2026-07-14: Workshop Session Persistence and the Session Browser

**Status:** Proposed
**Date:** 2026-07-14
**Extends:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Feature investigation:** [.todo/features/feature-workshop-session-persistence](../../.todo/features/feature-workshop-session-persistence/README.md)

## Context

The Workshop session is one in-memory aggregate (`WorkshopSessionService`) plus
provider conversation histories in `ConversationManager`'s in-memory `Map`.
Reload/reopen inside one VS Code window survives via host-side rehydration;
a process restart loses everything: the excerpt, writer-supplied context, the
transcript, the Sprint 08 todo list, and every retained conversation.

The feature investigation (2026-07-13) established the two facts that shape
this decision:

1. **The webview snapshot is a lossy projection.** `getSnapshot()` windows to
   the newest 100 turns and omits conversation ids, delivery cursors,
   `turnCounter`, and `excerptVersion`. Persisting it would silently reset
   counters and collide turn ids on hydrate. Persistence needs a **separate,
   complete serializer**.
2. **Provider conversations cannot be restored from the session.**
   `ConversationManager.continueConversation` throws
   `ConversationNotFoundError` on an unknown id. A rehydrated session holding
   yesterday's `conversationId`s would throw on the first post-restart turn.
   Conversational *memory* lives in a sibling in-memory Map that dies with the
   process.

The product ask is larger than "survive a restart": an explicit **Save
session**, a **session browser** that lists prior sessions and reopens them,
and restoration of the full room record — thread, tool reports, guest
exchanges, todos — not just the writer's inputs.

The investigation proposed a `workspaceState` Memento behind a new
`KeyValueStore` platform port. That shape fits a single autosave blob but
fights the browser: Mementos have no natural enumeration story, are invisible
to the writer, and multiple saved sessions × 10k-word excerpts is exactly the
payload Mementos are not meant for.

The sprint number remains Sprint 10, but implementation intentionally follows
Sprints 11 and 12. File-access capabilities add artifact-turn variants, and the
intake rework replaces the single brief with typed context attachments. Building
the persistence boundary last lets its first schema describe the completed
aggregate instead of requiring an immediate migration.

## Decision

### 1. Sessions persist as JSON files in the workspace, through the existing `FileSystem` port

Sessions are written to **`prose-minion/sessions/`** in the workspace root as
schema-versioned JSON, via the existing `FileSystem` platform port
(`readFile`/`writeFile`/`readDirectory`/`stat`/`createDirectory` — writeFile
already auto-creates parents). This follows the `prose-minion/reports/`
precedent and buys, for free:

- **The browser is `readDirectory`.** No blob-enumeration protocol invented on
  a key-value port.
- **Writer visibility and ownership.** Sessions are ordinary files: inspectable,
  deletable, committable or `.gitignore`-able at the writer's choice.
- **Portability.** The desktop-shell host implements `FileSystem` anyway; no
  VS Code-specific storage dependency
  ([feature-desktop-shell-adapter](../../.todo/features/feature-desktop-shell-adapter/README.md)).
- **No new platform port.** One small extension to `FileSystem` — a
  `delete(path)` method mirroring `vscode.workspace.fs.delete` — supports the
  browser's delete action. That is the entire platform surface change.

File naming: `YYYYMMDD-HHMM-<slug>.json` (memory-bank convention). The slug
derives deterministically from the excerpt's first heading or opening words.
The live autosave writes to a fixed name (`current.json`) so restart recovery
never depends on the writer having pressed Save.

**Privacy note:** manuscript text at rest in the workspace — the same posture
as the manuscript files themselves. Never global storage; nothing leaves the
workspace folder.

### 2. One serializer, two triggers: autosave and explicit save

`WorkshopSessionService` gains `serialize(): WorkshopSessionSnapshotV1` and
`static hydrate(snapshot, now)`. This snapshot is **complete** — the full turn
list (no 100-turn window), the todo list, excerpt text + `sourceUri` +
`excerptSource` + `excerptVersion` + `replacementCount` + `turnCounter`, the
ordered context attachments, all turn variants (including capability artifacts
and context event turns), and participant *identities* (host persona id, tool
sidecar ids, guest persona ids). It is a distinct type from the webview
projection and must never be built from `getSnapshot()`.

- **Autosave** writes through to `current.json` on every mutation seam —
  `setExcerpt`/`replaceExcerpt`, context attachment add/update/remove, turn
  completion, todo mutations, guest lifecycle — debounced host-side. `reset()`
  deletes the blob: no stale session resurrecting on next launch.
- **Save session** copies the current serialized state to a timestamped file
  and reports the saved name as a deterministic status line. Saved files are
  immutable records; continuing to work mutates only `current.json`.

A new infrastructure service, `WorkshopSessionStore` (core, consuming
`FileSystem` + `Workspace`), owns pathing, naming, schema stamping, listing,
and tolerant reads. It is constructed in `extension.ts`, added to
`CoreServices`, and injected into `WorkshopHandler` — nothing is `new`-ed in
the handler (ADR 2026-06-18).

### 3. Restored sessions are honest: full record, fresh memory (tier T2)

Opening a session — via restart recovery or the browser — restores:

- the excerpt (live, editable, version counters intact),
- the context attachments (live),
- the todo list (live — todos are writer-owned data, not model memory),
- the **entire transcript as read-only history**, capped with the existing
  divider-turn mechanism: *"Previous session restored — transcript preserved,
  room memory not retained."*

**Every provider conversation id is stripped at serialization.** Delivery
cursors and pending host updates — which only have meaning relative to live
provider conversations — are dropped with them. On hydrate,
`hasHostConversation()` is false, persona selection re-unlocks, tool sidecars
and guests appear only as their transcript record. The first post-restore
turn starts a fresh conversation seeded by the normal join machinery. No
restored session can ever throw `ConversationNotFoundError` — this is the
single correctness invariant of the design, enforced by type (the snapshot
schema has no field for conversation ids) rather than by discipline.

**Tier T3 (true cross-restart conversational memory) is explicitly deferred**,
unchanged from the investigation: it requires persisting `ConversationManager`
histories and answering the open product question of whether multi-day
retained rooms are even desirable. T2 is the honest interim and the schema
leaves room for it (a future `schemaVersion` bump).

### 4. Schema-versioned, tolerant-forward

Every file carries `schemaVersion`. Unknown or malformed files are skipped by
the browser listing and ignored by restart recovery — surfaced as a log line,
never a crash. `WorkshopSessionSnapshotV1` is implemented only after Sprint 12
establishes the attachment-based session shape, so there is no pre-attachment
v1 and no v1 → v2 migration. For future *named saves* (writer-created records),
prefer additive fields and cheap tolerant reads over discard when the cost is
small; the autosave blob may still reset on a breaking alpha schema change.

### 5. The session browser reuses the modal shell; the panel comes back on restart

The browser lists `prose-minion/sessions/*.json` newest-first (title, saved
date, persona, turn count, excerpt word count) with open and delete actions,
built on the shared browser-modal shell extracted by Sprint 12 (which resolves
tech-debt 2026-07-10-workshop-browser-modal-shell). Opening a session replaces
the current one behind the same confirmation used by "New session".

A `WebviewPanelSerializer` is registered for the Workshop panel (resolving
tech-debt 2026-07-07): after a restart VS Code reopens the tab, and the
provider rehydrates from `current.json` through the standard
`WORKSHOP_REQUEST_SESSION` path. The serializer stores no state of its own —
the JSON file is the single source of truth.

## Consequences

**Gains**

- A restart or crash no longer destroys writer work; re-pasting the manuscript
  and rebuilding context attachments — the sharpest papercut — is gone.
- Sessions become durable, inspectable writer artifacts with a browsing UI.
- Zero new platform ports; one method added to `FileSystem`.
- The dangling-conversation-id hazard is structurally impossible, not merely
  avoided.

**Costs / risks**

- Manuscript text at rest under `prose-minion/sessions/` — document it; the
  writer controls the folder.
- Write-through on every mutation seam is a new cross-cutting concern on an
  aggregate already near its size threshold (see tech-debt
  2026-07-12-workshop-session-capability-artifact-extraction) — the store call
  belongs in `WorkshopHandler`'s mutation paths, not inside the aggregate.
- Serialized turn lists are unbounded (tech-debt
  2026-07-11-workshop-session-turn-retention); acceptable now, and the file
  format gives a natural place to window later.
- A restored room *looks* continuous but the persona remembers nothing — the
  divider turn is the mitigation, and it must be impossible to miss.

**Explicitly unchanged**

- The webview persists nothing (`WorkshopPersistence = Record<string, never>`);
  host-side state remains the only truth.
- Tool sidecars stay stateless instruments; guests stay bounded (ADR
  2026-07-11); no persistence tier grants anyone new memory.
- `ConversationManager` is untouched — no provider-history serialization in
  this ADR.

## Implementation

Sprint 10 of the Workshop epic, intentionally executed after Sprints 11 and 12:
[.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md).
