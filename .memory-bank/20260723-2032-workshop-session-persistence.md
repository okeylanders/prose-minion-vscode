# Workshop Session Persistence — Sprint 10 Implementation

**Date:** 2026-07-23
**Branch:** `sprint/workshop-editor-tab-10-session-persistence`
**Status:** Implemented in
[draft PR #85](https://github.com/okeylanders/prose-minion-vscode/pull/85);
automated verification and GitHub CI complete. Manual Extension Development
Host continuity/corruption exercise and PR review remain.

## Landed decisions

- `prose-minion/sessions/current.json` is the rolling authoritative Workshop
  checkpoint; timestamped named JSON files are immutable storage identities
  with editable title metadata.
- Strict bounded `.summary.json` sidecars make large sessions browser-visible.
  Full JSON remains the only restore/action authority and exact reads are
  unbounded.
- `WorkshopSessionService` exports/hydrates its complete committed aggregate,
  not the windowed webview snapshot. Runtime conversation ids are never durable.
- `ConversationManager` archives committed non-system messages under logical
  host/guest/tool keys, imports them under fresh runtime ids, and rebuilds
  leading system prompts from current persona/behavior/profile policy.
- A malformed participant archive degrades locally to fresh memory while the
  rest of the workspace/transcript survives.
- Trusted time frames are queued per persona on first turn, disk resume, and
  one-hour thresholds; delivery timestamps advance only after successful turns.
- The coordinator owns ordered autosave, named checkpoints, strict Open/New
  promotion/rollback, workspace-root pinning, unreadable-current protection,
  and activation/deactivation lifecycle barriers.
- The approved session interface is split into its anchored header menu,
  focused Save dialog, and viewport-bounded full browser. The browser keeps
  Open/New controls in view, supports bounded search and date/excerpt grouping,
  renders each saved host persona's focus icon, and offers Rename, Duplicate,
  Reveal, and Delete under active-run/operation locks.
- Conversation Widgets remain a typed additive follow-up. No untyped widget
  extension bag was introduced before those domain entities exist.

## Verification

- `npm run typecheck`: core, webview, extension passed.
- `npm test -- --runInBand`: 122 suites, 1,177 tests, 1 snapshot passed.
- `npm run lint`: 0 errors, 766 repository-baseline warnings.
- `npm run build`: production extension/webview builds and bundle sentinels
  passed.
- `npm run package`: VSIX packaging passed (176 files, 9.77 MB).
- GitHub `verify`: passed on draft PR #85.
- Bundle sizes: `extension.js` 2,547,503 bytes; `webview.js` 880,989 bytes.

## Manual closeout

Use Extension Development Host to:

1. Build a room with excerpt, context, todo, host, guest, and direct-tool turns.
2. Quit/relaunch VS Code and continue host and guest under restored memory.
3. Confirm the first resumed persona turn receives the trusted time frame.
4. Corrupt one archived participant history and confirm visible local
   degradation while excerpt/transcript/todos remain intact.
5. Exercise Save/browser actions against both ordinary and long sessions.

## References

- [Sprint 10](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/10-session-persistence.md)
- [Persistence ADR](../docs/adr/2026-07-14-workshop-session-persistence.md)
- [Feature investigation](../.todo/features/feature-workshop-session-persistence/README.md)
