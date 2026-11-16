# OpenRouter model audit — November 16, 2026

Compared the interactive curated lists against [OpenRouter's public catalog](https://openrouter.ai/api/v1/models) and queried serving endpoints for the 123 existing base IDs and three additions. All existing IDs had catalog entries (the `:nitro` routing variant was checked against its base) and at least one advertised endpoint. No existing choices were removed. Defaults and saved selections remain unchanged; no paid inference was made.

| Added model | Context / top-provider output | Catalog input / output per million tokens | Reasoning | Advertised endpoints |
|---|---:|---:|---|---:|
| [Gemini 4 Hydrogen](https://openrouter.ai/google/gemini-4-hydrogen) | 1,048,576 / 943,718 | $1.50 / $7.50 | Mandatory | [7](https://openrouter.ai/api/v1/models/google/gemini-4-hydrogen/endpoints) |
| [Qwen4 Max](https://openrouter.ai/qwen/qwen4-max) | 1,000,000 / 131,072 | $1.425 / $4.275 | Optional | [1](https://openrouter.ai/api/v1/models/qwen/qwen4-max/endpoints) |
| [Hy4 Flash](https://openrouter.ai/tencent/hy4-flash) | 1,048,576 / 65,536 | $0.035 / $0.1405 (promotional) | Optional | [1](https://openrouter.ai/api/v1/models/tencent/hy4-flash/endpoints) |

All three advertise text output, tools and structured outputs. Prices and limits may differ by route or change. Counts are endpoints, not distinct providers. These records establish advertised availability, not successful inference, editorial quality, or prompt-cache reuse. The new models retain the existing native cache policy without an asserted cache lifetime; advertised cache prices alone do not establish reuse.

Ling 3.2 Flash appeared as a free-only catalog listing, but its unsuffixed endpoint query returned no routes; the free variant's availability was not established. It was deferred along with batch-only and non-chat models. The catalog's top-provider output limit is not a guarantee for every route.

OpenRouter lists `z-ai/glm-5.1` as expiring November 20, 2026, and `z-ai/glm-4.5` on December 31, 2026. Both still had advertised endpoints during this audit and remain selectable; writers using them should plan a replacement before the listed dates. Saved selections are not automatically migrated.
