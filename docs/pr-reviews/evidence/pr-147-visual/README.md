# PR #147 visual evidence: Workshop before and after the full-tab shell

Lightbox Slice 1 moves the Workshop header, chrome and frame styles into a
shared shell, and rescopes those styles from `[data-pm-surface="workshop"]` to
`[data-pm-frame="fulltab"]`. The Workshop should look exactly the same. This
folder holds the screenshots and DOM snapshots that show it does, and the
harness that produced them, so a reviewer can rerun it.

## What is here

| Path | Contents |
|---|---|
| `baseline/` | The bundle built at the merge base `df50039` (`epic/lightbox` before this PR) |
| `result/` | The bundle built at the slice head (`53e5303`; later commits on the branch are docs-only) |
| `*/<state>-<width>.png` | One screenshot per state and width |
| `*/<state>-1440.html` | `#root` outer HTML at 1440 px, for the DOM comparison |
| `harness.js` | Renders a built `webview.js` in Chromium behind a page that mimics `webviewHtml.ts`, with a stubbed VS Code API. Drives each state through window messages and screenshots it once two consecutive frames are byte-identical. |
| `compare.py` | Shot-by-shot pixel and DOM comparison between two runs. Prints a Markdown table. |
| `styleorder.js` | Lists the runtime stylesheet order, to check that the frame sheets load before the Workshop's |

**States:**
- `initial`: before any host message;
- `empty`: session open, no excerpt;
- `excerpt`: an excerpt pinned;
- `paused`: no API key, so the provider-paused banner shows.

**Widths:** 1440, 1000 and 500 px.

**Limitation:** this is headless Chromium, not the VS Code webview host.
Theme variables are stubbed, and fonts come from the system.

## Results

**DOM.** At 1440 px the result's `#root` markup equals the baseline's in all
four states once the new `data-pm-frame="fulltab"` attribute is removed.

**Pixels.** Each bundle was rendered three times. Run-to-run noise is
anti-aliasing flicker: a few dozen pixels at most, usually 1/255 in a single
channel. So the question is whether baseline-vs-result differences exceed
that noise.

| Shot | Baseline vs baseline: max px (max Δ) | Result vs result: max px (max Δ) | Baseline vs result: min–max px (max Δ) |
|---|---|---|---|
| empty-1000 | 0 (0) | 0 (0) | 0–0 (0) |
| empty-1440 | 0 (0) | 32 (1) | 0–32 (1) |
| empty-500 | 0 (0) | 18 (1) | 0–18 (1) |
| excerpt-1000 | 15 (1) | 6 (1) | 0–15 (1) |
| excerpt-1440 | 0 (0) | 22 (1) | 0–22 (1) |
| excerpt-500 | 24 (7) | 24 (7) | 0–24 (7) |
| initial-1000 | 0 (0) | 0 (0) | 0–0 (0) |
| initial-1440 | 0 (0) | 0 (0) | 0–0 (0) |
| initial-500 | 0 (0) | 0 (0) | 0–0 (0) |
| paused-1000 | 0 (0) | 0 (0) | 0–0 (0) |
| paused-1440 | 0 (0) | 0 (0) | 0–0 (0) |
| paused-500 | 0 (0) | 0 (0) | 0–0 (0) |

**Every state at every width has a result run that is pixel-identical to a
baseline run** (the minimum baseline-vs-result difference is 0 throughout).
Every nonzero difference also appears between two runs of the *same* bundle.
The committed `baseline/` and `result/` shots are each side's first run, and
`compare.py baseline result` on them reports at most 32 px at 1/255. A Δ of 7
appears only in `excerpt-500`, and equally between two baseline runs.

**Stylesheet order at runtime** (`styleorder.js`): the full-tab frame sheets
load first, then the Workshop's sheets, then `index.css`. That matches the
pre-slice cascade, where the moved rules sat at the top of the Workshop's
`shell.css`.

## Rerunning it

From a checkout of each commit, with dependencies installed:

```sh
npm run build                                   # writes apps/vscode-extension/dist/webview.js
cp apps/vscode-extension/dist/webview.js /tmp/<side>-webview.js
```

Then, from this folder:

```sh
node harness.js /tmp/base-webview.js /tmp/base 'data-pm-surface="workshop"'
node harness.js /tmp/head-webview.js /tmp/head 'data-pm-surface="workshop" data-pm-frame="fulltab"'
python3 compare.py /tmp/base /tmp/head            # optionally a second base run as a third argument
node styleorder.js /tmp/head/page.html            # runtime stylesheet order (the page the harness wrote)
```

Playwright resolves from the project, then from `PLAYWRIGHT_MODULE`, then from
`/opt/node22/lib/node_modules/playwright`. Chromium resolves from
`CHROMIUM_PATH`, then `/opt/pw-browsers/chromium`, then Playwright's default.
`compare.py` needs Pillow and NumPy. Pass the second root-attribute argument
exactly as shown: the result bundle's styles depend on `data-pm-frame`, which
`webviewHtml.ts` stamps in the real host.
