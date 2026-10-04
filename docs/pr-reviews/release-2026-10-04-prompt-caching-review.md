# Release preparation review — 2026-10-04

**Baseline:** `v2.7.0` (`364b76c4`)
**Reviewed source:** `9d77ad75` (merged PR #123)
**Scope:** Focused release review of correctness, security, architecture, performance, and error handling. Independent read-only reviewer plus release orchestrator verification; not a full Forge crew review.

## Disposition

**CRITICAL:** No new blocker found. PR #123's earlier High findings are addressed by the current follow-ups. This is a bounded review, not a guarantee against defects.

**WARNING:** Existing findings remain in the [PR #123 resolution ledger](pr-123-provider-prompt-caching-review.md). No release-time warning fixes were made:

- **F-05, remote clock skew:** `OpenRouterClient` computes an absolute cache expiry on the extension host; `WorkshopCacheIndicator` subtracts the webview clock. Remote hosts with different clocks can show inaccurate estimates. Request caching itself is unaffected.
- **F-17, workspace TTL override:** `proseMinion.claudeCacheTtl` lacks application scope. Workspace configuration can override the overlay's global preference and retain the more expensive one-hour write setting.
- **F-28, intake versus capacity:** The 100K-word standing-context ceiling does not promise that an excerpt, history, and reply fit the selected model. Conservative estimation may refuse otherwise usable capacity. The UI explains the distinction, but numerical remaining capacity and tokenizer calibration remain pending.
- **Live acceptance:** Automated wire/usage tests pass in the feature record, but Claude and supported Qwen cold-write/warm-read checks and live TTL behavior remain pending. No paid provider calls were made during release preparation.
- **Dependency audit:** No critical advisory. High/moderate findings affect development and packaging tools. See the [per-package dispositions](../../.todo/tech-debt/2026-10-02-release-dependency-audit-follow-up.md). The audit is not clean.

**INFO:** Preserve the verified seams: shared captured context delivery for host chat and tool synthesis; acknowledgement only after success; pending in-flight edits; structured window refusals and draft rollback; exact-first alias metadata lookup; validated baseline persistence and rewind invalidation. No production `vscode` imports were found in core.

## Compatibility and release notes

- Existing v2.7.0 sessions are readable; the host-private `hostContextDelivery` baseline is optional and absent baselines resynchronize once.
- Older exact-key session validators reject a newly written room containing that field. Git-synced machines should all upgrade before opening sessions saved by the new release. No new schema migration is introduced by release preparation.
- Standing context increases from 50K to 100K words; a message can hold seven attachments, each capped at 10K words.
- Known live model windows receive a pre-dispatch estimate check. Unknown/offline metadata remains provider-validated.
- Cache hints request reuse rather than guarantee it. Claude cold writes cost more than ordinary input; the one-hour preference affects future retained requests. The composer clock is an estimate, while the response badge reports provider usage.

## Evidence

Reviewed production changes in `v2.7.0..9d77ad75`, current PR resolution ledger, both fix reviews, provider cache policy, context delivery, persisted baseline validators, and rewind behavior. Whitespace and architectural import checks passed. Test/build/audit/package results belong to the release preparation checkpoint, including any dependency installation correction performed after this review.
