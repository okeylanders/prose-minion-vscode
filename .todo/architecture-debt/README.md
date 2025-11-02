# Architecture Debt

This directory tracks **architectural debt** - design decisions that work but could be improved. Unlike bugs (which are broken) or features (which are missing), architecture debt represents working code that has structural issues affecting maintainability, scalability, or extensibility.

---

## What Belongs Here

### ✅ Architecture Debt
- Hardcoded lists/magic strings that should be configurable
- Duplicated logic that should be abstracted
- Tight coupling that should be loosened
- Missing abstractions that would improve extensibility
- Suboptimal patterns that cause maintenance burden
- Working code that violates Clean Architecture principles

### ❌ Not Architecture Debt
- **Bugs** → Create GitHub issues or bug tracking documents
- **Missing features** → Create feature requests or epic/sprint docs
- **Performance issues** → Track separately in performance optimization docs
- **Code style** → Use linter rules and code review comments
- **Documentation gaps** → Track in documentation todos

---

## Document Template

Each debt item should follow this structure:

```markdown
# Architecture Debt: [Descriptive Title]

**Date Created**: YYYY-MM-DD
**Category**: [Configuration Management | Data Flow | State Management | etc.]
**Priority**: [Low | Medium | High]
**Effort**: [Low (< 2h) | Medium (2-8h) | High (> 8h)]
**Status**: [Identified | In Progress | Resolved | Deferred]
**Introduced In**: [Feature/Sprint that introduced it]

## Problem
[Clear description of the current implementation and why it's problematic]

## Minimum Fix
[Quick, tactical fix to reduce pain]
- Effort estimate
- Benefits
- Drawbacks

## Better Solution
[Strategic, architectural improvement]
- Design overview
- Benefits
- Drawbacks

## Recommendation
[What should we do and when?]

## Related Files
[Files that would be affected]

## Decision Log
[Track decisions about this debt over time]
```

---

## Categories

### Configuration Management
Settings, configuration loading, environment-specific config

### Data Flow
Message passing, event handling, data synchronization

### State Management
Component state, global state, persistence

### Dependency Management
Service instantiation, dependency injection, coupling

### Domain Modeling
Entity design, value objects, aggregate boundaries

### Infrastructure
External integrations, API clients, file system access

### Testing
Test architecture, mocking strategies, test coverage

---

## Priority Guidelines

### High Priority
- Causes frequent bugs or confusion
- Blocks new features
- Violates core architectural principles
- Affects multiple teams/areas

### Medium Priority
- Increases maintenance burden
- Slows down development
- Makes testing difficult
- Affects one area significantly

### Low Priority
- Minor inconvenience
- Rare edge case
- Easy workarounds exist
- Purely aesthetic/organizational

---

## Effort Guidelines

### Low (< 2 hours)
- Extract method/class
- Add abstraction layer
- Refactor single component
- Can be done in one sitting

### Medium (2-8 hours)
- Refactor subsystem
- Introduce new pattern
- Update multiple files
- Requires testing changes
- Half-day to full-day work

### High (> 8 hours)
- Architectural redesign
- New infrastructure components
- Requires ADR and planning
- Multi-day effort
- May need spike/prototype first

---

## Workflow

### 1. Identify Debt
When you notice architectural issues while working:
```bash
# Create new debt document
touch .todo/architecture-debt/YYYY-MM-DD-descriptive-name.md
```

### 2. Document Problem
- Describe current implementation
- Explain why it's problematic
- Link to code locations
- Estimate impact

### 3. Propose Solutions
- **Minimum Fix**: Quick tactical improvement
- **Better Solution**: Strategic architectural fix
- Compare trade-offs

### 4. Make Decision
Update **Decision Log** section with:
- Date of decision
- Decision made (implement now, defer, reject)
- Rationale
- Action items

### 5. Track Progress
Update **Status** field:
- **Identified** → New debt, not yet addressed
- **In Progress** → Actively being fixed
- **Resolved** → Fixed and merged
- **Deferred** → Decided not to fix yet (document why)

### 6. Close When Resolved
- Update status to **Resolved**
- Link to PR/commit that fixed it
- Archive or keep for reference

---

## Review Cadence

### Weekly (During Standup)
- Quick scan of new debt items
- Prioritize any High priority items

### Monthly (Team Retro)
- Review all Medium/High priority debt
- Decide what to tackle in next sprint
- Update priorities based on current pain

### Quarterly (Architecture Review)
- Full review of all debt items
- Identify patterns/themes
- Plan larger refactoring efforts
- Close resolved items

---

## Current Debt Inventory

### Active Debt
- [Settings Sync Registration](2025-11-02-settings-sync-registration.md) - Medium priority, hardcoded settings watcher

### Resolved Debt
- None yet

### Deferred Debt
- None yet

---

## Principles

### Don't Let Debt Accumulate
- Document debt when you see it
- Don't wait for "the right time"
- Small fixes compound over time

### Balance Pragmatism
- Not all debt needs fixing immediately
- Working code that ships > perfect code that doesn't
- Fix debt when it blocks progress

### Be Specific
- "Bad code" is not debt tracking
- Identify concrete issues with clear fixes
- Quantify effort and impact

### Link to Context
- Reference the feature/sprint that introduced it
- Link to related ADRs
- Connect to architectural principles

---

**Remember**: Architecture debt is normal and expected. The goal is not zero debt, but **conscious, documented trade-offs** that we revisit regularly.
