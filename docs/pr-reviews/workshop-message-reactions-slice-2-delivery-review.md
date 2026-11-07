# PR #246 Review: Message Reactions Slice 2 (delivery)

**PR:** #246, `epic/workshop-message-reactions-slice-2-delivery` → `epic/workshop-message-reactions`
**Reviewed head:** `94d52ace` (base `2004c752`)
**Spec:** [ADR 2026-11-07](../adr/2026-11-07-workshop-message-reactions.md) D4, D6; R2, R3
**Reviewers:** the epic's coordinator, plus an independent review pass

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| M1 | Medium | A host conversation started by tool synthesis writes no `start`, so the next message folds over a discarded conversation | Fix | |
| L1 | Low | The frame can name reactions on turns catch-up deferred, and record them delivered | Fix | |
| L2 | Low | `workshopReactionOpening` can split a surrogate pair | Fix | |
| L3 | Low | `reactionDelivery` ships to the webview on every turn | Fix (reactions); tech debt (memory) | |
| L4 | Low | The codec's bound is a tunable prompt budget | Fix | |
| L5 | Low | Test gaps: cancel, unavailable, overtaken run, capability sub-turns | Fix | |
| N1 | Nit | A `"` inside the quoted opening reads ambiguously | Fix | |
| N2 | Nit | ADR D4's example says "your message" where the code says "the writer's message" | Fix (ADR) | |
| N3 | Nit | "since your last reply" is untrue for reactions held back and delivered later | Fix | |
| N4 | Nit | `prose-minion-reaction` is not yet a reserved tag for the neutralizer | Slice 3 | |

## Verification at `94d52ace` (coordinator's own run)

- `npm run typecheck`: clean. `npm run lint`: exit 0.
- `npx jest`: 807 suites, 11,334 tests, all passing.

## Findings

### M1. A host conversation started by tool synthesis writes no `start`

`WorkshopRoomHandler.ts` (around line 1118) picks `start` or `update` from the handler's `conversationId`. When the host has no conversation, `RunWorkshopToolSidePass.ts` (lines 245–252) starts one through `startWorkshopPersonaConversation` and stages nothing for reactions. The fold is keyed by participant only, so a conversation started this way inherits the discarded conversation's records.

1. The host's earlier conversation records `update`s for R1–R5.
2. A settings change throws `ConversationNotFoundError`, and `clearAllConversations()` drops the host conversation. The records stay in the ledger.
3. A tool run's synthesis starts a fresh host conversation, with no record.
4. The writer messages the host. That send plans an `update` against the old fold, so R1–R5 never reach the live conversation. This breaks D6/R3.

Project Memory is safe here because its engine decides frame vs. note on every conversation start, synthesis included.

**Fix.** On the synthesis path, when there is no host conversation and the host's view has recorded anything, stage an empty `start` on the synthesis reply. The synthesis still carries no frame (D4's delivery points stand). The next host message then folds from empty and delivers again.

Add a test: a ConversationNotFound clear, then a tool synthesis, then a host message re-delivers the earlier reactions.

### L1. The frame can name reactions on turns catch-up deferred

`WorkshopReactionDelivery.ts` filters by visibility alone, but room catch-up is bounded (`roomDelivery.deferredTurns`). A reaction on a deferred guest reply is listed and recorded before the persona has seen that reply, and it is never repeated once the reply arrives.

**Fix.** Owe a reaction only on turns this message leaves the reader holding: its own turns, turns at or before its offset, and this message's `deliveredTurnIds`. Leave the rest owed. Add a test with a deferred turn.

### L2. `workshopReactionOpening` can split a surrogate pair

`WorkshopReactionFrameRenderer.ts`. When the first 80 code units hold no space (emoji, CJK, a long URL), the fallback `slice(0, 80)` can end on a lone high surrogate.

**Fix.** Never cut inside a pair, by backing off one unit or by cutting over code points. Add an emoji test with no spaces.

### L3. `reactionDelivery` ships to the webview on every turn

`workshopTurnForWebview` passes `reactionDelivery` through, which is up to 1,000 triples per reply in every turn post and snapshot. This is host bookkeeping the webview never reads.

**Fix.** Strip `reactionDelivery` in the webview projection, with a test. `projectMemoryDelivery` has the same leak and predates this epic, so file it under `.todo/tech-debt/` rather than widen this PR.

### L4. The codec's bound is a tunable prompt budget

`WorkshopReactionDeliveryRecords.ts` bounds a record by `PROMPT_BUDGETS.workshopReactions.deliveredPerReply`. Lowering that budget later would refuse saved sessions that were valid when written (ADR 2026-07-30).

**Fix.** Give the codec its own pinned constant, as `WORKSHOP_PROJECT_MEMORY_DELIVERY_LIMITS` does, with a test that it is at least the delivery budget.

### L5. Test gaps

Through the real handler path, add tests that each of these records nothing and that the next message carries the reaction:

- an `AbortError` cancel mid-stream;
- an `AgentRunUnavailableError` rollback;
- an overtaken run (`preemptActiveRun`).

Also add a test that capability sub-turns inside a host run carry no record and that the final reply does.

### N1. A `"` inside the quoted opening reads ambiguously

`began "He said "stop…"` reads ambiguously. Escape inner double quotes or use other delimiters, and test it.

### N2. ADR D4's example wording is out of date

The code's "the writer's message" reads better than the ADR's "your message". Update D4's text to match.

### N3. "since your last reply" is not always true

Reactions held back by the 1,000 bound, or by L1's fix, arrive later than that wording claims. Use a neutral lead such as "Reactions you haven't been told of yet."

### N4. `prose-minion-reaction` is not yet a reserved tag

Once Slice 3 reads the reaction trailer, writer text quoted in an opening could carry a forged one. Slice 3 adds the tag to `RESERVED_PERSONA_FRAME`, with a test that quoted text is neutralized. It is recorded in the epic README's Slice 3 row.
