# Claude cache duration and composer indicator

Branch: `fix/anthropic-prompt-caching`.
The preceding caching implementation was committed/pushed as `52f2e947`.
These subsequent duration/indicator changes are local and uncommitted.

## User intent and result

Okey asked whether Claude's one-hour caching is selectable, how pricing
differs, and requested `[Est. Cache Time Remaining: 1 min]` beside the Workshop
composer's plus button.

- Added `proseMinion.claudeCacheTtl` (`5m` default / `1h`) in the manifest,
  General Settings overlay, existing models domain hook, settings response,
  update validation, and general settings watcher. Retained engine calls read
  the current setting; only the Claude policy changes TTL.
- One-hour cache writes cost 2× regular input versus 1.25× for five minutes,
  60% more per write. Cache-read pricing is unchanged. No settings preference
  was changed on Okey's machine and no paid inference was made.
- Provider observations carry a conservative cache-window estimate, based on
  request dispatch time and positive reported reads/writes. Alibaba-compatible
  routes require an explicit write because an isolated read could come from an
  implicit-cache endpoint. Unknown native lifetimes and applied compression
  have no countdown.
- The latest inference's estimate rides the existing ephemeral context budget
  to the current participant's composer. Unknown final-call telemetry clears
  an earlier call's estimate. Model mismatches hide it; duration changes affect
  subsequent requests. Session restore, rewind and system-message replacement
  already clear context readings. No persisted-session schema change.
- Added a quiet timer immediately after `+`, a tooltip explaining uncertainty,
  `<1 min` and estimated expired states, interval cleanup, and wrapping controls
  on narrow panels.
- ADR: `docs/adr/2026-10-03-cache-window-indicator.md`.

## Verification

- Full suite before final evidence refinement: 232 suites, 2,886 tests and
  2 snapshots passed. Final focused provider/engine/settings/composer suites:
  8 suites and 208 tests passed, including the additional Alibaba evidence cases.
- Monorepo typecheck, production build and bundle sentinels passed after the
  final refinement. Changed-file ESLint had zero errors, existing warning-level
  conventions remain. `git diff --check` passed.
- Actual composer preview using production CSS and React verified in Chrome
  at 1,162px and 680px widths: label beside plus, actions wrap below on narrow
  panels. Preview fixture/bundle are only in `/private/tmp/prose-minion-cache-preview`.
- No live cache-hit/TTL acceptance against paid providers yet.

Unrelated existing release notes and `Prose Minion.zip` remain untouched.
