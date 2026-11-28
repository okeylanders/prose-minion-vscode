# PR #316: Bind and retain each persona's Workshop highlight set

- Reviewer: independent Astra 6.2
- Reviewed head: `11dfdc2bf1d054f41bf0fa638362c51850d2f2e7`
- Target: `epic/workshop-persona-highlights` at `0bb448907266dc7c09495cfc1995e7ba87345002`
- Merge base: `28162b11f3c90436023020bad22a1baeb7292898`
- Verdict: **Request changes before merging into the epic.**

## P2: A writer-composed message is not consent to place highlights

[H1](https://github.com/okeylanders/prose-minion-vscode/blob/be3f847a58add4c952595345cc3b2250e75b0d99/.todo/features/feature-workshop-persona-highlights/README.md#L91-L100) says the persona may offer, but never highlight unasked. The normal composer marks every nonempty send as writer-composed ([`WorkshopRoomHandler.ts:643–646`](../../packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L643-L646)). That provenance flag plus the model's trailer is all the highlight path needs ([lines 1457–1459](../../packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L1457-L1459)). The guest opening reply is also eligible for an ordinary opening question ([lines 847–855](../../packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts#L847-L855)). The host authorizes the captured excerpt file, but does not authorize the highlight action itself. An unsolicited valid set can therefore be saved on the adopted reply and drawn immediately in the open excerpt file. This is an opt-in failure, not arbitrary-file access or a text mutation.

Use one-shot, run-bound authorization from a writer action, or leave the result as an offer requiring an explicit writer confirmation before it can be saved as an active set or drawn. Do not use English keyword matching as the consent gate. Verify that plain critique and an ordinary guest-opening turn cannot auto-place a set, that one approval cannot carry to a later turn, and that an authorized current reply still draws or defers against its captured source.

## Verification

Astra independently passed 289 tests across eight offline suites and core typecheck. Coverage included the normal composer/handler entry point with a mock provider, mixed reaction and set trailers, stale room/excerpt, discarded completion, closed buffer, finalized turn/log redaction, older fixture round-trip, and architecture. The finalized webview turn carries title and count only; this does not claim the streaming transport contains no raw provider output. The shared room-service wiring in #314 was checked for compatibility. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45920233049) passed. No native VS Code or live inference was rerun.
