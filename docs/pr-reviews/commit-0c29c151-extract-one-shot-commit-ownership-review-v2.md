# Commit Review v2 — refactor(workshop): extract one-shot commit ownership

**Author:** Okey Landers · **Commit:** `0c29c151` on `sprint/conversation-widgets-03-creative-variations`
**Reviewed:** 2026-08-10 · **Mode:** Full (runway reused, not regenerated)
**Sprint context:** Slice 1 of 7 — [Sprint 03: Creative Variations Explorer](../../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/03-creative-variations.md)

**Scope caveats**

- The working tree contains **uncommitted Slice 2 work** (`WorkshopWidgetConfigLedger.ts`, `WorkshopWidgetConfigOperations.ts`, `WorkshopWidgetPersistenceLifecycle.ts`, `promptBudgets.ts`, `messages/workshop/{index,widgets}.ts`, plus untracked `creativeVariations/`). **None of it is in scope.** All source was read from a pristine detached worktree at `0c29c151`; the panel was explicitly instructed not to read the dirty checkout.
- `HEAD` is two commits ahead (`7c4b673b`, `450dfaf9`) — both docs-only. Not reviewed.
- Single-commit mode: there is no MR, no description, and no prior reviewer comments. The commit message body is **empty**; the subject line is the only declared intent inside the commit itself.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason ·
**Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise,
superseded, or not actionable.

**Resolution update (2026-08-10):** The follow-up commit `06557616`
(`fix(workshop): harden one-shot commit ownership`) addressed every actionable
finding below. The body of the review remains the historical evidence captured
at `0c29c151`; this ledger records the branch's current resolution state.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Writer-origin artifact-delivery assertion did not survive the test split | Blake, Sam, Cal | 3 independent | 🎯🎯 Strong Consensus | **Addressed** — assertion restored in `06557616` |
| F-02 | 🟡 Standard | One-shot dispatch is a partial function guarded from outside; refusal arm untested | Sam, Stan, Patricia, Cal | 4 runway-prompted | 🧭 Corroborated Runway | **Addressed** — closed runtime refusal plus witness in `06557616` |
| F-03 | 🟡 Standard | Availability policy injected at handlers, defaulted at the recommendation surface | Marcus, Sam, Stan, Cal | 4 runway-prompted | 🧭 Corroborated Runway | **Addressed** — availability binding made explicit in `06557616` |
| F-04 | 🟡 Standard | Coordinator spreads feature-owned artifact over the identity keys it minted | Patricia | 1 independent | — | **Addressed** — coordinator identity made authoritative in `06557616` |
| F-05 | 🟡 Standard | Commit refusal ladder is silent; first rung conflates two causes | Oliver, Sam | 1 independent · 1 corroborating | — | **Addressed** — classified refusal diagnostics added in `06557616` |
| F-06 | 🟡 Standard | `roomText`/`displayText` became separable with no assertion on the writer's turn | Bria | 1 independent | — | **Addressed** — writer-turn and chip-copy assertions added in `06557616` |
| F-07 | 🟡 Standard | `toolTargetRefusalMessage` is a required success-path field carrying refusal copy | Marcus, Parker | 1 independent · 1 runway-prompted | — | **Addressed** — success/refusal contract separated in `06557616` |
| F-08 | 🟡 Standard | `selectionCount` freezes a Gesture-shaped noun into the family contract | Bria | 1 runway-prompted | — | **Addressed** — feature-derived commit label replaces the generic noun in `06557616` |
| F-09 | 🟡 Standard | Room-send seam mirrored without its rationale; artifact shape declared twice | Parker | 1 independent | — | **Addressed** — seam and artifact ownership consolidated in `06557616` |
| F-10 | 🟡 Standard | Writer-facing route validation landed in the persisted-shape codec | Parker | 1 runway-prompted | — | **Addressed** — source-reference validation extracted in `06557616` |
| F-11 | 🔵 Nit | `CommitPreparation` / `PreparedCommit` differ by word order; `prepare` vs "compiler" | Parker | 1 runway-prompted | — | **Addressed** — one-shot seam vocabulary aligned in `06557616` |
| F-12 | 🔵 Nit | `'WorkshopGesturePlaygroundHandler'` is now a dead `WorkshopMutationRouteOwner` arm | Blake, Sam | 2 independent | — | **Addressed** — dead owner arm removed in `06557616` |
| P-01 | ⭐ Praise | Registry total at compile time; guard derived from the registry object itself | Blake | — | — | **N/A — preserve** |
| P-02 | ⭐ Praise | Path-leak refusal moved byte-for-byte, both call sites intact, now witnessed twice | Patricia | — | — | **N/A — preserve** |
| P-03 | ⭐ Praise | All writer-visible strings byte-identical; `includeMessageAttachments` type-locked | Bria | — | — | **N/A — preserve** |
| P-04 | ⭐ Praise | Architecture ledger moved in the same commit; new generics left off the allowlist | Stan | — | — | **N/A — preserve** |
| P-05 | ⭐ Praise | `widgetId` added to every coordinator log line before the route went plural | Oliver | — | — | **N/A — preserve** |
| P-06 | ⭐ Praise | Synchronous `prepare` structurally forbids I/O in the discarded-work window | Tim | — | — | **N/A — preserve** |

## Review coverage

- **Read fully:** the complete 2,289-line unified diff; all four new source files; both modified handlers; `WorkshopSliceComposition.ts`; `WorkshopRouteContracts.ts`; `WorkshopWidgetRecommendationOperations.ts`; `GesturePlaygroundConfigCodec.ts`; all five touched test files; `boundaries.test.ts`; the sprint contract; the implementation runway; `CLAUDE.md`.
- **Read as siblings/callers:** `workshopWidgets.ts` catalog, `messages/workshop/widgets.ts`, `WorkshopWidgetConfigLedger.ts`, `WorkshopSessionService.ts`, `WorkshopWidgetPersistenceLifecycle.ts`, `WorkshopWidgetConfigOperations.ts`, `WorkshopRunCompletion.ts`, `WorkshopSessionStateV1Shape.ts`, `WorkshopRoomHandler.ts`, `WorkshopTurnBubble.tsx`.
- **Compared against parent:** `e02e7702`, including the deleted `handleCommit` body and the deleted 231-line "atomic commit" test block.
- **Verification run at the reviewed commit** (pristine worktree): `jest` → **194 suites / 2012 tests pass** (parent: 192 / 2007); `npm run typecheck` (core + webview + ext) → **clean**; `npm run lint` → **0 errors**, 934 pre-existing `curly` warnings.
- **Mutation probes** run by Blake at both commits to test assertion strength (see F-01).
- **Blast radius:** 17 files, +1,189 / −689. 4 new source modules, 2 new test suites, 1 architecture-ledger change, 1 doc status line. No migrations. No `vscode` imports added to core. No public API surface outside the Workshop widget family.

---

# Part I — Semantic Runway

**This review did not regenerate a runway.** At the user's direction, it reuses the existing
architecture-change runway, which was written for this sprint on the same day and which names
the reviewed commit as its Slice 1:

> **[Architecture Change Runway — Creative Variations Explorer](../architecture/2026-08-10-creative-variations-implementation-runway.md)** (2026-08-10)

That document supplies the change thesis, the responsibility ledger, the contracts-and-invariants
table, the negative-space table, the alternatives considered, the ranked findings this slice was
meant to discharge (F1, F3), the prospective-failure review, and the reproduction test. It is the
authority for *what this change means*; the four runway scouts were not run, and no part of it was
rewritten here.

What follows is only the **Slice-1-scoped synthesis brief** given to the panel — the subset of that
runway the implementation was tested against.

## Runway Synthesis Brief — Slice 1

**Thesis.** Because the second one-shot widget has arrived while the family commit route and
room-send contract are still Gesture-owned, move one-shot route and transaction ownership to the
generic widget host plus a mechanical coordinator, preserving the durable retry config, atomic
turn/artifact acceptance, exact persisted variants, writer authority, and zero editor mutation.

Slice 1's stated purpose: *"Correct family one-shot ownership without behavior change."*
Rollback seam: *"revert pure extraction."*

**Invariants the slice must preserve**

1. Exactly one `WORKSHOP_COMMIT_WIDGET` route, now owned by the Widget Host.
2. The durable retry config (`wc-N`) may precede room acceptance and must survive refusal — the
   atomic unit is *writer turn + artifact*, not config + turn + artifact.
3. Exact widget-id ↔ draft pairing; a sibling draft must never cross the route.
4. Catalog liveness gates every route through one injected availability policy whose production
   implementation reads the catalog. No environment flag, no production bypass.
5. The writer's staged composer attachments are never consumed by a widget commit.
6. Acceptance is a separate milestone from the participant reply; a later participant-response
   failure must not revoke an accepted widget commit.

**Negative space.** The widget host may know message type, widget id, mutation gate, and action
correlation — not invariants, prose, or tradeoffs. The one-shot operations module may know exact
supported ids and feature compiler callbacks — not feature validation or artifact wording. The
coordinator may know config input, room/display text, artifact envelope, and acceptance callbacks —
not feature vocabulary or feature failure copy.

**Questions put to the panel** (neutral, not verdicts)

- Does the extracted transaction reproduce the previous commit semantics exactly, including the
  acceptance-vs-settlement milestones and every failure classification?
- Where does the system now commit to the new reality, and is that commitment point still singular
  and observable?
- Is the closed dispatch total, or does it depend on an external guard being called first?
- Did the redistribution of the deleted 231-line "atomic commit" block preserve every behavioral
  guarantee it previously asserted, or did some guarantee become an inference from composition?
- Does the availability seam consolidate liveness, or introduce a second way to answer the same
  question?
- Does the generic family layer stay free of feature vocabulary, and is that enforced automatically
  or only by review?

**Scope rule given to the panel.** This is deliberately Slice 1 of 7. Absence of Creative Variations
code is the declared plan, not an omission; no finding may be "add Creative Variations" or "flip the
catalog." Reviewers *may* flag a seam that will predictably fail or mislead when Slice 2 or 5 lands.

---

# Part II — The Review

## Executive Briefing

**Verdict:** **Nearly there** — the extraction itself is faithful and verified branch-by-branch, but
it deleted a regression guard on persisted writer data and did not rehome it.

- 🟠 **F-01 · Writer-origin artifact-delivery assertion did not survive the test split** `🎯🎯 Strong Consensus` — the deleted test block was the only thing asserting that an accepted commit files into the writer-origin manifest. Blake proved by mutation that deleting `recordWidgetArtifactDelivery` fails a test at the parent commit and **passes all 2012 tests at this one**. The code is correct today; the alarm is gone. Restore the assertion in the coordinator suite before merge — it is roughly one line.

Nothing else rises to Blocking or High. Behavior preservation was checked mechanically, not by
reading: guard order is identical, all 20 validation strings are byte-identical, the composed
writer-visible sentence is identical to its curly quotes, every failure classification produces the
same action-result payload, and `includeMessageAttachments: false` is now type-locked to the literal
rather than merely happening to be passed.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus | B+ | Ownership genuinely moved and the commitment point survived intact; one delegation asymmetry (F-07), and the lane's headline finding was refuted by the architecture tests themselves. |
| Critical Correctness — Blake | A− | Branch-by-branch equivalence verified against the parent; no live defect found; the one issue is a removed guard, not a break. |
| Edge Cases — Sam | B | The happy and failure paths are faithfully reproduced; the dispatch is partial and its refusal arm lost its only witness (F-02). |
| Code Quality — Parker | B | Reads linearly and the outcome union beats the old boolean flag; vocabulary is unsettled and two rationale comments did not move with the code (F-09, F-11). |
| Tests — Cal | C+ | 20 cases became 21, but four guarantees became inferences from composition and the highest-value one vanished entirely (F-01, F-02). |
| Codebase Fit — Stan | B+ | Route ledger moved in the same commit, three sibling registries followed; the fourth lookup did not take the family's refusal shape, and two injection styles now compete (F-02, F-03). |
| Performance — Tim | A | Nothing material at any N this system will see; the synchronous `prepare` signature structurally bounds the horizon (P-06). |
| Security — Patricia | B+ | The path-leak control moved byte-for-byte with both call sites intact; the spread-order authority hazard is latent, not live (F-04). |
| Observability — Oliver | B− | Transaction logging improved and gained `widgetId` ahead of need; the entire pre-transaction refusal ladder is silent and one rung conflates two causes (F-05). |
| Domain Logic — Bria | A− | Writer-visible behavior verified byte-identical; two family contract questions were frozen without an explicit decision (F-06, F-08). |

## Findings

### F-01 · 🟠 High — Writer-origin artifact-delivery assertion did not survive the test split `🎯🎯 Strong Consensus`

**Raised by:** Blake, Sam, Cal
**Discovery:** 3 independent · 0 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator.ts:87` — `this.session.recordWidgetArtifactDelivery(artifactId, prepared.artifact.label, prepared.artifact.content.length, target);`
**Affected contract:** persisted session data (`writerSources`) + test contract

The deleted `describe('WorkshopGesturePlaygroundHandler — atomic commit')` block asserted that
`session.collectWriterSources({ kind: 'host' })` moved from `[]` before acceptance to a
`message-attachment` entry carrying `artifactId: 'ta-1'` after it. That was the only guard on
`recordWidgetArtifactDelivery`, which files the committed artifact into the target participant's
writer-origin manifest — a validated field of the persisted session shape
(`WorkshopSessionStateV1Shape.ts:83,119,395`) and therefore Marketplace writer data under
ADR 2026-07-30.

The redistribution kept the config-linkage half of that test and dropped the manifest half.
Searched the entire `__tests__` tree for `recordWidgetArtifactDelivery` — not found. The
surviving `collectWriterSources` assertions cover pins and context attachments on different
paths; the end-to-end `WorkshopRoomHandler.seams.test.ts` asserts `threadArtifacts` and
`turn.widgetCommit`, which come from other calls.

Blake proved the asymmetry rather than inferring it:

- At parent `e02e7702`, deleting the `recordWidgetArtifactDelivery` call → **1 test fails**.
- At `0c29c151`, deleting the equivalent call → **194 suites / 2012 tests pass**.
- At `0c29c151`, hardcoding the fourth argument to `{ kind: 'host' }` → **also all green**.

Cal traced the second mutation's consequence: `recordWidgetArtifactDelivery`
(`WorkshopSessionService.ts:904-931`) routes into three manifests by target kind and defaults to
`{ kind: 'host' }`. A `personaGuest` chat target is fully reachable at commit — the host refuses
only `kind === 'tool'` (`WorkshopWidgetHostHandler.ts:119`) — yet all five coordinator tests pass
`{ kind: 'host' }`. A regression would file a guest's artifact under the host manifest, so the
guest's catch-up delivery never records it and the artifact can ship twice.

The failure mode in all three cases is silent: the writer turn and artifact still land, the config
still stamps `committedTurnId`/`artifactId`, the sheet still receives `ok: true`, and only the room's
accounting of what the writer supplied is wrong. This commit is where the assertion's home was
demolished, so this is where it should be rebuilt.

**Recommendation:** In `WorkshopOneShotWidgetCommitCoordinator.test.ts`, add to the deferred-acceptance
case: `collectWriterSources({ kind: 'host' })` is `[]` before `acceptRoom()` and contains the
`message-attachment` entry for `ta-1` after. Add one case committing against
`{ kind: 'personaGuest', personaId: … }` asserting the entry lands under that guest and not under
the host — that kills the default-argument mutant in the same test.

---

### F-02 · 🟡 Standard — The one-shot dispatch is a partial function guarded from outside, and the guard's refusal arm lost its only witness `🧭 Corroborated Runway`

**Raised by:** Sam, Stan, Patricia, Cal
**Discovery:** 0 independent · 4 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts:74-81` — `const entry = WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS[payload.widgetId] as unknown as WorkshopOneShotWidgetCommitOperation; return entry.prepare(payload);`
**Affected contract:** maintenance + test (route refusal semantics, webview action-result correlation)

`prepareWorkshopOneShotWidgetCommit` is exported, performs an unguarded computed index, and
immediately erases the type — so a registry miss is invisible to the compiler and yields
`entry.prepare` on `undefined`. Its guard, `supportsWorkshopOneShotWidgetCommit`, lives in the same
module but is never called by it; only `WorkshopWidgetHostHandler.ts:93` calls it, correctly and
first.

Patricia confirmed the guard itself is sound: `Object.prototype.hasOwnProperty.call` returns `false`
for `__proto__`, `constructor`, `toString`, `hasOwnProperty`, and `valueOf` against this registry
shape. There is no prototype-chain escape. The issue is not the guard's quality but its location.

Stan supplied the convention: all three sibling closed registries keep the refusal *inside* the
lookup. `WorkshopWidgetPersistenceLifecycle.ts:139` re-checks `isPersistedWorkshopWidgetId` and
throws `Unsupported persisted Workshop widget: ${widgetId}` before the identical `as unknown as`
cast; `WorkshopWidgetConfigOperations.ts:27` bottoms out in a `never`-arm; and
`inspectWorkshopWidgetRecommendation` calls its guard inline, in the same function, immediately
before indexing. This fourth registry is the odd one out — and it is the file a Slice 5 author will
copy.

Sam traced the consequence if the guard is ever bypassed: the `TypeError` travels out of the
mutation registrar and `MessageRouter.route`, lands in the generic catch at
`MessageHandler.ts:364-374`, produces an "Error processing request" toast, and posts **no**
`WORKSHOP_WIDGET_ACTION_RESULT` bearing the `requestToken`. The sheet correlates strictly by token
and cleared its result on send, so the commit spins indefinitely.

Cal established that the arm is untested at any level. The Host suite's `createHandler({ available: false })`
passes `widgetId: 'gesture-playground'` — an id that *is* in the registry — so it exercises the
availability arm only. Searched the diff and evidence pack for any test posting
`WORKSHOP_COMMIT_WIDGET` with a non-registry `widgetId` — not found. The deleted
`['non-live widget', { widgetId: 'prose-controller' as never }]` case was the only one. This matters
now rather than later because `lexical-gravity` is `live: true` and not a one-shot operation, so it
is the first id for which the two arms genuinely disagree — and a writer committing it would be told
*"That widget is not available yet."* about a widget that shipped.

**Blake dissented, and was filed as praise (P-01).** He is right that the `satisfies` mapped registry
makes the dispatch total *at compile time*: removing the `gesture-playground` arm produces
`TS1360`, so widening `WorkshopCommitWidgetPayload` in Slice 2 without adding a compiler is a build
break, not a runtime crash. Both readings are correct — compile-time totality is real, and runtime
totality is delegated to a caller in another module.

**Recommendation:** Move the guard inside. Mirror `lifecycleFor`: return `{ ok: false, message: … }`
(or throw a named `Unsupported one-shot Workshop widget: ${widgetId}`) on a miss, which also lets
the double cast shrink. Then restore one host-suite case — `widgetId: 'prose-controller' as never`
against `fixedWorkshopWidgetAvailabilityPolicy(['prose-controller'])`, so availability is true and
the registry arm is the one under test — asserting `ok: false` and that the coordinator is never
reached.

---

### F-03 · 🟡 Standard — Availability is injected at the handlers but defaulted at the recommendation surface, and no production caller threads it `🧭 Corroborated Runway`

**Raised by:** Marcus, Sam, Stan, Cal
**Discovery:** 0 independent · 4 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations.ts:117` — `availability: WorkshopWidgetAvailabilityPolicy = WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY` against `packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts:38` — `private readonly availability: WorkshopWidgetAvailabilityPolicy,` (required, no default)
**Affected contract:** test fidelity + composition-root visibility

The seam works exactly as designed where it is a constructor argument. `WorkshopSliceComposition.ts:117,133`
names `WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY` twice, in the open, and
`fixedWorkshopWidgetAvailabilityPolicy` appears only in tests — there is genuinely no production
bypass, and runway invariant 4 holds at the route layer. Stan noted this is the version of the seam
worth copying, because it cannot be silently skipped.

The recommendation surface took a different shape. Both new functions take the policy as an optional
trailing parameter defaulting to production, and **no production code passes it**:
`WorkshopRunCompletion.ts:211` calls `inspectWorkshopWidgetRecommendation(result.content)` with one
argument, and `WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` takes the default at module load.
Searched the diff and evidence pack for a non-test caller supplying a policy to either function —
not found; the only injectors are `WorkshopWidgetRecommendationOperations.test.ts:93,146`.

So a Slice 3/5 route matrix that stages `creative-variations` through a fixed policy will go green
while the real recommendation path still consults the catalog — which is the runway's own
prospective-failure story, *"dormant Creative code passes unit tests but fails its real route,"*
reappearing on the surface the policy was supposed to have closed. Stan added a third competing
shape already in the family: `WorkshopStandingDirectiveHandler.ts:38-39` solves the same
closed-registry-with-production-default problem as a defaulted *constructor* parameter one directory
over.

Cal found the mirror image in the tests: `WorkshopWidgetRecommendationOperations.test.ts:93` injects a
fixed policy exactly as intended, while `WorkshopGesturePlaygroundHandler.test.ts:91` injects the
**production** catalog policy — coupling ~20 generate tests to `gesture-playground.live === true`
in the shipped catalog, the precise coupling the policy was introduced to break. The new
`|| !this.availability.isAvailable(widgetId)` clause at `WorkshopGesturePlaygroundHandler.ts:91` is
consequently never exercised; deleting it leaves all 2012 tests green.

**Stan dissented on one part, persuasively.** Marcus and Sam both flagged
`WorkshopSessionStateV1Shape.ts:611` — which still asks `isLiveWorkshopWidgetId` directly and
`shapeError`s a persisted recommendation for a non-live id — as unfinished consolidation. Stan
argues it should stay catalog-bound: per ADR 2026-07-30 the codec is the public version boundary,
and injecting a route-staging policy into a decoder would let a staged build write sessions a
shipped build cannot read. Sam's counter stands too: a recommendation accepted at the route under a
widened policy would then fail at decode, and a shape error at decode means the writer's saved room
refuses to open. Both agree the resolution is documentation, not injection.
`WorkshopWidgetsModal.tsx:40` is webview presentation and cannot import an application service
without a dependency elevator — also a legitimate distinguishing fact.

**Recommendation:** Pick one shape for the recommendation surface — either make the parameter
required and let `WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION` pass the catalog policy explicitly so
the production binding is one greppable line, or drop the parameter and keep the policy only where
it is genuinely injected. Separately, add a comment at `WorkshopSessionStateV1Shape.ts:611` recording
that persisted recommendations are deliberately catalog-bound and not policy-bound. Switch
`WorkshopGesturePlaygroundHandler.test.ts` to a fixed policy so the new availability clause is
actually exercised.

---

### F-04 · 🟡 Standard — The coordinator spreads a feature-owned object over the identity keys it just minted

**Raised by:** Patricia
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator.ts:79-84` — `widgetArtifact: { id: artifactId, widgetId: prepared.widgetId, widgetConfigId: config.id, ...prepared.artifact }`
**Affected contract:** data integrity at the generic ↔ feature ownership boundary (ADR 2026-08-03)

The coordinator mints `artifactId` and owns `config.id` — the linkage keys that `recordWidgetCommit`
and `recordWidgetArtifactDelivery` stamp into the persisted session and that the room uses to bind
the artifact to the writer turn. It then spreads a feature-owned object **after** them. Spread wins.
The three ids the generic owner is responsible for are structurally overridable by the feature it is
supposed to be neutral toward.

The predecessor did not have this shape: the old handler enumerated all six keys explicitly
(`WorkshopGesturePlaygroundHandler.handleCommit` at the parent commit). The weakening is introduced
here.

There is no live vector, and that should be stated plainly: `prepareGesturePlaygroundOneShotCommit`
returns a fresh object literal, so excess-property checking currently fires. The reachability is a
future one and not exotic — TypeScript's excess-property check applies only to fresh literals, so a
Slice 5 compiler that builds its artifact in a helper and returns the *variable* carries any extra
`id` straight through. The result would not be a crash but a session recording config → artifact
`ta-N` while the room displays a different artifact id: silent linkage divergence in persisted
writer data.

**Recommendation:** Put the spread first — `{ ...prepared.artifact, id: artifactId, widgetId: prepared.widgetId, widgetConfigId: config.id }` — or destructure `const { label, content, selectionCount } = prepared.artifact`. One line, and the generic owner keeps authority over the ids it mints regardless of what any future compiler returns.

---

### F-05 · 🟡 Standard — The commit refusal ladder writes nothing to the log, and its first rung hides two causes behind one message

**Raised by:** Oliver (independent), corroborated by Sam
**Discovery:** 1 independent · 1 corroborating
**Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/workshop/widgets/WorkshopWidgetHostHandler.ts:92-104` — `if (!supportsWorkshopOneShotWidgetCommit(widgetId) || !this.availability.isAvailable(widgetId)) { this.postActionResult({ … message: 'That widget is not available yet.' });`
**Affected contract:** operational (diagnosability of a writer-visible refusal)

Oliver mapped every log line across the extraction and found **parity on the success path and
better identifiers**: all four transaction lines survived with the same text and emission order, each
gaining `prepared.widgetId` (see P-05). The gap is entirely on the paths where nothing gets
committed. All five pre-transaction refusals return without touching `outputChannel`. Searched the
diff for a log statement on any refusal path — not found; the only four `appendLine` additions in
the commit are in the coordinator.

The old handler was equally silent, so the silence itself is inherited. Three things make this
commit the natural repair point rather than a later slice:

1. The first rung is no longer one condition. `!supportsWorkshopOneShotWidgetCommit` is a *wiring*
   fact and `!isAvailable` is a *policy* fact, and they emit the identical sentence. Sam independently
   reached the same conclusion from the edge-case side, noting the message is actively false for
   `lexical-gravity`.
2. `availability` is now **injected**, so a composition mistake — a stale or empty fixed policy —
   would refuse every commit for every widget with no log line, no error, and a message that reads
   like normal product behavior.
3. The ~20 validation refusals moved into `GesturePlaygroundOneShotCommit.ts`, a pure module with no
   `LogSink` parameter, so they are now *structurally incapable* of logging. The writer reports "it
   won't let me commit"; the developer opens the Output Channel and finds no evidence a
   `WORKSHOP_COMMIT_WIDGET` message ever arrived.

The convention exists in this same class and this same commit: `handleRequestConfig` logs both of its
refusals distinctly (`:73-77`), and its test names the discipline — *"rejects malformed config ids
without echoing the untrusted value to logs."*

**Recommendation:** One line per rung in `handleCommit`, distinguishing the two conflated causes and
carrying `requestToken` — the only identifier a pre-transaction refusal has, since no `wc-N` exists
yet, and the id the webview already correlates on. Split the writer-facing copy too, so a live
non-one-shot widget is not told it "is not available yet." Log a stable reason code rather than
echoing `preparation.message`, which can contain writer prose.

---

### F-06 · 🟡 Standard — `roomText` and `displayText` became separable, and the writer's visible turn has no assertion

**Raised by:** Bria
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts:24-25` — `  roomText: string;` / `  displayText: string;`
**Affected contract:** test contract + consumer-visible response semantics

`executeMessage(text, displayText, …)` uses the first argument for the model message and the second
for the *visible writer turn* in the transcript. Before this commit those could not diverge: the
handler called `sendRoomMessage(displayText, displayText, {…})` — one variable, passed twice. This
commit replaces that with two independently settable fields on the prepared-commit contract.

That is a reasonable seam. What makes it a finding is that nothing guards the writer's side:
`GesturePlaygroundOneShotCommit.test.ts:57-71` asserts with `expect.objectContaining`, which omits
`displayText` entirely and checks only `roomText: expect.stringContaining('she smiled')`; the
coordinator test names the parameter `_displayText` and never inspects it; the 20 validation
messages are asserted only as `message: expect.any(String)`. Searched the diff and evidence pack for
an assertion on `displayText`, on the composed `For “…”` sentence, or on any of the 20 validation
strings — not found.

Today the note clause and dictionary clause of the writer's visible turn are unprotected —
reordering them, dropping the em-dash, or sending `roomText` where `displayText` belongs all stay
green. Bria verified by hand that they are currently byte-identical to the parent (see P-03); the
point is that the suite would not have said so. At Slice 5 a second compiler fills both fields and
the only witness on composed text will still be `roomText contains 'she smiled'`.

**Recommendation:** In `GesturePlaygroundOneShotCommit.test.ts`, replace the `objectContaining` with
an exact `displayText` assertion for three cases — no note, with note, with
`includeDictionaryInCommit: true` — and pin two or three validation strings by content (blank phrase
and no selections at minimum). No Creative code required.

---

### F-07 · 🟡 Standard — `toolTargetRefusalMessage` is a required success-path field that explains a refusal

**Raised by:** Marcus, Parker
**Discovery:** 1 independent · 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts:26` — `  toolTargetRefusalMessage: string;` · `WorkshopWidgetHostHandler.ts:125` — `message: preparation.commit.toolTargetRefusalMessage`
**Affected contract:** maintenance (feature-family extension contract)

Marcus was explicit that this is not a boundary violation: ADR 2026-08-03 §3 permits a generic module
to carry a feature's writer-facing copy *supplied through an explicit feature contribution*, and this
field is that mechanism.

The objection is to its shape. The host owns four refusal decisions and authors the copy for three
itself — unavailable, room-busy, not-accepted, failed. Only the tool-target refusal is delegated, and
it rides on `WorkshopOneShotWidgetPreparedCommit`, the value that means *"this draft is valid and
ready to commit."* A compiler must therefore emit, on its success path, an explanation for a
precondition it cannot evaluate and may not know exists — and because the field is required, every
future compiler inherits that obligation. Parker put the same observation as a shape problem: a field
describing what to say when we *don't* send rides inside a type whose every other field describes
what to send.

The predictable Slice 5 failure is copy-paste, not compilation. `GesturePlaygroundOneShotCommit.ts:39-40`
is the only exemplar; a Creative compiler cloned from it ships *"tool sidecars do not take gesture
directions"* to a writer committing variations. Nothing in the type system, the tests, or the token
scan notices, because the string lives in a feature file where it is legal.

**Bria dissented and filed the same design as praise.** Her argument: the alternative was neutralizing
the sentence into something generic, which would have been a silent writer-visible change in a slice
that promised none — this satisfies the boundary without paying for it in product voice, and it is
the right template for future feature-authored copy. Tim's P-06 supplies the supporting fact that the
resulting coupling is cheap.

The two positions are compatible: Marcus's fix preserves Bria's property.

**Recommendation:** Make the field optional and give the host a neutral default
(*"Switch to a persona target before committing a widget."*), so a feature supplies flavor only when
it has some. Follow-up is acceptable if Slice 2 lands first; do it before Slice 5 adds the second
compiler.

---

### F-08 · 🟡 Standard — `selectionCount` freezes a Gesture-shaped noun into the family contract

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** Medium
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts:27-31` — `  artifact: { label: string; content: string; selectionCount: number; };`
**Affected contract:** business / domain vocabulary contract for the one-shot family

The runway grants the coordinator knowledge of the "artifact envelope." `label` and `content` are
genuinely neutral; `selectionCount` is a count of *writer-kept units*, and it is now a **required**
field of both `WorkshopOneShotWidgetPreparedCommit.artifact` and `WorkshopOneShotWidgetRoomArtifact`.

The field was already generic upstream (`WorkshopRoomHandler.ts:1029`,
`WorkshopSessionStateV1Shape.ts:573-580`) — that part is inherited. What this commit does is make it
a required term of the *family* contract without saying what it means for a member that is not
Gesture. And its only writer-visible consumer gates on the rail, not the widget:

```
WorkshopTurnBubble.tsx:302   {turn.widgetCommit?.rail === 'thread-artifact' && onOpenWidgetConfig && (
:310                           <Icon name="hand" size={13} /> Gesture Playground{' '}
:312                           {turn.widgetCommit.selectionCount} direction
```

So at Slice 5 the first Creative Variations commit renders in the writer's transcript as
**"Gesture Playground · 3 directions."** The sprint's locked decisions say a Creative commit selects
*cards* and that full prose is an explicit per-card promotion — so a single integer is also lossy
for that widget, not merely mislabelled. The runway books the presentation half as its own F8
(MODERATE, deferred to Creative reopen UX); the contract half is undecided, and this is the commit
that froze it.

**Recommendation:** Follow-up, not a merge blocker. Either document the family meaning on the field —
one line stating "count of writer-selected units; the chip's noun is catalog-derived, not
'directions'" — or decide now that the chip summary is feature-authored copy on the prepared commit
(the move `toolTargetRefusalMessage` just made) and let `selectionCount` stay a telemetry integer.
Resolve before Slice 5 writes the second producer against an undeclared meaning.

---

### F-09 · 🟡 Standard — The room-send seam was mirrored structurally, but its rationale stayed behind and the artifact shape is now declared twice

**Raised by:** Parker
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator.ts:24-28` — the whole file carries one comment line, at `:1`
**Affected contract:** maintenance

The deleted `WorkshopGesturePlaygroundHandlerOptions` carried eight lines explaining the two hardest
facts on this rail: that `onRoomAccepted` is a *separate milestone* from the participant reply so the
authoring sheet never waits on model latency, and that `includeMessageAttachments` stays `false`
because the writer's staged pills belong to the message they were typing. The replacement type states
the shape and none of the why. Searched the full core source for the phrase "separate milestone" —
not found anywhere after this commit. The staged-pills sentence survives only at the provider end
(`WorkshopRoomHandler.ts:891-898`), which is not where a maintainer editing the *consumer* type will
look.

That matters more because the same commit created a second declaration of the widget-artifact shape:
`WorkshopOneShotWidgetRoomArtifact` (`:15-22`) duplicates the inline `widgetArtifact` shape at
`WorkshopRoomHandler.ts:900-907`, and the two already disagree — the mirror narrows `widgetId` to
`WorkshopOneShotWidgetId`, the original says `WorkshopWidgetId`. One wire shape, two declarations,
and the copy a Slice 5 author will edit is the one with no rationale attached. There,
`includeMessageAttachments: false` reads as an arbitrary literal; it is actually runway invariant 5.

**Recommendation:** Carry the two deleted sentences onto `WorkshopOneShotWidgetRoomSend` — one above
`includeMessageAttachments`, one above `onRoomAccepted` — and have `WorkshopRoomHandler.executeMessage`
reference `WorkshopOneShotWidgetRoomArtifact` instead of restating the shape.

---

### F-10 · 🟡 Standard — Writer-facing route validation landed inside the persisted-shape codec, which now holds three expressions of one rule

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec.ts:170-172` — `/** Writer-facing route validation for source-reference inputs. */ export function gesturePlaygroundSourceReferencesValidationError(value: unknown): string | undefined {`
**Affected contract:** maintenance

That file's own header declares its responsibility as the persisted-draft contract governed by
ADR 2026-07-30, whose failure mode is `shapeError(path, expectation)` for a developer reading a
corrupt session file. The new function's failure mode is *"Source material must carry at most 5
references."* — a sentence shown to a writer in a sidebar. Two audiences, two error vocabularies, one
file, and nothing in the module name warns you.

The concrete cost: the `/^ctx-[1-9]\d*$/` id format, the exact-key counts, the duplicate rule, and
the `gestureSourceReferenceCharacters` budget are now encoded three times *within this single file* —
`assertGesturePlaygroundSourceReferencesShape:168`, `assertGesturePlaygroundSourceReferencesIntegrity:221`,
and the new `:171`. Change the attachment-id format and all three must be found; two sit close enough
to look like the same function at a glance and differ enough that a copy-paste fix will not compile
identically. The duplication is inherited — the third copy previously lived as `validateSourceReferences`
in the Gesture handler — but this commit is what colocated it, and this is the natural repair point.

*(Patricia reviewed the same move from the security side and confirmed the validation logic itself is
byte-identical, with both call sites intact — see P-02. The concern here is placement and duplication,
not correctness.)*

**Recommendation:** Move the function into a `GesturePlaygroundSourceReferences.ts` sibling alongside
`GesturePlaygroundDirective.ts` — both current callers already import from that folder. Collapsing
the three rule expressions onto one shared predicate that each caller renders in its own error idiom
is acceptable as follow-up; the move itself belongs here, while the function is new and
un-depended-upon.

---

### F-11 · 🔵 Nit — Two exported types differ by word order, and the seam has two names

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `WorkshopOneShotWidgetCommitOperations.ts:20,34` — `WorkshopOneShotWidgetPreparedCommit` (the success payload) and `WorkshopOneShotWidgetCommitPreparation` (the result union containing it)
**Affected contract:** maintenance

The two exported types differ by word order alone, are used in adjacent positions across three files,
and autocomplete will offer both without disambiguating. Separately, `boundaries.test.ts:441` names
this seam `'closed one-shot feature-compiler dispatch'` and the module docstring says *"named feature
compilers,"* while every callable symbol says `prepare` — the architecture test is the enforcement
document for this boundary, so the vocabulary split makes the next author guess which is
authoritative. (`Operations` and `Coordinator` themselves are fine; both have sibling precedent.)

**Recommendation:** Rename the union to `…CommitPreparationResult` (or the payload to `…CommitPlan`),
and pick one verb — either rename `prepare*` to `compile*`, or change the `boundaries.test.ts` reason
string and docstring to say "preparation." Type-rename only.

---

### F-12 · 🔵 Nit — `'WorkshopGesturePlaygroundHandler'` is now a dead `WorkshopMutationRouteOwner` arm

**Raised by:** Blake, Sam
**Discovery:** 2 independent
**Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/workshop/WorkshopRouteContracts.ts:44` — `  | 'WorkshopGesturePlaygroundHandler'`
**Affected contract:** maintenance

That handler no longer registers any mutation route — `registerRoutes` now takes only the router, and
`WorkshopSliceComposition` no longer builds a mutation registrar for it. The union member is
unreachable. Under the project's alpha guidelines ("remove dead code aggressively; don't keep legacy
arms"), it should go.

Two related stale-but-harmless notes, not worth separate rows: the `boundaries.test.ts` approval
tokens for `WorkshopSliceComposition.ts` and `WorkshopRouteContracts.ts` still allow
`WorkshopGesturePlaygroundHandlerOptions`, a type this commit deleted — the approval check is
per-file, so unused tokens do not fail. And `WorkshopOneShotWidgetRoomSend` still declares
`userTurnId?: string` on its resolution, which the coordinator never reads — a second, quieter
acceptance channel sitting in the contract for a Slice 5 author to reach for instead of the callback.

**Recommendation:** Delete the union member; optionally tighten the two approval-token regexes and
drop the unread `userTurnId` while you are there.

---

## Praise

**P-01 · The registry is total at compile time, and the guard is derived from the registry itself** (Blake)
`WorkshopOneShotWidgetCommitOperations.ts:68`. Blake went after the `as unknown as` cast expecting an
undefined-`entry` crash waiting for Slice 5, and found two properties doing the work together:
`satisfies` over a mapped type keyed by `WorkshopCommitWidgetPayload['widgetId']` makes the registry
total — removing the arm yields `TS1360`, so widening the payload union in Slice 2 without adding a
compiler is a build break, not a runtime crash — and `supportsWorkshopOneShotWidgetCommit` derives
the guard from the registry object via `hasOwnProperty`, so guard and dispatch cannot drift the way a
hand-maintained id list would. Worth copying for the next closed dispatch.

**P-02 · The path-leak refusal survived the module move byte-for-byte** (Patricia)
`GesturePlaygroundConfigCodec.ts:186-193`. Exact-key validation is exactly the kind of control that
gets "cleaned up" into a permissive `typeof` check during an extraction. It wasn't: the strict
`Object.keys(reference).length !== 2` that rejects a `{ kind, attachmentId, path }` reference — and
stops workspace paths reaching a persisted, room-visible, model-visible artifact — is identical to
the parent apart from the signature line. Both call sites still reach it, and the refusal is now
witnessed in two suites rather than one, with the literal `/workspace/secret.md` payload preserved.

**P-03 · Every writer-visible string is byte-identical, and one invariant got stronger** (Bria)
Verified mechanically rather than by reading: four commit gates in identical order, 20/20 validation
strings byte-identical including en-dashes and 1-based group indices, the composed `For “…”` sentence
identical to its curly quotes and both optional clauses, all outcome messages identical. And
`includeMessageAttachments` is now typed as the **literal** `false` on
`WorkshopOneShotWidgetRoomSend`, so no future compiler can pass `true` without a type error — the old
handler merely happened to pass `false` at one call site.

**P-04 · The architecture ledger moved in the same commit, and the new generics were deliberately left off the allowlist** (Stan)
`boundaries.test.ts:193-195`. The route entry changed *owner* rather than being added beside a stale
one, and `WORKSHOP_GESTURE_HANDLER_OWNER` correctly survives because it still owns the two generate
routes. Better still is what was *not* added: only the operations dispatch went into
`WORKSHOP_APPROVED_GENERIC_FEATURE_SURFACES`. Because the token scan walks every source file and
fails any unapproved file containing a feature token, the coordinator and the availability policy
cannot acquire feature vocabulary without turning the build red. The correct move when extracting a
generic owner is to *not* add it to the approval list and let the scan hold the line.

**P-05 · Every transaction log line names the widget, before the route went plural** (Oliver)
`WorkshopOneShotWidgetCommitCoordinator.ts:66-71`. The old lines said `Widget commit staged (wc-3 → ta-1, …)`,
sufficient only because one widget could produce them. This commit makes `WORKSHOP_COMMIT_WIDGET` a
family route sharing one `wc-N` sequence, and added `prepared.widgetId` to staged, accepted, and
failed at the same time. When Creative interleaves with Gesture in the same Output Channel, `wc-7`
and `wc-8` stay attributable without opening the session file. The `clonedFromConfigId` provenance
suffix carried through intact.

**P-06 · The synchronous `prepare` signature bounds the horizon structurally** (Tim)
`WorkshopOneShotWidgetCommitOperations.ts:42`. The extraction did move `buildGestureDirective` ahead
of the cheap tool-target and room-busy guards — work discarded on refusal — because the refusal copy
now lives inside the prepared commit. Tim measured it: worst case ~66 KB of string built by one map
and one join, once per commit click, on a path whose next step is a model round trip. Immaterial, and
it *stays* immaterial because `prepare` returns a plain value with no `Promise`, no callback, and no
injected port, so no future compiler can put a file read or a network hop into that window without a
visible, reviewed change to the registry signature.

## What the Panel Changed About the Runway

**Affirmed.** The Slice 1 thesis holds. Ownership genuinely moved: the route ledger records
`WORKSHOP_COMMIT_WIDGET` under `WORKSHOP_WIDGET_HOST_HANDLER_OWNER`, the Gesture handler retains only
its pre-commit generate routes, and runway F1 is discharged. Blake traced every branch of the old
`handleCommit` into the new three-part path and found no divergence in guard order, failure
classification, action-result payloads, or the acceptance-vs-settlement milestone. Invariants 1, 2, 5,
and 6 are preserved; invariant 5 is now type-locked. There is no production availability bypass.

**Refined.** Invariant 4 ("one injected availability policy") is true of the route layer and not of
the recommendation surface or the durable shape (F-03). The runway's verification line for this
slice — *"existing Gesture handler/service/session tests"* — treats the redistributed tests as
equivalent to the deleted ones; they are not (F-01, F-02, F-06). Its negative-space table tracks
feature vocabulary leaking *downward* into generic modules, and Patricia's two findings run the other
direction — **authority leaking upward**: a generic module publishing a partial function whose
totality is enforced elsewhere, and a generic owner spreading a feature object over ids it minted.
Neither appears as feature vocabulary in a generic file, so neither scan sees them. A row belongs in
§2.6 for *what a generic owner must not delegate*. Tim added that the negative-space rule has an
unstated latency consequence: forbidding the coordinator from knowing feature failure copy is what
pushed rendering ahead of the guards, and it is cheap only because `prepare` is synchronous — worth
owning as an accepted tradeoff rather than an emergent side effect.

**Rejected.** Marcus filed a Standard finding that the three new generic modules were not enrolled in
`WORKSHOP_GENERIC_FEATURE_COPY_SURFACES` — an explicit allowlist scanned for the literal prose
"Gesture Playground" / "Lexical Gravity" — arguing the boundary would then rest on review alone.
**The orchestrator dropped it under diff-read validation.** A second, broader scan
(`boundaries.test.ts:1113-1136`) walks *every* source file and fails any non-approved file containing
a feature token, and its vocabulary already includes `\bGesture\s+Playground\b` and
`\bLexical\s+Gravity\b` — so the three new files are already fenced against exactly the prose cited.
His forward-looking concern about Creative vocabulary is closed too:
`boundaries.test.ts:1008-1018` asserts that the feature-boundary descriptor ids equal the persisted-
lifecycle ids, so when Creative joins persistence in Slice 2 the build fails until its descriptor
exists. Stan had independently read the same tests the opposite way and filed the architecture as
praise (P-04). He was right. The map was corrected by the territory, which is the system working.

**Still unknown.** Whether `selectionCount` and the rail-keyed chip label are a decided family
contract or an undecided default (F-08) — that needs Okey, not another reviewer. Whether the
recommendation surface should have a real injected seam or none (F-03) is a design call the panel
scoped but did not settle.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A split unit splits its assertions, and the seams are where guards fall through

**Illuminated by:** F-01 (Blake, Sam, Cal), F-02's lost `prose-controller` witness (Sam, Stan, Patricia, Cal)

When one 231-line block becomes three focused suites, each new suite inherits the assertions that
belong to *its* subject — and the assertions that belonged to the whole, to the end-to-end fact that a
commit lands in the writer-origin manifest, belong to no one. Three well-tested units do not add up
to a tested composition; coverage stays green precisely because every part is still covered. The
unit-splitting refactor is one of the few moves in which the test suite can grow in count and shrink
in what it actually guards, which is why Blake's mutation probe — delete the call, see which commit
notices — is worth more here than any coverage number.

**Carry forward:** Before deleting a test block, enumerate its assertions as a list and assign each
one an heir by name; any assertion whose heir is "the composition" needs a home built for it, not a
suite that happens to be nearby.

### Lesson — An enforcement mechanism is code; read it before you trust it or fear it

**Illuminated by:** the refuted allowlist finding (Marcus filed it, Stan filed the same architecture as P-04), F-03's dissent (Stan)

Two careful reviewers looked at the same architecture tests and reached opposite verdicts — not
because either reasoned badly, but because "is this enforced?" is a question about what a specific
file does on a specific edit, and both answered it from the shape of the mechanism rather than from
its execution. The allowlist *looked* like the boundary, so its absence looked like a hole; the global
scan and the inventory-equality test were the boundary, and the author had correctly declined to
widen the allowlist. The same discipline resolved F-03 in the other direction: what looks like drift
("why is *this* one catalog-bound?") turned out to be a deliberate distinguishing fact about who may
write persisted data. Suspicion and praise are both hypotheses about a mechanism, and both are cheap
to check.

**Carry forward:** Before writing "this is unenforced" or "this is guarded," answer one question in
concrete terms — *what edit would make the build fail, and which file prints the error?* If you can't
name the file and the message, you're describing a shape, not an enforcement.

### Lesson — Totality is a property of a plane; say which plane you closed

**Illuminated by:** F-02 (Blake's dissent against Sam, Stan, Cal, Patricia), F-03 (Marcus, Sam, Stan, Cal)

Blake is right that a `satisfies` mapped registry makes dispatch total at compile time, and the others
are right that an unguarded computed index with an `as unknown as` cast leaves it open at runtime; the
disagreement dissolves the moment both name the plane they're standing on. The `as unknown as` is the
doorway between the two — a type-plane proof that stops holding exactly where the value plane begins,
which is why the sibling registries keep the refusal *inside* the lookup rather than beside it. F-03
shows the same geometry from another angle: a policy seam whose only caller is a test is closed on the
production plane and open on the test plane, which is a real property and worth stating out loud
rather than discovering later.

**Carry forward:** When you defend a design as "it can't happen," finish the sentence — *can't happen
at compile time, at runtime, or only in the callers we happen to have today?* Then ask who can still
reach it from the plane you didn't close.

### Lesson — Extraction relocates capability, not just code

**Illuminated by:** F-05 (Oliver), F-06 (Bria), F-04 (Patricia), F-08 (Bria)

A block of logic carries invisible affordances from wherever it used to live: a `LogSink` in scope, a
single local variable that made two fields identical by construction, a literal whose excess-property
check happened to protect the keys spread over it. Move it into a pure module and the twenty refusals
become structurally incapable of speaking; split the variable into two settable fields and an
invariant quietly demotes itself from *impossible to violate* to *nobody has yet*. Generalization has
a matching version of this — `selectionCount` and a rail-keyed label were honest nouns while there was
one widget, and became a decision about the whole family the moment there were two. None of this is
carelessness; it is what relocation does, and it is only visible if you go looking for it.

**Carry forward:** After moving a block, ask what it *could* do in its old home — log, throw, share a
variable, rely on a literal's type check, name a thing after its only instance — and confirm each
capability is either still present or deliberately retired.

## Horizon Watchlist

Not merge blockers. Carried forward because the panel supported them and Slices 2–7 will meet them.

- **Slice 2 will demand Slice 5's compiler.** The moment `creative-variations` joins
  `WorkshopCommitWidgetPayload`, the `satisfies` mapped registry requires a `prepare` entry — the
  contract will ask for the commit compiler at the contracts slice's boundary. Cal flagged this as a
  decision to make deliberately, not a defect. Plan for a stub-that-refuses or accept the reordering.
- **Slice 2 will also force a feature-boundary descriptor.** `boundaries.test.ts:1008-1018` asserts
  descriptor ids equal persisted-lifecycle ids; adding Creative to persistence fails the build until
  its `WORKSHOP_FEATURE_BOUNDARIES` entry exists. This is the mechanism that makes P-04 safe — expect
  it, don't fight it.
- **The chip is the first place Creative will look wrong.** `WorkshopTurnBubble.tsx:302-315` gates on
  `rail === 'thread-artifact'`, not widget id (runway F8 + F-08 here). Slice 5's first commit renders
  as "Gesture Playground."
- **A second `WorkshopOneShotWidgetRoomSend` implementation reopens the falsy-`turnId` question.** Sam
  and Blake both traced it and both declined to file: `WorkshopTurnLedger.nextId` cannot mint an empty
  id today, so `if (!acceptedTurnId)` is safe. The type invites another implementation; if one arrives,
  make the sentinel existence-based rather than truthiness-based.
- **Webview-side correlation failures are invisible to the host.** `reportWorkshopWidgetActionCorrelationIssue.ts:10`
  sends them to `console.warn` in the webview. Inherited, and the other half of why F-05 wants
  `requestToken` in the host log.
- **`WorkshopLexicalGravityHandler` gates nothing.** It is constructed without an availability policy
  while the Gesture handler gates its generate route. Pre-existing and unchanged here, but this is the
  first commit in which the family had an abstraction that could settle it (Stan).

## The Closer

🐾 **The animal:** a leafcutter ant.

It picked up a piece of cargo several times its own size — a route, a transaction, a validator, and
twenty writer-facing sentences — and carried it down a different tunnel without dropping a crumb or
tearing an edge. Every string arrived byte-identical; the composer pills it was told not to touch it
did not touch, and then it welded that instruction into the type so no future ant could. What
leafcutters famously do not do is look back at the old chamber to see what was still nailed to the
wall there. One alarm bell is still hanging in the room this commit emptied.

## Final Assessment

**Nearly there.** This is a genuinely faithful extraction — behavior preservation was verified
mechanically at the branch level rather than asserted, the commit is green on tests, typecheck, and
lint, and it lands with real architectural care: the route ledger moved in the same commit, the new
generic modules were correctly left off the approval allowlist so the global scan fences them, and the
one invariant that could be strengthened for free (`includeMessageAttachments: false`) was.

One item should be fixed before merge: **F-01**, the writer-origin manifest assertion that the test
split left homeless. It is roughly one line in an existing test, and the mutation evidence shows the
guard's absence is otherwise undetectable on a persisted writer-data contract. **F-02** and **F-04**
are cheap enough (an internal guard, a spread reorder) to fold into the same pass and will pay for
themselves the first time Slice 5 touches this rail. Everything else — the availability seam's shape,
the naming pair, the missing refusal diagnostics, the two frozen family contracts — is legitimate
follow-up that should be decided before Slice 5 adds a second producer, not before this commit lands.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ ·
Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
