# ADR 2026-08-12: Offline-capable assistant AgentRunEngine

**Status:** Accepted
**Date:** 2026-08-12
**Decision owner:** Okey Landers
**Extends:** [Agent Run Engine and Resource Catalogs](2026-07-10-agent-run-engine-and-resource-catalogs.md), [Workshop Session Persistence](2026-07-14-workshop-session-persistence.md)

## Context

Workshop archives are local conversation history. Restoring them does not call
OpenRouter, but the assistant `AgentRunEngine` was constructed only when an API
key existed. Because that engine also owned its `ConversationManager`, a
missing key prevented archive hydration and could let autosave replace a valid
checkpoint with degraded state.

The engine/conversation coupling is useful: running a retained agent turn and
committing its conversation are one transaction. The accidental coupling was
between that stateful engine's lifetime and its provider client's lifetime.

## Decision

`AIResourceManager` owns one process-stable assistant `AgentRunEngine`.

- The assistant engine continues to own its `ConversationManager`.
- The engine exists without credentials and can import, export, reset, and
  inspect conversations while offline.
- `AIResourceManager` attaches or detaches the OpenRouter client when
  credentials change; it does not replace the assistant engine.
- An inference request without a provider throws a typed unavailable error
  before creating or changing conversation history.
- One run captures one provider client. Attaching a different client during an
  active run affects only later runs.
- OpenRouter authentication, credit, throttling, network, and availability
  failures are typed transient run failures. Failed pending messages are never
  committed to retained history.
- Workshop rolls the provisional writer turn and any turn-bound artifacts back
  when one of these failures occurs. Composer attachments remain staged for a
  retry. Sidebar handlers surface the same failures as transient errors rather
  than analysis results.

Dictionary, context, category, and widget engines remain disposable because
they do not own Workshop retained conversations.

## Consequences

A keyless Workshop restore hydrates normally. Adding a key brings the same
agent engine online, so its existing runtime conversation ids and histories
remain valid. Removing a key pauses replies without invalidating the room.

This keeps the original CM-inside-ARE cohesion and avoids injecting
conversation state separately into the composition root, resource manager,
and assistant facade. The tradeoff is that the assistant engine has a longer
lifetime than its provider transport and must expose explicit attach/detach
operations.

## Verification

- Import an archived conversation into an offline engine.
- Reject an offline send without changing its messages.
- Attach a provider and continue the same runtime conversation.
- Preserve retained history across 402, 429, and provider-unavailable errors.
- Roll an unavailable Workshop send back out of both the room ledger and its
  durable checkpoint while retaining staged composer attachments.
- Surface transient failures without publishing an analysis result.
