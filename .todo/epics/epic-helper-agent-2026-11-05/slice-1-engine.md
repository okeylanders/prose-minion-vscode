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

## Acceptance checks (PR #225 review, A-01–A-05)

Slice 1 owns A-04, the engine's half of A-05, and the bounds A-01 sets on the helper's input. A-02, A-03 and the rest of A-01 and A-05 are Slice 2's, where the sheet and the route are.

| Check | How Slice 1 meets it | Test |
|---|---|---|
| A-01, the input is bounded | The task cuts its passage to `inputCharacters`, pinned equal to the sheet body's 8,000 UTF-16 code units. | `MemoryDraftTask.test.ts` ("sends the passage… cut to the task's bound", "reads as much of the turn as the memory sheet's body holds") |
| A-04, exact shape and known kind | `helperExactFields`: a missing or extra field is a fault. The kind must be one of `PROJECT_MEMORY_KINDS`. | `MemoryDraftTask.test.ts` ("drops a draft missing a field…", "reads every kind of the closed list…") |
| A-04, the existing one-line rule | `PROJECT_MEMORY_NOT_ONE_LINE` (control characters, U+2028, U+2029) moved to `shared/types/projectMemory.ts`. The sheet's `checkWorkshopMemoryDraft` and the helper's decoder both read it, so there is no second copy. | `MemoryDraftTask.test.ts` ("drops a title or summary holding a tab / carriage return / bell / C1 control / line separator / paragraph separator") |
| A-04, the same limits as production | Bounds read `PROJECT_MEMORY_FIELD_CHARACTERS`, and the prompt's numbers and kinds are pinned to it. A sweep of edge drafts agrees with the sheet's own check, both ways, astral characters included. | `MemoryDraftTask.test.ts` ("agrees with the sheet's own check…"); `helperPromptSync.test.ts` |
| A-04, no invention or truncation | Over-bound, empty, multi-line or unknown values fail. Only `parseModelJson`'s structure-only repairs are accepted, and they are logged by kind. | `MemoryDraftTask.test.ts` ("drops a field over its bound, never clipping it", "reads through the shared parser…") |
| A-05, a finite timeout, set explicitly | The policy's `timeoutMs` (20 s), owned by the service's own timer, aborts the request's signal. A stalled transport is stopped, with fake timers. | `HelperAgentService.test.ts` ("stops a stalled transport at the task's own timeout…") |
| A-05, caller abort | The caller's signal is forwarded. An already-aborted signal sends nothing. | `HelperAgentService.test.ts` ("reports an error and a caller's stop apart", "sends nothing when the caller stopped it first") |
| A-05, capability-free and discarded | `AGENT_RUN_POLICIES.helper`: no catalog, no rounds, no corrections, discard. Calls carry no `tools` and no `reasoning`. | `HelperAgentService.test.ts` ("runs two different tasks…", "runs its helper policy capability-free…") |
| A-05, bounded output, usage once, no text in logs | `maxTokens` is the policy's ceiling, and a reply cut off or too long is refused. Usage reaches the token listeners only through the engine's own fan-out; the service passes it back but never emits it. Logs carry task, model, outcome and counts. | `HelperAgentService.test.ts` ("drops a faulty answer by its kind…", "logs the task, the model, the outcome and counts, never the text") |
| A-05, following | An unpicked helper follows a Proofread change, a picked one stays its own, a cleared pick follows again, and `following` reports it. | `ModelScopeSelections.test.ts` (helper block); `AIResourceManagerHelperScope.test.ts` |
| A-05, retirement | A key refresh retires the held engine's transport, so it starts no new call. The new bundle keeps the followed model. A call already sent settles, as every scope's does (PR #169 F-01). | `AIResourceManagerHelperScope.test.ts` ("retires its engine's transport when a key change rebuilds its bundle…") |
