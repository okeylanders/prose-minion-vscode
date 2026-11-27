# Astra 6.2 re-review: PR #318

- Code head: `803af8e3b838590d6e28655065768760e8dea038`
- Base: `epic/workshop-persona-highlights` at `49164024c506a4155b1a25c636362a2fa6b7fabb`
- Verdict: No blockers. The previous optional hardening is resolved.

A configured Craft Flags estimate now requires both the model and the reasoning-budget decision even if no dollar estimate is available. The ready plan, approval, port and VS Code command preserve that pair. The service preserves an approved false instead of resolving reasoning support again; the fallback is reserved for direct, unpriced service calls. See `packages/core/src/infrastructure/api/services/craftFlags/CraftFlagsService.ts:139–154,203–219`.

Reviewed the mocked-provider integration cases for catalog refresh, model changes, unknown metadata and separate Proofread behavior, plus the direct-service fallback tests. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/46025765772). No live provider calls or native UI smoke test.
