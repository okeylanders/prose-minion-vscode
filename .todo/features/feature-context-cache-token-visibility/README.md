# Feature: Context Bar Cache vs. Fresh Token Visibility

**Status**: Proposed
**Priority**: Low
**Date**: 2026-08-06
**Origin**: Conversation brainstorm while inspecting the Workshop context bar
**Related**:
[ADR: Context Bar Cache vs. Fresh Token Visibility](../../../docs/adr/2026-08-06-context-cache-token-visibility.md),
[ADR: Token Usage and Cost Widget](../../../docs/adr/2025-10-26-token-usage-and-cost-widget.md)

## Problem / Motivation

The Workshop context bar shows a single cumulative "processed" token number
per participant, with no distinction between tokens served from a provider's
prompt cache and tokens freshly processed. In a long Workshop room with a
large pinned context (project resources, prior turns), most of the prompt is
often re-sent unchanged turn over turn — exactly the case prompt caching
exists for on providers that support it (e.g. Anthropic via OpenRouter). A
writer watching the bar currently can't tell whether a big number is real new
spend or a cheap cache hit.

## Proposal

- Capture cache token counts from OpenRouter's usage payload (a
  `prompt_tokens_details.cached_tokens`-shaped field) where the provider
  reports them, and add them to the shared `TokenUsage` contract as optional
  fields so every existing consumer is unaffected when absent.
- Thread the cached count through the same aggregation path that already
  produces `cumulativeProcessedTokens` for `ContextBudget`
  (`WorkshopRoomHandler` / `ConversationManager` / `AgentRunEngine` /
  `useWorkshopRoom`), using the same per-turn aggregation boundary so the
  cached and total figures never drift apart.
- Render the context bar's processed-token segment as two colors — cached vs.
  freshly processed — using the existing theme/identity token palette rather
  than new ad hoc colors, with the numeric total remaining the primary label.
- When a provider/model never reports cache counts, render exactly as today
  (single segment); this is a data-presence check, not a per-model capability
  flag the UI needs to track.

## Related Files

- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts` —
  `OpenRouterResponse['usage']` type and `toTokenUsage()`
- `packages/core/src/shared/types/messages/tokenUsage.ts` — `TokenUsage`
- `packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts`
- `packages/core/src/infrastructure/api/orchestration/{ConversationManager,AgentRunEngine}.ts`
- `packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts`
- `packages/core/src/presentation/webview/utils/contextBudget.ts`
- `packages/core/src/presentation/webview/components/shared/ContextBudget.tsx`

## Completion Criteria

- [ ] A live OpenRouter probe against a model Workshop actually uses confirms
      the exact cache-token field name and that it populates on a repeated
      prompt, before the UI split is built out.
- [ ] `TokenUsage` gains optional cache fields with no changes required in any
      existing consumer that ignores them.
- [ ] Cached and total processed-token aggregation share the same per-turn
      boundary (`requestCount`) so the two numbers stay consistent.
- [ ] The context bar renders a cached/fresh color split when cache data is
      present, and its current single-segment appearance unchanged when it is
      absent.
- [ ] Bar colors are chosen from the existing theme/identity token palette and
      pass a dark-theme contrast check.
- [ ] Tests cover: cache field present, cache field absent, and aggregation
      across a multi-call logical turn.
