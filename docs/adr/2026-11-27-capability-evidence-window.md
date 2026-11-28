# ADR — Fit memory reads and withhold oversized capability evidence

**Date** 2026-11-27
**Status** Accepted for implementation
**Scope** Capability evidence in all four capability-bearing run policies and the Workshop's `memory.read`.

## Context

[Everyday Conveniences D1–D7](2026-11-14-everyday-conveniences.md) shipped the shared half-window read rule and multi-file `resource.read`. Project memory still renders whole notes against a character ceiling alone. A guide, report, dictionary entry, or other result can exceed the preflight after a capability has already returned it. The Workshop currently records the original result before the engine knows whether it will send that result to the model. The writer chose a narrower retry within the existing round limit in the [feature decisions](../../.todo/features/feature-workshop-reads-fit-the-window/README.md).

## Decisions

1. Fit `memory.read` to half the available input tokens through the shared Workshop read rule. Measure the rendered evidence, keep whole notes in requested order, and identify omitted notes and the limit. When the window is known each read gets its current share. Without live model metadata, all memory reads in the turn share one read's character allowance. Existing limits on calls, notes and per-read characters still apply. The file and recall protocols keep their existing grammar and limits.
2. Check the entire prospective evidence request before dispatch in `AgentRunEngine`, for assistant guides, context generation, Workshop tool sidecars and Workshop personas. Use the requested model, real retained artifact address, history, tool schema, native-protocol reminder, output reserve and preflight headroom. When oversized, replace the evidence with a short notice naming the request type and available tokens and approximate characters. Full dictionary entries and analysis reports have no smaller form. Other calls may narrow and retry. Each attempt consumes its normal round. The existing forced-final path follows a further request at the ceiling. When a translated native reply requested additional calls, the notice still tells the model those calls did not run. If the complete notice does not fit, normal preflight refuses dispatch. Without known window metadata, the provider remains authoritative.
3. A capability with a visible ledger may prepare its result and settle it synchronously after that check. The Workshop records exactly one card, before posting either a successful result or a rejection stating that it did not fit. The rejection retains the cost of any nested provider work. Its stored content is the notice. It has no result payload, report findings, delivered files, or source rows. The existing publication rule excludes rejected cards. A discarded payload never joins the retained conversation, catch-up, or a manifest. Other adapters can deliver through their existing fulfillment method, with the engine removing the oversized material and its provenance together.

## Verification

Exercise a withheld result followed by a narrower result, the forced-final path, an irreducible notice, and an unknown window. Check all four policies and the Workshop ledger's publication and delivery projections. Cover full-note fitting and unknown-window cumulative memory reads at the boundary, including the wrapper and individual note sizes.
