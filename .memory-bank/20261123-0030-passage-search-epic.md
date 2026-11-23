# Passage Search: built; the live pass and the open decisions are Okey's

**Date:** 2026-11-23
**Epic:** [README](../.todo/epics/epic-passage-search-2026-11-20/README.md) (active; not archived)
**Decision:** [ADR 2026-11-20](../docs/adr/2026-11-20-passage-search.md): D1–D24, the spec-review amendments D2a, D3a, D5a, D9a, D11a, D12a, D19a, and the build amendments S1–S41.
**Branch:** `epic/passage-search`, cut from the tip of `epic/workshop-persona-tools` at `1b3b9239`. Every slice is merged; the tip is `5b747f6b`. The closing pass is `epic/passage-search-close`. Nothing has gone to `main`.
**Next step:** Okey's [live pass](../.todo/epics/epic-passage-search-2026-11-20/live-pass.md), which ends with the open decisions. Then a PR from the epic to `main`, after Workshop Persona Tools has landed there.

## What shipped

A search that reads. The writer, or a persona, asks a question ("Find every time Jasper adjusts his glasses"). A model reads the scope chunk by chunk, host code checks every quote against the text, and a final pass organizes what was found. Each slice was a PR into the epic, reviewed by Astra, and merged with a merge commit.

| Slice | What | PR | Merged | Review |
|---|---|---|---|---|
| 0 | Spec: ADR and README | #292 | `e45d8d1b` | Three rounds: binding Run to the estimate shown (`planKey`), a root-aware listing, the rendered request's bound, Stop starting nothing, delivered meaning an adopted reply, then the rollback placed where the run is given up |
| 1 | The engine (`PassageSearchEngine`, `PassageSearchService`) and the `passageSearch` model scope | #293 | `773543f0` | Three rounds: the current editor, never a remembered one; rotation after the last admission; cancelled vs unsent; per-file coverage; the call cap; deterministic overlap; ceilings in `planKey`; then an in-flight cancellation's usage |
| 2 | The sidebar subtab | #294 | `8b441e55` | Two rounds: exterior paths shown by name; the result's own question; a host-held report export |
| 3 | The organizing pass | #295 | `f5949b97` | Five rounds: the pass on the run's own engine; one failed-call classifier (`tooLarge`, `dispatched`, `requests`); an exact fit; quotation grounding **closed by construction** after four leaks |
| 4 | A persona asks for a search: trailer, card, Run, delivery | #296 | `5b747f6b` | Five rounds: room-bound pricing; rollback on panel close; open-room instances; directive bounds; at most four held; manual Send for partial results; run-slot identity; Stop never followed by the host's send |
| Close | Live pass, ADR S24–S41, `AGENTS.md`, this entry | #297 | pending | Two rounds: reset the scopes before each search; thrown calls apart from returned ones; the combined refusal case left to the deterministic test, recorded live only if it happens on its own |

## Decisions

**Okey's:** P1 (an organizing pass), P2 (personas can run it, after the writer approves the price), P3 (an engine a research agent can call later; callers own consent), P4 (any project locations, several at once).

**The orchestrator's, each Okey's to overturn,** listed in the README's "Defaults taken" (rows 1–32) and the ADR's S tables. The ones worth remembering:
- **`plan`, then `run(plan)`.** What was priced is what is searched. `planKey` covers the call plan, ceilings, token figures and pricing basis.
- **A group is every file its own patterns match,** across roots. That is wider than the picker shows.
- **Quotes are anchored by host code;** what is shown is the source slice, never the model's spelling. An ambiguous quote is dropped (Q1).
- **12,000 words a call** (Q2), lowered to fit half a known window.
- **Stop starts no model call,** and the host never sends a stopped search.
- **The host sends a persona's results itself only when everything planned was read in full** (S38); otherwise the writer presses "Send partial results".
- **Quotation grounding fails closed.** Marks take roles from their neighbours and pair like brackets, and each outermost quotation is checked whole. Leading elisions, apostrophes inside single-quoted quotations, two single-quoted quotations, and quotes holding « » or corner marks drop the claim. The prompt asks for straight double marks.
- **A held persona result survives only a Rewind in the same open room** (S36); any other replacement, a reopen of the same session included, drops it.

## Verification

- **Last full run** (`npx jest --maxWorkers=25%`, at `cc83e9e4`, the code merged as `5b747f6b`): 1,017 suites / 14,399 tests / 60 snapshots, all passing. Typecheck clean; lint 0 errors, 1,427 warnings. CI passed on every merged head.
- **The epic added** 51 suites and about 700 tests over Workshop Persona Tools' 966 / 13,696.
- **Astra's combined acceptance case passes** through the production engine and the real Workshop routes. Two files: one matched, one refused by the engine's preflight. The counts, coverage, charge, manual Send and saved receipt all agree.

**Not verified:** nothing has run in an Extension Development Host or against a real model. Every review was offline (static reading, mocked transports, React/jsdom). The live pass exists for this.

## Process notes

- **Usage limits stopped the build agents three times,** twice on the 5-hour limit and once on the model's limit. Work survived each time because agents committed as they went and worked in their own worktrees. The last rounds ran on another model. Two agents at a time fit; three ran out the limit.
- **Shared memory:** concurrent jest runs across worktrees were OOM-killed and the shared jest cache gave cross-worktree type errors. `--maxWorkers=25%` and a private `--cacheDirectory` per worktree fixed both.
- **Sibling slices** that share types (`calls`, the report and words) were integrated by whichever merged second, with Astra's combined acceptance test on the joined code.

## Open

- **The live pass,** and the decisions it ends with: Q1 (ambiguous quotes), Q2 (words per call), manual Send for partial results, whether the quotation rule drops too many claims, and Bring a sidebar result to the Workshop (Q5).
- **Q3** (resumable persona searches), **Q4** (figures in the analysis unchecked) and **Q6** (a single-file picker in the sidebar) stay open.
- **The PR to `main`** waits for Workshop Persona Tools to land there first.
