# Feature: A Workshop Session Keeps Its Cache Key Across a Reload

**Date Identified:** 2026-11-25
**Status:** Idea, ready to build. Small: one optional field on the engine's conversation archive, kept on restore. K1 and K2 decided. No ADR needed; a short note in the PR is enough.
**Priority:** Medium. Okey loses the cache on every rebuild and relaunch while testing, and so does any writer who reloads the window mid-session.
**Origin:** Okey, 2026-11-25, while Astra was building multiple Workshop tabs

## In Okey's words

> It would be cool for workshop sessions to preserve their openrouter
> session key! That way on a reload still within the cache window it'd
> still work. This would help during my testing b/c I regularly rebuild and
> relaunch (and have been losing my cache).

## What happens today

- **Every retained conversation already sends a routing key.**
  `prepareOpenRouterPromptCacheRequest` (`providers/OpenRouterPromptCachePolicy.ts`)
  sends `session_id: prose-minion:<sha256(conversationId)>`.
- **The key comes from the runtime conversation id, and a restore mints a new
  one.** `ConversationManager.importConversations` gives each archived
  conversation a fresh id (`createConversationId`: tool name, a counter,
  `Date.now()`, `randomUUID()`). The archive entry
  (`ConversationArchiveEntryV1`) stores no key. So after a reload, the same
  conversation goes out under a new `session_id`.
- **A new key is worse than no key.** OpenRouter's docs say a
  `session_id` is used *directly* as the sticky-routing key. Without one,
  OpenRouter groups requests by hashing the opening messages, which would
  match after a reload. So a reloaded room looks like a brand-new
  conversation, and the next request may go to another provider endpoint
  for the same model (Anthropic, Bedrock, Vertex), whose cache is cold.
- **The countdown is lost too.** The composer's cache clock reads
  `estimatedCacheExpiresAt` from the context-budget snapshot, which is
  "ephemeral with the context reading" (`inferenceContext.ts`) and not
  archived. A reloaded room shows no clock until its next reply.

## Idea

1. **A key that belongs to the conversation, not the runtime.** When a
   conversation starts, the engine mints an opaque random `routingKey` and
   keeps it on the conversation. `prepareOpenRouterPromptCacheRequest`
   reads that key, not the runtime id. It is still hashed before sending
   and stays well under OpenRouter's 256-character limit.
2. **Archived and restored with the history.** `ConversationArchiveEntryV1`
   gains an optional `routingKey`. Export writes it; import keeps it instead
   of deriving one from the new runtime id.
   - The field is optional and additive, with no `schemaVersion` bump
     (ADR 2026-07-30).
   - An archive without it (every session saved before this) mints a fresh
     key on import, which is today's behavior.
   - An authentic session fixture from before the change must keep reading.
3. **The engine's change, not the Workshop's.** It lives in
   `ConversationManager` and the cache policy. No Workshop branch, so any
   retained conversation gets it.
4. **The cache clock comes back too** (K2). The archive also keeps the last
   request's `estimatedCacheExpiresAt` and `cacheRequestModelId`. On
   restore, a time still in the future seeds the countdown; a past one is
   dropped.
5. **Private.** The key never reaches the webview, a transcript, an export
   or a log. It's random, and carries nothing of the writer's text or
   paths.

## What keeps the key (K1)

The key follows the retained history: a copy of the history keeps it, and a
new conversation mints one.

| Operation | Key | Why |
|---|---|---|
| Reload, restore, reopen a saved session | Keeps | The point of the feature. |
| Rewind | Keeps | The cut history is a prefix of the cached one. |
| Branch | Keeps | Same prefix. Two rooms sharing a routing hint is harmless: it is not an identity. |
| New, full reset, a participant's fresh conversation | New key | A new conversation. |

## What it can't fix

- **The provider's cache window.** A reload must land within it: five
  minutes by default, an hour with `proseMinion.claudeCacheTtl: "1h"`. For
  rebuild-and-relaunch testing, the one-hour setting makes this reliable.
- **A changed prompt.** A rebuild that changed a system-prompt file, the
  tool list, or a setting the prompt includes changes the prefix, and the
  cache misses. That is correct behavior.
- **OpenRouter's sticky session expiring.** The main caching guide says 60
  minutes of inactivity; another copy says 10. Check the live docs when
  building.
- **Sticky routing never applies with a manual `provider.order`,** and only
  where cache reads are cheaper than ordinary input.

## Decisions (Okey, 2026-11-25)

| # | Decision | Notes |
|---|---|---|
| K1 | **The key follows the retained history.** Reload, reopen, Rewind and Branch keep it; New, a full reset and a fresh conversation mint one. | The table above. Branch keeps it because the cached prefix is the same. |
| K2 | **The cache clock is restored too.** | Two numbers in the archive. Restoring the whole last context reading (the meter too) is a separate, larger question, left out. |

## Completion Criteria

- [ ] A conversation's `session_id` is the same before and after an
      export and import (test through `ConversationManager`).
- [ ] An archive without `routingKey` imports with a fresh key, and the
      pre-change session fixture still reads (test).
- [ ] Rewind and Branch keep the key; New, a full reset and a fresh
      conversation mint one (tests, per K1).
- [ ] A restored room shows the cache clock while the saved expiry is in
      the future, and none once it has passed (test, per K2).
- [ ] The key appears in no webview message, transcript, export or log
      (test).
- [ ] The help line on the cache (`resources/help/overview.md`, the
      Settings section) says a reload within the window keeps the cache.
- [ ] Live check: with the one-hour cache, rebuild and relaunch mid-room,
      and the next reply reports cached input.

## Related

- [Provider conversation prompt cache](../feature-provider-conversation-prompt-cache/README.md):
  where the per-conversation `session_id` came from.
- [Several Workshop and Lightbox tabs](../feature-multiple-workshop-and-lightbox-tabs/README.md)
  (#9): Astra's work touches the same session restore path. Build this after
  it merges, or stack on it.

## Related Files

- `packages/core/src/infrastructure/api/providers/OpenRouterPromptCachePolicy.ts`
  (`prepareOpenRouterPromptCacheRequest`)
- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`
  (passes `conversationId` today)
- `packages/core/src/infrastructure/api/orchestration/ConversationManager.ts`
  (`ConversationArchiveEntryV1`, `importConversations`, `createConversationId`)
- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts`
- `packages/core/src/shared/types/messages/inferenceContext.ts`
  (`estimatedCacheExpiresAt`)
- `packages/core/src/application/services/workshop/WorkshopPersistedSession.ts`
  (the archive in the session file)

## Sources

- [OpenRouter: Prompt caching](https://openrouter.ai/docs/guides/best-practices/prompt-caching)
- [OpenRouter: Prompt caching and sticky routing](https://openrouter.ai/blog/tutorials/prompt-caching-sticky-routing/)
