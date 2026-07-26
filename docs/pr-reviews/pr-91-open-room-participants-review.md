# MR Review — Open Workshop rooms to persona guests (Sprint 13D_2)

**Author:** okeylanders · PR #91 · `sprint/workshop-editor-tab-13d_2-open-room-participants` → `epic/workshop-editor-tab`

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status`
column as findings are addressed so this file stays a living record. Legend: **Open** =
act before merge · **Deferred** = real issue, safe to punt for a stated reason (track it)
· **Addressed** = fixed · **Partially addressed** = fixed with a noted remainder · **N/A**
= out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🟠 High | Guest manifest seeded from live state at completion, not from the join envelope actually sent | Marcus, Blake, Sam, Patricia, Oliver, Bria | 🎯🎯 Strong (6) | **Addressed** |
| 2 | 🟠 High | Participant-subject policy now written in four places; newest copy (`canInviteGuest`) is the loosest | Marcus, Parker, Bria | 🎯🎯 Strong (3) | **Addressed** |
| 3 | 🟠 High | Both new invite-guard refusal branches unexercised at both layers | Cal | — | **Addressed** |
| 4 | 🟡 Standard | Catch-up status classified from post-guard `turns`, not eligible `pending` | Parker, Cal, Oliver, Sam, Bria | 🎯🎯 Strong (5) | **Addressed** |
| 5 | 🟡 Standard | Semantic flag smuggled through string shape; `/\s+context$/i` written twice in one file | Stan, Parker, Marcus | 🎯🎯 Strong (3) | **Addressed** |
| 6 | 🟡 Standard | Excerpt-scope joins now also ship standing context; mixed pin+context case untested | Cal, Tim | 🎯 (2) | **Addressed** |
| 7 | 🟡 Standard | The one comment whose invariant changed lost its sprint/ADR traceability tag | Stan | — | **Addressed** |
| 8 | 🟡 Standard | New status classification is invisible in the log | Oliver | — | **Addressed** |
| 9 | 🟢 Praise | Gate flip from `target.kind !== 'host'` to `=== 'tool'` verified airtight across all nine combinations | Blake | — | **N/A** |
| 10 | 🟢 Praise | Delivery-accounting log deliberately left gated on turn count, not the new classification | Oliver | — | **N/A** |
| 11 | 🟢 Nit | Three suspected scaling concerns confirmed to genuinely not matter | Tim | — | **N/A** |

### Resolution notes — 2026-07-26

1. `beginPersonaGuestJoin` now captures the exact excerpt, standing-context
   list, and derived writer-source rows used by the join envelope. The source
   rows ride the active run and seed adoption after the provider await;
   `adoptPersonaGuest` never re-reads live room state.
2. `WorkshopSessionService.getParticipantSubjectStatus()` is the single policy
   authority. The handler translates its typed reason, the session snapshot
   exposes `participantSubjectReady`, the hook consumes that boolean, and the
   invite gate reuses `workshop.canMessage`.
3. The pure aggregate policy test exercises all four subject combinations;
   guest-join and handler tests exercise unchosen-scope refusal and both
   handler refusal messages.
4. `WorkshopRoomDeliveryService.prepare()` classifies the complete eligible
   `pending` backlog before applying the runaway guard. An injected guard test
   proves deferred conversation still selects conversational catch-up.
5. `ContextBudget` now accepts a bare `participantLabel` and explicit
   `showsContextSuffix`; both suffix regexes were removed.
6. Prompt-builder and manifest tests cover excerpt + standing context together.
7. The capability invariant comment now cites Sprint 13D_2 / ADR 2026-07-26.
8. The existing delivery-accounting log now records
   `status=conversational|lifecycle-only`, with tests for both values.

---

## Blast Radius

- 16 files changed · +374 / −44 lines
- New files: 2 (ADR + sprint doc) · Migrations: no · New services/controllers: none
- 6 source files, 6 test files, 4 docs. No persistence schema change, no new transport, no new state store.
- Characterization: a **policy widening** (`requireHostSubject` → `requireParticipantSubject`) plus a **status-classification fix**, delivered on top of an already-landed delivery architecture. Small diff, high semantic leverage — it changes who may speak in a room and what the writer is told about it.

---

## Report Card

| Category | Grade |
| --- | --- |
| 🏛️ Architecture | C |
| 🛡️ Security | C+ |
| 🧪 Tests | C |
| 📖 Quality | B− |
| ⚡ Performance | B+ |
| 🎯 Domain | C |

---

## Executive Briefing

🟠 **[6-reviewer Strong Consensus]** **The guest manifest can lie about what the guest was told.** `handleInviteGuest` snapshots context attachments at T0 to build the prompt; `adoptPersonaGuest` re-reads them live at T1 after the awaited LLM call, and *that* is what seeds the writer-facing manifest. The comment above the code asserts the invariant the code doesn't enforce. `rejectExcerptMutationWhileRunning()` exists in this very file and guards `handleSetExcerpt` — none of the five context-attachment handlers have it.

🟠 **[Marcus, Parker, Bria]** **The ADR's central claim doesn't hold.** ADR §1 says the aggregate owns the participant-subject invariant "once" and handlers "may not recreate a different host-versus-guest policy." It now lives in four places, and the newest — `canInviteGuest` — checks `!!workshop.excerpt` where its sibling `canMessage` checks `!!excerpt?.text.trim()`.

🟠 **[Cal]** **Neither new refusal branch is tested.** The PR split one flat check into two branches with distinct messages; neither string is asserted anywhere, because every test calls `pin()` or `chooseOpen()` first. A test was deleted and an assertion inverted in the same change.

🟡 **[5-reviewer Strong Consensus]** **The catch-up classifier is asked the wrong pipeline stage** — `roomDelivery.turns` (post-guard) instead of `pending`. Blake dissented on reachability and was verified correct: it needs a single ~1M-character turn, which the prompt budgets prevent. Real reasoning error, currently masked by a budget that happens to hold.

---

## 🏛️ Marcus · Architecture & Design

"The Cartographer of Layer Boundaries"

### 🟠 High — Guest manifest seeded from live attachments, not the snapshot delivered at invitation [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1093-1099`

The ADR states the guest manifest is recorded "because they were actually delivered" (§2). But the two reads of `contextAttachments` happen at different clock ticks. `handleInviteGuest` snapshots `getContextAttachments()` at invitation time to build the prompt actually sent to the model. `adoptPersonaGuest` only runs later, inside `completeRun`, after the async `startWorkshopGuestConversation` call resolves — and it reads `this.contextAttachments` fresh.

Worth noting: the host's pin-adoption path has the identical shape. This isn't a new failure mode invented here — it's an existing weak invariant now extended from one pin to an open-ended attachment list, which widens the blast radius.

### 🟠 High — The participant-subject invariant is independently re-derived, not delegated [🎯🎯 Strong Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:611-623` and `893-912`

The ADR is explicit: "The aggregate owns this invariant once as the participant-subject guard." I searched for a shared predicate the handler could consult — `getScope()`/`getExcerpt()` are the only exposed accessors; grepped for `canAdmit`/`canSend`/`canInvite`, not found. Instead both handler methods independently re-derive the scope/excerpt boolean logic ahead of calling into the aggregate.

I checked every `(scope, hasExcerpt, target)` combination and they currently agree. But "translate a thrown error's message" and "duplicate the branching logic that decides whether to throw" are different things, and the latter is what's happening. Add a third scope value or a new participant kind and four independently-maintained copies must move in lockstep.

### 🟡 Standard — `ParticipantLabel` infers a semantic distinction from string shape [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/shared/ContextBudget.tsx:90-91, 108-113`

`WorkshopApp.tsx` already knows, at the call site, whether it's passing a bare name or a measured "`<name> context`" label — that's exactly the `scope === 'open' && !hasExcerpt` branch it just evaluated. Instead of passing that explicitly, it collapses both into one ambiguous string and lets `ContextBudget` re-derive the distinction twice. A label whose suffix carries meaning is an illegal-state-shaped contract — what happens to a persona literally named "… Context"?

> *"The invariant that matters here isn't wrong — it's just not living in one house, and a manifest that can't promise what it says it delivered isn't a UI bug, it's a broken contract wearing a UI costume."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

"She's Been Paged for This Before"

### 🟡 Standard — Manifest seeded from a second read taken at run completion [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1098`

Two reads of the same mutable field at two different times, and the code comment asserts they are one. Nothing serializes them. `registerRoutes` wraps context mutations in `rejectRoomMutationDuringSessionOperation`, which returns early unless `isSessionOperationPending()` — a save/load lock, not a run lock. So `WORKSHOP_ADD_CONTEXT_RESOURCES` and `WORKSHOP_ADD_CONTEXT_TEXT` are accepted by the backend while a guest join is streaming.

The manifest is frozen at adoption, so the lie is permanent for that guest. Fix is one line: capture the attachment list beside the frame in `handleInviteGuest` and pass it to `adoptPersonaGuest`. Rated MEDIUM confidence only because reachability depends on a modal-open race I could not walk end to end.

### 🟢 Praise — The `!hasExcerpt` gate flip is airtight

Enumerated all nine `(scope, hasExcerpt, target.kind)` combinations against `WorkshopHandler.ts:898-910`. `target.kind === 'tool'` errors first; host and personaGuest both fall through to `scope !== 'open'`, so `scope: 'excerpt'` with a blank or missing excerpt still rejects a guest exactly as before. No combination reaches code that dereferences a missing excerpt: `buildWorkshopGuestJoinMessage` guards `input.excerpt` at both use sites, `WorkshopPersonaCapability` already treats `turn.excerpt` as optional, and `WorkshopSessionStateV1Migration` normalizes persisted `scope: undefined` before restore, so the legacy-session path lands on `requireExcerpt`, not past it. Nothing here blocks merge.

> *"One field, two reads, an await in between, and a comment swearing they're the same value — that's not a manifest, that's a memory of one."* — Blake

---

## 🔍 Sam · Bug Hunter

"What if the list is empty, though?"

### 🟠 High — Guard-truncated delivery can hide a real backlog behind "Streaming…" [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopRoomDeliveryService.ts:38-44`

Concretely: pending = `[session_start, <huge real turn that alone exceeds the guard>]`. `guardWorkshopRoomDelivery` always keeps the first turn unconditionally, then breaks on the oversized second turn, so `turns = [session_start]` and `deferredTurns = 1`. The classifier returns `false`, so the writer sees `Streaming Jill…`.

Meanwhile `buildWorkshopRoomCatchUp(turns, deferredTurns, …)` explicitly appends *"Some later room turns remain pending and have not been witnessed"* into the **model's** prompt. So the model is told a backlog exists, but the writer's status copy claims ordinary streaming — the exact inversion of the bug this PR sets out to fix.

**Orchestrator adjudication:** Blake dissented and is correct on reachability — this requires a single turn near 1M characters, which `PROMPT_BUDGETS` makes unreachable today. Landed as Standard, not High. The reasoning error is real; the exposure is not.

### 🟠 High — Manifest seeded from live attachments at run-completion [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1093-1097`

`handleAddContextText` (and the Edit/Preview sheet's `applyTextSheet` → `addContextText`/`updateContextText` path) has no `rejectExcerptMutationWhileRunning`-style guard, unlike every excerpt mutation handler in the same file. If the writer adds an attachment mid-stream, `adoptPersonaGuest` stamps it into the manifest even though it was never in the prompt. If they remove one that *was* in the prompt, the manifest silently drops it.

> *"Two clocks measuring the same 'what did the guest actually get' question — one ticks at invite, one ticks at completion, and nobody's watching the gap between them."* — Sam

---

## 📖 Parker · Code Quality

"Code is Communication, Not Instruction"

### 🟡 Standard — Label-suffix decision encoded three times via string-shape sniffing [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/shared/ContextBudget.tsx:91, 108-112`

Three places must agree: `WorkshopApp.tsx` builds the string, `participantName` strips the suffix with a regex, and `ParticipantLabel` re-tests the *same* regex against the *same* string to decide whether to render the word back. The boolean the component actually needs is known for a fact at the call site at the exact moment it's discarded into a string.

Simpler: give `ContextBudget` an explicit `showsContextSuffix?: boolean` and delete both regexes.

### 🟡 Standard — `canInviteGuest` reinvents (and weakens) `canMessage`'s subject check [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:399-404`

`useWorkshop.ts:891-893` already computes exactly this concept for `canMessage`. `canInviteGuest` restates it and not identically — `!!workshop.excerpt` (object presence) instead of `!!excerpt?.text.trim()` (non-blank content), plus a `scope !== null` clause already implied by the union type. Safe today only because `handleSetExcerpt` rejects blank text upstream — an invariant the reader has to verify in a different file.

### 🟡 Standard — `hasWorkshopConversationalCatchUp` reads the post-guard slice [🎯🎯 Strong Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:929-931`

The name and doc comment are about "is there real conversation to catch up on," which is a question about `pending`, but it's fed the delivery-shaped slice. Classify off `pending` (or thread `deferredTurns` into the boolean), and rename the parameter so a future caller doesn't pass the wrong pipeline stage.

> *"I read `hasConversationalCatchUp` three times expecting it to ask 'is there unseen conversation,' and each time it turned out to be asking 'did the runaway guard let it through' instead."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

"Confidence Levels, Not Coverage Numbers"

### 🟠 High — Both new invite-guard branches unexercised at both layers

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:613-622`

This PR replaced a single flat `!excerpt` check with two distinct branches, each with its own user-facing message. Searched the diff and the whole test tree for `'Choose how to start this session'` and `'Pin an excerpt before inviting'` — neither string is asserted anywhere. Every `handleInviteGuest` call in the test file is preceded by `pin()` or `chooseOpen()`.

The same gap exists one layer down: `beginPersonaGuestJoin` now calls `requireParticipantSubject`, whose `scope === null` throw is likewise untested for the guest-join path — only `beginPersonaMessage` and `beginToolRun` get that coverage.

### 🟡 Standard — Excerpt-scope manifest change untested where pin and standing context coexist [🎯 Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1096-1098`

This spread is unconditional — it changes guest-manifest seeding for *excerpt*-scope guests too. The pre-existing test pins an excerpt but adds zero attachments (so the new spread contributes nothing and the test passes identically before and after); the new test has an attachment but no pin. **No test ever invites a guest into a room with both** — the actual mixed case this PR newly enables.

### 🟡 Standard — Catch-up classification blind to guard-deferred turns [🎯🎯 Strong Consensus]

`WorkshopRoomDeliveryService.test.ts` tests `guardWorkshopRoomDelivery`'s truncation in isolation and `hasWorkshopConversationalCatchUp` against hand-built arrays in isolation — never together. Both new handler catch-up tests use small, unguarded turn sets.

> *"I don't need every line covered — I need to know that when the guard truncates, the status bar doesn't just shrug and say 'Streaming' over a queue it can't see."* — Cal

---

## 🗂️ Stan · Codebase Standards

"He Has Every Pattern Memorized"

### 🟡 Standard — Guest-capability comment dropped its sprint/ADR tag mid-edit

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:670`

This file annotates every invariant comment with a traceable tag — `// Sprint 13A §1: what a turn needs depends on the session's SCOPE…` (line 883), `// Session scope (ADR 2026-07-25)…` (line 1475), `// … the scope lock (ADR 2026-07-25)…` (line 2626). The old comment here was tagged `// Sprint 13C:`; the reword strips the tag entirely instead of updating it to the sprint that actually changed this invariant. This is precisely the site whose behavior this PR changed, so it's the one comment in the diff that most needed a fresh reference — and it's the one that lost its reference.

### 🟡 Standard — New suffix check duplicates `participantName`'s regex instead of a named predicate [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/components/shared/ContextBudget.tsx:111`

Every other derivation this file needs in JSX is hoisted to a named function above the component — `kindLabel`, `originLabel`, `compressionLabel`, `compressionValueClass`, and `participantName` itself. The new suffix check inlines the same `/\s+context$/i` pattern raw inside the JSX ternary rather than adding a sibling predicate next to `participantName`.

> *"Two copies of the same regex a page apart — the file already had a drawer for this labeled 'predicates go here,' and somebody set this one down on the counter instead."* — Stan

---

## ⚡ Tim · Performance

"O(n²) at Scale is an Incident Waiting to Happen"

### 🟡 Standard — Guest join now re-ships the full standing-context budget, once per invited guest [🎯 Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:643`

The math. `PROMPT_BUDGETS.contextAttachments` caps standing context at 50,000 words / 420,000 characters — at ~4 chars/token, worst case ~105k tokens. Against `guestJoinSnapshot` (100 turns / 100,000 chars ≈ 25k tokens) and `personaExcerpt` (≈ 30k tokens), a maximally-loaded excerpt-scope guest invite can approach ~160k tokens before the opening message.

**Doesn't matter:** this is not new exposure in kind — the host's first turn already ships the identical call. And it does *not* double-ship: `recordContextChange` only pushes a short divider (`Added context: Story compass · 6 words`) into the room ledger, so the snapshot carries no attachment bodies.

**Does matter, mildly:** before this PR, excerpt-scope guest invites shipped **zero** standing context. Now every guest invite pays up to that ~105k-token cost, and each persona guest is a separate OpenRouter conversation with no shared cache. Three guests against a context-heavy room pays it three times. Real, quantifiable, intended, and already bounded — worth knowing the number, not worth blocking on.

### 🟢 Nit — The three flagged "does this scale" spots don't

Checked all three explicitly. The `.some()` scan is bounded by the 1M-character guard — sub-millisecond, once per message. The `ContextBudget` double regex runs on a ~20-character string once per render — nanoseconds against React's own overhead. `adoptPersonaGuest`'s `.map()` runs once per adoption over a writer-curated list. No action needed on any of the three.

> *"The budget was already doing its job before this diff showed up — the only new arithmetic here is guests now getting billed for it too, and that's a design choice with a number attached, not a leak."* — Tim

---

## 🛡️ Patricia · Security

"She Reads Code Like an Attacker Would"

### 🟠 High — Guest manifest seeded from live state, not from what was actually sent [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1093-1099`

Traced the full round trip. Between T0 (frame built) and T1 (manifest seeded) there is a real, unguarded window: `handleAddContextText`, `handleAddContextFile`, `handleAddContextResources`, `handleRemoveContextAttachment`, and `handleUpdateContextText` are all registered as plain `registerMutation`s with **no `rejectExcerptMutationWhileRunning()` check** — that guard exists only on excerpt-mutating handlers, and its own comment explains it exists precisely to close this class of mid-run race.

Context attachments never got the same guard. Before this PR that omission was harmless for guest manifests, because `adoptPersonaGuest` only recorded `pin` (which *is* guarded). **This PR extends the completion-time-snapshot pattern to unguarded state, so the omission now has teeth.**

**Practical judgment:** not a disclosure to an unauthorized party — all context attachments are room-wide by design, so no cross-participant confidentiality boundary is crossed. But it is a traceable violation of the ADR's own stated invariant and undermines the honesty guarantee the manifest exists to provide. Practical-but-narrow: requires the writer to edit context during an in-flight invitation, not attacker-controlled input. HIGH, not Blocking.

*No prompt-injection or capability-widening findings.* The neutralization path holds on the new frames, and the guest capability minted with `excerpt: undefined` does not silently widen.

> *"The manifest promises to say exactly what a guest was told, but it doesn't watch the moment the promise is made — it watches the moment the promise is checked, and those are not always the same instant."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

"Would This Failure Leave a Trail at 2am?"

### 🟠 High — Join content and its later manifest snapshot can diverge, with zero log to reconcile them [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1093-1099`

Searched the whole diff for any new `appendLine` call — not found. So if a writer ever files *"Felix keeps talking like he never saw my story compass note"* (or the reverse — quoting something he shouldn't know), there is no local record of either the join-time or completion-time attachment set to compare against. The PR's own body flags manual EDH smoke as still pending for exactly this invitation path; right now that smoke test would produce no trail at all if it silently mis-seeded the manifest.

### 🟡 Standard — The new status decision is invisible in the log

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:1005-1007`

Searched for any log of the `hasConversationalCatchUp` value or the chosen `statusMessage` — not found. The neighbouring `Room catch-up prepared` log still fires and still reports included/deferred counts correctly, so the raw numbers *are* on disk — but nothing ties those numbers to which status text the writer actually saw. A developer chasing "writer says nothing loaded but the log shows 12 deferred" has to reconstruct the classification by hand.

### 🟢 Praise — The delivery-accounting log survives the status-copy change untouched

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:948-951`

This log is gated on `deliveredTurnIds.length > 0`, not on `hasConversationalCatchUp`, so it keeps firing — with true included/deferred counts — even in the new lifecycle-only case where the user-facing copy deliberately goes quiet. That's the right split: quieter UI, unchanged ground truth on disk. It's the reason the finding above is Standard and not High.

> *"I can forgive a status message for being calm; I can't forgive a codebase for being unable to tell me, after the fact, whether calm was the right call."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

"Does This Code Actually Do What the Ticket Asked?"

### 🟠 High — Manifest seeded from live state at completion, not from the join envelope [🎯🎯 Strong Consensus]

`packages/core/src/application/services/workshop/WorkshopSessionService.ts:1093-1097`

ADR §2 justifies recording standing context "because they were actually delivered." The comment directly above asserts the invariant the code doesn't enforce. Is a completion-time snapshot intentional (e.g. because mutation is UI-gated by `roomMutationLocked` during any run), or should the join-time snapshot be threaded through and reused so the manifest can't drift from the actual envelope?

### 🟡 Standard — `canInviteGuest` recreates a weaker copy of the participant-subject guard [🎯🎯 Strong Consensus]

`packages/core/src/presentation/webview/WorkshopApp.tsx:399-401`

ADR §1 says the aggregate owns the invariant "once" and handlers "may not recreate a different host-versus-guest policy." The codebase now has the same policy written three different ways — aggregate `requireParticipantSubject`, hook `canMessage`, and this new `canInviteGuest` — and the newest copy is the loosest. Was reusing `workshop.canMessage` for the invite gate considered?

### 🟡 Standard — Catch-up status classified from the post-guard prefix [🎯🎯 Strong Consensus]

`packages/core/src/application/handlers/domain/WorkshopHandler.ts:929-930`

It self-corrects on the very next turn, since the deferred content becomes the new "first" turn — so this is a narrow, one-turn edge case rather than a persistent one. Is that considered acceptable, or should classification use the pre-guard `pending` set?

> *"The comment says the manifest 'must describe that exact input' — but it's reading `this.contextAttachments` fresh off the shelf at delivery time, not the box that actually shipped. Cute promise, wrong timestamp."* — Bria

---

## 🎓 Sensei · The Teacher

"The Review Is the Lesson. The Code Is the Practice."

### Lesson 1 — The Snapshot You Forgot to Take

Illuminated by: Finding 1 (and its shadow in Finding 3's deleted test)

When your code reads some state, then waits — an await, a network call, a few seconds of someone else's thinking — the world does not hold still for you. If what you tell the user afterward must describe *what you originally saw*, you have to carry that original view forward as data, not go back and ask the world again once you're done waiting. The comment in this code already knew the rule ("the retained manifest must describe that exact input") — it just didn't trust the code to keep the promise the words made. A comment stating an invariant the code doesn't enforce is not documentation. It's a wish.

→ Carry forward: Whenever you see a `read → await → read again (same source)` shape, ask out loud: "is the second read guaranteed to equal the first?" If the honest answer is "usually," snapshot at the first read and use the snapshot.

### Lesson 2 — Ask the Full Set, Not the Slice Someone Already Cut

Illuminated by: Finding 4

A pipeline often produces more than one shape of "the data" as it flows — the raw backlog, the truncated slice, the rendered prefix. Each shape was cut for a purpose. When a new question arrives, it's tempting to hand it whatever variable is closest at hand, especially if it already has the right type. But a variable filtered for a *different* reason may quietly answer a *different* question. This bug is real today and invisible today, because a budget constraint elsewhere happens to keep the two answers aligned. That's not safety, that's coincidence wearing safety's coat.

→ Carry forward: Before feeding a variable into a new decision, trace it one hop upstream and ask what it was already filtered *for*. If the answer isn't "for this," go get the unfiltered set.

### Lesson 3 — An Invariant Has One Home Address

Illuminated by: Finding 2

The ADR said the aggregate owns this rule once, and handlers may only translate it. And yet the rule now lives in four places, and the newest one is the loosest — checking "is there an object" where its neighbour checks "is there real content." This is how policy drift happens: not through one careless developer, but through each new caller reasonably assuming its own small check is close enough. Every unguarded copy is a place the rule can quietly relax without anyone deciding it should.

→ Carry forward: Before writing a condition that smells like "can this participant do X," grep for the phrase first. If it already exists upstream, thread the answer through — don't re-derive it downstream, even approximately.

### Lesson 4 — Don't Let a Boolean Go Underground

Illuminated by: Finding 5

Somewhere in this code, something *knew* — as a clean, unambiguous boolean — whether this participant carries context. And at the exact moment of knowing, it buried that fact inside a string and left the next reader to dig it back out with a regex. Worse, dug twice, with two separate shovels. Every time a fact crosses a boundary encoded as a weaker signal than it started as, someone downstream has to reconstruct it — imperfectly, and usually more than once.

→ Carry forward: When you catch yourself formatting a fact into a string for display *and* another consumer needs the fact itself, ask whether the boolean should have crossed that boundary directly, with the string generated from it — not the other way around.

### Lesson 5 — A Fork in the Road Needs Two Footprints

Illuminated by: Finding 3

Splitting one check into two distinguishable failure messages is a real improvement in honesty toward the user — but it's also a silent promise that both paths matter enough to name separately. If every test still walks the one paved road, the fork exists only in the code, not in anyone's verified understanding of it. And a checklist marked all `[x]` while manual smoke testing is still pending tells the same story at a larger scale: green and verified are not synonyms, they just went to school together.

→ Carry forward: When a change turns one branch into two, write the test for the branch you *didn't* take before the one you did — the refusal path is the one nobody wants to type out, which is exactly why it's worth typing out.

> *"The bug that slips past a green suite and a checked box is rarely hiding — it's usually standing in the one place nobody thought to ask a second question."* — Sensei

---

## The Closer

### 🎋 Haiku

```
The guest arrives, told
what the room holds — but the room
kept changing its mind.
```

---

## Summary

**Nearly there.** The core move — letting scope rather than excerpt-presence decide who may speak — is sound, and Blake's nine-combination sweep confirms the gate flip introduces no reachable crash. The two documents are genuinely good: the ADR names its own supersession of the 13A holdout and the sprint file records real verification.

What needs work sits in the seam this PR opens rather than in the policy it changes. Six reviewers independently landed on the same thing: the guest manifest is seeded from a second read taken after an awaited network call, while a comment three lines above swears it describes the first. Patricia found why that now matters — `rejectExcerptMutationWhileRunning()` guards the excerpt but was never applied to the five context-attachment handlers, an omission that was harmless until this PR started recording those attachments. The fix is small: capture the attachment list beside the frame in `handleInviteGuest` and pass it into `adoptPersonaGuest`, and consider extending the existing run guard to the context handlers.

Given the domain is *honesty about what each participant knows*, findings 1 and 3 deserve to land before merge — a manifest that can misreport is a defect in the product's central promise, and the two new refusal messages are currently unverified in either direction. Finding 4 is a one-line correctness improvement worth taking even though Blake proved it unreachable today. The manual EDH smoke the PR body defers is exactly where the untested refusal branches would surface.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
