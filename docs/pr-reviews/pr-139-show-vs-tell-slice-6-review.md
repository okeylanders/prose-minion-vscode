# PR Review — Show vs. Tell witnesses and current-state docs (Slice 6)

**Author:** okeylanders · **PR:** [#139](https://github.com/okeylanders/prose-minion-vscode/pull/139) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-6-witnesses` → `epic/conversation-widgets`
**Verified base / merge-base:** `9ce728f483dc011f492e1243bce7d31b35cdce11`
**Reviewed implementation/docs head:** `2c4709cc84b6b97e9193c3a7937ab705ddb1663a`
**Additional reviewed docs-only head:** `0592cb1018acce9e58a9a58c6906cf6a4fbfabfb`
**Scope:** 15 files · +1,344 / −19 · 6 commits
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent source/spec and witness review, exhaustive channel-order probes, retained authoring regressions, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | Minor / P3 | The new live-provider follow-up conflates response validation with the selected-artifact ceiling | Follow-up lines 12–14 and 36–37; a valid 700-character prose variant decodes, its over-budget prose artifact refuses at commit, and direction-only carry succeeds | **Open** |

**Verdict: One minor documentation correction requested; approval pending F-01.** No runtime or architecture blocker was established. The implementation, full gates, and independent regressions pass. This finding is about the accuracy of the new quality-pass instructions, not a defect in the runtime budget enforcement.

## F-01 — Separate generation validation from the writer-selected artifact budget

**Location:** [live-provider quality-pass follow-up, lines 12–14](https://github.com/okeylanders/prose-minion-vscode/blob/2c4709cc84b6b97e9193c3a7937ab705ddb1663a/.todo/tech-debt/2026-10-09-show-vs-tell-live-provider-quality-pass.md#L12-L14), with the same distinction needed in [completion criteria, lines 36–37](https://github.com/okeylanders/prose-minion-vscode/blob/2c4709cc84b6b97e9193c3a7937ab705ddb1663a/.todo/tech-debt/2026-10-09-show-vs-tell-live-provider-quality-pass.md#L36-L37).

The document lists a malformed four-group response, exceeding the 600-character artifact ceiling, and a direction that is too long, then says the strict parser rejects “those outputs.” The middle case is not a response-parser failure. Generation may validly contain prose up to **1,200 characters per variant** and several variants. The **600-character limit applies later to the writer's selected artifact body**, after choosing keeps and carry modes.

Evidence:
- `ShowVsTellResponseCodec.ts:57–89` enforces the response envelope, shape, and workup integrity. The existing `ShowVsTellResponseCodec.test.ts:224–233` explicitly accepts a 1,200-character prose variant.
- `ShowVsTellOneShotCommit.ts:78–87` independently measures the selected artifact body and rejects over 600.
- An independent synthetic witness decodes a valid **700-character** prose variant, keeps it as prose and observes the commit refusal, then switches the same variant to direction-only and observes an accepted commit plan. No provider, editor, or real room is used.

**Impact:** A future quality pass could count valid long generated prose, or an all-prose selection that the writer must narrow, as a malformed model response. Its stated outcome currently does not identify the kept variants and carry choices used to measure the artifact.

**Requested change:** Separate parser acceptance/response-contract checks from selected-artifact fit. Record the tested kept set and carry modes, check the meter and host refusal for an over-budget selection, and check a fitting selection such as the guaranteed one-direction case. Do not describe the response parser as enforcing 600 or require all generated prose to fit at once. No runtime code change is requested.

## Verified implementation and witness quality

- **Narrow source change.** The only product-code delta is `ShowVsTellConfigCodec.ts:106–117`: persisted recommendation channels must be distinct and in canonical order. Enum and cardinality checks run first. This addresses the optional import-boundary observation from PR #138 without changing normal producer output or adding a migration for the unshipped arm.
- **Exhaustive normal-path preservation.** All **325** distinct ordered nonempty channel subsets, plus an empty optional suggestion, pass the real recommendation parser, canonicalization, session parsing/hydration, seeded-draft reopening, and production generation ingress. All **31** canonical persisted subsets hydrate; all **294** noncanonical permutations fail at session parsing. The synthetic generation port returns cancellation after ingress; these probes do not claim a live generation.
- **Real production routes.** The matrix uses `MessageRouter` → `WorkshopRoomHandler` → `WorkshopSliceComposition`, the production catalog availability policy, and the closed commit/recommendation adapters. Commit, clone/recommit, over-budget and bad-provenance refusal, Host and invited-Guest adoption, and tool-turn rejection are exercised. The existing generation row remains in `WorkshopRoomHandler.seams`.
- **Meaningful independence checks.** Host witnesses compare deep copies of Lexical Gravity state before and after Show vs. Tell adoption/commit, and verify that a real gear/evidence-mode shift occurred while the committed Show vs. Tell config/artifact stayed unchanged. Opening-hook tests separately preserve the other widget's opening state and rail.
- **Bounded architecture claims.** The vocabulary and independence scans have inventory floors, negative controls, and behavioral complements. Frozen shared data has no stateful owner. Prose Controller is not built: its prospective source scan is currently vacuous and its adoption assertion is documentary, not proof of a second working surface. The sprint correctly leaves that criterion unchecked.
- **Retained lifecycle behavior.** All 17 independent seeded-authoring probes and 63 retained Slice 3/4 probes pass against this head, including source invalidation, stale completion rejection, pending-commit freezing, close/reopen, exact clone, and recommit lineage.

## Completion scope and remaining evidence

The current sprint says **Slice 6 ready for review**, and explicitly leaves three broader completion criteria open: interactive readout comprehension, a dedicated “never silently canon” witness, and the future Controller consumer. Native VS Code/browser checks and live-provider quality are expressly unrun and tracked. This review does not tick those criteria, accept a waiver, or authorize a release/main merge.

The completion-note title “Sprint 05 complete” is broader than its qualified body; “Slice 6 verification and remaining checks” would be clearer. Likewise, its August inventory of 189 suites / 1,937 tests / 1 snapshot is older history, not the recorded Slice 0 baseline of **267 / 3,535 / 2** at `7031b7ee`. These are optional wording nits, separate from F-01.

## Verification actually run

Full gates and independent probes below target **`2c4709cc84b6b97e9193c3a7937ab705ddb1663a`**. During review, **`0592cb10`** amended only the sprint's readout-test citations. I inspected that complete delta, verified the cited tests, reran the modal and architecture witness suites (**64 tests**, 7.883 seconds), and reran `git diff --check` at the amended head. Product code and test files are unchanged. Both heads precede this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**. The isolated worktree reused the prior lockfile-installed dependency tree; the lockfile is unchanged and source aliases resolve into this worktree.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **296 suites / 4,190 tests / 2 snapshots passed**, 213.216 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,112 warnings**, unchanged baseline |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check 9ce728f4..2c4709cc` | Passed |
| Focused route/independence/persistence/witness suites | **5 suites / 46 tests passed**; overlap with full suite, not extra inventory |
| Independent exhaustive channel-order audit | **2 tests passed**, 9.728 seconds; enumerated cases described above |
| Independent parser-versus-commit budget witness | **1 test passed**, 5.826 seconds |
| Retained independent seed-specific UI probes | **17 tests passed**, 19.664 seconds |
| Retained independent Slice 3/4 UI/controller probes | **3 suites / 63 tests passed**, 79.616 seconds |
| Reviewed-head GitHub CI | **Success**, [run 37978105790](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37978105790) |

Native rendering/traversal, interactive VS Code Extension Development Host behavior, and live/billable providers were **not** independently exercised. JSDOM and synthetic ports establish deterministic behavior, not visual fidelity or provider prose quality. No real manuscript, clipboard, or editor data was used; this review makes no functional edit, real-room commit, merge, or release.
