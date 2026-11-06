# Feature: Workshop Research Agent

**Date Identified:** 2026-11-06
**Status:** Idea. Far tail, not needed yet. Needs an ADR before any slice.
**Priority:** Low
**Origin:** Okey, 2026-11-06, as the [Helper Agent](#related) epic reached code complete

## In Okey's words

> Instead of the Workshop persona personally researching, if desired, it can
> hand off the task to a research agent that'll perform the lookups,
> searches, etc. and provide a detailed summary back. This keeps the context
> clean, and cheap. It goes along with the helper agent; in fact it may just
> be an additional policy and use the helper agent. The research agent will
> also have web access.

("Back to the research agent" in the original is read here as back to the
persona that asked.)

## Problem

When a persona researches today, everything it finds lands in its own
retained conversation, on the room's model:

- **Web research.** With `proseMinion.workshop.webResearch` on (off by
  default), every persona call carries OpenRouter's `openrouter:web_search`
  server tool (`engine: 'auto'`, `max_uses: 2`, `max_total_results: 10`;
  `AssistantToolService.workshopWebSearchTools`). The results and the reading
  of them are the persona's turn.
- **Lookups.** The capability calls (`resource.*`, `transcript.*`,
  `memory.*`, `dictionary.*`) return their evidence into the same thread.

The persona's conversation is retained (`AGENT_RUN_POLICIES.workshopHost`,
`retention: 'retain'`), so material it read once and mostly discarded is paid
for again on every later turn, at the room model's price. It also crowds the
context the persona needs for the writer.

## Idea

The persona can delegate. It writes a short research brief (the question,
and why the room needs it) and hands it to a **research agent**:

- The research agent runs on its own inexpensive model, with web access and
  read-only lookups, over as many rounds as its budget allows.
- It returns a **detailed summary with its sources**, and says what it could
  not find.
- The persona keeps only the brief and the summary. The searches, pages and
  dead ends stay with the research agent and are discarded.

## What is already in place

- **Persona web research** (`proseMinion.workshop.webResearch`): the opt-in,
  its privacy wording ("queries can draw on room context and are processed by
  OpenRouter and search providers"), the server tool, and citations on the
  reply (`webResearchAttached`, `citations`).
- **The agent-run engine's policies** (`AGENT_RUN_POLICIES`) already set,
  per caller, the capability catalog, the round limit, corrections and
  retention. `context` runs a catalog over two rounds and discards;
  `workshopHost` retains.
- **The Helper Agent** (`epic/helper-agent`, not on `main` yet; ADR
  2026-11-05): its own model scope that follows a cheap one until picked,
  built only in `extension.ts`, tasks as policies, logs without text, and a
  boundary test that keeps it apart from feature modules.
- **The capability families** (`WORKSHOP_CAPABILITY_OPERATIONS`,
  `workshopCapabilityFamily`) are exhaustive, so a new operation is a
  compile-checked addition. Recall's window seam
  (`AgentCapability.fulfill(request, window?)`) already clamps evidence to
  the free context.
- **A principal for a delegate thread.** The room-ledger ADR reserves
  `private(tangent:<id>)` (see [Workshop Subagents](#related)).

## Fit with the Helper Agent: one policy, at which layer?

"An additional policy on the helper" is half right, and which half matters.

- **Not a helper task.** The helper's task registry (`HELPER_TASK_POLICIES`)
  is built for one capability-free call: temperature 0, a small output
  ceiling, JSON out. Its ADR's D2 says it "has no tools, no capabilities and
  no file access of its own", and its run policy is `AGENT_RUN_POLICIES.helper`
  (no catalog, no rounds). Research is a loop with tools and a long, prose
  answer. Making it a helper task would break D2 and the engine's
  "no task branch" rule.
- **A run policy, one layer down.** `AGENT_RUN_POLICIES` already models what
  research needs: a catalog, a round limit, discard. A `research` run policy
  (web plus read-only lookups, N rounds, discard) fits the engine as it is.

**Leaning:** a sibling `ResearchAgentService` on the shared agent-run engine,
with its own run policy, built like the helper (own scope following a cheap
one, composition root, boundaries, logs). It shares the helper's patterns,
not its no-tools contract. The other option is to amend the helper ADR's D2
so a task may name a read-only catalog. That needs less code, but it blurs
the one rule that makes the helper easy to trust.

**Handoff shape (sketch):** a new capability operation the persona calls,
for example `research.ask` in a new `research` family. The host runs the
research agent and returns the summary as capability evidence, within
recall's window clamp. No new private channel between conversations.

## Open questions for the ADR

- **Who delegates.** The persona through the capability (the "if desired"
  reading), the writer through a button, or both? With delegation on, does
  the persona lose its direct `web_search` tool, or keep both?
- **What the research agent is told.** The brief only, or room context too?
  Brief-only narrows what reaches search providers, a privacy gain over
  today's setting. Keep it unless there is a reason not to.
- **Web access.** OpenRouter's `openrouter:web_search` server tool first (it
  exists, and sources come back as provider annotations). Whether it also
  fetches whole pages, and from where (the extension host has its own
  network), is a separate decision.
- **Which lookups.** Read-only only: dictionary, `resource.*`,
  `transcript.*`, `memory.*`. It never writes: no memory proposals, no file
  edits, no settings.
- **The output contract.** The summary's bound in `PROMPT_BUDGETS`; prose or
  structured; a source list taken from the provider's annotations, never
  from URLs in the model's text; a "not found" section.
- **Model and cost.** Its own scope (`researchModel`) or the helper's? Which
  scope it follows until picked. A per-delegation cap on rounds and searches.
  Confirmed first, or bounded and automatic like the helper's drafts? How
  the usage shows under the persona's turn.
- **Visibility.** Does the writer see the trail (queries, sources) as a
  collapsible card? Is the summary publishable evidence, like
  `transcript.read`?
- **Stop and failure.** The persona turn's Stop cancels the research. On a
  timeout, refusal, empty result or malformed answer, the persona is told
  research was unavailable, in host words, and never fills the gap itself.
- **Settings.** A mode under `workshop.webResearch` (persona searches /
  delegates), or a switch of its own? Web stays behind the existing opt-in,
  off by default.
- **Relation to Workshop Subagents.** Research may be the first concrete
  subagent, or the two may share one delegate engine with the recall filter.
  Decide them together.

## Completion Criteria

- [ ] An ADR settles the questions above, including the layer question.
- [ ] A persona can hand a brief to the research agent. The research agent
      runs on its own scope with web access and read-only lookups, within a
      round and search bound, and returns a summary with sources.
- [ ] A test shows the persona's retained conversation holds the brief and
      the summary, and none of the raw search results.
- [ ] Web access stays behind `proseMinion.workshop.webResearch`, off by
      default.
- [ ] The deterministic edges are tested without a model: the brief and
      summary codec, budgets, the source list taken from annotations, and
      the failure fallback. No live, billable call in tests.
- [ ] Logs carry counts, categories and outcomes, never the brief, the
      queries or the summary.

## Related

- [Workshop Subagents](../feature-workshop-subagents/README.md): the
  general delegate-thread idea (filtering recall results on a fast model).
  Closest sibling; overlaps here.
- [Workshop Task Sidecar Conversations](../feature-workshop-task-sidecar-conversations/README.md):
  another delegated conversation shape, writer-launched.
- [ADR 2026-11-05: A Helper Agent for Small Tasks](../../../docs/adr/2026-11-05-helper-agent.md)
  (on `epic/helper-agent` until that epic reaches `main`).
- [ADR 2026-10-05: Session Transcript Recall](../../../docs/adr/2026-10-05-workshop-session-transcript-recall.md):
  the capability families and the window seam.

## Related Files

- `packages/core/src/infrastructure/api/services/analysis/AssistantToolService.ts`
  (`workshopWebSearchTools`: today's persona web research)
- `packages/core/src/infrastructure/api/providers/OpenRouterClient.ts`
  (`OpenRouterWebSearchTool`)
- `packages/core/src/infrastructure/api/orchestration/AgentRunPolicies.ts`
  (where a `research` run policy would join)
- `packages/core/src/shared/types/workshopCapabilities.ts`
  (where a `research` operation and family would join)
- `packages/core/src/shared/types/messages/workshop/settings.ts`
  (`WorkshopWebResearchSettings`)
- `apps/vscode-extension/package.json` (`proseMinion.workshop.webResearch`)
- `infrastructure/api/services/helper/HelperAgentService.ts` (on
  `epic/helper-agent`)
