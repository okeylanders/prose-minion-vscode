# PR #283: Round Two integration into main

Reviewed head `b4cd3a73d952ec01737da23f09e5bf0944f4df6a` against main `600cff63`. Tested GitHub's merge candidate `75efae678880a4a015adad659edfb1f0050a31eb`; its tree is identical to the PR head. No product-code blocker identified. One release-validation finding remains.

**P2 — Live-pass setup selects the old branch and can undo the integration fix.** [.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/live-pass.md](../../.todo/epics/epic-everyday-conveniences-round-two-2026-11-17/live-pass.md), lines 4, 16, 375–397. Setup checks out the historical close branch (manifest 2.14.0), not the candidate (2.14.1). Following it yields acceptance evidence for a different tree. Staying on the correct candidate instead makes H6's expected version wrong; H7 explicitly tells the tester to restore 2.14.0 into the 2.14.1 help reference. Point setup at the candidate under test and record its SHA. Read the expected installed version from its manifest, and restore the exact original overview from that checkout before starting the cold-reader recovery test.

**Resolution of prior integration concern:** the PR correctly updates overview.md to 2.14.1. Regenerated all three help tables in memory against the actual manifest; all matched. Ran the staging script and verified that the packaged resource directory contains all nine help files and its overview matches the installed version. This is not a runtime help-version finding.

**Coverage:** Reviewed integration against the previously reviewed slices; the main synchronization changes the help version and preserves main's settings/support work. On the exact merge candidate, all 101 changed Jest suites (1,600 tests) passed, including all five previously failing assertions. Separately, the three main-side regression suites passed (33 tests). Typechecking passed for core, webview and extension. No full-suite, live-model/Extension Development Host, screen-reader, or installed-VSIX run was performed in this review. The 15 product decisions and separately recorded pre-existing debt are not fresh code defects. No merge or product-code change by the reviewer.

## Resolution ledger

| ID | Severity | Finding | Decision | Resolution |
|---|---|---|---|---|
| 1 | P2 | The live pass checks out the 2.14.0 close branch, and H6/H7 hard-code and restore 2.14.0 | Fix | Fixed in `live-pass.md`. The header and setup step 1 name the candidate, PR #283's head (`origin/epic/everyday-conveniences-round-two`, detached), and ask the tester to record its SHA. Setup reads the installed version *V* from `apps/vscode-extension/package.json` (2.14.1 at b4cd3a73). H6 edits "Reference version: *V*" and expects "The installed version is *V*". H7's reset restores the overview from the candidate's own checkout (`git checkout --` the file, `git status` clean) before rebuilding, and its expected refusal names *V*. No 2.14.0 remains in the checklist. |
