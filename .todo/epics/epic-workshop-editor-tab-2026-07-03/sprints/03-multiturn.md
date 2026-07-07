# Sprint 03: Multi-turn (continuation)

**Status**: In Review (implementation complete 2026-07-06)
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

- [x] Add `WORKSHOP_SEND_MESSAGE` (free-text follow-up) to `workshop.ts`.
- [x] `WorkshopSessionService`: hold the active `conversationId` per session.
      First tool run `startConversation`s (system prompt = the active tool's
      prompt); subsequent follow-ups `addMessage` + re-request against the same
      conversation. `WORKSHOP_RESET_SESSION` `deleteConversation`s and clears.
      *(Implemented via a `retainConversation` option on the orchestrator: a
      successful tool run keeps + pins its conversation and the session adopts
      the id; see Notes for the conversation policy.)*
- [x] `WorkshopHandler`: handle `WORKSHOP_SEND_MESSAGE` → append the user turn,
      continue the conversation, stream the assistant turn under
      `domain: 'workshop'`.
- [x] Decide and document token-budgeting behavior across turns (trim/window vs.
      full history) and surface it through the existing `useTokenTracking` rail.
      Note the decision in this doc's Notes. *(Decision recorded below; a
      session-tokens chip in the Workshop header makes the accumulation
      visible.)*
- [x] Enable the composer in `WorkshopApp`; `useWorkshop` sends
      `WORKSHOP_SEND_MESSAGE` and appends streaming turns. *(Plus the cancel
      wire: `CANCEL_WORKSHOP_REQUEST` + a stop affordance in the composer;
      the Sprint 2 `CancellableStreamingDomain` exclusion retired on
      schedule.)*
- [x] Editor-selection seeding: `prose-minion.workshopSelection` context-menu
      command reuses `getSelectionPayload` (the shared half of
      `handleAssistantSelection`) and routes `WORKSHOP_SET_EXCERPT` through
      the panel's own MessageHandler via `WorkshopPanelProvider.seedExcerpt` —
      same guards + provenance as a webview pin, no parallel mechanism.
- [x] **File-picker seeding** (Okey, Sprint 02 review): "Pin from file…" in
      the rail posts `WORKSHOP_PICK_EXCERPT_FILE`; the host picks via the new
      `ShellService.pickFile()` port (VS Code adapter wraps
      `window.showOpenDialog`), reads through the `FileSystem` port, pins
      with full provenance, and head-slices files over 10,000 words with a
      durable truncation notice on the excerpt model (rendered in the rail).
- [x] ~~Migrate `ConversationManager`'s `console.*` calls to the injected
      `LogSink`~~ **Done early, in Sprint 02** (PR #67 — it was on the same
      seam as the multicast work). Nothing left here.
- [x] Multi-turn service tests: a follow-up appends to the same conversation
      (message count grows, id stable); reset disposes the conversation; a new
      run after reset starts a fresh id. *(AIResourceOrchestrator suite runs
      the continuation seam against a REAL ConversationManager; plus new
      ConversationManager pinning tests and session/handler/hook coverage.)*

### Carried from PR #67 review (landed with this sprint)

- [x] Ledger #8: `useWorkshop` live-run identity collapsed to ONE tracker —
      `{ requestId, phase: 'streaming' | 'settled' }` state with a ref mirror
      behind a single setter; `currentRequestId` is derived.
- [x] Ledger #12: session snapshots are bounded — `getSnapshot()` windows to
      the most recent 100 turns and reports `totalTurns`/`truncatedTurns`;
      the hook merges instead of shrinking a live thread and shows a
      hidden-turns divider after a marathon-thread reload.

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

### Token-budgeting decision (2026-07-06)

**Full history per conversation, no trimming/windowing in v1 — bounded
structurally, surfaced visibly.**

- Every follow-up sends the complete conversation (`[system, (user,
  assistant)+, user]`). No message-window or summarization pass.
- The bound is STRUCTURAL, not numeric: a conversation is scoped to **one
  tool run + its follow-ups**. Each new tool run retains a *fresh*
  conversation (tool system prompts must not cross-contaminate) and the old
  one is discarded; "New session" discards too. Threads therefore can't
  accumulate unbounded model context across tools — only across follow-ups
  the user deliberately strings together.
- Visibility: prompt tokens grow linearly with each follow-up. The Workshop
  header now carries a session-tokens chip fed by the existing
  `useTokenTracking` rail (tooltip breaks down prompt vs. completion and
  says WHY prompt grows), and each assistant bubble still shows per-turn
  usage.
- Revisit trigger: if real follow-up chains routinely push prompt sizes
  toward the context window, add a windowing/summarizing pass INSIDE
  `AIResourceOrchestrator.continueConversation` — the seam is one method, so
  the policy can change without touching handler or UI.

### Conversation policy (implementation record)

- **The session's conversation follows the last successful tool run.**
  Adoption is atomic in `WorkshopSessionService.completeRun`: cancelled,
  failed, preempted, and zombie runs never adopt (and the handler discards
  their orphaned conversations).
- A cancelled follow-up leaves the STORED conversation untouched — the
  orchestrator appends user+assistant messages only on completion, so the
  history is always well-formed and the next follow-up continues from the
  last completed exchange. (The thread still records the attempt; thread ≠
  model context, by design.)
- Retained conversations are **pinned** against `ConversationManager`'s
  5-minute idle reaper (users think slower than timeouts); explicit
  discard/reset always deletes.
- Config changes rebuild the AI resources (fresh `ConversationManager`), so a
  live conversation can genuinely disappear: `continueConversation` throws a
  typed `ConversationNotFoundError`, and the handler clears the session
  reference and says so honestly instead of silently cold-restarting.
- Follow-up turns are plain single streaming turns — no guide-request
  detection loop; guides (if requested) were loaded during the conversation's
  opening tool run and live in its history.
