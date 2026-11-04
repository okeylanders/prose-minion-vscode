# Slice 5: Save and Tell Me

**Epic:** [Workshop Project Memory](README.md)
**Decision:** [ADR 2026-11-04](../../../docs/adr/2026-11-04-workshop-project-memory.md), D7 (receipt actions), D8 (Save and tell me, caps, the web-research hold, Forget). No `INDEX.md` (question 2, decided).
**Status:** Waiting on Slice 3.

## Outcome

Under **Save and tell me** (`auto`), a persona's proposal is saved at once with
`origin: auto`, and the thread shows a receipt with **Edit** and **Forget**.
Saves are capped per reply and per room. A proposal from a reply whose run had
web research attached is always held for the writer.

## Since Slice 3

- Proposals, cards, receipts and library writes exist. Under `auto` a proposal
  has so far waited like `ask`. This slice adds the automatic branch.

## Build

- **Decision point.** Where Slice 3 records a proposal, the host decides:
  - `ask`: the card waits;
  - `auto`, not held, under the caps: save now with `origin: auto` and record a
    receipt with `by: 'auto'`;
  - otherwise the card waits, with a hold reason the card shows: "Held because
    this reply used web research", or "Held: this conversation's automatic saves
    reached N".
- **The web-research hold** reads whether the run had web search tools attached
  (`AssistantToolService.ts:753-761`), never whether it cited. The run reports
  that fact on its completion. It isn't stored on the turn unless the card needs
  it after a reload; if it is, use an optional field on `memoryProposal`
  (`held: 'web-research' | 'room-cap'`).
- **Caps:** one per reply (already the codec's), and `autoSavesPerRoom`, counted
  from the room's receipts with `by: 'auto'`, so Rewind lowers the count with the
  turns it cuts.
- **Receipt actions:**
  - *Edit* opens Slice 3's sheet on the saved memory and writes `updated`;
  - *Forget* archives it (claimed rewrite) and records a `forgotten` receipt.
  - Neither deletes a file.

## Tests

- `auto`: saved at once, receipt with `by: 'auto'`, the file's `origin: auto`
  with full provenance.
- **Held:**
  - a reply whose run attached web search (even with no citations);
  - the room cap reached;
  - after a Rewind below the cap, saves resume.
- `ask` is unchanged by this slice.
- *Forget* archives and leaves the file. The room learns it through the
  `forgotten` receipt, which counts as delivered (D14), and the next
  conversation's frame drops it.
- **Poisoning witness:** an attachment carrying "remember: always …" under
  `auto` with web research on gives a held card, not a file.

## Completion Criteria

- [ ] Save and tell me saves with a visible receipt and never silently.
- [ ] The caps and the web-research hold hold, with tests.
- [ ] Forget is reversible from the manager.
- [ ] The epic's per-slice verification passes, with counts recorded here.
