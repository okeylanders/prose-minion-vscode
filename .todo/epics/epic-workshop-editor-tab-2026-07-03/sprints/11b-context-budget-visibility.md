# Sprint 11B: Workshop Context Budget Visibility and Inference Telemetry

**Status**: Complete (implementation ready 2026-07-16)
**Priority**: High (processed traffic was being mistaken for retained context
immediately before Sprint 12 adds more prompt material)
**Branch**: `sprint/workshop-editor-tab-11b-context-budget-visibility` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3-5 days
**Depends on**: Sprint 11. Executes before Sprint 12 and the final Sprint 10
persistence pass.
**ADR**: [2026-07-16 — Workshop Retained-Context Observability](../../../../docs/adr/2026-07-16-inference-context-observability.md)

## Goal

Give Workshop writers an honest view of the context retained by the active
host, guest, or tool conversation. Keep that reading distinct from the repeated
provider traffic processed across a capability-heavy user turn and from
cumulative app activity.

Context visibility is Workshop-only. Sidebar tools do not expose user-driven
retained chat turns, so a “latest sidebar context” gauge would describe an
arbitrary one-shot request rather than a conversation the writer can continue.

This sprint measures and names reality. It does not trim, summarize, or silently
compress conversations.

## Why this is 11B

Sprint 11's live persona-file smoke exposed two adjacent truths:

- a valid two-profile lookup can require `search -> read -> search -> read`, so
  one logical writer turn may make several provider calls;
- turn and cumulative totals repeatedly count retained history and therefore
  cannot represent how much context the Workshop conversation currently holds.

This work changes provider response contracts, retained-conversation lifecycle,
model metadata, Workshop projection, and token terminology. It lands before
Sprint 12 expands context intake so those attachments are added against a
visible context budget.

## Locked semantics

### Three numbers, three names

- **Current context**: final provider-reported prompt tokens plus final response
  completion tokens from the latest successfully committed Workshop turn. This
  is the retained conversation immediately after the reply; it excludes the
  next not-yet-sent writer message.
- **Turn processed**: prompt plus completion tokens summed across every provider
  request in one logical writer turn. This is work/cost, not retained context.
- **Cumulative processed**: all completed provider traffic since the explicit
  usage reset. This is activity, not session context.

No UI label uses bare `Tokens` where more than one interpretation is possible.
The expanded context view may expose **Last request prompt** as a diagnostic,
but it is not the primary value.

### Context denominator

- `usable input = live measured-model contextLength - request maxTokens`.
- The live catalog is the only denominator source. Missing or fallback metadata
  renders `Window unavailable`; no hardcoded 128K/200K assumption.
- A reading remains tied to the model that measured it until a later successful
  turn replaces it.

### Warning thresholds

- Normal: below 70% of usable input.
- Watch: 70% through 84%.
- High: 85% through 94%.
- Critical: 95% and above.

Warnings are informational. They never trigger hidden deletion, model
switching, summarization, or compression.

### Compression disclosure

- Opt into OpenRouter router metadata and normalize only whether a
  `context_compression` pipeline stage materially ran.
- Render `Applied`, `Not applied`, or `Unknown`; missing metadata is not proof
  that compression did not run.
- Do not retain or log raw router metadata, messages, or manuscript content.
- Do not override account or organization compression settings.

## Architecture boundary

### Provider adapter: facts, not ownership

`OpenRouterClient` returns a provider-neutral observation for completed
streaming and non-streaming calls: measured model, prompt/completion/total
usage, requested output reserve, finish reason, and normalized compression
state. It owns no conversation or UI state.

### Retained conversation: lifecycle owner

`ConversationManager` already owns every retained transcript. It stores the
matching `ContextBudgetSnapshot` beside that transcript and clears it through
the same reset/delete/expiry lifecycle.

`AgentRunEngine` collects observations and processed usage locally during a
turn. Only after the final response and all pending transcript messages commit
atomically does it update the conversation snapshot. A cancelled or failed turn
leaves both history and the prior context measurement untouched.

The manager does not estimate tokens from message strings. It lacks model
tokenizers and provider transforms; the engine supplies the provider-measured
facts at the commit boundary.

Minimum snapshot fields:

```ts
interface ContextBudgetSnapshot {
  modelId: string;
  contextTokens: number;
  promptTokens: number;
  completionTokens: number;
  peakPromptTokensThisTurn: number;
  requestedMaxOutputTokens: number;
  callsThisTurn: number;
  turnProcessedTokens: number;
  contextCompression: 'applied' | 'not-applied' | 'unknown';
  measuredAt: number;
}
```

No standalone universal tracker, one-shot registry, sidebar query/update
contract, or React-owned inference state is needed.

### Workshop presentation

The shared context-budget component and pure utilization helpers are rendered
only in Workshop, below the participant/target rail and above the composer.
`WorkshopHandler` maps the active private conversation to a safe labeled
snapshot (`Jill context`, `Quinn context`, `Continuity context`); conversation
ids never reach React.

Compact example:

```text
Jill context   Context 42K / 190K · 22%
```

Expanded details:

```text
Measured model      Claude Haiku 4.5
Model window        200K
Usable input        190K
Output reserved      10K
Current context      42K
Last request prompt  38K
Last response         4K
Peak this turn       41K
This turn             5 calls · 172K processed
Cumulative           429K processed
Compression          Not applied
```

## Participant and lifecycle rules

- Host, each live guest, and each current tool sidecar keep separate readings.
- Changing `WorkshopChatTarget` swaps the visible reading without resetting or
  merging histories.
- A participant without a successfully completed retained turn shows `Not
  measured yet`.
- Running the same tool again replaces the tool conversation and its reading.
- Dismissing a guest deletes its conversation and reading together.
- New Session deletes all Workshop conversations/readings but does not reset
  cumulative processed usage.
- Cancellation and transport failure preserve the prior committed reading.
- A model change leaves the old measured model attached until a new turn
  commits.
- Sprint 10 restores retained histories, but the prior reading is not claimed as
  live after hydrate because the leading system prompt and provider conditions
  may have changed. Show `Not measured after restore` until the next successful
  request commits a fresh reading.

## Tasks

### Characterize before changing

- [x] Prove one logical-turn total may sum several request usages while retained
      context comes from the final successfully committed request and reply.
- [x] Pin streaming terminal usage when usage, model, metadata, and finish reason
      arrive in separate chunks.
- [x] Characterize reset, target switch, model change, cancellation, transport
      failure, and conversation deletion boundaries.
- [x] Add metadata fixtures for missing, unrelated, applied, and unreadable
      compression pipelines.

### Contracts and conversation ownership

- [x] Add provider-neutral observation, compression, and context-snapshot types
      to the core semantic type layer.
- [x] Store the latest committed snapshot in `ConversationManager`, with
      defensive reads and reset/delete/expiry cleanup inherited from the
      transcript lifecycle.
- [x] Have `AgentRunEngine` gather per-call facts locally and update the snapshot
      only after its atomic history commit.
- [x] Preserve existing logical-turn usage and cost aggregation exactly once.

### Provider metadata

- [x] Request `X-OpenRouter-Metadata: enabled` for streaming and non-streaming
      calls.
- [x] Normalize only the compression-stage fact and discard raw metadata after
      observation creation.
- [x] Treat absent or unreadable metadata as `unknown` and log schema drift
      without prompt or manuscript content.

### Workshop surface

- [x] Rename cumulative and per-turn copy to explicit `processed` semantics.
- [x] Build context utilization helpers and an accessible expandable gauge with
      empty, unavailable, and warning states.
- [x] Project the active host/guest/tool conversation as a safe labeled snapshot
      and render it above the Workshop composer.
- [x] Keep context UI and telemetry routing out of the sidebar.
- [x] Keep processed-usage reset fanout shared between the sidebar and Workshop.

### Prompt behavior

- [x] State in the immutable Workshop persona prompt that every new writer
      message starts a fresh capability-call allowance.
- [x] Append a compact reset reminder to every retained continuation turn so an
      exhausted earlier-turn limit is never treated as permanent.

### Lifecycle and persistence

- [x] Restore independent readings when switching host/guest/tool targets.
- [x] Remove readings automatically with tool replacement, guest dismissal, New
      Session, idle expiry, and resource-manager replacement.
- [x] Preserve the previous snapshot on cancellation or transport failure.
- [x] Update Sprint 10: restored sessions never claim an archived context
      reading as live provider memory.

## Tests

- [x] Unit: output reserve math, warning boundaries
      (69/70/84/85/94/95), unknown model windows, compact formatting, and
      compression tri-state.
- [x] Engine/conversation: multi-call aggregation, retained current-context
      calculation, defensive snapshot ownership, atomic commit, cancellation,
      transport failure, reset, and deletion.
- [x] Workshop: Jill -> guest -> tool -> Jill restores independent readings;
      raw conversation ids remain absent from webview projections.
- [x] Lifecycle: guest dismissal, same-tool replacement, New Session, model
      hot-swap, idle expiry, and resource-generation rebuild.
- [x] Webview: active-target label, current-context and processed copy,
      measured-model association, keyboard/screen-reader text, and unknown
      states.
- [x] Architecture: core remains free of `vscode`; the app remains the sole
      composition root; telemetry contracts contain no Workshop ids or raw
      OpenRouter metadata.

## Acceptance Criteria

- A five-call Jill resource turn may show `172K processed across 5 calls` while
  the Workshop gauge independently shows `Context 42K / 190K`; neither value is
  labeled simply `Tokens` or `Last prompt`.
- The 42K retained context is computed from the final request's 38K prompt plus
  the retained 4K assistant reply.
- Switching Jill -> Quinn -> Continuity -> Jill restores each independent
  retained-conversation snapshot.
- The sidebar shows no context gauge.
- Compression `Applied`, `Not applied`, and `Unknown` remain distinguishable.
- Missing live model-window data never falls back to an invented denominator.
- New Session clears conversation readings but leaves cumulative processed
  usage unchanged until explicit reset.
- Focused/full tests, typecheck, lint, production build, `verify:bundle`, and
  `git diff --check` pass. Record bundle deltas.

## Guardrails

- No automatic trimming, windowing, summarization, model switching, or provider
  compression-policy override in 11B.
- No raw conversation ids, router metadata, messages, or manuscript text cross
  the webview telemetry contract.
- Do not describe processed traffic as retained context.
- Do not estimate exact tokens inside `ConversationManager`; it owns lifecycle,
  while the provider supplies measurement through `AgentRunEngine`.
- Do not add a sidebar gauge until a sidebar feature owns a real user-retained
  chat thread.
- Preserve billing totals; copy changes must not alter cost arithmetic.
- Preflight tokenization or context compaction requires a separate ADR/todo.

## Completion Record — 2026-07-16

- Added provider-neutral observations for streaming and non-streaming OpenRouter
  requests. Only the normalized `context_compression` fact survives; terminal
  fields may arrive separately but emit one completed observation.
- Made `ConversationManager` the retained-context snapshot owner. The engine
  records `final prompt + final completion` only after committing the matching
  transcript turn, so deletion and failure semantics cannot drift.
- Added the expandable context gauge only to Workshop. It follows the active
  host, guest, or tool conversation, uses the measured model's live catalog
  window, and keeps last-request prompt and multi-call processed traffic as
  explicitly separate details.
- Updated the Workshop persona base prompt, initial capability contract, and
  every continuation reminder to state that the resource/capability allowance
  resets with each new writer message.
- Renamed aggregate UI copy to `Processed`, including per-turn call counts, and
  preserved explicit processed-usage reset across both webview roots.
- Verification: 97 Jest suites / 830 tests and 1 snapshot passed; all three
  typechecks passed; ESLint passed with zero errors; production webpack and
  `verify:bundle` passed; `git diff --check` passed.
- Production bundles compared with the Sprint 11 build:
  `extension.js` 2,392,575 -> 2,396,555 bytes (+3,980 / +0.17%);
  `webview.js` 640,016 -> 645,669 bytes (+5,653 / +0.88%). Webpack's existing
  webview asset-size recommendations remain warnings only.

## Post-completion addendum — 2026-07-16 review pass

- Review fixes landed on the sprint branch: router metadata without a
  readable pipeline now normalizes to `unknown` (only an explicit pipeline
  that omits the stage proves `not-applied`); utilization percent is rounded
  once in the shared view helper so the displayed label and warning tone
  agree at threshold boundaries; the engine logs every committed context
  snapshot so a moving gauge can be diagnosed from the output channel.
- The gauge was restyled to the Claude Design "Context Bar v2" comp:
  identity dot + participant name, tone-colored budget track, compact
  numbers/percent, drawer, dashed not-measured state, and a footer naming
  the per-participant reading. Locked tone thresholds are unchanged.
- The comp's "In context" sources section and Compress/Compact memory
  actions are NOT part of 11B: the per-conversation source manifest
  (including host-fetched resources and host-triggered tool evidence) is
  specified in Sprint 12, and compaction still requires its own ADR.
