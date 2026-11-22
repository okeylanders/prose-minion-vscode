# PR #295: Passage Search organizer re-review

- Reviewer: Astra 6.2
- Product head: `ceb26a9ab05af274b0eda23b239c06c01d448298`
- Base: `epic/passage-search` at `8b441e55e10c5422ee87d9166f8b0763513d1515`
- Verdict: **Hold for one P2.** Both previously reported inputs are fixed; a different quote-grounding case still lets the organizer attribute invented words to a source.

## Findings

### P2: Ambiguous nested straight quotes can leave the dialogue unverified

`packages/core/src/infrastructure/api/services/search/passage/PassageSearchOrganizeChecks.ts:116–135,211–229` pairs successive straight double marks. In a model result shaped like `It reads "She said "meet me at midnight" before leaving".`, it verifies only the two outer fragments. With the sole cited source `She said goodbye before leaving.`, the unchanged claim, section title and headline all survive, even though the source contains none of the dialogue. The prompt recommends straight double marks, so nested dialogue is not limited to unusual Unicode punctuation. Require grounding for the entire candidate quotation or reject ambiguous quote structure. Keep the positive case of genuinely separate quotations. The existing generated test treats double quotes as preassembled spans and misses this structure. Related coverage note: corner quotes such as `「…」` and `『…』` are not in the current unsupported-mark check; treat that as secondary coverage, not a separate merge blocker.

### P3: An all-unmetered organize attempt can disappear from retry counts

`packages/core/src/infrastructure/api/services/search/passage/PassageSearchPassUsage.ts:36–40,63–68` can fall back to the read-only `calls.dispatched` count when previous attempts produced no usage total. `packages/core/src/application/handlers/domain/PassageSearchRoute.ts:364–365,411–414,432–433` allows another try. In the offline fixture, one unmetered hit plus five unmetered read failures, one unmetered failed explicit organize, and then one metered organize success give eight dispatches but seven reported requests. Cost and cache totals remain withheld. Retain the cumulative attempt count separately from whether usage was metered.

## Fixed and independently checked

- A read refused locally for context size never reaches the transport. Inline and explicit organize both preserve two billed read calls, 24 total tokens, $0.02, 10 cached tokens and six cache-write tokens in the original fixture. Genuine unmetered dispatches still withhold cost/cache totals. Seven local refusals dispatched nothing, and a local refusal did not reset the five-provider-failure streak.
- The earlier whitespace and elision single-quote cases now fail closed in claims, titles and headlines. The branch's grounding cases, including its generated inputs, and independent positive and negative probes were exercised offline.
- [Exact-head GitHub CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45070630163) passed. Local review used synthetic input and mocked transport, not a live provider or VS Code host.

## Sibling integration

This is a standalone verdict. #296 will need to carry over the new `calls.tooLarge` and `calls.dispatched` fields, count locally refused reads in its partial coverage, and update typed fixtures. Whichever branch lands second needs combined integration checks. No merge performed.
