# Provider caching PR preparation

Okey authorized opening a PR for the completed work on
`fix/anthropic-prompt-caching` against `main`. No existing PR was found.
After fetching origin, the branch had no missing commits from `main`.

The PR includes the already-pushed caching activation commit `52f2e947` and
the duration setting, estimated cache-window telemetry/clock indicator,
Terra/GPT-5.6+ window support, seven message attachments, and 100,000-word
standing-context budget. Current design and acceptance tracking remain in
the [feature checklist](../.todo/features/feature-provider-conversation-prompt-cache/README.md)
and its linked ADRs.

Final combined verification: 232 Jest suites, 2,914 tests, and two snapshots
passed; monorepo typecheck, production build/bundle verification, changed-file
ESLint (zero errors), and diff checks passed. The full suite exposed an old
three-attachment assumption in the selector fixture; it now stages six and
verifies that selecting two more blocks confirmation until one is deselected.
Logs are `/private/tmp/prose-minion-pr-*`.

Live provider cold-write/follow-up-read acceptance remains tracked separately;
no billable requests were made by Ada. Existing toolchain/lint warnings remain.
Unrelated release memory files and `Prose Minion.zip` are excluded from staging.
