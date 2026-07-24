# ADR 2026-07-16: Workshop Retained-Context Observability

**Status:** Accepted
**Date:** 2026-07-16
**Extends:** [ADR 2026-06-16 — Monorepo Ports and Adapters](2026-06-16-monorepo-ports-and-adapters.md), [ADR 2026-06-18 — MessageHandler Composition-Root Consolidation](2026-06-18-messagehandler-composition-root-consolidation.md), [ADR 2026-07-10 — Agent-Run Engine and Resource Catalog Policies](2026-07-10-agent-run-engine-and-resource-catalogs.md), [ADR 2026-07-09 — Workshop Persona Host, Tool Sidecars, and Capabilities](2026-07-09-workshop-persona-hosted-conversations.md)
**Epic:** [Assistant as a Full Editor Tab](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md)
**Implementation:** [Sprint 11B — Context Budget Visibility and Inference Telemetry](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/11b-context-budget-visibility.md)

## Context

Prose Minion exposes three token quantities that must not impersonate one
another:

1. **Retained conversation context** — the provider-measured tokens represented
   by the latest successfully committed Workshop conversation.
2. **Logical-turn processed traffic** — prompt plus completion tokens summed
   across every provider call needed to finish one writer turn. Capability
   loops may resend the same retained history several times.
3. **Cumulative processed traffic** — every completed request since the
   explicit usage reset.

`OpenRouterClient` receives per-request usage. `AgentRunEngine` aggregates those
requests into one logical-turn `TokenUsage`. A capability-heavy turn can
therefore process 170K tokens while retaining only 40K of context. Neither the
turn total nor the cumulative total is the conversation size.

Only Workshop currently presents user-driven retained chat turns. Sidebar
assistant operations are one-shot tools; a “latest sidebar context” reading is
just the most recent request from whichever tool happened to finish last. It
does not describe a conversation the writer can continue and is therefore not
useful context-window state.

Workshop also has multiple independent retained conversations. The permanent
host, every live guest persona, and every current tool sidecar each has a
different conversation id. The composer routes through `WorkshopChatTarget`, so
the visible context reading must follow that target.

Finally, OpenRouter may apply context compression. Prose Minion must disclose a
reported compression stage without retaining raw router metadata or changing
the provider's compression policy.

## Decision

### 1. `ConversationManager` owns the retained context snapshot

The existing `ConversationManager` owns each retained message thread and its
lifecycle. It also stores that conversation's latest `ContextBudgetSnapshot`.
This makes deletion, reset, idle expiry, guest dismissal, tool replacement, and
New Session cleanup automatic: the measurement cannot outlive the thread it
describes.

`ConversationManager` does **not** tokenize message strings. Exact counts depend
on the selected model and provider-side transforms. Instead:

- `OpenRouterClient` converts one completed provider response into a
  provider-neutral `InferenceRequestObservation`;
- `AgentRunEngine` collects observations and processed usage locally while a
  turn is running;
- after the final response and pending transcript messages commit atomically,
  `AgentRunEngine` stores the resulting snapshot on the conversation;
- cancellation or transport failure leaves both the retained transcript and
  its previous context snapshot unchanged.

No independent universal tracker, one-shot run registry, or sidebar telemetry
query contract is introduced.

### 2. “Current context” means the retained thread after the latest reply

For the latest successfully committed turn:

`current retained context = final request prompt tokens + final response completion tokens`

The final request's prompt count measures the history and intermediate
capability evidence actually presented to the provider. Adding that request's
completion measures the assistant reply now retained beside it. This is the
best provider-measured representation of the conversation immediately after
the reply commits.

It intentionally excludes the writer's next, not-yet-sent message. The next
provider request can still differ because that new message, model changes, or
provider transforms have not happened yet. The expanded view keeps **Last
request prompt** as a diagnostic, but it is not the primary gauge.

The denominator is:

`usable input = live measured-model context length - requested maximum output`

The model context length comes from `ModelOption.contextLength`. If live
metadata is unavailable, the UI says `Window unavailable`; it never assumes a
128K or 200K window. A reading remains associated with the model that measured
it until a later successful turn replaces it.

Warning presentation begins at 70%, escalates at 85%, and becomes critical at
95% of usable input. These are visibility thresholds only.

### 3. Processed traffic remains separate

`AgentRunEngine` continues to aggregate prompt and completion usage across all
calls in one logical writer turn. The UI names this **processed** traffic and
includes the provider-call count. The existing cumulative processed counter
continues to reset only through its explicit reset action.

A Workshop turn may therefore show both:

```text
Jill context     Context 42K / 190K · 22%
This turn        5 calls · 172K processed
```

The first number describes retained context. The second describes repeated
provider work and cost.

### 4. Context visibility is Workshop-only and follows the composer target

`WorkshopSessionService` continues to own participant selection and private
conversation ids. It does not store transport telemetry. When posting the
session projection, `WorkshopHandler` maps the active target to the matching
conversation snapshot:

- host target → permanent host conversation;
- persona guest target → that live guest conversation;
- tool target → that tool's current sidecar conversation.

React receives only a participant label and safe snapshot; raw conversation ids
never cross into the webview. Switching targets changes the displayed snapshot
without resetting or merging histories. A target without a completed retained
turn shows `Not measured yet`.

The sidebar intentionally renders no context gauge. Its processed-usage copy
may remain, because processed traffic is meaningful for one-shot work.

### 5. Router metadata is normalized; compression policy is unchanged

OpenRouter requests opt into router metadata with
`X-OpenRouter-Metadata: enabled`. The adapter retains only whether a
`context_compression` pipeline stage was reported:

- `applied` when the stage is present;
- `not-applied` when readable metadata reports a pipeline without that stage;
- `unknown` when metadata is absent or unreadable.

The app never stores arbitrary router metadata, messages, or manuscript text as
telemetry. Sprint 11B observes compression; it does not enable, disable, or
replace it.

### 6. Persistence restores history, not a live measurement

The 2026-07-23 persistence amendment restores retained message histories under
logical participant keys and remaps them to fresh runtime conversation ids.
The last context-budget reading may be retained as historical diagnostics, but
it is never presented as a current measurement after hydrate: the leading
system prompt is rebuilt and provider/model conditions may have changed. A
restored conversation displays `Not measured after restore` until its next
successful provider response commits a fresh reading.

## Consequences

### Gains

- The gauge now represents the retained Workshop thread, not merely its last
  pre-response prompt.
- Context ownership and cleanup align with the object that owns the transcript.
- Cancelled and failed turns cannot advance context telemetry past history.
- Host, guest, and tool sidecars retain independent readings.
- One-shot sidebar runs no longer display a misleading conversation gauge.
- Processed traffic, cumulative activity, and retained context have distinct
  names and contracts.
- OpenRouter compression becomes visible without exposing prompt content.

### Costs and risks

- The retained count is provider-measured after the latest completed reply; it
  cannot include a future writer message or predict future provider transforms.
- Streaming usage must still be emitted exactly once when terminal fields
  arrive in separate chunks.
- Missing live model metadata requires an honest unknown denominator.
- Provider metadata schemas can drift and need focused fixtures.

## Rejected alternatives

- **Have `ConversationManager` tokenize its messages:** it has full transcript
  visibility but not the selected model tokenizer or provider-side transforms;
  a local count could be confidently wrong.
- **Use a universal `InferenceContextTracker`:** duplicates retained-thread
  lifecycle, creates cleanup synchronization, and invents questionable
  one-shot/sidebar context state.
- **Show the last request prompt as current context:** omits the assistant reply
  that is already retained for the next turn.
- **Show a sidebar context gauge:** sidebar work has no user-continuable retained
  conversation, so “latest” is an arbitrary one-shot request.
- **Store telemetry in `OpenRouterClient`:** the provider adapter cannot own
  conversation identity or atomic transcript commits.
- **Store telemetry in `WorkshopSessionService`:** mixes provider measurement
  into the participant aggregate and can outlive the provider conversation.
- **Derive context in React:** loses the commit boundary and invites private
  conversation state into the webview.
- **Use cumulative `TokenUsage`:** double-counts resent history and measures
  work, not retained context.
- **Add exact tokenizer preflight now:** model/provider tokenizer coverage and
  transforms are a separate feature; provider-reported completed usage is the
  stronger source for this sprint.

## Implementation

[Sprint 11B — Context Budget Visibility and Inference Telemetry](../../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/11b-context-budget-visibility.md), executed after Sprint 11 and before Sprint 12.
