# Word Search Defaults Product Decision

**Date Identified**: 2026-06-29
**Reviewed**: 2026-06-29
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Small

## Problem

The unified-settings ADR from 2025-11-03 describes Word Search defaults of
`contextWords: 7` and `clusterWindow: 150`, but the shipped extension defaults
are `contextWords: 3`, `clusterWindow: 50`, and `minClusterSize: 2`.

During the migration, the code centralized on the shipped behavior to preserve
runtime semantics. Moving to `7 / 150` is a real product change: wider context
snippets and broader cluster grouping.

## Recommendation

Decide deliberately whether the product should adopt the ADR's wider defaults.
If yes, update the package configuration, shared constants, tests, docs, and any
formatter fallback text in one focused change.

## Related Files

- `packages/core/src/shared/constants/wordSearchDefaults.ts`
- `apps/vscode-extension/package.json`
- `packages/core/src/presentation/webview/utils/formatters/wordSearchFormatter.ts`
- `packages/core/src/presentation/webview/utils/formatters/categorySearchFormatter.ts`
- `docs/adr/2025-11-03-unified-settings-architecture.md`

## Completion Criteria

- Product decision recorded.
- Defaults are consistent across package config, constants, UI hydration, and
  report formatting.
- Focused tests verify the defaults stay in sync.
