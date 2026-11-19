# PR #276 review: trailer outcomes

**Verdict: changes requested.** Reviewed code head `5e099e478950c6199e648d96617f05eda5c8e049` against epic base `9e10c53cee371e6beded20a8cd2a69f415418452`. Documentation only; no merge.

### F-01 (P2): losing a retained conversation silently loses the last reply's outcome

`packages/core/src/application/handlers/domain/workshop/WorkshopRoomHandler.ts:1240` requires a provider conversation ID before it consults the ledger. When the host conversation disappears, the persona's last reply and outcomes still exist in the room. The next successful writer send starts a fresh provider conversation without the frame; its reply then replaces the one whose counts were owed. The passing route test at `WorkshopRoutes.trailerOutcomes.test.ts:188–200` exercises exactly this recovery path and asserts the omission. D15 keys delivery to the participant's latest ledger reply, not the provider conversation's lifetime.

Consult the ledger for an eligible writer send even if there is no conversation ID. Keep the press/tool exclusions. A first-ever participant has no matching ledger reply and naturally receives nothing; a resumed host should receive its own frame in the new envelope. Update the recovery test and verify the frame occurs only once on successive successful sends.

### F-02 (P3): clipping counts breaks D13's conservation rule

`packages/core/src/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesRecord.ts:73–80` clips each count at 10,000. An independent witness passed 10,001 empty, closed memory-proposal tags with memory disabled through the production extractor and builder. The extractor returned exactly 10,001 rejections; the record contained only `{reason: 'off', count: 10000}`. That number is subsequently rendered as exact. This is a large-reply edge case, not an ordinary card-cap problem: rejected frames continue to accumulate after card limits are reached.

Use a codec bound that can represent every possible extractor count (e.g. the maximum array length), preserve the actual count, and regression-test this transition. The shape stays bounded without silently undercounting.

### Validation

- All six changed Jest suites passed: 145 tests. Coverage reviewed includes typed settlement, both commit paths, session persistence, projection/redaction, participant isolation and rewind.
- Separate local extractor-to-builder witness passed (confirmed the undercount, not the desired behavior).
- `npm run typecheck` passed for core, webview and extension; `git diff --check` passed.
- Not run independently: full Jest suite, lint, live model or native extension UI.
