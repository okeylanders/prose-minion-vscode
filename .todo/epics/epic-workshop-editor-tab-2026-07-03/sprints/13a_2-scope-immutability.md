# Sprint 13A_2: Scope Immutability

**Status**: In progress on `sprint/workshop-editor-tab-13a_2-scope-immutability`
**Priority**: High
**Branch**: `sprint/workshop-editor-tab-13a_2-scope-immutability` -> PR into `epic/workshop-editor-tab`
**Implements**: [ADR 2026-07-25 — Workshop Session Scope Is Immutable Once the Room Has a Memory](../../../../docs/adr/2026-07-25-workshop-scope-immutability.md)
**Follows**: [Sprint 13A — Open Chat](13a-open-chat.md) (PR #86, merged 2026-07-25)
**Design load**: **Low** — this sprint mostly *removes* surface. No new layout, no
new copy beyond one locked-state sentence.

## Goal

Make session scope immutable once the room has a memory, and delete the six
mechanisms that existed only to service mid-conversation scope changes.

Sprint 13A made the path reversible at any time. The PR #86 review found three
defects, all of them living in the machinery that reversibility requires, and
all three were repaired by *deriving* the right answer. This sprint removes the
question instead.

## Scope

### 1. The lock predicate

`WorkshopSessionService.hasRoomMemory()` — true when `conversationIds()` is
non-empty (host conversation, any tool sidecar, or any persona-guest
conversation). Scope is freely selectable while it is false and fixed once it
is true.

A tool run locks the scope; a first message that fails and leaves no
conversation does not.

### 2. Temporal frames must never lock

`resetSession()` records a `session_start` marker and `resumeSession()` records
a `session_resume` marker, so **every session holds a turn before the writer
acts**. A turn-based predicate would lock scope at `null` on creation and
strand the writer on the path chooser.

`recordSessionMarker` touches `this.turns` and never `participants`, so the
chosen predicate is immune structurally. This is under test, and the test is
what protects every future ledger-only event.

### 3. Guarded transitions

- `setSessionScope(...)` throws when locked.
- `repinShelvedExcerpt()` throws when locked.
- `replaceExcerpt(...)` throws when locked **and** scope is `open` — an open
  conversation never adopts a passage.
- `replaceExcerpt(...)` in a locked **passage** session is unchanged: revision
  stays available, still retires tool sidecars, still pulls `chatTarget` back.

### 4. Machinery deleted

- `pendingExcerptWithdrawal`, `WorkshopPendingHostUpdates.excerptWithdrawn`,
  and the withdrawal prompt frame.
- `WorkshopExcerptDeliveryReason` entirely. Every surviving delivery is a
  revision, so a single-member union earns nothing; the lead string is inlined
  at its one use.
- `pendingExcerptChange` on the live aggregate.
- The mid-conversation `scope_change` divider emitted by `replaceExcerpt`.

`hostDeliveredExcerptVersion()` is **retained**. It is the honest answer to
"what does the host hold," it is what makes the surviving revision path
correct, and it is cheap.

### 5. Persistence: tolerate and discard

Live checkpoints on disk hold `pendingExcerptWithdrawal` and
`pendingExcerptChange`. The V1 shape validator rejects unknown fields, so these
stay in the **allowlist** as explicitly legacy, are discarded on hydrate, and
are never written again. A writer's real session must not fail to open.

The both-slots integrity guard stays (the shelf survives). The
delivery-versus-withdrawal contradiction guard goes, along with its test — the
state it described is now legacy data we normalize rather than reject.

### 6. Surfaces

Once locked:

- **Scope strip** drops its mutation button and becomes purely declarative.
- **Rail `ExcerptPanel`** drops "Set this aside" / "Unpin" / "Add excerpt" /
  "Re-pin", keeping "Update text…" and "Re-read from file".
- **Composer** drops "Add excerpt" in a locked open conversation.

Every disappearance must say where to go: **"Start a new session to change
this — your excerpt and context carry over."** Required, not optional; the
recovery path is what makes the lock acceptable.

## Explicit non-goals

- Conversation forking or branching. See
  [Feature: A prior conversation is a resource, not a branch](../../../features/feature-prior-conversation-as-resource/README.md).
- Decomposing `WorkshopSessionService` / `WorkshopHandler`. Tracked separately
  in [`.todo/tech-debt/2026-07-25-workshop-god-files.md`](../../../tech-debt/2026-07-25-workshop-god-files.md).
  This sprint shrinks both by deletion, which is a happy side effect, not the
  goal.

## Exit criteria

- [ ] Scope cannot change once any conversation exists; refusal is tested.
- [ ] A fresh session and a resumed session both report `hasRoomMemory() ===
      false` despite their session markers, and scope stays selectable.
- [ ] The withdrawal path and `WorkshopExcerptDeliveryReason` are gone from the
      live model.
- [ ] A checkpoint carrying legacy `pendingExcerptWithdrawal` /
      `pendingExcerptChange` hydrates cleanly and drops them.
- [ ] Locked surfaces hide their mutations and name the recovery path.
- [ ] Superseded tests removed rather than adapted; full suite green,
      typecheck clean on all three projects, lint 0 errors.
