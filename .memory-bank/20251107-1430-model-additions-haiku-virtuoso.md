# Model Additions: Claude Haiku 4.5 & Virtuoso Large

**Date**: 2025-11-07
**Time**: 14:30
**Type**: Feature Addition (Model Support)

## Summary

Added two new models to the recommended models list in alphabetical order:

1. **Claude Haiku 4.5** (`anthropic/claude-haiku-4.5`)
2. **Virtuoso Large** (`arcee-ai/virtuoso-large`)

## Changes Made

### File Modified
- [OpenRouterModels.ts](../src/infrastructure/api/OpenRouterModels.ts)

### Models Added

#### Claude Haiku 4.5
- **Position**: 1st in alphabetical list (before Claude Opus 4.1)
- **ID**: `anthropic/claude-haiku-4.5`
- **Name**: Claude Haiku 4.5
- **Description**: Anthropic's fastest and most efficient model with frontier-level capabilities
- **Context**: 200,000 tokens
- **Pricing**: $1/M input, $5/M output
- **Highlights**:
  - Matches Claude Sonnet 4 performance on reasoning, coding, computer-use
  - Extended thinking capability (controllable reasoning depth)
  - Scores >73% on SWE-bench Verified (top-tier coding model)
  - Optimized for sub-agents, parallelized execution, scaled deployment

#### Virtuoso Large
- **Position**: 18th in alphabetical list (after Qwen3 Max)
- **ID**: `arcee-ai/virtuoso-large`
- **Name**: Virtuoso Large
- **Description**: Arcee AI's top-tier 72B parameter model with 128K context for cross-domain reasoning and creative writing
- **Context**: 131,072 tokens (128K)
- **Pricing**: $0.75/M input, $1.20/M output
- **Highlights**:
  - 72B parameters, general-purpose LLM
  - Cross-domain reasoning, creative writing, enterprise QA
  - Training: DeepSeek R1 distillation + multi-epoch SFT + DPO/RLHF alignment
  - Strong on BIG-Bench-Hard, GSM-8K, Needle-In-Haystack tests
  - Used as "fallback brain" in Conductor pipelines

## Impact

- Both models now available in Settings overlay dropdowns for all three model scopes:
  - Assistant Model
  - Dictionary Model
  - Context Model
- Expands model selection options from 16 to 18 models

## Testing

- [x] Verified alphabetical ordering maintained
- [ ] Test in Extension Development Host (Settings overlay dropdown)
- [ ] Verify models work with OpenRouter API

## References

- Models sourced from OpenRouter model catalog
- Created: Claude Haiku 4.5 (Oct 15, 2025), Virtuoso Large (May 5, 2025)

## Next Steps

None - models are immediately available for user selection.
