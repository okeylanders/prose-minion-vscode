# ADR 2026-10-03: Claude Cache Duration and Estimated Cache Window

**Status:** Accepted

## Context

The writer wants to choose Claude's one-hour cache duration and see an
estimated remaining cache window centered between the Workshop composer's controls.
OpenRouter reports cache reads/writes but no expiration timestamp. Cache
activity can differ between requests inside a single logical turn.

## Decision

- Add `proseMinion.claudeCacheTtl`, with `5m` (default) and `1h`, through the
  existing model-settings domain hook and Settings overlay. Read the setting
  for each retained inference. Only Claude receives the selected TTL; other
  provider policies keep their current behavior. Reject unsupported values.
- The provider policy owns known cache durations. On a completed request with
  positive reported cache reads or writes, project an optional
  `estimatedCacheExpiresAt` in the request observation. Use request dispatch
  time plus the known duration, a conservative estimate that avoids adding
  generation time to the remaining lifetime. Unknown native durations and
  compressed requests have no countdown.
  For Alibaba-compatible models, require explicit cache writes: a read alone
  could come from another endpoint's implicit cache with an unknown lifetime.
- GPT-5.6 and later have a documented default minimum cache window of 30
  minutes, refreshed by writes/reuse. Include a native OpenAI policy for these
  versioned model families (including routing variants and alias markers).
  Leave automatic request caching unchanged; no Claude controls or explicit
  breakpoints are needed. Earlier GPT models and unresolved router ids remain
  unknown. Only positive provider-reported cache activity starts the estimate.
  At zero, say `window elapsed`: OpenAI may retain entries beyond its minimum.
- Carry the last request's estimate into the existing context-budget snapshot,
  scoped to the selected participant. Never infer warmth from aggregate usage
  or old transcript bubbles. Context budgets are already ephemeral: restoring
  conversations, rewinding, resetting, and replacing system prompts clear them.
- Render `Est. Cache Time Remaining: N min` with a small decorative clock icon,
  centered between the plus button and the action buttons in the accent color.
  Hide absent estimates and mismatched models. At zero, show an estimated
  elapsed window rather than promise a cache miss. Use a quiet tooltip to
  explain routing, prefix matching, and conservative timing. Update against
  wall-clock time, and avoid repeated screen-reader announcements.
- A duration preference change affects subsequent requests, not existing
  estimates. No persisted-session schema change or artificial keepalive calls.

## Costs and validation

Claude's one-hour writes cost 2× normal input versus 1.25× for five minutes
(60% more per cache write); reads use the same model-specific discounted rate.
Test request serialization, conservative timestamps, positive/absent cache
evidence, last-request telemetry, settings validation/sync, timer expiry and
recipient switching. Verify typecheck and production build.

Sources: [OpenRouter caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching),
[Claude caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
