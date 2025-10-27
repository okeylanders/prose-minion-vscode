# ADR: Webview Settings Module

Status: Accepted — Phase 1 Implemented
Date: 2025-10-26

## Context

We need a first‑class, in‑app settings experience so non‑technical users can configure Prose Minion without opening VS Code’s Settings UI. The module should expose all extension settings with friendly descriptions, proper theming, and immediate application via the existing configuration pipeline.

## Decision

1. Place a full‑screen settings overlay in the webview
   - Opened via a title‑bar gear icon; uses a fixed overlay that covers the entire view and blocks background scrolling.
2. Message contracts for data flow
   - Added messages: `OPEN_SETTINGS_TOGGLE`, `REQUEST_SETTINGS_DATA`, `SETTINGS_DATA`, `UPDATE_SETTING`, `RESET_TOKEN_USAGE`.
   - Reuse existing publishing standards messages to populate dropdowns.
3. Settings persistence via VS Code configuration
   - Webview posts `UPDATE_SETTING` with `proseMinion.*` keys; `MessageHandler` updates configuration and refreshes model data as needed.
4. UX requirements
   - Every setting includes a concise description of purpose and effect.
   - Publishing Standards presented as dropdowns (preset: none/manuscript/genre; trim size list derived from selected genre).
   - “Reset Token Usage” control clears session totals and refreshes the header widget.
   - Inputs styled with VS Code theme variables for a native feel.

## Alternatives Considered
 - Rely solely on VS Code settings panel: rejected (usability and guidance concerns).
 - Partial overlay limited to a tab: rejected (inconsistent with goal to keep users inside the tool view).

## Consequences
 - Simple, guided configuration workflow entirely within the tool.
 - Clear linkage with existing configuration watchers; changes reflect immediately.

## Implementation Notes
 - UI: `src/presentation/webview/components/SettingsOverlay.tsx`
 - Styling: CSS classes in `src/presentation/webview/index.css` replace inline styles for maintainability; section titles sized at 1.3em with border-bottom for visual hierarchy.
 - Toggle: title‑bar `prose-minion.openSettingsOverlay` command posts `OPEN_SETTINGS_TOGGLE`.
 - Contracts: `src/shared/types/messages.ts`
 - Handlers: `src/application/handlers/MessageHandler.ts` fetches settings, updates keys, and supports token reset.
 - Publishing data: `REQUEST_PUBLISHING_STANDARDS_DATA` populates preset + trim dropdowns from `PublishingStandardsRepository`.

## Links
 - Sprint 5 — Settings Module: `.todo/epics/epic-search-architecture-2025-10-19/sprints/05-settings-module.md`
 - Branch: `sprint/epic-search-arch-05-settings-module`
