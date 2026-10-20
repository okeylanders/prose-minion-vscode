# Lightbox source picker: visual evidence

The writer asked: "Can you make the open excerpt trigger the same modal we use
in the workshop." The Lightbox's source panel now opens the Workshop's "Choose
from project" picker, which is a shared component. The writer then widened the
request: the Lightbox's Context list uses the same picker in attach mode, as
the Workshop's context panel does. This folder shows both, and shows the
Workshop's own excerpt picker before and after the move. The harness is
adapted from
[`../lightbox-launch-entry-points/`](../lightbox-launch-entry-points/README.md),
which is unchanged.

## What is here

| Path | Contents |
|---|---|
| `lightbox/source-browse-<width>.png` | Nothing boarded; the source panel's **Choose from project…** opened the picker, and the catalog arrived. Categories, at 1440, 1000 and 500 px |
| `lightbox/source-chapters-<width>.png` | The same picker inside **Chapters & Scenes**: one click boards a file, so rows are buttons, not checkboxes |
| `lightbox/source-search-<width>.png` | Searching "rabbit" with **Names + content**: the name matches here, plus the host's content matches, with category pills |
| `lightbox/context-attach-<width>.png` | A counted board with one context file on the shelf; the Context list's **Add from project…** opened the picker in attach mode. Inside Characters, the shelf's file (the same file key as its catalog row) reads "attached" and another is checked; the footer totals both selections |
| `lightbox/context-rail-<width>.png` | After **Add 2 files** and the host's answer: the rail lists the three context files |
| `workshop/excerpt-browse-{before,after}-<width>.png` | The Workshop's excerpt card **Choose from project…**, browsing, with the base bundle (before) and this branch's (after), at 1440, 1000 and 500 px |
| `workshop/excerpt-search-{before,after}-<width>.png` | The same, searching "rabbit" with **Names + content** |
| `facts.json` | Per shot: the dialog's eyebrow, description, categories, pills, rows (role, text, disabled), footer and box, a SHA-256 of its markup, the backdrop check (`backdrop`: `onTop` when `document.elementFromPoint` returns the backdrop at each of eight probes outside the dialog, `coversViewport` when its box spans the window), the source panel's and welcome's copy, the context list, whether the source panel's buttons stay inside it, horizontal overflow, and what the page posted |
| `harness.js` | Renders a built `webview.js` as the Lightbox or Workshop surface behind a stubbed VS Code API, drives each state, plays the host's catalog and search answers (echoing each request's id, with a stand-in file key per file), screenshots once two consecutive frames match, and writes `facts.json` |
| `compare.py` | Compares each Workshop shot before and after: differing pixels in the whole shot and inside the dialog's box, and whether the dialog markup hashed the same |

Run it from the repository root after `npm run build`, with a base bundle
built from `epic/lightbox` for the Workshop's before shots:

```
node docs/pr-reviews/evidence/lightbox-source-picker/harness.js apps/vscode-extension/dist/webview.js <outDir> <base webview.js>
python3 -I docs/pr-reviews/evidence/lightbox-source-picker/compare.py <outDir>
```

**How the states were made.** The page receives what the host sends on mount
(the API-key status, model data, the account balance, token totals), then the
board and the context list. The source shots start with no board; the context
shots use the counted board of Lewis Carroll's "Alice's Adventures in
Wonderland", chapter 1 (1865, public domain), read from
[`../lightbox-slice-4-visual/states/chapter.json`](../lightbox-slice-4-visual/states/chapter.json).
The harness plays the host: it answers `lightbox_project_catalog`,
`lightbox_project_catalog_search_results` and `lightbox_context_files` (and
the Workshop's `workshop_context_catalog` and
`workshop_context_search_results`) with a synthetic catalog named for the
same book. As the host does since the PR #154 review, each Lightbox answer
echoes the `requestId` of the request the page posted (F-01), and each
Lightbox catalog row and shelf file carries a `fileKey` (F-02); the harness's
keys are stand-ins, a hash of the synthetic path, since the page only
compares them. The Workshop's catalog carries no key. The model is the
Slice 3 harness's stub, `provider/reader-model` ("Reader model (stub)"). No
provider was called.

**Limitations.**
- This is headless Chromium, not the VS Code webview host. Theme variables are
  stubbed, and fonts come from the system.
- The host is played by the harness. The host routes (the catalog and its
  text-only filter, content search, boarding a picked file, adding context,
  every refusal, containment and the source-request races) are covered by
  `LightboxProjectSource.test.ts`, `LightboxProjectContext.test.ts` and
  `openFileInLightboxOwnership.integration.test.ts`.
- "Explore project folders…" opens VS Code's own file dialog, which cannot be
  captured here; `LightboxAppProjectPicker.test.tsx` pins that it posts
  `lightbox_pick_source_file` (source) and `lightbox_add_context_files`
  (context).
- Late, out-of-order and canceled answers, and two workspace folders that
  share a display path, are not staged here. They are covered end to end by
  `LightboxProjectPickerReplies.test.tsx` and
  `LightboxProjectPickerMultiRoot.test.tsx`, through the real handlers.

## Results

From `facts.json` and `compare.py`, against the bundles built after the
PR #154 review fixes (`webview.js` SHA-256
`56749f8e761a1c38d762233ee947506a31a1d7c1cea829ac7961d6b88031e826`) and at
`epic/lightbox` `59b57b6` (base, `1f78a57895662bd001d4d69037b98e887c2c6183af4bce2eb49bba24dd55129b`).
The first set of shots was taken at `2cf1f97`; the regenerated set matches
it pixel for pixel in every Lightbox shot but one, `context-attach-1000`,
where 10 pixels along the Lightbox logo's lower edge, under the backdrop,
differ (raster noise; the dialog is unchanged), and adds the Workshop's
500 px shots and the backdrop facts.

| State | What the page shows |
|---|---|
| `source-browse` (1440, 1000, 500) | The picker's eyebrow is "Board a source", under the title "Choose from project". Five categories: Characters (3 files · 4.5 KB), Locations & Settings, Themes, Chapters & Scenes (4 files · 47.6 KB), Manuscript. Footer: "Click a file to board it" and Cancel. The page posted only `lightbox_request_project_catalog` |
| `source-chapters` (1440, 1000, 500) | Four chapter rows, each `role="button"` with its size |
| `source-search` (1440, 1000, 500) | Pills "All · 5", "Characters · 1", "Themes · 1", "Chapters & Scenes · 3": three name matches merged with the host's two content matches. The page posted `lightbox_request_project_catalog`, then `lightbox_search_project_catalog` after the debounce |
| `context-attach` (1440, 1000, 500) | Eyebrow "Add context". In Characters, `white-rabbit.md` (on the shelf under the same file key) reads "attached" and is disabled; `cheshire-cat.md` is checked. Footer: "2 files · ~418 words est.", Cancel, **Add 2 files** |
| `context-rail` (1440, 1000, 500) | **Add 2 files** posted one `lightbox_add_project_context` naming `{ characters, Characters/cheshire-cat.md }` and `{ locations, Places/the-long-hall.md }`, in the order chosen. After the host's answer the rail lists white-rabbit (196 w), cheshire-cat (241 w) and the-long-hall (158 w), and the page asked for a fresh estimate (`lightbox_set_lenses`) |
| Source copy (every Lightbox shot without a board) | Source card: "No source yet. Choose a file from your project, right-click a chapter and pick **Open File in Lightbox**, or select a passage and run **Open Selection in Lightbox**." Welcome: "Choose a chapter from your project, right-click one and pick **Open File in Lightbox**, or select a passage and run **Open Selection in Lightbox**. The counted board appears at once and costs nothing: no model is asked." |
| Workshop excerpt picker, before vs after | **0 differing pixels inside the dialog** in all six shots (browse and search, 1440, 1000 and 500), and the dialog's markup hashes the same before and after. Outside the dialog, under the backdrop: 0 pixels in five shots, and 5 pixels (largest channel difference 1) at 500 px browse, in the header's model pill; two runs of the *same* bundle differ there too (below) |
| Backdrop (every shot with a dialog) | `backdrop.onTop` and `backdrop.coversViewport` are true in all 24: the 12 Lightbox picker shots and the 12 Workshop shots, before and after, at 1440, 1000 and 500 px. Each tests eight points outside the dialog |
| Workshop at 500 px, behind the picker | The Workshop keeps its rail and main column side by side, so its main column is cut off at the right, before and after alike. That is older than this branch and tracked in [`2026-10-19-workshop-narrow-width-reflow.md`](../../../../.todo/tech-debt/2026-10-19-workshop-narrow-width-reflow.md) |
| Horizontal overflow | None, in any state or width |
| Source panel buttons | Inside the panel in every shot. The first run found "Choose from project…" running past the rail's edge beside "Re-read file" at 1440 and 1000 px; commit `f959b29` wraps that row, and these shots are after it |

- No page errors in any state or width.
- Two runs of the regenerated harness against the same bundles gave
  byte-identical Lightbox shots. The Workshop shots were identical inside the
  dialog in both runs; outside it, under the backdrop, up to 20 pixels
  (largest channel difference 1) in the header's pills varied between the
  runs, for the base bundle as for the head. `compare.py` therefore reports
  the dialog's own pixels separately.
- At 500 px the backdrop is harder to see against the stacked page. The
  first evidence set only noted that it was on top; this set records it per
  shot, as above (PR #154 N-01).
