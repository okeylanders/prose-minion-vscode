# PR #315: Draw independent Workshop highlight sets in VS Code

- Reviewer: independent Astra 6.2
- Reviewed head: `07a6a92a6359ac1e310318da72be4e78ffccfa52`
- Target: `epic/workshop-persona-highlights` at `0bb448907266dc7c09495cfc1995e7ba87345002`
- Merge base: `28162b11f3c90436023020bad22a1baeb7292898`
- Verdict: **Request changes before merging into the epic.**

## P2: Pending Show can reopen a source tab the writer just closed

In [`VsCodeWorkshopHighlightDocuments.ts:15–17`](../../apps/vscode-extension/src/platform/vscode/VsCodeWorkshopHighlightDocuments.ts#L15-L17), the async reveal trusts that the document model is not closed. Closing the last source tab can leave that model cached. If it happens while Show is awaiting the document, Show can then reopen the file and redraw the marks against the writer's more recent action. Astra reproduced this via the Show gesture and tab-close event using VS Code doubles.

Track the last-tab-close generation for the source URI from the beginning of Show (including the #314 authorization wait) and check it before revealing or drawing. This should still allow Show when the file started closed. Add a regression for a cached model after the last tab closes.

## P3: Identical action labels hide which overlapping mark will be dismissed

[`VsCodeIssueAnnotator.ts:184–187`](../../apps/vscode-extension/src/platform/vscode/VsCodeIssueAnnotator.ts#L184-L187) returns the same “Dismiss this Workshop highlight” label for overlapping marks, although the internal IDs differ. Include the persona/set or a shortened diagnostic label when there is more than one possible target. This is nonblocking on its own.

## Verification

Astra independently passed 172 tests across six repository suites, including activation, editor adapter, anchoring, and architecture. Two additional adapter tests confirmed the findings. Core, webview, and extension typechecks passed; [exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45921239272) passed. No live VS Code GUI/F8 or live inference was run.
