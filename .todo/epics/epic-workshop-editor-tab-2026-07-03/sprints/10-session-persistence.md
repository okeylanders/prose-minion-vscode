# Sprint 10: Session Persistence, Save, and the Session Browser

**Status**: Planned
**Priority**: High (live pain point — restart loses the manuscript excerpt and context)
**Branch**: `sprint/workshop-editor-tab-10-session-persistence` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 4-6 days
**Execution order**: Runs last in the epic, after Sprints 11 and 12. The sprint
number and branch name remain unchanged.
**Depends on**: Sprint 12, which completes the live session shape and extracts
the shared browser-modal shell. This transitively includes Sprint 11's
file-access artifact turns and Sprint 09's guest sidecars.
**ADRs**: [2026-07-14 — Workshop Session Persistence and the Session Browser](../../../../docs/adr/2026-07-14-workshop-session-persistence.md)
**Feature**: [feature-workshop-session-persistence](../../../features/feature-workshop-session-persistence/README.md)

## Goal

A VS Code restart no longer destroys the Workshop. The live session autosaves
to `prose-minion/sessions/current.json`; an explicit **Save session** writes a
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
- **Schema-versioned, tolerant-forward**: `schemaVersion` on every file;
  malformed/unknown files skipped with a log line, never a crash.
- Autosave and named saves share the serializer and differ only in filename
  and trigger.

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
      context event turns), todos, excerpt text + `excerptSource` + `sourceUri`
      + `excerptVersion`/`replacementCount`/`turnCounter`, ordered context
      attachments, host/tool/guest participant identities. No conversation
      ids, no cursors.
- [ ] Hydrate appends the restored-session divider turn, reports
      `hasHostConversation() === false`, re-unlocks persona selection, and
      preserves counters so new turn ids and excerpt versions never collide
      with restored history.

### Autosave and save

- [ ] Write-through from `WorkshopHandler` mutation paths (excerpt set/replace,
      context attachment add/update/remove, turn completion, todo mutations,
      guest lifecycle), debounced; `reset()` deletes `current.json`.
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
      as "New session"; delete confirms and removes the file.

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
      context event turns; snapshot type rejects conversation ids by shape.
- [ ] Hydrated session: divider present, persona unlocked, no
      `ConversationNotFoundError` reachable on first turn; new turn ids don't
      collide with restored ones.
- [ ] Restored artifact turns are inert: no direct-tool or other live action
      depending on a dead provider conversation remains enabled.
- [ ] Store: schema-mismatch skip, malformed-file skip, reset-deletes-blob,
      naming determinism, list ordering.
- [ ] Handler routes: save/list/open/delete registration + validation;
      open-session confirmation flow.

## Acceptance Criteria

- Quit VS Code mid-session; relaunch: the Workshop tab returns (or reopens
  manually) with excerpt, context attachments, todos, and full transcript
  restored, the divider visible, and the persona picker unlocked. The first
  new message starts cleanly.
- Save session → visible file in `prose-minion/sessions/`; browser lists it;
  opening it from a *different* session restores it behind a confirmation.
- Deleting a session removes the file; malformed JSON in the folder never
  breaks the listing.
- `reset()` leaves no `current.json`; a fresh window starts genuinely fresh.
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
- Restored transcript turns are read-only record; no restored artifact may
  re-offer live actions that depend on a dead conversation (e.g. "Talk
  directly to <Tool>" chips must render disabled/absent for restored sidecars).
- Do not prompt for a session title in v1 — deterministic naming; renaming is
  a file operation the writer already owns.
