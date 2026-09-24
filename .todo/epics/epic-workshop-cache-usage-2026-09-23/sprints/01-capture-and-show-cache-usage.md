# Sprint 01: Capture and Show Cache Usage

**Status:** Implementation complete; live provider and editor-tab checks pending
**Branch:** `feat/workshop-cache-usage-badge`

## Writer experience

The response header already shows total processed tokens. Add a compact cache-read indicator beside it, using the same per-response usage. A positive reported read says `N cached`; an explicit zero says `0 cached`. Explain in accessible text that this is prompt input read from a provider cache, not the size of retained context. If cache details are absent, show no badge. Cache writes may be included in the detail text but are never called a hit.

For a logical response containing several provider calls, report the sum only when every call reports cache details. Partial reporting must not look like a complete zero or percentage. Keep total processed tokens unchanged. Allow the header to wrap at narrow widths, and do not rely on color alone.

## Implementation

1. Parse `usage.prompt_tokens_details.cached_tokens` and `cache_write_tokens` defensively in the OpenRouter client for streaming and non-streaming responses. Preserve absent versus explicit zero.
2. Add optional cache counts to `TokenUsage`, aggregate them across the same provider-call boundary as prompt and total tokens, and accept them in persisted Workshop turns without changing old sessions.
3. Render the indicator in the assistant turn header beside the existing usage label. Preserve the existing context bar.
4. Cover provider parsing, multi-call aggregation, restored-session shape, and UI states with focused tests. Run typechecks, affected tests, lint on changed source, and a production build.

## Completion criteria

- [x] A response with a reported positive cache read shows that count in its header.
- [x] Reported zero and absent cache details remain distinguishable.
- [x] Multi-call responses never label partial reporting as a complete result.
- [x] Existing Workshop checkpoints still load; new cache fields survive a round trip.
- [x] Streaming and non-streaming usage normalize the same way.
- [ ] The indicator is legible and accessible in the narrow Workshop editor tab.

## Manual proof

A real OpenRouter response and the editor-tab appearance require a manual provider/UI check. Automated fixtures prove parsing and presentation but do not prove a particular model currently emits cache details or receives cache hits.

On 2026-09-24, Okey reported that the feature was working well in live use. The model, response fields, and narrow editor-tab accessibility check were not recorded, so the final criterion remains open.

## Validation recorded

- 4 focused suites / 116 tests passed, followed by 2 affected suites / 71 tests after the final persistence guard.
- Core, webview, and extension typechecks passed.
- Changed-source ESLint finished with 0 errors (106 warnings across the selected files).
- Production webpack build and bundle verification passed (webpack emitted size warnings).
- `git diff --check` passed.
