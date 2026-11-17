# PR #273: earlier turns review

## Verdict

Technical review clear: no actionable correctness findings at code head `9348bbb3737fe3b7da80ab7701897612f44eb3be`, against epic base `137039f531814d27c6f13252a5361c33f9818ac0`. No merge or implementation changes performed. This is not a claim that untested native UI behavior is verified.

## Review scope

- Checked the shared snapshot/page projection, host sanitation, 100-turn/1 MiB turn-payload bound and oversized-single-turn progress exception against ADR D1–D7.
- Traced the read-only handler through queued room replacements and revision rejection. Read response correlation, room resets, restarted reread walks, carried sliding-window turns, range eviction and queued manual pagination.
- Checked older-turn Rewind/Branch mapping, reactions, bookmark state, memory/file-edit card plumbing, model-slice seed and DOM scroll-anchor calculation.
- Read the new regression tests and application wiring, including the merged app-router changes. No persistence added for loaded turns.

## Independent validation

- 10 focused suites / 129 tests passed: earlier-turn host/service/routes/bubble actions, pure run and hook state, real WorkshopApp integration, thread/control, scroll-hold math, app message router and architecture guards.
- All core, webview and extension typechecks passed.
- Repository ESLint completed with zero errors (warnings remain).
- `git diff --check` passed.
- Exact code-head CI passed: https://github.com/okeylanders/prose-minion-vscode/actions/runs/44118194789
- Latest remote code head was unchanged immediately before publication.

## Remaining verification limits

Full local suite was not rerun. No native Extension Development Host, Chromium layout/scroll anchoring, real screen reader, or streaming performance pass was performed. Keep the PR's live checklist: top-edge scroll hold, focus when the final-page control disappears, and reread cost with many loaded pages. An edit-offer chip on an out-of-window turn was inspected through existing plumbing but was not independently exercised end to end. These are explicit coverage limits, not additional reproduced blockers.

The report is a documentation-only follow-up commit; its own CI may run separately.
