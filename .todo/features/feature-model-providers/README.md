# Feature: Model Providers Beyond OpenRouter (Anthropic, OpenAI, Local)

**Date Identified:** 2026-11-07
**Status:** Idea. Epic-sized: it changes the engine's provider seam, every model scope and every price the app shows. ADR first, then an epic.
**Priority:** High (Okey: "we need to add")
**Origin:** Okey, 2026-11-07

## In Okey's words

> We also need to add Anthropic, OpenAI, and local provider options.

## Problem

Every model call goes to OpenRouter. A writer who has an Anthropic or OpenAI
key, or a model running on their own machine, can't use it. The local case
also matters for privacy: with a local model, the manuscript never leaves the
writer's computer.

## What makes this tractable (findings, 2026-11-07)

- **The seam is narrow.** 55 files name OpenRouter, but only 7 import the
  client (`AgentRunEngine`, `AgentRunContracts`, `AIResourceManager`,
  `ConversationManager`, `ReasoningRequest`, `AssistantToolService`,
  `LightboxCallFailure`). The rest is the catalog, the balance, and UI copy.
- **The engine holds the concrete client.** `AgentRunEngine` stores an
  `OpenRouterClient` (`openRouterClient`, `attachProvider`,
  `requireProvider`). There is no provider interface yet, and that is the
  first change.
- **The chat call is already the OpenAI-compatible shape.** The client posts
  to `${baseUrl}/chat/completions`, with the base URL fixed at
  `https://openrouter.ai/api/v1` (`OpenRouterClient.ts:152`). OpenAI speaks
  that shape, and so do most local servers (Ollama, LM Studio, llama.cpp's
  server, vLLM). One adapter with a configurable base URL covers two of the
  three asks.
- **No native tool calling.** Persona capabilities are a text grammar the
  host parses (`WorkshopCapabilityXmlCodec`). Nothing sends `tools` but web
  research. Any provider that can chat can run every capability.
- **"Unknown" already has paths.**
  - `TokenUsage.costUsd` is optional.
  - The preflight skips when the context length is unknown.
  - `refusesReasoningOff` sends `off` as asked when the catalog can't say.
  - Recall falls back to one read's worth with no window.

## What is OpenRouter-only today

| Feature | Where | Anthropic | OpenAI | Local |
|---|---|---|---|---|
| Chat call | `OpenRouterClient` (`/chat/completions`) | Messages API: its own shape (top-level `system`, content blocks, `x-api-key`) | Same shape | Same shape, by base URL |
| Model list with prices and context length | `OpenRouterModels.ts` (`/models`) | Lists models, no prices | Lists models, no prices or context | Lists installed models. Free. Context length from the server where it says |
| Cost per call | `usage: { include: true }` | From a price table, or absent | From a price table, or absent | $0 |
| Reasoning levels | `reasoningRequest` (`reasoning.max_tokens`, `effort`) | `thinking.budget_tokens` | `reasoning_effort` on reasoning models | Model-dependent, mostly none |
| "Always reasons" check | catalog `reasoning.mandatory` | Unknown: sent as asked | Unknown: sent as asked | Unknown: sent as asked |
| Prompt caching | `OpenRouterPromptCachePolicy` (`cache_control`) | Native `cache_control` | Automatic | None |
| Web research | `openrouter:web_search` server tool | Its own server tool | Its own, through a different API | None: unavailable, with a reason |
| Account balance | `infrastructure/account/` | None | None | None |
| Served-model note | OpenRouter routing | Echoes the request | Echoes the request | Echoes the request |
| Attribution headers | `HTTP-Referer`, `X-Title` | — | — | — |

## Shape (for the ADR)

1. **A provider port.** `ChatProvider` in `infrastructure/api/providers/`.
   It is not a `platform/` port: it isn't the host's, and any host uses
   the same adapters.
   - **In:** a normalized request: messages, ceiling, temperature, the
     reasoning *level* (not a provider's field), cache hints, web research
     on or off, and the abort signal.
   - **Out:** a normalized result: content, `TokenUsage`, the served model,
     citations and the finish reason.
   - The engine, `ConversationManager` and `AIResourceManager` depend on the
     port. Today's client becomes the first adapter, unchanged.
2. **A catalog port, where unknown is an answer.** Each provider says what it
   knows about a model: context length, prices, whether it always reasons,
   whether it can search. Every field may be `unknown`, and every reader
   says so in words:
   - "price unknown", never "$0.00";
   - no preflight;
   - "web research isn't available on this provider".

   It never makes up a number.
3. **Two new adapters.**
   - `OpenAICompatibleProvider`, for OpenAI and local servers by base URL,
     with an optional key.
   - `AnthropicProvider`, for the Messages API.

   Each maps reasoning levels, usage fields, errors (the failure categories
   `LightboxCallFailure` reads) and cancellation itself.
4. **A scope picks a provider and a model.** Each model scope's selection
   becomes `{ provider, model }`, and a following scope follows both. Model
   ids stay native to their provider (`claude-…` direct, `anthropic/claude-…`
   on OpenRouter). Saved boards and sessions keep the model strings they
   recorded, which are just text.
5. **Keys.**
   - One SecretStorage key per provider (today: `openRouterApiKey`).
   - A local base URL is a plain setting, since it isn't a secret, and its
     key is optional.
   - Logs carry the provider id, never a key.
6. **Defaults don't move.** OpenRouter stays the default for every scope.

### Slices (a sketch for the epic)

| # | Slice | Outcome |
|---|---|---|
| 0 | Spec | ADR and epic |
| 1 | The port | The engine depends on `ChatProvider`, and OpenRouter is its adapter. No behavior change: the request bodies of every run policy are pinned before and after. |
| 2 | The catalog port | Prices, context, reasoning and search are read through it, with honest unknowns everywhere |
| 3 | Settings and keys | A provider per scope, keys per provider, a base URL, the Settings overlay |
| 4 | OpenAI-compatible | OpenAI and local servers |
| 5 | Anthropic | The Messages API adapter |
| 6 | Extras by provider | Web research per provider, the balance only where it exists |
| 7 | Live pass | Each provider against a real key or server |

**Order:** 4 before 5, because one adapter covers OpenAI and local.

## Open questions

- **A provider per scope, or one for everything?** Leaning per scope: the
  helper and Proofread on a free local model, the Workshop on Claude.
- **Prices for direct providers.** Neither lists prices. Options:
  - ship a price table, which goes stale;
  - let the writer enter prices;
  - say "price unknown".

  Craft Flags and the Lightbox confirm with a price ("≈ $…"). What does the
  confirmation say when the price is unknown?
- **Local presets.** Offer Ollama and LM Studio by name, with their usual
  addresses, plus a custom URL?
- **Anthropic's OpenAI-compatible endpoint.** Anthropic documents one.
  Whether it carries thinking, caching and usage reporting the way the
  native API does decides whether it can replace the Anthropic adapter.
- **Remote windows.** In a Remote-SSH, WSL or Codespaces window, "localhost"
  is the remote machine, because the extension host runs there. Say so in
  the setting?
- **Timeouts.** A local model can be much slower. Should the helper's, the
  Lightbox's and Proofread's timeouts scale per provider?
- **Context length on local servers.** Read it from the server where it says
  (Ollama reports it), and otherwise ask the writer?
- **Native web search** on Anthropic and OpenAI: v1, or later?

## Completion Criteria

- [ ] An ADR settles the port, the catalog's unknowns, `{ provider, model }`
      selection, keys, and the table above, row by row.
- [ ] The engine depends on `ChatProvider` only. OpenRouter's request bodies
      are identical before and after, pinned for every run policy.
- [ ] Each scope can run on OpenRouter, OpenAI, Anthropic or a local server.
      Each adapter is tested with a mocked transport: reasoning mapping,
      usage mapping, errors, cancellation and served model.
- [ ] Every OpenRouter-only feature has a stated answer per provider. An
      unknown is said in words (price, balance, search, window), never shown
      as a made-up number.
- [ ] Keys are per provider in SecretStorage and never logged. A local base
      URL is a setting.
- [ ] `packages/core/src` still has no `from 'vscode'`. `boundaries.test.ts`
      pins that only adapters call a provider's API.
- [ ] No live, billable call in tests.

## Related

- [Provider Conversation Prompt Cache](../feature-provider-conversation-prompt-cache/README.md):
  caching that is OpenRouter-shaped today.
- [Workshop Header Model Browser](../feature-workshop-header-model-browser/README.md):
  browsing models, which becomes per provider.
- [Reads That Fit the Window](../feature-workshop-reads-fit-the-window/README.md):
  its unknown-window path is what a local model without a stated context gets.
- [Workshop Research Agent](../feature-workshop-research-agent/README.md):
  web research, which is per provider here.
- [Desktop Shell Adapter](../feature-desktop-shell-adapter/README.md): another
  host on the same core and the same adapters.

## Related Files

- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts` (the
  chat call, base URL, headers, web search, usage)
- `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts` (the
  catalog, `reasoning.mandatory`)
- `packages/core/src/infrastructure/api/providers/OpenRouterPromptCachePolicy.ts`
- `packages/core/src/infrastructure/api/orchestration/AgentRunEngine.ts`,
  `AgentRunContracts.ts`, `AIResourceManager.ts`, `ConversationManager.ts`,
  `ReasoningRequest.ts`, `RequestContextPreflight.ts`
- `packages/core/src/infrastructure/lightbox/LightboxCallFailure.ts`
- `packages/core/src/infrastructure/account/` (OpenRouter balance)
- `packages/core/src/infrastructure/secrets/SecretStorageService.ts`
  (`openRouterApiKey`)
- `packages/core/src/shared/types/messages/configuration.ts` (`ModelScope`)
  and `shared/types/messages/tokenUsage.ts`
- `apps/vscode-extension/package.json` (model settings)
