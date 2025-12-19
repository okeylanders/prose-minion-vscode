# Sprint 05: Relevance Controls & Dedicated Model

**Status**: ✅ Complete
**Branch**: `epic/context-search-2025-11-17`
**Estimated Effort**: 2-3 hours
**Actual Effort**: ~2 hours

## Goals

Add user controls for search precision and create a dedicated category model scope with curated model list to avoid thinking model issues.

## Scope

### A. UI Controls

1. **Relevance Selector** (tab bar style like word length filter)
   - `broad` - Include loosely related words
   - `adjacent` - Include moderately related words
   - `focused` - Include closely related words only
   - `specific` - Include only exact semantic matches

2. **Word Limit Selector** (tab bar style)
   - 20, 50, 75, 100, 250 words

3. **Constraint Injection**
   - Append to system prompt: `\n\n---\n**CONSTRAINTS**: Return up to ${limit} words at ${relevance} relevance.`

### B. Dedicated Category Model Scope

1. **New Model Scope**: `categoryModel`
   - Separate from `contextModel`
   - Curated list (no thinking models)
   - Default: `anthropic/claude-sonnet-4.5`

2. **Allowed Models**:
   - `anthropic/claude-sonnet-4.5` (default)
   - `openai/gpt-5.1-chat`
   - `google/gemini-2.5-pro`
   - `mistralai/mistral-large-2411`

3. **Fixed Token Limit**: 7500 (hardcoded, not configurable)

## Tasks

### Backend

- [ ] Add `categoryModel` to ModelScope type
- [ ] Add `proseMinion.categoryModel` to package.json with allowed values
- [ ] Add `CATEGORY_MODELS` constant to OpenRouterModels.ts:
  ```typescript
  export const CATEGORY_MODELS = [
    {
      id: 'anthropic/claude-sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      description: 'Default for category search'
    },
    {
      id: 'openai/gpt-5.1-chat',
      name: 'GPT-5.1 Chat',
      description: 'OpenAI conversational model'
    },
    {
      id: 'google/gemini-2.5-pro',
      name: 'Gemini 2.5 Pro',
      description: 'Google advanced model'
    },
    {
      id: 'mistralai/mistral-large-2411',
      name: 'Mistral Large 2411',
      description: 'Mistral large model'
    }
  ];
  ```
- [ ] Update AIResourceManager to handle `category` scope
- [ ] Add `categoryRelevance` and `categoryWordLimit` to CategorySearchOptions
- [ ] Modify CategorySearchService.getAIMatches() to:
  - Use `category` model scope instead of `context`
  - Append constraint note to system prompt
  - Hardcode maxTokens: 7500
- [ ] Update ConfigurationHandler to get/sync category settings

### Frontend

- [ ] Add relevance and wordLimit to CategorySearchState in useSearch
- [ ] Add tab-bar UI for relevance (4 options)
- [ ] Add tab-bar UI for word limit (5 options)
- [ ] Update ModelSelector to use `category` scope
- [ ] Pass relevance/limit in CATEGORY_SEARCH_REQUEST message
- [ ] Persist relevance/limit in useSearch.persistedState

### Types

- [ ] Add to CategorySearchOptions:
  ```typescript
  relevance?: 'broad' | 'adjacent' | 'focused' | 'specific';
  wordLimit?: 20 | 50 | 75 | 100 | 250;
  ```
- [ ] Add `category` to ModelScope union

## Implementation Details

### Constraint Note Format

```typescript
const relevanceDescriptions = {
  broad: 'loosely related',
  adjacent: 'moderately related',
  focused: 'closely related',
  specific: 'exact semantic matches only'
};

const constraintNote = `\n\n---\n**CONSTRAINTS**: Return up to ${wordLimit} ${relevanceDescriptions[relevance]} words.`;
const fullPrompt = systemPrompt + constraintNote;
```

### Model Scope Configuration

```json
// package.json
"proseMinion.categoryModel": {
  "type": "string",
  "default": "anthropic/claude-sonnet-4.5",
  "enum": [
    "anthropic/claude-sonnet-4.5",
    "openai/gpt-5.1-chat",
    "google/gemini-2.5-pro",
    "mistralai/mistral-large-2411"
  ],
  "description": "AI model for Category Search (curated list, no thinking models)"
}
```

### UI Layout

```
[Relevance: broad | adjacent | focused | specific]
[Limit to: 20 | 50 | 75 | 100 | 250 words]

Category Model: [dropdown with 4 options]
```

## Acceptance Criteria

- [ ] Relevance selector displays 4 options in tab-bar style
- [ ] Word limit selector displays 5 options in tab-bar style
- [ ] Constraint note appended to system prompt with selected values
- [ ] Category model dropdown shows only 4 curated models
- [ ] Default model is claude-sonnet-4.5
- [ ] Token limit fixed at 7500 regardless of maxTokens setting
- [ ] Settings persist across sessions
- [ ] No thinking model issues (no truncation problems)

## Definition of Done

- [ ] All tasks completed
- [ ] Code committed to sprint branch
- [ ] Manual tests passed
- [ ] No TypeScript errors
- [ ] PR ready for review

## References

- [ADR-2025-11-17](../../../docs/adr/2025-11-17-context-search-component.md)
- [CategorySearchService](../../../src/infrastructure/api/services/search/CategorySearchService.ts)
- [SearchTab](../../../src/presentation/webview/components/SearchTab.tsx)
- [useSearch Hook](../../../src/presentation/webview/hooks/domain/useSearch.ts)
- [Sprint 04](./04-performance-polish.md) - Previous sprint
