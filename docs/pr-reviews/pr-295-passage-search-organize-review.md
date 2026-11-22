# PR #295 review: Passage Search organizing pass

**Astra 6.2 · November 21, 2026 · Reviewed `22056f56f362a0ace2d9182bcf3e44ca86da8a05`** against `773543f0ff77c7279209497ae760ea107f6f4880` on `epic/passage-search`.

**Verdict: changes before merge. One P1 and three P2s.** [Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44952322404).

## P1 · A running query can cross provider credentials at the organizer handoff

[PassageSearchService.ts:268–288](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchService.ts#L268-L288) checks whether the reads' engine is retired before invoking the organizer, but [PassageSearchModelOrganizer.ts:138–156](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchModelOrganizer.ts#L138-L156) awaits request preparation and initialization, then fetches whichever engine is current. If credentials change during the await, it can send the manuscript quotes to the replacement engine in the same run, contrary to D12a. If the already-admitted organizer completes after retirement, the outer run can also keep its analysis and report `complete`.

Bind the automatic organizer to the same held engine or a stable provider-generation guard; recheck immediately before sending, and check again when the pass resolves. Return the original checked reads as `key-changed` with no analysis. Preserve any usage from an already-admitted pass. An explicitly re-priced later organize action is separate. A deferred fake prompt load verified one dispatch on the replacement engine; a late-success control verified the result keeps analysis after retirement.

## P2 · Organizer usage can recreate the incomplete totals fixed in Slice 1

[PassageSearchService.ts:292–309](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchService.ts#L292-L309) filters unknown usage out before merging; [PassageSearchModelOrganizer.ts:169–194,217–220](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchModelOrganizer.ts#L169-L220) conflates a dispatched call with no usage and a pass that never sent. Two metered reads plus an unmetered or cancelled in-flight pass still report 2 requests and the reads' USD/cache subtotal as complete. Two dispatched unmetered reads plus a metered pass instead report just the organizer (1 of 3). A no-engine control sent nothing and correctly retained the two reads.

Carry dispatched counts alongside usage across the two stages, distinguish a skipped pass from an unmetered dispatched one, and preserve the known token subtotal while withholding incomplete cost/cache. Removing the filter by itself would count some skipped passes and cannot recover the counts when all reads were unmetered.

## P2 · One long middle row can suppress an organizing pass that fits

[PassageSearchOrganizeRequest.ts:110–145](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchOrganizeRequest.ts#L110-L145) treats the center sample as the only possible one-row fit and uses binary search over nonnested samples, whose measured size need not increase with count. A synthetic 60-row, 60-label result with a 30,000-token model has an organizer limit of 11,000. The center-only request costs 11,252 and yields no pass, but two evenly spaced rows fit at 9,602. Another fixture selected 127 rows despite a 224-row evenly spaced sample fitting. The request it does return is bounded; the defect is refusing valid work or discarding evidence unnecessarily.

Use a sampling strategy whose candidates are nested or otherwise account for nonmonotone candidate sizes. Do not let one oversized row prove no room. Recheck the whole rendered request and report the actual sample size.

## P2 · Curly single-quoted claims bypass source checking

[PassageSearchOrganizeChecks.ts:53–79](https://github.com/okeylanders/prose-minion-vscode/blob/22056f56f362a0ace2d9182bcf3e44ca86da8a05/packages/core/src/infrastructure/api/services/search/passage/PassageSearchOrganizeChecks.ts#L53-L79) detects straight and curly double delimiters only. A reply using paired curly single quotation marks can keep an unsourced attributed quotation in a headline, section title, or cited claim. D13 says quotations must be grounded; prompting for double marks is not a host check. Recognize unambiguous paired single quotes or reject unsupported quotation forms while preserving normal contractions and possessives. Add coverage for all three placements.

## Verification and scope

The independent review used a head-pinned offline harness with real organizer, service and usage arithmetic, stubbed provider/catalog/prompts as appropriate, and the shipped estimator and prompt text for sampling. Verified the separate explicit plan uses its frozen messages and output ceiling and the #294 route correlates plan/result IDs; the automatic pass should reserve its frozen cap when fitting too, but current same-build caps are equal. No live provider, Extension Development Host, or independent full suite. Recheck integration and CI after the sibling sidebar slice lands.
