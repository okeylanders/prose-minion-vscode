# Lightbox launch entry points: visual evidence

This change adds three ways into the Lightbox. A **Lightbox** button sits beside
**Workshop** in the sidebar's Analysis tab. **Open File in Lightbox** appears in
the Explorer, editor title and editor context menus for Markdown and plain-text
files. The tab's empty state now names these ways in. This folder shows the two
webview surfaces that changed. The harness is adapted from
[`../lightbox-slice-2a-visual/`](../lightbox-slice-2a-visual/README.md), which is
unchanged.

## What is here

| Path | Contents |
|---|---|
| `sidebar/sidebar-analysis-<width>.png` | The sidebar's Analysis tab at 430 px (the design's sidebar width), 560 px and 320 px |
| `lightbox/lightbox-empty-<width>.png` | The Lightbox with nothing boarded, at 1440, 1000 and 500 px |
| `facts.json` | What each page showed: the title and launcher boxes, the empty-state copy and horizontal overflow, and what the sidebar posted when its Lightbox button was pressed |
| `harness.js` | Renders a built `webview.js` as the sidebar (an unstamped `#root`) and as the Lightbox surface behind a stubbed VS Code API, screenshots each once two consecutive frames match, presses the sidebar's Lightbox button, and writes `facts.json` |

Run it from the repository root after `npm run build`:

```
node docs/pr-reviews/evidence/lightbox-launch-entry-points/harness.js apps/vscode-extension/dist/webview.js <outDir>
```

**How the states were made.** The page receives what the host sends on mount:
the API-key status, model data, the account balance and token totals. For the
Lightbox it also receives `lightbox_board` with a null board, the host's answer
before any source. The model is the Slice 3 harness's stub,
`provider/reader-model` ("Reader model (stub)"), set for every scope, so no real
model's name is drawn. No provider was called.

**Limitations.**
- This is headless Chromium, not the VS Code webview host. Theme variables are
  stubbed, and fonts come from the system.
- **Native VS Code menus cannot be captured here.** The Explorer context menu,
  the editor context menu and the editor title's `$(layout)` icon are drawn by
  VS Code, not the webview. Their contributions, `when` clauses, icon and
  activation events are pinned instead by the manifest witnesses in
  [`apps/vscode-extension/src/__tests__/architecture/providerAssembly.test.ts`](../../../../apps/vscode-extension/src/__tests__/architecture/providerAssembly.test.ts).
  The command's behavior (which file is boarded, and what is refused) is
  covered by
  [`openFileInLightbox.test.ts`](../../../../apps/vscode-extension/src/__tests__/application/commands/openFileInLightbox.test.ts).
  A live pass in the Extension Development Host is part of the epic's Slice 6.

## Results

From `facts.json`, against the bundle built at this branch's head
(`webview.js` SHA-256 `51c0da369e1398a418679b07026713e63c5991c1c174fca30af001b88b32a9ee`).

| State | What the page shows |
|---|---|
| `sidebar-analysis` 430 | **Workshop** and **Lightbox** share the title row, to the right of "Prose Excerpt Assistant", which wraps to two lines (151 px wide). Both buttons have the same `btn btn-secondary surface-launch-button` style: Workshop 119 px wide, Lightbox 110 px, both 44 px tall |
| `sidebar-analysis` 560 | The title, Workshop and Lightbox fit on one line |
| `sidebar-analysis` 320 | The title takes its own line; the two buttons sit on the next line, right-aligned. Before this layout change, a second button pushed the title under the Workshop button at this width |
| Lightbox press (every width) | The page posted exactly one message: `{"type":"open_lightbox","source":"webview.analysis.tab","payload":{}}` |
| `lightbox-empty` (1440, 1000, 500) | Source card: "No source yet. Choose a file, right-click a chapter and pick **Open File in Lightbox**, or select a passage and run **Open Selection in Lightbox**." Board welcome: "Hold a chapter up to the light." then "Choose a file, right-click a chapter and pick **Open File in Lightbox**, or select a passage and run **Open Selection in Lightbox**. The counted board appears at once and costs nothing: no model is asked." |
| Horizontal overflow | None, in any state or width |
| Models shown | Only the stub: "Reader model (stub)" in the pickers, `provider/reader-model` beside Context Model |

- No page errors in any state or width.
- Three runs of the harness against the same bundle: the screenshots were
  byte-identical except `lightbox-empty-1440` in one run, which differed in 4
  pixels by 1/255 at the model picker's chevron (anti-aliasing).
- The earlier empty state, before this copy, is
  [`../lightbox-slice-2a-visual/lightbox/lightbox-empty-1440.png`](../lightbox-slice-2a-visual/lightbox/lightbox-empty-1440.png)
  (Slice 2A; later slices added the Context and Lenses panels since).
