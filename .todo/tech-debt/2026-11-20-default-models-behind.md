# The Default Models Sit a Generation Behind, and Are Set in Three Places

**Date:** 2026-11-20
**Status:** Open. A small chore that can fold into any release.
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

- **Models that always reason.** Proofread, Craft Flags and the helper
  refuse to send `off` to such a model, or give it a budget. None of the
  recommended defaults for those scopes always reasons; `gpt-6.2-sol` goes
  only to context, which sends no reasoning setting. A test can hold that
  line: no default for a scope that sends a reasoning level may be a model
  the curated list marks as always reasoning.
- **`ModelParameterMetadata`** has labels for some models. Add one for any
  new default that lacks it.

## Completion Criteria

- [ ] One defaults table, read by the host and the webview; the old
      constants are gone.
- [ ] A sync test holds the manifest's defaults to it.
- [ ] The new defaults are in the manifest, prices checked, and the
      changelog says who moves.
- [ ] Help tables regenerated; `helpReferenceSync.test.ts` passes.
- [ ] Tests pinning the old defaults are updated; the full suite passes.

## Related Files

- `apps/vscode-extension/package.json` (`proseMinion.*Model` defaults)
- `packages/core/src/infrastructure/api/orchestration/ModelScopeSelections.ts`
- `packages/core/src/presentation/webview/hooks/domain/useModelsSettings.ts`
- `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts`
  (`DEFAULT_CATEGORY_MODEL`, the curated lists)
- `packages/core/src/infrastructure/api/providers/ModelParameterMetadata.ts`
- `packages/core/resources/help/settings.md` (generated tables)
