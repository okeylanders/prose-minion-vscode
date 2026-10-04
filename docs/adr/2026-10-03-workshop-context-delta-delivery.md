# ADR 2026-10-03: Acknowledged Workshop Context Deltas

**Status:** Accepted
**Related:** PR #123 review F-01, F-02, F-04

## Problem

A standing-context mutation currently appends every attachment body again to
retained host history. The 100,000-word intake limit does not bound accumulated
history. A small edit can duplicate the entire list and exceed a model window.

## Decision

Use acknowledged-state synchronization: retain a compact host delivery baseline
of attachment ids and content/metadata fingerprints, plus its context revision.
A named context-delivery collaborator compares the current working set against
that baseline. It emits added/changed attachment bodies and explicit removed
ids. Unchanged bodies do not enter a new history message. Changed bodies replace
the model's active version by id; earlier versions remain honest history.

Both host chat and tool-report synthesis use one preparation seam to capture
the initial attachment snapshot before host dispatch and acknowledge that exact
snapshot only after the first host turn succeeds. Tool synthesis captures after
the analysis pass, so intervening edits belong to its initial envelope. A
successful update advances the baseline even when a newer edit is pending;
clear pending revisions covered by the delivered generation, leaving newer
revisions queued. Failure/cancellation leaves the baseline untouched. Multiple
edits before dispatch coalesce by current state.

Persist the host-private fingerprint baseline alongside the existing V1 room
state; validate its shape, revision, unique ids, and counter references. It never
crosses the webview boundary and does not duplicate manuscript bodies. A room
without a baseline needs a complete replacement once. Restore preserves a valid
baseline; loss of the host discards it. Rewind retains it only if its revision
matches the surviving host history mark; otherwise invalidate it and queue a
complete resynchronization. Do not parse retained message text to reconstruct
state, and do not alter old messages or historical cache prefixes.

Before each provider inference, check an estimated input token count
plus requested output and safety headroom against the selected model's live,
cached context length. Prefer literal alias catalog entries, then normalize
routing aliases/variants for catalog lookup. Do not treat offline fallback
metadata as a real window. Unknown windows are logged once per uninterrupted
period of missing metadata for the current model and left to the provider.
Count all history and in-turn tool/correction
messages; a cache read still occupies context. Refuse an estimated overflow
before provider I/O, preserving pending work and atomic history. Explain that
the writer can reduce standing context or the excerpt, start a fresh room with
fewer inputs for a long conversation, or switch to a larger model. Expose
overflows as `AgentRunUnavailableError` with a `context-window-exceeded` reason
and numeric details: the host restores its provisional writer message to the
composer, a refused tool request is rolled back, and sidebar tools publish an
error without an analysis result. A completed tool report survives a refused
synthesis. This estimate is a practical preflight, not an exact tokenizer guarantee.

Keep the requested 100K-word and seven-item limits. Sync persona prompt numbers
with the validator and guard them in CI. Derive Gesture Playground's referenced
source allowance from standing context plus the pinned-excerpt character cap.
Seven items at 10K words each intentionally allow up to 70K words in a single
message. Aggregate history still has to pass request context preflight; the
standing and per-message limits are intake ceilings, not model-window guarantees.
The context panel states this distinction before send. Keep the conservative
estimator pending provider-tokenizer calibration; a live numerical remaining
capacity display remains follow-up work (review F-28).

## Verification

Cover initial delivery, additions, edits, removals, multiple pending mutations,
failed retries, edits during an in-flight turn, checkpoint restore, host loss,
and rewind. Assert unchanged large bodies never enter a delta. Exercise both
streaming and non-streaming preflight, output reserve, routing normalization,
unknown/fallback metadata, and growth during capability rounds. Verify prompt
number sync and a long legal Gesture source, then run typecheck and tests.
