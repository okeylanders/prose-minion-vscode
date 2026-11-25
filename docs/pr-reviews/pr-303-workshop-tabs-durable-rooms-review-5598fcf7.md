# PR #303 · Workshop tabs 02: durable rooms

**Independent reviewer:** GPT-6.2 Astra  
**Verdict: Request changes before merging into `epic/workshop-tabs`.**  
**Reviewed:** `0830be3c554ed5f1bc31d4940a074dc3c1b25633` → `5598fcf748b23b893114a04259b0af3cf9eb0c33`, 12 changed files.

The legacy/UUID split is compatible with existing scratch files. Two cooperating writers racing for one slot no longer silently replace each other, and a failed disk write retains the previous checkpoint. The new close barrier is a genuine improvement. Two additional offline contract checks exposed failures in the new recovery/ownership paths, even though all six focused upstream suites pass.

### F1 · P1 · A named room's newest edit can have no durable copy

`packages/core/src/application/services/workshop/WorkshopNamedSessionRecoveryCopy.ts:53–78`; `WorkshopSessionPersistenceCoordinator.ts:1930–1945` (same directory). Two windows have the same named room. B saves; A's first refused edit is correctly forked to recovery. If another window then edits or renames that recovery, A's next recovery update refuses its old baseline. The code mints a new copy only for a **rolling** refusal, not for a named one. The fallback scratch write now also refuses because B changed that slot. Nothing persists A's latest edit. In the supplemental in-memory filesystem test, the named files and rolling file held “Local version one”, “Other writer”, and “Other writer”; none held “Local version two.” The live room is still dirty, but host loss now loses that revision.

On a confirmed conflict or disappearance of a recovery file, allocate a fresh non-overwriting recovery for either source; keep the existing recovery and the winning named/rolling checkpoints. Report a preservation success only after the latest checkpoint commits. Extend the existing named-recovery suite with the second edit and verify all three versions after a fresh store opens.

### F2 · P1 · The shared ownership queue opens a gap in the workspace guard

`packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:384–399,1740–1748`; `WorkshopNamedSessionOwners.ts:13–17`. The per-room queue checks the accepted workspace **before** joining the shared queue, not when it gets to run. A sibling can hold that queue across asynchronous work. If the workspace changes while waiting, a queued save can resolve paths under the new workspace. For example, Save as New calls the store without another workspace check; owner bookkeeping still uses the old workspace. A read-only sentinel queued on the exact saved-session operation path returned the replacement workspace instead of rejecting. No real disk mutation was necessary to observe the mismatch.

Recheck the initiating room's accepted root inside the shared gate, immediately before invoking queued work. Bind filesystem destinations to that root or revalidate at commit when later awaits can cross another root change. Gate with a held sibling operation and an A→B workspace swap: refuse the queued save and leave both workspaces' files and ownership unchanged.

### F3 · P2 · A rolling lock abandoned by a crashed host has no supported recovery path

`packages/core/src/infrastructure/storage/WorkshopNamedSessionLock.ts:219–224,276–289,345–353`; `WorkshopSessionStore.ts:293–311`; `WorkshopNamedSessionRecovery.ts:189` (same directory). Every rolling publish now acquires a persistent claim. A host exiting after acquiring it can leave the directory behind. Expiration does not release it: acquisition returns “recovery required,” the rolling store translates that into an ordinary conflict, and the recovery scan expressly excludes rolling filenames. Even after all windows restart, this slot can be read but not updated. Named recovery forks preserve some edits; they do not repair the slot. For legacy this affects existing single-tab users too.

Offer an explicit, fenced rolling repair or replacement-slot flow. Distinguish a stale claim from an ordinary version conflict and never forcibly retire a live writer. Include an abandoned claim fixture, an intact prior checkpoint, a fresh host and a successful later edit; retain the active-claim refusal as its negative control. This finding is from code tracing, not a live host crash.

### F4 · P2 · A confirmed rolling conflict has no terminal close outcome

`packages/core/src/infrastructure/storage/WorkshopSessionStore.ts:272–279,291–305`; `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:594–605,657–667,716–725`. After a genuine change on disk, the losing store keeps its old expected revision. This correctly fences the winner, but a successful recovery fork is followed unconditionally by an error: each later close retries the same unwinnable comparison and remains dirty. For a successful named write with a disputed rolling mirror, the authoritative data is durable but the pending mirror likewise never clears. Save as New cannot repair the disputed rolling association either. The shipped integration test explicitly expects continued close rejections at lines 862–871. Contrast a temporary I/O failure, where retry really can succeed. Without a repair decision, a retaining registry cannot release this room/claim normally, and shutdown can keep reporting failure even after the work has a verified recovery.

Return a distinct, actionable fork outcome (including its durable identity) or allow safe explicit adoption into a fresh slot. Do not mark the original slot saved or refresh its baseline blindly. Test a terminal close/reopen of the *forked* room, including a named-file-success/mirror-conflict case; the winner's bytes must remain unchanged.

### Relation to #301 and integration scope

- **Scratch fence:** passes the principal legacy/UUID and absent-file races with independent stores; the remaining problems concern repeated recovery, interrupted publication, and closing after a definitive conflict.
- **Close durability:** the coordinator now joins prior room operations and detects dirty revisions, a pending mirror, or a protected dirty checkpoint. The real-store fixture demonstrates a held operation, persistent I/O error, another scratch room draining, and recovery on retry. That does not exercise the live host retaining and reattaching a room. The shared owner is a single window-wide queue; the passing “other room drains” case holds a local context operation, not a long-running shared owner operation.
- **Not failures of this sprint:** room factory/panel wiring, picker retention for failed or ephemeral rooms, Lightbox and usage belong to subsequent composition work. In particular, a resolved close with zero/multiple roots is not evidence of a disk commit; the host must retain these in-memory rooms per the amended ADR.

### Verification

Verified PR base/head against GitHub. Applied the patch to the cached source and independently matched Git blob hashes for **all 12 changed files** to the pinned head. The cached baseline's release-only delta to the PR base did not change the persistence code or tests exercised here. With cached dependencies and an isolated Jest cache: **6 upstream suites, 153 tests passed** (coordinator, persistence integration, session store, named lock, named recovery copy, saved-session to-dos across windows). Separately, **2 reviewer-authored contract assertions failed**, as documented in F1 and F2. The durability fixture used the real coordinator and storage implementation over the repository's in-memory filesystem, not a physical two-window VS Code session. No full-suite run, paid/live providers, remote writes or merge.
