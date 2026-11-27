# ADR 2026-11-19: Workshop Persona Tools: Closing To-dos, a File's Git History, and the Project's Context Paths

**Status:** Proposed (Slice 0). Revised 2026-11-19 after PR #286's review (D6a, D8a, D13a, D22a), again after its re-review (D6b, D6c, D8b), after the second re-review (D6d), and after the third (D6e); see "Amendments after review". T1, G1–G3 and L1–L3 are Okey's. Every other default was taken by the orchestrator from the brief, or refined where the code showed the brief was wrong; the epic README's "Defaults taken" table lists each, with why. None of those is an owner decision, and each is Okey's to overturn.
**Date:** 2026-11-19
**Epic:** [Workshop Persona Tools](../../.todo/epics/epic-workshop-persona-tools-2026-11-19/README.md)
(its "Defaults taken" table is binding here)
**Ideas as filed:**
[Personas Close To-dos, Here and in Saved Sessions](../../.todo/features/feature-workshop-recall-todo-closeout/README.md) (item A, Okey's #30),
[Personas Read a File's Git History](../../.todo/features/feature-workshop-file-git-history/README.md) (item B, #28),
[Set Up the Project's Context Paths](../../.todo/features/feature-helper-project-locations/README.md) (item C, #26)
**Amends:**
- [ADR 2026-11-05: A Helper Agent for Small Tasks](2026-11-05-helper-agent.md)
  **D6** (`project-locations`). Item C builds it, with a second way in (a
  persona), a button instead of an unstated start, a scan that sends
  folders rather than every name, one checker shared with the persona path,
  and a write that refuses a group the workspace overrides. Decisions
  D20–D27 below. That ADR's text is not edited; this ADR is the amendment.
**Extends:**
- [ADR 2026-11-17: Everyday Conveniences, Round Two](2026-11-17-everyday-conveniences-round-two.md)
  D13–D15 (trailer outcomes: two new kinds), D16 (what a new capability
  operation joins) and D10 (`<page>`, for `locations.folders`).
- [ADR 2026-11-14: Everyday Conveniences](2026-11-14-everyday-conveniences.md)
  D1, D2 and D2a: the shared window fit, and "every hint makes progress"
  (`history.diff`).
- [ADR 2026-10-05: Session Recall](2026-10-05-workshop-session-transcript-recall.md):
  recall stays read-only. Item A writes through a port of its own.
- [ADR 2026-09-30: Rewind and Branch](2026-09-30-workshop-rewind-and-branch.md):
  the named-session compare-and-swap, which item A writes through.
- [ADR 2026-11-05: Persona File Edits](2026-11-05-workshop-persona-file-edits.md):
  a persona proposes and the writer applies (item C's card); Apply is a
  host action keyed by a stored proposal.
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md):
  every session field here is optional and additive, with no
  `schemaVersion` bump.
- [ADR 2026-11-18: Workshop Context Breakdown](2026-11-18-workshop-context-breakdown.md):
  every new frame is tallied where it is placed.

Paths below that start `core/` are under `packages/core/src/`; `app/` is
`apps/vscode-extension/`.

## Context

**A, as the code stands:**
- To-dos are `WorkshopTodoItem`s (`core/shared/types/messages/workshop/session.ts`),
  status `open`, `completed` or `dismissed`. The open room changes one only
  through `WorkshopSessionService.setTodoStatus` → `WorkshopTodoLedger.setStatus`,
  from the writer's actions in `WorkshopTodoHandler`.
- `buildWorkshopTodoEvidence` (`WorkshopPromptBuilder.ts`) writes
  `<workshop-todo-snapshot>`: the host's open, current-excerpt to-dos, at
  most `PROMPT_BUDGETS.workshopTodos.items` (12) within 12,000 characters.
  No block shows an id. The frame ends "only explicit writer UI actions
  change task state." It is built for the host only; a guest's plan passes
  `buildTodoEvidence: () => undefined`. It is tallied as `todos.snapshot`.
- `transcript.todos` lists saved sessions' to-dos, each "id … in session …"
  (`WorkshopRecallTodoList.ts`). The live room is never in recall's corpus
  (`WorkshopRecallCorpusSelection.ts`); naming its id is `unknown-session`
  with `liveSession: true`.
- **Recall's document cache is keyed by `updatedAt`**
  (`WorkshopRecallDocumentCache.get(sessionId, updatedAt, source)`). A file
  rewritten with the same `updatedAt` would be served stale.
- **Every named-session write already compares and swaps.**
  `WorkshopSessionStore.updateNamed(sessionId, session, expected)` reads the
  file, refuses unless it equals `expected` (`hasSameWorkshopCheckpoint`,
  a deep equality of the decoded checkpoint), stages the new file, and
  checks again in its own `beforeCommit`, immediately before the rename. A
  mismatch is `WorkshopNamedSessionChangedError` ("The saved Workshop
  session changed on disk. Reopen the session to load the saved version
  before saving again.").
- **The coordinator's every named save passes its accepted checkpoint as
  `expected`.** `WorkshopSessionPersistenceCoordinator` holds
  `acceptedNamedCheckpoint`: what the room last read or wrote. Autosave,
  Save, rename of the open room, a Rewind's commit and a file edit's
  checkpoint all reach `updateNamed` with it (`writeNamedWithRollingRecovery`,
  `requireAcceptedNamedCheckpoint`). On a refusal it writes the room to
  `current.json` instead, never the named file, and reports the save as an
  error. When the webview loads, `refreshNamedSession` compares the named
  file with the accepted checkpoint; if they differ it promotes the file and
  keeps any differing local work as a new session, "… (local recovery)"
  (`preserveDisplacedLocalSession`).
- `WorkshopSessionStore.renameNamed` is the precedent for changing a saved
  session that is not the open room: read, change, `updateNamed(id,
  changed, read)`, with `updatedAt` moved to now. It refuses a file that
  needs recovery (`assertNamedSessionNeedsNoRecoveryBeforeMutation`). The
  coordinator's `renameNamed` sends the open room's own id to
  `updateActiveNamedSession` instead.
- `rewindWorkshopSession` drops to-dos whose source turn is cut. It never
  changes a kept to-do's status.
- A memory card saved by "Save and tell me" commits with the reply in
  state `saving`, and its file write runs after the commit
  (`memoryAutoSave`, `WorkshopRunCompletion.ts`). It is the precedent for a
  reply's write that cannot sit inside the room's synchronous commit.

**B, as the code stands:**
- Nothing touches git. `diff` is not installed, directly or transitively;
  the only diff code in `node_modules` is Jest's `diff-sequences`, a dev
  dependency. Core's runtime dependencies are `dompurify`, `marked`,
  `p-limit`, `react`, `react-dom`, `saxes` and `wink-pos-tagger`
  (`packages/core/package.json`).
- `app/package.json` declares no `capabilities` block. VS Code reads a
  missing `capabilities.untrustedWorkspaces` as `{ supported: false }`: the
  extension is not activated in Restricted Mode. It declares no
  `extensionDependencies`. The engine floor is `^1.82.0`.
- No Git extension typings (`git.d.ts`) are in the repository.
- The pieces to build on exist: `workshopExcerptFileEditDocument`
  (the excerpt's file, authorized as Re-read from file authorizes it),
  `findConfiguredResource` (`WorkshopConfiguredResourceLookup.ts`),
  `fitWorkshopReadToWindow` and `workshopReadEvidenceTokens`
  (`reads/WorkshopReadWindowFit.ts`), `splitBlankLineParagraphs`
  (`core/utils/blankLineParagraphs.ts`), and `CONTEXT_SOURCE_KINDS`
  (`core/shared/types/messages/inferenceContext.ts`).

**C, as the code stands:**
- `ContextResourceResolver` (`core/infrastructure/context/`) reads each
  group's patterns **from settings only** (`getPatternsForGroup`, a
  comma-split of `proseMinion.contextPaths.<group>`), normalizes each
  (`normalizePattern`: strips `./`, **every leading `/` and a `workspace:`
  prefix**, and makes a bare name `**/name`), and runs
  `Workspace.findFiles` per root and pattern with a fixed exclude
  (`node_modules`, `.git`, `.svn`, `.hg`, `dist`, `out`). Only `.md` and
  `.txt` files count; symbolic links and escapes are refused.
- Its catalog (`collectResources`) keeps a file in its first group only.
  `listCandidates` does not; it reports every group's matches.
- Its `browse` mode logs a failed pattern by text. `browse-counts` and
  `authoritative` log counts only.
- `SettingsStore` (`core/platform/SettingsStore.ts`) has `get` and
  `update`; `update` writes `ConfigurationTarget.Global`
  (`VsCodeSettingsStore`). It cannot say where a value comes from.
- **The context-path settings declare no `scope`,** so they are `window`
  scope: a workspace's `.vscode/settings.json` overrides a user-level value.
- The helper has one task, `memory-draft` (`HELPER_TASK_POLICIES`,
  `core/infrastructure/api/services/helper/`), with its bounds in
  `PROMPT_BUDGETS.helper['memory-draft']` and its prompt section in
  `resources/system-prompts/helper/10-memory-draft.md`.
- `ConfigurationHandler.ts` (627 lines) and `SettingsOverlay.tsx` (739)
  are past 500 lines.

**The shared seams:**
- `extractWorkshopReplyControls` (`core/utils/workshopReplyControls.ts`,
  381 lines) reads every trailer in one pass (`TRAILER_TAGS`).
- Trailer outcomes: `WorkshopTrailerOutcomes`
  (`core/shared/types/workshopTrailerOutcomes.ts`: `memory`, `fileEdits`),
  `workshopTrailerDropReason` (`trailerOutcomes/WorkshopTrailerDropReasons.ts`,
  a `never` default), `buildWorkshopTrailerOutcomes`
  (`WorkshopTrailerOutcomesRecord.ts`), the frame
  (`WorkshopTrailerOutcomesFrame.ts`) and its words
  (`core/shared/constants/workshopTrailerOutcomeWords.ts`), tallied as
  `room.trailer-outcomes`.
- The grammar: `WORKSHOP_CAPABILITY_OPERATIONS` (18 operations, seven
  families, `core/shared/types/workshopCapabilities.ts`),
  `workshopCapabilityFamily`, `WORKSHOP_CAPABILITY_FIELD_POLICY`
  (`WorkshopCapabilityXmlCodec.ts`), `WORKSHOP_NATIVE_CALL_FIELDS`
  (`WorkshopNativeToolCallTranslator.ts`), `PUBLISHABLE_CAPABILITY_OPERATIONS`
  (`WorkshopRoomAudience.ts`), `workshopCapabilityPage`
  (`WorkshopCapabilityPaging.ts`).
- `WORKSHOP_TOOL_USE_PROMPT_PATHS` (`WorkshopPersonaSystemPrompt.ts`) and
  `WORKSHOP_CONTEXT_TALLY_PIECES` (`WorkshopContextTally.ts`). A read's
  manifest rows are counted under the `requested` part by kind
  (`READ_IN_NAMES`, `WorkshopContextBreakdown.ts`).

## Where the code differs from the notes and the brief

Checked before deciding; each is settled below.

1. **The saving side compares the file, but not atomically** (A, default
   4; PR #286 F-01). Every named write is `updateNamed` against the room's
   accepted checkpoint, checked twice. But the second check is an awaited
   `beforeCommit` followed by a separate `rename(…, { overwrite: true })`
   (`WorkshopSessionStore.ts`, `updateNamed` and `writeJsonAtomically`).
   Two windows can both pass the check before either renames; the later
   rename wins, with no error and no rolling recovery. A stale save *after*
   a completed write is refused; overlapping writes are not. D6a makes
   every named-session writer claim the file first.
2. **Recall's cache sees a change only when `updatedAt` moves** (A). The
   write moves it, as `renameNamed` does (D6).
3. **The live room is never a "saved session"** (A). Its own id names the
   open room (D2).
4. **The snapshot is the host's, open and current-excerpt only, 12 at
   most** (A). A guest sees no open-room id; an omitted to-do has none
   shown. Neither changes here (D4).
5. **A saved session's write cannot sit inside the reply's commit** (A,
   T1). It is file I/O. The open room's change does land in the commit; a
   saved session's row commits as `saving` and is written just after, as a
   memory card's auto-save is (D5).
6. **The Git extension's typings are not in the repository** (B). D12
   states exactly what is relied on, and avoids what the 1.82 floor may
   lack (`LogOptions.skip`). The port therefore takes a count, not a page;
   core pages (D11).
7. **"Git's text conversions never run" is too strong** (B). Core computes
   the diff, so diff drivers and external diff tools never run. But the Git
   extension's `show` reads a blob through `git show`, which may apply a
   textconv the repository configures. Workspace trust is the boundary that
   covers it (D16).
8. **The resolver cannot check patterns it was not configured with** (C). It
   needs a seam that takes patterns as an argument (D22).
9. **The resolver strips a leading `/` and `workspace:` silently** (C). The
   checker refuses unsafe patterns before any normalization (D22).
10. **A comma splits the setting** (C). A pattern holding `,` (a brace set
    such as `{Cast,People}/**`) cannot be stored. The checker refuses it.
11. **A user-level write does nothing where the workspace sets the group**
    (C, L1). The settings are window-scoped. Apply would report success and
    change nothing here, while changing every other project. The port gains
    a read of where a value comes from, and such a group is shown and not
    offered (D25).
12. **The catalog hides a file's second group** (C). Overlap is counted from
    per-group matches, never the catalog (D22).
13. **No new context-tally piece is needed.** The to-do ids ride
    `todos.snapshot`; the two new outcome kinds ride the one
    `<workshop-trailer-outcomes>` frame, `room.trailer-outcomes`. A history
    diff's manifest row is counted under `requested` once `READ_IN_NAMES`
    names its kind (D15).
14. **Files past 500 lines:** `WorkshopPersonaCapability.ts` (1,078),
    `WorkshopSessionStateV1Shape.ts` (1,122), `WorkshopSessionService.ts`,
    `WorkshopSessionPersistenceCoordinator.ts` (1,887),
    `WorkshopSessionStore.ts` (1,181), `ConfigurationHandler.ts`,
    `SettingsOverlay.tsx` and `promptBudgets.ts` (1,060). Each feature
    brings its own modules; those files gain only the call into them.
    `promptBudgets.ts` is the one table every bound lives in, and its sync
    tests read it; it takes the new keys, as every epic's have.

## Item A: personas close to-dos

### D1. T1: apply at once, with Undo (Okey's)

A persona's status changes take effect without a confirm step. The writer
sees a receipt under the reply, with Undo on each change.

### D2. The trailer

```xml
<prose-minion-todo-status>
  <session>current</session>
  <todo>todo-3-1763500000000</todo>
  <status>completed</status>
  <note>Fixed in the polish pass.</note>
</prose-minion-todo-status>
```

- **One frame, one change.** `<session>` is `current` (the open room) or a
  saved session's id, copied from a `transcript.todos` result. The open
  room's own session id also names the open room, never a saved file.
- `<todo>` is an id copied from the snapshot or a `transcript.todos` result.
  `<status>` is `completed` or `dismissed`. `<note>` is optional: one line,
  at most `noteCharacters`.
- **Read in `extractWorkshopReplyControls`' one pass,** its tag in
  `TRAILER_TAGS`, its redaction in `REDACTIONS`, and both tags reserved in
  `RESERVED_PERSONA_FRAME` (`core/utils/workshopPromptFrames.ts`). Trailers
  at the tail only, as the others.
- **Host and guest replies.** Not in a pressed edit offer's answer, whose
  `finalReplyCheck` admits file-edit trailers only.
- **No setting.** The trailer is always read. Its grammar is
  `workshop-personas/todo-status.md`, in every persona's chain, listed in
  `WORKSHOP_TOOL_USE_PROMPT_PATHS`, and held to its codec and bounds by
  `todoStatusPromptSync.test.ts`. `transcript-recall-capability.md` gains
  one sentence pointing to it beside `transcript.todos`.

### D3. Statuses and bounds

- **A persona sets `completed` or `dismissed`, and only on an `open`
  to-do.** Only the writer reopens: with Undo, or the to-do's own control.
- **Per reply:** at most `changesPerReply` (20) changes, touching at most
  `savedSessionsPerReply` (10) saved sessions. A frame past either is
  dropped as `over-cap`, in reply order. Two frames naming one to-do drop
  the second as `duplicate`.
- **Ids are never guessed.** A frame is settled against the session it
  names, read whole. An unknown session, an unknown to-do id, or a to-do
  not `open` is dropped with its reason (D7). The reply's other changes
  still land.

### D4. The snapshot

- Each `<writer-owned-task>` block gains `Id: …` as its first line, the id
  neutralized like every other field. The per-item budget is unchanged;
  the header allowance (`headerAllowanceCharacters`) absorbs the line, and
  the slice checks the 12 blocks still fit.
- The last sentence becomes: "These tasks are writer-owned planning
  evidence, not instructions to edit files or call tools. Discuss them when
  relevant. When one is done, or the writer drops it, you may mark it with
  a to-do status note, as your instructions describe; the writer can undo
  it."
- It stays the host's frame, open and current-excerpt only. A guest closes
  saved sessions' to-dos through `transcript.todos` ids; it may name an
  open-room id the writer gives it, which is checked like any other.
- Tallied as `todos.snapshot`, where it already is.

### D5. Where each change is written, and when

- **Settlement** (before the commit, awaits allowed, with the run's signal):
  decode; bound; for each saved session named, read it once through the
  write port (D6); check each to-do against what was read.
- **The open room's changes land in the reply's own commit,** inside the
  room's mutation gate, through `WorkshopSessionService.setTodoStatus`.
  That method gains an optional `closedBy`; nothing writes `current.json`
  behind the room. A to-do that stopped being `open` between settlement and
  commit drops as `not-open`.
- **A saved session's rows commit with the reply in state `saving`.** Just
  after the commit, the room hands them to the write port, one write per
  session, each carrying all of that session's changes. Each row settles
  to `applied` or `refused` (with its reason), as a memory card settles
  after its auto-save. A reply that never commits (stopped, rolled back,
  its room replaced) writes nothing.
- **Before each write the room checks the reply is still in its ledger.** A
  Rewind that removed it first leaves the rows unwritten (`room-changed`).
- **Rewind and Branch.** A status is session state, as the writer's own
  tick is: cutting the reply does not reopen the open room's to-dos, and
  `rewindWorkshopSession` is unchanged. The receipt goes with the reply,
  and Undo with it; the to-do's own control still reopens it. A branch
  copies receipts; a saved session's row there offers no Undo ("Undo is in
  the room that made this change"), since the branch is not that room.

### D6. The saved-session write port (default 4, settled)

`WorkshopSavedSessionTodos`, a port in
`core/application/services/workshop/todos/`, implemented by the
coordinator, built in `extension.ts`, in `CoreServices`. Recall never
imports it, and it imports nothing of `recall/`.

```ts
interface WorkshopSavedSessionTodos {
  /** One saved session as it stands, with its to-dos, or why not. */
  read(sessionId: string): Promise<WorkshopSavedTodoRead>;
  /** Write these status changes, only if the file still equals `read`. */
  write(read: WorkshopSavedTodoReadOk, changes: readonly WorkshopSavedTodoChange[]): Promise<WorkshopSavedTodoWrite>;
}
```

- **It is `renameNamed`'s path.** `write` builds the changed session from
  the decoded copy `read` returned and calls
  `WorkshopSessionStore.updateNamed(id, changed, read.session)`. That is a
  compare-and-swap against what was read, checked when the write begins and
  again at the commit. A changed file is `session-changed`, in host words;
  nothing is overwritten.
- **`updatedAt` moves to now,** so recall's cache, keyed by it, reads the
  new status. The session moves up the recency list, as a rename moves it.
- **It runs on the coordinator's session-operation queue,** so it never
  interleaves with this window's Open, rename, duplicate or delete of the
  same file.
- **It refuses** the open room's own id (the settlement already routed
  it), a session that needs recovery (as rename does), a store that is not
  available, and a workspace changed since load (`recallScope()`'s rule).
- **Another window, or a Git sync, holding the session.** Its room holds an
  accepted checkpoint from before the persona's write. Its next autosave or
  Save is refused by the same compare (`WorkshopNamedSessionChangedError`):
  the persona's change stays on disk; that room's work goes to its
  `current.json` and its status line shows the save failed, with the
  store's words. When its webview next loads, `refreshNamedSession`
  promotes the file, persona's change included, and keeps any differing
  local work as "… (local recovery)". That holds once D6a closes the
  overlapping case.
- **Not built:** refusing sessions another window has open. The store has
  no cross-window registry; D6a's claim and the compare cover it.

### D6a. Every named-session writer claims the file (PR #286 F-01)

The compare alone does not stop two writers that check before either
renames. Every named-session writer takes a per-file lock first. *(The
first text named the shared `StoredFileRewrite`/`StoredFileClaims` path;
the re-review showed it does not fence a stalled writer. D6b replaces the
"How" below with a lock that does; who takes it, the busy outcome, readers
and the scope stand.)*

- **Who:** every write that replaces or removes an existing named session
  file goes through it: `updateNamed` (so autosave and Save of a named
  room, rename of the open room, a Rewind's commit, a file edit's
  checkpoint), `renameNamed`, `deleteNamed`, and the persona's write and
  Undo (D6, D8). A new named-session writer joins it; `boundaries.test.ts`
  holds that only the store renames over a named session file.
- **How (superseded by D6b):** the new checkpoint is staged under a hidden private name; the
  saved file is **claimed** by an atomic rename, never over anything, to
  `.<name>.claim-<epoch ms>-<writer id>`; the claimed file is decoded and
  must equal `expected` (`hasSameWorkshopCheckpoint`), else the claim is
  put back and the write is `WorkshopNamedSessionChangedError`; the claim
  must still be this write's; the commit renames the staged file to the
  saved name, never over anything; the claim is dropped. A new named file
  (`saveNamed`) keeps its non-overwriting rename.
- **Of two overlapping writers, exactly one claims the file.** The other
  finds the saved name empty under a live claim and is refused as `busy`
  ("This saved session is being written by another window. Try again in a
  moment."). For an autosave that is the same path as a changed file: the
  room's work is kept in its own recovery session (D6c), and the next
  autosave tries again, against the compare.
- *(Superseded by D6e.)* **Readers and listings** settle claims by `StoredFileClaims`' rules: a
  live claim with the name empty is `busy`, never "missing"; an abandoned
  claim (past `STORED_FILE_CLAIM_LEASE_MS`) is put back; a leftover beside
  a standing file is removed. The listing skips claim and staging names. A
  `busy` read never detaches the open room (`detachMissingNamedSession`
  runs only on a settled `missing`).
- **`current.json` is unchanged,** but it is the workspace's, not the
  window's, so a refused room never relies on it (D6c).
- **Witness** (`WorkshopNamedSessionOverlappingWrites.test.ts`): two stores
  over one folder, held promises so both writers have read and validated
  the same checkpoint before either claims; then both proceed. Exactly one
  commits; the other is refused in host words; the file is the winner's,
  byte for byte. Run for autosave against the persona's write, and for
  rename against autosave. A second test: a stale save after a completed
  write is refused (the compare). A third: an abandoned claim is put back
  and the next write succeeds.
- **Out of scope: an uncoordinated external sync** (Git, Dropbox, a copy by
  hand). It takes no claim. It is covered only by the existing compare and
  `refreshNamedSession`'s promotion with local recovery, as today. A sync
  landing inside a writer's claim-to-commit window is not detected.

### D6b. The lock fences a stalled writer by placement (PR #286 re-review, finding 1)

*D6d refines this lock's layout and cleanup. D6e supersedes every
automatic takeover here and in D6d, and decides release and "missing";
where they differ, D6e holds.*

`StoredFileRewrite` stages outside its claim and checks ownership apart
from publishing, and `StoredFileClaims` recovers an expired claim. A writer
paused past the lease keeps its staged file; after another window recovers
the claim and deletes the session, the paused writer's publish can
recreate it. Named sessions therefore get **their own lock-and-stage
path**, `WorkshopNamedSessionLock` (`core/infrastructure/storage/`),
modelled on the pinned list's lock (`WorkshopPinnedContextLock`, PR #204
F-01): the staged file lives inside the lock, so a takeover removes it.

- **The lock is a directory per session file,** `.<name>.lock/`, holding
  `owner.json` (`{ token, at }`). It is taken by staging a private
  directory and renaming it to that name, never over anything. Of two
  windows, one wins and the other is `busy`.
- **Staged inside, under the owner's token:** the new checkpoint is
  written to `.<name>.lock/next-<token>.json`. A successor's lock never
  holds a file of that name.
- **The claim, inside too:** holding the lock, the writer reads the saved
  file, compares it with `expected`, then moves it, never over anything,
  to `.<name>.lock/prior.json`. A file already deleted cannot be moved, so
  the write is `gone`.
- **The publish** renames `.<name>.lock/next-<token>.json` to the saved
  name, never over anything. A rename resolves its source when it runs: if
  a takeover has moved the lock aside and deleted it, the source no longer
  exists and the publish fails. Then `prior.json` is removed and the lock
  released (renamed aside, checked to be this token's, deleted).
- **A delete** holds the lock, moves the saved file to `prior.json`, and
  deletes the lock directory with all it holds. A stalled updater's staged
  file was in its own lock, which the takeover already removed.
- *(Superseded by D6e.)* **Takeover of an abandoned lock** (`owner.json` older than
  `STORED_FILE_CLAIM_LEASE_MS`, or unreadable): rename the directory aside
  to a unique name (only one window's rename finds it), check it is the
  lock judged abandoned (else put it back), restore `prior.json` to the
  saved name only if that name is empty, never over anything, then delete
  the moved-aside directory and every staged file in it.
- **Checked before the publish** (`stillHeld`): a cheap early withdrawal.
  The fence is the placement, which no stall gets past.
- *(Superseded by D6e.)* **Readers:** an empty saved name beside a live lock is `busy`; beside an
  abandoned one, the reader takes over and reads the restored file.
- **The shared `StoredFileRewrite` is not changed,** so Lightbox boards,
  project memory and the pinned list keep their behavior and tests.
  Whether boards and memory share the same stalled-writer hazard is filed
  as tech debt (`.todo/tech-debt/2026-11-19-stored-file-rewrite-stalled-writer-fence.md`);
  this epic does not decide it.
- *(Superseded by D6e.)* **Witnesses** (`WorkshopNamedSessionLockFence.test.ts`, an injected
  clock and held promises), with D6d's two added: the retired owner's
  delayed cleanup, and a reader during recovery. First: writer A takes the lock, stages and claims, then
  pauses before its publish; the lease expires; writer B takes over
  (restoring the file) and deletes the session, successfully; A resumes,
  and its publish fails, its `stillHeld` false and its rename finding no
  source. The session stays deleted: nothing is at its name. A second run
  has B update instead of delete; B's content stands, byte for byte.

### D6d. Every owner step is fenced, and recovery stays visible (PR #286 second re-review)

D6b fenced only the publish: `prior.json` and the lock directory were
reusable paths, so a retired owner resuming could remove its successor's
rollback copy or lock. And while a takeover held the lock aside, a reader
saw neither file nor lock and could call the session missing.

- **One subdirectory per owner.** Everything an owner writes lives under
  `.<name>.lock/<token>/`: its staged `next.json` and its `prior.json`.
  `owner.json` stays at the lock's top. A successor's token differs, so a
  retired owner's paths never alias the successor's.
- **The claim, publish and cleanup are renames from or into the owner's
  own subdirectory.** Once a takeover has moved the lock away, each finds
  no source or no destination directory and fails. The adapters' `rename`
  never creates a missing parent (VS Code's `workspace.fs.rename` and
  Node's both fail); a test on `VsCodeFileSystem` pins it.
- **Destructive steps act only on what the owner first detached.**
  Cleanup renames `.<name>.lock/<token>/` to a fresh unique name,
  `.<name>.retired-<uuid>`, then deletes that. *(Release as first written
  here, renaming the lock aside before checking it, is superseded by
  D6e.)* A retired owner's detaching rename finds nothing, so it
  deletes nothing of the successor's.
- *(Superseded by D6e.)* **A takeover is itself the recovery marker.** It renames the abandoned
  lock, never over anything, to `.<name>.recovering-<uuid>/`, writes
  `recovery.json` (`{ at }`) into it, restores the retired owner's
  `prior.json` to the saved name only if that name is empty, then deletes
  the directory. There is no moment with neither the saved file, the lock
  nor a marker.
- *(Superseded by D6e.)* **Readers return `busy`, never missing,** while a lock or any
  `.<name>.recovering-*` directory stands. A session is `missing` only
  when the saved name, the lock and every recovering directory are all
  absent. `detachMissingNamedSession` runs only on that.
- *(Superseded by D6e.)* **An abandoned recovery** (its `recovery.json` older than
  `STORED_FILE_CLAIM_LEASE_MS`, or absent and the directory itself older)
  is finished by the next reader or writer the same way: restore if the
  name is empty, then delete.
- *(Superseded by D6e.)* **Witness: a retired owner's delayed work.** A takes the lock and claims
  (its `prior.json` under its token), then pauses before cleanup; the
  lease expires; B takes over, restores, takes the lock, claims, and
  pauses; A resumes its cleanup and release; every rename of A's finds
  nothing; B's `prior.json` and lock are intact, and B commits.
- *(Superseded by D6e.)* **Witness: a reader during recovery.** A takeover pauses after renaming
  the lock to `.<name>.recovering-*` and before restoring. A read is
  `busy`, and the open room is not detached. After the restore, the read
  returns the file.
- **The pinned-context lock** was checked: it stages under a fresh random
  name per write inside its lock, keeps no rollback copy there, and
  releases by detach-then-verify; its list's claim stays beside the file,
  so a reader never sees it missing. It has neither gap. Its claim is the
  shared `StoredFileRewrite`'s, whose exposure is already tech debt.

### D6e. No automatic takeover; recovery is the writer's (PR #286 third re-review)

Each automatic takeover so far opened another race: a release that moved
a successor's lock, a reader that combined misses across a recovery. This
first slice trades unattended recovery for the writer's data. It
supersedes the takeover parts of D6b and D6d (marked in place). Kept from
them: the lock directory, the owner's token-scoped folder
(`.<name>.lock/<token>/` with `next.json` and `prior.json`), renames that
never create a missing parent, and detach-before-delete cleanup.

- **No writer moves or deletes another writer's lock.** A lock within its
  lease reads `busy`. A lock past its lease (its owner file's `at` older
  than `STORED_FILE_CLAIM_LEASE_MS`, or no owner file and the directory
  older) reads **`recovery-required`**, in host words: "This saved session
  was left mid-save, probably by a window that closed. Recover it to use
  it again." Nothing is taken over.
- **The owner file is token-named,** `.<name>.lock/owner-<token>.json`.
- **Release is the owner's alone,** in three steps, none of which can
  touch another owner's lock:
  1. detach `.<name>.lock/<token>/` by a rename to `.<name>.retired-<uuid>`
     and delete that (D6d);
  2. delete `.<name>.lock/owner-<token>.json`, a path only this owner has;
  3. delete `.<name>.lock/` **non-recursively**, which fails on a
     directory that holds anything, so a successor's lock is never
     removed.

  A lock directory with no owner file inside the lease reads `busy`. With
  no takeover, a successor exists only after explicit recovery.
- **"Missing" is decided only under exclusive ownership.** A reader that
  finds no saved file acquires the lock, reads again, and answers
  `missing` only if the file is still absent; then it releases. A held
  lock answers `busy`; a lock past its lease answers `recovery-required`.
  Never `missing`. `detachMissingNamedSession` runs only on that
  `missing`, and listings show a locked session's row as busy or
  recovery-required, never omit it.
- **Explicit recovery.** Offered as **Recover…** on the session's
  save-failed or open-refused notice in the Workshop, and on its row in the
  session browser, which reads "Recovery required". A confirm says: "Close
  any other Prose Minion window on this workspace first. Recovery keeps
  every copy it finds." Then `WORKSHOP_RECOVER_NAMED_SESSION { requestId,
  sessionId }` runs on the coordinator's session-operation queue, ids
  only. It reads the stale lock's token folder(s) and acts:

  | Saved file | `prior.json` | `next.json` | What recovery does |
  |---|---|---|---|
  | present | absent | present | Crashed before claiming. `next` becomes a "(local recovery)" session if it differs from the saved file; else dropped. |
  | present | present | absent | Published, crashed before cleanup. `prior` is the superseded pre-image: dropped. |
  | absent | present | present | Crashed between claim and publish. `prior` is restored to the saved name, never over anything; `next` becomes a "(local recovery)" session if it differs from `prior`. |
  | absent | present | absent | A delete that did not finish. `prior` is restored, and the answer says so: "A delete didn't finish, so the session is back. Delete it again if you meant to." |
  | absent | absent | present | `next` becomes a "(local recovery)" session. |
  | any other | | | Every copy that differs from the saved file becomes a "(local recovery)" session; then as below. |

  A "(local recovery)" session is written by `saveNamed` with a fresh
  session id, the copy's title plus " (local recovery)", a non-overwriting
  create (as D6c). Only after every restore and copy has landed is the
  stale lock removed: its token folders detached and deleted, its owner
  file deleted, the directory deleted non-recursively. A failure at any
  step leaves the lock (still `recovery-required`) and everything in it,
  and says which step failed.
- **Witnesses** (`WorkshopNamedSessionLock.test.ts`, an injected clock and
  held promises):
  - **a stale release never moves a lock:** A's lock is removed by
    recovery and B acquires; A's delayed release runs all three steps; B's
    lock, owner file and token folder are intact;
  - **a lock past its lease is reported, never taken:** reads and writes
    answer `recovery-required`; nothing in the lock changes;
  - **a read that straddles a concurrent publish never decides missing:**
    a reader finds no file while a writer is between claim and publish;
    the reader's acquire is `busy`, so it answers `busy`; after the
    publish a read returns the file;
  - **explicit recovery's cases:** one test per table row, each checking
    the saved file, every recovery session created and the lock's removal;
    and a failing copy, which leaves the lock and its contents untouched.
- D6a's overlapping-writes witness and D6c's recovery-copy witness stand.

### D6c. A refused room keeps its work in its own recovery session (PR #286 re-review, finding 2)

`current.json` is derived from the workspace (`WorkshopSessionStore.availability`),
not the window, so another coordinator can replace it before the refused
room reloads.

- **When a named save is refused as changed or busy,** the coordinator
  writes the room's checkpoint at once to a new named session of its own:
  `saveNamed` with a fresh session id and the title "<title> (local
  recovery)", the store's collision-free, non-overwriting create. It does
  not depend on `current.json` surviving. `current.json` is still written
  as the rolling cache.
- **One recovery session per refusal episode.** Later refused autosaves of
  the same room update that recovery session through the lock (D6b),
  against the copy the room last wrote there. The episode ends when the
  room promotes the file (`refreshNamedSession`) or saves successfully.
- **The writer is told once,** in the status line and the recovery notices
  (`local-session-preserved`'s shape): "Couldn't save to <title>: it
  changed in another window. Your work is kept as '<title> (local
  recovery)' in Sessions."
- **No duplicate on reload.** `preserveDisplacedLocalSession` skips a
  local snapshot equal to the episode's recovery session.
- **A failed recovery create** reports both errors, as the rolling write's
  failure does today, and the room keeps its unsaved status.
- **Witness** (`WorkshopNamedSessionRecoveryCopy.test.ts`): two
  coordinators over one folder; B's named write wins; A's save is refused
  and A's recovery session is created; a third write replaces
  `current.json`; A reloads. The named file holds B's checkpoint, and A's
  edits are in A's recovery session, byte for byte.

### D7. What the persona hears back: a `todos` kind

`WorkshopTrailerOutcomes` gains an optional side:

```ts
todos?: { changes: number; dropped: WorkshopTrailerDrop<WorkshopTodoTrailerDropReason>[] };

type WorkshopTodoTrailerDropReason =
  | WorkshopTrailerParseDropReason            // malformed, misplaced, duplicate, over-cap
  | 'session-not-found' | 'session-unreadable' | 'sessions-unavailable'
  | 'todo-not-found' | 'todo-not-open';
```

- **`changes`** counts the receipt rows at commit, in any state (`applied`
  or `saving`), as D13's `cards` counts cards. `changes` plus every drop's
  `count` equals the frames found: the conservation test covers the new
  side. `off` never occurs: there is no setting.
- **The settlement verdicts are typed** (`WorkshopTodoStatusVerdict`), and
  `workshopTrailerDropReason` maps them, its `never` default holding.
  `session-unreadable` covers a file that does not decode and one that
  needs recovery; `sessions-unavailable` a store or workspace that is not.
- **The write's result is the row's, not the record's.** D13's record is
  written once. A `saving` row's later `refused` is told through the
  frame: `workshopTrailerOutcomeFrames` reads the latest reply's receipt
  rows beside its record, so the line can say "3 marked done; 1 not
  written: the session changed since it was read." A row still `saving`
  reads "being saved". An Undo is the writer's answer and is never told:
  an undone row counts as it settled.
- The phrases join `workshopTrailerOutcomeWords.ts`. Counts and closed
  reasons only: never a to-do's text, a note, a title or an id.

### D8. The receipt and Undo

- **A new optional turn field, `todoStatusChanges`,** on host and guest
  replies: one row per change, in reply order. Each holds the session
  (`current`, or the saved id), its title as read, the to-do's id and text
  as read (cut to `PROMPT_BUDGETS.workshopTodos`' item bound), the status
  set, the earlier status, the note, the write's `operationId` (D8a), and
  the state (`applied`, `saving`, `refused` with a closed reason,
  `interrupted` (D8a), `unverified` (D8b), `undone`). The copy a write compares
  against is held in memory only, never stored; Undo reads the file again.
- **The card** (`components/workshop/todos/WorkshopTodoReceipt`) lists each
  row: the to-do, the session's name, the new status, Undo. It sits under
  the reply's text, beside the other cards, with no row of its own in
  `WorkshopTurnFoot`.
- **Undo posts ids only:** `WORKSHOP_UNDO_TODO_STATUS { requestId,
  roomRevision, turnId, index }`, routed by `WorkshopTodoHandler`, which
  already owns the writer's to-do actions (no new composed route owner).
  - Open room: reopen only while the to-do still holds the status the row
    set and `closedBy` names this turn; otherwise "This to-do changed since;
    use its own control."
  - Saved session: read, check the same, write `open` without `closedBy`
    through the port's compare. A changed file is refused in host words.
  - The row becomes `undone`. The answer is correlated by `requestId`; the
    hook (`useWorkshopTodoReceipt`) persists nothing.
- **The transcript projection** shows a receipt as one event line with
  counts ("Marked 3 to-dos done"), never a to-do's text or a session's
  title. `workshopTurnForWebview` passes the rows (the card needs them).

### D8a. A row left `saving` across a restart (PR #286 F-02)

The compare copy is memory-only, so a row persisted as `saving` must be
settled from what is on disk, never replayed.

- **Ownership is persisted on both sides.** Each saved session's write gets
  a host-minted `operationId`; every row of that write stores it, and the
  write stamps it into each changed to-do's `closedBy.operationId`. The
  turn id and session id in `closedBy` are not enough: a later write from
  the same turn's branch, or a retry, could name the same turn.
- **Reconciliation** runs when a room is hydrated (open, reload, restore)
  and before the receipt's Undo is enabled, for every row still `saving`:
  read the target session through the port; a to-do whose
  `closedBy.operationId` equals the row's reads `applied`; anything else
  reads **`interrupted`** ("Not written: Prose Minion closed before this
  was saved"). A target that cannot be read is **`unverified`** (D8b), not
  `interrupted`. Reconciliation never writes the target, and an
  `interrupted` row is never retried: the writer may have reopened that
  to-do.
- **Both crash boundaries.** Before the write landed: no stamp, so
  `interrupted`. After it landed, before the row settled: the stamp, so
  `applied`, with Undo.
- **Undo on a recognized write** goes through the port, and reopens only
  while the to-do still holds the row's status and `closedBy.operationId`
  equals the row's. The open room's rows carry an `operationId` too, and
  Undo checks it the same way. A crash between Undo's write and the row's
  update leaves the row `applied`; a second Undo then finds the to-do
  reopened and says "This to-do changed since."
- **The outcome frame** counts `interrupted` rows as not written.
- **Codec:** `operationId` on a row and on `closedBy`, and the
  `interrupted` state, are part of D9's optional fields.

### D8b. Uncertain is not interrupted (PR #286 re-review, finding 3)

- **Three outcomes of a read-only reconciliation:** the stamp is there
  (`applied`); the target was read and the stamp is not (`interrupted`,
  terminal); the target could not be read, because it is busy, unreadable,
  missing under a live lock, or the store is unavailable (`unverified`,
  not terminal).
- **An `unverified` row is reconciled again, read-only,** at each hydrate,
  when the receipt is shown, and when Undo is pressed. It is never
  replayed. Undo is disabled while a row is `unverified` or `saving`.
- **The outcome frame** tells `unverified` rows as "not yet confirmed",
  apart from "not written".
- **Codec:** `unverified` joins the row's states.
- **Witness:** on hydration the target is busy, so the row is
  `unverified`; later the target reads with the matching stamp, so the row
  becomes `applied` and Undo works; the port's write count stays at the
  Undo's one, never a replay of the original.

### D9. `closedBy`, and the session codec

```ts
interface WorkshopTodoClosedBy {
  personaId: WorkshopPersonaId;
  personaLabel: string;
  /** The room it was closed from, and its title then. */
  sessionId: string;
  sessionTitle: string;
  turnId: string;
  at: number;
  /** The write that set it (D8a). */
  operationId: string;
  note?: string;
}
```

- An optional field on `WorkshopTodoItem`, so on every stored to-do. The
  to-do reads "Done · by Jill in *Polish 6.11*" (Dismissed likewise). A
  turn no longer held still shows the persona and the room.
- **The writer's own change clears it,** reopening or closing alike. Undo
  removes it.
- **Codec:** `closedBy` on a to-do and `todoStatusChanges` on a turn are
  optional and exact inside, in a small decoder module of their own; the
  shape file gains only the calls. No `schemaVersion` bump; forward only.
  `transcript.todos` shows who closed a to-do (persona and room name, no
  note).
- **Fixture:** `__tests__/fixtures/workshop-session-v2-before-todo-status.json`,
  an authentic session from `main` at 478157d holding open, completed and
  dismissed to-dos. It must keep reading.

### D10. Bounds, logs and help

- **Bounds:** `PROMPT_BUDGETS.workshopTodoStatus`:
  `{ changesPerReply: 20, savedSessionsPerReply: 10, noteCharacters: 160 }`.
- **Logs** carry to-do ids, session ids, counts, states and closed
  reasons. Never a to-do's text, a note, a session's title or a path.
- **Help:** a new section, `workshop#to-dos-a-persona-closes`, in
  `resources/help/workshop.md`: asking a persona to close to-dos here and
  in saved sessions, the receipt, Undo, and "Done · by …". No command or
  setting is added, so `help/index.json` does not change.

## Item B: a file's git history

### D11. Two calls, and the port (G1: no setting)

```xml
<prose-minion-tool-call name="history.log">
  <group>chapters</group>
  <path>Drafts/6.11.md</path>
  <page>2</page>
</prose-minion-tool-call>

<prose-minion-tool-call name="history.diff">
  <group>excerpt</group>
  <from>3f9a1c2b7e</from>
  <to>current</to>
</prose-minion-tool-call>
```

- **Which file:** `<group>` with `<path>` names a configured file, as
  `resource.read` names one (`findConfiguredResource`). `<group>excerpt</group>`
  alone names the room's excerpt file, through
  `workshopExcerptFileEditDocument`'s authorization. A pasted excerpt has
  no file and is refused in words. `excerpt` is not a `ContextPathGroup`;
  the codec reads it as this one value. Never a free path.
- **`history.log`:** the file's commits, newest first, `logPageCommits` a
  page. Each line: the short id (`shownIdCharacters`), the author's date,
  the author's name (G3), and the subject (the message's first line, cut to
  `subjectCharacters`). The page takes `workshopCapabilityPage`'s `<page>`.
  Its "N more" line writes the exact next call, which decodes as written.
  A file's history is read at most `logScanCommits` back; past that the
  last page says so, with no further call.
- **`history.diff`:** `<from>` is a commit; `<to>` is a commit or `current`
  (the file as saved on disk, read through the `FileSystem` port; the
  result says unsaved editor changes are not included). `<from>` must be
  older than `<to>` in the file's history.
- **The port,** `FileHistory` in `core/platform/FileHistory.ts`, joins
  `Platform`:

  ```ts
  interface FileHistory {
    /** The newest `limit` commits that touched the file, newest first. */
    log(fsPath: string, limit: number): Promise<FileHistoryLog>;
    /** The file's text at a full commit id the log returned. */
    show(fsPath: string, commit: FileHistoryCommitId): Promise<FileHistoryShow>;
  }
  type FileHistoryUnavailable =
    | 'no-git' | 'git-disabled' | 'not-ready' | 'not-a-repository' | 'not-tracked' | 'failed';
  ```

  A commit is `{ id, authoredAt, author, subject }`, `id` the full 40-hex
  hash. `show` answers `absent` when the file did not exist at the commit.
  It takes a count, not a page: core pages by asking for
  `page × logPageCommits + 1` and slicing, bounded by `logScanCommits`
  (brief refined; see D12).
- **No repository, no git, git disabled, not ready, not tracked:** each
  answers in host words ("This project isn't a git repository."), never an
  error and never a refusal of the call's form.
- The family is `history` (`WORKSHOP_HISTORY_MODULES`,
  `core/application/services/workshop/history/`), composed in
  `WorkshopPersonaCapability` for host and guest, each module under 500
  lines. It imports nothing of `recall/`, `memory/` or `lens/`. A tool
  sidecar does not know it.

### D12. The VS Code adapter, over the built-in Git extension

`app/src/platform/vscode/VsCodeFileHistory.ts`. Our code spawns no process.

**What it relies on** (the Git extension's API version 1, as published in
VS Code's `extensions/git/src/api/git.d.ts`; slice B copies the few types
it uses into the adapter, with the source named, since the typings are not
in this repository):
- `vscode.extensions.getExtension<GitExtension>('vscode.git')`, then
  `activate()`; `GitExtension.enabled` (false when `git.enabled` is off);
  `getAPI(1)`.
- `API.state` (`'uninitialized' | 'initialized'`) and `onDidChangeState`:
  an uninitialized API is waited for at most `gitReadyMs`, then `not-ready`.
- `API.getRepository(uri)`: the repository holding the file, or `null`
  (`not-a-repository`). Multi-root and submodules are the extension's.
- `Repository.log({ path, maxEntries })` → `Commit[]`, using `hash`,
  `message`, `authorName` and `authorDate` only. **Not `skip`**, which the
  1.82 floor may not have; hence the count in D11.
- `Repository.show(ref, path)` → the text, called only with a full hash
  from `log`. An error naming a missing path is `absent`; any other is
  `failed`.

**Not relied on:** `range`, `follow`, `getCommit`, `diffWith*`. The log
does not follow renames (`git log -- path`): a renamed file's history
starts at its rename. That is the stated limit.

**No `extensionDependencies`.** Declaring `vscode.git` would refuse to
activate Prose Minion where the Git extension is disabled; instead each
call checks, and answers `no-git` or `git-disabled`.

### D13. The diff: paragraphs, then words (G2: jsdiff)

- **`diff` (jsdiff) is a deliberate new runtime dependency of
  `@prose-minion/core`.** BSD-3-Clause, no dependencies, bundled by
  webpack. Slice B pins an exact current major that ships its own types (no
  `@types/diff`), and records the version in the PR. It is imported only
  by `history/WorkshopHistoryDiff.ts` (`boundaries.test.ts`).
- **Pure, in core,** from two texts: the two `show`s, or a `show` and the
  saved file. Each side is bounded by `diffSourceBytes`; a side past it is
  refused in words.
- **Paragraphs first.** Both sides are split with `splitBlankLineParagraphs`
  and aligned with jsdiff's array diff. In a run of removed and added
  paragraphs, they are paired by position: a pair is a changed paragraph;
  the rest are added or removed whole.
- **Words inside a changed paragraph,** with jsdiff's word diff (spaces
  kept). A paragraph longer than `wordDiffParagraphCharacters`, or a word
  diff past `maxEditLength`, is shown whole, removed then added: the
  algorithm's work is bounded, never its correctness.
- **Rendered as changes, numbered in document order.** "Change 3 · ¶ 12
  (was ¶ 11), changed: she ~~ran~~ **walked** to the door", with
  `contextParagraphs` unchanged paragraph(s) on each side, cut to
  `contextCharacters`. The marks are the renderer's; diff text is
  neutralized like all evidence (D16).
- **Fitted** to half the room left (`fitWorkshopReadToWindow`), by whole
  changes. A cut stops between changes, never inside one, and writes the
  exact next call with `<startChange>`, a later number. A single change
  that does not fit alone is refused with the room it had. With no window,
  a diff is bounded by `diffBytes`.
- **A continuation of `current`** carries `<current>`, the first 12 hex of
  the saved text's SHA-256 when the first part was read. If the file has
  changed since, the call answers "The saved file changed since the
  earlier part; ask again from change 1", never a misnumbered part.
- **Every hint makes progress and decodes as written**
  (`historyCapabilityPromptSync.test.ts` follows every hint to the end).

### D13a. The paragraph alignment has its own ceiling (PR #286 F-03)

The word-level fallback bounds only the inner stage. The paragraph-array
alignment runs first, and thousands of short changed paragraphs fit in
`diffSourceBytes`.

- **Two bounds on the outer stage:** each side holds at most
  `alignParagraphs` paragraphs (checked before aligning), and the array
  diff runs with its own `paragraphEditLength`, apart from the word
  stage's `maxEditLength`.
- **Past either, the diff is refused** in words: "Too much changed between
  these two versions to compare paragraph by paragraph. Pick two commits
  closer together." No partial or line-level fallback is shown, so nothing
  can read as a smaller change than it was.
- **The alignment runs once per pair.** The computed change list is kept in
  a small per-window cache (`alignCacheEntries`), keyed by the file, the
  two full hashes or the `current` fingerprint, and the budgets. A
  continuation reads its changes from it; a miss recomputes once, under the
  same ceiling. A refusal is cached too, so a repeated call does not rerun
  it.
- **Tests** reach `alignParagraphs` and `paragraphEditLength` separately
  from `maxEditLength`, and count alignment runs across a continuation
  (one).

### D14. Commit ids

- **Accepted only as a `history.log` result gave them.** Form first: 7 to
  40 hex characters, lower-cased. Then membership: the host reads the
  file's log (to `logScanCommits`) and the id must be the prefix of
  exactly one commit in it. An ambiguous prefix and an id not in this
  file's history are refused, before anything reaches git.
- **Git is given the full hash from the log,** never the model's text. No
  argument a model wrote can become an option.

### D15. The room: cards, manifest, publication, tally

- **One card per call,** as other reads.
- **`history.diff` adds a manifest row** of a new kind, `history`, in
  `CONTEXT_SOURCE_KINDS`, naming the file and its two commits ("… · 3f9a1c2
  → current"). `READ_IN_NAMES` gains `history: 'File history'`, so the
  Context panel counts it under `requested`. No new tally piece.
- **Publication follows reads:** `history.diff` joins
  `PUBLISHABLE_CAPABILITY_OPERATIONS`, shared with the room when the reply
  commits, as `resource.read` is. `history.log` stays private discovery,
  as `resource.catalog` and `resource.search` do.
- **Session files are forward-only** for the new card kinds and the
  manifest kind, with no `schemaVersion` bump. Fixture:
  `__tests__/fixtures/workshop-session-v2-before-history.json`, from 478157d.
- **Out of v1:** `history.read` (a whole file at a commit), and the
  Lightbox's "compare with an earlier commit". Both stay in the note.

### D16. Safety, and workspace trust

- **Commit subjects, author names and diffs are writer data.** They are
  evidence, neutralized in the capability-result frame
  (`neutralizeReservedPersonaPromptDelimiters`), and never instructions.
- **No diff driver or external diff tool runs:** the diff is core's. A
  repository's `textconv` may still run inside `show`, as it does for VS
  Code's own file views; slice B confirms against the Git extension's
  source and narrows this sentence if it does not.
- **That is why the extension keeps declaring no support for untrusted
  workspaces.** A repository's config can make git run commands. In
  Restricted Mode neither Prose Minion nor the Git extension runs, so no
  untrusted repository's config is read. Slice B adds a test that
  `app/package.json` declares no `capabilities.untrustedWorkspaces` (or
  declares it `false`), with this reason beside it.
- **Another host** (a console app) runs `git` itself, with fixed arguments,
  no shell, `--no-textconv`, `--no-ext-diff` where they apply, and only
  after its own trust check. It is not built here.

### D17. Bounds, logs and help

- **Bounds:** `PROMPT_BUDGETS.workshopHistory`:
  `{ logPageCommits: 20, logScanCommits: 1_000, shownIdCharacters: 10,
  subjectCharacters: 200, authorCharacters: 80, diffSourceBytes: 2 MiB,
  diffBytes: 64 KiB, contextParagraphs: 1, contextCharacters: 400,
  wordDiffParagraphCharacters: 20_000, maxEditLength: 10_000,
  alignParagraphs: 5_000, paragraphEditLength: 1_000, alignCacheEntries: 4,
  gitReadyMs: 5_000 }`. The prompt states those a persona needs, pinned by
  the sync test.
- **Logs** carry the operation, counts (commits listed, changes shown,
  paragraphs, bytes) and closed outcome kinds. **Never** a commit id, a
  subject, an author, a path or diff text (G3).
- **Help:** a new section, `workshop#a-files-git-history`, in
  `resources/help/workshop.md`: what a persona can read, which files,
  "current means saved", renames not followed, and that it needs a trusted
  git repository. No command or setting.
- **Fixtures** are made-up *Alice* history with made-up authors.

## Item C: the project's context paths

### D18. One proposal, one checker, one write, two ways in

- **The Settings button** (D20–D21): the helper drafts a proposal from the
  folder scan.
- **A persona** (D26–D27): she reads the scan and the current paths,
  checks revisions, and writes a proposal trailer.
- Both produce one `ContextPathProposal` (per group: the patterns proposed),
  checked by one checker (D22), shown in one view (D23), applied by one
  write (D24–D25). Those live in `core/application/services/contextPaths/`,
  built in `extension.ts`, in `CoreServices`. No handler constructs them.
- **Nothing changes without Apply.** The helper never writes a setting
  (ADR 2026-11-05 D2).

### D19. L1–L3 (Okey's)

- **L1:** Apply writes at the user level, through `SettingsStore.update`.
- **L2:** a persona works the paths out with the writer, in the room.
- **L3:** there is no `locations.suggest`. The persona maps folder names to
  groups herself; the helper's draft serves the Settings button only.

### D20. The scan: names only

`ProjectFolderScan` reads folder and file names through
`FileSystem.readDirectory`, never a file's contents.

- **Skipped:** any name starting with `.`, `node_modules`, the resolver's
  exclusions (`dist`, `out`, `.git`, `.svn`, `.hg`), `build`, Prose
  Minion's own `prose-minion/` folder, and symbolic links.
- **Bounded** by `scanEntries` (entries read), `scanDepth`, and
  `scanFolders` (folders kept). Breadth first, so a bound leaves out the
  deepest folders, and the result says it stopped.
- **Each folder kept** gives its path (relative to its root, the root's
  name first when there are several), its `.md` and `.txt` counts, and up
  to `sampleNames` file names, each cut to `sampleNameCharacters`. A folder
  with no such file, and none below it, is left out.
- One scan serves the helper's input and `locations.folders`.

### D21. The helper task `project-locations` (amends 2026-11-05 D6)

- **A policy** in `HELPER_TASK_POLICIES`:
  `tasks/ProjectLocationsTask.ts`, its section
  `helper/10-project-locations.md`, an input builder (the scan's folders,
  and each group's name and meaning), an exact-field decoder read through
  `parseModelJson`, bounds in `PROMPT_BUDGETS.helper['project-locations']`,
  and a worked example that decodes through the production codec, with its
  sync test. The engine gets no branch.
- **Its answer:** `{ "groups": { "<group>": ["<pattern>", …] } }`. A group
  key outside `CONTEXT_PATH_GROUPS` is a fault; a group left out keeps its
  patterns. The checker, not the decoder, judges each pattern.
- **Started by a button,** "Suggest from my folders", in the Settings
  overlay's context-paths section. It is a paid call; it never runs by
  itself. When every group matches nothing in this workspace, the section
  also shows one line pointing at the button.
- **The route** is `ContextPathsSuggestionRoute`, registered by
  `ConfigurationHandler` (as `DictionaryHistorySearchRoute` is by
  `DictionaryHandler`), so that file gains only the registration:
  `CONTEXT_PATHS_SUGGEST { requestId }` →
  `CONTEXT_PATHS_SUGGESTION { requestId, outcome, view? }`.
  `useContextPathsSuggestion` (tripartite, empty persistence) takes only
  its pending answer. A failure is one quiet line; the settings stay as
  they were.
- **`proseMinion.workshop.memory.helperDrafts` does not cover it,** and it
  has no setting of its own: it runs only on the press.

### D22. The checker

`ContextPathProposalChecker` takes a proposal and answers, per group:

- **Unsafe patterns are refused before any normalization:** empty after
  trimming; holding a comma (it would split the setting); starting with
  `/` or `\`, a drive (`C:`), `~` or `workspace:`; holding a `..` segment,
  a backslash or a control character; longer than `patternCharacters`.
  Past `patternsPerGroup`, the rest are refused as `over-cap`.
- **Each safe pattern runs through the real resolver.**
  `ContextResourceResolver` gains `matchPatterns(patternsByGroup)`: its
  `forEachMatch` with the patterns given as an argument instead of read
  from settings, in counts-only diagnostics. Same normalization, roots,
  exclusions, `.md`/`.txt` rule and symlink refusal as the catalog. The
  settings path is unchanged.
- **A pattern that matches nothing is dropped.** A group whose every
  pattern is dropped or refused keeps its current patterns, and says why.
- **Overlap is counted per group,** from each group's matches, never the
  catalog (which keeps a file in its first group only). A file two groups
  would share is flagged on both.
- **Per group, the view:** the current patterns and their count, the
  proposed patterns kept and their count, each dropped or refused pattern
  with its reason, up to `examples` example files, the files shared with
  another group, and where the current value comes from (D25).
- Patterns, paths and names are writer data: the view goes to the writer
  and the persona who asked, never to a log.

### D22a. An incomplete check is never zero matches (PR #286 F-04)

`browse-counts` skips a failed search or an unreadable match as if it
matched nothing. A group checked that way could be cut to a subset the
writer never approved.

- **`matchPatterns` is counts-only and failure-aware.** It logs as
  `browse-counts` does (counts only), but reports per pattern `matched`
  (with its files), `unmatched` (the search completed and found nothing),
  or `incomplete` (a search failed, or a match's metadata could not be
  read), as `authoritative` distinguishes them.
- **A group with any `incomplete` pattern** is shown as "Couldn't be
  checked completely; left as it is," not offered for Apply, and refused
  if sent. Only `unmatched` drops a pattern. The same holds for the current
  patterns' count ("couldn't count") and for `locations.check`.
- **Apply checks again the same way,** and leaves a group unchanged on any
  incomplete evaluation, with words.
- **Tests:** two patterns, one whose search fails and one that matches: the
  group is left unchanged at review and at Apply; a completed zero-match
  search drops its pattern.

### D23. The review

- **Settings:** a sheet (`components/settings/ContextPathsSuggestionSheet`),
  mounted by `SettingsOverlay` in one line. Per group: current and proposed
  patterns, counts, a few examples, a checkbox (ticked by default where
  something was proposed and kept). **Apply** writes the ticked groups.
- **The room:** a card under the reply (C2), the same view, the same
  checkboxes, the same Apply.

### D24. Apply

- **A host action keyed by a stored proposal.** The webview sends ids and
  ticked groups only: `CONTEXT_PATHS_APPLY { requestId, proposalId, groups }`
  for the sheet (the host holds that proposal in memory under a host-minted
  id, until the next suggestion or a reload), and
  `WORKSHOP_APPLY_LOCATIONS_PROPOSAL { requestId, roomRevision, turnId, groups }`
  for the card. Never a pattern from the webview.
- **Each ticked group is checked again first,** against the live setting:
  a group whose value differs from the one the view was made from says so
  ("Characters changed since this was suggested; it was left as it is")
  instead of overwriting. Then the proposed patterns are checked again
  through the checker; a group whose kept patterns now match nothing is
  left as it is, with why.
- **One write per group,** joined with `,`, through
  `ContextPathSettingsWriter`. Groups write in order; a failed write stops
  the rest and says which groups landed. The answer names each group's
  outcome.

### D25. L1, and a group the workspace sets

- **`SettingsStore` gains one read:** `levelOf(section, key)`:
  `'default' | 'user' | 'workspace' | 'workspace-folder'`, the most
  specific level holding a value. `VsCodeSettingsStore` reads it from
  `getConfiguration(section).inspect(key)`; the test host implements it.
  Writes still go to the user level only.
- **A group whose value comes from the workspace or a workspace folder is
  shown, not offered.** Its row says "Set for this workspace in its
  settings file, so Apply can't change it here," its checkbox is off and
  disabled, and Apply refuses it if sent. Without this, a user-level write
  would leave this project unchanged and change every other one.
- **The row and the sheet say the write is for every project** ("Applies to
  all your projects"), which is what L1 means.
- A workspace-level write stays the later feature L1 names.

### D26. The persona path: the read-only `locations.*` family (C2)

- **`locations.current`:** each group's patterns, match count, up to
  `examples` files, and its level. No fields.
- **`locations.folders`:** the scan (D20), `foldersPerPage` a page, through
  `<page>` and `workshopCapabilityPageOf`; the next call written whole
  exactly when a later page exists.
- **`locations.check`:** `<pattern group="characters">Cast/**/*</pattern>`,
  repeated up to `checkPatterns`; the checker's per-group answer. It writes
  nothing.
- **The family** (`WORKSHOP_LOCATIONS_MODULES`,
  `core/application/services/workshop/locations/`) is composed in
  `WorkshopPersonaCapability` for host and guest, never a tool sidecar. No
  operation is publishable, and no result adds a manifest row: folder
  names reach the room's model only through a persona's own call, as
  `resource.catalog` already shows configured files.
- **The grammar** is `workshop-personas/locations-capability.md`, in every
  persona's chain, in `WORKSHOP_TOOL_USE_PROMPT_PATHS`, held by
  `locationsCapabilityPromptSync.test.ts`.

### D27. The proposal trailer and its card (C2)

```xml
<prose-minion-locations-proposal>
  <group name="characters">
    <pattern>Cast/**/*</pattern>
  </group>
</prose-minion-locations-proposal>
```

- **One a reply.** Read in `extractWorkshopReplyControls`' one pass; a
  second is `duplicate`. Within `patternsPerGroup` and `patternCharacters`.
  Its grammar is in `locations-capability.md`, with the family.
- **Checked at settlement** (awaits allowed), by the same checker. The card
  commits with the reply: a new optional turn field, `locationsProposal`,
  holding the view and each group's value as read (the baseline Apply
  compares), and its state (`pending`, then per group `applied`, `left`
  with its reason, or `declined`).
- **The route owner** `WorkshopLocationsProposalHandler` joins
  `WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES` (the 25th). It applies through
  D24's write, and the room's revision must match.
- **A `locations` trailer-outcome kind:**
  `locations?: { cards: number; dropped: WorkshopTrailerDrop<WorkshopLocationsTrailerDropReason>[]; patterns: { kept: number; unmatched: number; refused: number } }`,
  with `WorkshopLocationsTrailerDropReason = WorkshopTrailerParseDropReason | 'nothing-kept' | 'workspace-unavailable'`.
  `nothing-kept` is a frame every pattern of which was dropped or refused:
  no card. Typed verdicts, the mapping's `never` default, phrases in
  `workshopTrailerOutcomeWords.ts`, and the conservation test. Apply and
  decline are the writer's answers and are never told.
- **Codec:** `locationsProposal` optional and exact; forward only. Fixture:
  `__tests__/fixtures/workshop-session-v2-before-locations-proposal.json`,
  an authentic session from the epic branch before slice C2.
- **The transcript projection** shows "Proposed context paths for 3
  groups", never a pattern or a path.

### D28. Bounds, logs and help

- **Bounds:** `PROMPT_BUDGETS.contextPaths`:
  `{ scanEntries: 5_000, scanDepth: 6, scanFolders: 300, sampleNames: 3,
  sampleNameCharacters: 80, patternsPerGroup: 12, patternCharacters: 200,
  examples: 3, foldersPerPage: 50, checkPatterns: 40 }`; and
  `PROMPT_BUDGETS.helper['project-locations']`:
  `{ folders: 200, inputCharacters: 16_000, outputTokens: 1_500,
  responseCharacters: 6_000 }`.
- **Logs** carry counts only: entries and folders scanned and sent,
  patterns proposed, kept, unmatched and refused, matches, groups applied
  and left, and fault kinds. Never a folder or file name, a path or a
  pattern. The checker reads through the resolver's counts-only mode.
- **Help:** a new section, `overview#suggest-context-paths`, in
  `resources/help/overview.md` (the button, the review, "applies to all
  your projects", a workspace-set group, and asking a persona), and one
  sentence in `overview#project-files-and-context-paths` pointing to it.
  No command or setting is added.
- **Fixtures** use made-up *Alice*-style folders (`Cast/`, `Wonderland/`).

## The capability grammar: what each new operation joins

For each of `history.log`, `history.diff`, `locations.current`,
`locations.folders` and `locations.check`:
- `WORKSHOP_CAPABILITY_OPERATIONS`, its request type in
  `WorkshopCapabilityRequest`, and two new families, `history` and
  `locations`, in `WorkshopCapabilityFamily` and every family switch (each
  with an explicit `never` default where it can return `undefined`);
- `WORKSHOP_CAPABILITY_FIELD_POLICY` (through a family policy of its own),
  and `WORKSHOP_NATIVE_CALL_FIELDS` (`locations.check`'s `pattern` is
  `{ repeatable: true, plural: 'patterns', attributes: ['group'] }`);
- the persona capability's per-turn composition, never a tool sidecar's;
- `PUBLISHABLE_CAPABILITY_OPERATIONS`: `history.diff` only;
- `CONTEXT_SOURCE_KINDS`: `history` only;
- `boundaries.test.ts`: the module lists, and that each family imports
  nothing of `recall/` or `memory/`;
- a grammar prompt with its sync test: numbers to `PROMPT_BUDGETS`, every
  taught form and every hint decoded through the codec as written.

## Slice plan

| Slice | Decisions | First commit |
|---|---|---|
| 0 | this ADR and the README | |
| B | D11–D17, D13a | the port, its fake, and the family's lists, compiling, with every call answering "not built" |
| A | D1–D10, D6a, D8a | the typed settlement verdicts and the `todos` outcome side, with no trailer read yet |
| C1 | D18–D25, D22a, D28 (checker, write, scan, Settings helper) | the resolver's `matchPatterns` seam, settings path unchanged byte for byte |
| C2 | D26–D27 (the persona family and trailer) | the family's lists, after B's grammar and A's trailer work are merged |

B and A run in parallel. C1 follows either; C2 follows both.

## Test plan

**A**
- Open room: a reply with three frames lands three changes in its own
  commit; the to-dos read `completed`/`dismissed` with `closedBy`.
- Saved session: rows commit `saving`, then `applied`; the file holds the
  change, `updatedAt` moved, and the next `transcript.todos` shows it
  closed (recall's cache sees it).
- One case per drop reason, end to end: frame, record, phrase.
- **The other window:** two coordinators over one folder hold one named
  session; the write port changes a to-do in one; the other's later
  autosave is refused with `WorkshopNamedSessionChangedError`, the file
  keeps the change, the other room's work is in its `current.json`;
  reloading it promotes the file and preserves its local work as a
  recovery session.
- **Overlapping writes** (D6a): both writers validate before either
  claims; exactly one commits, the other is refused as `busy` in host
  words, the file is the winner's. An abandoned lock is taken over and the
  file restored.
- **The lock** (D6e): a stale release never moves a lock; a lock past
  its lease is reported as `recovery-required`, never taken; a read that
  straddles a concurrent publish answers `busy`, never `missing`; each
  explicit-recovery case, and a failing copy leaving the lock intact.
- **The recovery copy** (D6c): a refused room's edits survive in its own
  recovery session after another write replaces `current.json`.
- **Unverified** (D8b): busy at hydration, then readable and matching:
  `applied` and Undo, with no replay.
- **Restart** (D8a): a `saving` row with no stamp in the file reads
  `interrupted` and is never retried; one whose stamp is there reads
  `applied`, and Undo works on it; a to-do the writer reopened is left
  open.
- A file changed between settlement and write: the row is `refused`
  (`session-changed`), nothing overwritten, and the next message says so.
- Stop before commit: nothing written anywhere. Rewind before the
  post-commit write: no write (`room-changed`).
- Bounds: the 21st change and the 11th session drop as `over-cap`.
- Undo: open room and saved; a to-do changed since refuses; Undo in a
  branch offers none for saved rows.
- The writer's own toggle clears `closedBy`.
- Conservation with the new side; `workshopTurnForWebview`; the transcript
  projection holds counts only.
- Codec: round trip; the before-fixture reads.
- Recall's modules stay read-only; the port is outside `recall/`.
- Logs hold no fixture text, note or title.

**B**
- Log: paging to the end, every hint decoding as written; `logScanCommits`
  reached; authors and subjects shown, neutralized.
- Diff: paragraph moves, adds and removals; word changes inside one;
  a long paragraph shown whole; `maxEditLength` reached; `current`; a
  continuation at a later change; a changed `current` between parts; a
  single change too big to fit; no window.
- The outer alignment's ceiling (D13a): `alignParagraphs` and
  `paragraphEditLength` refuse apart from `maxEditLength`; a continuation
  does not rerun the alignment.
- Ids: bad form, ambiguous prefix, not in this file's history, each refused
  before the fake port is called; git receives the full hash.
- Files: excerpt (file, selection, pasted), configured, free path refused.
- Each unavailable reason answers in words (a fake port).
- No `from 'vscode'` in core; `diff` imported only by the diff module; the
  manifest declares no untrusted-workspace support.
- Logs hold no id, subject, author, path or diff text.

**C**
- Scan: hidden, `node_modules`, build output, `prose-minion/` and links
  skipped; each bound reached and said.
- Checker: each unsafe form refused before normalization; a comma refused;
  unmatched dropped; overlap flagged on both; a group left out unchanged;
  a group whose patterns all drop keeps its value.
- An incomplete check (D22a) leaves its group unchanged at review and
  Apply; a completed zero-match search drops its pattern.
- `matchPatterns` and the catalog agree for the same patterns; the
  settings path is unchanged.
- Helper: the worked example decodes; an unknown group is a fault; a
  cut-off reply is dropped.
- Apply: only ticked groups; a group changed since is left with words; a
  workspace-set group is not offered and is refused if sent; a failed write
  stops the rest.
- The sheet and the card go through one checker and one write.
- C2: the family's codec, paging, hints; the trailer, its card and its
  outcome kind; conservation; the before-fixture.
- Logs hold no folder, file name, path or pattern.

## Amendments after review (PR #286)

Reviewed at `c7c09d4`. Four findings, all accepted. Decisions keep their
numbers; the changes are new sub-decisions.

| Finding | What was wrong | Resolved in |
|---|---|---|
| F-01 (P1) | The named-session compare is an awaited check followed by an overwriting rename, so two windows can both pass it and the later rename wins silently. | **D6a:** every named-session writer claims the file (`StoredFileRewrite`/`StoredFileClaims`); an overlapping-writes witness; external sync out of scope. Context item 1 corrected. |
| F-02 (P1) | A `saving` row can outlive a restart with no way to settle it, and a blind retry could close a to-do the writer reopened. | **D8a:** an `operationId` on the row and stamped into `closedBy`; reconciliation reads `applied` or `interrupted`, never replays; Undo checks the stamp. |
| F-03 (P2) | Only the word stage had a work ceiling; the paragraph alignment could run long, and again on each continuation. | **D13a:** `alignParagraphs` and `paragraphEditLength`, a refusal in words, and a per-window cache so a continuation does not realign. |
| F-04 (P2) | The checker's counts-only mode treats a failed search as zero matches, so Apply could cut a group to a subset. | **D22a:** `matchPatterns` reports `incomplete` apart from `unmatched`; such a group is left unchanged at review and Apply. |

**Re-review** ([report](../pr-reviews/pr-286-workshop-persona-tools-spec-rereview.md),
at `5769e7ca`'s parent): F-03 and F-04 closed; three findings, all accepted.

| Finding | What was wrong | Resolved in |
|---|---|---|
| 1 (P1) | The shared claim stages outside it and recovers an expired claim, so a writer paused past the lease could recreate a session another window deleted. | **D6b:** named sessions get their own lock directory; the staged file sits inside it under the owner's token, so a takeover removes it and a stale publish finds no source. The shared `StoredFileRewrite` is unchanged; its own exposure is tech debt. Witness: pause, lease expiry, takeover and delete, resume, publish fails. |
| 2 (P1) | A refused room's recovery copy was `current.json`, which is the workspace's and another coordinator can replace. | **D6c:** a refused save writes at once to a new named "(local recovery)" session by a non-overwriting create; one per refusal episode. |
| 3 (P2) | A temporarily unreadable target settled a row as terminal `interrupted`, removing Undo for good. | **D8b:** `unverified` is kept apart from `interrupted`, reconciled again read-only, never replayed. |

**Second re-review** ([report](../pr-reviews/pr-286-workshop-persona-tools-spec-rereview-2.md)):
D6c and D8b closed; two findings on D6b, both accepted.

| Finding | What was wrong | Resolved in |
|---|---|---|
| P1 | `prior.json` and the lock directory were reusable paths, so a retired owner's claim, cleanup or release could remove the successor's rollback copy or lock. | **D6d:** every owner artifact under `.<name>.lock/<token>/`; destructive steps act only on what the owner detached by a unique rename; witness: a retired owner's delayed work leaves the successor intact. |
| P2 | While a takeover held the lock aside, a reader saw neither file nor lock and could detach an open room. | **D6d:** the takeover renames the lock to a `.<name>.recovering-*` marker directory; readers are `busy` while it stands; witness: a reader during recovery. *(Superseded by D6e.)* |

**Third re-review** ([report](../pr-reviews/pr-286-workshop-persona-tools-spec-rereview-3.md)):
two findings, both accepted, through the simpler slice the review proposed.

| Finding | What was wrong | Resolved in |
|---|---|---|
| P1 | Release detached the canonical lock before checking ownership, so a retired owner could move a successor's whole lock. | **D6e:** no automatic takeover; release deletes only token-named paths and then the directory non-recursively; witness: a stale release never moves a lock. |
| P2 | A reader could combine misses across a recovery transition and detach the room. | **D6e:** `missing` is decided only while holding the lock, after a second read; a lock past its lease is `recovery-required`, recovered only by the writer's confirmed **Recover…**; witnesses: a straddling read, a lease-expired lock, each recovery case. |

## Consequences and risks

- **A persona can change saved files of the writer's,** without a confirm.
  The change is small, shown on a receipt, undone in one press, and never
  overwrites a changed file. A room in another window that held the
  session sees its save refused and must reopen; that is the existing
  behavior for any change on disk, now reachable from a persona.
- **A saved session's `updatedAt` moves** when a persona closes one of its
  to-dos, so it rises in the recency list.
- **One new runtime dependency** (`diff`), small and pure.
- **History reads run git through VS Code** in trusted workspaces only. A
  rename cuts a file's history short.
- **Context paths applied at the user level change every project.** The
  review says so; a group the workspace sets is never written.
- **`SettingsStore` gains a method;** every host implements it.
- **A window that dies mid-save leaves its session `recovery-required`**
  (D6e) until the writer presses **Recover…**. Unattended recovery is
  traded for never losing or resurrecting the writer's data.
- **Named-session writes take a lock** (D6a, D6b). Every save, rename and
  delete of a named session costs a few more renames and a small
  directory, and a write can be `busy` for a moment while another window
  writes. A refused room creates a recovery session (D6c), so Sessions can
  gain "(local recovery)" entries.
- **Five operations, two families and two trailers are added;** the
  persona prompt grows by three grammar files. All are pinned.
- **Older builds cannot open a session** holding the new fields or cards:
  the forward-only rule already in force.

## Open questions for Okey (work proceeds on the default)

None blocks the epic. Each default below is in the README's table.

- **Q1.** A saved row still `saving` when the next message is built is
  told as "being saved" (D7). The alternative waits for it.
- **Q2.** Rewind past a receipt keeps the to-dos closed (D5). The
  alternative reopens the open room's to-dos the reply closed.
- **Q3.** `history.log` does not follow renames (D12). Following them
  needs `git log --follow`, which the Git extension's API does not offer.
- **Q4.** A group the workspace sets is not offered (D25). The alternative
  is the workspace-level write L1 defers.


## Addendum, 2026-11-27 · Read a file’s Problems

A Workshop host or guest can ask for `problems.read` when discussing highlights or other diagnostics. The file selector follows D11. `excerpt` resolves the file or selection captured for the requesting turn through the existing excerpt authorization. A configured group and path resolve one catalog entry. This makes the same file available to different Workshop sessions with independent conversations.

The extension queries the current VS Code window for diagnostics published on that one URI. A result identifies the diagnostic’s source, severity, location and message, with a bounded quote when the corresponding text buffer is available. Workshop’s own message already includes the persona, set title and note. Each request samples the current editor state. Results can change after edits, clears or diagnostic updates between pages. A read opens no editors and triggers no analysis.

The application treats diagnostic messages, sources and quoted passages as external data. It fits whole entries in the available evidence budget, discloses omissions and gives a continuation when more can be read. A successful read of a file with zero published Problems is distinguishable from an unauthorized target or an unavailable provider. Only the invoking persona receives the tool evidence through the existing private conversation mechanism. The persisted tool card and transcript summarize the operation. The change introduces no cross-session lookup of saved conversations or new diagnostic store.

The [design and verification cases](../../.todo/epics/epic-workshop-persona-highlights/file-problems-runway.md) cover a two-room read, a second diagnostic provider, authorized file selection and a fresh read after clearing a set.
