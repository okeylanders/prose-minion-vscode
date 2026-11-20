# ADR 2026-11-20: Passage Search, a Search That Reads

**Status:** Proposed (Slice 0). P1–P4 are Okey's. Every other default was taken by the orchestrator from the brief, or refined where the code showed the brief needed it; the epic README's "Defaults taken" table lists each, with why. None of those is an owner decision, and each is Okey's to overturn.
**Date:** 2026-11-20
**Epic:** [Passage Search](../../.todo/epics/epic-passage-search-2026-11-20/README.md)
(its "Defaults taken" table is binding here)
**Idea as filed:** `.todo/features/feature-passage-search/README.md` on `main`
(newer there than on the epic branch; never edited on this branch).
**Leaves room for:** `.todo/features/feature-workshop-research-agent/README.md`
(P3: a research run policy would call this engine under its own consent
rule; nothing here builds it).
**Extends:**
- [ADR 2026-10-21: Draft Edit](2026-10-21-draft-edit-engine-and-document-write-back.md):
  quotes, not offsets; `anchorQuote`; paragraph chunking; an estimate that
  names the model it priced, and a run that goes to that model.
- [ADR 2026-10-19: Lightbox](2026-10-19-lightbox-inspiration-board.md) D6/D7
  addendum of 2026-10-23: asks, not gates; the shared JSON parser and its
  salvage at the output ceiling.
- [ADR 2026-11-10: Reply Edit Actions](2026-11-10-workshop-reply-edit-actions.md):
  a host-started persona run with a directive (`runDirected`), which D18
  generalizes.
- [ADR 2026-11-17: Everyday Conveniences, Round Two](2026-11-17-everyday-conveniences-round-two.md)
  D13–D15 (trailer outcomes: one new kind) and D21–D25 (help).
- [ADR 2026-11-18: Workshop Context Breakdown](2026-11-18-workshop-context-breakdown.md):
  the results directive is tallied where it is placed.
- [ADR 2026-07-30: Session Codec Evolution](2026-07-30-workshop-session-codec-evolution.md):
  every session field here is optional and additive, with no
  `schemaVersion` bump.
- [ADR 2026-06-16](2026-06-16-monorepo-ports-and-adapters.md) and
  [2026-06-18](2026-06-18-messagehandler-composition-root-consolidation.md):
  the engine is built once, in `extension.ts`, and joins `CoreServices`.

Paths below that start `core/` are under `packages/core/src/`; `app/` is
`apps/vscode-extension/`.

## Context

**The gap.** The sidebar's Search tab has two subtabs (`SearchSubtool`:
`'word' | 'category'`). Word Search counts exact words and n-grams.
Category Search asks a model which of the text's *words* fit a category,
then counts them. Neither finds a *moment*: a gesture written five ways, or
a cliché in one character's dialogue. That needs a model to read.

**As the code stands:**
- **Sources.** `TextSourceResolver.resolve(spec)`
  (`core/infrastructure/text/`) returns one joined `text` and
  `relativePaths` for `activeFile`, `manuscript`, `chapters` and
  `selection`. It gives no per-file text and no per-file offsets, sorts
  nothing, and bounds nothing. Passage Search needs each file apart, so it
  cannot search the joined text.
- **The catalog.** `ContextResourceResolver.createProvider(groups)`
  (`core/infrastructure/context/`) returns a `ContextResourceProvider`
  (`listResources()`, `loadResources(paths)`), with no Workshop import. Its
  groups are `CONTEXT_PATH_GROUPS` (`core/shared/types/context.ts`):
  `characters`, `locations`, `themes`, `things`, `chapters`, `manuscript`,
  `projectBrief`, `general`. A catalog key is `ConfiguredResourceRef`
  (`{ group, path }`). `findConfiguredResource` is a pure function but
  lives under `application/services/workshop/`.
- **Chunking.** `chunkParagraphs(text, maxWords)`
  (`core/utils/draftEdit/chunkParagraphs.ts`) cuts on blank lines, never
  inside a paragraph, with no overlap.
- **Anchoring.** `anchorQuote(text, { quote, before?, after? })`
  (`core/utils/draftEdit/anchorEdits.ts`) returns `anchored` (a range),
  `unanchored` or `ambiguous`. It tries exact forms, then a normalized
  match, and fails closed on a form that matches twice.
- **The fan-out precedent.** `ProofreadService` runs chunks through
  `p-limit` at `PROMPT_BUDGETS.proofread.concurrency`. A key change detaches
  the engine's provider; the next call throws
  `AgentRunUnavailableError('missing-credentials')`, which
  `draftEditInterruptionOf` reads as `key-changed`, and queued chunks then
  go unsent. A reply at the ceiling is `finishReason === 'length'`.
- **The estimate precedent.** `CraftFlagsService.estimate` reads the
  engine's model once before anything awaits, sums
  `estimateRequestTokens` over the exact messages it will send, prices
  them through a port (`CraftFlagsPriceSource`), and the run sends every
  call to that model (`AgentRunOptions.model`). The "≈ $…" formatter is
  private to `craftFlagsSummary.ts`, with near-copies in two Lightbox
  modules.
- **Model scopes.** `ModelScope`, `FollowingModelScope` and
  `MODEL_SCOPE_FOLLOWS` (`core/shared/types/messages/configuration.ts`);
  `MODEL_SCOPE_SETTING_KEYS` and `resolveModelScopeSelections`
  (`core/infrastructure/api/orchestration/ModelScopeSelections.ts`);
  hand-declared bundles in `AIResourceManager.rebuildResources`;
  `MODEL_KEYS` in `MessageHandler`; rows in `SettingsOverlay.tsx`.
  `proseMinion.categoryModel` defaults to `openai/gpt-oss-120b:nitro`.
- **Saving a report.** `SAVE_RESULT` → `FileOperationsHandler.handleSaveResult`
  writes `prose-minion/reports/<tool-slug>-YYYYMMDD-HHMMSS.md` for a closed
  list of tool names, and throws for any other.
- **Opening at a line.** Nothing does. `ShellService.openFileInEditor(path,
  { beside? })` takes no line.
- **Natural order.** No comparator exists; every sort is `localeCompare`.
- **A host-started persona run.** `WorkshopRoomHandler.runDirected(target,
  WorkshopDirectedRun)` runs `executeMessage` with a directive frame. Today
  `WorkshopDirectedRun` requires `editOfferRequest`, `finalReply` and
  `complete`; a directed run hides the stream and carries no reminders,
  trailer outcomes or reaction invite. The press never learns the context
  window; only a capability's `fulfill(request, window?)` does.
- **Trailers.** `extractWorkshopReplyControls`
  (`core/utils/workshopReplyControls.ts`) reads every trailer in one pass
  (`TRAILER_TAGS`, `REDACTIONS`); `RESERVED_PERSONA_FRAME` is in
  `core/utils/workshopPromptFrames.ts`. The newest, the locations proposal,
  is the model for a card that commits with its reply.
- **No card shows progress and Stop for host work outside a turn.** A file
  edit's `applying` is a short write, read as `unknown` on reopen.

## Decisions

### The engine (P3)

**D1. One engine, two layers, no caller named.**
- **`PassageSearchService`** (`core/infrastructure/api/services/search/passage/`)
  owns the model work over files already in hand: chunks, the calls, the
  reply codec, anchoring, the merge, the organizing pass and the estimate.
- **`PassageSearchEngine`** (`core/application/services/passageSearch/`) is
  what callers hold. It resolves scopes to files (D3), then asks the
  service. It offers `plan(request)` and `run(plan, { signal, onProgress })`.
- It is built once, in `extension.ts`, and joins `CoreServices`. No handler
  constructs it.
- **Callers own consent.** The engine asks the writer nothing and shows
  nothing. `plan` sends nothing to a model; only `run` does.
- **A boundary test** (`boundaries.test.ts`, "Passage Search engine") holds
  that neither directory imports or names `workshop`, `lightbox`, a
  handler, `presentation/`, a persona, or the sidebar's messages. It may
  import `utils/draftEdit/chunkParagraphs`, `utils/draftEdit/anchorEdits`,
  `@parsers/*`, `@orchestration/*`, the context resolver, the platform
  ports and `shared/`. Its module lists are closed
  (`PASSAGE_SEARCH_MODULES`), and every module stays under 500 lines.

**D2. A plan is what was priced, and a run runs exactly that plan.**
`plan(request)` takes `{ question, scopes, organize }` and returns either a
refusal in host words (D6) or a `PassageSearchPlan`:
- the model, read once from the `passageSearch` engine before anything
  awaits;
- the files, in reading order (D4), each with its text as read and its
  SHA-256;
- the chunks (D5) and so the number of calls, plus one when `organize`;
- the estimate: `{ model?, files, calls, inputTokens, outputTokens, usd? }`;
- a `planKey`: a digest of the model, the question, `organize`, and each
  file's identity and hash.

`run(plan)` searches the texts the plan holds and sends every call to the
plan's model. It never resolves the model or reads a file again. A caller
that cannot keep a plan (a card across a reload) plans again and compares
`planKey` (D20). The estimate is approximate, never a cap.

**D3. Scopes (P4).** A request holds 1 to `scopes` (12) of:

| Kind | Names | Who may send it |
|---|---|---|
| `active-file` | the active editor's document | the sidebar |
| `selection` | the editor's selection | the sidebar |
| `group` | a `ContextPathGroup`: every file in it | any caller |
| `file` | a `ConfiguredResourceRef` | any caller |
| `pattern` | a writer-typed path or glob | the sidebar only |
| `text` | a label and a text, by value | any caller (the Workshop's excerpt) |

- **Files come from one catalog per operation.** `PassageSearchScopeFiles`
  opens `ContextResourceResolver.createProvider` once per `plan` and
  resolves every `group` and `file` scope against that one listing. It is
  never kept after the plan.
- **`findConfiguredResource` moves** to a neutral home
  (`core/application/services/ConfiguredResourceLookup.ts`), behavior
  unchanged; the Workshop imports it from there. The engine never imports
  a Workshop path.
- **`active-file` and `selection`** are read through `TextSourceResolver`
  and `EditorContext`, on the host, at `plan`. A selection's lines are the
  document's when the port gives its start line, else counted within the
  selection and said so.
- **`pattern`** goes through the context-paths pattern safety rules and
  `Workspace.findFiles` (`.md` and `.txt` only, the resolver's fixed
  excludes, symbolic links and escapes refused), as a context path does.
  The engine's request type marks it `writerTyped`; the Workshop's codec
  cannot produce one (D15), and a boundary test holds that no Workshop
  module constructs a `pattern` scope.
- **`text`** carries its own text and label. Its instances have a line
  within that text and nothing to open.
- **De-duplicated by file,** by the host's file identity, the first scope
  to name a file keeping it.

**D4. Reading order is the host's.** Scopes in the order given. Inside a
`group` or `pattern` scope, files by natural order of their paths: compared
segment by segment, the extension set aside, digit runs as numbers, so
`6.9` < `6.9.2` < `6.10` and `6.9.2.md` sorts after `6.9.md`. Then by
line. The comparator is new: `core/utils/naturalOrder.ts`, pure, with those
three names as a test.

**D5. A whole file per call when it fits; split at paragraphs with one
paragraph of overlap when it doesn't.**
- The budget is `PROMPT_BUDGETS.passageSearch.chunkWords` (12,000).
  - Craft Flags reads up to 25,000 words a call, because a category needs
    the whole chapter at once. Passage Search asks for *every* instance,
    and recall falls off over long texts, so it starts lower. 12,000 keeps
    nearly every chapter whole.
  - When the catalog knows the model's context length, the budget is
    lowered until a call's request and its output ceiling fit half the
    window. Below `minChunkWords` (1,500) the plan is refused
    (`model-too-small`).
- `passageChunks(text, maxWords)` (the engine's own module) calls
  `chunkParagraphs`, then starts each chunk after the first one paragraph
  earlier. `chunkParagraphs` gains only an exported `paragraphRanges`;
  Draft Edit's chunks do not change (a test holds its output).
- The text is read raw: nothing is masked.

**D6. Bounds and refusals.** In `PROMPT_BUDGETS.passageSearch`: `scopes`
(12), `files` (200), `calls` (300), `fileBytes` (2 MiB),
`questionCharacters` (400). A plan past a bound is refused before any file
past it is read, in host words that name the bound and the count. The
closed refusals: `no-key`, `no-question`, `no-scope`, `no-files`,
`too-many-files`, `too-many-calls`, `file-too-large`, `unknown-group`,
`unknown-file`, `ambiguous-file`, `unsafe-pattern`, `no-selection`,
`no-active-file`, `model-too-small`, `catalog-unreadable`. A file that
cannot be read as UTF-8 text is left out and counted, never a refusal.

### The reads

**D7. One call per chunk, a few at a time.**
- Run policy `AGENT_RUN_POLICIES.passageSearch`: no catalog, no rounds, no
  corrections, `discard`. Temperature 0. No reasoning setting is sent.
- `p-limit` at `concurrency` (4).
- The request is the system prompt
  (`core/resources/system-prompts/passage-search/`, with a worked example
  that decodes through the production codec, held by a sync test) and a
  user message holding the question and the chunk, each in its own frame,
  the chunk neutralized so it cannot close its frame.
- **A key change stops starting calls** (`key-changed`), as Proofread's
  does. **Stop** (the caller's signal) does the same. Either way the
  result keeps what was found (D11).
- **A failed call is that call's outcome,** counted; the run goes on.

**D8. The reply: asks, not gates.** JSON, read through `parseModelJson`;
at the output ceiling, `salvageModelJson` keeps the finished instances and
the call is counted `cut`.

```json
{ "instances": [ { "quote": "…", "before": "…", "after": "…", "note": "…", "label": "…" } ] }
```

- An empty list is a fine answer.
- `quote` is read whole, never clipped. `before` and `after` are optional
  context for choosing among repeats.
- Lengths and counts in the prompt (`quoteCharacters` 400, `noteCharacters`
  200, `labelCharacters` 40, `instancesPerCall` 80) are asks. One safety
  ceiling clips only `note`, with an ellipsis, and counts it. A `label`
  over its ceiling, or a `quote` over `safetyMultiple` times its ask, is a
  malformed instance, dropped and counted.
- Fields the format does not define are ignored and counted. A missing
  `quote` or `label`, or a wrong type, drops that instance only.
- A reply longer than `responseCharacters`, or one that does not parse,
  is that call's failure.
- Each repair is logged by kind, never with text.

**D9. Every quote is anchored by host code, in its own chunk.**
`anchorQuote(chunk.text, { quote, before, after })`:
- `anchored`: kept, with its range in the file;
- `unanchored`: dropped, `quote-not-found`;
- `ambiguous`: dropped, `quote-ambiguous`. The prompt teaches `before` and
  `after` for a phrase the chunk repeats. Failing closed here costs some
  repeats of a short phrase; that is the stated limit (Q1).

The host computes the line from the range. A model never gives a line, a
file or a count.

**D10. The merge.**
- **One moment shows once.** Within a file, instances whose ranges overlap
  are one: the earliest-starting kept, the rest counted `duplicate`. This
  covers the overlap paragraph and a model that lists a moment twice.
- **Labels are merged by a host key:** folded through
  `shared/utils/foldedTextSearch.ts`, whitespace collapsed. The first
  spelling in reading order is the one shown.
- **Instances are numbered** from 1, in reading order (D4). The number is
  the instance's id for the rest of the result.
- **At most `instances` (2,000) are kept.** Past it the run stops starting
  calls and says so (`instance-limit`).

**D11. The result is typed, and honest about what is missing.**
`PassageSearchResult` holds:
- `instances`: number, file (display path and the host's file key), line,
  quote, a little context either side (`contextCharacters`, 160), note,
  label key;
- `labels`: each with its count and file count, the host's table;
- `analysis?` (D12);
- `dropped`: counts by closed reason (`quote-not-found`, `quote-ambiguous`,
  `malformed`, `duplicate`);
- `calls`: planned, answered, failed, cut, unsent;
- `files`: read, left out;
- `ended`: `complete`, `stopped`, `key-changed` or `instance-limit`;
- `usage` and the model.

A result with unsent, failed or cut calls says so in host words wherever
it is shown. Nothing in the result is the model's count.

### The organizing pass (P1)

**D12. One call over the checked instances, never the text.**
- **Input:** the question, the label table with the host's counts, and each
  instance's number, file, line, label, quote and note, in reading order.
- **It runs only when** `organize` is set, the run ended `complete` or
  `stopped` with at least one instance, and the key still holds. It is one
  call on the same model and policy, priced in the estimate at
  `organize.typicalOutputTokens`.
- **Over `organize.inputTokens` (24,000),** instances are sampled evenly by
  position so the pass still spans the scope, and the result says "The
  analysis read 400 of 1,240 instances." in the host's words.
- **Output,** through `parseModelJson`:

```json
{ "headline": "…", "sections": [ { "title": "…", "claims": [ { "text": "…", "cites": [4, 12] } ] } ] }
```

**D13. What the host keeps of it.**
- **Citations.** A cite is kept only when it names an instance the pass was
  shown. A claim left with none is dropped and counted. A section left
  with no claim is dropped.
- **Quotations.** Any span a claim, title or headline puts in quotation
  marks must stand, folded, inside the quote of an instance the pass was
  shown (for a claim, one it cites). A claim that fails is dropped and
  counted. A headline that fails is replaced by the host's ("14 instances
  in 6 files").
- **Counts stay the host's.** The label table beside the analysis is the
  source of truth. A figure the pass writes is not checked: the stated
  limit.
- **Lengths are asks** (`headlineCharacters`, `sections`, `claims`,
  `claimCharacters`); free prose past the safety ceiling is clipped and
  counted.
- **A failed, malformed or cut-off pass leaves the list whole.** The result
  carries the reason; nothing found is lost.
- The result reads: headline, analysis, label table, every instance.

### The model and the price

**D14. A `passageSearch` scope that follows Category Search's.**
- `ModelScope` and `FollowingModelScope` gain `passageSearch`;
  `MODEL_SCOPE_FOLLOWS.passageSearch` is `'category'`.
- `proseMinion.passageSearchModel`, empty by default: it follows
  `categoryModel` until picked, and never writes it.
- It joins `MODEL_SCOPE_SETTING_KEYS`, `AIResourceManager`'s bundles,
  `MODEL_KEYS`, a row in the Settings overlay with its following copy
  (`MODEL_FOLLOW_COPY`), and `help/index.json`.
- **The estimate** prices the exact messages the run will send, through a
  price port of the engine's own (tests never reach the catalog). Output
  is priced at `typicalOutputTokens` a call, not the ceiling. With no live
  price, the estimate has calls and tokens and no `usd`, and callers say
  "price unavailable" beside the count.
- **One formatter.** `formatApproximateUsd` moves to
  `core/shared/utils/approximateUsd.ts`; Craft Flags' and the Lightbox's
  copies call it, their output unchanged (their tests hold it). "≈ $0.42",
  or "< $0.01". Never "up to".

### The sidebar

**D15. A third subtab, `passage`.** `SearchSubtool` gains `'passage'`;
`PassageSearchPanel` sits beside the other two; `usePassageSearch` is
tripartite, mirrored by `PassageSearchRoute`, registered by
`SearchHandler` (which stays under 500 lines by holding only the
registration).
- **Scope:** Active File, Selection, a checkbox per context group, and a
  path or pattern field. Several at once. A single-file picker is not
  built in the sidebar (default 12).
- **The press is two steps, both correlated.**
  1. `PASSAGE_SEARCH_PLAN_REQUEST { requestId, question, scopes, organize }`
     → `PASSAGE_SEARCH_PLAN { requestId, planId, estimate }` or a refusal.
     The panel shows "23 calls · ≈ $0.42 · <model>" and **Run**.
  2. `PASSAGE_SEARCH_RUN { requestId, planId }`. The host holds one plan
     per sidebar, the newest; any other `planId` is refused
     (`plan-expired`) and nothing is sent.
- Changing the question, a scope or the toggle drops the shown plan.
- **Progress** ("Reading 7 of 23 · 5 found") by `requestId`; **Stop**
  aborts and the result so far lands. Only the pending answer is taken.
- **Text never travels webview → host** but the question, the pattern and
  the scope choices. A selection is read on the host.
- **"Organize the results"** is a toggle, on by default, a UI preference in
  the hook's `persistedState` with the last scope choices. The question
  and the result are not persisted in `setState`.
- **Open at a line.** `ShellService.openFileInEditor` gains an optional
  `line`. The webview posts `PASSAGE_SEARCH_OPEN_INSTANCE { resultId,
  instance }`; the host finds the file and line in the result it holds.
  The webview never sends a path.
- **Copy and Save.** The report is Markdown built by a pure formatter
  shared with the Workshop card (D21): headline, analysis, table,
  instances, what was dropped and why. `SAVE_RESULT` gains
  `passage_search`, saved as `prose-minion/reports/passage-search-….md`.

### Personas (P2)

**D16. The trailer.** A host or guest reply may end with one
`<prose-minion-passage-search>`:

```xml
<prose-minion-passage-search>
<question>Find every time Jasper adjusts his glasses.</question>
<group>chapters</group>
<path group="characters">jasper.md</path>
</prose-minion-passage-search>
```

- `<question>` once, within `questionCharacters` (300).
- 1 to `scopes` (8) of: `<group>` (every file in it), `<path group="…">`
  (one file, as `resource.read` names one), `<excerpt/>` (the room's
  excerpt, as a `text` scope).
- **No free path and no pattern.** The codec has no such field.
- It joins `TRAILER_TAGS`, `REDACTIONS` and `RESERVED_PERSONA_FRAME`, and is
  read in `extractWorkshopReplyControls`' one pass. A second frame is
  dropped (`extra`). A pressed edit offer's answer never carries one.
- A reply of nothing else reads "Asked for a passage search."
- **No setting.** Nothing is sent to a model until the writer presses Run.
- Bounds are `PROMPT_BUDGETS.workshopPassageSearch`. The grammar is
  `workshop-personas/passage-search-request.md`, in
  `WORKSHOP_TOOL_USE_PROMPT_PATHS`, in every persona's chain, held to the
  codec by `passageSearchRequestPromptSync.test.ts`.

**D17. Settled before the reply commits; the card commits with it.**
- Settlement checks form, then each group and file against one catalog
  for the operation (`unknown-group`, `unknown-file`, `ambiguous-file`,
  `no-excerpt`, `catalog-unreadable`). It reads no file and prices nothing.
- A bad frame is dropped with its typed reason and gives no card.
- The card is `passageSearchRequest` on the reply turn: the question, the
  scopes as named, and `answer?: 'cancelled'`. Optional and exact, in its
  own decoder (`WorkshopPassageSearchRecords`), with no `schemaVersion`
  bump. Fixture: `workshop-session-v2-before-passage-search.json`.
- **Trailer outcomes** gain a `passageSearch` side: `cards` and `dropped`,
  with the reasons above plus `malformed` and `extra`. Mapping, words and
  the conservation test as ADR 2026-11-17 D13 requires. Run and Cancel are
  the writer's answers and are never told through outcomes.

**D18. A directed run that is not an edit offer.** `WorkshopDirectedRun`
becomes a union on its request: an edit offer's (unchanged: hidden stream,
`finalReply`, its own `complete`) or a **results delivery**. A results
delivery:
- records a writer-role request turn with `passageSearchResults` (D19)
  and the host's line;
- places one directive frame, `<prose-minion-passage-search-results>`;
- streams, expects ordinary prose, completes through `completeWorkshopRun`,
  and so may carry trailers and gets trailer outcomes next turn;
- rolls its request turn back if the run fails, as a press does.

`AgentRunEngine` gains no branch and names no feature.

**D19. Status is derived from the ledger, never stored.**
`workshopPassageSearchStatus(ledger, turnId, { running })`:

| Status | When | The card |
|---|---|---|
| `pending` | no answer, no results turn | the estimate, **Run**, **Cancel** |
| `running` | this window's handler is searching it | progress, **Stop** |
| `ready` | searched; the room was busy at the finish | **Send to <persona>** |
| `delivered` | a later turn holds `passageSearchResults` naming it | counts, **Open report** |
| `cancelled` | `answer: 'cancelled'` | "Cancelled." |

- `running` and `ready` are the window's, never persisted. A reload, a
  closed tab or a replaced room stops the search; the card reads
  `pending` again and nothing reached the room. Calls already made are
  spent: the card's confirm says a run cannot be resumed.
- `passageSearchResults` on the request turn holds ids and counts only:
  the request's turn id, instances, files, labels, dropped, calls, how it
  ended, whether it was organized. Optional and exact.
- A Rewind that removes the request removes its card; one that removes
  only the results turn makes the card `pending` again. Rewind needs
  nothing of its own.

**D20. The card's price and Run.** `WorkshopPassageSearchHandler` (the
26th composed route owner) owns the routes, each with a webview-minted
`requestId` and `roomRevision`:
- **`…_ESTIMATE`** (a read, never behind the mutation gate): the handler
  builds the engine request from the stored card, calls `plan`, and
  answers the estimate and its `planKey`, or the refusal in host words.
  The card asks when it is first drawn `pending`.
- **`…_RUN { turnId, planKey }`**: plans again and runs only when the new
  `planKey` equals the one the writer saw. Otherwise it answers the new
  estimate (`price-changed`) and sends nothing. **The price is never
  skipped.**
- **`…_STOP`**, **`…_CANCEL`** (stores `answer`, behind the gate),
  **`…_SEND`** (for `ready`), **`…_OPEN_REPORT`**.
- One search at a time per window's Workshop; a second Run is refused in
  the room's busy words.
- The search runs on the `passageSearch` scope. The persona's model never
  reads the files.
- A room replaced mid-search (`roomRevision` moved, or the turn gone)
  aborts it. Nothing is delivered to another room.

**D21. Delivery.**
- **When the search finishes and the room is idle,** the handler starts the
  results delivery to the reply's author, in that participant's own
  conversation. If a run is active, the card reads `ready` and waits for
  **Send**.
- **A search with no instance is still delivered,** with what was read and
  what was dropped, so the persona can say so.
- **The directive** carries, in order: the question; how the search ended
  and what is missing, in host words; the headline and analysis; the label
  table; then instances, whole, in reading order. Every model-written or
  writer-written string is neutralized
  (`neutralizeReservedPersonaPromptDelimiters`). It is evidence, never
  instructions, and says so.
- **Fitted to half the room left,** by whole instances, through
  `reads/WorkshopReadWindowFit`. A cut directive says how many instances
  it holds of how many, and that the report has the rest.
  - The window reaches the directive through a seam that names no feature.
    The slice chooses between a function-valued directed frame the engine
    calls with the window before dispatch, and measuring in the room
    handler with `measureContextWindow`. Either way `AgentRunEngine` has
    no Workshop branch.
  - With no window known, the bound is
    `PROMPT_BUDGETS.workshopPassageSearch.resultsTokens` (6,000).
- **Tallied where it is placed,** under a new piece,
  `room.passage-search` ("Passage search results"), in
  `WORKSHOP_CONTEXT_TALLY_PIECES`.
- **The report.** The handler holds the newest `heldResults` (4) full
  results, per window, by request turn. **Open report** saves the shared
  Markdown report under `prose-minion/reports/` and opens it. After a
  reload the card says the report is no longer held.
- **Transcript and export.** The card is one event line ("Asked for a
  passage search of 2 scopes."), and the results turn one ("Passage search
  finished: 14 instances in 6 files."). Neither projects the question's
  scopes as paths, an instance or the analysis.

### Across the feature

**D22. Logs carry counts, ids and fault kinds only.** Never the question,
a quote, a note, a label, a headline, a claim, a pattern, a path or a
group's file names. The engine logs one line per plan and per run (files,
calls, instances, drops by reason, repairs by kind, tokens, milliseconds).

**D23. Tests.** No live, billable call. The engine's calls run against a
mocked transport. Fixtures use *Alice*-style text. The deterministic edges
each have a test: chunks and overlap, anchoring and each drop reason, the
merge, natural order, the plan's bounds and refusals, `planKey`, the
estimate's messages equal to the run's, Stop, a key change, a cut reply's
salvage, the organizing pass's citation and quotation checks, the trailer
codec and prompt sync, status derivation, the directive's fit and
neutralization, and `price-changed`.

**D24. Help.** `sidebar-tools.md` gains Passage Search; `workshop.md`
gains the persona's request; `settings.md` and `help/index.json` gain the
model setting. Each lands with the slice that builds its surface.

## Consequences

- **A paid fan-out is new.** A manuscript-wide search can be hundreds of
  calls. The bounds (D6), the count shown first and the two-step press
  (D15, D20) are the controls. There is no spending cap.
- **`ShellService` gains an optional `line`.** Every host implements it;
  a host that cannot reveal a line opens the file.
- **`WorkshopDirectedRun` becomes a union.** Edit offers' behavior is
  pinned by their existing tests, which must pass unchanged.
- **Plans hold file text in memory** until they run or are replaced: at
  most `files` × `fileBytes`, one plan per caller.
- **A persona's search does not survive a reload mid-run.** Durable,
  resumable runs are out of scope (Q3).
- **A research agent** can later call `PassageSearchEngine.plan` and `run`
  under its own consent rule, with `group`, `file` and `text` scopes, and
  read the typed result. Nothing here needs to change for it.

## Open questions

- **Q1. Ambiguous quotes.** D9 drops a quote its chunk holds twice unless
  context places it. If the live pass shows too many lost repeats, the
  alternative is to keep the first unclaimed occurrence. Default: fail
  closed.
- **Q2. `chunkWords`.** 12,000 is a starting point for the live pass.
- **Q3. Resumable persona searches.** Default: not built.
- **Q4. A figure in the analysis** is not checked against the table (D13).
- **Q5. Bring a sidebar result to the Workshop.** Later; it stays in the
  source note.
- **Q6. A single-file picker in the sidebar.** Later (default 12).
