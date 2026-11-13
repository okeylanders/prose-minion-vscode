# PR #254: Reply Edit Actions Slice 3b review

## Resolution ledger

| Item | Resolution |
|---|---|
| **D1** The requested-rewrite ceiling | **Decided by Okey, 2026-11-10: option A.** The ceiling stays lifted entirely for a requested rewrite, as built, with the whole-short-file consequence stated to him. No code change. Recorded in the ADR's second addendum. The alternatives put to him were a host-enforced passage bound (B) and a higher ceiling (C). |
| **M1** The README merge conflict | Resolved in `1b955b6d` (the epic merged into the slice, all three progress notes kept); verified by the reviewer in `ffc78ccb`. |

- **Reviewed code:** `7a5d332365e1578901ccb8cd691890d54001be27`.
- **Target:** `epic/workshop-reply-edit-actions`, at `cfca765fcc0daf536de7460c5796aa0ec9b7d902`.
- **Date:** 2026-11-10.
- **Verdict:** **No confirmed implementation defect found. Approval is held for the explicit rewrite-policy decision below.** The documentation merge conflict was resolved during review (M1 below).
- **Scope:** Option protocol, reminder delivery, press routing, answer staging, persistence and cloning, derived status, chips and announcements, and the requested-rewrite gateway policy. No production changes or merge performed.

## D1: The ceiling change needs an explicit owner decision

The PR's own description says the coordinator chose to remove the ceiling for requested rewrites and Okey has not confirmed that choice. The slice notes also say to confirm it at review. “Our limit on edits may be too small” supports revisiting the limit; it does not settle whether it should be removed completely. This review does not convert silence into approval.

The implementation matches the proposed policy: [FileEdit.ts:107–132](https://github.com/okeylanders/prose-minion-vscode/blob/7a5d332365e1578901ccb8cd691890d54001be27/packages/core/src/domain/models/FileEdit.ts#L107-L132) removes `ceiling` for `intent: 'rewrites'`. The gateway uses that policy both when planning and before every retry. The intent comes from the host's stored offer kind, not from a model trailer or a webview field. Fixes retain their narrower policy, ordinary proposals keep the ceiling, and older cards without intent keep their original policy.

**Decision needed:** Does Okey want every requested rewrite card to bypass the 60% / 300-character ceiling, with the writer's explicit review and Apply plus the remaining guards controlling the change? Or should requested rewrites keep a bounded or host-enforced passage policy? The current implementation takes the first choice. No alternative limit is selected by this review.

### Concrete consequence to include in that decision

Removing the ceiling permits a `replace` operation to cover an entire short prose file, provided its text fits the ordinary find/replacement bounds and does not cross protected syntax. The `allowsRewrite: false` safeguard rejects the literal `rewrite` operation; it does not reject a semantically whole-file replacement expressed as find/replace. The new “Never the whole file” directive is model teaching, not a host-enforced range rule.

An independent probe used the real `ProjectFileEditGateway`, real `DraftEditApplier`, fake document ports, and a three-paragraph plain Markdown file made from *Alice* prose. It supplied one operation:

```ts
{ op: 'replace', find: entireOriginalFile, with: twoDifferentPlainParagraphs }
```

- With no intent: `refused`, reason `rewrite-ceiling`, with no write.
- With `intent: 'rewrites'`: `applied`.
- The probe assertion that the second case must not apply failed, establishing the behavior. This was an exploratory safety assertion, not a failing shipped regression test.

This is **a policy consequence, not a separate P2 bug**: the addendum explicitly removes the ceiling and lists the retained guard as “no `<rewrite>` of a prose file,” while describing passage-only scope under teaching. The writer still sees the card's diff and must choose Apply or Review in editor. No automatic write or authorization bypass was demonstrated. Please make the consequence explicit when confirming D1; if a host-enforced passage boundary is intended instead, implement and test that requirement before approval.

## M1: Documentation merge conflict resolved

GitHub reports the PR as non-mergeable. A local three-way `git merge-tree --write-tree` against the exact target commit confirms one content conflict in:

`.todo/archive/epics/epic-workshop-reply-edit-actions-2026-11-10/README.md`

The target's additional progress entry overlapped the slice's edits. While the full-suite result was being published, the coordinator merged the target into the slice in `1b955b6d`. A fresh three-way check against the same target is clean, and GitHub reports the branch mergeable. The diff from reviewed code `7a5d3323` to `5e845137` contains only the README's additional progress entry and this review report; production code is unchanged. **M1 is resolved.** No merge or conflict resolution was performed by this reviewer.

## What checked out

- The trailer accepts one to four bounded, one-line option labels only on rewrites; it rejects empty, duplicate, over-bound, and fixes options. Duplicate comparison normalizes to NFC and lowercases. A single option is intentionally allowed.
- A press sends the option index. The host validates it against the stored offer and reads the label from that offer. A missing, extraneous, or nonexistent option is refused; malformed indices do not start a run.
- The chosen option is carried through the request, answer, correlated result, host wording, and retained session records. Status is derived per option, so using one does not consume its siblings or the fixes offer.
- Cloning preserves the options array independently. Rewind, branch, reopen, transcript/export omission of offer metadata, and the no-status-in-persistence rule have focused coverage. An old non-option offer retains its prior behavior.
- Chips preserve fixes-first ordering, label text is rendered as text, pending keys distinguish options, and result correlation distinguishes request, room, source, kind, and option. The five states retain stable focusable controls and their waiting explanations.
- The reminder is guarded by file edits being `ask`, a file-backed excerpt, a persona recipient, and no press. Guest joins are included; tool calls, their synthesis, and direct tool conversations are excluded. The reminder's delimiter is reserved.
- Host-origin intent, the offered-file check, exactly-once quotes, protected regions, structure mode, insertion bounds, and the literal prose `rewrite` refusal remain in place. The requested rewrite's ceiling exception applies consistently on retries.
- Inspected the supplied `8-options.png`, `9-options-answered.png`, and `10-options-narrow.png`. The wide, stateful, and narrow examples are consistent with the UI changes. This is inspection of supplied evidence, not a fresh interactive VS Code pass.

## Independent verification

Checks ran against the reviewed code under Node `v24.22.1`, without live provider calls. Installed dependencies were reused from a checkout with a byte-identical package lockfile.

- `npm run typecheck`: all three stages passed.
- `npm run build`: both bundles and bundle verification passed; existing webpack size warnings remain.
- `npm run lint`: passed, **0 errors and 1,171 warnings**, matching the PR's baseline.
- Option lifecycle focused run: **7 suites / 121 tests passed**, including option routes, persistence, whole-room rewind/branch/reopen, status, footer, chip view, and hook correlation.
- Policy/protocol/reminder focused run: **9 suites / 145 tests passed**, covering the rewrite/fixes gateways, option codec, answer frame, reminder routes, resolver, and prompt synchronization. Together with the lifecycle run: **16 suites / 266 tests passed**.
- Additional temporary whole-file safety probe: **1 passed control and 1 expected failed safety assertion**, described under D1. The probe was outside the repository; no production code or shipped test was changed.
- `git diff --check` reports four added blank lines at EOF, all in changed tests. This is non-blocking whitespace: `WorkshopEditOfferStatus.test.ts:228`, `replyEditOfferPressPromptSync.test.ts:142`, `workshopEditOfferChipView.test.ts:223`, and `workshopReplyEditOffers.test.ts:208`.
- Full `npm test -- --runInBand`: **841 suites / 11,889 tests / 59 snapshots passed**, in 502.82 seconds, with a clean exit. This finished after the initial review publication; the independently observed counts match the PR's report. The verdict and decision gate are unchanged.

## CI and remaining scope

The connector returned no PR-triggered workflow runs and no legacy commit statuses for `7a5d3323`. Those endpoints do not establish that push/check-run CI is green; exact-head CI was not independently verified. The subsequent documentation head `5e845137` has PR CI run `42875893890` in progress. Later report-only commits have their own CI status; no pending run is described as green.

No live model call, Extension Development Host session, or assistive-technology session was run. Whether the firmer teaching plus reminder reliably produces options in the real prompt remains the planned live pass. This review does not mark that slice complete.

The authenticated publishing account is the PR author, so this verdict is recorded in this ledger and a COMMENT review, not a formal self-approval. Resolve D1 and verify CI on the resulting head before treating this PR as ready to merge. M1 is resolved.
