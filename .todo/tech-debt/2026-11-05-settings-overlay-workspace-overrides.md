# A project's settings file can override the Settings overlay's choices

**Date Identified**: 2026-11-05
**Reviewed**: 2026-11-05
**Status**: Identified
**Priority**: Medium
**Estimated Effort**: A product decision, then small (manifest scopes and a test) or medium (a settings-port change)

## Problem

Every Prose Minion setting except the three Workshop writer settings is
window-scoped (no `scope` in `apps/vscode-extension/package.json`).
`SettingsStore.update` writes only the global level, but `get` reads VS Code's
merged value. Two consequences follow, the same ones the Workshop's web
research setting had before [ADR 2026-07-20 §17](../../docs/adr/2026-07-20-workshop-persona-interaction-modes-and-expression-profiles.md):

- **A cloned project chooses for the writer.** Its `.vscode/settings.json` can
  set `proseMinion.assistantModel` (or any other model scope),
  `proseMinion.maxTokens` or `proseMinion.claudeCacheTtl`. The model decides
  which provider receives the manuscript, and the others change what a run
  costs. Nothing tells the writer that a project file made the choice.
- **The overlay cannot undo it.** A model the writer picks in the Settings
  overlay is written globally (`ConfigurationHandler`), while the workspace
  value still wins on the next read. The pick appears to revert.

No setting redirects an endpoint or the API key; the key is in SecretStorage.

## Recommendation

Decide per setting which ones a project may legitimately set. Context paths,
word lists and publishing presets are project data and can stay window-scoped.
For the model scopes, `maxTokens` and `claudeCacheTtl`, choose one:

1. `"scope": "application"`, as the Workshop's writer settings are. A model can
   then no longer differ per project.
2. Keep per-project values, but make them visible and writable. The settings
   port reads and writes a target (a port change every host implements), and
   the overlay shows when a project file sets the value.

## Related Files

- `apps/vscode-extension/package.json` (`contributes.configuration`)
- `apps/vscode-extension/src/platform/vscode/VsCodeSettingsStore.ts`
- `packages/core/src/platform/SettingsStore.ts`
- `packages/core/src/application/handlers/domain/ConfigurationHandler.ts`
- `packages/core/src/__tests__/architecture/workshopSettingsScope.test.ts` (the pattern for a scope guard)

## Completion Criteria

- Each setting a run reads for its model, provider or cost has a stated scope decision.
- A test pins those scopes, as `workshopSettingsScope.test.ts` does for the Workshop.
- The overlay never shows one value while a run uses another.
