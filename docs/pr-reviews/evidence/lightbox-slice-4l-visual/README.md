# Lightbox Slice 4L visual evidence: the Lightbox's own model setting

Lightbox Slice 4L gives the Lightbox a model setting of its own (epic
decision 51). The writer found that choosing a model in the Lightbox cleared
the Workshop's prompt-cache timer: the Lightbox read with the shared
assistant scope, so its picker changed the Workshop's model too, and the
Workshop composer's "Est. Cache Time Remaining" disappeared. Now the
Lightbox has the `lightbox` scope and `proseMinion.lightboxModel`, which
follows the Workshop's model until the writer picks one ("Same as Workshop
(…)").

This folder shows it from real host output at 1440, 1000 and 500 px: the
Lightbox's picker unset and set, the Settings overlay's Lightbox Model row
unset and set, and the Workshop composer's cache estimate before and after a
model is chosen in the Lightbox. The harness follows the earlier Lightbox
evidence folders (`../lightbox-slice-5a2-visual/`).

## What is here

| Path | Contents |
|---|---|
| `lightbox/lightbox-<state>-<width>.png` | The Lightbox: `unset`, `unset-browser`, `set`, `set-browser` |
| `settings/settings-<state>-<width>.png` | The sidebar's Settings overlay, scrolled to its Lightbox Model row: `unset`, `set` |
| `workshop/workshop-<state>-<width>.png` | The Workshop: `before` and `after` a model is chosen in the Lightbox |
| `workshop/workshop-after-cf7f260-<width>.png` | The same `after`, with `cf7f260`'s bundle: the writer's symptom |
| `states/models.json` | The host's messages for each tab (below) |
| `states/log.txt` | Every line the hosts logged while the states were made |
| `tools/build-models.test.ts` | How `states/` was made |
| `harness.js` | Renders a built `webview.js` as the Lightbox, the sidebar and the Workshop behind a stubbed VS Code API, with the page's clock pinned to 3:00 PM UTC on Oct 24, 2026; replays each tab's own host messages; answers the tab's requests with the host's recorded answers; acts as the writer would; screenshots each state once two consecutive frames match; writes `facts.json` and `errors.txt`, and exits 1 when any state is wrong |
| `facts.json` | What each state's page showed, read from the DOM: the header chip's name, the model browser (its "Same as Workshop" card, checked or not, and which model card is checked), the run line, the overlay's Lightbox Model row (value, the option shown, every option, its help), the Workshop composer's cache estimate and the Workshop's own chip, every `set_model_selection` the page posted, and horizontal overflow |
| `errors.txt` | Every page error, console error and failed expectation. Empty for this run |
| `errors-cf7f260.txt` | The same harness against `cf7f260`'s bundle |

### How the states were made

`tools/build-models.test.ts` runs the production `ConfigurationHandler`, one
per webview (the sidebar, the Lightbox, the Workshop), over one settings
store and the production `AIResourceManager` (the composition root's one
instance), with the config watcher's hot-swap and broadcasts as
`MessageHandler` runs them (`modelSettingsHarness`). Beside them run the
production `LightboxHandler`, `LightboxReadingHandler`, `LightboxService` and
`LightboxReadingRunner`, whose engines are that manager and whose prices are
the real `OpenRouterModels` cache. It records:

1. **Each tab's mount:** the `MODEL_DATA` its own host answers with while
   the Lightbox has no model of its own (`following: ['lightbox']`), the
   Lightbox's board, and its estimate, priced on the Workshop's model.
2. **A pick of "Lightbox placeholder"**, for each payload a Lightbox picker
   can post: this branch's (`scope: 'lightbox'`) and `cf7f260`'s (`scope:
   'assistant'`, its header chip's only scope). Each runs on its own hosts:
   what the Lightbox's host answered, the estimate after, the settings and
   engines after, and what the watcher broadcast to the sidebar and the
   Workshop. The harness plays the one the page actually posted.
3. **"Same as Workshop" after this branch's pick:** the setting removed,
   following again.

The builder checks along the way: this branch's pick writes `lightboxModel`
and leaves `assistantModel` and the assistant engine on the Workshop's model,
and the Workshop's broadcast still names it; `cf7f260`'s pick writes
`assistantModel`, and the Workshop's broadcast names the Lightbox's pick;
every model id in the states is a placeholder; the log holds no paragraph of
the chapter.

**Placeholders and stubs.** Three placeholder models, served by a stubbed
catalog fetch: "Workshop placeholder" (`placeholder/workshop-model`, $3 /
$15 per million tokens), "Lightbox placeholder"
(`placeholder/lightbox-model`, $0.80 / $4) and "Other placeholder" (the
other four scopes). `MODEL_DATA`'s `categoryOptions`, the curated category
catalog these pages never read, is left out of the recorded messages so that
every id in them is a placeholder. The prompts are the test harnesses' stub
("SYSTEM" and the file names), as in the earlier folders, so the estimates
price that, not the real prompts. The processed and balance chips are
stubbed as before. No provider was called.

**Not host output:** the Workshop's room, a warm cache on the Workshop's
model four minutes from the pinned clock, written for this evidence in the
host's shape (`workshopRoom()` in the builder).

**Source text.** ¶1–¶8 of Chapter I of Lewis Carroll's "Alice's
Adventures in Wonderland" (1865), public domain: the worked examples'
excerpt. The room's two lines were written for this evidence.

### The states

| State | What the writer did | What it shows |
|---|---|---|
| `lightbox-unset` | Opened the Lightbox | The chip reads "Same as Workshop (Workshop placeholder)" (truncated at its width; its name and tooltip whole). The run line prices the Workshop's model: "7 calls · est. $0.33" |
| `lightbox-unset-browser` | Opened the chip | "Lightbox Model", with "Same as Workshop (Workshop placeholder)" first and checked, and its words: "The Lightbox reads with the Workshop's model and follows it when it changes. Pick a model to give the Lightbox its own; the Workshop keeps its model either way." No model card is checked |
| `lightbox-set` | Picked "Lightbox placeholder" | The page posted `{ scope: 'lightbox', modelId: 'placeholder/lightbox-model' }`. The chip reads "Lightbox placeholder"; the run line prices it: "est. $0.09" |
| `lightbox-set-browser` | Opened the chip again | "Lightbox placeholder" checked; "Same as Workshop (Workshop placeholder)" offered, unchecked |
| `settings-unset` | Opened Settings in the sidebar | "Lightbox Model": "Same as Workshop (Workshop placeholder)", and "Runs the Lightbox's analyses. "Same as Workshop" uses the Assistant Model above and follows it when it changes; pick a model to give the Lightbox its own." |
| `settings-set` | The same, after the Lightbox's pick (the watcher's broadcast) | "placeholder/lightbox-model (Custom)": a model outside the curated list reads "(Custom)" in every row of the overlay, as before. "Same as Workshop (Workshop placeholder)" is the first option |
| `workshop-before` | The Workshop, a turn back | "Est. Cache Time Remaining: 4 min"; its chip "Workshop placeholder" |
| `workshop-after` | The same, after the Lightbox's pick (the watcher's broadcast) | Unchanged: "Est. Cache Time Remaining: 4 min", and its chip still "Workshop placeholder" |

At 500 px the Workshop's thread column runs past the window's edge by its
own layout, unchanged by this slice; the facts read the composer's estimate
from the page.

## Results

From the committed `facts.json`, rendered from the bundle `npm run build`
writes at this branch (`webview.js` SHA-256
`6a08cf5c82fb84691c7daba7dde3cef97fd87066e5bfe7144356a540f2b23f45`):
every state shows what its host's messages say; `errors.txt` is empty.

**Against `cf7f260`'s bundle** (`webview.js`
`dcf1b09159aa338130fb4f0f8f982d5815c8334e643549142aa8659c66b22192`, built
the same way from an export of `cf7f260`), the harness writes 36 errors
(`errors-cf7f260.txt`), twelve per width:

- The Lightbox's chip is the assistant model's ("Browse assistant model
  options"), with no "Same as Workshop" choice, and its pick posts `scope:
  'assistant'`.
- The overlay has no Lightbox Model row.
- **The writer's symptom:** after that pick, the Workshop's chip names
  "Lightbox placeholder" and the composer's cache estimate is gone
  (`workshop-after-cf7f260-*.png`).

## Reproducing

```bash
# From the repository root, at this branch:
cp docs/pr-reviews/evidence/lightbox-slice-4l-visual/tools/build-models.test.ts packages/core/src/__tests__/
LIGHTBOX_EVIDENCE_DIR=$PWD/docs/pr-reviews/evidence/lightbox-slice-4l-visual \
  npx jest packages/core/src/__tests__/build-models.test.ts
rm packages/core/src/__tests__/build-models.test.ts
npm run build
node docs/pr-reviews/evidence/lightbox-slice-4l-visual/harness.js \
  apps/vscode-extension/dist/webview.js docs/pr-reviews/evidence/lightbox-slice-4l-visual
```

The harness needs Playwright's Chromium (`/opt/pw-browsers/chromium`, or
`$CHROMIUM_PATH`), and writes three page files (`lightbox.html`,
`sidebar.html`, `workshop.html`) into its output folder; they name the
bundle's absolute path and are not committed.
