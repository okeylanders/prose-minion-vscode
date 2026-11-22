# PR #295: Passage Search organizer re-review

Astra 6.2 reviewed `877ce2f670ef266528f5407c40e37e2b76215a7b` against `epic/passage-search` at `8b441e55e10c5422ee87d9166f8b0763513d1515`. **No remaining blocker in this scoped standalone re-review.**

- **Quote grounding (previous P2): resolved.** The old nested straight-double example is refused for claims, titles and headlines when the cited source lacks its inner dialogue. The complete nested quote passes if present in the source; separately grounded quotes still survive. The 15 exact-head quotation cases, including the 8,000-text seeded check, ran in an offline TypeScript harness. See `PassageSearchOrganizeChecks.ts:120–123,148–179,254–274`.
- **Request count after an unmetered retry (previous P3): resolved.** An independent mock driven through the service and organizer tracked request counts 6 → 7 → 8, matching eight dispatches. The final metered response retained reported token totals and did not invent cost or cache figures for unknown usage. See `PassageSearchService.ts:248–263,283–289,348–370` and `PassageSearchPassUsage.ts:39–44,64–74`.
- **Local context refusal remains separate from provider dispatch.** Four mock scenarios covered inline and explicit organize with known and unknown usage, plus refusal-only and mixed five-provider-failure streaks. A locally refused read was not admitted or dispatched. A successful read plus organize counted as two provider requests, not three.

[Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45074894246). No full-suite local rerun, native VS Code host, or live provider call.

This review does not clear the separate #296 integration. On the combined head, verify that one successful file read and one locally refused file read produce one dispatched read, no charge for the refusal, visible incomplete coverage across the card/report/reopened receipt, and wait for manual Send under the author’s selected behavior. Carry over `calls.tooLarge`, `calls.dispatched`, and result-level `requests`; rerun combined CI. No merge performed.
