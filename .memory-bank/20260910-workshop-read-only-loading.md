# Workshop read-only loading follow-up — 2026-09-10

Branch: `fix/workshop-startup-loading`. Initial changes were published in PR #115
as `5b158d50`; the status fix followed as `33e447f0`. Review remediation follows in PR #115. User approved the read-only-loading proposal after
inspection of the September 10 manuscript logs; manuscript/session files remain
untouched. Ephemeral local evidence (not a repository dependency): `/private/tmp/workshop-20260910-y0eoi2wn/investigation.md`.

The old recovery contained only prior committed content plus resume bookkeeping.
Discard affected tracked named files; ignored current.json stayed older. Both
resume autosave and session-open context refresh dirtied named on load.

Implemented:
- Rolling-only `rollingCleanHash` binds clean provenance to the full normalized
  checkpoint. Only accepted named mirrors receive it. Named writes strip it;
  local-only author writes omit it. Altered or legacy rolling payloads do not
  gain clean authority. Optimistic named-write equality remains separate.
- Startup/Open/reveal mirror named without dated turns, activity touch or named
  autosave. Provider setup is followed by the existing full-file recheck.
- Resume is pending in runtime, appended before the first message/tool/guest
  interaction. Rollback/reset retain appropriate pending state.
- Session-open context rereads mutate only the runtime working set and pending
  provider-delivery revision. No dated notice or autosave. Explicit Refresh accepts
  staged state even when the disk body is already equal; explicit author edits
  keep normal autosave.
- Author-work state is tracked separately from staged runtime changes and restored
  on rollback. A named-save completion cannot clear a later dirty revision.

Initial implementation validation: 210 suites / 2,379 tests / 2 snapshots; all three TypeScript projects;
lint 0 errors with 963 existing warnings; build and bundle sentinels pass with
existing webpack size warnings. Regression coverage includes discard/pull/restart,
clean marker tampering, failed-save restart recovery, automatic refresh without
writes/dated turns, next-interaction persistence, automatic reread failures, and
host-message/tool/guest resume ordering. Okey manually verified the status fix;
live logs confirmed a subsequent clean-cache restart without recovery. The first
review is in docs/pr-reviews/pr-115-workshop-read-only-loading-review.md. Broader
manual failure-path verification and remediation re-review remain outstanding. Older caches may cause one conservative recovery before
provenance is established; do not infer clean state from shorter transcripts.

Docs: ADR 2026-09-10 plus updated canonical persistence/authority ADRs and changelogs.
Manual acceptance tracked in `.todo/tech-debt/2026-09-10-workshop-loading-git-churn.md`.
Preserve unrelated `.todo/features/feature-workshop-anthropic-prompt-cache/`,
`Prose Minion.zip`, and `workshop-ai-service-conversation-ownership.md`.

Validation after remediation: 210 Jest suites / 2,397 tests / 2 snapshots passed;
all three TypeScript projects passed; lint reported 0 errors and 963 existing
warnings; build and bundle sentinels passed with existing webpack size warnings;
`git diff --check` passed. These remediation changes are included in PR #115; no manuscript files
were modified. Independent remediation review and manual failure-path checks are
still pending.
