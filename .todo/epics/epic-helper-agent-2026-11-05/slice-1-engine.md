# Slice 1: Engine

**Status:** Built, in review.
**Branch:** `epic/helper-agent-slice-1-engine`, from `epic/helper-agent-slice-0-spec`.
**Decisions:** [ADR 2026-11-05](../../../docs/adr/2026-11-05-helper-agent.md) D1–D4, and D5's codec.

## Scope

- **The `helper` model scope**, end to end (AGENTS.md, "A model setting"):
  - `ModelScope`, `MODEL_SCOPE_MEMBERS`, `FollowingModelScope` and `MODEL_SCOPE_FOLLOWS` (`helper: 'proofread'`);
  - `MODEL_SCOPE_SETTING_KEYS` (`helperModel`), resolved by `ModelScopeSelections` with no special case;
  - a bundle in `AIResourceManager`;
  - `proseMinion.helperModel` in `MessageHandler`'s `MODEL_KEYS` and in the manifest (empty default);
  - a row in the Settings overlay, with "Same as Proofread (…)" from `MODEL_FOLLOW_COPY`;
  - `MODEL_DATA`'s `following`, which already reads `MODEL_SCOPE_FOLLOWS`;
  - the Workshop's model-slice label (`workshopModelSlices`' exhaustive record).
- **Following, generalized.** Following was already keyed by `MODEL_SCOPE_FOLLOWS`, whose values are any own scope; only the comments and one header chip assumed the assistant model. Those now read the map. A test pins that no following scope follows another, so one lookup always names a model.
- **`HelperAgentService`** (`infrastructure/api/services/helper/`):
  - `HelperTaskPolicy`: prompt section, input builder (plain data), input counts for logs, exact-field decoder, call settings (temperature 0, ceiling, response bound, timeout; no reasoning);
  - `HELPER_TASK_POLICIES` / `HelperTask`;
  - `HelperReply`: ceiling and length refusals, then `parseModelJson`, then the task's decoder. Faults are a closed list (`HelperReplyFault`); nothing is clipped or repaired beyond the shared parser's structure-only repairs;
  - the engine has no task branch. It takes the caller's `signal`, and its own timer tells a timeout from a stop;
  - `AGENT_RUN_POLICIES.helper`: capability-free, nothing retained.
- **`memory-draft`**: `{ title, summary, kind }`, bounded by `PROJECT_MEMORY_FIELD_CHARACTERS` and `PROJECT_MEMORY_KINDS`. `PROMPT_BUDGETS.helper['memory-draft']` holds `inputCharacters` (the sheet body's 8,000), `outputTokens` (400) and `responseCharacters` (4,000).
- **Prompts:** `helper/00-helper.md` (generic, D1) and `helper/10-memory-draft.md`, with its worked example.
- **Wiring:** built in `extension.ts`, in `CoreServices.helperAgentService`, exported from the core barrel. No handler uses it yet.

## Tests

| Test | Covers |
|---|---|
| `ModelScopeSelections.test.ts` (helper block, following block) | follows Proofread, moves with it, never the assistant; picked is its own; cleared follows again; no following scope follows another |
| `AIResourceManagerHelperScope.test.ts` | its own engine; hot-swaps with a Proofread pick; a pick of its own holds; no engine without a key |
| `MemoryDraftTask.test.ts` | codec faults (missing, unknown, wrong type, outside the kinds, over bound, empty, multi-line, malformed JSON, not an object, cut off, too long); input bound equals the body's |
| `HelperAgentService.test.ts` | two fake tasks through one path; temperature 0, no reasoning, the run model pinned; unconfigured, rejected, error, timeout, cancelled; logs carry counts, never text |
| `helperPromptSync.test.ts` | every task's section exists; the generic prompt names no task or number; numbers pinned; kinds in order; worked example byte-identical and decoded by the production reader |
| `boundaries.test.ts` ("keeps the helper agent apart") | no Workshop, Lightbox, Draft Edit or presentation import; an allow-list of what it reads; only the composition root builds it; its engine is the `helper` scope's |
| `SettingsOverlay.test.tsx` (helper row) | "Same as Proofread (…)", a pick of its own, and back to following |
| Existing scope tests | `following` lists now end with `helper` |

## Implementation note

- **Faults drop, never clip.** An over-bound title is dropped whole, as D2 says. A title one character too long costs the draft; the sheet stays as it is today.
- **Surrounding whitespace is trimmed** before the bound is checked. A line break inside a field is a fault (`multi-line`).
- **Timeout.** 20 seconds for `memory-draft`, in the policy's call settings, not `PROMPT_BUDGETS` (it is not a prompt bound).
- **`source`** (`writer` | `persona`) joins the input so the kind can lean on who spoke; Slice 2 supplies it from the turn's role.
- **Usage** reaches the token widget through the engine's fan-out, as every scope's does, and also rides on the result.
- **`AIResourceManager.ts`** was at 503 lines, over the 500 line rule but not on the epic's list. It grows by five lines, only the scope's bundle seam that every scope adds (AGENTS.md: "its bundle in `AIResourceManager`").
- **Lint naming.** The task keys stay kebab-case (`memory-draft`, as the ADR names them), with the repo's `naming-convention` disable comments beside them.
