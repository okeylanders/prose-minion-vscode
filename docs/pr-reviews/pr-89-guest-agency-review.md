# MR Review — feat(workshop): Sprint 13C — guest agency (split-sheet pickers, rail divider, participant-owned capabilities)

**Author:** okeylanders · PR #89 · Base: `epic/workshop-editor-tab`

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | Guest capability artifact permanently drops the writer's prompt from the guest→host handoff | Blake | — | **Addressed** — handoff pairing walks backwards past the guest's own private artifacts to the owning writer turn; regression tests assert the writer's prompt is **present** (single and multi-artifact interleavings) and the cursor commits cleanly |
| 2 | 🔴 Blocking | Guest system prompt denies the capabilities its new run policy grants | Blake | — | **Addressed** — `guest-base.md` charter rewritten (bounded instruments, results delivered privately); `analysis-capability.md` now assembled into the guest base; prompt-path test inverted + a charter guard test that fails on any future "no capabilities" denial |
| 3 | 🟠 High | Route matrix documents a policy the guest sidecar no longer takes | Marcus, Stan | 🎯 | **Addressed** — new `resolveWorkshopParticipantPolicy()` is the one named home for the decision; both call sites resolve through it; matrix guest row now names it and points at `workshopHost`; new test pins the runtime branch AND matrix agreement |
| 4 | 🟠 High | `edited` one-way latch defeats the untouched-default soft confirm | Sam | — | **Addressed** — `isDefaultOpening` re-derived from current text vs the generated default; `edited` now governs only rewrite-on-selection; type-then-revert test added |
| 5 | 🟠 High | The one line that stamps the capability principal is asserted by no test | Cal | — | **Addressed** — handler test pins `owner` + `personaId` for host send, guest join, and guest continue |
| 6 | 🟠 High | Principal-guard refusal collapses three failure modes into one log line | Oliver | — | **Addressed** — `describeCapabilityArtifactRefusal()` names `no-active-run` / `request-mismatch` / `principal-mismatch` / `stale-excerpt-version` with the active run's identity; all three refusal-logging callers use it; unit test covers each reason |
| 7 | 🟡 Standard | `isHostThreadTurn` is already the audience policy 13D was to own | Marcus | — | **Addressed (seam only)** — guest-exclusion rule extracted into named `isGuestOwnedCapabilityTurn()` (also reused by the #1 fix); `audience()` itself remains 13D |
| 8 | 🟡 Standard | Principal check gates the record, not the call; `owner` is caller-supplied | Patricia | — | **Addressed** — doc comment now states it is an evidence-admission gate, that the call has already executed, that the closed catalog is the real boundary, and that refusals log loudly |
| 9 | 🟡 Standard | Stale selection survives a lock, enabling launch on an uninvitable card | Sam | — | **Addressed** — selection clears (and an untouched generated opening resets) the moment its card gains a lock; rerender test covers a guest joining under the open modal |
| 10 | 🟡 Standard | Hydration migration's negative case (already-stamped principal) untested | Cal | — | **Addressed** — test hydrates a `personaGuest`-stamped artifact and asserts it survives unchanged with no migration flag |
| 11 | 🟡 Standard | Sprint doc's excerpt-free rationale contradicts the tested invite gate | Bria | — | **Addressed** — the sprint now states the shipped excerpt gate and gives the real reason for neutral default copy: the room transcript + writer opening determine the guest's task |
| 12 | 🟡 Standard | Capability→policy rule duplicated across two call sites | Marcus | — | **Addressed** — merged with #3 into `resolveWorkshopParticipantPolicy()` |
| 13 | 🟡 Standard | `target.kind === 'personaGuest'` evaluated three times in one expression | Parker | — | **Addressed** — `participantOwner` resolved once; gate, speaking persona, and persisted principal all derive from it |
| 14 | 🟡 Standard | `pm-ws-invite-*` classes styling the Choose Host footer | Parker | — | **Addressed** — shared footer chrome renamed to neutral `pm-ws-sheet-actions` / `-cancel` / `-commit(-label)`; invite-only dock classes keep the `pm-ws-invite-*` prefix |
| 15 | 🟡 Standard | Guest turns now carry host-sized token/round budget (~6× worst case) | Tim | — | **Deferred** — intentional per criterion #7; number recorded here and in `.memory-bank/20260726-1530`; sprint-notes line rides Okey's docs pass |
| 16 | 🟡 Standard | Status ticker can't distinguish a host from a guest capability call | Oliver | — | **Addressed** — `speakerLabel()` appends `(guest)` for persona-guest owners on every live status; `owner=` also joins the output-channel log lines |
| 17 | 🟢 Nit | `flashToken` + `flashing` is two states doing one job | Parker | — | **Addressed** — one `flashing` state + ref-held restartable timer |
| 18 | 🟢 Nit | Soft-confirm hint tested by text content, not by `role="status"` | Cal | — | **Addressed** — test asserts the instruction lives inside a `role="status"` region |
| 19 | 🟢 Nit | Persona grid not memoized; re-renders 12 cards per keystroke | Tim | — | **Deferred** — sub-millisecond at 12 fixed personas |
| 20 | 🟢 Nit | `conversationId` added to the capability turn is written by three call sites and read by none | Blake | — | **Addressed** — read by the capability's per-call log line (`conversation=` id, or `fresh`), pairing with #6/#16 forensics |
| 21 | 🟢 Praise | Host run-policy reuse grants guests no extra privilege | Patricia | — | **N/A** |
| 22 | 🟢 Praise | `resource.read` containment remains catalog-bound, not path-bound | Patricia | — | **N/A** |
| 23 | 🟢 Praise | Transcript scans stayed O(turns); every principal-guard call site lines up | Tim, Blake | 🎯 | **N/A** |

## Verification pass — 2026-07-26, at `c1b5ac4`

Blake, Sam, and Cal were sent back in adversarially against their own findings,
briefed to default to "not fixed" unless they could walk the corrected path
themselves. Repo-wide validation re-run independently of the author's claim:
**typecheck clean (3 configs) · lint 0 errors · jest 129 suites / 1402 tests pass**
(+8 tests). CI `verify` green on `c1b5ac4`.

| Finding | Verifier | Verdict |
| --- | --- | --- |
| #1 handoff drops the writer's prompt | 🔥 Blake | **Closed with caveat** — walked the corrected path in a throwaway run; the walk is bounded by the cursor and cannot double-deliver. Caveat below. |
| #2 guest charter denies its own capabilities | 🔥 Blake | **Closed** — confirmed on the *fresh* guest run, not just rehydration; grant and charter now agree. Caveat below. |
| #4 `edited` latch dodges the soft confirm | 🔍 Sam | **Closed** — `isDefaultOpening` re-derives from current text; cross-persona reselect still pins writer edits. |
| #9 stale selection survives a lock | 🔍 Sam | **Closed with caveat** — guard is content-based, so it self-corrects; effect churn noted below. |
| #3 / #5 / #6 / #10 / #12 / #18 test claims | 🧪 Cal | **Verified ×6** — every claimed assertion exists, targets the code path the fix touched, and would fail if the fix were reverted. |

**Caveats carried forward (none blocking):**

1. `'workshop-personas/guest-base.md'` is a hardcoded literal duplicated across
   `AssistantToolService.ts` and `workshopPersonas.ts`, while every sibling
   prompt path is a shared constant. A rename, or a third participant base,
   silently re-opens finding #2. → *Worth a constant next time this file is open.*
2. `locks` re-memoizes every render because `WorkshopApp` rebuilds
   `livePersonaGuestIds` as a fresh array literal, so the new lock effect
   re-fires needlessly. Content-based guard means no misfire; pre-existing
   footgun, not introduced here.
3. The new backward walk skips only the guest's *own* capability artifacts. A
   `session` / `context_change` turn minted mid-guest-run reproduces the original
   symptom. Tracked with the item below.

**Discovered during verification, pre-existing and out of scope:**
handoff cursors advance to the newest *delivered* turn while the frame builder
trims **oldest-first**, so a windowed or over-budget exchange is silently
consumed rather than deferred — contradicting the invariant `commitHostHandoff`
documents from PR #72 review #1. `WorkshopPromptBuilder.ts` and
`commitHostGuestHandoff()` are untouched by this branch. Filed as
[`.todo/tech-debt/2026-07-26-handoff-cursor-advances-past-undelivered-turns.md`](../../.todo/tech-debt/2026-07-26-handoff-cursor-advances-past-undelivered-turns.md)
and pointed at 13D, which replaces this machinery with a single offset-advance
call site.

---

## Blast Radius

- 33 files changed · +1788 / −343 lines
- New files: 6 (3 components, 1 shared grid, 2 test suites) · Deleted: 2 (`WorkshopPersonaBrowserModal` + its test) · Migrations: n/a (no DB) · New services: 0
- Largest surfaces: `workshop.css` (+440), `WorkshopApp.tsx`, `WorkshopSessionService.ts`, `WorkshopHandler.ts`
- **Zero prompt-resource changes** — `packages/core/resources/` is untouched by this PR, which is the root of finding #2

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | B |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | B |
| 🎯 Domain | B− |

*Both blockers sit outside the graded categories by the rubric's reviewer mapping. Read the
grades as "the panel's specialist lanes are in decent shape" and the Executive Briefing as
"the feature does not yet work end-to-end."*

---

## Executive Briefing

🔴 **[Blake]** **A guest capability call silently deletes the writer's prompt — permanently.**
`collectUnseenGuestExchangesForHost` pairs a guest reply with `turns[index - 1]`; this sprint
inserts a `participant: 'tool'` artifact exactly there, so the writer's message fails the pairing
check and the delivery cursor then advances past it. Every guest turn that uses the new feature
drops half the exchange. Proven against the real service.

🔴 **[Blake]** **The guest is handed a capability catalog by a prompt that tells it it has none.**
`guest-base.md` still reads *"You have no tools or Workshop capabilities"*, and the capability
protocol fragment is appended only for the **host** base prompt. Outcome is either an inert
feature or malformed calls that burn rounds and write `rejected` artifacts into the ledger.

🟠 **[Marcus + Stan]** 🎯 **The "one source of truth" route matrix no longer describes reality.**
Guest sidecars are documented as capability-free; the real selection moved into a runtime ternary
duplicated across two call sites, and the guarding test only checks the array's literal shape.

🟠 **[Sam]** **One keystroke and a backspace convinces the modal the boilerplate is "Personalized."**
`edited` is a one-way latch, so `isUntouchedDefault` stays false forever — the chip flips green and
the soft confirm the sprint specifically built never fires.

🟠 **[Cal + Oliver + Patricia]** **The principal guard is the sprint's centrepiece and nothing is
watching it.** The one line that stamps `owner` is asserted by no test (Cal); a mismatch fails
silently and indistinguishably from two benign refusals (Oliver); and `owner` is caller-supplied
rather than derived from the active run (Patricia). Three findings, one root: *the guard's failure
mode is silent and unobserved.*

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — `AGENT_RUN_ROUTE_MATRIX` no longer names one policy per route [🎯 Consensus]

`packages/core/src/infrastructure/api/orchestration/AgentRunPolicies.ts:55` — The matrix's own
docstring calls it "One source of truth for the caller-to-policy matrix," and its guarding test
asserts it "keeps every migrated route on one explicit policy." That invariant is now false for
this row. `AssistantToolService.startWorkshopGuestConversation` (610–613) and `continueConversation`
(665–668) both pick `workshopHost` when a capability is present — and a guest capability is minted
unconditionally for every guest turn now. So in production the guest-sidecar route *always* resolves
to `workshopHost`, the same policy as the host route one line above it. Nothing catches the drift
because the test checks the array's literal shape, not the runtime branch. Someone reasoning about
the system from this file alone — which is precisely its purpose — will conclude guests run
capability-free. Fix: express the conditional in the matrix, or extract the selection into one
named function so there's a single place that has to stay honest.

### 🟡 Standard — `isHostThreadTurn` is doing the audience policy the ADR defers to 13D

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:2234` — The new
`WorkshopCapabilityPrincipal` comment is explicit and, I think, correctly scoped: *"Whether an owner
implies privacy stays a computed policy (13D's `audience()`), never a stored classification."* Good
seam — ownership is a fact, audience is a future policy. But `isHostThreadTurn` is exactly that
policy, arriving early and uncredited. It already governs host-prompt construction, live-guest
catch-up, and the handoff cursor; this PR adds a fourth job. Not a bug — it's tested — but when 13D
arrives to build `audience()`, it will either duplicate this branch or refactor a method four other
things depend on. I'd want the guest-exclusion rule in its own named predicate now, even if
`isHostThreadTurn` is its only caller today, so the seam the comment promises is the seam the code
actually has.

### 🟡 Standard — Capability-presence policy selection duplicated across two call sites

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:610` — The same
rule ("a capability on this turn means `workshopHost`, otherwise `workshopToolWithoutResources`") is
written independently in `startWorkshopGuestConversation` and `continueConversation`, with slightly
different plumbing. Duplicated knowledge, not duplicated text: it's the business rule that made the
route matrix go stale, because there's no single named place that owns *how we pick a Workshop run's
policy*. A `resolveWorkshopParticipantPolicy(capability?)` next to `AGENT_RUN_POLICIES` gives both
call sites one home and gives the matrix something honest to cite.

> *"The bones are fine — but the map in `AgentRunPolicies.ts` is describing a road that got quietly re-paved underneath it, and the guest thread's audience policy is already living rent-free in a method that isn't supposed to have opinions about privacy until 13D moves in."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🔴 Blocking — A guest capability call silently deletes the writer's prompt from the handoff — permanently

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1529` —
`collectUnseenGuestExchangesForHost` pairs a guest response with `this.turns[index - 1]` and only
accepts it if that turn is `participant === 'writer'`. That adjacency assumption was safe until this
PR, because guests had no capabilities and nothing could ever land between the writer's message and
the guest's reply. Sprint 13C now pushes a `participant: 'tool'` capability artifact into
`this.turns` in between. Proven against the real service with a throwaway suite:

- Control (no capability call) → `["Look up liminal.", "Margot reply."]`
- One guest `dictionary.lookup` in the same turn → `["Margot reply."]`

The host receives an orphaned guest answer with no record of what the writer asked. And it is not
recoverable: `commitHostGuestHandoff` advances `deliveredToHostThroughTurnId` to the guest response
index, so the writer turn is permanently behind the cursor and can never ship. Every guest turn that
exercises the feature this sprint exists to deliver silently drops half the exchange. The existing
test at `WorkshopSessionService.test.ts:807` builds this exact interleaving and only asserts the
artifact is *absent* — it never asserts the writer's prompt is *present*. Fix: walk backwards from
the guest response past capability artifacts to find the owning writer turn, rather than assuming
`index - 1`.

### 🔴 Blocking — The guest is handed the capability catalog by a system prompt that tells it it has no capabilities

`packages/core/resources/system-prompts/workshop-personas/guest-base.md:11` —
`startWorkshopGuestConversation` now switches to `AGENT_RUN_POLICIES.workshopHost`
(`capabilityCatalog: 'workshopPersona'`, `maxCapabilityRounds: callsPerTurn`) whenever a capability
is passed. Searched the diff for any prompt change: `git diff --stat -- packages/core/resources/`
returns **empty**, and `workshopPersonaSystemPromptPaths` still appends `analysis-capability.md`
only when `basePromptPath === 'workshop-personas/base.md'` — the host. So the guest run ships two
contradictory charters: the system prompt says *"You have no tools or Workshop capabilities,"* and
the injected protocol says *"You may make at most N capability calls."* Worse,
`createWorkshopCapabilityInstruction` tells the guest "The stable `analysis.run` grammar and its
validation rules are in your system instructions" — for a guest they are not there at all. Outcome
is either an inert feature (the guest obeys its charter and never calls) or malformed `analysis.run`
calls that route to `handleInvalidRequest`, burn rounds, and write `rejected` artifacts into the
writer's ledger. The new test mocks the prompt loader, so nothing covers this. Fix both: strike the
denial from `guest-base.md` and include `WORKSHOP_ANALYSIS_CAPABILITY_PROMPT_PATH` for the guest base.

### 🟢 Praise — What I walked and cleared, so nobody re-walks it

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1194` — **Principal
guard:** every caller lines up. `RunWorkshopToolSidePass` mints `owner: {kind:'host'}` *after*
`beginPersonaSynthesis` sets `target: 'host'`, and `excerpt.version` is the same counter as
`this.excerptVersion`. Guest join: `beginPersonaGuestJoin` → `beginMessage(target='personaGuest')`
sets `activeRun.guestPersonaId`, and the capability is minted with the same `requestId` and
`getExcerptVersion()`. Direct-tool runs never mint a capability. **No legitimate artifact is
silently dropped.** **Hydration:** `hydrateCommittedState` runs the migration *before* anything
reads a turn, so `isHostThreadTurn`'s unguarded `turn.capability?.invokedBy.kind` can never see
`undefined`; `restoreRollback` goes through the same method. `cloneCapabilityDetails` is likewise
unreachable with an undefined principal. **Lifecycle:** `capabilityFactory.create` before the try
block is a synchronous constructor with no await and no throw path; `maxCapabilityRounds` is bounded.
One loose thread for another lane: the new `conversationId` on `WorkshopPersonaCapabilityTurn` is
written by all three call sites and read by none.

> *"The writer asks Margot a question, Margot looks up one word, and the question evaporates before it ever reaches the host — permanently, because the cursor moved. Ship this and I'll see you in the incident channel."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — One keystroke permanently disarms the untouched-default soft confirm

`packages/core/src/presentation/webview/components/workshop/WorkshopInviteGuestModal.tsx:132` —
`edited` is a one-way latch for the life of the open modal; nothing resets it except the `[open]`
effect. `isUntouchedDefault = !edited && trimmed === generatedDefault.trim()` therefore stays `false`
forever after the first keystroke, regardless of what the textarea ends up containing. Trace: the
writer clicks in, types a character, deletes it back to exactly the generated default — `edited` is
still `true`, the chip shows green **Personalized**, and `launch()` skips the
`isUntouchedDefault && !confirmArmed` branch entirely and invites on the first press. The one-shot
soft confirm that Sprint 13C goal #3 specifically calls out never fires, and the guest receives the
literal boilerplate while the UI told the writer it was personalized. The tests cover
default→edit and edit→default-typed-back-in with a *single* edit; none type-then-revert to a
byte-identical default.

### 🟡 Standard — Stale selection survives a lock, leaving an enabled launch aimed at an uninvitable persona

`packages/core/src/presentation/webview/components/workshop/WorkshopInviteGuestModal.tsx:120` —
`canLaunch` checks `!!selected` but never whether `selected` is currently locked.
`WorkshopPersonaSheetGrid:55` computes its own `selected = !lock && selectedPersonaId === persona.id`,
so a card that gains a lock stops rendering as selected — but the parent's state still holds that id,
and the reset effect keys on `[open]` only, not on `hostPersonaId`/`livePersonaGuestIds`. The footer
keeps showing "Opening message to ⟨Persona⟩" and a fully enabled **Read in ⟨Persona⟩** for a card
that now reads *Room full*. Clicking reaches `onInvite`, the modal closes, and the backend correctly
rejects it — so nothing corrupts, but the writer gets a confusing "Failed to invite" for a card the
UI itself marked unselectable. Downgraded from High per Rule B: `validatePersonaGuestInvitation` is
the real gate and it holds.

> *"Found the trap door — it's not that the confirm fires twice, it's that one keystroke and a backspace convinces the whole modal it's 'Personalized' while quietly shipping the boilerplate."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — `pm-ws-invite-*` class names on a modal that isn't an invite

`packages/core/src/presentation/webview/components/workshop/WorkshopChooseHostModal.tsx:114-119` —
`WorkshopChooseHostModal` commits a host choice, not an invitation, but its footer is styled by
`.pm-ws-invite-cancel` / `.pm-ws-invite-launch` / `.pm-ws-invite-actions` — classes coined for the
invite sheet. `workshop.css` confirms it: there's no `.pm-ws-host-cancel`, and the qualifier at CSS
line 2131 is literally `.pm-ws-host-actions .pm-ws-invite-cancel`, styling a class named after the
sibling feature. Read this file cold and the class list tells you it's part of the invite flow — it
isn't. It's also duplicated knowledge with a trap door: a future tweak to "the invite footer"
silently reaches into Choose Host, and nobody grepping for host classes would find it. Pull the
shared footer chrome into a small `WorkshopSheetFooterActions`, or at minimum rename to neutral
`pm-ws-sheet-actions` / `-cancel` / `-commit`, so both modals share the *behaviour* on purpose
instead of borrowing a name that lies.

### 🟡 Standard — `target.kind === 'personaGuest'` checked three times in one expression

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1027-1033` — I had to read this
three times to trust it, because the same discriminant is checked independently in the gate, the
`personaId` field, and the `owner` field — three chances for one to drift out of sync during the next
edit, and TypeScript's narrowing won't save you across three separately-evaluated ternaries. Resolve
the owner once:

```ts
const participantOwner: WorkshopCapabilityPrincipal | undefined =
  target.kind === 'personaGuest' ? { kind: 'personaGuest', personaId: target.personaId }
  : target.kind === 'host' ? { kind: 'host' }
  : undefined;
```

then gate and build off `participantOwner`. Same behaviour, one place where "which participant is
this" gets decided instead of three.

### 🟢 Nit — `flashToken` + `flashing` is two states doing one job

`packages/core/src/presentation/webview/components/workshop/WorkshopInviteGuestModal.tsx:61-84` —
`.pm-ws-invite-flash` is a plain `transition`, not a keyframe animation, so nothing here needs a
fresh mount to replay. `flashToken` exists purely to re-fire the effect and restart the 1100 ms
timer; but `setFlashing(true)` is a no-op when already true, so the counter buys only a timer reset.
That's one `useRef`-held timeout, not two pieces of render state — drops a state variable and the
effect entirely, and reads as "start/restart a flash" rather than "bump a nonce so an effect
elsewhere notices."

> *"It works, but I had to squint three times at one ternary to believe it — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — The host-vs-guest `owner` wiring is never asserted by any test

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1031` — This is the one line of
production code that decides which principal gets stamped onto a capability turn; everything
downstream — the `recordCapabilityArtifact` guard, the `isHostThreadTurn` privacy filter, the
hydration migration — trusts that `owner` arrived correctly. But every test exercising that guard
hand-constructs `invokedBy` directly (`WorkshopSessionService.test.ts` 711, 797, 822, 859), and
`WorkshopPersonaCapability.test.ts` only ever builds adapters with `owner: { kind: 'host' }` — zero
`personaGuest` occurrences. `WorkshopHandler.test.ts` captures `capabilityFactory.create.mock.calls`
once, for a host run, and never inspects `owner` at all. Flip that ternary, or swap `target.personaId`
for `personaId`, and every existing test stays green. The guard you're proud of downstream is only
as good as the wiring nobody is watching.

### 🟡 Standard — The hydration migration's negative case is untested

`packages/core/src/__tests__/application/services/workshop/WorkshopSessionPersistence.test.ts:313` —
The only test asserting `migrations: []` uses `buildCompleteState()`, whose tool turn comes from
`completeToolReport` — a path that never sets `capability` at all, so the migration's guard
(`if (!turn.capability || turn.capability.invokedBy !== undefined)`) exits on the **first** clause,
not the second. The test that does stamp a capability covers only the positive case. Nothing
hydrates a turn whose `invokedBy` is already `{ kind: 'personaGuest', personaId: 'margot' }` and
confirms it survives unchanged with `'defaulted-capability-principal'` absent from `migrations`. If
that `!== undefined` check ever regresses to always-stamp, a guest artifact gets silently relabelled
`host` on the next save/load — defeating the privacy guarantee — and the suite stays green.

### 🟢 Nit — The soft-confirm hint is tested by text, not by its `role="status"` contract

`packages/core/src/__tests__/presentation/webview/components/workshop/WorkshopInviteGuestModal.test.tsx:108` —
The component is explicit that `role="status"` is load-bearing ("must be ANNOUNCED, not
colour-signalled"). The test never queries `getByRole('status')`; `getByText` finds the string
wherever it lives. Delete the `role="status"` and this suite is unaffected — the one thing the
sprint's accessibility criterion actually asks about isn't the thing under test.

> *"The guard downstream is only as good as the wiring nobody's watching upstream — and right now, nobody's watching `owner:`."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟠 High — Route matrix lies about where guest sidecars actually go now [🎯 Consensus]

`packages/core/src/infrastructure/api/orchestration/AgentRunPolicies.ts:55` — This file's own header
calls `AGENT_RUN_ROUTE_MATRIX` "One source of truth for the caller-to-policy matrix." It no longer
is. `AssistantToolService.startWorkshopGuestConversation:610-612` branches on capability presence,
and its **only** caller — `WorkshopHandler.inviteGuest` — mints a `guestCapability` unconditionally.
I grepped for other callers across `packages/core/src` and `apps/vscode-extension/src`: there are
none. So every real invocation routes to `workshopHost`, and the matrix's `workshopToolWithoutResources`
claim documents a branch effectively unreachable from this caller. `AgentRunPolicies.test.ts` asserts
only the static shape and the caller-name list — it never exercises `AssistantToolService` to check
which policy a real guest call gets, so it passed clean through this PR. Either update the entry to
describe the conditional, or add the assertion that would have caught it.

*The rest of Stan's checklist came back clean against sibling patterns: import aliases match the
established local convention in the workshop components directory, `WorkshopPersonaBrowserModal` and
`DEFAULT_WORKSHOP_GUEST_OPENING` are fully removed with no stragglers, the CSS prefix vocabulary and
test placement match the house style, and the new files carry the long "why" header comments the
codebase expects.*

> *"We keep a 'one source of truth' matrix and then let the code quietly grow a branch it doesn't know about — the guest sidecar hasn't taken the door marked `workshopToolWithoutResources` since this PR landed. It just forgot to change the sign."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — Every guest turn now pays the full host-sized token and round-trip budget

`packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts:665-667` — Before
13C, guest turns ran under `workshopToolWithoutResources`: one provider call, no capability text.
Now a `participantCapability` is minted for **every** `personaGuest` target turn — not just the join
— so `capability` is always truthy and every guest turn for the life of the retained conversation
runs under `workshopHost`: `capabilityCatalog: 'workshopPersona'`, `maxCapabilityRounds: 5`. I built
the actual instruction block from `createWorkshopCapabilityInstruction`: with resource groups present
it runs ~3,975 characters, ~1,000 tokens. This is a stateless chat-completions API, so that block
rides the system message on *every* call, and the capability loop is a real bound
(`AgentRunEngine.ts:332`). Worst case: 1 initial + 5 capability rounds = **6 calls × ~1,000 tokens of
repeated static instruction ≈ 6,000 extra tokens on a single guest turn** that used to cost one call
with zero catalog overhead. The cap is enforced and identical to the host's — this isn't a defect,
it's guests costing what host turns already cost, which is literally acceptance criterion #7.
Flagging so the number is on record rather than discovered on an OpenRouter bill.

### 🟢 Nit — The persona grid re-renders all 12 cards per keystroke — doesn't matter yet

`packages/core/src/presentation/webview/components/workshop/WorkshopPersonaSheetGrid.tsx:44` — Not
wrapped in `React.memo`. The invite modal colocates `message` state with the grid, so every
`onChange` re-executes `WORKSHOP_PERSONA_CATALOG.map` over 12 personas with 2 `Icon` children each.
`locks` is already `useMemo`'d, but that buys nothing without `React.memo` on the child. Math: 12
cards × ~5 DOM nodes is sub-millisecond on anything that runs VS Code. It would only matter if the
catalog grew an order of magnitude, and the sprint's non-goals rule that out. One-line insurance if
you're in the file anyway; not worth a dedicated PR.

### 🟢 Praise — Transcript scans stayed O(turns); the new principal check is a free branch

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:2234` — Checked whether
this sprint made anything O(turns × guests). It didn't. `collectHostThreadTurns()` runs once per
guest *join*; `collectUnseenHostTurnsForGuest()` and `commitGuestCatchUp()` run once per message to
the currently-targeted guest — not once per guest per turn, since `activeRun` is singular and
`preemptActiveRun()` serializes targets. The `new Map(this.turns.map(...))` index-building predates
13C. The only new cost is one property comparison in an already-short guard chain.

> *"The guest capability bill is real and I did the arithmetic — six calls, a thousand tokens of instructions apiece, repeated verbatim on every round — but it's the same meter the host has been running on since day one, and the cap doesn't leak. Ship it, just don't be surprised by the invoice."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard — The principal check is a stale-run guard wearing an authorization costume

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1189` — Ordering, as
asked. In `WorkshopPersonaCapability.fulfill()`, `this.dispatch(request)` runs at line 165 — the
dictionary call, the resource read, the analysis side-pass — and **fully executes**, spends tokens,
and touches the catalog-bounded filesystem, before `recordCompletedTurn()` at line 178 ever calls
`session.recordCapabilityArtifact()`. `principalMatchesRun` therefore authorizes nothing about the
*call*; it gates only whether the completed result enters the shared transcript. That's a legitimate
design given the real boundary is the closed catalog — but the doc comment ("the invoking principal
must match the run that is actually active") reads like an authz gate on the capability itself, and
`owner` is caller-supplied at each call site rather than derived from `activeRun`. Today both sites
build `owner` from the same locals that set `activeRun.target`, so they can't practically diverge —
but nothing in the types enforces that, and a mismatch fails *silently*. A future third call site
that gets the wiring wrong produces quietly-dropped evidence, not a loud test failure. Worth a
comment fix now, before this becomes load-bearing for something it wasn't built to bear.

### 🟢 Praise — Guest capability catalog is not expanded by reusing the host run policy

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:425` — I traced this
the way an attacker would, assuming "reused host policy" meant "reused host privileges." It doesn't.
`AGENT_RUN_POLICIES.workshopHost` sets `capabilityCatalog: 'workshopPersona'`, and
`AgentRunEngine.validateCapability` only checks that the capability object's `.catalog` matches —
it's a **type tag, not a privilege grant**. The actual surface is the single `WorkshopPersonaCapability`
class, instantiated identically for host and guest, dispatching over the closed
`WorkshopCapabilityRequest` union — exactly the sprint's six operations. `dispatch()` has zero
`this.turn.owner`-conditioned branches; I read the whole switch. There is no host-only operation a
guest can reach through this door.

### 🟢 Praise — `resource.read` containment is untouched and still catalog-bound, not path-bound

`packages/core/src/application/services/workshop/WorkshopResourceCapability.ts:227` — Searched the
diff: this file is untouched by PR #89, so I read the current file rather than trusting the diff.
`read()` never hands the caller-supplied `request.path` to the filesystem. It looks the string up
against a pre-enumerated catalog by exact or case-folded match, and only on a match calls
`loadResources([resource.path])` using the **catalog's own** path. A `../../etc/passwd` or absolute
path simply matches nothing and is rejected. Identical for host and guest — no owner branch here
either.

> *"Reusing the host's run policy for a guest sounds like a red flag until you notice the policy is just a name tag — the closed catalog and the catalog-bound file reads are the actual fence, and this PR didn't move it."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — The silent-refusal guard collapses three failure modes into one log line

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:618-623` —
`recordCapabilityArtifact` returns `undefined` for three semantically different reasons, checked in
one compound condition: (1) the run moved on — ordinary and benign; (2) `!principalMatchesRun` — the
artifact's principal doesn't own the active run, which given 13C's new dual-principal model is
*exactly* the shape of a guest/host attribution wiring bug; (3) stale excerpt version — also benign.
Every caller that logs the refusal reports only the attempt's `requestId`/`persona`/`excerptVersion`
— never which check failed, never what `activeRun` actually was. A benign late-arriving report and a
genuine principal mismatch produce **byte-identical** log lines. You can't triage that from the
output channel; you'd have to reproduce it with a debugger attached.

### 🟡 Standard — The live status ticker can't distinguish a host capability call from a guest's own

`packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts:567-570` —
`WorkshopPersonaCapabilityTurn.personaId` is documented as "the persona speaking this turn (the host
persona, or the guest itself)" — the same identifier either way. Every `events.status(...)` call
formats from `personaLabel`/`toolLabel` alone, never `owner.kind`. If the same persona appears in
both a host-driven synthesis and an invited-guest turn in one session — which the architecture
explicitly allows — the ticker text is identical for both. The persisted `capability.invokedBy` does
retain the truth, so post-hoc forensics from a checkpoint still works; but the live signal you watch
while a run is in flight can't answer "which thread just called the dictionary."

> *"Three different reasons to refuse, one line of text to explain them — that's not a log, that's a coin flip you'll be doing at 2am with a checkpoint file open in one hand."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — The sprint doc's opening-message rationale contradicts the actual, tested invite gate

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:607-611` — The 13C doc justifies
the excerpt-free default copy with *"a guest may be invited into a session whose scope has no
excerpt,"* and the PR description repeats it. But `handleInviteGuest` hard-errors on exactly that,
and it's deliberately tested (`WorkshopHandler.test.ts:2567`, *"refuses a guest invitation in an
excerpt-free room"*). The gate predates 13C and is actually **load-bearing** for the sprint's own
non-goal — open-chat sessions have no excerpt, so this gate is what enforces "No guest invitation in
open chat." The parent Sprint 13 doc says so explicitly. The real contract is: guests require a
pinned excerpt, full stop. The 13C doc's inline rationale describes an aspirational state, not what
ships. Not a functional bug — but the doc and PR description both claim a capability that does not
exist, which will mislead whoever reads Exit Criteria as ground truth.

*Bria's remaining checks cleared:* the generated opening is a byte-match to the sprint doc's own
literal example (the lowercase "read" is documented voice, not a defect); the no-persona fallback is
genuinely shown before selection, not dead code; `inviteGuest` closes the modal synchronously and
`WorkshopModalShell` unmounts on `open=false`, so there is no double-invite path; `getSnapshot()`
sends `this.turns` **unfiltered** to the webview, so the writer's ledger genuinely still shows guest
artifacts — audience governs prompts, not display, exactly as specified; and the participant rail
never claims a sidecar's *report* is private, matching ADR §9.

> *"The ticket says a guest can walk into an excerpt-less room. The code says 'pin an excerpt or don't bother.' One of them is lying, and it's not the code — it's just talking about tomorrow like it's today."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — Invariants Live in the Empty Space

Illuminated by: Blake #1

An invariant can hold for years not because anything enforces it, but because the space it depends
on has always been empty. "The writer's message is always one turn back" was never a rule about
position — it was a rule about the guest having nothing else to say. The sprint's entire purpose was
to give the guest something else to say, and the adjacency check never got told. This is the quiet
danger of every *grant X a new capability* sprint: the capability isn't additive, it's invasive. It
walks into rooms that were load-bearing precisely because they used to be empty.

→ Carry forward: When the goal is "grant X a new ability," search not for code that checks *what X
is*, but for code that assumed *X could do nothing*. Those assumptions were never written down,
because they never needed defending.

### Lesson 2 — Proving Absence Is Not Proving Presence

Illuminated by: Blake #1, Marcus & Stan, Cal #1 and #2

A test that shows the bad thing isn't there feels like coverage, but it's checking one rail of a
two-rail track. The interleaving test proved the wrong artifact never appeared — and never checked
whether the right one did, so it watched the writer's prompt vanish without a red line. The routing
matrix test proved the documented map has the right shape — and never asked whether the running code
consults it. Absence and presence are different claims; a suite that tests only one waves the
other's regression straight through.

→ Carry forward: For every assertion that something is *missing*, write the sibling assertion that
the *correct* thing is present. And for anything labelled "source of truth," test the runtime
decision it governs, not just the artifact's own shape.

### Lesson 3 — The Map Is a Promise, Not a Proof

Illuminated by: Blake #2, Marcus & Stan, Bria

A comment that says "this is the source of truth," a prompt that tells an agent what it can do, a
doc that explains why the code behaves as it does — these are all claims about the system, made in a
different language than the system, and nothing keeps them honest automatically. The guest ran under
a policy handing it five rounds of tool calls while its own charter insisted it had none: two
documents describing one actor, disagreeing, both shipped. That gap doesn't announce itself. It sits
there until someone reads the prompt file instead of the test mock.

→ Carry forward: When a change moves a decision — a policy, a permission, a routing rule — grep
every doc, comment, and prompt that *describes* that decision and update or delete it in the same
commit. Treat "source of truth" language as a pointer to be re-verified, not a fact verified once.

### Lesson 4 — One Signal Can't Carry Three Meanings

Illuminated by: Oliver #1, Sam #1, Patricia #1

A value can only honestly distinguish as many situations as it has shape for. `undefined` here means
"stale run" or "wrong principal" or "stale excerpt," and every caller logs the same three words
regardless. `edited` means "has ever differed from default," but the UI reads it as "is currently
different" — two claims that separate the instant someone types and backspaces. When a signal is
asked to mean more than it can hold, the missing distinction doesn't disappear. It relocates into a
human's head, usually at 2am or mid-keystroke, exactly when they can least afford to rebuild it.

→ Carry forward: Before naming a return value or a flag, ask what specific situations it must
distinguish. If the answer is "more than one," it wants a discriminated type or a value re-derived
on every transition — not a bare `undefined` and not a boolean that only ever moves one direction.

> *"The floor held for years. Nobody had ever stepped on that part of it."* — Sensei

---

## The Closer

### ⭐ Yelp Review — 3 / 5 stars

Beautiful room. Genuinely — the split-sheet build is the most confident interior work this epic has
shipped, the persona cards state *why* they're locked instead of just greying out, and somebody
clearly cared about what a screen reader hears. I ordered the guest with capabilities, which is the
headline item on the menu. It arrived with a note from the kitchen explaining that this dish does not
exist, and the waiter took my order slip away before it reached the chef. Would absolutely return
once the pass is talking to the line — just fix the ticket rail first.

---

## Summary

This is high-craft work with two holes in the middle of it. The design fidelity is real, the
security posture is genuinely good — Patricia traced the "guests reuse the host policy" alarm to
ground and found the fence exactly where it should be — and the performance story is bounded and
intentional. But the sprint's headline capability doesn't function end-to-end: the guest's system
prompt still denies the tools its run policy now grants, and any guest that *does* invoke one
silently and permanently destroys the writer's half of the exchange on the way to the host.

The pattern underneath both blockers is the same one Sensei named: the sprint carefully persisted
*who* invoked a capability, but the surrounding system still assumed *nobody but the host ever
would*. The principal guard itself is correctly wired at every call site — Blake walked all three —
but it's untested at the point of attribution, unlogged at the point of refusal, and shadowed by a
route matrix that documents the old world.

**Needs rework before merge.** Findings #1 and #2 are non-negotiable; #3–#6 are cheap and would each
have caught a future version of this. Everything from #7 down is honest cleanup that can ride the
same branch or a follow-up.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
