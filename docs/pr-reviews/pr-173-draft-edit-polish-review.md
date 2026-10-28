# PR Review — Draft Edit Slice 3: submenu, spelling convention and selection-scoped flags

**Author:** okeylanders · **PR:** [#173](https://github.com/okeylanders/prose-minion-vscode/pull/173)

**Branches:** `claude/upbeat-galileo-y1l4yf` → `epic/lightbox`

**Reviewed implementation head:** `1b63e91b8e30e82ddc1bb2010f85d8957fad0d60`

**Base and merge-base:** `daec95d342800a1eb12af7befc20634e610fb444`

**Scope:** 25 changed files · +1,062 / −91

**Reviewed:** 2026-10-26 · **Reviewer:** Astra

**Mode:** independent complete-diff and contracts review; production command/use-case/service/adapter execution with synthetic passages and controlled transport/host doubles; pinned VS Code 1.82.0 source checks; local Node 18 aggregate gates.

## Summary

**Approved for merge into `epic/lightbox`. No blocking findings.**

The submenu preserves the existing commands' visibility and relative order. The spelling convention is captured before asynchronous confirmation/progress and reaches every chunk as a separate request field without weakening the existing guard. Selection runs retain only the earlier outside flags that are still shown, with stable IDs and usable quick fixes, while replacing overlapping flags.

**Scope discipline:** Slice 3b is queued documentation, not implemented or cleared by this review. The name/word-list, missing-word, narrative-baseline and document-wide consistency proposals need their own ADR, implementation and verification.

**Accepted risk stays accepted, not fixed:** [PR #172 F-02](pr-172-proofread-and-fix-review.md) remains the writer's explicit trade-off for native Refactor Preview. A held preview can still commit after a language/lifetime change; the run then reports `closed` and does not revive flags. This PR neither fixes that risk nor reintroduces automatic global Discard. Native VS Code interaction and live proofreading quality were not run here and remain separate acceptance checks.

## Findings

No new correctness, security or architectural blocker was reproduced in this delta.

One non-blocking wording cleanup: [`docs/TOOLS.md`](../TOOLS.md#6-proofread) now introduces both Flag and Fix but retains an unqualified **“Never changes the text”** bullet. Label it **“Proofread and Flag never changes the text”** so that the introductory safety promise cannot be read as applying to Fix. The following Fix bullet accurately explains its writes; this is not a reason to block the integration.

## Independent verification

Read `AGENTS.md` (the `.ai/central-agent-setup.md` source), the Draft Edit ADR and Slice 3 amendment, slice plans, new tests, unchanged ownership/lifecycle contracts and the final PR #172 dispositions. There is no repository `.agents/skills` directory or dedicated PR-review template; this uses the existing `docs/pr-reviews` format. No functional source, tests, manifest, dependencies or prior report was changed by the reviewer.

### Menus, command titles and spelling

- Compared the prior flat manifest with the new submenu over supported language/selection states. Existing per-item `when` conditions and order are retained; Clear stays out deliberately. Explorer/editor-title Lightbox labels lose the prefix intentionally, while palette titles retain the category.
- Verified the engine-floor source, rather than treating the test's menu interpreter as the host: submenu contributions are supported, empty submenu actions are removed, group/order/title sorting is implemented, ordinary menu actions use the command title, and palette actions prepend the category. An isolated VM execution of the official menu/label code passed 30 base-versus-head context comparisons; registry and context services were controlled doubles, not a native UI. Sources: [menu registration](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/services/actions/common/menusExtensionPoint.ts), [menu service](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/platform/actions/common/menuService.ts), [menu action label](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/platform/actions/common/actions.ts), [palette labels](https://github.com/microsoft/vscode/blob/1.82.0/src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts).
- Independently exercised all four named conventions and automatic/invalid-value fallback through commands and request construction, including changes while confirmation/progress is deferred. A gesture's setting is not replaced by a later setting or editor focus.
- Checked that every chunk receives the same chosen convention beside its quoted passage; the prompt and manifest match the domain list. No additional provider call, credential owner or host dependency is introduced. The existing edit-distance, line-break and Markdown-structure guards remain authoritative; receiving a spelling convention is not permission for an unrestricted rewrite.

### Selection ownership and lifetime

Independent tests use the production `DraftEditUseCase`, `DraftEditApplier`, `VsCodeDocumentEditor` and `VsCodeIssueAnnotator` over the controlled VS Code host, not only the lightweight core fakes.

- Flags immediately adjacent to either selection boundary survive; a flag crossing a boundary is replaced. Whole-file runs still replace all flags.
- Prefix edits move retained occurrences without changing their IDs; an edited-away and subsequently retyped typo is not treated as the original flag.
- Selection preview partial acceptance and Discard preserve outside flags and leave the appropriate selected findings; Clear and Dismiss during held preview do not resurrect the withdrawn outside flags.
- Close/reopen and language-change lifetime controls suppress all revived flags, with the already accepted native write race distinguished from flag publication.
- Another document's flags stay independent. Retained mechanical fixes still apply at their current ranges; judgment suggestions remain excluded from Fix all but can be explicitly chosen.
- A 1,000-fix selection, applied through a native-shaped coalesced event, reports 1,000 applied, zero unknown, and retains the two outside flags. A contiguous selection's write span does not encompass the earlier outside flags.
- Counts distinguish new findings from `kept`, and Show Problems remains available when only earlier flags survive. No thresholds changed.

### Architecture and hygiene

The single core write door and app-to-core barrel boundary remain intact. Production core has no VS Code imports; no new `any` or upward dependency was introduced. Changed production modules stay below 500 lines except the already oversized composition root (`extension.ts`, 844 lines; one setting callback added). The existing oversized assembly test is not a new production responsibility owner. The full implementation delta passes `git diff --check`.

## Gates

Dependencies were reused from the retained review environment, not freshly installed. The lockfile is byte-identical to the preceding reviewed checkout (SHA-256 `65f6ddd8094762e35196e095271b73ee4876237664b2ddc5034b12e6969074ac`), and source aliases resolve into this isolated checkout. Local checks used **Node 18.20.8 / npm 10.8.2**.

| Check | Independent result |
| --- | --- |
| Typecheck | Pass: core, webview and adapter |
| Lint | Pass: 0 errors / 1,133 existing warnings |
| Production build + `verify:bundle` | Pass; three existing webpack size/performance warnings |
| Full repository Jest | Pass: **552 suites / 7,710 tests / 59 snapshots**; exit 0 |
| Independent command/service witnesses | 2 scratch suites / 30 tests pass |
| Independent production-adapter selection witnesses | 1 scratch suite / 20 tests pass |
| Implementation-head push CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40353505582), exact head `1b63e91b` |
| Implementation-head pull-request CI | [Success](https://github.com/okeylanders/prose-minion-vscode/actions/runs/40353985218), exact head `1b63e91b` |
| Whitespace | Pass: implementation delta and report |

Representative commands:

```sh
npm run typecheck
npm run lint
npm run build
npm test -- --maxWorkers=1 --workerIdleMemoryLimit=1000MB \
  --cacheDirectory=../retained-jest-cache
```

Jest emitted its worker-teardown warning after all tests passed (one worker was force-exited); this was not a failed test or a nonzero gate. No `--detectOpenHandles` investigation is claimed.

Scratch evidence and logs are retained outside the checkout in `../pr173-review-evidence/`, including separate `menu/` and `selection/` suites. These are synthetic/public-domain passages, not the writer's manuscript. No native application, live/billable provider, merge, deployment, formal GitHub review or PR comment was invoked.

## Integration and remaining acceptance

**Approve the reviewed implementation for `epic/lightbox`.** No implementation correction is required by this review; the small documentation clarification above is optional.

This is approval of the reviewed Slice 3 implementation for the epic, not a claim that native UI or model-quality acceptance has passed. The remaining human checks are right-click/palette behavior in VS Code, successive section runs with visible Problems/quick fixes, and a British-convention passage such as “color”. Record provider-quality fixtures separately; this review does not claim deterministic spelling accuracy from prompt-contract tests.

The report-only publication's exact-head CI is checked after publication; that is separate from the implementation-head results above.
