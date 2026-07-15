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
- Allowed any exact configured resource to be read directly on any host turn;
  path containment and configured resolver membership remain the access
  boundary rather than a prior catalog/search call.
- Added bounded in-process literal search, case-insensitive canonical path
  resolution, line-window reads, stable provenance, visible success/failure
  artifacts, cancellation, and resource metrics.
- Added catalog-aware prompt instructions: empty configured catalogs are not
  advertised as available.
- Repaired the live host behavior after smoke testing: the immutable base
  prompt now authorizes autonomous access to configured project resources;
  named lookups search catalog paths/labels directly instead of pulling the
  full catalog; and a valid capability call may follow ordinary narration.
- Added proactive context guidance: when material context is missing, hosts
  inspect neighboring chapters/manuscript files and relevant project-bible
  groups before asking the writer to provide it.
- Added optional inclusive `startLine` / `endLine` reads with a 400-line
  default window and a non-overridable 64 KiB hard ceiling.
- Sanitized the shared Markdown renderer with DOMPurify and removed bare
  `https:` image loading from the shared webview CSP.

## Security boundary

- Model-authored absolute, traversal, URI, backslash, unknown-group, unknown-
  field, and oversized requests never reach filesystem I/O.
- Structurally rejected resource requests are recorded as visible rejected
  Project Resources artifacts before the engine asks the persona to recover.
- Direct reads resolve only against the configured resolver catalog. Unique
  case-insensitive matches use canonical configured casing; ambiguous matches
  fail closed, and absolute/traversal/outside-workspace paths remain rejected.
- Project file contents are delivered as explicitly untrusted evidence with
  neutralized Markdown fences; raw HTML, SVG, script, event handlers, inline
  styles, JavaScript URLs, and image beacons render inert.
- Guest personas still receive no capability adapter.

## Validation

- Focused direct-read follow-up: 6 suites / 83 tests passed.
- Full: 95 suites / 798 tests passed; 1 snapshot passed.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: zero errors; the repository's existing warnings remain.
- `npm run build`: passed, including resource staging and `verify:bundle`.
- `git diff --check`: passed.
- Bundle delta from the pre-sprint build:
  - `extension.js`: 2,369,397 → 2,391,428 bytes (+22,031 / +0.93%).
  - `webview.js`: 608,340 → 639,992 bytes (+31,652 / +5.20%).

## Remaining epic order

Sprint 12 runs next. Sprint 10 remains last so persistence serializes the final
Workshop turn/session contracts, including these resource artifacts and Sprint
12's context attachments, once.
