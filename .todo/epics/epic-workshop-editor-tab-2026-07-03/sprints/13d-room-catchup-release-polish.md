# Sprint 13D: Room Ledger, Delivery Offsets, and Release Polish

**Status**: Planned  
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13d-room-catchup-release-polish` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 13C  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md)  
**Related**: [Guest-to-Guest Room Catch-Up](../../../features/feature-workshop-guest-room-catchup/README.md),
governed by [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)\
**Design load**: **None.** Aggregate, prompt-builder, and persistence work
only — the rail divider moved to 13C so this sprint carries no pixel-fidelity
surface.

## Goal

Make the room's shared ledger truthful when writers move among participants,
then collect the full release evidence for the completed Workshop surface.

The design investigation that preceded this sprint found that guest-to-guest
catch-up cannot be added as a fourth delivery relationship without inheriting
three live defects: newest-first packing silently loses turns behind a scalar
cursor, visibility is decided in two places, and a second delivery path
(`RunWorkshopToolSidePass`) commits its own cursor outside the room's
accounting. The ADR replaces the four relationship-owned cursors with one
reader-owned offset per participant. The net change deletes more than it adds.

## Scope

Delivered as four reviewable steps on one branch.

### 13D-a — Extract the shared packer

Collapse `buildGuestTranscriptFrame` and `boundByCharacterBudget` into one pure
packer. No behavior change; existing tests untouched. Its published contract
states ordering, atomicity, omission accounting, and the ordering of
`deliveredTurnIds` — which the two implementations currently get backwards from
each other.

### 13D-b1 — The durable model

- `audience(turn) → 'room' | 'private(principal)'` as the single visibility
  authority. Remove the second filter in the prompt builder and the
  `includeGuestTurns` boolean.
- Persist the invoking **principal** on capability turns. Today they are
  appended as `participant: 'tool'` with no `personaId`, which is only safe
  because the host is the sole invoker; 13C makes guests invokers.
- Persist enough capability-run correlation to publish evidence transactionally:
  successful/partial resource reads, dictionary evidence, and
  participant-requested analysis results become room evidence only with the
  invoking participant's committed final reply. Catalog/search traffic and
  failed, rejected, cancelled, stale, or uncommitted work stay private.
- One inbound offset per participant (`lastSeenRoomTurnId`), including the
  host's — a new participant record shape. Remove
  `guest.lastSeenHostTurnId`, `guest.deliveredToHostThroughTurnId`, and
  `sidecar.deliveredToHostThroughTurnId`.
- Accept the three removed keys as known-legacy-ignored in the V1 shape
  validator; drop them at hydration and head every offset. No V2.
- Invariant tests land here.

### 13D-b2 — The delivery protocol

- Exactly one site materializes a reader's pending turns and one site advances
  an offset. Route `RunWorkshopToolSidePass` through it.
- Contiguous oldest-first prefix **of the reader's eligible projection**.
- A turn is atomic: no frame ships part of a turn. Remove truncation markers
  and character accounting from the catch-up path.
- Catch-up delivery is unbounded for this sprint; one large constant remains as
  a runaway guard, and if it fires the remainder defers losslessly.
- Delete the direct-tool handoff path entirely:
  `collectUnseenDirectExchanges`, `commitHostHandoff`,
  `buildWorkshopDirectHandoff`, the `DIRECT-TOOL HANDOFF` envelope, and
  `WorkshopHostMessageOptions.handoff`.

### 13D-c — Frames and release evidence

- The single catch-up frame, with writer attribution (`Writer (Okey) → Felix:`)
  passed as a render parameter and frame-level temporal markers.
- Room-wide join snapshot (previously host-only), bounded, whole turns only.
- Final persistence/reopen, reconnect/stale-cancel, accessibility, bundle,
  focused/full validation, and Extension Development Host exercises.

The participants/instruments rail divider specified in
[ADR 2026-07-24 §9](../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
is implemented in **13C**, which already owns the participant rail's visual
vocabulary. Keeping it out of 13D leaves this sprint free of pixel-fidelity
work.

## Explicit non-goals

- No live relay of every room turn to every retained conversation.
- No eager fan-out or per-participant pending queue.
- No newest-first packing paired with a scalar cursor.
- No head truncation of a participant's speech in any frame.
- No bounding of catch-up delivery — that is compaction-era work.
- No schema V2.

## Exit criteria

- A -> B carries A's eligible unseen exchange without a host call.
- A tool report reaches every participant; its sidecar conversation reaches
  none.
- Evidence-bearing capability results reach every participant only after the
  invoking participant's final reply commits.
- Catalog/search traffic and failed, rejected, cancelled, stale, or
  uncommitted capability work reach only their invoking principal.
- No frame splits a turn, within or across deliveries.
- Delivery acknowledgement follows only the recipient's committed reply;
  cancellation and retry are idempotent.
- An `__tests__/architecture/` guard asserts a single catch-up call site and a
  single offset-advance call site.
- A re-invited guest starts from a join snapshot rather than an inherited
  offset.
- A session file carrying the legacy cursor keys opens cleanly.
- Manual evidence covers open chat, later excerpt adoption, both local-analysis
  policies, guest invitation/capabilities, A -> B catch-up, cancellation/retry,
  and restored sessions.
- Typecheck, full suite, lint, production build/bundle, accessibility pass,
  and `git diff --check` pass.
