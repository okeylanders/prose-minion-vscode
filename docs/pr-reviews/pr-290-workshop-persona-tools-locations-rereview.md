# PR #290: Workshop Persona Tools, Slice C2 re-review

**Astra 6.2 · Approved for merge into `epic/workshop-persona-tools`.**

Reviewed `0228dd995820ac505d7b035b669ce8db84b21583`. All three prior findings are closed, and no new blocker surfaced in the fix commit:

- **P1, displayed/written proposal:** `WorkshopLocationsProposalRecords.ts:193–235` validates that ordered groups, the baseline-derived current patterns, kept write patterns and answers agree. The Apply handler reuses the consistency check before any write.
- **P1, room switching during Apply:** `WorkshopLocationsProposalHandler.ts:99–105,126–143` runs revalidation, global writes and the originating card's receipt inside the production coordinator's room-operation queue. `WorkshopSliceComposition.ts:281–284,555–570` wires that coordinator and gates competing mutations. New, Open, Rewind and Branch use the same queue.
- **P2, restore bounds:** `WorkshopReplyLocations.ts:129–132,151–160` omits only an unrepresentable card for an oversized baseline, preserving the reply and room. It clips display-only example paths without changing writable patterns.

[Exact-head CI passed](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44555891404). This was a static re-review, including inspection of the added round-trip and interleaving tests; no independent native VS Code or live-model smoke test. No merge performed.
