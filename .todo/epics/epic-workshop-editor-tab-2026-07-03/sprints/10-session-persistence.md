# Sprint 10: Seamless Session Persistence, Save, and Browser

**Status**: Implemented 2026-07-23 — automated verification complete; manual
Extension Development Host continuity pass and PR review remain
**Priority**: High (restart currently destroys the Workshop)
**Branch**: `sprint/workshop-editor-tab-10-session-persistence` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 8-12 days
**Execution order**: Runs last in the epic after Sprints 11, 11B, 12,
Relational Depth, and Writer Profile, so the first persisted schema captures the
final aggregate and prompt boundary.
**Depends on**: Sprint 12 and its shared browser-modal shell; transitively
includes file-access artifact turns, context telemetry, and guest sidecars.
**ADRs**: [2026-07-14 — Workshop Session Persistence and the Session Browser](../../../../docs/adr/2026-07-14-workshop-session-persistence.md)
**Design**: [Workshop editor tab](../../../../docs/design/Prose%20Minion%20-%20Assistant%20Tab.html)
**Feature**: [feature-workshop-session-persistence](../../../features/feature-workshop-session-persistence/README.md)

## Goal

Reopening Workshop after a restart or from the session browser returns the
writer to the conversation and workspace they left: excerpt, context,
participants, todos, artifacts, widget state, transcript, and genuinely
continuable persona histories. The design’s editable titles and full browser
actions ship with this persistence boundary. T2 transcript-only restoration is
a corruption/incompatibility fallback, not the normal experience.

## Locked Decisions

- Workspace JSON under `prose-minion/sessions/`; `current.json` is ordered
  autosave, named files are collision-safe checkpoints.
- Editable `title` is metadata. Immutable `sessionId` and filename are storage
  identity; rename does not move the file, duplicate creates a new identity.
- Persistence is a coherent product snapshot plus a typed
  `ConversationArchiveV1`; never serialize from windowed `getSnapshot()`.
- Conversation archives use stable logical participant keys. Import mints fresh
  runtime ids and reconnects the session participant graph.
- Leading system messages are excluded and rebuilt from current persona
  resources, current global behavior/profile, and session-owned standing
  directives.
- Only successful committed transactions persist. In-flight streams, partial
  tool/widget commits, and uncommitted modal drafts do not.
- T3 is the normal restore. Invalid conversation history degrades visibly to T2
  while preserving the product session.
- Time-awareness frames are deterministic, per persona conversation, queued on
  first turn/resume/one-hour threshold, and marked delivered only after success.
- Settings seed new widgets; the session owns exact committed one-shot and
  standing configurations. Opening a session never rewrites Settings.
- Browser scope follows the approved design: save title, search, date/excerpt
  grouping, open, rename title, duplicate, reveal, and delete.

## Tasks

### 1. Schema, ports, and store

- [x] Define `WorkshopPersistedSessionV1` with identity/timestamps/timezone,
      summary metadata, complete `WorkshopSessionSnapshotV1`, and
      `ConversationArchiveV1`.
- [x] Inventory every aggregate field and monotonic counter, including excerpt
      source/fingerprint/version/replacement count, full turns, todos,
      attachments and pending committed delivery state, participants/cursors,
      `turnCounter`, `todoCounter`, `attachmentCounter`,
      `threadArtifactCounter`, and widget collections when present.
- [x] Extend the host boundary for delete and reveal-file without importing
      `vscode` into core. Construct `WorkshopSessionStore` in `extension.ts` and
      inject it through `CoreServices`.
- [x] Implement atomic/ordered `current.json` writes, collision-safe
      `YYYYMMDD-HHMMSS-<initial-slug>.json` saves, tolerant reads, summary-only
      listing, title updates, duplicate, delete, and reveal routing.
- [x] Define no-workspace and multi-root behavior explicitly; never guess which
      manuscript workspace owns a session.

### 2. Product aggregate serialization

- [x] Add complete serialize/hydrate operations separate from
      `getSnapshot()`. Round-trip every turn variant, artifact payload,
      provenance stamp, participant, cursor, counter, todo, excerpt field, and
      ordered attachment.
- [x] Persist session start/activity/time-notice state and add trusted visible
      `session_start` / `session_resume` marker variants without pretending a
      same-process webview reload is a resume.
- [x] Keep global Conversation Behavior and Writer Profile outside the session;
      preserve historical behavior stamps and exclude derived Carry Cues.
- [x] Reconcile pending message attachments and delivery cursors so committed
      work survives and in-flight work cannot reappear as half a transaction.

### 3. Conversation archive and prompt rebuild

- [x] Add typed `ConversationManager.exportConversations()` /
      `importConversations()` seams for committed non-system messages, logical
      participant key, context sources, last activity, and
      `nextArtifactNumber`.
- [x] On import, mint runtime ids, validate message/cursor shape, return the
      logical-key map, and reconnect host/guest participants atomically.
- [x] Rebuild each leading system message from current persona resources,
      current validated global behavior/profile, restored session context, and
      normalized active standing directives. Never deserialize the old leading
      system message.
- [x] Make a single malformed conversation degrade only the affected
      participant to a visible fresh-memory fallback; never throw
      `ConversationNotFoundError` from a successful hydrate.
- [x] Persist context-source state needed by the restored conversation but mark
      derived context-budget telemetry unmeasured/stale until the next
      successful provider response.

### 4. Trusted time awareness

- [x] Add a deterministic time-frame builder with session start, current time,
      timezone, elapsed interval, reason, and the explicit “do not infer the
      writer’s gap” constraint.
- [x] Queue it for the first persona turn, after disk hydrate/open, and when
      that persona’s last successful notice is at least one hour old.
- [x] Advance the per-conversation notice timestamp only after a successful
      persona turn; cancellation/failure retries next turn. No background timer
      or tool-sidecar model call.

### 5. Autosave and lifecycle

- [x] Build one application-owned dirty/autosave coordinator spanning aggregate
      and conversation history. Serialize writes; flush safely on lifecycle
      boundaries; prevent an older write from winning.
- [x] Mark dirty after every successful mutation: excerpt/context/todo/guest
      changes, completed persona/tool turns, behavior/directive replacement,
      and complete widget transactions.
- [x] Decide active-run behavior for Save/Open/Rename/Duplicate/New. Prefer
      disabling state-replacing actions while a run is active rather than
      snapshotting ambiguous partial work.
- [x] Hydrate `current.json` on activation/panel open and immediately promote an
      opened named checkpoint to `current.json`.
- [x] Register `WebviewPanelSerializer`; it stores no duplicate state.

### 6. Save and browser UI

- [x] Implement Save dialog title input, filename/identity explanation, and the
      “included in this snapshot” manifest from the approved design.
- [x] Add typed routes for list/save/open/rename/duplicate/reveal/delete and
      explicit success/failure responses.
- [x] Build newest-first Recent and browser views with cancellable bounded
      search across title/participants/excerpt/transcript and grouping by date
      or stable excerpt identity.
- [x] Distinguish current from named checkpoints. Confirm state replacement and
      delete; protect `current.json` from named-session actions.
- [x] Replace prototype T2 copy in implementation with seamless-restore
      language; show the memory-not-retained warning only for degraded recovery.

### 7. Conversation Widget seam

Deferred intentionally to
[`epic-conversation-widgets-2026-07-22`](../../epic-conversation-widgets-2026-07-22/epic-conversation-widgets-2026-07-22.md).
That epic's typed widget/config/directive entities do not exist yet. Sprint 10
delivers the exact aggregate parser, stable artifact counters, logical archive
keys, summary sidecars, and one ordered post-commit autosave seam they will
extend; it does not invent an untyped placeholder blob.

- [ ] Persist exact normalized widget configs and active standing directives as
      typed session-owned collections even when Settings hold last-used
      defaults.
- [ ] Preserve distinct `turnId`, `artifactId`, and `widgetConfigId`.
      Clone/recommit creates new ids plus optional `clonedFromConfigId`;
      standing edits retain identity and increment revision.
- [ ] Preserve both session `ta-N` and ConversationManager `art-N` counters.
      Reconstruct standing system frames from normalized config on restore.
- [ ] Autosave only after config + marker + system replacement + telemetry
      invalidation commit together. Browser summaries ignore additive widget
      fields.

### 8. Verification

- [x] Unit: product and conversation round trips, every counter, logical-id
      remapping, prompt rebuild/exclusion, per-participant degradation, schema
      mismatch, malformed file, ordering, collision resistance, and title
      metadata rename.
- [x] Unit: time frame first/resume/hour boundary/timezone, successful delivery,
      cancellation retry, and no false same-process resume.
- [x] Unit: current global behavior/profile applied without writing raw profile
      content; historical behavior stamps preserved.
- [ ] Unit: widget config/directive round trip, identity/revision rules, and no
      half-transaction autosave.
- [x] Integration: save/list/search/group/open/rename/duplicate/reveal/delete,
      active-run guards, `current.json` promotion, panel serializer, multi-root
      handling, and T2 recovery UI.
- [ ] Extension Development Host: quit mid-room, relaunch, continue host and
      guest conversations, verify time notice and restored workspace, then
      corrupt one archived history and verify graceful degraded recovery.
- [x] Run architecture, typecheck, lint, full tests, build, and bundle checks;
      record bundle deltas.

## Implementation Notes

- Exact full snapshots are authoritative and unbounded for restore/actions.
  Strict, bounded `current.summary.json` / `<checkpoint>.summary.json` sidecars
  keep very large valid sessions discoverable without parsing their transcript
  merely to open the browser. Content search remains bounded and discloses when
  deep transcript matches may be omitted.
- The coordinator pins the workspace root accepted at activation. A
  single-root → multi-root → different-single-root transition fails closed
  rather than retargeting a live room's autosave.
- An unreadable `current.json` is protected from rolling overwrite. The writer
  may save a named rescue checkpoint; replacing the current room remains an
  explicit action.
- Activation awaits current-session hydrate before registering Workshop UI.
  Deactivation first aborts/abandons the active Workshop run, then flushes the
  now-coherent aggregate.
- The latest live tool-sidecar conversation archive round-trips along with host
  and guests so direct-tool follow-up remains continuable. Existing rerun
  replacement/stateless-tool semantics remain unchanged.

## Verification (2026-07-23)

- `npm run typecheck` — core, webview, and extension passed.
- `npm test -- --runInBand` — 120 suites, 1,170 tests, 1 snapshot passed.
- `npm run lint` — 0 errors, 763 pre-existing warnings.
- `npm run build` — production webpack builds and bundle sentinel verification
  passed; existing webview size warnings remain.
- `npm run package` — VSIX packaging passed (176 files, 9.77 MB).
- Final production bundles: `extension.js` 2,547,503 bytes;
  `webview.js` 859,326 bytes. A clean Sprint-10-only delta is not available
  because the branch began after the design/integration sync; absolute sizes
  are recorded instead.
- Manual Extension Development Host restart/corruption exercise remains open.

## Acceptance Criteria

- Quit VS Code after successful turns; relaunch; the Workshop returns with the
  exact workspace and both host/guest conversations continue with retained
  memory under fresh runtime ids.
- The first resumed persona turn receives a trusted passage-of-time frame.
  Another is sent only after that conversation crosses one hour since its last
  successful notice.
- A bad conversation archive cannot destroy the excerpt/transcript/todos. The
  affected participant visibly falls back to fresh memory and remains usable.
- No explicit Save is required for recovery. Named Save accepts a title and the
  browser can search, group, open, rename, duplicate, reveal, and delete it.
- Opening an old session restores its widget settings and standing directives
  exactly without changing the user’s global last-used defaults.
- Current global persona resources, behavior, and Writer Profile are used for
  the next turn; old leading system prompts and raw profile values are absent
  from disk.
- Core imports no `vscode`; composition-root and architecture witnesses remain
  green.

## Guardrails

- Never serialize from `getSnapshot()` and never persist an unresolved runtime
  conversation id as durable identity.
- Never persist the leading system message or raw Writer Profile.
- Never treat transcript visibility as conversational continuity; either the
  archive validates or the participant is explicitly degraded.
- Never autosave an in-flight run or half a widget/behavior transaction.
- Keep `WorkshopSessionService` pure; persistence and coordination remain
  application/infrastructure concerns.
- No untyped extension bag and no second mutable widget/artifact log.
- Do not make filenames the user-facing identity. Title edits cannot invalidate
  recents, open handles, or references.
- Do not build a background time-notice timer. Time enters only at a
  persona-turn boundary.
