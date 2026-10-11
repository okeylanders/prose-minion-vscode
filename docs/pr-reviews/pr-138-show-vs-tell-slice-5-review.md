# PR Review — Show vs. Tell persona recommendation and prefill (Slice 5)

**Author:** okeylanders · **PR:** [#138](https://github.com/okeylanders/prose-minion-vscode/pull/138) (open, unmerged at review)
**Branches:** `epic/conversation-widgets-sprint-05-slice-5-recommend` → `epic/conversation-widgets`
**Verified base / merge-base:** `4f20c0965ab41ff98a702841156723d46d676119`
**Reviewed code head:** `032292c843074e0a7fdcb64b4c8203077ed1d7ef`
**Scope:** 32 files · +2,237 / −42 · 3 commits
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, focused recommendation-boundary and seeded-authoring audits, adversarial synthetic probes, retained Slice 3/4 regressions, and full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| — | — | No actionable finding established in the reviewed Slice 5 flows | Independent parser/persistence/run-completion and full-application seed probes, retained regressions, and full gates pass | **N/A** |

**Verdict: Approved for merge into `epic/conversation-widgets`.** No open review finding remains at `032292c8`. The slice implements recommendation and prefill without transferring generation or commit authority to the persona. Approval remains subject to required checks on the final report-only branch head. This report does not merge the PR; Slice 6's production-route witnesses and current-state documentation remain outstanding.

## Scope and architecture

- The branch starts at the merged Slice 4 epic tip. The change adds one feature-owned recommendation parser/entry and explicit arms at the established recommendation, persisted-union, clone, source-availability, opening, chip, and Host-preparation seams. It adds no generic widget framework or cross-feature state owner.
- [`ShowVsTellRecommendation.ts`](https://github.com/okeylanders/prose-minion-vscode/blob/032292c843074e0a7fdcb64b4c8203077ed1d7ef/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellRecommendation.ts) owns the prompt copy, 24 ordered markers, closed values, field validation, and exact **2,200-character** response-frame ceiling. The existing registry continues to own selection, availability, coarse/exact frame limits, and control stripping.
- The new persisted seed arm is required and input-only. [`assertShowVsTellRecommendationSeedShape`](https://github.com/okeylanders/prose-minion-vscode/blob/032292c843074e0a7fdcb64b4c8203077ed1d7ef/packages/core/src/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec.ts#L58-L118) rejects output/workup, keeps, carry, note, provenance, unknown nested keys, and missing required inputs. This is an unshipped arm, so the lack of a migration is consistent with the codec-evolution policy.
- The authoring controller remains **498 lines**. Seed construction is a pure sibling rule, and the parser/codec remain host-only. The feature continues to share vocabulary constants, not Prose Controller or Lexical Gravity authoring state.

## Independently verified behavior

### Recommendation grammar, trust, and host adoption

- All 24 marker omission and duplication cases reject. Field limits, multiline policy, empty required fields, closed POV/position/channel/budget values, malformed references, and the exact whole-frame ceiling are exercised. Cross-widget dispatch cannot relabel another widget's frame as Show vs. Tell.
- Seven new tag names are registered with the reserved-delimiter neutralizer in the same change. Case-varied, attributed, and nested reserved-tag probes do not create additional trusted framing. Ordinary text remains text.
- The shared run-completion path accepts valid Host and invited-Guest recommendations under the production catalog policy. Missing live sources reject with a writer-facing notice. Cancelled and stale/zombie completions do not attach a seed; direct tool output cannot become a persona recommendation.
- Private recommendation controls are stripped from visible/retained prose through the existing protocol owner. Round-trip and deep-copy probes preserve valid seeds without aliasing references, POV objects, or channels.

### Seeded authoring and writer authority

- Full-`WorkshopApp` probes open both Host and Guest chips with the actual persona identity/label. Supplied inputs appear exactly; omitted suggestions use the feature defaults. Opening sends **no Generate or Commit request**.
- [`createShowVsTellSeededDraft`](https://github.com/okeylanders/prose-minion-vscode/blob/032292c843074e0a7fdcb64b4c8203077ed1d7ef/packages/core/src/presentation/webview/hooks/domain/workshop/controllers/showVsTell/showVsTellAuthoringRules.ts#L68-L107) explicitly copies only input fields. Workup is null, keeps and note are empty, source references/POV/channels are defensively copied, and the chip-only subject never reaches the draft or generation payload.
- The current sprint's explicit pronoun-free decision is followed: the banner names the persona without inventing pronoun data. POV is plain writer input after prefill; only the beat records `persona-prefill` provenance and latches `editedByWriter` when changed. This review does not infer a new persona-catalog field.
- The Host-preparation door closes the browser and fills an **editable composer request**, selecting the Host even when the room currently targets a Guest. It does not send the request or generate/commit anything. Explicit Send is still required.
- Unavailable seeded references are retained rather than silently removed; Generate is blocked until the writer resolves the choice. Later source loss cancels grounded generation. Close/reopen, stale-token/workup, active-sheet, and pending-config guards remain intact.
- Seeded commit, refusal/retry, pending-commit freeze, exact clone reopening, and recommit lineage pass. The 63 retained independent Slice 3/4 tests also pass, including both previously repaired commit-lock witnesses.

### Prompt and policy review

The new recommendation copy presents telling/showing as tradeoffs, forbids treating showing as the fix, and reserves generation, keeping, carry, note, and commit decisions for the writer. The Host-preparation request uses the same input-only posture. The assembled recommendation instruction grows from **7,823 to 12,523 characters**; this explicit 4,700-character growth and its pin were reviewed rather than accepted as an incidental test update. No live-provider evaluation of semantic compliance was performed.

## Import-boundary observation

The persisted seed shape accepts distinct channels in a noncanonical order, such as `['interiority', 'observable-action']`. An independently altered session can therefore parse/hydrate, but its seeded draft is refused by the existing generation integrity gate with **“unique channels in the fixed channel order”**, before any provider call. The current persona-frame parser canonicalizes channel order, and normal UI, clone, export, and hydration paths preserve that output; no current producer of the altered ordering was found.

This is disclosed as optional import-boundary hardening, not a current-flow regression or an accepted deferral. The review does not claim arbitrary hand-edited session JSON is normalized into generation-ready input.

## Verification actually run

All checks target **`032292c843074e0a7fdcb64b4c8203077ed1d7ef`**, before this report-only commit. Runtime: Node **24.19.0** / npm **11.9.0**. The isolated review worktree reused the prior lockfile-installed dependency tree; the lockfile is unchanged and repository source resolves through this worktree's path mappings.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **292 suites / 4,160 tests / 2 snapshots passed**, 224.080 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,112 warnings**; seven additional naming-convention warnings at closed registry/rejection keys |
| `npm run build`, including `verify:bundle` | Passed; existing webpack size/performance warnings |
| `git diff --check 4f20c096..032292c8` | Passed |
| Independent host adversarial probes | **127 tests passed**, 7.297 seconds; includes the import-boundary characterization above |
| Independent seed-specific UI probes | **17 tests passed**, 11.897 seconds, using the real application/controller stack with synthetic host data |
| Retained independent Slice 3/4 UI/controller probes | **3 suites / 63 tests passed**, 61.830 seconds; counted once despite a separate corroborating run |
| Code-head GitHub CI | **Success**, [PR run 37965669204](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37965669204) |

Native browser rendering/traversal, interactive VS Code Extension Development Host behavior, and live/billable providers were **not** independently exercised. JSDOM and synthetic ports/envelopes establish the deterministic behavior above, not provider prose quality or visual fidelity. No real manuscript, clipboard, or editor data was used; no functional repository edit, real-room commit, merge, or release was performed by this review.
