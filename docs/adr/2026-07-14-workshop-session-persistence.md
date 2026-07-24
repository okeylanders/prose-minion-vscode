# ADR 2026-07-14: Workshop Session Persistence and the Session Browser

**Status:** Accepted; amended 2026-07-23 to make true cross-restart
conversation continuity (T3) the normal restore path and to reconcile the
approved Workshop design
**Date:** 2026-07-14
**Amended:** 2026-07-23
**Extends:** [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md); [ADR 2026-07-20 — Workshop Persona Interaction Modes and Expression Profiles](2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Feature investigation:** [.todo/features/feature-workshop-session-persistence](../../.todo/features/feature-workshop-session-persistence/README.md)
**Approved interaction design:** [Workshop editor tab](../design/Prose%20Minion%20-%20Assistant%20Tab.html)

## Context

The Workshop is one product session assembled from two in-memory owners:

- `WorkshopSessionService` owns the writer-visible aggregate: excerpt, context
  attachments, participants, transcript turns, todos, artifact/configuration
  records, counters, and delivery state.
- `ConversationManager` owns the retained host and guest message histories that
  make a later turn genuinely continue the earlier conversation.

A webview reload survives while the extension host remains alive. A process
restart destroys both owners. Persisting only the webview projection would be
incorrect: `getSnapshot()` windows the transcript and omits counters, cursors,
pending delivery state, and retained histories.

The original 2026-07-14 decision chose tier T2: restore the visible record but
start every persona with fresh memory. Product clarification on 2026-07-23
rejected that as the normal experience. The Workshop is a room the writer
returns to, not a transcript viewer. Reopening it must restore the conversation
and workspace as one coherent session.

The approved design also adds editable session titles and a richer browser:
search, grouping, rename, duplicate, reveal, and delete. Its “room memory not
retained” copy and slug-only filename examples reflect the superseded T2
contract. The design remains authoritative for layout and interaction; this ADR
is authoritative for persistence semantics and storage identity.

## Decision

### 1. Sessions are schema-versioned workspace JSON files

Sessions live under **`prose-minion/sessions/`** through the existing
host-agnostic `FileSystem` and `Workspace` ports. `FileSystem` gains the narrow
operations required by the approved browser (`delete` and `reveal`; reveal may
remain an adapter command rather than a core filesystem primitive if the final
message boundary is cleaner).

The store owns two kinds of files:

- `current.json` is the ordered rolling checkpoint used for crash/restart
  recovery.
- Named checkpoints use
  `YYYYMMDD-HHMMSS-<initial-title-slug>.json`.

Every snapshot has an immutable `sessionId`, editable `title`, `startedAt`,
`createdAt`, `updatedAt`, `savedAt`, and original IANA timezone. Changing a
title updates metadata; it does not change `sessionId` or the filename.
Duplicate creates a new session/checkpoint identity. This deliberately differs
from the prototype’s slug-only path preview: titles are human labels, not
storage keys.

Files remain writer-owned, inspectable, committable, or `.gitignore`-able.
Manuscript and conversation text therefore exist at rest in the workspace; they
never move to global storage.

### 2. Persistence is a coordinated two-part snapshot

One persisted session contains two typed sections committed from one
application-owned save boundary:

1. **Product aggregate.** A complete `WorkshopSessionSnapshotV1`, distinct from
   `getSnapshot()`, includes the full turn ledger; excerpt provenance and every
   monotonic counter; ordered context attachments; todos; participants;
   delivery cursors and pending committed updates; widget configuration and
   standing-directive collections when present; and historical behavior stamps
   and transition provenance.
2. **Conversation archive.** A typed `ConversationArchiveV1` contains each
   continuable persona history, keyed by a stable logical participant key such
   as `host`, `guest:<participantId>`, rather than by an ephemeral runtime
   conversation id. It includes the committed non-system messages, context
   sources, artifact counter, last activity, and other state required for the
   next successful continuation.

`ConversationManager` gains narrow typed export/import operations. Import mints
fresh runtime conversation ids and returns the logical-key-to-runtime-id map;
the session hydrator reconnects participants and validates all cursors against
the imported histories. No restored participant may retain an id that the
manager cannot resolve.

Only successfully committed conversation transactions are serializable.
In-flight runs, partial streams, uncommitted widget drafts, and half-applied
configuration changes are not durable state. Autosave occurs after the product
aggregate and retained history have both reached the same successful commit.

### 3. Leading system prompts are rebuilt, not replayed

The leading system message is intentionally excluded from the conversation
archive. It can contain old persona resources, global Writer Profile content,
global Conversation Behavior, and standing directive renderings. Replaying it
would silently freeze settings and prompt versions from the day a session was
saved.

On hydrate, the application rebuilds each leading system message from:

- the current persona resources and expression profile;
- the current validated global Conversation Behavior;
- the currently enabled global Writer Profile;
- the session-owned active standing directives, rendered from normalized
  persisted payloads; and
- the restored session/excerpt/context framing required by the current prompt
  contract.

Historical turns keep their saved effective-behavior stamps. Opening a session
never writes session values into global VS Code Settings and never serializes
raw Writer Profile fields. Derived Carry Cues/attunement are not persisted;
they are rebuilt only through future successful conversation.

### 4. T3 is normal; T2 is an explicit recovery fallback

Opening `current.json` or a named session normally restores:

- the exact editable excerpt and context workspace;
- todos, participants, artifacts, widget configs, and active standing
  directives;
- the full visible transcript; and
- continuable host and guest conversations remapped to live runtime ids.

Tool sidecars remain bounded/stateless according to their own ADRs; their
visible reports and canonical structured artifacts still round-trip.

If one or more conversation archives are malformed, incompatible, or cannot be
validated, the store must not brick the rest of the writer’s session. It
restores the product aggregate in **degraded T2 mode**, visibly marks the
affected persona histories as non-continuable, and starts fresh histories for
later turns. It logs structured diagnostics without exposing prompt contents.
T2 is recovery behavior, not the default product promise.

### 5. Time passage is trusted session context

Sessions persist temporal state rather than asking the model to infer it:

- `startedAt` and the session’s original timezone;
- `lastActivityAt`; and
- the last successfully delivered time-notice timestamp per persona
  conversation.

The transcript receives a visible session-start marker. Reopening a persisted
session adds a visible resume marker with the current local date/time and
elapsed interval. A panel/webview reload in the same live extension-host
session does not create a false resume event.

The application queues a deterministic trusted time frame for the next
persona-directed turn:

- on the first persona turn in the session;
- after a persisted session is resumed; and
- whenever at least one hour has elapsed since that persona conversation last
  received a successful time notice.

The frame states session start, current time, elapsed duration, timezone, and
reason. It explicitly forbids inferring what the writer did, thought, or felt
during the gap. It is prepended by deterministic orchestration, not stored as a
user-authored message and not produced by a background model call. Failed or
cancelled turns do not advance the delivered timestamp, so the notice retries
on the next attempt.

### 6. Autosave and explicit save share one ordered coordinator

`WorkshopSessionStore` owns paths, schema stamping, atomic/tolerant reads,
summary extraction, and file operations. It is constructed in `extension.ts`
and injected through `CoreServices`.

One application-owned autosave coordinator marks `current.json` dirty after
every successful mutation seam and serializes writes so an older write cannot
win. It snapshots the aggregate and conversation archive as one logical
revision. Future widget coordinators use the same seam and autosave only after
their complete transaction: configuration, visible marker, system-message
replacement, and telemetry invalidation.

Explicit Save creates a named checkpoint from that same coherent snapshot.
Opening a named checkpoint immediately promotes its hydrated state to
`current.json`. New Session replaces `current.json` with a fresh-room snapshot
after confirmation; stale conversation histories cannot resurrect.

### 7. The browser adopts the approved interaction set

The shared modal shell presents:

- editable title in Save;
- newest-first recent sessions;
- search across title, participant metadata, excerpt, and transcript content;
- grouping by date or excerpt identity;
- open, rename-title, duplicate, reveal-file, and delete actions; and
- clear distinction between the rolling current session and named checkpoints.

Excerpt grouping uses persisted source identity when available and a stable
excerpt fingerprint otherwise; the editable title is not the grouping key.
Opening or deleting/replacing the current session confirms when unsaved
committed changes would be displaced.

Browser summaries are tolerant and independent of full hydration. Malformed or
unknown-version files are skipped with diagnostics, never allowed to crash the
browser.

### 8. Widget configuration is session truth; Settings are defaults

Conversation Widget values may also be stored in VS Code Settings as convenient
last-used defaults. The ownership rule is:

- Settings seed **new** widget instances.
- The session snapshot owns the exact configuration of every committed
  one-shot artifact and active standing directive.
- Opening a session restores its saved configurations without mutating global
  Settings.

The persisted graph distinguishes `turnId`, `artifactId`, and
`widgetConfigId`. Clone-and-recommit mints new identities and may record
`clonedFromConfigId`; editing a standing directive preserves its config/directive
identity and increments a revision. Both the session’s thread-artifact counter
and each conversation archive’s artifact counter survive round-trip.

No generic `Record<string, unknown>` extension bag is reserved. Widget
collections are explicit typed optional fields with deterministic empty
defaults. Conversation history is never the only durable home of canonical
widget data, even though that history now also persists.

### 9. Panel restoration has no second state store

A Workshop `WebviewPanelSerializer` allows VS Code to reopen the editor tab.
The serializer stores no Workshop state; it rehydrates from `current.json`
through the normal request path. Manual reopen uses the same path.

## Consequences

**Gains**

- Restart, crash, and named-session restore return the writer to the actual
  conversation and workspace they left.
- Current prompt/profile/directive policy remains current without falsifying
  historical turns.
- Session-owned artifacts and future widgets have one typed durable graph.
- Rich browser actions operate on stable identities rather than filenames
  pretending to be domain objects.
- Corrupt conversation history degrades locally instead of destroying the
  manuscript/session record.

**Costs and risks**

- The sprint now crosses two state owners and needs an atomic application
  boundary; this is materially larger than the former T2 serializer.
- Full message histories increase file size and place conversation content at
  rest in the workspace.
- Rebuilt system prompts may differ from those used earlier. That is deliberate
  current-policy behavior and must be test-visible.
- Transcript and archive retention are unbounded in v1; later compaction must
  preserve structured artifacts and stable identities.
- Rich content search should start with a simple bounded scan and remain
  cancellable; do not build an index until workspace scale proves it necessary.

## Explicitly unchanged

- The webview persists nothing; host-side state remains authoritative.
- `WorkshopSessionService` remains a pure aggregate with no I/O.
- Core imports no `vscode`; the extension app remains the only composition
  root.
- Tool sidecars do not gain open-ended persona memory.
- Global Conversation Behavior and Writer Profile remain settings-owned.

## Implementation

[Sprint 10: Session Persistence, Save, and the Session Browser](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md),
executed after the Workshop aggregate and prompt boundary stabilize.
