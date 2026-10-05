# PR Review — Workshop session recall design and groundwork

**PR:** [#125](https://github.com/okeylanders/prose-minion-vscode/pull/125) (open at review) · **Branches:** `claude/practical-ritchie-rx9n4t` → `epic/workshop-session-recall`
**Base:** `30b523610a0d5afde78f57db19b2c288e0aaaf0a` · **Reviewed head:** `eda61cb763d3759aea1b2a1c8a219008a6f2ae8c`
**Scope:** 35 files · +2,221 / −142 · 10 commits
**Reviewed:** 2026-10-05 · **Mode:** quick, focused Ada Forge review of the production diff, characterization tests, transcript consumers, and design/slice boundaries.

## Resolution ledger

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🔵 Nit | Result logging still has an implicit fallback for a new capability family | `WorkshopPersonaCapability.ts:768-798`, especially `:786` | Open, nonblocking; handle when adding the recall family in Slice 3 |

**Verdict:** Approve for integration into `epic/workshop-session-recall`, subject to the required GitHub checks passing. No Blocking, High, or Standard finding was identified in this quick review. F-01 is a small observability gap with no change to current writer-facing behavior. The PR already targets the associated epic branch.

## F-01 — Make the result log formatter exhaustive on its next touch

`resultLogSummary()` now calls `workshopCapabilityFamily()`, but still branches only on analysis and resources. Every other family returns `resourceMetrics=none`. Extending the family union forces changes in labels, evidence framing, rejected-request copy, and truncation copy; it does not force this formatter to handle the new family. After those other consumers are updated, a transcript result with recall metrics would silently take this fallback.

Use an exhaustive family switch here when Slice 3 introduces `transcript.*`, with an explicit dictionary case preserving its current log behavior and a recall case reporting the planned session, byte, cache, and truncation metrics. The existing `capability=...` log field still identifies the operation, so this is a nonblocking nit rather than a current attribution or data-loss bug.

## Review observations

- The operation, artifact, and context-source lists retain the existing values and order. Their unions and runtime validators now share those lists. No recall operation, artifact, or context kind is enabled in this PR.
- The projection move changes its location and exposes the existing per-turn function. The inclusion rules and message bodies remain unchanged. Export service and renderer tests pass against the moved module.
- Existing family labels, tool labels, evidence framing, resource-limit copy, and rejected-request recording remain equivalent in the inspected paths. Unknown operation strings are checked before the strict family classifier is called on the invalid-request path.
- The new tests exercise load and save rejection, archive-import degradation, the existing operations' labels, and hidden-field sentinels through real services. They provide useful characterization before recall is wired in.
- The ADR and epic keep the recall service, contract wiring, prompt enablement, and live verification in later slices. Publication policy, budgets, session addressing, and the default read window remain explicit open decisions. This review approves the groundwork; those later slices still need the corpus, workspace-change, bounds, cache, and save-and-reopen witnesses listed in the epic.

## Verification actually run

| Check | Result |
| --- | --- |
| Live PR and remote branch tips | Local head and base matched GitHub and `git ls-remote`; PR was open and mergeable, targeting `epic/workshop-session-recall` |
| Eight focused capability, persistence, transcript, archive, and bubble suites | 152 tests passed locally |
| Export service and renderer suites | 36 tests passed locally; total: **188 tests across 10 suites** |
| `npm run typecheck` | Core, webview, and extension passed |
| `npm run build` | Passed, including `verify:bundle`; emitted Browserslist freshness and webpack bundle-size warnings |
| `git diff --check origin/epic/workshop-session-recall...HEAD` | Passed |
| GitHub `verify` at the reviewed head | Queued at review: [run 37371085020](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37371085020), [run 37371122061](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37371122061) |

The author's full-suite and lint results were not independently rerun. No independent Extension Development Host or live provider pass was performed. Review coverage is limited to this design and behavior-preserving groundwork; it does not establish runtime acceptance of session recall.

The three pre-existing untracked items were left untouched. This report is the only intended file in the review commit. The documentation commit changes the PR head, so the required checks must pass on that updated head before merging.
