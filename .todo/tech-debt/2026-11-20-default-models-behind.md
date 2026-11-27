# The Default Models Sit a Generation Behind, and Are Set in Three Places

**Date:** 2026-11-20
**Status:** Implemented on `sprint/highlights-default-models`.
**Priority:** Medium. Writers who never picked a model run on the defaults.
**Found by:** Okey

## Problem

### 1. The defaults are older than the curated list

| Setting | Default today | Newest in the curated list |
|---|---|---|
| `assistantModel` (also the Lightbox and Craft Flags, which follow it) | `anthropic/claude-sonnet-5` | `anthropic/claude-sonnet-5.5` |
| `widgetModel` | `anthropic/claude-sonnet-5` | `anthropic/claude-sonnet-5.5` |
| `dictionaryModel` | `anthropic/claude-haiku-4.5` | `anthropic/claude-haiku-5.5` (already Proofread's default) |
| `contextModel` | `openai/gpt-5.4` | `openai/gpt-6.2-sol` / `gpt-6.2-astra` |
| `proofreadModel` (the helper follows it) | `anthropic/claude-haiku-5.5` | current |
| `categoryModel` | `openai/gpt-oss-120b:nitro` | chosen for speed, not age (below) |

### 2. The defaults live in three places, and they already disagree

- **The manifest** (`apps/vscode-extension/package.json`,
  `contributes.configuration`): what VS Code reports for a setting the
  writer never changed.
- **The host's fallback** (`ModelScopeSelections.ts`):
  - `DEFAULT_SCOPE_MODEL` (`claude-sonnet-5`) for assistant, dictionary and
    context;
  - `DEFAULT_WIDGET_MODEL` and `DEFAULT_PROOFREAD_MODEL`.

  The manifest says Haiku 4.5 for the dictionary and GPT-5.4 for context,
  so where the fallback applies (a setting cleared to empty, a host without
  the manifest), those scopes get Sonnet 5 instead.
- **The webview's fallback** (`useModelsSettings.ts`, its default settings
  block). `DEFAULT_CATEGORY_MODEL` (`OpenRouterModels.ts`) is shared, the
  rest are copies.

## Fix

1. **One table.** A single `DEFAULT_MODEL_SELECTIONS`, keyed by
   `OwnModelScope`, in `shared/constants/`. The host's fallback and the
   webview's defaults both read it, and the separate constants go.
2. **A sync test holds the manifest's defaults to that table,** so the
   three can't drift again.
3. **The new defaults** (recommended):
   - **assistant and widget → `claude-sonnet-5.5`,** the newest Sonnet,
     which the curated list describes as the everyday prose model. The
     Lightbox and Craft Flags follow assistant, so they move too.
   - **dictionary → `claude-haiku-5.5`,** the same generation Proofread
     already uses, for many quick calls.
   - **context → `gpt-6.2-sol`,** the lower-cost GPT-6.2 tier, keeping an
     OpenAI model in the defaults. It always reasons, which costs some
     latency and reasoning tokens on each brief. The context assistant
     sends no reasoning setting, so nothing refuses it. The alternative is
     `claude-sonnet-5.5`.
   - **proofread:** unchanged.
   - **category: unchanged, `gpt-oss-120b:nitro`.** Category Search
     classifies hundreds of words per batch, and that model is chosen for
     throughput, not recency. The alternative is `claude-haiku-5.5`
     (adjustable reasoning).
4. **Check prices against the live catalog** when making the change. The
   curated list carries no prices, and a default should not quietly cost
   more.
5. **Say so in the changelog.** VS Code stores only settings the writer
   changed, so **everyone who never picked a model moves to the new
   default.** One line names each change ("If you never chose a model,
   the Assistant now uses Claude Sonnet 5.5").
6. **Regenerate the help tables**
   (`node apps/vscode-extension/scripts/generate-help-tables.js`), so
   `settings.md` shows the new defaults. `helpReferenceSync.test.ts` must
   pass.
7. **Update the tests that pin the old ids.** About a dozen do, mostly
   webview components and `useModelsSettings.test.ts`. Tests that use a
   model id only as a sample can keep theirs.

## Watch for

- **Models that always reason.** Sonnet 5.5 and GPT-6.2 Sol require reasoning according to the live catalog. On 2026-11-27 Okey chose to request reasoning in Craft Flags whenever its model supports it. Proofread and the helper retain their own policies.
- **`ModelParameterMetadata`** has labels for some models. Add one for any
  new default that lacks it.

## Implementation

The host's model resolver and `MODEL_DATA` fallback, plus the webview's
initial settings, use `DEFAULT_MODEL_SELECTIONS`. A test checks each
scope against the manifest, verifies that the pickers list every own default
and guards compatibility for the scopes that can request reasoning Off.
Explicit model choices take precedence, including overrides for following scopes.

OpenRouter's public catalog on 2026-11-27 listed the following base prices
in USD per million input and output tokens. Context's GPT-6.2 Sol always
reasons, so elapsed time and total token usage can change with each brief.
[OpenRouter catalog](https://openrouter.ai/api/v1/models)

| Scope | Model change | Previous → new input / output |
| --- | --- | --- |
| Assistant and Conversation Widgets | Sonnet 5 → Sonnet 5.5 | $2 / $10 → $2 / $10 |
| Dictionary | Haiku 4.5 → Haiku 5.5 | $1 / $5 → $0.10 / $0.50 |
| Context | GPT-5.4 → GPT-6.2 Sol | $2.50 / $15 → $2 / $10 |

Lightbox and Craft Flags follow the Assistant model unless the writer picks
their models separately. Craft Flags offers Light, Standard and Deep. A saved
Off setting reads as Standard. Sonnet 5.5 requires reasoning and accepts the
selected budget. Models the catalog identifies as lacking reasoning can still
run Craft Flags with the ordinary reply allowance.
Proofread and its helper still use Haiku 5.5. Category Search and its Passage
Search follower still use GPT-OSS 120B Nitro, which routes for throughput.
[OpenRouter catalog](https://openrouter.ai/api/v1/models) · [Nitro routing](https://openrouter.ai/docs/guides/routing/model-variants/nitro)

## Completion Criteria

- [x] One defaults table, read by the host and the webview. The old
      constants are gone.
- [x] A sync test holds the manifest's defaults to it.
- [x] The new defaults are in the manifest, prices checked, and the
      changelog says who moves.
- [x] The regenerated help tables pass `helpReferenceSync.test.ts`.
- [ ] Tests pinning the old defaults are updated; the full suite passes.

## Related Files

- `apps/vscode-extension/package.json` (`proseMinion.*Model` defaults)
- `packages/core/src/infrastructure/api/orchestration/ModelScopeSelections.ts`
- `packages/core/src/presentation/webview/hooks/domain/useModelsSettings.ts`
- `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts`
  (the curated lists)
- `packages/core/src/infrastructure/api/providers/ModelParameterMetadata.ts`
- `packages/core/src/shared/constants/defaultModelSelections.ts` (runtime defaults)
- `packages/core/resources/help/settings.md` (generated tables)
