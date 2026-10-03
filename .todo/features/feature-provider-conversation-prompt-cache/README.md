# Provider Conversation Prompt Cache

**Status:** Implemented and automatically verified; live provider acceptance pending
**Priority:** High

## Problem

Claude and supported Alibaba/Qwen Workshop turns need provider-specific caching
requests. Cache reporting was implemented separately from activation.

## Related files

- [ADR](../../../docs/adr/2026-10-03-provider-conversation-prompt-caching.md)
- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`
- `packages/core/src/infrastructure/api/providers/OpenRouterPromptCachePolicy.ts`
- `packages/core/src/infrastructure/api/providers/OpenRouterChatContracts.ts`
- [Checked provider support](provider-support-2026-10-03.md)
- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts`

## Completion criteria

- [x] Retained runs request conversation caching from their first inference.
- [x] Claude requests carry automatic caching; 14 verified Alibaba-compatible
  model ids receive explicit content breakpoints; native models keep their behavior.
- [x] Participant conversation identity controls stable provider affinity.
- [x] Histories and session contracts remain plain strings without cache metadata.
- [x] Regression tests, typecheck, and build pass.
- [ ] Live Claude follow-up reports cache reads after a cold cache write.
- [ ] Live supported Qwen follow-up reports cache reads after a cold cache write.

## Verification (2026-10-03)

Branch: `fix/anthropic-prompt-caching`.

- Extended focused policy/provider/engine suites: 147 tests passed.
- Extended full Jest suite: 231 suites, 2,863 tests, 2 snapshots passed.
- Full monorepo typecheck and production build/bundle verification passed.
- Changed-file ESLint: no errors; warning-level API wire naming and existing
  formatting warnings. Build/test toolchain warnings also remain.
- No live provider requests were made. See ADR for the acceptance procedure
  and cold-write/TTL limitations.
