# PR #251 review: Reply Edit Actions declaration

**Verdict: approve the scoped Slice 1 implementation. No blocking findings.**

- **PR:** [#251](https://github.com/okeylanders/prose-minion-vscode/pull/251)
- **Reviewed code head:** `7b8f63ca1d69e5943c5d5171911da1b81e4141da`
- **Base:** `c32a31dce4082a035f29917d1a19561fb8368e6a` (`epic/workshop-reply-edit-actions`)
- **Branch:** `epic/workshop-reply-edit-actions-slice-1-declaration`
- **Reviewed:** 2026-11-10

## Scope and reconciliation

Reviewed all 36 changed paths, the unified reply-tail reader and its consumers, staging identity checks, completion and route wiring, session cloning and validation, webview delivery, transcript/recall projection, prompts, architecture guards, and ADR D1/D2 plus the `editOffers` part of D8. No existing review, inline thread, or report for this head was present when the pass began or at the pre-publication check.

This is a host-only declaration slice. It does not add the press, request/answer protocol, fixes policy, derived offer status, or footer UI. Those are later slices. Scoped approval is not approval of those unbuilt behaviors, a release, or a merge instruction.

## What checked out

1. **The reply tail still has one owner.** The offer tag joins the existing trailer scanner, removal, redaction, and streaming-prefix handling. Mixed and nested trailer cases do not expose offer payloads. The offer is removed before findings and widget interpretation; retained history does not retain its control frame. An offer alone earns no host-authored proposal line.
2. **Offer acceptance is bounded and explicit.** Kinds are closed to fixes/rewrites, at most one kept frame of each kind. The parser rejects unknown elements, malformed targets/counts, over-bound payloads, misplaced/nested/unclosed frames, and duplicates. A kept file-edit proposal suppresses offers, while wholly malformed proposals do not. The 48,000-character limit is applied to the prose completion actually keeps, after widget stripping. Empty or host-written content cannot support an offer.
3. **Identity resolution does not read a baseline.** `resolve` and `stage` share `identify`; the refactor preserves staging's live-buffer/file baseline and class calculation. Offers resolve catalog paths without choosing the first ambiguous file, and excerpt offers bind to the current file identity. Unpersistable identities are dropped. Two kinds may legitimately name the same file.
4. **Completion adopts only its own reply.** Resolved context is matched to the exact returned content. Host and guest replies can carry offers; direct-tool turns cannot. Independent route probes also exercised host synthesis. A cancelled or preempted run waiting on resolution does not publish the obsolete reply or its offers.
5. **Persistence and projections agree.** The optional field has strict bounded shape, unique kinds, persona ownership, and persistable identity. Existing recursive turn cloning covers nested offers. Save/read/hydration preserve them. Both real webview delivery paths remove `documentUri`; transcript, export, recall, and preview intentionally omit offers. No artificial development-checkpoint normalization is introduced.
6. **Prompts and architecture remain aligned.** Teaching is conditional on file edits being enabled; its worked example decodes through the production reader. The current four taught bounds are tested. No `vscode` import was introduced into core, and no new file exceeds 500 lines. The existing larger owners grow at their integration seams.

## Independent verification

Local checks used Node `v24.22.1`, the committed lockfile, and `npm ci --ignore-scripts` with a writable temporary npm cache. No live provider was called.

- `npm run typecheck`: all three stages passed.
- `npm run lint`: **0 errors / 1,165 warnings**, matching the branch's recorded baseline.
- `npm run build`: both webpack bundles and `verify:bundle` passed; three existing webview bundle-size/performance warnings remain.
- Seven focused production suites: **171 tests passed**, covering protocol, unified controls, prompt sync, file identity staging, offer turns, and staged identity persistence.
- Six additional temporary real-router probes: **6/6 passed**. Host reply, guest invitation, and host synthesis each resolve offers without staging cards and strip the URI from both turn/snapshot delivery. Turning file edits off while the provider reply is delayed prevents resolution. Cancelling or preempting while resolution is delayed prevents stale adoption.
- `npm test -- --runInBand`: **802 suites / 11,284 tests / 59 snapshots passed** on the reviewed implementation. The six temporary probes ran separately and are not included in these totals.
- `git diff c32a31dc...7b8f63ca --check`: passed.

The temporary route probes are review-only and are removed before publication. This publication changes only this report; no production code or existing test is changed.

### Exact-code-head CI

Both [push CI 42761673512](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42761673512) and [PR integration CI 42761758075](https://github.com/okeylanders/prose-minion-vscode/actions/runs/42761758075) passed for code head `7b8f63ca` against the stated epic base. The `verify` job's dependency install, all typechecks, tests, lint, and both-bundle build steps were independently checked as successful. The workflow uses Node 18, providing coverage on the CI runtime as well as the local runtime.

Publishing this report creates a separate documentation head and new CI runs. The results above belong to the reviewed code head, not to those future runs.

## Integration and acceptance limits

- **Message Reactions integration still needs review.** Preserve both trailer-table additions and both new completion arguments when combining the epics. `WorkshopRunCompletion.ts` is currently 496 lines; the planned extraction in Reactions matters to that integration. The future combined branch is not covered by this review.
- **Per-snapshot mode/status checks, the press, and fixes enforcement remain Slice 2.** Their absence does not block this declared Slice 1 scope.
- **Offer-only replies retain the documented empty-reply behavior.** Reactions' future fallback line should be reconciled during integration, not silently inferred to exist here.
- No interactive VS Code, live-model, visual, keyboard, or accessibility acceptance was performed. The footer is not built in this slice; the epic's live pass and release-codec decision remain separate.

**Conclusion:** no actionable correctness or security defect found in the reviewed Slice 1 change. No merge, auto-merge, deployment, or unrelated PR changes were performed.
