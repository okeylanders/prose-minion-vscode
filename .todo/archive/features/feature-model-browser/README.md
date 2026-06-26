# Feature: Model Browser (replaces the model dropdown)

**Status:** Archived / released
**Released In:** 2.0.0 (Marketplace, 2026-06-25)
**Archived:** 2026-06-26
**Captured:** 2026-06-25
**Priority:** Pre-release nice-to-have (small, additive)
**Owner:** TBD

## Motivation

The curated model list is now **82 models across 17 providers** (see
[OpenRouterModels.ts](../../../../packages/core/src/infrastructure/api/providers/OpenRouterModels.ts)).
That is well past the point where a flat `<select>` dropdown
([ModelSelector.tsx](../../../../packages/core/src/presentation/webview/components/shared/ModelSelector.tsx))
is a good browsing experience. Users can't see **cost**, **context window**, or the **full
description** we already author — they just see a name.

A **Model Browser** modal — designed to mirror the existing
[AllToolsModal.tsx](../../../../packages/core/src/presentation/webview/components/tabs/AllToolsModal.tsx)
("Writing Tools" picker) — gives those fields a home: a searchable, tabbed gallery of model
cards. The dropdown can stay as the compact inline control; the browser is the "see everything"
affordance behind it (same relationship the Assistant tab has with AllToolsModal today).

## UX — mirror AllToolsModal, add search + tabs

Reuse the established `tm-*` design language (`tm-backdrop`, `tm`, `tm-head`, `tm-grid`,
`tm-card`, `tm-ic`, `tm-n`, `tm-d`) and Escape-to-close behavior from `AllToolsModal`. Differences:

- **Search bar** in the header — filters by name, id, provider, family, and description text.
- **Tabs** — two pivots the user asked for:
  - **By Provider** (17): OpenAI, Anthropic, Qwen, Z.AI, Google, DeepSeek, Moonshot, Mistral,
    xAI, TheDrummer, InclusionAI, Nous Research, Arcee, StepFun, Sao10K, DeepCogito, Aion Labs.
    Trivially derived: `id.split('/')[0]`.
  - **By Family** (finer than provider — e.g. *Claude Opus*, *GPT-5.2*, *GLM 5*, *Gemini 3.1*).
    **Requires a curated `family` field** (see Data Contract) — it cannot be reliably parsed from
    the id (`gpt-5.2-codex` doesn't tell a regex whether the family is "GPT-5.2" or "Codex").
- **Card content** per model: name, **family** + **release date** badges, **price** (in/out per
  1M), **context window**, and the **full description** (cards already show a one-line `tm-d`;
  here we show the complete blurb, possibly clamped with expand-on-hover/click).
- Selecting a card sets the active model for the current scope (assistant / dictionary / context),
  same as the dropdown does today.

## Data Contract — curated ⨝ live

Pricing and context are **not** in the curated arrays today; they live only in the live
OpenRouter `/models` response. The browser is therefore a **join on `id`**:

| Field | Source | Notes |
| --- | --- | --- |
| `id` | curated | join key |
| `name` | curated | display name |
| `description` | curated | our authored editorial blurb (full text shown in browser) |
| **`family`** | **curated (NEW)** | drives the Family tab; e.g. `'Claude Opus'`, `'GLM 5'`, `'GPT-5.2'`. The ONLY genuinely-new curated field — no clean API equivalent. |
| **`releaseDate`** | **live API (derived)** | derive from the API's `created` unix timestamp — see note below. NOT hand-curated. |
| `provider` | derived | `id.split('/')[0]` — no stored field needed |
| **`pricing.prompt` / `pricing.completion`** | **live API** | realtime; never cache as ground truth |
| **`context_length`** | **live API** | **cache-on-display, refresh-on-select** (see below) |
| `knowledge_cutoff` | live API (optional) | nice card detail when present (e.g. `2025-12-01`) |
| `expiration_date` | live API (optional) | **audit signal** — a set expiration means OpenRouter is deprecating it; surface in the browser and/or a future automated audit |

### Release date is free — derive it, don't curate it

The OpenRouter `/models` response includes a **`created`** unix timestamp per model, and it's
accurate (`z-ai/glm-5.2` → 2026-06-16; `anthropic/claude-opus-4.1` → 2025-08-05, matching its
real release). So `releaseDate` belongs in the **same bucket as pricing/context — derived live
and cached on display — not hand-entered.** This avoids 82 hand-typed dates that would rot and
be less accurate than the source of truth. The catalog also exposes `knowledge_cutoff` and
`expiration_date`, both worth showing on the card.

New curated shape (additive — extend the existing object literals):

```ts
{
  id: 'z-ai/glm-5.2',
  name: 'GLM 5.2',
  family: 'GLM 5',
  releaseDate: '2026-05',           // ISO; month precision is fine
  description: '…full blurb…'
}
```

### Caching strategy (per Okey)

- **Pricing → realtime, always.** Volatile and the thing users most need to trust. Pull from the
  live `/models` fetch each time the browser opens. Never persist a price as authoritative.
- **Context window → cache in the list, refresh on select.** `context_length` is stable enough to
  show a cached value while browsing (fast render, no spinner per card), then re-fetch the
  authoritative value for the **one** model the user actually selects. This avoids 82 live lookups
  to paint the grid while keeping the committed choice accurate.

### Failure mode to handle explicitly

`OpenRouterModels.fetchModels()` already has a fallback path that returns `pricing: { prompt:
'0', completion: '0' }` when the API is unreachable. **The browser must not render "$0.00" as a
real price.** Show "pricing unavailable" / a dashed placeholder when the live join misses or the
fallback fires.

## Loading & sync flow (one call, not 82)

`OpenRouterModels.fetchModels()` already pulls the **entire** `/models` catalog (~339 models,
~500KB) in a **single GET** and caches it statically for the session. The browser reuses this:

```text
open → fetchModels() [1 call, then cached]  → Map<id, liveData> in memory
     → join CURATED(82) ⨝ Map on id          [pure in-memory map, no network]
     → render grid                            [instant]
select → optional clearCache()+refetch        [commit against fresh pricing/context]
```

- **No per-model sync, no N+1.** We pull the full catalog once and filter/join our 82 against
  that in-memory object. The endpoint has no per-id filter, so one fat GET is simplest.
- **`/models` is public** — no API key needed to populate the browser; no secret handling here.
- **Refresh-on-select is nearly free** — the catalog is already cached, so it's an *optional*
  cache-bust for a long-open browser, mostly relevant to pricing (context is stable).
- Cost is the first ~500KB fetch per session — which already happens today for the dropdown.

## Open question: the two curated lists

There are two arrays serving different scopes:

- `RECOMMENDED_MODELS` (~82) — the Prose Excerpt Assistant list.
- `CATEGORY_MODELS` (smaller, non-thinking) — for Category Search's predictable token usage.

The browser must be explicit about **which list it edits/shows**. Two options:

1. **Short term (this feature):** the browser targets one scope at a time (it's opened from a
   specific model selector, so it already knows the scope). Keep the two arrays as-is.
2. **Long term (tech-debt, NOT this PR):** unify into a single source of truth with a
   `tags: ('recommended' | 'category')[]` field and let the browser filter. Cleaner, but a bigger
   change than a pre-release add — track separately.

## Implementation sketch (touch points)

- **Data:** add `family` + `releaseDate` to all entries in
  [OpenRouterModels.ts](../../../../packages/core/src/infrastructure/api/providers/OpenRouterModels.ts)
  (both arrays). Extend the curated TS type to include the two new optional-then-required fields.
- **Component:** new `ModelBrowserModal.tsx` under
  [components/tabs/](../../../../packages/core/src/presentation/webview/components/tabs/) (or `shared/`),
  cloned from `AllToolsModal` structure; add search state + tab state.
- **Data hook:** extend
  [useModelsSettings.ts](../../../../packages/core/src/presentation/webview/hooks/domain/useModelsSettings.ts)
  to expose the joined model rows (curated ⨝ live pricing/context) and the realtime/refresh logic.
- **Entry point:** an "browse all" affordance next to `ModelSelector` (button/icon), opening the
  modal; selection routes through the existing `SET_MODEL_SELECTION` message.
- **Reuse:** the live fetch already exists (`OpenRouterModels.fetchModels()` + cache). No new
  backend service required for v1.

## Out of scope (v1)

- Unifying `RECOMMENDED_MODELS` / `CATEGORY_MODELS` (tech-debt note instead).
- Favorites / recently-used / per-project pinning.
- Live "is this model up right now" health checks beyond the existing fetch.
- Sorting controls beyond newest-first + the search filter (can add later).

## Decisions locked (2026-06-25)

- ✅ **DONE** — curated **`family`** field added to all 82 entries (both arrays), minor-version
  grouping for OpenAI (GPT-5.1/5.2/5.3/5.4/5.5). 36 distinct families. Typecheck clean.
- ✅ **`releaseDate`**: confirmed — **derive live from API `created`** (accurate + zero
  hand-maintenance), cached on display. Not stored in the curated file.
- ✅ Cost/context retrieved **realtime**; context **cached in list, refreshed on select**.
  Release date rides the same live/cache path.
- ✅ Browser **mirrors AllToolsModal** design language.
- ➕ Bonus from the catalog: `knowledge_cutoff` (card detail) and `expiration_date`
  (deprecation/audit signal).

## Related

- Mirror target: [AllToolsModal.tsx](../../../../packages/core/src/presentation/webview/components/tabs/AllToolsModal.tsx)
- Replaces/augments: [ModelSelector.tsx](../../../../packages/core/src/presentation/webview/components/shared/ModelSelector.tsx)
- Data source: [OpenRouterModels.ts](../../../../packages/core/src/infrastructure/api/providers/OpenRouterModels.ts)
- State: [useModelsSettings.ts](../../../../packages/core/src/presentation/webview/hooks/domain/useModelsSettings.ts)
