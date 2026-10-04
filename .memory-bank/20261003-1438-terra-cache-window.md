# Terra 5.6 cache window

Okey reported no composer cache timer while using Terra 5.6 despite a large
cached-token badge. Model id is `openai/gpt-5.6-terra`. The earlier duration
implementation only supplied known-window telemetry for Claude and Alibaba;
native OpenAI fell through to an unknown-lifetime policy.

## Fix on `fix/anthropic-prompt-caching`

- Added `openaiAutomatic` to the prompt-cache registry. Versioned GPT-5.6+
  families have a documented default minimum 30-minute cache window, refreshed
  after writes/reuse. Automatic request messages remain unchanged, with no
  Claude fields or explicit caching opt-in. Claude's duration selection does
  not affect OpenAI.
- Positive provider reads or writes start the conservative dispatch-time
  estimate through the existing observation/context-budget/composer path.
  Numeric version detection excludes older GPTs, GPT-OSS, unknown router ids,
  malformed versions and unrelated providers. Existing leading aliases and
  routing variants use the same normalization as other policies.
- At zero, the indicator now says `window elapsed`: OpenAI may retain cache
  entries longer than the documented minimum. It does not promise eviction.
- Tests cover Terra's reported cache read through streaming and non-streaming
  responses, alias/variant request identity, default TTL despite Claude's
  one-hour preference, cold writes, cache misses and discarded runs.
- Updated the existing cache-window ADR before implementation.

## Verification and use

Five focused suites / 204 tests and monorepo typecheck passed. Production build
and bundle verification are recorded in `/private/tmp/prose-minion-terra-cache-build.log`.
Changed-source ESLint: zero errors. No live billable provider calls.

Reload the development extension, then send a follow-up with positive cache
usage. Old bubbles have no request-time estimate and intentionally do not
backfill a timer. These changes and the preceding duration/indicator changes
remain local/uncommitted; the earlier provider activation commit `52f2e947`
is already pushed. Unrelated existing files remain untouched.

Source: https://developers.openai.com/api/docs/guides/prompt-caching
