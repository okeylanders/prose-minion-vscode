# Workshop Wayfinding aggregate integration review

**Disposition: no actionable technical integration findings at the reviewed epic head.** This is an independent code/test review, not the Slice 8 live pass, a formal GitHub approval or authorization to merge or release.

**Epic head:** `6c12df5bece661912504ae5125928cf9afc904d0`  
**Current main at review:** `24d9d6e56d557435eae81b1d5c1083d901533df4`  
**Merge base:** `cfac12badb0ac024e8963c6709978a9d424226e2`  
**Reviewed:** 2026-11-04

## Scope

Independently reviewed the integrated effects of the rail, reader and provenance, bookmarks, model stamps/slices, session operations and transcript/export/recall boundaries. The earlier slice reviews remain supporting evidence, not a substitute for this aggregate check.

The epic is 127 commits ahead and one behind current main. The one main-side change after the merge base adds a project-memory planning document only. A local merge-tree is conflict-free and its executable/test tree matches the tested epic; the actual final integration PR and its exact merge result must still be reviewed and verified when created.

## Verification

On a clean checkout of exact epic head `6c12df5`, Node 24.22.1 / npm 11.9.0:

- Full Jest: **636 suites / 8,977 tests / 59 snapshots passed**.
- All three typechecks passed.
- Production lint: **0 errors / 1,153 existing warnings**.
- Extension and webview bundles built; bundle sentinel verification passed. Existing webview size warnings remain.
- Two independent mixed-feature App probes passed: a bookmark rename draft survives rail switching, Read in arrivals and model-slice updates, then resets on room replacement while the selected tab persists; reader → out-of-window preview preserves the opener, and replacement rejects late reader/preview replies without restoring old model slices.
- An independent boundary lane passed **36 suites / 514 tests** (33 production suites / 497 tests, two existing probe suites / 14 tests, and a new combined-metadata suite / 3 tests). The combined real coordinator/store/ConversationManager probe exercises bookmarks, model stamps and private resource fingerprints through Open, Rewind, Branch, export and recall. Archive provenance survives, superseded rows recalculate after cuts, JSON keeps intended model/bookmark metadata, and private hashes and navigation metadata stay out of export/preview/recall/provider messages.

GitHub comparison confirms the tested epic differs from the last Slice 7 code head only by its review document. Existing downgrade incompatibility and same-millisecond Read in row ambiguity remain documented debt, not newly discovered findings.

## Remaining acceptance

Native VS Code layout, both themes, keyboard and screen-reader behavior, Open beside, extension reload/restart and live-provider acceptance were not performed here. They remain the explicit Slice 8 human pass. The five writer decisions in that checklist are open; no built default is treated as accepted. The final main integration PR needs its own exact-head/merge-tree and CI check, particularly if main or a decision changes before then.

No implementation change, provider call, formal approval, merge, deployment or release was made.
