# Per-Surface MessageHandler Route Tables

**Date Identified**: 2026-10-19 (Lightbox Slice 0 research)
**Reviewed**: 2026-10-19
**Status**: Identified
**Priority**: Low
**Estimated Effort**: Medium (constructor change plus assembly guards)

## Problem

Every webview gets a `MessageHandler` that builds and registers all domains:
the sidebar, the Workshop tab, and (from Lightbox Slice 2A) the Lightbox tab.
Each instance constructs its own `WorkshopRoomHandler` and attaches listeners
that only one surface needs:

- token usage;
- dictionary and search status;
- balance refresh;
- a secret-change listener that re-runs `refreshServiceConfiguration` once
  per handler;
- the Workshop session save-status broadcast;
- a Workshop settings resync on every configuration change.

The webview router ignores unknown message types, so nothing visibly breaks.
The costs are duplicated work, more listeners than surfaces need, and a
larger blast radius for any domain's constructor side effects.

## Related files

- `packages/core/src/application/handlers/MessageHandler.ts` (constructor,
  domain construction and `registerRoutes` calls)
- `packages/core/src/application/handlers/MessageHandlerContracts.ts`
- `apps/vscode-extension/src/application/providers/*Provider.ts`
- `apps/vscode-extension/src/__tests__/architecture/providerAssembly.test.ts`
  (pins the `new MessageHandler(...)` argument shape)

## Options

1. Pass a per-surface domain set to `MessageHandler` (for example
   `{ surface: 'lightbox' }`) and register only that surface's domains plus
   the shared chrome routes. This changes the constructor and the assembly
   guard.
2. Keep one handler per webview, but make domain construction lazy, on first
   route. This avoids side effects without changing the constructor.

## Completion criteria

- Each surface registers only the domains it uses, or constructs them lazily.
- A secret change refreshes service configuration once, not once per webview.
- The assembly and boundary tests pin the chosen rule.
