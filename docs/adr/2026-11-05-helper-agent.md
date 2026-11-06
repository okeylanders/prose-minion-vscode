# ADR 2026-11-05: A Helper Agent for Small Tasks

**Status:** Proposed (2026-11-05).
- **Okey's choice:** automatic drafting for the first task.
- **Q1–Q3:** Okey handed the implementation to the coordinator, who took the
  recommended defaults ([below](#defaults-taken-2026-11-05)). Okey may
  override any of them before the live pass.
**Date:** 2026-11-05
**Epic:** [Helper Agent](../../.todo/epics/epic-helper-agent-2026-11-05/README.md)
**Related:**
- [ADR 2026-11-04: Workshop Project Memory](2026-11-04-workshop-project-memory.md):
  the memory sheet the first task fills.
- [ADR 2026-10-21: Draft Edit](2026-10-21-draft-edit-engine-and-document-write-back.md):
  the passes-as-policies pattern this follows.

## Context

Okey asked for a general assist agent with a generic system prompt:
- **First job.** When the writer presses **Save to memory…** on a bubble, the
  agent titles and summarizes the memory.
- **Later jobs.** For example, configuring the project's context paths by
  scanning the workspace's folder and file names.

What exists today:
- **The context assistant** (`ContextAssistantService`, the `context` model
  scope) writes context briefs from project resources. Its prompt and output
  belong to that one job, so it isn't a general agent.
- **The memory sheet.** Opened from a bubble (`saveTurn`, sheet mode `turn`),
  its body is the bubble's text, cut at `bodyCharacters`. The title and
  summary start empty, and Save needs both.
- **Draft Edit's passes** are policies: each brings its own prompt, codec and
  guard to a shared engine. Small, recurring model jobs fit the same shape.

## Decision

### D1. One agent, a generic prompt, tasks as policies

- **The prompt.** `resources/system-prompts/helper/00-helper.md` is generic:
  - be brief and exact;
  - return only the JSON the task asks for;
  - never invent facts the input doesn't hold;
  - the writer's words outrank yours.
- **The tasks.** Each task is a policy in `HELPER_TASK_POLICIES`, keyed by a
  `HelperTask` union. A policy brings:
  - its own prompt section (`10-<task>.md`);
  - an input builder (plain data in, prompt text out);
  - an output codec (`parseModelJson`, then exact fields);
  - its bounds in `PROMPT_BUDGETS.helper.<task>`;
  - its call settings (temperature 0, a small output ceiling, no reasoning
    level of its own).
- **Amended 2026-11-06 (Slice 3's live pass): reasoning off.** The first
  live Save to memory… came back cut off: the reply spent all 400 output
  tokens, where a finished draft is about 100 to 130. Most likely the model
  decided for itself to think, since the helper sent no reasoning setting;
  it may instead have written past the JSON. Both are covered:
  - **Reasoning off.** The engine asks every helper call for reasoning
    `off` (`reasoningRequest`, `effort: 'none'`), whatever the task.
  - **A model that always reasons** is never sent `off` (PR #181 F-01's
    rule): the live catalog is asked about the exact model the call goes
    to. Where Draft Edit refuses such a model, the helper sends it the
    `light` budget (`PROMPT_BUDGETS.reasoning.light`) on top of the output
    ceiling. Drafting is automatic, and a refusal would only show the quiet
    failure line. A catalog that cannot say sends `off` as asked, as Draft
    Edit's does. The catalog read counts in the call's time.
  - **The catalog rule is neutral ground.** `ReasoningCatalog` and
    `refusesReasoningOff` moved from `services/draftEdit/` to
    `orchestration/ReasoningCatalog.ts`, so the helper reads them without
    importing Draft Edit; Draft Edit's behavior is unchanged.
  - **The ceiling is raised** from 400 to 1,000 tokens. Drafts don't get
    longer: the decoder holds the title and summary to their bounds,
    `responseCharacters` still refuses a long reply, and a cut-off is still
    refused, never salvaged.
  - **Reasoning tokens** a provider reports are logged on the helper's line
    as a count (`, 312 reasoning`), never added to `TokenUsage`.
- **Adding a task** adds a policy, a prompt section, a worked example that
  decodes through the production codec, and a sync test. It never adds a
  branch in the engine.

### D2. It proposes; it never writes

The helper has no tools, no capabilities and no file access of its own:
- Code hands it exactly the input it needs.
- Its answer is data that code validates and the writer sees before anything
  is saved.
- A malformed or out-of-bounds answer is dropped and logged by fault kind. It
  is never repaired into something the writer didn't see.

### D3. Its own model scope: `helper`

- **The setting.** `proseMinion.helperModel` is empty by default. It follows
  another scope until the writer picks one, as the Lightbox's and Craft
  Flags' scopes do.
- **Which scope it follows** (Q1). Recommendation: **Proofread's**, an
  inexpensive default. The task runs automatically on every Save to memory…,
  so it should be fast and cheap.
- **What joins the model path** (AGENTS.md's model-setting steps):
  - `helper` joins `ModelScope`, `MODEL_SCOPE_SETTING_KEYS` and
    `ModelScopeSelections`;
  - it gets a bundle in `AIResourceManager`;
  - its key joins `MODEL_KEYS` in `MessageHandler`'s watcher;
  - it gets a row in the Settings overlay.

### D4. Where it lives

- **The service.** `HelperAgentService` lives in
  `infrastructure/api/services/helper/`. It is built in `extension.ts`, joins
  `CoreServices`, and handlers call it. No handler constructs it.
- **What it imports.** It never imports a Workshop, Lightbox or Draft Edit
  module. Tasks receive plain data, and `boundaries.test.ts` pins this.
- **Usage.** A call's `TokenUsage` is reported like every other scope's.
- **Logs.** They carry the task, the model, the outcome and counts, never the
  text.

### D5. First task: `memory-draft` (automatic)

1. **When.** The memory sheet opens from a turn: **Save to memory…** on a live
   bubble, or (Q3) a bookmark's **Remember this** on a saved turn. The
   webview posts `WORKSHOP_MEMORY_DRAFT_REQUEST`, with the turn id (and the
   saved session's id for a saved turn) and a minted request id.
2. **The host reads the turn itself.** It never takes text from the webview.
   It uses the same projection the sheet's body comes from, and asks the
   helper for `{ title, summary, kind }`:
   - the title within `titleCharacters`;
   - the summary within `summaryCharacters`;
   - the kind one of `PROJECT_MEMORY_KINDS`.
3. **The answer is correlated.** `WORKSHOP_MEMORY_DRAFT_RESULT` names its
   request id, and the hook takes only the answer it still waits for, on the
   sheet it was asked for. A closed or reopened sheet ignores it.
4. **The writer's typing wins.** The answer fills only fields the writer
   hasn't touched. The body is never changed: it stays the bubble's text.
5. **While it drafts:**
   - the title and summary fields read "Drafting…" (placeholder text, not
     values);
   - Save stays available;
   - a writer who types first simply keeps their words.
6. **Failure is quiet.** With no key, an error, a timeout or a malformed
   answer, the sheet stays as it is today. One muted line says "Couldn't
   draft a title and summary." Nothing blocks.
7. **The setting.** `proseMinion.workshop.memory.helperDrafts` (default
   `true`) turns it off.
   - **Off is silence, not failure.** The webview knows the setting, posts
     no request, and shows no "Drafting…" and no line.
   - **The host gates it too.** A request that arrives while it is off is
     answered `off` with no model call, and the webview treats `off` as
     silence.

   The call isn't confirmed first: Okey chose
   automatic. It is bounded (its input is the sheet's body, at most
   `bodyCharacters`, plus the prompt; its output is the three fields), and
   its cost depends on the source's length and the helper's model (PR #225
   N-01).

A proposal card's **Edit…** already has a persona's title and summary, so it
asks for nothing.

### D6. A later task: `project-locations` (not built in v1)

- **Code scans the workspace.** It reads folder and file names only, never
  contents, bounded by count and depth, and skips hidden folders, the build
  output folder and `node_modules`.
- **The helper maps the names** to `CONTEXT_PATH_GROUPS` patterns.
- **Settings shows the proposal.** Each group shows the files the real
  context-path resolver matches, counted. The writer applies all of it, part
  of it, or none. The helper never writes a setting.

## Defaults taken (2026-11-05)

Okey delegated these. Each is the recommendation below, taken as the
default until he says otherwise.

1. **Model.** Which scope should the helper follow until picked: Proofread
   (cheap and fast; recommended) or the assistant model (the Workshop's)?
2. **Kind.** Should the draft also choose the memory's kind?
   Recommendation: yes. The writer can change it in one click.
3. **Remember this.** Should a bookmark's Remember this get a draft too?
   Recommendation: yes. It is the same sheet, opened from a saved turn.

## Consequences

- Small model jobs get one home, with no new engine per job.
- Saving a bubble becomes one click plus a glance, not three fields typed.
- Each Save to memory… on a bubble costs a small, unconfirmed call. The
  setting turns it off.
- There is one more model scope in Settings, empty until the writer picks one.

## Alternatives considered

- **Reuse the context assistant.** Rejected: its prompt and output are a
  context brief's, and its model is chosen for that job.
- **Ask the room's persona to title the note.** Rejected:
  - it spends the room's model, which is expensive;
  - it adds a turn the writer didn't ask for;
  - it would only work in the open room.
- **A button instead of automatic.** Okey chose automatic. The setting covers
  writers who want neither.
- **Derive the title from the first sentence (no model).** A useful fallback,
  but a poor title. It may still serve as D5.6's failure fallback (not
  decided).
