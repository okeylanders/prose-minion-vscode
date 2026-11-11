# OpenRouter model audit — November 11, 2026

**Scope:** Refresh the shared interactive model choices on the Workshop Reply
Edit Actions branch. All additions are opt-in. Existing defaults and saved
selections are unchanged; no paid requests were made.

## Evidence

Compared the branch's curated lists with [OpenRouter's public catalog](https://openrouter.ai/api/v1/models)
and checked each addition and retirement against its individual endpoints.
The refreshed catalog contained 466 records, including free, batch and routing
variants. After the refresh there are 123 recommended IDs and 76 Category
Search IDs, with no duplicates or missing live base IDs. The existing `:nitro`
choice is checked against its base ID.

Prices are catalog dollars per million input/output tokens on the audit date;
individual routes, promotional rates and actual costs can differ. Output
limits are the catalog's top-provider limits, not a promise for every route.
All four additions advertise text output, tools and structured outputs.

| Model | Context / output ceiling | Input / output | Reasoning | Serving endpoints |
|---|---:|---:|---|---:|
| [Claude Fable 5.2](https://openrouter.ai/anthropic/claude-fable-5.2) | 1,000,000 / 128,000 | $8 / $40 | Mandatory, default high | [5](https://openrouter.ai/api/v1/models/anthropic/claude-fable-5.2/endpoints) |
| [Gemini 4 Carbon](https://openrouter.ai/google/gemini-4-carbon) | 1,048,576 / 943,718 | $2 / $10 | Mandatory, default medium | [7](https://openrouter.ai/api/v1/models/google/gemini-4-carbon/endpoints) |
| [Muse Ember](https://openrouter.ai/meta/muse-ember) | 1,048,576 / 943,718 | $0.10 / $0.50 | Mandatory, default max | [2](https://openrouter.ai/api/v1/models/meta/muse-ember/endpoints) |
| [Tencent Hy4](https://openrouter.ai/tencent/hy4) | 1,048,576 / 65,536 | $0.417 / $1.2505 | Optional, default high | [1](https://openrouter.ai/api/v1/models/tencent/hy4/endpoints) |

Endpoint counts are routes, not distinct providers. The catalog and endpoint
records establish advertised availability, not successful inference, prose
quality, or prompt-cache reuse in Prose Minion. The live reasoning catalog
reports the three mandatory-reasoning models to the existing Proofread and
helper safeguards when available; offline fallback cannot establish that fact.
Earlier Fable choices remain available for writers to compare.

## Retired choices

Each was absent from the refreshed catalog and returned an empty endpoint list:
[Mercury 2.5](https://openrouter.ai/api/v1/models/inception/mercury-2.5/endpoints),
[Mercury 3](https://openrouter.ai/api/v1/models/inception/mercury-3/endpoints),
[Hermes 3 70B](https://openrouter.ai/api/v1/models/nousresearch/hermes-3-llama-3.1-70b/endpoints),
and [Hermes 3 405B](https://openrouter.ai/api/v1/models/nousresearch/hermes-3-llama-3.1-405b/endpoints).
The curated lists and orphaned Hermes parameter metadata are removed; saved
settings are not rewritten. No automatic model substitution is made.

## Caching and curation

Fable 5.2 inherits the existing Anthropic request policy. Carbon, Ember and Hy4
use the native path without newly asserted cache lifetimes. Ember does not
inherit the five-minute Muse display estimate just by sharing its family name.
Advertised cache pricing is not evidence that a request reused a prompt.

Deferred coding-focused and batch arrivals. Ripple 65B Preview remains a
possible low-cost general option, but one of its three routes advertised a
131,072 context limit while the other two advertised 1,048,576; its distinct
editorial value is unverified.

## Validation

- Node 20.20.2 full test suite: **842 suites, 11,910 tests, and 59
  snapshots passed**. Six focused catalog, metadata, reasoning and cache
  suites also passed (96 tests).
- Core, webview and extension typechecks passed. Build and bundle sentinel
  passed; webpack reported three performance warnings.
- Lint passed with zero errors and 1,169 warnings. Comparing the changed
  TypeScript files to the previous commit found no new warnings.
- Catalog comparison found no duplicate or missing live base IDs, and the
  extension configuration defaults match the previous commit.

Extension Development Host selection, live inference, prose quality and cache
reuse require separate manual witnesses.
