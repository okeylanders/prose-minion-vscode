# PR #286: Workshop Persona Tools, Slice 0

**Verdict: changes requested.** Reviewed `c7c09d440f296591757e2f549469f03e6ad27321` against `478157d0a7929d94c01ebb37813900c1852d12be`. This is an architecture gate, not a report of bugs reproduced in shipped features. No product edits or merge. [SHA-anchored review](https://github.com/okeylanders/prose-minion-vscode/pull/286#pullrequestreview-5973120262).

| Slice | Ownership and implementation gate |
|---|---|
| A: close and undo | The reply owns the receipt; the open room owns live to-dos; the target named session owns saved to-dos. Keep recall read-only. The transfer between independent writers and between two durable records needs F-01/F-02. |
| B: file history | The adapter resolves an authorized file through VS Code Git; core resolves commit membership, compares texts, and fits changes into the room. Keep that split, but bound the first comparison stage as well as the second (F-03). |
| C: context paths | Settings and Workshop share a preview/checker; only the writer's Apply changes settings. The resolver must distinguish unknown from empty before the writer's global settings can be replaced (F-04). |

### F-01 · P1 · The named-file store does not provide the cross-window CAS promised by D6

[ADR D6](../adr/2026-11-19-workshop-persona-tools.md#d6-the-saved-session-write-port-default-4-settled), lines 323–349; epic defaults 5–6. [Observed] [WorkshopSessionStore.ts](../../packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L278-L304) rereads the expected checkpoint in a callback. The [commit itself](../../packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L947-L975) awaits the callback and separately issues an overwriting rename. Independent coordinators can both pass the check before either replacement takes effect. Each save then appears successful. The [recovery write](../../packages/core/src/application/services/workshop/WorkshopSessionPersistenceCoordinator.ts#L1802-L1827) on rejection cannot rescue a write that never rejected; the [rolling path](../../packages/core/src/infrastructure/storage/WorkshopSessionStore.ts#L210-L217) is per session directory, not private to each window, either.

**Gate:** Specify one coordination mechanism shared by participating named writers, or a conservative refusal when safe participation cannot be established. State separately what can actually be guaranteed for uncoordinated external sync. Require one overlapping save case with the same expected checkpoint: both operations must not report success while one change disappears. Keep the existing sequential stale-save test; it covers a different case.

### F-02 · P1 · A persisted `saving` receipt has no restart transition

[ADR D5/D8](../adr/2026-11-19-workshop-persona-tools.md#d5-where-each-change-is-written-and-when), lines 292–299 and 384–390. [Declared] The source receipt may be saved before the target changes; the comparison snapshot lives only in memory. A restart can therefore leave the **same source state** with two different target states: the change did not land, or it did land but the receipt was not updated. Q1 (what the next prompt says while work is in flight) does not address a dead worker. [Observed] The cited [memory builder](../../packages/core/src/application/services/workshop/memory/WorkshopReplyMemory.ts#L140-L164) stores `pending`; “saving” is its log wording, not a persisted state machine inherited by this feature.

**Gate:** Define a terminal recovery transition that checks the target's status and provenance, including origin room/turn identity. Restore a usable applied receipt/Undo when ownership still matches; otherwise report interruption or uncertainty without replaying a write over later writer work. Test reload on both sides of the target commit and after a subsequent writer change.

### F-03 · P2 · The outer paragraph diff has no independent work limit

[ADR D13](../adr/2026-11-19-workshop-persona-tools.md#d13-the-diff-paragraphs-then-words-g2-jsdiff), lines 549–566. [Declared] A byte cap limits each text, then all paragraphs are aligned, then changed pairs receive a bounded word diff. Many short, substantially rewritten paragraphs fit below the byte cap. Their alignment can dominate host work before the word cap or output fitting is reached. [Observed] [jsdiff's options](https://github.com/kpdecker/jsdiff#universal-options) support abortable diffing; [the paragraph splitter](../../packages/core/src/utils/blankLineParagraphs.ts#L23-L35) produces an entry for each paragraph.

**Gate:** Budget the array stage itself, define the outcome on exhaustion (bounded coarse result or explicit refusal), and ensure a continuation does not repeat unbounded work. Verify independent outer and inner budget cases. This does not challenge G2's choice of jsdiff.

### F-04 · P2 · A failed resolver query must not become a zero-match global write

[ADR D22–D24](../adr/2026-11-19-workshop-persona-tools.md#d22-the-checker), lines 716–728 and 751–760. [Observed] [ContextResourceResolver.ts](../../packages/core/src/infrastructure/context/ContextResourceResolver.ts#L183-L218) has two distinct failure contracts: `browse-counts` skips failed searches/unreadable candidates, while `authoritative` signals an incomplete read without logging names. [Inferred] When two patterns were approved, a transient failure on one at Apply plus a successful match on the other could write a smaller comma-joined setting across projects. An empty search and an incomplete search are not interchangeable.

**Gate:** Retain private count-only diagnostics but make incomplete evaluation explicit. Leave the affected group unchanged, identify it in the sheet/card, and allow retry. Exercise two patterns in one group: first both match, then one search fails at Apply; expect **no write for that group**. Separately test a genuinely successful zero-match result.

### What held up, and what was verified

- The three linked source notes distinguish T1, G1–G3 and L1–L3 from implementation defaults. No new product decision is needed from Okey for the four findings. Q1–Q4 remain owner options; they are not review failures.
- Pinned [VS Code 1.82 API](https://github.com/microsoft/vscode/blob/1.82.0/extensions/git/src/api/git.d.ts#L125-L132) supplies `path`/`maxEntries`, not `skip`. Its [log implementation](https://github.com/microsoft/vscode/blob/1.82.0/extensions/git/src/git.ts#L1023-L1036) does not request rename following. Its [show adapter](https://github.com/microsoft/vscode/blob/1.82.0/extensions/git/src/repository.ts#L1749-L1765) goes through the [text-converting read](https://github.com/microsoft/vscode/blob/1.82.0/extensions/git/src/git.ts#L1153-L1158). These claims are supported at the declared floor; this was a source check, not an Extension Development Host run.
- Verified both changed paths were documentation and all **13 distinct relative Markdown link targets** in them resolved at the reviewed SHA. [GitHub CI verify](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44499826826/job/135476343749) passed install, typecheck, tests, lint and both webpack bundles. No separate local suite or live workflow was run. Green CI does not exercise future slice behavior.
- **Re-plan verdict: refine before implementing.** Keep the three proposed ownership boundaries, shared Settings checker, and existing review order. Revise the four failure contracts and add their acceptance witnesses to the ADR/epic before treating Slice 0 as approved.
