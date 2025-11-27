# Sprint 01: Add New Models

**Epic**: [UX Polish](../epic-ux-polish.md)
**Status**: Ready
**Duration**: 30 min
**Priority**: HIGH

---

## Objective

Add two new frontier models to the model selection dropdowns:
1. **Cogito v2.1 671B** (`deepcogito/cogito-v2.1-671b`)
2. **Claude Opus 4.5** (`anthropic/claude-opus-4.5`)

Both models should appear in `CATEGORY_MODELS` and `RECOMMENDED_MODELS`.

---

## Model Specifications

### Cogito v2.1 671B
- **ID**: `deepcogito/cogito-v2.1-671b`
- **Context**: 128K tokens
- **Parameters**: 671B (MoE)
- **Key Features**:
  - Hybrid reasoning (direct or self-reflective)
  - ~60% shorter reasoning chains than DeepSeek R1
  - Strong multilingual, coding, and tool calling
- **Pricing**: Competitive (check OpenRouter)

### Claude Opus 4.5
- **ID**: `anthropic/claude-opus-4.5`
- **Context**: 200K tokens
- **Output**: 64K tokens
- **Key Features**:
  - 80.9% SWE-bench (industry leading)
  - 66.3% OSWorld (best computer-use model)
  - Hybrid reasoning with extended thinking
  - 66% cheaper than Opus 4.1 ($5/$25 per M tokens)
- **Released**: 2025-11-24

---

## Tasks

### 1. Update CATEGORY_MODELS

- [ ] Add Cogito v2.1 671B entry
- [ ] Add Claude Opus 4.5 entry
- [ ] Maintain alphabetical sort by name

### 2. Update RECOMMENDED_MODELS

- [ ] Add Cogito v2.1 671B with description
- [ ] Add Claude Opus 4.5 with description
- [ ] Maintain alphabetical sort by name

### 3. Verify

- [ ] Build succeeds (`npm run build`)
- [ ] Models appear in Settings dropdown
- [ ] Models appear in Category Search dropdown

---

## Implementation

### CATEGORY_MODELS entries

```typescript
{
  id: 'anthropic/claude-opus-4.5',
  name: 'Claude Opus 4.5',
  description: 'Anthropic\'s frontier reasoning model for complex tasks and agentic workflows'
},
{
  id: 'deepcogito/cogito-v2.1-671b',
  name: 'Cogito v2.1 671B',
  description: 'One of the strongest open models globally, matching frontier closed models'
},
```

### RECOMMENDED_MODELS entries

```typescript
{
  id: 'anthropic/claude-opus-4.5',
  name: 'Claude Opus 4.5',
  description: 'Anthropic\'s frontier reasoning model optimized for complex software engineering and agentic workflows. Strong multimodal capabilities with improved robustness. Supports extended context and multi-step planning.'
},
{
  id: 'deepcogito/cogito-v2.1-671b',
  name: 'Cogito v2.1 671B',
  description: 'One of the strongest open MoE models globally. Trained via self-play RL for state-of-the-art instruction following, coding, longer queries, and creative writing.'
},
```

---

## Files to Update

```
src/infrastructure/api/OpenRouterModels.ts
```

---

## Acceptance Criteria

- [ ] Both models in CATEGORY_MODELS
- [ ] Both models in RECOMMENDED_MODELS with prose-focused descriptions
- [ ] Alphabetical sort maintained
- [ ] Build passes
- [ ] Models visible in UI dropdowns

---

**Created**: 2025-11-24
