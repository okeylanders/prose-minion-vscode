# MR Review v2 — Creative Variations Sprint 03, Slice 5

**Author:** Okey Landers · **Branch:** `sprint/conversation-widgets-03-creative-variations` → `epic/conversation-widgets`
**Range:** `47d3281f` … `4210cdc5` · **Head:** `4210cdc` · **Single commit:** `feat(workshop): add creative variations commit lifecycle`
**Reviewed:** 2026-08-13 (America/Chicago) · **Mode:** Full (local, review-only)

**Verdict: Nearly there.** No Blocking findings. The slice proves its structural claim — the feature-neutral one-shot coordinator took a second, richer feature with zero diff lines. Three High findings: one new host gate crashes where it used to refuse, the webview cannot recover from a commit that never answers, and the room-facing artifact never names the passage it is about.

Jump to [Executive Briefing](#executive-briefing) · [Findings](#findings) · [Focus-area verdicts](#focus-area-verdicts-against-the-review-brief) · [Sensei's Lessons](#senseis-lessons)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | A new gate indexes a partial map with a wire-controlled widget id, above the guard that makes it total | Marcus, Blake, Sam, Patricia, Stan, Oliver | 6 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-02 | 🟠 High | A commit that receives no action result is terminal for the whole webview | Blake, Oliver | 2 runway-prompted | 🧭 Corroborated Runway | **Open** |
| F-03 | 🟠 High | The committed room turn carries the writer's choice but never its subject | Bria | 1 runway-prompted | — | **Open** — needs copy-owner decision |
| F-04 | 🟡 Standard | A widget-model change during a pending commit is swallowed permanently, not deferred | Sam, Cal | 2 independent | 🎯 Consensus | **Open** |
| F-05 | 🟡 Standard | Clone lineage is read at commit time, not seed time | Sam | 1 runway-prompted | — | **Open** |
| F-06 | 🟡 Standard | `clonedFromConfigId` crosses the bus unvalidated into state the host's own reader rejects | Patricia | 1 independent | — | **Open** |
| F-07 | 🟡 Standard | Eligibility rule 7 has no commit-path test, and it binds identifiers rather than authored text | Cal | 1 runway-prompted | — | **Open** |
| F-08 | 🟡 Standard | The mounted test rewrite dropped the only proof that the model picker reaches invalidation | Cal | 1 independent | — | **Open** |
| F-09 | 🟡 Standard | Every autosave re-derives the overlap matrix for every persisted Creative config | Tim | 1 independent | — | **Deferred** — growth curve, not an outage; one-flag fix with existing precedent |
| F-10 | 🟡 Standard | One eligibility rule, three expressions, and the weakest one is what the writer sees | Parker | 1 independent | — | **Open** |
| F-11 | 🟡 Standard | `commitAvailable`'s doc comment lost its checkability, and its dead branch outranks every real blocker | Parker | 1 runway-prompted | — | **Open** |
| F-12 | 🟡 Standard | The commit freeze is restated nine times and never named | Parker | 1 independent | — | **Deferred** — land before Slice 6 adds the `seed` arm |
| F-13 | 🟡 Standard | A tool target blocks commit at the host but never in the sheet | Bria | 1 runway-prompted | — | **Open** |
| F-14 | 🟡 Standard | `artifactUsage`'s swallowed catch conflates "nothing to measure" with "would not compile" | Oliver | 1 runway-prompted | — | **Open** |
| F-15 | 🟡 Standard | After an offline rollback, the channel's last word is "provisionally accepted" | Oliver | 1 independent | — | **Open** |
| F-16 | 🟡 Standard | The new feature compiler re-verifies its own arm; its sibling does not | Stan | 1 independent | — | **Deferred** — resolve one way before Sprint 05 templates off it |
| F-17 | 🔵 Nit | The blocker union lives in the modal's props file, and the controller imports it upward | Marcus (premise corrected by Stan) | 1 runway-prompted | — | **N/A** — complying with the accepted Slice 4 remediation convention |
| P-1 | 💚 Praise | The verification read-back is load-bearing, not ceremony | Blake | 1 runway-prompted | — | N/A — preserve |
| P-2 | 💚 Praise | The one-shot plan carries a count, not a noun — why the coordinator has zero diff lines | Marcus | 1 runway-prompted | — | N/A — preserve |
| P-3 | 💚 Praise | The artifact-budget fixtures prove they cross the boundary, at both enforcement sites | Cal | 1 independent | — | N/A — preserve |
| P-4 | 💚 Praise | The artifact excludes editor provenance by construction, pinned by name in a test | Patricia | 1 runway-prompted | — | N/A — preserve |
| P-5 | 💚 Praise | Widening the payload union came with a same-commit sibling sweep (`Omit<Union, K>` collapse) | Stan | 1 runway-prompted | — | N/A — preserve |
| P-6 | 💚 Praise | The expensive O(n²) derivation is never imported into the webview | Tim | 1 independent | — | N/A — preserve |
| P-7 | 💚 Praise | The "What commits" line counts instead of asserting | Bria | 1 independent | — | N/A — preserve |

## Review coverage

**Read fully:** `CreativeVariationsArtifact.ts`, `CreativeVariationsOneShotCommit.ts`, `CreativeVariationsConfigIntegrity.ts`, `WorkshopWidgetHostHandler.ts`, `WorkshopOneShotWidgetCommitOperations.ts`, `WorkshopOneShotWidgetCommitCoordinator.ts`, `useCreativeVariationsAuthoring.ts`, `useCreativeVariations.ts`, `useWorkshopWidgetOpening.ts`, `dispatchWorkshopWidgetActionResult.ts`, `shared/types/messages/workshop/creativeVariations.ts`, `shared/types/messages/workshop/widgets.ts`, `GesturePlaygroundOneShotCommit.ts` (sibling), plus the new `CreativeVariationsOneShotCommit.test.ts`.

**Diff reviewed in full:** all 37 changed files (+1,936 / −112), including `WorkshopCreativeVariationsModal.tsx`, `WorkshopApp.tsx`, `WorkshopSliceComposition.ts`, `WorkshopModalShell.tsx`, `useGesturePlayground.ts`, `workshopWidgets.ts`, and all 16 changed test files.

**Read for context (unchanged this commit):** `WorkshopRoomHandler.executeMessage` (lines 1089–1260), `WorkshopWidgetConfigLedger.ts`, `WorkshopWidgetPersistenceLifecycle.ts`, `MessageRouter.ts`, `MessageHandler.handleMessage`, `CreativeVariationCard.tsx`, `promptBudgets.ts`, `WorkshopWidgetRecommendationOperations.ts`, `creativeVariationsFixtures.ts`.

**Documents reconciled:** sprint `03-creative-variations.md`; Slice 4 and Slice 5 handoffs; ADRs 2026-07-22, 2026-07-31, 2026-08-03, 2026-08-12; the Creative Variations implementation runway; and the Slice 4 review (all 18 findings marked Addressed).

**Blast radius:** 2 new application services · 17 production files · 18 test/witness files · 0 migrations · 0 new routes · 0 new message types · 0 new provider calls. `WorkshopOneShotWidgetCommitCoordinator.ts` — the transaction at the centre of the change — has **zero diff lines**.

**Independent verification run by the orchestrator (not taken on trust):**

| Receipt claim | Independently re-run | Result |
| --- | --- | --- |
| Full Jest: 207 suites, 2,242 tests, 2 snapshots | `npx jest` | ✅ exact match, exit 0 |
| Focused set: 15 suites, 177 tests | 16-suite superset incl. coordinator test | ✅ 186 tests pass |
| `npm run typecheck` (core, webview, extension) | all three configs | ✅ exit 0 |
| ESLint: 0 errors, 960 warnings | `npm run lint` | ✅ exact match |
| Production build + bundle sentinel | `npm run build` | ✅ both bundles, sentinel OK, 3 advisory webpack warnings retained |
| `git diff --check` | ✅ passes |

Two claims were additionally proven by disposable probe tests, since a described path is worth less than an executed one. Both probes were deleted; the worktree ended clean.

**Not reviewed / unavailable:** the integrated VS Code Extension Development Host surface. Display capture was unavailable in both the implementation and review environments, and no fixture screenshot was substituted by either. Real-provider generation was not exercised (the commit path performs no model call, so this does not affect commit coverage). These are recorded as residual risks, not findings.

---

# Part I — Semantic Runway

## Semantic Runway — Creative Variations Sprint 03, Slice 5: the one-shot commit lifecycle

**Commit:** `4210cdc530deb59212fa9c21cb5880335339d140` · **Parent:** `47d3281f6513a5ba349814d0f6accd0967fc41eb`
**Author:** Okey Landers · **Branch:** `sprint/conversation-widgets-03-creative-variations` → `epic/conversation-widgets`
**Evidence date:** 2026-08-13 · **Mode:** Full (local, `--last-commit`)

**Blast radius:** 37 files, +1,936 / −112. Two new application services (`CreativeVariationsArtifact.ts`, `CreativeVariationsOneShotCommit.ts`); 17 production files touched across shared contracts, application handlers, application services, and the webview; 18 test/witness files. No migrations. No new routes. No new provider calls. `WorkshopOneShotWidgetCommitCoordinator.ts` — the transaction at the centre of the change — has **zero diff lines**.

**Runway thesis.** Slice 5 gives Creative Variations an *ending*. Slices 2–4 built a comparison studio that could explore but never conclude: the writer generated takes, compared them, and copied prose to the clipboard while the room learned nothing. This commit adds the one-way door — a compact deterministic artifact, an exact correlated commit arm, host-side eligibility and budget enforcement before any mutation, and a clone-and-recommit reopen path. Its second, quieter job is to be the *reproduction test* for the one-shot rail that Slice 1 extracted on a single specimen: this is the first time the feature-neutral coordinator has two consumers, and whether it stayed neutral is now an empirical question rather than a design intention.

---

### 1. Working Definition & Real Job

**Literal code change.** A second arm is added to three closed registries — `WorkshopCommitWidgetPayload` (`shared/types/messages/workshop/widgets.ts:170-172`), `WorkshopWidgetActionResultPayload` (`:193-196`), and `WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS` (`application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations.ts:65-68`) — plus a fourth, newly created: `oneShotGenerationActivity` in `WorkshopSliceComposition.ts:148-151`. Two feature-owned services implement the arm. The webview gains commit transport, commit-eligibility derivation, a pending lock, and a clone-aware opening.

**Functional capability.** A writer can now select one or more generated takes, see exactly what those takes will cost the room in characters, commit them as one writer turn with one bounded artifact, reopen that turn's chip later to recover the exact authored draft, and recommit it as a fresh turn without editing history.

**Business problem.** Exploration without a commit path is a dead end. The writer had to retype or paste, and everything they declared — what must survive, what must not change, which risks they accepted — evaporated at the clipboard boundary. This makes the *choice*, not just the prose, into shared conversational context.

**What the structure emphasizes.** Three things are conspicuously load-bearing. First, **one formula**: `buildCreativeVariationsArtifact` is imported by both the host validator (`CreativeVariationsOneShotCommit.ts:110`) and the webview usage meter (`useCreativeVariationsAuthoring.ts:553`), so the meter cannot disagree with the gate. Second, **projection by omission**: the artifact builder simply never reads the source passage, unselected cards, tradeoffs, overlap evidence, or provenance — exclusion is structural, not filtered. Third, **acceptance-gated closure**: the modal closes only on `ok: true` (`useCreativeVariationsAuthoring.ts:229-232`), never optimistically.

**What it suppresses.** The generation cloud, entirely. Also — and less obviously — the aim, the sampling distance, the requested count, and each card's *approach name* never reach the room. The room learns what was chosen, not what was asked for.

**What must survive any valid alternative.** The discarded cloud stays out of the room; the editor is never written; commit performs no model call; a blank aim persists blank; blank invariants declare nothing; history is immutable under recommit.

**Competing interpretation.** A reader could take this as "the slice that turns on the commit button" — Slice 4 already rendered a disabled button behind `commitAvailable={false}`, so Slice 5 looks like flipping a flag and filling in a callback. **[Observed]** That reading understates it: the commit *contract* did not exist before this commit. The payload arm, the artifact projection, the eligibility rules, the host gates, the pending lock, and the clone identity are all new. The disabled button was a placeholder for a lifecycle, not a lifecycle waiting for a boolean.

> This MR is not merely wiring a commit button to an existing rail. Its real job is proving that the feature-neutral one-shot transaction can carry a second, semantically richer feature without learning its vocabulary — while preserving the writer's exact authored truth on both sides of the durable boundary.

---

### 2. Declared Intent, Observed Behavior & Open Meaning

**Alignment.** Every declared baseline holds under inspection:

| Declared | Observed |
|---|---|
| Creative stays `live: true` | `shared/constants/workshopWidgets.ts:92` unchanged; only `lifecycleNote` updated to `ONE_SHOT_LIFECYCLE` (`:89`) |
| Passage is the only required generation input | Commit adds requirements; generation eligibility untouched this slice |
| Blank invariants declare nothing | `CreativeVariationsArtifact.ts:48-56` emits no section; `CreativeVariationsConfigIntegrity.ts:113` rejects a flag against a blank field |
| Blank aim persists blank, projects only at generation | `intent.aim === ''` asserted durably in host, persistence, and mounted tests; `Generate at random.` lives in `CreativeVariationsDerivations.ts` |
| Commit makes no model call | No provider port anywhere on the commit path; `WorkshopRoomHandler.seams.test.ts` asserts `creativeVariationsGenerate` was never called across an original commit *and* a clone recommit |

**Verification receipt reconciled.** **[Observed]** Independently re-run: full Jest 207 suites / 2,242 tests / 2 snapshots pass; all three TypeScript configs pass; ESLint 0 errors / 960 warnings; `git diff --check` passes. The claimed focused set (15 suites / 177 tests) was re-run as a 16-suite superset including the coordinator test: 186 tests pass. The receipt is accurate.

**Gaps between what the sprint says and what the code decides.**

- **The commit sentence.** `I'm committing N selected Creative Variations take(s) to the room.` (`CreativeVariationsOneShotCommit.ts:40-42`) is both `roomText` (model-facing) and `displayText` (transcript-facing). No sprint clause or ADR specifies what the writer's turn says. It speaks in the writer's first person and names a UI feature. **[Inferred]** This is a product-voice decision made inside a mechanical slot.
- **A false claim was quietly corrected.** Slice 4's summary line asserted "both declared constraint fields ride with them" unconditionally. Slice 5 counts nonblank fields and says "blank invariant fields add no constraint" when there are none (`WorkshopCreativeVariationsModal.tsx:808-815`). The correction is right; it is not called out as a fix in the sprint evidence.
- **`commitAvailable` is now vestigial.** The only production call site passes it unconditionally (`WorkshopApp.tsx:1404`), and the Slice-4 test that exercised the false branch was rewritten. The false branch and its copy survive in the component (`WorkshopCreativeVariationsModal.tsx:286`). **[Unknown]** whether Slice 6/7 will re-use it.
- **Reopen has exactly one mode.** Clicking a historical chip always seats the writer in an editable clone draft. There is no read-only view of what was committed.

**Unknowns.** No integrated F5 screenshot evidence exists; both the handoff (`:142-154`) and the sprint doc record display capture as unavailable. Whether 20,000 characters (`promptBudgets.ts:252`) was calibrated against real full-prose workups is unrecorded.

---

### 3. Business Story & Rulebook

**Actors.** The *writer* is the sole decision-maker: they generate, select, choose carry mode, accept risks, write the note, and commit. The *host* is the mechanic — it mints `wc-N`, `ta-N`, and turn ids, and validates independently of the UI. The *model* is a proposer: it produces takes and declares invariant flags, but cannot supply ids and cannot invent a constraint. The *room and its personas* are beneficiaries and subjects. Two actors are **excluded by design**: personas cannot recommend, prefill, generate, select, or commit Creative Variations (**[Observed]** — there is no `creative-variations` arm in `WorkshopWidgetRecommendationOperations.ts`, and `openWidgetRecommendation` handles only Gesture and Lexical); and the *editor* is never a write target.

**Trigger and preconditions.** The writer has a settled workup and at least one selection. Commit is reachable only from the modal footer.

**Decisions and rules.** Eligibility is defined twice, in the same order, from the same facts (`CreativeVariationsOneShotCommit.ts:63-119`; `useCreativeVariationsAuthoring.ts:561-611`):

1. draft passes shape validation;
2. a settled workup exists;
3. at least one selection;
4. every selected position exists in the workup;
5. no selected card carries any `hard-conflict` flag;
6. accepted advisory-risk ids are *exactly* the card's advisory ids — set equality, no missing, extra, or duplicate;
7. semantic integrity still binds the workup to its authored inputs, including recomputed overlap (`CreativeVariationsConfigIntegrity.ts:132-176`);
8. the compiled artifact is ≤ 20,000 characters.

**Carry mode.** Every new selection defaults to `direction` (`useCreativeVariationsAuthoring.ts:470`) — the portable creative move. Full prose is a per-card promotion, and the artifact labels them differently to the room (`Take N — direction:` vs `Take N — full prose:`), so a persona can tell whether it received a move or a text.

**State transitions.** Any authoring mutation clears workup *and* selections atomically (`:299`). Regeneration clears both (`:444`). A widget-model change invalidates dependent transient work (`:418-437`). Selections cannot outlive their cards.

**Value created.** A bounded, comparable set of genuinely different moves becomes shared conversational context, carrying the writer's declared constraints with it.

**Harm prevented.** The discarded cloud never reaches the room; the editor is never mutated; there is no automatic rewrite (direction unless explicitly promoted); a model-declared hard conflict cannot be talked into the room by re-labelling it a risk; context cost is visible before it is paid.

**Legitimate exceptional states.** A durable `wc-N` config that survives a pre-acceptance refusal is *not* an error — it is a retry token (ADR 2026-07-22). An accepted commit whose participant reply later fails is *not* rolled back.

---

### 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** The sheet is open with a settled workup. `commitBlockers` is non-empty and the footer names exactly one reason. The writer selects a take; `artifactUsage` becomes non-null and the meter appears.

**Development.** Escalating commitment in four steps. The writer selects (default carry mode: direction). They may promote to full prose, watching the meter move. Advisory risks on selected cards must each be explicitly accepted, or the take unselected. A hard-conflicting card cannot even be selected (`:460`).

**The Turn.** There are, honestly, **three** commitment points, not one:

1. **`wc-N` created** (`WorkshopOneShotWidgetCommitCoordinator.ts:64-68`) — durable *before* the room send. Survives refusal as a retry token.
2. **`onRoomAccepted(userTurn.id)`** (`WorkshopRoomHandler.ts:1100`) — the room has published the writer turn and its thread artifact together; the callback stamps `recordWidgetCommit` and `recordWidgetArtifactDelivery`.
3. **The verification read-back** (`Coordinator.ts:109-120`) — the coordinator re-reads the config and demands `committedTurnId` and `artifactId` still match. **[Inferred]** This is not decoration: `rollbackMessageRun` unwinds turn-bound widget linkage when `AgentRunUnavailableError` fires (ADR 2026-08-12's offline contract), and the read-back is what converts that post-acceptance rollback into an honest `not-accepted` so the sheet stays open. Two ADRs are reconciled by this single comparison.

**Ending.** On `ok: true`, the authoring effect fires `onCommitAccepted` → `closeCreativeVariations`. The sheet closes, the chip appears, and the turn is history. On refusal, the exact draft stays open with retryable host copy rendered at `role="alert"` (`WorkshopCreativeVariationsModal.tsx:634-637`).

**Unresolved threads.** Two, both worth the panel's attention as *questions*, not verdicts. (a) The webview has no commit timeout: `commitPending` is cleared only by a token-matching action result (`useCreativeVariations.ts:172`). While pending, the close button is disabled, Cancel is disabled, and `close()` early-returns — so Escape and overlay clicks are inert too. What unwedges a commit whose reply never arrives? (b) A `wc-N` orphaned by a pre-acceptance refusal is durable but has no turn and therefore no chip. What is its lifecycle?

---

### 5. Codebase Genealogy & Controlling Precedent

**Closest ancestor: Gesture Playground**, file for file. `CreativeVariationsOneShotCommit.ts` ↔ `GesturePlaygroundOneShotCommit.ts`; `CreativeVariationsArtifact.ts` ↔ `GesturePlaygroundDirective.ts`; the commit block of `useCreativeVariations.ts:133-179` ↔ `useGesturePlayground.ts:86-142`.

**Lexical Gravity is correctly not a sibling.** It rides the standing rail — `apply-standing` tokens, an *edit-in-place* opening rather than clone, `STANDING_LIFECYCLE` copy. It appears in neither the commit registry nor the new generation-activity table, and the MR touches it zero times. That is precisely what ADR 2026-08-03 §3 predicts for a non-family member.

**Controlling precedent, explicitly declared.** The Slice 1 review recorded: "`satisfies` over a mapped type keyed by `WorkshopCommitWidgetPayload['widgetId']` makes the registry total… **Worth copying for the next closed dispatch.**" Slice 5 is the first exercise of that pressure, and it holds — widening the payload union mechanically forced the second registry arm, and the runtime guard `supportsWorkshopOneShotWidgetCommit` is still derived from the registry object by `hasOwnProperty`, so guard and dispatch cannot drift.

**A distinguishing fact worth understanding.** `useGesturePlayground.commitWidget` was narrowed this slice from `Omit<WorkshopCommitWidgetPayload, 'requestToken'>` to `Omit<WorkshopGesturePlaygroundCommitPayload, 'requestToken'>`. **[Observed]** This was forced, not cosmetic: `Omit` is non-distributive over unions, so once Creative joined, the old signature collapsed into a cross product accepting `{widgetId: 'gesture-playground', draft: creativeDraft}` at the last typed hop before `postMessage`. This was verified directly against the repository's own `tsc` configuration — the pre-narrowing type does compile the crossed literal. The narrowing closed a hole the union widening created.

**Two token families, not one.** Family-action tokens (`commit`, `apply-standing`) come from the shared `createWorkshopWidgetActionRequestToken`. Streaming/cancel tokens are feature-prefixed and keyed to `createCancelRequestMessage(domain, requestId)` — Gesture mints `gesture-…`, Lexical `lexical-…`, Creative `creative-variations-…` (`useCreativeVariations.ts:29-32`). **[Inferred]** `useCreativeVariations` holding both is the correct application of two conventions, not an inconsistency. Whether that split is written down anywhere a Sprint-05 author would find it is **[Unknown]**.

**Accidental drift, unscheduled.** Gesture is now the *older* shape on four axes: commit state lives in its modal rather than a controller; its generation token is minted in the component; its commit ref *overwrites* rather than refuses; it self-closes from an effect. Nothing in the sprint plan schedules convergence, and Slice 7's declared scope is witnesses, route matrix, and docs.

**New precedent this MR creates.** A two-arm closed one-shot registry with an unchanged coordinator; `isWidgetGenerationActive` as a per-widget capability port behind a `satisfies Record<…>` table; family-global commit serialization in the host; one artifact formula with two enforcement sites; and controller-owned commit blockers as a closed string union declared in the modal's props file and imported *upward* into the controller.

**What Show vs. Tell will copy.** The `…OneShotCommit.ts` + `…Artifact.ts` pair as a template; the `commit`/`handleCommitResult`/`clearCommitResult` triad; the `commitBlockers` + `artifactUsage` memo pair; the `creativeCommitMessage` test-helper shape.

---

### 6. Structural & Causal Map

```
WorkshopCreativeVariationsModal (onCommit)          [presentation, rule-free]
  └─ useCreativeVariationsAuthoring.commitDraft      [transport-free controller]
       └─ WorkshopApp inline adapter                 [composition]
            └─ useCreativeVariations.commit          [IPC + correlation token]
=== postMessage: WORKSHOP_COMMIT_WIDGET ==============================
WorkshopWidgetHostHandler.handleCommit               [feature-neutral gates]
  availability → generation-in-flight → commit-in-flight
  → prepareWorkshopOneShotWidgetCommit               [closed registry]
       └─ prepareCreativeVariationsOneShotCommit     [feature compiler]
            └─ buildCreativeVariationsArtifact       [sole projection formula]
  → tool-target → room-run-active
  → WorkshopOneShotWidgetCommitCoordinator.commit    [unchanged transaction]
       ├─ createWidgetConfig  → wc-N                 ◄ COMMITMENT 1
       ├─ mintWidgetArtifactId → ta-N
       ├─ sendRoomMessage → WorkshopRoomHandler
       │    └─ onRoomAccepted(userTurn.id)           ◄ COMMITMENT 2
       └─ verification read-back of the config       ◄ COMMITMENT 3
=== postMessage: WORKSHOP_WIDGET_ACTION_RESULT =======================
useWorkshopAppMessageRouter → dispatchWorkshopWidgetActionResult
  → useCreativeVariations.handleCommitResult         [token + widget match]
       → authoring effect → onCommitAccepted → closeCreativeVariations
```

**Gate ordering, and why.** The host sequence is availability (`:109`) → generation-in-flight (`:118`) → commit-in-flight (`:127`) → feature preparation (`:137`) → tool-target (`:148`) → room-run-active (`:159`). Feature validation sits *between* two neutral gates rather than before or after all of them, and the reason is visible: the tool-target refusal message is feature-supplied (`preparation.commit.toolTargetRefusalMessage`), so preparation must run first to obtain Creative-voiced copy while the host retains a neutral fallback (`:46-47`).

A question the panel should settle independently: `isWidgetGenerationActive(widgetId)` at `:118` runs *before* `prepareWorkshopOneShotWidgetCommit` at `:137` establishes that `widgetId` is a supported one-shot id, and it is backed by a record keyed only on one-shot ids (`WorkshopSliceComposition.ts:148-151`). `lexical-gravity` is `live: true` and therefore passes the availability gate. What is the intended host posture toward a wire payload whose `widgetId` the TypeScript union forbids but the runtime wire permits — and what does the handler do if it arrives?

**Neutrality audit.** **[Observed]** Grepping `Creative` across `WorkshopSessionService`, `WorkshopTurnLedger`, `WorkshopOneShotWidgetCommitCoordinator`, `WorkshopWidgetHostHandler`, and `WorkshopRoomHandler` returns nothing. The single hit is `WorkshopWidgetConfigLedger.ts`, where `WorkshopWidgetConfigInput` names the draft *type* in a discriminated union — the ADR 2026-07-31 shape that exists so the ledger dispatches without importing a codec. The coordinator sees only `widgetConfigInput`, `roomText`, `displayText`, and `artifact.{label, content, selectionCount}`. The neutrality reads as real.

**Failure translation, layered.** The feature compiler returns writer-facing prose; the host forwards it verbatim; the coordinator returns `not-accepted | failed` and the host supplies neutral copy for each (`:187-206`); the webview never re-authors refusal text, only substituting a default when `message` is absent.

---

### 7. Contracts, Invariants & Negative Space

**Preconditions (host-enforced, before any mutation).** Widget available; no generation in flight for that widget; no commit in flight for *any* one-shot widget; draft valid per the eight rules in §3; target is not a tool; no room run active.

**Postconditions (accepted).** `wc-N.committedTurnId` and `.artifactId` set; one `ta-N` bound to one turn; the writer turn carries a `widgetCommit` decoration; delivery recorded in the target's manifest; the modal closed.

**Invariants.** The artifact excludes source passage, unselected cards, tradeoffs, overlap data, provenance, and unaccepted risks — enforced by construction. A blank aim persists blank. Selections never outlive their cards. Positions are contiguous and host-derived; flag ids are host-derived from workup id, card position, and ordinal.

**Compatibility promises.** `wc-N` is monotonic and never reused. Clone-and-recommit mints a *new* config linked by `clonedFromConfigId` to its **immediate** parent — persistence requires the source to exist, share the widget id, and carry a strictly smaller `wc-N`. There is no root-config field; provenance is one-hop.

**Negative space — deliberately not supported.** No editor write route or API. No persona recommendation or prefill for Creative (Slice 6). No report prefill. No partial or card-level regeneration. No cross-workup history. No ranking or auto-selection. No read-only view of a committed take. No bound four-menu frame. **[Observed]** All confirmed absent.

---

### 8. Forces, Tensions & Design Tradeoffs

**Duplicated evaluation, single formula.** The webview imports `buildCreativeVariationsArtifact` from the application layer to power both the meter and the `over-artifact-budget` blocker; the host computes the same string from the same function with the same `>` operator against the same constant. **[Observed]** All four comparison sites use `>`, so the exact limit commits and one character over refuses, consistently. The cost is a presentation→application import (precedented by `CreativeVariationsDerivations`) and rules expressed twice. The benefit is that the meter *cannot* disagree with the gate.

**Optimistic UI vs. honest closure.** Nothing is optimistic; the sheet closes only on host acceptance. The cost is a visible `Committing…` state across a full round trip; the benefit is that a rolled-back turn never leaves a closed sheet claiming success.

**Two "in-flight" gates with different scopes.** `commitInProgress` is one boolean on the host handler shared by *all* one-shot widgets (`:50`), while `isWidgetGenerationActive` is per-widget. Defensible — one room, one turn at a time, versus independent generation rails — but asymmetric, and the refusal copy does not name which widget holds the slot.

**Draft-on-the-wire.** The whole authored draft crosses, not a projection, so the host can persist authoring truth and re-derive everything itself. The cost is payload size and a host that must re-validate everything — which it does, including recomputing the overlap matrix.

**Alternate constructions.**

- *Host computes the artifact from a projection-only payload.* Smaller wire, and the host could not be fed a stale workup — but the durable config would lose exact authoring truth, breaking reopen/clone, and the meter would need a second formula. Directly contradicts the persisted-truth contract.
- *Host as the single blocker authority, webview renders a host-computed list.* Would dissolve the `commitBlockers[0]` ordering question and make `tool-target` visible in the sheet. Costs meter synchrony — which is exactly why the split exists.
- *Coordinator-owned commit mutex instead of a handler field.* The gate would live with the resource it protects; cost is that the host loses the ability to refuse before touching the coordinator at all.

---

### 9. Failure, Recovery & Operational Truth

**Business rejection vs. technical failure.** Cleanly separated. Business rejections arrive as `invalid-draft` with feature-authored copy naming the take number. Technical failures arrive as `not-accepted` (room refused, or the read-back detected a rollback) or `failed` (exception before acceptance), each with host-authored neutral copy. All three preserve the exact draft and keep the sheet open.

**Partial failure.** A pre-acceptance send failure may leave a durable `wc-N` with no turn — declared, and inside ADR 2026-07-22's accepted envelope. A participant-response failure *after* acceptance leaves the committed turn intact and logs `remained committed after the participant response failed` (`Coordinator.ts:122-127`).

**Idempotency.** Not idempotent by design: every commit mints a new `wc-N`, `ta-N`, and turn. Duplicate suppression is by single-flight guards at three layers, not by request deduplication. **[Observed]** The host guard engages only *after* the refusal gates (`:169`), so `commit-in-flight` cannot fire for a refused attempt.

**Diagnostics.** The coordinator logs staged commits with widget id, config id, artifact id, selection count, and clone source; provisional acceptance; the retained-after-participant-failure case; and failures. The host logs refusals with reason and a 160-char-bounded token. **[Observed]** No draft prose is logged.

**Deployment/rollback.** The catalog `live` flag is the rollback lever. **[Observed]** After a flip-off, `handleCommit` refuses at `:109-117`, but `handleRequestConfig` has no availability gate (`:83-105`), so durable configs stay reopenable while non-committable. Whether that is the intended degraded posture is **[Unknown]**.

**The 2am question.** If a commit reply never arrives, the writer sees a locked sheet with `Committing…` and no path out. The host's output channel would carry the story; the webview would not.

---

### 10. Security, Trust & Misuse Surface

**Assets.** The writer's authored draft (their prose, their declared constraints), the durable session ledger, and the outbound prompt frame.

**Trust boundary.** The webview↔host message bus. The host treats it as a real boundary elsewhere in the same file — `handleRequestConfig` regex-validates the config id before use (`:85`), and `refuseCommit` type-guards `requestToken` before logging (`:215-216`). Whether every new gate on the commit path holds that same posture is a question for the panel.

**Attacker-controlled inputs.** In a single-user local extension there is no remote attacker; the realistic threat model is *malformed or version-skewed input*, and the codebase treats that as real — `useWorkshopWidgetOpening.ts:170` carries the comment "The wire may be ahead of this webview's discriminated union."

**Data exposure.** The artifact is the only new thing crossing into the prompt frame. **[Observed]** It carries no paths, URIs, or provenance — the Slice 4 review's F-09 concern (editor-derived path reaching the outbound prompt) does not recur here, because the projection never reads provenance. Logs carry ids and counts, not prose.

**Business-logic abuse.** Repetition is the only lever: repeated refused commits accumulate durable `wc-N` configs with no turn. ADR 2026-07-22 already accepts unbounded config accumulation from clone-and-recommit, so this sits inside an accepted envelope.

---

### 11. Data, Time, Scale & Concurrency Horizon

**Operational envelope.** Single-user VS Code extension; one Workshop session; one room run at a time; no server, no tenancy, no multi-writer contention. JavaScript single-threading means `commitInProgress` needs no lock — the flag is set before the sole `await` and cleared in `finally`.

**More data.** Config and turn ledgers are arrays with linear `find` (`WorkshopWidgetConfigLedger.ts:106-108`) — appropriate for tens to hundreds of records in one session. Session snapshots carry bounded config *summaries*; the full draft is fetched only on chip open, and the persistence test asserts a summary stays under 1,000 bytes and never contains card text.

**Concurrent actors.** Only one human plus async messaging. The interleavings that exist are: two rapid commit clicks (guarded at three layers), a commit racing a room run (guarded both sides), a commit racing a generation (guarded host-side per widget), and a chip-open response landing while a fresh launch is open — the last of which is worth tracing, since the reset effect keys on the open *transition* rather than on `opening` identity (`useCreativeVariationsAuthoring.ts:204`).

**Reordered/duplicated work.** Stale and wrong-widget action results are rejected by token and widget id, with a reported correlation issue. Cross-widget token collision is structurally excluded — Gesture and Creative draw from one monotonic counter.

**Clock boundaries.** Tokens embed `Date.now()` plus a counter; ids are host-minted and monotonic. No wall-clock business rule exists on this path.

**Audit horizon.** `clonedFromConfigId` records one hop. Reconstructing a full lineage means walking the chain. Whether a root reference is ever needed is a legitimate open question, not a present defect.

---

### 12. The Change Genome: Variation & Reproduction

**Cousin: Show vs. Tell (Sprint 05)** — named by the sprint itself as Creative's "deliberately specialized sibling." **The single varied axis is intent shape.** Creative varies along an unbounded writer-named aim plus a verbalized probability band; Show vs. Tell varies along one *bounded named continuum* with a direction and magnitude. Everything else in the promise is meant to be identical. That makes it the sharpest probe available: it holds the entire lifecycle fixed and moves only what Slice 5 does not touch.

**Reuse (zero edits expected).** `WorkshopOneShotWidgetCommitCoordinator` in full. `WorkshopOneShotWidgetCommitPlan`, which already exposes `roomText`, `displayText`, `selectionCount`, and an optional `toolTargetRefusalMessage` as neutral slots. `WorkshopWidgetHostHandler` gates. `WorkshopRouteTestHarness`. This is the abstraction Slice 1 earned, and the cousin confirms it.

**Extension (one exact arm each).** The payload union; the action-result union; the operation registry; the generation-activity map; the live catalog; the draft-integrity arm; a fifth consumer in `dispatchWorkshopWidgetActionResult`. **[Observed]** Every one of these is a mapped type or closed union that fails to compile when an arm is missing — the "one arm per registry, zero edits to existing feature slices" reproduction criterion from ADR 2026-08-03 Phase 7.

**Fork (expected and healthy).** `CreativeVariationsArtifact.ts` — its headings are feature voice. The authoring controller, transport hook, and modal.

**Contradiction pressure.** `useWorkshopWidgetOpening` already carries three near-identical `close*` triples and a widget `else if` ladder; a fourth makes it a registry wearing a switch statement. `openWidgetRecommendation` still handles two widgets and silently drops the rest — Slice 6 and the cousin both land there.

**Premature-generalization risk.** The blocker enum splits six family-generic members from two Creative-semantic ones (`hard-conflict-selection`, `unaccepted-advisory-risk`). Hoisting `COMMIT_BLOCKER_COPY` into a shared map is exactly where Creative vocabulary would enter generic code and fail the reproduction test. Likewise `creativeArtifactCharacters` is correctly feature-named; renaming it `oneShotArtifactCharacters` would couple two features' ceilings to one number.

**Verdict on the genome.** This is a **generative pattern with honest feature-local forks** — not a premature framework, and not a special case pretending to be general. The narrowness is earned.

---

### 13. Comparative Models & Borrowed Vocabulary

**Internal parallel (strongest).** Gesture Playground's one-shot lifecycle. **Question it contributes:** where Creative and Gesture now disagree — commit state location, token minting, duplicate-commit shape, self-closing — which one is the precedent, and does the codebase say so anywhere a Sprint-05 author will look?

**Software parallel: software product lines and variability modeling.** Commonality is the transaction, the correlation protocol, and the artifact envelope; the variation point is the feature compiler; binding time is compile time, enforced by mapped-type totality. **[Analogy]** **Question:** are the invalid *combinations* modeled? The registry proves every one-shot id has a compiler; it does not prove every `live` id that reaches the commit wire has one.

**Software parallel: design by contract.** **Question:** the commit route's postcondition to the *webview* is "you will receive exactly one action result for your token." Is that postcondition enforced anywhere, or is it an emergent property of every branch happening to post one?

**Cross-industry: chain of custody.** Provenance, custody, tamper evidence, reconstruction. **[Analogy]** The design is unusually strong here — host-derived flag ids, recomputed overlap on ingest, verification read-back, immutable source under clone. **Question:** with only one-hop `clonedFromConfigId`, can a later investigator distinguish "third recommit of an original" from "first recommit of a second original"? Walking the chain answers it; nothing summarizes it.

**Cross-industry: aviation operational envelopes.** Go/no-go criteria, degraded mode, handoff. **[Analogy]** The eight eligibility rules are a preflight checklist, and the degraded mode ("commit works with AI down, given a settled workup") is deliberate. **Question:** which handoff can silently lose state or responsibility? The webview→host commit handoff has no timeout and no unwedge path; that is the one place the checklist has no abort item.

---

### 14. Creative Counterfactuals

**Inversion.** Make the host the single blocker authority and have the webview render a host-computed list. `tool-target` would stop being invisible in the sheet, and the `commitBlockers[0]` ordering question would dissolve. The cost is meter latency — which is precisely why the split exists. The current design buys synchronous feedback with a duplicated rule set that happens to share one function.

**Deletion.** Remove `ignoredOpeningCommitOutcomeRef` (`:199, 206, 224-227`). Close already clears the result (`WorkshopApp.tsx:244`) and `commitDraft` clears it again (`:618`). Does the ref defend a reachable state, or discharge a proof obligation? Which test turns red without it?

**Time-lapse.** After Slice 6 (persona prefill), Slice 7, and Sprint 05, `useWorkshopWidgetOpening` grows a Creative `seed` arm plus a fourth widget arm, and `WorkshopApp` holds four modal blocks — the Creative one already ~35 props. The pressure at that point is to hoist a `WorkshopWidgetModals` container or a props bundle, which is exactly the moment Creative vocabulary could leak into generic presentation.

**Constraint swap.** Suppose the artifact budget were 2,000 characters instead of 20,000. Full-prose promotion would become rare, `over-artifact-budget` would fire routinely, and the meter would move from reassurance to primary control. The design would survive — which suggests the budget is a calibration knob rather than a load-bearing assumption.

**Boring alternative.** The least clever implementation satisfying the invariants: a single host function that takes the draft, validates it, builds a string, and writes three records — no registry, no coordinator, no closed unions. It would work today for two widgets and would rot at four. The registries are buying the *fourth* widget, and Slice 5 is the first evidence they will actually deliver it.

---

### 15. Evidence Confidence & Unresolved Questions

**Repository-grounded (high confidence).** The gate ordering; the artifact projection's contents and omissions; the four-site `>` operator consistency; the coordinator's zero diff; the absence of any Creative token in feature-neutral host/session/coordinator code; the absence of a Creative recommendation arm; the absence of any editor-write route; the three-layer duplicate-commit guards; the pending lock's coverage of close, Cancel, Escape, passage, note, and every card control; the `Omit<union>` collapse that forced the Gesture narrowing (verified against the repo's own `tsc`); and the full verification receipt (independently re-run and matching).

**Material inferences.** That the verification read-back exists specifically to reconcile ADR 2026-08-12's rollback with ADR 2026-07-22's atomicity. That Gesture's four divergences are unscheduled drift rather than deliberate distinction. That the commit sentence is a product-voice decision made in a mechanical slot.

**Competing interpretations.** Whether `commitAvailable`'s surviving false branch is scaffolding for Slice 6/7 or dead code. Whether family-global commit serialization is a decision or a consequence of one handler instance.

**Missing artifacts.** No integrated F5 screenshots — display capture was unavailable, and no fixture image was substituted. No record of who chose 20,000 characters or against what corpus. No ADR or doc recording the two-token-family split.

**Needs author or product confirmation.** The room-facing commit sentence. Whether the room is expected to already hold the passage the direction refers to. Whether exposing workup positions (`Take 3`) to the room is intended given the discarded-cloud invariant.

**Not verifiable here.** Real-provider generation behavior; the integrated VS Code surface.

---

### 16. Past → Present → Horizon Synthesis

**Past.** Gesture Playground proved the one-shot lifecycle while implicitly *defining* the generic host. ADR 2026-08-03 froze feature work to make ownership legible and mandated closed registries over plugin discovery. Slice 1 extracted the one-shot commit route and transaction from Gesture — with exactly one specimen, which meant the extraction's neutrality was a hypothesis. Slices 2–4 built Creative's contracts, generation, and authoring surface, ending at a deliberate boundary: a mounted commit button that honestly said it could not commit.

**Present.** Slice 5 supplies the second specimen, and the hypothesis survives contact: the coordinator has zero diff lines, no Creative token appears in feature-neutral code, and every generic seam took exactly one arm. The commit path is validated twice from one formula, gated before mutation, correlated by fresh tokens, locked while pending, and closed only on acceptance. The tensions it leaves are real and mostly deliberate: rules expressed twice, a family-global commit lock, one-hop clone provenance, and a webview that trusts the host round trip to always answer.

**Horizon.** Slice 6 adds a `seed` opening arm that will pass through `commitDraft`'s clone branch. Slice 7 owns architecture witnesses. Sprint 05's Show vs. Tell is the real exam: if it lands as one arm per registry plus its own compiler, artifact, controller, hook, and modal — with zero edits under `creativeVariations/` — this slice's structural claim is proven. The drift most likely to cost something is not in Creative at all; it is that Gesture is now the older shape on four axes with no convergence scheduled, and the next author will copy whichever hook they open first.

---

### 17. Runway Synthesis Brief

**Invariants the implementation must preserve.** The discarded generation cloud never reaches the room. The editor is never written. Commit performs no model call and works with AI unavailable given a settled workup. A blank aim persists blank; blank invariants declare nothing. Accepted advisory risks are exactly the card's advisory ids. A hard-conflicting card cannot commit. The exact limit commits; one character over does not. Recommit mints fresh `wc-N`, `ta-N`, and turn ids and leaves source records untouched.

**Anchors.** `CreativeVariationsOneShotCommit.ts:63-119` (eligibility); `CreativeVariationsArtifact.ts:30-74` (the sole projection); `WorkshopWidgetHostHandler.ts:107-207` (gates and outcome handling); `WorkshopSliceComposition.ts:145-161` (the new generation-activity table); `WorkshopOneShotWidgetCommitCoordinator.ts:56-148` (unchanged transaction, three commitment points); `useCreativeVariationsAuthoring.ts:203-238, 561-623` (open/outcome effects, blockers, commitDraft); `useCreativeVariations.ts:133-179` (single-flight and correlation); `WorkshopCreativeVariationsModal.tsx:277-302, 780-892` (blocker projection, meter, footer); `useWorkshopWidgetOpening.ts:162-205` (clone opening).

**Tensions (tradeoffs, not defects).** Rules expressed twice for meter synchrony. Family-global commit lock vs. per-widget generation lock. Draft-on-the-wire size vs. exact durable truth. One-hop clone provenance vs. lineage reconstruction. Feature-voiced copy inside a feature-neutral rail.

**Unknowns.** Integrated UI evidence. The 20,000-character provenance. Whether `commitAvailable`'s false branch is scaffolding or dead. Whether the chip-open-races-launch interleaving is reachable through the sheet overlay. What unwedges a commit whose reply never arrives. The lifecycle of a `wc-N` orphaned by pre-acceptance refusal.

**Legitimate variation points.** The feature compiler and its artifact. The blocker enum's feature-semantic members. Feature-authored refusal copy. The per-feature artifact budget constant.

**Predicted pressures.** *Near:* Slice 6's `seed` arm through the clone branch. *Middle:* four modal blocks and ~35-prop invocations in `WorkshopApp`; a fourth `close*` triple in `useWorkshopWidgetOpening`. *Far:* Gesture/Creative divergence hardening into two competing canons; a future background rail meeting the single `commitInProgress` boolean.

**Questions for the panel (neutral).**

1. What does `handleCommit` do with a `live` widget id that has no one-shot commit arm, and which gate sees it first?
2. Is there a terminal state if a commit action result never arrives for the active token, and what is meant to unwedge it?
3. Is the `commitBlockers` push order the intended writer priority, given exactly one blocker is shown? Where does a tool target fit, since the webview has no blocker for it?
4. Is `artifactUsage`'s `catch { return null }` intended as a silent no-blocker state, given it also suppresses `over-artifact-budget`?
5. Is `hard-conflict-selection` reachable through any writer path, given selection already refuses such a card and integrity rejects such a persisted config?
6. Does the family want one duplicate-commit doctrine before Sprint 05 copies whichever hook the author opens first?
7. Is presentation→application import of a pure feature formula an accepted standing rule, and should the boundaries test encode it rather than permit it by silence?
8. What does the room-facing commit sentence promise, and who owns that copy?
9. After a catalog flip-off, is "reopenable but non-committable" the intended degraded posture?
10. Which tests would turn red if `ignoredOpeningCommitOutcomeRef` were deleted?

**Do not overread.**

- The webview's duplicated eligibility rules are **not** an unowned second source of truth — they share one formula and the host is authoritative. Judge the *duplication of expression*, not of authority.
- `commitAvailable` being effectively constant is **not** proof of dead code; Slice 6 may re-use it. Ask, do not assume.
- A durable `wc-N` surviving a refused commit is **declared** behavior, not a leak.
- Gesture/Creative divergence is **inherited**, not introduced here — except where this MR made it newly reachable or newly canonical.
- The absence of persona prefill, report prefill, partial regeneration, ranking, and editor apply is **deliberate scope**, not omission.
- Missing screenshots are a **residual validation gap**, not evidence of a defect.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there.** No Blocking findings. The architectural thesis of the slice is proven — the feature-neutral coordinator took a second, semantically richer feature with zero diff lines — but one new host gate converts a purpose-built refusal into an unhandled crash, and the webview has no way to recover from a commit that never answers.

- 🟠 **F-01 · A new gate indexes a partial map with a wire-controlled widget id, above the guard that makes it total** `🧭 Corroborated Runway` — six reviewers, five proved it by execution. A `live` non-one-shot id throws `TypeError` and posts **zero** action results, where the parent commit returned a clean `unsupported-one-shot-widget`. The MR's own test asserting that refusal still passes, because the harness stubs a *total* function where production wires a *partial record*. Fix: call the already-exported `supportsWorkshopOneShotWidgetCommit` after the availability gate, and un-stub the seam.
- 🟠 **F-02 · A commit that receives no action result is terminal for the whole webview** `🧭 Corroborated Runway` — no branch guarantees a result, `postActionResult` swallows a rejected post silently, and while pending the sheet's close, Cancel, and Escape are all inert. The token ref outlives the modal, so the writer loses Creative commits for the session and their unsaved draft with them. Gesture resets this on open; Creative moved the state up and dropped the reset.
- 🟠 **F-03 · The room-facing artifact never names the passage it is about** — default carry mode is `direction` and a pasted subject is first-class, so a persona routinely receives *"cut the told line, downgrade the smile"* with no told line in view. The sibling names its target phrase in both slots. This is a product decision the compiler is currently making unattended, and Sprint 05 will template off it.

F-04 (`🎯 Consensus`, two independent) and F-05/F-06 are proven data-integrity defects with small fixes; they are Standard only because their triggers are narrow.

## Report Card

| Domain | Reviewer | Grade | Rationale |
| --- | --- | --- | --- |
| Architecture | Marcus 🏛️ | **B+** | Coordinator zero-diff, neutrality real (`grep Creative` across host/session/coordinator returns nothing), every generic seam took exactly one arm. Docked for a partial adapter placed above the totality guard. |
| Critical Correctness | Blake 🔥 | **C+** | One proven crash regression converting a graceful refusal into an unhandled exception, with an unrecoverable UI consequence and no guaranteed terminal state. |
| Edge Cases | Sam 🔍 | **B−** | Thresholds, blank/whitespace, and selection-drift are handled well; three separate proven path defects (gate, clone-lineage timing, model-change swallow) say the edges were not walked. |
| Code Quality | Parker 📖 | **B** | Reads cleanly in the large, and `buildCreativeVariationsArtifact`'s "deliberately excludes" docblock is the best-written thing in the diff. Three real costs: one rule in three expressions, a doc comment that lost its checkability, and a nine-site unnamed invariant. |
| Tests | Cal 🧪 | **B−** | Exemplary derived boundary fixtures at both enforcement sites. Offset by a stub more total than production that green-lights F-01, a lost composition assertion, and a precondition whose removal keeps the suite green. |
| Codebase Fit | Stan 🗂️ | **A−** | Copies the declared Slice 1 precedent, and caught an `Omit<Union, K>` collapse that no mapped type protects. Docked for copying half the precedent — the `satisfies` half without the derived guard. |
| Performance | Tim ⚡ | **B+** | Correct split of cheap vs expensive derivations across the bridge. One real growth curve switched on: per-autosave overlap re-derivation over all persisted configs. |
| Security | Patricia 🛡️ | **B** | No exposure regression — the Slice 4 path-leak concern does not recur, and provenance is excluded by construction and pinned by name. Two trust-boundary posture gaps at the same bus the file elsewhere validates. |
| Observability | Oliver 🌙 | **C+** | The deliberately-supported degraded path logs the *opposite* of what happened: "provisionally accepted" is never corrected after an offline rollback. Plus a silent catch and no unwedge path. |
| Domain Logic | Bria 🎯 | **B−** | The eight eligibility rules, hard-conflict scope, and atomic clearing all trace to code faithfully. The room-facing artifact may not be legible to its reader, and tool-target authority is invisible in the sheet. |

## Findings

### F-01 · 🟠 High — A new gate indexes a partial map with a wire-controlled widget id, above the guard that makes it total `🧭 Corroborated Runway`

**Raised by:** Marcus, Blake, Sam, Patricia, Stan, Oliver
**Discovery:** 0 independent · 6 runway-prompted
**Confidence:** High — proved by execution independently by five reviewers and by the orchestrator
**Evidence:** `packages/core/src/application/handlers/domain/workshop/WorkshopSliceComposition.ts:160` — `isWidgetGenerationActive: (widgetId) => oneShotGenerationActivity[widgetId]()`
**Affected contract:** Operational / trust boundary — the commit route's postcondition to the webview ("exactly one action result per request token")

`handleCommit` (`WorkshopWidgetHostHandler.ts:107-137`) runs availability → **generation-in-flight** → commit-in-flight → `prepareWorkshopOneShotWidgetCommit`. Only that last step narrows the id, via `supportsWorkshopOneShotWidgetCommit` — a `hasOwnProperty`-derived totality guard (`WorkshopOneShotWidgetCommitOperations.ts:78-85`). The gate at `:118` is new in this MR, and its production adapter is a `satisfies Record<WorkshopOneShotWidgetId, () => boolean>` table with exactly two keys.

The availability gate consults the **catalog**, not the registry, and the catalog's live set is strictly larger. `lexical-gravity` is `live: true` (`shared/constants/workshopWidgets.ts:158`) and has no one-shot arm. It clears gate one, reaches `oneShotGenerationActivity['lexical-gravity']` → `undefined` → `undefined()`.

Proved through the real `WorkshopSliceComposition` wiring:

```
THREW: oneShotGenerationActivity[widgetId] is not a function
ACTION RESULTS: []
```

Neither `createMutationRegistrar` (`WorkshopSliceComposition.ts:255-271`) nor `MessageRouter.route` catches. `MessageHandler.handleMessage:363-377` does — and posts a generic `ERROR`, **not** a `WORKSHOP_WIDGET_ACTION_RESULT`. Patricia's control run with an unknown id (`'not-a-real-widget'`) refuses cleanly at the availability gate, which closes the prototype-chain variant: the vector is exactly *catalog-known, live, non-one-shot*.

**This MR created the regression.** At `47d3281f` the same payload fell through to `prepareWorkshopOneShotWidgetCommit` and was refused as `unsupported-one-shot-widget` with a real action result. The `'unsupported-one-shot-widget'` reason the handler still declares at `:39` is now unreachable for the only live id it was written to catch. It is also a posture inconsistency the MR authored against itself: `handleRequestConfig:85` regex-validates its wire id, `refuseCommit:215-216` type-guards the token, and `useWorkshopWidgetOpening.ts:169-170` carries the comment *"The wire may be ahead of this webview's discriminated union."* The newest gate is the one place that trusts the union.

**The test that should catch this cannot.** `WorkshopWidgetHostHandler.test.ts:412` — *"refuses an available non-one-shot widget inside the closed dispatch"* — passes, because `:152` stubs the seam as `isWidgetGenerationActive: () => options.generationActive ?? false`: a **total** double standing in for a **partial** production lookup. Stan's framing is the sharpest: the repo already wrote this lesson down. The Slice 1 review's P-01 said the derived guard means "guard and dispatch cannot drift — worth copying for the next closed dispatch." Slice 5 built the next closed dispatch and copied the `satisfies` half only.

Reachability today is wire skew or a webview bug, not the shipped UI — the payload union forbids it at compile time. That is why this is High and not Blocking. But the second path is scheduled: `show-vs-tell` is `rail: 'oneshot'`, `live: false`, and Sprint 05 is the cousin. The moment that boolean flips ahead of its `prepare` arm — a one-line edit in a *different* registry from the one carrying the totality guarantee — every commit attempt crashes instead of refusing.

*Correction of record:* Marcus cited `prose-controller` as a second live trigger. It is `live: false` (`workshopWidgets.ts:170`); only `lexical-gravity` reaches the crash in production. The existing test uses `prose-controller` with an injected availability override, which is why it never exercised the real policy.

**Recommendation:** Add the existing derived guard immediately after the availability gate, preserving refusal precedence:

```ts
if (!supportsWorkshopOneShotWidgetCommit(widgetId)) {
  this.refuseCommit(requestToken, widgetId, 'unsupported-one-shot-widget',
    'That widget does not support one-shot commits.');
  return;
}
```

Then build the harness options from the real record shape so `:412` witnesses the production adapter. `oneShotGenerationActivity[widgetId]?.() ?? false` stops the crash but silently, and leaves the refusal reason wrong.

### F-02 · 🟠 High — A commit that receives no action result is terminal for the whole webview `🧭 Corroborated Runway`

**Raised by:** Blake, Oliver
**Discovery:** 0 independent · 2 runway-prompted
**Confidence:** High
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations.ts:136-138` — `if (activeCommitTokenRef.current !== undefined) { return undefined; }`
**Affected contract:** Operational — recoverability of the commit lifecycle

`activeCommitTokenRef` and `commitPending` clear in exactly one place: a token-and-widget-matching action result (`:172-173`). No timeout, no abort, no second `setCommitPending(false)` anywhere on the Creative path.

While pending there is no exit. `close()` early-returns on `commitPending` (`WorkshopCreativeVariationsModal.tsx:293-296`), which makes Escape and backdrop dismissal inert; the close button is `disabled={commitPending}` (`:378`); Cancel is disabled (`:872`); every authoring control sits behind `interactionLocked` (`:218`). And because `useCreativeVariations` is instantiated once at `WorkshopApp` level, the ref outlives the modal — the writer cannot commit Creative Variations again for the life of the webview. Recovery means reloading the panel, which discards the workup, selections, and note. Nothing tells the writer any of this.

The route has no branch that guarantees a result. Two triggers exist:

1. **Out of contract:** F-01's throw, which `MessageHandler` converts to a generic `ERROR` no token-matching handler will ever consume.
2. **In contract:** `postActionResult` ends with `void this.postMessage(result)` (`WorkshopWidgetHostHandler.ts:238`) — a rejected post is swallowed with no log and no retry, while the sibling route `handleRequestConfig:104` *awaits* its post.

F-01 is not the general fix; it closes one throw site. This is the containment gap that turns the next one into an unrecoverable state instead of a refusal. **The sibling does not have this problem:** `WorkshopGesturePlaygroundModal.tsx:166` resets `commitPending` in its on-open effect, so a wedged Gesture sheet clears on reopen. Creative moved that state above the modal and did not carry the reset with it — and `useGesturePlayground.commitWidget` overwrites its token ref rather than refusing, so a stuck Gesture commit still permits a retry.

> Searched the diff and evidence pack for a commit timeout, abort, cancel-commit route, or unwedge path — not found.

**Recommendation:** Wrap `handleCommit`'s body so every exit posts an action result — `catch { this.refuseCommit(requestToken, widgetId, 'failed', 'The commit could not be processed. Your draft is still open.'); }` — which converts the postcondition from emergent to enforced regardless of which throw appears next. Then restore the sibling's recovery: clear `commitPending`/`activeCommitTokenRef` in the authoring open-effect, so the writer has a manual exit even when the host goes quiet. Awaiting `postMessage` in `postActionResult` closes the in-contract trigger.

### F-03 · 🟠 High — The committed room turn carries the writer's choice but never its subject

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** Medium — the mechanism is certain; whether it is wrong is a product decision
**Evidence:** `packages/core/src/__tests__/application/services/workshop/widgets/creativeVariations/CreativeVariationsOneShotCommit.test.ts:117-122` — the whole compiled artifact for a blank-invariant commit is `Creative Variations — selected takes\nTake 1 — direction:\ncut the told line, downgrade the smile — baseline`
**Affected contract:** Business — the sprint Goal ("commit only the chosen direction or explicitly selected prose to one room turn")

The complete business payload the room receives on the default path is that three-line artifact plus the turn sentence *"I'm committing 1 selected Creative Variations take to the room."* Neither names the passage. The exclusion is deliberate and asserted (`:98` — `expect(artifact).not.toContain(generatedDraft.subject.text)`).

The triggering path is the ordinary one, not an edge: every new selection defaults to `carryMode: 'direction'` (`useCreativeVariationsAuthoring.ts:470`), and a pasted subject independent of the room excerpt is first-class. So a writer pastes a passage the room has never seen, selects one take, and commits — and the persona receives an imperative with no referent.

The cousin on the same rail decided this differently. `GesturePlaygroundDirective.ts:13` opens with `Gesture directions I want for "${input.targetPhrase.trim()}":`, and Gesture's turn sentence names the phrase too. Gesture puts the referent in both slots; Creative puts it in neither, and nothing in the sprint doc, concept doc, or ADRs records which was intended.

> Searched the diff and evidence pack for the subject text, `subjectPreview`, or any target-phrase equivalent on the commit path — not found. `subjectPreview` exists only in the config summary for the chip and reaches no prompt frame.

This belongs here because this MR writes the room-facing contract for the first time, and Sprint 05 will template off the `…OneShotCommit.ts` + `…Artifact.ts` pair.

**Recommendation:** A decision, not necessarily a code change. Ask whether the room is expected to already hold the passage. If not, the cheapest honest repair reuses machinery already in the change — emit the existing 160-character `subjectPreview` as a leading artifact line, or name it in the turn sentence the way Gesture does. If the omission is intentional, record it as a Locked decision beside "Commit is compact," so Show vs. Tell inherits the reasoning rather than the shape.

### F-04 · 🟡 Standard — A widget-model change during a pending commit is swallowed permanently, not deferred `🎯 Consensus`

**Raised by:** Sam, Cal
**Discovery:** 2 independent · 0 runway-prompted
**Confidence:** High — both reviewers proved it with a control pair
**Evidence:** `packages/core/src/presentation/webview/hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring.ts:419-421` — `previousWidgetModelIdRef.current = widgetModelId;` then `if (!open || commitPending || previousWidgetModelId === widgetModelId) {`
**Affected contract:** Business — "Host-owned effective widget model; changes invalidate dependent transient work"

The MR added exactly one token to this guard (`!open ||` became `!open || commitPending ||`). But the ref advance on the line **above** is unconditional, so the guard does not defer the invalidation — it consumes it.

Walk it: the writer commits, `commitPending` goes true, and a host push changes the effective widget model (`MODEL_DATA` or `SETTINGS_DATA` via `useModelsSettings`, feeding `WorkshopApp.tsx:263-264`). No writer action inside the sheet is needed — the in-modal picker is correctly disabled by `interactionLocked`, which is precisely why the only remaining trigger is asynchronous. The effect fires, advances the ref, then returns. The host refuses; `commitPending` clears; the effect re-runs and now `previousWidgetModelId === widgetModelId`, so it returns again. The invalidation never happens.

The `!open` case in the same guard is safe because reopening always reseats the draft. `commitPending` is different: the draft deliberately survives, exact and intact, so the skipped invalidation has something to be wrong about. The consequential window is a **refused** commit — the one branch where the sheet stays open — and the writer then recommits takes attributed to a model that did not generate them, with no notice.

> Searched the diff and evidence pack for any test combining `commitPending` with a `widgetModelId` change — not found. `commitPending: true` appears in exactly one controller test, which never varies the model.

**Recommendation:** Move `previousWidgetModelIdRef.current = widgetModelId;` below the guard so a skipped invalidation stays pending and fires when `commitPending` clears. Add the two-step regression test.

### F-05 · 🟡 Standard — Clone lineage is read at commit time, not seed time, so a draft can be recorded as descended from a config it never touched

**Raised by:** Sam
**Discovery:** 1 runway-prompted
**Confidence:** High — both halves proved with `renderHook`
**Evidence:** `useCreativeVariationsAuthoring.ts:204` — `if (open && !wasOpenRef.current) {` and `:621` — `opening?.kind === 'clone' ? opening.config.id : undefined`
**Affected contract:** Data — `clonedFromConfigId` as one-hop provenance on an immutable ledger

The draft is seeded **once**, on the open transition. The lineage id is read **live**, at commit. Nothing ties those two reads to the same `opening`.

The path: the writer clicks a thread-artifact chip → `openWidgetConfig` posts the request and sets `pendingWidgetConfigId` (`useWorkshopWidgetOpening.ts:93-96`). Nothing renders that pending state — it has no consumer in `WorkshopApp` — and nothing disables the widget browser. The writer, seeing nothing happen, launches Creative Variations fresh. The config-data response then lands and `:173-174` calls `setCreativeVariationsOpening({ kind: 'clone', config })` **unconditionally**, with no check that a sheet is already open. `wasOpenRef.current` is already true, so the reseat does not run: the writer keeps their fresh draft while the banner flips to clone and the button relabels to "Commit as new turn" — actively claiming a reopen that never happened. `commitDraft` then sends `draftRef.current` with the other config's id.

The host cannot catch it. `WorkshopWidgetConfigLedger.prepareCreation:86` records the value verbatim, and every persistence rule (source exists, same widget id, strictly smaller `wc-N`) still holds — the parent is real, just not this draft's. With one-hop provenance there is nothing to cross-check it against.

Standard rather than High because the window is one IPC round trip against a synchronous session lookup. The mechanism is proven; the trigger is narrow. The fix is one line and belongs here, before Slice 6 adds a `seed` arm through the same branch.

**Recommendation:** Capture the clone source in the same effect that seeds the draft — a `seededCloneConfigIdRef` set at `:204-211` — and have `commitDraft` read that ref rather than live `opening`. Optionally have `openWidgetConfig` refuse or queue while a sheet for that widget is already open.

### F-06 · 🟡 Standard — `clonedFromConfigId` crosses the bus unvalidated and is written into durable state the host's own reader rejects

**Raised by:** Patricia
**Discovery:** 1 independent
**Confidence:** High — proved end-to-end through the real route harness
**Evidence:** `CreativeVariationsOneShotCommit.ts:49` — `clonedFromConfigId: payload.clonedFromConfigId,` → `WorkshopOneShotWidgetCommitCoordinator.ts:66`
**Affected contract:** Data / durability — persisted session state

Nothing on the commit path checks this optional wire string's shape, existence, widget kind, or ordering. It flows into `createWidgetConfig`, the snapshot, the coordinator's log line (unbounded interpolation), and `exportCommittedState`. The read side is strict: `WorkshopSessionStateV1Integrity.ts:274-289` requires the source to exist, share the widget id, and carry a strictly smaller `wc-N` — but integrity runs only on **decode**, never before writing.

Proved with `clonedFromConfigId: 'wc-999'`:

```
ACTION RESULTS: [{"action":"commit","ok":true,"widgetConfigId":"wc-1", ...}]
PERSISTED CONFIGS: [{"id":"wc-1","clonedFromConfigId":"wc-999", ...}]
REHYDRATE INTEGRITY: Persisted Workshop widget config wc-1 clones an unknown config
```

The commit is accepted, the turn is real, the room has the artifact — and the checkpoint the host just produced will not load.

**Inherited class, right place to repair.** `GesturePlaygroundOneShotCommit.ts:36` does the identical passthrough, so this is Slice 1's pattern. Three things make this MR the place: it adds the second instance, making the pattern canonical for Show vs. Tell; it promotes clone-and-recommit from a mechanism to the slice's headline writer path, so the field is now routinely populated; and the coordinator is the shared choke point, so one guard fixes both arms and stays feature-neutral.

**Recommendation:** Validate in the coordinator — reject a `clonedFromConfigId` failing `/^wc-[1-9]\d*$/`, naming no existing config, or naming a config of a different widget id, before `createWidgetConfig`. Refuse rather than silently dropping the field, so provenance loss is never quiet. Assert it with a route test that runs the existing integrity validator over `exportCommittedState()`.

### F-07 · 🟡 Standard — Eligibility rule 7 has no commit-path test, and it binds identifiers rather than authored text

**Raised by:** Cal
**Discovery:** 1 runway-prompted
**Confidence:** High — measured with a probe against the repo's own fixture
**Evidence:** `CreativeVariationsOneShotCommit.ts:102-106` — `assertCreativeVariationsDraftIntegrity(draft, 'Creative Variations commit draft');`
**Affected contract:** Test contract for the host-side commit gate

The new suite covers four refusals; `WorkshopWidgetHostHandler.test.ts` covers the neutral gates. Searched for a commit-path test that violates `assertCreativeVariationsDraftIntegrity` — not found. The function has unit coverage elsewhere, which proves *the function*; nothing proves *the commit route calls it*. Delete line 103 and the full 2,242-test suite stays green.

That matters more than a missing branch, because the gate does less than the slice's own rule statement implies. Against the shared fixture the recorded matrix is `[{1,2: 0/0}, {1,3: 0/0}, {2,3: 95/90}]`. Replacing card 1's `prose` outright leaves the recomputed matrix **byte-identical** — a rounded 0–100 Jaccard score is a lossy hash, and pairs already at 0 stay at 0. `prepareCreativeVariationsOneShotCommit` returned `ok: true` and the substituted string appeared verbatim under `Take 1 — full prose:` in the artifact bound for the room. Same for tampering `direction`, and for swapping `subject.text` after the workup settled. A forged `invariantFlags[].id` *is* caught. **Integrity binds host-derived identifiers, cardinality, and contiguity — not authored text.**

This is inherited machinery, but Slice 5 is where it becomes load-bearing: it is one of the eight preconditions, and this is the first slice where card text crosses into the outbound prompt frame and the durable ledger. There is no adversary here and no UI that edits card prose — this is an unexamined guarantee, not a traced exploit.

**Recommendation:** Add one commit-path case with a fixture that genuinely crosses the boundary — a forged `invariantFlags[].id`, which the probe confirms is refused — so removing line 103 turns something red. Then write down, in the eligibility comment or the sprint doc, that integrity binds ids and shape rather than text. If binding text is wanted before Show vs. Tell copies this template, a content hash over `(subject.text, cards[].prose, cards[].direction)` minted with the `cvw-` id is the cheap version.

### F-08 · 🟡 Standard — The mounted test rewrite dropped the only proof that the model picker reaches invalidation

**Raised by:** Cal
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `git show 47d3281f:packages/core/src/__tests__/presentation/webview/WorkshopApp.test.tsx:303-312` — the deleted assertions on `SET_MODEL_SELECTION`, the vanished workup summary, and the notice's `role="status"`
**Affected contract:** Test contract — webview composition

Three green tests each prove a link: the controller clears on a `widgetModelId` **prop** change; the modal renders an `invalidationNotice`; the picker calls `onWidgetModelChange`. Each is satisfied entirely by its own props. Nothing now proves the loop that joins them. Searched `packages/core/src/__tests__` for `SET_MODEL_SELECTION` and `setModelSelection` — the only hit asserts the **host** router registration; nothing asserts the webview emits it. So `WorkshopApp.tsx:1429-1430` and `:262-263` are joined by no test. Change `'widget'` to `'chat'`, or feed `modelSelections.chat` into `widgetModelId`, and the suite stays green while the writer's model change silently stops invalidating their workup.

The rewrite is a net gain in commit-lifecycle confidence and a net loss in composition confidence. Both are true; only the first was recorded.

**Recommendation:** Restore four lines to the mounted test — click the picker, assert the `SET_MODEL_SELECTION` `scope: 'widget'` postMessage, assert the settled-workup summary disappears.

### F-09 · 🟡 Standard — Every autosave re-derives the overlap matrix for every persisted Creative config

**Raised by:** Tim
**Discovery:** 1 independent
**Confidence:** High — measured; code path independently confirmed
**Evidence:** `packages/core/src/infrastructure/storage/WorkshopSessionStore.ts:918-921` — `private validateSessionForWrite(session) { return parseWorkshopPersistedSession(session); }`
**Affected contract:** Operational — extension-host responsiveness on the save path, growing with committed-config count

`markDirty` → autosave → `writeCurrent` (plus `updateNamed` when a named session is active) → `validateSessionForWrite` at four call sites → `parseWorkshopPersistedSession` → `validateWorkshopSessionStateV1` with **no options**, which loops every persisted config and re-asserts integrity. For a Creative config that reaches `CreativeVariationsConfigIntegrity.ts:139` — full NFKC normalization, tokenization, 3-gram set construction per card, and C(n,2) Jaccard comparisons, from scratch.

Measured: **0.80 ms** per config at realistic size (5 cards × 1,200-char prose), **2.89 ms** at 8,000 chars, **6.11 ms** at the 20,000-char cap.

**Newly reachable here, not inherited.** At the parent, `WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS` contained only `gesture-playground` (verified), and `WorkshopOneShotWidgetCommitCoordinator.ts:64` is the sole production caller of `createWidgetConfig` (verified) — so no `creative-variations` config could reach `widgetConfigs`. The persistence-lifecycle arm existed but was dead. Creative is also the first widget whose integrity assert is an expensive *re-derivation* rather than a membership check.

Cost is O(K) in persisted Creative configs, on every autosave — and autosave fires on interactions unrelated to widgets (chat-target change, host-persona selection, guest dismissal), doubled under a named session. K grows through normal use: clone-and-recommit accumulates configs by design, and a refused commit leaves a durable retry token behind. At K=40 with realistic prose that is ~64 ms of synchronous host block per save; at K=100 with long prose, ~580 ms. Off the render thread, so no typing jank — a growth curve this MR switched on, not a present outage.

**Recommendation:** Pass `skipWidgetDraftIntegrity: true` on the write path. The flag and the precedent already exist (`WorkshopSessionService.ts:1810` uses exactly this during hydration). A committed config is immutable and its overlap was validated at commit time; re-deriving a pure function of frozen inputs on every write buys nothing, while the read/import path keeps the full check where untrusted bytes actually arrive.

### F-10 · 🟡 Standard — One eligibility rule, three expressions, and the weakest one is what the writer sees

**Raised by:** Parker
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `CreativeVariationsOneShotCommit.ts:93-97` — `acceptedIds.size !== selection.acceptedAdvisoryRiskIds.length || acceptedIds.size !== advisoryIds.length || advisoryIds.some((id) => !acceptedIds.has(id))`
**Affected contract:** Business rule (advisory-risk acceptance) + maintenance

The host validator re-implements three rules inline at `:79-100` — selected position exists, no hard conflict, accepted ids exactly equal the card's advisory ids without duplicates — and then at `:103` calls `assertCreativeVariationsDraftIntegrity`, which enforces all three again (`CreativeVariationsConfigIntegrity.ts:194-225`, unchanged by this MR, same three-clause predicate clause for clause).

There is a good reason: the inline copy is take-numbered where the integrity path can only say "no longer matches its authored inputs." Nothing in the file says so — searched for any comment naming the shadowed check; not found.

The third expression is the concerning one. `useCreativeVariationsAuthoring.ts:588-596` derives `unaccepted-advisory-risk` as **membership only** — no cardinality check, no duplicate check. That is a strict subset of the host's rule. A maintainer reading the webview would conclude the rule is "accept every advisory risk"; the host's actual contract is "your accepted set must *equal* the card's advisory set." In any draft carrying a stale or duplicated accepted id, `commitBlockers` is empty, the button is green, and the host refuses with instructions the writer has already followed. Not reachable through the sheet today — which is why this is Standard — but it is a divergence that exists *because* the rule was retyped rather than shared.

**Recommendation:** Do to the rules what this MR already did to the artifact. Export one predicate beside `CreativeVariationsArtifact.ts` returning both the take-numbered message and the blocker code; call it from the host validator and the `commitBlockers` memo. That presentation→application import is already the established shape here and `boundaries.test.ts` already approves it. Keep `assertCreativeVariationsDraftIntegrity` as the structural backstop. If the duplication is kept deliberately, one comment naming the shadowed check discharges most of the cost.

### F-11 · 🟡 Standard — `commitAvailable`'s doc comment lost the one fact that made it checkable, and its dead branch outranks every real blocker

**Raised by:** Parker
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `WorkshopCreativeVariationsModal.tsx:91-92` — `/** Narrow host capability boundary; a false value must remain visibly honest. */`
**Affected contract:** Maintenance — prop meaning and liveness

The prior comment read *"False until Slice 5 installs the host commit route for this feature"* — checkable against reality, and actionable once Slice 5 landed. The replacement states a design value rather than a condition, and no longer answers the only question a reader has: *when is this false?*

Meanwhile the MR removed every empirical way to answer it. `WorkshopApp.tsx:1404` passes the prop bare (always true) at the single production call site, and the one test exercising the false branch was rewritten into a commit-pending test. The copy `'Commit to the Workshop thread is not available in this build yet.'` appears in the diff **only as a deletion from the test**; it survives in production at `:287` with no reachable caller and no coverage.

This matters more than an ordinary dead branch, because the branch is not inert — it **wins**. `:860-864` renders `commitUnavailableReason` in an `if/else` *ahead of* `COMMIT_BLOCKER_COPY[activeBlocker]`, and `:883-889` points `aria-describedby` at it the same way. Whoever re-enables the flag in Slice 6 gets a footer that suppresses every genuine blocker in favour of a sentence claiming the feature is not in this build.

**Recommendation:** Pick one and make the code say it. If it is scaffolding for Slice 6, restore a checkable comment and keep one modal test pinning the false branch. If not, delete the prop, `commitUnavailableReason`, and its copy — the blocker list already carries every honest reason. Either way the precedence at `:860-864` deserves a second look: a capability message that hides the actual blocker is the wrong order even when the capability is real.

### F-12 · 🟡 Standard — The commit freeze is restated nine times and never named

**Raised by:** Parker
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `useCreativeVariationsAuthoring.ts:614` — `if (commitBlockers.length > 0 || commitPending) {`
**Affected contract:** Maintenance — authoring-lock invariant

One idea — *a pending commit freezes the authored draft* — appears as nine guards in this controller (`:288`, `:307`, `:421`, `:440`, `:455`, `:480`, `:492`, `:522`, `:614`). Eight early-return on `commitPending`; `changeNote` at `:522` inverts to `if (!commitPending)`. Same fact, two polarities, no name.

The MR's own code shows the rule is hard to track: `:566-568` pushes `'commit-in-flight'` into `commitBlockers`, then `:614` checks `commitBlockers.length > 0 || commitPending` — the second clause can never decide. Harmless, and exactly the artifact you get when a rule has no single home.

The structural reason is worth naming: the controller has two mutation shapes. Text edits go through `applyAuthoringChange`, which also cancels generation and raises an invalidation notice; the four card mutators deliberately must *not* do that, so each carries its own guard copy. A Slice 6 author adding a mutator picks whichever neighbour they open first, and only one of those teaches them about the freeze. The test enumerates rather than proves — five of nine sites; `changeCarryMode`, `toggleAdvisoryRisk`, `requestSubjectSelection`, and the model effect are unguarded by any test.

The component next door already found the word: `WorkshopCreativeVariationsModal.tsx:218` — `const interactionLocked = generating || commitPending;` — one name, then twelve `disabled={interactionLocked}` sites that read as one rule.

**Recommendation:** Give the draft mutators one guarded seam — a small `editDraft(update)` wrapper holding the single `if (commitPending) return;`, with a comment saying *why* (the host owns the draft for the round trip). That collapses five of nine sites and removes the polarity split. Drop the redundant `|| commitPending` at `:614`. Follow-up is acceptable, but it should land before Slice 6 adds the `seed` arm.

### F-13 · 🟡 Standard — A tool target blocks commit at the host but never in the sheet, unlike every other host-owned gate

**Raised by:** Bria
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `WorkshopCreativeVariationsModal.tsx:61-69` — the closed eight-member blocker union, with no tool-target arm
**Affected contract:** Business — actor authority; a tool sidecar is not a valid recipient of a creative direction

The controller's `commitBlockers` memo never inspects the target. The host does: `CreativeVariationsOneShotCommit.ts:52-53` supplies *"Switch to a persona target before committing Creative Variations — tool sidecars do not take creative directions."*, and this MR's own test proves the state is reachable and refused before mutation.

> Searched the diff and evidence pack for a `tool-target` commit blocker, or any `tool` reference in the Creative modal or authoring controller — not found (zero matches, case-insensitive).

The inconsistency is internal, not aspirational: `room-run-active` is equally host-owned and equally authoritative, and the sheet mirrors it. `WorkshopApp` already discriminates `workshop.chatTarget.kind === 'tool'` elsewhere. So the writer with a tool target sees a fully enabled Commit button, a green usage meter, and no blocker copy — then pays a full round trip to learn the recipient was never eligible.

**Recommendation:** Either add a ninth `tool-target` blocker fed from `workshop.chatTarget.kind`, mirroring `room-run-active` — or record in the sprint's Locked decisions that target validity is deliberately host-only, so Show vs. Tell copies a decision rather than an omission.

### F-14 · 🟡 Standard — `artifactUsage`'s swallowed catch makes "nothing to measure" and "the artifact would not compile" the same silent null

**Raised by:** Oliver
**Discovery:** 1 runway-prompted
**Confidence:** Medium — high on the consequence, honest about the trigger
**Evidence:** `useCreativeVariationsAuthoring.ts:556-557` — `} catch {\n      return null;`
**Affected contract:** Operational / UI — the declared meaning of `artifactUsage: null`

The prop's own contract says what null means: *"null before any selection."* The catch quietly adds a second meaning. `buildCreativeVariationsArtifact` throws when a selection's position is absent from the workup, and the memo's only other early return is `selections.length === 0` — so with takes selected and a mismatched position, `artifactUsage` becomes null for a reason that is not "no selection."

The writer then sees a screen that looks fine and is not. The character count and the `role="progressbar"` meter disappear, but the summary still reads "3 takes · 2 as direction · 1 as full prose" because it keys off `selectedCount`. `commitBlockers` guards `over-artifact-budget` behind `if (artifactUsage && …)`, so the budget blocker cannot fire and the button stays lit. The writer presses it and gets a refusal from a different rule entirely, which does not explain why the meter vanished. Nothing is written anywhere.

The webview already has the convention: `reportWorkshopWidgetActionCorrelationIssue` warns rejected acknowledgements with owner, token, and widget id, and its doc comment calls itself a "Visible diagnostic trail." The new memo, two files away, discards the same class of information. Reachability is the honest soft spot — authoring mutations clear workup and selections atomically, so the ordinary path should not produce a stale position; the clone-open path seats a durable draft over a wire the codebase itself declares untrusted.

**Recommendation:** One line in this MR — log the swallowed error rather than discarding it. Worth a separate decision: whether a failed compile should push a blocker rather than silently permit commit, so the writer is stopped by the real reason instead of the host's.

### F-15 · 🟡 Standard — After an offline rollback, the channel's last word about the config is "provisionally accepted," and nothing corrects it

**Raised by:** Oliver
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `WorkshopOneShotWidgetCommitCoordinator.ts:115-120` — the `not-accepted` return, with no `appendLine`
**Affected contract:** Operational — truthfulness of the durable diagnostic record

The AI-unavailable commit is the **designed** degraded path, and it is the one whose trail lies. `onRoomAccepted` fires before inference, stamping the config and logging `Commit provisionally accepted (creative-variations, wc-7 on turn t-12)`. `AgentRunUnavailableError` then fires, `rollbackMessageRun` unstamps the config and deletes the turn, and the room handler logs `Rolled back unavailable writer turn t-12` — naming the **turn** only. The coordinator's read-back detects the mismatch and returns `not-accepted` with no log at all; the host's `not-accepted` branch also logs nothing.

So the channel reads: staged → provisionally accepted → rolled back turn `t-12` → silence. An operator grepping `wc-7` — the id the config ledger keeps — finds one affirmative line claiming acceptance and no correction. In the other `not-accepted` shape, where `sendRoomMessage` returns without ever calling `onRoomAccepted`, there is no correlating line at all.

This matters more after this MR because the refusal copy invites retry. A writer offline for ten minutes retries five times, mints `wc-7` through `wc-11`, and the channel records five provisional acceptances and zero abandonments. ADR 2026-07-22 accepts unbounded config accumulation; it does not accept the log asserting those configs committed. Inherited (the coordinator has zero diff lines, and Gesture is equally silent), raised here because this MR puts a second higher-volume feature on the rail and builds a retry-on-refusal loop on top of it.

**Recommendation:** One `appendLine` before the `not-accepted` return, naming what happened to the durable record and joining the two id families that currently meet only by luck.

### F-16 · 🟡 Standard — The new feature compiler re-verifies its own arm; its sibling does not

**Raised by:** Stan
**Discovery:** 1 independent
**Confidence:** High
**Evidence:** `CreativeVariationsOneShotCommit.ts:25` — `if (payload.widgetId !== 'creative-variations') {`
**Affected contract:** Maintenance (family template) + test honesty

`prepareGesturePlaygroundOneShotCommit` has no such check. The parameter is typed `WorkshopCreativeVariationsCommitPayload`, whose `widgetId` is the literal, so the comparison is provably false at the type level; the only production caller looks the entry up *by* `payload.widgetId`. The registry also forecloses the mis-wiring this would catch — `prepare` is a function-typed property on a generic entry, and under `strictFunctionTypes` a mis-paired compiler is contravariance-rejected at the `satisfies` line.

The cost shows in the test: `CreativeVariationsOneShotCommit.test.ts:153-165` reaches the branch only with `draft: {} as never` inside an object cast `as never`. That test can never turn red for a real regression — only if someone deletes the branch. It also puts `unsupported-one-shot-widget`, a reason owned by the registry and logged by the host as such, into a feature module's vocabulary. Two files that are otherwise a matched pair now give different answers to "does a feature compiler re-verify its own arm," and Show vs. Tell will template off the newer one.

**Recommendation:** Drop the guard and its test so the pair matches — or, if defence-in-depth against the registry's type erasure is genuinely wanted, hoist the check into `prepareWorkshopOneShotWidgetCommit` once, where it is generic, reachable from a real path, and testable without `as never`. Either way, one answer, recorded once.

### F-17 · 🔵 Nit — The blocker union now lives in the modal's props file, and the controller imports it upward

**Raised by:** Marcus · **premise corrected by Stan**
**Discovery:** 1 runway-prompted
**Confidence:** High
**Evidence:** `useCreativeVariationsAuthoring.ts:30-33` — `import type { WorkshopCreativeVariationsArtifactUsage, WorkshopCreativeVariationsCommitBlocker } from '@components/.../WorkshopCreativeVariationsModal';`
**Affected contract:** Maintenance — layer ownership within the webview

Marcus raised this as a direction inversion introduced by this MR, noting that `useCreativeVariationsAuthoring.ts` is now the only file under `controllers/` importing from `@components`. **Stan checked the history and refuted the premise:** the accepted Slice 4 remediation `b6fa5b07` had already moved `WorkshopCreativeVariationsGenerationPhase` and `WorkshopCreativeVariationsAvailableSource` the same direction, deliberately leaving the narrower blocker union behind. Verified — the remediation diff shows exactly that move. Slice 5 is finishing an accepted convention, not inventing one.

What survives is a smaller observation. The co-location buys real totality: `COMMIT_BLOCKER_COPY: Record<WorkshopCreativeVariationsCommitBlocker, string>` fails to compile when an arm is added without copy. What it costs is that six of the union's eight members mirror gates the **host** enforces, so eligibility-rule names live in the most volatile layer.

**Recommendation:** No action required for this MR. If the team wants the direction recorded rather than inferred from three concordant imports, a line in the Slice 7 architecture witness is the cheapest place. Keep `COMMIT_BLOCKER_COPY` in the modal either way — that `Record` totality check is worth more than the layering tidiness.

## Praise

| ID | What | Raised by |
| --- | --- | --- |
| **P-1** | **The verification read-back is load-bearing, not ceremony.** `Coordinator.ts:110-114` re-reads the config after the await. `rollbackMessageRun` → `rollbackThreadCommit` clears `committedTurnId`/`artifactId` *after* `onRoomAccepted` already latched them in the closure. Without the read-back the coordinator would return `accepted` on a turn that no longer exists, the sheet would close on `ok: true`, and the writer's exact draft — the whole point of the slice — would be gone. **The reusable rule: when a callback stamps durable state before an outer `await` resolves, re-read the record after the await instead of trusting the closure variable.** | Blake |
| **P-2** | **The one-shot plan carries a count, not a noun — which is why the coordinator has zero diff lines.** `selectionCount: number` is used in exactly one place (a log string), so the rail never learns whether the unit is a gesture option or a creative take; and `toolTargetRefusalMessage` is an *optional* feature-voice slot with a host-owned neutral default. That pair is what let a semantically richer feature join without the transaction learning a word of its vocabulary — and it explains the otherwise-odd gate ordering. **Neutral rails carry counts, ids, and optional caller-supplied copy — never rendered nouns, never a required feature string.** | Marcus |
| **P-3** | **The artifact-budget fixtures prove they cross the boundary, at both enforcement sites.** The test measures the compiled artifact's fixed overhead from a one-character probe draft, derives the prose length landing on exactly 20,000, then asserts *the fixture's length* before asserting the verdict. `WorkshopWidgetHostHandler.test.ts` repeats the derivation independently at the host site, and both recompute `overlap` so the constructed draft still satisfies integrity. Flip either `>` to `>=` and one suite goes red. | Cal |
| **P-4** | **The artifact excludes editor provenance by construction, and the test pins the exact path by name.** `buildCreativeVariationsArtifact` never *references* `subject.provenance` or `sourceReferences` — not filtered, not redacted. A filter can be edited into a leak; an unreferenced field cannot. And because structural exclusion is invisible the moment someone adds a "context" section, the fixture's `relativePath` is asserted absent by name. That converts the Slice 4 review's F-09 into a standing guard instead of a habit. | Patricia |
| **P-5** | **Widening the payload union came with a same-commit sibling sweep.** `Omit<WorkshopCommitWidgetPayload, 'requestToken'>` was harmless while the union had one member; adding the Creative arm collapses it to a cross-product accepting `{widgetId: 'gesture-playground', draft: creativeDraft}` at the last typed hop before `postMessage`. *Verified against the repo's own `tsc`: the pre-narrowing type compiles the crossed literal.* The author narrowed both the interface and the callback in the same commit. Closed registries fail loudly when an arm is missing; `Omit<Union, K>` fails **silently by getting looser**. | Stan |
| **P-6** | **The expensive derivation is never imported into the webview.** Creative has two projections over card prose: `buildCreativeVariationsArtifact` at 0.034 ms, and `computeCreativeVariationsTextualOverlap` at 0.8–6.1 ms. The webview imports the cheap one and only a *constant* from the expensive one. That is what makes the deliberately broad `useMemo(..., [draft])` a non-issue at 0.034 ms per note keystroke — behind the same key, the overlap recompute would have cost milliseconds per keystroke. **Cheap pure projections may cross the layer; O(n²) re-derivations stay host-side and arrive precomputed.** | Tim |
| **P-7** | **The "What commits" line counts instead of asserting.** Slice 4 claimed unconditionally that both declared constraint fields ride with the takes — false whenever a field was blank. This slice replaces the assertion with a count derived from the same nonblank predicate the artifact builder uses, and gives the zero case its own honest sentence. The writer-facing summary is computed from the same function that decides what actually ships, so it cannot drift into a comfortable lie. | Bria |

## Focus-area verdicts against the review brief

| # | Question from the brief | Verdict |
| --- | --- | --- |
| 1 | Creative payload arm pairs only `widgetId: 'creative-variations'` with the exact authored draft; no `any`, no loose pairings, no widened generics | **Holds, and improved.** The union, action-result arm, and registry each took exactly one arm; `@ts-expect-error` witnesses pin the pairing. The MR also closed an `Omit<Union, K>` collapse the widening created (P-5). |
| 2 | Creative vocabulary does not leak into feature-neutral host, coordinator, or session code | **Holds.** `grep Creative` across `WorkshopSessionService`, `WorkshopTurnLedger`, the coordinator, the host handler, and `WorkshopRoomHandler` returns nothing; the single hit is the ledger's discriminated-union arm, which is the ADR 2026-07-31 shape. |
| 3 | The existing closed one-shot registry is reused rather than bypassed | **Holds.** Registry took one entry; the coordinator has zero diff lines. The gap is that its derived guard was not reused on the new gate (F-01). |
| 4 | `CreativeVariationsArtifact` is the sole deterministic projection for both host enforcement and the modal meter | **Holds, and is tested.** One function, two enforcement sites, same `>` operator against the same constant at all four comparison points; P-3 proves flipping either turns a suite red. |
| 5 | Unselected cards, discarded alternatives, overlap data, rankings, paths/URIs, and inferred blank constraints cannot leak into the artifact | **Holds by construction** (P-4). Exclusion is by non-reference, not by filter, and the excluded values are asserted absent by name. |
| 6 | Exact-limit success and one-character-over rejection occur before room mutation | **Holds.** Proven at both sites with derived fixtures; the host tests additionally assert `session.getWidgetConfig('wc-1')` is undefined after refusal. |
| 7 | Settled-workup, selection, hard-conflict, risk-acceptance, generation, duplicate-commit, room-run, availability, and target gates — in webview and host | **Mostly holds.** All eight host rules verified. Three gaps: the generation gate crashes on a live non-one-shot id (F-01), the webview's advisory check is a strict subset of the host's (F-10), and `tool-target` has no webview blocker at all (F-13). |
| 8 | No double-click races, stale closures, active-generation races, or host re-entry creating duplicate durable records | **Holds for duplicates.** Three-layer single-flight; no path produces two configs for one click. Two non-duplicate race defects found instead: clone lineage read at the wrong time (F-05) and a model change swallowed during pending (F-04). |
| 9 | Pre-acceptance failure may retain the durable retry config; turn/artifact atomicity and cross-record linkage | **Holds.** Verified through the real route harness: original and clone each mint fresh `wc-N`/`ta-N`/turn with correct linkage, and the source config is byte-identical afterward. |
| 10 | Participant-response failure after acceptance does not roll back the accepted commit | **Holds**, and the read-back that makes the *opposite* case honest is the slice's best single idea (P-1). |
| 11 | Commit never regenerates the workup or invokes a model | **Holds.** `expect(creativeVariationsGenerate).not.toHaveBeenCalled()` across an original commit *and* a clone recommit, through the real router. No provider port on the path. |
| 12 | Every attempt gets a fresh token; stale-token and wrong-widget results ignored; duplicate commit prevented while pending | **Holds.** Tested directly, including the wrong-widget-with-matching-token case, which reports a correlation issue rather than settling. |
| 13 | Pending commit keeps the modal mounted and locks close/destructive changes | **Holds** — and is the strictest lock in the family, covering close, Cancel, Escape, overlay, passage, note, and every card control. That strictness is also what makes F-02 unrecoverable rather than merely annoying. |
| 14 | Refusal preserves the exact draft and exposes retryable host copy | **Holds.** Host copy is forwarded verbatim and rendered at `role="alert"`; the draft is untouched; proven by test. |
| 15 | The modal closes only after host acceptance; closing clears stale settled action-result state without pretending to cancel an accepted transaction | **Holds.** Closure is gated on `ok: true` only. `ignoredOpeningCommitOutcomeRef` earns its keep — Cal identified the test that turns red without it (the `ok: false`-at-open case); the `ok: true` branch remains untested. |
| 16 | Durable config preserves exact blank aim, provenance, workup, selections, carry modes, accepted-risk ids, note; transient chrome does not persist | **Holds.** Blank aim asserted durably at three independent layers. |
| 17 | Chip reopen fetches by exact `widgetConfigId`; reopened state is transiently idle | **Holds**, including the config-id regex validation on the request route. |
| 18 | Recommit records `clonedFromConfigId`, mints fresh `wc-N`/`ta-N`/turn ids, leaves source config and historical turn immutable | **Holds for identity and immutability** (verified end-to-end). **Does not hold for provenance correctness:** the field is captured at the wrong moment (F-05) and validated on neither the write path nor the wire (F-06). |
| 19 | Export/hydration linkage and compact-summary bounds | **Holds.** The new persistence test asserts the summary excludes card text and stays under 1,000 bytes. |
| 20 | Live catalog mounts a functional commit button with accessible first-blocker copy and exact usage | **Holds in the mounted test.** One caveat: the unreachable `commitAvailable` branch outranks every real blocker in both the footer and `aria-describedby` (F-11). |
| 21 | The integrated chip reopens the actual Creative surface; Creative remains launchable | **Holds** in the mounted integration. Unverified on the real F5 surface — see residual risks. |
| 22 | No editor-write route/API added | **Holds.** Zero matches for `applyEdit`, `WorkspaceEdit`, `TextEditor`, `editor.edit`, `replaceRange`, `insertText`, or `writeFile` in the diff; zero new message types; zero new routes. |
| 23 | Host recommendation/prefill remains unavailable until Slice 6 | **Holds.** No `creative-variations` arm in `WorkshopWidgetRecommendationOperations`; `openWidgetRecommendation` handles only Gesture and Lexical. |
| 24 | No accidental persona prefill, report prefill, partial regeneration, cross-workup history, ranking, auto-selection, or editor application | **Holds. None present.** |

## What the Panel Changed About the Runway

**Affirmed.** The structural thesis survived every seat: the coordinator's zero diff is real, feature-neutrality is genuine rather than nominal, and every generic seam took exactly one arm. The artifact's exclusion-by-construction, the four-site threshold consistency, the blank-aim durability, and the absence of every deferred behaviour all verified. The runway's caution that missing screenshots are a residual gap rather than a defect was upheld — no reviewer found contrary evidence.

**Refined.** Three framings tightened. (1) The runway asked two *separate* neutral questions — "what does the handler do with a live non-one-shot id?" and "what unwedges a commit whose reply never arrives?" — and the panel found they were the same defect meeting itself. (2) The runway's design-by-contract question, "is the one-result-per-token postcondition enforced or emergent?", resolved to *emergent, and already false on one branch*. (3) The runway called §11's scale question settled by naming the ledger's linear `find`; Tim's answer was that the `find` is free and the per-write O(n²) re-derivation the runway never mentioned is what bills you.

**Rejected.** Stan overturned the runway's §5 claim that controller-owned blockers imported upward were *new precedent this MR creates*. The Slice 4 remediation `b6fa5b07` had already moved two sibling types the same direction; Slice 5 is complying with an accepted convention, not inventing one. Verified against the remediation diff. Bria also rejected §3's framing of actor authority as fully settled — the *tool sidecar* is an actor the host refuses and the sheet never mentions. Cal materially weakened §3's rule 7 and §13's chain-of-custody reading: recomputed overlap binds ids and cardinality, not authored text.

**Still unknown.** Whether the room is expected to already hold the passage (F-03) — a product question no artifact answers. Whether `commitAvailable` is Slice 6 scaffolding or dead code. The provenance of the 20,000-character budget. And the integrated F5 surface, which no one in this review could see.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — Totality proves the map, not the key

**Illuminated by:** F-01 (Marcus, Blake, Sam, Patricia, Stan, Oliver); P-5 (Stan)

The `satisfies Record<…>` table and its `hasOwnProperty`-derived guard prove something real and worth keeping: every one-shot id has a compiler, and guard and dispatch cannot drift apart. What they cannot prove is that the id arriving on the wire *is* a one-shot id — that fact is established by a gate, and here the gate that consumes the narrow type ran above the gate that earns it. The same MR shows the compiler at its best when widening the payload union mechanically forced a sibling narrowing; the difference is that a compiler can only notice values that passed through it, and a wire value has not yet.

**Carry forward:** For every early gate that indexes by a narrowed type, name the line that does the narrowing and confirm it runs above you — per argument, not per payload.

### Lesson — A test is worth the edit that can turn it red

**Illuminated by:** F-07, F-08, F-16 (Cal, Stan); the harness stub in F-01; P-3 (Cal)

Three findings this round describe assertions that cannot fail: a rule whose call can be deleted with 2,242 tests still green, a join whose only assertion was rewritten away, a branch whose test reddens only if someone deletes the branch. The fourth is the instructive one — the harness stubbed a partial record lookup as a total function, so it did not merely miss the defect, it *asserted the graceful refusal that production no longer performs*. A double built from the signature will be kinder than production every time, because a signature describes the shape of the call and composition decides the shape of the answer. The counterweight sits in the same diff: fixtures that assert their own length before asserting the verdict — a test that checks it is still the test it believes itself to be.

**Carry forward:** For each new assertion, name the production edit that would turn it red; if the only candidate is "delete this assertion," it is scenery — and build seam stubs from what composition actually wires, not from the interface.

### Lesson — A postcondition nobody owns is a habit, not a guarantee

**Illuminated by:** F-02 (Blake, Oliver) meeting F-01; F-14, F-15 (Oliver); F-04 (Sam, Cal); P-1 (Blake)

The runway asked whether "exactly one action result per token" was enforced or emergent, and the panel's answer — emergent, and already false on one branch — is the whole lesson in miniature. An invariant maintained by every branch behaving well survives until a branch is added, and the branch that gets added is reliably the one that throws before it replies. What makes it expensive here is that the state awaiting the reply was a lock, so an unspoken answer costs the writer their draft. The same unmet obligation appears in quieter registers all through the report: a `catch` that returns the same null as "nothing selected," a rollback the channel never corrects, a model change an effect swallows rather than defers.

**Carry forward:** When UI state is cleared only by an inbound reply, find the single place that guarantees the reply — a `finally`, one terminal switch — and if no such place exists, give that state its own release path.

### Lesson — If a rule must be said twice, share the sentence

**Illuminated by:** F-10, F-12 (Parker); F-06 (Patricia); F-13 (Bria); the single-artifact-formula design

This change contains the best and the worst version of the same situation. One rule is stated at two enforcement sites and *cannot* disagree, because both call one function — drift there would require someone to edit the formula. Another rule is stated three times and did drift, with the webview's check a strict subset of the host's; a third disagrees across the durable boundary, so the host writes what its own reader refuses. The variable is not diligence but residence: a shared function where the layers permit one, and failing that a shared *name* — the way the component next door had already found `interactionLocked` while nine unnamed guards beside it said the same thing in two polarities.

**Carry forward:** When you write a rule the second time, ask whether it can import the first — and if it genuinely cannot, give both copies the same name so the next reader can find them together.

### Lesson — Deliberate divergence and drift look identical at rest

**Illuminated by:** F-17 (Marcus, premise corrected by Stan); F-03 (Bria); F-11 (Parker)

Marcus read the blocker union's move into the props file as a direction inversion this change introduced; Stan went to the history and found `b6fa5b0` had already moved two siblings the same way and deliberately left the third behind. Both readings were sound from the diff — what separated them was archaeology, performed because one reviewer chose to dig. The same gap recurs where a sibling names its subject phrase twice and this one names it nowhere with nothing recording the choice, and where a doc comment shed the one fact that made a flag checkable in the same commit that removed every empirical way to answer it. A convention that lives only in commit history is a convention the next author will re-decide by coin flip, and comments describing *what* decay while comments giving *why* keep working.

**Carry forward:** When you diverge from a sibling on purpose, write the reason where the next author will be standing — and when you remove the last empirical way to check a claim, replace it with why it holds, not a restatement of it.

> If one thread runs through all five: everywhere this change let a machine hold the promise — the totality table, the single artifact formula, the fixtures that measure themselves — the promise held; everywhere it was left to every branch behaving well, the panel found the branch that didn't.

## Horizon Watchlist

Not merge blockers. Real pressures the panel or the runway supported, carried forward for Slice 6, Slice 7, and Sprint 05.

- **The catalog `live` flag sits upstream of every totality guarantee with no compile-time link to any of them.** `show-vs-tell` is already `rail: 'oneshot'`, `live: false`. The registries fail loudly when an arm is missing; the boolean that admits an id to the commit route does not. F-01 is the first symptom, not the class.
- **Gesture is now the older shape on four axes** — commit state in the modal, generation token in the component, an overwriting token ref, a self-closing effect — with no convergence scheduled and Slice 7 scoped to witnesses and docs. The next author copies whichever hook they open first. F-02 and F-16 are both consequences of the two shapes disagreeing.
- **Show vs. Tell is the real exam.** If it lands as one arm per registry plus its own compiler, artifact, controller, hook, and modal — with zero edits under `creativeVariations/` — this slice's structural claim is proven. Watch `carryMode`: its five continuum positions map closely enough onto it that it is the concept most likely to be wrongly generalised.
- **`useWorkshopWidgetOpening` is accumulating a fourth `close*` triple and a fourth `else if` arm**, and `openWidgetRecommendation` still handles two widgets while silently dropping the rest — where Slice 6 lands.
- **`WorkshopApp`'s Creative modal invocation is already ~35 props.** With four modal blocks after Sprint 05, the pressure to hoist a container or a props bundle arrives — and that is the moment feature vocabulary could enter generic presentation.
- **One-hop clone provenance.** Reconstructing a lineage means walking the chain; nothing summarises it. F-05 and F-06 both bite harder the longer chains get.
- **Unrecorded calibration.** No artifact records who chose 20,000 characters or against what corpus, and the two-token-family convention (shared action tokens vs feature-prefixed streaming tokens) exists only as three concordant implementations.
- **The single `commitInProgress` boolean is family-global.** Correct today — one room, one turn. A future background or queued rail meets it first.

## The Closer

⭐ **Restaurant review — four stars.**

Ordered the tasting menu with the chosen-directions course, and the kitchen has clearly learned since the last visit — the plate arrives with exactly what you selected and nothing from the discard bin, the bill is itemised before you commit to it, and when the pass sends something back the waiter reads you the kitchen's own words instead of improvising. Four stars because the dish is served without ever naming the ingredient it is a variation *on*, so the table across from you has to guess what they are being asked to taste. And one back-of-house note: there is a service door that used to hold a polite "not that way, chef" sign, and someone put a new step in front of it — anyone who walks it now falls into the cellar, and the dining room never hears a thing.

## Final Assessment

This is the slice that had to prove Slice 1 was honest, and it did. The feature-neutral coordinator took a second, semantically richer feature with **zero diff lines**; feature vocabulary appears nowhere in host, session, or transaction code; every generic seam accepted exactly one arm; and the artifact projection excludes the discarded cloud by construction rather than by filter, with the exclusion pinned by name in a test. Four of the seven praise items describe machinery that will hold without anyone remembering to — which is the property that actually survives contact with Sprint 05.

The three High findings share one shape, and it is not architectural. Two of them are the same sentence read from opposite ends: the host acquired a gate that can throw before it can answer, and the webview acquired a lock that only an answer can release. Each fix is small and well-specified — a guard call that already exists and has no caller, and a `catch` that turns an emergent postcondition into an enforced one. The third is a product question the compiler is currently answering unattended, and the honest repair may be a recorded decision rather than a code change.

**Merge after F-01 and F-02.** F-03 needs the copy owner's answer, not necessarily a patch, but it should not reach Sprint 05 unrecorded. F-04 through F-06 are proven defects with one-line fixes and belong with them; F-07's missing test and F-01's stubbed harness are the same lesson and should land together, because right now the suite asserts a refusal production no longer performs. The remaining Standard findings are legitimate follow-ups — F-09 in particular is a growth curve, not an outage, and should not hold this commit.

One residual risk stands above the findings and belongs to neither the code nor the panel: **no one in this review, or in the implementation, has seen this run.** Display capture was unavailable in both environments and no fixture image was substituted by either — which is the correct call. The mounted integration exercises the live catalog route, settlement, selection, pending commit, acceptance, chip, exact reopen, and clone recommit, so the wiring is genuinely proven; the eligible posture, pending lock, narrow layout, and accessible first-blocker copy on the real Extension Development Host are still owed a human pass.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
*Runway scouts: Bria 🎯 · Stan 🗂️ · Marcus 🏛️ · Sam 🔍*
