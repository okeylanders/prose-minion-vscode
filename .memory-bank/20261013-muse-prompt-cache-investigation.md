# Muse prompt-cache investigation — 2026-10-13

**Branch:** `release/v2.10.0`, investigation began at `e08f5e1e`
**Status:** User's Activity screenshot confirms one Wonder cache hit and five approximately full-price requests; fixed TTL and miss causes remain unconfirmed. Okey requested a disclosed five-minute display estimate.
**Scope:** Public provider contracts, existing local runtime metadata, mocked tests, and the requested countdown/footnote implementation. No paid inference call.

## Provider evidence

The public OpenRouter endpoint records list one Meta endpoint for each curated Muse model, all with discounted `input_cache_read` pricing:

| Model | Input per million tokens | Cache read per million tokens |
| --- | ---: | ---: |
| Muse Spark 1.1 | $1.25 | $0.15 |
| Muse Spark 1.2 | $1.25 | $0.15 |
| Muse Spark 1.3 | $1.25 | $0.15 |
| Muse Wonder | $4.00 | $0.20 |

Sources: `/api/v1/models/meta/muse-spark-1.1/endpoints`, `/api/v1/models/meta/muse-spark-1.2/endpoints`, `/api/v1/models/meta/muse-spark-1.3/endpoints`, and `/api/v1/models/meta/muse-wonder/endpoints` on `https://openrouter.ai`. Public snapshots are under `/tmp/prose-cache-audit-meta-muse-*.json`.

Meta's [prompt-caching guide](https://dev.meta.ai/docs/prompt-caching) describes automatic prefix caching with no enable flag or breakpoint. Chat Completions reports reads at `usage.prompt_tokens_details.cached_tokens`. Stable leading tokens are reusable; a changed prefix ends the match. An optional `prompt_cache_key` groups requests across backends. Default retention is server-managed and subject to pressure/inactivity; the guide gives no fixed lifetime to display for these Chat Completions requests.

OpenRouter's [caching guide](https://openrouter.ai/docs/guides/best-practices/prompt-caching) documents `session_id` for sticky provider routing and the same cached-token usage field. Its current guide has no Meta/Muse-specific configuration section. Direct Meta support for an optional key does not establish how OpenRouter forwards that key upstream.

## Prose Minion source trace

The following describes the source before the requested display change.

- `OpenRouterPromptCachePolicy.ts` selects the `native` policy for Muse. It preserves the normal messages and adds a stable SHA-256-derived `session_id` for retained conversations. It sends no cache-disable setting.
- The native policy returns no TTL and no activity confirmation for the expiry estimator. `OpenRouterClient.estimateCacheExpiry()` therefore omits an estimated expiry, and `WorkshopCacheIndicator` renders no clock. This suppresses the timer only; it does not turn off provider caching.
- Both streaming and non-streaming requests ask for usage. `OpenRouterClient.toTokenUsage()` reads the documented cached-token field and preserves a reported numeric zero.
- `WorkshopTurnBubble` displays a cached count whenever the normalized field is present, regardless of model family. Missing or invalid usage stays unreported. Across multi-call turns, `AgentRunEngine` omits partially reported cache aggregates; it does not invent a zero.
- Retained history is read from `ConversationManager`; new messages are appended to that history. The system message is established at conversation creation, rather than retimestamped for each ordinary continuation.

## Existing runtime evidence

The October 13 Extension Development Host output log (`window41`, `output_logging_20261013T133144/2-Prose Minion.log`) identifies version 2.10.0 and records six Muse Wonder turns in the same retained host conversation:

| Turn | Prompt tokens | Calls |
| --- | ---: | ---: |
| 1 | 96,164 | 1 |
| 2 | 97,459 | 1 |
| 3 | 98,749 | 1 |
| 4 | 99,906 | 1 |
| 5 | 100,948 | 1 |
| 6 | 101,994 | 1 |

The conversation ID is unchanged across these turns, and the log records ordinary continuations. This rules out a small total prompt and per-turn conversation recreation for this sequence. It does not prove token-by-token upstream prefix equality, cache residence, or backend affinity.

That log records processed/context totals, but no cache counters or generation IDs. The available on-disk sessions and persisted view records did not contain this live session's per-turn usage. Manuscript content was not printed or sent to any provider during this investigation.

### User-provided OpenRouter Activity evidence

Okey supplied the October 13 Activity screenshot for these same six requests. The prompt and completion totals match the local log exactly. All six used Meta and the Prose Minion app; only the 1:59 PM row has the cache indicator.

| Local time | Prompt tokens | Completion tokens | Displayed charge | Expected without caching |
| --- | ---: | ---: | ---: | ---: |
| 1:49 PM | 96,164 | 1,138 | $0.407 | $0.407416 |
| 1:56 PM | 97,459 | 1,014 | $0.410 | $0.410116 |
| 1:59 PM | 98,749 | 633 | $0.0376 | $0.407656 |
| 2:03 PM | 99,906 | 746 | $0.415 | $0.414544 |
| 2:05 PM | 100,948 | 714 | $0.418 | $0.418072 |
| 2:11 PM | 101,994 | 1,123 | $0.430 | $0.430436 |

Using Wonder's listed $4/M input, $20/M output, and $0.20/M cached input rates, the 1:59 PM charge is consistent with roughly 97,000 cached prompt tokens and a 90.8% reduction in total generation cost. This is an estimate from rounded charges, not an exact provider counter. The other five displayed charges match ordinary full-price processing within screenshot rounding.

This establishes that Wonder caching works on this account. It does not establish a five-minute TTL. A write-anchored five-minute expiry could explain the 1:56 → 1:59 hit → 2:03 miss, but the full-price requests at 2:03 and 2:05 are only about two minutes apart. A simple fixed five-minute window, assuming matching prefixes and cache admission on each miss, does not explain the whole sequence. Provider cache admission, eviction, backend routing, or upstream prefix changes still need request-level evidence. Meta documents server-managed in-memory retention, including eviction under pressure or inactivity.

## Verification

`npm test -- --runInBand --testPathPattern='(OpenRouterClient|OpenRouterPromptCachePolicy)'`: two suites / 127 tests passed. These are mocked contract checks, not a paid cache-hit witness.

## Remaining evidence

The Activity screenshot supplies the missing cost evidence and confirms a hit. Still unknown: how that hit appeared in the Workshop badge, the exact cached-token counter, the expiry policy, and why the subsequent requests missed. Generation details for the hit and a nearby miss would distinguish those further.

- The missing clock came from deliberately unestimated native retention. Okey subsequently chose an approximate five-minute display with an explicit Meta disclaimer, as recorded below.
- If repeated turns report zero cached tokens, investigate provider eviction/backend routing or upstream prompt transformation using existing generation metadata. Do not assume a missing cache enable flag.
- If the badge is absent, compare the upstream generation's `cache_discount` and cache metadata with the response usage before changing normalization or request options.

OpenRouter's [generation metadata endpoint](https://openrouter.ai/docs/api/api-reference/generations/get-request-%26-usage-metadata-for-a-generation) permits checking an existing generation. It does not require a new inference call. Publication remains pending while this issue is investigated.

## Requested display decision — 15:18 CDT

Okey requested five minutes for the Meta models with a footnote that Meta does not guarantee the cache window. The implementation covers the four curated Muse models (Spark 1.1, 1.2, 1.3, and Wonder), including aliases, with a shared model set used by the provider estimate policy and composer indicator.

Only reported positive cache reads start the estimate; misses and absent read counters do not prove cache admission. Dispatch remains the clock anchor, so generation time does not extend the estimate. The footnote appears directly below the countdown: **Meta does not guarantee the cache window.** The tooltip explains that the five-minute guideline is approximate and earlier eviction is possible. Request content and native caching parameters are unchanged.

Focused mocked verification passed: four suites / 167 tests. Scoped ESLint passed with no errors; warnings concern wire names, component names, and brace style. `npm run package` passed all three typechecks, 306 suites / 4,472 tests / two snapshots, production bundles, and VSIX packaging. The packaged webview contains the footnote. The new artifact is recorded in the manual-test checkpoint and supersedes the earlier hash. This display decision supplies no new proof of cache retention or the cause of misses.
