# ADR 2026-07-25: Workshop Session Scope Is Immutable Once the Room Has a Memory

**Status:** Accepted
**Date:** 2026-07-25
**Extends:** [ADR 2026-07-14 — Workshop Session Persistence and the Session Browser](2026-07-14-workshop-session-persistence.md); [ADR 2026-07-11 — Workshop Excerpt Revision and Room Memory](2026-07-11-workshop-excerpt-revision-and-room-memory.md)
**Supersedes:** [Sprint 13A](../../.todo/archive/epics/epic-workshop-editor-tab-2026-07-03/sprints/13a-open-chat.md) §4 "The path is reversible in both directions" — reversibility is retained only before the room has a memory, and the mid-conversation transitions it specified are deleted rather than re-bounded. §§1–3 and 5–11 stand unchanged.
**Epic:** [Assistant as a Full Editor Tab](../../.todo/archive/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Origin:** [PR #86 review](../pr-reviews/pr-86-open-chat-session-scope-review.md) findings #1–#3, and the writer-facing confusion they were symptoms of.

## Context

Sprint 13A made session scope explicit — `null` (path unchosen), `excerpt`
(passage session), `open` (open conversation) — and made the choice reversible
at any moment, in both directions, inside one retained session. §4 is
unambiguous about it: *"All of these are context transitions inside one
retained session."*

That reversibility is the source of essentially all the machinery this feature
carries, because a mid-conversation scope change means telling a model to stop
believing something it has already read. The aggregate cannot un-send a prompt,
so it compensates with a delivery protocol:

| Mechanism | Exists only to service |
| --- | --- |
| `shelvedExcerpt` + the one-slot shelf | Passage → open, without deleting the passage |
| `pendingExcerptWithdrawal` + the withdrawal frame | Telling a retained host the passage it read no longer applies |
| `WorkshopExcerptDeliveryReason: 'repinned'` | Open → passage, for a passage the host already holds |
| `WorkshopExcerptDeliveryReason: 'added'` | Open → passage mid-conversation, first passage this host has seen |
| The `scope_change` divider and its "same session, conversation retained" copy | Making the transition legible in the transcript |
| `repinShelvedExcerpt()` / `WORKSHOP_REPIN_EXCERPT` | Re-pinning without leaving open scope |

The PR #86 review found three defects, and all three live in exactly this
machinery:

- **#1 (blocking)** — `replaceExcerpt` branched on `this.excerpt`, which
  shelving empties while the passage survives in `shelvedExcerpt`. Pinning over
  a shelved passage took the "first pin" branch: stale tool sidecars survived,
  `chatTarget` was never pulled back, and the host was told *"This is the FIRST
  passage you have been given here"* while its own transcript held the previous
  one.
- **#2** — a fresh pin silently destroyed the shelved passage, unrecoverable
  for hand-pasted text.
- **#3** — shelving discarded an undelivered revision, and the later re-pin
  hardcoded `'repinned'`, telling a host holding v1 that it had v2 back
  *"unchanged."*

All three are now fixed. But the fixes are *derivations* — the aggregate
computes what the host actually holds from `hostWriterSources` and reasons
about it correctly. The question remains askable, and every future change to
this area has to keep answering it.

### The writer-facing symptom

The machinery is also not legible to the person using it. In a passage session
54,752 tokens deep — where the host has demonstrably read the excerpt and
written extensively about it — the room offers **two separate affordances** to
un-read it: "Unpin excerpt" on the scope strip and "Unpin — back to open
conversation" in the rail. The product then spends a withdrawal frame, a
divider, and a caption (*"still has the passage you set aside until your next
message"*) explaining the consequences of an action it did not need to offer.

The reversibility is not serving a need. It is generating states that require
explanation.

### What the reversibility actually buys

One scenario, honestly stated: brainstorm in open chat, get an idea, write a
passage, want the host to read it — today that keeps the conversation.

Against that: a new session already **preserves the working set** (Sprint 13A
§3 — the excerpt and every context attachment survive the boundary, and a
shelved passage comes back off the shelf as the pinned excerpt). So the cost of
changing mode via a new session is the thread and the host's memory, not the
writer's material.

## Decision

**Session scope is chosen freely until the room acquires a memory, and is
immutable thereafter.**

### 1. The lock predicate is "any conversation exists"

Scope may change while `conversationIds()` is empty and no persona-guest
tombstone exists — no host conversation, no tool sidecar, and no current or
former persona-guest conversation. Once any exists, `scope` is fixed for the
life of the session. Dismissing a guest discards its provider conversation but
keeps its participant record, so dismissal cannot reverse the lock.

This predicate is chosen over the simpler "first visible turn" because it
matches the underlying truth: scope is locked exactly when some participant's
memory depends on it. Two consequences follow, both intended:

- A tool run locks the scope. A Prose sidecar genuinely reads the excerpt, so
  allowing an unpin afterwards would reintroduce finding #1's stale-sidecar
  defect through a different door.
- A first message that **fails** and leaves no conversation does **not** lock.
  A network error on the first turn must not strand the writer in a mode they
  did not commit to.

`WorkshopSessionService.conversationIds()` enumerates the live set.
`hasRoomMemory()` adds the existing disposed-guest participant record as the
historical proof that a guest conversation existed; this uses the durable
tombstone already required for thread attribution rather than adding parallel
bookkeeping.

#### Temporal frames must never count as a turn

This is the hazard that decides the predicate, and it is not hypothetical.

`WorkshopSessionPersistenceCoordinator.resetSession()` calls
`recordStartMarker()`, which appends a `session_start` divider to the ledger.
**Every session therefore holds a turn before the writer has done anything** —
the visible *"Session started Thursday, July 23, 2026 at 9:34:57 PM CDT"* line.
`resumeSession()` appends a `session_resume` marker on every reopen, and
`WorkshopSessionTimeService` issues a third, `'hourly'`, as a persona notice
inside a prompt.

A "first visible turn" predicate would therefore lock `scope` at `null` the
instant a session was created, stranding the writer on the path chooser with no
way to choose anything. That alternative is not merely coarse; it is broken.

The chosen predicate is immune structurally, not incidentally:
`recordSessionMarker` pushes to `this.turns` and touches nothing in
`participants`, so no temporal frame can move `conversationIds()`. The same
holds for the `'hourly'` notice, which is a prompt frame riding an existing
host turn and never creates a conversation of its own.

**Required test:** a fresh session, and a resumed session, must both report
`hasRoomMemory() === false` despite carrying a session marker — and scope must
still be freely selectable after a resume. Any future ledger-only event
(context change, task, artifact divider) inherits this guarantee, and this test
is what protects it.

### 2. Before the lock, both paths remain fully reversible

The path chooser, the rail's "Set this aside", "Unpin — back to open
conversation", "Add excerpt", and "Re-pin *title* vN" all keep working in the
pre-lock window. Because no conversation exists there, none of them needs to
tell anyone anything: no withdrawal frame, no delivery reason, no
`scope_change` divider, no host notification of any kind.

### 3. The shelf survives, reduced to a pre-lock holding slot

`shelvedExcerpt` is kept. Unpinning before the lock moves the excerpt to the
shelf; re-pinning moves it back at its original version. Deleting the shelf
outright was rejected: unpinning a hand-pasted passage would destroy text that
exists nowhere else, which is finding #2 reproduced in a smaller room.

The V1 integrity rule — exactly one of `excerpt` / `shelvedExcerpt` may be
populated — stands unchanged, as does its guard and the tests added for it.

### 4. Excerpt *revision* is unaffected

`replaceExcerpt` on a locked passage session — "I edited the chapter, re-read
it" — remains available and continues to produce `excerptChange: 'revised'`,
retire tool sidecars, and pull `chatTarget` back to the host. This is the
pre-13A behavior, it is well understood, and it is the one excerpt mutation
that has never needed a scope change to justify it.

An open conversation never gains an excerpt, and a passage session never loses
one.

### 5. Machinery deleted

Per the repo's alpha policy (no backward compatibility before v1.0; remove
dead paths rather than deprecating them), the following become unreachable and
are removed rather than left guarded:

- `pendingExcerptWithdrawal`, `WorkshopPendingHostUpdates.excerptWithdrawn`,
  and the withdrawal prompt frame.
- `WorkshopExcerptDeliveryReason` members `'repinned'` and `'added'`, and their
  `WORKSHOP_EXCERPT_DELIVERY_LEAD` entries. The type collapses to `'revised'`
  — at which point it should be evaluated for deletion entirely rather than
  kept as a single-member union.
- The mid-conversation `scope_change` divider path in `replaceExcerpt` and
  `setSessionScope`, and the `scope_change` turn artifact if nothing else
  claims it.
- `WorkshopSessionStateV1.revisions.pendingExcerptWithdrawal` and its shape and
  integrity checks.

The delivery-reason **derivation** added in the PR #86 fix
(`hostDeliveredExcerptVersion` / `excerptDeliveryReason`) is retained even
though the lock makes it nearly always answer `'revised'`. It is ~15 lines, it
is the honest way to answer "what does the host hold," and it keeps the
`'added'` case correct for the one path that survives: a pin queued before any
conversation existed.

> **Preferred over the alternative.** Deriving the right answer and removing
> the question are not the same quality of fix. The PR #86 derivation is
> correct; this ADR makes two of the three defects it repairs structurally
> unreachable. Unreachable beats correct.

### 6. Surfaces after the lock

- **Scope strip** becomes purely declarative — it states what the room is and
  drops its mutation button. This is a natural fit: the component was already
  changed in the PR #86 fix to take `scope` explicitly and to render nothing
  for a scope it cannot honestly describe.
- **Rail `ExcerptPanel`** drops "Set this aside" / "Unpin" / "Add excerpt" /
  "Re-pin" once locked, keeping "Update text…" and "Re-read from file".
- **Composer** drops its "Add excerpt" affordance in a locked open
  conversation. The existing `NEEDS EXCERPT` tool gating (§9) is unchanged and
  already handles the "tools unavailable here" case.
- Wherever an affordance disappears, the locked state must **say why and where
  to go**: *"Start a new session to change this — your excerpt and context
  carry over."* A dead end becomes a signpost. This copy is required, not
  optional; the loss in §"What the reversibility actually buys" is only
  acceptable if the recovery path is visible.

### 7. Migration of existing checkpoints

Live sessions on disk may hold states this ADR makes unreachable. Hydration
normalizes rather than throws — a writer's real session must not fail to open:

| Persisted state | On hydrate |
| --- | --- |
| `pendingExcerptWithdrawal: true` | Dropped. The field no longer exists. |
| `pendingExcerptChange: 'repinned' \| 'added'` | Coerced to `'revised'` when a conversation exists; dropped with the pending delivery otherwise. |
| `shelvedExcerpt` alongside an existing conversation | **Kept.** It is unreachable in this session, but a new session un-shelves it into `excerpt` (§3 of Sprint 13A), so the writer's material is genuinely recoverable — through the same door this ADR points every mode change at. The rail should say so. |

This is a one-time normalization at the hydration boundary, the same place
Sprint 13A's scope migration already lives.

## Alternatives considered

**Keep reversibility, fix the bugs (status quo + PR #86).** Viable — the
defects are repaired and tested. Rejected because it leaves the writer-facing
confusion untouched and keeps six mechanisms alive whose only job is to explain
a state the product did not need to allow. The review's own Lesson 2 applies:
the reasoning error had an altitude, and derivation fixes it at one floor
rather than removing the floor.

**Lock on the first visible turn.** Simpler to explain. Rejected because a
failed first message would lock the mode, and because it leaves tool runs
ambiguous.

**Lock on the first host message only; tool runs don't lock.** Simplest rule.
Rejected outright: a Prose sidecar that read the excerpt would survive an
unpin, which is finding #1 with new paint.

**Delete the shelf entirely.** Smallest state. Rejected — see §3.

**Fork or branch the conversation into the new session.** Rejected, and not
merely on cost. A forked host inherits a history it never lived and speaks as
though it had — the exact failure this ADR exists to prevent, reintroduced at
the session boundary.

The intended answer instead is
[Feature: A prior conversation is a resource, not a branch](../../.todo/features/feature-prior-conversation-as-resource/README.md):
a prior session's transcript is delivered as an ordinary context resource,
either by writer opt-in or by host fetch through the existing capability
catalog. Because cross-participant material already arrives as quoted,
speaker-labeled text inside the **user** message (ADR 2026-07-24), the host
*reads a record of* that conversation rather than *remembering* one — which is
honest by construction and needs no branching machinery. It also softens this
ADR's one real cost: the thread a mode change leaves behind becomes readable
from the new session rather than lost.

That feature is deliberately **not** designed here; this ADR only records that
it, and not forking, is the direction.

## Consequences

**Good.**

- Findings #1 and #3 become unreachable by construction; #2 shrinks to the
  pre-lock window where the shelf has no host to mislead.
- Six mechanisms and their persisted fields are deleted, meaningfully reducing
  `WorkshopSessionService`'s size — which is the file
  [`.todo/tech-debt/2026-07-25-workshop-god-files.md`](../../.todo/tech-debt/2026-07-25-workshop-god-files.md)
  flags as a god file. This is decomposition by deletion, the cheapest kind.
- The room can no longer be in a state where the transcript and the host's
  belief disagree about what was read.

**Costs.**

- Changing mode mid-thought costs the thread and the host's memory. Mitigated
  by the working set surviving the boundary, and required to be *visible* per
  §6.
- Sprint 13A shipped copy and comp states that this removes. The design doc
  ("Prose Minion - Assistant Tab") will disagree with the product on the
  reversal affordances; that divergence must be recorded in the sprint's
  "Where the comp and the product disagreed" section, as its siblings were.
- Tests written against the deleted transitions must be removed, not adapted —
  including several added in the PR #86 fix pass. Their loss is expected and
  is the point; the surviving tests should assert that the transitions are
  *refused*, which is a stronger claim.

## Explicitly unchanged

- Sprint 13A §§1–3, 5–11: explicit scope as state, the path chooser, working
  set survival, the paste widget, the shared Edit/Preview sheet, clickable
  context attachments, context in open chat, tool gating, status honesty, and
  prompt honesty.
- The V1 one-slot integrity rule and its guard.
- `replaceExcerpt`'s sidecar retirement, `chatTarget` pull-back, and revision
  divider.
- The capability gate refusing `analysis.run` without an excerpt — which under
  this ADR becomes a permanent property of an open conversation rather than a
  transient one, strengthening it.

## Implementation

Sprint to be cut from this ADR. Rough shape, smallest reviewable steps:

1. `hasRoomMemory()` on the aggregate; `setSessionScope` / `repinShelvedExcerpt`
   throw when locked. Tests assert refusal.
2. Delete the withdrawal path and the `'repinned'` / `'added'` reasons; collapse
   or remove `WorkshopExcerptDeliveryReason`.
3. Hydration normalization (§7) with a test per row of that table.
4. Surface pass: strip, rail, composer — affordances gated on
   `hasRoomMemory`, with the "start a new session" copy.
5. Remove superseded tests; update the 13A sprint doc's divergence section.
