# Sprint 03: Multi-turn (continuation)

**Status**: Not Started
**Priority**: High
**Branch**: `feat/workshop-s3-multiturn` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 2–4 days
**Depends on**: Sprint 02

## Goal

Turn the thread into an actual conversation. Free-text follow-ups and re-runs
**continue the same `ConversationManager` conversation** instead of restarting
it — the "now tighten it" loop. Seed the pinned excerpt from the editor
selection. This sprint isolates the one genuinely novel mechanism in the epic,
so its risks (token budgeting across turns, system-prompt handling, disposal on
reset) don't contaminate the session-state work.

## Current Reality

- `ConversationManager`
  (`packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`)
  already exposes `startConversation(toolName) → id`, `addMessage`,
  `getMessages`, `resetConversation`, `deleteConversation`,
  `getConversationInfo`. It **supports** multi-turn; no handler has ever driven
  it that way — today's handlers `startConversation` and stop.
- ~~It still logs via raw `console.*`~~ **Done in Sprint 02** (PR #67): the
  sink is constructor-injected and the cleanup log routes through it.
- The sidebar already seeds an excerpt from the editor selection via a
  `handleAssistantSelection` path — reuse it, don't reinvent it.
- The provenance plumbing already exists (Sprint 02): `WorkshopExcerpt` /
  `WorkshopSetExcerptPayload` carry `sourceUri` + `relativePath`, the header
  subtitle renders them, and `WorkshopHandler` passes `sourceUri` into the
  tool calls. Both seeding mechanisms below are senders for fields that are
  already wired end-to-end.

## Tasks

- [ ] Add `WORKSHOP_SEND_MESSAGE` (free-text follow-up) to `workshop.ts`.
- [ ] `WorkshopSessionService`: hold the active `conversationId` per session.
      First tool run `startConversation`s (system prompt = the active tool's
      prompt); subsequent follow-ups `addMessage` + re-request against the same
      conversation. `WORKSHOP_RESET_SESSION` `deleteConversation`s and clears.
- [ ] `WorkshopHandler`: handle `WORKSHOP_SEND_MESSAGE` → append the user turn,
      continue the conversation, stream the assistant turn under
      `domain: 'workshop'`.
- [ ] Decide and document token-budgeting behavior across turns (trim/window vs.
      full history) and surface it through the existing `useTokenTracking` rail.
      Note the decision in this doc's Notes.
- [ ] Enable the composer in `WorkshopApp`; `useWorkshop` sends
      `WORKSHOP_SEND_MESSAGE` and appends streaming turns.
- [ ] Editor-selection seeding: add an editor context-menu entry to
      `prose-minion.openWorkshop` (or a sibling command) that seeds the pinned
      excerpt from the current selection via the existing
      `handleAssistantSelection` seeding path → `WORKSHOP_SET_EXCERPT`.
- [ ] **File-picker seeding** (Okey, Sprint 02 review): a "Pin from file…"
      affordance in the rail's excerpt block, next to paste-pinning, so both
      paths exist. Shape: new `WORKSHOP_PICK_EXCERPT_FILE` message
      (webview→ext) → host opens a file picker → reads the file → pins with
      full provenance (`sourceUri` + `relativePath`) → posts
      `WORKSHOP_SESSION_STATE`. The picker needs a host seam — handlers are
      vscode-free, so either add a `pickFile()` method to the `shell`
      platform port (VS Code adapter wraps `window.showOpenDialog`) or let
      `WorkshopPanelProvider` own the dialog and forward the chosen path.
      Prefer the port: it keeps the flow inside `WorkshopHandler` where the
      session mutation lives. Guardrail: pin the file's CONTENT as the
      excerpt; if the file is huge, take a sane head-slice and say so in the
      UI rather than silently pinning a novel.
- [x] ~~Migrate `ConversationManager`'s `console.*` calls to the injected
      `LogSink`~~ **Done early, in Sprint 02** (PR #67 — it was on the same
      seam as the multicast work). Nothing left here.
- [ ] Multi-turn service tests: a follow-up appends to the same conversation
      (message count grows, id stable); reset disposes the conversation; a new
      run after reset starts a fresh id.

## Acceptance Criteria

- A free-text follow-up after a tool run produces a response that reflects the
  prior turn (genuine continuation, not a cold restart).
- The conversation id is stable across follow-ups within a session and disposed
  on reset; a post-reset run starts a new conversation.
- Opening the Workshop from an editor selection pins that selection as the
  excerpt.
- "Pin from file…" pins a picked file's content with `relativePath` shown in
  the header subtitle and excerpt block — same provenance as selection
  seeding.
- ~~`ConversationManager` no longer calls `console.*`~~ (landed in Sprint 02).
- Token tracking reflects multi-turn accumulation; the budgeting decision is
  documented.
- Multi-turn service tests pass; lint, typecheck, tests, build, bundle green.

## Notes / Guardrails

- This is the highest-risk sprint. If continuation semantics get gnarly, keep
  the blast radius here — do not reach forward into quick actions or cards.
- Reuse the sidebar's selection-seeding path; a parallel seeding mechanism is a
  boundary smell.
- Token-budgeting decision (fill in during implementation): _TBD_.
