# Feature: Add Debug / Output Icon to Extension Title Bar

**Created:** 2026-06-24  
**Status:** Archived / released  
**Released In:** 2.0.0 (Marketplace, 2026-06-25)  
**Archived:** 2026-06-26  
**Priority:** Low  
**Type:** Developer-experience and supportability enhancement  
**Area:** VS Code extension shell / view title actions  
**Reference:** [title-bar.png](title-bar.png)

## Summary

Add a debug icon to the Prose Minion view title bar beside the existing settings
gear. Clicking it should reveal the **Prose Minion Output channel**, giving the
user or developer immediate access to activation logs, message routing,
configuration events, API failures, resource loading, and other diagnostic
information.

Proposed title bar:

```text
PROSE MINION: WRITING TOOLS                         [bug] [gear]
```

## Problem

Prose Minion already writes useful diagnostic information to its dedicated
Output channel, but discovering that channel requires knowledge of VS Code's
Output panel and channel selector.

When a model request fails, a setting does not synchronize, or a resource cannot
be loaded, the shortest path to evidence should be visible on the extension
itself. Currently the title bar exposes only Settings.

This is especially useful during the v2 release smoke test and for future
support instructions: “Click the bug icon and copy the relevant Prose Minion
output” is clearer than navigating several VS Code menus.

## Assumed Behavior

The “debug” icon means:

> Reveal and focus the existing **Prose Minion** Output channel.

It does **not**:

- start an Extension Development Host;
- launch a debugger;
- open browser developer tools;
- enable a verbose/debug logging mode;
- copy logs automatically;
- expose API keys or request bodies.

If Developer Tools was the intended target, this todo should be revised before
implementation.

## Proposed Solution

### Command contribution

Add a command:

```json
{
  "command": "prose-minion.showOutputChannel",
  "title": "Prose Minion: Show Debug Output",
  "icon": "$(bug)"
}
```

`$(bug)` is the preferred Codicon because the action is diagnostic. If it reads
too much like “report a bug,” `$(output)` or `$(debug-alt)` are reasonable
alternatives.

### View-title contribution

Add it immediately before Settings:

```json
{
  "command": "prose-minion.showOutputChannel",
  "when": "view == prose-minion.toolsView",
  "group": "navigation@98"
}
```

The existing gear remains:

```json
{
  "command": "prose-minion.openSettingsOverlay",
  "when": "view == prose-minion.toolsView",
  "group": "navigation@99"
}
```

The ordering makes debug/output appear to the left of Settings, matching the
reference image's available title-bar space and conventional action grouping.

### Command implementation

Register the command in `activate()` using the existing `outputChannel`:

```typescript
vscode.commands.registerCommand(
  'prose-minion.showOutputChannel',
  () => outputChannel.show(true)
);
```

`show(true)` preserves focus when possible. If manual testing shows that users
expect keyboard focus to move into the Output panel, use `show(false)` instead.

The command must be added to `context.subscriptions` with the other Prose Minion
commands.

## Scope

### In scope

- Contribute a title-bar command with a Codicon.
- Show the existing Prose Minion Output channel.
- Place the icon immediately before the settings gear.
- Give the command a clear title/tooltip in the Command Palette.
- Register and dispose the command through the extension context.
- Ensure the action is visible only on `prose-minion.toolsView`.

### Out of scope

- A new logging framework or log-level setting.
- Adding more logs.
- Opening Chromium/VS Code Developer Tools.
- Exporting logs to a file.
- Copy-all-logs behavior.
- Redacting legacy logs as part of this feature. Existing logging must already
  obey the no-secrets boundary.
- Adding the action inside the React webview header; this is a native VS Code
  view-title command.

## Architecture

This is shell-only behavior:

```text
package.json command/menu contribution
                ↓
apps/vscode-extension/src/extension.ts
                ↓
existing vscode.OutputChannel.show()
```

No core port or message-envelope change is required. The Output channel is
created and owned by the VS Code composition root, so the command belongs in
`apps/vscode-extension`.

Do not route this through `MessageHandler` or the webview. That would add an
unnecessary round trip and invert the host boundary for a native VS Code action.

## Likely Files

- `apps/vscode-extension/package.json`
- `apps/vscode-extension/src/extension.ts`
- potentially an app-side command-registration test once the existing
  app-scoped `vscode` mock seam is introduced
- release notes/changelog if included in v2.0.0

## Acceptance Criteria

- [ ] A debug/output icon appears in the Prose Minion view title bar.
- [ ] The icon appears immediately to the left of the settings gear.
- [ ] The icon is visible only when `prose-minion.toolsView` is active.
- [ ] Hover text clearly identifies the action as Prose Minion debug/output.
- [ ] Clicking the icon reveals the Output panel with **Prose Minion** selected.
- [ ] Clicking the settings gear continues to open the settings overlay.
- [ ] The command is available through the Command Palette.
- [ ] Repeated clicks reuse the same Output channel and do not create additional
      channels.
- [ ] The command registration is added to `context.subscriptions`.
- [ ] No webview message type or core dependency is introduced.
- [ ] No secrets or raw API response bodies are added to logs.

## Test Plan

### Automated

Preferred lightweight test once app command testing is available:

- mock `vscode.commands.registerCommand`;
- capture the registered callback;
- invoke it;
- verify the existing output channel's `show(true)` is called;
- verify the command ID is `prose-minion.showOutputChannel`.

This feature may expose the already-documented app-side Jest gap: tests under
`apps/vscode-extension` do not yet have a dedicated `vscode` mock. Options:

1. add the minimal app-scoped mock as part of this feature; or
2. treat this two-line shell command as manually verified and track the adapter
   test seam separately.

Avoid moving command registration into core merely to make it easier to test.
That would be the abstraction doing theater, not work.

### Manual

- Launch the Extension Development Host.
- Open the Prose Minion sidebar.
- Confirm bug/output icon ordering beside the gear.
- Hover and verify the tooltip.
- Click it before any AI request and confirm activation logs are visible.
- Run an analysis, click it again, and confirm request/message logs are visible.
- Return to Prose Minion and verify the settings gear still works.
- Test in both light and dark VS Code themes.

## Risks and Guardrails

- **Ambiguous icon:** A bug icon can imply “file a bug.” The tooltip/title must
  say “Show Debug Output” or “Show Prose Minion Output.”
- **Title-bar crowding:** Keep this to one additional icon. Do not add text.
- **Focus behavior:** `show(true)` preserves editor focus; verify whether this
  feels correct when the command is clicked with a mouse.
- **Log safety:** Easier log access increases the chance users paste logs into a
  support report. Continue to ensure keys, authorization headers, and raw
  provider bodies never enter the Output channel.

## Recommended Implementation Slice

This is a small VS Code adapter change and does not require an ADR.

Suggested branch:

`feature/debug-output-title-action`

Estimated effort: **30–60 minutes**, or **1–2 hours** if the app-side VS Code
command test seam is added at the same time.

## Open Decision

Confirm the icon target:

- **Show the Prose Minion Output channel** — assumed and recommended.
- Open VS Code Developer Tools.
- Perform another debug/support action.
