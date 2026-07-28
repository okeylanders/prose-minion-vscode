# Sprint 13D: Room Ledger, Delivery Offsets, and Release Polish

**Status**: Implementation Complete — manual Extension Development Host smoke pending (2026-07-26)
**Priority**: High  
**Branch**: `sprint/workshop-editor-tab-13d-room-catchup-release-polish` -> PR into `epic/workshop-editor-tab`  
**Depends on**: Sprint 13C  
**Parent**: [Sprint 13 delivery plan](13-open-chat-guest-room-polish.md)  
**Related**: [Guest-to-Guest Room Catch-Up](../../../features/feature-workshop-guest-room-catchup/README.md),
governed by [ADR 2026-07-24 — The Workshop Room Ledger and Delivery Offsets](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)\
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

### Architecture constraints

13D is a consolidation, not permission to enlarge the existing Workshop
orchestrators:

- `WorkshopSessionService` owns durable ledger state and aggregate invariants.
  It does not render prompt frames or grow reader-specific delivery branches.
- One bounded delivery collaborator owns eligible projection, pending-turn
  materialization, and acknowledgement. It is injected through the existing
  composition root rather than constructed inside `WorkshopHandler`.
- `WorkshopPromptBuilder` renders turns already selected by the delivery
  policy. It does not make a second audience decision.
- `WorkshopHandler` coordinates the use case. It does not reimplement
  projection, packing, cursor arithmetic, or capability-publication policy.
- Audience and packing rules stay pure and independently testable. Do not
  replace the removed relationship methods with boolean policy flags or a
  generic "room manager" that owns unrelated lifecycle work.
- The ordered ledger remains the sole delivery source of truth. No participant
  mailbox, pending-queue mirror, or second transcript store is introduced.

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
[ADR 2026-07-24 §9](../../../../../docs/adr/2026-07-24-workshop-room-ledger-and-delivery-offsets.md)
is implemented in **13C**, which already owns the participant rail's visual
vocabulary. Keeping it out of 13D leaves this sprint free of pixel-fidelity
work.

## Inherited verification follow-ups

### Release-blocking delivery invariant

[Handoff cursors advance past turns the envelope never shipped](../../../tech-debt/2026-07-26-handoff-cursor-advances-past-undelivered-turns.md)
is pre-existing, reproduced during PR #89 verification, and owned by this
sprint because 13D deletes the affected relationship machinery.

- The replacement acknowledgement must advance through the newest
  **contiguous delivered turn in the reader's eligible projection**, never the
  newest delivered turn by max index.
- Do not carry the `newestIndex` / `Math.max` scan shape into the single
  acknowledgement site.
- Pairing and publication must not depend on physical adjacency in the ledger;
  `session` events and private capability work may interleave an exchange.
- Regression coverage must preserve Blake's three proofs: one ~25k-character
  reply, five short exchanges, and four ~6k-character exchanges. In the new
  protocol, an intentionally undelivered turn or hole remains pending and is
  returned on the next collection.
- Restate the PR #72 review #1 invariant at the surviving acknowledgement site,
  where the code now makes it true.

### Small release-polish follow-ups from PR #89

- Replace the duplicated `'workshop-personas/guest-base.md'` literal in
  `workshopPersonas.ts` and `AssistantToolService.ts` with one shared prompt-path
  constant. Prompt assembly and its tests must consume that same value so a
  rename cannot silently split the guest charter from its capability policy.
- Stabilize `livePersonaGuestIds` across unchanged `WorkshopApp` renders so the
  invite modal's lock effect does not re-fire on array identity churn. Keep it
  derived—do not add mirrored state or another synchronization effect.

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
- The sole acknowledgement site advances only through the newest contiguous
  delivered turn; a delivery hole remains pending and retries without loss.
- Exchange ownership/publication does not depend on adjacent ledger rows.
- No frame splits a turn, within or across deliveries.
- Delivery acknowledgement follows only the recipient's committed reply;
  cancellation and retry are idempotent.
- An `__tests__/architecture/` guard asserts a single catch-up call site and a
  single offset-advance call site.
- A re-invited guest starts from a join snapshot rather than an inherited
  offset.
- A session file carrying the legacy cursor keys opens cleanly.
- Guest base-prompt selection uses one shared path constant.
- Unchanged live-guest membership keeps a stable `livePersonaGuestIds`
  identity without mirrored React state.
- Manual evidence covers open chat, later excerpt adoption, both local-analysis
  policies, guest invitation/capabilities, A -> B catch-up, cancellation/retry,
  and restored sessions.
- Typecheck, full suite, lint, production build/bundle, accessibility pass,
  and `git diff --check` pass.

## Implementation record

Completed on `sprint/workshop-editor-tab-13d-room-catchup-release-polish` as
five reviewable implementation passes:

1. `91c1383` — extracted the shared turn packer.
2. `301a122` — persisted room audience facts and one inbound offset per
   participant.
3. `63fe132` — routed participant delivery and acknowledgement through one
   collaborator and deleted the relationship handoff paths.
4. 13D-c (this implementation checkpoint) — renders room frames through the focused
   `WorkshopRoomFrameRenderer`, adds render-time writer attribution and
   frame-level relative-time markers, and makes the bounded room-wide join
   snapshot whole-turn-only.
5. PR #90 review fixes — separates cold-start join projection from incremental
   delivery, makes acknowledgement failures retryable bookkeeping, advances
   only through the delivered contiguous prefix, hardens packing/rendering,
   and gives guest-persona `### Next steps` the same durable proposal workflow
   as the host.
6. Post-review room bounds — raises fresh-guest context to 100 whole turns /
   100,000 characters, raises standing context to 50,000 words, and bounds the
   webview to the latest 200 turns with an explicit preservation/pagination
   notice while retaining the complete saved ledger.

Automated release evidence on 2026-07-26:

- `npm run typecheck` — passed for core, webview, and extension.
- `npm test -- --runInBand` — 133 suites / 1,437 tests passed.
- `npm run lint -- --no-cache` — passed with the repository's pre-existing
  786-warning baseline and zero errors.
- `npm run build` — production extension + webview bundles compiled;
  `verify:bundle` passed. Webpack retained its existing webview asset-size
  warnings.
- `npm run package` — produced `prose-minion-2.0.3.vsix` (177 files,
  9.79 MB).
- `git diff --check` — passed.
- Workshop modal, rail, composer, thread, persistence/reopen, stale-run,
  cancellation/retry, and architecture suites passed as part of the full run.

Still intentionally manual before merge: exercise open chat, later excerpt
adoption, both local-analysis policies, guest invitation/capabilities, A → B
catch-up, cancellation/retry, and a restored session in the Extension
Development Host; include keyboard/screen-reader inspection in that pass.
