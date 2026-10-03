# Explicit cache provider support — 2026-10-03

All checks are public documentation/endpoint metadata reads, without API keys
or inference calls. Wire format and TTL come from the provider documentation;
cache-write pricing on a live Alibaba endpoint corroborates model support.
These checks do not prove a cache hit or the endpoint selected for a future run.

## Enabled content-block policies

| OpenRouter model id | Evidence |
| --- | --- |
| `deepseek/deepseek-v3.2` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing among other providers |
| `qwen/qwen-plus` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3-max` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3-coder-plus` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3-coder-flash` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3.6-plus` | OpenRouter cache guide; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3.6-flash` | Alibaba explicit-cache model list; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3.6-max-preview` | Alibaba explicit-cache model list; Alibaba endpoint with cache-write pricing |
| `qwen/qwen3.7-max` | Alibaba explicit-cache model list; OpenRouter model description and endpoint cache-write pricing |
| `qwen/qwen3.7-plus` | Alibaba explicit-cache model list; OpenRouter endpoint with cache-write pricing |
| `qwen/qwen3.7-flash` | Alibaba explicit-cache model list; OpenRouter endpoint with cache-write pricing |
| `qwen/qwen3.8-max` | Alibaba explicit-cache model list; OpenRouter endpoint with cache-write pricing |
| `qwen/qwen3.8-max-0902` | Alibaba explicit-cache model list; OpenRouter endpoint with cache-write pricing |
| `qwen/qwen3.8-flash` | Alibaba explicit-cache model list; OpenRouter endpoint with cache-write pricing |

The API checked was `GET /api/v1/models/{model_id}/endpoints` on OpenRouter.
For the additional eight Qwen ids, their model slugs have an Alibaba endpoint
advertising `pricing.input_cache_write`. Runtime policy selection uses this
checked allowlist; it makes no extra network requests.

## Deliberately excluded from explicit hints

- `qwen/qwen3-max-thinking`: Alibaba endpoint has no cache-write pricing.
- `qwen/qwen3.8-max-prime`: Alibaba endpoint lists native cache-read pricing
  but no cache-write pricing; absent from the checked explicit model list.
- `qwen/qwen3.5-plus-02-15` and `qwen/qwen3.5-flash-02-23`: OpenRouter's
  cache guide explicitly excludes these snapshot endpoints.
- Guessed `qwen/qwen3.5-plus`, `qwen/qwen3.5-flash`, `qwen/qwen-flash`,
  `qwen/qwen3-vl-plus`, and `qwen/qwen3-vl-flash`: endpoint lookup returned
  404 for these slugs even though native Alibaba models exist.
- `moonshotai/kimi-k2.5`: no Alibaba endpoint in the checked route set.
- `moonshotai/kimi-k2.7-code`: Alibaba endpoint has no cache-write pricing.
- Gemini, Muse, OpenAI, Z.AI, and other native families: no required explicit
  activation under the existing conversation-caching intent.

No provider ordering or pinning is added. In particular, DeepSeek V3.2 can
still be routed to non-Alibaba providers with their own caching behavior.

## Sources

- [OpenRouter caching guide](https://openrouter.ai/docs/guides/best-practices/prompt-caching)
- [Alibaba explicit caching](https://www.alibabacloud.com/help/en/model-studio/context-cache)
- [Alibaba cache placement guidance](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/explicit-cache-guide)
- [Qwen3.7 Max on OpenRouter](https://openrouter.ai/qwen/qwen3.7-max)
- [Example endpoint metadata: Qwen3.8 Max 0902](https://openrouter.ai/api/v1/models/qwen/qwen3.8-max-0902/endpoints)
