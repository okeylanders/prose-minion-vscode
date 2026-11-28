# PR #314: Show, Clear, and rewind reply highlight sets

- Reviewer: independent Astra 6.2
- Reviewed head: `dcdaad478f0802c038779b83231f219319826c0e`
- Target: `epic/workshop-persona-highlights` at `0bb448907266dc7c09495cfc1995e7ba87345002`
- Merge base: `28162b11f3c90436023020bad22a1baeb7292898`
- Verdict: **Approved for merge into the epic for this slice.** No actionable findings here. This is not an integrated feature sign-off.

## Review

The footer addresses a set by room revision and turn ID. The host resolves the saved reply and reauthorizes its recorded source rather than taking a path from the webview. It invalidates late Show work on replacement, disposal, and Clear, and observes the window-wide clear generation. Rewind uses the whole surviving turn ledger, not just visible turns. The #316 settlement slice's separate writer-consent question does not originate in these explicit Show/Clear controls.

## Verification

Astra independently ran 133 tests in four suites: WorkshopHighlightRoutes, WorkshopTurnFoot, WorkshopRoomHandler.seams, and architecture boundaries. All passed. The exact four slice heads also merged cleanly over the epic tip in a disposable local checkout; that checks compatibility, not behavior of the combined result. [Exact-head CI](https://github.com/okeylanders/prose-minion-vscode/actions/runs/45921187830): in_progress. Route and editor tests used doubles; neither native VS Code/F8 behavior nor live inference was rerun.
