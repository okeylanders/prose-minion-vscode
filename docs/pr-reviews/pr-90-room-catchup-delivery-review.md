# MR Review — Workshop: unify room catch-up delivery and release polish (Sprint 13D)

**Author:** okeylanders · PR #90 · `sprint/workshop-editor-tab-13d-room-catchup-release-polish` → `epic/workshop-editor-tab`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Join snapshot reuses the delta projection, deleting a re-invited guest's own prior turns | Blake | — | **Addressed** — cold-start join projection retains the guest's prior exchange and private evidence |
| 2 | 🟠 High | `commit()` head-jump to the ledger tail diverges from ADR §5 and leans on an unstated cross-file invariant | Parker, Bria, Blake | 🎯🎯 Strong | **Addressed** — advances only through `deliveredTurnIds.at(-1)` |
| 3 | 🟠 High | `commit()` throw is caught by the model-round-trip handler and misreported as a failed message | Marcus, Blake | 🎯 | **Addressed** — acknowledgement failures are contained and retained for retry |
| 4 | 🟠 High | Tool-side-pass synthesis-failure test never asserts the room offset stayed pending | Cal | — | **Addressed** — failure regression asserts the report remains pending |
| 5 | 🟡 Standard | Catch-up frame has no cost bound — the 1M runaway guard replaced a deleted 20k budget | Tim | — | **Deferred** — governing ADR §6 deliberately keeps catch-up lossless/unbounded until [context compaction](../../.todo/epics/epic-workshop-context-compaction-2026-07-21/README.md) |
| 6 | 🟡 Standard | `slice(-0)` returns the whole array, inverting the bound when `turnLimit` is 0 | Sam | — | **Addressed** — non-positive limits now produce an empty window |
| 7 | 🟡 Standard | Delivery-integrity throws name no participant and no offset values | Oliver | — | **Addressed** — errors include reader plus expected/actual/delivered offsets |
| 8 | 🟡 Standard | Commit-skip on a cancelled run is silent, unlike the sibling branch three lines below | Oliver | — | **Addressed** — both delivery paths log retained acknowledgements |
| 9 | 🟡 Standard | Persisted `publishedWithTurnId` can't be tied back to the run that produced it | Patricia | — | **Deferred** — local single-user extension; tampering actor already owns the content |
| 10 | 🟡 Standard | Block-joining algorithm re-derived in both frame builders | Parker | — | **Addressed** — shared `withBlankLines()` renderer helper |
| 11 | 🟡 Standard | `workshopTurnBelongsToPrincipal` is named for ownership, documented as self-visibility dedup | Parker | — | **Addressed** — renamed `isWorkshopTurnAlreadyVisibleToPrincipal` |
| 12 | 🟡 Standard | `WorkshopRoomFrameRenderer` is the one new module without a mirrored test file | Stan, Cal | 🎯 | **Addressed** — direct renderer suite covers empty, temporal, day-bucket, and whole-turn bounds |
| 13 | 🟡 Standard | Two full-ledger clones per turn plus an O(n) scan doing an O(k) lookup | Tim | — | **Deferred** — microseconds at current session lengths; revisit past ~1k turns |
| 14 | 🟢 Nit | Unreachable branch in the eligibility filter | Sam | — | **Addressed** — delta projection now has one room-audience return path |
| 15 | 🟢 Nit | New files import a capability type from the broad barrel, not the specific module | Stan | — | **Addressed** — imports use `@shared/types/workshopCapabilities` |
| 16 | 🟢 Nit | Guest transcript formats every turn twice and discards the first pass | Tim | — | **Addressed** — renderer reuses the packer's formatted blocks |
| 17 | 🟢 Nit | Aggregate still 2,370 lines — evidence for the tracked debt ticket, not this PR's job | Marcus | — | **Deferred** — tracked in `.todo/tech-debt/2026-07-25-workshop-god-files.md` |
| 18 | 🟢 Praise | Audience/delivery/render split respects the dependency rule; boundaries guard enforces the ADR claim | Marcus, Blake, Stan | 🎯🎯 Strong | **N/A** |
| 19 | 🟡 Standard | Guest persona `### Next steps` are parsed but do not receive the actionable menu shown for host turns | Author follow-up | — | **Addressed** — guest findings now persist, render, and promote with guest-turn provenance |

### Implementation response — 2026-07-26

All merge-blocking findings are addressed. Finding #5 is intentionally not
implemented as a 20k window: [ADR 2026-07-24 §6](../adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md#6-a-turn-is-atomic-catch-up-delivery-is-unbounded-for-now)
explicitly chooses complete, whole-turn catch-up for 13D and assigns cost
shaping to compaction. Adding a lower scalar-offset window here would re-create
either silent loss or persistent participant lag—the protocol defects this
sprint removes.

The author-observed guest proposal inconsistency is included as row #19. Its
fix uses the existing structured-finding and todo pipeline end to end; it does
not add a guest-only UI path.

---

## Blast Radius

- 41 files changed · +1,743 / −992 lines
- New source modules: 4 (`WorkshopRoomAudience`, `WorkshopRoomDeliveryService`, `WorkshopRoomFrameRenderer`, `WorkshopTurnPacker`) · New test files: 3 · Migrations: saved-session V1 hydration only (no schema V2) · New injected services: 1
- Net deletion of five collector/committer pairs and three cursor fields; one new architecture guard
- This is a protocol replacement, not a feature add — the blast radius is every participant's conversational memory

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | B− |
| 🛡️ Security | A− |
| 🧪 Tests | C+ |
| 📖 Quality | B− |
| ⚡ Performance | B |
| 🎯 Domain | B |

---

## Executive Briefing

🟠 **[Blake]** Re-invited guest joins with its own half of the conversation deleted — `prepareJoinSnapshot()` reuses the incremental-delta filter on a reader that has no memory at all, and the frame reports "0 omitted."

🟠 **[Parker · Bria · Blake] 🎯🎯** The `commit()` head-jump records the ledger tail instead of the delivered prefix's last id, contradicting ADR §5's explicit wording. All three agree it's safe *today* — solely via an invariant enforced in two other files and named in neither.

🟠 **[Marcus · Blake] 🎯** A `commit()` throw is a bookkeeping fault, but it lands in the model-round-trip catch — so the writer sees "Failed to message…" for a reply already on screen, and staged attachments silently re-ship.

🟠 **[Cal]** `RunWorkshopToolSidePass` has its own commit call site whose failure path never asserts the offset stayed pending — the exact regression class the tech-debt ticket was written about.

🟡 **[Tim]** The catch-up frame's only bound is a 1M-character corruption backstop; the deleted `guestCatchUp` budget (8 turns / 20k chars) was never replaced, so a returning participant can ship ~250k tokens of billed context.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — Delivery-acknowledgement failure is reported as a failed message [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1107`

`commit()` is a compare-and-set that throws `'…receipt is stale'` or `'…not a contiguous prefix'`. That's a real invariant, unit-tested at the service level. But the call sits inside the same `try` that wraps the entire model round-trip (lines 1061–1138). By the time it runs, `completeWorkshopRun` has already pushed the turn, called `postTurn`, and completed the stream — the reply is fully visible. A throw falls to the shared `catch` at line 1138, which calls `sendError('Failed to message ' + label)` and marks the request abandoned. The writer sees an error banner for a message that already arrived; because the offset never advanced, the identical backlog re-ships in the next catch-up frame. Same shape at `RunWorkshopToolSidePass.ts:268`. Catch and log the commit fault independently of the model-call failure domain — the turn *was* delivered, and leaving the offset behind for the next contiguous-prefix retry is exactly what the existing hole test proves is safe.

### 🟢 Nit — Real decomposition, but the aggregate is still the thing every feature touches

`packages/core/src/application/services/workshop/WorkshopSessionService.ts`

This is a genuine cut: five hand-rolled collector/committer pairs and their three cursor fields are gone, replaced by three narrow port methods and one collaborator. The aggregate shrank 2,542 → 2,370 lines. Still ~4.7× the file-size line in CLAUDE.md's own anti-pattern checklist, and guest lifecycle, capability stamping, todo tracking, and persistence coordination all still live here. Already tracked in `.todo/tech-debt/2026-07-25-workshop-god-files.md` — noting it only as evidence for that ticket's candidate-seams list.

### 🟢 Praise — The audience/delivery/render split respects the dependency rule

`packages/core/src/application/services/workshop/WorkshopRoomAudience.ts`

Pure function module, zero dependency on the aggregate or any I/O. `WorkshopRoomDeliveryService` depends on the aggregate — matching `WorkshopAnalysisSidePass`, not a violation — while its own exported functions stay pure and independently tested. The new `boundaries.test.ts` guard turns the ADR's "single delivery protocol" claim into an *enforced invariant* rather than a comment. The `WorkshopTurnPacker` extraction directly answers the ADR's documented "two packers, drifted" defect instead of inventing an abstraction nobody asked for.

> *"The room finally has one door everyone walks through — I'd just make sure a jammed lock on the way out doesn't get blamed on the guest who already left."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🟠 High — Re-invited guest joins with its own prior turns surgically deleted

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:89`

`prepareJoinSnapshot()` runs the full incremental-catch-up projection, including the `workshopTurnBelongsToPrincipal` filter. That filter justifies itself as "already materialized in this participant's own retained conversation" — an assumption that is **false for a join**, because a join builds a brand-new provider conversation with zero memory.

Path, verified by running it: `dismissPersonaGuest('margot')` sets liveness `disposed`; `validatePersonaGuestInvitation` then permits re-invitation (explicitly supported and tested at `WorkshopSessionService.test.ts:1064`); `handleInviteGuest` calls `prepareJoinSnapshot({kind:'personaGuest', personaId:'margot'})`, which drops every `guest`/`margot` turn, every `writer→margot` message, and every margot-invoked capability turn. The resulting snapshot handed to the fresh conversation:

```
"Margot flagged distance. Do you agree?"   (writer→host)
"I agree with Margot about paragraph two." (host)
```

Margot's actual note — the referent of both lines — is gone, and Margot has no memory of it. Worse, `buildWorkshopGuestTranscript` reports `Omitted whole turns by bound: 0` and the frame instructs "Do not claim to have witnessed omitted turns," so the model is affirmatively told nothing was withheld. It will hallucinate what it said or contradict the host. `WorkshopRoomDeliveryService.test.ts` never exercises `prepareJoinSnapshot` at all. Join is a different reader contract from catch-up: principal-ownership filtering is correct for an offset delta, wrong for a cold start.

### 🟡 Standard — `commit()` throws by design, but the only catch treats it as a model failure [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1108`

The catch runs the failed-run path: `sendStreamComplete(requestId, '', true)` — a second, cancelled completion for a turn the writer already sees — plus `sendError`, and it skips `commitPendingHostUpdates` / `commitMessageAttachments` / `commitTimeNotice`. Staged attachments stay pending and re-ship on the next message. I could not trace a currently-reachable trigger: single-slot `activeRun` plus `preemptActiveRun()` firing before `prepare()` means an aborted run never reaches commit, `hydrate`/`reset` clear `activeRun`, and lines 1088→1108 contain no await. Not a live bug — an invariant guarded by an accident of scheduling.

### 🟢 Praise — The claimed acknowledgement fix holds; the head-jump is not a new hole

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:142`

I went after `state.turns.at(-1)?.id` specifically, on the theory that a turn skipped as ineligible could later become eligible and be stranded. It can't, for a reason worth writing down: the only audience flip is `undefined → publishedWithTurnId`, and that stamp happens synchronously with the push of the completing turn inside `completeRun`, with no await between. Capability turns from a preempted run are refused by the requestId/principal guard and stay unpublished forever. And because `commit()` is only ever called immediately after `completeWorkshopRun` in straight-line code, `state.turns.at(-1)` is always the run's *own* just-pushed turn — the jump can never leap a third party's undelivered history. The receipt exactly matches what `buildWorkshopRoomCatchUp` renders. **The tech-debt item is genuinely closed.**

> *"The offset math is finally honest — now go tell the guest you deleted her half of the conversation before you sat her back down."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟡 Standard — `slice(-0)` returns the entire history instead of nothing

`packages/core/src/application/services/workshop/WorkshopTurnPacker.ts:33`

```ts
const newest = turns.slice(-policy.turnLimit);
```

`[1,2,3].slice(-0)` returns `[1,2,3]` — because `-0 === 0` in JS, `slice(-0)` is indistinguishable from `slice(0)`. The contract is "keep the newest window," so a `turnLimit` of 0 should keep *nothing* and instead keeps *everything* — the exact inverse of the bound. Latent, not live: the only production caller passes a hardcoded `20`. But the module advertises itself as a reusable pure primitive, `turnLimit` is untyped beyond `number`, nothing guards `<= 0`, and every existing test uses `turnLimit: 3`. The first caller that derives the limit from a computed budget gets a landmine.

### 🟢 Nit — Dead branch in the eligibility filter

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:50`

The second OR-arm (`audience.principal.kind !== 'toolSidecar' && sameParticipantPrincipal(...)`) can never fire. `workshopTurnAudience` returns `private` in only two shapes: tool-sidecar principals (excluded outright by the guard) and unpublished-capability principals — but that same turn was already tested one line earlier by `workshopTurnBelongsToPrincipal`, whose `if (turn.capability)` branch computes the identical comparison on identical inputs. Whenever this arm would be `true`, the filter already returned `false` above it. Not a live bug — no reader sees their own private turn quoted back, and nothing falls through to nobody — but worth a comment or a reachability test, since a future refactor could quietly change the assumption without failing anything either way.

> *"Found the trap door. `slice(-0)` isn't `slice` of zero things — it's `slice` of everything, and nobody's tested the zero case to notice."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟠 High — The head-jump explains *that* it happens, not *why* it's safe [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:142`

```ts
const deliveredThroughTurnId = allEligibleTurnsDelivered
  ? state.turns.at(-1)?.id
  : delivery.deliveredTurnIds.at(-1);
```

The doc comment on `commit()` explains one thing well — "never derive an acknowledgement from the newest pending/max-index turn" — but that's the **else** branch. The **then** branch does exactly the thing the comment warns against, one level up: instead of stopping at the last delivered eligible turn, it jumps the offset to the newest turn in the *entire* ledger, including rows this reader never evaluated. Nothing at the call site says why that's safe.

It is safe today, but only via an invariant living in a different file: `WorkshopHandler` enforces a single session-wide `activeRun` slot (line 235), and `commitTurn` stamps `publishedWithTurnId` atomically in the same synchronous call that appends the unlocking reply (`WorkshopSessionService.ts:1483–1493`). If a future change ever lets two participants run concurrently without that atomic stamp — which the sprint's own tech-debt doc anticipates — this line silently skips a turn that later becomes room-visible, and the reader never sees it again. No exception, no retry, just gone. Either compute from `pendingIds.at(-1)` in both branches, or name the invariant at the crime scene.

### 🟡 Standard — Block-joining logic duplicated verbatim between the two frame builders

`packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts:189` (and `:155`)

```ts
...temporal.blocks.flatMap((block, index) => index === 0 ? [block] : ['', block]),
```

Not superficially similar text — the identical algorithm ("blank line between blocks, but not before the first"), independently re-derived for two sibling builders that both assemble a room-history frame from `temporal.blocks`. If the spacing rule ever changes (e.g. to treat a `[N later]` gap marker differently), someone must remember two places, and nothing fails loudly if they fix one. Extract `joinWithBlankLines(blocks)` next to `renderTemporalRoomBlocks` and call it from both.

### 🟡 Standard — `workshopTurnBelongsToPrincipal` is named for ownership; its own comment says otherwise

`packages/core/src/application/services/workshop/WorkshopRoomAudience.ts:71`

The doc comment is precise: this predicate stops a reader's own already-visible turns from being re-quoted at them. The name asks a different question — "does this turn *belong to* X." The mismatch is concrete: for the writer→guest case the turn doesn't belong to the guest in any ownership sense (the writer wrote it), but it *is* already in the guest's transcript, which is what's actually being checked. A reader skimming `projectWorkshopRoomTurns:47` would reasonably guess authorship gate and be surprised. Rename to match the comment the author already wrote — `isTurnAlreadyVisibleToPrincipal` or similar.

> *"The `commit()` head-jump works, but only because of an invariant filed three modules away and never mentioned at the crime scene — that's not documentation, that's a landmine with a really good memory."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — Tool-side-pass synthesis failure never asserts the room offset stayed put

`packages/core/src/__tests__/application/handlers/domain/WorkshopHandler.test.ts:1280`

`RunWorkshopToolSidePass.ts` has its own `roomDelivery.commit(pendingRoomDelivery)` call site, separate from `WorkshopHandler`'s. It's correctly guarded by `if (synthesisTurn)`, so on a failed host synthesis the delivery should stay pending — exactly the class of bug the tech-debt ticket says the old code got wrong. But the existing test for this failure path (untouched by this PR) only asserts the tool-report turn and sidecar survive and that an ERROR was posted. It never re-derives the room delivery to confirm the tool-report turn is still the *pending* head rather than silently acknowledged. The parallel `WorkshopHandler` direct-message failure test (`'keeps direct sidecar work private across a failed host turn and retry'`, line 1381) *does* make exactly that assertion by re-deriving `roomDelivery.prepare(...)` post-failure. If a future refactor hoisted the commit above the `synthesisTurn` check, the whole suite would still pass.

### 🟢 Nit — Renderer has no dedicated test file, but its exports are covered [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts`

No `WorkshopRoomFrameRenderer.test.ts` anywhere. However `buildWorkshopRoomCatchUp` and `buildWorkshopGuestTranscript` are directly unit-tested in `WorkshopPromptBuilder.test.ts` (asserting `'[3 hours later]'` and `'ending 2 minutes ago.'`), and the oversized-first-turn and empty-input cases are covered. One real hole: `relativeDuration`'s day-level bucket has zero coverage anywhere. Low risk — straightforward arithmetic parallel to the tested hour branch.

> *"The tool-report cursor got the 'don't advance on failure' test everywhere except the one place it actually forked into a second class with its own commit call — that's the gap the tech debt ticket was written about in the first place."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — One new module out of four skipped the mirrored test file [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts:1`

This sprint added four new modules under `application/services/workshop/`. Three shipped with a test file mirroring the source path exactly, per CLAUDE.md's "tests mirror source tree": `WorkshopRoomAudience.ts` and `WorkshopTurnPacker.ts` both got new mirrored files in this same diff. `WorkshopRoomFrameRenderer.ts` is the odd one out. Functionally covered indirectly through `WorkshopPromptBuilder.test.ts`, but the file-to-test mapping this PR establishes for its own siblings is broken for exactly one module — which will confuse the next person looking for where to add a room-frame case.

### 🟢 Nit — Capability type imported from the broad barrel, not the specific module

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:11`

`WorkshopHandler.ts:153` imports the same type via `@shared/types/workshopCapabilities`; the new files take `@shared/types` instead. Same symbol today (the index re-exports it), so nothing breaks — but the established Workshop convention (`WorkshopHandler`, `WorkshopPersonaCapability`, `WorkshopAnalysisSidePass`) is the specific module, and CLAUDE.md says prefer specific aliases when available.

### 🟢 Praise — Composition-root and constant placement are right, not deviations

`packages/core/src/application/handlers/MessageHandlerContracts.ts:103`

Two things flagged for scrutiny turn out to match precedent. `WorkshopRoomDeliveryService` is threaded through `CoreServices`, constructed once in `extension.ts`, and added to `FORBIDDEN_INFRASTRUCTURE_CONSTRUCTION` — exactly the `WorkshopSessionService` pattern; the barrel exports only the composition-root-constructed class, same as `WorkshopAnalysisSidePass` (whose internal collaborators aren't barrel-exported either). And `WORKSHOP_ROOM_DELIVERY_RUNAWAY_CHARACTERS` living beside its algorithm matches `WORKSHOP_ACTIONABLE_FINDING_BOUNDS` and `WORKSHOP_TODO_BOUNDS` — both single-consumer safety bounds — while `PROMPT_BUDGETS` is reserved for budgets shared across call sites.

> *"We've got three new pure-function modules that each got their own test file, and then the one renderer that didn't — go find it, it's hiding behind WorkshopPromptBuilder's tests like it's got somewhere else to be."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — The runaway guard is a corruption backstop, not a cost control

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:23,65–82`

`guardWorkshopRoomDelivery` is the *only* bound on `buildWorkshopRoomCatchUp` — the renderer docstring even calls it "the unbounded, whole-turn delta." Compare the sibling budget one file over: `guestJoinSnapshot` caps a **new** participant at 20 turns / 24,000 characters. An **existing** participant who simply goes quiet — writer steps away, or a guest hasn't been addressed in a stretch — gets up to 1,000,000 characters of raw turn content resent as prompt context on their next turn. That's ~42× the join budget and roughly 250k tokens of billed input on a single OpenRouter call. Given a realistic ~25k-character single reply, it takes ~40 backlogged turns to approach the cap, and it re-ships on every subsequent message until the backlog clears. At today's usage (a few turns between addresses) this never gets close — it's not corrupting anything, it's an economically unmotivated number. The threshold where it bites is exactly the scenario Sprint 13D exists for. I'd want a second, much lower catch-up budget mirroring `guestJoinSnapshot`, with 1M kept only as the true backstop.

### 🟡 Standard (Medium confidence) — Two full-ledger clones per turn plus an O(n) scan doing an O(k) lookup

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1001–1024, 1483–1493`

`prepare()` calls `readRoomDeliveryState` once and `commit()` calls it again — two `this.turns.map(cloneTurn)` passes plus two `projectWorkshopRoomTurns` per completed turn per participant, and `RunWorkshopToolSidePass` runs the same pair again. Separately, the publication-stamping loop does a full `for (const capabilityTurn of this.turns)` scan on every completed run despite already holding the exact ids in a `Set` of typically 1–3 entries — O(n) to do an O(k) lookup; a `Map<id, turn>` would fix it. Mitigating: `cloneTurn` is a shallow spread, not a deep content copy, so cost scales with *turn count*, not characters. At tens-to-low-hundreds of turns this is microseconds per message. Worth revisiting only if a single room accumulates into the thousands of turns without a reset.

### 🟢 Nit — Guest transcript formats every turn twice and throws the first pass away

`packages/core/src/application/services/workshop/WorkshopRoomFrameRenderer.ts:134–147`

`packWorkshopTurnsNewestFirst` calls the formatter — which runs a regex over the entire turn content — on every candidate just to measure `block.length`. `packed.blocks` is then never read; the caller pulls only `deliveredTurnIds`/`omittedTurns` and calls `renderTemporalRoomBlocks` to format the same turns again. Bounded today by the 20-turn / 24k join budget, so sub-millisecond. Dead work rather than scale risk: returning `blocks` keyed by turn id, or passing a memoizing formatter, deletes the second pass for free.

> *"The 1M-character guard isn't protecting your wallet, it's protecting your sanity — and only one of those costs money per token."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟡 Standard (Medium confidence) — Publication integrity validates the principal and ordering, not the originating request

`packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts:130–151`

The validator confirms `publishedWithTurnId` points to a *later* assistant reply that *belongs to the same principal* as the capability call — but never ties the publication back to the run that produced the result (there's no persisted `requestId` on `WorkshopTurn`). At runtime this is always correct by construction: `completeRun` only stamps capability turns recorded during the same active run. The persisted-file validator is looser — it accepts a hand-edited session where an old, never-published `resource_read` (one whose run was cancelled) has its `publishedWithTurnId` pointed at an unrelated later reply from the correct principal. On load, that turn flips `private → room` for every guest persona. The actor is the writer tampering with their own session JSON; practical impact is limited since they already have full access to the content as the host who invoked the read. The interesting effect is narrower: it can make a persona "know" something the room's turn-taking rules say it shouldn't yet.

**Cleared during this review** (traced and found sound): the fail-open `room` default is a deliberate "public by default, carve out two private cases" design with no sensitive turn reaching the fallthrough; the `PUBLISHABLE_CAPABILITY_OPERATIONS` allowlist is coherent and parametrically tested (`resource.catalog`/`resource.search` stay private even with a stamp); `workshopTurnBelongsToPrincipal` is correct in both directions; a disposed-then-reinvited guest gets a fully replaced map entry with the offset reset to the current head, so no inherited-offset leak; and `neutralizeReservedPersonaPromptDelimiters` does include `workshop-room-catch-up` in its reserved-tag regex, is applied uniformly to speaker labels *and* content across every branch, and gets re-applied by `neutralizeTrustedFrame()` at the host-embed boundary — defense in depth, not a single point of failure.

> *"The gate checks who spoke next, not whether they were answering the question you're pretending they answered."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟡 Standard — Delivery-integrity throws omit reader identity and offset values

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1044–1046`

All four CAS guards — `'Cannot advance a non-live Workshop participant'`, `'Workshop room offset changed during delivery'`, `'…receipt is stale'`, `'…is not a contiguous prefix'` — protect per-participant cursors in a room supporting the host plus multiple simultaneous guests, and none names the participant or the actual-vs-expected offset. They *are* caught and logged (both `sendError` and `events.error` append the raw message), so this isn't invisible — just underspecified. When a writer reports "my guest's replies look out of order," the log reads `Failed to message Whisper — Workshop room offset changed during delivery`, with no way to tell which guest or what drifted without adding print statements and asking for a repro. The sibling `readRoomDeliveryState` already does it right at line 1013: `` `Workshop guest ${reader.personaId} is not a live room reader` ``.

### 🟡 Standard — Commit-skip has no trail, unlike the sibling branch three lines below

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1107–1119`

When a run is cancelled or errors, `commit()` is simply never called and the cursor stays put — silently, zero log. Three lines down, the *same function* handles the structurally identical pending-host-update case explicitly with an `else if` that logs `'Pending host update retained after incomplete delivery'`. Same asymmetry at `RunWorkshopToolSidePass.ts:267–279`. If a writer reports a guest repeatedly re-catching-up on the same turns after cancelled runs, the Output Channel shows nothing confirming or ruling out "delivery never committed" — the developer has to infer it from the *absence* of a line, which is much weaker evidence. The idiom already exists one branch over.

> *"The pending-host-update branch tells you exactly when it punted; the room-delivery branch just shrugs and hopes the next turn fixes it — see you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟡 Standard — Full-delivery acknowledgement jumps to the physical ledger tail, not "the prefix's last id" [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:140–144`

ADR §5 states the rule plainly:

> *"An offset into an append-only log can only mean 'everything before this.' It may never jump a turn that was not delivered. … Committing therefore reduces to recording the prefix's last id."*

When every eligible pending turn was delivered, this code does not record the prefix's last id — it records `state.turns.at(-1)?.id`, the literal tail of the entire physical ledger, re-read fresh at commit time. That tail can include ineligible rows the reader never received.

I traced why it's very likely safe today: ADR §8's single-active-run invariant ("The Workshop admits only one active room run… so no reader can pass provisionally private evidence that later becomes room") means no other participant's turn can commit between this reader's `prepare()` and `commit()`. But that argument is external to this file — it rests entirely on an invariant this module doesn't reference, check, or assert — and the ADR itself flags a later-release tangent/sub-agent thread as a new principal kind that could run concurrently. `WorkshopRoomDeliveryService.test.ts`'s full-delivery cases never construct a ledger with a trailing ineligible row, so this exact divergence is unexercised. Is the ledger-tail jump an intentional optimization that should be documented as such, or should `commit()` literally record `deliveredTurnIds.at(-1)` as the ADR says, leaving the shortcut until it's actually needed?

> *"The ADR says 'record the prefix's last id.' The code says 'record the ledger's last id, they're the same thing right now, promise.' They are — until someone adds a second active run."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Load-Bearing Wall in the Next Room

Illuminated by: the head-jump consensus (Parker, Bria, Blake), the throw-containment consensus (Marcus, Blake), Blake's join-snapshot filter reuse

When a piece of code is safe only because of a fact enforced somewhere else — a single active-run slot, a synchronous stamp ordering two files away, a filter whose justification holds for one caller but not the other — that safety is invisible at the point of use. Three independent reviewers had to reconstruct the same invariant from scratch to arrive at "this is fine today." That's three people doing the work one sentence could have done once, and it's exactly how correct code quietly becomes fragile code: not because the logic is wrong, but because its safety is a rumor rather than a citation.

→ Carry forward: When a line's correctness depends on something true elsewhere, write that dependency down at the point of risk — not where it happens to be true today, but where the consequence lands if it stops being true.

### Lesson 2 — One Filter, Two Questions

Illuminated by: Blake's `prepareJoinSnapshot` reusing the delta projection; Parker's ownership-vs-dedup naming mismatch

Reuse is usually judged by whether the mechanism produces the right shape of output — and this one does, technically. But a join and a catch-up are different contracts wearing the same return type: one serves a reader with partial memory, the other a reader with none at all. "Does this function compute the right value" is not the same question as "was this function built to answer what I'm now asking it." A filter can be perfectly correct at its original job and silently wrong at its borrowed one — and its name will keep insisting it's fine after the meaning has drifted.

→ Carry forward: Before reusing a projection or filter at a second call site, write one sentence describing what the reader on the other end already knows. If the two sentences differ, that's two contracts.

### Lesson 3 — The Comment That Guards the Branch It Already Trusted

Illuminated by: `commit()`'s doc comment, which defends the else-branch and says nothing about the then-branch

A comment justifying one branch is real work, and also a tell. If a writer felt the need to explain why the safe-looking branch is safe, it's often because their doubt already visited that branch — and the branch that actually takes the risk received none of that scrutiny. The asymmetry in the commentary is itself evidence about where attention went missing.

→ Carry forward: When a function has two branches and only one has an explanatory comment, interrogate the silent one first. The silence is the signal, not merely the absence of one.

### Lesson 4 — A Backstop Is Not a Budget

Illuminated by: Tim's finding — the 1,000,000-character runaway guard standing in for the deleted 8-turn/20k budget

A guard built to catch corruption ("this should never happen") and a guard built to bound cost ("this happens constantly — keep it small") look identical in code: a number and a comparison. When the real budget disappears during a refactor, a nearby corruption backstop can quietly get promoted to fill its role, and nothing looks broken because there's still technically "a limit." But a limit sized for the impossible case is enormous for the ordinary one.

→ Carry forward: When you delete a bound during a refactor, go looking for the nearest surviving number that could be mistaken for its replacement, and ask what it was actually sized for. "There's still a limit" and "there's still the limit we needed" are different claims.

### Lesson 5 — Don't Let the System Lie to a Reader Who Can't Check

Illuminated by: the catch-up frame reporting "Omitted whole turns by bound: 0" while the reused filter was omitting turns

We're practiced at worrying about a system telling a *human* something untrue — a human can get suspicious, cross-reference, push back. Here the reader is a persona with no memory of what it wasn't given, explicitly instructed not to claim it witnessed anything omitted, while the omission counter reads zero because the wrong projection did the omitting one layer upstream. That's a stranger category of bug than a wrong answer: false metadata about the *completeness* of an answer, delivered to a reader engineered to trust it precisely because it cannot check.

→ Carry forward: Any claim a system makes about its own completeness or provenance — "0 omitted," "fully delivered," "no drift" — is itself an output that needs a test, driven from the same code path that could falsify it.

> *"We build these systems to remember for us; the least we owe them is to be honest when we didn't."* — Sensei

---

## The Closer

### 🐾 Animal

If this MR were an animal, it would be a **corvid caching food** — and this is not a compliment about being clever, it's a compliment about bookkeeping. A crow will hide thousands of caches, remember which ones it made while another bird was watching, and go back to re-hide exactly those. That is precisely what this PR built: one ledger, and a per-observer record of what each one actually witnessed. The old code was a crow that assumed every bird saw every cache. The new code checks.

It's also a corvid in the less flattering sense: it re-hid one guest's entire stash and then told her nothing was missing.

---

## Summary

This is strong work on a genuinely hard problem, and the harshest reviewer on the panel independently attacked the central claim and confirmed it holds — the acknowledgement bug from `.todo/tech-debt/2026-07-26-handoff-cursor-advances-past-undelivered-turns.md` is really closed, and the new `boundaries.test.ts` guard converts the ADR's "one delivery protocol" from prose into an enforced invariant. The audience/delivery/render split is the rare decomposition that earns its keep.

Two things want attention before merge. The join snapshot reusing the incremental-delta filter is a real behavioral defect with a verified reproduction and no test coverage at all — a re-invited guest is handed a conversation with her own half removed and a frame that reports nothing was omitted. And three reviewers independently landed on the same four lines of `commit()`: the head-jump is safe today, but it contradicts the ADR's own wording and depends entirely on an invariant named nowhere near it. Neither is a rewrite; both are small, surgical, and the tests to lock them in are obvious.

Everything else — the missing cost budget, the silent commit-skip, the `slice(-0)` landmine, the unlogged offsets — is the ordinary sediment of a large protocol replacement, and the ledger above will hold it.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
