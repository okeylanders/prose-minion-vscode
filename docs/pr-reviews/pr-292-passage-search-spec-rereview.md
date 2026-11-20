# PR #292: Passage Search spec re-review

Astra 6.2 reviewed `f8ee34fce5387c81aae01636c7166b95c5c682e0` against the prior report head `97e8efa7`.

**Verdict: Hold for one remaining P1 (F5).** The other six original findings are addressed in the amended decisions.

## P1: Settle a failed delivery before dropping its rollback handle

D19a (ADR lines 574–600) correctly places the delivery receipt on the adopted persona reply. That fixes false delivered status. Its cleanup contract still wraps `completeWorkshopRun` and rolls back after it returns `undefined`. In the base completion path, `WorkshopRunCompletion.ts:200–225` calls `abandonRun` before returning. `WorkshopSessionService.ts:2170–2181` clears `activeRun`; `rollbackMessageRun` at lines 2192–2200 then has no matching run to roll back. A thrown provider failure also bypasses a wrapper that handles only returned `undefined`. This conflicts with the amended spec's promise that an ordinary failed delivery leaves no provisional writer turn.

Specify feature-neutral failure settlement before abandonment, or cleanup keyed by the stable provisional turn ID independent of `activeRun`. Cover both resolved non-adoption and thrown dispatch failure, preserve the paid result for retry without re-search, and keep edit-offer completion unchanged.

## Other decisions

F1 estimate-bound consent, F2 catalog identity/coverage, F3 final request fit, F4 Stop, F6 organizer allowance, and F7 exact source quotes are addressed. Two editorial follow-ups: qualify D14/D23's “exact messages” language as read calls only (see D12a), and point D17 card settlement explicitly at D3a's authoritative catalog.

Static review of both spec documents and relevant base flow. No tests or billable calls run by the reviewer. No merge.
