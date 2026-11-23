# ADR 2026-11-20: Passage Search, a Search That Reads

**Status:** Accepted and built (PRs #292–#297, merged into `epic/passage-search` at `e54cc784`); in Okey's live pass. Slice 5 (S42–S49, narrowing a group and the group inventory) is Okey's change from the live pass, 2026-11-23; S50–S52 were added while building it, and S53 after its review (PR #298). Revised 2026-11-20 after PR #292's review (D2a, D3a, D5a, D9a, D11a, D12a, D19a) and its re-review (D19a's rollback; see "Amendments after review"). Amended while building: S1–S23 (the engine and its review), S24–S41 (the review rounds of Slices 2–4). P1–P4 are Okey's. Every other default was taken by the orchestrator from the brief, or refined where the code showed the brief needed it; the epic README's "Defaults taken" table lists each, with why. None of those is an owner decision, and each is Okey's to overturn.
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
- a `planKey` (D2a).

`run(plan)` searches the texts the plan holds and sends every call to the
plan's model. It never resolves the model or reads a file again. A caller
that cannot keep a plan (a card across a reload) plans again and compares
`planKey` (D2a, D20). The estimate is approximate, never a cap.

**D2a. `planKey` is everything the writer was shown, and everything that
decides what is sent** (PR #292 F1). It is a digest of:
- the model, the question and `organize`;
- each file's identity and hash, and the files left out;
- the call plan as computed: the word budget in force (D5a), and each
  chunk's file and range, so the number of calls;
- the token figures of the estimate;
- the pricing basis: the per-token prices read, or that none was
  available.

Two plans with the same key show the same line and send the same
requests. Any difference (a live price that moved, a price that appeared
or went away, a context length that changed the chunks) is a different
key, and a Run naming the old key gets the new estimate and sends
nothing. Tests: unchanged files with a changed price, with a price gone
unavailable, and with a changed chunk budget.

**D3. Scopes (P4).** A request holds 1 to `scopes` (12) of:

| Kind | Names | Who may send it |
|---|---|---|
| `active-file` | the active editor's document | the sidebar |
| `selection` | the editor's selection | the sidebar |
| `group` | a `ContextPathGroup`: every file in it | any caller |
| `file` | a `ConfiguredResourceRef` | any caller |
| `pattern` | a writer-typed path or glob | the sidebar only |
| `text` | a label and a text, by value | any caller (the Workshop's excerpt) |

- **Files come from one listing per operation** (D3a).
  `PassageSearchScopeFiles` asks for it once per `plan` and resolves every
  `group` and `file` scope against it. It is never kept after the plan.
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
- **De-duplicated by file,** by the host's file identity (D3a), the first
  scope to name a file keeping it.

**D3a. The listing is root-aware, keeps every group a file belongs to, and
never hides a failed scan** (PR #292 F2). The browse catalog
(`collectResources`) cannot serve a search: it keys files by relative
path, so the same relative path in two workspace roots is one entry; it
keeps a file in the first group that matched it only; and a failed
`findFiles` is logged and skipped.
- The engine reads through a new read-only resolver method,
  `listGroupFiles(groups)`, in `authoritative` mode. The browse catalog
  and the pickers that read it are unchanged.
- **Identity is the absolute path,** compared as the platform compares
  paths. Two roots holding `chapters/1.md` are two files.
- **A group is every file its own patterns match.** A file matched by both
  `chapters` and `manuscript` is in both; a search of either reads it, and
  a search of both reads it once. This is wider than the picker, which
  shows such a file under one group (default 28).
- **A `file` scope** is looked up in its named group's own files.
  One match is the file. A relative path two roots both hold is
  `ambiguous-file`, never the first root's.
- **A scan that fails refuses the plan** (`catalog-unreadable`). A plan
  never reads fewer files than the scope names without saying so.
- Tests: the same relative path in two roots; one file in two groups,
  searched by each and by both; one failed scan.

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
- `passageChunks(text, budget)` is the engine's own module.
  `chunkParagraphs` gains only an exported `paragraphRanges`; Draft Edit's
  chunks do not change (a test holds its output).
- The text is read raw: nothing is masked.

**D5a. The bound is on the request as rendered, overlap included** (PR
#292 F3). `chunkParagraphs` keeps a paragraph over the budget whole, and
adding an overlap paragraph to a full chunk would put it over.
- **The overlap is inside the budget.** A chunk's body and its overlap
  together stay within `chunkWords`. The overlap is the previous chunk's
  last paragraph, or only its closing sentences when that paragraph is
  longer than `overlapWords` (600).
- **A paragraph over the budget is split at sentence ends**
  (`proseSentenceSpans`), into pieces within the budget, each after the
  first overlapping the one before by a sentence.
- **A sentence over the budget cannot be split.** Its file is left out,
  counted as `unsplittable`, and the estimate says so before anything is
  sent ("1 file left out: it has no place to split"). If no file is left,
  the plan is refused (`no-files`).
- **Each chunk's rendered request is then measured**
  (`estimateRequestTokens` over the exact messages) with its output
  ceiling. When the context length is known, every request fits half the
  window, or the budget is lowered and the file chunked again; below
  `minChunkWords` the plan is refused (`model-too-small`).
- Tests: a paragraph over the budget; two adjacent chunks each near the
  limit; an overlap paragraph over `overlapWords`; a sentence over the
  budget.

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
- **After Stop or a key change the engine starts no model work at all**
  (D12a): no queued read, and no organizing pass.
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

**D9a. What is shown is the source, never the model's spelling** (PR #292
F7). `anchorQuote` also matches normalized forms (curly and straight
quotation marks, spaces, an ellipsis) and returns a range. Once anchored,
the instance's `quote` is `file.text.slice(start, end)` of the plan's
frozen text, and its context either side is cut from the same text. The
model's `quote`, `before` and `after` are discarded. The organizing pass
(D12), the quotation check (D13), the report and the persona's directive
(D21) all read the source slice. Test: a model quote with straight marks
anchored on curly ones shows the curly source, exactly.

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

**D11a.** Every `quote` and context in the result is a slice of the plan's
frozen text (D9a).

A result with unsent, failed or cut calls says so in host words wherever
it is shown. Nothing in the result is the model's count.

### The organizing pass (P1)

**D12. One call over the checked instances, never the text.**
- **Input:** the question, the label table with the host's counts, and each
  instance's number, file, line, label, quote and note, in reading order.
- **Inside `run`, it starts only when** `organize` is set, the reads ended
  `complete` or `instance-limit`, and there is at least one instance. It
  is one call on the same model and policy.
- **Over its input bound (D12a),** instances are sampled evenly by
  position so the pass still spans the scope, and the result says "The
  analysis read 400 of 1,240 instances." in the host's words.

**D12a. Stop starts nothing; the pass is priced as an allowance; its whole
request is bounded** (PR #292 F4, F6).
- **A stopped or key-changed run returns its checked instances and no
  analysis.** `run` never starts the pass after either, even when the stop
  lands between the last read and the pass. The signal is read again
  immediately before the pass is dispatched.
- **Organizing afterwards is a separate, explicit action.** The engine
  offers `planOrganize(result)` and `organize(result, organizePlan)`. This
  plan's input is exact, since the instances exist. The sidebar shows it
  as **Organize these results** with its own "1 call · ≈ $…" (D15); a
  caller that never offers it never calls it.
- **Inside the first estimate the pass is an allowance, and is said to
  be.** What it will read does not exist yet. The estimate has two parts:
  - the reads: exact input, `typicalOutputTokens` a call;
  - the organizing pass: `organize.allowanceInputTokens` (6,000) in and
    `organize.typicalOutputTokens` out.

  The shown line is their sum, still "≈", and its detail says "includes an
  allowance for organizing the results". Both parts are in `planKey`.
- **The whole rendered request is bounded:** prompt, question, label
  table and instances together fit the smaller of `organize.inputTokens`
  (24,000) and half the model's window, measured with
  `estimateRequestTokens`, with the output ceiling reserved.
  - The label table is bounded first: at most `organize.labels` (60), most
    used first, then one line counting the rest.
  - Instances then take what is left, sampled evenly when they do not all
    fit.
  - If not one instance fits, the pass is not run, and the result says so.
- **The estimate covers the search only.** A persona's reply to the
  results is an ordinary turn on the room's model; the card says so (D20).
- Tests: Stop while reads are in flight; Stop after the last read and
  before the pass; a label table over its bound; the allowance in the
  estimate and in `planKey`.
- **Output,** through `parseModelJson`:

```json
{ "headline": "…", "sections": [ { "title": "…", "claims": [ { "text": "…", "cites": [4, 12] } ] } ] }
```

**D13. What the host keeps of it.**
- **Citations.** A cite is kept only when it names an instance the pass was
  shown. A claim left with none is dropped and counted. A section left
  with no claim is dropped.
- **Quotations.** Any span a claim, title or headline puts in quotation
  marks must stand, folded, inside the source quote (D9a) of an instance
  the pass was shown (for a claim, one it cites). A claim that fails is dropped and
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
- **The estimate** prices the exact messages the read calls will send
  (the organizing pass is an allowance, D12a), through a
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
  aborts and the result so far lands, with no analysis and no further
  call (D12a). Only the pending answer is taken.
- **Organize these results** shows on a stopped or key-changed result that
  holds an instance, with the toggle on. It is its own two-step press
  (`PASSAGE_SEARCH_ORGANIZE_PLAN_REQUEST`, then `…_ORGANIZE_RUN`), by
  result id and request id.
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
- Settlement checks form, then each group and file against D3a's
  authoritative listing (`listGroupFiles`), one for the operation (`unknown-group`, `unknown-file`, `ambiguous-file`,
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
- records a provisional writer-role request turn with the host's line;
- places one directive frame, `<prose-minion-passage-search-results>`;
- streams, expects ordinary prose, completes through `completeWorkshopRun`,
  and so may carry trailers and gets trailer outcomes next turn;
- on adoption, stamps the persona's reply turn with
  `passageSearchDelivery` (D19a), in the reply's own commit;
- removes its request turn on every outcome that is not an adopted reply
  (D19a).

`AgentRunEngine` gains no branch and names no feature.

**D19. Status is derived from the ledger, never stored.**
`workshopPassageSearchStatus(ledger, turnId, { running })`:

| Status | When | The card |
|---|---|---|
| `pending` | no answer, no results turn | the estimate, **Run**, **Cancel** |
| `running` | this window's handler is searching it | progress, **Stop** |
| `ready` | this window holds its result, undelivered | counts, **Send to <persona>**, **Open report**, **Discard** |
| `delivered` | an adopted reply turn holds `passageSearchDelivery` naming it | counts, **Open report** |
| `cancelled` | `answer: 'cancelled'` | "Cancelled." |

- `running` and `ready` are the window's, never persisted. A reload, a
  closed tab or a replaced room stops the search; the card reads
  `pending` again and nothing reached the room. A held result is lost
  with the window too. Calls already made are spent: the card's confirm
  says a run cannot be resumed.
- A Rewind that removes the request removes its card; one that removes
  only the persona's reply to the results makes the card `pending` again
  (`ready`, while this window still holds the result). Rewind needs
  nothing of its own.

**D19a. Delivered means the persona's reply was adopted** (PR #292 F5).
The request turn is written before dispatch, and ordinary completion can
abandon a run (Stop, a missing key, a failed retention) and leave that
turn behind. So the request turn proves nothing.
- **The receipt is on the reply.** `passageSearchDelivery` on the
  persona's adopted reply turn holds ids and counts only: the card's turn
  id, instances, files, labels, dropped, calls, how the search ended,
  whether it was organized, and how many instances the directive held.
  Optional and exact. It is written in the reply's own commit, never
  after. Status reads only this field.
- **A delivery that is not adopted removes its request turn** and leaves
  the card `ready`: the result is still held, and **Send** tries again
  without searching again.
- **The rollback happens where the run is given up, never after** (PR
  #292 re-review). `completeWorkshopRun` calls `session.abandonRun` on
  each non-adoption branch before it returns, which clears `activeRun`;
  `rollbackMessageRun` called afterwards finds no run and removes
  nothing. So a wrapper around `completeWorkshopRun` cannot do it.
  - `completeWorkshopRun`'s input gains a feature-neutral
    `notAdopted?: 'abandon' | 'rollback'`, default `'abandon'`. With
    `'rollback'`, every branch that today calls `abandonRun` (cancelled, no
    key, no retained conversation) calls `rollbackMessageRun(requestId)`
    in its place, while `activeRun` still names the run. Nothing else in
    the function changes. A results delivery passes `'rollback'`; every
    other caller passes nothing and behaves as today (their tests hold it).
  - **A thrown failure** (a provider error, a dispatch that never returns
    a result) never reaches `completeWorkshopRun`. It takes the room
    handler's existing failed-directed-run path, which calls
    `rollbackMessageRun` before the run is cleared, as a press's does. The
    delivery is a directed run, so it is on that path already; a test
    holds it for this request kind.
  - **Neither path touches the held result.** The handler drops a held
    result only on an adopted delivery's eviction (`heldResults`), on
    **Discard**, or when its room is replaced.
  - Edit-offer completion (`completeWorkshopEditOfferRun`) is unchanged.
- **A request turn with no receipt after it is never read as delivered,**
  whatever left it there (a crash between the two commits). On reopen such
  a card is `pending`.
- **Every send checks first,** with nothing awaited between the check and
  the dispatch: the room revision the search began in, the card's turn
  still in the ledger, its author still a participant, and no run active.
  A failed check sends nothing and says why.
- Tests: for each non-adoption branch of `completeWorkshopRun` (Stop, no
  key, no retained conversation) and for a thrown provider failure, the
  delivery leaves no request turn, no active run, and a `ready` card with
  its result; Send after it delivers without a second search; a session
  reopened with an orphan request turn reads `pending`; a participant
  removed before Send.

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
  **`…_SEND`** and **`…_DISCARD`** (for `ready`), **`…_OPEN_REPORT`**.
- The card's price line ends "The search only. <Persona>'s reply to the
  results is an ordinary turn."
- One search at a time per window's Workshop; a second Run is refused in
  the room's busy words.
- The search runs on the `passageSearch` scope. The persona's model never
  reads the files.
- A room replaced mid-search (`roomRevision` moved, or the turn gone)
  aborts it. Nothing is delivered to another room.

**D21. Delivery.**
- **When the search ends `complete` (or `instance-limit`) and the room is
  idle,** the handler starts the results delivery to the reply's author,
  in that participant's own conversation, after D19a's checks. If a run
  is active, the card reads `ready` and waits for **Send**.
- **A stopped or key-changed search is never delivered by the host**
  (D12a). Its card reads `ready` with what was found ("Stopped: 9
  instances from 7 of 23 reads") and **Send partial results to
  <persona>**, **Open report** and **Discard**. The persona's turn starts
  only on that press. The persona's card has no organize action.
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
estimate's read-call messages equal to the run's (the organizing pass is
an allowance, D12a), Stop, a key change, a cut reply's
salvage, the organizing pass's citation and quotation checks, the trailer
codec and prompt sync, status derivation, the directive's fit and
neutralization, and `price-changed`.

**D24. Help.** `sidebar-tools.md` gains Passage Search; `workshop.md`
gains the persona's request; `settings.md` and `help/index.json` gain the
model setting. Each lands with the slice that builds its surface.

## Amendments after review

PR #292, Astra's design review of `b35e5203` (2026-11-20), seven findings,
all taken:

| Finding | Was | Now |
|---|---|---|
| F1 (P1) | `planKey` covered the model and the text | D2a: it covers the call plan, the token figures and the pricing basis too |
| F2 (P1) | scopes resolved against the browse catalog | D3a: a root-aware listing, every group a file is in, a failed scan refuses |
| F3 (P1) | a word budget on chunk bodies | D5a: overlap inside the budget, oversized paragraphs split, each rendered request measured |
| F4 (P1) | the pass could follow Stop; delivery was automatic | D12a, D21: Stop starts nothing; organizing and sending a partial result are explicit presses |
| F5 (P1) | `delivered` read the request turn | D19a: a receipt on the adopted reply; a failed delivery leaves the card `ready` |
| F5, re-review (P1) | the rollback wrapped `completeWorkshopRun`, after `abandonRun` had cleared the run | D19a: `notAdopted: 'rollback'` inside the completion, and the directed run's own path for a thrown failure |
| F6 (P2) | the pass priced at a typical output only | D12a: an allowance, said to be one; the whole request bounded; the persona's turn named as apart |
| F7 (P2) | the model's quote was shown | D9a: the frozen source slice, everywhere |

## Amendments from Slice 1 (the engine)

What building the engine changed or settled. Each is the orchestrator's
default, and Okey's to overturn.

| # | Decision | As built | Why |
|---|---|---|---|
| S1 | D8 | `salvageModelJson` gains an opt-in `arrayItems`: a cut array keeps its finished items. Default behaviour is unchanged. | It kept only finished root members, so a cut `{"instances":[…` lost every instance. The option is the parser's and names no feature. |
| S2 | D6 | Two more refusals: `question-too-long`, `too-many-scopes`. | D6 named both bounds and gave neither a reason. |
| S3 | D7, D11 | `failureStreak` (5) provider errors in a row, with no answered call between, stop the run: queued calls go unsent, `ended` is `provider-failed`, what was found is kept, and no organizing pass starts. An unreadable reply neither adds to the streak nor resets it. | A key out of credits would otherwise make up to 300 failing calls. Calls already in flight when the streak trips still finish. |
| S4 | D2, D12a | A plan asks for the organizing pass only when an organizer is present (`organizer.available`). With none, `organize: true` plans no call and no allowance. | The estimate must not price a call that cannot run. |
| S5 | D3 | `active-file` is read by the engine's own strict file reader (size bound, strict UTF-8), its identity from `EditorContext`; the engine does not use `TextSourceResolver`. | One reader, one set of bounds, for every file. |
| S6 | D3, D3a | The engine does not call `findConfiguredResource`. `PassageSearchScopeFiles` has its own root-aware lookup. The function still moved to its neutral module. | Its exact-match-first rule returns the first root's file and would hide the ambiguity D3a requires. |
| S7 | D1 | The engine also imports `@/tools/measure/passageProseStats` (`proseSentenceSpans`), `@providers/OpenRouterModels`, `@/utils/textUtils`, `@/utils/tokenUsage`, `ContextPathPatternSafety` and `@/utils/configuredResourcePath`. The boundary test lists them. | D5a needs the sentence rule and D3 the pattern rules; the rest are leaf helpers. |
| S8 | D14 | The price port is `facts(model)`: `pricing?` and `contextLength?`. | D5a needs the window from the same catalog read. |
| S9 | D11 | The result also holds the `question`, `leftOut.empty` (files with no words), `overLimit` (instances past the bound) and `analysisMissing` (why a started pass left no analysis). | Each is something the writer must be told. |
| S10 | D10 | Overlap is judged against the instance that stands. A range clear of the kept one is its own moment, even when a dropped one touched both. | A chain of touching ranges would otherwise swallow distinct moments. |
| S11 | D10, D11 | `instance-limit` is reported only when something was lost: an unsent call or an instance over the bound. | Reaching exactly the bound on the last call loses nothing. |
| S12 | D5a | The overlap gives way first: it shrinks to nothing when it leaves no room beside the chunk's first unit. | A chunk must always make progress. |
| S13 | D3 | A selection and its whole file are separate identities, so naming both can show a moment twice. | The stated limit. |
| S14 | D7 | Neutralizing the frames rewrites `<` in a `passage-search-` tag. A quote running through such a tag does not anchor. | The stated limit; a manuscript does not hold these tags. |
| S15 | D14 | The Lightbox call control keeps its own price format (it prints "≈ $0.00" at exactly zero). Craft Flags and the saved-boards view use the shared formatter. | "Output unchanged" came first. |
| S16 | D24 | `help/index.json` maps the model setting to the Category Search section until Slice 2 writes Passage Search's. | No section exists yet. |

After PR #293's review (Astra, 2026-11-20; six findings and a follow-up,
all taken):

| # | Decision | Now | Why |
|---|---|---|---|
| S17 | D3 | Active file and Selection read one snapshot of the *current* editor (`currentSelection()`), taken synchronously at the top of `plan`. No current editor is `no-active-file`; an empty selection is `no-selection`. Nothing is substituted. | The remembered selection could name a document the writer had left (F1, P1). |
| S18 | D7, D12a | The run asks the engine it holds `isProviderAvailable()` at each admission, when the reads settle, and immediately before the organizing pass. A retired engine ends the run `key-changed`. | A rotation after the last read was admitted raised no error, so the run read `complete` and could organize (F2, P1). |
| S19 | D11 | `calls` adds `cancelled`: dispatched, then cancelled or aborted in flight, its usage kept. `unsent` is only a call that never started. `answered + failed + cancelled + unsent = planned`. A call aborted in flight may have been charged with no usage reported: its usage is recorded as unknown, so the run keeps its known token counts and counts the request, and claims no cost or cache total (re-review). | F3. |
| S20 | D11 | `files` is `{ planned, searched: { full, partial, none }, leftOut }`, and each file carries its chunks planned, admitted and answered. A file never searched no longer looks like a file with no hits. | F4. |
| S21 | D6 | `calls` (300) bounds the whole plan: a planned organizing call takes one place, so at most 299 reads beside it. | F5. |
| S22 | D10 | The merge orders candidates by file, start, chunk index, then reply item, before judging overlaps. The result does not depend on which reply arrived first. | F6. |
| S23 | D2a | The plan holds its output ceilings, and `planKey` covers them. | The follow-up: a changed ceiling must be a changed key. |

Values chosen where the ADR gave none: `outputTokens` 12,000,
`typicalOutputTokens` 800, `responseCharacters` 120,000, `safetyMultiple`
4, and in `organize`: `outputTokens` 4,000, `typicalOutputTokens` 1,200,
`headlineCharacters` 160, `sections` 8, `claims` 8, `claimCharacters` 300.

## Amendments from Slices 2–4 (review rounds)

What Astra's reviews of PRs #294, #295 and #296 changed or settled. Each
is the orchestrator's default, and Okey's to overturn.

### The sidebar (PR #294)

| # | Decision | Now | Why |
|---|---|---|---|
| S24 | D3, D15 | A file outside the workspace is shown by its name only (`passageSearchDisplayLabel`, in the engine's scope module, applied again at the view boundary). Opening still uses the host-held result. | An exterior editor path reached the panel and the report. |
| S25 | D15 | A result is headed "Results for: …" with the question it was searched for, never the field's current text. | The question shown could differ from the one searched. |
| S26 | D15 | Copy and Save send only `{ requestId, resultId }`. The host builds the report from the view it holds (`PassageSearchReportExport`), copies it through its own clipboard, and logs status and fault kind only. `SAVE_RESULT` no longer takes `passage_search`. | Report text crossed webview → host. |
| S27 | D12a, D15 | The engine says whether an organizer is present (`organizerAvailable()`), and the sidebar offers **Organize these results** from it, never from a trial plan. | A trial plan failed after a key change and hid the action. |

### The organizing pass (PR #295)

| # | Decision | Now | Why |
|---|---|---|---|
| S28 | D12a | A run hands its own engine to the organizer, which uses only that engine inside a run. Credentials and the stop signal are read again just before dispatch, and credentials again when the call returns. | A key change during preparation could send the pass on the replacement engine. |
| S29 | D7, D11 | One classifier (`PassageSearchCallFailures`) decides, for reads and the pass, whether a failed call was dispatched. A retired engine's refusal and the engine's own preflight (`context-window-exceeded`) were not: no usage entry, no request, no effect on the failure streak. Every other **thrown** call was, and leaves one unknown usage entry, so no cost or cache total is claimed over it. A call that **returned** keeps the usage the provider reported, whatever its reply came to: unreadable, cut off, stopped in flight, or (for the pass) nothing kept or a key change while it was out (PR #297 F3). | A dispatched unreadable reply looked metered; a local refusal looked like a provider call; and a returned reply's known usage must not be discarded or called unknown. |
| S30 | D11 | `calls` gains `tooLarge` (refused before dispatch) and `dispatched` (`answered + failed + cancelled`); `answered + failed + cancelled + unsent + tooLarge = planned`. The result gains `requests`: every call dispatched for it, reads and each organizing pass, retries included, apart from whether its usage was known. | S29; and a retry could drop out of the request count. |
| S31 | D12a | The pass fits its instances by walking a spread order and keeping each that still fits, sized exactly as rendered; an early long instance that fits is kept. Nothing left out would still fit. | The earlier sampler refused rows that fit. |
| S32 | D13 | **Quotation grounding is closed by construction.** Text is normalised first. Each mark takes a role from its neighbours; marks pair like brackets; every outermost quotation is checked whole, nested marks and all. A mark that fits both roles or neither, an unbalanced mark, or a mark the check does not read («», corner marks and others) fails the text: a claim is dropped, a title or headline replaced. Single marks allow one quotation per text, none crossing a double mark. | The span parser leaked four times. The cost: a leading elision, an apostrophe inside a single-quoted quotation, two single-quoted quotations, and a quote holding unread marks all fail closed. The prompt asks for straight double marks. |

### The persona request (PR #296)

| # | Decision | Now | Why |
|---|---|---|---|
| S33 | D21 | The results directive's window is measured by the room handler (`ConversationWindowMeasure`, feature-neutral), which then calls the delivery's frame with it. `AgentRunEngine` names no feature. | The choice D21 left to Slice 4. |
| S34 | D20 | A card's price request belongs to the room rendered when it is sent; a new room drops pending answers before any card can ask, and a pending card asks again there, once. | A restored or reopened room's card stuck without a price or Run. |
| S35 | D19a | A results delivery's run is marked provisional; closing the panel rolls it back while it is still active. Every other run is abandoned on close as before. | Closing mid-delivery left a results turn with no reply. |
| S36 | D19, D20 | The persistence coordinator announces every room replacement (`WorkshopOpenRoomInstance`). Activation, Open, a reopen or reload of the same session, Branch, New and rollback start a new open-room instance; only a Rewind keeps it. The announcement aborts a running search and frees its slot. **A held result survives only a Rewind in the same instance**, and only for an unchanged, unanswered card. | Replacement did not stop old work, and a same-id reload kept an old report. This amends D19's "Rewind needs nothing of its own". |
| S37 | D20 | A Run is an operation with its own id and room; every exit releases only its own operation, and every effect after an await requires it still to own the slot, in its room, with the window open. Closing the panel closes the slot and the holder. | An old room's search blocked the new room; a late result published after close. |
| S38 | D21 | **The host sends results itself only when it read everything it planned**: the search ended `complete` or `instance-limit`, no read failed, was cut, cancelled, unsent or too large, and every planned file was searched in full. Otherwise the card waits with "Send partial results to …" and says what was not searched. Every send, the host's own included, waits out a pending session operation. | Okey's to overturn: a partial result is the writer's to send. |
| S39 | D21 | The directive is the whole frame by instances; else a summary that fits and always carries the coverage caveat; else nothing, and the delivery is refused (`results-too-large`) with the card left `ready`. | The directive could exceed its bound, and the summary could drop the caveat. |
| S40 | D21 | A window holds at most four undelivered results; with four, Run is refused before anything is planned (`results-full`) and the card says to Send or Discard one. An undelivered result is never evicted. | "The newest 4" was not enforced. |
| S41 | D19, D21 | Counts keep files with an instance apart from files searched ("Found 1 instance in 1 file. 20 files were searched."). The receipt gains optional `searched`, `filesPlanned`, `requests`, `calls.tooLarge`, `calls.dispatched` and `calls.cancelled`; no `schemaVersion` bump. | The card counted files searched as files matched. |

## Amendment from the live pass: narrowing a group (Slice 5)

**Okey, 2026-11-23.** In the live pass a persona could not limit a search
to Book 1's chapters. It could name the whole `chapters` group, or at most
8 exact files, and asked the searching model, in the question, to stay
inside Book 1. Okey asked for two things: a persona may name several
patterns in one request, and a persona may pull an inventory of a group.

This narrows P4 ("a persona names groups or files by catalog key only")
and does not overturn it: **every file a persona's search reads still
comes from a configured group.** A free pattern stays the sidebar's.

| # | Decision | Now | Why |
|---|---|---|---|
| S42 | P4, D16 | **A `<group>` may carry `match`:** `<group match="Drafts/chapter-4.*.md, Drafts/chapter-1*.md">chapters</group>`. `match` is a comma-separated list, read as a context-path setting is read (`ContextPathPatternSafety`: split on commas, trimmed, empties dropped, so a trailing comma is harmless): 1 to `matchPatterns` (8) patterns, each held to `contextPathPatternRefusal`, and the attribute within `matchCharacters` before it is split. `<path>` and `<excerpt/>` take no `match`. The codec still has no free path and no free pattern. | Okey: several patterns in one pass, in the writer's own comma convention. |
| S43 | D3, D3a, D4 | **The engine's `group` scope gains an optional `match`** (the patterns, already split). It resolves to the files of that group's authoritative listing (`listGroupFiles`) that at least one pattern finds by the context-path walk (VS Code's `findFiles` dialect, `.md`/`.txt`, the resolver's excludes, symbolic links and escapes refused): an intersection by the host's file identity, so **a narrowed group can never reach a file outside its group.** Any caller may send one; the engine refuses an unsafe pattern itself (`unsafe-pattern`), whoever sends it. A walk that does not complete is `catalog-unreadable`, never zero files. Files stay in the group's natural order. `planKey` covers the narrowed scope. The `pattern` scope stays writer-typed only, and no Workshop module builds one. | The boundary P4 protects is the group, not the catalog key. |
| S44 | D17 | **Settlement checks each pattern:** unsafe is `unsafe-match`; one that finds no file of its group is `match-found-nothing` (a typo'd pattern never silently narrows a search); an incomplete walk is `catalog-unreadable`. Each drops the request with its typed reason, mapped in `WorkshopTrailerDropReasons` with one fixed phrase; the conservation test holds. A group named twice, narrowed or not, is a repeat, as today. Per-pattern outcomes come from one `matchPatterns` call per operation (ADR 2026-11-19 D22a: `incomplete` is never `unmatched`). | Fail closed, as an unknown file does today; the persona hears why in counts and can check with S46 first. |
| S45 | D17, D18, D19 | **The card's stored scope gains an optional `match`** (the patterns as split), exact; no `schemaVersion` bump, and a session saved before Slice 5 holding a card keeps reading (a fixture). The card names the place with its patterns ("chapters, matching Drafts/chapter-4.*.md, Drafts/chapter-1*.md"); the estimate's file count is the narrowed one. Run plans again (D20), so files added under a pattern since the price change the `planKey` and show the new price. Transcript and export stay counts only. The results directive names the place the same way, its patterns neutralized. | The writer sees what will be read before paying. |
| S46 | — | **`resource.catalog` is the group inventory.** For a named group it lists the files of that group's authoritative listing, the same files a search of it reads (the browse catalog keeps a file in its first group only: PR #292 F2); without a group, each group in turn from the same listing, a file under every group it belongs to. It pages by the shared rule (`workshopCapabilityPage`, `catalogItems` a page, the next page's whole call written exactly when a later page exists, a page past the end answered in words), replacing "Catalog limited to 100 of N". An optional `<match>`, only beside `<group>` (`match-needs-group` otherwise), takes S42's list, read by the same rule through **one shared module** with settlement, and lists exactly the files that narrowed scope would search, with each pattern's count, so a persona sees a pattern that finds nothing before it asks. `<match>` may repeat (the lists are joined) so a native call's array maps; the prompt teaches one element. | Okey: an inventory of a group, such as every file under chapters. |
| S47 | — | **Native tool calls.** `resource.catalog`'s row in `WORKSHOP_NATIVE_CALL_FIELDS` gains `page` and `match` (repeatable, plural `matches`), held to the codec's policy by the existing test. The passage-search request is a trailer written in the reply, never a tool call: the adapter never sees it, and that is unchanged. | A Claude model with web research on sends some calls natively. |
| S48 | D16, D24 | **Prompts and help.** `passage-search-request.md` teaches `match` and says to check a narrowing with `resource.catalog` first; the resource grammar teaches `<page>` and `<match>`. Their sync tests hold every number to `PROMPT_BUDGETS` and every taught form and written call to the codecs. The help reference's Workshop section says a persona can narrow a group and list a group's files; section ids are kept. | A feature is complete with its help (round two, D21). |
| S49 | — | **Logs** carry pattern counts, file counts and reason kinds: never a pattern, a path or a file name. | The epic's writer-data rule. |
| S50 | S46, ADR 2026-11-03 D4, ADR 2026-11-19 D11 | **A pair resolves to the file the inventory lists for it** (amended after PR #298 P1). `resolveConfiguredResource` (`ConfiguredResourceLookup.ts`, beside `findConfiguredResource`): (1) **the group's authoritative listing first** (`listGroupFiles`): the one exact relative path, else the one path equal to it ignoring letter case; several exact matches (the same path in two workspace folders), or several case-folded matches with no exact one, are `ambiguous`, never the first; none is `missing`. That listing holds every file the browse listing holds for the group. (2) **Then that file's browse entry, by host identity,** which loads as it always has; when the browse listing holds no entry for it (it merged the file with a same-named one, or dropped it), `ambiguous`, never another file. (3) **Only when the authoritative listing cannot be read** (a failed scan, or a host that gives none: `NO_CONFIGURED_GROUP_FILES`), the pair resolves by the browse listing alone (`findConfiguredResource`), the behavior before Slice 5, so a failed walk never blocks every read. A path in no configured group is in no listing, so containment is unchanged. `resource.read` (each group listed once per read), `history.*` and the Read in reader all resolve through it, so a card's recorded pair always opens in the reader. A result names the file by its browse entry, so its card records the group the browse listing keeps it in. The reader's listing is the intake service's (`extension.ts` builds it with the resolver). | With overlapping patterns the inventory listed `{ manuscript, Drafts/chapter-1.md }` and a read answered `missing`; and a browse hit read first could resolve a case-folded or merged pair to a different file than the one it names. |
| S51 | S42, S44, S45, S46 | **Decided while building.** (1) `matchCharacters` is 2,000: a catalog continuation writes a narrowing as one `<match>`, its patterns joined by ", ", and `matchPatterns` patterns at `patternCharacters` each need 1,614, so every continuation decodes (a test holds it). (2) The trailer codec judges a list's form (`empty-match`, `match-too-long`, `too-many-match-patterns`, recorded as `malformed`); settlement judges each pattern's safety (`unsafe-match`), before anything is listed, as the locations proposal splits form from safety. The engine refuses an empty or over-long list as `unsafe-pattern`; in `resource.catalog` an unsafe `<match>` is the codec's `unsafe-match`, and too many is `too-many-patterns`. (3) With no workspace folder open there is nothing to walk: every pattern finds nothing (`match-found-nothing`), not `catalog-unreadable`. (4) A catalog entry is `` - [group] `path` ``, with `· workspace: <folder>` whenever several workspace folders are open (the workspace's own folder name), whatever the page found; the browse label is gone, the "N catalog entries" ceiling became the page size, and a page past the end, an empty listing's included, is answered in words. (5) The results directive's `Searched:` line is in the summary too, so a delivery that falls back to the summary still says where it looked. (6) `resource.catalog` logs one line: group, page, pages, files, pattern count and outcome. | The spec left each open. |
| S52 | S43, S46 | **Stated limits.** The resolver's pattern walk keys a file by its case-folded path within one workspace folder, so of two files there that differ only by letter case a narrowing can leave one out; it never adds a file, and never one outside its group. The instruction's per-group file counts, and `resource.search` scoped to a group, still read the browse listing, so a file in two groups counts once there, under the first group, while the inventory lists it under each. | Changing the walk's key would move the context-path checker's overlap counts; the counts and search are the browse catalog's by design (D3a). |
| S53 | S42, S43, S46, S47, D7 | **After PR #298's review.** (1) **A supplied empty list is the translator's fault** (`empty-list`), for every repeating field: `[]`, or the text `"[]"` read through `listWrittenAsText`. Nothing is translated and the engine's correction path runs; an omitted field and a non-empty list are unchanged. It was read as the field left out, which widened `resource.catalog` to the whole group. (2) **The trailer's attribute values are decoded** (`match`, and `group` on `<path>`; `utils/xmlCharacterReferences`) before they are judged: the five predefined entities and numeric references to characters XML allows, as the capability codec's XML parser decodes text, so `Arts &amp; Crafts/*.md` gives one pattern in a trailer and in `resource.catalog`'s `<match>`. Anything else, a bare `&` included, stays as written (the trailer is read leniently; the call's parser refuses it). (3) **The engine applies settlement's rule at every plan:** a narrowed group whose pattern finds no file of its group refuses the plan (`match-found-nothing`, in host words), so a card's price and Run after one pattern's files vanish refuse, never a quietly narrower search. (4) **One file is read once per `resource.read`:** a later pair resolving to a file an earlier pair named (one file in two groups) is its own outcome, `same-file`, decided before anything of it loads: no text, no manifest row, no line range, no fingerprint and no share of the read, so no continuation names it. | Astra's P2 findings: a widened catalog, escaped names that did not round-trip, a replan that silently dropped a pattern, and one file read and charged twice. |

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
