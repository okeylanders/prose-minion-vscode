# Feature: Add Live Stats to AI Streaming Progress

**Created:** 2026-06-24  
**Status:** Archived / released  
**Released In:** 2.0.0 (Marketplace, 2026-06-25)  
**Archived:** 2026-06-26  
**Priority:** Medium  
**Type:** UX enhancement  
**Area:** AI streaming / progress feedback  
**Reference:** [stats.png](stats.png)

## Summary

Expand the compact streaming header so users can see useful live progress
statistics while an AI response is arriving.

The current header shows:

```text
● Streaming (305 tokens)                                      [×]
```

The enhanced header should communicate:

- how much output has arrived;
- how long the request has been streaming;
- the initial response latency (time to first chunk);
- the current average output rate;
- whether the stream is still waiting, active, complete, or cancelled.

The UI should remain a single compact row and preserve the existing cancel
button.

## Problem

Long analysis and dictionary requests can stream for a meaningful amount of
time. The changing output proves that the request is alive, but the user has no
sense of:

- elapsed time;
- how long the model/provider took to begin responding;
- whether output is arriving quickly or has stalled;
- how much response has accumulated;
- whether the displayed count is exact provider usage or only a client-side
  estimate.

There is also a correctness issue in the current label. `useStreaming` increments
`tokenCount` once for every `STREAM_CHUNK` callback. OpenRouter content deltas
are not guaranteed to contain exactly one model token, so the value displayed as
“tokens” is currently a count of received chunks, not authoritative tokenizer
usage.

## Proposed Experience

Recommended compact layout:

```text
● Streaming · 305 chunks · 18.4s · first 2.1s · 16.6 chunks/s [×]
```

If we deliberately retain the friendlier “tokens” wording, it must be labeled as
an estimate:

```text
● Streaming · ~305 tokens · 18.4s · first 2.1s · ~16.6 tok/s [×]
```

The honest default is **chunks**, because that is what the client can measure
live without introducing a tokenizer dependency. Exact provider usage is
available only when `STREAM_COMPLETE` arrives and should remain part of the
completed request/token accounting path.

### Responsive behavior

The sidebar can be narrow. Stats should degrade without breaking the header:

1. Always show status and cancel.
2. Prefer count + elapsed time + initial latency.
3. Hide throughput first when horizontal space is constrained.
4. Hide initial latency next if the title bar still cannot fit.
5. Do not wrap the cancel button onto a second row.

Example narrow state:

```text
● Streaming · 305 chunks · 18s · first 2.1s                  [×]
```

## Scope

### In scope

- Track elapsed streaming time in `useStreaming`.
- Track initial latency from stream start to the first received chunk.
- Derive average chunks per second from count and elapsed time.
- Rename internal `tokenCount` terminology where practical so the state does
  not claim tokenizer accuracy.
- Display live count, elapsed time, and throughput in `StreamingContent`.
- Update the stats at a human-readable cadence without rerendering every
  millisecond.
- Reset stats cleanly between requests.
- Stop the timer when a stream completes or is cancelled.
- Preserve existing buffering, markdown rendering, and cancellation behavior.
- Apply the shared behavior to analysis, context, and standard dictionary
  streaming because all three use `useStreaming` / `StreamingContent`.

### Out of scope

- Adding a tokenizer library solely to estimate live model tokens.
- Showing prompt-token count before the provider reports usage.
- Cost prediction during an active request.
- Fast Dictionary block progress; it uses known block progress through
  `LoadingIndicator`, not the standard streaming-content header.
- Category Search batch progress.
- Persisting per-request streaming telemetry across reloads.
- Historical performance charts.

## Data Model

Recommended additions to `StreamingState`:

```typescript
interface StreamingState {
  buffer: string;
  displayContent: string;
  isBuffering: boolean;
  isStreaming: boolean;

  chunkCount: number;
  elapsedMs: number;
  initialLatencyMs?: number;
  chunksPerSecond: number;
}
```

`chunksPerSecond` may be derived by the hook or by a pure formatter:

```typescript
const chunksPerSecond =
  elapsedMs > 0 ? chunkCount / (elapsedMs / 1000) : 0;
```

Prefer storing only the primitive state needed for rendering:

- `startedAtRef`
- `chunkCount`
- `elapsedMs`
- `initialLatencyMs`

Throughput can then be derived. Avoid parallel state that can disagree.

`initialLatencyMs` should be recorded exactly once:

```typescript
if (initialLatencyMs === undefined && startedAtRef.current !== null) {
  setInitialLatencyMs(Date.now() - startedAtRef.current);
}
```

Use a ref or functional state guard so multiple chunks arriving in the same
React batch cannot overwrite the first measurement.

## Timing Behavior

- Set the start timestamp in `startStreaming()`.
- Update `elapsedMs` with a lightweight interval, recommended every **250 ms**.
- On the first `appendToken()` call, capture
  `Date.now() - startedAtRef.current` as `initialLatencyMs`.
- Never recalculate initial latency after the first chunk.
- Clear the interval in:
  - `endStreaming()`
  - `reset()`
  - component unmount cleanup
- Do not restart the elapsed timer when the first content chunk arrives; elapsed
  time represents the full request wait from `STREAM_STARTED`.
- While no chunk has arrived, render initial latency as `first …` or omit its
  value rather than showing `0 ms`.
- If a request completes or is cancelled before any chunk arrives, initial
  latency remains unavailable.
- Preserve the final elapsed value after `endStreaming()` only if the completed
  UI will display final stats. Otherwise reset it when the streaming header
  disappears.

The first implementation may keep stats visible only while `isStreaming` is
true. A persistent completed summary is a separate product decision.

## Presentation

Add a small pure formatter rather than building punctuation inline:

```typescript
formatStreamingStats({
  chunkCount,
  elapsedMs,
  initialLatencyMs,
  chunksPerSecond
});
```

Suggested formatting:

- `0–9.9 seconds`: one decimal (`8.4s`)
- `10–59 seconds`: whole seconds (`18s`)
- `60+ seconds`: `m:ss` (`1:24`)
- initial latency below one second: milliseconds (`first 420ms`)
- initial latency at or above one second: seconds (`first 2.1s`)
- throughput: one decimal when below 100, otherwise whole number
- do not display `NaN`, `Infinity`, or negative values
- hide throughput until at least one chunk and 500 ms have elapsed
- do not display an initial-latency number until the first chunk arrives

Use the existing `streaming-header`, `streaming-indicator`, and cancel-button
styles. Add semantic child classes for individual values so CSS can hide the
least important stat at narrow widths.

## Architecture Touchpoints

Likely files:

- `packages/core/src/presentation/webview/hooks/useStreaming.ts`
- `packages/core/src/presentation/webview/components/shared/StreamingContent.tsx`
- `packages/core/src/presentation/webview/index.css`
- analysis/context/dictionary domain hooks if the `tokenCount` return property is
  renamed
- `AnalysisTab.tsx` and `UtilitiesTab.tsx` for renamed props
- `packages/core/src/__tests__/presentation/webview/hooks/useStreaming.test.ts`
- a new pure formatter test or lightweight `StreamingContent` helper test

No new extension/webview messages should be necessary. The webview already knows
when streaming starts and receives each chunk.

## Acceptance Criteria

- [ ] Starting a stream displays a live elapsed timer immediately.
- [ ] Before the first chunk arrives, initial latency is shown as pending or is
      omitted; it is never displayed as zero.
- [ ] The first received chunk records time-to-first-chunk exactly once.
- [ ] Later chunks do not change the initial-latency value.
- [ ] Every received stream chunk increments the live output count.
- [ ] The UI does not describe chunk count as exact provider token usage.
- [ ] Average throughput is displayed after enough data exists to calculate it
      meaningfully.
- [ ] Elapsed time updates while waiting for the first chunk.
- [ ] Completing a stream stops all timing intervals.
- [ ] Cancelling a stream stops all timing intervals.
- [ ] Starting a second stream resets count, elapsed time, and throughput.
- [ ] Starting a second stream also clears the previous initial-latency value.
- [ ] Unmounting the hook leaves no active interval or timeout.
- [ ] Analysis, context generation, and standard dictionary lookup show the same
      stats format.
- [ ] The cancel button remains usable and visually stable.
- [ ] The header remains readable in narrow sidebar widths.
- [ ] Existing five-second buffering and 100 ms content debounce behavior are
      unchanged.
- [ ] Existing streaming-cancellation tests remain green.

## Test Plan

### Hook tests

Use fake timers to prove:

- start sets elapsed time to zero and begins timing;
- elapsed time advances at the configured cadence;
- the first chunk captures initial latency from the stream start time;
- subsequent chunks preserve the original initial latency;
- chunks increment the count;
- rate is derived correctly;
- end freezes/stops timing;
- reset clears all metrics;
- a stream cancelled before its first chunk leaves initial latency unavailable;
- repeated starts do not create multiple intervals;
- unmount clears the interval and existing buffer/debounce timers.

### Formatter tests

Cover:

- zero state;
- sub-second state;
- normal seconds;
- minute formatting;
- zero elapsed time;
- pending initial latency;
- sub-second initial latency in milliseconds;
- initial latency in seconds;
- invalid/non-finite values;
- responsive optional-field output.

### Manual verification

- Run prose analysis and watch the stats increase.
- Run context generation and verify the same format.
- Run standard dictionary lookup and compare with the reference image.
- Cancel during buffering and during active output.
- Start a second request immediately after cancellation.
- Test at narrow and wide sidebar widths.
- Confirm exact session token/cost totals still arrive through
  `TOKEN_USAGE_UPDATE` after completion.

## Risks and Guardrails

- **Metric honesty:** A streamed content delta is not guaranteed to equal one
  model token. Avoid presenting chunk count as authoritative token usage.
- **Latency semantics:** Initial latency is client-observed time from
  `STREAM_STARTED` handling to the first `STREAM_CHUNK`; it includes extension,
  network, provider queue, and model startup time. Label it as “first” or
  “first chunk,” not pure model inference latency.
- **Render churn:** A timer that updates too frequently can cause unnecessary
  markdown/header rerenders. Use a 250 ms cadence and keep derived formatting
  cheap.
- **Timer leaks:** `useStreaming` already owns several timers. Add the interval
  to the existing centralized cleanup path.
- **Narrow layout:** More information can make the header noisy. Use priority-
  based responsive hiding rather than wrapping everything.

## Recommended Implementation Slice

This is a small presentation-layer feature and does not require an ADR.

Suggested branch:

`feature/streaming-progress-stats`

Estimated effort: **2–4 hours**, including tests and responsive polish.

## Open Decision

Confirm the user-facing count label:

1. **Chunks** — technically honest and dependency-free; recommended.
2. **Estimated tokens** — friendlier, but requires an explicit approximation and
   may disagree with final provider usage.
3. **Words** — easy to derive from accumulated content, but less directly tied
   to model billing/performance.
