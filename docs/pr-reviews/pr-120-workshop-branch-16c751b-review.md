# PR Review — Workshop Rewind and Branch: Sprint 03 Branch and release readiness

**Author:** okeylanders · **PR:** [#120](https://github.com/okeylanders/prose-minion-vscode/pull/120) (Open)
**Branches:** `sprint/workshop-rewind-and-branch-03-branch` → `epic/workshop-rewind-and-branch`
**Base:** `5fb85a00270c1763b92f13b1263bacb413a73f2a` · **Head:** `16c751b9edea778316775d13a9462d65a89b0c89`
**Scope:** 68 files · +3,366 / −430 · 15 commits
**Reviewed:** 2026-10-01 · **Mode:** quick Ada Forge review, with an independent correctness pass over routes, webview flows, widget restoration, and time-notice lifetimes. Format follows the recent reviews in this directory; this is a focused review, not the full specialist panel.

## Resolution ledger

Status legend: **Open** = actionable recommendation with the deadline below · **Deferred** = an explicitly accepted follow-up · **Addressed** = fixed · **N/A** = praise or no action. No new deferral has been accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Branch trusts a stale named association and can overwrite the only complete checkpoint after an external source-file change | Three real-store probes: deleted, unreadable, and replaced-with-earlier source | **Open** — fix before integration |
| F-02 | 🟡 Standard | Reopening a widget edit retains the later chat target and can send the edit to the wrong participant | Real-coordinator Rewind and Branch probes, plus commit-handler dispatch tracing | **Open** — fix before release; recommend in this PR |
| F-03 | 🟡 Standard | Rewind leaves old time notices attached to personas whose replacement history import degrades | Real-coordinator host-only degradation probe; guest imports preserved | **Open** — complete the lifecycle fix before release, or explicitly reopen its debt record |
| F-04 | 🟢 Praise | One replacement transaction protects the prior runtime histories through installation and durable promotion | Source tracing and passing rollback tests | N/A — preserve |
| F-05 | 🟢 Praise | Branch reuses the cut oracle, and the UI uses the host's authoritative verdicts and snapshots | Seventeen-rest-point proof, route/UI tests, and source tracing | N/A — preserve |

**Verdict:** Request changes before integration. F-01 breaks Branch's central preservation promise under supported external file/Git changes. F-02 and F-03 are bounded correctness gaps in the new widget-edit and time-notice work. Automated gates pass, but do not cover these scenarios. Manual Extension Development Host smoke remains pending separately.

---

## Verification actually run

Checks performed against the reviewed implementation head, before adding this report:

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

The six-scenario [manual smoke checklist](../../.memory-bank/20261001-1105-workshop-rewind-and-branch.md) remains pending. Branch lineage, the action screenshot, release version selection, and epic archival retain their documented dispositions; this review does not accept new deferrals or authorize merge/publication.

---

## Report card

| Dimension | Assessment |
| --- | --- |
| Preservation / named authority | C — full-source preservation is unproved after external file changes; F-01 reproduces loss |
| Replacement / rollback | A− — coherent shared transaction and failure tests; source prerequisite needs the separate gate |
| Edit and participant lifetimes | B — normal edit flow works; widget target and degraded-history notices need correction |
| Tests | B+ — all automated gates pass and the cut oracle is strong; six additional probes expose uncovered boundaries |
| Architecture / scope | A− — shared transform/promotion and explicit ports; large coordinator ownership is already tracked |
| Presentation / release evidence | B+ — authoritative gates and release notes are coherent; manual/visual evidence is pending |

These assessments apply to the inspected head and stated review scope. No fixes, merge, or release actions were performed as part of this review.
