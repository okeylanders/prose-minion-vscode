# Sprint 01 — Workshop Shell (code complete on branch)

**Date:** 2026-07-06
**Epic:** [Workshop editor tab](../.todo/epics/epic-workshop-editor-tab-2026-07-03/epic-workshop-editor-tab-2026-07-03.md) (ADR 2026-07-03)
**Sprint doc:** [.todo/…/sprints/01-shell.md](../.todo/epics/epic-workshop-editor-tab-2026-07-03/sprints/01-shell.md)
**Branch:** `claude/sprint-01-workshop-editor-tab-u49fd5` → PR into `epic/workshop-editor-tab` (pending)

---

## What landed

The second webview surface exists and boots. Zero AI, zero session logic.

- **`WorkshopPanelProvider`** (`apps/vscode-extension/src/application/providers/`)
  — owns one `WebviewPanel` (`proseMinion.workshop`), reveal-if-exists,
  `retainContextWhenHidden: true`, PM book icon on the tab. Constructor takes
  `(extensionUri, coreServices, outputChannel, platform)` — the Sprint 2 seam —
  and `new`-s nothing. Only host-side message handling: `webview_error` boot
  diagnostics into the output channel.
- **`webviewHtml.ts`** — the HTML shell extracted from `ProseToolsViewProvider`
  and shared by both surfaces (one CSP/nonce/assets path). The Workshop root is
  stamped `data-pm-surface="workshop"`; the sidebar's HTML is byte-identical to
  before (inline-padded `#root`, no stamp).
- **`prose-minion.openWorkshop`** command (extension.ts + `contributes.commands`
  + activation event). Command palette only — sidebar button and context-menu
  seeding are Sprint 3.
- **`index.tsx`** branches on the stamp: `<WorkshopApp/>` vs `<App/>`. One
  bundle, two roots.
- **`WorkshopApp.tsx`** — static Direction B layout: header (brand, disabled
  New-session, model + balance placeholders), left rail (pinned-excerpt
  placeholder, context-brief placeholder, tool palette: 6 tools + "All 14
  tools…" ghost), empty thread, disabled composer. Exports `WORKSHOP_TOOLS`,
  the 14-tool catalog whose ids map 1:1 onto `dialogue`/`prose` +
  `WritingToolsFocus` — the wire values Sprint 2 routes on.
- **`workshop.css`** — Frame Minion tokens ported verbatim from
  `docs/design/pm-mock.css` as `--pm-*` custom properties, every rule scoped
  under `[data-pm-surface="workshop"]`. Sidebar untouched (verified).
- **Architecture witnesses** (boundaries.test.ts): webview providers construct
  no services (only `new MessageHandler` sanctioned); WorkshopPanelProvider is
  wired from the composition root's `coreServices` bundle.

## Verification

- Typecheck (3 configs), lint (0 errors), 52 suites / 428 tests, production
  build + verify-bundle: all green.
- `dist/webview.js` 512,088 → 528,443 bytes (+16.0 KB / +3.2%).
- Headless Chromium boot-check of the production bundle: workshop stamp renders
  the Workshop shell (7 palette buttons, disabled composer), no stamp renders
  the sidebar `<App/>`, no cross-surface style leak, no boot errors.
- Outstanding manual step: F5 extension-host click-through of the command.

## Decisions of note

- HTML generation extracted rather than duplicated — "extend the HTML
  generator" read as one generator, two surfaces; prevents CSP/nonce drift.
- Workshop token names mirror the sidebar's `--pm-*` vocabulary but carry the
  FM mock's fixed warm-brown values; the two roots never nest, so no collision.
  Workshop is pinned warm-dark in v1 (no follow-VS-Code mode).
- Rail width fixed at 372px per the prototype; no responsive collapse yet —
  noted as a possible follow-up when the panel is dragged narrow.
