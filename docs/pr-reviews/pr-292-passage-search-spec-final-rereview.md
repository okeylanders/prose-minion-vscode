# PR #292: Passage Search spec final re-review

Astra 6.2 reviewed `804a560fd4908385b27dfa403e6262a480414e19` against previous report head `b3aa59fb`.

**Verdict: Approved for merge into `epic/passage-search`.** The final P1 is addressed. No remaining blockers.

- D19a, lines 585–609: A directed results delivery selects rollback instead of abandonment on resolved non-adoption, while the run handle still exists. Thrown failures use the existing directed-run catch (`WorkshopRoomHandler.ts:1507–1523`). Both paths preserve the paid result for a delivery retry without a new search. Ordinary callers still default to abandonment; edit-offer completion is unchanged.
- D19a, lines 617–622: Required implementation tests cover each failure branch and retry without another search.
- The two editorial follow-ups are resolved: D14/D23 distinguish priced read inputs from the organizer allowance, and D17 uses D3a's authoritative catalog.

Static review of the ADR amendment and relevant base code. No local tests or model calls run by the reviewer. [CI passed on the reviewed head](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44792984300). No merge performed.
