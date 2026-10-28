# PR Review — Draft Edit Slice 3c, part 2: register shift

**Latest disposition — re-review of `7936977b`: No blocking findings; N-01 resolved. Native VS Code and live-provider fixture acceptance remain separate and unrun.**

**Author:** okeylanders · **PR:** [#178](https://github.com/okeylanders/prose-minion-vscode/pull/178) · **Reviewer:** Astra · **Reviewed:** 2026-10-27

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Implementation head:** `48901041ade945dea6a28abea8314abda89cc73d`

**Base and merge-base:** `f7b0c851e11720e55a2e94811a41df3cd98d877e`

**Scope:** 27 files · +722 / −63 · implementation tree `ca6eb4816f781fc22db29da336eded68e2e64b0a`

## Summary

Register shift joins the existing flag-only pipeline rather than introducing a second write path. Its kinds and definitions have one domain owner; its prompt, root-field allowlist, speech policy and request identity are category-specific. The root register line survives anchoring and live movement into informational notes, never a replacement or quick fix. Missing ground rejects the affected category without discarding the sibling category's usable reply.

The second parallel call does not regress PR #177's approved-model or document-lifetime protections in independent held-promise tests. Both calls use the model actually priced, retain distinct prompts/conversations, and respect cancellation, recovery and the category selection captured at the gesture. No source correction is requested for integration into the epic. This is source and controlled-host verification, **not a claim that the new editorial judgments have been validated on live models**.

## Nonblocking note

### N-01 · P3 · Make the period worked example historically unambiguous

**Location:** [`21-register-example.md:19–22`](../../packages/core/resources/system-prompts/craft-flags/21-register-example.md#L19).

The positive `period` example flags `okay` against a broadly **Victorian English** register, explaining it as “A later, American word”. An American/informal mismatch with this narrator may be a reasonable register judgment, but it is not an unambiguous temporal example. Merriam-Webster dates `OK` to 1839 and records the exact spelling `okay` in *Little Women* (1868–9), within the Victorian period. The passage itself supplies no narrower historical date that establishes the mismatch; its introductory publication metadata is not the narrator's setting. [Lexical source](https://www.merriam-webster.com/wordplay/the-hilarious-history-of-ok-okay).

**Suggestion:** use an unmistakably later expression in narration that actually establishes its period, or classify this example as an informal/register mismatch without claiming the word postdates Victorian English. Keep the paired dialogue control, and update the worked-example assertions with it. The existing tests correctly verify framing, anchoring and the speech exclusion; they cannot establish the historical premise of the positive example. This is a static prompt-quality note, not evidence of a measured live false-positive rate.

## Architecture and behavioral review

- **Category ownership:** `CRAFT_FLAG_CATEGORIES`, `REGISTER_SHIFT_KINDS`, definitions, kind allowlists, speech policy, root fields and prompt paths agree. The command normalizes the setting into a new canonical array; unknown entries/duplicates are ignored, and none enabled refuses before the use case reads the document or sends anything. Settings changes during preparation/confirmation affect only the next gesture.
- **Response boundary:** a nonempty register reply requires a nonblank string even if all flags are malformed; an empty list may omit it. The digit exemption allows years but does not bypass forbidden words, imperative or quote checks: those faults precede `figure`. A withheld root line counts once, not once per finding. Per-flag why/suggestion fences, category-kind separation, clipping and ignored-field accounting remain intact; a reply's replacement never enters the annotation.
- **Call isolation:** both requests carry distinct category JSON and prompt sections, capability-free/discard policies and the approved model. Forward and reversed completion through the real manager/engine/client preserve both findings and summed usage, with no intermediate annotation publication and no retained conversations. A bad register frame, missing line, wrong kind, output ceiling or transport failure leaves the valid cliché sibling usable. Two rejected replies produce two recovery captures but only one presentation.
- **Lifetime and consent:** both categories preserve the gesture watch across initialization, pricing, confirmation, progress and prompt loading. Closing/reopening, changing text at the same version, or changing language refuses pre-call dispatch; closure during the replies shows no new flags. Approved-model changes at seven asynchronous windows, including changes to the followed Workshop model, do not redirect either call. Key retirement, cancellation, declines, errors and duplicate gestures release their watches and ownership.
- **Placement:** same-category overlaps are dropped; different categories may annotate the same words. Register lines survive source mapping and generic live issue movement. Whole-document and selected runs in Markdown/plaintext, including selections beyond the 25,000-word ceiling, retain the correct passage and offsets. Speech newly inserted while a reply is held drops both categories; protected text is not exposed through quote placement. Earlier flags outside a selection remain, while no code path in these probes calls `applyEdits`.
- **Layering and scope:** core adds no VS Code dependency, no new applier route, no live-provider test and no new recovery format. Existing architecture guards cover the category's no-write boundary. The sizeable composition-root/budget files were already above 500 lines; no new oversized feature module is introduced.

## Independent verification

Read the relevant `AGENTS.md`/`.ai/central-agent-setup.md` guidance, Draft Edit ADR and Slice 3c decisions, changed production/tests, adjacent service/host contracts and earlier review dispositions. No repository `.agents/skills` directory or dedicated review template is present; this follows the existing `docs/pr-reviews` format.

A fresh isolated cloud worktree matches the exact implementation head/tree. Retained dependency files were reused only after matching lockfile SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`; workspace aliases resolve this checkout. Checks use **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| `npm run typecheck` | Pass: core, webview and adapter |
| `npm run lint` | Pass: 0 errors / 1,133 existing warnings |
| `npm run build`, including `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full typed repository Jest (`--runInBand`) | Pass: **574 suites / 8,088 tests / 59 snapshots**, 535.878 s, exit 0 |
| `git diff --check` | Pass |
| Exact implementation-head push CI | [Success, 40450208838](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40450208838); every verify step passed |
| Exact implementation-head PR CI | [Success, 40450268149](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40450268149); every verify step passed |

Additional independent scratch probes, separate from repository test counts:

- **144** production frame/codec/message cases: every kind, missing/blank/malformed ground, empty replies, unknown fields, Unicode digits with simultaneous fence faults, clipping, fallback and category normalization.
- **77** dual-category production command → use case → manager → engine → client → actual VS Code adapter scenarios with synthetic transport: approved model, document lifetime, ordinary edits, cleanup, key changes and repeated gestures.
- **13** multi-category service/use-case cases: reversed completion, rejection isolation, single recovery presentation, usage, cancellation and prompt-preparation failures.
- **7** further real-engine concurrency/settings cases: both completion orders and five category-setting mutation windows.
- **35** production-use-case scope/placement cases: all four register kinds, both supported languages, whole/selected/over-ceiling scopes, protected/speech controls, partial replies and no-write/watch-release assertions.

These controlled probes are not native extension-host UI tests or live-model acceptance. Evidence/logs remain outside the repository at `../pr178-review-evidence/`. Only this report is published: no source/test/dependency changes, prior-report rewrites, formal GitHub review/comments, connected-Mac access, merges or provider calls by the reviewer.

## Integration and remaining acceptance

**No blocking implementation finding on `48901041`.** Check the exact report-head CI after publication; any subsequent functional changes need a delta re-review. N-01 is optional prompt cleanup, not a code-correctness hold.

Native confirmation/Problems UI and the live seeded-fixture hit/false-positive results remain unverified. The part-2 ADR explicitly makes both categories provisionally enabled; the slice document still makes a recorded fixture run the gate for shipped defaults. This review does not substitute codec/anchor tests for that quality decision or authorize paid calls. A selection read alone has only the selection's register, as the ADR acknowledges.

PR #172's narrowly accepted native Refactor Preview lifetime race remains **unchanged and not fixed**. Craft Flags has no preview/write path, and that acceptance does not waive pre-call ownership or model-consent checks.

## Author response (`e03502fb`)

**N-01 is taken.** Your text above is unchanged.

### N-01 · the worked example's period flag

You were right, and it was worse than a style point: the example taught the model a false premise. `okay` is in print by 1839 and in *Little Women* by 1868, so a Victorian narrator could use it, and the example called it a later word. It also set its period only through the register line, never in its own narration, which is exactly what the prompt's `period` rule forbids.

**The example now** (`21-register-example.md`):

- **Sets its own period.** The passage names its summer, "that golden afternoon in the summer of 1862". The register line reads "A wry, formal Victorian English of the 1860s…" (years are allowed there).
- **Calls the narration's `okay` what it is: `slang`.** It is a casual American word in formal narration. The closing note says why it is not a word out of its period.
- **Gives `period` an unmistakable case:** "on autopilot", from the aviation of a later century, in narration.
- **Keeps the controls:** the Rabbit's "okay", in its speech, is left alone.

**Tests** (`craftFlagsPrompt.test.ts`):

- the kinds in order: ornate, jargon, slang, period;
- the register line names the 1860s, and the phrasing fence finds only its years (`figure`), the one fault a register line may carry;
- the slang flag sits on the narration's `okay` and the period flag on "on autopilot";
- a new test: the passage sets its own period, and the `period` flag is read against it.

As you say, none of this measures a live false-positive rate. The fixture run still decides that.

### Verification

Node 18.20.8 on `e03502fb`:

- typecheck passes;
- Jest: 574 suites / 8,089 tests / 59 snapshots, up 1 test;
- lint: 0 errors / 1,133 warnings;
- build, with `verify:bundle`, passes.

## Re-review — 2026-10-27 (`7936977b`)

**No blocking findings; N-01 is resolved.** Reviewed implementation `7936977b62ecb5c3d216b7ab55fd66dfd424b5ed` (functional prompt correction `e03502fb04bc618ebb5f3d1b2212ab01ea562658`), tree `44280b49b451ff2a558f6397a783147e6a65d132`, against the unchanged base `f7b0c851`. The five-file delta from report `6342688e` changes the worked example, its tests and documentation only: no runtime TypeScript, manifest, policy, budget or dependency change. The original review and the author's appended response are preserved.

The narration itself now establishes **summer 1862**, the register line names the **1860s**, and the two distinctions are explicit: `okay` is an informal/slang mismatch, while `on autopilot` is the temporal example. This is a sound correction to the reported historical premise: Merriam-Webster dates the first known use of *autopilot* to 1917, after the example's stated setting. [Dictionary entry](https://www.merriam-webster.com/dictionary/autopilot). The Rabbit's own `okay` remains a negative speech control.

Independent production frame → codec → anchoring → speech → placement checks return all four intended flags, with no malformed/ignored/withheld/dropped entries. Deliberately adding the Rabbit's quoted phrase is rejected as dialogue. Three frame variants and the original 144-case independent codec matrix pass on the corrected tree. The new repository test explicitly requires the period to appear in narration, rather than only in the response's register line.

Fresh isolated Node 18.20.8 / npm 10.8.2 verification:

| Check | Result |
| --- | --- |
| Full typed Jest | Pass: **574 suites / 8,089 tests / 59 snapshots**, 523.897 s, exit 0 |
| Typecheck | Pass: core, webview and adapter |
| Lint | Pass: 0 errors / 1,133 existing warnings |
| Build and `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Diff hygiene | `git diff --check` passes |
| Exact correction-head push CI | [Success, 40453030186](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40453030186); every verify step passed |
| Exact correction-head PR CI | [Success, 40453033554](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40453033554); every verify step passed |

The earlier final report head `6342688e` also finished [push CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40451523846) and [PR CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40451528052) successfully, every verify step checked. This re-review update changes only the report; check its exact-head CI separately after publication. Native UI and live quality/ship-default acceptance remain unrun and are not inferred from the corrected example. PR #172's accepted preview limitation is unchanged.
