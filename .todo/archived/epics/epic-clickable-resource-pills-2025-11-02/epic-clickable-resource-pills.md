# Epic: Clickable Resource Pills in Context Assistant

**Date Created**: 2025-11-02
**Status**: Complete ✅
**Priority**: MEDIUM (v1.0 Polish)
**Target Release**: v1.0
**Completion Date**: 2025-11-02
**PR**: #15 (merged to main)
**Epic Lead**: Development Team

---

## Overview

Make resource pills in the Context Assistant clickable to match the existing interaction pattern of guide pills, providing users with a consistent, intuitive way to navigate to referenced resources.

## Vision

**As a writer using the Context Assistant**, I want to click on resource pills to open the referenced files, so that I can quickly explore the context materials used in my analysis without manually searching for them.

## Business Value

### User Experience
- ✅ **Consistent interaction model** - All pills work the same way
- ✅ **Improved discoverability** - Users can explore context materials easily
- ✅ **Reduced friction** - One-click navigation vs. manual file search
- ✅ **Better understanding** - Users can see exactly what context was used

### Technical Value
- ✅ **Follows established patterns** - Reuses OPEN_GUIDE_FILE pattern
- ✅ **Minimal complexity** - Simple extension of existing UIHandler
- ✅ **Clean Architecture adherence** - Maintains domain separation
- ✅ **No technical debt** - Uses best practices from presentation refactor

## Success Metrics

### Primary Metrics
- **User feedback** - Positive comments about pill interactivity
- **Zero confusion** about which UI elements are clickable
- **Consistent behavior** - All pills behave the same way

### Secondary Metrics
- **Error rate** - Low errors when clicking resource pills
- **Adoption** - Users actually click resource pills to navigate
- **No regressions** - Guide pills continue to work correctly

## Scope

### In Scope
1. **Backend Message Handler** (Application Layer)
   - Add `OPEN_RESOURCE` message type
   - Implement workspace-relative path resolution
   - Error handling for missing files
   - Register handler in UIHandler

2. **Frontend Interaction** (Presentation Layer)
   - Convert resource pills from `<span>` to `<button>`
   - Add onClick handlers with message posting
   - Keyboard accessibility (Tab + Enter)

3. **Styling** (Presentation Layer)
   - Hover states for visual feedback
   - Cursor changes to indicate clickability
   - Consistent with guide pill styling

4. **Documentation**
   - ADR documenting the decision
   - Memory bank entry with results

### Out of Scope (Future Enhancements)
- ❌ Preview on hover - v1.1+
- ❌ Right-click context menu - v1.1+
- ❌ Resource usage statistics - v1.1+
- ❌ Visual indicators of included resources - v1.1+

## Architecture Alignment

This epic adheres to Clean Architecture principles established in the [Presentation Layer Review](../../../.memory-bank/20251102-presentation-layer-architectural-review.md):

### Layer Separation
```
┌────────────────────────────────────┐
│  Presentation Layer                │
│  - AnalysisTab.tsx                 │
│  - Resource pill click handlers    │
│  - Message posting only            │
└────────────────────────────────────┘
              ↓ postMessage
┌────────────────────────────────────┐
│  Application Layer                 │
│  - UIHandler                       │
│  - File opening logic              │
│  - Error handling                  │
└────────────────────────────────────┘
              ↓ uses
┌────────────────────────────────────┐
│  Infrastructure                    │
│  - VSCode workspace API            │
│  - File system operations          │
└────────────────────────────────────┘
```

### SOLID Principles Applied
- **Single Responsibility**: UIHandler owns all file opening operations
- **Open/Closed**: Extends UIHandler without modifying existing code
- **Dependency Inversion**: Component depends on message contract, not implementation
- **Interface Segregation**: Clean, focused message payload interface
- **Type Safety**: Explicit TypeScript interfaces throughout

### Domain Mirroring
- **UI Domain** handles user interactions (clicks)
- **Application Domain** handles file operations
- **Message Envelope Pattern** maintains communication symmetry

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Resource path doesn't exist | Low | Low | Error handling with user-friendly message |
| No workspace open | Low | Low | Check for workspace, show clear error |
| User confusion about clickability | Low | Very Low | Clear hover states and cursor changes |
| Breaking guide pills | Medium | Very Low | Separate message types, isolated handlers |

## Dependencies

### Internal Dependencies
- ✅ UIHandler exists and handles OPEN_GUIDE_FILE
- ✅ Message envelope pattern established
- ✅ Context resources tracked in useContext hook
- ✅ AnalysisTab renders resource pills

### External Dependencies
- None (self-contained feature)

### Blocking Issues
- None identified

## Timeline

### Sprint 1: Implementation (1-2 hours)
- **Week 1**: Implement message type, handler, frontend click logic, styling
- **Deliverables**: Working clickable resource pills

**Estimated Total**: 1-2 hours (single sprint)

## Sprints

1. [Sprint 01: Clickable Resource Pills Implementation](sprints/01-clickable-resource-pills-implementation.md) - **In Progress**

## Related ADRs

- [ADR: Clickable Resource Pills (2025-11-02)](../../../docs/adr/2025-11-02-clickable-resource-pills.md)

## Related Epics

- [Epic: Presentation Layer Domain Hooks Refactor](../epic-presentation-refactor-2025-10-27/) - Establishes architectural patterns this epic follows
- [Epic: Message Envelope Architecture](../epic-message-envelope-2025-10-28/) - Establishes message patterns this epic uses

## Team Notes

### Why This Epic Matters

**Inconsistent UX creates confusion.** When some interactive-looking elements work and others don't, users lose confidence in the interface. Making all pills clickable:
- Creates a predictable interaction model
- Improves discoverability of context materials
- Reduces cognitive load (no need to guess what's clickable)

### Architectural Philosophy

Following the lessons from the presentation layer refactor:
- **Message envelope pattern**: Consistent communication structure
- **Domain separation**: UI sends messages, backend performs actions
- **Type safety**: Explicit interfaces prevent runtime errors
- **Reuse existing patterns**: OPEN_GUIDE_FILE provides the blueprint
- **Minimal changes**: Extends without breaking existing functionality

### User Scenarios

**Scenario 1: Exploring Context**
- User generates context for their scene
- Sees resource pills: "characters/protagonist.md", "locations/tavern.md"
- Clicks "protagonist.md" → file opens in editor
- Reviews character details
- Returns to Prose Minion with better understanding

**Scenario 2: Learning the System**
- New user sees guide pills (clickable) and resource pills (not clickable)
- Tries clicking resource pill
- Nothing happens
- Confusion about UI patterns

**With This Feature:**
- New user sees guide pills and resource pills
- Both have hover states
- Both respond to clicks
- Consistent, predictable behavior

## Definition of Done

- [ ] All acceptance criteria from Sprint 01 met
- [ ] ADR documented and approved
- [ ] Code follows Clean Architecture principles
- [ ] Manual testing checklist completed
- [ ] No TypeScript errors
- [ ] Builds successfully
- [ ] Guide pills still work correctly
- [ ] PR reviewed and approved (if applicable)
- [ ] Merged to main branch
- [ ] Memory bank entry created

## Post-Epic Review

_(To be filled after completion)_

### What Went Well
- TBD

### What Could Be Improved
- TBD

### Lessons Learned
- TBD

### Metrics Achieved
- TBD

---

**Epic Status**: ✅ Complete
**Completion**: Sprint 01 complete (PR #15)
**Blocked**: No
**Last Updated**: 2025-11-03
