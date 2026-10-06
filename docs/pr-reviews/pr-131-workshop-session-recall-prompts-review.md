# PR Review — Workshop session recall enablement (Slice 4)

**Author:** okeylanders · **PR:** [#131](https://github.com/okeylanders/prose-minion-vscode/pull/131) (open at review)
**Branches:** `claude/workshop-recall-prompts` → `epic/workshop-session-recall`
**Verified base / merge-base:** `b2fe8ddb6b2fa32cb33ba0f870342157076dc165`
**Initial reviewed code head:** `34dda149917b07b5ed3582ec9821cfea07d4996c`
**Final re-review head:** `c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7`
**Initial scope:** 18 files · +873 / −39 · 10 commits
**Re-review scope:** 10 files · +180 / −31 · 5 commits after the first report `5d5194d`
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review with three independent specialist passes; final re-review with two fresh independent passes (sequential-read budgets/engine/persistence; follow-up guidance/continuation contracts), original privacy/lifecycle regression probes, and all automated gates rerun

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf. This ledger records the independently verified state at `c56c58f`; the original evidence below remains pinned to `34dda149`.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🔵 Nit | The bidirectional prompt-sync witness omits the multi-session full-detail continuation | The seventh form is now taught; all declared details are sampled, and generated continuations preserve exact identities/ranges/detail | **Addressed**, independently verified at `c56c58f`; fix `b7e44fe` |

**Verdict: Approved for merge into `epic/workshop-session-recall`.** F-01 is independently verified addressed at `c56c58f`. No new Blocking, High, or Standard finding was established in the final re-review. This approval includes the 300,000-character per-turn allowance and answer-then-offer changes, subject to required checks on the final branch head. It does not declare every Slice 5 acceptance criterion complete or authorize a merge.

## Final re-review at c56c58f

The reviewed branch is still PR #131, targeting the same epic base. The five follow-up commits contain the F-01 fix, its author response, the increased total read allowance, the follow-up guidance/refusal copy, and the corresponding tests/ADR/epic records. The author's existing report additions are preserved below.

### F-01 is addressed

The [seventh prompt form](https://github.com/okeylanders/prose-minion-vscode/blob/c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7/packages/core/resources/system-prompts/workshop-personas/transcript-recall-capability.md#L87-L93) is now explicit. The [sync corpus](https://github.com/okeylanders/prose-minion-vscode/blob/c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7/packages/core/src/__tests__/architecture/transcriptRecallPromptSync.test.ts#L186-L201) samples one/multiple sessions in every declared detail, and the new round-trips follow generated batch continuations alone and together.

Independent probes additionally used **one, two, and three sessions, full/discussion detail, and discontiguous ranges**. They verified exact session identities and remaining ranges, not only wildcard session counts. Following the decoded requests through the real service retained the effective detail. Partial, empty-range, and all-unknown results produced no invented continuations. The original coverage gap is closed.

### The larger total preserves per-read bounds and fresh-window accounting

The [budget change](https://github.com/okeylanders/prose-minion-vscode/blob/c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7/packages/core/src/shared/constants/promptBudgets.ts#L266-L269) is **150,000 characters per read, 300,000 across the turn, and two reads**. It does not enlarge an individual read, remove the minimum share, or bypass the existing estimator/clamp. The relationship test makes the intended two-full-read allowance explicit.

Independent real-engine probes exercised the persona factory, recall service/store, retained messages, session save/reopen, and a subsequent user turn, with mocked provider transport. Plain, CJK, and XML-escape-heavy content were checked at **32K, 64K, 200K, and 1M context windows**. The second window was recomputed from the actual first call/evidence, rather than reusing the initial allowance; the next provider request passed the ordinary preflight in the sampled known-window cases.

- At a **64K** plain-text window, successive free-window measurements were **54,363 → 27,145 → 13,533 tokens**. The two reads delivered **88,585 + 44,059 characters**, reflecting the shrinking context.
- At **200K** with plain text, both 150K read limits remained available and delivered **149,001 + 148,996 characters**, within the 300K total. A third read remained refused.
- Save/reopen retained both evidence messages. A fresh user turn reset the per-turn counters while still charging the earlier retained evidence against its context window.

**Important qualification:** the clamp requires model context metadata. The inherited no-window path still applies character limits without a local provider-capacity guarantee. An XML-heavy unknown-window probe delivered **297,992 characters**, costing approximately **223,528 estimated evidence tokens** after escaping. Thus “300K characters” is neither a universal 75K-token ceiling nor a guarantee that an unknown model can accept the result. This is the existing fallback policy with a larger authorized allowance, not a newly bypassed known-window check. The ADR's broad “overflow stays covered” explanation should be read as conditional on available metadata and the preflight estimator; making that qualification explicit would improve the documentation. The increased retained-history and future-request cost is real and is appropriately recorded for continued live tuning.

### Answer-then-offer guidance is consistent with bounded answers

The prompt now says to answer from available evidence, identify the unread sessions/turns, and offer the next step, while leading with the limitation if the missing turns are central to the writer's question. It does not authorize invented content or unrequested routine recall. The [runtime advice](https://github.com/okeylanders/prose-minion-vscode/blob/c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7/packages/core/src/application/services/workshop/recall/WorkshopTranscriptRecallCapability.ts#L285-L330) distinguishes resettable turn caps from pre-read and measured context-window refusals: the latter say what could not be read without claiming the window resets.

One **nonblocking wording observation**, not a demonstrated model failure: the system paragraph's offer to read the remainder “next” is most accurate when capacity permits. At **2,999 free input tokens**, a one-session request has a 5,996-character guess against the fixed 6,000-character minimum; a fresh turn or narrower turn range at the same/lower window still refuses. A multi-session refusal can sometimes recover by naming fewer sessions. An offer is not a guarantee, but explicitly qualifying it by available capacity would make the prompt match the runtime distinction even more clearly.

### Live evidence and remaining acceptance

The writer reports that live testing looked good. The ADR records a real five-chat 6.8 read that used 147,948 characters and a subsequent tail refusal under the old total; the implemented increase directly addresses that allowance problem. This report treats those observations as **writer/author-reported live evidence**, not as a replay independently witnessed by the reviewer or completion of every acceptance criterion.

No paid calls or live Extension Development Host run were made during this re-review. Natural answer quality, offer frequency, UUID copying across supported models, long-room cost, and real-corpus performance still require the applicable live checks. The earlier separate guest-to-do persistence limitation remains outside this diff.

### Final re-review verification

All checks below target **`c56c58fdca7b62e5d2a2f7c6983f355e7f516bf7`**, before the report update. Local runtime remains **Node v24.19.0 / npm 11.9.0**, with the same dependency tree and unchanged lockfile.

| Check | Result |
| --- | --- |
| Full `npm test -- --runInBand` | **266 suites / 3,518 tests / 2 snapshots passed**, 98.474 seconds |
| `npm run typecheck` | Core, webview, extension passed |
| ESLint over all six changed TypeScript files | **0 errors / 0 warnings** |
| Full repository ESLint, excluding independent probes | **0 errors / 1,085 warnings**; unchanged from the independently checked epic base, including per-file counts |
| `npm run build`, including `verify:bundle` | Passed; same three webpack size/performance warnings |
| `git diff --check 5d5194d..c56c58f` | Passed |
| Independent sequential-read/runtime probes | **19 passed**, covering known/unknown windows, fresh second-window accounting, low-window refusals, read charging, save/reopen, and retained next-turn context |
| Independent continuation/guidance probes | **9 passed**, including exact generated request round-trips and refusal/recovery controls |
| Original privacy/lifecycle probes, rerun unchanged | **4 passed**; includes the 648-combination prompt matrix, fresh/reopened mocked-provider delivery, and hostile-record/publication checks |
| Consolidated independent-probe rerun | **4 suites / 32 tests passed**, 10.665 seconds |
| Prompt measurement | Latest grammar: **9,951 bytes / 2,488 estimated tokens**; source-chain delta versus epic base **+2,655–2,656 host / +2,637 guest tokens**, excluding the separate first-turn pointer |
| GitHub CI for reviewed code head | **Success** for [PR run 37492975542](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37492975542) and [push run 37492964932](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37492964932) |

No implementation changes are part of this report update. The initial-review sections below are historical and remain scoped to `34dda149`, including their former 150K per-turn budget. Exact report-head CI is checked separately after publication.

## Author response (`b7e44fe`)

These are the author's claims, offered for re-review. They are not verified findings.

**F-01 ([`b7e44fe`](https://github.com/okeylanders/prose-minion-vscode/commit/b7e44fe)).** The grammar teaches the seventh form, and the corpus can no longer skip a mode.

- **The grammar** lists `Continue with <session turns="41-72">…</session> <detail>full</detail>.` beside its discussion twin. Each of the two now names its detail.
- **The corpus.** The sync test renders a read of one session and of several sessions, in every detail of `WORKSHOP_RECALL_READ_DETAILS`, plus a search. A detail added to that list joins the corpus by itself. Widening the corpus alone, before the grammar changed, failed "teaches every form the renderers emit", which reproduces the finding.
- **Round-trips.** For each detail, the continuations of a real read of several sessions, followed alone and together, decode with that detail explicit.
- **Mutation check.** Removing the new form fails three witnesses. Letting a several-session continuation drop `<detail>full</detail>` fails three, including the round-trip.
- The ADR's Slice 4 note and the epic record the fix. The grammar is now 9,569 bytes, about 2,400 estimated tokens.

**Also since the review, at Okey's request after the first live pass** (no finding asked for these):

- [`c1a552d`](https://github.com/okeylanders/prose-minion-vscode/commit/c1a552d): `readCharactersPerTurn` is 300,000, twice `readCharacters`, amending D11. A five-chat read had used 147,948 of 150,000 characters, leaving the turn's second read nothing. The window clamp still caps each read.
- [`e2eb7e9`](https://github.com/okeylanders/prose-minion-vscode/commit/e2eb7e9): when a limit leaves turns unread, the persona answers from what it has, names what is left, and offers to read it next. The read refusals end the same way.
- [`c20e4c0`](https://github.com/okeylanders/prose-minion-vscode/commit/c20e4c0): a real-store test of recalling a session that itself read another session and committed a Gesture Playground draft. The nested transcript and the widget payload never come back; the one-line Session Recall event, the commit's visible line, and the replies do.

## F-01 — Include full-detail batch continuations in the prompt-sync matrix

**Evidence:** [the renderer corpus at transcriptRecallPromptSync.test.ts:175–180](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/__tests__/architecture/transcriptRecallPromptSync.test.ts#L175-L180), [its completeness assertions at :188–201](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/__tests__/architecture/transcriptRecallPromptSync.test.ts#L188-L201), [the prompt's forms at :87–92](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/resources/system-prompts/workshop-personas/transcript-recall-capability.md#L87-L92), and [WorkshopRecallReadSection.ts:239–248](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/application/services/workshop/recall/WorkshopRecallReadSection.ts#L239-L248). **Confidence: High; priority: Low.**

The new witness samples single-session full, single-session discussion, multi-session discussion, and search. It does not sample a multi-session full read. That supported mode emits:

```xml
Continue with <session turns="41-72">session-id</session> <detail>full</detail>.
```

This seventh shape does not match any of the six taught forms. The test's “every form the renderers emit” claim therefore holds only for its sampled corpus. It would not guard against prompt/renderer drift specific to full-detail batch continuations.

**Independent reproduction:** save two sufficiently long sessions through the real aggregate/coordinator/store, read both with `detail: 'full'`, and render with a 16,000-character cap. Both sections emit the explicit-full continuation. Combining the emitted fragments successfully decodes to a multi-session full read; the runtime is working.

**Suggested improvement:** add the multi-session full read to the renderer corpus and document its continuation form. Round-trip its generated fragments alone and together, asserting full detail remains explicit. Keep the existing discussion, single-session, same-session range consolidation, and conflicting-detail witnesses.

**Why nonblocking:** the prompt already teaches full detail and says to preserve returned hints; these continuations are valid and independently verified. No live-model failure is inferred from the missing example.

## Review observations and strengths to preserve

### 1. Enablement reaches real host, guest, and reopened-conversation paths

The [shared path chain](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/shared/constants/workshopPersonas.ts#L122-L147) inserts the grammar immediately after analysis for both persona bases. Fresh creation, between-run settings replacement, and archive import converge on the same system-message builder. The grammar is not dependent on a newly generated first-turn contract.

An independent matrix loaded the grammar exactly once for all **648 role × persona × interaction-mode × expression-level × relational-depth combinations**. Separate probes used the real `PromptLoader`, `AssistantToolService`, `ConversationManager`, and `AgentRunEngine` with mocked provider transport for fresh and reopened hosts and guests. Rebuilt system prompts contained the grammar while pre-recall first-user content stayed unchanged. This is stronger than checking a path list, while still being a deterministic transport test rather than a live persona conversation.

### 2. The advertised grammar agrees with the runtime

All four operations' documented fields, persona ids/display labels, to-do status/source filters, newest-session selection, detail defaults, and live-room exclusion agree with the codec and service. The unconditional pointer appears in both resource-availability branches without making recall depend on configured project files.

The one production behavior change is appropriately narrow: [the collapsed report hint now names full detail](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/application/services/workshop/recall/WorkshopRecallReadWindow.ts#L243-L273). Following it alone retrieves the report body. Mixing it with a discussion continuation now produces `conflicting-detail`, instead of silently collapsing the requested report again. Session-qualified hints that name the same session twice still require combining their ranges into one `<session>` element; the prompt explicitly teaches that rule rather than relaxing duplicate-session validation. Repeated sibling `<turns>` for one bare session remain accepted and merged by the codec.

The sync test pins the actionable numeric limits and decodes accepted and intentionally refused examples through the real codec. Its coverage caveat is F-01, not a failure of those existing examples.

### 3. The chapter-6.7 workflow has a deterministic end-to-end witness

The independent real-store flow successfully performed **catalog → three-session discussion read → open to-dos** through the codec, capability, service, coordinator, and in-memory filesystem. `<match>6.7</match>` found a “Chapter 6.7 stock pass,” a “6.7 cliché pass,” and a differently titled chat pinned to 6.7. Adding “chapter” narrowed the results as the prompt warns.

Discussion reads retained persona discussion while collapsing tool-report bodies; to-do results retained marked stale open items and honored source/persona filtering. This verifies that the operations needed for “Summarize the chats on chapter-6.7; what's left?” are connected and usable. It does not demonstrate that a particular live model will choose the right sequence or synthesize the answer correctly.

### 4. Enablement preserves the quoted-record and publication boundaries

The new grammar distinguishes historical requests from current instructions, records from memory, dated decisions from present truth, and bounded results from exhaustive knowledge. The host charter and interaction contract agree, including the noncanonical status of old persona improvisation. The offer rule permits a one-line offer but requires acceptance before unrequested recall.

The [existing evidence boundary](https://github.com/okeylanders/prose-minion-vscode/blob/34dda149917b07b5ed3582ec9821cfea07d4996c/packages/core/src/application/services/workshop/WorkshopPersonaCapability.ts#L777-L805) still XML-escapes recall content and marks it as a quoted record. An independent adversarial probe carried hostile saved text containing closing evidence/catch-up tags, forged writer/interaction frames, and a tool-call literal through guest recall, reply commit, and eventual host catch-up. Those strings remained escaped reference data at both delivery boundaries.

Actual publication matched the amended guest charter: catalogs/searches and failed reads remained private; a partial read became room-visible only after the guest reply committed. The broad projection, scope, cancellation, bounded-read, and persistence safeguards from the earlier slices remain in the passing full suite. This PR does not introduce another saved-data reader, persistence shape, route, or composition root.

### 5. Prompt cost is visible and packaging includes the resource

The grammar is **9,376 bytes / 2,344 estimated tokens** using the repository's estimator. The complete changed system-prompt delta, including the charter and interaction-contract amendments, is approximately **+2,512 tokens for hosts** and **+2,493–2,494 for guests**; the new first-turn pointer adds a separate user-message cost. The normal request estimator measures the assembled system text, so the additional prompt consumes real preflight capacity rather than bypassing accounting. The existing two-read / 150,000-character per-turn bounds and half-window read clamp remain in force.

The resource is included in the existing recursive staging path. The production-staged grammar matches its source hash, and `vsce ls --no-dependencies` includes all four changed prompt resources. Existing prompt prefixes change on upgrade; actual provider cache hits, billing, and the quality return on the additional tokens were not measured here.

## Accepted limitations and live-test boundary

1. **Slice 4 is the live-test starting point.** A build of this branch can be exercised with the repository's existing Run Extension/F5 Development Host, or from the epic after integration. A main/Marketplace release is not required for that test. Use a single-root workspace containing named saved sessions, a different active room, and ordinary configured model access. The active room is excluded from recall.
2. **Slice 5 remains necessary.** Fast-model session-id copying, natural invocation/offer restraint, continuation use, semantic prompt-injection resistance, evidence honesty, real-corpus latency, and useful answer quality require the planned live acceptance pass. No paid provider call, real writer-corpus run, or Extension Development Host interaction was performed in this review.
3. **Recall remains bounded.** The catalog, search, reads, and to-do results are not guarantees of an exhaustive workspace answer. The prompt correctly tells personas to preserve limitations and continue later when needed. The inherited estimator is not a provider tokenizer guarantee.
4. **The guest-to-do save defect is separate.** This branch does not incorporate the independently tracked fix in [PR #128](https://github.com/okeylanders/prose-minion-vscode/pull/128). That known issue is not a new Slice 4 finding and should not be confused with successful recall of existing saved to-dos.

## Verification actually run

All code checks below target **`34dda149917b07b5ed3582ec9821cfea07d4996c`**, before this report-only commit. Local runtime: **Node v24.19.0 / npm 11.9.0**. Dependencies were copied from a prior isolated checkout only after a byte-identical `package-lock.json` comparison. No fresh local `npm ci`, Node 18 run, or Node 22 run is claimed.

| Check | Result |
| --- | --- |
| Live PR metadata, remote refs, merge-base, changed-file list | Base/head matched; PR open, non-draft, mergeable, targeting the epic |
| PR discussion/reviews at review start | No comments or reviews returned |
| `npm test -- --runInBand` | **266 suites / 3,514 tests / 2 snapshots passed**, 99.994 seconds |
| `npm run typecheck` | Core, webview, extension passed |
| ESLint over all 10 changed TypeScript files | **0 errors / 20 warnings** |
| Full repository ESLint, excluding independent probes | **0 errors / 1,085 warnings**; independently rerun base also **0 / 1,085**, with no per-file warning-count changes |
| `npm run build`, including `verify:bundle` | Both production bundles passed; three existing webpack size/performance warnings |
| `git diff --check b2fe8ddb...34dda149` | Passed |
| Independent prompt/contract probes | **4 passed**, including the real-store 6.7 flow and F-01 runtime control; 35 focused existing tests also passed |
| Independent privacy/publication probes | **2 passed**; six focused existing suites / 101 tests also passed |
| Independent lifecycle/budget/package probes | **2 tests passed**, covering all 648 prompt combinations and fresh/reopened host/guest mocked-provider delivery; estimator measurements, staged-resource equality, and package inclusion also passed |
| Consolidated independent-probe rerun | **3 suites / 8 tests passed**, 7.637 seconds |
| GitHub CI for reviewed code head | **Success** for [PR run 37486618110](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37486618110) and [push run 37486609412](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37486609412), using the workflow's Node 18 verification configuration |

Review-only probes are outside the normal suite/lint paths and are not published. No implementation or repository test changes are included in this review. The author's mutation-check and separate local Node 18/22 claims were not independently replayed.

The only intended publication is this review document. Its commit creates a new PR head; CI for that exact documentation head is checked separately after publication. No merge, close, branch deletion, or implementation fix is part of this review.
