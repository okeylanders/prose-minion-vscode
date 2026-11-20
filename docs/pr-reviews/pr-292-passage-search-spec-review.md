# PR #292: Passage Search Slice 0 design review

Reviewer: Astra 6.2. Reviewed head `b35e5203d6cc3a8e69bb627f7fc4285971e21d11` against `1b3b923909a70cb7af1c2bbe4cc48ef42e4e0128` (`epic/passage-search`).

**Verdict: Request changes before building Slice 1 on this spec.** The split between a reusable engine and caller-owned consent is sound. These are places where following the written contract can produce the wrong result.

## Findings

References are to `docs/adr/2026-11-20-passage-search.md` at the reviewed head. Carry the fixes and acceptance cases into the corresponding epic slices.

1. **P1 | D2/D20, lines 138–144 and 467–470: Bind Run to the estimate shown.** The replan digest covers model and text, but the live price, its availability, or the planned chunk/call shape can change with the same key. Bind the approval to the displayed pricing basis (including unavailable pricing) and the computed call plan. A material mismatch should return the updated estimate without dispatching. Test unchanged files with changed prices and changed chunk limits.
2. **P1 | D3, lines 157–164: Make catalog coverage and file identity explicit.** The base `ContextResourceResolver.ts:95–112,275–294,325–349` reads by relative path, removes duplicates on relative path before group/file lookup, and can mask scan failures. Same-named paths in multiple roots or overlapping groups can yield missing results or lose a valid selector. Use root-aware identity and preserve group membership, or explicitly limit results to picker-visible entries and report incomplete discovery. Test duplicate paths across roots, overlapping groups and one failed scan.
3. **P1 | D5, lines 194–201: Fit the actual rendered request.** The shared paragraph chunker preserves over-budget paragraphs, and adding overlap can push an otherwise full chunk over budget. Enforce bounds on final rendered input plus output reserve after overlap. Specify a safe split or typed refusal for oversized paragraphs and test that case plus adjacent near-limit chunks.
4. **P1 | D7/D12/D21, lines 225–227, 297–303 and 480–484: Stop must not start new model work.** D12 allows an organizer call after Stop; automatic delivery can then start a persona call. Return verified partial results without starting either. Offer separate explicit actions to organize or send partial results if desired. Test Stop while reads are in flight and before either follow-on dispatch.
5. **P1 | D18/D19, lines 429–446: Mark delivered only after the persona reply is adopted.** The provisional writer request is recorded before dispatch. Ordinary completion can abandon the run without deleting that turn (`WorkshopRunCompletion.ts:200–225`, `WorkshopSessionService.ts:2160–2181`). Derive delivery from a committed receipt or adopted assistant reply instead. When the result remains held, let the writer retry delivery without paying for the search again. Test a resolved failed delivery and reopen; recheck the originating room and participant before sending.
6. **P2 | D12/D14, lines 294–303 and 339–343: Price the organizer as an allowance, not exact input.** The organizer depends on results not yet generated. Explain what is approximate, bound the whole rendered organizer request including labels against available model capacity, and distinguish the search estimate from the subsequent ordinary persona turn.
7. **P2 | D9/D11, lines 252–260 and 275–279: Display the actual frozen source quote.** The shared anchor accepts normalized forms and returns offsets. Once anchored, derive the quote and surrounding context from the frozen source slice, not the model spelling. Add a normalization case that asserts the exact displayed source.

## Verification

Static review of the ADR and epic README with targeted checks against the base catalog, anchoring/chunking helpers, and Workshop completion code. Docs-only PR. No tests or billable model calls run. No merge performed.
