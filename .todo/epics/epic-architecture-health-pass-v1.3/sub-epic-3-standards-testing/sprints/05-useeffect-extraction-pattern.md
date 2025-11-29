# Sprint 05: useEffect Extraction Pattern

**Status**: ⏸️ Pending (Blocked on Sprint 04)
**Estimated Time**: 2-4 hours
**Priority**: MEDIUM
**Branch**: `sprint/epic-ahp-v1.3-sub3-05-useeffect-extraction`

---

## Problem

Inline useEffect logic with comments explaining intent.

---

## Tasks

- [ ] Extract inline logic to named methods wrapped in `useCallback`
- [ ] Semantic naming: `request*`, `sync*`, `clear*When*`, `initialize*`, `validate*`
- [ ] Apply pattern to 6+ domain hooks with complex useEffects
- [ ] Update tests (easier to test named methods)

---

## Acceptance Criteria

- ✅ No inline useEffect logic (extract to named methods)
- ✅ Self-documenting method names
- ✅ Testable without mocking React lifecycle
- ✅ Tests pass

---

## Reference

[Architecture Debt: useEffect Extraction Pattern](../../../../architecture-debt/2025-11-05-useeffect-extraction-pattern.md)

---

**Created**: 2025-11-29
