# Feature: Desktop Shell Adapter

**Date Identified**: 2026-06-29
**Source**: Migration & Facelift deferred item (`apps/desktop`)
**Status**: Planned
**Priority**: Low
**Estimated Effort**: Large

## Summary

Add a standalone desktop app shell that consumes `@prose-minion/core` through
the same platform ports used by the VS Code extension.

The v2.0.0 monorepo work made this possible by moving host-agnostic logic into
`packages/core` and isolating VS Code behavior in `apps/vscode-extension`.
Actually building the desktop shell remains separate product/platform work.

## Why This Is Separate

The monorepo migration was the enabling architecture, not the desktop product.
Keeping this as its own feature prevents the archived migration epic from owning
future Electron or desktop UX decisions forever.

## Candidate Scope

- Scaffold `apps/desktop`
- Implement desktop equivalents for the `Platform` ports
- Reuse core resources, prompts, guides, and services
- Decide packaging, auto-update, signing, and local storage strategy
- Decide whether desktop shares the current sidebar UI or introduces a broader
  desktop-first layout

## Design Questions

- Electron, Tauri, or another desktop host?
- Where should secrets live for each supported OS?
- How should project/workspace concepts map outside VS Code?
- Which VS Code affordances need desktop equivalents: editor selection, open
  file, save report, output channel, settings, and command palette?
- Should desktop launch with parity to the VS Code sidebar or wait for the
  full-tab conversation surface?

## Acceptance Criteria

- Desktop host choice is documented with tradeoffs.
- The app implements the existing `Platform` ports without weakening core
  boundaries.
- `packages/core` remains free of host imports.
- Resource loading works from the desktop package.
- Basic smoke path works: configure key, run an analysis, view output, save a
  report.

## Related

- ADR: `docs/adr/2026-06-16-monorepo-ports-and-adapters.md`
- Core package: `packages/core/`
- VS Code adapter reference: `apps/vscode-extension/src/platform/vscode/`
