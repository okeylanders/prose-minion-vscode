# Sprint 04: CSS Pattern Standardization

**Reviewed**: 2026-06-25
**Status**: Ready
**Priority**: Low
**Estimated Effort**: 2-4 hours

## Current Reality

Tailwind is actively used throughout the webview and its production delivery is
guarded by `apps/vscode-extension/scripts/verify-bundle.js`. The monorepo move
also established a `--pm-*` design-token system for theme-aware colors.

The remaining inconsistency is static inline styling. `SettingsOverlay.tsx` is
the largest concentration and should become the reference implementation for
the project convention.

## Styling Convention

1. Use custom CSS classes for reusable component semantics and complex shared
   visual patterns.
2. Use Tailwind utilities for one-off layout, spacing, sizing, and alignment.
3. Use `--pm-*` design tokens or VS Code theme variables for colors; avoid
   hard-coded Tailwind gray palettes where theme awareness matters.
4. Keep inline styles only for values that are genuinely computed at runtime,
   such as a progress-bar percentage.
5. Refactor opportunistically. This sprint is not authorization for a broad
   visual redesign.

## Tasks

- [ ] Document the convention in `.ai/central-agent-setup.md` and `AGENTS.md`
- [ ] Refactor static inline styles in `SettingsOverlay.tsx`
- [ ] Preserve dynamic inline values where classes cannot represent the value
- [ ] Use existing `--pm-*` tokens for theme-sensitive colors
- [ ] Confirm the settings overlay renders correctly in the extension host
- [ ] Run lint, typecheck, tests, production build, and bundle verification
- [ ] Decide whether a lint or architecture guard is worth enforcing

## Acceptance Criteria

- The hybrid styling convention is documented for future work
- `SettingsOverlay.tsx` contains no avoidable static inline styles
- No theme-sensitive colors are replaced with hard-coded palette values
- Dynamic style values remain explicit and readable
- Tailwind bundle verification remains green
- No unrelated components are mass-refactored

## Notes

The previous sprint draft claimed Tailwind was configured but unused and that
inline styles generated lint warnings. Both claims are obsolete. The current
value of this sprint is consistency and guidance, not enabling Tailwind.
