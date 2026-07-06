# Sprint 01: Shell

**Status**: In Progress
**Priority**: High
**Branch**: `feat/workshop-s1-shell` → PR into `epic/workshop-editor-tab`
**Estimated Effort**: 1–2 days

## Goal

Stand up the second webview surface and prove it boots. A `WorkshopPanelProvider`
owns a `WebviewPanel`; a new command opens it; the shared bundle renders a
distinct `<WorkshopApp/>` root selected by a surface flag; the Frame Minion
design tokens are ported. **Zero AI, zero session logic** — a static layout
that renders.

## Current Reality

- The extension registers exactly one `WebviewViewProvider` today:
  `apps/vscode-extension/src/application/providers/ProseToolsViewProvider.ts`
  (the sidebar). There is no editor-tab surface.
- The webview entry point is
  `packages/core/src/presentation/webview/index.tsx`, rendering `<App/>` into
  `#root`. There is no surface branching.
- Design assets live in `docs/design/`: `pm-mock.css` (Frame Minion tokens —
  warm-brown, coral accent), `pm-direction-b.css`, and the approved
  `Prose Minion - Assistant Tab.html` prototype.

## Tasks

- [ ] Add `WorkshopPanelProvider.ts` under
      `apps/vscode-extension/src/application/providers/` — owns a single
      `vscode.window.createWebviewPanel('proseMinion.workshop', …)` with
      reveal-if-exists and `retainContextWhenHidden: true`. Constructor takes
      `CoreServices` (or the same wrapped deps the sidebar provider takes) —
      **nothing `new`-ed inside**.
- [ ] Register the `prose-minion.openWorkshop` command in `extension.ts` and
      `package.json` (`contributes.commands`); wire a command-palette entry.
      (Sidebar button + editor context-menu seeding land in Sprint 3.)
- [ ] Extend the HTML generator to stamp `<div id="root" data-pm-surface="workshop">`
      for the panel vs. the default for the sidebar.
- [ ] Branch `index.tsx`: read `data-pm-surface`; render `<WorkshopApp/>` when
      `workshop`, else `<App/>`. One bundle, two roots.
- [ ] Add `WorkshopApp.tsx` — static layout only: header (brand, model-select
      placeholder, balance placeholder, New-session button), left rail (pinned
      excerpt placeholder, context-brief placeholder, tool palette), empty
      thread, **disabled** composer.
- [ ] Port Frame Minion tokens from `pm-mock.css` into the webview stylesheet as
      `--pm-*` custom properties / classes, **scoped under the workshop root**
      (`[data-pm-surface="workshop"] …`) so the sidebar is untouched.
- [ ] Extend the architecture/assembly tests (`__tests__/architecture/`) to
      assert the new provider is wired from `CoreServices` and `new`-s nothing.
- [ ] Confirm the panel opens via the command and renders in the extension host.
- [ ] Run lint, typecheck, tests, production build, bundle verification.

## Acceptance Criteria

- `prose-minion.openWorkshop` opens an editor-tab panel titled "Workshop".
- The panel renders `<WorkshopApp/>`; the sidebar still renders `<App/>`.
  Neither leaks the other's styles.
- Reopening the command reveals the existing panel rather than spawning a second.
- The Frame Minion look is visibly applied to the panel and scoped to it.
- The composer is present but disabled (no message path yet).
- Architecture tests pass, including the new provider assertion.
- Bundle verification stays green; note the `dist/webview.js` size delta in the PR.

## Notes / Guardrails

- No `workshop.ts` messages, no handler, no service this sprint — if you reach
  for `ConversationManager`, you've crossed into Sprint 2.
- Measure the bundle delta but **do not** split entries — premature build surgery
  is explicitly rejected by the ADR.
- Keep the model-select and balance widgets as static placeholders; they get
  wired to `useModelsSettings` / `useAccountBalance` in Sprint 2.
