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
  named lookups return catalog path/label hits before continuing through the
  bounded content scan instead of pulling the full catalog; and a valid
  capability call may follow ordinary narration.
- Added proactive context guidance: when material context is missing, hosts
  inspect neighboring chapters/manuscript files and relevant project-bible
  groups before asking the writer to provide it.
- Added optional inclusive `startLine` / `endLine` reads with a 400-line
  default window and a non-overridable 64 KiB hard ceiling.
- Raised the shared host capability budget from three to five calls after a
  live two-profile comparison proved `search -> read -> search -> read` could
  not complete. Five is the smallest demonstrated-safe cap plus one spare;
  dictionary-full-entry and analysis-run subcaps remain one each.
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

- Focused final boundary set: 9 suites / 109 tests passed.
- Full: 95 suites / 806 tests passed; 1 snapshot passed.
- `npm run typecheck`: passed for core, webview, and extension.
- `npm run lint`: zero errors; 661 existing warnings remain.
- `npm run build`: passed, including resource staging and `verify:bundle`.
- `git diff --check`: passed.
- Bundle delta from the pre-sprint build:
  - `extension.js`: 2,369,397 → 2,392,575 bytes (+23,178 / +0.98%).
  - `webview.js`: 608,340 → 640,016 bytes (+31,676 / +5.21%).

## Remaining epic order

Sprint 11B runs next to separate per-request context pressure from multi-call
and cumulative processed usage across sidebar and Workshop. Sprint 12 follows,
then Sprint 10 remains last so persistence serializes the final Workshop
turn/session contracts once.

## PR #77 review remediation — 2026-07-16

- Addressed all 11 findings marked Open in the committed review ledger.
- Catalog path/label hits now lead a combined bounded content search; exact-cap
  search results probe for a real overflow before claiming truncation.
- Resolver stat sizes now pre-bound source I/O, search loads files
  incrementally, and reads refuse configured sources over 2 MiB before loading.
- Read provenance uses one normalized byte basis and has multi-line LF/CRLF
  truncation coverage; resolver stat failures are pinned fail-closed.
- The six deliberately deferred findings are tracked in
  `.todo/tech-debt/2026-07-16-workshop-persona-file-access-review-follow-ups.md`.
- Review finding 18 is now addressed by the measured five-call host cap. The
  context-observability architecture and Sprint 11B plan live in
  `docs/adr/2026-07-16-inference-context-observability.md` and
  `.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/11b-context-budget-visibility.md`.
- Verification: 95 Jest suites / 806 tests and 1 snapshot passed; core,
  webview, and extension typechecks passed; ESLint reported zero errors with
  the existing warning set; production webpack build and `verify:bundle`
  passed; `git diff --check` passed.
