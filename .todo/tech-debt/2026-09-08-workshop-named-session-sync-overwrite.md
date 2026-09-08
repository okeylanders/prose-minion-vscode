# Workshop named session overwritten after Git sync

Status: review remediation implemented locally including approved F-03 recovery policy; manual verification and manuscript restoration not performed.

Priority: High

Related files: `WorkshopSessionPersistenceCoordinator.ts`, `WorkshopSessionStore.ts`,
`WorkshopSessionMessageHandler.ts`, `WorkshopSessionPersistenceIntegration.test.ts`.

Completion criteria: publish and re-review remediation, and complete manual VS Code checks. Keep this item active until those
criteria are met; F-10/F-11 and baseline hashing remain deferred in the review ledger.

The incident and initial reproduction below describe the pre-fix behavior.
The implementation follows [ADR 2026-09-08](../../docs/adr/2026-09-08-workshop-named-checkpoint-authority.md).

## Confirmed incident

On September 8, 2026, Workshop overwrote an incoming named session after Git
updated that file while the room was already open. The startup divergence guard
did not protect this later write.

Workspace: `/Users/okey.landers/GitHub/the-heart-parchment-chronicles`

Session: `prose-minion/sessions/20260904-195401-chapter-6-2-bridge-leveling-9-3.json`

Identity: `3f2bba7a-4aae-4ded-8245-f8d093ebaeff`

All times below are America/Chicago (UTC-05:00).

| Time | Evidence |
| --- | --- |
| 09:28:02.603 | Local session restored; a resume marker was appended. Prose Minion logged hydration and `current.json + named session committed`, reason `resume marker`. |
| 09:39:39 | Manuscript Git reflog records `pull --tags origin main: Fast-forward`, from `8d97d74` to `47261ff`. The incoming named session has 82 turns. |
| 09:40:57.119 | Context refresh appended a context-change marker to the stale live room. Prose Minion logged `current.json + named session committed`, reason `context files refreshed`. |
| 09:40:57.145 | Named file save timestamp; the named file now contains 33 turns. |

The 31 original local turns exactly match both the pre-pull Git version and the
first 31 incoming turns. The damaged file consists of those 31 turns plus the two
local markers. **51 incoming turns are absent**, explaining the net count change
from 82 to 33. The named file equals `current.json` after removing `savedAt`.
The full file was overwritten, not merely its derived summary.

The 82-turn session remains intact in manuscript Git HEAD (last session-changing
commit `8bd66dd`). The active extension log identifies version 2.2.4 running from
`prose-minion-vscode/apps/vscode-extension`, i.e. the development checkout.

Log evidence:

- `/Users/okey.landers/Library/Application Support/Code/logs/20260903T093032/window12/exthost/output_logging_20260908T092800/1-Prose Minion.log`: lines 1–3, 8, 15, 105, 112.
- Same window's `vscode.git/Git.log`: pull at 09:39:39 and subsequent file inspection.
- Same window's `exthost.log`: extension activation at 09:28:00.980.
- Manuscript repository reflog and committed/working session comparisons.

## Code paths

`WorkshopSessionPersistenceCoordinator.initializeOnce()` checks named/current
equivalence only during initialization. Equivalent copies authorize later named
autosave through `activeNamedSessionId`. Divergent copies detach named autosave,
but **still hydrate current.json**; an existing test explicitly expects that
stale-current behavior. This also violates the requested named-file precedence.

`markDirty()` retains the associated ID and writes the live snapshot to
`current.json`, then calls `store.updateNamed()`. It never verifies that the
named checkpoint still matches the revision previously loaded or written.
`updateActiveNamedSession()` has the same missing external-change protection.

`WorkshopSessionStore.updateNamed()` verifies session identity and overwrites the
file. `requireNamedSessionPath()` can authorize the cached path from a matching
summary session ID without rereading the full checkpoint. An incoming Git version
has the same ID, so identity validation cannot detect this conflict. Atomic rename
prevents partial JSON writes; it does not prevent stale whole-file replacement.

## Reproduction and validation

Two temporary Jest probes confirmed:

1. Start with equivalent named/current checkpoints, initialize and flush, replace
   the named checkpoint with incoming content using the same session ID, then
   mark dirty for a context refresh and flush. The incoming content is replaced
   by the stale room.
2. Start with already divergent checkpoints. Initialization preserves the named
   file but restores stale current content into the live room.

Both probes and the existing coordinator suite passed: 2 suites, 34 tests. The
probes assert the existing defects, not desired behavior. They were removed from
the repository after the run; a copy is retained with the local evidence below.
No production code changed, and no model calls were made.

## Required correction

- Treat a valid, uniquely identified named checkpoint as authoritative during
  automatic restore. Timestamps and transcript length must not decide precedence.
  A malformed or ambiguous named checkpoint must not authorize a fallback write
  from current.json.
- Track the authoritative checkpoint revision accepted on load/successful write.
  Before any replacement of a named checkpoint, detect external modification
  against that baseline using the full file, not its derived summary. Pause the
  conflicting save and preserve both versions. This must cover explicit Save as
  well as autosave. Define the filesystem commit race guarantees explicitly;
  a pre-write read alone does not make compare-and-swap atomic against Git.
- Surface the conflict in the UI. If live edits exist, preserve them separately
  before adopting the named file; do not silently destroy either branch of work.
- Add regressions for sync before startup, sync after startup before autosave,
  sync before explicit Save, unchanged named files during normal autosave,
  mismatched/unchanged summary files, and invalid or ambiguous named targets.
- Update existing tests and documentation that designate current.json as the
  recovery authority when the named file differs.

## Evidence preservation and recovery

Read-only copies of the damaged full file, damaged summary, current.json, and both
HEAD files are stored in:

`/private/tmp/workshop-session-investigation-20260908-2tmo5yfq/`

That directory also contains SHA-256 hashes and the temporary Jest reproduction.
Temporary storage is evidence for this investigation, not a durable backup policy.

The manuscript files were not changed. To recover safely, first stop the active
Workshop extension host so stale in-memory autosave cannot repeat the overwrite.
Then restore the named full file and derived summary from Git and deliberately
open the named session so current.json/live state are promoted from it. Restoring
the named file while the stale room remains active is insufficient.


## Development validation

Implemented in the existing `writer-profile-20k` checkout, without committing or
publishing. Startup and webview load prefer the named file. Revealing a retained
Workshop tab invokes the same load route. Named updates require an unchanged
full-checkpoint baseline and recheck it immediately before rename; successful
named writes precede the rolling mirror. Failed replacements retain rollback
state and report the error through the existing session UI.

- Full Jest run: 209 suites, 2,346 tests, 2 snapshots passed.
- Core, webview, and extension type checks passed.
- Lint passed with zero errors (repository warnings and exported-name mock warnings remain).
- Development build and bundle verification passed (three webpack size warnings).
- `git diff --check` passed.
- Corrected an existing writer-profile test's obsolete 1,001-character invalid
  fixture to use the configured maximum plus one; no profile runtime behavior changed.

The regression suite covers the 82-turn incoming file, named precedence despite
newer local timestamps, Git changes after initialization, retained-tab reveal,
resume-write revalidation, stale autosave/Save/Rename rejection, summary
mismatch/absence, changes during temporary-file preparation, malformed/deleted
files, rolling-write recovery, active-run exclusion, and context-load ordering.

For manual verification, restart the Extension Development Host to load the new
bundle. Use disposable test sessions: restore a stale current file alongside a
longer named checkpoint and verify the longer transcript plus one resume entry;
then hide the tab, externally replace its named checkpoint, and reveal it again.
Confirm the named content is loaded before context refresh and that a stale save
reports a conflict rather than replacing externally changed content. The final
read/rename concurrency limitation is documented in the ADR.
