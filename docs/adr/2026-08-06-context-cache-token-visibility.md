# ADR: Context Bar Cache vs. Fresh Token Visibility

Status: Proposed
Date: 2026-08-06
Extends: [ADR 2025-10-26 — Token Usage and Cost Widget](2025-10-26-token-usage-and-cost-widget.md)

## Context

The Workshop context bar (`ContextBudget.tsx`) shows a single cumulative
"processed" token figure per participant. It does not distinguish tokens that
were served from a provider's prompt cache from tokens that were freshly
processed. For a long-running Workshop room with a large pinned context
(project resources, prior turns), most of a request's prompt is typically
re-sent unchanged turn over turn — a strong candidate for prompt caching on
providers that support it (e.g. Anthropic models via OpenRouter).

OpenRouter's unified usage-accounting response can include a cache breakdown
on the `usage` object (analogous to OpenAI's `prompt_tokens_details.cached_tokens`)
for models/providers that support prompt caching. Today the codebase neither
requests nor reads this:

- `OpenRouterClient.ts`'s `OpenRouterResponse['usage']` type declares only
  `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost`, and
  `cost_details.upstream_inference_cost` — no cache fields.
- `toTokenUsage()` only maps those same fields; any cache breakdown present in
  the raw JSON is silently dropped.
- `TokenUsage` (`shared/types/messages/tokenUsage.ts`) has no cache-related
  field.
- No file in the repo references `cache_read`, `cached_tokens`,
  `cache_creation`, or `prompt_tokens_details`.

Without this data, a writer watching the context bar cannot tell whether a
large "processed" number represents real new spend or a cheap cache hit —
information that directly affects the cost and latency intuition the bar is
meant to build (per ADR 2025-10-26's tokens-first UX goal).

## Decision

1. **Capture cache token counts where the provider reports them.**
   Extend `OpenRouterResponse['usage']` to optionally include a cache
   breakdown (`prompt_tokens_details.cached_tokens`, and any distinct
   cache-write/creation count the provider reports). Extend `toTokenUsage()`
   to read it defensively — the field is provider- and model-dependent, so its
   absence must fall back to today's behavior without error.

2. **Extend the shared `TokenUsage` contract.**
   Add optional `cachedTokens?: number` (and `cacheCreationTokens?: number` if
   OpenRouter distinguishes cache writes from cache reads for a given
   provider) to `TokenUsage`. Optional fields preserve every existing
   consumer; nothing downstream breaks if a response omits them.

3. **Thread cache counts through the Workshop aggregation path.**
   `WorkshopRoomHandler` / `ConversationManager` / `AgentRunEngine` already
   aggregate `cumulativeProcessedTokens` for `ContextBudget`. Extend that
   aggregation to also sum cached tokens, and expose both the cached and
   total-processed figures to `useWorkshopRoom` and `ContextBudget`.

4. **Render the context bar as two segments, not two numbers.**
   In `ContextBudget.tsx`, split the existing processed-token bar into a
   cached segment and a fresh segment (e.g. green for cached, a distinct
   accent — not necessarily literal orange, subject to the existing
   `--pm-identity-*` / theme token palette and dark-mode contrast pass — for
   freshly processed). Keep the existing numeric total as the primary label;
   the color split is a supplementary signal, consistent with how identity
   color is already treated as supplementary in the sibling participant-color
   feature.

5. **Degrade silently when cache data is unavailable.**
   If a provider/model never reports cache counts, `cachedTokens` stays
   `undefined` and the bar renders exactly as it does today — a single
   uncolored (or single-color) segment. This is not a per-model capability
   flag the UI needs to know about in advance; it is a data-presence check.

## Alternatives Considered

- **Add a second text stat ("cached: N") instead of coloring the bar.**
  Rejected as the first move: a color split answers "how much of this was
  cheap" at a glance during a long session, which is the bar's whole job;
  a text-only stat is easy to miss. A tooltip/text breakdown on hover can
  still be layered on top of the colored bar later — not exclusive.
- **Treat this as a per-model capability flag surfaced in settings.**
  Rejected: presence of `cachedTokens` in a given response is a sufficient
  and simpler signal than maintaining a static list of which models cache.
- **Estimate cache savings from cost fields instead of a token count.**
  Rejected: `cost_details` is opportunistic and cost-shaped, not token-shaped;
  mixing a cost-derived estimate into a token bar would misrepresent the
  bar's existing unit.

## Consequences

### Positive

- The context bar becomes a more honest cost/latency proxy for long Workshop
  rooms with large pinned context, without adding a new widget or control.
- Optional fields keep this fully additive to the existing `TokenUsage`
  contract and the Phase 1 token widget ADR; no breaking changes.

### Costs / risks

- Cache-field population is provider- and model-dependent and not verified
  against a live OpenRouter response as of this ADR. If the field is absent
  or unreliable for the models Workshop actually uses, the bar simply never
  shows the cached segment — low risk, but the UI payoff should not be
  assumed until confirmed live.
- `cumulativeProcessedTokens` aggregation currently sums a single number
  across potentially multiple calls in one logical turn (`requestCount`);
  summing a second cache figure across the same calls must use the same
  aggregation boundary to stay consistent, or the two numbers will silently
  drift apart.

## Follow-ups

- Before investing in the two-segment bar UI, run a live OpenRouter probe
  (a repeated prompt against a model Workshop actually uses, e.g. an
  Anthropic model) to confirm `usage.prompt_tokens_details.cached_tokens` (or
  the equivalent field OpenRouter actually returns) populates as expected.
- Decide final bar colors against the existing `--pm-identity-*` / theme
  token palette and confirm dark-theme contrast, rather than introducing new
  ad hoc colors.
- Consider a hover tooltip with the exact cached/fresh split once the colored
  bar ships, for writers who want the precise numbers.
