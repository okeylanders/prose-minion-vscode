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
- Repaired the live host behavior after smoke testing: the immutable base
  prompt now authorizes autonomous access to configured project resources;
  named lookups search catalog paths/labels directly instead of pulling the
  full catalog; and a valid capability call may follow ordinary narration.
- Sanitized the shared Markdown renderer with DOMPurify and removed bare
  `https:` image loading from the shared webview CSP.

## Security boundary

- Model-authored absolute, traversal, URI, backslash, unknown-group, unknown-
  field, and oversized requests never reach filesystem I/O.
- Structurally rejected resource requests are recorded as visible rejected
  Project Resources artifacts before the engine asks the persona to recover.
- Direct path/label search changes discovery efficiency only. It does not
  broaden configured-group reachability or the same-turn exact-read gate.
- Project file contents are delivered as explicitly untrusted evidence with
  neutralized Markdown fences; raw HTML, SVG, script, event handlers, inline
  styles, JavaScript URLs, and image beacons render inert.
- Guest personas still receive no capability adapter.

## Validation

- Focused live-smoke repair: 6 suites / 96 tests passed.
- Full: 95 suites / 787 tests passed; 1 snapshot passed.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: zero errors; the repository's existing warnings remain.
- `npm run build`: passed, including resource staging and `verify:bundle`.
- `git diff --check`: passed.
- Bundle delta from the pre-sprint build:
  - `extension.js`: 2,369,397 → 2,388,986 bytes (+19,589 / +0.83%).
  - `webview.js`: 608,340 → 639,817 bytes (+31,477 / +5.17%).

## Remaining epic order

Sprint 12 runs next. Sprint 10 remains last so persistence serializes the final
Workshop turn/session contracts, including these resource artifacts and Sprint
12's context attachments, once.
