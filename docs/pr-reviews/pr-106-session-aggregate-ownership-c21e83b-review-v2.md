# MR Review v2 — Refactor Workshop session aggregate ownership

**Author:** okeylanders · **PR:** #106 · **Branches:** `sprint/workshop-architecture-refactor-05-session-aggregate` → `epic/workshop-architecture-refactor`
**Reviewed:** 2026-08-05 (America/Chicago) · **Head:** `c21e83b8` · **Merge base:** `476afbf1` · **Mode:** Full

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Context-only host commit changed writer-visible manifest behavior, undeclared and unfalsifiable | Cal, Blake, Bria, Oliver | 4 runway-prompted | 🧭 Corroborated Runway | **Addressed** — correction declared; pin-manifest regression added |
| F-02 | 🟡 Standard | Live-host-pin rule widened to parse time, removing the degraded-open path | Blake, Bria | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — pre-degradation corruption refusal explicitly documented |
| F-03 | 🟡 Standard | `dismissPersonaGuest` branch condition weakened from liveness to payload | Sam | 1 independent | — | **Addressed** — transition result separated from optional conversation id; roster and facade regressions added |
| F-04 | 🟡 Standard | Atomicity proven at proxy level; witnesses blind to a hoisted install | Cal, Patricia | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — final-prepare fault injection plus paired prepare/install witness |
| F-05 | 🟡 Standard | Prepare/install frame condition documented stronger than practiced | Marcus, Parker | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — mutable-draft and throw-free barrier contract documented |
| F-06 | 🟡 Standard | Half-migrated import origins; record-type re-export block near-dead | Marcus, Stan | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — final consumer retargeted; legacy type re-export removed |
| F-07 | 🟡 Standard | Two deep-copiers own `WorkshopTurn`; they meet on the snapshot path | Parker, Tim | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — one recursive copier in Records; snapshot second pass removed |
| F-08 | 🟡 Standard | Generation-three template drift: clock default + unrecorded choosing rules | Marcus, Stan | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** — clock required; collaborator conventions recorded beside code |
| F-09 | 🟡 Standard | Declared reset-counter correction proven only below its declared seam | Cal | 1 independent | — | **Addressed** — facade-level post-reset identity regression added |
| F-10 | 🟡 Standard | Rollback failure masks the original cause and logs nothing (inherited) | Oliver | 1 runway-prompted | — | **Deferred** — inherited recovery-policy decision tracked in `.todo/tech-debt/2026-08-06-workshop-rollback-failure-observability.md` |
| F-11 | 🟡 Standard | Refused-checkpoint pin error names the rule but not the rows | Oliver | 1 independent | — | **Addressed** — refusal includes live-pin count and excerpt versions |
| F-12 | 🔵 Nit | `append` return clone discarded by all nine call sites | Tim | 1 independent | — | **Addressed** — append now returns `void` and clones once |
| F-13 | 🔵 Nit | Todo ledger header names the wrong owner for excerpt version | Parker | 1 runway-prompted | — | **Addressed** — header now names `WorkshopPassageScope` |
| P-01 | 💚 Praise | Hydration atomicity survives the extraction, traced end-to-end | Blake | 1 runway-prompted | — | N/A — preserve |
| P-02 | 💚 Praise | Directory-derived witness: derive the population, pin the floor | Stan | 1 independent | — | N/A — preserve |
| P-03 | 💚 Praise | Host-private projection boundary survived relocation byte-for-byte | Patricia | 1 independent | — | N/A — preserve |
| P-04 | 💚 Praise | Domain rulebook and declared reset correction survived verbatim | Bria | 1 independent | — | N/A — preserve |
| P-05 | 💚 Praise | `replaceExcerpt` reorder is provably safe: pre-mutation facts returned as values | Sam | 1 runway-prompted | — | N/A — preserve |

### Post-review verification (2026-08-06, fixes staged on top of `c21e83b8`)

Twelve findings were addressed in this PR; inherited F-10 was deliberately
deferred with a scoped recovery-contract ticket.

- `npm test -- --runInBand` — 187 suites, **1,922 tests**, 1 snapshot, all pass.
- Six directly affected suites — **161 tests**, all pass.
- `npm run typecheck` — clean for core, webview, and VS Code adapter.
- `npm run lint` — 0 errors; 921 repository-baseline warnings.
- `npm run build` — production build and bundle sentinel pass; three existing
  webpack asset-size recommendations remain.
- `git diff --check` — clean.
- The sprint record now declares both behavior-adjacent corrections (F-01 and
  F-02), and `session/README.md` records the lifecycle conventions extracted
  from the planning runway.

## Review coverage

- **Read fully:** all four `session/` collaborators; `WorkshopSessionRecords.ts`; `WorkshopSessionService.ts` hydration/export/reset/snapshot regions and `commitPendingHostUpdates`; both precedent ledgers (`WorkshopWidgetConfigLedger`, `WorkshopStandingDirectiveLedger`); both architecture witnesses; `WorkshopSessionStateV1Integrity.ts`; the four new test suites; the fault-injection and integrity test cases.
- **Diff reviewed:** complete 4,825-line code diff (`476afbf1...c21e83b8`, excluding docs/`.todo`/`.memory-bank`).
- **Before-state:** `git show 476afbf1:…WorkshopSessionService.ts` consulted for every behavior-preservation claim in this report.
- **Declared artifacts read:** PR body, sprint doc, pre-implementation architecture runway, ADR 2026-08-03, ADR 2026-07-30, root `CLAUDE.md`.
- **Not re-run:** the declared verification suite (187 suites / 1,918 tests). Suite results in this report are the author's declaration, not an independent observation.
- **Blast radius:** 25 files, +3,867/−1,093; aggregate 2,894 → 2,127 lines; 4 new collaborators (1,126 lines) + records module (401 lines); 39 new tests; no message, persisted-shape, or public-signature change.

---

# Part I — Semantic Runway

**Runway thesis:** This PR converts the Workshop session aggregate's implicit ownership map into four named, individually tested collaborators while preserving the whole-session consistency contract — atomic prepare/install hydration, reset semantics, autosave ordering — and, more consequentially, converts the atomicity discipline itself from authorial line-placement into executable witnesses. The extraction is the visible work; the witnesses are the durable work.

## 1. Working Definition & Real Job

- **Literal change:** [Observed] Move four state clusters (todos, turn identity/order, passage/scope, participant roster) into `session/` collaborators, each implementing `exportState` / `prepareState` / `installPreparedState` / `reset`; move ~400 lines of record types and defensive-copy helpers to `WorkshopSessionRecords.ts`; widen the handler-bypass witness to derive collaborator names from the directory; add a prepare-before-install ordering witness; move the duplicate-live-host-pin rule into `WorkshopSessionStateV1Integrity`.
- **Functional capability:** none new, by design. Sprint 05 of a feature-frozen refactor epic (ADR 2026-08-03).
- **Business/operational problem:** [Declared] the aggregate was the epic's highest-churn file (63 commits since 2026-05-01, 2,894 lines, 104 methods); a maintainer could not find or test one session concept without reading the whole file, and the hydration atomicity that protects writers' session files from half-restored rollback was enforced by nothing but the author's placement of one line.
- **Emphasis and suppression:** the PR body and sprint doc emphasize contract preservation and one documented correction (reset preserves counters). The wording suppresses — or did not notice — two behavior-adjacent deltas (§2).
- **Must survive any valid alternative:** the aggregate remains the only production caller of the collaborators; hydration remains all-or-nothing; persisted `WorkshopSessionStateV1` shape unchanged; handlers keep depending on the facade.
- **Competing interpretation:** this is primarily a *witness-hardening* PR wearing a refactor's clothes — the fault-injection test, ordering witness, and integrity-rule move would have been worth landing alone, and the extraction is the occasion rather than the point. The sprint's own structure (witnesses before any extraction) supports this reading.

> This MR is not merely splitting a 2,894-line file. Its real job is giving independently changing session concepts named, tested owners while making the aggregate's atomic-hydration discipline executable — and preserving every writer-visible contract byte-for-byte, a claim the panel should test rather than accept.

## 2. Declared Intent, Observed Behavior & Open Meaning

**Aligned:** [Observed] No public aggregate method signature changed. Persisted `WorkshopSessionStateV1` shape untouched. Autosave ordering untouched (no collaborator references `markDirty` or does I/O). `WorkshopSessionScope.test.ts` (799L) is green **unmodified** — the pre-implementation runway's strongest demanded signal. The documented reset correction matches pre-change behavior exactly.

**Gaps between declaration and observation** (neutral, for panel investigation):

1. **Context-only host commit no longer appends a duplicate pin row.** Old code treated `delivered.excerpt?.version === this.pendingRevisionVersion` as satisfied when both sides were `undefined`. New code requires `delivered.excerpt &&`. Looks like a silent fix of a real manifest-growth bug, not the declared correction.
2. **The live-host-pin rule was widened, not just moved.** Old: checked after host-binding degradation, so a two-live-pin checkpoint with a dead host binding opened degraded. New: checked at parse time, before degradation.
3. **New defensive throw sites inside "no behavior change":** turn append duplicate-id guard, turn-identity-change guard, `window()` bounds validation. All appear unreachable through current facade paths.
4. **`replaceExcerpt` internal step order inverted:** old retired tool sidecars before minting the new excerpt; new mints inside the collaborator then retires in the aggregate.

## 3. Business Story & Rulebook

**Actors:** the writer (owns rooms, passages, tasks, guests); the maintainer (the refactor's direct beneficiary); the persistence coordinator (autosave + named-session open/rollback acting on the writer's behalf).

**Writer-visible rules now encoded in collaborators** [Observed, all with pre-change equivalents]:

| Rule | Owner |
|---|---|
| Todo staleness derived per read from a supplied `excerptVersion`, never cached | `WorkshopTodoLedger` |
| Stale-excerpt-turn promotion refusal; `(turnId, findingKey)` dedupe; item cap; text bounds | `WorkshopTodoLedger` |
| Monotonic turn identity; no id reuse across ordinary reset | `WorkshopTurnLedger` |
| Scope lock: path immutable once room memory exists; idempotent request checked before lock | `WorkshopPassageScope` (receives `locked: boolean`) |
| Shelf: one slot, no history; displaced passage reported; shelve/re-pin never bumps version | `WorkshopPassageScope` |
| Guest capacity (2), host self-invite refusal, duplicate live-guest refusal | `WorkshopParticipantRoster` |
| Room memory includes disposed-guest tombstones ("cannot un-read a room") | `WorkshopParticipantRoster` |
| Delivery offset compare-and-set after aggregate proves turn existence | Aggregate joins roster + turn ledger |
| Chat-target repair on hydration (dangling targets fall back to host) | Roster `prepareState` |
| Exactly one live host pin in persisted state | `WorkshopSessionStateV1Integrity` |

**Value created:** a maintainer finds and tests one concept in one file; the next session-owned concept costs four lifecycle touch points and zero witness edits. **Harm prevented:** a ledger's `prepareState` drifting below the install barrier, turning a failed session-open rollback into a permanently half-restored room on disk. That harm is writer data loss, and the witnesses are its fence.

## 4. Narrative Flow: Beginning, Development, Turn & Ending

The flow that matters is **session replacement** (open-named / rollback — the same method).

- **Beginning:** a writer opens a named session. The coordinator captures a rollback, re-imports provider conversations, then calls `hydrateCommittedState`.
- **Development (may throw, live state untouched):** validate → normalize → strict revalidate; six `prepareState` calls interleaved with manifest/attachment clones; then the degradation remap — a missing host binding clears prepared host manifests and *mutates the already-prepared* passage state; the roster's `prepareState` runs last, consuming remapped inputs and repairing dangling chat targets.
- **Turn (commitment point):** the first `this.<field> =` assignment. Everything after is assignment-only.
- **Ending:** the caller receives discarded conversation ids, degraded keys, and applied normalizations; the room is entirely the new session or entirely the old one.
- **Unresolved thread:** the "prepared state is sealed" story has a documented asymmetry — the aggregate installs *aggregate-modified* prepared state, and the roster's prepare input *depends on* degradation outcomes. "Prepare" today means "draft completed before the barrier," not "immutable value."

## 5. Codebase Genealogy & Controlling Precedent

- **Controlling precedent:** `WorkshopWidgetConfigLedger` + `WorkshopStandingDirectiveLedger`. The prepare/install pattern is roughly **five days old** and was *review-driven* (born of PR 97's partial-hydration finding). This PR is its third generation and first mass reproduction.
- **Inheritance:** all four collaborators reproduce the quartet, the doc-comment pair, the state-interface naming, and assignment-only installs, nearly verbatim.
- **Distinguishing facts / drift:** one collaborator alone defaults its clock; "ledger" now spans two transaction disciplines; reset-counter semantics fork across the family (each faithful to pre-change behavior); two clone philosophies for one record; roster `prepareState` adds deterministic repair to the precedent's pure clone; `WorkshopScopeLockedError` is the family's first typed, code-bearing error.
- **New precedent created:** the directory-derived bypass witness; `WorkshopSessionRecords` as the named home for record shapes + boundary copies; the sprint-doc pattern of *recording* a deviation instead of silently normalizing it.

## 6. Structural & Causal Map

Cross-cluster reads stay in the facade: **room delivery** (aggregate proves `turnLedger.contains(id)` then delegates the CAS to the roster — existence proof and CAS now on opposite sides of a seam, bound by a docstring); **scope lock** (roster owns the memory fact, passage scope owns the refusal, aggregate passes `locked: boolean`, ADR rationale lives as an aggregate doc comment — one concept's evidence, enforcement, and documentation in three places); **import topology** (`index.ts` re-points `WorkshopSessionHydrationResult` to Records; handlers type-import from Records; but the Service *also* re-exports record types).

**The ordering witness, precisely:** it slices `hydrateCommittedState`'s source and requires every `.prepareState(` offset to precede the first `/\n\s*this\.\w+\s*=/` match. It pins prepares-before-scalar-assignments. It does **not** pin the six `installPreparedState` calls, install order, or prepare-input independence.

## 7. Contracts, Invariants & Negative Space

**Contract:** `prepareState` may throw and performs all cloning; `installPreparedState` must not throw and only assigns; `exportCommittedState` refuses during an active run; hydration failure leaves committed state deep-equal to before.

**Negative space — deliberately not done:** no extraction of manifests, active run, attachments, or behavior (retained five, reasons recorded in the aggregate header); no `schemaVersion` bump; no store/search-index/coordinator split; no message or payload change. The turn ledger deliberately knows no artifact vocabulary; roster state is "never a wire contract" while the todo ledger *does* speak `WorkshopStoredTodoItemV1`.

## 8. Forces, Tensions & Design Tradeoffs

Uniform lifecycle over heterogeneous substance (a 132-line vocabulary-free container and a 444-line policy-bearing roster wear the same four-method suit). Scalar `locked` keeps dependency direction clean at the cost of three call sites that must each remember `hasRoomMemory()`. Density is conserved: the mechanical clusters left; the cross-cluster reconciliation stayed and is now *denser* relative to its file.

**Alternate constructions:** registry fan-out (rejected on evidence — the roster's prepare input depends on degradation outcomes that also mutate the passage's prepared state, so a uniform loop would hide the load-bearing order); records-in-place (avoids dual import origins at the cost of a 400-line prelude); a fifth manifest collaborator (deliberately deferred to Phase 7).

## 9. Failure, Recovery & Operational Truth

Single-process extension host; synchronous mutations; the rollback path *is* hydration. There is no rollback-of-rollback: a throw inside `restoreRollback` propagates out of `openNamed`'s catch. The new parse-time pin rule now gates the *rollback* input too. Degraded outcomes are visible (degraded keys + normalizations returned and logged); a refused checkpoint surfaces as a failed open, not silent wrongness. Fault injection covers one prepare path.

## 10. Security, Trust & Misuse Surface

Low-stakes lane: no new inputs cross a trust boundary; provider conversation ids remain host-side; `exportCommittedState` maps ids to logical keys. The persisted checkpoint is attacker-influenceable only as a hand-edited local file; the widened validator *narrows* what a malformed file can do. No secrets, no injection surface, no authorization semantics changed.

## 11. Data, Time, Scale & Concurrency Horizon

`append` now does a linear `contains()` scan per append; `getSnapshot` deep-clones the 200-turn window twice. Both bounded by realistic session sizes. All clocks injected except one collaborator's default. Single-threaded host; the CAS offset guard defends against re-entrant delivery races.

## 12. The Change Genome: Variation & Reproduction

**Cousin:** the next session-owned persisted concept. Four-method contract (**reuse**, though the family forks make "copy the template" ambiguous); `counters` record (**extension** — exact precedent of optional keys, no schema bump); directory-derived witness (**reuse** — zero edits); ordering witness (**reuse with a gap** — install order and prepare-input independence unwitnessed); lifecycle touch points (**reuse** — four lines).

**Verdict:** a generative pattern with real reproduction machinery, carrying three forks a copier must resolve by coin flip.

## 13. Comparative Models & Borrowed Vocabulary

- **Design by contract:** prepare/install is a textbook two-phase commitment contract. Sharpened question: is the *frame condition* — "prepared values are not modified between phases" — part of the contract? The aggregate says no; the docstrings imply yes.
- **Evolutionary architecture / fitness functions:** the ordering witness guards gradual erosion. Does it check the *quality* (atomicity) or a *proxy* (textual ordering)? Here: a proxy, with known blind spots.
- **[Analogy] Aviation — flight envelope:** hydration's known-safe envelope is validated input, throw-free remap, assignment-only installs. Nothing marks the envelope's edge for the next editor.

## 14. Creative Counterfactuals

**Inversion (registry fan-out):** fails honestly — heterogeneous, interdependent prepare inputs need per-collaborator adapters. **Deletion (`WorkshopSessionRecords`):** irreducible residue is cycle prevention and external vocabulary; it earns its existence. **Time-lapse:** hydrate grows one prepare + one install per concept, but any concept referencing runtime bindings reproduces the roster's entangled prepare-input assembly. **Boring alternative (todos only):** genuinely worse — the scope machine's 799-line isolated suite meant the seam was already paid for.

## 15. Evidence Confidence & Unresolved Questions

**Repository-grounded:** the aligned list; the witness mechanics; collaborator behavior compared line-by-line against `476afbf1`. **Material inferences:** two-live-pin checkpoints unreachable from released write paths; the remap is throw-free. **Missing artifacts:** no test observes the host manifest on the context-only commit path; no fault injection through a new collaborator's prepare; declared suite counts not independently re-run.

## 16. Past → Present → Horizon Synthesis

**Past:** four sprints moved misplaced code; the session aggregate was never misplaced — just unreadable, with its most dangerous invariant enforced by line placement alone.

**Present:** the aggregate is an honest coordinator; four closed concepts have named owners with focused suites; five entangled clusters remain with written reasons; the atomicity discipline has executable witnesses. Alongside the declared work, one manifest-growth bug appears silently fixed and one persisted-state rule got stricter at the decode boundary.

**Horizon:** the next concept reproduces the pattern at the promised four-line cost but inherits three coin-flip forks; Phase 7's manifest decision will confront the degradation remap; the turn ledger's vocabulary-free name will face pressure when artifact bodies want ledger-coordinated retention.

## 17. Runway Synthesis Brief

**Invariants:** hydration all-or-nothing; one live host pin; monotonic turn/todo identity across ordinary reset; excerpt version owned by passage scope; handlers never touch collaborators; collaborators never do I/O; offset advance only after turn-existence proof.

**Tensions:** uniform lifecycle over heterogeneous substance; scalar `locked` over coupling; density conserved in the retained remap; dual import origins tolerated to limit consumer churn.

**Do not overread:** the new defensive throws are unreachable via the facade today; the reset-counter "correction" documents pre-existing behavior; the witness's regex brittleness fails *closed* in every traced scenario except the install-order gap; do not demand a registry abstraction already rejected on evidence.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — the architecture is sound, the atomicity contract was traced end-to-end with no reachable failure path, and every merge-relevant item is documentation or test debt around two real behavior deltas the PR does not yet claim.

- 🟠 **F-01 · Context-only host commit changed writer-visible manifest behavior** `🧭 Corroborated Runway` — the guard at `WorkshopSessionService.ts:977-980` silently fixes a manifest-growth bug inside a PR declaring no behavior change, and the only test on that path observes nothing, so both old and new behavior pass the suite. Declare the fix and add one observing assertion before merge.

Nothing else rises to Blocking or High. Blake traced the full prepare/install window and found no reachable path to the half-restored-room failure class this sprint exists to prevent.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | B+ | Boundaries drawn where ownership genuinely changes hands; dependency direction clean; costs are cleanup and legend, not structure. |
| Critical Correctness — Blake | A− | Barrier traced end-to-end; no reachable failure path. Two undeclared deltas are documentation debt, not defects. |
| Edge Cases — Sam | B+ | Four assigned paths came back provably equivalent; one real invariant weakening found, latent today. |
| Code Quality — Parker | B | Headers good enough to be trusted, which is why three sentences that outran the code matter. |
| Tests — Cal | B− | Four genuine new suites — but the three sentences the PR body promises are the three no test can falsify. |
| Codebase Fit — Stan | B+ | Faithful reproduction of the precedent; one default parameter and a half-finished import migration. |
| Performance — Tim | A− | One bounded double-clone regression with a one-line fix; everything else unchanged or noise. |
| Security — Patricia | A | Host-private boundary survived relocation byte-for-byte; prototype-pollution question closed; malformed files die at the door. |
| Observability — Oliver | B− | Degraded-path logging is the model; rollback double-failure is invisible and one refusal message lacks its subject. |
| Domain Logic — Bria | B+ | Rulebook survived verbatim; two real deltas need paperwork, one adjudicated as outside the codec-migration clause. |

## Findings

### F-01 · 🟠 High — Context-only host commit changed writer-visible manifest behavior, undeclared and unfalsifiable `🧭 Corroborated Runway`

**Raised by:** Cal, Blake, Bria, Oliver · **Discovery:** 0 independent · 4 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionService.ts:977-980` — `if (delivered.excerpt && this.passageScope.commitPendingExcerptDelivery(delivered.excerpt.version))`; old `476afbf1:…:1235` — `if (delivered.excerpt?.version === this.pendingRevisionVersion) {`
**Affected contract:** business (writer-visible "In context" host manifest; exported checkpoint content) + the sprint doc's declared-corrections contract

Trigger, traced against the merge base by three reviewers independently of one another's notes: writer pins a passage → the first host turn ships it (`pendingRevisionVersion` cleared) → writer edits context attachments → the next host turn ships a **context-only** delivery. Old code evaluated `undefined === undefined` → true → `appendHostPin(pin)`, staling the live pin and pushing a duplicate fresh row. One extra stale-history row per context-only delivery, on both production callers (`WorkshopHandler.ts:1305`, `RunWorkshopToolSidePass.ts:296`), visible in `collectWriterSources({kind:'host'})` and in every exported checkpoint. New code short-circuits: no row.

The new behavior is correct and the old one was a bug — Bria and Blake both concluded the fix is right. The problem is ownership and observability. The sprint doc declares exactly *one* correction (reset counters) and writes its Contract Preservation section as "nothing else moved." Cal ran the mutation in both directions: the only test driving this path (`WorkshopSessionService.test.ts:550-572`, whose `firstDelivery` is context-only with a live pin) asserts only `contextAttachments` and never reads the manifest, so reverting the guard leaves the suite green. Every test that *does* observe pins delivers an excerpt. The fix is unowned and could silently revert; Oliver adds that neither side logs manifest appends, so a writer reporting "a pin row I expected isn't there" gives the author no oracle.

**Recommendation:** Declare the second correction in the sprint doc/PR body, and extend the existing test at `:550-572` to assert `collectWriterSources({ kind: 'host' })` holds exactly one live pin with no new row after a context-only commit. Both in this MR.

### F-02 · 🟡 Standard — Live-host-pin rule widened to parse time, removing the degraded-open path `🧭 Corroborated Runway`

**Raised by:** Blake, Bria · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:431-432` — `throw new Error('Persisted Workshop state contains multiple live host pins');`; old check at `476afbf1:…:2320-2325` ran inside hydrate **after** `hostWriterSources.length = 0`
**Affected contract:** data (persisted session codec — a Marketplace writer-data contract, ADR 2026-07-30) + the rollback path

A checkpoint with two live pins **and a dead host binding** previously hydrated successfully, because degradation wiped the pins before the old check ran; the same file is now refused at decode, before degradation, and the rule additionally gates `restoreRollback` input. Both reviewers traced reachability and agree the shape is unreachable from released write paths: `appendHostPin` is the only pin writer and stales the prior pin first; the two other `hostWriterSources.push` sites write `attachment`/`message-attachment` kinds only.

Bria adjudicated the ADR 2026-07-30 clause directly: the migration requirement does **not** apply, because the shape was never producible by a released write path and was already rejected whenever the host binding was live — it is corruption-rejection consistency, not a formerly-valid shape becoming required, and the ADR's "authentic prior-Marketplace fixture" gate cannot be satisfied for a state that cannot exist. Refusal-at-decode is also *stronger* corruption rejection than degrade-and-wipe. What remains wrong is only the sprint doc's word "moved," which understates a changed failure mode for corrupt files.

**Recommendation:** One sentence in the sprint doc: the rule now runs pre-degradation, a corrupt two-pin file is refused rather than degraded-open, adjudicated as corruption-rejection outside the codec migration contract (no schema bump). No code change.

### F-03 · 🟡 Standard — `dismissPersonaGuest` branch condition weakened from liveness to payload

**Raised by:** Sam · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionService.ts:1156-1158` — `const conversationId = this.participantRoster.dismissPersonaGuest(personaId);` / `if (conversationId === undefined) { return undefined; }`; old `476afbf1:…:1463-1465` — `if (!guest || guest.liveness === 'disposed') { return undefined; }`
**Affected contract:** aggregate invariant — a disposed guest owns no manifest and no active run

The roster's `dismissPersonaGuest` (`session/WorkshopParticipantRoster.ts:179-194`) returns `undefined` in two very different situations: no guest / already disposed (zero mutation), **or** a live guest whose `conversationId` was already absent (it disposes the guest, snaps `chatTarget` back to host, and returns that `undefined` as the payload). The aggregate cannot distinguish them, so on the second path it returns early and skips both cleanups the old code performed unconditionally for any live guest: `guestWriterSources.delete(personaId)` and cancellation of an `activeRun` targeting that guest. The stuck run is the worse half — `exportCommittedState()` throws `WorkshopSessionActiveRunPersistenceError` while a run exists, so every subsequent checkpoint would refuse.

Sam was explicit that the second state is **not reachable today**: `adoptPersonaGuest` rejects a blank conversation id, `clearAllConversations` sets id and liveness together, and hydration demotes any guest without a usable binding before install. Searched for a construction of `liveness: 'live'` with an absent `conversationId` — not found. It belongs in this MR because the MR created the divergence: extraction turned a liveness branch into a payload branch, and the roster's own `isLivePersonaGuest` exists precisely to assert that state is representable.

**Recommendation:** Give the roster an unambiguous return — e.g. `{ disposed: boolean; conversationId?: string }` — and have the aggregate key its cleanup off `disposed`. One-line caller change at `WorkshopHandler.ts:801`; add a roster test disposing a live guest with no conversation id.

### F-04 · 🟡 Standard — Atomicity proven at proxy level; both witnesses are blind to a hoisted install `🧭 Corroborated Runway`

**Raised by:** Cal, Patricia · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/__tests__/architecture/boundaries.test.ts:675` — `const firstLiveFieldInstall = hydrationBody.search(/\n\s*this\.[A-Za-z][A-Za-z0-9]*\s*=/);`; `WorkshopWidgetConfigs.test.ts:227-241` stubs only `widgetConfigLedger.prepareState`
**Affected contract:** test contract for the half-restored-room harm class (writer data loss on the rollback path)

Two gaps compound. The fault-injection test throws at prepare #4 of 6 (`WorkshopSessionService.ts:1801`), so the standing-directive prepare, the manifest clones, the degradation remap, and `participantRoster.prepareState` never execute under fault — and the fixture's turn/todo populations are empty, so the earlier prepares are checked only against vacuous state. Meanwhile the witness regex matches only scalar assignments: `this.turnLedger.installPreparedState(turnState)` contains no `=`, so hoisting any of the six install calls above the roster's prepare — 70 lines and one remap earlier — passes the witness, passes the fault injection, and converts a roster-prepare throw (its contract explicitly permits throwing) into exactly the partial hydration this PR exists to prevent. Orchestrator verification confirms the regex cannot match an install call. Patricia notes the same paths are where a hand-edited checkpoint's data flows first, so this is also the proof behind refusal-not-corruption.

**Recommendation:** Add one fault-injection test spy-throwing on `participantRoster.prepareState` (the *last* prepare) with a populated session — pinned excerpt, a turn, a todo, a guest — asserting `exportCommittedState()` deep-equals the pre-attempt capture. That proves the whole prepare phase plus the remap. Optionally extend the witness to require every `installPreparedState` offset to follow the last `prepareState`.

### F-05 · 🟡 Standard — Prepare/install frame condition documented stronger than practiced `🧭 Corroborated Runway`

**Raised by:** Marcus, Parker · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopPassageScope.ts:277` — `/** Install only state returned by prepareState; this phase performs assignments only. */` vs `WorkshopSessionService.ts:1832` — `passageState.pendingRevisionVersion = undefined;`
**Affected contract:** maintenance contract (the documented frame condition of the atomicity discipline)

The collaborator docstrings tell a sealed-value story; the aggregate practices a draft story — the degradation remap mutates already-prepared passage state, and the roster's prepare input is assembled *from* remap outcomes, making prepare order itself load-bearing. Both are safe today because every remap operation is a throw-free plain assignment above the barrier, but that rule is written nowhere and no witness pins it. Two symmetric mistakes are available to a future author: treating prepared state as frozen (and rejecting a legitimate remap edit), or adding a throwing lookup into the remap region (introducing the half-restore bug while every witness stays green). This PR authored both the docstrings and the remap, so it is the natural place to make them tell one story.

**Recommendation:** Add a sentence at the remap (`:1827`) and/or the barrier comment: prepared collaborator state is a draft the aggregate may adjust before the barrier; every operation between the last validation and the barrier must be throw-free and assignment-shaped. Soften the install docstrings to "install only state produced by this collaborator's prepare phase; must not throw."

### F-06 · 🟡 Standard — Half-migrated import origins; the record-type re-export block is near-dead `🧭 Corroborated Runway`

**Raised by:** Marcus, Stan · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionService.ts:150-167` — `export type { WorkshopCapabilityArtifactInput, WorkshopContextAttachment, … } from '@/application/services/workshop/WorkshopSessionRecords';`
**Affected contract:** maintenance contract (single ownership origin for the session record vocabulary)

The MR half-finished its own migration: it retargeted both handlers, `WorkshopPromptBuilder`, `WorkshopAnalysisInputs/SidePass`, `WorkshopSessionStateV1`, and the barrel to import record types from `WorkshopSessionRecords`, while keeping a full re-export block in the Service. `CLAUDE.md`'s alpha rules are explicit: remove the old path in the same PR. Stan notes the visible result — `WorkshopExcerptScopeHandler.ts:3-10` consumes both origins for sibling vocabulary in adjacent statements.

**Orchestrator correction:** Marcus reported zero consumers of the block anywhere. Validation found exactly one: `packages/core/src/__tests__/application/services/workshop/WorkshopPromptBuilder.test.ts:25-26` consumes `WorkshopContextAttachment` through it via inline `import('…').Type` syntax, which evades a conventional import grep. The finding stands and its repair is smaller than claimed — one test line to retarget, then the block can go. Separately verified: the adjacent value re-exports (`WorkshopScopeLockedError`, `workshopParticipantSubjectStatus`, `WorkshopSessionCheckpointNormalization`, `workshopTextNoteLabel`, the two constants, `WorkshopSessionActiveRunPersistenceError`) all have live consumers and must stay — Marcus is right that the error re-export is the witness-sanctioned handler doorway, since the bypass guard textually forbids handlers from naming `session/` modules at all.

**Recommendation:** Retarget `WorkshopPromptBuilder.test.ts:25-26` to `WorkshopSessionRecords`, then delete `WorkshopSessionService.ts:150-167`. Keep the value re-exports. If deferred, the block needs a dated transitional comment and a `.todo/tech-debt/` entry.

### F-07 · 🟡 Standard — Two deep-copiers own `WorkshopTurn`, and they meet on the snapshot path `🧭 Corroborated Runway`

**Raised by:** Parker, Tim · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopTurnLedger.ts:122` — `function cloneRecord<T>(value: T): T {`; `packages/core/src/application/services/workshop/WorkshopSessionRecords.ts:196` — `export function cloneTurn(turn: WorkshopTurn): WorkshopTurn {`; `WorkshopSessionService.ts:1918, 1947`
**Affected contract:** maintenance contract (defensive-copy discipline for a persisted record) + operational (snapshot allocation)

Pre-change there was one answer to "how do you deep-copy a turn." Now there are two with different failure modes: when `WorkshopTurn` gains a nested mutable field, `cloneRecord` deep-copies it automatically while `cloneTurn` silently aliases it until someone adds a line — and `cloneTurn` is still called at eleven aggregate sites. Parker's sharper point: this breaks the `WorkshopSessionRecords` header's own pledge that a record's boundary copy changes in the same place as the record, since turns now have a copy home outside Records.

Tim measured the collision. Old `getSnapshot` did a **shallow** `this.turns.slice(-WINDOW)` plus one `cloneTurn` pass (`476afbf1:2377, 2403`); new code has `window()` return `cloneRecord` deep copies and then deep-copies all 200 again at `:1947` — verified by orchestrator. It is the only allocation regression this PR introduces, bounded and not user-visible (sub-millisecond on an event-driven path), and the fix is one deleted `.map`.

**Recommendation:** Drop `.map(cloneTurn)` at `:1947` and use `windowed` directly. Then pick one copier for `WorkshopTurn` — simplest is promoting the generic copier into Records and deleting `cloneTurn`; if the field-enumerating form is kept deliberately, say so beside it and accept the same-tick maintenance rule.

### F-08 · 🟡 Standard — Generation-three template drift: a clock default and unrecorded choosing rules `🧭 Corroborated Runway`

**Raised by:** Marcus, Stan · **Discovery:** 0 independent · 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopPassageScope.ts:77` — `constructor(private readonly now: () => number = Date.now) {}`; siblings at `WorkshopTurnLedger.ts:21`, `WorkshopTodoLedger.ts:45`, `WorkshopWidgetConfigLedger.ts:66-69`, `WorkshopStandingDirectiveLedger.ts:54` all require the clock
**Affected contract:** maintenance contract (template fidelity for the epic's reproduction machinery)

The pattern is five days old and this is its first reproduction at scale, which makes this PR the moment conventions freeze. One collaborator of six defaults its clock — and the PR's own pre-implementation runway recorded the convention ("both take an injected clock") before generation three broke it. The default is dead code: the aggregate passes `this.now`, and both test constructions pass explicit clocks. Two further forks ship unrecorded beside the code: reset-counter semantics differ across the family (each faithful to pre-change behavior, and the preserving side documents itself while the zeroing side is silent), and "ledger" now names both prepared-mutation and direct-mutation disciplines.

Stan's refinement, accepted: the rule for choosing between the two disciplines **is** recorded — "New ledgers need the state contract; they need the mutation contract only if a caller must interleave provider I/O" — in the planning doc, which is not where the sixth implementer looks. Likewise the persisted-grammar difference (todo ledger speaking `WorkshopStoredTodoItemV1` vs the roster's runtime-only state) is justified by a distinguishing fact each file documents. So the gap is placement, not absence.

**Recommendation:** Delete `= Date.now` in this MR (one token, aligns all six). As follow-up, hoist one paragraph into the aggregate header or a `session/` README: the reset-counter rule ("preserve when ids must never recur; zero otherwise") and the discipline-choosing sentence that currently lives only in the planning doc.

### F-09 · 🟡 Standard — The declared reset-counter correction is proven only below the seam it is declared at

**Raised by:** Cal · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/__tests__/application/services/workshop/session/WorkshopTurnLedger.test.ts:177-187` — ledger-level only; `WorkshopWidgetConfigs.test.ts:541-547` — facade-level test pinning the *opposite* semantics
**Affected contract:** the declared aggregate contract "ordinary reset preserves existing monotonic turn/todo counters while clearing rows"

The new ledger suites prove counter preservation through `WorkshopTurnLedger.reset()` and `WorkshopTodoLedger.reset()` in isolation — real contracts, good tests. But the PR declares this at the *aggregate* level, and no workshop facade suite asserts a post-reset turn/todo counter or id through `WorkshopSessionService.reset()`. A plausible regression — reconstructing the ledger instead of delegating at `:1652` — passes every test in the repo. With the fixed injected clocks these suites already use, post-reset id reuse would be deterministic and observable, so the fixture conditions are already paid for. The family fork makes it worse: the widget facade test pins counter-*zeroing* through the facade, so a copier reading facade tests as documentation sees only the wrong half.

**Recommendation:** Four-line facade test: mint a turn and a todo, `service.reset()`, mint again, assert ids advance rather than reuse (or that `exportCommittedState().counters.turn`/`.todo` survive reset).

### F-10 · 🟡 Standard — A rollback failure masks the original cause and logs nothing (inherited)

**Raised by:** Oliver · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts:424-427` — `} catch (error) { this.restoreRollback(rollback); throw error; }`
**Affected contract:** operational (post-failure evidence on the session-replacement path)

`openNamed` fails → `restoreRollback` re-hydrates the captured export, which runs `validateWorkshopSessionStateV1` first. If that re-hydration throws, the throw escapes the catch **before** `throw error` executes: the original failure is never rethrown and never logged — the catch writes no line, and the handler logs only the secondary error. The author debugging a writer's report then sees a message describing the rollback's refusal with no record of why the open failed, and cannot tell whether the live room holds the new session or the prior one (identity, `activeNamedSessionId`, and temporal state are assigned only after hydration succeeds). Same pattern at `resetSession`. Orchestrator verified the code and that the coordinator is untouched by this diff — inherited risk, surfaced because this PR widened the parse-time rule that gates the rollback input.

**Recommendation:** Follow-up acceptable. Log the original error before calling `restoreRollback`, and wrap the restore in its own try/catch that logs "rollback restore also failed; live room state is <new-session|prior>" before rethrowing. Two `appendLine`s.

### F-11 · 🟡 Standard — Refused-checkpoint pin error names the rule but not the rows

**Raised by:** Oliver · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:431-433` — `throw new Error('Persisted Workshop state contains multiple live host pins');`
**Affected contract:** operational — the only forensic artifact for a refused session file

The string moved verbatim into a module whose own convention is identifier-bearing errors: every sibling names its subject (`Persisted Workshop tool ${sidecar.toolId} has an invalid latest report`, `Persisted Workshop guest ${guest.personaId} has an invalid room offset`). The pin rule is now the one check in the file with zero identifying context — and because this PR moved it to parse time, it gates every open. Pin entries carry only safe metadata (`excerptVersion`, `sizeChars`, `deliveredAt`), so identifiers cost nothing in sensitivity.

**Recommendation:** One line: include the count and the offending pins' `excerptVersion`s. Versions and counts only — keep labels and paths out.

### F-12 · 🔵 Nit — `append`'s return clone is discarded by all nine call sites

**Raised by:** Tim · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopTurnLedger.ts:31-33` — `const stored = cloneRecord(turn); this.turns.push(stored); return cloneRecord(stored);`
**Affected contract:** maintenance (dead allocation, misleading API surface)

The storage clone is justified (old code stored the caller's object raw); the return clone is not consumed by any of the nine aggregate call sites, which re-clone their own local when they need a copy. Cost is negligible — this is an API-honesty note. A return value nobody consumes invites the next reader to believe someone does.

**Recommendation:** Return `void` from `append`.

### F-13 · 🔵 Nit — Todo ledger header names the wrong owner for excerpt version

**Raised by:** Parker · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/session/WorkshopTodoLedger.ts:5` — `Excerpt version remains aggregate-owned and is supplied to every operation`
**Affected contract:** maintenance (the ownership map this extraction exists to make explicit)

This same PR moved excerpt version into `WorkshopPassageScope`; the aggregate merely reads and forwards it. In a PR whose point is a truthful ownership map, the one sentence that misstates ownership is worth ten seconds.

**Recommendation:** "Excerpt version is owned by `WorkshopPassageScope`; the aggregate supplies it to every operation that derives staleness. It is never cached here."

## Praise

- **P-01 · Hydration atomicity survives the extraction, traced end-to-end (Blake).** Between the last `prepareState` and the first live assignment there are only `Array.filter`, an index read, and a pure `conversationIds()` call; all six `installPreparedState` implementations are assignment-only. The half-restored-room failure class has no reachable entry point in this code as written.
- **P-02 · The directory-derived witness derives the population and pins the floor (Stan).** It replaces sprint-00's enumerated regex with directory discovery plus an `arrayContaining` floor so the derivation cannot silently rot — the shape future architecture witnesses here should copy.
- **P-03 · The host-private projection boundary survived relocation byte-for-byte (Patricia).** Moving provider conversation ids into a new class with `exportState`/`snapshot`/`conversationIds` was the PR's most dangerous move for that lane; the projection is field-identical to the pre-change one and the state type now carries an explicit "never a wire contract" marker.
- **P-04 · The rulebook survived verbatim, and the deviation was recorded rather than normalized (Bria).** Guest rules carry the same shared constant and byte-identical messages; todo bounds carry the same import; the reset-counter paragraph is accurate as history. Recording a pre-existing deviation is the template — apply it twice more.
- **P-05 · `replaceExcerpt`'s reorder is provably safe because pre-mutation facts are returned as values (Sam).** The step order genuinely inverted, which is normally where a refactor draws blood; it holds because `WorkshopPassageReplacement` captures `displaced` and `replaced` before `setExcerpt` runs, so the aggregate never re-derives a pre-mutation fact from post-mutation state.

## What the Panel Changed About the Runway

**Affirmed.** The thesis held: the witnesses are the durable work, the extraction respects real ownership, and the rejection of registry fan-out survives contact with the code (the roster's remap-dependent prepare input makes the explicit call order load-bearing). Blake closed the runway's open atomicity question by trace rather than inspection — including confirming `usableRuntimeBindings` is byte-identical to the old version.

**Refined.** Sam drew the sharpest distinction: the extraction is behavior-preserving on every *reachable* input but weakened on the *state space* (F-03) — different claims, and the runway should only make the first. Marcus and Stan narrowed the "two live import origins" claim, and orchestrator validation narrowed it further to one near-dead origin with a single inline-`import()` consumer. Cal refined the round-trip picture: `WorkshopSessionPersistence.test.ts:390-424` already round-trips a live-aggregate-produced state through the widened validator, so the untested residue is specifically the rollback input under a hypothetical two-live-pin live state — which the runway correctly traced as unreachable. Tim supplied the before/after arithmetic the runway skipped: hydration and export clone counts are unchanged; `readRoomDeliveryState`'s full-array clone is inherited, not introduced.

**Rejected.** Stan rejected the runway's claim that "nothing names the rule for choosing" between the two ledger disciplines — the rule *is* recorded in the pre-implementation runway document; the problem is placement, not absence. Patricia closed the runway's implicit prototype-pollution question: `Object.fromEntries` define-own semantics make a JSON-borne `__proto__` key inert.

**Still unknown.** Whether the two undeclared deltas were intentional is an author question no amount of code reading resolves. The declared suite results were not independently re-run.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A correct change that nothing can observe is an unowned change

**Illuminated by:** F-01 (Cal, Blake, Bria, Oliver), F-02 (Blake, Bria), P-04 (Bria)

The `delivered.excerpt &&` guard is a real fix — the old comparison was true when both sides were `undefined`, appending a duplicate host pin row on every context-only delivery. But it arrived inside a PR whose thesis is "no behavior change," and the single test on that path never looks at the manifest, so the suite is equally happy with the bug and the fix. A change that no test can see and no sentence claims has no owner, and the next refactor can quietly restore the bug with a green build. Notice that this same PR already knows the right move: it *declared* the reset-counter correction in prose and kept it. The habit exists here; it just didn't reach every line that changed shape.

**Carry forward:** For every condition whose shape changed in a "no behavior change" diff, ask "if I reverted this one line, which assertion goes red?" If the answer is none, you owe it either a declaration plus an observing test, or its own commit.

### Lesson — Extraction relocates the answer; the question has to be carried by hand

**Illuminated by:** F-03 (Sam), P-05 (Sam), and the panel's reachable-inputs-vs-state-space refinement

The old `dismissPersonaGuest` branched on *liveness*; the new one branches on the conversation id the roster hands back. On every input reachable today those predicates agree, so the extraction is behavior-preserving — and simultaneously weaker, because the new expression conflates "nothing happened" with "disposed a live guest carrying no conversation id," skipping the manifest delete and the run cancellation. "Same answers on current inputs" and "same question" are different claims, and only the second survives the next feature. The counter-example sits in the same PR: the passage collaborator returns pre-mutation facts *as values*, so `replaceExcerpt`'s reorder is provably safe rather than accidentally safe.

**Carry forward:** When a condition crosses a seam, name aloud the two states it separates, then ask the new collaborator which of those states its own predicates admit. If it ships an `isLivePersonaGuest`, it is telling you that state is representable — believe it.

### Lesson — Prove it at the altitude you promised it

**Illuminated by:** F-09 (Cal), F-04 (Cal, Patricia), F-05 (Marcus, Parker), P-02 (Stan)

Three findings are one shape. The reset-counter correction is declared at the aggregate and proven at the ledger, so a regression that reconstructs instead of delegating passes. Atomicity is claimed for six prepares and fault-injected at position four, so the last two and the degradation remap never run under fault. The ordering witness matches `this.x =`, a proxy that a hoisted `installPreparedState(...)` slides straight past — passing both guards while creating the exact partial-hydration bug the PR exists to prevent. And F-05 is the same gap in prose: the docstring promises immutability between phases while the code practices "throw-free, assignment-shaped work above the barrier." Compare Stan's witness, which derives its population from the directory: it guards the claim itself.

**Carry forward:** After writing a guard or a test, ask "what is the cheapest edit that breaks the promise and keeps this green?" If you can name one in under a minute, you are testing a proxy — and say the invariant you actually keep, not the stronger one that sounds better.

### Lesson — A pattern becomes canon on its first mass copy, and the copier reads the code, not the plan

**Illuminated by:** F-08 (Marcus, Stan), F-06 (Marcus, Stan), F-07 (Parker, Tim)

The prepare/install pattern is five days old and this is its first reproduction at scale — which makes this PR, not the original, the moment the convention is set. Three forks shipped unrecorded: one collaborator defaults its clock while five require it, reset-counter semantics vary, and "ledger" names two different transaction disciplines. The panel was right to reject "there is no rule" — the clock rule *was* written, in the sprint planning document, which is not where the sixth implementer looks. The same gravity produced two deep-copiers for one `WorkshopTurn` and two import origins for the record types: when knowledge lives in two places, one of them will drift, and the drift is silent.

**Carry forward:** When you write instance N of a young pattern, put the convention in a doc-comment beside the contract, and if you deviate, record the deviation at the deviating site. Then delete the old path in the same PR — one live origin, one copier, one rule.

### Lesson — The recovery path runs on your worst day and gets your least practice

**Illuminated by:** F-10 (Oliver), F-11 (Oliver), P-01 (Blake)

`catch (error) { this.restoreRollback(rollback); throw error; }` reads as careful and behaves as amnesia: a throw inside the restore pre-empts the rethrow, and nothing ever logged the primary failure. This is the least-exercised code in the aggregate and the most consequential — hydration *is* rollback, so a failure below the install barrier leaves a writer's session file half-restored on disk. F-11 is the same neglect at the message layer: the one integrity check that names its rule but not its rows. The person reading that error has already lost their session; the error is the only thing you can still give them.

**Carry forward:** For every catch block that performs recovery, log the primary cause *before* attempting the restore, and ask what the reader sees when the recovery itself fails. Then check that each refusal message names the rows, not just the rule.

*Across all thirteen findings, one quiet question keeps changing costume — where does this claim live, and who would notice the day it stops being true? — and the answer is already written well in five places in this PR, which is the surest sign the practice is taking.*

## Horizon Watchlist

Not merge blockers; future pressures the runway and panel supported.

- **Phase 7 manifest ownership** will confront the degradation remap — the entangled passage that writes manifests, passage state, and roster input in one pass. Extracting manifests forces a decision about where remapping lives.
- **Turn-ledger vocabulary pressure.** The generic name holds only while the ledger knows no artifact vocabulary. The first time thread-artifact bodies want ledger-coordinated windowing or retention, either the ledger learns vocabulary or a paired ledger appears.
- **The scope-lock concept spans three homes** (roster evidence, passage-scope refusal, aggregate doc comment). Any future participant type touches all three.
- **Witness blind spot for mismatched filenames.** A future `session/` file whose exported class name differs from its basename drops out of the bypass guard silently; asserting every class-exporting file yields a name would close it.
- **Forward compatibility of a future `counters` key** under the strict shape validator was not verified — worth one check when the next collaborator adds a counter.
- **Fitness function worth considering:** a witness that requires every `installPreparedState` offset to follow the last `prepareState`, which would convert F-04's proxy into a real guard.

## The Closer

🎬 **Movie tagline** — *Four concepts walked out of the house they built. The house got quieter, the locks got smarter, and two doors closed so gently that nobody wrote down they'd been open.*

## Final Assessment

Merge-ready in substance, not yet in paperwork. The architecture is honest — four genuinely closed concepts, five retained clusters with written reasons, a witness that grows with the directory, and an atomicity contract Blake traced end-to-end without finding a reachable failure path. What stands between this and merge is small and specific: declare the two behavior deltas the PR made without claiming (F-01, F-02), add the one assertion that makes the manifest fix falsifiable, and — cheaply, while the files are open — delete the dead re-export block, drop the clock default, and remove the double snapshot clone.

The rest is follow-up: one fault-injection test through a new collaborator's prepare would convert this sprint's central guarantee from a textual proxy into a proof, and it is the single highest-value test the epic could add next.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
