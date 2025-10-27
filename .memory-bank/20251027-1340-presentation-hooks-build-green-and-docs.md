# Memory Note — Presentation Hooks: Build Green + Docs Updated

Date: 2025-10-27 13:40

## Summary

Completed the presentation hooks refactor integration pass: fixed message enum/prop mismatches, exposed missing handlers, achieved a clean TypeScript/webpack build, and updated architecture docs and central agent guidance.

## Changes

- App.tsx: aligned message enums (STATUS, MODEL_DATA), removed unsupported TabBar prop, wired Metrics/Search props, corrected SettingsOverlay API key prop
- useSettings: `UPDATE_SETTING` for `ui.showTokenWidget`, `SET_MODEL_SELECTION` for models
- useMetrics: added `setPathText`, `clearSubtoolResult`
- useMessageRouter: relaxed handler param typing to accept domain-specific handlers cleanly
- docs/ARCHITECTURE.md: added “Presentation Hooks Architecture” section (structure, patterns, references)
- .ai/central-agent-setup.md: added “Presentation Hooks (Webview)” guidance for agents

## Build

- npm run build: extension + webview compiled successfully (warnings only about bundle size)

## Next

- Manual test pass in Extension Development Host (F5): verify tabs, settings overlay, token widget, model selectors, analysis/metrics/search/dictionary flows, copy/save
- After validation, remove `src/presentation/webview/App.old.tsx`

## Links

- ADR: docs/adr/2025-10-27-presentation-layer-domain-hooks.md
- Epic: .todo/epics/epic-presentation-refactor-2025-10-27/epic-presentation-refactor.md
- Sprint: .todo/epics/epic-presentation-refactor-2025-10-27/sprints/01-domain-hooks-extraction.md
- Branch: sprint/epic-presentation-refactor-2025-10-27-01-domain-hooks

