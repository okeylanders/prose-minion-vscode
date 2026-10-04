# ADR 2026-10-03: Provider Conversation Prompt Caching

**Status:** Accepted
**Date:** 2026-10-03
**Related:** [Cache token visibility](2026-08-06-context-cache-token-visibility.md)

## Context

Workshop resends retained histories on each participant turn. The OpenRouter
adapter reports cache reads/writes but sends no caching opt-in. OpenAI's
implicit caching works; Claude's opt-in caching therefore never starts.
Earlier session notes reference an untracked Anthropic proposal that is absent
from this checkout and has no committed history.

## Decision

Use a request policy at the OpenRouter adapter boundary. The engine supplies
the runtime conversation id for every inference in a retained run, including
its first call, continuation, capability rounds, and corrections. Discarded
one-off runs supply no conversation caching intent.

The adapter derives an opaque, bounded `session_id` from that id for provider
affinity on all model families. For Anthropic model ids (including OpenRouter
alias ids), it also sends top-level `cache_control: { type: 'ephemeral' }`.
OpenRouter advances this breakpoint over the growing conversation and
translates it for Claude backends. Default TTL is five minutes.

### Explicit content caching (2026-10-03 extension)

Resolve a named request policy from a closed registry: Anthropic automatic,
Alibaba explicit, or native caching as the default. Separate plain transcript
messages from outbound text-block messages. The request preparation step can
rewrite wire content without mutating or persisting cache markers.

For documented Alibaba-compatible model ids, mark the first nonempty system
message and the last nonempty message with ephemeral content-block controls.
The stable breakpoint protects system reuse when the advancing tail moves
beyond the provider's lookup window. The tail breakpoint writes growing history
for subsequent requests. Use at most two markers, deduplicating a system-only
request, and keep the content shape of earlier messages stable across turns.

Use an exact supported-model allowlist, stripping only OpenRouter's leading
alias marker and routing variant suffix for detection. Support the six models
in OpenRouter's caching guide plus newer Qwen endpoints with verified Alibaba
cache-write support. Do not generalize to all Qwen snapshots, future ids, or
routers. Endpoint metadata checked on 2026-10-03 also identifies supported
Qwen 3.6 Flash/Max Preview, 3.7 Max/Plus/Flash, and 3.8 Max/Max 0902/Flash routes.
Qwen3 Max Thinking and Qwen3.8 Max Prime are excluded because the checked
endpoints do not advertise explicit cache-write support.

The full checked model list and endpoint evidence are recorded in the
[support notes](../../.todo/features/feature-provider-conversation-prompt-cache/provider-support-2026-10-03.md).

DeepSeek V3.2 receives compatible content markers to enable its Alibaba route;
other serving routes may use native caching. Do not pin providers or require
caching support, so OpenRouter retains its normal availability fallback.
Gemini and Muse remain on native caching; their optional explicit controls
are separate optimizations, not requirements to enable caching.

Keep model-specific wire fields out of conversation history, session JSON,
webview messages, and domain settings. Re-evaluate the policy using the model
captured for each request, so a hot-swap cannot retain the prior family's hints.
Hydration/branching receive new runtime ids; rewind preserves its id. Neither
identity nor a hint promises a cache hit: exact prefix matching, TTL, provider
availability, model thresholds, and provider normalization still apply.

## Consequences and verification

- Retained Claude runs can write/reuse their prompt prefixes; cold writes have
  a surcharge. No blanket opt-in for discarded dictionary/analysis calls.
- Session affinity also helps providers with implicit caching before their
  first reported cache hit. It preserves OpenRouter's availability fallback.
- Cache activation needs no persisted-schema or UI changes. Existing
  per-response cache counts remain the evidence of actual reuse; costs remain
  provider-reported. The duration setting and composer estimate follow the
  [cache-window ADR](2026-10-03-cache-window-indicator.md).
- Test serialized streaming/non-streaming bodies, model switching, exact model
  detection, advancing content breakpoints, immutable history, and the
  engine's retained/discarded lifecycle. Verify typecheck and build.
- Manual acceptance: send a substantial Claude Workshop request, then a
  follow-up to the same participant within five minutes; inspect cache writes
  on the cold response and cache reads on the follow-up. Do not use an empty
  room or a model switch as proof of reuse. Live billable calls are deferred.
- Validate supported Alibaba/Qwen Workshop follow-ups the same way. A marker
  enables the supported route's cache; it does not prove the chosen endpoint
  cached the request. Cold writes still carry a surcharge.
- One-hour Claude TTL is implemented in the cache-window follow-up. Optional
  Gemini explicit caching remains separate work.

## Sources (checked 2026-10-03)

- [OpenRouter prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)
- [OpenRouter chat request contract](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion)
- [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Alibaba context cache](https://www.alibabacloud.com/help/en/model-studio/context-cache)
- [Alibaba explicit cache practices](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/explicit-cache-guide)
- [OpenRouter endpoint metadata](https://openrouter.ai/docs/api/api-reference/models/list-endpoints)
