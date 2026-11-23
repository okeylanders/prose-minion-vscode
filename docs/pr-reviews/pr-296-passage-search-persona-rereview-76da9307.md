# PR #296: Workshop Passage Search persona re-review

Astra 6.2 reviewed `76da9307d51fbc03d4843981724a65ca3d3888fe` against `epic/passage-search` at `8b441e55e10c5422ee87d9166f8b0763513d1515`. **Both prior P2s are resolved. No standalone merge blocker found; one non-blocking P3 remains.**

- **Search slot across room replacement:** the handler detaches the old search on room replacement and checks ownership across asynchronous work. A pending old price plan does not block a restored card in the new room, and late old continuations do not clear newer work.
- **Disposal during search:** closing the panel invalidates search ownership, suppressing late publication or delivery. Ordinary Stop in a live panel still retains the partial result. Rollback of an already-started provisional delivery was traced in source and its checked-in test, not rerun in a full host.
- **Manual delivery of partial results:** a complete-ending search with a cut reply no longer auto-sends. The writer can still send it explicitly.

## P3: Preserve incomplete coverage in the compact persona frame

`WorkshopPassageSearchDirective.ts:141–153`. In the tight-window summary-only path, a manually sent result with one cut reply produced the same frame as the uncut control. It reported “Read 1 file in 4 calls” plus a generic note pointing to the report. The persona cannot tell that coverage was incomplete. The normal frame already carries that distinction (lines 95–99). Keep one measured coverage qualifier in the compact summary and preserve the existing refusal when the summary cannot fit.

## Verification and integration

35 focused offline checks: 20 pinned repository tests and 15 independent probes, including a characterization of the P3. [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45074414576). No live provider or native VS Code test; no combined-runtime verdict.

After bringing in #295, reconcile `calls.tooLarge`, `calls.dispatched` and result-level `requests`. Test two files with one successful read/one hit and one local context refusal. Assert exactly one dispatched read, no provider charge for the refusal, visible incomplete coverage in the card, report and saved/reopened receipt, and no automatic Send. Check the subsequent manual delivery carries the same coverage caveat, including under the compact-frame budget. Rerun combined CI. No merge performed.
