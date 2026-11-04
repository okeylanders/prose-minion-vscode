# PR #191 review: Workshop Wayfinding live-pass checklist

**Disposition: three nonblocking checklist corrections recommended before the human pass.** This is a documentation review, not live acceptance, a formal GitHub approval or authorization to merge.

**Reviewed head:** `94a93e95bf1b85d15a2add898a0358c845b5ccf8`  
**Base:** `6c12df5bece661912504ae5125928cf9afc904d0`  
**PR:** [#191](https://github.com/okeylanders/prose-minion-vscode/pull/191) · **Reviewed:** 2026-11-04

## N-01: Use an achievable to-do badge recipe

[The checklist](https://github.com/okeylanders/prose-minion-vscode/blob/94a93e95bf1b85d15a2add898a0358c845b5ccf8/.todo/epics/epic-workshop-wayfinding-2026-11-03/slice-8-live-pass.md#L32-L34) asks for a to-do the host adds while Notes is hidden. The amended D1 decision explicitly records that the current producer is the writer adding a finding; the earlier host-only rule badged nothing. Ask the writer to add a finding as a to-do while Notes is hidden, then check the badge and clearing. This makes the live step achievable and exercises the actual producer.

## N-02: Separate JSON stamps from visual slices

[The checklist](https://github.com/okeylanders/prose-minion-vscode/blob/94a93e95bf1b85d15a2add898a0358c845b5ccf8/.todo/epics/epic-workshop-wayfinding-2026-11-03/slice-8-live-pass.md#L83-L86) says Markdown, HTML and JSON show the same slices. Slice 7 deliberately emits visual slice entries only in Markdown/HTML; JSON carries the per-turn `model` fields and no synthetic slice entries. Ask for Markdown/HTML placement parity and separately verify the JSON model stamps. Otherwise a correct JSON export would appear to fail.

## N-03: Carry forward the specific native reader acceptance cases

The earlier [Slice 2 re-review](https://github.com/okeylanders/prose-minion-vscode/blob/6c12df5bece661912504ae5125928cf9afc904d0/docs/pr-reviews/pr-186-workshop-wayfinding-read-in-review.md) explicitly left native `details/summary`, disabled-fieldset traversal and screen-reader acceptance unverified after replacing manual Tab enumeration with inert background. The checklist has a generic forward-Tab step and a screen-reader check for the model divider, but not those reader cases. Include a rich-Markdown resource and test Tab/Shift+Tab reaches its summary, skips inherited-disabled controls, and keeps the Workshop background inert; include reader/rail screen-reader navigation.

Also exercise **Show where it was read** when the card is outside the loaded window: the reader should hand off to the out-of-window preview without focus returning behind the active sheet. The current checklist covers the in-window card jump and a separate direct out-of-window preview, but not that sheet-to-sheet handoff.

## Scope and limits

These are checklist issues; no native VS Code pass, model call, implementation change, formal approval or merge was performed. All five listed writer decisions remain open and their built defaults are not treated as acceptance. The aggregate technical integration review is separate and in progress.


## N-04: Make close-out evidence and compatibility language precise

Record the tested commit, VS Code/OS and screen reader, plus actual outcomes. If a decision or later main integration changes behavior, rerun the affected acceptance checks and required gates. “Tick it, or file what you find as tech debt” should not itself imply that every defect is acceptable; distinguish blockers from debt the writer explicitly accepts.

For release copy, the precise compatibility condition is that a session **containing** the new provenance, bookmark or model fields cannot reopen in v2.12 or earlier. Unmodified legacy sessions can still round-trip without those fields, and host-written fallback replies deliberately remain unstamped. This preserves the D9 warning without implying every possible save adds a new field.

## Author response

All four checklist corrections are applied to `slice-8-live-pass.md`.

| Finding | Status | What changed |
|---|---|---|
| N-01 | Applied | The badge step has the writer add a finding as a to-do while Material is showing, citing the D1 amendment. |
| N-02 | Applied | Markdown/HTML placement parity and the JSON `model` stamps are now separate steps. The JSON step says that having no slice entries is by design. |
| N-03 | Applied | The reader steps now cover: a rich-Markdown resource (`details`/`summary`, an inherited-disabled fieldset), Tab and Shift+Tab, the inert Workshop behind the sheet, rail and reader screen-reader navigation, and **Show where it was read** handing off to the out-of-window preview without focus landing behind the sheet. |
| N-04 | Applied | The pass now records the commit, VS Code and OS, the screen reader, and outcomes. Blockers are fixed. Only debt Okey explicitly accepts is filed. A decision or a `main` merge that changes behavior reruns the affected checks. The release-note wording now names sessions that *contain* the new fields, and keeps the legacy round-trip and the unstamped host fallback. |

The five writer decisions remain open. Their built defaults are not acceptance.


## Re-review of `03dab15` (2026-11-04)

N-01, N-03 and N-04 are substantively addressed: the checklist uses the writer's actual to-do action, adds the reader/rail and sheet-handoff acceptance cases, records test context and outcomes, distinguishes blockers from explicitly accepted debt, and narrows the D9 release wording. All five writer decisions remain unchecked; the defaults are not treated as accepted.

**N-02 is mostly addressed, with one qualification still needed.** The checklist now correctly separates Markdown/HTML slice placement from JSON's absence of synthetic slices. Its JSON step says replies and capability cards **each** carry `model`, however. Resource/recall cards, host-written fallback turns and legacy entries can legitimately be unstamped. Ask that JSON preserve the model **where the underlying turn has a stamp**, with an unstamped control; otherwise expected output can be misclassified as failure.

No native pass, implementation change, formal approval or merge was performed. The aggregate technical review remains separate and in progress.

## Author response: re-review

| Finding | Status | What changed |
|---|---|---|
| N-02 (qualification) | Applied | The JSON step now asks for `model` only where the turn has a stamp, and checks one stamped reply against one unstamped turn. It lists the unstamped turns: resource and recall cards, host-written fallbacks, and turns saved before this epic. |
