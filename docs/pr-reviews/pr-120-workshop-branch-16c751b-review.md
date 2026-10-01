# PR Review — Workshop Rewind and Branch: Sprint 03 Branch and release readiness

**Author:** okeylanders · **PR:** [#120](https://github.com/okeylanders/prose-minion-vscode/pull/120) (Open)
**Branches:** `sprint/workshop-rewind-and-branch-03-branch` → `epic/workshop-rewind-and-branch`
**Base:** `5fb85a00270c1763b92f13b1263bacb413a73f2a` · **Head:** `16c751b9edea778316775d13a9462d65a89b0c89`
**Scope:** 68 files · +3,366 / −430 · 15 commits
**Reviewed:** 2026-10-01 · **Mode:** quick Ada Forge review, with an independent correctness pass over routes, webview flows, widget restoration, and time-notice lifetimes. Format follows the recent reviews in this directory; this is a focused review, not the full specialist panel.
**Re-reviewed:** 2026-10-01 · **Head:** `8f4186faf8aa9e1a1f3137a57d30a9423b82522b` · **Delta:** five fix/documentation commits after the published report `97530338`. The original findings below describe `16c751b9`; current dispositions and new evidence are recorded in the ledger and re-review section.
**Final re-review:** 2026-10-01 · **Head:** `a640deff48df186f7bfd89ba963233a94362c96f` · **Delta:** commit-boundary fix `47979f11` and its documentation commit. All three findings are independently verified as addressed at this head.

## Resolution ledger

Status legend: **Open** = actionable recommendation with the deadline below · **Partially addressed** = verified improvement with a remaining gate · **Deferred** = an explicitly accepted follow-up · **Addressed** = fixed · **N/A** = praise or no action. No new deferral has been accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Branch can overwrite the only complete checkpoint after an external source-file change | Original source-change and late-mirror scenarios now have passing regressions; both independent late-race probes preserve the full room | **Addressed and independently verified** (2026-10-01, `16ea5f2` + `47979f1`, final re-review at `a640deff`) — the early no-write check remains; the late guard reaches the store's existing `beforeCommit` hook after the temporary snapshot write and immediately before rename. Source loss during mirror read or rolling temporary write now keeps `current.json` and prior runtime histories, removes the temporary file, and reports the saved branch as not opened. Permanent coordinator/store tests and an independent review confirm ordering and rollback |
| F-02 | 🟡 Standard | Reopening a widget edit retains the later chat target and can send the edit to the wrong participant | Real-coordinator Rewind and Branch probes, plus commit-handler dispatch tracing | **Addressed and independently verified** (2026-10-01, `ed576c3`, re-review at `8f4186f`) — composer and widget edits restore the addressee through `addresseeOf` / `repairedChatTarget`. New regressions cover later guest/tool targets and both operations; the original independent reproduction now passes. Host fallback is preserved |
| F-03 | 🟡 Standard | Rewind leaves old time notices attached to personas whose replacement history import degrades | Real-coordinator host-only degradation probe; guest imports preserved | **Addressed and independently verified** (2026-10-01, `0af3539`, re-review at `8f4186f`) — degraded persona keys join cut-dropped keys inside the transaction before writing. Tests cover host/guest degradation, survivor notices, durable state, and rollback; the original independent reproduction now passes. Open/Branch/refresh resume behavior is covered, and the archived debt is qualified |
| F-04 | 🟢 Praise | One replacement transaction protects the prior runtime histories through installation and durable promotion | Source tracing and passing rollback tests | N/A — preserve |
| F-05 | 🟢 Praise | Branch reuses the cut oracle, and the UI uses the host's authoritative verdicts and snapshots | Seventeen-rest-point proof, route/UI tests, and source tracing | N/A — preserve |

**Current verdict:** Approve for integration into the epic branch. F-01, F-02, and F-03 are addressed and independently verified; no additional actionable finding was identified in the remediation. Manual Extension Development Host smoke remains a separate pending release gate. This verdict does not perform or authorize a merge or release.

---

## Verification actually run

Original checks performed against `16c751b9`, before adding this report:

| Check | Result |
| --- | --- |
| Local checkout equals live PR head `16c751b9edea778316775d13a9462d65a89b0c89` | ✅ |
| GitHub `verify` at that head | ✅ Success; no existing PR comments or submitted reviews when checked |
| `npm test -- --runInBand` | ✅ 228 suites / 2,704 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension projects passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,030 warnings. Baseline lint was not rerun, so no independent warning-delta claim is made |
| `npm run build` | ✅ Extension/webview webpack builds and `verify:bundle` passed; webpack reported bundle-size warnings |
| `git diff --check 5fb85a0...16c751b9` | ✅ |
| Additional real-coordinator reproduction suite | ✅ Six probes passed by asserting the defective observations described below: three source-file scenarios, two widget-target scenarios, one import-degradation scenario |
| Independent review | Confirmed widget-target and time-notice defects with isolated regression expectations that fail on this head; no production changes |
| Live provider calls, Extension Development Host smoke, visual/accessibility inspection | Not performed |

The probes used the existing `WorkshopCoordinatorHarness`, real aggregate, real in-memory filesystem/store, `ConversationManager`, and time service. The source and widget probes ran the production coordinator without injecting its result. The notice probe injected only a supported host import-degradation outcome, importing the other histories normally. These are deterministic boundary reproductions, not evidence of a live provider failure. Temporary reproduction tests were removed from the checkout; this publication contains only the report.

The checkout initially contained the existing untracked prompt-cache feature directory, ZIP, and conversation-ownership document. They remain outside this review and publication. No implementation files were changed.

Governing material reviewed: `AGENTS.md`, live PR metadata/description, changed production code and relevant tests, [ADR 2026-09-30](../adr/2026-09-30-workshop-rewind-and-branch.md), the epic/Sprint 03 plan, archived widget/time debt, release notes, the manual checklist, and the recent PR-review format.

---

## Re-review — `8f4186f` (2026-10-01)

The three fixes are small and use the existing seams. Widget edits now share the composer edit's addressee repair. Rewind clears time notices for personas whose imports degrade, preserving successfully imported personas and restoring notice state on write failure. The independent review reran both original reproductions with their intended behavior assertions: both pass. No additional finding was identified in F-02/F-03.

Branch now reads its source before saving and again after import. New coordinator tests verify missing, corrupted, and earlier valid source files; unchanged full room/rolling checkpoint/history bindings on refusal; Save-as-new recovery; and deletion during branch saving or import. The route distinguishes a changed source from an ordinary saved-but-not-opened failure. These improvements are verified.

### F-01 remaining gate — run the source check at the rolling-file commit boundary

**Files at this head:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:704-705`, `:435-442`; `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts:219-228`, `:879-883`.

`promoteNamedSession` awaits `beforeReplacingCurrent` and then calls `mirrorNamedCheckpoint`. That mirror still awaits a read of the new **branch** file, followed by the store's write of a `current.json.tmp-*` file and its rename. Neither operation rechecks the original source. A source change in either intervening await therefore passes both new checks while occurring before the full rolling checkpoint is replaced.

Two real-store probes scheduled the same external source deletion at those remaining seams:

| Change scheduled after the second source check | Observed |
| --- | --- |
| While completing the branch-file read used by the final mirror | Branch succeeds; source is missing; `current.json` is the cut branch; the original final turn is absent; only the branch is listed; no recovery notice |
| After writing the rolling temporary file, before its rename | The same loss and successful result |

Both probes assert that exactly two source checks completed, proving the new guards ran. They inject filesystem timing, not a fabricated branch result. This is a remaining part of F-01, not a new finding about a later external deletion after Branch has completed.

**Recommended completion:** Thread the Branch source guard through the rolling mirror into `writeCurrent` and the store's existing `beforeCommit` seam, which runs after the temporary snapshot write and immediately before the atomic rename. Keep the early check for a no-write refusal. A failed final check should retain the full rolling file, clean up its temporary file, restore prior runtime bindings, and return the source-changed saved-but-not-opened result. Add regressions for both late seams. This follows the store's existing optimistic commit-check pattern used by `updateNamed`; it does not require a new replacement transaction or global filesystem locking.

### Re-review verification actually run

| Check | Result |
| --- | --- |
| Local checkout equals live PR head `8f4186faf8aa9e1a1f3137a57d30a9423b82522b`; GitHub `verify` | ✅ Matching head; CI success |
| `npm test -- --runInBand` | ✅ 228 suites / 2,719 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,030 warnings |
| `npm run build` | ✅ Webpack and `verify:bundle` passed |
| `git diff --check 97530338...8f4186f` | ✅ |
| Independent F-02/F-03 reproductions | ✅ Two intended-behavior assertions now pass |
| Late-mirror reproduction suite | ✅ Two probes pass by asserting the remaining defective outcomes above |
| Live providers / manual host smoke / visual inspection | Not performed |

Author-recorded mutation checks were not repeated during this re-review. Temporary probes were removed from the checkout; only this report is changed by the reviewer. The unreadable browser row is now explicitly tracked as [Low-priority debt](../../.todo/tech-debt/2026-10-01-workshop-browser-lists-unreadable-session.md), separate from the source-preservation gate. The expanded seven-scenario manual checklist still shows pending results.

### Author response — `47979f1` (2026-10-01)

The remaining gate is implemented as recommended. `WorkshopSessionStore.writeCurrent(session, { beforeCommit })` passes the hook to the existing atomic writer. `mirrorNamedCheckpoint` forwards it, and `promoteNamedSession` gives it Branch's source guard in place of the post-import check, so the guard runs between the temporary write and the rename. The early, no-write check is unchanged.

- **New regressions** (`WorkshopSessionBranchCoordinator.test.ts`): the source is deleted while the mirror reads the branch back, or right after the rolling temporary file is written. Each test asserts the source-changed not-opened result, the unchanged room, histories and `current.json`, an openable branch, and no leftover temporary file.
- **Store test:** a throwing `beforeCommit` sees the staged snapshot, keeps the old `current.json` and leaves no temporary file.
- **Mutation checks:** moving the guard back before the mirror (as at `8f4186f`) fails exactly the two late-seam tests, and dropping the late guard fails all four mid-branch tests. Ignoring the hook in `writeCurrent` fails the store test.

Verification is listed in the PR description.

---

## Final re-review — `a640deff` (2026-10-01)

**F-01 is resolved.** Source checks retain the early refusal before Branch writes anything and now use the store's actual commit boundary for the final refusal. The guard flows through `promoteNamedSession` → `mirrorNamedCheckpoint` → `writeCurrent` → `writeJsonAtomically`, after the final mirror read and temporary snapshot write. A throwing guard leaves the old rolling checkpoint intact, cleans up the temporary file, and triggers the existing room rollback before the coordinator advances accepted checkpoint state or retires prior conversations.

The two previous late-change probes were replayed at the same I/O seams with the intended preservation assertions. Deleting the source during the final branch-file read or rolling temporary write now produces `WorkshopBranchNotOpenedError` with refusal `source-changed`. Both probes verify byte-identical original `current.json`, unchanged aggregate, original host binding/history, unchanged active conversation count, no temporary-file residue, and a valid saved cut branch available for later opening. The independent review also ran eight relevant changed-source/commit-hook tests across two suites; all passed. Ordinary Open and mirror callers supply no guard and keep their existing behavior.

This is the repository's established optimistic filesystem commit check, matching `updateNamed`; it is not a transaction or lock across the source and rolling files. No further filesystem operation in Branch's replacement path intervenes between the completed source check and the rolling rename. External edits after that commit remain separate events.

| Check at `a640deff` | Result |
| --- | --- |
| Local checkout equals live PR head; GitHub `verify` | ✅ Matching head; CI success |
| `npm test -- --runInBand` | ✅ 228 suites / 2,722 tests / 2 snapshots passed |
| `npm run typecheck` | ✅ Core, webview, and extension passed |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,030 warnings |
| `npm run build` | ✅ Webpack and `verify:bundle` passed |
| `git diff --check 6a9ddef0...a640deff` | ✅ |
| Independent replay of both late-race probes | ✅ Two tests now pass with the intended preservation assertions |
| Independent commit-boundary review and targeted tests | ✅ No new finding; two suites / eight relevant tests passed |
| Live providers / manual host smoke / visual inspection | Not performed; the seven-scenario manual checklist remains pending |

Author-recorded mutation checks were not repeated. The temporary independent probe was removed from the checkout; this review publication changes only this report. The earlier re-review and original findings remain in the report as historical evidence; their loss descriptions no longer describe the final reviewed head.

---

## Executive briefing

The main design is coherent: Branch exports the live room, applies the same pure cut as Rewind, saves a fresh named envelope, then opens the file through named-session promotion. Failed promotion restores the prior room while leaving the saved branch available. The shared transaction also brings New's reset prelude inside rollback protection.

The missing safety check is on the source side. An in-memory named-session id and clean local revision counters do not establish that the full source still exists on disk. Branch verifies its new file during promotion, but never verifies the original file before replacing the rolling checkpoint. That distinction matters in a product that supports Git synchronization and already implements named-checkpoint authority elsewhere.

The two other findings concern information carried across replacement: a widget edit needs its original addressee just as a composer edit does, and a persona with no replacement history needs its old delivery notice cleared regardless of whether the cut or import removed that history.

---

## Findings

### F-01 · 🟠 High · Verify the durable source before Branch replaces its rolling recovery

**File:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:975-983`, `:1005-1011`.

**Affected contract:** Branch preserves the complete source session, including every turn after the chosen cut.

`branchFrom` accepts `activeNamedSessionId` plus clean local dirty flags as proof of a saved source. It never reads that source or compares it with `acceptedNamedCheckpoint`. Those values stay unchanged when Git or another process deletes, corrupts, or replaces the source file while the room is open. Successful promotion then writes the cut branch into `current.json` and discards the full room's runtime conversations. The same-session local-recovery safeguard in `promoteNamedSession` does not apply: the branch has a new id, and the source has no local dirty flag.

**Reproduction:** Save and open the canonical scripted room as `source`. Without changing the live aggregate, externally alter its named file, then branch after the `prose report` rest point. All three cases succeeded:

| External change after Open | Observed after Branch |
| --- | --- |
| Delete the source JSON through the filesystem | Only the cut branch is listed as a named session; `current.json` now holds the branch; the original later turns have no saved checkpoint |
| Replace the source bytes with invalid JSON | The source cannot be opened; `current.json` now holds the cut branch; no complete recovery copy is created. Its stale browser index can still advertise the source |
| Replace the source with an earlier, valid checkpoint of the same id | Both named sessions remain valid, but neither holds the original later turns; `current.json` also holds only the cut branch |

Each probe confirmed the original final turn was absent from the branch/rolling checkpoint and that no recovery notice was produced. The delete case uses the filesystem directly; it does not call the coordinator's deliberate Delete action, which would detach the association. Ordinary bubble Branch has no fresh listing or source-read gate that catches this change.

This is loss of the complete local session after an external change, not a claim that Branch itself writes the original named file. The “later turns stay in” success copy becomes false.

**Recommended fix:** Revalidate the source's existence, readability, and accepted checkpoint identity within the serialized operation before replacing the live room/rolling checkpoint. Refuse and retain the full room when the source is missing or changed, or preserve a complete recovery checkpoint through an explicit recovery path. Keep Branch's rule that it never writes the source. Because branch saving/import can await, cover a source change during those awaits as well as one before the request; checking only the cached id or newly saved branch is insufficient.

Add permanent coordinator regressions for these three source changes. Assert refusal or complete recovery, preservation of the old rolling checkpoint and runtime histories when refusing, and honest result copy. Existing source-byte-equality tests are valuable but assume the source remains intact throughout.

### F-02 · 🟡 Standard · Restore the widget message's addressee before reopening it

**Files:** `packages/core/src/application/services/workshop/session/WorkshopSessionRewind.ts:174-175`, `:206-209`, `:259`; dispatch in `packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts:162`, `:186-188`.

The transform restores the original message's target only when `composerRestoreFor` returns a value. Widget messages deliberately return no composer restore, so the newly added `widgetRestore` leaves the room's later `chatTarget` in place. Reopening the config does not carry a separate target; recommit reads `session.getChatTarget()`.

**Reproduction:** Start a scripted room, send a host message, invite Margot, commit a widget to the host, then send a later message to Margot. Save/open the room and cut before the widget's writer message. Both `rewindTo(..., { origin: 'writer' })` and `branchFrom(...)` return the correct widget config, but the installed target is `{ kind: 'personaGuest', personaId: 'margot' }`. The edited host message would therefore recommit to Margot. If the later target were a surviving tool, the widget handler would instead refuse the commit as `tool-target`.

**Recommended fix:** Recognize widget restoration when selecting the edited message's addressee, and apply the existing `addresseeOf` / `repairedChatTarget` logic to both edit forms. Preserve the host fallback if the original addressee no longer survives. Add Rewind and Branch regressions with a later target change; the existing widget tests check reopening but omit this routing consequence.

### F-03 · 🟡 Standard · Clear notices for persona histories lost during import too

**File:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:923-929`.

Rewind clears notices only for `cutRoom.summary.droppedConversationKeys`. A persona can survive the pure cut but lose its replacement history during `installRoom`. This is a supported outcome: `AssistantToolService.importWorkshopConversationArchive` independently degrades a key when its current prompt cannot be rebuilt. The successful rewind then retires the prior conversation, yet the time service keeps the notice delivered to it.

**Reproduction:** Keep a host and Margot in a saved scripted room, commit both time notices, and inject host-only import degradation while importing Margot normally. Rewind after the host's widget reply. The host is absent from the transform's dropped-key list, present in `outcome.degradedConversationKeys`, and has no runtime conversation. Its old notice remains in `personaNotices`; `time.prepareNotice('host')` returns `undefined`. Margot retains her conversation and notice as expected. A new host started within the hour consequently receives no initial time frame.

**Recommended fix:** Clear the persona keys from both the transform's dropped keys and the installation's degraded keys inside the existing rollback transaction, before the durable write. Preserve notices for successfully imported personas. Add host/guest degradation coverage and a write-failure rollback assertion. The [archived time-notice debt](../../.todo/archive/tech-debt/2026-09-30-workshop-time-notices-outlive-conversations.md) claims this lifecycle issue resolved; if the remaining case is deferred, reopen it and qualify that claim explicitly.

### F-04 · 🟢 Praise · Replacement keeps the rollback histories alive

`replaceLiveRoom` captures both aggregate/bindings and temporal delivery intent, restores them after a failed replacement, and retires superseded conversations only after success. Branch distinguishes an unsuccessful save from a saved branch that failed to open. Existing transform/write/import/hydration/mirror fault tests exercise meaningful boundaries. This ownership remains useful while fixing F-01.

### F-05 · 🟢 Praise · The oracle and authoritative UI protect the central cut behavior

Branch's seventeen-rest-point proof compares the persisted room/archive with the Rewind oracle and checks the fresh envelope, cut summary, and intact source. The webview uses the unfiltered host verdict map for Branch, so the latest reply remains eligible; busy/storage gates and the save-first popup are consistent. It installs the host snapshot before reopening edited content. Those contracts should be retained while extending coverage to F-01–F-03.

---

## Plan corrections and existing follow-ups

| Item | Assessment |
| --- | --- |
| One private replacement helper; no new collaborator class yet | Matches the confirmed kickoff decision; [coordinator ownership](../../.todo/tech-debt/2026-10-01-workshop-persistence-coordinator-ownership.md) is already tracked |
| Refuse unsaved changes without writing the source | Correct rule; F-01 completes the external-source side of its prerequisite |
| Read the branch back and use Open's promotion | Correctly opens what Sessions would read, with a separate saved-but-not-opened outcome |
| Fresh branch temporal envelope, source timezone, no lineage | Matches the recorded Sprint 03 decisions |
| Reopen only the widget message's own cut; silently release skipped-past configs | Accepted residue is documented; F-02 concerns the reopened edit's target, not that accepted residue |
| Prepend the What's New page and bump notice version to `v4` | Matches the explicitly confirmed departure from the unimplemented notice-ledger plan |
| Leave changelogs under `[Unreleased]` and retain the Git-sync upgrade warning | Correct release-preparation boundary |

The [manual smoke checklist](../../.memory-bank/20261001-1105-workshop-rewind-and-branch.md), now expanded to seven scenarios, remains pending. Branch lineage, the action screenshot, release version selection, and epic archival retain their documented dispositions; this review does not accept new deferrals or authorize merge/publication.

---

## Report card

| Dimension | Assessment |
| --- | --- |
| Preservation / named authority | A− — F-01 resolved through early source validation and the established optimistic commit check |
| Replacement / rollback | A — source refusal preserves the full rolling file and prior histories, with temporary-file cleanup verified |
| Edit and participant lifetimes | A− — F-02/F-03 resolved with regression and independent reproduction evidence |
| Tests | A− — all 2,722 tests and other automated gates pass; late-mirror regressions and independent replays now cover the reported gaps |
| Architecture / scope | A− — shared transform/promotion and explicit ports; large coordinator ownership is already tracked |
| Presentation / release evidence | B+ — authoritative gates and release notes are coherent; manual/visual evidence is pending |

The report card reflects final re-review at `a640deff`; the earlier narrative/findings are retained as historical evidence. No implementation fixes, merge, or release actions were performed by the reviewer.
