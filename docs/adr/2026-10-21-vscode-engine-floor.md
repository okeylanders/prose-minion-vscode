# ADR 2026-10-21: VS Code Engine Floor 1.82 (Chromium 114)

**Status:** Accepted (2026-10-21)
**Date:** 2026-10-21
**Epic:** [Lightbox](../../.todo/epics/epic-lightbox-2026-10-19/README.md)
**Resolves:** [Webview CSS uses features above the declared Chromium 102 floor](../../.todo/archive/tech-debt/2026-10-21-webview-css-above-chromium-102.md)
**Related:** [PR #156 review, F-04](../pr-reviews/pr-156-lightbox-story-lenses-review.md)

## Context

`apps/vscode-extension/package.json` declared `engines.vscode: ^1.75.0`.
VS Code 1.75 runs Electron 19.1.9, which is Chromium 102 (sources in the
PR #156 review, F-04). The webview CSS floor guard added for F-04
(`packages/core/src/__tests__/architecture/webviewCssFloor.test.ts`) found
these uses newer than Chromium 102 already in the stylesheets. First Chrome
versions are from MDN browser-compat-data 6.1.5.

| Feature (first Chrome) | Uses |
|---|---|
| `color-mix()` (111) | 99, including the theme tokens in `index.css` |
| `text-wrap: pretty` (117; the `text-wrap` property is 114) | 4, `styles/workshop/context.css` |
| `scrollbar-width` / `scrollbar-color` (121) | 4, the Lexical Gravity widget sheet |
| `@container` (105) | 1, `index.css` |
| `translate` property (104) | 2, the Workshop schematic's keyframes |

`color-mix()` is the one that breaks things. A custom property whose value
is an unsupported `color-mix()` becomes invalid where it is used, so the
surfaces and borders drawn from the theme tokens would probably lose their
colors on Chromium older than 111. This was inferred from the CSS rules,
not seen in an old VS Code.

The Electron and Chromium in the stable VS Code releases that matter:

| VS Code | Electron | Chromium | Source |
|---|---|---|---|
| 1.75 (January 2023) | 19.1.9 | 102 | PR #156 review, F-04 |
| 1.78 (April 2023) | 22 | 108.0.5359.215 | <https://code.visualstudio.com/updates/v1_78> |
| 1.82 (August 2023) | 25 | 114.0.5735.289 | <https://code.visualstudio.com/updates/v1_82> |
| 1.86 (January 2024) | 27 | 118.0.5993.159 | <https://code.visualstudio.com/updates/v1_86> |

- The 1.82 notes' "Electron 25 update" says that milestone promotes
  Electron 25 to stable users, with Chromium 114.0.5735.289 and Node.js
  18.15.0. Earlier stable releases were not on Electron 25. Electron
  [23](https://releases.electronjs.org/release/v23.0.0) and
  [24](https://releases.electronjs.org/release/v24.0.0) ship Chromium 110 and
  112, so no release before 1.82 reached 114.
- Electron's release pages agree that Electron 25 is Chromium 114.
  [25.0.0](https://releases.electronjs.org/release/v25.0.0) shipped
  114.0.5735.45, and [25.8.0](https://releases.electronjs.org/release/v25.8.0)
  ships 114.0.5735.289.
- The sources agree, so no tie-break was needed. They were read on
  2026-10-21 through web-search excerpts of these official pages, because
  the build environment could not fetch them directly.

On the host side, typechecking the extension against `@types/vscode` 1.82.0
reports four errors. Each passes a `Thenable` where a `PromiseLike` is
expected, which the older file's `Thenable` declaration does not allow.
There are no other errors, so the extension calls no VS Code API newer
than 1.82.

## Decision

The writer chose to raise the floor rather than keep VS Code 1.75 and add
fallbacks.

- `engines.vscode` is `^1.82.0`, the first stable VS Code whose Electron
  ships Chromium 114 or later. That covers `color-mix()`, `@container`, the
  `translate` property and the `text-wrap` property with one of `wrap`,
  `nowrap` and `balance`. Its two-value shorthand and `auto` are Chrome
  130's grammar, and the guard counts them (PR #158 N-01).
- The guard pins `^1.82.0` and sets `FLOOR_CHROME = 114`. Its feature list
  keeps only features above 114.
- Its `KNOWN` ratchet may hold only features in its `GRACEFUL` list, ones
  Chromium 114 drops without breaking the page.

## Consequences

- **Older VS Code.** Writers on VS Code 1.75 to 1.81 cannot install this
  release or any later one. VS Code checks `engines.vscode` before it
  installs or updates an extension from the Marketplace, so they keep the
  last release that declared `^1.75.0` until they update VS Code.
- **What the CSS may use.** Webview CSS may now use features up to Chrome
  114 without a fallback, among them `color-mix()`, `:has()` and container
  queries.
- **Still guarded.** `subgrid` (117) stays guarded, so the Lightbox
  ribbon's plain grid stays as it is. CSS nesting also stays guarded
  (fully supported from Chrome 120; 112 to 119 do not parse a nested rule
  that starts with a type selector).
- **Host runtime.** The extension host's floor is Node.js 18.15.0, which
  VS Code 1.82 ships.
- **`@types/vscode`.** It stays declared at `^1.75.0`. vsce requires the
  declared types version to be at or below `engines.vscode`, and 1.75 is.

### Remaining graceful exceptions

| Feature (first Chrome) | Uses | On Chromium 114 |
|---|---|---|
| `scrollbar-width` / `scrollbar-color` (121) | 4, the Lexical Gravity widget sheet | Ignored; Chromium 114 to 120 style the scrollbars by the sheet's own `::-webkit-scrollbar` rules |
| `text-wrap: pretty` (117) | 4, `styles/workshop/context.css` | Ignored; Chromium 114 to 116 wrap lines as usual |

Neither is worth a higher floor. The guard still counts them per file, so
any new use fails its ratchet.
