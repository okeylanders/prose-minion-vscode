# Sprint 5 — Settings Module

Status: In Progress

- Window: 2025-10-23 → 2025-10-24 (Days 5–6)
- Epic: todo/epics/epic-search-architecture-2025-10-19/epic-search-architecture.md

## Goal
Full‑screen overlay module in the webview to guide non‑technical users through configuration; writes to the same VS Code settings.

## ADR to Author
- docs/adr/2025-10-XX-webview-settings-module.md
  - Decision: Present friendly settings UI; changes persist via `MessageHandler` updates.
  - Scope: API key, models (per scope), guides toggle, max tokens, publishing standards preset, word frequency and word search options.

## Tasks
- Add gear icon to top right to open the overlay.
- Render settings groups with descriptive help text and links (OpenRouter docs, internal CONFIGURATION.md).
- Post messages to update VS Code settings; rely on existing config watcher to refresh orchestrators/model data.
- Add a "Reset Token Usage" button in the overlay to clear session totals (tokens and cost) via an extension message.

## Affected Files
- src/presentation/webview/App.tsx (overlay + trigger icon)
- src/application/handlers/MessageHandler.ts (existing setters for models; extend if needed for others)
- docs/CONFIGURATION.md (link consistency)

## Acceptance Criteria
- Users can configure API key and model scopes without opening VS Code settings.
- Changes reflect immediately (watcher fires; model dropdown updates).
- Users can manually reset the session token usage totals; widget updates immediately.

## Progress (2025-10-26)
- Implemented full‑screen Settings overlay (blocks background scroll) with VS Code theming and grouped sections.
- Title‑bar gear toggles overlay (OPEN_SETTINGS_TOGGLE).
- Per‑item descriptions added across all settings, including hapax/lemmas, and Word Frequency bigrams/trigrams notes.
- Publishing Standards presented as dropdowns; trim size derives from selected genre (wired via PublishingStandardsRepository).
- Settings persist via UPDATE_SETTING; `MessageHandler` updates config and re-sends `MODEL_DATA` for UI-affecting values.
- Reset Token Usage implemented and wired; header widget refreshes immediately.

Next:
- UX niceties: Esc to close, focus trap, and persist overlay open state on reattach.
- CONFIGURATION.md links and minor copy polish if needed.
