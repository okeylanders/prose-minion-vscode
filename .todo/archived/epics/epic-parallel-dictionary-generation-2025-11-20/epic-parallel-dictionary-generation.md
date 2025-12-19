# Epic: Parallel Dictionary Generation via Fan-Out Batching

**Created**: 2025-11-20
**Status**: Active
**ADR**: [2025-11-20: Parallel Dictionary Generation](../../../docs/adr/2025-11-20-parallel-dictionary-generation.md)

---

## Overview

Add experimental **parallel dictionary generation** using the fan-out/fan-in pattern proven in Category Search. Split dictionary template into 6-8 independent blocks (definitions, etymology, usage, etc.), fire concurrent OpenRouter API calls, and reassemble results for 2-4× faster generation.

---

## Goals

1. **Performance**: Achieve 2-4× faster dictionary generation (8-15s → 3-5s)
2. **Pattern Reuse**: Leverage proven Category Search fan-out architecture
3. **User Choice**: Provide experimental opt-in (no disruption to stable generation)
4. **Graceful Degradation**: Handle partial failures without blocking entire result
5. **Clean Architecture**: Preserve message envelope pattern, domain mirroring, hook interfaces

---

## Success Metrics

**Performance**:
- Target: 2-4× faster than standard generation
- Baseline: 8-15s for comprehensive entry
- Target: 3-5s for parallel generation

**Quality**:
- Target: >90% block completion rate (≤10% partial failures)
- Measure: Track partial failure rate in logs

**User Adoption** (if telemetry added):
- Target: >30% of dictionary lookups use fast generate after 1 month

**Cost**:
- Acceptable: <$0.05 per fast dictionary entry (6-8× API calls)

---

## Scope

### In Scope

✅ **Backend Fan-Out Infrastructure**:
- Message types for fast generate requests/results/progress
- `DictionaryService.generateParallelDictionary()` method
- Block-specific prompt templates (6-8 blocks)
- Concurrency management (5 threads)
- Timeout + retry logic per block
- Result reassembly with partial failure handling

✅ **Frontend Integration**:
- Extend `useDictionary` hook with fast generate actions
- "Experimental: Fast Generate" button with 🧪 badge
- Progress updates (backend messages per completed block)
- Display partial failure warnings
- Persistence for experimental feature preference

✅ **Prompt Engineering**:
- Block-specific prompts derived from main dictionary prompt
- Guardrails to prevent cross-block leakage
- Testing across models (Claude, GPT-4, Gemini)
- Quality validation (comparable to standard generation)

✅ **Performance Monitoring**:
- Output Channel logging (per-block timing, errors)
- Performance testing across models
- Partial failure rate monitoring
- Documentation of outcomes in ADR

### Out of Scope (Future Enhancements)

❌ **Caching**: Deferred entirely (not in experimental trial)
❌ **Cost Warning**: Experimental badge is sufficient
❌ **Batch Combining**: Each block gets own API call (no optimization)
❌ **Visual Progress List**: Deferred to future enhancement (horizontal list with graying sections)
❌ **Configurable Concurrency**: Fixed at 5 threads for experimental trial
❌ **Production Graduation**: Removing experimental badge, comprehensive tests (Phase 5)

---

## Architecture Decisions (from ADR)

1. **Block Granularity**: Each block gets its own API call (6-8 separate calls, no combining)
2. **Progress Updates**: Backend sends message per completed block (like Category Search)
3. **Caching**: Not in scope for experimental trial
4. **Cost Mitigation**: No cost warning (experimental badge sufficient)
5. **Concurrency**: Fixed at 5 threads (proven optimal)

---

## Implementation Plan

**Branching Strategy** (Experimental):
- **Single Epic Branch**: `epic/parallel-dictionary-generation-2025-11-20`
- All sprints work on this branch (no separate sprint branches)
- Commits organized by sprint phase
- PR opened at end of epic (after Sprint 4 complete)

---

### Sprint 1: Core Fan-Out Infrastructure
**Duration**: 1-2 days

**Scope**:
- Add message types (request, result, progress)
- Implement `DictionaryService.generateParallelDictionary()`
- Create block-specific prompt templates
- Add concurrency management
- Implement timeout + retry logic
- Register handler routes

**Deliverable**: Backend service fully functional, testable via manual message dispatch

---

### Sprint 2: Frontend Integration
**Duration**: 1 day

**Scope**:
- Extend `useDictionary` hook (fast generate actions)
- Add message routing for new types
- Create "Fast Generate" button with experimental badge
- Display progress updates (existing loader graphic)
- Show partial failure warnings
- Add persistence

**Deliverable**: End-to-end flow working in UI

---

### Sprint 3: Prompt Refinement
**Duration**: 1-2 days

**Scope**:
- Test block prompts across models (Claude, GPT-4, Gemini)
- Refine guardrails (prevent cross-block leakage)
- Quality validation (compare to standard generation)
- User testing (speed vs. quality trade-off)

**Deliverable**: High-quality block outputs, at least 2× faster than standard

---

### Sprint 4: Performance Tuning
**Duration**: 1 day

**Scope**:
- Performance testing across models
- Output Channel logging (per-block timing)
- Monitor partial failure rates
- Document outcomes in ADR

**Deliverable**: Performance documented, feature ready for experimental release

---

## Sprints

1. [Sprint 01: Core Fan-Out Infrastructure](sprints/01-core-fan-out-infrastructure.md) - **Pending**
2. [Sprint 02: Frontend Integration](sprints/02-frontend-integration.md) - **Pending**
3. [Sprint 03: Prompt Refinement](sprints/03-prompt-refinement.md) - **Pending**
4. [Sprint 04: Performance Tuning](sprints/04-performance-tuning.md) - **Pending**

---

## Dependencies

**Leverages Existing Patterns**:
- Message Envelope Architecture ([ADR-2025-10-28](../../../docs/adr/2025-10-28-message-envelope-architecture.md))
- Presentation Layer Domain Hooks ([ADR-2025-10-27](../../../docs/adr/2025-10-27-presentation-layer-domain-hooks.md))
- Category Search Fan-Out Pattern ([Epic](./../archived/epics/epic-context-search-2025-11-03/))

**No Blocking Dependencies**: Can start immediately

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| API costs 6-8× higher per entry | Experimental badge sets expectations; users opt-in consciously |
| Partial failures disrupt UX | Graceful degradation: show completed blocks, mark missing sections |
| Block prompts produce inconsistent quality | Iterative testing in Sprint 3; guardrails prevent leakage |
| Model variability across providers | Test all three models (Claude, GPT-4, Gemini); adjust prompts if needed |
| Concurrency throttling by OpenRouter | Cap at 5 threads (proven safe in Category Search) |

---

## Future Enhancements (Post-Epic)

**Phase 5: Production Readiness** (if experimental trial succeeds):
- Visual progress indicator (horizontal list: `*definition* ↔ **etymology** ↔ *voices* ↔ etc`)
- Caching layer (per-word + model)
- Extract shared fan-out utility (reuse in other features)
- Comprehensive automated tests (unit + integration)
- Remove experimental badge (graduate to stable)
- Add user guide and best practices

---

## References

- **ADR**: [2025-11-20: Parallel Dictionary Generation](../../../docs/adr/2025-11-20-parallel-dictionary-generation.md)
- **Proven Pattern**: [Context Search Epic](./../archived/epics/epic-context-search-2025-11-03/) - Fan-out batching
- **Dictionary Service**: [src/infrastructure/api/services/dictionary/DictionaryService.ts](../../../src/infrastructure/api/services/dictionary/DictionaryService.ts)
- **Category Search Reference**: [src/infrastructure/api/services/search/WordSearchService.ts](../../../src/infrastructure/api/services/search/WordSearchService.ts)

---

## Notes

**Alpha Development**: Breaking changes allowed; no backward compatibility required.

**Experimental Philosophy**: Ship fast, gather feedback, iterate. Feature may graduate to stable or be retired based on user adoption and quality outcomes.

---

**Last Updated**: 2025-11-20
**Owner**: Claude Code (AI Agent)
