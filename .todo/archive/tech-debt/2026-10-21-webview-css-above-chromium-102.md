# Webview CSS Uses Features Above the Declared Chromium 102 Floor

**Date Identified**: 2026-10-21 (PR #156 F-04 follow-up)
**Reviewed**: 2026-10-21
**Status**: Resolved 2026-10-21: the writer raised the floor to VS Code 1.82 (Chromium 114), [ADR 2026-10-21](../../../docs/adr/2026-10-21-vscode-engine-floor.md)
**Priority**: Was Medium; resolved
**Estimated Effort**: Medium (a floor decision, then either fallbacks or a raised `engines.vscode`)

## Problem

`apps/vscode-extension/package.json` declares `engines.vscode: ^1.75.0`.
VS Code 1.75 runs Electron 19.1.9, which is Chromium 102. The Slice 2A notes
name Chromium 102 as the engine floor, and PR #156 F-04 held the Lightbox
ribbon to it.

The webview stylesheets already used several features newer than Chromium
102 before that review. These are the uses the new guard
(`packages/core/src/__tests__/architecture/webviewCssFloor.test.ts`) found,
with each feature's first Chrome version from MDN browser-compat-data 6.1.5:

| Feature (Chrome) | Uses | Where |
|---|---|---|
| `color-mix()` (111) | 99 | `index.css` (18, among them the theme tokens `--pm-surface`, `--pm-surface-2`, `--pm-inset`, `--pm-border`, `--pm-border-2` and the primary button tokens), `styles/workshop/shell.css` (33), `styles/workshop/context.css` (25), `styles/workshop/session.css` (5), `styles/fulltab/shell.css` (5), `styles/fulltab/modal.css` (2), `styles/lightbox/board.css` (2), `styles/lightbox/tiles.css` (2), `styles/lightbox/readings.css` (1), and the Creative Variations, Gesture Playground and Show vs. Tell widget sheets (2 each) |
| `text-wrap` (114) | 4 | `styles/workshop/context.css` |
| `scrollbar-width` / `scrollbar-color` (121) | 4 | the Lexical Gravity widget sheet |
| `@container` (105) | 1 | `index.css` |
| `translate` property (104) | 2 | the Workshop schematic's keyframes |

Most degrade gracefully on Chromium 102: `text-wrap` and the scrollbar
properties are ignored, the `@container` rule does not apply, and the
schematic's drift animation does not move.

`color-mix()` is the serious one. A custom property whose value is a
`color-mix()` is accepted as written, then becomes invalid where it is used,
so properties drawn from the theme tokens fall back to their initial values
(a transparent surface, for example). On VS Code builds older than Chrome
111's runtime, the Workshop's and the Lightbox's surfaces and borders
probably lose their colors. This has not been seen in a Chromium 102
browser or an old VS Code; it follows from the CSS rules and the versions
above.

## Recommendation

Decide the floor first; that is the writer's decision.

- **Keep VS Code 1.75.** Give each `color-mix()` token a plain fallback
  declared before it (a precomputed color, overridden where `color-mix()`
  is supported), or compute the mixed colors at build time. Leave the
  degrading features as they are, or add `@supports` fallbacks for the ones
  that matter.
- **Raise the floor.** Set `engines.vscode` to the first VS Code release
  whose Electron ships the needed Chromium. Update the README's support
  statement, the Slice 2A note, and the guard's `FLOOR_CHROME`, `FEATURES`
  and `KNOWN` together.

Either way, the guard's `KNOWN` inventory shrinks to match, and it keeps new
uses out meanwhile.

## Related Files

- `packages/core/src/__tests__/architecture/webviewCssFloor.test.ts` (the
  guard and its `KNOWN` inventory)
- `apps/vscode-extension/package.json` (`engines.vscode`)
- `apps/vscode-extension/README.md` (the supported VS Code versions)
- `packages/core/src/presentation/webview/index.css` (the theme tokens)
- `.todo/epics/epic-lightbox-2026-10-19/slice-2a-tab-and-counted-board.md`
  (the floor note)
- [PR #156 review](../../../docs/pr-reviews/pr-156-lightbox-story-lenses-review.md)
  (F-04)

## Completion Criteria

- The floor is decided and stated in one place that the guard reads or pins.
- Every remaining use above the floor has a fallback, or the floor is
  raised above it, and the guard's `KNOWN` inventory is empty or explains
  each entry left.

## Resolution

Resolved on 2026-10-21 (`epic/lightbox-vscode-floor`). The writer chose to
raise the floor rather than add fallbacks;
[ADR 2026-10-21](../../../docs/adr/2026-10-21-vscode-engine-floor.md) records
the decision and its sources.

- **The floor.** `engines.vscode` is `^1.82.0`. VS Code 1.82 is the first
  stable release on Electron 25, which ships Chromium 114 (the 1.82 release
  notes name Chromium 114.0.5735.289). This covers `color-mix()`,
  `@container` and the `translate` property.
- **The guard.** `webviewCssFloor.test.ts` pins `^1.82.0` and sets
  `FLOOR_CHROME = 114`. Features at or below 114 left its list. CSS nesting
  stays, at 120: MDN lists 112 to 119 as partial (no nested rule that starts
  with a type selector).
- **A correction.** The four `text-wrap` uses in the table above are
  `text-wrap: pretty`, which MDN lists at Chrome 117. Only the property and
  its `wrap`, `nowrap` and `balance` values are 114. So the guard now
  counts `text-wrap: pretty` on its own.
- **What is left.** `KNOWN` holds two entries, each explained by the guard's
  `GRACEFUL` list and a test that allows nothing else there:
  - `scrollbar-width` / `scrollbar-color` (121), 4 uses in the Lexical
    Gravity widget sheet. Chromium 114 to 120 ignore them and style the
    scrollbars by the sheet's own `::-webkit-scrollbar` rules.
  - `text-wrap: pretty` (117), 4 uses in `styles/workshop/context.css`.
    Chromium 114 to 116 wrap lines as usual.

  These are decided allowances, not open debt, so no follow-up item was
  split out.
- **Also updated:** the README's requirements, the Slice 2A note (a dated
  line), `.ai/central-agent-setup.md`, and the Lightbox ribbon's comments.
