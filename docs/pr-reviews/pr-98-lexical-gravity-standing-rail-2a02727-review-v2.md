# MR Review v2 — feat(workshop): add Lexical Gravity standing directive

**Author:** okeylanders · **PR:** [#98](https://github.com/okeylanders/prose-minion-vscode/pull/98) (Draft)
**Branches:** `sprint/conversation-widgets-02b-lexical-gravity-standing-rail` → `epic/conversation-widgets`
**Base:** `462d872` · **Head:** `2a02727`
**Reviewed:** 2026-07-31 · **Mode:** Full (Semantic Runway + 10 specialists + Sensei)

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up with reason · **Addressed** = fixed · **Partially addressed** = fixed with remainder · **N/A** = praise, superseded, or not actionable.

| ID | Sev | Finding | Reviewers | Discovery | Signal | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | 🟠 High | Composed lens slugs overflow the 64-char bound and fail the whole save batch | Sam, Blake | 2 independent | 🎯 Consensus | **Addressed** |
| F-02 | 🟠 High | A codec-valid lens can render a directive frame over budget; `reach` is the hidden switch | Blake, Cal (+Sam, Patricia corroborating) | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-03 | 🟠 High | Completion criterion 1 promises "previews before/after"; no "before" is rendered at all | Bria | 1 runway-prompted | — | **Addressed** |
| F-04 | 🟡 Standard | Widget-specific rendering and vocabulary live in the most family-generic files | Marcus, Parker | 2 independent | 🎯 Consensus | **Addressed** |
| F-05 | 🟡 Standard | A generated lens subject is a one-shot resource and nothing says so | Sam, Bria | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-06 | 🟡 Standard | The acceptance surface drifted in both directions | Stan, Bria | 2 runway-prompted | 🧭 Corroborated Runway | **Addressed** |
| F-07 | 🟡 Standard | Lens provenance is stamped on the write paths and not on the read path | Patricia | 1 independent | — | **Addressed** |
| F-08 | 🟡 Standard | Two renderers over one join; live and restore paths disagree on frame order | Marcus | 1 runway-prompted | — | **Addressed** |
| F-09 | 🟡 Standard | Every fail-loud path added here is asserted only where it cannot fail | Cal | 1 independent | — | **Addressed** |
| F-10 | 🟡 Standard | An overloaded negative fixture short-circuits, leaving the single-lens invariant unasserted | Cal | 1 independent | — | **Addressed** |
| F-11 | 🟡 Standard | `remove-standing` action results have no consumer; the kill switch fails silently | Oliver | 1 independent | — | **Addressed** |
| F-12 | 🟡 Standard | The standing-directive lifecycle logs nothing on success | Oliver | 1 independent | — | **Addressed** |
| F-13 | 🟡 Standard | No artifact lets the writer reconstruct what the directive said | Oliver | 1 runway-prompted | — | **Addressed** |
| F-14 | 🟡 Standard | The widest contract has the narrowest owner; Sprint 03 must restructure, not extend | Marcus | 1 runway-prompted | — | **Partially addressed** — apply is family-discriminated; shared route ownership is now an explicit Sprint 03 first step |
| F-15 | 🟡 Standard | A docblock states a must-not-throw invariant the code does not hold | Blake | 1 runway-prompted | — | **Addressed** |
| F-16 | 🟡 Standard | One business rule stated five times; four executable, one English prose | Parker | 1 runway-prompted | — | **Addressed** |
| F-17 | 🟡 Standard | The second widget-local codec has a different shape from the first | Stan | 1 independent | — | **Addressed** |
| F-18 | 🟡 Standard | A duplicated message-regex error classifier; the tracked debt names only one site | Stan | 1 independent | — | **Partially addressed** — one shared classifier now; stable port error codes remain tracked |
| F-19 | 🟡 Standard | The widget recommendation contract is an unconditional per-turn token tax | Tim | 1 runway-prompted | — | **Deferred** — follow-up; this PR's increment is +142 tokens, the shape is the concern |
| F-20 | 🔵 Nit | `'falconry'` design fixture left as state default; makes the placeholder unreachable | Parker | 1 runway-prompted | — | **Addressed** |
| F-21 | 🔵 Nit | `list()` awaits in a loop and gates zero-cost built-ins behind the project walk | Tim | 1 runway-prompted | — | **Addressed** |
| F-22 | 🟢 Praise | Deterministic exploration is genuinely zero-token; both paid seams single-flight and abortable | Tim | 1 independent | — | N/A — preserve |
| F-23 | 🟢 Praise | The webview→host boundary is closed end to end; validate-before-join beats post-hoc containment | Patricia | 1 independent | — | N/A — preserve |
| F-24 | 🟢 Praise | The persona recommendation seed is a closed enum that keeps lens bodies behind writer selection | Patricia | 1 runway-prompted | — | N/A — preserve |
| F-25 | 🟢 Praise | Two exemplary tests: the staged-install pair and the mid-batch rollback | Cal | 1 independent | — | N/A — preserve |

### Remediation note — 2026-07-31

The review pass fixed every release-scoped finding and both nits. The two
partial rows are deliberate horizon boundaries: F-14's route-owner move is now
the first explicit Sprint 03 architecture step (the second family is what earns
that handler), while F-18's stable provider error code remains the existing
`FileSystem`-port debt after consolidating today's message classifier.

Notable product resolution: F-03 follows the approved Spread 02 interaction.
The modal now renders the canned lens sample as **Before** and the generated
sample as **After**, and the sprint criterion says exactly that; it does not
quietly substitute a passage-sized preview contract. F-05 retains unsaved
generated takes for top-up saves while the sheet remains open and explains the
existing-project short circuit.

Verification after remediation: `npm run typecheck` passed; the full Jest run
passed **156 suites / 1,749 tests / 1 snapshot**; `npm run lint` completed with
**0 errors** (906 repository warnings); and the production build plus bundle
sentinel verification passed. A final focused pass after tightening partial-save
response correlation passed **4 suites / 28 tests**.

## Review coverage

**Read fully:** the standing-directive triad (`WorkshopStandingDirectiveService`, `…Ledger`, `…Frames`), `LexicalGravityConfigCodec`, `LexicalGravityLenses`, `LexicalGravityLensRepository`, `LexicalGravityModelService`, `WorkshopLexicalGravityHandler`, `WorkshopWidgetConfigOperations`, `WorkshopWidgetConfigLedger`, the standing-directive regions of `WorkshopSessionService` / `…StateV1Shape` / `…StateV1Integrity` / `…PersistenceCoordinator`, `WorkshopLexicalGravityModal`, `WorkshopStandingDirectiveRail`, `useLexicalGravity`, `WorkshopApp` (widget regions), `messages/workshop.ts`, `promptBudgets.ts`, `workshopWidgetRecommendation.ts`, `workshopPromptFrames.ts`, and all new/modified tests.

**Siblings read for precedent:** `WorkshopConversationSettingsService`, `GesturePlaygroundConfigCodec`, `GesturePlaygroundService`, `WorkshopWidgetHandler`, `WorkshopSessionStore`, `WorkshopThreadArtifactFrame`, `ConversationManager`, `AssistantToolService`, `persistedValidation`, `pathContainment`.

**Governing documents read:** `CLAUDE.md`; the Sprint 02B plan (Locked Decisions, Deliverables, Completion Criteria); `docs/adr/2026-07-22-conversation-widgets.md`; `docs/adr/2026-07-30-workshop-session-codec-evolution.md`; the epic; `docs/pr-reviews/pr-96-…` and `pr-97-…`; four `.todo/tech-debt/` entries.

**Independently executed:** `npx jest` over the 12 affected suites — **210 tests, all passing** at head `2a02727`. Slug-overflow arithmetic reproduced in isolation. Frame-budget arithmetic computed by four reviewers independently. Exhaustive greps for `vscode` imports in core, `lexicalPreviewSourceCharacters`, `.sample` in the presentation layer, `cache_control`, and `source: 'project'`.

**Not verified:** full `npm run build` / `typecheck` / `lint` (author-claimed; the focused test subset was re-run and passes). Windows device-name behavior through the `FileSystem` port. Whether Workshop widget configs have shipped to Marketplace — this decides which regime of ADR 2026-07-30 applies.

**Blast radius:** 63 files, +4,772 / −256. No migrations. No external API contracts. `schemaVersion` unchanged at `1`. Two new project-file resource types under `prose-minion/lenses/`. One new reserved prompt frame. Three new services at the composition root.

---

# Part I — Semantic Runway

*Written before any reviewer ran, from four independent scout passes reconciled against raw evidence. The panel was instructed to treat it as a testable map, not authority — and corrected it in four places. Those corrections are recorded in Part II.*


**PR:** #98 (DRAFT) · **Author:** okeylanders
**Branches:** `sprint/conversation-widgets-02b-lexical-gravity-standing-rail` → `epic/conversation-widgets`
**Base:** `462d872` · **Head:** `2a02727` · **Evidence date:** 2026-07-31
**Blast radius:** 63 files, +4,772 / −256. Two commits. No migrations, no external API contracts, no server. Touches the Workshop session codec, the persona prompt-assembly path, a new project-file resource type, and the composition root.

**Runway thesis.** This PR looks like a feature — a writer dials a lens and the prose leans that way. It is really an *infrastructure* PR wearing a feature as its test harness: it builds the third rail in the Workshop widget system (durable standing state, after Sprint 01's one-shot thread-artifact rail and Sprint 02A's config ledger) and uses Lexical Gravity as the load that proves the rail holds weight. The central design claim is an *orthogonality wall* — this thing shapes the prose the room emits without touching who the room is — and that wall turns out to be half structural guarantee and half instruction to a language model. Reading the change well means keeping those two halves separate.

---

### 1. Working Definition & Real Job

**Literal code change.** Three new application services under `application/services/workshop/directives/` (a family-generic ledger, a serialized coordinator, a frame renderer), a widget-local codec and lens catalog under `lexicalGravity/`, a domain handler, a model service with two bounded seams, a project-file repository, a modal, a hook, a rail component, and roughly 280 lines of new message contracts. The session codec gains an optional `standingDirectives` array and a `counters.standingDirective`; the persisted widget-config draft and turn `widgetCommit` both become discriminated unions.

**Functional capability.** A writer opens Lexical Gravity, picks one of six built-in interpretive lenses (photography, music, mathematics, weather, botany, architecture — `LexicalGravityLenses.ts:12-121`) or a project-generated one, sets three scalars, optionally spends one model call to preview and one to draft new lenses, then installs. From that moment every persona prompt in the room carries a `<prose-directive family="lexical-gravity">` block until the writer edits or kills it.

**Business/operational problem.** Before this, biasing generated prose meant repeating the instruction every turn, or editing persona identity — which changes the *participant* rather than the *work*. **[Declared]** ADR decision 1, `docs/adr/2026-07-22-conversation-widgets.md:47-55`.

**What the wording and structure emphasize.** The vocabulary is relentlessly physical: *gravity*, *weight*, *reach*, *pull*, *field*, *the passage stops gravitating*. That is not decoration — it encodes the intended mental model, that this is an ambient force acting on prose rather than a rule being obeyed. The structure emphasizes *reversibility and visibility*: an amber strip above the composer, install/shift/kill markers in the transcript, one-click removal.

**What it suppresses.** The word *prompt* appears nowhere writer-facing. The writer never sees the actual directive text sent to the model. The physical metaphor is doing real work here — it makes an unreadable prompt-engineering artifact feel like a dial.

**What must survive any valid alternative.** (a) Persona identity and conversation behavior are never mutated by this feature. (b) The writer can always see that a directive is active and remove it in one action. (c) Prose-generation state changes happen between runs, never mid-run. (d) A restored session reconstructs the exact committed directive from persisted config, never from a stale serialized system message. (e) Deterministic exploration costs zero tokens.

**Competing interpretation.** A reader could take this as "Sprint 02B ships the Lexical Gravity feature," with the rail as incidental scaffolding. The evidence points the other way: the sprint plan's Goal sentence leads with the rail and treats Lexical Gravity as the proof ("Build the **standing prose-directive rail** … and prove it with its first real widget"), the ledger/integrity/persistence layers are family-generic throughout, and `prose-controller` is already enumerated in three closed unions before Sprint 03 exists **[Observed]** `WorkshopSessionStateV1Shape.ts:366-367, 570, 583-584`. But the interpretation is not free of tension — several *coordination* seams (route ownership, the rail's remove wiring, the apply method name) remain single-family, which a pure-infrastructure reading would not predict. Section 12 takes that up.

> This MR is not merely adding a lens picker. Its real job is **establishing a durable, writer-owned, session-reconstructable standing-directive rail** while preserving **the wall between what the room writes and who the room is**.

---

### 2. Declared Intent, Observed Behavior & Open Meaning

The sprint plan (`.todo/epics/.../02b-lexical-gravity-standing-rail.md`) is unusually explicit — thirteen "Locked Decisions," nine numbered deliverables, five completion criteria. That makes declared-vs-observed comparison unusually productive.

**Aligned and demonstrably so:**

| Declared | Observed |
| --- | --- |
| Deterministic controls make no model call | Only `preview()` and `buildLenses()` reach an engine (`LexicalGravityModelService.ts:36,73`); all six lenses and every panel tab are pure data |
| Reserved `<prose-directive>` frame with closed family + `pd-N` id | `WorkshopStandingDirectiveFrames.ts:44`; registered in `RESERVED_PERSONA_FRAME` with delimiter neutralization on every interpolated value |
| Coordinator refuses mid-run, applies between runs, serializes | `WorkshopStandingDirectiveService.ts:98-108`, plus an independent second assertion in `WorkshopConversationSettingsService.ts:271` |
| Edit-in-place keeps stable id, increments revision | `WorkshopStandingDirectiveLedger.ts:72-77` reuses `existing.id` |
| Session owns committed truth; frame rebuilt from config | No rendered frame string exists in the persisted shape; `WorkshopSessionPersistenceCoordinator.ts:643` rebuilds via `renderWorkshopStandingDirectiveFramesFromState` |
| Personas propose, writers install | The recommendation path yields a four-scalar *seed*; nothing persona-side reaches `WORKSHOP_APPLY_STANDING_WIDGET` |
| Core stays host-agnostic | Zero `vscode` imports in `packages/core/src`; all three services constructed in `extension.ts` |
| Single lens only | `assertLexicalGravityDraftShape` requires `resolvedLens.slug === lensSlug` (`LexicalGravityConfigCodec.ts:137-139`) |

**Gaps and open meaning — the material ones:**

**(a) "Previews before/after" previews someone else's prose.** Completion criterion 1 says the writer "previews before/after." **[Observed]** `preview()` sends `draft.resolvedLens.sample` — a 2–4 sentence sample baked into the lens definition — not the writer's passage (`LexicalGravityModelService.ts:93`). Corroborating signal: `promptBudgets.ts:198` defines `lexicalPreviewSourceCharacters: 16_000`, and that constant is referenced **nowhere else in the codebase** (verified by exhaustive grep). A budget was provisioned for a passage-sourced preview that was not built. Whether that is deliberate scoping or an unfinished slice is **[Unknown]**.

**(b) The plan was amended by its own implementation, in the same commit.** At the epic base `462d872` and again at the first commit `bd44161`, the locked decision read: *"the writer chooses one. Only the chosen validated lens is written."* Commit `2a02727` changed the behavior to multi-select **and rewrote that locked decision, the ADR's decision 6, the epic's decision 8, and the design catalog entry** to read "one or more" **[Observed]**. This is not concealment — the doc edits are in the diff and visible. But it means the plan can no longer be read as an independent specification against which the code is checked; for this decision, plan and code are the same artifact. Section 13 returns to this.

**(c) Settings-backed defaults were not built.** The locked decision permits ("may retain") Settings defaults, and deliverable 9 lists *"Settings-default isolation"* as a required test. **[Observed]** defaults are hardcoded `photography / 60 / 2 / false` (`WorkshopLexicalGravityModal.tsx:97-100`) and no such setting exists in the extension manifest. The deliverable's test line has nothing left to isolate. Since the decision said "may," this is a permitted scope cut with a stale test requirement, not a contradiction.

**(d) Deliverable 1 names a different home for the frame builder.** The plan says the `<prose-directive>` builder goes in `WorkshopPromptBuilder`; it landed in `directives/WorkshopStandingDirectiveFrames.ts` **[Observed]**. Notably, PR #96's review moved the *sibling* `buildGestureDirective` in the opposite direction — out of infrastructure and into `WorkshopPromptBuilder` (commit `775cec7`). Widget prompt assembly now has two addresses.

**(e) "Dormant during analysis" is instructed, not enforced — for personas.** The frame says "Keep it dormant during analysis, critique, planning, and ordinary conversation" (`WorkshopStandingDirectiveFrames.ts:45`). For tool sidecars the dormancy is structural — `buildWorkshopToolSystemMessage` never receives frames **[Observed]**. For personas it is prose addressed to a model, and the frame ships on every turn while active. This is the largest declared-vs-observed spread in the change, and it is worth stating precisely: the *orthogonality* claim (never touches persona identity) is structurally true; the *dormancy* claim (inactive during conversation) is model-dependent.

---

### 3. Business Story & Rulebook

**Actors.**

| Actor | Role | Authority |
| --- | --- | --- |
| Writer | Decision-maker | Sole authority to install, shift, kill, or save a lens |
| Personas | Proposers | May recommend and seed; restricted to the six built-in slugs (`workshopWidgetRecommendation.ts:325-327`) |
| Host (core) | Trusted intermediary | Mints `pd-N`/`wc-N`, holds generated candidate bodies, validates fail-closed, renders the frame |
| Widget-scope model | Contractor | Two paid seams; never touches standing state |
| The passage | Subject | The thing being biased |
| Persona identity | Protected non-subject | The orthogonality wall |

**Rules newly introduced.** One active directive per closed family. Weight is an integer 10–100 in five-point steps; reach is exactly 1, 2, or 3. Directive id is stable across shifts; revision tracks the config's. Mutations are refused while `activeRequestId !== undefined`. The lens library lives at `prose-minion/lenses/`, capped at 200 files, 256 KB each, 3 per save batch. A config may carry `artifactId` **xor** `directiveId` — spanning both rails is fatal at load.

**Rules accidentally implied — the interesting ones.**

- **Weight and reach are enforced in different classes.** Reach is *deterministic*: the frame emits only degree buckets ≤ reach (`WorkshopStandingDirectiveFrames.ts:31-36`). Weight is *advisory prose*: the frame prints "Weight: 60/100. Let this field influence diction and imagery at that intensity." The plan presents them as peer controls; the implementation makes one a filter and the other a suggestion. Whether five-point granularity carries writer-visible meaning against a model reading a raw integer is **[Unknown]**.
- **The first *selected* candidate claims the bare subject slug**, later ones get `<subject>-<variant>` (`LexicalGravityLensRepository.ts:107-119`). Selection order, not model order, determines which take owns the canonical name. Undeclared anywhere.
- **One build ⇒ one save ⇒ subject closed.** `latestBuild` is cleared on success (`WorkshopLexicalGravityHandler.ts:206`), and a later rebuild of the same subject short-circuits on the now-existing file (`:158-165`). A writer cannot return for more takes on a subject they have already saved, and there is no rename or delete in the UI. Library curation happens in the file explorer.
- **Removing nothing reports success.** `{ ok: true, removed: false }` with no turn and no marker (`WorkshopStandingDirectiveService.ts:90`).

**Value created.** Say it once and it holds — with a receipt. Plus a project-owned lens library that outlives the session.

**Harm the feature must prevent.** Stated plainly in the plan: *"A durable, invisible influence is a debugging nightmare for the writer"* (line 145-146). Every visibility affordance — amber strip, shift markers, one-click kill, frame-rebuilt-from-config — is a countermeasure to that one sentence. The harm model is about the *writer's* ability to reconstruct why their prose looks the way it does. Hold that thought for Section 13.

---

### 4. Narrative Flow: Beginning, Development, Turn & Ending

**Beginning.** The writer is mid-conversation on a passage. Three doors lead in: the Widgets browser, a persona's recommendation chip, or a transcript marker. If a directive is already active, the browser door silently redirects to *edit* rather than *new* (`WorkshopApp.tsx:520-527`) — the one-per-family rule enforced at the UI before the host sees it.

**Development (free play).** Four deterministic tabs, three controls, zero tokens. Two explicit paid seams, both sentinel-framed and bounded. Generated candidates stay host-side; the webview holds only ids.

**The Turn.** "Install on passage." This is the only act that changes conversation state, and only a writer can perform it. The sequence is genuinely two-phase:

```
serialize (queue #1)
  assertBetweenRuns
  prepare config      ← nothing installed
  prepare directive   ← nothing installed
  render frames       ← throws here are free; nothing has moved
  await replaceStandingDirectiveFrames   (queue #2, re-asserts between-runs)
        └─ AssistantToolService builds ALL persona prompts, then
           ConversationManager validates ALL targets, then mutates ALL  ← atomic batch
  commitStandingDirectiveMutation        ← synchronous; session state moves here
```

The guarded-batch prompt swap (`ConversationManager.ts:336-363`: validate every target, then mutate every target) is the strongest safety property in the change. And the ordering the PR description claims — prompt replacement succeeds before session state commits — is literally what the code does.

**Ending.** A system divider turn lands in the transcript (`"Lexical Gravity installed — Photography · 60% · 2°"`), three effects fan out (`postTurn`, `postSessionState`, `markDirty`), and the debounced autosave eventually writes the checkpoint. The amber strip appears. The caller may safely believe: the provider history and the session agree, and the checkpoint will follow.

**Unresolved threads.** There are four commitment points, not two, and they are not equally reversible: the in-memory provider history swap (no undo), the session aggregate install, the transcript marker, and the disk checkpoint (debounced, independent). The window between the first two is a synchronous continuation after a single `await`, so nothing interleaves — but `commitStandingDirectiveMutation` is *not* throw-free: it installs both ledgers at `WorkshopSessionService.ts:1101-1104` and only afterwards calls `standingDirectiveMarkerContent`, which throws at `:2770` and `:2776`. That is the one place where the codebase's own "prepare everything that can throw, then install" rule is not quite held. Whether it is reachable is a question for the panel, not the runway.

---

### 5. Codebase Genealogy & Controlling Precedent

**The three-step line.** Sprint 01 (PR #96) built Gesture Playground and the one-shot thread-artifact rail. Sprint 02A (PR #97) extracted widget state architecture — the config ledger, injected clone/summary operations, prepare-then-install hydration, and `persistedValidation` as the single structural grammar. Sprint 02B (this PR) adds the standing rail. Each step's review shaped the next: this PR *inherits fixes rather than re-earning bugs*.

**Controlling precedent, and a ghost.** The plan names `WorkshopConversationBehaviorService` and `assistantToolService.replaceWorkshopConversationBehavior` as its template. **Neither exists** — verified absent from source. The class is `WorkshopConversationSettingsService` and the seam is `replaceWorkshopConversationSettings`; the rename was itself a PR #83 review finding, completed in `708bfb0` **[Observed]**. The plan's genealogy points at a retired name — but the *right* retired name. The surviving class genuinely is the closest ancestor, and `WorkshopStandingDirectiveService.ts:98-108` reproduces its `serialize()`/`assertBetweenRuns()` nearly verbatim (one difference: `.then(operation, operation)` here versus `.then(operation)` there — this version survives a rejected predecessor).

**Sibling map.**

| New | Ancestor | Why genuinely sibling |
| --- | --- | --- |
| `directives/WorkshopStandingDirectiveLedger.ts` | `widgets/WorkshopWidgetConfigLedger.ts` | Method-for-method: `now` injection, clone-on-read, `prepare*`/`installPrepared*`, `exportState`/`prepareState`/`reset` |
| `lexicalGravity/LexicalGravityConfigCodec.ts` | `widgets/GesturePlaygroundConfigCodec.ts` | Widget-local persisted grammar built only on `persistedValidation` primitives |
| `widgets/LexicalGravityModelService.ts` | `widgets/GesturePlaygroundService.ts` | Sentinel-framed, bounded, `getEngine('widget')`, same run policy |
| `storage/LexicalGravityLensRepository.ts` | `storage/WorkshopSessionStore.ts` | Platform-port-only infra storage importing an application-layer codec |

**Scar tissue this PR inherits correctly.** The prepare-then-install split exists because PR #97 finding #1 caught a clone inside hydration's must-not-throw block. The injected `WorkshopWidgetConfigOperations` exists because PR #97 finding #2 rejected a "generic" ledger that hard-imported one codec — and this PR is the first proof that seam works: the switches extended without touching the ledger. `prose-directive` is registered in `RESERVED_PERSONA_FRAME`, whose ordering comment is scar tissue from PR #72.

**New precedent this PR creates.** The `directives/` triad is what Sprint 03 will copy. Six things it will most likely copy rather than extend: `applyLexicalGravity` → `applyProseController`; the apply/remove route registration (because `MessageRouter.register` throws on duplicates); `useLexicalGravity` → `useProseController` carrying its hardcoded family; the marker-content diff block; the recommendation instruction string; and the coordinator's test file wholesale. Genuine seams that will *not* need copying: the ledger, `WorkshopWidgetConfigOperations`, the persisted shape/integrity scaffolding, `renderWorkshopStandingDirective`'s registry throw, and the rail component's props.

**Conflicting authority worth naming.** `lexicalGravity/` is a new per-family directory while Gesture's codec stayed in `widgets/`, and the dispatch registry in `widgets/` now reaches across into `lexicalGravity/`. PR #97 finding #9 flagged exactly this conflation and was ledgered *"Deferred — revisit when the second codec lands."* The second codec has landed. Whether the new directory resolves that deferral or sidesteps it is stated nowhere **[Unknown]**.

---

### 6. Structural & Causal Map

Three rails now exist in the Workshop widget system, and the distinction is the key to reading this change:

- **One-shot / thread-artifact** (Sprint 01): a config commits into one turn's artifact. A *past event*.
- **Standing** (this PR): a config installs a durable prompt segment that outlives every turn. *Live prompt state that must be reconstructable.*
- **Resource** (registry-declared, not yet built).

That difference justifies most of the new structure. A past event needs a turn; live state needs a ledger, an integrity contract, a reconstruction path, and a between-runs guard.

**Dependency direction holds.** Presentation → hook → message envelope → handler → application service → session aggregate. Infrastructure (`LexicalGravityLensRepository`, `LexicalGravityModelService`) is reached only through the handler and imports only platform ports. The composition root constructs all three new services and threads them inward. One notable inward reach: `LexicalGravityConfigCodec` lives in `application/` but is imported by two `infrastructure/` collaborators — arguably it is a domain grammar that infrastructure reuses rather than an application artifact.

**The frame's insertion point** is the load-bearing structural fact for the orthogonality claim. `AssistantToolService.ts:871-876` appends directives as a *separate block* after the persona prompt: `[systemPrompt, ...directives, RECOMMENDATION_INSTRUCTION].join('\n\n')`. The directive never enters `workshopPersonaSystemPromptPaths`, never touches `WorkshopConversationBehavior`, and the snapshot type carries no persona field. **There is no write path from Lexical Gravity to persona identity.** That wall is structural and real.

**Restoration is a pure function of persisted state.** `renderWorkshopStandingDirectiveFramesFromState(state)` reads only `standingDirectives` + `widgetConfigs`. No rendered frame is ever persisted. The plan's direction — "a serialized old system message is never its source of truth" — is honored.

**Integrity as a load-bearing contract.** `WorkshopSessionStateV1Integrity.ts:246-320` cross-checks four ways: one directive per family, `directive.revision === config.revision`, `config.directiveId === directive.id`, `family === widgetId`, coherent `standingDirectiveChange` on every `rail:'standing'` commit, and a standing counter that never trails an existing `pd-N`. This makes a restore either correct or loudly dead rather than quietly wrong — a defensible posture given the stated harm is invisible influence.

---

### 7. Contracts, Invariants & Negative Space

**Preconditions for install:** no active run; a valid four-value draft with a matching `resolvedLens`; if editing, the supplied `widgetConfigId` must be the active one.

**Postconditions:** every retained persona prompt carries the new frame; the session holds a directive whose revision matches its config; a marker turn exists; the session is dirty.

**Invariants:** one active directive per family; stable `pd-N` across shifts; config carries `artifactId` xor `directiveId`; no rendered frame in persisted state; directive rendering ≤ 3,000 characters.

**Negative space — what this PR deliberately does not do.** No lens blending (Sprint 04). No Prose Controller (Sprint 03). No scope/context IPC extraction (Sprint 02C). No Settings-backed defaults. No rename/delete/regenerate for project lenses. No passage-sourced preview. No structural enforcement of dormancy for personas. No multi-root workspace support for the lens library. Naming this negative space matters because several items look like omissions and are in fact scope lines — and one or two look like scope lines and may be omissions.

---

### 8. Forces, Tensions & Design Tradeoffs

**Durability vs. the run boundary.** A directive must survive turns, but a provider conversation can only be edited between runs. Resolution: prepare → replace → commit behind a queue and an `activeRequestId` guard, inherited wholesale from the settings service. Cost: a *second* serializer and a nested-queue topology. The two queues give standing installs mutual exclusion with behavior/profile edits, which is the right instinct; the coupling runs the other way too, since `WorkshopConversationSettingsService.apply()` now renders standing frames itself, so a broken directive→config linkage would also break behavior changes.

**Reuse vs. specialization — the central tension.** The infrastructure is family-generic (ledger, integrity, persistence, config operations, rail props, message names). The *coordination* is single-family (the apply method name, the route registration, the hook's hardcoded family, the rail's discarded `family` argument, the summaries switch). This is not obviously wrong — the sprint explicitly ships one family and defers the second — but it means the PR's own thesis ("the rail generalizes") is proven for state and unproven for coordination.

**Fail-loud vs. degrade.** `getSnapshot()` calls `standingDirectiveSummaries()`, which throws on a missing or mismatched config. `getSnapshot` fires on nearly every interaction, so one broken linkage takes down the room view rather than degrading one chip. Given the stated harm — invisible influence — fail-loud is defensible. It is still a choice worth naming.

**Freeze vs. rebuild.** The design freezes the *semantic payload* (`resolvedLens` snapshotted into session config) while leaving the *wording* live (frame rebuilt from template at render). A prompt-template edit silently changes what an old room is told; a lens-file edit cannot. That is a genuinely well-chosen split, and it is the reason alternative (c) below loses.

**Alternate constructions.**

**(a) Embed standing state in `WorkshopHandler`.** Fewer files, one fewer `CoreServices` entry, no nested queues. Costs: the between-runs guard becomes implicit, Sprint 03 becomes a second incision into a 2,959-line file, and the direct unit test (197 lines exercising serialization and mid-run refusal without a handler) disappears. The chosen split buys testability and reuse for a three-hop trace.

**(b) A widget-owned repository instead of session-owned config.** Decouples the directive from the session codec. Forfeits the single persistence clock and the atomic checkpoint — a restored session could disagree with the directive store, which is precisely the failure `renderWorkshopStandingDirectiveFramesFromState` makes structurally impossible. Sprint 02A already ruled this out; the lens *library* demonstrates the correct hybrid (reusable source in project files, committed truth in the session snapshot).

**(c) Store a serialized frame instead of rebuilding.** The persisted blob becomes source of truth, prompt fixes never reach old sessions, and every checkpoint carries an opaque multi-kilobyte string the validator cannot meaningfully check. Rebuild wins.

---

### 9. Failure, Recovery & Operational Truth

**Partial failure.** The lens repository has a real rollback: stage to `.tmp`, `rename(overwrite:false)`, and on any failure delete both temporaries and already-published destinations (`LexicalGravityLensRepository.ts:132-146`). The directive path has no counterpart — if `commitStandingDirectiveMutation` throws after the prompt swap resolved, provider history holds a directive the session does not. Reachability of that throw is a panel question.

**Failure classification is a message regex.** `isMissingPath()` tests the error *message* against `/(?:ENOENT|FileNotFound|not found|does not exist)/i`. A permission error or an I/O error whose message happens to contain "not found" would be classified as missing. Contained to one file, but it is a translation boundary built on prose.

**What the writer sees.** Install/shift/kill markers in the transcript, the amber strip, and error toasts on rejection. What the writer *cannot* see: the actual directive text sent to the model. Given the stated harm is the writer's ability to reconstruct why their prose looks the way it does, the gap between "you can see that a gravity is active" and "you can see what it told the model" is worth naming.

**Diagnostics.** `LexicalGravityLensRepository` logs skipped invalid lens files with a reason. Crashed saves leave `.tmp` litter in `prose-minion/lenses/` (filtered from listing by the `.json` suffix check, so invisible but persistent).

**Budget as a failure mode.** `buildLexicalGravityDirectiveFrame` throws when the rendered frame exceeds 3,000 characters. Because degree lines are gated on reach, frame size is monotone in reach — so the *same lens* can install at reach 1 and throw at reach 3. The throw sits on the rendering path, which is also the persona-start and behavior-change path, so a budget violation would fail conversation starts, not just installs. The codec's field bounds make it plausibly unreachable; arithmetic on worst-case bounds suggests otherwise. A concrete question for the panel.

---

### 10. Security, Trust & Misuse Surface

The operational envelope is local and single-user: no tenancy, no server, no database, no network-exposed surface. Calibrate accordingly — most classical categories are simply not in play.

**What is genuinely a trust boundary.** The webview → host message channel. The design handles it well: `validateLexicalGravityDraft` fail-closes on every apply (`WorkshopLexicalGravityHandler.ts:129, 233`), and generated lens bodies never round-trip through the webview — the webview sends only `candidateId`s, which the host resolves against its own `latestBuild` (`:178-205`). That is exactly the shape the PR description claims.

**Prompt-injection surface.** A project lens file is attacker-influenced in the sense that it is arbitrary JSON on disk that becomes prompt text. Mitigations present: every interpolated value passes through `neutralizeReservedPersonaPromptDelimiters`, values are length-truncated, arrays are sliced, and the whole frame is budget-capped. Worth checking: neutralization happens *after* slicing.

**Path handling.** Slugs are normalized NFKD → stripped → lowercased → non-alphanumerics collapsed to dashes, so `../` cannot survive into `path.join`. But the repository does not use `isPathWithinRoot`, which its `infrastructure/storage/` sibling `WorkshopSessionStore` does. Whether derived-slug-only input is the stated reason for the difference is **[Unknown]**. Windows device names (`con`, `nul`, `aux`) survive slugification intact.

**Persona authority.** Recommendations are restricted to the six built-in slugs, so a persona cannot name an arbitrary project file. Whether that is a deliberate closed-enum posture at a trust boundary or an incidental consequence is **[Unknown]**.

---

### 11. Data, Time, Scale & Concurrency Horizon

**More data.** The lens library caps at 200 files listed, read sequentially. At a writer's realistic library size this is irrelevant; it is worth noting only as the shape of the eventual pressure.

**Concurrent actors.** Two webview surfaces (sidebar and Workshop panel) each construct their own `MessageHandler`, but the session, settings service, and directive service are constructed **once** in `extension.ts` and shared — so the mutation queue genuinely covers both. `WorkshopLexicalGravityHandler` is per-surface, so `latestBuild`, `previewRun`, and `buildRun` are per-surface too: a lens built in one panel cannot be saved from the other. Harmless locally; surprising if encountered.

**Clock boundaries.** `updatedAt` comes from an injected `now()`. No timezone or scheduling logic.

**Codec horizon.** `schemaVersion` stays `1` while `widgetCommit` and the widget-config `draft` both became discriminated unions. Old thread-artifact checkpoints still validate (the `rail === 'thread-artifact'` branch preserves the prior exact key set), and the new fields are optional with defaults. Under ADR 2026-07-30 the question is whether Workshop widget configs have appeared in a Marketplace release — if not, this is checkpoint-level evolution for an unfinished epic and no bump is required; if so, the newly-required `directiveId`/`rail` coherence is a released-semantics change. **[Unknown]** which regime applies.

**Two-year horizon.** `resolvedLens` snapshots are frozen at `version: 1` with `exactObject` validation that rejects unknown fields. A future lens field (Sprint 04's per-lens dominance, say) makes old snapshots invalid on read unless the lens gets a version ramp independent of the session `schemaVersion` — which is exactly the widget-local codec extraction already queued in `.todo/tech-debt/2026-07-30-workshop-widget-local-codecs.md`.

---

### 12. The Change Genome: Variation & Reproduction

**Cousin: Prose Controller (Sprint 03).** Axis, named exactly: **directive-family cardinality on the standing rail — one live family → two concurrently live families.** This beats Sprint 04's blending as a probe because blending mostly stresses the codec and frame builder, while cardinality stresses the rail, the ledger, IPC ownership, the integrity invariant, presentation wiring, and precedence — the parts this PR claims to have generalized.

| Contact point | Classification | Evidence |
| --- | --- | --- |
| Ledger (`prepareUpsert` keys on family, shared `pd-N` counter) | **Reuse** | `WorkshopStandingDirectiveLedger.ts:65-89` |
| Persisted shape + integrity scaffolding | **Reuse** | optional-with-default; both families already enumerated |
| Domain types (`WorkshopStandingDirectiveFamily`) | **Extension** | already two-member unions |
| `WorkshopWidgetConfigOperations` switches | **Extension (good)** | `unsupportedConfig(value: never)` makes a third widget a compile error until handled |
| `renderWorkshopStandingDirective` | **Extension** | explicit registry-shaped throw; adding a family is one branch |
| `WorkshopStandingDirectiveService.applyLexicalGravity` | **Fork** | family in the method name + four literals; `remove(family)` is already generic |
| Apply/remove route ownership | **Contradiction** | generic message types registered by a family-specific handler; `MessageRouter.register` throws on duplicates |
| Rail remove wiring | **Contradiction** | `Rail.tsx:55` passes `directive.family`; `WorkshopApp.tsx:1466` discards it; `useLexicalGravity.ts:103` hardcodes it |
| `standingDirectiveSummaries` | **Contradiction (latent)** | shape accepts `prose-controller`; summaries throw for it inside `getSnapshot()` |
| `family === widgetId` invariant | **Contradiction (latent)** | `lens-blending` is already a registered standing widget id (`workshopWidgets.ts:172`) that would presumably produce a `lexical-gravity`-family directive |
| Frame ordering | **Open question** | live path appends the replacement last; restore path preserves persisted order |
| Recommendation instruction | **Premature-generalization risk** | one literal naming both widgets, appended to every persona message, with its section budget computed from *gesture* budgets |
| Tests | **Fork** | no test exercises two directives active at once |

**Conclusion.** This PR creates a **genuinely generative pattern for standing *state*** and a **deliberately narrow implementation of standing *coordination*.** The state layer will carry Sprint 03 with additions only. The coordination layer will require either a promotion (routes and apply moved to a shared standing handler) or a fork. Neither is a defect today — the sprint ships one family by design — but the PR's stated purpose is proving the rail generalizes, and the proof is currently partial in a way the diff does not announce.

**Inversion.** Reverse ADR decision 12 — personas install, writers approve. The seed would have to carry a full `resolvedLens`, making arbitrary model JSON the durable snapshot the frame is rebuilt from forever; and `assertBetweenRuns` inverts badly, since a persona would want to propose mid-run. The current design's strength shows under inversion: the writer-commit boundary is exactly what lets the seed stay four scalars.

**Deletion.** Remove the standing family entirely and Lexical Gravity becomes "attach this lens to this message" on the existing one-shot rail. Exactly one thing is lost: **durability across turns without re-attachment.** That is the irreducible need. Everything else — ledger, two-phase commit, amber strip, shift markers, kill switch — is the cost of durability plus the writer's right to see an invisible influence.

**Time-lapse.** At three families the rail's `default:` clauses, the LG-owned routes, the append-last frame ordering, and the monolithic recommendation instruction reach their limits together.

---

### 13. Comparative Models & Borrowed Vocabulary

**Strongest internal parallel: `WorkshopConversationSettingsService`.** Same problem class — mutate a durable prompt segment on retained conversations — and the same three constraints fall out: a mutation queue, a between-runs gate, and replacement-before-commit ordering. *Question it contributes:* the template deliberately used **one** queue for behavior and profile together. This PR nests a second queue inside the first. What does the nesting buy that a single shared queue would not?

**Software product lines / variability modeling.** Vocabulary: commonality, variation point, variant, *binding time*. The useful distinction here is binding time — this design binds family variation at **compile time** (closed unions, `assertNever`, a registry throw) rather than at configuration or runtime. That is a strong choice for a codebase with two known future families, because the compiler enforces exhaustiveness. *Question it contributes:* the persisted shape validator binds *later* than the reader — it accepts `prose-controller` from disk while `standingDirectiveSummaries()` cannot render it. When a validator admits a variant the reader rejects, which one states the real contract?

**Evolutionary architecture / fitness functions.** `WorkshopSessionStateV1Integrity` is functioning as a fitness function: an executable, always-on assertion of architectural invariants that fails loudly on drift. *Question it contributes:* one of its assertions — `family === widgetId` — encodes the first case as universal truth, and the widget registry already contains a counterexample-in-waiting (`lens-blending`). Is that assertion a fitness function or a fossil?

**Legal precedent and statutory interpretation.** [Analogy] The sprint plan operates like a statute with "Locked Decisions," and this PR does something a court cannot: it **amends the statute in the same instrument that applies it.** Commit `2a02727` changed single-select to multi-select and rewrote the locked decision, the ADR, and the epic to match. Nothing is hidden — the edits are in the diff. But the plan can no longer serve as independent authority for that decision. *Question it contributes:* when a locked decision changes during implementation, should the amendment be recorded as a dated amendment rather than a silent replacement, so that later readers can see the decision moved and why?

**Chain of custody and evidence handling.** [Analogy] The stated harm is the writer's inability to reconstruct why their prose looks as it does. Chain-of-custody asks: can a later investigator trace derived output back to a source fact, and distinguish missing data from an empty result? This design does well on *identity* provenance — stable `pd-N` ids, revisions, install/shift/kill markers with before→after values, and a frame rebuilt from persisted config rather than a stale blob. It does less well on *content* provenance: the writer can see that Photography · 60% · 2° is active, but never the ~2,000 characters actually sent to the model on their behalf. *Question it contributes:* for a feature whose declared harm is invisible influence, is directive-identity visibility sufficient, or does the writer need to be able to read the directive?

---

### 14. Creative Counterfactuals

**Boring alternative.** The least clever implementation satisfying the invariants: store the four scalars plus the resolved lens on the session, and rebuild the frame inline in `AssistantToolService` wherever persona prompts are assembled — no ledger, no coordinator, no directive ids. It would work for one family. It would lose the between-runs guard (which currently prevents mid-run prompt mutation), the stable identity that makes edit-in-place auditable, and the integrity contract that makes a corrupt restore loud. The extra machinery is buying *auditability under mutation*, which is precisely what the stated harm model demands. The abstraction earns its keep.

**Constraint swap.** Suppose the frame had to be rebuilt on every turn from live config rather than swapped into retained prompts. The between-runs guard becomes unnecessary and the whole two-queue topology dissolves — but prompt caching dies, and the sprint plan explicitly prices install as "the same cache cost class as a mode change." The design is paying complexity to protect cache economics. Worth knowing that is the trade.

**Time-lapse on the plan.** Two years out, a reader of `02b-lexical-gravity-standing-rail.md` sees a locked decision saying "one or more" and a completed implementation matching it perfectly. The disagreement is only visible in `git log`.

---

### 15. Evidence Confidence & Unresolved Questions

**Repository-grounded and independently verified by the orchestrator:** the two-phase ordering; the guarded batch prompt swap; zero `vscode` imports in core; alias-policy compliance in new directories; `lexicalPreviewSourceCharacters` referenced nowhere; the preview using `resolvedLens.sample`; the plan-text rewrite across `462d872` → `bd44161` → `2a02727`; `WorkshopConversationBehaviorService` absent from source; god-file growth (`WorkshopSessionService` 2,761→2,950; `WorkshopHandler` 2,922→2,959; `messages/workshop.ts` 1,694→1,952; `WorkshopApp.tsx` 1,635→1,724); shape accepts `prose-controller` while summaries throw; ledger install precedes marker-content construction; `lens-blending` registered as a standing widget id; integrity requires `family === widgetId`; the rail's `family` argument discarded at `WorkshopApp.tsx:1466`; **12 test suites / 210 tests passing at head `2a02727`.**

**Material inferences:** that this is primarily an infrastructure PR (supported by the plan's Goal, the family-generic state layer, and pre-enumerated `prose-controller`, but tensioned by single-family coordination seams); that weight-vs-reach enforcement asymmetry is consequential rather than incidental; that fail-loud on `getSnapshot` is deliberate.

**Missing artifacts:** the approved design spread HTML itself was not re-synced for the multi-lens change — only its README description was. No `docs/pr-reviews/` entry exists for this PR yet.

**Needs author or product confirmation:** whether the canned-sample preview is deliberate scoping; whether Settings-backed defaults were intentionally dropped (and deliverable 9's test line should be struck); whether `'falconry'` prefilled in the build-lens input (`WorkshopLexicalGravityModal.tsx:105,131`) is a leftover design placeholder in a field that spends tokens on Enter; whether Workshop widget configs have shipped to Marketplace (which decides the ADR 2026-07-30 regime).

**Not verified in this pass:** full `npm run build` / `typecheck` / `lint` (author-claimed; the focused test subset was independently re-run and passes); Windows device-name behavior through the `FileSystem` port; whether the webview can deliver two mutation messages before the first settles.

---

### 16. Past → Present → Horizon Synthesis

**Past.** Sprint 01 built a widget and a one-shot rail, and its review moved the frame builder into `WorkshopPromptBuilder`. Sprint 02A's review forced state ownership into a ledger with prepare-then-install hydration and consolidated shape grammar into `persistedValidation`. This PR arrives with those lessons already absorbed — the new ledger inherits the clone-outside-the-install-block fix rather than re-earning it, and the injected config-operations seam gets its first real proof.

**Present.** The change establishes a durable, writer-owned, session-reconstructable standing rail and lands one widget on it. The orthogonality wall is structurally real where it concerns persona identity and structurally real for tool sidecars; for persona dormancy during conversation it is a sentence addressed to a model. The state layer is family-generic and demonstrably so. The coordination layer — routes, apply signature, hook family, rail wiring, summaries switch — is single-family, with two latent asymmetries where a validator or registry already admits a second identity the reader cannot serve.

**Horizon.** Sprint 03 will exercise exactly the seams this PR left single-family; the question is whether it extends them or copies them. Sprint 04's blending collides with a `resolvedLens` frozen at `version: 1` under `exactObject`, pointing at the widget-local codec extraction already queued in tech debt. And the aggregate keeps growing: four Workshop files gained 500 lines between them while the new feature code stayed small and well-factored — the pressure is landing on the session and the contracts file, not on the new code.

---

### 17. Runway Synthesis Brief

**Invariants the implementation must preserve.** No write path from a standing directive to persona identity or conversation behavior. One active directive per closed family. Writer-only commit. No prose-generation state change during an active run. A restored session reconstructs the exact committed directive from persisted config alone. Deterministic exploration spends no tokens. The writer can always see that a gravity is active and remove it in one action.

**Anchors.** `WorkshopStandingDirectiveService.ts:36-108` · `WorkshopStandingDirectiveLedger.ts:65-106` · `WorkshopStandingDirectiveFrames.ts:26-107` · `WorkshopSessionService.ts:1093-1130, 2410-2438, 2760-2790` · `WorkshopSessionStateV1Integrity.ts:246-330` · `WorkshopSessionStateV1Shape.ts:366-367` · `LexicalGravityConfigCodec.ts:31-159` · `LexicalGravityLensRepository.ts:92-180` · `WorkshopLexicalGravityHandler.ts:129, 158-206, 230` · `AssistantToolService.ts:871-876` · `WorkshopApp.tsx:1466` · `useLexicalGravity.ts:103` · `workshopWidgets.ts:171-181` · `promptBudgets.ts:185-201` · the sprint plan's Locked Decisions and Completion Criteria.

**Tensions (real tradeoffs, not disguised defects).** Family-generic state versus single-family coordination. Fail-loud `getSnapshot` versus graceful degradation. Two nested queues versus one shared queue. Frozen semantic payload versus live wording. Compile-time variation binding versus a validator that binds later.

**Unknowns.** Marketplace-release status of widget configs (decides the codec regime). Whether the canned-sample preview is scoping or an unfinished slice. Whether the `lexicalGravity/` vs `widgets/` split answers or sidesteps PR #97 finding #9. Whether frame order carries precedence with the models in use. Whether the plan/ADR edits in `2a02727` were an intended amendment.

**Legitimate variation points.** A second directive family. A third widget in the config-operations switch. Additional built-in lenses. Project lens files. Recommendation seeds.

**Predicted pressures.** *Near:* Sprint 03 hits route ownership, the apply signature, the hook's hardcoded family, and the rail's discarded argument. *Middle:* Sprint 04's blending hits the frozen `resolvedLens` and `family === widgetId`. *Far:* the recommendation instruction becomes a per-turn token tax proportional to widget count; the session aggregate keeps absorbing growth.

**Questions for the panel — targeted, neutral, and phrased as investigations:**

1. Trace `commitStandingDirectiveMutation` after a successful prompt replacement: `standingDirectiveMarkerContent` throws at `WorkshopSessionService.ts:2770` and `:2776`, and both ledgers are already installed by `:1104`. Is that path reachable, and if so what reconciles provider history with session state?
2. `WorkshopSessionStateV1Shape.ts:366` accepts `family: 'prose-controller'` from disk; `standingDirectiveSummaries()` throws for it inside `getSnapshot()`. Is that forward-compat staging, and what is the blast radius if such a checkpoint ever exists?
3. `lens-blending` is a registered standing widget id (`workshopWidgets.ts:172`); integrity requires `directive.family === directive.widgetId` (`Integrity.ts:316`). Do those two facts conflict for Sprint 04?
4. `WorkshopStandingDirectiveRail` passes `directive.family` to `onRemove`; `WorkshopApp.tsx:1466` discards it and `useLexicalGravity.ts:103` hardcodes the family. Does this matter before Sprint 03 — and what does the X button do with two directives present?
5. Worst-case arithmetic on the codec's own field bounds versus `lexicalDirectiveCharacters: 3000`: can a validated lens exceed the budget, and can the same lens install at reach 1 and fail at reach 3?
6. Two nested serialization queues with four other callers on the inner one. Can any inner-queue operation observe a session that does not yet contain a prepared directive?
7. `WORKSHOP_APPLY_STANDING_WIDGET` / `WORKSHOP_REMOVE_STANDING_WIDGET` are generic message types registered by a family-specific handler, and `MessageRouter.register` throws on duplicates. Who owns them in Sprint 03?
8. Is "one build ⇒ one save ⇒ subject permanently closed" (`Handler:158-165, 206`) the intended lens lifecycle, and does the first *selected* candidate claiming the bare subject slug match intent?
9. Does the preview satisfy completion criterion 1 given it renders the lens's canned sample rather than the writer's passage, and should `lexicalPreviewSourceCharacters` be wired or removed?
10. What confidence do the tests provide about *two* directives coexisting — the case the rail exists to support?
11. `isMissingPath()` classifies failures by regex over error messages. What happens to a permission or I/O error whose message contains "not found"?
12. Is `'falconry'` prefilled at `WorkshopLexicalGravityModal.tsx:105,131` a leftover placeholder in a field that spends tokens on Enter?

**Do not overread.**

- Narrowness is not automatically a defect here. Single-lens, one family, and no blending are *declared scope lines*, not omissions. Penalize them only where the code claims generality it does not deliver.
- The god-file growth is largely **inherited**; the new feature code is small and well-factored. Flag it as trend, not as this PR's sin, unless a specific addition belonged elsewhere.
- The nested queues are not obviously wrong. Do not call them a race without tracing a concrete interleaving.
- The prompt-swap batch (`ConversationManager.ts:336-363`) is genuinely well-guarded. Do not manufacture atomicity concerns there.
- The plan/ADR amendment is *visible in the diff*, not concealed. Treat it as a process question, not misconduct.
- The dormancy instruction being model-dependent is a **stated property of prompt-based systems**, not a bug. The question is whether the sprint's language oversells it, not whether the model can be trusted.

---

# Part II — The Review

## Executive Briefing

**Verdict: Nearly there** — the rail is sound, the state layer is genuinely reusable, and nothing here corrupts data or breaks a contract; but three writer-facing failures can each burn a paid model call with an error message that names a codec field instead of a cause.

- 🟠 **F-01 · Composed lens slugs overflow the 64-char bound and fail the whole save batch** `🎯 Consensus` — a 55-character subject plus a 10-character variant produces a 66-character slug that throws before any file is written, killing valid takes alongside the offending one; a 73-character subject produces a permanent trailing-hyphen failure that no retry can escape. The build is already billed. Clamp the composed slug in `uniqueSlug`.
- 🟠 **F-02 · A codec-valid lens can render a directive frame over its 3,000-character budget** `🧭 Corroborated Runway` — four reviewers computed the same arithmetic: ~2,788 / ~3,336 / ~3,884 characters at reach 1 / 2 / 3. The codec admits what the frame builder refuses, `reach` silently decides installability, and the lens file is permanent with no delete route. Enforce the budget where the lens is admitted, not where it is rendered.
- 🟠 **F-03 · Completion criterion 1 promises "previews before/after" and there is no "before"** — the preview renders the lens's own canned sample, and that sample is never displayed either. `lens.sample` is not accessed anywhere in `presentation/`. Either wire the passage (the unused `lexicalPreviewSourceCharacters: 16_000` was sized for exactly that) or amend the criterion and render a visible baseline.

Nothing rises to Blocking. Blake traced every candidate post-commit throw and found none reachable under the current single-panel UI.

## Report Card

| Domain | Grade | Rationale |
| --- | --- | --- |
| Architecture — Marcus 🏛️ | **B** | The rail is real: ledger, integrity, persistence, and config-operations will carry a second family without argument. Rendering and route ownership were not generalized with them. |
| Critical Correctness — Blake 🔥 | **B−** | No reachable data loss or corruption; the two-phase ordering genuinely holds. Two Highs land on paid-but-unusable work, and one docblock asserts an invariant the code does not keep. |
| Edge Cases — Sam 🔍 | **C+** | The happy path is solid. Long subjects, partial selections, and superseded transcript chips each reach a dead end, and the batch failure depends on which checkboxes were ticked. |
| Code Quality — Parker 📖 | **B** | New code is legible and honestly factored. Writer-facing vocabulary is hand-rolled in two layers and already disagrees for the second family. |
| Tests — Cal 🧪 | **C+** | 210 passing, and two tests I would show a new hire. But every fail-loud path added here is asserted only where it cannot fail; deleting two separate guards leaves the suite green. |
| Codebase Fit — Stan 🗂️ | **B−** | Inherits PR #96/#97's fixes rather than re-earning their bugs — real institutional memory. Offset by a divergent second codec shape, a duplicated error classifier, and four stale tracking documents. |
| Performance — Tim ⚡ | **A−** | Deterministic exploration is genuinely free, both paid seams are single-flight and abortable, and the directive frame is ~4% of a persona prompt. Only the shared recommendation literal's growth shape warrants watching. |
| Security — Patricia 🛡️ | **B+** | Two of three trust boundaries closed cleanly, with validate-before-`path.join` stronger than the sibling's post-hoc containment. The third — the read path — trusts a file's word about its own provenance. |
| Observability — Oliver 🌙 | **C+** | Identity provenance is good and survives reload. Content provenance is absent, the lifecycle logs nothing on success, and the headline one-click kill has no failure surface at all. |
| Domain Logic — Bria 🎯 | **C+** | Criteria 2, 3, and 5 are met cleanly. Criterion 1 is not, criterion 4 is half-met, and four business rules the code invented appear in no plan. |

## Findings

### F-01 · 🟠 High — Composed lens slugs overflow the 64-character bound and fail the entire save batch `🎯 Consensus`

**Raised by:** Sam, Blake · **Discovery:** 2 independent · **Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts:110-118` — `const proposedSlug = index === 0 ? baseSlug : \`${baseSlug}-${variantSlug || \`take-${index + 1}\`}\`;`
**Affected contract:** Business — the multi-select save this PR's second commit exists to deliver

Two distinct triggers, both reproduced in isolation by the orchestrator.

**Overflow.** The composed slug is never re-clamped, then validated against `lexicalLensSlugCharacters: 64`. Blake's trigger: subject `the slow disintegration of a small coastal fishing town` (55 chars, well inside the 100-char build cap) plus variant `deep field` → 66 characters → throws. Sam's: a 38-char base plus a 39-char variant → 78. The `candidates.map` at `:108-119` runs before any I/O, so nothing is written — correct, but the whole batch dies, including takes that were never at risk.

**Trailing hyphen.** `lexicalGravityLensSlug` (`LexicalGravityLenses.ts:178-186`) strips leading/trailing dashes and *then* slices to 64, so the slice can reintroduce one. Subject `the way light moves through water in a swimming pool at the end of summer` (73 chars) → `…-at-the-end-` → fails `SLUG` at `LexicalGravityConfigCodec.ts:43`. Index 0 always takes `baseSlug`, so *every* subset fails, on every retry, permanently.

What makes this High rather than tidy is the ordering of cost. The 8,000-token build is already paid. `latestBuild` survives the failure, so the writer retries into the identical wall. The error surfaced verbatim is `Lexical Gravity lens.slug must be a string of at most 64 characters` — a codec path string that never mentions subject length. And because index 0 is the lowest-*indexed selected* take, deselecting take 1 silently re-slugs take 2, so whether the batch fails at all depends on which checkboxes are ticked.

Not covered: `LexicalGravityLensRepository.test.ts` uses `'Radio Astronomy'` (15 chars) and `'falconry'`.

Inherited note: slice-after-strip comes from `WorkshopSessionStore.ts:1017-1023`, where a trailing dash is merely cosmetic. This PR is the first place that shape meets a regex validator.

**Recommendation:** Re-run `lexicalGravityLensSlug` over the composed `proposedSlug` before `uniqueSlug`, reserving headroom for the `-N` dedupe suffix. One line, and it fixes the collision suffix overflowing too. Optionally add `maxLength={BUDGET.lexicalBuildQueryCharacters}` to the lookup input, matching `WorkshopGesturePlaygroundModal`, which sets it on every free-text field.

---

### F-02 · 🟠 High — A codec-valid lens can render a directive frame over budget, and `reach` is the hidden switch `🧭 Corroborated Runway`

**Raised by:** Blake, Cal (Sam and Patricia corroborated without filing) · **Discovery:** 2 runway-prompted · **Confidence:** Medium
**Evidence:** `packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveFrames.ts:57-59` — `if (frame.length > PROMPT_BUDGETS.workshopWidgets.lexicalDirectiveCharacters) { throw new Error('Lexical Gravity directive exceeds its prompt budget'); }`
**Affected contract:** Data/business — two validators in one feature disagree about what a valid lens is

Four reviewers computed this independently and converged within ~10 characters:

| Lens profile | reach 1 | reach 2 | reach 3 | budget |
| --- | --- | --- | --- | --- |
| Codec maxima | ~2,788 | ~3,336 | ~3,884 | 3,000 |
| ~23-char terms (ordinary model output) | 2,181 | 2,594 | 3,007 | 3,000 |
| All six built-in lenses | — | — | 1,601–1,669 | 3,000 |

Built-ins carry ~1,330 characters of headroom; generated project lenses do not. `validateLexicalGravityLens` accepts a lens the frame builder will refuse — the codec's ceiling sits 884 characters above the budget — and the crossover lands around 18–23-character average degree terms, which is inside what `00-build-lens.md:36` asks for ("vivid specialist language") without giving any per-term length guidance.

The failure itself is clean: the throw sits at `WorkshopStandingDirectiveService.ts:66`, before the prompt swap and before commit, so nothing half-installs. The cost is what follows. The message never mentions `reach`, so the writer has no way to learn that lowering it fixes the problem — even though frame size is monotone in reach by construction (`Frames.ts:31-36`, ~550 characters per degree line). And the lens file is permanent: there is no delete route among the eight Lexical Gravity message types, and `handleBuild` short-circuits on the existing file, so the subject is closed to regeneration.

Every test fixture uses `builtInLexicalGravityLens(...)`, placing the entire corpus in the 2,100–2,400 band where this is structurally invisible.

**Recommendation:** Enforce the frame budget where the lens is *admitted*, not where it is rendered — run `buildLexicalGravityDirectiveFrame` at reach 3 inside `validateLexicalGravityLens` (or an adjacent `assertLexicalGravityLensRenderable`) so `parseCandidates` and `saveManyForQuery` reject an over-budget lens before it costs the writer a file. Failing that, tighten `lexicalTermCharacters` / `lexicalPhraseCharacters` so the codec's own maximum renders under 3,000 at reach 3. Either way, add a test constructing a lens at the codec's maxima and pinning the intended answer at reach 1 and reach 3.

---

### F-03 · 🟠 High — Completion criterion 1 promises "previews before/after"; no "before" is rendered at all

**Raised by:** Bria · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/services/widgets/LexicalGravityModelService.ts:93` — `` `Source sample (quoted task data): ${JSON.stringify(draft.resolvedLens.sample)}` ``
**Affected contract:** Business — the sprint plan's first Completion Criterion

The criterion reads: *"A writer opens Lexical Gravity, dials a single lens…, **previews before/after**, commits."* Two things diverge. The "before" is not the writer's passage — it is a 2–4 sentence sample baked into each lens definition. And that sample is **never rendered**: the entire preview surface is `WorkshopLexicalGravityModal.tsx:459`, one block containing `preview.text` and the caption *"one fast-tier call · sample pull at {weight}%"*. Verified by exhaustive grep — `lens.sample` is not accessed anywhere in `presentation/`.

So the writer sees a single italic block of unfamiliar prose with no baseline, no diff, and no way to tell what the weight moved. Two previews of different lenses are not even comparable to each other, because each lens brings its own sample.

The corroborating artifact is the unused budget: `promptBudgets.ts:198` declares `lexicalPreviewSourceCharacters: 16_000`, referenced nowhere in `packages/core`, `apps`, `docs`, or `.todo`. The canned sample is bounded at 800. Sixteen thousand characters is a chapter excerpt — someone planned to send the writer's passage and did not.

In fairness: the approved design mock does the same and less — `docs/design/pm-gravity.js:152` renders the preview as `L.sample` verbatim, so "Preview the pull" was always the lens's own sentence. The code implements the design faithfully and captions it honestly. The *criterion* is the artifact that promised more.

This matters because it is the one criterion defining the writer's core interaction, in a feature whose declared harm model is that a durable influence must not be invisible. The writer installs a passage-scoped directive having validated it only against a stranger's sentence.

**Recommendation:** Pick one and write it down. Either (a) wire `lexicalPreviewSourceCharacters` to a bounded slice of the active excerpt and render source-above-result so "before/after" is literally true; or (b) amend criterion 1 to *"previews the pull on the lens's own sample,"* render `lens.sample` above `preview.text` so a baseline exists, and delete the unused constant.

---

### F-04 · 🟡 Standard — Widget-specific rendering and vocabulary live in the most family-generic files `🎯 Consensus`

**Raised by:** Marcus, Parker · **Discovery:** 2 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigOperations.ts:4-6` — *"each widget owns only how its draft is copied and summarized. Adding another widget family extends this registry instead of teaching WorkshopSessionService its shape."*
**Affected contract:** Maintenance — where a second widget family adds its code

This PR wrote down the right rule and then did not follow it three directories over. Three Lexical-Gravity-specific surfaces landed in generic homes:

1. `buildLexicalGravityDirectiveFrame` (`Frames.ts:26-61`) shares a file with the family-generic dispatcher `renderWorkshopStandingDirective` (`:63-75`) — registry and one entry in the same module.
2. `standingDirectiveSummaries()` (`WorkshopSessionService.ts:2410-2438`) teaches the session aggregate Lexical Gravity's draft shape and **reimplements `summarizeLexicalGravityDraft` field for field** — the exact duplication the registry docstring exists to prevent.
3. `standingDirectiveMarkerContent` and `lexicalGravityConfigDisplay` (`:2759-2788`) put the widget's writer-facing vocabulary at the bottom of a 2,950-line aggregate.

Parker traced the consequence from the other end: the writer-facing config string is written twice, byte-identically, in two layers — `WorkshopSessionService.ts:2787` and `WorkshopStandingDirectiveRail.tsx:20` — with no shared formatter. And the family-label pair **already disagrees**: `standingDirectiveLabel` maps `'prose-controller' → 'Prose Controller'`, while `Rail.tsx:26-31` has no such case and falls through to `default: return directive.family`, the raw slug. The duplication did not drift eventually; it arrived drifted.

The codebase already declares an owner. `shared/constants/workshopWidgets.ts:1-12` opens by calling itself *"the single deterministic source for widget ids ↔ labels ↔ rails ↔ availability… so none of the three can drift,"* carries both labels, and exports `workshopWidgetLabel(id)` — already used by the sibling handler and the widgets modal. `WorkshopSessionService.ts:60` already imports `workshopToolLabel` from the parallel registry.

**Recommendation:** Move `buildLexicalGravityDirectiveFrame`, the marker strings, and the summary mapping into `lexicalGravity/`, and reduce `renderWorkshopStandingDirective`, `standingDirectiveMarkerContent`, and `standingDirectiveSummaries` to pure dispatch — the shape `WORKSHOP_WIDGET_CONFIG_OPERATIONS` already has. Have `standingDirectiveSummaries` call `summarizeLexicalGravityDraft` rather than restating it. Replace both label switches with `workshopWidgetLabel(directive.widgetId)` (the `family === widgetId` invariant guarantees they agree), and extract one shared `formatLexicalGravityConfig(...)`. Net line reduction, and it retires three of the six things Sprint 03 was otherwise going to copy.

---

### F-05 · 🟡 Standard — A generated lens subject is a one-shot resource, and nothing tells the writer `🧭 Corroborated Runway`

**Raised by:** Sam, Bria · **Discovery:** 2 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/WorkshopLexicalGravityHandler.ts:206` — `this.latestBuild = undefined;` and `:159-162` — `if (existingLens) { this.latestBuild = undefined; … return; }`
**Affected contract:** Business rules the code decided on the product's behalf; Completion Criterion 4

Four mechanisms compose into one rule that appears in no plan, ADR, or epic: **one build per subject, one save from it.**

Build `falconry` → three takes. Select take 2, save → `falconry.json` written, `latestBuild` cleared, and the modal's success effect clears `buildToken`, so the candidate list **unmounts in the same frame as the success chip**. Takes 1 and 3 vanish with no warning. Rebuild `falconry` → `findForQuery` hits the file just written → short-circuit, no candidates, no model call, and **no message explaining why**. The only escape is the file explorer; there is no rename or delete route among the eight Lexical Gravity message types.

Bria traced a second manifestation independently: closing the sheet calls `clearTransientResults()` and a reopened sheet mints a fresh token, so `handleSave`'s `generated.token === token` check makes the retained build permanently unaddressable. **Cancel discards a paid generation**, and the only recovery is paying again. The ADR promises *"Cancel/Esc costs nothing, and only the commit pays"* — true for conversation context, false for tokens.

This is the combination case, not a scope complaint: commit `2a02727` made *partial* selection a first-class action, and partial selection is precisely the one that loses work.

**Recommendation:** Keep `latestBuild` and the candidate list alive after a successful save so a partial selection can be topped up, clearing only on close or a new build; or lift `buildToken`/candidates into `useLexicalGravity` so a reopened sheet re-addresses the retained build. Surface the `handleBuild` short-circuit as *"falconry is already in your project lenses — rename or delete it to regenerate."* If the one-shot lifecycle is intended, say so in the option-actions caption and add it to the plan's locked decisions.

---

### F-06 · 🟡 Standard — The acceptance surface drifted in both directions `🧭 Corroborated Runway`

**Raised by:** Stan, Bria · **Discovery:** 2 runway-prompted · **Confidence:** High
**Evidence:** `git show 2a02727 -- .todo/…/02b-lexical-gravity-standing-rail.md` — `- writer chooses one. Only the chosen validated lens is written to` / `+ writer selects one or more and saves the selected set in one action.`
**Affected contract:** The plan's function as an independent acceptance surface

**Forward drift.** Commit `2a02727` changed the behavior single-select → multi-select *and*, in the same commit, rewrote the sprint's locked decision, ADR decision 6, the epic's decision 8, and the design catalog. Nothing is concealed — all four edits are in the diff. But for that decision, plan and code are now one artifact.

What makes this actionable rather than philosophical: **the project already has an amendment convention and it was not used.** The ADR's Status line is a dated ledger, used twice before — *"Accepted — 2026-07-29; Gesture Dictionary… amendments accepted 2026-07-29; Lexical Gravity Spread 02… amendments accepted 2026-07-31"* — and `git log -L` shows that third clause was added by the *planning* commit `462d872`, before any code. `2a02727` edited decision 6's body and left Status untouched.

**Backward drift.** Four documents are now factually wrong:

- `.todo/tech-debt/2026-07-31-widget-config-counter-integrity.md` reads `Status: Identified`, but `WorkshopSessionStateV1Integrity.ts:43` is verbatim its Recommendation. The fix shipped; the ledger cannot tell anyone. The entry's own completion criteria also ask for negative/fractional/unsafe counter boundary tests, which do not exist — so the guard shipped unprotected, and the new `standingDirective` counter at `:44` has the identical gap.
- `.todo/tech-debt/2026-07-30-workshop-widget-local-codecs.md` predicts conditions that are now both true; three of six boxes are satisfied and none are ticked.
- `.todo/tech-debt/2026-07-25-workshop-god-files.md` records counts (~2,743 / ~2,922) that head has passed (2,950 / 2,959). The entry exists to track a trend and no longer shows it.
- Deliverable 9 requires a *"Settings-default isolation"* test for a setting that does not exist — no `proseMinion…lexicalGravity*` contribution in the manifest, defaults hardcoded at `WorkshopLexicalGravityModal.tsx:97-100`. The governing decision said Settings *may* retain values, so this is a permitted scope cut with a stale requirement.

For a solo project this matters more, not less: there is no second party whose job it is to notice the specification moving to meet the code.

**Recommendation:** Add a dated clause to the ADR Status line recording the multi-lens amendment. Close the counter-integrity ledger to `.todo/archive/tech-debt/` *after* adding the boundary tests in the shape of `WorkshopPersistedSession.test.ts:75`. Tick the satisfied codec boxes, refresh the god-file counts, strike deliverable 9's Settings line, and amend deliverable 1 to name `directives/WorkshopStandingDirectiveFrames.ts` with its one-line reason.

---

### F-07 · 🟡 Standard — Lens provenance is stamped on the two paths the host authors and not on the one it reads

**Raised by:** Patricia · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/infrastructure/storage/LexicalGravityLensRepository.ts:196` — `return validateLexicalGravityLens(JSON.parse(raw));`
**Affected contract:** Security — the writer's only signal distinguishing audited starter content from arbitrary disk content that becomes system-prompt text

The host is careful on both paths it authors: `LexicalGravityModelService.ts:141` and `LexicalGravityLensRepository.ts:117` both force `source: 'project'`, so a model cannot choose its own identity. `readLens` does not. It parses and shape-validates, and `assertLexicalGravityLensShape` accepts `source` as an open two-value enum. Nothing re-stamps it, and nothing checks the declared `slug` against the filename.

Trace: a file at `prose-minion/lenses/anything.json` declaring `{"slug":"photography","source":"built-in",…}` is returned by `list()`; `handleRequestLenses:101-102` merges project lenses **over** built-ins keyed by slug, replacing the real Photography entry; the picker renders it with no `project` badge (`Modal.tsx:329` is conditional on the file's own claim); and its body resolves into `resolvedLens`, passes `validateLexicalGravityDraft`, lands in session config, and is rendered into every persona **system** message.

Patricia's weighting is what makes this more than a mislabeled badge: at reach 3 with metaphor on, the file-authored portion is roughly **2,790 of the 3,000-character budget**. The per-field `quote()` truncation exists to fit the budget, not to bound instruction content. The real mitigations against a hostile lens are exactly two — delimiter neutralization, which works correctly, and the writer knowingly selecting the lens. This removes the second. And lenses are *designed* to be shareable, repo-committed resources, so pulling a collaborator's branch inherits their lens directory.

**Recommendation:** Stamp on read as you do on write — `validateLexicalGravityLens({ ...JSON.parse(raw), source: 'project' })` at `:196`. One line, matching both sibling paths. Optionally refuse a project lens whose declared slug shadows a built-in, so the six starters cannot be replaced; that is a separate decision and can follow.

---

### F-08 · 🟡 Standard — Two renderers over one join; the live and restore paths disagree on frame order

**Raised by:** Marcus · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveFrames.ts:82-92` — `session.getStandingDirectives().filter((directive) => directive.family !== omitFamily)` … `if (replacement) {renderings.push(replacement);}`
**Affected contract:** Data/operational — the persisted session must reconstruct the prompt the live session runs

Two functions in one file perform the same join (directive → config by id, throw when absent) over two sources. They also disagree on ordering. Shift the *first* of two active directives `[A, B]`: the live path filters `A` out and pushes the replacement last → `[B, A']`. The ledger's `prepareUpsert` replaces **in place**, so the exported state holds `[A', B]`, which is what the restore path renders. Same directives, different prompt order — a reload silently reorders two standing prose directives with no writer action.

Unobservable today at one family. The tell is in the test that certifies the equivalence: `WorkshopStandingDirectiveService.test.ts:187` asserts `expect(frames).toHaveLength(1)`. The invariant is verified exactly where it cannot fail, and Sprint 03 is the release that makes it fail.

**Recommendation:** Collapse to one renderer. The ledger already prepares the complete next directive list — render from `preparedDirective.state.directives` instead of reconstructing by filter-and-append, and let both paths share a single `renderStandingDirectiveFrames(directives, configs)`. Removes the second join, the second throw, and the ordering divergence together; it is smaller than the code it deletes.

---

### F-09 · 🟡 Standard — Every fail-loud path added in this PR is asserted only where it cannot fail

**Raised by:** Cal · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:246-330` — the five-way directive↔config linkage check
**Affected contract:** Data/persistence integrity — the contract that a corrupt restore is loud rather than quietly wrong

Roughly 75 new lines of integrity validation raise nine distinct throws: duplicate directive id, duplicate family, `pd-N` malformation, the five-way linkage check, a standing counter trailing an existing id, an incoherent `standingDirectiveChange`, a thread-rail commit carrying a standing change, a `standing_directive_change` turn lacking metadata, and a config spanning both rails. Greps across `__tests__` for every one of those error strings return nothing. The only path reaching this code is `hydrateCommittedState` via `WorkshopStandingDirectiveService.test.ts:126-131` — with a single, perfectly coherent directive.

The concrete mutation the suite cannot detect: delete `|| directive.family !== directive.widgetId` from line 316, or flip `config.revision !== directive.revision` to `===`. All 210 tests still pass.

The sibling rail sets the standard next door: `WorkshopWidgetConfigs.test.ts` carries eight ingress-rejection tests plus two `it.each` mutation tables for thread-artifact integrity. Same author, same file family, same validator — one rail got a negative table, the other got nothing.

**Recommendation:** One `it.each` table in the shape of the existing `:331` table — export a state with one installed directive, apply one mutation per case, assert `parseWorkshopSessionStateV1` throws. Five cases cover it: revision drift, `directiveId` unlinked, family/widgetId divergence, duplicate family, counter trailing `pd-1`.

---

### F-10 · 🟡 Standard — An overloaded negative fixture short-circuits, leaving the single-lens invariant unasserted

**Raised by:** Cal · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/__tests__/…/LexicalGravityConfigCodec.test.ts:20-37` — `it('rejects unknown fields, mismatched slugs, duplicate terms, and bad control steps', …)`
**Affected contract:** Test contract — four rules named, one evaluated

The third fixture violates three rules at once: `weight: 63`, `reach: 4`, and `lensSlug: 'music'` against a Photography `resolvedLens`. `assertLexicalGravityDraftShape` checks in source order — weight at `:123-130` fires first and short-circuits. Reach is never evaluated. The slug mismatch is never evaluated.

That third rule is not incidental. `if (draft.resolvedLens.slug !== draft.lensSlug)` at `:137-139` is the structural enforcement of the locked decision *"Single lens only this sprint."* Delete it: 210 tests pass. Delete the reach check: 210 tests pass, and a reach of 4 flows into `Frames.ts:31` where `.filter(degree => degree <= draft.reach)` silently renders all three degrees while the persisted config carries a value the shape union does not describe.

**Recommendation:** Split into three single-violation fixtures, each asserting its own message. Three lines, and the single-lens invariant becomes something Sprint 04 must consciously change rather than quietly delete.

---

### F-11 · 🟡 Standard — `remove-standing` action results have no consumer, so the kill switch fails silently

**Raised by:** Oliver · **Discovery:** 1 independent · **Confidence:** Medium
**Evidence:** `packages/core/src/presentation/webview/components/workshop/WorkshopLexicalGravityModal.tsx:208` — `if (!applying || !actionResult || actionResult.action !== 'apply-standing') {return;}`
**Affected contract:** Operational — the invariant "the writer can always remove it in one action"

`handleRemove` posts a `WORKSHOP_WIDGET_ACTION_RESULT` on both success and failure; `useLexicalGravity` stores it. The only consumer is the modal — which is mounted only when a config sheet is open, while removal is triggered from the rail with the modal closed. And even open, line 208 filters to `'apply-standing'`. The only other occurrence of `'remove-standing'` in `packages/core/src` is the type union itself.

So: the writer clicks X on the amber strip. If removal throws, the strip stays exactly where it was — no toast, no inline alert, no marker. The reasonable conclusion is "the button didn't register," so they click again. The only record is one Output Channel line.

Reachable throws are narrow but real: `assertBetweenRuns` throws `'A Workshop response is still running.'`, and the rail's guard uses `showLiveTurn`, webview-derived state that lags the host's `activeRequestId` by a round trip. `ConversationManager.replaceSystemMessages` also fails closed on a missing conversation or a displaced system message — correctly, by design, but those rejections have nowhere to land either. Medium confidence on the trigger window; the wiring gap itself is certain.

This same gap absorbs the no-op case (`{removed:false}` reported as `ok:true`), which is why it is one finding rather than two.

**Recommendation:** Route `remove-standing` results to a surface that exists when the rail does — the composer's error channel or a transient inline message on the rail row.

---

### F-12 · 🟡 Standard — The standing-directive lifecycle writes nothing to the Output Channel on success

**Raised by:** Oliver · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveService.ts:31-34` — the constructor takes no `LogSink`
**Affected contract:** Operational — diagnosability

No logging exists anywhere in `application/services/workshop/directives/`. The handler takes a `LogSink` but uses it only on the error path. So install, shift, and remove — the three events that change what every persona is told for the rest of the session — succeed in silence.

Both nearest siblings log theirs, for changes strictly *less* durable: `WorkshopWidgetHandler.ts:374` writes `Widget commit staged (${config.id} → ${artifactId}…)` for a single-turn commit, and `WorkshopConversationSettingsService.logSettingsApplied` prints every applied value. The `markDirty('Lexical Gravity installed')` reason is not a substitute — the persistence coordinator prints `reason` only when autosave is *skipped*.

**Recommendation:** Three `appendLine` calls in the sibling format, ideally from the service with an injected `LogSink`: `[WorkshopStandingDirective] lexical-gravity installed (pd-3 → wc-7, rev 1, lens=falconry, weight=60, reach=2, frame=2184 chars)`. The `frame.length` field is the highest-value one — it is what makes F-02 predictable instead of surprising.

---

### F-13 · 🟡 Standard — No artifact lets the writer reconstruct what the directive actually said

**Raised by:** Oliver · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/directives/WorkshopStandingDirectiveFrames.ts:21-22` — `values.slice(0, 5).map((value) => quote(value, 32)).join(', ')`
**Affected contract:** Operational — the harm model the sprint plan states explicitly

Identity provenance is genuinely good: stable `pd-N`, revisions, clickable markers, the amber strip, and markers that survive reload as ordinary turns. But the writer's real question is not "is a gravity active" — it is "why did my prose come out like this," and nothing answers it. `buildLexicalGravityDirectiveFrame` has exactly two callers, one of them a test; `WorkshopStandingDirectiveSummary` carries four scalars and no text.

The part that makes this more than philosophical: **the lens file on disk is not the directive either.** The codec admits up to 12 terms per bucket at 80 characters; `terms()` ships the first **5**, each cut to **32** — mid-word, no ellipsis. A writer doing everything right, opening `prose-minion/lenses/falconry.json` and reading carefully, still cannot tell which five of twelve nouns were sent. For model-generated project lenses — the whole point of the second commit — the content is authored by a model, reviewed once in a modal, then frozen and silently down-sampled at render.

**Recommendation:** A collapsed disclosure in the modal — "What the room is told" — rendering `buildLexicalGravityDirectiveFrame` for the current draft. Pure function of the draft, deterministic, already budget-checked, no new state, no tokens, no message contract. It also makes `reach` legible: the writer watches degree lines appear as they raise it.

---

### F-14 · 🟡 Standard — The widest contract has the narrowest owner, and `MessageRouter` makes that a restructure

**Raised by:** Marcus · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/handlers/domain/WorkshopLexicalGravityHandler.ts:80-87` and `MessageRouter.ts:32-34` — `if (this.handlers.has(messageType)) { throw new Error(\`Duplicate handler registration…\`); }`
**Affected contract:** API/maintenance — ownership of the standing-rail IPC surface

Three layers disagree about how generic this rail is. The message contract is family-neutral (`WORKSHOP_APPLY_STANDING_WIDGET` carries a `widgetId`). The service method is family-named (`applyLexicalGravity`). The handler is family-named and owns both generic routes — then narrows them at runtime with `if (message.payload.widgetId !== 'lexical-gravity') throw`.

Because `MessageRouter.register` throws on duplicates, a `WorkshopProseControllerHandler` cannot register the same types. Sprint 03 cannot *extend* this seam; it must move the routes, touching this handler, the composition-root wiring, and the tests. The cousin feature does not exercise the seam — it reveals the seam was drawn around one case.

The declared narrowness is not the issue; the mismatch between claimed and delivered generality is. And the fix is nearly free: `applyLexicalGravity` contains four `'lexical-gravity'` literals and already calls `prepareWidgetConfigCreation({ widgetId, draft })`.

**Recommendation:** Generalize the service method now — one file, one test file — so the coordinator matches the ledger it sits on. Parker's variant is worth considering: a discriminated request object (`apply({ family, draft, widgetConfigId? })`) makes Sprint 03 a union member rather than a forty-line twin. Leave route ownership as a *recorded* Sprint 03 decision — one line in Out of Scope turns a latent restructure into a scheduled one.

---

### F-15 · 🟡 Standard — A docblock states a must-not-throw invariant the code does not hold

**Raised by:** Blake · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/WorkshopSessionService.ts:1089-1092` — *"Callers prepare every possibly throwing value first; this install path is sync."*
**Affected contract:** Maintenance/operational — the invariant keeping provider history and session state in agreement

Three statements inside the block can throw after the awaited prompt replacement resolves: `installPreparedMutation` (`Stale widget config creation`), `standingDirectiveMarkerContent` at `:2770`/`:2776` — constructed *inside* the block, after both ledgers move, and the one value the caller does not prepare — and `recordCommit` (`Unknown widget config`).

Blake traced all three and **could not reach any today**: the apply path always installs a matching config first; the shift path guarantees the prior config; the removal path returns before either check. The only interleaving reaching the staleness assert needs a concurrent widget commit inside the single `await`, and `registerMutation` is a session-operation guard, not a queue — so it is the single-panel-single-modal UI shape, not a structural guarantee, that makes it unreachable.

Not a blocker. But the state it *would* leave is exactly the sprint's named harm: every persona prompt carrying the `<prose-directive>` block while the session holds no directive, no strip, no marker, and `remove()` returning `{removed: false}` because there is nothing to remove. Invisible influence with no kill switch — and the comment says it cannot happen, in a method Sprint 03 will copy.

**Recommendation:** Hoist the marker-content construction above the installs. On the upsert path `currentConfig` is `preparedConfig.config`, already in hand — no install needed to compute the string. Makes the comment true for the one value it is currently wrong about, at zero cost.

---

### F-16 · 🟡 Standard — One business rule stated five times, four executable and one as English prose

**Raised by:** Parker · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/utils/workshopWidgetRecommendation.ts:26` — `'…weight must be 10–100 in steps of 5; reach is 1, 2, or 3…'`
**Affected contract:** Business rule + maintenance

"Weight is 10–100 in five-point steps; reach is 1, 2, or 3" is encoded in the draft codec, the seed codec, the recommendation parser, the recommendation *instruction prose*, and the modal's range inputs. Four fail loudly on mismatch. The fifth is a sentence addressed to a model: if it drifts, nothing fails — the parser simply starts rejecting seeds the persona was told were legal, and recommendations silently stop appearing.

Parker argued both sides. **For duplication:** the codec guards persistence/IPC and the parser guards model output; both must fail closed independently, and `workshopWidgetRecommendation.ts:10-13` documents a real layering reason — the instruction rides an envelope assembled in infrastructure, which must not import application. The parser genuinely *cannot* import the codec. **Against:** defense-in-depth argues for independent enforcement *points*, not independently authored *predicates*; two call sites of one shared predicate are still two enforcement points. And both files already import from `promptBudgets` and `workshopWidgets` — a layer-legal shared home exists and is already on both import lists. The prose copy settles it: you cannot defend as intentional redundancy a rule whose fifth statement is unverifiable English.

**Recommendation:** Add `LEXICAL_GRAVITY_WEIGHT`/`LEXICAL_GRAVITY_REACH` plus predicates to `@shared/constants/workshopWidgets.ts`. Call them from both codec branches and the parser, derive the modal's `min`/`max`/`step`, and interpolate them into the instruction string so the sentence the persona reads is generated from the constants the parser enforces.

---

### F-17 · 🟡 Standard — The second widget-local codec has a different shape from the first

**Raised by:** Stan · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `packages/core/src/application/services/workshop/widgets/WorkshopWidgetConfigOperations.ts:19-28` — clone imported from `lexicalGravity/LexicalGravityLenses`, summary from `lexicalGravity/LexicalGravityConfigCodec`
**Affected contract:** Maintenance — the canonical example for widget #3

The new `lexicalGravity/` directory is a defensible answer to PR #97 finding #9's deferred directory question. The divergence is *inside* it. `GesturePlaygroundConfigCodec.ts` owns all six codec responsibilities in one module — shape, source-reference rules, seed shape, **defensive clone**, **summary**, checkpoint normalization. `LexicalGravityConfigCodec.ts` owns shape, seed, validate, and summarize — but not the clone, which lives in `LexicalGravityLenses.ts`, a module otherwise holding the built-in catalog and the slug helper.

The codebase wrote the rule down: `.todo/tech-debt/2026-07-30-workshop-widget-local-codecs.md:31-37` — *"A widget-local codec owns: bounded shape validation **and defensive cloning** of its draft/config…"* The seam this PR is the first proof of is now wired from two modules on one arm and one on the other, and the repository pays the same two-import tax.

**Recommendation:** Move `cloneLexicalGravityDraft`/`cloneLexicalGravityLens` into `LexicalGravityConfigCodec.ts` so the codec matches its sibling and the debt entry's own definition; leave `LexicalGravityLenses.ts` as catalog + slug. Do it while the seam has one consumer.

---

### F-18 · 🟡 Standard — A duplicated message-regex error classifier, and the tracked debt names only one site

**Raised by:** Stan · **Discovery:** 1 independent · **Confidence:** High
**Evidence:** `LexicalGravityLensRepository.ts:211` — `/(?:ENOENT|FileNotFound|not found|does not exist)/i` vs `WorkshopSessionStore.ts:1038` — `/ENOENT|not found|unseeded path/i`
**Affected contract:** Maintenance

`infrastructure/storage/` holds four files; two of them classify filesystem errors by matching prose against a regex, and the two alternation sets already differ — the store knows `unseeded path` (the in-memory test provider's wording), the repository knows `FileNotFound` and `does not exist`, and neither knows the other's. `.todo/tech-debt/2026-07-27-filesystem-missing-error-contract.md` exists for exactly this, with the completion criterion *"Replace storage-layer message regexes with the stable contract"* — and its Related-files list names only `WorkshopSessionStore.ts`. As of this PR that list is wrong, so whoever picks it up fixes one site and leaves the other.

**Scope correction — this finding is narrower than originally raised.** Stan also flagged the absent `isPathWithinRoot` chokepoint. Patricia inspected it and refuted that half: `saveManyForQuery` runs its slug through `validateLexicalGravityLens`, whose `SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` must pass **before** `path.join` is reached, so a kebab slug with no dots or separators cannot escape by construction. That is a *stronger* posture than the sibling's post-construction containment check. The consistency observation survives — a reader comparing the two files cannot tell which states the house rule — but it is not a security gap and is not counted as one.

**Recommendation:** Lift both predicates into a shared module in `infrastructure/storage/`, or fold them into the tracked `FileSystem`-port contract now. At minimum, add `LexicalGravityLensRepository.ts` to the debt item's Related-files list. If the containment asymmetry is ever "fixed for consistency," add a comment at the `path.join` first — the regex is the guarantee, and a later reader may not see that.

---

### F-19 · 🟡 Standard — The widget recommendation contract is an unconditional per-turn token tax that grows once per widget

**Raised by:** Tim · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:876` — `return [systemPrompt, ...directives, WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION].join('\n\n');`
**Affected contract:** Operational — recurring inference cost per persona turn

The numbers set the severity honestly. The instruction measures **4,094 characters ≈ 1,024 tokens** by the project's own estimator, up from 3,525 ≈ 881 at the epic base — **+142 tokens, a 16% increase** from this PR. It rides message[0] of every retained persona conversation, capped at 3 conversations, so ~3,072 input tokens per full turn, ~11% of a representative persona system message. The Lexical Gravity directive itself is far cheaper: all six built-ins render to 1,601–1,669 characters at reach 3, about 4%.

So this PR's increment is a rounding error, and the finding is about shape:

1. **It is unconditional.** `isLiveWorkshopWidgetId` gates *parsing*, never the instruction text. The registry declares 14 widget concepts, 2 live and 12 not — nothing prevents advertising a widget the parse would reject.
2. **Growth depends on seed shape, and Gesture is the expensive precedent.** Gesture's block is 2,954 of the 4,094 characters (72%) because four prose fields need prose guidance; Lexical Gravity's is 277 because its seed is four scalars. The cheap shape is the one this PR introduced — genuinely good news — but the established pattern is "every new widget appends to one monolithic literal."
3. **Its section budget is not a spend control.** `maximumSectionCharacters` is computed from six *gesture* budgets (~14,700 chars) and applied unchanged to the Lexical Gravity path, whose four scalars need ~100. It runs against output already generated and billed, so it rejects but never saves.

**Recommendation:** Follow-up, not this PR. Assemble the instruction from per-widget fragments driven by the registry's `live` flag, so a widget's prompt cost is declared next to its registration and dead widgets cost nothing. Give the Lexical Gravity path its own section ceiling.

---

### F-20 · 🔵 Nit — `'falconry'` is a design-mock fixture in shipping state, and it makes the placeholder unreachable

**Raised by:** Parker · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `WorkshopLexicalGravityModal.tsx:105` — `const [lookup, setLookup] = React.useState('falconry');`

Provenance is recoverable: `docs/design/README.md:117` names *"the drafted-lens fixture (`LG_LOOKUP`, falconry)"* and the design spread says *"Try building the falconry lens."* It is the mock's demo string promoted to a React state default and re-asserted on every modal open at `:131`.

The component now makes two contradictory statements. `placeholder="Look up or invent a lens…"` says *this field starts empty* — and is dead code, because `value={lookup}` is never empty. Meanwhile the Build guard is `!lookup.trim()`, so the button is **enabled the moment the modal opens**, primed to spend a model call on a word the writer never typed. The sibling settles the convention: `WorkshopGesturePlaygroundModal.tsx:102-105` initializes every free-text input to `''`. The modal's own test locates the input by a placeholder the running app never shows, then overwrites the value — so it passes identically either way.

**Recommendation:** `React.useState('')` and `setLookup('')`. The placeholder becomes visible, the button starts correctly disabled, the test is unaffected.

---

### F-21 · 🔵 Nit — `list()` awaits in a loop and gates zero-cost built-ins behind the project walk

**Raised by:** Tim · **Discovery:** 1 runway-prompted · **Confidence:** High
**Evidence:** `LexicalGravityLensRepository.ts:74-77` — `for (const [name] of files) { const lens = await this.readLens(...); … }`

`1 readDirectory + N × (stat + readFile)` = 2N+1 sequential round trips. At a realistic library of 1–50 files that is tens of milliseconds and **does not matter**. The structural part does: `handleRequestLenses` awaits `list()` before posting anything, so the six built-in lenses — pure in-memory data, zero I/O — do not reach the webview until the project walk completes, and until they arrive both Preview and Install render disabled. `onRequestLenses()` fires on every modal open.

Raised only because the fix is three lines and the file already uses `Promise.all` for this exact shape three times in `saveManyForQuery`. The read path is the only place in the file that awaits in a loop.

**Recommendation:** `const lenses = (await Promise.all(files.map(([name]) => this.readLens(...)))).filter(Boolean)`.

---

### F-22 through F-25 · 🟢 Praise

**F-22 · Deterministic exploration is genuinely zero-token, and both paid seams are single-flight and abortable** *(Tim)*. The obvious implementation fires a model call on every dial; this one does not, structurally. Dragging weight 10→100 fires 18 `onChange` events and zero tokens, each calling `invalidatePreview()`. Only `buildLenses` and `preview` touch an engine, both aborting their predecessor before minting a new controller, both aborted by `dispose()`. A double-click cannot produce two billed calls. `lexicalBuildOutputTokens: 8_000` against ~946 tokens of actual candidate output is 8× headroom on a seam billed by output. **Keep this as the Sprint 03 template — "free until the writer names a price," with the four-scalar seed being what makes it affordable to advertise.**

**F-23 · The webview→host boundary is closed end to end, and the path layer is stricter than its sibling** *(Patricia)*. Patricia tried to find a webview-supplied value reaching a file write or the prompt without passing the codec, and could not. `handleSave` accepts `candidateIds` only, pinned by token, trimmed query, and set cardinality, then maps ids to host-held bodies — no lens body round-trips. `handleApply` fail-closes on `widgetId` then validates the draft, and the forwarded `widgetConfigId` is checked against the *active* directive so an arbitrary id cannot retarget a foreign config. Validate-before-`path.join` beats post-hoc containment. `persistedValidation.objectAt:59` requires `Object.getPrototypeOf(value) === Object.prototype`, so a crafted `__proto__` is rejected as an unknown key; `shapeError` never echoes the offending value, so an invalid lens file cannot use the diagnostic as a log-injection channel. **Preserve the candidate-ID seam and the validate-then-join ordering verbatim when Sprint 03 forks this handler.**

**F-24 · The persona recommendation seed is a closed enum, and it is load-bearing** *(Patricia)*. Restricting `lensSlug` to six host-owned built-ins keeps every project-file body behind a deliberate writer selection. Widen it and a persona — itself steerable by anything in the context window, including an already-installed hostile lens — could prefill the writer's modal with a specific file, degrading the gate from "the writer picked this lens" to "the writer accepted a chip." The four-scalar seed shape reinforces it: a persona can never contribute a `resolvedLens` body at all. **Keep it closed, and add a one-line comment saying it is a trust-boundary allowlist and not a convenience copy, so a future "DRY this up" refactor doesn't quietly widen it.**

**F-25 · Two exemplary tests** *(Cal)*. The staged-install pair (`WorkshopStandingDirectiveService.test.ts:40-92`) gates the replacement promise to assert the session is still empty mid-flight, then asserts a *rejected* replacement leaves no config, no directive, and no counter burn — proved by the retry landing on `wc-1`/`pd-1`. And `LexicalGravityLensRepository.test.ts:131-147` fails the **second** rename, so rename #1 is already in `published` — exercising the published-file unwind rather than just temporary cleanup. Most rollback tests in this class fail on the first operation and prove nothing. **Copy this pattern.**

---

## What the Panel Changed About the Runway

The runway was written before any reviewer ran and handed to all ten as a testable map. Four of its claims did not survive contact with the code.

**Rejected — the frame builder's home.** The runway questioned `buildLexicalGravityDirectiveFrame` landing in `directives/` when the sprint plan and PR #96's review both point at `WorkshopPromptBuilder`. **Marcus and Stan independently rejected it.** `WorkshopThreadArtifactFrame.ts` is standing precedent for a frame module beside its concept — and is itself imported *into* `WorkshopPromptBuilder`. PR #96's finding was about dependency *direction* (infrastructure → application), which this does not repeat. The **plan** is the stale artifact; the code is right. That correction is folded into F-06.

**Rejected — "contained to one file."** The runway called the message-regex classifier a contained wart. Stan showed it is the second copy in a four-file directory with a tracked debt item naming only the first. Now F-18.

**Rejected — prompt-cache economics.** The runway argued the design "pays complexity to protect cache economics," citing the plan's "same cache cost class as a mode change." Tim found **zero** `cache_control` / `cacheControl` / `prompt_cache` hits across `packages/core`, `resources`, and the extension; the request bodies emit no cache breakpoints, and the default model family requires explicit ones. There is no prompt cache to protect. The two-queue topology is bought by the between-runs guard and auditability instead — which the runway's own "boring alternative" paragraph got right. *(Medium confidence on the provider half, which is an external contract.)*

**Rejected — slug ownership.** The runway said "selection order determines which take owns the canonical name." Sam and Bria independently showed click order is discarded twice — the webview normalizes to candidate order and the host re-filters in the same order — so it is the first *model-emitted* take among those selected. Worse than the runway stated, since the writer has no lever at all. Folded into F-01 and F-05.

**Refined — `prose-controller` reachability.** The runway flagged the shape validator accepting a family the reader throws on. **Cal and Blake independently closed it as not material:** a `prose-controller` directive requires a config with that `widgetId`, and `assertWidgetConfig` rejects it at `Shape.ts:356`, so no such checkpoint can load. Blast radius today: nil. What is untested is the generality claim, not reachable behavior.

**Refined — the budget question.** The runway hedged that the codec's bounds made the budget throw "plausibly unreachable." Four reviewers' arithmetic went against it. Now F-02, and the crossover is at reach 2, not reach 3.

**Refined — nested queues.** The runway asked what the nesting buys. Marcus answered rather than flagged: the outer queue guards prepare→commit, the inner guards prompt-batch exclusivity against behavior edits. Without the outer, two concurrent applies would each compute a revision from the pre-commit ledger and the second would silently discard the first's increment. Two distinct critical sections, correctly ordered outer→inner, no path from inner back to outer. Defensible — and now a lock ordering someone should know about.

**Affirmed.** The orthogonality wall is half structural, half prose: no write path reaches persona identity, tool sidecars are structurally excluded, and persona dormancy is a sentence addressed to a model. The family-generic-state / single-family-coordination split. Rebuild-from-config over stored-frame. That the PR is primarily infrastructure with the feature as its proof load.

---

# Part III — Lessons & Horizon

## Sensei's Lessons 🎓

### Lesson — The strictest gate is the real definition of "valid"; every looser one upstream is only a promise

**Illuminated by:** F-01 (Sam, Blake), F-02 (Blake, Cal, Sam, Patricia), F-05 (Sam, Bria)

Two guards inside one feature disagreed about what a lens is: the codec admits a shape the frame builder refuses, and the slug validator checks both ingredients but never the composed name that actually gets stored. Validation attached itself to the parts rather than to the value — and when a value passes through more than one gate, the strictest gate is the definition; every more permissive gate above it is an invitation the system can't honor. What makes these High rather than tidy is *where* they fire: after the model call is paid, against a lens file with no delete route, into a retry that hits the identical wall.

**Carry forward:** For every new throw, ask two questions — "is there an earlier gate that would have waved this through?" and "what has already been spent by the time this fires?" A constraint computable from inputs the writer has already chosen (reach, subject length) belongs upstream of the spend, not downstream of it.

### Lesson — A guard becomes a control the moment a test watches it fail

**Illuminated by:** F-09, F-10 (Cal), F-08 (Marcus)

This change added roughly seventy-five lines of integrity validation raising nine distinct throws, and no test drives any of them — deleting the family-mismatch check outright leaves all 210 green. Nearby, the test certifying that the live and restore paths agree on frame order asserts `toHaveLength(1)`, checking the invariant at exactly the arity where it cannot break, and a negative fixture naming four rules short-circuits on the weight check, so the assertion protecting the sprint's locked "single lens only" decision never executes. A validator with no failing test is documentation with a stack trace: it states an intention rather than enforcing one — and a negative fixture should violate exactly one rule, or it only ever tests whichever rule the code happens to check first.

**Carry forward:** Before merging a new throw, delete it locally and run the suite; green means the test is missing, not that the guard was redundant. And ask where fixtures sit in the input distribution — every lens fixture here lands in the 2,100–2,400 band against a 3,000 cap, comfortably mid-range, which is precisely why the budget edge stayed invisible to four separate test files.

### Lesson — A general mechanism with one instance is a hypothesis, not a layer

**Illuminated by:** F-04 (Marcus, Parker), F-14 (Marcus), F-17 (Stan), F-19 (Tim)

`WorkshopWidgetConfigOperations` arrived carrying a docstring about each widget owning its own clone and summary "instead of teaching `WorkshopSessionService` its shape" — and the same change taught `WorkshopSessionService` its shape three times. That isn't inattention; it's the physics of building a mechanism and its first instance together, where the direct path is always shorter and the generic layer has no second client to push back with. The tell is already on the page: the duplicated family-label switch *disagrees* about `prose-controller` before the branch has even merged. Duplication doesn't drift eventually — it drifts on arrival.

**Carry forward:** Name widget #2 out loud, specifically, with a config shape, then walk every file this change touched and ask "would #2 edit this?" Each yes inside a family-generic file is the abstraction failing its first real test — the same question catches the registry's `live` flag going unconsulted by the prompt path and the second widget codec landing in a different shape from the first.

### Lesson — When the product is legibility, the label is not the thing

**Illuminated by:** F-03 (Bria), F-13, F-11, F-12 (Oliver), F-07 (Patricia)

The rail exists so a writer can see an influence that would otherwise work invisibly on their prose, and it ships that influence's *name* everywhere — chip, badge, amber strip, family label — while the influence itself stays off-screen. The preview renders an "after" with no "before" (`lens.sample` is never read anywhere in `presentation/`), and nothing on screen, in the log, or on disk reconstructs what the directive actually said, since `terms()` publishes five of up to twelve terms truncated to 32 of up to 80 characters. The one label standing unaccompanied is the source badge — which is the file's own word for itself: the host stamps `source: 'project'` on both write paths and then believes whatever the file claims on read. The 16,000-character preview budget, declared and referenced nowhere, is the fossil of the version that showed the writer their own passage.

**Carry forward:** For any feature whose value proposition is visibility, write the 2am question first — "what did it actually say, and where did it come from?" — and name the artifact that answers it. And derive provenance from where a thing was found, never from what the thing says about itself.

### Lesson — Claims with no failure mode are the ones that go quietly wrong

**Illuminated by:** F-15 (Blake), F-16 (Parker), F-06 (Stan, Bria)

`commitStandingDirectiveMutation` carries a docblock stating that callers prepare every possibly-throwing value first and that the install path is synchronous; three statements in it can throw, and the marker string is built after both ledgers have already moved. Nothing reaches it today, and nothing will ever fail *because of the comment* — which is the whole problem, since Sprint 03 will copy the method and inherit the comment's authority into different code. The same shape runs through one business rule stated five times with only four copies executable, and through four documents still describing the world before this PR. In a solo repo the ADR is the nearest thing to a second reader in the room, so when one commit flips single-select to multi-select and rewrites the locked decision, the ADR, the epic, and the catalog in the same breath, the document stops being a check and becomes a mirror — and the record that the decision was once different, along with the reasoning that changed it, is gone.

**Carry forward:** When writing "always," "never," or "this is sync," either encode it as an assertion, a type, or a test — or downgrade the wording to "assumes." And when a commit would change a decision, append a dated amendment rather than editing the decision in place; the value of an ADR is the delta, because the code already holds the current state.

*What ties these together is that the change knew exactly what it was building — a rail, not a widget — and nearly every place it slipped is a place where the second thing hadn't arrived yet: the second widget, the second reader, the second look at a guard nobody had watched fail.*

## Horizon Watchlist

**None of these are merge blockers.** They are pressures the runway and panel supported that do not warrant action now.

- **Sprint 03 route ownership.** `WORKSHOP_APPLY_STANDING_WIDGET` / `WORKSHOP_REMOVE_STANDING_WIDGET` must move to a shared registrar or dispatch internally; `MessageRouter` forbids sharing. Decide before Prose Controller starts, not during.
- **Frame ordering as precedence.** With two families live, does array order carry meaning to the model? If yes, F-08's live/restore divergence becomes semantic rather than cosmetic.
- **`lens-blending` versus `family === widgetId`.** The registry already carries `lens-blending` as a distinct standing widget id (`workshopWidgets.ts:172`) while integrity requires family and widgetId to match. Sprint 04 will have to decide whether that assertion is a fitness function or a fossil.
- **`resolvedLens` frozen at `version: 1` under `exactObject`.** A future per-lens field (Sprint 04 dominance) invalidates old snapshots on read unless the lens gets a version ramp independent of the session `schemaVersion` — the widget-local codec extraction already queued in tech debt.
- **Codec regime.** Whether Workshop widget configs have shipped to Marketplace decides whether the `widgetCommit`/`draft` union changes stay checkpoint-level or require a `schemaVersion` bump under ADR 2026-07-30. Worth answering explicitly before the epic merges.
- **The recommendation literal's growth curve.** ~1,024 tokens on every persona turn today, ungated by the registry's `live` flag, with each new widget appending. Registry-driven assembly is the shape to move toward.
- **The aggregate keeps absorbing growth.** Four Workshop files gained ~500 lines between them while the new feature code stayed small and well-factored. The pressure is landing on `WorkshopSessionService` and `messages/workshop.ts`, not on the new directories.

## The Closer 🚪

> "Knock knock."
> "Who's there?"
> "The-slow-disintegration-of-a-small-coastal-fishing-town-deep-field."
> "The-slow-disintegration-of-a-small-coastal-fishing-town-deep-fie—"
> "Sixty-six characters. I only accept sixty-four."
> "…so nobody's there?"
> "Nobody's there, nothing got saved, and the build's already billed."

## Final Assessment

**Nearly there.** The rail is genuinely built: the prepare-then-install split, the guarded batch prompt swap, the injected config-operations registry, and rebuild-from-config over stored-frame are all sound, and this PR inherits PR #96/#97's hard-won fixes rather than re-earning their bugs. Nothing corrupts data, nothing breaks a contract, and no path reaches persona identity.

What holds it back is a consistent pattern rather than a single defect: **the guards that protect the writer are the ones with no tests, and the failures that reach the writer are the ones with no message.** F-01 and F-02 both burn a paid model call and report a codec field instead of a cause; F-03 leaves the sprint's first completion criterion unmet; and F-09/F-10 mean two separate invariants can be deleted with the suite still green.

Conditions to merge: fix F-01 (one line in `uniqueSlug`), decide and implement F-02 (validate renderability at admission, or tighten the codec bounds), and resolve F-03 one way or the other — wire the passage or amend the criterion and render a baseline. F-04, F-08, F-15, and F-17 are cheap now and materially cheaper than after Sprint 03 copies them. The rest can follow.

---

*Reviewed by Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
*Semantic Runway scouted by Bria, Stan, Marcus, and Sam · Orchestrated and validated by Ada Forge*
