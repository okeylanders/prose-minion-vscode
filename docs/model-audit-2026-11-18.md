# OpenRouter model audit — November 18, 2026

This refresh covers interactive releases since the November 16 audit and the deferred Ling 3.2 Flash route. Gemini 4 Hydrogen, Qwen4 Max, and Hy4 Flash were added in the preceding refresh. The new models are opt-in. [November 16 audit](model-audit-2026-11-16.md) · [OpenRouter catalog](https://openrouter.ai/api/v1/models)

| Added model | Context / max output | Base input / output per million tokens | Reasoning | Serving endpoints |
|---|---:|---:|---|---:|
| [GPT-6.2 Sol](https://openrouter.ai/openai/gpt-6.2-sol) | 1,050,000 / 128,000 | $2 / $10 | Mandatory | [5](https://openrouter.ai/api/v1/models/openai/gpt-6.2-sol/endpoints) |
| [GPT-6.2 Sol Pro](https://openrouter.ai/openai/gpt-6.2-sol-pro) | 1,050,000 / 128,000 | $2 / $10 | Mandatory, Pro mode | [4](https://openrouter.ai/api/v1/models/openai/gpt-6.2-sol-pro/endpoints) |
| [GPT-6.2 Astra](https://openrouter.ai/openai/gpt-6.2-astra) | 1,050,000 / 128,000 | $8 / $40 | Mandatory | [5](https://openrouter.ai/api/v1/models/openai/gpt-6.2-astra/endpoints) |
| [GPT-6.2 Astra Pro](https://openrouter.ai/openai/gpt-6.2-astra-pro) | 1,050,000 / 128,000 | $8 / $40 | Mandatory, Pro mode | [4](https://openrouter.ai/api/v1/models/openai/gpt-6.2-astra-pro/endpoints) |
| [Ling 3.2 Flash (free)](https://openrouter.ai/inclusionai/ling-3.2-flash%3Afree) | 1,048,576 / 262,144 | Free, rate-limited | Optional | [1](https://openrouter.ai/api/v1/models/inclusionai/ling-3.2-flash:free/endpoints) |

All five advertise text output, tool calls, and structured outputs. The interactive pickers use the exact free ID for Ling and the standard interactive IDs for GPT-6.2. OpenRouter lists separate batch variants for GPT-6.2.

GPT-6.2 endpoints list higher rates for prompts of at least 272,000 tokens and for faster routes. At base routing rates, Sol lists $0.10/M cache reads and $2.50/M cache writes, and Astra lists $0.40/M reads and $10/M writes. Pro mode can raise the total cost by consuming more reasoning tokens. The app uses its existing automatic cache policy for GPT-6.2 and shows a window estimate after reported cache activity. Ling has no app cache-window estimate. Paid inference, prose quality, and app cache reuse remain unverified. [GPT-6.2 Sol pricing](https://openrouter.ai/openai/gpt-6.2-sol) · [GPT-6.2 Astra pricing](https://openrouter.ai/openai/gpt-6.2-astra)
