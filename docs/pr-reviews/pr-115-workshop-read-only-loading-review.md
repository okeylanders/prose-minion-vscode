# PR Review — Keep Workshop session loading read-only and show startup progress

**Author:** okeylanders · **PR:** [#115](https://github.com/okeylanders/prose-minion-vscode/pull/115) (Open)
**Branches:** `fix/workshop-startup-loading` → `main`
**Base:** `43002b4` · **Head:** `33e447f029b3296fc71a4be11cb1d413d7627d99` (verified against `origin/fix/workshop-startup-loading` before review) · **Scope:** 27 files · +623 / −65 · 2 commits (`5b158d5` persistence/loader, `33e447f` stale-status fix)
**Reviewed:** 2026-09-10 · **Mode:** single-reviewer deep read (Ada Forge). No reviewer subagents were launched, by request. The `mr-review` skill was read for its severity bar and ledger format only.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable · **Decision** = needs Okey's call before it can be Open or N/A.

| ID | Sev | Finding | Verdict | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Startup mirror failure (named changed during provider setup, or `current.json` write failure) leaves a stale hydrated room with a second `session_start` marker, drops the named association so reveal never adopts the newer file, and swallows the recovery notice for a recovery file that was already written | ✅ Confirmed by probe | **Addressed — re-review pending** — retain hydrated room/association/resume; retry cache independently; preserve committed recovery notices through failure |
| F-02 | 🟠 High | A verified clean cache now suppresses **startup** recovery for autosaved work whose named file was later reverted by Git; before this PR startup preserved it conservatively | ✅ Confirmed by probe | **Addressed** — Accept approved by Okey; Git-revert consequence documented and regression tested |
| F-03 | 🟡 Standard | Save-as-new rejects with the rolling write error after the named file already exists and the live identity has moved; the writer is told the save failed | ✅ Confirmed by probe | **Addressed — re-review pending** — named save succeeds; cache failure reported separately and retried without another named write |
| F-04 | 🟡 Standard | Startup now awaits `ensureAssistantReady` for every named session, including archive-free ones; a provider-init rejection turns a previously fine restore into the F-01 protected state | 🔎 Traced | **Addressed — re-review pending** — mirror no longer invokes provider readiness; archive-free rejection guard tested |
| F-05 | 🟡 Standard | Test gaps on the new failure surface: startup write failure, save-as-new rolling failure, dropped recovery notice, provider-init rejection, rollback of `localWorkPending`, resume marker after a failed first interaction | — | **Addressed — re-review pending** — real-store startup/save/rollback/V1/failed-interaction coverage and route error-boundary checks added |
| F-06 | 🟡 Standard | Manual Refresh with no disk changes but with failures issues two `markDirty` calls and therefore two named writes per click | 🔎 Traced | **Addressed — re-review pending** — manual warning path schedules one dirty revision |
| F-07 | 🔵 Nit | `awaitingInitialSession` re-covers the room with the loader if a startup error is dismissed before any session state arrives; the one host path that can do this (`waitForSessionOperations` rejecting) sits outside the handler's `try` | 🔎 Traced | **Addressed — re-review pending** — initialization await moved inside try; state/notices/scan completion covered on failure |
| F-08 | 🔵 Nit | Save-as-new advances `writtenRevision` even when the rolling mirror was skipped because `current.json` is protected, so `hasPendingWrite()` reports clean while the mirror is stale | 🔎 Traced | **Addressed — re-review pending** — pending mirrors tracked separately; protected rescue remains pending without overwriting original |
| F-09 | 🔵 Nit | `.memory-bank` note says "Changes remain uncommitted" and cites a `/private/tmp` evidence file that is not in the repo | — | **Addressed — re-review pending** — publication/manual verification notes updated; temporary evidence identified as ephemeral |
| F-10 | 🟢 Praise | Rolling provenance is stripped at three independent boundaries (hash helper, coordinator recovery save, store `saveNamed`/`updateNamed`), so the marker cannot leak into named bytes even if one caller forgets | — | N/A — preserve |
| F-11 | 🟢 Praise | Optimistic named-write checks are untouched: `acceptedNamedCheckpoint` is only ever assigned from a named read or a successful named write, and `mirrorNamedCheckpoint` rechecks the source after the async gap | — | N/A — preserve |
| F-12 | 🟢 Praise | Status-ordering fix is minimal and correctly placed: clear on `scanning:true`, never on `scanning:false`, and `handleSessionState` does not touch status, so fresh scan results survive completion | — | N/A — preserve |

---

## Verification actually run

Checks performed on head `33e447f` in this review session:

| Check | Result |
| --- | --- |
| `git rev-parse origin/fix/workshop-startup-loading` equals expected head | ✅ |
| `npm ci` then the 7 touched Jest suites (persistence coordinator, persistence integration, context handler, session routes, `WorkshopApp`, `useWorkshopRoomAndSessions`, `useWorkshopSessions`) | ✅ 7 suites / 148 tests passed |
| `npm run typecheck:core` | ✅ exit 0 |
| Four throwaway probe tests against the real `WorkshopSessionStore` + `MemoryFileSystem` (written, run, deleted; not committed) for F-01, F-02, F-03 | ✅ ran; results quoted inline below |
| Full suite, webview/extension typecheck, lint, build | ❌ not run here; relying on the PR's stated 210 suites / 2,379 tests |
| Manual VS Code verification | ❌ not performed; the tech-debt note's manual acceptance list remains pending |

Documents read in full: ADR 2026-09-10 (read-only loading), ADR 2026-09-08 (named authority), ADR 2026-07-14 diff, `.todo/tech-debt/2026-09-10-workshop-loading-git-churn.md`, the PR description, and the complete diff of both commits.

---

## Executive briefing

The design is sound and the implementation matches the ADR on the seven required behaviors. I walked each one:

1. **Named stays authoritative; loading mirrors without touching named.** ✅ `mirrorNamedCheckpoint` writes only `current.json` with the original named payload plus the hash; `hydrate` no longer records a resume marker or schedules an autosave; `time.touch()` is gone from the load path. The integration test asserts byte equality of the named file across load, discard, sync, restart.
2. **Automatic rereads stage; author activity or Save/Refresh persists.** ✅ `origin === 'session-open'` produces no event turn and no `markDirty`; `refreshContextFileAttachments(inputs, undefined)` still bumps the context revision so the model receives the update on the next host turn; `capture()` reads the live attachments, so any later `markDirty` or explicit Save persists them.
3. **Resume appears once before the first message/tool/guest interaction.** ✅ `resumePending` is set in `hydrate`, consumed in `beginInteraction`, cleared by `recordStartMarker`, and captured/restored by rollback. All three room-handler call sites sit after validation and before the user turn. The elapsed interval is measured from `startedAt`, not `lastActivityAt`, so intervening `touch()` calls do not distort it (I checked this specifically).
4. **Clean caches follow named without recovery; unsaved work stays recoverable.** ✅ at reveal and for the Git-pull-replaces-named case. ⚠️ At startup the same rule now also drops autosaved work whose named file was *reverted* (F-02). Legacy caches without a marker remain conservative.
5. **Provenance never weakens optimistic write checks.** ✅ (F-11).
6. **Loading visible after dismissing What's New; errors release it.** ✅ with one dismissal edge (F-07).
7. **Open/New/scan-start clears stale status; fresh results survive.** ✅ (F-12).

What needs attention before merge is the **failure branch of the new startup mirror**. The PR moved a write, a provider-readiness await, and a disk recheck into `initializeOnce`, but the surrounding `catch` still behaves as if hydration itself had failed. The result (F-01, confirmed by probe) is a room that shows stale content with two start markers, no named association, no recovery notice, and no path back except an explicit Open. Nothing is lost on disk, but the writer is not told that, and the retained-tab reveal that ADR 2026-09-08 relies on for adoption is disabled for the rest of the host lifetime.

---

## Findings

### F-01 · 🟠 High · Startup mirror failure produces a stale, orphaned, double-started room

**Files:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:282` (mirror call inside the startup `try`), `:295-302` (catch clears association, protects, records a start marker), `:323-331` (`mirrorNamedCheckpoint`: awaits provider, rechecks named, writes current).

**What changed.** Before this PR, startup did `hydrate()` and nothing else could throw after hydration. Now three new awaits follow a successful hydrate: `ensureAssistantReady`, `readNamedCheckpoint`, and `store.writeCurrent`. All three reject into the pre-existing catch, which was written for "restore failed before the room existed".

**Failure scenario (probe P1, confirmed).** `current.json` holds unsaved local work; the named file changes on disk while `ensureAssistantReady` is pending (a Git pull finishing during activation, which is exactly the incident shape this PR targets). Observed after `initialize()`:

```text
excerpt:            "Old"                      (first read, not the incoming file)
turns:              [session_start, session_start]   (a second start marker appended to hydrated content)
protectedErr:       "The saved Workshop session changed on disk. Reopen the session..."
notices:            []                         (but "named (local recovery)" WAS written to disk)
refreshNamedSession: false                     (association dropped; reveal will never adopt "Incoming")
beginInteraction:   undefined                  (no resume marker will ever be recorded for this room)
```

**Failure scenario (probe P2, confirmed).** Same setup, `writeCurrent` rejects with `EACCES`: identical outcome (double start marker, protected, `refreshNamedSession` → `false`).

**Why it matters.**
- The writer sees the older named content and has no signal that a newer one exists or that a recovery file was created for them. `pendingRecoveryNotices` is only pushed after the mirror succeeds.
- `activeNamedSessionId = undefined` disables `refreshAssociatedNamedSession` for the rest of the extension-host lifetime, so the "retained-tab reveal adopts Git changes" guarantee from ADR 2026-09-08 silently stops holding.
- Save from this state throws "The saved session changed before it could be updated" (no active named id), pushing the writer toward Save-as-new and a duplicate file.
- The transcript gains a `session_start` divider after hydrated turns, which is semantically wrong and will be persisted by the next author action.

**Existing coverage.** `WorkshopSessionPersistenceCoordinator.test.ts:448` covers only the named-changed branch and asserts protection plus explicit-Open retry. It does not assert transcript shape, notice delivery, the dropped association, or the write-failure branch.

**Recommended fix.** Split the startup `try` so post-hydration failures are handled on their own terms:
- On `WorkshopNamedSessionChangedError` from the mirror: re-read the named file and loop once or twice (bounded), or keep `activeNamedSessionId`/`acceptedNamedCheckpoint` as read so the next reveal promotes the newer file. Do not record a start marker onto a hydrated room.
- On `writeCurrent` failure: keep the association and the hydrated room, set `currentCheckpointError` (autosave pause is the right consequence), and skip the start marker.
- Push `recoveryNotice` before the mirror, or in both success and failure branches, so a file that was written is always announced.
- Add a regression test per branch asserting turns, notices, `refreshNamedSession()` result, and `beginInteraction()`.

---

### F-02 · 🟠 High (Decision) · Clean provenance now suppresses startup recovery for autosaved work whose named file was later reverted

**Files:** `WorkshopSessionPersistenceCoordinator.ts:263-270` (startup skips `preserveDisplacedLocalSession` when the cache is clean), `:1241` (every successful autosave writes a clean mirror).

**Failure scenario (probe P4, confirmed).** Writer opens a saved session, has a conversation; autosave writes the named file and a clean `current.json` (`cleanAfterAutosave: true`). Writer then runs `git checkout -- prose-minion/sessions/` or drops a stash, reverting the named file to its committed form. Restart:

```text
turnsAfterRestart: 1     (the conversation is gone from the live room)
recoveryFiles:     ["named"]   (no "(local recovery)" copy)
notices:           0
currentTurns:      1     (current.json overwritten with the reverted named payload)
```

The autosaved turns exist nowhere on disk after this sequence. Before this PR, startup had no accepted baseline and "other divergence is conservatively preserved" (ADR 2026-09-08), so a recovery copy would have been created.

**Why I'm not calling this a bug.** The ADR is explicit: a matching marker "proves the rolling state was already saved and can be replaced by incoming named state without recovery", and reveal already behaved this way for a room equal to its accepted baseline. The writer deliberately discarded the file. The September 10 incident is the case where preserving that discarded content was *unwanted*.

**Why it needs a decision.** "Was saved" is not "is still saved anywhere". The discard in the incident was of resume/notice noise; a discard of real turns is the same Git gesture. The marker cannot distinguish them, and the PR description says only that "unsaved author work remains recoverable", which a writer may read as "anything I typed is safe". Options:
- **Accept** (current PR): document in the ADR consequences and the changelog that reverting a named file via Git after autosave discards those turns from the cache with no recovery. One sentence each.
- **Narrow**: treat clean-but-recovery-different as recoverable only when the rolling cache is *newer* than the incoming named (compare `updatedAt`/`savedAt`); the ADR currently forbids timestamp heuristics, so this would be an ADR amendment.
- **Soft-preserve**: keep a single rotating `current.previous.json` written before any startup mirror overwrite, no notice, no list entry. Cheap insurance that never manufactures a named file.

My recommendation is Accept plus the documentation, given the ADR's stated principle and the fact that the room-level Git workflow already implies this for reveal.

---

### F-03 · 🟡 Standard · Save-as-new reports failure after the named file exists and identity has moved

**File:** `WorkshopSessionPersistenceCoordinator.ts:452-459`.

Before this PR, `saveNamed` called `markDirty('named save identity')` and returned; the rolling mirror ran on the autosave queue and any failure surfaced as a save-status error while the returned summary stayed valid. Now the mirror is awaited inline after `identity`, `activeNamedSessionId`, and `acceptedNamedCheckpoint` have already been reassigned.

**Failure scenario (probe P3, confirmed).** `writeCurrent` rejects once with `disk full` during Save-as-new:

```text
err:          "disk full"          (handleSaveSession posts action failure "save")
listed:       ["Named it"]         (the named file exists)
pendingWrite: false                (nothing will retry the mirror)
currentTitle: "Untitled session — Jill — Sep 8"   (current.json still points at the old room id)
```

The writer sees "save failed", the Sessions list shows the file anyway, and a restart restores the *untitled* room from the stale `current.json` with no association to the file that was just created. The next `markDirty` does heal it (`writeNamedWithRollingRecovery` mirrors again), so this is confusion rather than loss.

**Recommended fix.** Either return the summary and report the rolling failure through `emitSessionSaveStatus({ status: 'error' })` (matching `writeNamedWithRollingRecovery`'s "authority and durability are separate" comment), or wrap the mirror so its failure does not reject the save. Add a test for the new-save path; the existing rolling-failure test at `WorkshopSessionPersistenceCoordinator.test.ts:481` exercises only the update path.

---

### F-04 · 🟡 Standard · Startup now depends on provider initialization for every named session

**File:** `WorkshopSessionPersistenceCoordinator.ts:326`.

`hydrate` awaited `ensureAssistantReady` only when the checkpoint carried conversation archives. `mirrorNamedCheckpoint` awaits it unconditionally, and at startup that sits inside the F-01 catch. `AIResourceManager.startRebuild` rethrows on any build failure (a missing API key does not throw, but a bad model selection or a SecretStorage error does). A named session with no archives that restored cleanly before this PR now lands in the F-01 state on the same host.

This is also on the UI critical path: `handleRequestSession` awaits `waitForSessionOperations()` → `initialize()`, so the new loader stays up until provider init settles. That is acceptable, but it is a behavior change the PR description does not mention.

**Recommended fix.** Fold into F-01: if the mirror needs provider readiness only to keep the recheck honest after an async gap, consider `readNamedCheckpoint` first and `ensureAssistantReady` only when archives exist (mirroring `hydrate`'s own rule), or treat a readiness rejection as "skip the mirror, keep the association" rather than "restore failed".

---

### F-05 · 🟡 Standard · Tests miss the realistic failure paths the PR introduced

The new coverage is good on the happy and adversarial-content paths (tampered hash, failed named save, discard/pull/restart, resume ordering, status ordering). It is thin exactly where the PR added new awaits:

| Missing case | Why it matters |
| --- | --- |
| Startup `writeCurrent` rejection (F-01/P2) | New write on a path that previously had none |
| Startup mirror failure after a recovery copy was written (F-01/P1 notices) | Recovery file exists, writer never told |
| `ensureAssistantReady` rejection at startup for an archive-free session (F-04) | Regression from pre-PR behavior |
| Save-as-new rolling failure (F-03) | Only the update path is tested |
| Rollback of `localWorkPending` after a failed `promoteNamedSession` | Private flag; observable only by a *subsequent* promote producing (or not producing) a recovery copy |
| First interaction fails before commit (`AgentRunUnavailableError` path) | Resume marker was posted to the webview; assert it persists on the rollback `markDirty` and is not re-minted |
| Legacy V1 `current.json` (migration path) with a present named file | Confirms "one conservative recovery" rather than a decode-time hash mismatch surprise |

---

### F-06 · 🟡 Standard · Manual Refresh with failures writes twice

**File:** `packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts:350` and `:358`.

When `updates.length === 0` and `failures.length > 0` on a manual refresh, the handler calls `markDirty('context refresh accepted')` and then `markDirty('context file refresh warning')`. Each bumps `dirtyRevision`; the autosave queue writes both revisions, so one click costs two named writes and two optimistic rechecks. The new "accepted" call is needed to persist staged state; the warning call could be dropped when the accepted call already ran. Cost only.

---

### F-07 · 🔵 Nit · Dismissing a startup error before session state re-shows the loader

**File:** `packages/core/src/presentation/webview/WorkshopApp.tsx:457`.

`awaitingInitialSession = !sessionReady && !errorMessage`. `handleRequestSession` posts session state in its own `catch`, so in practice `sessionReady` arrives with the error. The one path that skips both is `waitForSessionOperations()` rejecting at `WorkshopSessionMessageHandler.ts:128`, which is outside the `try`. If that ever throws, the webview shows nothing; if it later shows an error some other way, dismissing it (or any of the actions that call `setErrorMessage('')`) re-covers the room with an unbounded loader. The test at `WorkshopApp.test.tsx:138` asserts the error state but not the post-dismissal state. Moving the await inside the `try` closes it.

---

### F-08 · 🔵 Nit · Save-as-new marks the revision written when the mirror was skipped

**File:** `WorkshopSessionPersistenceCoordinator.ts:454-459`.

When `currentCheckpointError` is set, the mirror is skipped but `writtenRevision = dirtyRevision` still runs, so `hasPendingWrite()` is `false` while `current.json` still describes the previous room. `promoteNamedSession` clears the protection on the next Open, so this is bounded, but `flush()` will never retry the mirror. Consider leaving `writtenRevision` alone on the skipped branch.

---

### F-09 · 🔵 Nit · Memory-bank note is stale and cites an out-of-repo evidence path

`.memory-bank/20260910-workshop-read-only-loading.md` says "Changes remain uncommitted" and points at `/private/tmp/workshop-20260910-y0eoi2wn/investigation.md`, which cannot be reached from the repo. The ADR and tech-debt note cite the same path. Either copy the relevant evidence into `docs/` or note that it was ephemeral.

---

### F-10 · 🟢 Praise · Provenance stripping is defense in depth

`withoutRollingProvenance` is applied in `cleanRollingCheckpoint` (recompute), `preserveDisplacedLocalSession` (recovery save), and both store write paths. `hasSameWorkshopRecoveryContent` also drops it. A future caller that forgets still cannot leak the marker into a named file.

### F-11 · 🟢 Praise · Named-write authority is untouched

`acceptedNamedCheckpoint` is assigned only from `readNamedCheckpoint` results or a `checkpoint` that `store.updateNamed` just accepted. The hash is never consulted on a write path, and `mirrorNamedCheckpoint` preserves the original named payload rather than a re-captured projection, which removes the old "promote an obsolete read" hazard.

### F-12 · 🟢 Praise · Status fix is exactly as small as it should be

One `clearStatus` seam on the replacement port, called from `openSession`, `beginReplacement`, and `scanning: true`. `handleSessionState` does not touch status, `handleSessionActionResult` does not touch status, so the scan's own `sendStatus` survives. The hook test at `useWorkshopRoomAndSessions.test.ts:717` pins all three triggers and the survive-through-completion case.

---

## Decisions for Okey (resolved in remediation)

1. **F-02:** accept that a verified clean cache drops autosaved-then-Git-reverted turns at startup (document it), narrow with a timestamp rule (ADR amendment), or add a silent `current.previous.json` safety copy.
2. **F-01 shape:** on a startup mirror failure, should the room keep its named association and let reveal adopt later (my recommendation), or is "protected and detached until explicit Open" the intended contract? The existing test encodes the latter; the ADR 2026-09-08 reveal guarantee implies the former.

## Straightforward fixes (original review recommendations; resolution above)

- F-01 mechanics: no start marker after a successful hydrate; push the recovery notice regardless of mirror outcome; add branch tests.
- F-03: do not reject Save-as-new on a rolling mirror failure; report via save status.
- F-04: gate `ensureAssistantReady` in the mirror on archive presence, or treat its rejection as "skip mirror".
- F-05 tests, F-06 double write, F-07 `try` boundary, F-08 `writtenRevision`, F-09 docs.

---

*Reviewed SHA `33e447f029b3296fc71a4be11cb1d413d7627d99`. Review only: no fixes implemented, no manuscript or session files touched, probe test file deleted before commit.*

## Remediation assessment — 2026-09-10

Okey approved named authority after Git reverts and retaining the named association
through startup mirror failure. No timestamp precedence or silent backup file was
added. The original findings above are retained as the reviewed-head record.

Implementation now separates author dirty revisions from pending rolling mirrors.
A mirror failure after successful startup hydration cannot append a start marker,
clear the resume boundary, or detach named. Reveal adopts a changed named file;
unchanged reveal and flush retry only the accepted cache payload. New author work
supersedes old cache retries. Successful named saves return their summary while
cache failures appear separately in save status, which is replayed on room request.
Protected current files remain untouched by rescue saves/flush until explicit Open
or reset. Named durability advances only the captured revision, preserving later
queued author edits. Strict optimistic named checks remain intact.

Committed recovery notices live outside hydration rollback and are delivered from
load-finally paths. A failed promotion may leave a recovery file, but its notice is
now delivered and retained work eligibility survives rollback. Manual warning
refresh emits one dirty revision. Initialization failures publish room state and
scan completion rather than leaving the loader waiting indefinitely.

Manual evidence: Okey confirmed the stale-status fix after rebuilding. Live logs
also confirmed clean-cache adoption without another recovery after the initial
legacy-cache transition. The new injected failure paths are automated evidence;
broader manual failure checks and independent remediation re-review remain pending.

Validation after remediation: 210 Jest suites / 2,397 tests / 2 snapshots passed;
all three TypeScript projects passed; lint reported 0 errors and 963 existing
warnings; build and bundle sentinels passed with existing webpack size warnings;
`git diff --check` passed. These remediation changes are included in PR #115; no manuscript files
were modified. Independent remediation review and manual failure-path checks are
still pending.
