# Sprint 01 — Workshop Shell: merged into epic branch

**Date:** 2026-07-06
**PR:** [#66](https://github.com/okeylanders/prose-minion-vscode/pull/66) →
`epic/workshop-editor-tab` (merge commit; branch
`claude/sprint-01-workshop-editor-tab-u49fd5`)
**Epic:** [Workshop editor tab](../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md) — progress 1/4
**Review:** [docs/pr-reviews/pr-66-workshop-editor-tab-shell-review.md](../docs/pr-reviews/pr-66-workshop-editor-tab-shell-review.md)

## Outcome

The Workshop editor-tab shell exists and boots behind
`prose-minion.openWorkshop`: `WorkshopPanelProvider` + shared `webviewHtml.ts`
generator, one-bundle-two-roots via the `data-pm-surface` stamp, static
Direction B `<WorkshopApp/>` in Frame Minion tokens scoped under
`[data-pm-surface="workshop"]`. Zero AI, zero session logic by design.

## Review cycle

10-reviewer panel: zero blocking findings; PR headline claims independently
re-verified (byte-identical sidebar HTML, scoped CSS, bundle delta exact).
All 10 Open findings addressed on the branch, notably:

- Architecture witnesses relocated app-side (core no longer fs-reads the shell).
- Sidebar HTML pinned by snapshot; vscode mock grew `Uri.joinPath`.
- `webview_error` unified on one validated/bounded parser
  (`coerceWebviewErrorText` in `@shared/types`) — fixed the sidebar's
  pre-existing flat-shape throw in `UIHandler` (+ regression tests).
- Shared surface contract (`PM_SURFACE_ATTR` / `WebviewSurface`) in
  `@shared/types`; kebab-case `prose-minion.workshop` viewType; honest
  panel-open log; approved Direction B rail six (choreography + show-and-tell,
  not the reference comp's slice).

Deferred findings (#10 ErrorBoundaries, #11 fake-panel fixture, #12
single-services witness, #14 scoped :focus, #15 CSPRNG nonce) + the manual F5
click-through are written into Sprint 02's task list as land-with-the-sprint
items.

## Numbers at merge

- 55 suites / 439 tests (1 snapshot) · lint 0 errors · typecheck ×3 clean
- `dist/webview.js`: 528,566 bytes (+16.1 KB over pre-epic baseline)

## Next

Sprint 02 — Session Spine: `workshop` domain (messages/handler/session
service), 12th `MessageHandler` domain, one streaming turn, reload-safe
host-side thread. Branch from `epic/workshop-editor-tab`.
