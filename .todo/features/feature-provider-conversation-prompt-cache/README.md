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
- [x] Claude's five-minute/default or one-hour duration is selectable in General settings.
- [x] Selected participant's estimated cache window is centered between composer controls in the accent color.
- [x] GPT-5.6+ (including Terra 5.6) native caching supplies a documented 30-minute estimate.
- [ ] Live Claude follow-up reports cache reads after a cold cache write.
- [ ] Live supported Qwen follow-up reports cache reads after a cold cache write.

## Verification (2026-10-03)

Branch: `fix/anthropic-prompt-caching`.

- Extended focused policy/provider/engine suites: 147 tests passed.
- Duration/indicator full Jest suite: 232 suites, 2,886 tests, 2 snapshots passed;
  final provider-evidence refinement: 8 focused suites and 208 tests passed.
- Full monorepo typecheck and production build/bundle verification passed.
- Changed-file ESLint: no errors; warning-level API wire naming and existing
  formatting warnings. Build/test toolchain warnings also remain.
- No live provider requests were made. See ADR for the acceptance procedure
  and cold-write/TTL limitations.
- Browser composer preview verified at 1,162px and 680px widths.
- Terra/native OpenAI extension: 5 focused suites / 204 tests passed; typecheck,
  production build, and ESLint verification use `/private/tmp/prose-minion-terra-cache-*` logs.
- See [duration and indicator ADR](../../../docs/adr/2026-10-03-cache-window-indicator.md).
- Final PR preparation: 232 suites / 2,914 tests / 2 snapshots passed, with
  monorepo typecheck, production build/bundle verification, changed-file
  ESLint (zero errors), and diff checks. Logs: `/private/tmp/prose-minion-pr-*`.
  Updated the context-selector fixture for six staged attachments and verified
  that selecting two more blocks confirmation under the seven-item cap.
