# PR #217 review: Pinned Context live-pass fixes

## Verdict

**Review clear at `dfa108d5e17d995bc85ff714c889725b07a47ac8`. No confirmed introduced defect or blocking finding.** The original 22-attachment failure is corrected, the list now admits 50 files, and larger valid requests receive a truthful final-count refusal. One pre-existing, non-blocking byte-accounting limitation is recorded below rather than treated as a new regression.

- **PR:** [#217](https://github.com/okeylanders/prose-minion-vscode/pull/217)
- **Base:** `epic-pinned-context` at `f2980986bb24d4627ffc60048ae7600020d342ce`
- **Source branch:** `epic-pinned-context-slice-5-live-fixes`
- **Reviewed:** 2026-11-05
- **Scope:** all 11 changed files, the accepted 50-file tuning, both handler intake routes, adjacent write/store/codec contracts, and the affected test coverage.

This is the report's review disposition, not a formal GitHub approval or permission to merge. No product changes, merge, deployment or live provider calls were performed.

## What reviewed cleanly

- Message-shape validation is separated from the durable list limit. Both attachment IDs and catalog keys accept up to 1,000 request items; empty, malformed and larger messages remain refused.
- The writes deduplicate requested paths against the existing list and earlier requested entries before calculating the new total. Existing 49 plus one distinct file succeeds; existing 49 plus two distinct files refuses with **51**, even when the entire request is repeated.
- An over-limit request reaches the writes' explanatory refusal rather than being mislabeled malformed. No partial list is written, and the new candidate files' content is not read before the count check. The normal response may still describe already pinned files.
- The supplied 22-file reproduction passes. Exactly 50 attachments pass; an independent real-handler control also pins exactly 50 catalog resources.
- Existing path validation, catalog ownership, workspace containment, room/revision checks and store commit guards are unchanged. The larger transport ceiling does not bypass them.
- The bound is shared through `PROMPT_BUDGETS`, the codec/store and response totals. The word budget is unchanged. The ADR explicitly accepts up to 50 bounded file reads during New.
- No new host import or architectural owner is introduced. The handler remains 440 lines and the writes 403.

## Independent boundary controls

[Preserved probe](probes/pr-217-pin-boundaries.test.ts.txt), **5 tests passed**:

1. 1,000 repeated attachment IDs pin one file; 1,001 are refused as malformed without writing.
2. The same boundary and deduplication behavior through catalog keys.
3. A duplicated request against an existing 49-file list reports the unique final total, preserves the list on overflow, then succeeds at exactly 50 using the unchanged revision.
4. Exactly 50 distinct catalog keys pin successfully.
5. The UTF-8 size limitation below is recorded with accepted path shapes and safe codec refusal, alongside evidence that the earlier 20-file/128-KiB bounds already had the same class of limitation.

To reproduce, copy the probe to `packages/core/src/__tests__/application/handlers/domain/workshop/WorkshopPinnedContext217.review-probe.test.ts`, then run `npx jest --runInBand --runTestsByPath` with that path. It is kept as `.txt` outside production test discovery. The fifth case documents a limitation, not evidence that the maximum-path guarantee holds.

## N-01 — Low / pre-existing: maximum-path byte sizing assumes ASCII

The amended comment at [`promptBudgets.ts:565–567`](https://github.com/okeylanders/prose-minion-vscode/blob/dfa108d5e17d995bc85ff714c889725b07a47ac8/packages/core/src/shared/constants/promptBudgets.ts#L565-L567), ADR and codec test say fifty maximum-length paths fit in 256 KiB. The test uses only `a`; the path limit counts UTF-16 code units, while the serialized bound counts UTF-8 bytes. Those are not interchangeable.

A concrete accepted-path list has 50 distinct paths, each **1,829 code units**, with normal nested Unicode components. It encodes to **272,985 bytes**, above 262,144, and `prepareWorkshopPinnedContext` correctly refuses it as `too-large`. Its first 20 entries encode to 109,215 bytes. The same underlying issue already existed at the old bounds: 20 longer valid Unicode paths exceed the old 128 KiB ceiling. This PR raises both limits and does not make a previously readable serialized list unreadable.

**Impact and disposition:** unusually long non-ASCII path collections can reach the safe byte refusal before the advertised file/path limits. Preparation refuses before commit, so this is not corrupt persistence or data loss. It does not block the live-pass correction. The documentation's universal guarantee and ASCII-only test are too broad; follow-up should either budget for the worst permitted encoding or describe the independent serialized-size limit, with Unicode/escaping coverage. [Tracked follow-up](../../.todo/tech-debt/2026-11-05-pinned-context-utf8-byte-bound.md).

## Verification

- Isolated checkout of the exact source head. Dependency manifests match the already installed dependency tree; Jest/TypeScript/webpack aliases resolve this checkout's source.
- **Local typecheck:** all three projects passed.
- **Local focused production tests:** **28 suites / 396 tests passed**, covering Pinned Context handler/library/seed/storage/UI behavior, prompt budgets and architecture boundaries.
- **Independent boundary controls:** **5 tests passed**, separately from the production count.
- **Local lint:** **0 errors / 1,165 warnings**, unchanged baseline; run before adding the temporary probe.
- **Local build:** both webpack bundles and the Tailwind sentinel verification passed, with the existing three webview size/performance warnings.
- **CI associated with this exact source head:** [run 42063042015](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42063042015), [verify job](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42063042015/job/127369599279), passed types, **729 suites / 10,244 tests / 59 snapshots**, lint **0 errors / 1,165 warnings**, both bundles and bundle verification.
- CI logs identify checkout `c735c74bc205336ba211be4617e48892d1037ceb`, GitHub's merge candidate combining the exact source head `dfa108d5` with base `f2980986`. This is not a result from an older implementation.
- This report-only publication will trigger a separate CI run; its outcome belongs in the PR discussion after it completes.

Native VS Code live acceptance, native Windows filesystem behavior and the full Slice 5 checklist remain distinct from these automated checks. This review does not claim to complete the remaining human live pass or accept/archive the epic.
