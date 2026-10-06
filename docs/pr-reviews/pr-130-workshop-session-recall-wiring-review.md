# PR Review — Workshop session recall contract, persistence, and wiring (Slice 3)

**Author:** okeylanders · **PR:** [#130](https://github.com/okeylanders/prose-minion-vscode/pull/130) (open at review)
**Branches:** `claude/workshop-recall-wiring` → `epic/workshop-session-recall`
**Verified base / merge-base:** `23b77791dcbf325daa8f62ebf5c76289058e2ac1`
**Reviewed head:** `c8f75e5fb9efd33e3903590353112f6f9016549c`
**Scope:** 53 files · +3,291 / −265 · 21 commits
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review, three independent specialist passes (codec/contracts; budgets/engine/lifecycle; privacy/provenance/persistence), an independent challenge of the clamp finding, integration review, adversarial probes, and full automated verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟡 Standard | The bounded clamp can refuse a feasible mixed-density read and misreport the minimum | A real CJK/English batch succeeds with 60K free tokens but is refused with 66K; the refusal reports 66,896 characters left against a 12,000-character minimum | **Open**, recommended before integration |
| F-02 | 🔵 Nit | Two collapsed-report hints from the same session of a batch cannot be followed together literally | The two emitted session fragments get `duplicate-session`; consolidating their ranges returns both reports | **Open**, nonblocking guidance/test improvement |

**Verdict: Request changes for F-01.** The ordinary mixed-density read has a legal smaller rendering but the clamp discards it after its iteration limit. No Blocking or High finding was established. F-02 concerns generated guidance, not the deliberate duplicate-session validation rule. This review covers Slice 3's dormant-to-models runtime, not Slice 4 prompting or live persona acceptance, and does not authorize a merge.

## F-01 — Retain a feasible read when proportional clamp refinement exhausts its attempts

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

## F-02 — Teach consolidation for several hints from one session of a batch

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

## Verification actually run

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
