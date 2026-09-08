# MR Review v2 — Workshop named checkpoint authority, context refresh, and writer-profile limit

**Author:** Okey Landers · **PR:** [#114](https://github.com/okeylanders/prose-minion-vscode/pull/114) · **Branches:** `writer-profile-20k` → `main`
**Head:** `cdc56d8a` · **Base:** `80e5afc3` · **Reviewed:** 2026-09-08 (America/Chicago) · **Mode:** Full, reduced panel (see coverage)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | An unrelated unreadable session file now blocks restore, protects `current.json`, and errors every reveal of an unnamed room | Orchestrator (Blake lane), Marcus scout | 1 independent · 1 runway-prompted | — | **Open** |
| F-02 | 🟠 High | Named-first ordering leaves the live room with no rolling checkpoint after any named-write failure; work after a conflict or external deletion is memory-only | Orchestrator (Blake lane), Marcus, Sam, Bria scouts | 1 independent · 3 runway-prompted | — | **Open** |
| F-03 | 🟠 High | Local-only work is displaced silently on init and reveal, with no preserved copy and no writer-visible notice; contradicts the tech-debt "preserve both versions / surface the conflict" correction | Orchestrator (Bria lane), Bria, Sam scouts | 1 independent · 2 runway-prompted | — | **Open** — product decision required |
| F-04 | 🟡 Standard | A missing named file for an associated room is reported as "changed on disk"; the association cannot be cleared through Delete or reveal | Orchestrator, Sam scout | 1 independent · 1 runway-prompted | — | **Open** |
| F-05 | 🟡 Standard | The session-open context scan runs outside both the serialized session boundary and the mutation-route guard | Orchestrator, Marcus, Sam, Stan scouts | 1 independent · 3 runway-prompted | — | **Open** |
| F-06 | 🟡 Standard | The loading overlay and `inert` content depend on a fire-and-forget `scanning:false` message that has no replay or fallback | Sam scout | 1 runway-prompted | — | **Open** |
| F-07 | 🟡 Standard | Per-autosave cost on a named room is two full reads, four decodes, and two JSON round-trips of a file bounded at 25 MB; unnamed rooms scan the whole sessions directory on every reveal | Orchestrator (Tim lane), Marcus, Stan scouts | 1 independent · 2 runway-prompted | — | **Open** — fail-fast part; **Deferred** — hash baseline, until file sizes prove it |
| F-08 | 🟡 Standard | Regression coverage misses the second-read rollback in `promoteNamedSession`, the missing-file and unrelated-corrupt-file paths, and any coordinator-plus-real-store round trip; manual VS Code verification is outstanding | Orchestrator (Cal lane) | 1 independent | — | **Open** |
| F-09 | 🟡 Standard | Documentation and process parity: CHANGELOG Unreleased omits four of five commits, no memory-bank entry, stale PR title/body, ADR header convention, unarchived tech-debt bullets, "Short" bio description at 20,000 chars, narrower Astra doc footprint | Stan, Bria scouts | 2 runway-prompted | 🧭 Corroborated Runway | **Open** — CHANGELOG/ADR header before merge; rest may ride release prep |
| F-10 | 🔵 Nit | Context refresh decides "unchanged" by body text only, unlike its excerpt sibling; a persistently refused source appends a notice turn and autosave on every scan | Sam, Stan scouts | 2 runway-prompted | 🧭 Corroborated Runway | **Deferred** — revisit with the next source-backed refresh |
| F-11 | 🔵 Nit | `inert` drops composer focus during a scan with no restoration; the overlay is otherwise accessible | Orchestrator | 1 independent | — | **Deferred** — accessibility polish |
| P-1 | 💚 Praise | The pre-rename recheck compares the full decoded destination against the accepted baseline; summary indexes never authorize a write | Orchestrator | 1 independent | — | N/A — preserve |
| P-2 | 💚 Praise | Context refresh reuses `authorizeExcerptReread` and bounded `loadFile`; no new path-trust surface, failures keep the saved snapshot | Orchestrator, Bria scout | 1 independent · 1 runway-prompted | — | N/A — preserve |
| P-3 | 💚 Praise | Named-lookup failure no longer authorizes a fallback write; the fail-closed intent is right even where F-01 shows its scope is too wide | Orchestrator | 1 independent | — | N/A — preserve |

## Review coverage

- **Panel size:** at the author's request this review ran the four runway scouts (Bria, Stan, Marcus, Sam) but **not** the ten specialist reviewers or Sensei. Findings were traced and validated by the orchestrator against raw code, with scout notes as input. Provenance is recorded honestly: "independent" means the orchestrator traced it before reading scout notes; "runway-prompted" means a scout note led to the trace. No 🎯 Consensus badges are claimed.
- **Read fully:** the complete merge-base→head diff (48 files, +1343/−297); `WorkshopSessionPersistenceCoordinator.ts`; `WorkshopSessionStore.ts` (all write/read/find paths); `WorkshopSessionMessageHandler.ts`; `WorkshopSliceComposition.ts` (mutation registrar); `WorkshopPanelProvider.ts`; `WorkshopSessionCheckpointEquality.ts`; `refreshChangedContextFiles` and `handleRereadExcerpt`; intake authorization/bounds; the aggregate's refresh/export/hydrate seams; all changed tests; AGENTS.md; both ADRs; the tech-debt note; targeted history (`7953b43`, `4cea113`, `aeea4fd`, `ec35d16`, PR #85 ledger).
- **Sampled:** CSS and card markup (visual-only); `RECOMMENDED_MODELS.md`; webview hooks beyond the changed handlers.
- **Independently verified:** `npm run typecheck` (three projects, clean); `npm run lint` (0 errors, 963 pre-existing warnings); `npx jest` (209 suites, 2,346 tests, 2 snapshots, all pass); `git diff --check` clean. These match the PR's claims. Two synthetic-fixture probes were run against the **real** store and coordinator and then deleted (working tree clean): (a) a never-named room plus one unrelated session file containing merge-conflict markers and no readable index makes `readNamedWithRecovery` throw; (b) a real-store round trip autosaves twice without a spurious conflict, and after external deletion of the named file the rolling checkpoint stops updating, reveal throws "changed on disk", and Delete cannot clear the association.
- **Not verified:** manual VS Code behavior (the PR declares it outstanding); whether `onDidChangeViewState` fires at first panel creation; whether host→webview messages are actually dropped while hidden under `retainContextWhenHidden`.
- **Blast radius:** persistence spine (coordinator/store), session IPC handler, context handler, VS Code panel adapter, six message contracts, webview shell/overlay, settings manifest, model catalog, three docs.

---

# Part I — Semantic Runway

**Thesis.** This PR is five commits wearing one branch name, but its centre of gravity is a data-integrity reversal: after the 2026-09-08 incident (Git delivered an 82-turn named session; a context refresh autosaved the stale 31-turn room plus two markers over it), the named checkpoint becomes the authority at every load, every reveal, and every write. The context-refresh, overlay, catalog, and profile-limit commits are the surface the incident happened on, not the fix. The runway therefore treats "who owns the truth of a room, and when is that checked" as the real job and everything else as its setting.

## 1. Working Definition & Real Job

- **Literal change.** Delete the startup-only equivalence guard (`hasEquivalentCheckpointState`, `isCanonicalResumeMarker`); make `initializeOnce` hydrate the named file whenever `current.json` names one; add `refreshNamedSession`/`promoteNamedSession` invoked from `WORKSHOP_REQUEST_SESSION` (webview mount, and now every tab reveal via a synthetic message from the adapter); retain `acceptedNamedCheckpoint` as an optimistic baseline; require `expected` on `updateNamed` and recheck the destination after the temp file is written, immediately before rename; commit named before `current.json`. Plus: refresh-on-open and manual refresh for file-backed context, file attachments read-only, a scan overlay, GPT-6 Astra, card polish, bio limit 1,000 → 20,000.
- **Capability.** A Git pull that replaces a named session can no longer be overwritten by a stale local room; the incoming version is adopted on the next load or reveal; conflicting writes are rejected.
- **Problem.** A writer who commits Workshop sessions and works from two machines lost 51 turns of craft conversation [Declared, tech-debt L21–34].
- **Emphasis/suppression.** The ADR's language ("regardless of timestamps or transcript length", "not automatic transcript merging") emphasizes authority and suppresses the fate of the *other* branch: the local room. The PR title and body still describe commit 2 only.
- **Must survive any alternative.** The incoming named file is never rolled backward by a stale room; a write that cannot prove its baseline is refused; a failure to read never silently authorizes an overwrite.
- **Competing interpretation.** The PR could be read as "make Git the sync layer for Workshop." The code does not support that reading: `.gitignore` is written by default (`WorkshopSessionStore.ts:824-836`), no merge exists, and the ADR disclaims merging. The narrower reading holds.

> This MR is not merely a Git-sync bug fix. Its real job is to move room authority from the machine-local rolling checkpoint to the writer-visible named file, at every point where the two can disagree, while preserving the atomic two-file snapshot, the serialized operation queues, and the fail-closed read discipline the persistence sprint established.

## 2. Declared Intent, Observed Behavior & Open Meaning

| Source | Declared | Observed |
| --- | --- | --- |
| ADR 2026-09-08 | Named wins on init and reveal; full-checkpoint baseline; named-first commit; conflicts report an error and leave the file intact; read/rename window is a platform limit | All implemented as stated (`Coordinator.ts:245-259, 326-332, 436-503`; `Store.ts:256-289, 855-887`) |
| Tech-debt "Required correction" | "Pause the conflicting save **and preserve both versions**"; "Surface the conflict in the UI. If live edits exist, preserve them separately before adopting the named file; do not silently destroy either branch of work" | Conflicting save is paused; nothing preserves the local branch; reveal-time replacement posts no notice (only `postSessionState`, `WorkshopSessionMessageHandler.ts:146`); autosave conflict surfaces as the generic save-failed chip/banner |
| PR body | Context refresh only; "wizard-generated text briefs remain editable" | True (`WorkshopSessionService.ts:527`, `useWorkshopContextSheet.ts` diff) |
| Validation claims | 209/2,346 pass; typecheck/lint/build pass | Reproduced here except build (not run; CI "verify" job ran build and passed on head) |
| CHANGELOG Unreleased | Astra + card polish | Four of five commits undocumented; the 2.2.3 entry describes the now-superseded detach design |

Open meaning: whether "replacement, not merging" was meant to include *discarding* local work, or only to decline auto-merge while still preserving the loser somewhere. The two documents in this PR answer that differently.

## 3. Business Story & Rulebook

**Actors.** The writer (subject and beneficiary); the other machine and Git (excluded actors whose writes are respected but never negotiated with); the extension host (decides authority, silently); the webview (told "scanning" and "save failed", never "replaced"); persona conversations (re-imported wholesale on promotion).

**Trigger/preconditions.** A room associated with a named file (Save, Open, or a named file matching the live id) and a workspace whose sessions directory is Git-tracked by the writer's own choice.

**Rules.** Named authoritative on init and on every request/reveal (`Coordinator.ts:250, 447-451`). Baseline is the full decoded checkpoint after JSON round-trip (`WorkshopSessionCheckpointEquality.ts:10-17`). Named commits before rolling (`:329-332, 1078-1081`). Rooms are not replaced during an active run (`Handler.ts:128,139`). Mutations are refused while a session operation is pending (`WorkshopSliceComposition.ts:275-293`). File attachments are read-only regardless of origin; refresh may grow only into free budget; a failed read keeps the saved snapshot. Bio ≤ 20,000 chars in manifest, contract, and modal.

**State transitions.** Unnamed → named via Save or via reveal finding a file with the live id; named → unnamed via Delete/Reset only; "conflict" is not a stored state, it is a per-write rejection; "accepted baseline" advances only on a successful named write, save, promotion, or init read.

**Value/harm.** The incoming transcript survives. The harm the design does not name: the local branch's work has no home once the named file has moved.

**Exceptional but legitimate states.** Duplicate ids (refused); malformed named file (refused, preserved); named file absent on disk while associated (see F-04); over-budget refresh (whole batch refused); refused source path (snapshot retained, notice turn).

## 4. Narrative Flow

- **Beginning.** Activation awaits `initialize()`; the writer reveals a retained tab, or the webview mounts.
- **Development.** `current.json` locates the id → the named file is read by id (directory scan on cache miss) → hydrate, resume marker → autosave. On reveal: `refreshNamedSession` compares disk to the accepted baseline → `promoteNamedSession` (hydrate, second read, `writeCurrent`, `writtenRevision = dirtyRevision`) → one-time context scan → `postSessionState`.
- **Turn.** For writes, the rename of the temp file after `beforeCommit` proves the destination still equals the baseline (`Store.ts:878-879`). For loads, `writtenRevision = dirtyRevision` (`Coordinator.ts:486`): every queued revision of the old room is retired.
- **Ending.** Both files equal the named room plus one resume marker (init) or `current.json` alone carries the marker until the next dirty (promotion). The writer sees the new transcript with no banner. On conflict the writer sees "Save failed" and the room stays open in memory.
- **Unresolved threads.** Work after a conflict; work in `current.json` that the named file did not contain; the composer draft across a reveal-time replacement [Unknown].

## 5. Codebase Genealogy & Controlling Precedent

- **Controlling precedent:** ADR 2026-07-14 §6, amended in place; its "current.json first" ordering came from `7953b43` (2026-07-23) with the rationale "once current.json commits, this identity is the recoverable live truth." This PR is the first inversion of that ordering.
- **Superseded design:** `4cea113` (prefer newer by timestamp) was replaced the same day by `aeea4fd` (equivalence-or-detach, v2.2.3) after release review found wall-clock ordering unsafe. This PR deletes both and adopts unconditional named authority. The v2.2.3 CHANGELOG text now describes behavior that no longer exists.
- **Siblings:** `handleRereadExcerpt` (`WorkshopExcerptScopeHandler.ts:231-306`) is the direct sibling of `refreshChangedContextFiles`; the new code reuses `authorizeExcerptReread` verbatim, batches atomically, compares body text rather than fingerprint (declared deliberate), and drops the sibling's between-await run rechecks. `seedExcerpt` is the precedent for host-minted `webview.workshop` messages; the reveal request copies its envelope.
- **Re-opened ledger:** PR #85 ledger #18 ("autosave parses the file it's about to overwrite") was resolved by `requireNamedSessionPath`; this PR deletes that and parses twice. The ADR 2026-07-14 sentence "ordinary per-turn autosave therefore does not rescan and parse every saved transcript" is now true for *every* transcript but not for *the* transcript.
- **New precedent likely to be copied:** `updateNamed(id, next, expected)` with a `beforeCommit` hook in `writeJsonAtomically` (first of its kind); `hasSameWorkshopCheckpoint` imported by both application and infrastructure; a VS Code lifecycle event driving a core route; a bare `{scanning}` lifecycle message; `inert` + `display: contents` overlay.

## 6. Structural & Causal Map

```
VS Code reveal ─┐                                   ┌─ Store.readNamedWithRecovery (scan by id)
webview mount ──┴─> WORKSHOP_REQUEST_SESSION ──> Handler.handleRequestSession
                       waitForSessionOperations ─> activeRunLabel? ─> Coordinator.refreshNamedSession [serialized]
                                                                      ├─ missing & associated → ChangedError (F-04)
                                                                      ├─ differs from accepted → promoteNamedSession
                                                                      │     hydrate → capture → 2nd read → writeCurrent → accepted=disk → writtenRevision=dirty
                                                                      └─ same → false
                       → scanContextFiles [NOT serialized, NOT a mutation route] (F-05)
                             refreshChangedContextFiles: authorize → loadFile → boundText → aggregate.refresh → markDirty
                       → flushDeferredConversationSettings → postSessionState (no "replaced" signal) (F-03)

mutation → markDirty ─> autosaveQueue: capture → requireAcceptedNamedCheckpoint → Store.updateNamed(expected)
                                          requireNamedSession (read 1) → validate → temp write → beforeCommit (read 2 + equality) → rename
                                        → accepted = checkpoint → writeCurrent          (named failure ⇒ no writeCurrent) (F-02)
```

Trust boundaries: filesystem contents are untrusted (25 MB exact bound, nesting depth, schema decode); the reveal request is host-minted; the refresh path trusts only what `authorizeExcerptReread` proves.

## 7. Contracts, Invariants & Negative Space

- **Invariants held everywhere I traced:** `acceptedNamedCheckpoint` never advances on a failed named write; a summary index never authorizes a write; the rename is the only commitment; `WorkshopSessionActiveRunPersistenceError` defers capture mid-run; rollback restores `acceptedNamedCheckpoint`.
- **Invariants held conditionally:** "no replacement during a run" holds at handler entry and structurally through `captureRollback → exportCommittedState` throwing; the coordinator itself does not check. "Mutations blocked during session operations" holds for the serialized part of a load but not for the scan that follows it.
- **Compatibility:** no schema change; v1 files decode through migration on both equality sides; `updateNamed`'s signature change is a compile-time contract every caller had to thread.
- **Negative space (deliberate):** no merge; no file watcher; no displaced-copy file; no conflict UI beyond save status; wizard-picked *files* lose editability (declared).

## 8. Forces, Tensions & Design Tradeoffs

- **Named-never-rolls-back vs local-always-has-a-checkpoint.** The PR spends the second to buy the first. Whether that spend was necessary is the review's central question (F-02): the incident's root cause was the *named* overwrite, not the ordering.
- **Strictness vs cost.** Full-decode equality is immune to summary/timestamp lies and costs decode work proportional to file size on every write and reveal (F-07).
- **One load path vs tab-switch-as-persistence-op.** Routing reveal through `WORKSHOP_REQUEST_SESSION` reuses one path and turns every tab switch into a disk read.
- **Fail-closed reads vs blast radius.** Refusing to guess when a read fails is right; refusing for *unrelated* files is the cost (F-01).
- **Alternatives:** (1) keep `expected`-checked named writes but still write `current.json` on named failure; (2) write a displaced copy with a fresh id before promotion when the local room differs; (3) hash-of-bytes baseline with full decode only on mismatch; (4) run the scan inside the serialized boundary; (5) skip the reveal lookup for unnamed rooms.

## 9. Failure, Recovery & Operational Truth

- Conflict at autosave: `Autosave failed` log, `status:'error'` chip, banner. Rolling checkpoint not updated. `flush()` at deactivate retries once and fails identically. Next start or reveal replaces the room.
- Missing named file: same error path with "changed on disk" wording; Delete throws not-found; only Save-as-new or New Session escapes.
- Unrelated unreadable file: init lands in the outer catch → empty room with a start marker, `current.json` protected; reveal of an unnamed room → route error every time, scan skipped.
- Partial write: temp file deleted best-effort; index write failure cleaned; named committed while rolling failed is recoverable next dirty (tested).
- Evidence for an on-call reader: log lines name ids and turn counts on restore/promotion but never the displaced side's turn count.

## 10. Security, Trust & Misuse Surface

Refresh reuses the same authorization as excerpt re-read: workspace containment, no symlink components, configured-resource exact match, single-root recovery; reads are size-bounded and UTF-8 decoded; empty files are refused. Session files are untrusted input and remain bounded. The host-minted reveal request cannot be spoofed from the webview any more than before. The 20,000-char bio enters every persona system prompt: a cost and prompt-injection *surface* increase for content the writer authors themselves (not an attacker path). No High or Blocking security path found.

## 11. Data, Time, Scale & Concurrency Horizon

Every host start and every promotion appends a resume marker to a Git-tracked file; two years of daily use is hundreds of divider turns and diff hunks. Reveal cost is proportional to named file size; unnamed rooms enumerate the directory (the exact scan is not bounded by `maximumFiles`). Two promise queues serialize loads against writes correctly; the gap is the scan after the boundary releases. The ADR's read/rename window is milliseconds and requires a Git write to land inside an autosave's final syscalls; practical risk is low and, unlike the incident, self-limiting (the next Git operation shows the diff). It is a genuine platform limit, distinct from the avoidable gaps in F-01 to F-04.

## 12. The Change Genome

Cousin: **write a displaced copy on replacement or conflict** (the tech-debt's own ask). Reuse: `captureRollback`/`capture` already produce the loser as a `WorkshopPersistedSessionV2`; `.gitignore` default keeps copies private. Extension: filename suffix, browser filter, a recovery-notice type. Contradiction: an identical `sessionId` would make every later exact lookup throw `IdentityConflictError`, so the copy must mint a fresh id (as `duplicateNamed` does) and the envelope's `exactKeys` rejects new provenance fields. Fork risk: adding I/O inside the rollback path. Conclusion: the PR is a deliberately narrow special case; the cousin is reachable without abstraction, but the id/envelope constraints must be designed, not bolted on.

## 13. Comparative Models & Borrowed Vocabulary

- **Internal:** `handleRereadExcerpt` — question: should "unchanged" be fingerprint-based here too?
- **Optimistic concurrency (design-by-contract):** precondition "destination equals baseline" is checked; the postcondition "the loser is preserved" is not part of the contract. Question: which document owns that postcondition?
- **Chain of custody [Analogy]:** the log records what was restored, never what was set aside. Question: can a writer reconstruct, a week later, that 12 local turns were displaced on 2026-09-08 09:28?

## 14. Creative Counterfactuals

- **Inversion (2.2.3):** one side still wins; only the side changed.
- **Deletion:** remove `acceptedNamedCheckpoint`; the irreducible need is "what did this room last agree the file said" — a byte hash could carry it.
- **Time-lapse:** markers, scans, and decodes grow with the file; nothing reaps.
- **Constraint swap:** if sessions were never Git-tracked, this PR reduces to the context-refresh commit.
- **Boring alternative:** keep current-first, add `expected` to `updateNamed`, hydrate named on load, log both turn counts. Satisfies the incident's invariant with two fewer new behaviors.

## 15. Evidence Confidence & Unresolved Questions

Repository-grounded: everything in §§1–11 cites code or tests read in full; the two probes are reproducible from their descriptions. Inferences: population of writers in a 2.2.3 detached state at upgrade; whether hidden-tab messages drop. Missing artifacts: manual VS Code verification; a memory-bank entry. Needs author confirmation: whether discarding the local branch is a decision or an omission; whether Astra's narrower doc footprint is release-prep deferral.

## 16. Past → Present → Horizon

**Past:** a two-file snapshot built around "current.json is local truth," patched once by timestamp and once by equivalence-or-detach, both blind to a pull after startup. **Present:** named authority at every touchpoint, optimistic writes, fail-closed reads; the local branch has no durable home when the two disagree. **Horizon:** the `expected`/`beforeCommit` pattern will be copied to other files; the reveal-as-load pattern will invite "refresh X on focus" cousins; a displaced-copy or conflict-notice feature is the next honest step if writers keep committing sessions.

## 17. Runway Synthesis Brief

- **Invariants:** incoming named content is never overwritten by a stale room; unverifiable baselines refuse to write; reads that cannot rule out the requested id do not silently fall back.
- **Anchors:** `Coordinator.ts:245-273, 326-332, 436-510, 1056-1093`; `Store.ts:256-289, 395-439, 855-887`; `Handler.ts:126-148, 254-270`; `WorkshopPanelProvider.ts:151-163`; tech-debt L81–99; ADR 2026-07-14 L330.
- **Tensions:** named-first vs crash safety; strict equality vs cost; fail-closed vs blast radius.
- **Unknowns:** first-open duplicate request; hidden-tab message drops; upgrade population.
- **Legitimate variation points:** the equality function; the reveal trigger; the scan boundary.
- **Predicted pressures:** marker growth in Git; per-reveal decode; a third source-backed refresh copying one of two siblings.
- **Do not overread:** the store→application import is an extension of an existing exception, not a new inversion; the ADR's rename race is a real platform limit, not an implementation gap.

---

# Part II — The Review

## Executive Briefing

**Verdict:** Needs rework — contained, but two introduced data-durability regressions and one undecided product question sit on the exact path the PR exists to protect. The fixes are small; the decision is not.

- 🟠 **F-01 · Unrelated unreadable file blocks restore** — one merge-conflicted or truncated session file in the directory leaves a never-named room empty and protected at startup and erroring on every reveal. Narrow the fail-closed catch to the matching file.
- 🟠 **F-02 · No rolling checkpoint after a named failure** — after a conflict, an external deletion, or a branch switch, every later turn is memory-only until the room is replaced. Write `current.json` even when the named write fails; it is no longer an authority, so this reintroduces no overwrite risk.
- 🟠 **F-03 · Local work displaced silently** — init and reveal replace the local room with no preserved copy and no notice, including for writers upgrading from the 2.2.3 detached state. Decide: preserve a displaced copy, or at minimum post a recovery notice with both turn counts and point at Save-as-new.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus lane | B | Seams reused honestly; the scan sits outside the boundary it should share (F-05); store→application import deepened, not introduced |
| Critical Correctness — Blake lane | C+ | Two introduced regressions with reachable triggers (F-01, F-02); no corruption path found |
| Edge Cases — Sam lane | B− | Missing-file, concurrent-reveal, and dropped-message paths unhandled (F-04, F-05, F-06) |
| Code Quality — Parker lane | B+ | Clean extraction of `promoteNamedSession`; one error string tells the wrong story (F-04) |
| Tests — Cal lane | B | Store tests are excellent; coordinator gaps and fake-store-only round trips (F-08) |
| Codebase Fit — Stan lane | B | Precedent followed; docs/process parity lags (F-09); a PR #85 ledger item re-opened knowingly |
| Performance — Tim lane | B− | Fine at 82 turns; the per-write and per-reveal cost curve is new (F-07) |
| Security — Patricia lane | A− | Authorization and bounds reused; no new trust surface |
| Observability — Oliver lane | B− | Restores are logged; displacements are not; conflicts wear a generic message |
| Domain Logic — Bria lane | C+ | The tech-debt correction and the ADR disagree about the losing branch; code sided with the ADR without saying so (F-03) |

## Findings

### F-01 · 🟠 High — An unrelated unreadable session file now blocks restore and errors every reveal

**Raised by:** Orchestrator (Blake lane); Marcus scout · **Discovery:** 1 independent · 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:250` — `const named = await this.readNamedCheckpoint(current.session.sessionId);` (inside the outer try; the pre-PR inner try/catch that logged "Could not confirm named autosave target" was deleted, diff 1725–1755) · `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts:433-437` — `if (!found && entries.failures.length > 0 && !options.ignoreUnreadable) { throw entries.failures[0]; }`
**Affected contract:** startup restore and reveal for rooms with no matching named file

Trigger: any file in `prose-minion/sessions/` that is not the requested session and cannot be ruled out by a readable summary index — e.g. a session JSON left with `<<<<<<<` merge-conflict markers whose `.summary.json` also conflicted or was deleted, a truncated file, or a file over 25 MB without an index. Path: `findNamedSession` must full-parse it, records the failure, finds no match for the live id, and throws. On init that throw now lands in the outer catch (`:264-273`): `currentCheckpointError` is set, `current.json` is never hydrated, the writer sees an empty room with a start marker and the protected-checkpoint banner, and rolling autosave is paused. On reveal of a never-named room, `refreshNamedSession` rethrows, the handler reports "Could not load the saved Workshop session" every time and skips the scan and settings flush. Confirmed by a synthetic probe against the real store. Introduced by this PR (the inner catch existed at base). The store's behavior is defensible (it cannot honestly say "not found"); the coordinator's response is wider than the ADR's intent, which was to stop an unreadable *matching* file from authorizing a fallback write.

**Recommendation:** In `initializeOnce`, catch the named lookup separately: on failure, log it, leave `activeNamedSessionId`/`acceptedNamedCheckpoint` undefined, and hydrate `current.json` (autosave then goes to `current.json` only, so the named file is untouched — the incident cannot recur from this path). In `refreshNamedSession`, when the room is unassociated, treat a lookup failure as "cannot confirm": log and return `false`. Keep the throw for associated rooms. Add the probe as a store/coordinator regression.

### F-02 · 🟠 High — Named-first ordering leaves the live room with no rolling checkpoint after any named-write failure

**Raised by:** Orchestrator (Blake lane); Marcus, Sam, Bria scouts · **Discovery:** 1 independent · 3 runway-prompted · **Confidence:** High
**Evidence:** `WorkshopSessionPersistenceCoordinator.ts:326-332` — `await this.store.updateNamed(namedSessionId, checkpoint, expected); this.acceptedNamedCheckpoint = checkpoint; } await this.store.writeCurrent(snapshot);` · test `preserves a Git replacement before %s` asserts `expect(current).toBe(previousCurrent)`
**Affected contract:** crash/restart recovery (ADR 2026-07-14 §1: `current.json` "is the ordered rolling checkpoint used for crash/restart recovery")

Trigger: any failure of the named write — a genuine conflict, an externally deleted file (a `git checkout` of a branch without that session, a `git rm`, a clean), a malformed replacement. Path: `updateNamed` throws, `writeCurrent` is skipped, `writtenRevision` does not advance, status `error`. Every subsequent turn repeats this; `flush()` at deactivate fails the same way. Nothing on disk records anything typed after the failure. On the next host start or tab reveal the named file (or, if missing, an error) replaces the room. Consequence: a writer who keeps working after the "Save failed" chip — or who never reveals the tab again — has memory-only work that a crash or reload destroys. Confirmed by probe (deletion case). Introduced: `7953b43` deliberately wrote `current.json` first for exactly this reason. The ADR's rationale ("a failed named write must not advance the accepted baseline") is satisfied by *not advancing the baseline*; it does not require withholding the rolling mirror. Since `current.json` is no longer an authority at load, writing it on named failure reintroduces no overwrite risk.

**Recommendation:** On named-write failure, still write `current.json` (best effort, its own try) before reporting the error, and keep `hasPendingWrite()` true so the named retry continues. Amend the ADR bullet to say the rolling mirror is written regardless. Pair with F-03's notice so the writer learns the local branch now lives in `current.json` and can Save-as-new.

### F-03 · 🟠 High — Local-only work is displaced silently, with no preserved copy and no notice

**Raised by:** Orchestrator (Bria lane); Bria, Sam scouts · **Discovery:** 1 independent · 2 runway-prompted · **Confidence:** High on behavior, Medium on population
**Evidence:** `WorkshopSessionPersistenceCoordinator.ts:250` — `const authoritative = named ?? current;` · `:486` — `this.writtenRevision = this.dirtyRevision;` · `WorkshopSessionMessageHandler.ts:129-146` — promotion result feeds only `postSessionState()` · `.todo/tech-debt/2026-09-08-workshop-named-session-sync-overwrite.md` L89–94 — "preserve both versions … If live edits exist, preserve them separately before adopting the named file; do not silently destroy either branch of work"
**Affected contract:** the tech-debt's own required correction; writer trust

Trigger A (upgrade): a writer on 2.2.3/2.2.4 whose named file diverged was, by that release's design, kept in a detached room whose work accumulated only in `current.json`. First start on this build hydrates the named file and, via the resume-marker autosave, overwrites `current.json`. The local-only turns are gone with no copy and a log line that names only the named file's turn count. Trigger B (steady state): a conflict per F-02, followed by a reveal: `promoteNamedSession` replaces the room and retires every pending revision. Trigger C: Delete the active named session, have Git restore the file, reveal — the room the writer deliberately detached is replaced by the file they deleted (`:441-451` promotes when `acceptedNamedCheckpoint` is undefined). In all three the webview receives a new transcript with a resume marker and nothing else. The ADR declares "not automatic transcript merging"; it does not declare "discard." The tech-debt note in the same PR declares the opposite. This is a product decision the code made on product's behalf.

**Recommendation:** Minimum: before promotion (init and reveal), when the live/current room differs from the named file or has pending dirty revisions, log both turn counts and post a recovery notice ("Loaded the saved version from disk (82 turns). Your previous local room (33 turns) was set aside.") with a pointer to Save-as-new. Preferred: write the displaced room as a sibling checkpoint with a fresh id (as `duplicateNamed` mints one) before hydrating; it is gitignored by default and satisfies "preserve both versions" without merging. Then reconcile the tech-debt note with the ADR so the two stop disagreeing.

### F-04 · 🟡 Standard — A missing named file is reported as "changed on disk" and the association cannot be cleared

**Raised by:** Orchestrator; Sam scout · **Discovery:** 1 independent · 1 runway-prompted · **Confidence:** High
**Evidence:** `WorkshopSessionPersistenceCoordinator.ts:442-445` — `if (!persisted) { if (this.activeNamedSessionId) { throw new WorkshopNamedSessionChangedError(); }` · `WorkshopSessionStore.ts:112` — "The saved Workshop session changed on disk. Reopen the session to load the saved version before saving again."
**Affected contract:** session action results; writer recovery path

When the named file is gone (branch switch, external delete), every reveal reports a message that tells the writer to reopen a session that cannot be opened; `deleteNamed` throws not-found so the browser's Delete cannot detach either; autosave fails per F-02. Only Save-as-new or New Session escape, and nothing says so. `deleteNamed` already models the correct end state (`:554-558`).

**Recommendation:** In `refreshNamedSession`, when the file is missing for an associated room, detach (clear both fields), write `current.json`, and post a recovery notice ("The saved file for this session is no longer on disk; autosave continues to current.json. Save to create a new checkpoint."). Give the not-found case its own error text where a throw remains. Let `deleteNamed` clear the association when the store reports not-found for the active id.

### F-05 · 🟡 Standard — The session-open context scan runs outside both guards

**Raised by:** Orchestrator; Marcus, Sam, Stan scouts · **Discovery:** 1 independent · 3 runway-prompted · **Confidence:** Medium
**Evidence:** `WorkshopSessionMessageHandler.ts:139-143` — scan begins after `refreshNamedSession` resolved (`pendingSessionOperations` back to 0) · `WorkshopSessionMessageHandler.ts:66` — `router.register(MessageType.WORKSHOP_REQUEST_SESSION, …)` (not a mutation route) · `WorkshopSliceComposition.ts:275-293` — mutation gate keyed only on `isSessionOperationPending()`
**Affected contract:** room consistency during load

`MessageHandler.handleMessage` dispatches concurrently. During the scan's file I/O, a second reveal whose `refreshNamedSession` finds a newer Git change replaces the aggregate mid-scan; the first scan's `refreshContextFileAttachments` then returns `unknown` and reports an error (`WorkshopSessionService.ts:561-563`). A `WORKSHOP_SEND_MESSAGE` in the same window passes the mutation gate; only the webview's `inert` overlay prevents it. The excerpt sibling rechecks the run guard between awaits; this path checked once, before the scan began. Reachability depends on timing, hence Medium.

**Recommendation:** Hold a session-operation token across the scan (increment `pendingSessionOperations` around it, or run the scan inside `serializeSessionOperation` through a narrow callback), and have `refreshContextFileAttachments` skip unknown ids rather than fail the batch.

### F-06 · 🟡 Standard — The overlay and `inert` content depend on a fire-and-forget `scanning:false`

**Raised by:** Sam scout · **Discovery:** 1 runway-prompted · **Confidence:** Medium
**Evidence:** `WorkshopSessionMessageHandler.ts:254-270` — `void this.postMessage(message)` for both states · `WorkshopPanelProvider.ts:147-149` — "Messages posted while an editor tab is hidden can be dropped even under retainContextWhenHidden — replay the cache on re-reveal" · `MessageHandler.flushCachedResults` does not cache `WORKSHOP_SESSION_CONTEXT_SCAN`
**Affected contract:** webview usability

If the writer reveals a tab (scan starts) and hides it before the scan finishes, and the provider's own premise about dropped messages holds, `scanning:false` is lost; the next reveal does not rescan (`initialContextRefreshCompleted` is true), so the thread stays `inert` and covered until a webview reload. Whether drops actually occur is unverified [Unknown], which is why this is Standard.

**Recommendation:** Make the busy state recoverable: post `scanning:false` unconditionally at the end of `handleRequestSession` (or carry `scanning` in `WORKSHOP_SESSION_STATE`), and let the webview clear the overlay on any session-state message.

### F-07 · 🟡 Standard — Per-write and per-reveal decode cost is new and grows with the file

**Raised by:** Orchestrator (Tim lane); Marcus, Stan scouts · **Discovery:** 1 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `WorkshopSessionStore.ts:262` (`requireNamedSession` full read+decode) and `:273-277` (`beforeCommit` full read+decode) · `WorkshopSessionCheckpointEquality.ts:14-16` (decode both sides + `JSON.parse(JSON.stringify(...))`) · `:441` → `findNamedSession` → `readNamedSessions:460-518` (exact scan, `truncated: false`, not bounded by `maximumFiles`) · ADR 2026-07-14 L330 — "ordinary per-turn autosave therefore does not rescan and parse every saved transcript"
**Affected contract:** ADR statement; PR #85 ledger #18 (re-opened by design)

Per autosave on a named room: 2 disk reads of the named file, 4 decodes of file-shaped content, 2 validations and 2 stringifies of the new snapshot, bounded at 25 MB. Per reveal: 1 read + 3 decodes for a named room; for an unnamed room, directory enumeration plus an index read per file and a full decode per index-less file. At 82 turns this is milliseconds; at multi-MB rooms every turn and every tab switch pays it. The first read's decoded session is discarded rather than compared.

**Recommendation:** Now: compare `found.session` against `expected` in `updateNamed` before writing the temp file (fail fast, one fewer read on conflict), and skip the reveal lookup when `activeNamedSessionId` is undefined unless a cheap directory-mtime check changed. Amend ADR 2026-07-14 L330. Later, if sizes warrant: keep a byte hash of the last accepted named file and decode only on mismatch.

### F-08 · 🟡 Standard — Regression coverage misses the paths that failed in probes

**Raised by:** Orchestrator (Cal lane) · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** Searched `WorkshopSessionPersistenceCoordinator.test.ts` for a test that changes disk between `hydrate` and the second read inside `promoteNamedSession` — not found (the "rechecks a queued resume save" test drives `capture`, not the promotion recheck). Searched for a missing-named-file-on-reveal test, an unrelated-corrupt-sibling test, and any coordinator test using the real `WorkshopSessionStore` — not found; the fake store's `updateNamed` reimplements the equality check and skips serialization.
**Affected contract:** test confidence for the incident class

The store suite proves the optimistic recheck well (mismatched/updated/missing index; change during temp write; deleted/malformed target). The coordinator suite proves ordering and conflict rejection against a fake. Missing: rollback state after promotion fails its second read; the two probe scenarios; one real-store round trip (which passed here, and should be pinned so a decode/serialize drift cannot make every autosave conflict); first-open duplicate request through the panel provider. Manual VS Code verification remains declared outstanding.

**Recommendation:** Add the four tests above (the two probes can be lifted nearly verbatim); record the manual verification steps from the tech-debt note in the memory-bank entry when performed.

### F-09 · 🟡 Standard — Documentation and process parity `🧭 Corroborated Runway`

**Raised by:** Stan, Bria scouts · **Discovery:** 2 runway-prompted · **Confidence:** High
**Evidence:** `docs/CHANGELOG-DETAILED.md` Unreleased lists only Astra and card polish; `docs/adr/2026-09-08-workshop-named-checkpoint-authority.md:1-3` lacks the `**Status:**/**Date:**/**Extends:**` header every other 2026 ADR carries; AGENTS.md L657–666 asks for a memory-bank entry when an architecture change lands; `.todo/tech-debt/2026-09-08-…` has no Priority/Related files/Completion criteria and carries unimplemented bullets; `apps/vscode-extension/package.json:416-417` — `"maxLength": 20000` beside "Short writer-authored context"; Astra touches fewer docs than Gemini 3.8 Flash (`a93da94`) and Muse Spark 1.3 (`bf115c5`) did.
**Affected contract:** release documentation; ADR discipline

Stan's history shows the repo often defers CHANGELOG and memory-bank to the release-prep commit, so part of this is habit. The user-facing behavior changes here (named authority, read-only file attachments, refresh action, overlay, 20× bio limit) are larger than usual to leave undocumented, and the 2.2.3 entry now describes superseded behavior without a pointer.

**Recommendation:** Before merge: CHANGELOG Unreleased entries for all five commits with a "supersedes 2.2.3 conflict preservation" note; ADR header block; retitle the PR. With release prep: memory-bank entry, tech-debt archive with the declined bullets split into a new item (or resolved via F-03), bio description that mentions prompt cost, Astra in the extension CHANGELOG/README to match siblings.

### F-10 · 🔵 Nit — Body-only "unchanged" test and recurring notice turns `🧭 Corroborated Runway`

**Raised by:** Sam, Stan scouts · **Discovery:** 2 runway-prompted · **Confidence:** High
**Evidence:** `WorkshopContextHandler.ts` (diff 1341) — `if (bounded.text === attachment.content) { continue; }` vs `WorkshopExcerptScopeHandler.ts:267-270` (fingerprint or `totalWords`) · diff 1408–1413 — failures alone mint a notice turn and `markDirty`
**Affected contract:** transcript hygiene

Declared deliberate (no persisted fingerprint schema), so recorded as a nit: a file whose head text is unchanged but whose tail grew reads as unchanged; a source that stays missing appends a "retained saved snapshot" divider and an autosave on every scan while a host conversation exists.

**Recommendation:** Compare `truncation.totalWords` alongside the body (already available from `loadFile`), and suppress a repeat notice when the previous turn is the identical notice.

### F-11 · 🔵 Nit — `inert` drops composer focus with no restoration

**Raised by:** Orchestrator · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `WorkshopApp.tsx` (diff 2328–2332) — `{...{ inert: sessionLoading ? '' : undefined }}`
**Affected contract:** accessibility

The overlay is announced (`role="status" aria-live="polite"`) and the content is marked `aria-busy`, which is right. When a reveal-triggered scan starts while the composer has focus, `inert` removes focus and nothing restores it afterwards.

**Recommendation:** Remember `document.activeElement` when `sessionLoading` turns on and refocus it (or the composer) when it turns off.

### P-1 · 💚 Praise — The pre-rename recheck is the right shape

**Raised by:** Orchestrator · **Discovery:** 1 independent
**Evidence:** `WorkshopSessionStore.ts:273-278, 877-879`; tests "rejects changed full content with a %s summary" and "rechecks incoming content after preparing the temporary named write"

The destination is compared as a full decoded checkpoint against the accepted baseline after the temp file exists and immediately before rename, and the summary index is never consulted for authority. The test matrix (unchanged/updated/missing index; change during the temp write; deleted/malformed target) proves the invariant the incident violated. Copy this shape for any future in-place replacement.

### P-2 · 💚 Praise — Refresh reuses the excerpt's authorization and bounds

**Raised by:** Orchestrator; Bria scout · **Discovery:** 1 independent · 1 runway-prompted
**Evidence:** `WorkshopContextHandler.ts` (diff 1316–1331) → `authorizeExcerptReread` / `loadFile` with `PROMPT_BUDGETS.contextAttachments`

Workspace containment, symlink refusal, configured-resource matching, and size/word bounds are the same code the excerpt re-read trusts; refusals keep the saved snapshot and are named in the status line. No second path-trust surface was created.

### P-3 · 💚 Praise — Unreadable named lookups no longer authorize a fallback write

**Raised by:** Orchestrator · **Discovery:** 1 independent
**Evidence:** `WorkshopSessionPersistenceCoordinator.ts:247-248` comment and `:264-273`; test "does not fall back to stale current when named lookup fails"

The intent — never let a read failure become write authority — is exactly the lesson of the incident. F-01 narrows its blast radius; it does not argue against the principle.

## What the Panel Changed About the Runway

- **Affirmed:** the thesis that authority, not context refresh, is the real job; the ADR's rename race as a genuine platform limit; the security posture of the refresh path.
- **Refined:** "fail-closed reads" applies to the *matching* file; the implementation applies it to any unreadable sibling (F-01). "Named-first ordering" protects the baseline, but the runway's first reading that it also protects the writer was wrong: it protects the file at the writer's expense (F-02).
- **Rejected:** the evidence pack's suggestion that the store→application import is a new boundary inversion; it extends an existing one and the boundary test does not prohibit it.
- **Still unknown:** first-open duplicate request; hidden-tab message drops; how many writers were in a 2.2.3 detached state.

---

# Part III — Lessons & Horizon

## Lessons (orchestrator, in Sensei's seat)

### Lesson — Authority and durability are different promises

**Illuminated by:** F-02, F-03 (Marcus, Sam, Bria lanes)

Deciding which copy wins is one contract; guaranteeing that the loser can still be found is another. The PR proved the first and let the second lapse because both were expressed through the same write ordering. **Carry forward:** when inverting a write order, write down what the old order was protecting and where that protection now lives.

### Lesson — Fail-closed has a radius

**Illuminated by:** F-01 (Blake lane), P-3

"Do not guess" is right for the file you were asked about; applied to every file a scan happens to touch, it turns one corrupt neighbor into a locked room. **Carry forward:** when a lookup can fail for reasons unrelated to the requested identity, separate "could not confirm" from "confirmed absent" at the caller, not just in the store.

### Lesson — Two documents in one PR must agree about the losing branch

**Illuminated by:** F-03, F-09 (Bria, Stan lanes)

The tech-debt note asks to preserve both versions; the ADR declines merging; the code discards. Each is defensible alone; together they let a product decision land as an implementation detail. **Carry forward:** when an ADR declines a requirement, say so in the ADR and amend or archive the item that asked.

### Lesson — A serialized boundary is only as wide as its last await

**Illuminated by:** F-05, F-06 (Sam, Marcus lanes)

The load was serialized; the scan that logically belongs to it ran after the counter returned to zero, and the busy signal that covers it is a message pair with no replay. **Carry forward:** when adding a step to a guarded operation, ask whether the guard still spans it and whether the UI state that reflects it can recover from a lost message.

## Horizon Watchlist

Not merge blockers.

- Resume markers per host start and per promotion accumulate in Git-tracked named files; consider collapsing consecutive markers.
- A third source-backed refresh (pinned excerpt on open) will copy either the fingerprint sibling or the body-text sibling; pick one before it happens.
- Byte-hash baselines if named files reach tens of MB.
- The `beforeCommit` hook will be reused for `writeCurrent` and index writes; keep its contract ("throw to abort, destination untouched") documented at the hook.
- The tech-debt storage-bounds item now also covers a retained full checkpoint in memory (`acceptedNamedCheckpoint`).

## The Closer

🐾 This PR is a lighthouse keeper's dog: it has learned, correctly and at real cost, never to let the boat that just came in be pushed back out by the one already tied up. It stands on the pier all night making sure of it. It has not yet learned that the boat it pushed away had someone in it, or that a stranger's wreck on the far rocks is not a reason to lock the keeper out of the house.

## Final Assessment

Needs rework, narrowly. The core mechanism — full-checkpoint optimistic writes with a pre-rename recheck, named authority on load and reveal — is sound, well-tested at the store, and the right response to the incident. Two introduced durability regressions (an unrelated unreadable file locking restore; no rolling checkpoint after any named failure) and one silent-displacement decision must be resolved before this reaches a writer who commits sessions. All three fixes are local to the coordinator and handler; the decision in F-03 belongs to the author. Independently verified: typecheck, lint, and 2,346 tests pass on the head; manual VS Code verification remains outstanding.

---

*Reviewed by the orchestrator with runway scouts Bria 🎯 · Stan 🗂️ · Marcus 🏛️ · Sam 🔍. Specialist panel and Sensei were not run at the author's request to conserve usage.*
