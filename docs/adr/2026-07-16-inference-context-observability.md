# ADR 2026-07-16: Universal Inference Context Observability

**Status:** Proposed
**Date:** 2026-07-16
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md), [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md), [ADR 2026-07-10 — Agent-Run Engine and Resource Catalog Policies](2026-07-10-agent-run-engine-and-resource-catalogs.md), [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Implementation:** [Sprint 11B — Context Budget Visibility and Inference Telemetry](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/11b-context-budget-visibility.md)

## Context

Prose Minion currently presents three different quantities as though they were
one token number:

1. **One provider request's context** — prompt tokens sent to one model call,
   constrained by that model's context window and the requested output reserve.
2. **One logical turn's processed traffic** — the sum of prompt and completion
   tokens across every provider call needed to finish that turn. Capability
   loops may resend the same retained history five or more times.
3. **Cumulative processed traffic** — the sum of every completed request since
   the shared token tracker was reset.

`OpenRouterClient` already receives per-request usage. `AgentRunEngine` then
adds every call together before returning one logical-turn `TokenUsage`, and
`MessageHandler` adds those turn totals into one cumulative bag. The Workshop
header labels that bag `Tokens`, while each assistant bubble displays the
logical-turn total. A resource-heavy turn can therefore show 170K tokens even
when each individual request used only 30–40K of a 200K context window. Adding
the bubbles double-counts retained history each time it was resent; it does not
measure the next request's context.

Workshop also has multiple independent retained conversations. The permanent
host, every live guest persona, and every current tool sidecar each owns a
different provider conversation id. The composer routes through
`WorkshopChatTarget`; switching from Jill to a guest or a tool must therefore
switch the context reading too. A session-wide gauge would be as misleading as
the current cumulative chip.

Finally, OpenRouter can apply its context-compression plugin from account or
organization defaults even when a request omits `plugins`. The client does not
request router metadata, so Prose Minion cannot currently tell the writer
whether a prompt was middle-out compressed. For a writing tool, invisible loss
of the middle of a conversation is a trust problem, not merely billing trivia.

## Decision

### 1. Context telemetry is universal, layered, and provider-neutral above the adapter

The feature is not Workshop state and is not owned by React.

- **Infrastructure adapter:** `OpenRouterClient` decodes one response's raw
  provider usage and router pipeline metadata into a provider-neutral request
  observation. It records facts only: model id, prompt/completion/total tokens,
  requested maximum output, finish reason, and whether context compression was
  reported. It does not retain history, identify participants, compute UI
  labels, or own cumulative state.
- **Application orchestration:** a new core application service (working name
  `InferenceContextTracker`) receives each request observation from
  `AgentRunEngine`, associates it with an opaque conversation/run key, and
  retains the latest request plus bounded turn aggregates. This is the one
  cross-surface source of truth for sidebar and Workshop inference telemetry.
- **Domain/shared contracts:** provider-neutral types describe request facts,
  context-budget snapshots, compression state, and safe presentation keys.
  They contain no OpenRouter response JSON and no VS Code types.
- **Presentation:** a shared context-budget component renders the same semantic
  fields on both surfaces. Surface-specific code chooses placement and label;
  it does not recalculate token meaning.

This split keeps provider parsing low, contextual ownership in the application
layer, and participant-aware presentation high. Putting all state in
`OpenRouterClient` would lose caller/conversation meaning; putting it in
`WorkshopSessionService` would exclude the sidebar and mix aggregate state with
transport telemetry.

### 2. Every provider call remains observable before aggregation

`AgentRunEngine` must preserve a bounded per-call trace for the active logical
turn instead of exposing only `addUsage(...)`'s sum. At minimum the tracker
records:

- `modelId` and the request's configured `maxTokens`;
- provider-reported prompt, completion, and total tokens;
- call ordinal within the logical turn;
- logical route/policy and opaque conversation/run key;
- finish reason;
- context-compression state: `applied`, `not-applied`, or `unknown`.

The existing aggregate `TokenUsage` remains for cost accounting and historical
turn bubbles. It is renamed in UI copy to **processed tokens**. No billing or
token-reset behavior is inferred from the context gauge.

The per-turn trace is bounded by the run policy's existing call/correction
limits. It is operational telemetry, not manuscript history, and is not added
to model prompts.

### 3. The gauge reports the last measured request, not an invented exact future value

The primary context value is:

`last provider-reported prompt tokens / usable input budget`

where:

`usable input budget = live model context length - requested max output tokens`

The model context length comes from the live model catalog already delivered in
`ModelOption.contextLength`. If live metadata is unavailable, the UI says
`Context window unavailable`; it does not silently assume 128K or 200K.

The label must say **Last prompt** or **Context on last call**. Exact next-call
token count is unknowable without model-specific tokenization and provider
transforms. Sprint 11B does not add a tokenizer dependency or describe a
character-count estimate as exact context. A future preflight estimate may be
added as a separately labeled approximation.

The expanded view distinguishes:

- last prompt tokens and usable input budget;
- peak prompt tokens during the logical turn;
- calls in the logical turn;
- turn processed tokens;
- cumulative processed tokens;
- model id/context window/output reserve;
- compression state.

Warning presentation begins at 70%, escalates at 85%, and becomes critical at
95% of usable input. These are visibility thresholds, not automatic trimming
triggers.

### 4. Workshop context follows the composer target

`WorkshopSessionService` continues to own the private participant graph and
conversation ids. It does not store provider telemetry. When posting a session
snapshot, the host maps the active `WorkshopChatTarget` to the tracker's record
and emits only a safe participant-labeled budget snapshot:

- host target → permanent host conversation;
- persona guest target → that live guest conversation;
- tool target → that tool's current sidecar conversation.

Raw conversation ids never cross into the webview. Switching targets changes
the displayed record immediately without resetting it. Switching back restores
the prior participant's reading.

Lifecycle rules:

- a participant with no completed request shows `Not measured yet`;
- dismissing a guest removes its live reading and returns to the host;
- a new run of the same tool replaces the old live tool conversation and its
  gauge, matching the existing sidecar replacement policy;
- New Session retires all conversation-scoped readings but does not reset the
  explicitly cumulative processed-token account meter;
- a model change does not reinterpret an old prompt count using the new model's
  tokenizer/window. The reading stays labeled with its measured model until a
  new request completes.

Bounded handoff and guest catch-up packets may copy selected information between
conversations, but their histories and context readings never merge.

### 5. Sidebar routes consume the same tracker without Workshop concepts

All production chat-completion calls currently pass through `AgentRunEngine`,
including sidebar assistant, dictionary, category-search, and context routes.
Discarded/one-shot routes use an opaque run key rather than a retained
conversation key. The sidebar shows the most recent request for the active
model/tool scope and uses the same shared widget and terminology.

No `WorkshopPersonaId`, `WorkshopToolId`, participant graph, or chat-target type
enters the universal tracker.

### 6. Router metadata is requested and normalized; compression policy is unchanged

OpenRouter requests opt into router metadata with
`X-OpenRouter-Metadata: enabled`. The adapter retains only a minimal normalized
summary of a `context_compression` pipeline stage; it never logs or stores full
request messages, manuscript text, or arbitrary router metadata.

Sprint 11B observes and discloses account/organization context compression. It
does not enable or disable the plugin and does not add local
windowing/summarization. If metadata is unavailable, the state is `unknown`,
not `not-applied`.

An explicit compression/compaction policy is a later decision informed by real
gauge data. Prose Minion must not silently implement a second hidden trimming
layer while measuring the first one.

### 7. Persistence keeps semantics honest

Request traces are ephemeral. Sprint 10 may persist only the latest safe
participant/run summary if product value justifies it; it must not persist raw
conversation ids or make a restored transcript appear to have live provider
memory. A restored T2 session starts with `Not measured yet` until its fresh
conversation completes a request.

## Consequences

### Gains

- Writers can see how close the active model request actually came to its
  usable context budget.
- Processed traffic, turn cost, and context size stop impersonating one another.
- Host, guest, and tool sidecars report their independent context honestly.
- Sidebar and Workshop share one semantic implementation instead of drifting.
- OpenRouter middle-out compression becomes visible without leaking prompt
  contents or changing account policy.
- Real measurements provide the evidence required by Sprint 3's deferred
  windowing/summarization trigger.

### Costs and risks

- Per-request telemetry must survive streaming and non-streaming response
  differences without double-counting terminal usage chunks.
- A provider-reported prompt value is backward-looking; the UI must resist the
  tempting but false label `Current context`.
- Live context-window metadata may be temporarily unavailable. Honest unknown
  states add UI complexity but avoid a dangerous fallback denominator.
- Participant-keyed readings add lifecycle cleanup at dismissal, replacement,
  reset, resource-manager rebuild, and model change.
- Router metadata is provider-specific at the adapter edge and requires focused
  fixtures so schema drift fails visibly.

## Rejected alternatives

- **Keep using cumulative `TokenUsage`:** double-counts resent history and
  cannot answer context-window pressure.
- **Store telemetry in `OpenRouterClient`:** the adapter cannot identify a
  Workshop participant, retained conversation, or sidebar run.
- **Store telemetry in `WorkshopSessionService`:** excludes sidebar routes and
  makes provider traffic part of the domain aggregate.
- **Derive context entirely in React:** loses the exact per-request boundary,
  duplicates semantics across two roots, and invites raw conversation ids into
  the webview.
- **Add exact tokenizer preflight now:** model/provider tokenizers and transforms
  make this substantially larger than an observability sprint. A labeled
  provider-reported last request is honest and immediately useful.
- **Rely silently on OpenRouter compression:** middle-out removal can change
  narrative continuity without leaving an application-visible explanation.

## Implementation

[Sprint 11B — Context Budget Visibility and Inference Telemetry](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/11b-context-budget-visibility.md), executed after Sprint 11 and before Sprint 12.
