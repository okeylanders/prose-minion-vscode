# PR Review — Workshop session recall contract, persistence, and wiring (Slice 3)

**Author:** okeylanders · **PR:** [#130](https://github.com/okeylanders/prose-minion-vscode/pull/130) (open at review)
**Branches:** `claude/workshop-recall-wiring` → `epic/workshop-session-recall`
**Verified base / merge-base:** `23b77791dcbf325daa8f62ebf5c76289058e2ac1`
**Initial reviewed code head:** `c8f75e5fb9efd33e3903590353112f6f9016549c`
**Fix re-review head:** `7deeb7b20b55e5f4836aaac01972bc4abb136fe0`
**Initial scope:** 53 files · +3,291 / −265 · 21 commits
**Fix-round scope:** 9 files · +443 / −44 · 3 commits after first report `ce2b2f5`
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review, three independent specialist passes (codec/contracts; budgets/engine/lifecycle; privacy/provenance/persistence), an independent challenge of the clamp finding, integration review, adversarial probes, and full automated verification; fix re-review with two fresh independent passes and all gates rerun

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf. The ledger records the independently verified state at `7deeb7b`; original evidence below remains pinned to `c8f75e5`.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | The bounded clamp can refuse a feasible mixed-density read and misreport the minimum | The original mixed-density/escape-heavy regressions now pass; the search preserves a measured safe fit and gives truthful minimum refusals | **Addressed**, independently verified at `7deeb7b`; fix `3f2d255` |
| F-02 | 🔵 Nit | Two collapsed-report hints from the same session of a batch cannot be followed together literally | ADR guidance now teaches consolidation; independent generated-hint replay verifies duplicate refusal and complete consolidated reports | **Addressed**, independently verified at `7deeb7b`; fix `994b234` |

**Verdict: Approved for merge into `epic/workshop-session-recall`.** F-01 and F-02 are independently verified addressed at `7deeb7b`. No additional Blocking, High, or Standard finding was established in the fix round. This approves the dormant-to-models Slice 3 integration, subject to required checks on the final branch head; Slice 4 prompting and Slice 5 live acceptance remain separate. No merge was performed as part of this review.

## Fix re-review at 7deeb7b

The three follow-up commits were reviewed against the first report commit `ce2b2f5`: **9 files, +443 / −44**. Two fresh independent passes covered the clamp search and its integration, while the original reproduction and full automated gates were rerun. The author's response is preserved below as submission history; the findings here are independently verified.

### F-01 is addressed

The search now keeps a measured fitting outcome instead of discarding it when refinement stops. [WorkshopRecallWindowClamp.ts:48–72](https://github.com/okeylanders/prose-minion-vscode/blob/7deeb7b20b55e5f4836aaac01972bc4abb136fe0/packages/core/src/application/services/workshop/recall/WorkshopRecallWindowClamp.ts#L48-L72) retains the largest tested character limit that fits; [its candidate selection at :86–115](https://github.com/okeylanders/prose-minion-vscode/blob/7deeb7b20b55e5f4836aaac01972bc4abb136fe0/packages/core/src/application/services/workshop/recall/WorkshopRecallWindowClamp.ts#L86-L115) tries the supported minimum after one unsuccessful proportional step. The bounded search is now **six renders**, explicitly recorded in the ADR; this changes the former four-render implementation choice rather than hiding unbounded retries.

The original review's unchanged regression suite now passes all **three** cases. The CJK/English sweep that formerly failed at 66K–76K free tokens produces no false minimum refusal. The escape-heavy case that also failed is repaired, and the passing mixed-markup control remains passing. In a separately built real saved-session reproduction, 60K free tokens now delivers **59,928 characters / 29,495 estimated tokens**, and 66K delivers **65,358 / 32,186**, within the respective half-windows. Across **150** CJK/English and CJK/escaped-text window cases, every returned result fit, delivered both sessions, stayed within six renders, and preserved its actual provenance.

The independent adversarial checks also exercised **19,501 discontinuous/nonmonotone synthetic cost curves**. A finite actual-renderer transition matrix covered **90 real-saved corpora, 56,949 distinct renderings, and 1,976 clamp runs** over CJK/English/XML/emoji mixes, one to three sessions, and varied entry sizes. No sampled token-cost decrease or false-minimum refusal was found. These are tested matrices, not a proof about every possible saved transcript.

The adapter returns the selected measured outcome, charges only that returned content once, and retains its corresponding manifest/provenance. [The measured refusal](https://github.com/okeylanders/prose-minion-vscode/blob/7deeb7b20b55e5f4836aaac01972bc4abb136fe0/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallCapability.ts#L298-L326) now reports the minimum's actual estimated token cost against the half-window, with a clearly approximate character equivalent. It no longer routes mere iteration exhaustion through a contradictory below-minimum explanation.

An independent **67K-free-token** witness deliberately exhausts all six renders and returns an earlier fit: the 12,000-character-limit rendering delivers **9,952 characters / 4,778 estimated tokens**, while the final attempted larger candidate misses the 33,500-token half-window by seven tokens. Both sessions retain their actual source rows and `cutTurn: 2`, with truthful truncation metadata; the next read receives the correct **140,048-character** remainder. This verifies preservation and accounting of an earlier safe fit. It also makes the quality tradeoff concrete: a slightly larger window can still produce less text when the bounded search does not discover a better fit.

This is a bounded measured search, not a proof of a globally optimal rendering or exact provider tokenization. The approval does not require every increase in window size to maximize delivered character count; it requires preserving measured feasible output, truthful minimum refusals, and the existing safety/accounting constraints.

### F-02 is addressed

The requested change was guidance and a witness, preserving the deliberate one-session-once grammar. Commit `994b234` makes that distinction explicit in the ADR and its Slice 4 instructions. The new real-output wiring test accepts consolidated same-session ranges and continues to reject a literal duplicate session. An independent replay checks both entire report bodies, full-detail metadata, and the single delivered-source row. The literal duplicate pair remains refused, exactly as the accepted grammar requires. No codec relaxation or unrelated source change was necessary.

### Verification of the fix head

Local runtime remains **Node v24.19.0 / npm 11.9.0**, using the same dependency tree; `package-lock.json` is unchanged. All checks below target **`7deeb7b20b55e5f4836aaac01972bc4abb136fe0`** before this documentation-only update.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **265 suites / 3,487 tests / 2 snapshots passed**, 69.221 seconds |
| `npm run typecheck` | Core, webview, extension passed |
| ESLint over all six changed TypeScript files in the fix round | **0 errors / 0 warnings** |
| Full repository ESLint, excluding independent probes | **0 errors / 1,085 warnings**, unchanged from the initial review head |
| `npm run build`, including `verify:bundle` | Passed; same three webpack size/performance warnings |
| `git diff --check ce2b2f5...7deeb7b` | Passed |
| Original review regression suite, unchanged | **3/3 passed**; formerly two failures and one passing control |
| Independent clamp re-review | **6/6 passed**, including 150 real-window cases, 19,501 synthetic cost curves, and the 56,949-rendering / 1,976-clamp-run transition matrix |
| Independent integration/hint re-review | **12/12 passed**; existing capability/wiring suites also **44/44 passed** |
| GitHub CI on the reviewed fix head | **Success**, [run 37477905268](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37477905268) |

No implementation fixes or tests are included in this report update. Review probes remain outside the published diff. The prior limitations remain: no local Node 18/22 rerun, live Extension Development Host, or paid/live model acceptance. Slice 4 prompting and Slice 5 live verification are still outside this review. Final report-head CI is checked separately after publication.

## Author response (`3f2d255`, `994b234`)

The following was the author's submission for re-review. The independent verification and current verdict are recorded above; this response is preserved as history.

**F-01 ([`3f2d255`](https://github.com/okeylanders/prose-minion-vscode/commit/3f2d255)).** Running out of renders no longer refuses a read that fits.

- The search moved to a pure module, `WorkshopRecallWindowClamp`, and keeps the largest read it measured to fit. The four-render bound became six:
  1. the first guess;
  2. one proportional step;
  3. if the step misses, the minimum, which settles whether any read fits;
  4. then interpolation between the largest fit and the smallest miss by their measured costs, stopping once a fit uses 98% of half the window.
- The search stops early when the first guess fits, or when a fit is close enough. It never refuses a fit it measured.
- **Refusal.** Only a minimum that measures over half the window is refused now, as you suggested. The copy says so in numbers: about how many characters of these sessions half the window holds, and what the minimum read measured against it. Metadata adds `minimumTokens` and `halfWindowTokens`. The refusal before reading (a first guess already below the minimum) is unchanged.
- **Witnesses:**
  - **Your reproduction.** A saved Chinese session and an English session, read together at turn 2 in full detail. The 66,000-token window now succeeds, fits, and delivers at least what the 60,000-token control did.
  - **Sweeps** from 20,000 to 80,000 free tokens in steps of 4,000, beside English and beside escape-heavy text. Every read succeeds, fits half the window, and delivers turns from both sessions. Before the fix the English sweep failed at 68,000.
  - **Synthetic cost curves.** Even density takes two renders. A dense section kept whole still fits. Across 2,000 random curves with a density change and a fixed overhead, the search never exceeds six renders, delivers a fit exactly when the minimum fits, and delivers the largest fit it measured.
  - **The measured refusal**, its numbers and its copy, with real saved CJK text.
- **Mutation check.** Each of these reversions fails at least one witness: no minimum fallback, keeping the first fit, no room tolerance, and proportional steps only.
- The sub-adapter returns to 474 lines.

**F-02 ([`994b234`](https://github.com/okeylanders/prose-minion-vscode/commit/994b234)).** The rule stays: one call names a session once.

- **The witness.** It takes the first two stock-session hints from a real batch's rendered evidence. Written side by side, they are refused as `duplicate-session`. Combined into `<session turns="5, 8">…</session> <detail>full</detail>`, they read both reports in full.
- **The guidance.** The ADR's Slice 3 note now qualifies "several at once, as written" to hints that name different sessions. It tells Slice 4's grammar doc to teach combining the ranges of hints that name the same one.

**Verification at `994b234`:**

- Full suite on Node 22.22.0 and Node 18.20.8: **265 suites / 3,487 tests**. The reviewed head had 264 / 3,478; the difference is the new clamp suite and the witnesses above.
- `npm run typecheck`, `npm run build` (including `verify:bundle`), and `git diff --check` are all clean.
- ESLint over the changed TypeScript files: 0 errors, and no file gains a warning against the epic base.

## Original F-01 — Retain a feasible read when proportional clamp refinement exhausts its attempts

**Evidence:** [WorkshopTranscriptRecallCapability.ts:179–194](https://github.com/okeylanders/prose-minion-vscode/blob/c8f75e5fb9efd33e3903590353112f6f9016549c/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallCapability.ts#L179-L194), [the refusal at :280–290](https://github.com/okeylanders/prose-minion-vscode/blob/c8f75e5fb9efd33e3903590353112f6f9016549c/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallCapability.ts#L280-L290). **Confidence: High.**

The refinement computes a new character limit from the ratio of the allowed tokens to the previous rendering's tokens. With sessions of different token density, fair-share allocation changes that ratio as the limit shrinks: one dense section can stay complete while the other section gives up text. Four proportional iterations do not establish that no supported rendering fits.

Nevertheless, reaching `CLAMP_ATTEMPTS` takes the same `tooSmall` path as an actual limit below `workshopRecallMinimumReadCharacters(n)`. The candidate computed on the fourth attempt is not rendered. The call returns no transcript evidence, spends a read attempt because the service already ran, and can claim that more than the minimum is too little.

Independently reproduced without editing persisted data or production budgets:

1. Save two open-scope sessions through the real aggregate, coordinator, and store. The first contains 33,000 characters of ordinary Chinese prose; the second repeats an ordinary English lighthouse paragraph 1,400 times. Each has a short reply. Begin a separate live room, leaving both saved sessions recallable.
2. Request full-detail turn 2 from both sessions in one valid `transcript.read`.
3. With a coherent 200,000-token context window leaving **60,000** free input tokens, the adapter succeeds. It delivers **59,649 characters**, with a **61,706-character** render limit and **29,359** estimated escaped body-plus-metadata tokens, below the allowed half-window of 30,000.
4. Repeat the identical read with **66,000** free input tokens. It returns `status: rejected`, `rejectionReason: recall-context-window`, `charactersLeft: 66896`, and `minimumCharacters: 12000`. Its message says the read needs at least 12,000 characters, “but only 66,896 are left.” The previously successful rendering costs 29,359 tokens and would fit the now larger 33,000-token half-window.
5. The natural-prose sweep reproduces the false refusal from 66K through 76K free tokens. A separate XML-heavy example also reproduces it; a sampled mixed-markup case passes, so this is not a claim that every multilingual or escaped read fails.

The windows are internally consistent: `contextLength = 200000`, `outputTokens = 20000`, `headroomTokens = 10000`, and `requestTokens = 170000 − freeInputTokens`. Every service read and render uses the actual saved data and the production estimator.

**Independent challenge:** a second reproduction constructed the window using `measureContextWindow` itself. Its four renders cost **49,144 → 37,858 → 34,693 → 33,433 tokens** against a 33,000-token half-window. The adapter then computed **66,908 characters** and refused without rendering that candidate. Rendering it delivered both sessions fairly (**32,431 / 32,424 characters**) at **31,937 tokens**, and the subsequent request passed `assertRequestFitsContext`. A minimum-budget rendering delivered both sessions at just **4,738 tokens**. The small numerical difference from the first fixture comes from its independently constructed labels/IDs.

**Recommended correction:** keep the documented four-render bound, but establish a feasible fallback before reporting the minimum refusal. For example, reserve the final permitted render for the supported per-session minimum, or use a bounded search retaining a measured safe candidate. Do not interpret iteration exhaustion as proof that the minimum cannot fit. If exhaustion is intentionally a separate refusal policy, give it truthful metadata/copy and an explicit policy decision instead of the below-minimum explanation.

**Regression:** use heterogeneous CJK/English and escape-heavy sessions, retain the successful smaller-window control, and assert that a known feasible supported rendering is not lost merely because the initial window is larger. Preserve the half-window measurement, minimum-per-session guarantee, total character budget, per-turn read ceiling, and actual-render provenance. This finding is a false refusal, not an output-budget or privacy escape.

## Original F-02 — Teach consolidation for several hints from one session of a batch

**Evidence:** [WorkshopRecallReadWindow.ts:249–267](https://github.com/okeylanders/prose-minion-vscode/blob/c8f75e5fb9efd33e3903590353112f6f9016549c/packages/core/src/application/services/workshop/recall/WorkshopRecallReadWindow.ts#L249-L267), [WorkshopTranscriptRecallXmlCodec.ts:145–153](https://github.com/okeylanders/prose-minion-vscode/blob/c8f75e5fb9efd33e3903590353112f6f9016549c/packages/core/src/application/services/workshop/WorkshopTranscriptRecallXmlCodec.ts#L145-L153). **Confidence: High; priority: Low.**

A discussion read of the real `saveExcerptCorpus()` stock and cliché sessions emits a self-addressed hint for every collapsed report. Taking the first two stock-session hints literally gives:

```xml
<session turns="5">stock-2</session> <detail>full</detail>
<session turns="8">stock-2</session> <detail>full</detail>
```

Putting these fragments together in one `transcript.read` is refused as `duplicate-session`. Equal repeated detail is accepted as intended; the repeated session is the problem. The existing followed-together witnesses cover one hint from each of two sessions and two bare `<turns>` fragments from a one-session read, but miss two hints from the same section of a multi-session read.

**Successful control:** `<session turns="5, 8">stock-2</session><detail>full</detail>` returns both complete reports in **32,069 characters**.

**Suggested improvement:** preserve the accepted distinct-session rule and teach callers to combine ranges when several hints name the same session. Add this generated-output composition witness and qualify the broad “several at once, as written” guidance before Slice 4 copies it into the grammar. Changing duplicate-session policy is not necessary to address the nit.

**Why nonblocking:** the codec deliberately rejects duplicates, each individual hint is valid, and a valid consolidated request works. This is a guidance gap with a straightforward transformation, not lost source data or a bad accepted request.

## Review observations and strengths to preserve

- **Closed grammar and extraction parity.** Four transcript operations join the explicit operation/family lists. Unknown operations remain rejected. Independent adversarial checks cover malformed numbers, unsafe session IDs, range caps, every persona display label, repeated-detail normalization, and sibling-range limits. Comparing `inspect` and `stripToolCalls` with the base parser across **3,888 decorated/malformed legacy-call vectors** found no existing-family grammar regression.
- **The repeated-detail decision is reasonable.** Case-normalized copies that agree preserve the renderer's intended mode; conflicting copies fail explicitly instead of silently choosing one. Repeated sibling `<turns>` stays tied to exactly one bare session and obeys the aggregate range limit. F-02 is a separate same-session hint issue.
- **Engine-owned context measurement is the right seam.** The engine sees retained history, pending rounds, the call itself, the evidence message/frame, output reservation, tools, and preflight headroom. Other capabilities can ignore the optional window. The actual content and escaped metadata are measured after rendering, and the normal dense-text path does re-render rather than relying only on four characters per token. F-01 is the termination/fallback error in this otherwise sound approach.
- **Per-turn state has an appropriate owner.** The persona factory creates a sub-adapter per host/guest turn; the engine fulfills calls serially. Direct concurrent calls to one adapter are not an established production path and were not promoted into a speculative race finding. Read attempts are charged only after admission to the service, and rendered characters are charged after successful fitting.
- **Privacy remains projection-owned.** The runtime consumes the recall service's explicit visible document, not session checkpoints or provider archives. Existing hidden-body sentinels now pass through full capability evidence. Independent hostile XML in saved text/title stays escaped and inert through the evidence and published catch-up paths.
- **Provenance follows actual rendering.** Read rows correspond to sessions that delivered visible turns; unknown and empty-visible sessions add no misleading row. Metadata preserves requested order and the actual delivered range IDs, continuation, collapsed count, and truncation. To-do rows cover shown pairs. Discovery and failed calls do not become published evidence.
- **Persistence widens together.** Operation/artifact/kind lists flow into the existing validators. The real engine/completion/coordinator/store witness saves and reopens a host using all four operations and a guest read, importing both retained conversations and their transcript rows. Unknown future-family guards remain. The lack of a schema-version bump follows the accepted additive-enum policy.
- **Composition stays at the root.** Store → coordinator → shared recall service → per-turn factory → tool side pass; no new route or handler-owned service construction. Every new production module stays below 500 lines and joins the relevant architecture guards. The larger persona class remains a documented existing owner with delegation branches rather than embedded recall implementation.
- **The preceding core follow-ups remain contained.** Outcome association now uses explicit request positions; the cache check removed from the loader was redundant with the immediately preceding lookup; empty render requests are refused; need measurement no longer packs an entire oversized transcript just to allocate a bounded window.

## Accepted limitations and slice boundary

1. **Dormant to models is accurate, not an access-control guarantee.** The codec and runtime can execute a valid call, but this diff adds no transcript grammar or advertisement to the model prompts. Slice 4 still owns prompting, architecture/agent-guide updates, and prompt-budget sync; Slice 5 owns live acceptance and tuning.
2. **The clamp uses the existing estimator and live cached model metadata.** It is not a tokenizer or provider guarantee. Unknown model context length retains the ordinary character budgets. Discovery/to-do calls are not newly window-clamped here; ordinary request preflight still applies. The finding does not assume a new clamp for unrelated families.
3. **Publication remains explicit room policy.** Successful/partial reads and to-dos become room-visible when the invoker's final reply commits. Catalog/search remain private. Private-instrument transcript visibility is the accepted export/recall policy, not a newly inferred permission.
4. **Inherited store limitations remain inherited.** The legacy listing path, cold-read byte-charge model, and store diagnostics were not redesigned. A malformed saved-file parse can log an inherited diagnostic internally; the new evidence path does not expose that error text. The explicit search-query log is not a transcript-body logging regression.
5. **No live host-lifecycle acceptance is claimed.** The ADR explains the first-folder extension-host restart behavior for the prior scope residual. This review did not run an Extension Development Host or simulate a real VS Code restart. Automated scope/cancellation coverage and current code inspection are not substituted for that live check.

## Initial-review verification actually run

All code checks target **`c8f75e5fb9efd33e3903590353112f6f9016549c`**, before this report-only commit. Local runtime: **Node v24.19.0 / npm 11.9.0**. Dependencies were copied from a prior isolated cloud checkout only after a byte-identical `package-lock.json` comparison. No fresh local `npm ci`, Node 18 run, or Node 22 run is claimed.

| Check | Result |
| --- | --- |
| Live PR metadata, remote refs, local merge-base, and changed-file list | Base/head matched; PR open, non-draft, mergeable, targeting the epic branch |
| PR discussion/reviews at review start | No comments or reviews returned |
| `npm test -- --runInBand` | **264 suites / 3,478 tests / 2 snapshots passed**, 99.115 seconds |
| `npm run typecheck` | Core, webview, and extension passed |
| ESLint over all 49 changed TypeScript files | **0 errors / 59 warnings** |
| Full repository ESLint, excluding independent probes | **0 errors / 1,085 warnings**, versus independently rerun base **0 / 1,097**; no file's warning count increased |
| `npm run build` | Both production bundles and `verify:bundle` passed; three webpack size/performance warnings, 1.24 MiB webview bundle |
| `git diff --check 23b77791...c8f75e5` | Passed |
| Independent codec/hint probes | **76 tests passed**, including 3,888 base/head extraction comparisons and the F-02 consolidated control |
| Independent privacy/persistence probes | **5 passed**, covering hostile XML, mixed outcomes/rows, publication privacy, malformed-file diagnostics, and 18 base/head section-sizing comparisons; 5 focused existing suites / 60 tests also passed |
| Independent clamp/lifecycle probes | Retained-history/accounting probe passed; mixed-markup sweep passed; **two regression probes failed as expected**, reproducing F-01 with CJK/English and escape-heavy batches |
| Independent clamp challenge | **1 passed**, using `measureContextWindow`, actual fair rendering of the discarded candidate/minimum, and subsequent preflight acceptance |
| Consolidated rerun of independent passing probes | **5 suites / 83 tests passed**; separately reran the clamp regression sweep: **2 reproduced failures / 1 passed** |
| GitHub CI for reviewed code head | **Success**, [run 37470036330](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37470036330), `verify`: `npm ci`, typecheck, tests, lint, build all succeeded under the workflow's Node 18 configuration |

Probe assertions characterizing a defect passing are not claims it is fixed. Independent `.probe.ts` files are excluded from the default suite/lint and are not published. No implementation or repository test changes are part of this review. No live VS Code Extension Development Host, paid provider call, or live persona pass was performed. The author's mutation-check and separate local Node 18/22 claims were not independently replayed.

The only intended publication is this review document. Its commit creates a new PR head; CI for that exact documentation head must be checked after publication. No merge, close, branch deletion, or implementation fix is part of this review.
