# Workshop Sprint 11: persona file access complete

**Date:** 2026-07-15 11:38 CDT
**Branch:** `sprint/workshop-editor-tab-11-persona-file-access`
**Target:** `epic/workshop-editor-tab`

## Delivered

- Added host-only `resource.catalog`, `resource.search`, and `resource.read`
  operations through `WorkshopPersonaCapability`.
- Reused `ContextResourceResolver` for configured context groups and hardened
  its catalog boundary against lexical escapes, symlink ancestors, unsupported
  files, and unreadable matches.
- Required a path to be disclosed by the same turn's bounded catalog/search
  before an exact group/path read can execute.
- Added bounded in-process literal search, head-sliced reads, stable provenance,
  visible success/failure artifacts, cancellation, and resource metrics.
- Added catalog-aware prompt instructions: empty configured catalogs are not
  advertised as available.
- Sanitized the shared Markdown renderer with DOMPurify and removed bare
  `https:` image loading from the shared webview CSP.

## Security boundary

- Model-authored absolute, traversal, URI, backslash, unknown-group, unknown-
  field, and oversized requests never reach filesystem I/O.
- Structurally rejected resource requests are recorded as visible rejected
  Project Resources artifacts before the engine asks the persona to recover.
- Project file contents are delivered as explicitly untrusted evidence with
  neutralized Markdown fences; raw HTML, SVG, script, event handlers, inline
  styles, JavaScript URLs, and image beacons render inert.
- Guest personas still receive no capability adapter.

## Validation

- Focused: 8 suites / 94 tests passed before final acceptance additions.
- Full: 95 suites / 783 tests passed; 1 snapshot passed.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: zero errors; the repository's existing warnings remain.
- `npm run build`: passed, including resource staging and `verify:bundle`.
- `git diff --check`: passed.
- Bundle delta from the pre-sprint build:
  - `extension.js`: 2,369,397 → 2,386,934 bytes (+17,537 / +0.74%).
  - `webview.js`: 608,340 → 639,610 bytes (+31,270 / +5.14%).

## Remaining epic order

Sprint 12 runs next. Sprint 10 remains last so persistence serializes the final
Workshop turn/session contracts, including these resource artifacts and Sprint
12's context attachments, once.
