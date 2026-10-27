# PR Review — Draft Edit Slice 3c, part 2: register shift

**Disposition: No blocking implementation findings. One nonblocking prompt-quality note (N-01). Native VS Code and live-provider fixture acceptance remain separate and unrun.**

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
