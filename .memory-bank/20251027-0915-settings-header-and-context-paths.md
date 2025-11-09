Focus: Settings overlay polish + Context Paths UI

When: 2025-10-27

Summary
- Centered Settings header via grid and set default layout to “stacked” (icon above title). Added doc with alternative header layouts.
- Added a new “Context Resource Paths” section to the Settings overlay (moved to bottom by request). Each group uses a textarea and includes descriptions.
- Fixed configuration pipeline so contextPaths.* values populate in the UI and persist on edit.

Key Changes
- UI
  - src/presentation/webview/components/SettingsOverlay.tsx: header data attribute `data-header-layout="stack"`; added Context Paths section; moved it to bottom.
  - src/presentation/webview/index.css: grid header, centered content, stacked variant styles.
- Extension handler
  - src/application/handlers/domain/ConfigurationHandler.ts:
    - SETTINGS_DATA now includes contextPaths.* keys.
    - UPDATE_SETTING allowlist includes `contextPaths.` prefix.
- Docs
  - docs/SETTINGS_HEADER_LAYOUT.md: how to switch among three header layouts.
  - docs/CONFIGURATION.md: note that Context Paths are editable in the in‑app Settings overlay.
  - docs/adr/2025-10-26-webview-settings-module.md: update log noting stacked header and Context Paths UI.

Open Questions / Next
- Optional: add placeholders and a “Learn more” link under Context Paths to jump to CONFIGURATION.md.
- Consider a compact view for Context Paths (collapsible group) if the section grows further.

