# MR Review v2 — Creative Variations Sprint 03, Slice 4

**Author:** Okey Landers · **Branch:** `sprint/conversation-widgets-03-creative-variations` → `epic/conversation-widgets`
**Range:** `8bbb5aeb` … `1f04653a` · **Head:** `1f04653` · **Single commit:** `feat(workshop): add creative variations authoring flow`
**Reviewed:** 2026-08-13 (America/Chicago) · **Mode:** Full (local, review-only)

**Verdict: Nearly there.** No Blocking findings. Three High findings, all small and well-specified, concentrated on the newly-default blank-invariant path and the selection-intake seam.

Jump to [Executive Briefing](#executive-briefing) · [Findings](#findings) · [Focus-area verdicts](#focus-area-verdicts-against-the-review-brief) · [Sensei's Lessons](#senseis-lessons)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Blank invariants are the default, and one model flag voids the entire paid workup | Blake, Sam, Bria, Tim, Oliver | 5 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-02 | 🟠 High | `handleSubjectSelection` is the only intake path without the guards its siblings have | Sam, Blake | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-03 | 🟠 High | A settled workup is destroyed with no statement that it happened or why | Oliver | 1 runway-prompted | — | **Addressed** |
| F-04 | 🟡 Standard | Blank-invariant guard untested; mounted integration test settles a workup the codec would reject | Cal | 1 runway-prompted | — | **Addressed** |
| F-05 | 🟡 Standard | The derived check built to fire on a `live` flip was replaced by a hardcoded list, at the flip | Stan, Cal | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-06 | 🟡 Standard | The registry still describes the pre-flip world, to writers and to engineers | Bria, Stan | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-07 | 🟡 Standard | Three appliers of the request projection, no declared owner; the webview's reaches the wire | Marcus | 1 runway-prompted | — | **Addressed** |
| F-08 | 🟡 Standard | Generate ignores a dead source reference the sheet has already diagnosed | Sam | 1 runway-prompted | — | **Addressed** |
| F-09 | 🟡 Standard | Editor-derived path rides into the outbound provider prompt with no display-safety guard | Patricia | 1 runway-prompted | — | **Addressed** |
| F-10 | 🟡 Standard | `updateAuthoringInput` acts before it decides, and signals the decision through object identity | Tim, Parker | 1 independent · 1 runway-prompted | — | **Addressed** |
| F-11 | 🟡 Standard | The composition root learned the card model to implement one copy button | Marcus | 1 independent | — | **Addressed** |
| F-12 | 🟡 Standard | The close contract is a conditional cancel where both siblings use an unconditional clear | Marcus | 1 runway-prompted | — | **Addressed** |
| F-13 | 🟡 Standard | Two names for one concept, twice over, with nothing holding them together | Parker | 1 runway-prompted | — | **Addressed** |
| F-14 | 🟡 Standard | The fresh-sheet contract has no witness: no test ever transitions `open` | Cal | 1 runway-prompted | — | **Addressed** |
| F-15 | 🟡 Standard | The authoring controller sits off the recorded target tree with no recorded reason | Stan | 1 runway-prompted | — | **Addressed** |
| F-16 | 🟡 Standard | Dev-watch polling taxes Linux and Windows to fix a macOS descriptor limit | Tim | 1 runway-prompted | — | **Addressed** |
| F-17 | 🟡 Standard | The sprint's named Design source still declares the rule this commit retired | Bria | 1 runway-prompted | — | **Addressed** |
| F-18 | 🔵 Nit | The new dispatcher borrows its sibling's word for the opposite contract | Parker | 1 runway-prompted | — | **Addressed** |
| P-1 | 💚 Praise | A dead source reference fails before the provider is touched | Blake | 1 independent | — | N/A — preserve |
| P-2 | 💚 Praise | The optionality loosening shipped with its matching model-authority guard, at both layers | Patricia | 1 independent | — | N/A — preserve |
| P-3 | 💚 Praise | Structural unavailability outranks situational, in the control's own accessible description | Oliver | 1 independent | — | N/A — preserve |

### Remediation receipt — 2026-08-13

All 18 findings were addressed in the post-review worktree. This records the
implementer's disposition for re-review; it does not change the review's
historical verdict or declare Slice 4 reviewed.

- **F-01 / F-04:** The prompt now defines blank invariant fields as absent and
  forbids flags against them; the example declares its nonblank precondition;
  rejection copy tells the writer when a blank-field flag caused the failure.
  Codec tests cover both invariant fields, and the mounted test now settles a
  flag-free workup compatible with its blank inputs. Response atomicity remains
  deliberate: one invalid flag rejects the whole closed workup.
- **F-02 / F-10 / F-14:** Selection intake now receives the full targeted
  envelope, ignores closed-sheet and in-flight replies, and treats an exact
  subject/provenance repeat as a no-op. All authoring updaters decide before
  cancellation or invalidation, use a synchronous draft reference for batched
  edits, and have close-to-reopen coverage.
- **F-03:** Input and model changes that clear work now retain a named reason in
  controller state and expose it through a polite `role="status"` region after
  the cards disappear.
- **F-05 / F-06:** Host-prefill fitness is derived from every live catalog id
  with Creative Variations as the exact witnessed no-prefill exception. The
  live browser behavior, catalog lifecycle copy, message-contract commentary,
  and governing ADR now distinguish launchability from the narrower commit and
  recommendation registries.
- **F-07 / F-09:** The webview sends the authored draft unchanged. The host
  handler is the declared generation-projection owner; the service repeats the
  derivation only as a provider-boundary defense. Provider task data now carries
  subject text and provenance kind but no workspace-relative path or line range.
- **F-08:** A diagnosed unavailable source is a first-class Generate blocker
  with an accessible removal instruction.
- **F-11 / F-12 / F-13:** Per-card copy passes prose upward rather than teaching
  `WorkshopApp` the card schema; transport cancellation always clears transient
  state even after settlement; the controller imports the modal's shared
  availability and generation-phase vocabulary instead of cloning it.
- **F-15 / F-17 / F-18:** The runway tree and handoff record the feature-scoped
  controller placement; the concept and sprint agree that constraints and aim
  are optional; the selection helper and responsibility ledger now describe
  exact target routing rather than fan-out, with defense-in-depth target guards.
- **F-16:** Development watch polling is now macOS-only by default, with a
  positive `PM_WATCH_POLL` override for other platforms; `node_modules` remains
  ignored everywhere.

Post-review verification: focused remediation set **18 suites / 202 tests**;
full Jest **206 suites / 2,215 tests / 2 snapshots**; all TypeScript
configurations; ESLint **0 errors / 955 baseline warnings**; production build,
resource staging, webpack bundles, bundle sentinels, and the exact F5 watch
command; `git diff --check`. All passed. The worktree remains ready for
re-review, not reviewed or complete.

## Review coverage

**Read fully:** `useCreativeVariationsAuthoring.ts`, `useCreativeVariations.ts`, `dispatchWorkshopSelectionData.ts`, `useWorkshopWidgetOpening.ts`, `useWorkshopAppMessageRouter.ts`, `WorkshopCreativeVariationsHandler.ts`, `CreativeVariationsService.ts`, `CreativeVariationsDerivations.ts`, `CreativeVariationsConfigCodec.ts`, `CreativeVariationsConfigIntegrity.ts`, `CreativeVariationsResponseCodec.ts`, `workshopWidgets.ts`, `persistedValidation.ts`, `UIHandler.handleSelectionRequest`, `WorkshopModalShell.tsx`, `useOverlayDismiss.ts`, `WorkshopOneShotWidgetCommitOperations.ts`, `WorkshopWidgetRecommendationOperations.ts`, `WorkshopWidgetAvailabilityPolicy.ts`, both system-prompt files.

**Diff reviewed:** all 33 changed files across `8bbb5aeb..1f04653a` (+1,926 / −119), including all 15 test files.

**Governing evidence read:** Sprint 03 plan, the Creative Variations Playground concept, the 2026-08-10 implementation runway, ADR 2026-07-22 (conversation widgets), ADR 2026-08-12 (offline-capable agent run engine), ADR 2026-08-03 (feature family), the Slice 4 handoff, and the prior v2 review for Slices 2–3 plus the PR-99 review that installed the F-08 fitness function.

**Siblings compared:** `useGesturePlayground.ts` + `WorkshopGesturePlaygroundModal.tsx`, `useLexicalGravity.ts` + `WorkshopLexicalGravityModal.tsx`, `dispatchWorkshopWidgetActionResult.ts`, `useWorkshopExcerptVerify.ts`.

**Not executed — stated plainly:** `node_modules` is empty in this container. **The author's verification receipt (15 focused suites / 158 tests; full Jest 206 suites / 2,201 tests; typecheck; lint; build) could not be independently re-run.** This review is static analysis of source at `1f04653`. Every reviewer was instructed not to claim execution results, and no finding below rests on one. Where a reviewer asserts "deleting these lines passes the suite," that is a reasoned claim about test coverage from reading test source, not a measured mutation run.

**Working tree:** unmodified throughout. No edits, commits, pushes, or PRs. The protected untracked files `Prose Minion.zip` and `workshop-ai-service-conversation-ownership.md` were not touched.

**Panel:** 4 runway scouts + 10 specialist reviewers + Sensei. 29 raw findings → 18 deduplicated + 3 praise.

---
# Part I — Semantic Runway

> The runway was written **before** any specialist reviewed the code, and deliberately contains no findings, severities, or verdicts. Four of its claims were later corrected by the panel; see *What the Panel Changed About the Runway*.

## Semantic Runway — Creative Variations Sprint 03, Slice 4

**Commit:** `1f04653` · **Range:** `8bbb5aeb..1f04653a` · **Branch:** `sprint/conversation-widgets-03-creative-variations`
**Evidence date:** 2026-08-13 · **Blast radius:** 33 files, +1,926 / −119; 2 new webview hooks (618 lines), 1 new dispatcher, no migrations, no new dependencies

**Runway thesis.** Slice 4 is where Creative Variations stops being a contract and becomes a surface a writer can touch. It does two things at once that a reader should keep separate: it builds the authoring flow (intake, transient state, correlated generation, cards, comparison), and it *opens the door to production* three slices ahead of the plan. The first is careful, well-tested engineering. The second is an authorized product decision whose consequences ripple through registries, durable codecs, prompt behavior, and a fitness function installed one review ago specifically to fire on this event.

---

### 1. Working Definition & Real Job

**Literal code change.** Two new webview hooks — `useCreativeVariations` (transport: token minting, generate/cancel wire, host `workupId` latch, stale rejection) and `useCreativeVariationsAuthoring` (transient draft, intake interpretation, invalidation authority, commit-blocker derivation) — plus a closed selection dispatcher, a `{kind:'new'}` opening arm, modal mounting in `WorkshopApp`, and a catalog flag flip. Three validation loosenings (`mustSurvive`, `intent.aim` may be blank; flag-vs-blank-field checking generalized to both invariant fields) and one dev-loop webpack fix ride along.

**Functional capability.** A writer opens Creative Variations from the real widget browser, pulls the editor selection or falls back to the clipboard, optionally declares constraints and an aim, presses Generate, watches correlated progress, cancels if they like, and compares three to five typed takes with a deterministic overlap readout — then copies prose to the clipboard, because commit does not exist yet.

**Business problem.** A writer exploring alternatives has no way to see several genuinely different takes side by side under constraints they control. Every existing path either rewrites in place or buries alternatives in chat prose. The harm the feature must prevent is subtler than the value it creates: silent rewriting, editor mutation, false continuity claims, and collapsed alternatives presented as variety.

**What the wording and structure emphasize.** The modal's own header calls it *"a comparison studio, not a rewrite button."* The controller's persistence interface is an empty interface with a comment explaining the emptiness (`useCreativeVariationsAuthoring.ts:77-79`) — the code goes out of its way to *declare* that it owns nothing durable. The commit button ships disabled with an associated explanation rather than hidden. This is a codebase that treats honesty as a feature.

**What it suppresses.** The word `live` now carries four distinct meanings (launchable, commit-capable, recommendable, prefill-preparable) behind one boolean, and this commit changed which of those it asserts by editing a doc comment rather than the call sites.

**What must survive any valid alternative.** No editor mutation. No result may settle onto a draft it was not generated from. A failed attempt must preserve the writer's inputs. The model may never invent identities or flag an invariant the writer did not declare. Provenance must never claim more than the intake proved.

**Competing interpretation worth testing.** A reviewer could read this as "the authoring slice, with a catalog flag flipped for convenience." The stronger reading is that the flag flip is the *load-bearing* change: it is the event that converts every dormant Slice 2/3 cost into a live one, and the prior review said so in writing. The panel should test which reading the code supports.

> This MR is not merely **wiring an authoring UI to an existing generation contract**. Its real job is **making the widget genuinely reachable by a writer for the first time — and thereby activating every latent registry, codec, and prompt assumption that `live: false` had been holding back** while preserving **writer authority, provenance honesty, attempt correlation, and the closed Slice 5 boundary**.

---

### 2. Declared Intent, Observed Behavior & Open Meaning

**Aligned.** The declared Slice 4 scope maps cleanly onto observable behavior. Every named deliverable exists and is tested. The transient controller genuinely declares `{}` persistence and genuinely imports no transport vocabulary — enforced, not merely asserted, by a directory-wide scan at `boundaries.test.ts:1240-1247`. Commit is refused twice and independently: the modal disables it with an accessible reason and receives no callback, and the host route would return `unsupported-one-shot-widget` because `WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS` contains only `gesture-playground`.

**Gaps between artifacts, all [Observed].**

- The concept doc named as the sprint's **Design source** still declares `must survive` nonblank and the aim required. It is byte-identical to the baseline. Sprint plan and architecture runway were both amended in this commit; the design source was not.
- The sprint's own Goal paragraph still describes the flow as *"declare what must survive and what must not change"* two sections above the locked decision that makes both optional.
- `messages/workshop/widgets.ts:24` still reads *"only `live` ids may launch, commit, or be recommended."*
- ADR 2026-07-22:457-458 still reads *"The persona-recommendation parser rejects `widgetId`s that are not `live` in the registry, so comp-only widgets can never render dead chips."*
- The architecture runway's target tree at `:137-142` still places `useCreativeVariationsAuthoring.ts` under `widgets/creativeVariations/`; the implementation put it under `controllers/creativeVariations/`. ADR 2026-08-03 §7 requires a recorded reason for such a deviation, and F-19 in the immediately prior review was resolved by recording exactly this kind of deviation.
- The production-visible catalog blurb still promises *"under invariants you declare"* (now optional) and `ONE_SHOT_LIFECYCLE = 'play first · commit adds one turn'` (commit unavailable). ADR §14 sets the standard: *"Unshipped widgets stay visible and disabled — the menu is a roadmap, not a lie."*

**Unknown.** No in-repo artifact predating this commit records who approved the optionality change or why. The review brief states Okey approved it; the panel should treat that as settled and not relitigate it, while still asking whether the artifacts that describe it now agree with each other.

---

### 3. Business Story & Rulebook

**Actors.** The writer (sole authority over generation, selection, and — later — commit). The host (mints `workupId`, resolves source material, owns availability and the model). The model (proposes takes and declares flags; may invent nothing). Personas (explicitly excluded in this slice). The room (receives nothing).

**Trigger and preconditions.** The widget browser now lists Creative Variations as launchable. The only precondition to generate is a nonblank passage.

**The rules this commit newly establishes.**

- The passage is the sole required input. Blank aim projects to `Generate at random.`; blank invariants declare no constraint.
- Editor-derived provenance keeps only `relativePath` plus an optional line range — `sourceUri` is used as evidence and discarded. Any subsequent keystroke demotes `excerpt → pasted`.
- Any authoring-input change atomically clears the workup, selections, carry modes, and accepted risks. Carry modes and accepted risks are nested inside `selections`, so clearing selections clears all three — the atomicity requirement is satisfied structurally, not by three coordinated writes.
- Changing the host-owned widget model invalidates the settled workup. Takes belong to the model that produced them.
- A failed attempt preserves every authoring input.
- A model flag against a blank invariant field is illegal at two layers.

**The rule accidentally implied.** With both invariant fields blank — the new default — *no* `invariantFlags` are legal at all. The advisory-risk acceptance gate and hard-conflict commit block, the feature's two writer-authority safety mechanisms, are inert until the writer opts in by typing something. Whether the default state means "this workup carries no risk" or "this workup's risks are undetectable" is not stated anywhere the writer can see.

**Exceptional but legitimate states.** A generation that fails and leaves inputs intact. A selected source that has become unavailable. A workup invalidated by an edit the writer made deliberately. All three are handled; the second is handled inconsistently (see §7).

---

### 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** A fresh `{kind:'new'}` opening. The controller's open-transition effect resets the draft to defaults: empty passage, `pasted` provenance, blank invariants, blank aim, `tail` distance, count 3.

**Development.** Intake arrives through the pre-existing `REQUEST_SELECTION` wire with a new exact target; `UIHandler` is target-agnostic and needed no production change. The controller interprets `sourceUri && relativePath` into display-safe provenance. Each authoring edit cancels any in-flight attempt and clears settled work.

**Turn.** `generateWorkup` calls `generate(draft)`, which mints a token *synchronously before posting* and returns it to be latched. That single statement is the commitment point: three records — the host's `activeGeneration`, the transport's `activeAttemptRef`, and the controller's `activeTokenRef` — are established atomically. The host then mints its own `workupId`, and the two identities join at the **first correlated callback**, where `workupId` is latched as a consistency witness rather than authenticated.

**Ending.** A correlated `ok` result whose inner `workup.workupId` matches its envelope settles into the draft with selections cleared. The writer compares, copies prose to the clipboard, and closes. Nothing persists. Nothing reaches the room.

**Unresolved threads.** Teardown is not symmetric with setup. The transport clears `activeAttemptRef` and publishes; the controller clears `activeTokenRef` one effect-tick later, gated on `open`. Because `cancelGeneration` early-returns when nothing is active, a *settled* result survives the sheet closing — and what prevents it from settling into the next sheet is that the open-reset effect is declared at line 133 and the result effect at line 158. React runs effects in declaration order. Nothing documents this; no test pins it.

---

### 5. Codebase Genealogy & Controlling Precedent

**The siblings are a weak comparison, and knowing why matters.** Gesture Playground and Lexical Gravity are both transport-only hooks with *uncontrolled* modals holding 16 and 26 `useState` calls respectively. Creative Variations' modal has been **controlled since Slice 3** — which left its draft homeless. Slice 4 had to house it, and `boundaries.test.ts:1240-1247` bans transport vocabulary anywhere under `controllers/`. The two-hook split falls directly out of that rule. The siblings never split because they never had a controller to place.

**Controlling precedent, and where it is contested.** `controllers/` was carved out of `WorkshopApp.tsx` for *family-generic* presentation owners; its three prior residents are all generic. `useCreativeVariationsAuthoring.ts` is the first **feature-scoped** resident. The next one-shot author reading the filesystem will find a feature folder under a generic-owner directory and inherit the split whether or not their modal is controlled.

**Layering.** No test and no lint rule constrains `presentation → application` import direction. Seven presentation files now cross it. `CreativeVariationsDerivations.ts` is dependency-free (type-only imports) and is the single owner of three identities used by four consumers spanning webview, host handler, and infrastructure service — a shared kernel whose directory says otherwise. Duplicating it webview-side would duplicate *knowledge*, not text.

**The precedent this commit creates, ranked by copy probability.** A feature subdirectory under `controllers/`; two hooks with correlation state in both; a request-shaping derivation applied three times on one path; two parallel type families for one feature's presentation vocabulary (the controller's blocker union is a structural subset of the modal's, so they assign without a cast and will silently stop overlapping when Slice 5 adds `commit-in-flight`); and `commitAvailable: boolean` + optional `onCommit?` as the shape for "this arm ships next slice."

**Conflicting authority.** Two dispatchers now sit in the same directory with opposite contracts: `dispatchWorkshopWidgetActionResult` broadcasts and lets each owner self-filter; `dispatchWorkshopSelectionData` switches and delivers once. Both consumers of the new one *also* self-filter, so the guard is doubled. Their consumer signatures differ too — one takes the envelope, one takes the payload.

---

### 6. Structural & Causal Map

```
modal ──onUseSelection──▶ useCreativeVariations.requestSubjectSelection
                              └─▶ REQUEST_SELECTION ──▶ UIHandler.handleSelectionRequest
                                    (editor selection │ clipboard fallback)
                                       └─▶ SELECTION_DATA ──▶ router ──▶ dispatchWorkshopSelectionData
                                             └─▶ authoring.handleSubjectSelection  [no open guard]

modal ──onGenerate──▶ authoring.generateWorkup
        └─▶ cancelActiveGeneration()  ─┐
        └─▶ setDraft(clear workup)     │ token minted synchronously, then posted
        └─▶ activeTokenRef = generate(draft) ──▶ WORKSHOP_CREATIVE_VARIATIONS_GENERATE
                                                    └─▶ Handler.handleGenerate
                                                          workupId minted (line 89)
                                                          availability gate  (line 90)
                                                          supersede prior    (line 101)
                                                          postProgress'started'(line 114)
                                                          └─▶ Service.generate
                                                                validate → engine → runInitial
                                                                └─▶ decodeCreativeVariationsResponse
                                                          └─▶ postResult ──▶ transport correlate
                                                                              └─▶ authoring settle
```

**Why each transition exists.** The selection wire is reused rather than duplicated because `UIHandler` is already target-agnostic and the trust boundary for clipboard-vs-editor provenance already lives there. The dispatcher exists so a second Workshop consumer of a shared wire does not turn the router table into a feature-aware surface. The token is minted webview-side because the shared cancel contract is keyed on a webview-minted `requestId` across every streaming domain — a host-only identity would make Creative Variations the one domain that cannot cancel before the host speaks.

**Where the trust boundary sits.** The host handler. Note that `creativeVariationsGenerationDraft` dereferences `input.intent.aim` one line *before* `assertCreativeVariationsDraftShape` runs, at both the handler and the service. Both sites are inside or propagate to a `try`, so a malformed payload degrades to a caught `TypeError` whose message becomes the writer-facing error string rather than the shaped validator message.

---

### 7. Contracts, Invariants & Negative Space

**Preconditions.** Nonblank passage. Availability policy admits the widget. No other precondition — notably, an unavailable selected source does **not** block Generate, even though the modal already computes `unavailableSelectedSources` and renders a "remove this reference" row for it.

**Postconditions.** A settled workup has exactly `requestedCount` cards at contiguous positions, host-derived flag ids, no flag against a blank writer field, and a recomputable overlap matrix.

**Invariants.** No editor write path exists in the new code — the only outbound content messages are `REQUEST_SELECTION` (read) and `COPY_RESULT` (clipboard). One live truth per draft: the persisted workup is *not self-describing*, because `assertOverlapIntegrity` recomputes overlap from `draft.subject.text`. That is legal only because any subject edit destroys the workup.

**Forbidden states.** A selection on a hard-conflict card (refused at selection time, stricter than the concept's "visible but commit-ineligible"). A flag whose id the model supplied. A result settling on a draft whose inputs changed.

**A contract tension worth naming, not yet a defect.** `assertSelectionRiskIntegrity` demands **set equality** between accepted risk ids and the card's advisory flags. The controller's `commitBlockers` treats an unaccepted risk as a *blocker*, not an error. So a selected-but-unaccepted card is a legal transient state and an illegal persisted state. Slice 4 never persists, so there is no collision today — but the persisted contract as written forbids the most common intermediate authoring state, which constrains any future checkpoint of an uncommitted draft.

**Negative space (deliberate).** No commit, chip reopen, clone, or recommit. No persona recommendation or prefill. No editor apply. No partial regeneration. No cross-workup history. No generic variation framework. `ConversationManager`, `AIResourceManager`, and `AgentRunEngine` are untouched — the diff contains no file under `orchestration/`.

---

### 8. Forces, Tensions & Design Tradeoffs

**Reachability vs. dormancy.** Going live early buys integrated hands-on testing through the same policy an F5 session uses, and the mounted `WorkshopApp` integration test now launches through the real catalog rather than a fixture. It spends the safety of dormancy. The prior review's Horizon Watchlist stated the trade explicitly: *"Slice 7 is when the dormant costs arrive… They land together the day the catalog flips."* Those four costs were all remediated before the flip — the trade was paid for. What was *not* re-examined is the set of registries and documents that read `live` for a different question.

**One boolean, four questions.** `isLiveWorkshopWidgetId` gates launch, commit admissibility (`WorkshopWidgetHostHandler.ts:101`), recommendation admissibility, and persisted-turn validity (`WorkshopSessionStateV1Shape.ts:613`). This commit narrowed the *comment* to launch-and-host-routes while leaving all four gates reading it. Creative Variations is independently stopped at commit (closed registry) and at recommendation (narrow TS union) — so the leaks are latent, not active. The durable codec gate is the one with no second guard: it now accepts a persisted `{widgetId:'creative-variations'}` recommendation that nothing can mint and nothing can open.

**Derivation ownership.** `creativeVariationsGenerationDraft` runs at three sites. It is idempotent, and projecting first is what makes a wire payload shape-checkable at all (the wire carries `widgetId`/`token`, which would fail `exactObject`). But because the *webview* projects first, the wire already carries the literal `Generate at random.` — the host cannot distinguish a blank aim from a typed one, and Slice 5 persists the draft.

**Alternate constructions.**
- *One hook, uncontrolled modal (the Gesture shape).* Buys one attempt record and no cross-effect ordering assumption. Costs: the `controllers/` rule would have to change, and invalidation plus commit-blocker derivation would live next to `postMessage` — precisely what the rule was written to prevent.
- *Project once at one declared boundary (the host).* Buys one owner, an unambiguous authored draft on the wire for Slice 5, and validation at the boundary that needs it. Costs the service its independent guard, contradicting the runway's "provider boundary must reject malformed results" posture.
- *Controller owns correlation; transport is pure I/O.* Buys exactly one attempt record and eliminates the effect-ordering dependency. Costs: stale host messages become React state before rejection, visible to any future consumer.

---

### 9. Failure, Recovery & Operational Truth

**Offline posture is intact and matches ADR 2026-08-12.** `getEngine('widget')` returns `undefined` without credentials because widget resources are only constructed on the configured path — exactly the disposable-engine carve-out the ADR preserves. The throw sits *outside* the decode `try`, so a provider-unavailable failure never persists a rejected-response artifact; only genuine model-output rejections do. `runInitial` runs on the widget engine under `assistantWithoutResources`, so no Workshop retained conversation is created or mutated. Hydration is pure and unaffected.

**But availability is credential-blind.** The catalog is now live, and the only Generate gate is a nonblank passage. Offline, the writer learns there is no key by pressing the button. This matches sibling widget services exactly (same literal error string in three of them), so it is inherited posture rather than new — but it is newly *reachable*.

**Rejection granularity is whole-workup.** One illegal flag on one card throws out of `arrayOf` → `decodeCard` → `decodeCreativeVariationsResponse` into `rejectResponse`. All 3–5 takes are lost, the call is paid, the raw response is persisted for recovery, and inputs are preserved. Before this commit, `mustSurvive` was required nonblank, so a `must-survive` flag was always structurally legal.

**Diagnostics.** The host logs generation, cancellation (with `reason=writer|superseded`), and failure with both identities. The webview transport rejects stale progress and results by early `return` with no trail — while both siblings report dropped acknowledgements through `reportWorkshopWidgetActionCorrelationIssue`. `dispose()` aborts silently where `cancelActiveGeneration` announces.

---

### 10. Security, Trust & Misuse Surface

Low surface, handled well. The prompt frames all writer strings as *"quoted task data, never as protocol instructions"* and repeats the rule in the system prompt. `sourceUri` — an absolute filesystem path — is deliberately dropped at the provenance boundary, so only a workspace-relative path can reach a persisted draft or the room. Source material is resolved host-side from session truth, never from webview-supplied content; the handler throws on duplicates and on references that no longer resolve. The model cannot supply ids of any kind. The rejected-response store was bounded to twenty entries by the prior review.

The attacker-controlled input worth naming is the model's response, and it is the one the closed codec exists to distrust.

---

### 11. Data, Time, Scale & Concurrency Horizon

`activeGeneration` is a single slot per handler instance, which is per `MessageHandler`, which is per webview. The Workshop panel is a singleton by construction, so "two Workshop surfaces superseding each other" is not reachable today — but the slot is written as though per-surface concurrency were the only question, and the sidebar has its own idle handler. The single-flight limit bounds one surface's spend, not the extension's.

Progress is throttled to one message per 1,000 output characters with a 128-character rolling marker buffer. Overlap recomputation runs on every integrity assertion and scales with card count squared — dormant in Slice 4 because nothing persists, and the prior review's F-12 already made the gram sets build once per card.

**Time-lapse at six widgets:** `useWorkshopWidgetOpening` takes six structurally identical edits per widget; `boundaries.test.ts:517` reaches a ~70-member alternation; `widgetModelsSync.test.ts` remains a source-regex count that passes for the wrong reason as soon as widget #4 binds a filtered list. The persistence side already solved this with a closed mapped registry; presentation has not, and that asymmetry is the real horizon pressure — not a generic variation framework, which both sprints correctly forbid.

---

### 12. The Change Genome: Variation & Reproduction

**Cousin: Show vs. Tell** (Sprint 05, already reserved in the catalog, `live: false`). **Varied axis: the shape of the creative pressure** — an open optional aim plus a four-step sampling distance becomes a closed five-position continuum. Everything else in the sprint declaration holds constant.

| Contact point | Class |
|---|---|
| Persistence lifecycle registry (mapped `satisfies`) | **Reuse** — the strongest seam; will not compile if incomplete |
| Streaming cancel map, config snapshot union | **Reuse** — exhaustiveness forces the entry |
| Two-hook split | **Reuse** — a repo rule, not a Creative Variations idiom |
| Recommendation registry | **Reuse** — live-without-recommendable compiles cleanly; the crisp decoupling |
| Overlap algorithm | **Reuse candidate, prefix-locked** — the computation knows nothing about aims; every export is `creativeVariations*`-named |
| Draft/workup types | **Fork by design** — but `overlap`, `carryMode`, and `selection` sub-shapes are pure mechanics and the honest candidates for the sprint's "narrow mechanical seam" |
| Response codec + prompt bundle | **Fork** — correct; a copyable pattern, not shareable code |
| `useWorkshopWidgetOpening` | **Premature-generalization risk, named** — six identical edits per widget, third repetition |
| `onClose*` option naming | **Contradiction** — three bindings already mean consume / clear / cancel |
| Persisted recommendation gate | **Contradiction, latent** — accepts a shape the type system cannot produce |
| Ask-prefill invariant | **Contradiction with a retired invariant** |
| `widgetModelsSync` count assertion | **Copy pressure / brittle** |

**Verdict.** This is a deliberately narrow special case that reproduces well where the repo already built closed registries, and reproduces badly exactly where it hasn't. Narrowness is the brief and should not be penalized.

---

### 13. Comparative Models & Borrowed Vocabulary

**Internal parallel — the persistence lifecycle registry.** `WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES` is a closed mapped `Record` that cannot compile if a widget is missing an arm. It is the same family, the same problem, solved with a compiler-enforced seam. *Question it contributes:* which of this commit's per-widget presentation edits could be a mapped registry entry instead of a hand-maintained arm, and which genuinely need bespoke code?

**Evolutionary architecture / fitness functions.** [External, standard vocabulary — no citation claimed] The distinction between a *derived* guarantee (computed from a source of truth) and an *enumerated* one (a hardcoded list) is exactly what separates a fitness function from a test. *Question:* when a guarantee is loosened, is the right move to delete the check or to re-express the real invariant with an explicit opt-out list, so "live before all arms exist" becomes a declared state rather than an absence?

**Legal precedent.** `live: true` is the distinguishing fact this commit introduces. The comment change is an *assertion* about what the predicate means; the four call sites are the *holding*. When a comment narrows and the gates do not, future maintainers inherit conflicting authority. *Question:* should the comment describe the union of what the predicate actually gates, or should the outlying gates get their own predicates?

---

### 14. Creative Counterfactuals

**Inversion — freeze inputs instead of destroying the workup.** Would require the workup to carry its own generating subject, making the persisted record self-describing. Correctly rejected (it collides with the sprint's out-of-scope "history across multiple workups"), but it names the assumption doing the work: **one draft, one truth, recomputable from live siblings** — which is what Slice 5's persisted contract will be built on.

**Deletion — remove the authoring controller.** The transport survives cleanly; correlation has no authoring vocabulary. What dies is *invalidation authority*. That is the controller's real job — not state storage. The payoff is visible in its test, which drives the whole state machine with `generate: jest.fn(() => 'cv-token-1')` and no vscode mock at all.

**Boring alternative.** One hook, uncontrolled modal, host-only identity. Cheaper today, and it loses the cancel contract, the transport-free witness, and the testability above.

---

### 15. Evidence Confidence & Unresolved Questions

**Repository-grounded.** Everything in §§1–14 traces to cited files read at this commit. The four scouts' load-bearing claims were independently re-verified by the orchestrator against source: the two-layer commit refusal, the catalog copy, the settled-result-survives-close behavior, the effect declaration order, the few-shot example's flag shape, the `generateReasons` gap, and the F-08 lineage quoted verbatim from the prior review.

**Material inference.** That the effect-ordering property is load-bearing rather than incidental. That the webview-first projection compounds at Slice 5. Both are reasoning about future edits, not observed failures.

**Coverage limitation, stated plainly.** `node_modules` is empty in this container. The author's verification receipt (206 suites, 2,201 tests) **could not be independently re-run**. This review is static analysis of source at `1f04653`. No reviewer should claim a test passes or fails from execution.

**Unknown and material.** Real-provider behavior against a blank-invariant prompt — untested by construction, and the handoff says so. Whether `Generate at random.` is meant to reach the persisted draft. Whether the `controllers/` placement was a deliberate re-reading of the target tree or a mid-implementation discovery.

---

### 16. Past → Present → Horizon Synthesis

**Past.** Slices 2 and 3 built the contracts, codec, prompt, correlation, and overlap algorithm behind `live: false`. A twenty-finding review closed clean, and its watchlist named the flip as the moment dormant costs arrive. One review earlier, a finding installed a fitness function specifically because *"no exhaustiveness check in this codebase watches that flag."*

**Present.** Slice 4 built a careful authoring flow — genuinely transport-independent, genuinely correlated, genuinely honest about provenance and about what it cannot yet do — and then flipped the flag. The engineering inside the feature slice is strong. The pressure is concentrated at the seams where `live` means something to code that this commit did not revisit.

**Horizon.** Slice 5 lands on three deliberately open seams and inherits two compounding questions: which layer owns the request projection, and whether the transient draft can satisfy a persisted contract that forbids its most common intermediate state.

---

### 17. Runway Synthesis Brief

**Invariants the implementation must preserve.** No editor mutation. No result settles onto a draft it was not generated from. Failure preserves inputs. Provenance never claims more than intake proved. The model invents no identities and flags no undeclared invariant. Clearing selections clears carry modes and accepted risks with them.

**Anchors.** `useCreativeVariationsAuthoring.ts:133/142/158/185-195/197-213/300-309`; `useCreativeVariations.ts:76-92/94-109/111-151`; `WorkshopCreativeVariationsHandler.ts:87-114/196-208`; `CreativeVariationsResponseCodec.ts:148-156`; `CreativeVariationsConfigIntegrity.ts:110-118/202-226`; `WorkshopCreativeVariationsModal.tsx:222-226/266-282/291-300`; `workshopWidgets.ts:82-92/277-280`; `WorkshopSessionStateV1Shape.ts:609-626`; `workshopWidgetAskPrefill.test.ts:21-28`; `01-creative-variations-example.md`.

**Tensions (tradeoffs, not defects).** Two hooks vs. one. Three projection sites vs. one owner. Reachability vs. dormancy. Narrow special case vs. per-widget edit cost.

**Legitimate variation points.** Feature-owned prompt, codec, types, and card interpretation. Per-widget opening arms. Threshold constants.

**Predicted pressures.** Near: Slice 5's commit gating against set-equality integrity. Middle: presentation-side registry asymmetry at widget four. Far: `live` as a four-way boolean.

#### Questions for the panel — investigate neutrally, cite raw evidence

1. What is the declared authority for "which attempt is live," given three records at three altitudes? Is the effect declaration order at lines 133/158 a contract, and if so, where is it recorded?
2. Should `handleSubjectSelection` carry the `!open` guard its sibling effects carry, and should it decline while an attempt is in flight?
3. `updateAuthoringInput` cancels before it knows whether the update changes anything. Is a value-identical edit meant to abort a paid run, and what should the writer see?
4. With both invariants blank as the new default, and the few-shot example demonstrating a `must-survive` advisory flag, is whole-workup rejection the intended granularity?
5. Should the prompt state that an empty string means *not supplied*, and that such a flag voids the whole response?
6. The modal computes `unavailableSelectedSources` but does not add it to `generateReasons`. Should a dead reference block Generate rather than guarantee a failed paid call?
7. Which layer owns `creativeVariationsGenerationDraft`, and what does the wire promise about `intent.aim` once Slice 5 persists it?
8. Does the persisted-recommendation gate still mean what its comment says, now that `live` flips for in-development testing rather than at ship?
9. F-08 asked for a check that fires on the `live` flip. This is the flip. Is the hardcoded enumeration the intended replacement?
10. Four documents describe `live` as gating commit and recommendation. Should they move with the comment?
11. Should the transport report dropped progress/results the way both siblings do?
12. Is the webpack watch change bounded, portable, and appropriately scoped to this commit?

**Do not overread.** `live: true` is approved — do not report it as a scope violation, and do not recommend a flag or test-only bypass. The two-hook split is forced by an existing architecture test, not a stylistic choice. The `presentation → application` imports follow seven existing precedents. Commit unavailability is deliberate and doubly enforced. Absent Slice 5/6 behavior is not a gap. Do not relitigate the optionality decision itself — only whether the artifacts and code now agree about it.
---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — the engineering inside the feature slice is strong and the closed boundaries hold, but making the widget reachable moved a previously-dead rejection arm onto the default path and left the intake seam without the guards every sibling input has.

- 🟠 **F-01 · Blank invariants are the default, and one model flag voids the entire paid workup** `🧭 Corroborated Runway` — five reviewers converged. The shipped few-shot demonstrates the exact flag shape that is now illegal by default, the prompt never defines `""` as *not supplied*, and the failure message tells the writer to retry a call that will fail identically. Fix the prompt and branch the retry copy before merge.
- 🟠 **F-02 · `handleSubjectSelection` is the only intake path without the guards its six siblings have** `🧭 Corroborated Runway` — re-clicking **Use editor selection** with byte-identical content destroys every take, carry mode, and accepted risk, with no warning and no recovery but another paid call. The same missing guard lets a late reply abort an in-flight run. Two guard clauses at one location.
- 🟠 **F-03 · A settled workup is destroyed with no statement that it happened or why** — one keystroke in the aim box unmounts the cards, the overlap matrix, and the warning with no alert, no `role="status"`, and no `aria-live`. The only invalidation copy is gated on the workup being present, so it disappears in the same frame as the thing it described. The rule is correct; the silence is the defect.

Nothing here is a crash, a corruption path, or a broken persistence contract. All three High findings are writer-experience and cost issues with small, well-specified repairs.

## Report Card

| Domain | Reviewer | Grade | Rationale |
| --- | --- | --- | --- |
| Architecture | Marcus 🏛️ | **B** | Two-hook split is forced by an existing architecture test, not taste; ownership seams for the projection, the copy path, and teardown need naming. |
| Critical Correctness | Blake 🔥 | **B** | No Blocking. Correlation machinery is genuinely sound — five guard conditions, two-identity latch, clean supersession. The one High is Medium-confidence and provider-dependent. |
| Edge Cases | Sam 🔍 | **B−** | The happy path and the threshold cases hold; the intake path is the weak seam, and its idempotency gap costs the writer real work. |
| Code Quality | Parker 📖 | **B** | Working, honest code that cannot tell its own story locally — an identity idiom with no name, and two type families with nothing holding them together. |
| Tests | Cal 🧪 | **C+** | The weakest lane. A guard on the new default path that can be deleted without failing anything, an integration fixture asserting a response the codec forbids, and no test that ever transitions `open`. |
| Codebase Fit | Stan 🗂️ | **B−** | A defensible placement recorded nowhere, four stale statements about what `live` gates, and a derived fitness function retired at the exact event it was built for. |
| Performance | Tim ⚡ | **B+** | Spend is bounded by construction — single-flight, supersede-not-stack, webview-minted token. The dev-loop polling bills two platforms for a third's problem. |
| Security | Patricia 🛡️ | **B+** | Low surface, handled with care: model invents no ids, sources resolve host-side, validation echoes paths but never values. One real path-egress gap into the outbound prompt. |
| Observability | Oliver 🌙 | **C+** | Host logging carries both identities and never carries prose. But the writer is told to retry an unretryable failure, and work vanishes without a word. |
| Domain Logic | Bria 🎯 | **B−** | The behavior matches the approved decisions; the artifacts describing them no longer agree with each other or with the card a writer reads before launching. |

## Findings

### 🟠 High

**F-01 · Blank invariants are the default, and one model flag voids the entire paid workup** `🧭 Corroborated Runway`
Raised by: Blake, Sam, Bria, Tim, Oliver · 0 independent · 5 runway-prompted · Confidence: Medium
`CreativeVariationsResponseCodec.ts:151-153`
This commit dropped `allowBlank=false` on `mustSurvive` (`CreativeVariationsConfigCodec.ts:67-71`) and made `{mustSurvive:'', mustNotChange:''}` the fresh-draft default (`useCreativeVariationsAuthoring.ts:90`). At `8bbb5ae` the `must-survive` rejection arm was structurally dead; it is now the common path. Wire sends fields present-and-empty (pinned: `expect(userMessage).toContain('"mustSurvive": ""')`). Prompt says only "Flag only an invariant field the writer actually supplied" — never defines `""` as not-supplied, never says one flag voids the response. **The shipped few-shot `01-creative-variations-example.md:6` demonstrates card 2 carrying `{"invariantField":"must-survive","kind":"advisory-risk"}` — the exact now-illegal shape.** One flag on one card unwinds `arrayOf` → `decodeCard` → `rejectResponse`; all 3–5 takes discarded, call billed. Prompt unchanged by this commit (`git diff --stat -- packages/core/resources/` empty). **Second half (Oliver):** `CreativeVariationsService.ts:208` closes with `nextStep = 'Try Generate again.'` — but this rejection class is a property of the writer's configuration, not transient. The retry sends an identical request against an identical prompt and identical few-shot. Nothing tells the writer the exit is "type a constraint, or expect no flags."
**Rec:** one prompt line after `00-creative-variations.md:26` (empty string = not supplied; flagging it voids the response) + note the example's request supplied a `must survive` field. Branch `nextStep` for this rejection class, using the pattern already at `CreativeVariationsService.ts:107-113`. Then record the granularity decision the code made on product's behalf.

**F-02 · `handleSubjectSelection` is the only intake path without the guards its siblings have** `🧭 Corroborated Runway`
Raised by: Sam, Blake · 0 independent · 2 runway-prompted · Confidence: High
`useCreativeVariationsAuthoring.ts:209-212`
Six sibling inputs guard on equality (`changeSubjectText:217-219`, `changeSurroundingContext:233`, `changeMustSurvive:269`, `changeMustNotChange:275`, `changeAim:281`, `changeDistance:287`, `changeRequestedCount:295`). `handleSubjectSelection` always builds a fresh object, so `updateAuthoringInput`'s identity test at `:191-193` always takes the destructive arm.
*Manifestation A (Sam, High):* writer pulls selection → generates → edits one word (provenance demotes to `pasted`, header flips) → wants the excerpt label back → re-clicks **Use editor selection**. Button is live (`interactionLocked` false once settled; `commitPending` hardwired `false`). Host returns byte-identical content. Every take, carry mode, and accepted risk cleared. Nothing persists; recovery is another paid generation. The sheet warns about regeneration (`:604-608`) but not this.
*Manifestation B (Blake, Standard):* `UIHandler.handleSelectionRequest` awaits `readClipboard()` at `:344` between two postMessage hops. Click Use-selection → press Generate before the host answers → the reply lands mid-flight and aborts the run. The button itself is `disabled={interactionLocked}` at modal `:393-394` — the button is locked, the reply it already asked for is not.
Tests: `handleSubjectSelection` is called only twice, both from a fresh idle hook (test `:35`, `:66`).
**Rec:** both guards at one location, after the target check at `:198-200` — return `current` when content and derived provenance both equal `current.subject`, and decline while `activeTokenRef.current` is set.

**F-03 · A settled workup is destroyed with no statement that it happened or why**
Raised by: Oliver · 1 runway-prompted · Confidence: High
`useCreativeVariationsAuthoring.ts:189-194`
One character into the aim box, a count bump, a distance nudge, or a model change nulls workup and selections. The `{workup && …}` region unmounts (`WorkshopCreativeVariationsModal.tsx:636`) — cards, overlap matrix, high-overlap warning, selection count — replaced by the scaffold caption at `:629-634`. No alert, no `role="status"`, no `aria-live`. The only invalidation copy (`:604-609`) is gated on `workup` being truthy, so it unmounts in the same frame as the thing it described, and it names the Regenerate button, not a keystroke. Unrecoverable: `persistedState: {}`. A writer returning to an empty sheet cannot distinguish "cleared by design" from "lost my work"; a screen-reader user gets no announcement. The invalidation rule itself is correct — `assertOverlapIntegrity` recomputes from `draft.subject.text`, so one-live-truth is load-bearing. The defect is the silence.
Tests certify the silence: the mounted test asserts `expect(screen.queryByText('3 returned · none ranked')).toBeNull()` and asserts nothing takes its place.
**Rec:** record that a *settled* workup was cleared (the function already distinguishes `next === current`), expose it on returned state, render in the vacated slot with `role="status"` naming the trigger. Cheaper floor: move `:604-609` out from behind the `workup` gate and name all triggers.

### 🟡 Standard

**F-04 · The blank-invariant guard is untested, and the mounted integration test settles a workup the codec would have rejected** — Cal · runway-prompted · High
`WorkshopApp.test.tsx:260` (`mustSurvive: ''`) … `:280` (`workup: generatedDraft.workup!`)
**Deleting `CreativeVariationsResponseCodec.ts:148-153` entirely passes the whole suite.** The codec test (unchanged) holds one context with both invariants nonblank; `CreativeVariationsService.test.ts` gives every card `invariantFlags: []`, so the new blank test never reaches a flag. The integration test sends `mustSurvive: ''` then settles `generatedDraft.workup`, whose card 2 carries `must-survive` and card 3 `must-not-change` (`creativeVariationsFixtures.ts:50, 70`) — legal only against `baseDraft`'s nonblank invariants. For the request that test just sent, the host would have returned `ok:false`. The one mounted test offered in place of an F5 screenshot proves a happy path the codec forbids for those inputs.
**Rec:** one `it.each` row (blank invariants + `must-survive` advisory flag → `/writer-declared nonblank invariant field/`); and either type an invariant before Generate in the integration test or settle a flag-free workup.

**F-05 · The one derived check built to fire on a `live` flip was replaced by a hardcoded list, at the flip** `🧭 Corroborated Runway` — Stan, Cal · 2 runway-prompted · High
`workshopWidgetAskPrefill.test.ts:21-24`
The deleted assertion derived its subjects from the catalog. Provenance is exact: PR-99 F-08 (`pr-99-…-review-v2.md:571`) — *"Sprint 03's actual event is not adding an id — it is flipping `live: false → true`, and no exhaustiveness check in this codebase watches that flag"* — recommending (`:575`) *"assert in the widget-catalog test that every `live: true` id has both an icon and a prefill clause. That is the only check that fires on the event that actually happens."* Commit `492ac1d` added it. `git log -S"live: true"` shows `1f04653` is the **first `live` flip since**, i.e. the first time it would have fired.
*Cal's half:* the flip made `WorkshopWidgetsModal.tsx:84` live input for the first time — before, `live` was exactly the two prefill ids, so `selectedIsLive && !selectedSupportsAgentPreparation` was structurally dead. It is now the only thing between a writer and `buildWorkshopWidgetAskPrefill` throwing inside the click handler at `WorkshopApp.tsx:650`, in a webview, with no catch. **Deleting `&& canBuildWorkshopWidgetAskPrefill(selectedId)` from line 42 passes 206 suites and ships an unhandled throw on a live button.** `WorkshopWidgetsModal.test.tsx` isn't in this diff and selects only the two older widgets.
No user-facing break today — the gate works and the hint copy is honest.
**Rec:** keep the derivation, declare the exception — iterate live widgets and skip an explicit `WIDGETS_WITHOUT_HOST_PREFILL = ['creative-variations']`, so Slice 6 removes a name instead of remembering to. Plus one `WorkshopWidgetsModal.test.tsx` case asserting Open enabled / Ask-agent disabled / hint rendered.

**F-06 · The registry still describes the pre-flip world, to writers and to engineers** `🧭 Corroborated Runway` — Bria, Stan · 2 runway-prompted · High
`workshopWidgets.ts:88-91` and `:39`
*Writer-facing (Bria):* `workshopWidgetIcons.ts:41-44` maps the descriptor onto the browser card; with `live: true` the 'Coming soon' badge disappears and the row is hoisted into *"Ready now — Built and playable today"* (`:56-57`). `WorkshopSheetBrowser.tsx:169-170` renders `selectionNote` beside **Open widget** — so the writer's last words before launching are `ONE_SHOT_LIFECYCLE` = *"play first · commit adds one turn."* Commit is unavailable. The blurb still promises *"under invariants you declare"*, three lines above a textarea labelled `optional`. ADR 2026-07-22:355-356: *"Unshipped widgets stay visible and disabled — the menu is a roadmap, not a lie."* The ADR assumed a binary; this commit created a third state and left the copy describing the old one. Mitigated to Standard by the modal's footer stating the truth before generation.
*Engineer-facing (Stan):* the commit narrowed `isLiveWorkshopWidgetId`'s comment at `:277` and left four statements of the old meaning — `workshopWidgets.ts:39` (the `live` field's own doc, what a flag-flipper reads first), `workshopWidgets.ts:11-12`, `messages/workshop/widgets.ts:24`, ADR 2026-07-22:457-458. Two are in the file this commit edited. `WorkshopSessionStateV1Shape.ts:611-614` calls the predicate for a fourth question none of the four sentences names.
Behavior is safe: commit refused by the closed registry at `WorkshopOneShotWidgetCommitOperations.ts:57-62`; recommendation refused by the narrow `RecommendationWidgetId` union.
**Rec:** give the row its own `lifecycleNote`; soften the blurb to *"under any invariants you declare"*; fix `:39`, `:11-12`, and `messages/workshop/widgets.ts:24` in this commit. Amend or note supersession of the ADR sentence.

**F-07 · Three appliers of the request projection, no declared owner, and the webview's is the one that reaches the wire** — Marcus · runway-prompted · High
`useCreativeVariations.ts:78` → posted at `:85`
Applied at webview transport, host handler (`:117`), and service (`:138`). Idempotent, so no happy-path defect. But this commit made the handler build the *entire* request from its own re-projection (`:118-125`, changed from `message.payload`), so no host component ever observes the authored aim. **Reachable today:** the modal placeholder at `:530` reads *"Generate at random when blank — or name a specific creative pressure."* A writer who types what the placeholder describes produces a payload byte-identical to leaving it blank. Meanwhile the codec was loosened this commit so the persisted shape *can* represent a blank aim — a state the wire can no longer produce. Searched sprint plan, handoff, and runway for a declared owner — not found.
**Rec:** decide the owner in this commit even if the code moves next. Cheapest: drop the projection at `:78`, post the authored draft, leave the handler as the single projection point and the service as boundary guard. Two tests move with it.

**F-08 · Generate ignores a dead source reference the sheet has already diagnosed** — Sam · runway-prompted · High
`WorkshopCreativeVariationsModal.tsx:298-300`
The sheet renders *"Remove this reference before generating again."* at `:477` — copy that presumes a block — while `generateReasons` (`:222-226`) contains only the blank-passage entry. **Convention deviation, not opinion:** Gesture Playground computes the identical value under the identical name and refuses in three places (`WorkshopGesturePlaygroundModal.tsx:269, 328, 690`). `workshop.excerpt` is re-pushed on every session snapshot (`useWorkshopRoom.ts:607`), so an `active-excerpt` reference can die under an open sheet. Pressing Generate clears workup and selections at `useCreativeVariationsAuthoring.ts:313` *first*, then the host throws.
**Cost corrected:** four reviewers independently confirmed `resolveSourceMaterials` is evaluated inside the request literal at `WorkshopCreativeVariationsHandler.ts:127-129`, before `await this.service.generate` at `:133`. No engine acquired, no tokens spent. The casualty is the comparison work, not the invoice.
**Rec:** add `unavailableSelectedSources.length > 0` to `generateReasons` with the copy the row already uses. One line.

**F-09 · Editor-derived path rides into the outbound provider prompt with no display-safety guard** — Patricia · runway-prompted · High
`CreativeVariationsService.ts:186-187`
`sourceUri` narrowing is real and enforced (`CreativeVariationsConfigCodec.ts:111-117` would reject it as an unknown field). What survives is `relativePath`, and it does not stop at display: draft → `creativeVariationsGenerationDraft` (`subject: input.subject`) → wire → handler `:122` → `buildUserMessage` serializes the whole subject object at `:187` and stringifies at `:199`. The prompt never mentions provenance and the few-shot has no provenance field — inert payload buying the generation nothing. **The value is not guaranteed relative:** `asRelativePath(uri, false)` returns the absolute path for a document outside every workspace folder. The repo already knows — `WorkshopContextIntakeService.ts:196-202` guards exactly that (`if (relativePath === filePath || isAbsolutePath(relativePath))`), applied at three intake sites, and `WorkshopPromptBuilder.ts:180-182` writes the rule: *"a raw absolute path or `file:` URI must never reach model-visible text."* The editor-selection lane has none. Reachable by opening a scratch file outside the workspace, selecting, Generate → provider receives OS username and directory layout.
Inherited class (`useWorkshopExcerptVerify.ts:78` does the same), and not covert (the modal renders the path). This commit's business because it builds the intake, ships it live, and adds a fresh egress.
Tests pin the wrong half: `expect(JSON.stringify(draft.subject)).not.toContain('sourceUri')` — the URI, not the path.
**Rec:** narrow at the prompt boundary only — `subject: { text, provenance: { kind } }` in `buildUserMessage`, leaving the draft intact for Slice 5.

**F-10 · `updateAuthoringInput` performs its side effect before its decision, and signals that decision through object identity** — Tim, Parker · 1 independent · 1 runway-prompted · Medium
`useCreativeVariationsAuthoring.ts:187-189`, `:306-308`
The cancel fires before the change test, so an update that then declines to change anything has already aborted a paid run. The model effect at `:300-309` states the intent plainly — `current.workup || current.selections.length > 0 ? { ...current } : current` means "only invalidate when there is something to invalidate" — yet during generation `generateWorkup:313` has already nulled workup and selections, so the ternary always takes the `current` branch while the run is aborted anyway. Live trigger is host-owned: `MessageHandler.ts:137` lists `proseMinion.widgetModel` in `MODEL_KEYS` and `:622-628` broadcasts `MODEL_DATA` on an external Settings change. Writer sees the progress panel vanish with no message; streamed tokens are billed.
*Parker's half:* the signal is invisible at the call site. Twelve call sites return `current` to mean skip; exactly one returns `{ ...current }` to mean clear. A spread that copies every field and alters none reads as a no-op; its entire meaning is the object address. No comment, helper, or test names the convention.
**Rec:** an `invalidateSettledWork()` sibling that does the cancel and the clear directly — the effect then reads `if (current.workup || current.selections.length > 0) invalidateSettledWork();`. Removes the spread, makes the unconditional cancel visible where it happens, leaves the twelve value-edit call sites unchanged.

**F-11 · The composition root learned the card model to implement one copy button** — Marcus · **Independent** · High
`WorkshopApp.tsx:762-763`
Sibling `copyGestureDictionary` (`:752-759`) is a pure transport effect; the modal hands it content (`WorkshopGesturePlaygroundModal.tsx:774`). Creative inverts: `CreativeVariationCard.tsx:190` has `card` in scope and passes only `position`; `WorkshopApp` re-finds it and reads `prose`. Three feature facts now live in the composition root, against ADR 2026-08-03 §5 (*"shell composition, route composition, and layout—not the controller for every Workshop modal and state transition"*). Contrast inside this very commit: the modal's private `sourceReferenceKey` was deleted for the shared derivation — duplicated knowledge correctly removed; the copy path puts it back one layer higher, and `boundaries.test.ts:487` widened to admit it. Slice 5's commit projection needs the same resolution, and carry mode will make "which text does Copy send" a second decision in a file that owns neither.
**Rec:** `onCopyVariation: (prose: string) => void` with the card passing `card.prose`; or move the resolution into the controller that owns the draft.

**F-12 · The close contract is a conditional cancel where both siblings use an unconditional clear** — Marcus · runway-prompted · High
`useCreativeVariations.ts:95-97`
Gesture binds `consumeWidgetActionResult` (`setWidgetActionResult(null)`); Lexical binds `clearTransientResults` (four unconditional clears). Creative binds `cancelGeneration`, which early-returns whenever `activeAttemptRef` is undefined — and that ref is cleared by `handleGenerationResult` at `:146` on every settled result. So the one case where a payload is actually sitting in state is exactly the case where close does nothing, and the transport is mounted for the panel's lifetime (`WorkshopApp.tsx:221`), not the sheet's.
**Mechanism corrected by the panel:** Marcus attributed the surviving invariant to effect declaration order (133 before 158). Blake, Cal, and Sam each independently traced it and found `activeTokenRef` is cleared at `:163` on every settle and `:180` on every cancel, so at the false→true transition it is already `undefined` on all traced paths. **The ordering is not load-bearing.** This is a consistency and robustness finding, not a correctness one.
**Rec:** unconditional teardown in the siblings' shape — clear progress, result, and the ref; post the cancel only when an attempt is active.

**F-13 · Two names for one concept, twice over, with nothing holding them together** — Parker · runway-prompted · High
`useCreativeVariationsAuthoring.ts:21-24` vs `WorkshopCreativeVariationsModal.tsx:52-55`
`GenerationPhase` is byte-identical across the two files; `AvailableSource` (`:32-36` vs `:70-74`) has the same three fields in the same order. They differ only by a `Workshop` prefix. No import, no shared module, no comment, no test connects them. A field added to the modal's `AvailableSource` is invisible to the controller that produces every instance of it. `CommitBlocker`'s 4-of-7 subset is defensible and should stay — it states what Slice 4 can actually produce.
Precedent for the fix: `useWorkshopStandingDirectives.ts:4` already imports `WorkshopToastState` from a component; the `controllers/` restriction is transport-vocabulary only.
**Rec:** delete the two clones from the controller and import the modal's originals; keep `CommitBlocker` forked with a one-line note.

**F-14 · The fresh-sheet contract has no witness: no test ever transitions `open`** — Cal · runway-prompted · High
`useCreativeVariationsAuthoring.test.ts:16`
The hook is mounted unconditionally at `WorkshopApp.tsx:254`; the *modal* unmounts, not the hook. Draft, settled workup, and `activeTokenRef` all survive a close. The only thing making a reopened sheet fresh is the effect at `:133-140`. All eight cases pass `open: true` at mount and never change it; the modal test is `open: true` only; the integration test opens once and never closes. The reset effect and all three `!open` guards (`:144`, `:160`, `:303`) are unexercised — break any and the suite is silent while a writer sees the previous passage, invariants, aim, and workup in a sheet the type system calls `{ kind: 'new' }`.
**Rec:** generate, settle, rerender `open:false`, rerender `open:true`, assert the draft equals `createCreativeVariationsAuthoringDraft()`. Two rerenders, no new mocks.

**F-15 · The authoring controller sits off the recorded target tree with no recorded reason** — Stan · runway-prompted · High
`docs/architecture/2026-08-10-creative-variations-implementation-runway.md:140-142`
The runway's tree places both hooks under `widgets/creativeVariations/`. The implementation put the authoring hook under `controllers/creativeVariations/`. This commit amended that same document in four places and left the tree untouched. **The deviation is defensible and that is the point:** `controllers/` puts the file inside `WORKSHOP_PRESENTATION_CONTROLLERS` (`boundaries.test.ts:726-729`), so `:1240-1246` enforces transport-freedom. Under `widgets/` it would earn no such guarantee. One sentence long.
ADR 2026-08-03 §7 requires the reason. The repo answered this exact class one review ago: F-19 flagged `CreativeVariationsConfigIntegrity.ts` as off-tree, and `62f6623` closed it with a paragraph in the Slice 3 handoff. Searched the Slice 4 handoff, sprint plan, and runway for the equivalent — not found.
*Marcus adds:* `Claude.md:149` defines `controllers/` as "Transient modal/surface state machines" with no genericity requirement, so the placement is correct and the stale artifact is the drawing, not the code.
**Rec:** one sentence in the Slice 4 handoff, in the shape F-19 established. Then fix the runway tree or mark it superseded.

**F-16 · Dev-watch polling taxes Linux and Windows to fix a macOS descriptor limit** — Tim · runway-prompted · High
`apps/vscode-extension/webpack.config.js:16-18`
Scoping verified: `.vscode/launch.json` → `${defaultBuildTask}` → npm `watch` → `webpack --mode development --watch`, so the `else if` at `:132-135` is the branch F5 takes, and `watchOptions` is inert outside `--watch`. Watched first-party set: 347 non-test `.ts/.tsx` under `packages/core/src`, 12 under `apps/vscode-extension/src`, 10 CSS, 1 SVG, ~95 directories. `package-lock.json` declares 988 installed package paths. **`ignored: /node_modules/` alone is the remedy that matches the stated cause** (macOS kqueue, one descriptor per directory) and costs nothing anywhere. `poll: 500` is the half that bills everyone: it replaces sub-millisecond inotify/`ReadDirectoryChangesW` with a 0–500 ms uniform delay (mean 250 ms), and `aggregateTimeout: 200` is 10× webpack 5's documented 20 ms default — roughly **+430 ms on every save→rebuild cycle**, permanently, on platforms with no descriptor problem. CPU is negligible (~95 dirs × 2 compilers, well under 1% of a core).
**Rec:** keep `ignored` unconditional; gate `poll` and the raised `aggregateTimeout` behind `process.platform === 'darwin'` or a `PM_WATCH_POLL` override. Follow-up, not merge-blocking.

**F-17 · The sprint's named Design source still declares the rule this commit retired** — Bria · runway-prompted · High
`.todo/…/concepts/creative-variations-playground.md:27, :31`
The sprint names this file as its **Design source** (`sprints/03-creative-variations.md:7`). This commit amended the sprint's Locked decisions and the runway's D1 row; `git diff 8bbb5aeb..1f04653a -- .todo/…/concepts/` is empty. The concept still declares a nonblank `must survive` field and a required custom aim. The sprint also disagrees with itself: its Goal paragraph (`:12-13`) still reads *"declare what must survive and what must not change"* twenty lines above the decision making both optional. Read top-down — how the next implementer reads it — the sprint describes declaring constraints as part of the flow, then declares them optional, then Slice 4 ships them blank by default. Cost is one slice away: Slice 6 adds persona prefill, the arm that decides what a persona may put in these fields.
**Rec:** amend the two concept bullets or record supersession; fix the Goal paragraph's verb. Follow-up acceptable if it lands before Slice 6 opens.

### 🔵 Nit

**F-18 · The new dispatcher borrows its sibling's word for the opposite contract** — Parker · runway-prompted · High
`dispatchWorkshopSelectionData.ts:6-7`
Header calls it *"Closed fan-out"*; the switch at `:14-23` delivers to exactly one consumer. The sibling one directory over uses the same word for genuine broadcast (`dispatchWorkshopWidgetActionResult.ts:11-12`). The two consumers of the same wire get different slices with no stated reason — one envelope, one payload. Both still self-filter (`useWorkshopExcerptVerify.ts:70`, `useCreativeVariationsAuthoring.ts:198`): mandatory under broadcast, unreachable under a switch. `boundaries.test.ts` registers it as "dispatch", quietly confirming the header's word is wrong.
**Rec:** `fan-out` → `routing` plus the authoritative-switch sentence; unify consumer signatures on `(message: SelectionDataMessage)`; drop or annotate the now-dead guards.

### 💚 Praise

**P-1 · A dead source reference fails before the provider is touched** — Blake
`WorkshopCreativeVariationsHandler.ts:127-133`. `resolveSourceMaterials` is evaluated while constructing the request literal, so its throw lands before `service.generate`. No engine, no tokens. If it is ever moved into the service or made lazy, the guarantee disappears silently.

**P-2 · The optionality loosening shipped with its matching model-authority guard, at both layers** — Patricia
`CreativeVariationsConfigIntegrity.ts:110-113`. Making `mustSurvive` optional is exactly the shape of change that quietly re-opens a closed door — a `must-survive` flag against a field the writer never wrote is the model fabricating a constraint and reporting on it in the writer's own risk UI. The guard was widened in the same commit, at decode and at integrity, with the negative case pinned. The prompt carried the rule in words; the code does not trust the words. **The pattern to copy: when a required field becomes optional, find every check that silently depended on it being required, and widen them in the same commit.**

**P-3 · Structural unavailability outranks situational, in the control's own accessible description** — Oliver
`WorkshopCreativeVariationsModal.tsx:838-846`. The ternary is the part worth copying: when the build cannot commit at all, that reason wins over whatever situational blocker is first in the list. A writer with no selection would otherwise read *"select at least one take"* — true, actionable, and completely misleading about why the button still will not work. `commitDisabled` refuses on three independent grounds, so no future wiring mistake can make an unimplemented route clickable.

## Focus-area verdicts against the review brief

| # | Question from the brief | Verdict |
| --- | --- | --- |
| 1 | Transport correlation prevents stale progress/results settling newer attempts | **Holds.** Five guard conditions in `useCreativeVariations.ts:111-151`, including `payload.ok && payload.workup.workupId !== payload.workupId`. Strictly more correlated than either sibling. |
| 2 | Cancel, close, supersession, and input changes abort the correct attempt | **Mostly holds.** Supersession and writer-cancel are exact and token-matched. Gaps: F-02 (late intake aborts the wrong thing), F-12 (close binding diverges from siblings). |
| 3 | All authoring-input changes atomically clear workup identity, cards, selections, carry modes, accepted risks | **Holds, structurally** — carry modes and accepted risks nest inside `selections`, so clearing selections clears all three. F-03 is the silence around it, not a gap in it. |
| 4 | Failures preserve the writer's inputs | **Holds.** Verified: only `generation` moves to `failed`; the draft is untouched. Pinned by test. |
| 5 | Source provenance stays truthful and changes to pasted after editing | **Holds.** `sourceUri` dropped, both fields required for `excerpt`, any keystroke demotes to `pasted`. F-09 is the egress caveat, not a provenance error. |
| 6 | Controller stays transport-independent and declares `{}` persistence | **Holds, and is enforced** — `boundaries.test.ts:1240-1247` scans the whole `controllers/` tree for transport vocabulary. |
| 7 | `CreativeVariationsDerivations` is single owner of generation projection, flag ids, source-reference keys | **Partial.** Single owner for flag ids and reference keys — the modal's private duplicate was correctly deleted this commit. The *projection* has three appliers and no declared owner (F-07). |
| 8 | Passage-only generation enforced consistently in UI, transport, handler, service, codec, prompt, response integrity | **Holds in six of seven.** The prompt is the gap (F-01): it never defines an empty invariant string as *not supplied*, and its few-shot demonstrates the now-illegal shape. |
| 9 | Blank invariant fields can never receive model flags | **Holds, at two independent layers** (`CreativeVariationsResponseCodec.ts:148-153`, `CreativeVariationsConfigIntegrity.ts:110-118`) — see P-2. The test gap is F-04. |
| 10 | Offline Workshop hydration and unavailable-AI transient-error behavior remain intact | **Holds.** No file under `orchestration/` is touched. `getEngine('widget')` throws outside the decode `try`, so unavailability never pollutes the recovery store. Matches ADR 2026-08-12's disposable-engine carve-out. |
| 11 | Accessibility, model selector, mounted Workshop integration, clipboard handling are honest | **Mostly holds.** Accessibility reuses the shared `WorkshopModalShell`/`useOverlayDismiss` pair correctly; P-3 is exemplary. Caveats: F-11 (clipboard ownership), F-04 (the integration fixture). |
| 12 | The webpack watch change is bounded, portable, and appropriate for F5 | **Partial.** Correctly gated to `--mode development`, and `ignored: /node_modules/` is the remedy matching the stated cause. `poll: 500` + `aggregateTimeout: 200` adds ~430 ms per save on platforms with no descriptor problem (F-16). |
| 13 | Slice 5/6 behavior accidentally leaked in | **No active leak.** Commit is refused twice independently; recommendation is refused by a narrow TS union the catalog flag cannot widen. The residue is latent: a durable codec gate that now accepts a shape nothing can mint (F-06), and a retired fitness function (F-05). |

## What the Panel Changed About the Runway

**Affirmed.** The thesis held from every seat: the flag flip is the load-bearing change, and the pressure lands where `live` means something to code this commit did not revisit. The two-hook split is forced by `boundaries.test.ts:1240-1247`, not stylistic. The closed boundaries — no editor mutation, no commit, no recommendation — are real and doubly enforced. `WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES` is the compiler-enforced counter-example the presentation side lacks.

**Refined.** Bria sharpened the central claim: the load-bearing change is not the flip alone but *the flip intersected with the optionality loosening*. The runway called the two safety mechanisms "inert" under blank invariants; the panel showed the same default also makes whole-workup rejection **more** likely, because the shipped few-shot demonstrates the flag that is now forbidden.

**Rejected — four runway claims did not survive tracing.**

1. **Effect declaration order is not load-bearing.** The runway claimed a stale-result guard rested on the reset effect (line 133) preceding the result effect (line 158). Blake, Cal, and Sam each traced it independently and found `activeTokenRef` is already cleared at `:163` on every settle and `:180` on every cancel, so both orderings are safe. The location still holds a real finding (F-12) — the mechanism was wrong, not the site.
2. **A dead source reference costs no tokens.** The runway said it "guarantees a failed paid call." Four reviewers found `resolveSourceMaterials` is evaluated inside the request literal, before `service.generate`. Blake converted the ordering into Praise (P-1). The defect is real (F-08); the casualty is comparison work, not the invoice.
3. **The `controllers/` placement is correct.** The runway framed the directory as reserved for family-generic owners and the new file as an intruding first feature-scoped resident. Marcus found `Claude.md:149` defines it as "Transient modal/surface state machines" with no genericity requirement. The stale artifact is the architecture drawing (F-15), not the code.
4. **Two handed anchors were established convention.** Parker rejected `CreativeVariationsAuthoringPersistence` as a smell — `useWorkshopWidgetOpening.ts:66-68` carries a byte-identical empty interface with the same comment — and defended *"not available in this build yet"* as accurate copy. Bria rejected the hard-conflict-strictness concern: `CreativeVariationCard.tsx:83` disables the control with an `aria-describedby` explaining *"The take stays visible for comparison"*, which honors the concept exactly. Stan rejected the correlation-diagnostics comparison as proximity, not siblinghood — the sibling for a *progress* wire is `useGesturePlayground.ts:105-110`, which correlates nothing at all.

**Still unknown.** Real-provider behavior against a blank-invariant prompt — the one fact that would move F-01 between Medium and High confidence. Neither the panel nor the author could probe it; the handoff says so plainly.

---

# Part III — Lessons & Horizon

## Sensei's Lessons

### Lesson — A check that fires on the event it was built for is not in the way

**Illuminated by:** F-05 — Stan, Cal

A guarantee can be *derived* from a source of truth or *enumerated* as a list. The derived form fails on the day the world changes, which is exactly the day it is most useful and most inconvenient — and replacing it with a list converts "not yet true" from a declared state into an absence, which will never fire again. When the exception is genuine, the durable move is to keep the derivation and name the exception inside it, so the next slice deletes a name rather than remembering an obligation.

**Carry forward:** When a check fails because of your change, read its provenance before you read its assertion — `git log -S` on the assertion, or the review that installed it. A check written for this exact event has earned the right to be satisfied or amended rather than removed.

### Lesson — Loosening a constraint promotes whatever that constraint had been killing

**Illuminated by:** F-01 — Blake, Sam, Bria, Tim, Oliver; F-04 — Cal; P-2 — Patricia

Making a required field optional does two things, and only the first is obvious: it admits new inputs, and it changes which branch is *typical*. Code that was structurally unreachable while the field was required — a rejection arm, an error path, a guard nobody could exercise — becomes the main road, and it arrives untested precisely because it was untestable before. Frozen artifacts that demonstrated the old required shape (fixtures, examples, few-shot prompts) do not merely go stale; they become live inputs demonstrating a shape the code now refuses.

**Carry forward:** When a field's optionality changes, run the question in both directions: which checks silently depended on it being required (P-2's pattern, done well here), and which branches were dead only because it was?

### Lesson — A guarantee that no name carries gets re-derived by every reader, and not always the same way

**Illuminated by:** F-10 — Tim, Parker; F-12 — Marcus, corrected by Blake, Cal, Sam; F-14 — Cal; F-15 — Stan; P-1 — Blake

Several real invariants here rest on things no identifier mentions: an object's address distinguishing "skip" from "clear," a throw's position inside a request literal keeping a call unbilled, a directory choice buying an enforced transport-freedom scan, one effect that is the only thing making a reopened sheet fresh. Each of them holds. The cost lands on every later reader, who must re-derive it — and the sharpest evidence for that cost is inside this review, where a careful runway concluded a stale-result guard rested on effect declaration order, and three reviewers had to trace it independently to establish that it did not.

**Carry forward:** For each invariant you lean on, ask what would have to be *renamed* for it to break. If the honest answer is "nothing — someone would only have to move a line," give it a name: a function, a comment stating why, or a test that fails when the position changes.

### Lesson — The defect and its price are two claims, and each needs its own trace

**Illuminated by:** F-08 — Sam, cost corrected by four reviewers and converted to P-1 by Blake; F-12 — Marcus, corrected by Blake, Cal, Sam; F-15 — Marcus

A flagged site can be wrong in three independent ways, and this panel found all three: a mechanism misattributed while the location still held a real finding; a defect confirmed while its stated cost — a billed provider call — evaporated once the evaluation order was followed; and a placement called a deviation until the written convention showed the *drawing* was the stale artifact. Severity is an evidence claim, not a volume knob. "This throws" and "this costs money" travel separately and can be true and false in either combination.

**Carry forward:** Before attaching a cost to a defect, name the line where the cost is actually incurred and show the failing path reaching it. And when a mechanism is falsified, do not clear the location — ask what *is* true there.

### Lesson — A comment narrows an assertion; the call sites hold the meaning

**Illuminated by:** F-06 — Bria, Stan; F-17 — Bria

One boolean here answers four different questions — launchable, commit-capable, recommendable, persist-valid — and the flip changed the answer to only one of them. Narrowing the field's doc comment records an intent, while the four gates reading it record the behavior, and a governing rule written for two states ("shipped, or visible and disabled") keeps returning confident answers about a world that now has three. There is also a gravity worth noticing in which artifacts get amended: the derived documents moved with this change, and the design source they all quote did not, because nobody was looking at it.

**Carry forward:** When a flag changes value or timing, enumerate the questions it answers and settle each one on its own — then ask which artifact is the *source* the others quote, and start the amendment there.

*A review earns its keep less by what it catches than by what it makes cheap to see next time — and the findings that changed shape on their way to this page are the ones that taught the most.*

## Horizon Watchlist

Not merge blockers. Pressures the panel saw and chose not to convert into findings.

- **The persisted contract forbids the most common intermediate state.** `assertSelectionRiskIntegrity` demands *set equality* between accepted risk ids and a card's advisory flags, while the controller treats an unaccepted risk as a blocker. A selected-but-unaccepted card is a legal transient state and an illegal persisted one. Slice 5's commit path must gate on `commitBlockers.length === 0`, and that forecloses ever checkpointing an in-progress draft.
- **The workup is not self-describing.** `assertOverlapIntegrity` recomputes overlap from `draft.subject.text`, which is legal only because any subject edit destroys the workup. Clone-and-recommit in Slice 5 will test whether one-live-truth survives contact with a second live truth.
- **Presentation has no closed registry where persistence has one.** `useWorkshopWidgetOpening` takes six structurally identical edits per widget, third repetition. At six widgets the `boundaries.test.ts` allowlist reaches a ~70-member alternation and all modals remain statically imported into a bundle already past webpack's advisory. The seam is a per-widget presentation record, not the generic variation framework both sprints correctly forbid.
- **`widgetModelsSync.test.ts` counts without a denominator.** Three literal occurrences in one file; a fourth picker binding a *filtered* option list passes, and so would three bindings on the same modal.
- **`live` is one boolean answering four questions.** Launchable, commit-capable, recommendable, persist-valid. Today three of the four are independently guarded. The honest end state is separate predicates.
- **The prior review's watchlist called this.** *"Slice 7 is when the dormant costs arrive… They land together the day the catalog flips."* All four named costs were remediated before the flip — the trade was paid for. What arrived unbudgeted was the set of registries and documents that read `live` for a different question.

## The Closer

⭐ **Restaurant review — three stars.**

Ordered the passage-only tasting menu, which the house now recommends. The kitchen is excellent and the room is honest — the disabled dessert course comes with a written explanation, which almost nobody does. Two stars withheld because the recipe card still tells the cook to garnish with a herb the new menu removed, and when the plate came back wrong the waiter said "try again" without mentioning that the kitchen would make it exactly the same way.

## Final Assessment

This is careful work. The correlation machinery is more rigorous than either sibling widget, the closed boundaries are enforced at two independent layers rather than asserted, and P-2 — widening every check that silently depended on a field being required, in the same commit that made it optional — is the kind of discipline that prevents the class of bug it was reaching for.

The three High findings share one shape: the widget became reachable, and the paths that were previously unreachable arrived without the guards, the copy, and the fixtures that reachable paths need. None is architectural. F-01 is a prompt line plus a branched retry message, F-02 is two guard clauses at one location, F-03 is a status region in a slot that is already vacated.

**Merge after F-01, F-02, and F-03.** F-04 through F-06 should land with them — they are the test and documentation halves of the same story, and F-05's fitness function is the one thing that will fire on the next flip. The remaining Standard findings are legitimate follow-ups, and F-16 in particular should not hold this commit.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
*Runway scouts: Bria 🎯 · Stan 🗂️ · Marcus 🏛️ · Sam 🔍*
