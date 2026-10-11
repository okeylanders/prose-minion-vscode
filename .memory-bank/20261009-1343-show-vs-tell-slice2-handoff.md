# Show vs. Tell — Slice 2 Review-Gate Handoff (2a + 2b)

**Date:** 2026-10-09 13:43 UTC

**Branch:** `epic/conversation-widgets-sprint-05-slice-2-generation`, cut from
`epic/conversation-widgets` at `d068abd` (the Slice 1 merge). One PR into the
epic covers 2a (prompt bundle) and 2b (this note). Not merged.

**Sprint:** [Sprint 05 — Show vs. Tell](../.todo/epics/epic-conversation-widgets-2026-07-22/sprints/05-show-vs-tell.md)

**Previous:** [Slice 2a prompts](20261009-0808-show-vs-tell-slice2a-prompts.md)

**Current gate:** Slice 2 is ready for review. Do not start Slice 3 until the
PR merges; Slice 3 cuts its branch from the epic after that.

## What landed in 2b

By layer:

- **Q1 persistence.** `WorkshopShowVsTellDraft.surroundingContext.sourceReferences`
  (0–1 `active-excerpt` | `context-attachment` with a `ctx-N` id; no passage
  text). Shape (`assertShowVsTellSourceReferencesShape`), integrity (no
  duplicates), clone, fixtures, and tests. Budgets
  `showVsTellSourceReferences: 1` and `showVsTellSourceReferenceCharacters: 500`
  in `PROMPT_BUDGETS`, the `promptBudgets` guard, and the sprint Budgets table.
  No migration or normalization: no writer holds a config before Slice 4.
- **Contracts** (`messages/workshop/showVsTell.ts`): generate, cancel, progress,
  and result messages; four `MessageType` entries; the `messages/index.ts`
  unions; the `workshop-show-vs-tell` streaming domain and its
  `streamingCancelMessages` arm; a `show-vs-tell` arm in
  `RECOVERABLE_WIDGET_RESPONSE_CONTRACTS`.
- **`ShowVsTellResponseCodec`** (`infrastructure/api/services/widgets/showVsTell/`):
  sentinel and key-set parsing only. It derives ids with
  `showVsTellVariantId` / `showVsTellFlagId`, then runs
  `assertShowVsTellWorkupShape` and `assertShowVsTellWorkupIntegrity`. It
  restates no semantic rule.
- **`ShowVsTellService`**: one `widget`-scope call with
  `maxTokens: showVsTellOutputTokens`; validates the request (the persisted
  shape and integrity gates on a transient draft, plus source-material
  checks) before the engine is even acquired; `AbortSignal` passthrough;
  truncation (`finishReason: 'length'`) and codec rejections persist the paid
  body through the recovery store.
- **`WorkshopShowVsTellHandler`**: generate and cancel routes, fresh injected
  workup id per attempt, one active generation, supersede aborts, stale-result
  correlation, terminal progress, host-side source resolution.
- **Wiring.** `showVsTellService` in `CoreServices` (built only in
  `extension.ts`), a `showVsTell` port on `WorkshopWidgetRuntime`,
  `WorkshopSliceComposition` constructs the handler, registers its routes,
  disposes it, and adds the `'show-vs-tell'` busy-predicate arm.
  `ShowVsTellService` is exported from the `@prose-minion/core` barrel.
- **Guards.** Route-table entry (56 routes: 37 mutation, 19 direct),
  `WORKSHOP_COMPOSED_SLICE_HANDLER_NAMES`, approved-token regexes at the generic
  files already approved (no new generic file was approved, so the Prose
  Controller seam inventory is unchanged), `minimumSourceFiles` 6 → 9.
  Production availability stays on `WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY`.
- **Docs.** `AGENTS.md` and `.ai/central-agent-setup.md` list the new handler
  (eleven composed route owners).

Untouched, as scoped: UI, hooks, components, the catalog (`show-vs-tell` is
still `live: false`), commit and artifact, recommendation, editor writes, and
Creative Variations code beyond sibling arms in shared registries.

## Decisions made in 2b (Ada; the writer may override)

1. **Source material errors fail before spend, visibly.** A missing excerpt or
   context item becomes an `ok: false` result with the same copy Creative
   Variations uses. Over-budget passage text (250,000 characters) is rejected by
   the service, not truncated.
2. **Unknown payload keys are dropped, not rejected, at the handler.** The
   handler builds its transient draft from named fields (as Creative Variations
   does), so a webview that sneaks in `writerText` has it ignored. A test pins
   that the text never reaches the service.
3. **A failed attempt ends its progress stream.** Creative Variations posts
   only an error result on failure. Show vs. Tell posts a terminal
   `completed` progress and then the `ok: false` result, so the Slice 3 busy
   state has one rule: a terminal phase (`completed` or `cancelled`) ends the
   attempt. The result carries the outcome.
4. **Neutralization.** Writer and source text reach the model only as JSON
   string values inside the 2a task JSON, exactly as Creative Variations does.
   No new reserved tag exists, so `workshopPromptFrames.ts` is untouched; a
   test shows a hostile sentinel in the beat stays inert.
5. **`showVsTellGenerationDraft`** (Derivations) is the one place that turns a
   generate payload into a transient draft, so the handler and service
   validate against the same gates persistence uses.
6. **Busy predicate.** `WorkshopOneShotWidgetId` has no `show-vs-tell` member
   yet (it derives from the commit payload union), so the activity map is typed
   `Record<WorkshopOneShotWidgetId | 'show-vs-tell', …>`. Slice 4 adds the
   commit arm and can narrow it back.

## Verification

- `npm run typecheck`: core, webview, ext clean.
- `npm run lint`: 0 errors (warnings pre-existing; none added in new files).
- `npm test`: **277 suites / 3,788 tests / 2 snapshots, all passing** (2a tip:
  274 / 3,641 / 2).
- `npm run build`: compiled; `verify-bundle` OK.
- `git diff --check`: clean.
- `grep -rn "from 'vscode'" packages/core/src`: no source hits.
- Mutation pass: disabling the shorter-than-prose rule, the group-order check,
  and the supersede abort each turned tests red. Removing only the
  `activeGeneration !== attempt` conjunct stays green because `signal.aborted`
  already covers every path that clears it (supersede and cancel both abort
  first); it is defense in depth, not an uncovered case.

## What Slice 3 needs

**Messages (all `source: 'extension.workshop'` from the host).**

- Webview → host: `WORKSHOP_SHOW_VS_TELL_GENERATE`, payload
  `{ widgetId: 'show-vs-tell', token, beat, surroundingContext: { sourceReferences },
  pov, invariants, channels, lengthBudget, position }`. No passage text.
- Webview → host cancel: `CANCEL_SHOW_VS_TELL_GENERATE_REQUEST` through
  `createCancelRequestMessage('workshop-show-vs-tell', token, source)`.
- Host → webview: `WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS` and
  `WORKSHOP_SHOW_VS_TELL_RESULT`.

**Correlation.**

- Mint a fresh `token` per Generate and per Regenerate; never reuse one.
- The host mints the `workupId`. It appears on every progress and result
  message for the attempt and is never reused, even after a cancel or failure.
- Progress `phase`: `started` → `streaming`* → terminal `completed` or
  `cancelled`. `completed` is terminal for success **and** failure; read the
  result for the outcome. Stages: `requesting` → `workup` → `validating`.
- A result is posted at most once, only while its attempt is still active.
  After a cancel or supersede the host posts a `cancelled` progress and **no**
  result for that token. The webview must still ignore any message whose token
  is not the one it is waiting on.
- A new Generate supersedes the old one on the host (abort + `cancelled`
  progress for the old token). The webview should keep one in-flight token.
- Refusals: an unavailable widget returns `ok: false, error: 'That widget is
  not available yet.'` with a fresh `workupId` and **no** progress.

**Which inputs invalidate a workup.** Every generation input except `position`:
beat (text and provenance), `surroundingContext.sourceReferences` (the source
reference **is** an input), POV, both invariants, channels, and length budget.
Moving the position re-weighs the readout and changes what commits; it keeps
the workup and the kept variants. Regenerating clears kept variants and carry
modes before the new cards settle.

**Error copy the host can return in `error`** (show it; do not rewrite it).

- `That widget is not available yet.`
- `The active excerpt referenced by this widget is no longer available.`
- `Context item ctx-N is no longer available.`
- `Surrounding context exceeds 250000 characters`
- `OpenRouter API key not configured. Please set your API key in settings.`
- `The model returned an unusable Show vs. Tell workup (<reason>). <recovery
  location notice> Try Generate again.` (the recovery notice names the saved
  response file; a flag against a blank constraint adds its own next step)
- Request-shape failures read `Show vs. Tell request.<path> …` (for example a
  blank must-survive); the UI should prevent them rather than rely on them.

## What Slice 4 needs

- **Multi-line values (Q2).** `direction`, `gains`, `costs`, flag notes, and the
  invariants may contain line breaks (only the beat, the POV focal character,
  and the note are single-line). The artifact is line-keyed, so the projection
  must define a continuation-line format for multi-line `direction:` and
  `must survive:` / `must not change:` values, and redo the 585-character
  fit-guarantee arithmetic if that format adds characters.
- `surroundingContext` never rides the commit, and passage text is never
  stored. The commit draft carries the reference only.
- `WorkshopOneShotWidgetId` gains `show-vs-tell` then; narrow the busy-predicate
  map's key type back to it.

## Contract questions (also in the PR)

1. **2a: POV applies to told variants.** Without it a told variant in a
   non-matching POV would head-hop. Revisit if the writer wants it relaxed.
2. **2a: no `omniscient` exception.** The sprint states the rule without one.
3. **2a: mixed-group framing is split across `gains` and `costs`.** `gains`
   carries "usually the working answer"; `costs` opens with "Distrust it once".
4. **2a: the example's POV character** is the beat's subject (`close-third`,
   `Nora`, "she") so every variant, the told end included, is POV-legal.
5. **2b: prompt-only rules stay prompt-only.** "Gains:"/"Costs:" labels,
   Markdown, and morality words are not rejected by the response codec, since a
   response-only rule would let a workup be valid at reopen and invalid at
   generation, or the reverse. If the writer wants one enforced it belongs in
   the shared integrity gate; flagged, not added.
6. **Q3 (POV custody)** stays open until Slice 5.
