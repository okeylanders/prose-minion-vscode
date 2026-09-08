# PR #114 review remediation — 2026-09-08

## State and decisions

- Working branch: `writer-profile-20k`; starting head `abf9e515` includes the review report.
- Author authorized committing and pushing the remediation after the ledger update.
  No manuscript session files were modified.
- Named checkpoints remain authoritative. Current.json now provides independent
  durability when a named write fails; an inconclusive lookup never authorizes a
  named write but no longer prevents rolling recovery.
- Confirmed missing active named files detach after preserving the live snapshot.
  Unassociated rooms skip named lookup on reveal, so Delete is not immediately
  undone by a same-ID file returning from Git. Startup and explicit Open can
  establish an association again.
- Context scans run inside the serialized load operation. Load requests replay
  the current busy state, including idle after a missed scan-end message.
- F-03 approved and implemented: preserve meaningful differing same-session local
  work under a fresh named recovery ID before loading named, then notify. Resume
  dividers, derived bookkeeping and save/activity times do not warrant a copy.
  Reveal also compares against the accepted baseline to avoid copying unchanged
  local content simply because Git changed named. Preservation failure aborts
  replacement. Startup without a baseline conservatively preserves other divergence.

## Validation and remaining work

- Focused coordinator/store/handler/hook suites passed (105 tests at that point).
- Final full suite passed: 210 suites / 2,365 tests / 2 snapshots. Results are
  recorded in the review ledger.
- Typecheck across all projects, lint (0 errors, existing warnings), production
  development build and bundle sentinels passed. Manual VS Code proof remains
  outstanding.
- Real-store tests cover corrupt unrelated siblings, repeated named round trips,
  external deletion, continued rolling durability, detachment and no reattachment
  on reveal, promotion second-read rollback with retained baseline, duplicate
  first-load requests, combined write failures, and load/scan serialization.
- Changelogs, ADRs, profile description, model README footprint and the review
  ledger were updated locally. PR metadata should be published with the final
  remediation rather than advertising unpushed behavior.
- F-03 is implemented. Manual verification and re-review are still required. F-10/F-11 and byte-hash baselines remain deferred.
- Preserve unrelated `.todo/features/feature-workshop-anthropic-prompt-cache/`,
  `Prose Minion.zip`, and `workshop-ai-service-conversation-ownership.md`.

## References

- [Review and resolution ledger](../docs/pr-reviews/pr-114-workshop-named-checkpoint-authority-cdc56d8-review-v2.md)
- [Authority ADR](../docs/adr/2026-09-08-workshop-named-checkpoint-authority.md)
- [Incident and active completion criteria](../.todo/tech-debt/2026-09-08-workshop-named-session-sync-overwrite.md)
