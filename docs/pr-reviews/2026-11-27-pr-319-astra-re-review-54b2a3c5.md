# Astra 6.2 re-review: PR #319

- Code head: `54b2a3c5bfa1b133e402cf7d76f57f597e2c5332`
- Base: `epic/workshop-persona-highlights` at `49164024c506a4155b1a25c636362a2fa6b7fabb`
- Verdict: Request changes. The three original findings are fixed; one new P2 remains.

## P2: A refused send can lose the writer's draft when the room changes

`packages/core/src/presentation/webview/hooks/domain/workshop/useWorkshopRoom.ts:729–733,579–587`: the incoming room snapshot drops the pending submission, including the only saved copy of its draft. If the old room's refusal arrives next, it no longer matches a pending submission and the text is not restored. `WorkshopRoomHandler.ts:647–649` disables the old restoration path. The intended draft-preservation behavior is documented in `docs/adr/2026-11-14-everyday-conveniences.md:465–467,487–492`.

Keep draft recovery correlated by submission and originating room independently of the active-room send lock, or retain the draft until acceptance. A late receipt must not unlock or overwrite a newer submission. Extend `apps/vscode-extension/src/__tests__/application/providers/WorkshopSelectedTextDelivery.integration.test.tsx:468–484` to deliver the replacement snapshot and refusal to the webview and then assert the draft is still recoverable.

## Verification

The duplicate-submit guard, pasted-text cut counts and live Selected Text-only send all passed re-review. All 184 tests across 12 focused suites passed. An extended regression assertion through the real Workshop webview and local provider plumbing confirmed that the draft is empty after the room-change refusal. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/46027869884). No live provider calls.
