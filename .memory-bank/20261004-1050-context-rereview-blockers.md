# PR #123 re-review: tool startup and context refusal paths

Okey authorized fixes for the re-review at `7a3b2f1` on
`fix/anthropic-prompt-caching` (review committed as `87593055`).
PR: https://github.com/okeylanders/prose-minion-vscode/pull/123.

F-26/F-27 are addressed. Host chat and tool synthesis share
`prepareHostUpdatesForDelivery`; both frame and acknowledgement use its
captured snapshot. Synthesis prepares after tool completion, before host
dispatch. Success acknowledges that generation; newer in-flight edits stay
pending. A 5,000-word attachment is not re-sent with a later four-word note.

Engine context-window refusals now expose `AgentRunUnavailableError` reason
`context-window-exceeded`, with numeric estimates in details. Host refusal
rolls back/restores its draft. Unavailable tool requests roll back provisional
request bubbles; completed reports survive synthesis refusal. Real engine,
AssistantToolService, and sidebar routes prove the refusal cannot become an
analysis result. No paid provider calls were made.

F-29 lookup prefers raw alias/base entries before normalized ids. F-30 clears
pending revisions covered by a successful snapshot; newer edits remain queued.
F-31 logs unknown-window metadata once per continuous missing period for the
current model, re-arming on recovery or model change.

F-28 is partially addressed: context UI describes the intake cap separately
from request capacity; refusal copy names standing context/the excerpt and a
fresh room with fewer inputs. The conservative estimator is unchanged pending
provider calibration. Numerical model-adjusted capacity remains tracked in
the feature checklist and review ledger. Original deferred/open findings remain.

Verification: 236 Jest suites / 2,943 tests / 2 snapshots passed; monorepo
typecheck, production build/bundle verification, changed-file ESLint (zero
errors), and diff checks passed. Existing warning-level toolchain output remains.

Records:
- `docs/pr-reviews/pr-123-provider-prompt-caching-review.md`
- `docs/adr/2026-10-03-workshop-context-delta-delivery.md`
- `.todo/features/feature-provider-conversation-prompt-cache/README.md`

Unrelated release memory entries and `Prose Minion.zip` remain untouched.
