# MR Review — feat(workshop): launch persona guest sidecars

**Author:** okeylanders · PR #76 · base `epic/workshop-editor-tab` ← `sprint/workshop-editor-tab-09-persona-guest-sidecars`

Reviewed by a 10-persona panel + Sensei. Draft PR; first user-visible slice of Workshop Sprint 09.

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | `workshop-guest-handoff` missing from `RESERVED_PERSONA_FRAME` — guest output can forge host framing (+ re-neutralize `guestHandoff.message` at the embed site) | Patricia, Cal, Stan | 🎯🎯 Strong | **Addressed** — registered, safely re-neutralized inside the trusted outer frame, and regression-tested |
| 2 | 🔴 Blocking | `beginToolRun` clears `directToolTarget` but not `personaGuestTarget` — a tool run silently strands the next message on the guest | Marcus | — | **Addressed** — replaced the dual pointers with one discriminated `chatTarget`; tool runs set it to host |
| 3 | 🟠 High | Dismissing a guest silently drops its un-relayed exchanges from the host handoff | Blake, Sam | 🎯 | **Addressed** — disposed guests retain evidence until a successful host handoff commits it |
| 4 | 🟠 High | Dismissed guest can never be re-invited, and `isPersonaSelectionLocked` also locks the host persona for the session | Bria, Cal, Sam | 🎯🎯 Strong | **Addressed** — duplicate/lock checks now use live guests; re-invitation preserves any pending delivery cursor |
| 5 | 🟡 Standard | `getChatTarget()` mutates `personaGuestTarget` on read (command-in-query); the self-heal branch is currently unreachable | Marcus | — | **Addressed** — getter is a pure read of the single routing field |
| 6 | 🟡 Standard | Dead `Promise.reject` branch shaped like a live fallback; the `target.kind` three-way split re-derived 6×; two nested ternaries whose indentation misstates their nesting | Parker | — | **Addressed** — dead fallback removed; target metadata and execution use explicit switches |
| 7 | 🟡 Standard | Guest opening message is a hardcoded constant; ADR §2 lists "the writer's opening message to the guest" as a co-equal envelope part | Bria | — | **Addressed** — invite modal now carries a bounded, writer-editable opening through the typed message contract |
| 8 | 🟡 Standard | Multi-guest handoff cursor interleaving (shared budget, per-guest cursors) is exercised only with a single guest | Cal | — | **Addressed** — two-guest ordering, attribution, shared packing, and per-guest cursor commit are covered |
| 9 | 🟡 Standard | Guest handoff/catch-up construction and guest dismissal leave no output-channel log, unlike every sibling disposal/handoff path | Oliver | — | **Addressed** — bounded handoff/catch-up counts and dismissal identity are logged |
| 10 | 🟡 Standard | Guest capacity (2) enforced only at the data layer; the invite UI never reflects "room full" — writer bounces off a rejection toast | Bria | — | **Addressed** — invite affordance is hidden at the shared live-guest capacity |
| 11 | 🟡 Standard | Guest transcript/catch-up/handoff packer duplicates the pre-existing direct-tool handoff bounded-packing algorithm (already diverges `push`/`unshift`) | Marcus | — | **Deferred** — tracked in [Workshop bounded turn packer](../../.todo/tech-debt/2026-07-14-workshop-bounded-turn-packer.md) |
| 12 | 🟡 Standard | Four cursor methods rebuild a full turn-index `Map` on every host send even with no live guests; free O(n)→O(1) short-circuit | Tim | — | **Addressed** — empty guest/delivery paths now return before indexing; disposed guests with pending evidence intentionally remain eligible |
| 13 | 🟢 Nit | `latestHostThreadTurnId` copies + reverses the whole array to find one element | Tim | — | **Addressed** — reverse index walk avoids allocation |
| 14 | 🟢 Praise | Guests × turns loop is O(n), not O(n²), because live-guest capacity is hard-capped at 2 | Tim | — | **N/A** |

## Resolution update (2026-07-14)

All merge-blocking, high, and open standard findings are addressed. The only
remaining deferred item is #11, the shared bounded-packer extraction; it is a
maintainability refactor with no current correctness gap and remains explicitly
tracked here before a third implementation appears.

---

## Blast Radius

- **28 files changed · +1479 / −65**, 2 commits
- New files: **1** (`resources/system-prompts/workshop-personas/guest-base.md` — the no-capability guest prompt contract)
- New message routes: **2** (`WORKSHOP_INVITE_GUEST`, `WORKSHOP_DISMISS_GUEST`) · new `WorkshopChatTarget` kind: `personaGuest` · new turn participant: `guest`
- New agent-run policy binding (guest → `workshopToolWithoutResources`), new prompt budgets (`guestJoinSnapshot` 20t/24k, `guestCatchUp` 8t/20k), new session state (`personaGuests` Map + `personaGuestTarget`)
- DB migrations: none (VS Code extension). Diff exceeds ~800 lines — agent focus was weighted to the three load-bearing files (`WorkshopSessionService.ts` +341, `WorkshopPromptBuilder.ts` +217, `WorkshopHandler.ts` +210).
- Character: strong, security-conscious feature work — bounded envelopes, host-owned lifecycle, honest happy-path tests — with two fixable boundary bugs and a consistent "extended the pattern to all-but-one site" theme.

---

## Initial Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | D |
| 🛡️ Security | F |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | B+ |
| 🎯 Domain | C |

*Architecture D and Security F are both driven by a single Blocking finding each; the underlying layering (handler → session service → assistant service → engine) is clean and the guest-variant factoring is good — the grades reflect the blast radius of the two boundary bugs, not systemic rot.*

---

## Initial Executive Briefing

🔴 **[Patricia · Cal · Stan]** Frame-injection gap *(🎯🎯 Strong Consensus)* — `workshop-guest-handoff` is the one new frame name left out of the neutralization regex. A guest's own model output containing `</workshop-guest-handoff>` closes the evidence frame early inside the **host** prompt (the only participant with tool capabilities), escaping the "context, not instructions" boundary. One-line fix + a mirror test.

🔴 **[Marcus]** Tool-run misroutes to the guest *(empirically reproduced; orchestrator elevated from HIGH)* — `beginToolRun` clears `directToolTarget` but not the new `personaGuestTarget`. Invite guest → run a tool → your next composer message silently routes to the guest, violating the method's own documented "a tool run always returns to host orchestration."

🟠 **[Bria · Cal · Sam]** Dismiss is a one-way door *(🎯🎯 Strong Consensus)* — a dismissed guest stays in the Map, so `validatePersonaGuestInvitation` (`.has()`) bars re-inviting that persona forever, and `isPersonaSelectionLocked` (`.size`) locks host-persona selection for the rest of the session. Capacity, three lines away, correctly counts live-only.

🟠 **[Blake · Sam]** Dismiss silently drops un-relayed guest evidence *(🎯 Consensus)* — `collectUnseenGuestExchangesForHost` skips non-live guests without flushing first. Chat with a guest, dismiss her, ask the host to act on her notes → the host never heard them. No error, no log.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🔴 Blocking — `beginToolRun()` resets one away-from-host pointer and forgets the other

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:385`

`WorkshopParticipants` now carries two independent "away from host" pointers: `directToolTarget` and the new `personaGuestTarget`. `setChatTarget` (357–377), `dismissPersonaGuest` (338–339), and `clearAllConversations` (945–946) all keep them mutually exclusive by clearing both. `beginToolRun` predates guests and clears only `directToolTarget` (385) — its comment even promises "a tool run always returns to host orchestration." Marcus reproduced it with a throwaway Jest test (written, run, deleted — tree verified clean): invite Margot → `setChatTarget({kind:'personaGuest', personaId:'margot'})` → run a tool sidecar → `getChatTarget()` still returns the guest. Reachable through ordinary UI (`toolsEnabled` in `WorkshopApp.tsx` never checks chat target), so the writer watches the host synthesize a report, types a follow-up, and it silently routes to the guest. *(Marcus graded this HIGH; the orchestrator elevated it to Blocking after independently confirming the missed reset and the normal-flow reachability — a silent misroute of the writer's message to the wrong participant is must-fix-before-merge. Downgrade in the ledger if you read the severity differently.)* Fix: collapse the two pointers into one `chatTarget`-shaped field, or add `this.participants.personaGuestTarget = undefined;` to `beginToolRun`.

### 🟡 Standard — `getChatTarget()` mutates on read, and the mutation is currently dead

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:272`

The getter — invoked on essentially every `postSessionState()` via `getSnapshot()` — writes `this.participants.personaGuestTarget = undefined` before returning `{kind:'host'}`. A command hiding inside a query (CQS). Deleting the write wouldn't change what this call returns; it only exists to influence a *future* call — self-healing on read. But every site that ends a guest's liveness (`dismissPersonaGuest`, `clearAllConversations`) already nulls the pointer explicitly, so the branch is currently unreachable. Sharp corollary from Marcus: this self-heal does **not** catch the `beginToolRun` bug above, because that's a "live guest, wrong focus" state, not a "guest went non-live" state. Keep the getter pure; repair invariants at the mutation sites — which is already everywhere except `beginToolRun`.

### 🟡 Standard — Guest packer re-implements the direct-tool handoff's bounded-packing algorithm

`packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts:141`

The PR correctly unifies its own three guest variants behind `buildGuestTranscriptFrame` (116–173) — good factoring. But that helper duplicates, near line-for-line, the pre-existing `boundByCharacterBudget`/`formatHandoffMessage` (445–498, untouched): same newest-first walk, same `separatorLength` rule, same head-truncate-then-omit branch, same `deliveredTurnIds`/`omittedTurns`/`truncatedCharacters` shape. Duplicated *knowledge*, not just text — "pack a turn thread into a turn+char budget, newest-first, and report what shipped for a cursor commit" is one concept serving both handoffs. The two copies already diverge (`push` vs `unshift` on `deliveredTurnIds`; harmless today only because both commit paths scan for a max index). First slice, so not a blocker — but the third copy is the one that quietly drifts.

> *"The thing that gives me pause is that `personaGuestTarget` joined `directToolTarget` as a second, separately-managed flag instead of folding into one routing field — and `beginToolRun` is the receipt: it resets the flag it was written to know about and leaves the one it wasn't."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

Cleared the red herrings on the way in: the `Promise.reject` guest branch is unreachable (guarded by the `!conversationId` return at `WorkshopHandler.ts:472`); `completeRun`→`adoptPersonaGuest`→`validatePersonaGuestInvitation` re-validation is dead-defensive under single-active-run; late-completion refusal, dismiss-during-join, zombie discard, and `reset`/`clearAllConversations` guest cleanup are all sound; cursor windowing mirrors the reviewed `commitHostHandoff` sibling. One real one:

### 🟠 High — Dismissing a guest silently drops her un-relayed exchanges from the host handoff [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:771`

`collectUnseenGuestExchangesForHost()` — the sole source feeding `buildWorkshopGuestHandoff` (called from `WorkshopHandler.executeMessage:492` whenever the writer messages the host) — skips every non-live guest. `dismissPersonaGuest` flips `liveness` to `disposed` without flushing `deliveredToHostThroughTurnId` first, so the instant you dismiss a guest, all her exchanges past the cursor (her join reply plus every continuation the host hasn't received) stop being collected — permanently, silently. The natural flow triggers it: invite Margot → chat → click her dismiss ✕ → ask the host "what should I revise?" → the host has never heard a word she said. The PR's stated contract is "hands bounded guest evidence back to the host," and the dismiss button on every chip quietly voids it. Liveness is the right guard for *catch-up* and *targeting*; harvesting already-produced turns into the host's context shouldn't depend on the guest still being alive. Untested — the one cursor test commits the handoff *before* dismissing.

> *"Writer dismisses the guest, asks the host to act on her notes, host has amnesia — I've been paged at 3am for quieter data loss than this."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🟠 High — A dismissed guest can never be re-invited, and permanently locks the host persona too [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:300`

`dismissPersonaGuest` never removes the guest from the Map (by design — "preserve historical thread attribution") — it only flips `liveness` to `disposed`. But `validatePersonaGuestInvitation` (296–308) checks `.has(personaId)` at line 300, not liveness, so once any persona is invited then dismissed, every future invitation of that persona throws "already in the room" — forever — even though `isLivePersonaGuest` reports them gone and the capacity check three lines below (`liveGuests` filtered on `liveness === 'live'`) correctly excludes them. The UI mirrors the lockout (`invitedPersonaIds` doesn't filter on liveness, so the card just greys out with no error). **Compounding damage Sam found:** `isPersonaSelectionLocked()` (345) tests `personaGuests.size > 0` — Map size, not live count — so after *any* guest has been dismissed, the writer can never change the host persona either, with zero live guests remaining. *(Sam graded this Blocking; held at High as the panel severity — the re-invite half is plausibly an intended "disposed guests are retained" choice, while the host-persona lock is clearly unintended. Confirm intent, then fix the `.has()`/`.size` checks to count liveness.)*

### 🟠 High — Dismissing a guest silently discards exchanges not yet handed to the host [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:771`

Independent confirmation of Blake's finding, at HIGH confidence. Sam's added nuance: this is materially worse than the bounded-budget truncation elsewhere in the file, which at least emits "Omitted turns by bound: N" — here the loss is total and signal-free. The turn stays visible to the writer in the transcript UI, but the host's retained conversation never receives it.

> *"I dismissed Margot, the little pill chip vanished from the rail, and now the room swears she's 'already here'… she just went quiet in a corner nobody can see, blocking her own seat and jamming the host-picker lock for the rest of the story. What if 'goodbye' doesn't mean goodbye?"* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — Unreachable `Promise.reject` branch shaped like a live fallback

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:592`

The guard at 472 already returns for a `personaGuest` target lacking a conversation id, so by 586 `conversationId` is truthy for guests and the outer `conversationId ? continueConversation(...) : ...` always takes its true branch — the `Promise.reject` arm is dead. Not harmless: it's shaped like a live fallback (even caught and surfaced as "Failed to message X"), so the next person to touch the guard has no signal it's unreachable. Prefer a plain `throw` (or an `unreachable()` helper), or restructure the three-way split as a `switch` where TypeScript exhaustiveness does the job for real.

### 🟡 Standard — The `target.kind` three-way split is re-derived six times; the status ternary's indentation lies

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:577`

The same `host | tool | personaGuest` split is independently re-derived for `conversationId`, `modelMessage`, `label`, `requestId`, `activeRun`, `userTurn`, and the status string — at least six towers. The status string (573–583) is four ternaries deep and its indentation puts `: target.kind === 'tool'`, `: target.kind === 'personaGuest'`, and `: Streaming…` at the same column, reading as three siblings when right-associativity makes them nested. A reader trusting the shape misreads the precedence, and the next edit (a fourth target kind) goes wrong quietly. Pull it into one `switch (target.kind)` that computes the record once.

### 🟡 Standard — `formatGuestTranscriptTurn`'s speaker ternary has the same lying indentation

`packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts:109`

Same failure mode in the sibling file: the `session` branch is dedented to the same column as the `guest` branch though it's that ternary's else. Five participant checks read as a flat list; they're five levels deep. A `switch (turn.participant)` makes each branch a parallel statement that can't drift out of sync with the logic the way this formatting already has.

> *"This ternary is technically correct and practically a liar — the indentation says `personaGuest` and `Streaming` are siblings, right-associativity says otherwise, and the `Promise.reject` two branches over has been dead since line 472; give it a `switch` and let the code say what it actually means."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🔴 Blocking — `workshop-guest-handoff` delimiter missing from the neutralization allowlist [🎯🎯 Strong Consensus]

`packages/core/src/utils/workshopPromptFrames.ts:3`

*(See Patricia's section for the full attack trace — Cal, Stan, and Patricia all landed here independently.)* Cal's test-lens contribution: the sibling `<workshop-transcript>` path is both correctly escaped **and** has a dedicated forgery test (`WorkshopPromptBuilder.test.ts`, "…neutralizes frame markers" asserts `&lt;/workshop-transcript&gt;`). There is no equivalent for `workshop-guest-handoff` — grepping both prompt-builder and handler test files for "GuestHandoff"/"guest-handoff" turns up a single assertion that the tag is *present*, never that a reserved delimiter inside it is escaped. The missing test and the missing regex entry went dark in lockstep. Fix: add the frame name to the regex, then add the mirror neutralization test.

### 🟠 High — Dismissed guest can never be re-invited [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:300`

Independent confirmation of the `.has()`-vs-liveness lockout (see Sam). Cal's angle: the live/disposed distinction was clearly understood for capacity (filtered) but not applied to the duplicate check three lines up — and no test exercises invite→dismiss→re-invite of the same persona, so the behavior isn't pinned as a contract anywhere. It just falls out of `.has()`.

### 🟡 Standard — Two-guest handoff interleaving has zero coverage

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:767`

`collectUnseenGuestExchangesForHost` loops per live guest over the entire turn array, collects each guest's unseen writer/guest pairs, then globally sorts; `commitHostGuestHandoff` re-derives each cursor; and `buildWorkshopGuestHandoff` funnels *all* guests' evidence through one shared 8-turn/20k budget, so one guest can crowd out another in a single round. The only test touching these uses a single guest start to finish; the one two-guest test never sends either a message. A regression in the per-guest `response.personaId !== guest.personaId` filter, or in how the shared budget apportions across guests, would pass the full suite today.

> *"Ninety-two suites, seven-hundred-forty-nine green checks, and the one guest whose words actually get quoted back to the host is the one nobody taught to spell its own name correctly — peace is what you get when you stop mistaking a passing suite for a proven boundary."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🔴 Blocking — `workshop-guest-handoff` never joined `RESERVED_PERSONA_FRAME` — the third sibling left outside [🎯🎯 Strong Consensus]

`packages/core/src/utils/workshopPromptFrames.ts:3`

`buildGuestTranscriptFrame` takes `frameName: 'workshop-transcript' | 'workshop-guest-catch-up' | 'workshop-guest-handoff'`, and this exact diff hunk registers two of those three literals in the regex — `workshop-transcript` and `workshop-guest-catch-up`. The third, used by `buildWorkshopGuestHandoff` (line 199), did not get added: same author, same commit, two out of three. Stan's careful correction to a tempting adjacent claim: the raw embed of `guestHandoff.message` at `buildWorkshopHostMessage:554` is **not** itself the bug — `buildWorkshopDirectHandoff`'s `formatExchangeBlock` never pre-escapes `turn.content`, so `handoff.message` genuinely needs the late re-neutralization at 551; `guestHandoff` (like sibling `todoEvidence` and `hostUpdate`, both also raw-embedded) is *supposed* to already be safe because `formatGuestTranscriptTurn` pre-escapes each turn — and it would be, if its own frame name were registered. The lone unregistered frame is the tell.

> *"Two of the three new frame names got their invitation to `RESERVED_PERSONA_FRAME` in this very same hunk — `workshop-guest-handoff` is still standing outside in the room it's supposed to be quoted in."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟡 Standard — Four cursor methods rebuild a full turn-index on every host send, guests or not

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:768`

`collectUnseenGuestExchangesForHost` runs on every host-directed send (gated only on `target.kind === 'host'`, never on whether a guest exists) and builds `new Map(this.turns.map(...))` over the *entire* `this.turns` array before the guest loop starts. Note: `this.turns` is **not** the 100-turn snapshot window — that bound applies only to the outward snapshot — so `n` tracks total session turns, not "dozens." In the common case (no guest ever, or all dismissed) the index is built and thrown away every host turn, forever; the same shape repeats in `collectUnseenHostTurnsForGuest`, `commitGuestCatchUp`, `commitHostGuestHandoff`. Sub-millisecond next to the LLM round-trip that dominates this path — **not a latency bug today** — but a free O(n)→O(1) win: short-circuit on "no live guests" before touching `this.turns`.

### 🟢 Nit — `latestHostThreadTurnId` copies and reverses the whole array to find one element

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1125`

`[...this.turns].reverse().find(...)` is two O(n) passes plus an allocation to walk backwards to the newest match; a plain reverse `for` loop is identical with zero allocation. Only reachable from `adoptPersonaGuest` (≤2×/session), so microseconds twice a session — a free swap if you're already in the method, not worth a dedicated trip.

### 🟢 Praise — The guests × turns loop is linear, not quadratic — the cap is doing its job

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:777`

`for (guest of personaGuests.values())` wrapping a scan to `this.turns.length` is the classic O(guests × turns) shape that turns ugly once either dimension grows. It doesn't here: `validatePersonaGuestInvitation` hard-caps live guests at `WORKSHOP_GUEST_CAPACITY = 2` before adoption, so the outer loop is bounded by a constant — worst case O(2n) = O(n). Correctly scoped; only a risk if a future sprint lets that `2` scale with room size.

> *"You rebuild the whole turn index four times an exchange to answer a question bounded by two possible guests — free today only because the LLM call next door is four orders of magnitude slower, and 'unbounded for the life of the session' is exactly the kind of phrase that ages badly."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🔴 Blocking — `workshop-guest-handoff` omitted from the reserved-delimiter regex — guest output can forge host framing [🎯🎯 Strong Consensus]

`packages/core/src/utils/workshopPromptFrames.ts:3`

Trace the trust flow. A guest turn's raw `content` is stored verbatim at completion (`WorkshopSessionService.completeRun`, no write-time sanitization), and the guest is explicitly no-capability/advisory — the lowest-trust, model-generated text in the system. When the writer next messages the host, `WorkshopHandler.executeMessage` builds `guestHandoff = buildWorkshopGuestHandoff(collectUnseenGuestExchangesForHost())` (491–493) with `includeGuestTurns=true` specifically to carry the guest's own words. Each turn passes through `formatGuestTranscriptTurn` → `neutralizeReservedPersonaPromptDelimiters(turn.content)` (WorkshopPromptBuilder.ts:113) — a no-op for a literal `</workshop-guest-handoff>` because the regex doesn't recognize that tag. The result is embedded into `modelMessage` and sent via `continueConversation(conversationId, modelMessage, { capability: hostCapability })` — and `hostCapability` is non-undefined precisely when `target.kind === 'host'`, which is precisely when `guestHandoff` is populated. So the forged framing lands in the one prompt that carries tool capability.

**Why this is cross-participant, not writer-self-inflicted:** the writer's own message has the same regex gap, but the writer already owns a legitimate direct-instruction channel — the "WRITER MESSAGE:" block immediately below — so forging framing there grants no new privilege. The guest has no such channel; the handoff frame is its *only* route into host-trusted context, and the invariant this file exists to enforce ("an excerpt cannot close or forge host framing," per its own header) does not hold for it. No test constructs a guest turn containing the delimiter.

### 🟠 High — `guestHandoff.message` embedded without the re-neutralization pass `handoff.message` gets

`packages/core/src/application/services/workshop/WorkshopPromptBuilder.ts:554`

Defense-in-depth companion to the fix above. In `buildWorkshopHostMessage`, `options.handoff.message` is wrapped in a second `neutralizeReservedPersonaPromptDelimiters(...)` at embed time (551) — the belt-and-suspenders pattern the file credits to "PR #72 review #4." `options.guestHandoff?.message` three lines later gets no second pass. Today this doesn't create an *independent* second hole (re-running the same buggy regex wouldn't catch `workshop-guest-handoff` anyway), but once the regex is fixed, this call site is still the only one of the two host-bound handoff frames with a single point of failure — a future refactor of the per-turn pass, or a new `WorkshopTranscript` producer that bypasses it, silently loses the net that `handoff.message` keeps by construction. Fix mirrors line 551: `options.guestHandoff ? neutralizeReservedPersonaPromptDelimiters(options.guestHandoff.message) : undefined`.

> *"The guest was built with no tools and no trust — but the one frame whose entire job was reminding the host of that fact forgot its own name in the regex, and the writer's evidence pipe forgot to double-check on the way in, which is how a 'read-only advisory sidecar' ends up drafting the host's next instruction."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟡 Standard — Guest handoff/catch-up frames are built with zero diagnostic log, unlike the sibling direct-tool handoff

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:491`

`handoff` (direct-tool evidence to the host) gets an explicit prep-time log at 513–517 (`unseen → included, omitted, chars truncated`). `guestHandoff` (491–493) and `guestCatchUp` (494–496) are the structurally identical `WorkshopTranscript` shape — same `includedTurns`/`omittedTurns`/`truncatedCharacters` — but neither ever reaches `outputChannel.appendLine`. `WorkshopSessionService` has no `LogSink` at all, so the handler is the only place this could land. When a guest reply looks like it's missing recent room context, or the host seems to ignore what a guest said, there's nothing to check truncation/inclusion counts for that run. Aligns with the PR's own remaining-work note ("guest-specific token/log evidence").

### 🟡 Standard — `handleDismissGuest` leaves zero output-channel trace on its success path

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:394`

Both early-return branches log via `sendError`'s built-in `appendLine`. The success path — the one that actually discards a live provider conversation — calls `discardConversation` directly (bypassing the handler's own `discardConversations()` helper) then only `sendStatus`, which is webview-only. Compare the sibling `handleResetSession` (logs "Session reset (N conversations discarded)") and `replaceExcerpt` (logs version + retired sidecar count on every disposal). Every other place in this file that discards a conversation announces it; this one logs neither persona id nor conversation id. "I dismissed Margot but something's still burning tokens" has nothing to correlate.

> *"Margot can join the room, ghost mid-stream, and get shown the door, and the output channel only clears its throat for the ones that go wrong — that's not a trail, that's a shrug, and shrugs don't debug well at 2am."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

### 🟠 High — Dismissed guest can never be re-invited — is exile intended? [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:300`

Bria's domain framing of the lockout (see Sam/Cal for the mechanics). Corroborating fact she pulled from the ADR (`docs/adr/2026-07-11-workshop-guest-persona-sidecars.md`): "Guests are individually dismissible" describes dismissal as a routine lifecycle action, not permanent exile; nothing in the ADR or sprint doc calls out permanent re-invitation lockout as intended. The sprint's "cap 2, reject duplicates of an existing guest" reads naturally as "reject a currently-*live* duplicate." Is a dismissed guest supposed to be gone for the session, or should dismissal free the persona for later re-invitation?

### 🟡 Standard — Writer can't author the guest's opening message

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:95`

`handleInviteGuest` passes the hardcoded `DEFAULT_WORKSHOP_GUEST_OPENING` as both the `openingMessage` and the `displayText` — every invitation, every persona, opens identically. `WorkshopInviteGuestPayload` carries only `personaId`; the guest-mode modal is persona cards wired to `onInvite?.(persona.id)` with no text field anywhere. But ADR §2 lists the join envelope's three parts as the transcript, the excerpt frame, and **"the writer's opening message to the guest"** — phrasing that implies writer-authored content, parallel to how the composer always carries the writer's own words to the host. The sprint's "Remaining work" doesn't mention deferring a custom opening. Deliberate v1 cut, or did the invite-composer text field get lost between the ADR and this PR?

### 🟡 Standard — Guest capacity isn't reflected in the invite UI

`packages/core/src/presentation/webview/components/workshop/WorkshopPersonaBrowserModal.tsx:86`

`WORKSHOP_GUEST_CAPACITY = 2` is enforced only in the session service — zero hits in any webview file. With two live guests, the rail still renders "Invite guest," the modal still opens, and a third persona's card is still clickable; the writer only learns the room is full when `handleInviteGuest` round-trips to the capacity throw and an error toast returns. Functionally safe (no bad state), but the sprint task explicitly calls out rail "overflow behavior that keeps host + 2 guests + tool chips legible" — was disabling the invite entry point at capacity meant to ship in this slice?

> *"Margot gets dismissed and the room just… remembers her as banished — no test, no doc line saying that's the plan, just a `.has()` that can't tell 'gone for now' from 'gone forever,' so I have to ask: exile or intermission?"* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — The Invisible Nth Site

Illuminated by: Patricia+Cal+Stan frame gap, Marcus `beginToolRun`, Bria+Cal+Sam live/disposed split

When you add a member to a set — a third frame, a second target pointer, a "disposed but retained" state — you aren't adding one thing; you're creating an obligation at every site that already reasons about that set. The code keeps no manifest of those sites, so you satisfy the ones in front of you and miss the ones over the horizon. And notice: you clearly *had* the knowledge — the capacity check counts live-only correctly, three lines from where the duplicate check didn't. The failure was never knowing the rule; it was propagating it to every room the rule was meant to live in.

→ Carry forward: When a change adds a member to a category, don't ask "did I handle the new thing?" Ask "who are its siblings, and where do they *all* get touched?" Grep the oldest sibling by name (`directToolTarget`, the existing frame builders) and walk every hit — your diff should shadow it.

### Lesson 2 — Danger Pools in the Blind Spot

Illuminated by: Patricia+Cal (the un-neutralized frame was the only path into the tool-capable host), Marcus (the un-reset pointer held the one documented invariant)

The site you miss is not chosen by a fair coin. The un-neutralized frame was precisely the handoff carrying model output into the only participant that can run tools; the un-cleared pointer was precisely the one guarding the invariant you'd bothered to write down. This is structural, not unlucky — the most dangerous path is usually the newest, longest, least-traveled one, which is exactly the path the eye glides over and the tests don't reach.

→ Carry forward: Rank the N sites by blast radius, then spend review attention *inversely* to how settled each feels. The path that moves untrusted output across a trust boundary earns ten times the scrutiny of the display-only paths — most of all when it feels already handled.

### Lesson 3 — Your Tests Read What You Meant to Write

Illuminated by: the join-transcript forgery test that exists vs the handoff test that doesn't; Cal's single-guest-only interleaving

A proofreader misses their own typos because they read the sentence they *intended*, not the one on the page — and a test written from the author's mental model inherits exactly the author's blind spots. The forgery test guarded the path you were thinking about; the unguarded path was the one you weren't, which is also where the bug was. Hand-written example tests can only probe cases you already imagined, so the missing test and the missing fix go dark in lockstep.

→ Carry forward: When safety depends on a set being complete, write the test as a loop over the set, not as N separate cases — "for *every* frame, quoting its delimiter must be neutralized." Let the enumeration be the oracle, so a frame added tomorrow without its guard fails the suite on its own.

### Lesson 4 — Give the Invariant One Home

Illuminated by: Marcus `beginToolRun` + `getChatTarget`, Patricia+Cal frame-list vs neutralizer-list, Marcus duplicated packer, Parker's six re-derived splits

Nearly every finding here traces to one invariant maintained by scattered discipline instead of by structure. Two independent away-from-host pointers make "clear both" a thing you must remember at six call sites — so one gets missed and another grows a dead mutation to compensate. Two hand-kept lists that must agree drift, because no single place owns the truth. When an invariant lives in human vigilance, you get *both* missing guards and redundant ones.

→ Carry forward: When you catch yourself keeping two things in sync — two pointers, two lists, two near-identical packers — ask "what one change to the *shape* of this data would make disagreement impossible?" One target-with-a-kind; a neutralizer set derived *from* the frame registry; one packer called twice. Make the illegal state unrepresentable, and the N−1 bug has nowhere left to live.

> *"You already knew the live-from-disposed lesson — you taught it to the capacity check with your own hands; the craft was never learning the rule once, but teaching it patiently to every room it was meant to live in."* — Sensei

---

## The Closer

### 🎬 Movie tagline

> In a room where every word is bounded and every guest arrives with no tools and no trust… one forgotten name in one regex let the advisory sidecar pick up the host's pen. She was only invited to read. She stayed to rewrite the room. **GUEST FRAME** — this sprint, the quiet ones do the talking.

---

## Final Resolution Summary

The reviewed slice is now merge-ready from this panel's perspective. The frame
injection and silent-routing blockers are closed, dismissed guest evidence is
delivered transactionally, live/disposed lifecycle checks permit safe
re-invitation, and routing now has one discriminated source of truth. The
writer-authored opener, room-capacity UI, guest logs, and multi-guest regression
coverage also landed. Finding #11 remains as explicit low-priority tech debt;
it is a shared-packer extraction, not an open behavior or trust-boundary gap.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
