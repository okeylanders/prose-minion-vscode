# Sprint 10: Session Persistence, Save, and the Session Browser

**Status**: Planned
**Priority**: High (live pain point — restart loses the manuscript excerpt and context)
**Branch**: `sprint/workshop-editor-tab-10-session-persistence` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Execution order**: Runs last in the epic, after Sprints 11, 11B, and 12. The
sprint number and branch name remain unchanged. Relational Depth and Writer
Profile land before this sprint so the first persisted turn schema captures the
final behavior shape and restore tests exercise the final prompt-assembly
boundary.
**Depends on**: Sprint 12, which completes the live session shape and extracts
the shared browser-modal shell. This transitively includes Sprint 11's
file-access artifact turns, Sprint 11B's context-telemetry lifecycle decisions,
and Sprint 09's guest sidecars.
**ADRs**: [2026-07-14 — Workshop Session Persistence and the Session Browser](../../../../docs/adr/2026-07-14-workshop-session-persistence.md)
**Feature**: [feature-workshop-session-persistence](../../../features/feature-workshop-session-persistence/README.md)
**Pre-persistence behavior features**: [Relational Depth](../../../features/feature-workshop-relational-depth/README.md) → [Writer Profile](../../../features/feature-workshop-writer-profile/README.md)

## Goal

A VS Code restart no longer destroys the Workshop. The live working session
always autosaves to `prose-minion/sessions/current.json` and restores whenever
Workshop reopens; an explicit **Save session** writes a
timestamped record; a **session browser** lists prior sessions and reopens
them with the full transcript, todos, excerpt, and context attachments —
honestly marked as restored history with fresh room memory.

## Locked Decisions (from the ADR)

- **JSON files in `prose-minion/sessions/`, via the existing `FileSystem`
  port** — no Memento, no new platform port. One port extension:
  `FileSystem.delete(path)`.
- **One complete serializer**, `serialize()`/`hydrate()` on
  `WorkshopSessionService` — full turn list (including file-access artifacts
  and context event turns), todos, excerpt + `excerptSource`/`sourceUri`/version
  counters, context attachments, participant identities. Never built from the
  windowed `getSnapshot()` projection.
- **Conversation ids are stripped by schema** — the snapshot type has no field
  for them. Delivery cursors and pending host updates drop with them.
- **Restore = tier T2**: excerpt/context attachments/todos live; transcript
  read-only behind a divider turn ("Previous session restored — transcript preserved, room
  memory not retained"); persona selection re-unlocked; first new turn starts
  a fresh conversation. T3 (real cross-restart memory) stays deferred.
- **Inference telemetry is never restored as live memory**: persisted snapshots
  contain neither provider conversation ids nor context-budget readings. A T2
  restore shows `Not measured yet` until a fresh provider request completes;
  archived transcript token history is not a current model-context claim.
- **Schema-versioned, tolerant-forward**: `schemaVersion` on every file;
  malformed/unknown files skipped with a log line, never a crash.
- Autosave and named saves share the serializer and differ only in filename
  and trigger.
- `current.json` is the rolling working-session checkpoint. Opening a named
  save immediately promotes that hydrated session to `current.json`; the
  writer does not need to make another edit or press Save to protect it.
- Historical persona-directed turns retain their effective behavior stamp and
  transition provenance. The active post-restore behavior comes from the
  current validated global Conversation Settings value; opening an old session
  never silently rewrites global settings.
- Derived Carry Cues/attunement state and raw Writer Profile content are not
  session data. A fresh post-restore persona conversation uses the current
  enabled global Writer Profile and starts without inferred cue memory.

## Tasks

### Platform and store

- [ ] Add `delete(path)` to the `FileSystem` port + `VsCodeFileSystem` adapter
      (mirror `workspace.fs.delete` semantics); update the port doc header.
- [ ] `WorkshopSessionStore` infrastructure service (core): resolve
      `prose-minion/sessions/` under the workspace root via `Workspace`,
      write/read/list/delete schema-stamped snapshots, deterministic
      `YYYYMMDD-HHMM-<slug>.json` naming (slug from excerpt heading or opening
      words), tolerant listing that skips unreadable files.
- [ ] Construct in `extension.ts`, add to `CoreServices`, inject into
      `WorkshopHandler` (architecture witness stays green — nothing `new`-ed
      in the handler).

### Serializer

- [ ] `WorkshopSessionSnapshotV1` type + `serialize()`/`hydrate()` on
      `WorkshopSessionService`: full turns (including capability artifacts and
      context event turns, behavior stamps, and behavior-transition
      provenance), todos, excerpt text + `excerptSource` + `sourceUri` +
      `excerptVersion`/`replacementCount`/`turnCounter`, ordered context
      attachments, host/tool/guest participant identities. No conversation
      ids, no cursors, no derived session attunement, and no Writer Profile.
- [ ] Hydrate appends the restored-session divider turn, reports
      `hasHostConversation() === false`, re-unlocks persona selection, and
      preserves counters so new turn ids and excerpt versions never collide
      with restored history.
- [ ] Hydrate receives the current validated `WorkshopConversationBehavior`
      from the composition/application boundary. Historical turns retain their
      saved stamps, but an opened session never overwrites the user's current
      global Conversation Settings value.

### Autosave and save

- [ ] Add one application-owned `markSessionDirty()` / autosave coordinator
      seam, then call it after successful `WorkshopHandler` mutation paths
      (excerpt set/replace, context attachment add/update/remove, turn
      completion, todo mutations, guest lifecycle). It owns debounce and
      write-order serialization; `reset()` checkpoints the fresh room with its
      preserved excerpt and standing context instead of resurrecting the old
      transcript. Future widget coordinators use this same seam rather than
      inventing persistence calls.
- [ ] `WORKSHOP_SAVE_SESSION` route: copy current state to a timestamped file;
      deterministic status line names the saved file. Header affordance in
      `WorkshopApp` (near New session).
- [ ] On activation/panel open with no live session: hydrate from
      `current.json` when present.

### Session browser

- [ ] Reuse the shared browser-modal shell extracted in Sprint 12; build the
      session browser on it without introducing a persistence-specific modal
      framework.
- [ ] `WORKSHOP_LIST_SESSIONS` / `WORKSHOP_SESSIONS_DATA` /
      `WORKSHOP_OPEN_SESSION` / `WORKSHOP_DELETE_SESSION` messages; listing
      shows title, saved date, persona, turn count, excerpt word count,
      newest first.
- [ ] Opening a session replaces the current one behind the same confirmation
      as "New session" and immediately writes the opened state to
      `current.json`; delete confirms and removes the named file.

### Future widget compatibility

- [ ] Keep the persisted aggregate additive through explicit, typed optional
      fields with empty/default hydration. Do not add a generic
      `extensions: Record<string, unknown>` bag and do not speculate the final
      widget payload before the Conversation Widgets ADR is accepted.
- [ ] Preserve stable turn, thread-artifact, and config ids byte-for-byte across
      serialize/hydrate. Future re-openable widget chips depend on those ids.
- [ ] Keep browser summary extraction independent of full session payload
      hydration so later typed widget collections do not break session listing.
- [ ] Document the future extension rule: widget authoring configs and standing
      directives are aggregate-owned session state and must join the complete
      serializer; provider-only `ConversationManager` history cannot be their
      sole durable source of truth.

### Panel serializer

- [ ] Register a Workshop `WebviewPanelSerializer` (resolves tech-debt
      2026-07-07): restart reopens the tab and rehydrates via the standard
      `WORKSHOP_REQUEST_SESSION` path from `current.json`. The serializer
      itself stores nothing. *(Separable if the sprint runs long — manual
      reopen still restores.)*

### Restore polish and verification

- [ ] Extension Development Host pass: divider prominence, restored context
      attachment and capability-artifact rendering, disabled direct-tool/live
      action chips, re-unlocked persona picker, first fresh turn, automatic tab
      reopen, and manual-reopen fallback. Record the results in the feature
      README or sprint completion notes.

### Tests

- [ ] serialize → hydrate round-trip fidelity: turns, todos, counters,
      excerpt provenance, context attachments, capability artifacts, and
      context event turns, including behavior stamps/transitions; snapshot type
      rejects conversation ids, Writer Profile, and derived attunement by shape.
- [ ] Hydrated session: divider present, persona unlocked, no
      `ConversationNotFoundError` reachable on first turn; new turn ids don't
      collide with restored ones.
- [ ] Restored artifact turns are inert: no direct-tool or other live action
      depending on a dead provider conversation remains enabled.
- [ ] Store: schema-mismatch skip, malformed-file skip, reset-deletes-blob,
      naming determinism, list ordering.
- [ ] Handler routes: save/list/open/delete registration + validation;
      open-session confirmation flow.
- [ ] Additive compatibility: absent future collections hydrate to empty;
      browser summaries ignore additional typed payload fields; stable ids do
      not change on round-trip.
- [ ] Restore prompt boundary: the first fresh host/guest conversation uses the
      current global Relational Depth and enabled Writer Profile without writing
      raw profile content or inferred Carry Cues state into the session file.

## Acceptance Criteria

- Quit VS Code mid-session; relaunch: the Workshop tab returns (or reopens
  manually) with excerpt, context attachments, todos, and full transcript
  restored, the divider visible, and the persona picker unlocked. The first
  new message starts cleanly.
- No explicit Save is required for restart recovery: every successfully
  committed live mutation reaches the rolling `current.json` checkpoint through
  the shared ordered autosave seam.
- Save session → visible file in `prose-minion/sessions/`; browser lists it;
  opening it from a *different* session restores it behind a confirmation.
- Deleting a session removes the file; malformed JSON in the folder never
  breaks the listing.
- `reset()` replaces `current.json` with the fresh-room state: preserved
  excerpt and standing context, but no prior transcript or retained model
  conversations.
- Core still imports no `vscode`; architecture and assembly tests green; lint,
  typecheck, full tests, build, bundle verification pass. Record bundle deltas.

## Guardrails

- Never serialize from `getSnapshot()` — the windowed projection resets
  counters and drops provenance (the feature README's "windowed-snapshot trap").
- No conversation id, cursor, or pending-update field may enter the snapshot
  schema, even optionally "for later" — T3 gets its own schema version when
  it earns an ADR.
- Store calls live in the handler's mutation paths, not inside the aggregate —
  `WorkshopSessionService` stays a pure aggregate (no I/O), and it is already
  near the size threshold (tech-debt 2026-07-12).
- `WorkshopSessionSnapshotV1` is the first shipped persisted schema and includes
  Sprint 12's attachment model from the start. Do not build a pre-attachment
  v1 or a v1 → v2 migration for a format that never shipped.
- Prefer additive, typed optional fields with deterministic defaults for future
  session-owned widget state. Do not reserve an untyped extension bag.
- A Decisions or other structured widget artifact cannot live durably only in
  provider conversation history because T2 intentionally does not serialize
  `ConversationManager`. Its canonical structured payload must be reachable
  from the extension-owned session turn/config graph without creating a second
  mutable shadow log.
- Restored transcript turns are read-only record; no restored artifact may
  re-offer live actions that depend on a dead conversation (e.g. "Talk
  directly to <Tool>" chips must render disabled/absent for restored sidecars).
- Do not prompt for a session title in v1 — deterministic naming; renaming is
  a file operation the writer already owns.
