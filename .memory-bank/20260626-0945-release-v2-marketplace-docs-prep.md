# Release v2.0 Marketplace Docs Prep

Date: 2026-06-26
Branch: `release/2.0-prep`
Feature commits:

- `e5215b9 Add output shortcut and streaming stats`
- `7827d46 Add model browser selector`
- `8dd7d76 Track model browser feature notes`
- `3923f77 Update All Tools Modal descriptions to match actual prompt behavior`

## What Just Landed

- Added the Prose Minion title-bar debug/output action:
  - `prose-minion.showOutputChannel`
  - `$(bug)` icon
  - visible on `prose-minion.toolsView`
  - placed immediately before the settings gear
  - reveals the existing `Prose Minion` Output channel via `outputChannel.show(true)`
- Added live AI streaming stats:
  - chunk count, elapsed time, first-chunk latency, and average chunks/sec
  - renamed the user-facing streaming counter from exact "tokens" to honest "chunks"
  - shared across analysis, context, and standard dictionary streaming
  - formatter and hook coverage added
- Added the Model Browser selector:
  - model selectors now open a searchable modal instead of a flat dropdown
  - users can browse by provider or family
  - cards show curated descriptions plus live OpenRouter pricing, release dates, and context windows
  - selection still flows through the existing scoped model-setting path
- Updated All Tools Modal copy:
  - audited all 16 writing-tool cards against their prompts
  - corrected misleading summaries for Gestures, Decision Points, Style, and Editor
- Refreshed the v2 model catalog:
  - added GLM 5.2 and Qwen3.7 Plus
  - moved Category Search from Mistral Large 2411 to Mistral Large 2512
  - removed/deprioritized stale or lower-priority recommendations

Validation performed before commit:

- `npm run typecheck`
- `npm test` -> 50 suites / 392 tests
- `npm run build`
- `npm run lint` -> 0 errors, existing warnings only

After the commit, `npm run package` was also run. It passed typecheck, tests, production build,
bundle verification, and created:

- `apps/vscode-extension/prose-minion-2.0.0.vsix`

That VSIX is ignored by `.vscodeignore` / git status and is not committed.

After the docs/icon pass, `npm run package` was run again:

- typecheck passed
- Jest passed: 50 suites / 392 tests
- production build passed with the existing webpack size warnings
- bundle verification passed
- generated VSIX includes `assets/frame-minion-icon.png`
- generated VSIX excludes stale `assets/pixel-minion-icon.png`
- generated VSIX size: 9.45 MB

## Marketplace Packaging Finding

The monorepo packaging root is `apps/vscode-extension`, not the repository root.

Evidence:

- root `package.json` delegates `npm run package` to `npm run package -w apps/vscode-extension`
- `apps/vscode-extension/package.json` runs `vsce package --no-dependencies`
- the generated VSIX included:
  - `extension/README.md`
  - `extension/CHANGELOG.md`
  - `extension/package.json`
  - `extension/assets/`
  - `extension/dist/`
  - `extension/resources/`
- the generated VSIX did not include:
  - root `screenshots/`
  - root `docs/`
  - root `docs/CHANGELOG-DETAILED.md`
  - root README/docs

Conclusion: marketplace-facing docs come from `apps/vscode-extension`, and relative links inside
that README/CHANGELOG are resolved against that packaged extension root. Current references to
`screenshots/...` and `docs/...` are likely broken in the Marketplace after the monorepo move.

## Known Marketplace Link Problems

`apps/vscode-extension/README.md` currently references root-level files that are not packaged:

- `screenshots/screenshot-click-to-open-settings.png`
- `screenshots/screenshot-set-openrouter-api-key.png`
- `screenshots/screenshot-settings-models.png`
- `screenshots/screenshot-ai-model-controls.png`
- `screenshots/screenshot-assistant-dialogue-analysis.png`
- `screenshots/screenshot-search-word-search.png`
- `screenshots/screenshot-search-category-search.png`
- `screenshots/screenshot-metrics-word-frequency.png`
- `screenshots/screenshot-metrics-prose-statistics.png`
- `screenshots/screenshot-metrics-style-flags.png`
- `screenshots/screenshot-dictionary-entry.png`
- `screenshots/screenshot-settings-pane.png`
- `docs/user-guides/dictionary-lookup-phrase-and-alternatives/README.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONFIGURATION.md`
- `docs/TOOLS.md`
- `docs/PROSE_STATS.md`

Additional wrinkle:

- `README.md` hero image uses `assets/prose-minion-book-animated.gif`.
- `apps/vscode-extension/.vscodeignore` excludes `assets/prose-minion-book-animated.gif`.
- Therefore the README hero image is also not in the generated VSIX.

`apps/vscode-extension/CHANGELOG.md` currently links to:

- `docs/CHANGELOG-DETAILED.md`

That file is not packaged because root `docs/` is outside the VSCE package root.

## Recommended Fix Strategy

For Marketplace presentation, use one of these patterns consistently:

1. Copy Marketplace images/docs into `apps/vscode-extension` and make sure `.vscodeignore` does
   not exclude them.
2. Or rewrite README/CHANGELOG links to absolute GitHub URLs that point at the release tag.

Recommendation:

- For screenshots, prefer copying a curated subset into `apps/vscode-extension/media/` or
  `apps/vscode-extension/screenshots/` so Marketplace rendering does not depend on branch URLs.
- For developer docs, prefer absolute GitHub links. They are not needed inside the VSIX and do
  not need to bloat the extension package.
- For the README hero, either:
  - stop excluding `assets/prose-minion-book-animated.gif`, or
  - switch the hero to a shipped asset like `assets/prose-minion-book.png`, or
  - use an absolute GitHub raw URL.

Decision taken in the docs pass:

- Keep screenshots out of the VSIX and use `raw.githubusercontent.com` links in the Marketplace README.
- Use normal GitHub `blob/main` links for repo docs.
- Switch the README hero to shipped `assets/prose-minion-book.png`.
- Replace the sister-extension callout with FrameMinion:
  - site: `https://frameminion.video`
  - Marketplace: `https://marketplace.visualstudio.com/items?itemName=OkeyLanders.frame-minion`
  - icon copied from FrameMinion into `apps/vscode-extension/assets/frame-minion-icon.png`
  - old unreferenced `assets/pixel-minion-icon.png` excluded from the VSIX

## Marketplace-Facing Docs To Update For v2.0

Required:

- `apps/vscode-extension/README.md`
  - Added a new top `What's New in v2.0.0` section.
  - Mentioned model browser, account balance widget, theme refresh, debug/output title-bar action, streaming progress stats, final v2 model-catalog refresh, and FrameMinion.
  - Replaced `screenshots/...` image links with GitHub raw URLs.
  - Replaced `docs/...` links with GitHub blob URLs or removed dead links.
- `apps/vscode-extension/CHANGELOG.md`
  - Added `## [2.0.0] - 2026-06-26`.
  - Kept this Marketplace-friendly: concise user-facing changes plus a short technical section.
  - Fixed the top detailed changelog link because `docs/CHANGELOG-DETAILED.md` is not packaged.
- `docs/CHANGELOG-DETAILED.md`
  - Updated the top detailed `2.0.0` entry covering:
    - monorepo ports-and-adapters migration
    - composition-root consolidation
    - React 18 / webview facelift
    - account balance widget
    - model browser
    - debug/output command
    - streaming stats
    - model-catalog refresh
    - packaging/docs link fix
    - final validation commands

## Model Catalog Changes Included

The v2 model refresh landed in:

- `packages/core/src/infrastructure/api/providers/OpenRouterModels.ts`

Capture these in the v2 release notes/changelogs:

- Added `z-ai/glm-5.2` to recommended models and category-search models.
  - User-facing angle: latest GLM flagship, 1M context, stronger long-horizon reasoning for manuscript-scale critique and structured category matching.
- Added `qwen/qwen3.7-plus` to recommended models.
  - User-facing angle: lower-cost Qwen3.7 sibling with 1M context; good value for long-context prose analysis, dictionary rewrites, and structured edits.
- Updated Category Search's Mistral option from `mistralai/mistral-large-2411` to `mistralai/mistral-large-2512`.
  - User-facing angle: newer Mistral Large with improved reasoning/instruction following.
- Removed/deprioritized stale or lower-priority recommendations:
  - `deepseek/deepseek-v3.2-speciale`
  - `mistralai/mistral-large-2411`
  - `arcee-ai/maestro-reasoning`

Release follow-up:

- `apps/vscode-extension/package.json` `proseMinion.categoryModel.enum` was synced with `CATEGORY_MODELS` before committing the model refresh.
- Update `docs/RECOMMENDED_MODELS.md` if it is still part of the release-facing docs set.
- Mention the model refresh in README `What's New`, Marketplace changelog, and detailed changelog.
- Updated `docs/RECOMMENDED_MODELS.md` with GLM 5.2, Qwen3.7 Plus, and Mistral Large 2512.

Optional but likely useful:

- `docs/RECOMMENDED_MODELS.md` if v2.0 changes model recommendations or defaults.
- `screenshots/README.md` if screenshots are refreshed or moved.
- release checklist / publish notes if the repo has a VSCE flow document.

## Remaining Release Checklist

- Decide screenshot strategy: package curated screenshots under `apps/vscode-extension`, or use
  release-tagged absolute GitHub URLs. **Done:** use GitHub raw URLs.
- Refresh screenshots if the v2.0 facelift materially changed the UI.
- Fix README hero image packaging. **Done:** switched to shipped PNG.
- Update README `What's New` to v2.0.0. **Done.**
- Update Marketplace changelog. **Done.**
- Update detailed changelog. **Done.**
- Update recommended models guide. **Done.**
- Re-run `npm run package` and inspect VSIX file list. **Done.**
- Verify the packaged README renders with working images/links before publishing. **Partially done:** package file list is correct; Marketplace preview still needs a human visual check.
- Publish from `apps/vscode-extension` package output only after docs and smoke checks are clean.
