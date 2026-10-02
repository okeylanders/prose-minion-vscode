# PR Review — Workshop branch naming and Dictionary encyclopedia entries

**Author:** okeylanders · **PR:** [#122](https://github.com/okeylanders/prose-minion-vscode/pull/122) (Open at review)
**Branches:** `feature/workshop-smoke-tweaks` → `main`
**Base / merge-base:** `c9e677fffdec41cc8e8cb13ec2f094692c8ea52a`
**Head:** `6b0a05b71bf23806abbb4bd00056afbb09cf5013`
**Scope:** 25 files · +1,142 / −81 · 2 commits
**Reviewed:** 2026-10-02 · **Mode:** focused review with independent Dictionary service/prompt and UI/hook/transport passes. This is not a full specialist panel.

## Resolution ledger

Status legend: **Open** = act before merge · **Deferred** = accepted follow-up · **Addressed** = verified fix · **N/A** = praise or no action. No new deferral is accepted on the author's behalf.

| ID | Sev | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| F-01 | 🟢 Praise | Nested branch names remain labels, while existing persistence protects the source | BigInt suffix folding; digit-growth and surrogate-pair tests; real-coordinator nested-branch test | **N/A** — preserve |
| F-02 | 🟢 Praise | Encyclopedia selection stays explicit across all entry points and selected-block accounting | Utility, service, UI, handler, hook, and Workshop tests; source tracing | **N/A** — preserve |
| F-03 | 🟢 Praise | The expanded appendix is additive, with bounded generation and source-text-free diagnostics | Original resource byte comparisons; Topic retry options; log-field inspection | **N/A** — preserve |

**Verdict:** Approve the reviewed code changes. No Blocking, High, Standard, or Nit code finding survived evidence checking. The checks below support integration; live-model quality and interactive theme/host smoke remain pending product validation, as already recorded in the feature plan.

## Current scope and description drift

The PR description still describes the first commit's always-included Topic section between Collocations and Morphology, along with renumbered later blocks. The reviewed second commit, `6b0a05b`, supersedes that behavior:

- Topic is the optional final section, after AI Advisory Notes.
- The Dictionary switch defaults on and remembers the writer's choice; standard, Fast, and context-menu auto-run use that choice.
- Workshop persona lookup and full-entry calls explicitly disable it.
- Fast retains the original 15 filenames and adds block 16 only when enabled.
- Original dictionary creativity and Sense Explorer wording are restored.

The current feature README, implementation, tests, and changelogs agree on this scope. The stale PR summary is a metadata clarification, not an implementation defect.

## Verification actually run

Checks ran against `6b0a05b` before this documentation-only report was added. Fresh cloud checkout; Node `v24.19.0`, npm `11.9.0`. CI uses Node 18.

| Check | Result |
| --- | --- |
| Live PR / local head / merge-base | ✅ Matching reviewed SHA and base; PR open, non-draft, mergeable |
| GitHub CI `verify` for reviewed head | ✅ [Run 37063563750](https://github.com/okeylanders/prose-minion-vscode/actions/runs/37063563750), including typecheck, tests, lint, and build |
| `npm test -- --runInBand` | ✅ 230 suites / 2,784 tests / 2 snapshots |
| `npm run typecheck` | ✅ Core, webview, extension |
| `npm run lint` | ✅ Exit 0; 0 errors / 1,037 warnings. Baseline lint was not rerun, so no warning-delta claim is made |
| `npm run build` | ✅ Extension/webview production bundles and `verify:bundle`; three webview size/performance warnings, 1.22 MiB bundle |
| Dictionary source/staged resources | ✅ All 20 Markdown files match byte-for-byte; filename sets match with no stale Dictionary resources |
| Original resource preservation | ✅ All 15 existing Fast blocks and `01-dictionary-example.md` match base byte-for-byte |
| `git diff --check origin/main...HEAD` | ✅ |
| Independent Dictionary utility/service checks | ✅ 2 suites / 29 tests; additionally covered by the full run |
| Interactive VS Code host, live providers, visual/theme/screen-reader checks | Not performed |
| VSIX packaging / Marketplace validation | Not performed; no release or version bump |

Dependency installation succeeded with a workspace-compatible npm cache after the default cache path failed. Install lifecycle scripts were disabled locally; CI's ordinary `npm ci` passed. No provider credentials or paid model calls were used.

Governing material: `AGENTS.md`, complete net diff, live PR metadata/comments/reviews, [Rewind/Branch ADR](../adr/2026-09-30-workshop-rewind-and-branch.md), [Dictionary feature plan](../../.todo/features/feature-dictionary-topic-lexicon/README.md), relevant source/tests, build resource staging, and CI workflow. No existing discussion comments or submitted reviews were present. No checkout-local `.agents/skills` directory was available.

## Executive briefing

### F-01 — Branch naming keeps the persistence boundary intact

[WorkshopSessionTitles.ts](../../packages/core/src/application/services/workshop/WorkshopSessionTitles.ts) recognizes only trailing generated suffixes, accumulates repeated suffixes using BigInt, reserves room for the resulting number, and preserves the existing surrogate-pair truncation guard. Ordinary non-suffix uses of “branch” remain part of the title.

The coordinator continues to use its existing Branch transaction and source-file protections. The added integration test branches three times, reads each saved title back, compares every source file byte-for-byte, and verifies that all four sessions remain listed. The helper does not introduce a new identity, write path, codec, or history transformation.

### F-02 — The selection controls the work that is actually performed

[DictionaryUtility](../../packages/core/src/tools/utility/dictionaryUtility.ts) conditionally loads the encyclopedia resource, inserts the enabled section into the primary blueprint, and gives the system and user messages consistent active-selection instructions. Missing-resource fallback honors the same choice.

[DictionaryService](../../packages/core/src/infrastructure/api/services/dictionary/DictionaryService.ts) selects blocks before dispatch. Resource numbering stays tied to the stable registry, while progress totals, ordered assembly, partial failures, and token/cache aggregation reflect only selected blocks. Disabling Topic therefore prevents the extra generation request rather than hiding its output afterward.

The UI's standard, Fast, and context-menu paths forward the persisted choice; both handlers retain it. Workshop's two capability paths explicitly pass false. The switch exposes its accessible name and checked state, is disabled while generating, uses existing theme tokens, retains keyboard-focus styling, and respects reduced motion. These are source/test observations, not a visual-accessibility certification.

### F-03 — Expanded content uses existing execution seams

The original 15 Fast blocks and full reference entry are unchanged from base. The new Topic prompt and fallback distinguish related vocabulary from synonyms/antonyms, label creative associations, and ask for confidently known books as possible further reading rather than fabricated citations.

Only the Topic block receives the expanded 6,000-token / 90-second budget, consistently on the first attempt and retry. Other blocks retain 3,500 tokens / 15 seconds and the existing concurrency limit. New standard/streaming diagnostics record mode, option, output limit, finish reason, completion-token count, cancellation, and Topic-heading presence; they do not log the word, context, or response body.

The existing service is over the repository's preferred file-size target, but this delta stays within its established dictionary orchestration responsibility. No new composition root, provider loop, transport owner, persistence owner, or cross-layer dependency was identified.

## Remaining product validation

These are existing pending checks, not newly discovered code defects or newly waived gates:

1. Recheck the documented enabled `copper` lookup that previously stopped at AI Advisory Notes against this corrected head. The tests prove prompt composition and diagnostic behavior, not model compliance.
2. Run `plosive` through standard and Fast generation; assess developed topics, useful vocabulary relationships, examples, book accuracy, and preservation of the original sections' creative breadth.
3. Run a several-sense word such as `bank` with contextual guidance and inspect sense separation and prioritization.
4. Check the switch in dark, light, sepia, and Follow VS Code themes, including persisted choice and omission in standard, Fast, and persona-triggered results.

The saved `plosive` sample discussed during review does not identify its generating build or mode. It cannot establish a regression in this head; the current requirements deliberately preserve the pre-existing Sense Explorer behavior. A generated answer's linguistic accuracy still needs output-level evaluation.

The separate seven-scenario Workshop release smoke remains pending. This review does not mark it, or any Marketplace release gate, passed. Mocked-provider tests also do not establish live timeout/cancellation behavior, actual provider concurrency, latency, or cost.

## Summary

Approve `6b0a05b` for integration based on the complete delta review, independent passes, successful current CI, and the full local automated checks. Publish this report on the PR branch, require its resulting CI to pass, and refresh the exact head before merging. Live-model and interactive validation retain their existing pending status.
