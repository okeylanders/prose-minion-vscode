# Draft Edit: reasoning levels for Proofread and Craft Flags

**Date:** 2026-10-27
**Branch:** built in a worktree on local branch `reasoning-levels`, from
`claude/upbeat-galileo-y1l4yf` at `aba2c006` (PR #180's head, in review), to
open as its own PR once PR #180 merges.
**Decision record:** ADR 2026-10-21, "Amendment 2026-10-27: reasoning levels
for Proofread and Craft Flags".

## Why

A Proofread chunk on the default model (`anthropic/claude-haiku-5.5`) came
back cut off mid-string. Its recovery sidecar: `finishReason: "length"`,
4,000 completion tokens, a 1,155-character reply. About 3,700 tokens went to
hidden reasoning; neither pass sent a reasoning setting.

## Decisions (the writer, 2026-10-27)

- A named level per pass, `off` / `light` / `standard` / `deep` (budgets
  0 / 1,024 / 4,000 / 12,000), its budget on top of the reply's own ceiling.
- Defaults: Proofread `light`, Craft Flags `standard`.
- Scope: these two passes. A level belongs to the request, never the model,
  so Craft Flags following the assistant model never changes the Workshop.
- Across model families a level is a request, never a guarantee: exact on
  budget models (Anthropic, Gemini), rough on effort-only ones (OpenAI
  reasoning, Grok), possibly ignored by always-on reasoners.

## Built

- `ReasoningLevel` (domain), `PROMPT_BUDGETS.reasoning`, pass defaults in
  `DRAFT_EDIT_PASS_POLICIES`, `reasoningRequest` (orchestration).
- `OpenRouterReasoningOptions` takes a token budget, sent as
  `reasoning.max_tokens`; the client reads
  `usage.completion_tokens_details.reasoning_tokens` onto each call's result,
  and the engine returns the final call's as `ExecutionResult.reasoningTokens`.
  Never `TokenUsage`: the Workshop session shape and the Lightbox board codec
  list usage fields exactly.
- Both services send their level, log reported thinking, and reject a reply
  the thinking cut off with "the model spent N of M output tokens thinking…;
  lower <setting> or choose another model" (`draftEditCeilingRejection`).
- Craft Flags' estimate counts half the level's budget as typical thinking.
- Settings `proseMinion.proofread.reasoning` and
  `proseMinion.craftFlags.reasoning`, read at the gesture; a manifest sync
  test.

## To confirm

OpenRouter's documentation was unreachable from the build container. The
writer's acceptance pass runs one Proofread chunk at `off` and one at
`light`, and reads the log line or sidecar: `reasoning.max_tokens`,
`effort: 'none'` and `completion_tokens_details.reasoning_tokens`.
