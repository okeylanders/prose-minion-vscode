# PR Review — Workshop session recall enablement (Slice 4)

**Author:** okeylanders · **PR:** [#131](https://github.com/okeylanders/prose-minion-vscode/pull/131) (open at review)
**Branches:** `claude/workshop-recall-prompts` → `epic/workshop-session-recall`
**Verified base / merge-base:** `b2fe8ddb6b2fa32cb33ba0f870342157076dc165`
**Reviewed code head:** `34dda149917b07b5ed3582ec9821cfea07d4996c`
**Scope:** 18 files · +873 / −39 · 10 commits
**Reviewed:** 2026-10-06 · **Mode:** fresh thorough review, three independent specialist passes (prompt/codec/runtime contracts; privacy/publication/reopen compatibility; lifecycle/budgets/packaging), integration review, independent probes, and full automated verification

## Resolution ledger

Status legend: **Open** = recommended action · **Deferred** = explicitly accepted follow-up · **Addressed** = independently verified fix · **N/A** = no action. No deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🔵 Nit | The bidirectional prompt-sync witness omits the multi-session full-detail continuation | The renderer emits a seventh shape that works when followed, but the prompt's six examples and test corpus omit it | **Open**, nonblocking coverage/documentation improvement |

**Verdict: Approved for merge into `epic/workshop-session-recall`.** No Blocking, High, or Standard finding was established. F-01 is a completeness gap in the new sync witness, not a demonstrated invocation failure. This approves Slice 4 enablement, subject to required checks on the final branch head; it does not claim Slice 5 live acceptance or authorize a merge.

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
