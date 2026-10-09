# PR Review — Show vs. Tell generation, response codec, and prompt bundle (Slice 2)

**Author:** okeylanders · **PR:** [#135](https://github.com/okeylanders/prose-minion-vscode/pull/135) (open, unmerged at review)  
**Branches:** `epic/conversation-widgets-sprint-05-slice-2-generation` → `epic/conversation-widgets`  
**Verified base / merge-base:** `d068abddbc0a89a65c8466780735e6cfab83005d`  
**Reviewed code head:** `43d1a7a584658d9a3be7dfb4a737a4decad36697`  
**Scope:** 36 files · +3,068 / −31 · 11 commits  
**Reviewed:** 2026-10-09 · **Reviewer:** Astra · **Mode:** independent code/spec review, focused lifecycle and codec audits, adversarial runtime probes, full deterministic verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| — | — | No actionable finding established in the reviewed Slice 2 scope | Independent inspection, adversarial probes, full local gates, and code-head CI | **N/A** |

**Verdict: Approved for merge into `epic/conversation-widgets`.** No open Blocking, High, Standard, or Nit finding remains. The prompt bundle, strict response boundary, service, source-reference persistence, cancellation, and correlation match this slice's current contract. All deterministic gates and code-head CI pass. Approval remains subject to required checks on the final report-only branch head. This report does not merge the PR or authorize starting Slice 3 before the writer merges it.

## What is sound

### Correct scope and architecture

- The branch starts at the Slice 1 merge, `d068abdd`, and targets the epic. The catalog stays `live: false`; the real catalog policy refuses the route until the later catalog flip. No UI, commit, recommendation, editor-write, or standing-directive path is introduced.
- `extension.ts` constructs `ShowVsTellService` at the existing composition root. The service is injected through `CoreServices` / `WorkshopWidgetRuntime`; handlers do not construct infrastructure.
- The handler, service, and codec remain feature-owned and below 500 lines. Shared changes are explicit sibling arms in the message, cancellation, recovery, composition, and architecture registries. Core source imports no `vscode`.
- The two direct generation/cancel routes are inventoried, the generation activity predicate is present, and composition disposes the handler. The temporary one-shot activity key union is explicitly bounded until Slice 4 adds the commit payload arm.

### Prompt and closed response boundary

- Both the system bundle and example teach four groups in their fixed order, one or two variants each, selected channels as an emphasis rather than a group filter, and both showing and telling as choices with gains and costs. The mixed group teaches its usual usefulness and the reason to distrust it once.
- The prompt makes POV a constraint across all groups, explains the unspecified case, distinguishes the required invariant from the optional hard boundary, and teaches passive flags. The example itself decodes through the production codec.
- `ShowVsTellResponseCodec` owns sentinel framing and exact wire key sets, rejects provider-supplied ids or extra fields, derives host ids, and then runs the same workup shape/integrity gates as persistence. Semantic validation has not forked into a second policy.
- Those shared gates enforce group membership/order, cardinalities, field budgets, distinct channels, normalized duplicate rejection, direction-shorter-than-prose, and flags only against nonblank declared invariants. The Slice 1 apostrophe-normalization correction is retained.
- Adversarial responses with repeated groups, duplicate channels, or a hard conflict against must-survive reject. Generation settles atomically rather than salvaging a partly valid workup.

### Service, source custody, and lifecycle

- Request validation runs before engine acquisition or the provider call. The service uses the `widget` scope, the frozen output ceiling, one `runInitial` call, and the caller's abort signal. Truncation and malformed paid responses go through the existing recovery store.
- The generated request JSON contains the authored generation inputs and host-resolved source material. Provenance and host identities are not unnecessarily copied into the model task. Writer/source strings remain JSON values; this is a structural framing measure, not a claim that arbitrary prompt injection is impossible.
- Q1 is implemented as a zero-or-one source reference, with exact keys and cloning. Active excerpts and context attachments are resolved from current host session truth. Missing sources fail before spend; webview-supplied passage text is not forwarded or persisted in `surroundingContext`.
- Writer cancellation and supersession abort the matching attempt, post its terminal cancellation progress, and suppress its later success, error, and token callbacks. A refused unavailable/wrong-widget request does not disturb a different active attempt.
- Workup ids are newly host-minted for each attempt. Success and ordinary failures finish their progress stream; teardown aborts and retires the active attempt. No generation path writes session state.

## Independent verification actually run

All local checks below target **`43d1a7a584658d9a3be7dfb4a737a4decad36697`**, before this report-only commit, on Node **24.19.0** / npm **11.9.0** with the unchanged lockfile. GitHub's CI uses Node 18.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **277 suites / 3,788 tests / 2 snapshots passed**, 94.479 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| Full `npm run lint` | **0 errors / 1,092 warnings** |
| ESLint over all changed TypeScript files | 0 errors; warning locations are shared existing-style registry/enum declarations and pre-existing `MessageHandler` constants |
| `npm run build`, including `verify:bundle` | Passed; the three existing webpack asset-size/performance warnings |
| `git diff --check d068abdd..43d1a7a5` | Passed |
| Host-agnostic core source scan | No `from 'vscode'` source imports |
| Additional full-session matrix | **96 decoded-workup round trips passed**: all 16 legal group cardinalities × all 3 source-reference choices × single-/multi-line values |
| Additional malformed-source boundary matrix | Six malformed shapes rejected, including passage-text injection, unknown kinds, bad ids, and excess references |
| Additional response-codec challenge | Duplicate channels, repeated groups, and illegal hard-conflict targets reject; all supported source kinds survive export/parse/hydration |
| Code-head GitHub CI | **Success**, [PR run 37939167779](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37939167779) |

The independent 96-case matrix decoded wire responses through the production codec, created configs in a real `WorkshopSessionService`, exported them, JSON-serialized/parsed them, ran the session parser, and hydrated a fresh service. Exact workups, source references, mixed carry modes, and allowed multiline values survived unchanged.

The lint total is six warnings above the reviewed Slice 1 total of 1,086: four new all-caps message enum members and the two new hyphenated registry keys in composition/cancellation. These follow the existing wire/registry convention. The handoff's statement that no warnings were added should be read with this measured qualification; there are no lint errors or warnings in the new feature implementation files. The “244 warnings potentially fixable” footer is not the total warning count.

The final report-only commit and its exact-head CI are verified after publication.

## Scope boundaries and next-slice review gates

These are existing planned responsibilities or verification limits, not new findings or silently accepted deferrals.

- **Q2 changed the multiline contract explicitly.** The current sprint allows multiline directions, gains/costs, flag notes, and invariants. Rejection of those values would now be incorrect. Slice 4 must define the artifact continuation-line format and redo the fit arithmetic if that encoding adds characters. The existing 585-character arithmetic remains a bound for the current raw field formula, not proof for a future expanded encoding.
- **Craft guidance is not a deterministic semantic oracle.** The parser enforces the closed structure and mechanical invariants. It does not prove POV legality, preservation of story meaning, neutral wording, sentence count, or absence of literal Markdown/HTML-like text in gains/costs. Those are prompt instructions, as disclosed in the handoff. No unsafe rendering is established by this slice; the later UI must render the fields as plain text.
- **Slice 3 owns presentation invalidation.** Its controller must correlate fresh tokens, discard stale replies after close/room/input changes, invalidate on every generation input except position, and clear kept/carry state on regeneration. A headless handler test is not a substitute for those later interaction tests.
- **Slice 4 owns commit safety.** This review does not certify the future meter, host 600-character recheck, delimiter neutralization, history marks, or clone-and-recommit path. The explicit prohibition on integrating the epic into `main` between Slices 3 and 4 remains in force.
- **Q3 remains scheduled for Slice 5.** Persona-prepared POV custody on reopen is still an explicit open design question, not an omitted Slice 2 implementation.
- **Not run:** live/billable model calls, provider-quality evaluation, interactive VS Code Extension Development Host testing, or UI/commit flows that this slice does not yet implement. All test content was synthetic or repository fixtures; no real manuscript was sent to a provider.
