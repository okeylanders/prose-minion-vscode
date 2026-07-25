# MR Review — Sprint 13A_2: Scope Immutability — the session path settles once the room has a memory

**Author:** Okey Landers · PR [#87](https://github.com/okeylanders/prose-minion-vscode/pull/87) · `sprint/workshop-editor-tab-13a_2-scope-immutability` → `epic/workshop-editor-tab`
**Reviewed:** 2026-07-25 · Implements [ADR 2026-07-25](../adr/2026-07-25-workshop-scope-immutability.md) · Origin: [PR #86 review](pr-86-open-chat-session-scope-review.md)

---

## Resolution ledger

Status is the reviewer's **initial recommendation**, not a verdict — update the `Status` column as
findings are addressed so this file stays a living record. Legend: **Open** = act before merge ·
**Deferred** = real issue, safe to punt for a stated reason (track it) · **Addressed** = fixed ·
**Partially addressed** = fixed with a noted remainder · **N/A** = out of scope or superseded.

| # | Sev | Finding | Reviewers | Consensus | Status |
|---|-----|---------|-----------|-----------|--------|
| 1 | 🔴 Blocking | The 13A `open` + pinned-excerpt hybrid hydrates verbatim and wedges the session | Blake, Sam | 🎯 | **Addressed** |
| 2 | 🟠 High | Dismissing a persona guest un-locks the scope, and their exchanges still ship to the host | Blake | — | **Addressed** |
| 3 | 🟠 High | The persona-guest lock path has zero test coverage | Cal | — | **Addressed** |
| 4 | 🟠 High | The legacy-delivery-reason migration test exercises only one of its two branches | Cal, Bria | 🎯 | **Addressed** |
| 5 | 🟠 High | The ADR's named "Required test" never walks the resume path it names | Cal | — | **Addressed** |
| 6 | 🟠 High | The scope-lock refusal is silent in two of its three handlers | Oliver | — | **N/A** — `sendError()` already logs every refusal; regression assertion added |
| 7 | 🟠 High | The hydration migration that rewrites a session's scope leaves no trail | Oliver | — | **Addressed** |
| 8 | 🟠 High | The refusal sentence is authored four times, once inside the host-agnostic core | Marcus | — | **Addressed** |
| 9 | 🟠 High | The comp/product divergence landed under a new heading, not the ADR-mandated one | Stan, Bria | 🎯 | **Addressed** |
| 10 | 🟡 Standard | One concept, four names — and `locked` doesn't lock what it says | Parker, Marcus | 🎯 | **Addressed** |
| 11 | 🟡 Standard | `setSessionScope`'s idempotence checks silently depend on preceding the lock check | Parker | — | **Addressed** |
| 12 | 🟡 Standard | The handler's banner comment still describes the machinery this PR deleted | Parker | — | **Addressed** |
| 13 | 🟡 Standard | `replaceExcerpt` invents a second refusal idiom for the third member of one family | Stan | — | **Addressed** |
| 14 | 🟡 Standard | The one-time migration lives inline in the permanent hydration path | Marcus | — | **Addressed** |
| 15 | 🟡 Standard | A degraded host binding silently re-unlocks a room whose transcript proves otherwise | Oliver | — | **Deferred** — policy documented at the predicate; coordinator logs binding loss |
| 16 | 🟡 Standard | `hostDeliveredExcerptVersion()` re-derives what `activeHostPin` already caches in O(1) | Tim | — | **Deferred** — doesn't matter at current scale |
| 17 | 🟢 Praise | The lock predicate is bounded by a fixed participant enum; the PR only shrinks the broadcast | Tim | — | **N/A** |
| 18 | 🟢 Praise | A genuinely clean security pass — the load-bearing integrity rule survived | Patricia | — | **N/A** |

---

## Resolution pass — 2026-07-25

The blocking hybrid now passes through a named V1 hydration migration before
current invariants are enforced. `scope: 'open'` plus a pinned excerpt becomes
a passage session, is reported in the hydration result, and is logged by the
persistence coordinator. The same migration owns the older withdrawal and
delivery-reason normalization instead of leaving one-time compatibility logic
inline in the aggregate.

Dismissed persona guests now remain scope-lock evidence through their existing
durable participant tombstone. Their unseen exchange remains eligible for the
host handoff because the passage path can no longer change underneath it. The
test walks the real join → response → dismiss path and proves both properties.

The domain now throws `WorkshopScopeLockedError`; one shared product-copy
constant supplies the proactive UI signposts and reactive handler refusal.
`roomHasMemory` is the name from snapshot through hook and all three surfaces.
The handler's central four-caller helper is named `tryReplaceExcerpt`, and
`setSessionScope` makes the load-bearing idempotence-before-lock ordering
explicit.

Verification after the resolution pass:

- Focused scope/persistence/handler/webview suite: **230 tests passed**
- All three TypeScript projects: **clean**
- ESLint: **0 errors** (repository baseline warnings remain)
- Full Jest suite: **1,342 tests passed**, snapshot green

---

## Blast Radius

- **24 files changed · +815 / −637** — a net-negative PR that deletes six mechanisms
- New files: 1 (sprint doc `13a_2-scope-immutability.md`) · Migrations: yes (checkpoint hydration, §7) · New services/handlers: none
- 9 of 24 files are tests — the test suite is the bulk of the change
- **Character:** an architectural simplification landing as deletion. The two real defects are both in the seam between the new construction and the data the old construction wrote.

---

## Report Card

| Category | At review | After resolution |
| --- | --- | --- |
| 🏛️ Architecture | C | **A−** |
| 🛡️ Security | A | **A** |
| 🧪 Tests | D | **A−** |
| 📖 Quality | B− | **A−** |
| ⚡ Performance | B+ | **B+** |
| 🎯 Domain | C | **A** |

*The blocking finding was a migration-seam defect straddling Architecture and Domain; the report card
grades each reviewer's own findings, so the blocker's weight lived in the briefing rather than in a
single letter. The resolution column reflects the verified pass recorded above — the migration is now
a named, twice-validated boundary, and both defects are covered at unit **and** integration level.
Performance is unchanged because there was nothing to fix.*

---

## Executive Briefing

> **Resolved 2026-07-25.** Every item below was fixed and independently verified — see
> [Resolution pass](#resolution-pass--2026-07-25) and the ledger. Kept in the original present tense
> as the record of what the panel found; the "How it resolved" line on each states where it landed.

🔴 **[Blake + Sam · 🎯 Consensus]** **The `open` + pinned-excerpt hybrid wedges the session.** The old
`setExcerpt` let an open conversation adopt a passage and stay open, so `scope: 'open'` with a
populated `excerpt` is a real, structurally valid checkpoint on disk. §7 normalizes exactly one legacy
shape and misses this one. On hydrate, all three exits throw — including `setSessionScope('open')`
refusing *"this room already has a conversation"* at a room that is already open — while the UI renders
"Update text…" as an enabled button. Verified independently against base commit `bfcaf45`.
→ *How it resolved:* a named `WorkshopSessionStateV1Migration` module normalizes the hybrid to a
passage session, hydration runs **validate → migrate → validate again**, and the integrity validator
now forbids the shape outright behind a single opt-in flag that dies at the migration boundary.

🟠 **[Blake]** **Dismissing a persona guest un-locks the scope.** `dismissPersonaGuest` clears
`conversationId`, so the guest leaves `conversationIds()` and `hasRoomMemory()` returns to `false` —
the one property this PR exists to remove. The dismissed guest's passage-specific commentary then
ships into the host's opening prompt anyway, because `collectUnseenGuestExchangesForHost` has no
liveness filter.
→ *How it resolved:* inverted — `hasRoomMemory()` now counts `personaGuests.size > 0`, so a guest that
ever held a conversation is permanent lock evidence and the handoff stays honest *because* the path
can no longer move under it. `reset()` clears the tombstones via `newParticipants()`, so a new session
is not born locked.

🟠 **[Cal]** **The persona-guest lock path has zero tests** — and it is exactly where Blake's defect
lives. The untested path and the broken path are the same path.
→ *How it resolved:* a test walks the real join → `completeRun` → dismiss path and asserts both
properties — the lock persists, and the exchange stays eligible for the host handoff.

🟠 **[Cal + Bria · 🎯 Consensus]** **A migration test that looks like it covers a branch and doesn't.**
The `pendingExcerptChange` test passes `{ host: 'host-conv' }`, but the fixture never starts a host
conversation, so `hostExpected` is false and the binding is never consulted. Only the "dropped" branch
runs.
→ *How it resolved:* the fixture now calls `startHostConversation()` first, so the binding is genuinely
consulted, and a second test covers the "no host memory survives" branch. Both rows of §7 are live.

🟠 **[Oliver]** **The refusal a writer will hit first is the one that logs nothing.** The author added
`appendLine` before `sendError` for the excerpt-pin refusal but not in `handleSetSessionScope` or
`handleRepinExcerpt`, which catch the identical new lock throw.
→ *How it resolved:* **rejected as a false positive.** `sendError` has always ended with
`outputChannel.appendLine(...)` — confirmed present before the resolution pass — so every scope refusal
was logged the whole time. Oliver compared two handlers against a sibling without checking the shared
helper, which Rule B exists to prevent. A regression assertion was added instead.

---

## 🏛️ Marcus · Architecture & Design

*"The Cartographer of Layer Boundaries"*

### 🟠 High — The scope lock's refusal message is UI copy, authored four times across the dependency boundary

[`WorkshopSessionService.ts:378-382`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L378-L382)

`packages/core` is meant to be host-agnostic — the composition-root rule in `CLAUDE.md` exists
precisely so this aggregate can be reused by a non-VS-Code host. But `requireUnlockedScope` throws a
fully-formed, writer-facing sentence, and `WorkshopHandler`'s catch block
([`:2553-2560`](../../packages/core/src/application/handlers/domain/WorkshopHandler.ts#L2553-L2560))
forwards it to the webview verbatim — with a test asserting on that literal string. Meanwhile
[`ExcerptPanel.tsx:140-147`](../../packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx#L140-L147),
[`:324-328`](../../packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx#L324-L328),
and [`WorkshopScopeStrip.tsx:64-68`](../../packages/core/src/presentation/webview/components/workshop/WorkshopScopeStrip.tsx#L64-L68)
each hand-author their own version of the same "start a new session, your excerpt and context carry
over" message for the *proactive* signpost. Four independently-maintained copies of one product
decision, one baked into the domain layer, with nothing enforcing agreement. The reactive (thrown) and
proactive (rendered) paths will drift the next time either is tweaked, and any future host inherits
this exact English by construction.

**Suggested:** throw a typed refusal (`{ reason: 'scope-locked' }` or an error code) and let one
presentation-side formatter own the sentence — the same formatter both the signpost and the error
toast call into.

### 🟡 Standard — The §7 migration lives inline in the mainline hydration path, not as an isolated versioned step

[`WorkshopSessionService.ts:1825-1843`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1825-L1843)

`WorkshopSessionStateV1` still calls itself V1 with no version discriminant, and the one-time
normalization is spliced directly into `hydrateCommittedState`'s primary variable derivation — the
same function that will read every future checkpoint forever. No structural marker separates "this is
a current checkpoint" from "this is a one-time shim for pre-lock data." Six months out, someone reading
cold has to reconstruct from a comment, not a type, that `withdrawalNeverShipped` is dead weight for
anything written after 2026-07-25. Given `CLAUDE.md`'s aversion to legacy paths and that the author has
deliberately carved out persisted writer data as the exception, the exception should *look* like one
structurally — a named migration step called once at the top of hydration.

> *"The bones are sound, but the room where the writer's refusal gets its words is now three rooms, and only one of them is on the blueprint."* — Marcus

---

## 🔥 Blake · Critical / Blocking Issues

*"She's Been Paged for This Before"*

### 🔴 Blocking — The 13A open-with-excerpt hybrid hydrates verbatim and permanently wedges the session [🎯 Consensus]

[`WorkshopSessionService.ts:1837-1843`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1837-L1843)

§7 normalizes exactly one legacy shape (`withdrawalNeverShipped`). It does not normalize the other one
13A could write. On the base branch, `setExcerpt` read:

```ts
// Pinning IS choosing the passage path — but an open conversation that
// adopts an excerpt stays open (Sprint 13A §4: a visible context
// transition, not a new session).
if (this.scope !== 'open') {
  this.scope = 'excerpt';
}
```

So `scope: 'open'` with a populated `excerpt` is a real, structurally valid V1 checkpoint.
[`WorkshopSessionStateV1Integrity.ts`](../../packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts)
only forbids `excerpt` + `shelvedExcerpt` together — it contains **zero** references to `scope`.

**Trace.** Hydrate that checkpoint with the host binding present → L1839 restores `scope: 'open'`,
L1829 restores the excerpt, host conversation restored → `hasRoomMemory()` is `true`. Now every path
out is refused:

| Attempt | Result |
|---|---|
| `replaceExcerpt` ([`:503-508`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L503-L508)) | sees `scope === 'open'` → throws through all four handler call sites (`:1189`, `:1759`, `:2160`, `:2228`) → `sendError` toast |
| `setSessionScope('excerpt')` | fails the `:411` idempotence guard (scope isn't `'excerpt'`) → `requireUnlockedScope` throws |
| `setSessionScope('open')` | fails the `:397` guard (`this.excerpt` is truthy) → throws *"this room already has a conversation"* at a session that is **already open** |

Meanwhile `ExcerptPanel` falls into its pinned branch
([`:260`](../../packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx#L260)+)
because `excerpt` is truthy regardless of `scope`, and renders "Update text…" / "Re-read from file"
**enabled**. The writer clicks a live button and gets a guaranteed refusal naming a recovery path for a
passage the room already holds. `WorkshopScopeStrip` simultaneously renders *"Open conversation · No
excerpt yet"* ([`:63`](../../packages/core/src/presentation/webview/components/workshop/WorkshopScopeStrip.tsx#L63))
— an on-screen contradiction. `exportCommittedState` writes the hybrid straight back, so it persists
across every open.

This directly contradicts the sprint doc's own promise: *"`replaceExcerpt(...)` in a locked passage
session is unchanged: revision stays available."*

**Coverage:** every legacy hydration fixture in `WorkshopSessionScope.test.ts` (`:483-537`) sets
`excerpt: undefined`. Nothing hydrates `scope: 'open'` with a pinned excerpt.

**Fix:** normalize at the same boundary — `state.scope === 'open' && excerpt !== undefined` →
`scope: 'excerpt'` (the host holds it; agreeing with the host is the same rule §7 already applies to
the undelivered withdrawal). Then assert the invariant in the integrity validator so it can never come
back.

### 🟠 High — Dismissing a guest un-locks the scope, and that guest's exchanges still ship to the host

[`WorkshopSessionService.ts:996-1015`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L996-L1015)

`dismissPersonaGuest` clears `guest.conversationId` before flipping liveness, so a dismissed guest
contributes nothing to `conversationIds()` and `hasRoomMemory()` returns to `false`. **The lock is
reversible** — the one property this PR exists to remove.

**Trace.** Pin excerpt v1 → invite Margot (`beginPersonaGuestJoin`
[`:1256-1264`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1256-L1264)
requires only `requireExcerpt()`, no host conversation) → she is handed the pin in her join envelope
and replies about it → dismiss her → `hasRoomMemory()` is `false` → `setSessionScope('open')` passes
`requireUnlockedScope`, shelves the passage, mints no divider ("invisible to everyone"). Then the
writer's first host message: `collectUnseenGuestExchangesForHost`
([`:1478`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1478))
iterates `personaGuests.values()` with **no liveness filter**, and no cursor was ever advanced — so the
guest-handoff frame delivers Margot's passage-specific commentary into the host's opening prompt. A
host that holds no excerpt, in a room that reports `scope: 'open'`.

That is precisely the ambiguity `requireUnlockedScope` was written to prevent, reached *through the
predicate itself*.

**Coverage:** every lock test uses `startHostConversation()`. No test dismisses a guest and then
changes scope.

**Fix (pick one, currently neither holds):** make the predicate count a guest that ever *held* a
conversation (a `hasHeldConversation` flag, or `personaGuests.size > 0`), **or** filter
`collectUnseenGuestExchangesForHost` by liveness and drop the pending handoff on dismissal.

> *"The lock has a back door and a legacy checkpoint that walks straight into a dead room — ship this and I'll see you in the incident channel."* — Blake

---

## 🔍 Sam · Bug Hunter

*"What if the list is empty, though?"*

### 🔴 Blocking — Hydration doesn't retire the `open` + pinned-excerpt hybrid it was supposed to kill [🎯 Consensus]

[`WorkshopSessionService.ts:1825-1843`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1825-L1843)

*Same defect as Blake's blocker, reached by a second independent route.* Sam traced it through
`repinShelvedExcerpt` rather than `setExcerpt`: on the base branch
(`git show bfcaf45`), that method calls `adoptShelvedExcerpt(shelved)` and records a `scope_change`
divider but **never touches `this.scope`**. So a writer who pinned, went open, then re-pinned *without
leaving the open conversation* — a fully tested Sprint 13A feature — also lands in `scope: 'open'` with
`excerpt` defined, persisted exactly that way.

Two routes into the same invalid state raises the probability that such checkpoints exist on disk. The
`setExcerpt` route Blake found is the likelier one, since "Add excerpt" mid-open-chat was a first-class
13A affordance.

> *"Found the trap door — it's a 'supported' repin from PR #86 that never touched `scope`, and this migration only patches the withdrawal case, so `open` + a pinned excerpt sails through hydration looking perfectly legal right up until the strip lies to the writer's face."* — Sam

---

## 📖 Parker · Code Quality

*"Code is Communication, Not Instruction"*

### 🟡 Standard — One boolean, four names, and one of them lies a little [🎯 Consensus]

[`ExcerptPanel.tsx:58`](../../packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx#L58)

`WorkshopApp.tsx` reads the same value out of the hook and hands it to three sibling components under
two different names in the same JSX tree: `locked={workshop.roomHasMemory}` for `ExcerptPanel`,
`roomHasMemory={...}` for `WorkshopScopeStrip` and `WorkshopComposer`. Upstream it's `hasRoomMemory()`
on the aggregate and `hasConversation` on the snapshot — four names, one concept, three layers.

But `locked` isn't just a rename — it's doing double duty. When `locked` is true in the excerpt-pinned
branch ([`:292-304`](../../packages/core/src/presentation/webview/components/workshop/ExcerptPanel.tsx#L292-L304)),
the "Paste or type" button doesn't disappear or disable; it **relabels to "Update text…" and stays
fully clickable** — that's `replaceExcerpt`, a live mutation. What actually goes away under `locked` is
the scope-reversal button. So the boolean genuinely locks the *session path* but only cosmetically
"locks" the *excerpt content*. A reader who sees `locked` and assumes "nothing here can change" will be
wrong about half the panel.

**Suggested:** pass `roomHasMemory` through unchanged and let the JSDoc, not the identifier, carry the
"this switches the intake copy too" nuance.

### 🟡 Standard — `setSessionScope`'s guard placement makes the lock/idempotence relationship implicit

[`WorkshopSessionService.ts:395-424`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L395-L424)

Two branches, each with the same shape — idempotence check, then `requireUnlockedScope(...)`, then the
mutation. The ordering is correct and load-bearing (re-asking for the scope you're already in must
never throw, even when locked, which a test depends on) — but nothing says "no-op check precedes lock
check, on purpose." The `excerpt` branch's last line, `if (this.excerpt === undefined) {
this.adoptShelvedExcerpt(restored); }`, adds a second read: by the time you reach it the early return
has already ruled out `scope === 'excerpt' && this.excerpt`, so given the one-slot invariant this
condition is true on every live path. It reads like a branch point but isn't one.

**Suggested:** a named `isIdempotentScopeRequest(scope)` helper at the top of both arms, or a comment
stating the invariant it leans on.

### 🟡 Standard — The routing-block comment describes the OLD machinery, not what's left

[`WorkshopHandler.ts:1393-1396`](../../packages/core/src/application/handlers/domain/WorkshopHandler.ts#L1393-L1396)

This banner sits directly above `handleSetSessionScope` / `handleRepinExcerpt` / `applyScopeTransition`
and still cites "Sprint 13A §4," calling every transition *"a context transition inside ONE retained
session: no conversation, transcript, task, or attachment is discarded."* But the whole point of this
PR is that these transitions now fire only *before* any conversation exists — there is no conversation
*to* discard at the point this code runs. A reader who lands here first (banner comments are where
people start) gets the Sprint 13A mental model and has to un-learn it three files later. This PR already
rewrote the equivalent header on `setSessionScope` itself; this banner deserves the same treatment.

> *"It works, but I had to read three files to learn that 'locked' leaves the pen unlocked and the banner comment is describing a machine this PR just tore out — that's a tax on everyone who reads this forever."* — Parker

---

## 🧪 Cal · Test Coverage & Quality

*"Confidence Levels, Not Coverage Numbers"*

### 🟠 High — The scope lock is tested for host and tool conversations, never for a persona guest

[`WorkshopSessionScope.test.ts:130-216`](../../packages/core/src/__tests__/application/services/workshop/WorkshopSessionScope.test.ts#L130-L216)

`hasRoomMemory()`'s own doc comment and the ADR both name three conversation types that lock scope:
host, tool sidecar, and persona guest — and `conversationIds()` reads all three. The
`describe('the scope lock')` block has eight cases covering host (`:131`), tool (`:140`), the
open-conversation refusal (`:150`), re-pin (`:160`), the recovery copy (`:169`), revision-still-allowed
(`:177`), session markers (`:196`), and the failed run (`:206`). **There is no persona-guest test.** The
one guest reference in the file (`:74`) is an unrelated pre-lock assertion.

A persona guest joining and then talking is the one lock path with zero regression coverage — and it is
exactly where Blake's HIGH finding lives.

### 🟠 High — The migration test never establishes a live host conversation, so only half of §7 row 2 is exercised [🎯 Consensus]

[`WorkshopSessionScope.test.ts:520-537`](../../packages/core/src/__tests__/application/services/workshop/WorkshopSessionScope.test.ts#L520-L537)

ADR §7 row 2: `pendingExcerptChange` is *"coerced to `'revised'` when a conversation exists; dropped
with the pending delivery otherwise"* — two branches, and the ADR's Implementation section demands "a
test per row." The test passes `{ host: 'host-conv' }` as a runtime binding and reads like it exercises
the "conversation exists" branch. It doesn't: `pin()` never calls `startHostConversation()`, so
`exported.participants.host.conversationKey` is never `'host'`, and
`hostExpected = conversationKey === 'host'` gates whether the binding is consulted at all
([`WorkshopSessionService.ts:1863`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1863)).
`hostConversationId` stays `undefined` regardless.

Worth noting: `pendingExcerptChange` is never *read* anywhere in `WorkshopSessionService.ts`, and
`WorkshopExcerptDeliveryReason` is deleted entirely — so "coerced when a conversation exists" is true
only by construction, never by an explicit code path.

### 🟠 High — The ADR's named "Required test" — a resumed session — is never actually resumed

[`WorkshopSessionScope.test.ts:196-204`](../../packages/core/src/__tests__/application/services/workshop/WorkshopSessionScope.test.ts#L196-L204)

ADR §1 calls out by name that *"a fresh session, **and a resumed session**, must both report
`hasRoomMemory() === false`… and scope must still be freely selectable after a resume"* — and frames
this as "the hazard that decides the predicate," explicitly "not hypothetical." The test calls
`recordSessionMarker('start', …)` and `recordSessionMarker('resume', …)` back-to-back on one
never-persisted instance. It never goes through `hydrateCommittedState` + resume, which is what
`WorkshopSessionPersistenceCoordinator.resumeSession()` actually does. The pre-existing coordinator
resume test resumes a real checkpoint but never calls `hasRoomMemory()` or attempts a scope change
afterward.

> *"Happy path only. I've seen this movie — the branch nobody actually walks through the front door is always the one that ships broken."* — Cal

---

## 🗂️ Stan · Codebase Standards

*"He Has Every Pattern Memorized"*

### 🟠 High — The divergence landed in a new section, not the one the ADR named [🎯 Consensus]

[`13a-open-chat.md:191`](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/13a-open-chat.md#L191)

ADR §Consequences is explicit: *"that divergence must be recorded in the sprint's 'Where the comp and
the product disagreed' section, **as its siblings were**."* That section already exists at line 121 and
lists exactly three prior divergences (editor tab strip, sample passage, starter chips) — untouched by
this PR. The reversal-affordance divergence went into a brand-new `### Superseded by ADR 2026-07-25`
heading at line 191, after "Contract decisions worth knowing." The content is good; it's filed under a
heading the ADR didn't ask for, so a reader scanning the divergence history won't find it there.

### 🟡 Standard — `replaceExcerpt` invents a second refusal shape for the same lock its neighbors already handle

[`WorkshopHandler.ts:2546-2590`](../../packages/core/src/application/handlers/domain/WorkshopHandler.ts#L2546-L2590)

The sprint doc groups these as one family — *"`setSessionScope(...)` throws when locked.
`repinShelvedExcerpt()` throws when locked. `replaceExcerpt(...)` throws when locked and scope is
`open`."* Two of the three have a home: `handleSetSessionScope` (`:1398`) and `handleRepinExcerpt`
(`:1422`) each wrap the throwing call in a try/catch at the **call site** and route straight to
`sendError`. `replaceExcerpt` does something else — the try/catch moved *inside* the private helper,
which now returns `boolean`, and all four call sites (`:1189`, `:1759`, `:2160`, `:2228`) grew an
`if (!this.replaceExcerpt(...)) { return; }` guard. Nothing wrong with either shape in isolation, but a
reader who just learned the call-site pattern two methods up has to relearn a second idiom for the
third guarded transition on the same list.

> *"We wrote the pattern for this twice, right above it — `handleSetSessionScope`, then `handleRepinExcerpt` — and `replaceExcerpt` still went its own way for the third guarded transition on the same list."* — Stan

---

## ⚡ Tim · Performance

*"O(n²) at Scale is an Incident Waiting to Happen"*

### 🟢 Praise — `hasRoomMemory()` is bounded by participant count, not turn count — and the PR only shrinks the broadcast

[`WorkshopSessionService.ts:2139-2152`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L2139-L2152)

`conversationIds()` iterates host (≤1) + `toolSidecars` (fixed-size object keyed by the
`WorkshopToolId` union) + `personaGuests` (a `Map` keyed by the `WorkshopPersonaId` union) — all fixed,
small enums, not proportional to session length. At 200 turns / 3 guests / 4 sidecars that's an
~8-element allocation. `getSnapshot()` calls it once per broadcast and maps
`turns.slice(-WORKSHOP_SNAPSHOT_TURN_WINDOW)` (capped at 100), untouched by this PR. **O(participants),
not O(turns)** — this doesn't degrade as sessions lengthen, only as the persona/tool roster grows, and
that roster is a fixed enum.

On the deletion side: removing the mid-conversation `scope_change` divider means the common pre-memory
scope switch no longer mints an extra turn + prompt frame, and dropping `pendingHostUpdate.excerptWithdrawn`
shrinks the payload. **This PR made `getSnapshot()` strictly cheaper or unchanged, never more
expensive.** Bonus: `roomHasMemory` is a `useState<boolean>` set every snapshot, but React bails via
`Object.is` on unchanged primitives — so it re-renders only on the real transition.

### 🟡 Standard — `hostDeliveredExcerptVersion()` re-derives what `activeHostPin` already caches in O(1)

[`WorkshopSessionService.ts:459-467`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L459-L467)

`this.activeHostPin` is maintained at every write site (`:903` on delivery, `:1665` on reset, `:1955` on
hydrate) and holds the same value this backward loop walks to find. `hostWriterSources` isn't windowed
like `turns` is — it only resets on full session reset — and interleaves `pin` rows with
`message-attachment` rows, so scan length is bounded by "turns since the last excerpt revision," not a
constant. **Doing the math:** `queueExcerptDelivery` is the only caller, firing once per pin action —
maybe 10–20 times in a 200-turn session. Even a worst-case 200-element scan is microseconds.
**Doesn't matter at current scale.** But it's a second source of truth for a value already tracked in
O(1); swapping to `this.activeHostPin?.excerptVersion` makes the whole question disappear rather than
be re-litigated later.

> *"Bounded by a fixed-size enum, capped at 100 turns, and getting cheaper with every deletion — I checked the arithmetic so you don't have to, and it comes up boring, which is the best thing arithmetic can do."* — Tim

---

## 🛡️ Patricia · Security

*"She Reads Code Like an Attacker Would"*

### 🟢 Praise — Zero findings across all four boundaries

**Webview → host IPC.** `handleSetSessionScope` validates the enum via `isWorkshopSelectableSessionScope`
before touching the aggregate. All three scope-mutating paths enforce `requireUnlockedScope()` *inside
the aggregate*, not just via the UI's `locked` prop — so a webview that lied about `roomHasMemory` and
sent the message anyway is still rejected host-side, caught, and routed through `sendError`. The one
gap the ADR itself names (the aggregate's throw escaping as an unhandled rejection) is what this PR
fixes.

**Persisted checkpoint.** Two integrity assertions were removed, but the one that matters —
*"exactly one of `excerpt`/`shelvedExcerpt` may be populated"*
([`WorkshopSessionStateV1Integrity.ts:29-31`](../../packages/core/src/application/services/workshop/WorkshopSessionStateV1Integrity.ts#L29-L31))
— is untouched and still runs first, since `validateWorkshopSessionStateV1(state)` is the first line of
hydration. The `withdrawalNeverShipped` normalization looked like a lock bypass on first read but
isn't: the lock guards *future mutation calls*, not the one-time hydration assignment, and the
normalization makes persisted scope agree with what the host's actual conversation history contains.
The legacy fields remain shape-constrained (`enumAt([...])`, `pendingExcerptWithdrawal` must be `true`
or absent), so hand-edited garbage can't slip past as a different type.

**Prompt content.** The removed withdrawal frame and delivery-lead union were UX framing for the LLM,
not content-trust labeling. The actual trust boundary — the `<pinned-excerpt version="...">` wrapper
around writer text — is untouched.

**Filesystem.** No path-handling changes.

> *"Passes the scanner, passes the attacker too — the one integrity rule that would've mattered if it were gone is still standing guard, and the two that got cut were never load-bearing."* — Patricia

---

## 🌙 Oliver · Observability & Debuggability

*"Would This Failure Leave a Trail at 2am?"*

### 🟠 High — The scope lock's refusal path is silent — except where the author already fixed it

[`WorkshopHandler.ts:1414-1419`](../../packages/core/src/application/handlers/domain/WorkshopHandler.ts#L1414-L1419)

`handleSetSessionScope` and `handleRepinExcerpt` (`:1414-1419`, `:1428-1433`) catch the exact
`requireUnlockedScope` throw this PR newly wires in, and send it to the webview with **zero**
`appendLine`. Compare the private `replaceExcerpt` a thousand lines down, which this same PR touches:
`this.outputChannel.appendLine(\`[WorkshopHandler] Excerpt pin refused: ${details}\`)` *before*
`sendError`. The author clearly recognized "aggregate throw reaching the writer needs a log line" as a
pattern worth fixing — they fixed it in one of three call sites hitting the identical new lock.

Before this PR a scope-change throw was a rare edge case; after it, hitting a locked room is the PR's
**headline interaction**. When a writer reports "it won't let me change the mode and I don't know why,"
the Output Channel has every *excerpt* rejection and nothing for every *scope* rejection.

**Fix:** mirror the `appendLine` into both catch blocks. One line each.

### 🟠 High — The hydration migration that reclassifies a session's scope leaves no trail

[`WorkshopSessionService.ts:1825-1843`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L1825-L1843)

Searched `hydrateCommittedState` (`:1808-1972`) for `appendLine` — **not found, anywhere in the
function.** This block silently un-shelves a passage and rewrites `scope: 'excerpt'`, and two legacy
fields are dropped without a trace on every hydrate. This is the same author who, in the same PR, added
deliberate logging for a structurally identical case — a shelf destroyed by a pin (`:2568-2577`:
*"this line is the only surviving record of what the pin destroyed"*). The migration is that scenario in
reverse: the only record of *why* a session's scope flipped under a returning writer is a source
comment.

**Note on the fix:** `WorkshopSessionService` has **no logger at all** — zero `appendLine`/`LogSink`
references, by design as a pure aggregate. So logging can't go inside `hydrateCommittedState` without
breaking that boundary. The honest shape is to return the migration fact on the existing
`WorkshopSessionHydrationResult` (which already carries `degradedConversationKeys` for exactly this
purpose) and let `WorkshopSessionPersistenceCoordinator` log it at its two call sites (`:653`, `:872`).

### 🟡 Standard — A degraded host binding silently re-unlocks a room the writer remembers talking in

`hasRoomMemory()` ([`:371-373`](../../packages/core/src/application/services/workshop/WorkshopSessionService.ts#L371-L373))
is defined purely over `conversationIds()` — live runtime bindings — not over `turns.length`. In
hydration, `hostConversationId` becomes `undefined` whenever the runtime binding is missing or stale
(`:1864`, `:1867-1874`), dropping the host out of `conversationIds()`. If that was the room's only live
conversation, `hasRoomMemory()` flips to `false` on reopen **even though `this.turns` still holds every
message the writer wrote** — so the strip and rail unlock their mutation affordances for a room whose
transcript plainly shows a conversation happened.

The coordinator already logs degraded keys and the writer gets a generic *"N conversation histories were
restored without retained memory"* status (both pre-existing, unchanged) — but neither says *"and
therefore this room's scope, which you may remember as locked, is selectable again."* That consequence
is new to this PR. Worth a line, or at minimum a comment at `:371` acknowledging that `hasRoomMemory` is
a live-binding predicate, not a historical one, and that degradation is a scope-unlock vector.

> *"Two of three refusal paths log, one doesn't, and the one that doesn't is the one a writer hits first — fails silently, see you in the incident retro."* — Oliver

---

## 🎯 Bria · Domain Logic & Business Correctness

*"Does This Code Actually Do What the Ticket Asked?"*

Bria walked the ADR section by section. **§1–§6 check out** — the lock predicate covers all three
conversation types, pre-lock reversibility is intact on every surface, the shelf restores at its
original version (`adoptShelvedExcerpt` never calls `setExcerpt`, so the version counter doesn't bump),
revision on a locked passage session is unaffected, and every deleted mechanism is genuinely gone rather
than merely unreferenced.

**Notably, §6's hardest requirement is met.** The ADR insists *"wherever an affordance disappears, the
locked state must say why and where to go… This copy is required, not optional."* Every disappearing
affordance across `ExcerptPanel`, `WorkshopScopeStrip`, and `WorkshopComposer` is paired with signpost
copy. No affordance vanishes into silence.

### 🟠 High — Divergence recorded in a new section, not the ADR-mandated one [🎯 Consensus]

*See Stan's finding above — independently reached.*

### 🟠 High — The one test for migration-table row 2 doesn't test row 2 [🎯 Consensus]

*See Cal's finding above — independently reached, via the same `hostExpected` trace.*

> *"The ADR wrote a three-row table and asked for a test per row — I count three tests and 2.5 rows covered. Probably fine. Probably."* — Bria

---

## 🎓 Sensei · The Teacher

*"The Review Is the Lesson. The Code Is the Practice."*

### Lesson 1 — Construction Arguments Terminate at the Edge of Your Own Writes

Illuminated by: Blake/Sam blocker, Marcus #2, Oliver #2

"Unreachable by construction" is one of the strongest claims a design can make — and it is always a
claim about the *future*. The new code cannot produce `scope: 'open'` holding a pinned excerpt; the old
code could, and did, and wrote it to disk where it waits with perfect patience. A persisted state is a
second codebase, authored by a previous version of yourself, that you can no longer edit — only
translate. Notice that the pure logic here is sound: both real defects live in the seam where the new
world meets the old world's data, which is where they usually live.

→ **Carry forward:** When you delete a state transition, don't enumerate the states your new code can
reach — enumerate the states your *old* code could write, and check each against the new invariants.
Write the migration from the old invariant list, not the new one, and let it say out loud that it
rewrote someone's session.

### Lesson 2 — A Test That Looks Like It Covers a Branch Is Worse Than No Test

Illuminated by: Cal #1, #2, #3

A missing test is honest — it leaves a hole you can see. A test that passes a runtime binding no
assertion ever consults, or calls two primitives back-to-back on an object that never went to disk,
produces something more expensive: it spends the reviewer's attention and returns nothing. And observe
the pattern that repeats twice here — the untested path and the broken path were the *same* path. That
is not coincidence; it is the ordinary physics of attention. We test what we were already thinking
about, and the bug is living in what we weren't.

→ **Carry forward:** Before trusting a new test, break the code it claims to protect and watch it go
red. If it stays green, you have written documentation, not a test. And when you add a guard, list its
trigger set explicitly — host, tool sidecar, persona guest — and make sure there is a case per member,
not a case per member you happened to picture.

### Lesson 3 — Fix the Family, Not the Instance

Illuminated by: Oliver #1, Tim #2, Parker #1

You clearly *knew* the pattern here — you applied log-before-`sendError` in the excerpt-pin refusal, and
you derived the honest answer where derivation was right. But knowing a pattern and applying it
exhaustively are different skills, and only the second one shows up in production. The carpenter who
understands a mortise still has to cut all four. A fix applied once is an insight; a fix applied to
every sibling is a change in the codebase's behavior.

→ **Carry forward:** The moment you apply a fix you recognize as a *pattern* rather than a one-off, stop
and grep for its siblings before you move on. Ask: "what is the family of call sites this belongs to,
and did I just fix one member of it?"

### Lesson 4 — Every Enabled Control Is a Promise

Illuminated by: Blake/Sam blocker, Marcus #1, Parker #1

The domain and the UI were each asked the same question — *may this writer change the text?* — and they
answered it separately, in four hand-authored English sentences, one of which was baked into a
host-agnostic core. When one rule has four authors, it has no author, and the copies drift until the
interface offers something the domain has already decided to refuse. A live button that returns a
guaranteed error is the most expensive kind of bug, because the user's trust is spent before the
exception is even thrown.

→ **Carry forward:** For every guard you add in the domain, find the control that can reach it and ask
whether the *same* predicate decides both the refusal and the affordance. If the UI is deciding
independently, you have two rules wearing one name — and check the name too: `locked` should lock
something.

> *"Deleting the machinery is the brave part; remembering that its output is still out there, in someone's saved session, waiting to be believed — that's the part that takes years."* — Sensei

---

## The Closer

### 🔮 Fortune cookie

*You will successfully remove the question. The old answers, however, have already been written down.*

---

## Summary

**Merge-ready after the resolution pass.** The blocker and guest-dismissal
defect are fixed at their honest state boundaries, the missing migration and
resume branches are now exercised, and the review's maintainability findings
were resolved without widening the feature. Finding #6 was a false positive:
the shared `sendError()` path already records the refusal. The two remaining
deferrals are explicitly non-blocking: degradation semantics (#15) and a
micro-optimization with no present-scale consequence (#16).

*Independently re-verified at review close:* full Jest suite **1,342 passed / 127 suites**, all three
TypeScript projects clean, ESLint **0 errors**. The new `personaGuests.size > 0` lock predicate was
probed for the ADR's stranding hazard — `reset()` clears participant tombstones via
`newParticipants()`, so a fresh session is not born locked.

---

*Reviewed by: Marcus 🏛️ · Blake 🔥 · Sam 🔍 · Parker 📖 · Cal 🧪 · Stan 🗂️ · Tim ⚡ · Patricia 🛡️ · Oliver 🌙 · Bria 🎯 · Sensei 🎓*
