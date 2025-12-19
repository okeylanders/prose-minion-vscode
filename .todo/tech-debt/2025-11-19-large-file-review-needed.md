# Large Files Review Needed

**Date Identified**: 2025-11-19
**Identified During**: Shared Types Hygiene Analysis
**Priority**: Low
**Estimated Effort**: TBD (requires individual assessment)

## Problem

Several files exceed the recommended size limits (hooks < 200 lines, handlers < 150 lines, components < 400 lines) and may contain catch-all patterns or multiple responsibilities.

## Current Implementation

### Files Exceeding Size Guidelines

| File | Lines | Concern |
|------|-------|---------|
| resultFormatter.ts | 763 | Formatting utilities catch-all? |
| SettingsOverlay.tsx | 678 | Potential god component |
| SearchTab.tsx | 666 | Potential god component |
| MessageHandler.ts | 603 | Already refactored, still large |
| AIResourceOrchestrator.ts | 600 | Orchestrator complexity |
| AnalysisTab.tsx | 517 | Tab component size |
| ConfigurationHandler.ts | 492 | Handler size |
| App.tsx | 479 | Already refactored, monitoring |
| WordSearchService.ts | 466 | Service complexity |
| MetricsTab.tsx | 413 | Tab component size |

### Analysis Notes

**resultFormatter.ts (763 lines)**
- Likely contains multiple formatter functions for different result types
- May benefit from splitting by result domain (analysis, metrics, search)

**SettingsOverlay.tsx (678 lines)**
- Settings UI has grown with each new setting domain
- May need to extract domain-specific settings panels

**SearchTab.tsx (666 lines)**
- Contains both Word Search and Category Search UI
- May need to extract each search type into sub-components

**MessageHandler.ts (603 lines)**
- Already refactored with Strategy pattern (was 1,091 lines)
- Contains service instantiation and route registration
- May benefit from dependency injection container

**AIResourceOrchestrator.ts (600 lines)**
- Complex orchestration logic
- May need domain-specific orchestrators

## Recommendation

These files don't require immediate action but should be reviewed when:
1. Adding new functionality to them
2. Fixing bugs in them
3. Performing architecture reviews

**Review Questions:**
- Does this file have single responsibility?
- Can it be split by domain/feature?
- Are there extraction opportunities?

## Impact

### Benefits of Fixing (per file)

- Improved maintainability
- Better testability
- Clearer responsibilities
- Faster navigation

### Risks of Not Fixing

- Continued growth
- Harder to understand
- Higher bug risk
- Difficult onboarding

## References

- Architecture guidelines in [.ai/central-agent-setup.md](../../.ai/central-agent-setup.md)
- Size limits: hooks < 200 lines, handlers < 150 lines
- [ADR: Presentation Layer Domain Hooks](../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md)
