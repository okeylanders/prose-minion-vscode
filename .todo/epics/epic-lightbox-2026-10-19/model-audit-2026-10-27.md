# Model catalog audit — October 27, 2026

**Status:** Implemented on `epic/lightbox`; automated verification below.
**Priority:** Medium
**Scope:** Refresh the shared curated models and Category Search directly on
the integration branch. No default changes, settings migrations, or paid calls.

## Evidence and baseline

Compared the current curated lists (last addition: Gemini 4 Argon, October 14)
with [OpenRouter's public catalog](https://openrouter.ai/api/v1/models), fetched
October 27, 2026. The response contained **464 records**, including routing,
batch, and free variants. Checked the six additions' serving endpoints and
the three missing curated IDs separately. HTTP 200 alone is insufficient:
the missing IDs return an empty endpoint list.

Before: **120 distinct curated IDs**, three missing from the live catalog.
After: **123 recommended IDs** and **74 Category Search IDs**, with no
duplicates or missing live base IDs (the existing `:nitro` choice resolves
against its base ID). All six additions are in both lists. This is advertised
availability and capability evidence; prose quality and successful inference
in the extension remain unverified.

## Additions

Prices are the catalog's dollars per million input/output tokens on the audit
date, not a promise about a selected serving endpoint or total call cost.
Output limits below are the catalog's top-provider limits; routes may differ.
Every addition advertises tools, structured outputs, and text output.

| Model / catalog creation date (UTC) | Context / output ceiling | Input / output price | Reasoning | Serving endpoints |
|---|---|---|---|---|
| [GPT-6.1 Terra](https://openrouter.ai/openai/gpt-6.1-terra) / Oct 26 | 1,050,000 / 128,000 | $1 / $5 | Optional; default medium | [4](https://openrouter.ai/api/v1/models/openai/gpt-6.1-terra/endpoints) |
| [GPT-6.1 Terra Pro](https://openrouter.ai/openai/gpt-6.1-terra-pro) / Oct 26 | 1,050,000 / 128,000 | $1 / $5 | Mandatory; default medium | [4](https://openrouter.ai/api/v1/models/openai/gpt-6.1-terra-pro/endpoints) |
| [Kimi K3.1 Pro](https://openrouter.ai/moonshotai/kimi-k3.1-pro) / Oct 23 | 1,048,576 / 943,718 | $2 / $10 | Optional; default max | [2](https://openrouter.ai/api/v1/models/moonshotai/kimi-k3.1-pro/endpoints) |
| [MiniMax M3.1 Flash](https://openrouter.ai/minimax/minimax-m3.1-flash) / Oct 19 | 1,048,576 / 524,288 | $0.15 / $0.60 | Mandatory; default max | [12](https://openrouter.ai/api/v1/models/minimax/minimax-m3.1-flash/endpoints) |
| [DeepSeek V4.1 Flash 1017](https://openrouter.ai/deepseek/deepseek-v4.1-flash-1017) / Oct 17 | 1,048,576 / 393,216 | $0.15 / $0.60 | Optional; default high | [36](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash-1017/endpoints) |
| [Mercury 3](https://openrouter.ai/inception/mercury-3) / Oct 16 | 1,000,000 / 131,072 | $0.10 / $0.35 | Optional; default medium | [1](https://openrouter.ai/api/v1/models/inception/mercury-3/endpoints) |

- Terra's rates double on input and rise to $7.50/M output at 272,000 prompt
  tokens. Pro uses the same underlying model and per-token price, but can
  consume substantially more output tokens. Batch variants are excluded.
- Terra / Terra Pro and Kimi do not advertise temperature control. Adding a
  picker entry does not introduce a temperature override or change reasoning
  policy. The existing live `reasoning.mandatory` guard covers Terra Pro and
  MiniMax when the writer chooses reasoning off in Draft Edit.
- DeepSeek's scheduled peak rates are $0.30/$1.20. Preserve the existing
  V4.1 Flash choice alongside this dated snapshot. Mercury 2.5 and Kimi K3
  likewise remain choices; no existing selection is redirected.
- Parameter counts remain undisclosed for the additions: no new architecture
  or parameter-count estimate was inferred from a family name.

## Removed unavailable choices

Each ID was absent from `/models` and had **zero** serving endpoints:

| Removed ID | Endpoint evidence | Decision |
|---|---|---|
| `deepseek/deepseek-r1` | [Empty endpoints](https://openrouter.ai/api/v1/models/deepseek/deepseek-r1/endpoints) | Remove the unavailable original. `deepseek/deepseek-r1-0528` remains live (three endpoints), but is a distinct older checkpoint, not a new release or an automatic replacement |
| `sao10k/l3.3-euryale-70b` | [Empty endpoints](https://openrouter.ai/api/v1/models/sao10k/l3.3-euryale-70b/endpoints) | Remove; do not silently downgrade to the live L3.1 checkpoint |
| `arcee-ai/trinity-large-thinking` | [Empty endpoints](https://openrouter.ai/api/v1/models/arcee-ai/trinity-large-thinking/endpoints) | Remove; no live Trinity replacement found |

Removed their orphaned parameter-count metadata and the two obsolete model
recommendation sections. Saved settings are not rewritten by this refresh.

## Other arrivals reviewed and deferred

These are curation judgments based on the catalog descriptions, not model
quality findings. They remain usable through custom model IDs where supported.

- `meta/muse-spark-open`: specifically optimized for coding agents; not an
  editorial successor to the existing Muse Spark choices. Six live endpoints
  confirmed. Do not extend Muse's estimated cache window by name alone.
- `reflection/beam-1.0-501b-a23b`: coding and long-horizon agent specialist;
  five live endpoints confirmed. Revisit after evidence of editorial value.
- `nvidia/nemotron-3.5-super-vl`: visual/document/GUI-oriented; nine endpoints
  confirmed. The catalog's top provider has 262,144 context despite the model
  record's 1,048,576. Defer paid and free variants from this prose refresh.
- `elorian/glimpse`: visual and physical-world reasoning specialist.
- `moondream/moondream3-preview` and `moondream/moondream3.1-9b-a2b`:
  vision/OCR specialists with 32,000 context and 4,096 output ceiling.
- `prism-ml/ternary-bonsai-2-9b`: compact efficiency-oriented model; no
  demonstrated benefit over the existing low-cost prose choices.
- `unbiased/pareto-26.10`: composite research/coding/agent model without
  advertised structured-output support; defer pending a focused use case.
- `recursive/flint-v1.0:free` and `xingchen-agi/xing4.0-29b-a4b:free`:
  coding-focused free arrivals; leave out of the curated prose list.
- Terra's two `:batch` variants: batch transport is outside the interactive
  pickers' contract.

## Cache behavior

No production cache-policy change. Terra inherits the established GPT-5.6+
native policy and its 30-minute display estimate. Its endpoints advertise
cache-read/write prices while `supports_implicit_caching` is false; this
contradiction does not justify disabling native behavior or claiming reuse.
Kimi, MiniMax, DeepSeek 1017, and Mercury keep native messages without
explicit cache hints or a newly asserted cache lifetime. Advertised cached
pricing is not evidence that any request reused a prompt. No paid probes ran.

## Changed files and completion criteria

- `OpenRouterModels.ts`: shared recommended list and Category Search list.
- Extension `package.json`: Category Search enum kept in sync.
- `ModelParameterMetadata.ts`: remove metadata for unavailable choices.
- `docs/RECOMMENDED_MODELS.md`: new options, current prices, and removals.
- Existing widget/catalog, parameter metadata, and cache-policy tests updated.

Completion requires duplicate-free lists, no missing live base IDs, unchanged
defaults, passing catalog/metadata/cache tests, typechecks, lint, and build.
Extension Development Host selection and provider response/prose quality are
separate manual checks, not implied by these automated checks.

### Verification

- Live catalog and endpoint assertions: **passed**. All configuration defaults
  compared with `HEAD` are unchanged; Category Search enum membership matches
  its TypeScript list; no duplicate or missing live base IDs; all six additions
  have serving endpoints and advertise text output, tools and structured
  outputs; all three removed IDs are absent and have empty endpoints.
- Six focused suites: **92 tests passed** (Category Search and widget catalog
  sync, parameter metadata, cache policy, live context window and reasoning).
- `npm run typecheck`: **passed** for core, webview and extension.
- `npm run lint`: **passed**, zero errors and 1,130 warnings. Comparing the
  five changed TypeScript files against `HEAD` found no new diagnostics;
  those files' warning count fell from 58 to 55 with the retired metadata.
- `npm run build`: **passed**, including the bundle sentinel check. Webpack
  reported its three asset/entrypoint-size and performance warnings.
- Full `npm test -- --runInBand`: **585 suites passed, one failed**;
  **8,302 tests passed, three failed**; **59 snapshots passed**.
  The three failures are the unchanged N-01 overflow witness in
  `LightboxMisnestedMemberEdges.test.ts`. On Node **v26.1.0**, serialization
  succeeds at the fixture's 20,000-level nesting depth, contradicting its
  assumption about Node 18/22 stack overflow. Reproduced using Node alone,
  independently of the model code. Tracked in
  [the runtime-portability follow-up](../../tech-debt/2026-10-27-lightbox-json-overflow-witness-node26.md);
  no parser or fixture behavior changed in this refresh.
- `git diff --check`: **passed**. No paid inference, Extension Development
  Host smoke test, packaging, commit, push, or publication performed.

Local command logs are `/private/tmp/prose-model-audit-20261027-*.log`;
the public catalog and endpoint snapshots used for the assertions are
`/private/tmp/prose-model-audit-20261027.json` and
`/private/tmp/prose-model-endpoints-20261027.json`. These temporary files are
local evidence; the tables and source links above preserve the findings here.
