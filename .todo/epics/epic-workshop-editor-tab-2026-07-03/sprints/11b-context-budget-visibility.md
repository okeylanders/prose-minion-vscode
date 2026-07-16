# Sprint 11B: Context Budget Visibility and Inference Telemetry

**Status**: Planned
**Priority**: High (the current token UI misrepresents processed traffic as
conversation size, immediately before Sprint 12 adds more prompt context)
**Branch**: `sprint/workshop-editor-tab-11b-context-budget-visibility` -> PR into `epic/workshop-editor-tab`
**Estimated Effort**: 3-5 days
**Depends on**: Sprint 11. Executes before Sprint 12 and the final Sprint 10
persistence pass.
**ADR**: [2026-07-16 — Universal Inference Context Observability](../../../../docs/adr/2026-07-16-inference-context-observability.md)

## Goal

Replace ambiguous token counters with honest, universal inference telemetry.
Writers can distinguish one request's context-window pressure from one turn's
multi-call traffic and the app's cumulative processed usage. In Workshop, the
context gauge follows whichever independent host, guest, or tool conversation
the composer is addressing. The sidebar consumes the same provider-neutral
tracking seam.

This sprint measures and names reality. It does not trim, summarize, or silently
compress conversations.

## Why this is 11B

Sprint 11's live persona-file smoke exposed two adjacent truths:

- a valid two-profile lookup can require `search -> read -> search -> read`, so
  capability-heavy turns make several provider calls and the per-turn token
  total can greatly exceed any individual prompt;
- the header's cumulative `Tokens` chip and bubble totals are naturally read as
  context size even though they repeatedly count the same retained history.

The file-access PR remains scoped to file access and its review remediation.
This work changes universal request contracts, lifecycle attribution, model
metadata, and both presentation surfaces. It deserves its own reviewed branch.
It also needs to land before Sprint 12 adds multiple context attachments, so
that attachment UX is designed against visible context pressure rather than an
ambiguous cumulative meter.

## Locked semantics

### Three numbers, three names

- **Last prompt**: provider-reported prompt tokens for one completed model
  request. This is the context gauge numerator.
- **Turn processed**: prompt + completion tokens summed across every provider
  request in one logical user turn. This is cost/traffic, not context size.
- **Cumulative processed**: all completed provider traffic since the explicit
  usage reset. This remains an account/activity meter, not session context.

No UI label uses bare `Tokens` where more than one interpretation is possible.
The turn bubble may remain compact, but its tooltip/copy says `processed across
N calls`.

### Context denominator

- `usable input = live model contextLength - request maxTokens`.
- The live catalog is the only denominator source. Missing/fallback catalog
  metadata renders `Context window unavailable`; no hardcoded 128K/200K
  assumption.
- A reading is tied to the model that measured it. Changing models leaves the
  old reading labeled as old until the next request completes.
- The primary label is `Last prompt` or `Context on last call`, never an exact
  `Current`/`Next prompt` claim.

### Warning thresholds

- Normal: below 70% of usable input.
- Watch: 70% through 84%.
- High: 85% through 94%.
- Critical: 95% and above.

Warnings are informational. No threshold triggers hidden message deletion,
provider switching, summarization, or compression.

### Compression disclosure

- Opt into OpenRouter router metadata and normalize only whether a
  `context_compression` pipeline stage materially ran.
- Render `Applied`, `Not applied`, or `Unknown`; missing metadata is never
  interpreted as proof that compression did not run.
- Do not override account/organization plugin settings in this sprint.
- Do not retain or log raw router metadata, messages, or manuscript content.

## Architecture boundary

### Provider adapter: facts, not ownership

Extend `OpenRouterClient` to return a provider-neutral per-request observation
for streaming and non-streaming calls: model, request max output, usage, finish
reason, and normalized compression state. The adapter parses OpenRouter fields
but owns no cumulative/session state.

### Application service: universal attribution and lifecycle

Add an application-layer `InferenceContextTracker` (final name may sharpen in
implementation) and inject it from `extension.ts` through the existing
composition root. `AgentRunEngine` records every completed provider request
before aggregating the logical turn.

The tracker keys retained work by opaque conversation key and one-shot work by
opaque run key. It exposes safe snapshots and cleanup operations; it knows no
React, VS Code, or Workshop persona/tool types.

Minimum snapshot fields:

```ts
interface ContextBudgetSnapshot {
  modelId: string;
  promptTokens: number;
  peakPromptTokensThisTurn: number;
  requestedMaxOutputTokens: number;
  callsThisTurn: number;
  turnProcessedTokens: number;
  contextCompression: 'applied' | 'not-applied' | 'unknown';
  measuredAt: number;
}
```

Context length and utilization may be joined from `ModelOption` in the
presentation path, but the measured `modelId` must travel with the snapshot so
an old reading is never reinterpreted against a newly selected model.

### Presentation: shared component, surface-specific placement

Create one context-budget component and pure formatting/threshold helpers.

- **Workshop:** render below the participant rail/direct-target band and above
  the composer. Label it with the active target (`Jill context`, `Quinn
  context`, `Continuity context`). The host maps the private `chatTarget` to the
  tracker; conversation ids never reach React.
- **Sidebar:** render the same component in the active tool/model control band.
  It follows the latest applicable one-shot/run scope and contains no Workshop
  participant language.
- **Header:** rename the existing cumulative chip to `Processed`; keep account
  balance and model selection global.

Compact example:

```text
Jill context   Last prompt 38K / 190K   20%
```

Expanded details:

```text
Model window       200K
Output reserved     10K
Last prompt         38K
Peak this turn      41K
This turn            5 calls · 172K processed
Cumulative          429K processed
Compression         Not applied
```

## Participant and lifecycle rules

- Host, each live guest, and each current tool sidecar keep separate readings.
- Changing `WorkshopChatTarget` swaps the visible reading immediately; it does
  not reset or merge participant telemetry.
- A participant without a completed call shows `Not measured yet`.
- A new run of the same tool replaces that tool's prior live conversation and
  gauge, matching `adoptToolSidecar`.
- Dismissing a guest retires its live tracker key and returns the widget to the
  host target.
- Bounded handoff/catch-up frames may increase the recipient's next measured
  prompt, but never merge two histories or gauges.
- New Session retires all Workshop conversation readings. It does not reset
  cumulative processed usage; only the existing explicit usage reset does.
- AI-resource generation rebuild/expiry clears readings that no longer map to
  a live provider conversation.
- Sprint 10 restored T2 sessions begin `Not measured yet`; archived transcript
  history is not live model memory.

## Tasks

### Characterize before changing

- [ ] Add engine characterization proving one logical-turn total is the sum of
      several request usages while `last prompt` and `peak prompt` remain
      individual-call values.
- [ ] Pin streaming terminal-usage behavior so telemetry emits once even when
      finish reason and usage arrive in separate chunks.
- [ ] Characterize current global reset/New Session/model-change behavior and
      name each desired boundary explicitly.
- [ ] Add OpenRouter fixtures with no metadata, unrelated pipeline stages, and
      applied context compression.

### Contracts and application service

- [ ] Add provider-neutral request-observation and context-budget snapshot
      types in the core semantic type layer; export through the barrel.
- [ ] Implement the application tracker with retained-conversation and
      one-shot-run keys, bounded per-turn trace, latest/peak lookup, retirement,
      and resource-generation cleanup.
- [ ] Construct/inject the tracker from `extension.ts`; no service construction
      inside `MessageHandler`, handlers, providers, or React.
- [ ] Feed observations from every `AgentRunEngine` provider call before
      logical-turn aggregation. Preserve existing aggregate usage/cost exactly
      once.

### Provider metadata

- [ ] Request `X-OpenRouter-Metadata: enabled` for streaming and non-streaming
      calls.
- [ ] Normalize only the context-compression pipeline fact and discard the raw
      metadata object after observation creation.
- [ ] Treat absent/unparseable metadata as `unknown`; log schema drift without
      prompt/message content.

### Message and surface integration

- [ ] Add one typed telemetry update/query contract usable by both webview
      roots; no ad-hoc window messages.
- [ ] Rename global and per-turn labels/tooltips to `processed` semantics on
      sidebar and Workshop.
- [ ] Build the shared context-budget component, utilization helper, accessible
      textual status, theme-safe warning states, and unknown/empty states.
- [ ] Workshop maps active host/guest/tool target to a safe participant-labeled
      snapshot and renders it below the participant rail, above the composer.
- [ ] Sidebar renders the latest applicable run/model reading using the same
      component and terminology.

### Lifecycle

- [ ] Switching host/guest/tool targets restores independent readings.
- [ ] Tool replacement, guest dismissal, New Session, conversation expiry, and
      resource-manager rebuild retire only the affected live readings.
- [ ] Model changes preserve the old measured model label and move to the new
      denominator only after a new request.
- [ ] Update Sprint 10's persistence inventory: no conversation id or live
      context reading is restored as provider memory.

## Tests

- [ ] Unit: request observation normalization, output reserve math, threshold
      boundaries (69/70/84/85/94/95), unknown context length, compression
      tri-state.
- [ ] Engine: one-call, five-call, correction, forced-final retry, streaming,
      cancellation, and transport failure; no usage double-counting.
- [ ] Workshop aggregate: Jill -> guest -> tool -> Jill switches restore three
      distinct readings; raw conversation ids absent from snapshots/messages.
- [ ] Lifecycle: guest dismissal, same-tool replacement, New Session, model
      change, and generation rebuild.
- [ ] Webview: shared widget semantics on both roots, active-target label,
      processed-copy regression, keyboard/screen-reader text, reduced motion.
- [ ] Architecture: core remains free of `vscode`; app remains the only
      composition root; universal tracker imports no Workshop/presentation
      types.

## Acceptance Criteria

- A five-call Jill resource turn may show `172K processed across 5 calls` while
  the context widget independently shows, for example, `Last prompt 38K /
  190K`; neither value is labeled simply `Tokens`.
- Switching Jill -> Quinn -> Continuity -> Jill displays each independent last
  prompt and restores Jill's original reading when returning.
- The same selected model/window is shared where appropriate, but no
  participant inherits another participant's numerator or processed turn
  count.
- OpenRouter-applied context compression produces a visible `Applied` state;
  unavailable metadata produces `Unknown`, not a false assurance.
- A custom/offline-catalog model with no live context length shows an honest
  unavailable denominator and never assumes 200K.
- New Session clears active participant readings but leaves cumulative
  processed usage unchanged until explicit reset.
- Focused/full tests, typecheck, lint, production build, `verify:bundle`, and
  `git diff --check` pass. Record bundle deltas.

## Guardrails

- No automatic trimming, windowing, summarization, model switching, or provider
  compression-policy override in 11B.
- No raw conversation ids, router metadata, messages, or manuscript text cross
  the webview telemetry contract.
- No exact `current`/`next` context claim from a backward-looking provider
  measurement.
- Do not make `WorkshopSessionService` the universal telemetry store or make
  `OpenRouterClient` the participant/session owner.
- Preserve existing billing totals; relabeling must not change cost arithmetic.
- If implementation reveals a need for preflight tokenization or context
  compaction, capture it as a separate ADR/todo rather than smuggling it into
  this observability sprint.
