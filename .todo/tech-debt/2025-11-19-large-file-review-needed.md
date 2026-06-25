# Large-File Responsibility Review

**Date Identified**: 2025-11-19
**Reviewed**: 2026-06-25
**Status**: Deferred
**Priority**: Low
**Estimated Effort**: Assess per file

## Context

The original inventory became stale after the Architecture Health Pass and the
monorepo migration:

- `resultFormatter.ts` was decomposed and removed
- `SearchTab.tsx` and `MetricsTab.tsx` became thin orchestrators
- `App.tsx` was reduced
- `MessageHandler` stopped constructing infrastructure and now receives
  composition-root dependencies

File length alone is not an architectural defect. Review these files by
responsibility, change pressure, and test seams rather than enforcing arbitrary
line limits.

## Current Review Candidates

| File | Approx. lines | Review question |
|---|---:|---|
| `AIResourceOrchestrator.ts` | 973 | Can repeated execution mechanics be extracted without erasing meaningful guide/context differences? |
| `SettingsOverlay.tsx` | 698 | Should domain-specific settings sections become focused components? |
| `AnalysisTab.tsx` | 619 | Does the tab own too much analysis/context UI behavior? |
| `ConfigurationHandler.ts` | 506 | Can settings groups or watcher behavior become narrower collaborators? |

Other large files should be added only when a concrete responsibility problem
is identified.

## Review Questions

- Does the file have more than one reason to change?
- Is duplicated knowledge present, or merely similar syntax?
- Would extraction create a clearer test seam?
- Would a new abstraction make production debugging easier?
- Is the file actively changing enough to justify the migration cost?

## Recommendation

Review opportunistically when adding behavior or fixing defects. Create a
focused debt item or ADR for a specific extraction rather than treating this
document as a standing instruction to split files.

The existing
[AIResourceOrchestrator loop debt](2025-11-25-ai-resource-orchestrator-loop-duplication.md)
is one concrete child of this broader review.
