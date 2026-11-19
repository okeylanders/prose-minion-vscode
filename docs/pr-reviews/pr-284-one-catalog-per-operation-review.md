# PR #284: one project catalog per operation

**Verdict: fix two issues before merging.** Ordinary session-open and manual scans now build the catalog once, as do the pinned seed/reset/Attach missing paths. The change keeps scan order and aggregate word budgeting intact. The remaining issues are about what changes *during* a scan and what is written *after* one.

### F-01 · P2 · An old catalog can authorize a folder the writer just removed

[WorkshopContextIntakeService.ts:385–414](../../packages/core/src/application/services/workshop/WorkshopContextIntakeService.ts#L385-L414) resolves the source against the operation’s cached listing, then asks for the **current** workspace folders. If a secondary folder is removed during a multi-file refresh, later attachments from it no longer have a current workspace root, but an exact match from the earlier listing still takes the external-catalog success branch. That skips the live workspace-path check and can refresh the room with content from a folder that is no longer open. Previously those later files got a new listing. This matters even if no files change on disk.

Keep the fast path for a stable workspace, but bind the listing to the roots it was built for; if those roots change, stop using the snapshot as authority and refuse or safely restart. Add coverage for a workspace-folder change between ordinary reads, alongside the existing one-build test.

### F-02 · P2 · A second Output line still contains attachment names

[WorkshopContextHandler.ts:303–306, 320–321](../../packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L303-L321) appends the human-facing refresh summary to Output after the new counts-only line. [The formatter](../../packages/core/src/application/handlers/domain/workshop/WorkshopContextHandler.ts#L986-L1003) includes labels for changed, truncated, and refused files. Those pre-existing writes contradict this PR’s new counts-only logging contract. The privacy test filters for the literal phrase `Context scan` before looking for names, so it discards the line that contains them.

Keep the detailed names in the writer-facing status and room notice. Remove the duplicate detailed Output writes and assert against all handler Output lines for both the changed and refusal-only cases.

### Scope and verification

- Reviewed `9c5cdb575521dcd24b9de57a40faca4c774a520c` against merged main `62504c1cfaf9d2606cbd4d1677796d9095d15d95`. The catalog change is `74ce33aa`, directly above `b4cd3a73`. The PR also contains `da78858d` (five opt-in model IDs) and a merge of the final epic. The PR description’s “last commit only” is stale. No epic or #285 re-review.
- The local Git merge-tree check was clean; the merged tree differs from the reviewed head only in three main-side planning documents. No runtime or test code differs.
- On the exact code head: **34 Jest suites, 489 tests passed**. Coverage includes one build for 28 attachments, fresh catalogs on repeat scans, pinned fallback after catalog failure, existing context/excerpt routes, model-picker synchronization and model cache policy. `git diff --check` passed. All three TypeScript projects (core, webview, extension) typechecked.
- GitHub [CI #2352](https://github.com/okeylanders/prose-minion-vscode/actions/runs/44406339831) succeeded for the reviewed head. No live model calls, desktop acceptance run, or separate local full-suite run. No product-code edits or merge.
