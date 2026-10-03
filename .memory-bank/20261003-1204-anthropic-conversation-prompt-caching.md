# Provider Conversation Prompt Caching

Date: 2026-10-03 (America/Chicago)
Branch: `fix/anthropic-prompt-caching`
Status: Local implementation verified; live cache reuse pending.

## Findings

Okey reported OpenAI caching working while Claude Workshop turns were full
cost. OpenRouterClient sent neither cache opt-in nor conversation affinity.
Cache reporting had landed independently (PR #116 / cache-usage epic).
Session notes from September reference an untracked
`.todo/features/feature-workshop-anthropic-prompt-cache/` proposal; that folder
is absent now and `git log --all -- <path>` found no committed copy.

## Decision and implementation

- [ADR](../docs/adr/2026-10-03-provider-conversation-prompt-caching.md)
- [Active acceptance tracking](../.todo/features/feature-provider-conversation-prompt-cache/README.md)
- AgentRunEngine passes runtime conversation identity for retained policies
  from the first request through follow-ups and capability/correction calls.
- OpenRouterPromptCachePolicy hashes ids into stable, opaque, bounded routing
  keys and adds top-level ephemeral cache control for Anthropic model ids.
  OpenRouter aliases prefixed with `~` are recognized too.
- Okey then requested other explicit-cache models. The policy is now a closed
  registry of Anthropic automatic, Alibaba explicit, and native strategies.
  Fourteen verified Alibaba-compatible model ids receive content-block
  breakpoints on the system prompt and advancing conversation tail.
- Plain transcript and outbound content-block types are separated in
  OpenRouterChatContracts. All nonempty Alibaba messages use a consistent
  text-block wire shape; stored history stays strings. Empty messages remain
  strings and receive no marker. Requests carry at most two breakpoints.
- [Model support evidence](../.todo/features/feature-provider-conversation-prompt-cache/provider-support-2026-10-03.md)
  records public endpoint checks. No runtime endpoint lookup or provider pin
  is introduced. Exact ids recognize routing suffixes; unverified snapshots,
  Qwen Max Thinking, and Max Prime remain on native behavior.
- Streaming and non-streaming requests share completion options and policy.
- Native families receive affinity while retaining native caching behavior;
  discarded one-off tools remain without explicit caching intent.
- Default cache TTL is five minutes. Cache writes carry a premium; actual
  hits still depend on prefix equality, model thresholds, expiry, and routing.
- No durable schema, prompt content, webview, or composition-root changes.

## Verification and remaining work

- Extended focused suites: 147 tests passed.
- Extended full suite: 231 suites / 2,863 tests / 2 snapshots passed.
- `npm run typecheck`, `npm run build`, and bundle sentinels passed.
- Changed-file ESLint: zero errors, warning-level wire naming/formatting.
- Toolchain warned about ts-jest configuration, React act, old Browserslist
  data, and webpack asset sizes; no validation failed.
- No live billable calls performed. Validate the cold cache-write and a warm
  same-participant Claude and supported Qwen follow-up within five minutes in the development
  host; measured reads/cost are the evidence, not the request hint alone.
- One-hour TTL policy and optional Gemini explicit caching are not implemented.
- First commit scope: caching implementation, tests, ADR, provider-support
  evidence, active acceptance tracking, and this continuity snapshot.
  Pre-existing release notes and Prose Minion.zip were preserved.
